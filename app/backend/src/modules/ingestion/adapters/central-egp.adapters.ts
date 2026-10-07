import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import path from 'node:path'

import { unzipSync, type UnzipFileInfo } from 'fflate'

import {
  extractSubmitDeadlineFromPdf,
  fetchAnnouncementPdf,
  fetchAnnouncementTemplateId,
  type SubmitDeadline,
} from '../egp-submit-deadline.js'
import type {
  DownloadDocument,
  ProcurementProject,
  ProcurementSourceAdapter,
} from './procurement-source.adapter.js'

const EGP_ORIGIN = 'https://process5.gprocurement.go.th'

const METADATA_URL = `${EGP_ORIGIN}/egp-approval-service/apv-common/infoProcureDocAnnounZipTemp`

const DOWNLOAD_URL = `${EGP_ORIGIN}/egp-upload-service/v1/downloadFileTest`

const SEARCH_URL = `${EGP_ORIGIN}/egp-agpc01-web/announcement`

const ANNOUNCEMENT_URL = `${EGP_ORIGIN}/egp-atpj27-service/pb/a-egp-allt-project/announcement`

const TOKEN_URL = `${ANNOUNCEMENT_URL}/generateToken`

const PROJECT_DETAIL_URL = `${ANNOUNCEMENT_URL}/getProjectDetail`

const PROCUREMENT_DETAIL_URL = `${ANNOUNCEMENT_URL}/getProcurementDetail`

/**
 * Central eGP request configuration
 *
 * Start conservatively because eGP does not publicly document
 * the exact rate limit for these endpoints.
 */
const EGP_MIN_REQUEST_INTERVAL_MS = 1_200

const EGP_MAX_RETRIES = 5

const EGP_BASE_RETRY_DELAY_MS = 2_000

const EGP_MAX_RETRY_DELAY_MS = 60_000

const PROJECT_ID_PATTERN = /^\d{11}$/

/**
 * TOR files inside the announcement ZIP, in the order they are sent to the
 * extractor (most important first):
 *
 * tor_<projectId>_<uuid>.pdf   the TOR itself
 * Attach_TOR_<n>.pdf           TOR attachments
 * doc_<deptId>_<projectId>.pdf invitation / bid document
 *
 * annoudoc_*.pdf (the announcement) is intentionally excluded.
 */
const TOR_FILE_PREFIXES = ['tor_', 'attach_tor', 'doc_'] as const

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024
const MAX_ARCHIVE_ENTRIES = 500
const MAX_ENTRY_BYTES = 100 * 1024 * 1024
const MAX_TOTAL_UNCOMPRESSED_BYTES = 500 * 1024 * 1024
const MAX_COMPRESSION_RATIO = 500

interface ArchiveMetadata {
  zipId: string
  archiveName: string
}

export interface CentralEgpProjectDetails {
  departmentName: string
  departmentSubName: string
  projectStatus: string | null
  midPriceBaht: number | null
  awardedPriceBaht: number | null
}

export interface CentralEgpAdapterOptions {
  fetchImpl?: typeof fetch
  requestTimeoutMs?: number
}

/**
 * Special error so the ingestion worker can distinguish
 * rate-limit failures from permanent ingestion failures.
 */
export class CentralEgpRateLimitError extends Error {
  public readonly projectId: string
  public readonly retryAfterMs: number | null

  public constructor(projectId: string, retryAfterMs: number | null = null) {
    super(`Central eGP rate limit exceeded for project ${projectId}`)

    this.name = 'CentralEgpRateLimitError'
    this.projectId = projectId
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Central eGP has no TOR to download for this project (no announcement
 * archive published, or no TOR PDF inside it). Permanent, so the worker
 * should skip the job instead of retrying it.
 */
export class NoTorDocumentsError extends Error {
  public constructor(message: string) {
    super(message)

    this.name = 'NoTorDocumentsError'
  }
}

/**
 * Non-2xx response from a Central eGP endpoint.
 */
export class CentralEgpHttpError extends Error {
  public readonly status: number

  public constructor(message: string, status: number) {
    super(message)

    this.name = 'CentralEgpHttpError'
    this.status = status
  }
}

/**
 * Very small in-process request limiter.
 *
 * Every Central eGP request in this Node process goes through
 * the same queue.
 *
 * Example:
 *
 * request A ─┐
 * request B ─┼──> limiter ──> eGP
 * request C ─┘
 *
 * Request spacing:
 *
 * A
 *   1.2 sec
 * B
 *   1.2 sec
 * C
 */
class EgpRequestLimiter {
  private queue: Promise<void> = Promise.resolve()

  private lastRequestAt = 0

  public async schedule<T>(request: () => Promise<T>): Promise<T> {
    let release!: () => void

    const previous = this.queue

    this.queue = new Promise<void>((resolve) => {
      release = resolve
    })

    await previous

    try {
      const now = Date.now()

      const elapsed = now - this.lastRequestAt

      const waitMs = Math.max(0, EGP_MIN_REQUEST_INTERVAL_MS - elapsed)

      if (waitMs > 0) {
        await sleep(waitMs)
      }

      this.lastRequestAt = Date.now()

      return await request()
    } finally {
      release()
    }
  }
}

/**
 * IMPORTANT:
 *
 * This instance is outside the adapter class intentionally.
 *
 * Multiple CentralEgpAdapter objects inside the same
 * Node process therefore share the same request limiter.
 */
const egpRequestLimiter = new EgpRequestLimiter()

export class CentralEgpAdapter implements ProcurementSourceAdapter {
  private readonly fetchImpl: typeof fetch

  private readonly requestTimeoutMs: number

  private readonly archiveByProjectId = new Map<string, ArchiveMetadata>()

  public constructor(options: CentralEgpAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch

    this.requestTimeoutMs = options.requestTimeoutMs ?? 60_000
  }

  /**
   * Get the complete project information.
   */
  public async getProject(externalId: string): Promise<ProcurementProject> {
    const projectId = externalId.trim()

    assertProjectId(projectId)

    /**
     * Only the archive metadata is needed here. Department, status and
     * prices come from the discovery source (job.sourceMetadata), so the token and
     * detail endpoints are not called during ingestion.
     */
    const metadata = await this.fetchArchiveMetadata(projectId)

    this.archiveByProjectId.set(projectId, metadata)

    const detailUrl = new URL(SEARCH_URL)

    detailUrl.searchParams.set('keywordSearch', projectId)

    return {
      externalId: projectId,

      title: `Central eGP project ${projectId}`,

      detailUrl: detailUrl.toString(),
    }
  }

  /**
   * Retrieve project + procurement details.
   */
  public async getProjectDetails(externalId: string): Promise<CentralEgpProjectDetails> {
    const projectId = externalId.trim()

    assertProjectId(projectId)

    const token = await this.generateAnnouncementToken(projectId)

    const headers = {
      Accept: 'application/json',

      noToken: 'noToken',

      noDataProfile: 'noDataProfile',

      'X-Announcement-Token': token,
    }

    /**
     * These are logically parallel.
     *
     * They still pass through limitedFetch(), so actual
     * HTTP requests are rate limited.
     */
    const [projectPayload, procurementPayload] = await Promise.all([
      this.fetchJson(PROJECT_DETAIL_URL, projectId, headers, 'project detail'),

      this.fetchJson(PROCUREMENT_DETAIL_URL, projectId, headers, 'procurement detail'),
    ])

    const projectDetail = parseDetailData(projectPayload, projectId, 'project detail')

    const procurementDetail = parseDetailData(procurementPayload, projectId, 'procurement detail')

    return {
      departmentName: requiredString(projectDetail.deptName, 'deptName', projectId),

      departmentSubName: requiredString(projectDetail.deptSubName, 'deptSubName', projectId),

      projectStatus: nullableString(procurementDetail.flowName, 'flowName', projectId),

      midPriceBaht: nullablePrice(procurementDetail.priceBuild, 'priceBuild', projectId),

      awardedPriceBaht: nullablePrice(procurementDetail.priceAgree, 'priceAgree', projectId),
    }
  }

  /**
   * Submit deadline from the announcement PDF (ประกาศ), which states the
   * bidding window. Best effort: returns null when the project has no
   * announcement template or the deadline cannot be parsed.
   */
  public async getSubmitDeadline(externalId: string): Promise<SubmitDeadline | null> {
    const projectId = externalId.trim()

    assertProjectId(projectId)

    const fetchImpl = ((input: Parameters<typeof fetch>[0], init?: RequestInit) =>
      this.limitedFetch(input, init, projectId, 'announcement PDF')) as typeof fetch

    try {
      const templateId = await fetchAnnouncementTemplateId(projectId, { fetchImpl })
      if (!templateId) return null

      const pdf = await fetchAnnouncementPdf(templateId, { fetchImpl })
      return await extractSubmitDeadlineFromPdf(pdf)
    } catch (error) {
      console.warn(
        `[Central eGP] Could not read the submit deadline for ${projectId}: ` +
          (error instanceof Error ? error.message : String(error)),
      )
      return null
    }
  }

  /**
   * Download TOR documents.
   */
  public async downloadDocuments(project: ProcurementProject): Promise<DownloadDocument[]> {
    const projectId = project.externalId.trim()

    assertProjectId(projectId)

    const metadata =
      this.archiveByProjectId.get(projectId) ?? (await this.fetchArchiveMetadata(projectId))

    this.archiveByProjectId.set(projectId, metadata)

    const url = new URL(DOWNLOAD_URL)

    url.searchParams.set('fileId', metadata.zipId)

    const response = await this.limitedFetch(
      url,
      {
        headers: {
          Accept: 'application/zip, application/octet-stream',
        },
      },
      projectId,
      'ZIP download',
    )

    if (!response.ok) {
      throw new Error(`Central eGP ZIP download failed (${response.status}) for ${projectId}`)
    }

    const contentLength = Number(response.headers.get('content-length'))

    if (Number.isFinite(contentLength) && contentLength > MAX_ARCHIVE_BYTES) {
      throw new Error(`Central eGP ZIP is larger than ${MAX_ARCHIVE_BYTES} bytes`)
    }

    const archive = await readResponseWithLimit(response, MAX_ARCHIVE_BYTES)

    if (archive.length < 4 || archive[0] !== 0x50 || archive[1] !== 0x4b) {
      throw new Error(`Central eGP returned an invalid ZIP for ${projectId}`)
    }

    const entries = extractTorPdfs(archive)

    const documents = Object.entries(entries)
      .sort(
        ([a], [b]) =>
          torFileRank(a) - torFileRank(b) || a.localeCompare(b, 'en', { numeric: true }),
      )
      .map(([entryName, content]) => ({
        fileName: path.posix.basename(entryName.replaceAll('\\', '/')),

        mimeType: 'application/pdf',

        content: Buffer.from(content),

        sourceUrl: `${url.toString()}#entry=${encodeURIComponent(entryName)}`,
      }))

    if (documents.length === 0) {
      throw new NoTorDocumentsError(
        `No TOR PDF was found in ${metadata.archiveName} for Central eGP project ${projectId}`,
      )
    }

    return documents
  }

  /**
   * Fetch ZIP metadata for the project.
   */
  private async fetchArchiveMetadata(projectId: string): Promise<ArchiveMetadata> {
    const url = new URL(METADATA_URL)

    url.searchParams.set('projectId', projectId)

    const response = await this.limitedFetch(
      url,
      {
        headers: {
          Accept: 'application/json',

          noToken: 'noToken',

          noDataProfile: 'noDataProfile',
        },
      },
      projectId,
      'metadata',
    )

    if (!response.ok) {
      throw new Error(`Central eGP metadata request failed (${response.status}) for ${projectId}`)
    }

    const payload: unknown = await response.json()

    return parseArchiveMetadata(payload, projectId)
  }

  /**
   * Generate the announcement token used by the
   * project-detail endpoints.
   */
  private async generateAnnouncementToken(projectId: string): Promise<string> {
    /**
     * The key is recreated every retry.
     *
     * encryptAnnouncementData() uses a random salt,
     * so we do not keep retrying the exact same encrypted
     * payload.
     */
    const createRequest = (): RequestInit => {
      const key = encryptAnnouncementData(
        encryptAnnouncementData({
          projectId,
        }),
      )

      return {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',

          noToken: 'noToken',

          noDataProfile: 'noDataProfile',
        },

        body: JSON.stringify({
          key,
        }),
      }
    }

    const response = await this.limitedFetch(
      TOKEN_URL,
      createRequest,
      projectId,
      'announcement token',
    )

    if (!response.ok) {
      throw new CentralEgpHttpError(
        `Central eGP token request failed (${response.status}) for ${projectId}`,
        response.status,
      )
    }

    const payload: unknown = await response.json()

    if (!isRecord(payload) || typeof payload.data !== 'string' || payload.data.length === 0) {
      throw new Error(`Central eGP returned a malformed announcement token for ${projectId}`)
    }

    return payload.data
  }

  /**
   * Fetch JSON from one of the announcement endpoints.
   */
  private async fetchJson(
    endpoint: string,
    projectId: string,
    headers: Record<string, string>,
    label: string,
  ): Promise<unknown> {
    const url = new URL(endpoint)

    url.searchParams.set('projectId', projectId)

    const response = await this.limitedFetch(
      url,
      {
        headers,
      },
      projectId,
      label,
    )

    if (!response.ok) {
      throw new CentralEgpHttpError(
        `Central eGP ${label} request failed (${response.status}) for ${projectId}`,
        response.status,
      )
    }

    return response.json()
  }

  /**
   * Single entry point for every Central eGP request.
   *
   * Handles:
   *
   * - request throttling
   * - timeout
   * - HTTP 429
   * - Retry-After
   * - exponential backoff
   * - retryable 5xx responses
   */
  private async limitedFetch(
    input: Parameters<typeof fetch>[0],

    init: RequestInit | (() => RequestInit) | undefined,

    projectId: string,

    label: string,
  ): Promise<Response> {
    for (let attempt = 0; attempt <= EGP_MAX_RETRIES; attempt += 1) {
      const requestInit = typeof init === 'function' ? init() : init

      let response: Response

      try {
        response = await egpRequestLimiter.schedule(() =>
          this.fetchImpl(input, {
            ...requestInit,

            signal: AbortSignal.timeout(this.requestTimeoutMs),
          }),
        )
      } catch (error) {
        /**
         * Network errors / timeout.
         *
         * Retry unless this was the final attempt.
         */
        if (attempt >= EGP_MAX_RETRIES) {
          throw error
        }

        const delayMs = getBackoffDelay(attempt)

        console.warn(
          `[Central eGP] ${label} network error for ${projectId}. ` +
            `Retrying in ${formatDelay(delayMs)} ` +
            `(attempt ${attempt + 1}/${EGP_MAX_RETRIES + 1})`,
        )

        await sleep(delayMs)

        continue
      }

      /**
       * Success / client errors other than 429.
       *
       * Return the response and allow the calling method
       * to handle it.
       */
      if (response.status !== 429 && !isRetryableServerError(response.status)) {
        return response
      }

      /**
       * HTTP 429
       */
      if (response.status === 429) {
        const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))

        if (attempt >= EGP_MAX_RETRIES) {
          console.error(
            `[Central eGP] Rate limit still active after ${EGP_MAX_RETRIES + 1} attempts for ${projectId}`,
          )

          throw new CentralEgpRateLimitError(projectId, retryAfterMs)
        }

        const delayMs = retryAfterMs ?? getBackoffDelay(attempt)

        console.warn(
          `[Central eGP] HTTP 429 while requesting ${label} for ${projectId}. ` +
            `Retrying in ${formatDelay(delayMs)} ` +
            `(attempt ${attempt + 1}/${EGP_MAX_RETRIES + 1})`,
        )

        await sleep(delayMs)

        continue
      }

      /**
       * Temporary eGP 5xx errors.
       */
      if (isRetryableServerError(response.status)) {
        if (attempt >= EGP_MAX_RETRIES) {
          return response
        }

        const delayMs = getBackoffDelay(attempt)

        console.warn(
          `[Central eGP] HTTP ${response.status} while requesting ${label} for ${projectId}. ` +
            `Retrying in ${formatDelay(delayMs)} ` +
            `(attempt ${attempt + 1}/${EGP_MAX_RETRIES + 1})`,
        )

        await sleep(delayMs)

        continue
      }
    }

    /**
     * TypeScript safety fallback.
     *
     * Logically unreachable.
     */
    throw new Error(`Central eGP request retry loop unexpectedly ended for ${projectId}`)
  }
}

/**
 * Retry temporary upstream server failures.
 */
function isRetryableServerError(status: number): boolean {
  return status === 500 || status === 502 || status === 503 || status === 504
}

/**
 * Exponential backoff:
 *
 * attempt 0 -> ~2 sec
 * attempt 1 -> ~4 sec
 * attempt 2 -> ~8 sec
 * attempt 3 -> ~16 sec
 * attempt 4 -> ~32 sec
 * attempt 5 -> max 60 sec
 *
 * A small random jitter prevents many workers from
 * retrying at exactly the same moment.
 */
function getBackoffDelay(attempt: number): number {
  const exponential = EGP_BASE_RETRY_DELAY_MS * 2 ** attempt

  const capped = Math.min(exponential, EGP_MAX_RETRY_DELAY_MS)

  const jitter = Math.floor(Math.random() * 1_000)

  return Math.min(capped + jitter, EGP_MAX_RETRY_DELAY_MS)
}

/**
 * HTTP Retry-After supports:
 *
 * Retry-After: 10
 *
 * or
 *
 * Retry-After: Wed, 16 Sep 2026 15:30:00 GMT
 */
function parseRetryAfter(value: string | null): number | null {
  if (!value) {
    return null
  }

  /**
   * Seconds format
   */
  const seconds = Number(value)

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, EGP_MAX_RETRY_DELAY_MS)
  }

  /**
   * HTTP date format
   */
  const date = Date.parse(value)

  if (Number.isNaN(date)) {
    return null
  }

  const delay = date - Date.now()

  if (delay <= 0) {
    return 0
  }

  return Math.min(delay, EGP_MAX_RETRY_DELAY_MS)
}

function formatDelay(milliseconds: number): string {
  if (milliseconds < 1_000) {
    return `${milliseconds}ms`
  }

  return `${(milliseconds / 1_000).toFixed(1)}s`
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

function encryptAnnouncementData(value: unknown): string {
  /**
   * Match the public e-GP client protocol:
   *
   * CryptoJS AES passphrase encryption
   * using OpenSSL compatible formatting.
   */
  const salt = randomBytes(8)

  const password = Buffer.from('RDCrypto')

  let derived = Buffer.alloc(0)

  let block = Buffer.alloc(0)

  while (derived.length < 48) {
    block = createHash('md5')
      .update(Buffer.concat([block, password, salt]))
      .digest()

    derived = Buffer.concat([derived, block])
  }

  const cipher = createCipheriv(
    'aes-256-cbc',

    derived.subarray(0, 32),

    derived.subarray(32, 48),
  )

  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])

  return encodeURIComponent(
    Buffer.concat([Buffer.from('Salted__'), salt, encrypted]).toString('base64'),
  )
}

function parseDetailData(
  payload: unknown,
  projectId: string,
  label: string,
): Record<string, unknown> {
  if (isRecord(payload) && payload.validateAnnouncementToken === false) {
    throw new Error(`Central eGP rejected the announcement token for ${projectId}`)
  }

  if (!isRecord(payload) || !isRecord(payload.response) || !isRecord(payload.data)) {
    throw new Error(`Central eGP returned malformed ${label} for ${projectId}`)
  }

  if (payload.response.responseCode !== '0') {
    throw new Error(`Central eGP returned unsuccessful ${label} for ${projectId}`)
  }

  if (payload.data.projectId !== projectId) {
    throw new Error(`Central eGP returned mismatched ${label} for ${projectId}`)
  }

  return payload.data
}

function requiredString(value: unknown, field: string, projectId: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Central eGP returned invalid ${field} for ${projectId}`)
  }

  return value.trim()
}

function nullableString(value: unknown, field: string, projectId: string): string | null {
  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error(`Central eGP returned invalid ${field} for ${projectId}`)
  }

  return value.trim() || null
}

function nullablePrice(value: unknown, field: string, projectId: string): number | null {
  if (value === null) {
    return null
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Central eGP returned invalid ${field} for ${projectId}`)
  }

  return value
}

function assertProjectId(projectId: string): void {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new Error('Central eGP project ID must contain exactly 11 digits')
  }
}

function parseArchiveMetadata(payload: unknown, projectId: string): ArchiveMetadata {
  // eGP answers 200 with `data: null` (E0001) when no archive was published.
  if (isRecord(payload) && payload.data === null) {
    throw new NoTorDocumentsError(
      `Central eGP has no announcement archive for project ${projectId}`,
    )
  }

  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error(`Central eGP returned malformed metadata for ${projectId}`)
  }

  const zipId = payload.data.zipId

  const archiveName = payload.data.buildName1

  const returnedProjectId = payload.data.projectId

  if (
    typeof zipId !== 'string' ||
    zipId.length === 0 ||
    typeof archiveName !== 'string' ||
    archiveName.length === 0 ||
    (returnedProjectId !== undefined && returnedProjectId !== projectId)
  ) {
    throw new NoTorDocumentsError(
      `Central eGP has no downloadable announcement archive for ${projectId}`,
    )
  }

  return {
    zipId,
    archiveName,
  }
}

function extractTorPdfs(archive: Uint8Array): Record<string, Uint8Array> {
  let entryCount = 0

  let totalUncompressedBytes = 0

  const files = unzipSync(archive, {
    filter: (entry: UnzipFileInfo) => {
      entryCount += 1

      if (entryCount > MAX_ARCHIVE_ENTRIES) {
        throw new Error(`Central eGP ZIP contains more than ${MAX_ARCHIVE_ENTRIES} entries`)
      }

      assertSafeArchivePath(entry.name)

      totalUncompressedBytes += entry.originalSize

      if (entry.originalSize > MAX_ENTRY_BYTES) {
        throw new Error(`Central eGP ZIP entry is too large: ${entry.name}`)
      }

      if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
        throw new Error('Central eGP ZIP expands beyond the safe size limit')
      }

      const compressionRatio = entry.size === 0 ? Infinity : entry.originalSize / entry.size

      if (entry.originalSize > 0 && compressionRatio > MAX_COMPRESSION_RATIO) {
        throw new Error(`Central eGP ZIP has a suspicious compression ratio: ${entry.name}`)
      }

      return isTorPdf(entry.name)
    },
  })

  for (const [name, content] of Object.entries(files)) {
    if (!Buffer.from(content.subarray(0, 5)).equals(Buffer.from('%PDF-'))) {
      throw new Error(`Central eGP TOR candidate is not a valid PDF: ${name}`)
    }
  }

  return files
}

function assertSafeArchivePath(entryName: string): void {
  const normalized = entryName.replaceAll('\\', '/')

  const segments = normalized.split('/')

  if (
    normalized.includes('\0') ||
    normalized.startsWith('/') ||
    /^[a-zA-Z]:/.test(normalized) ||
    segments.includes('..')
  ) {
    throw new Error(`Central eGP ZIP contains an unsafe path: ${entryName}`)
  }
}

function torFileRank(entryName: string): number {
  const fileName = path.posix.basename(entryName.replaceAll('\\', '/')).toLowerCase()

  if (!fileName.endsWith('.pdf')) {
    return -1
  }

  return TOR_FILE_PREFIXES.findIndex((prefix) => fileName.startsWith(prefix))
}

function isTorPdf(entryName: string): boolean {
  return torFileRank(entryName) !== -1
}

async function readResponseWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) {
    throw new Error('Central eGP ZIP response has no body')
  }

  const reader = response.body.getReader()

  const chunks: Buffer[] = []

  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    totalBytes += value.byteLength

    if (totalBytes > maxBytes) {
      await reader.cancel('Archive exceeded the safe download limit')

      throw new Error(`Central eGP ZIP is larger than ${maxBytes} bytes`)
    }

    chunks.push(Buffer.from(value))
  }

  return Buffer.concat(chunks, totalBytes)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
