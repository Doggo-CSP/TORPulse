import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import path from 'node:path'

import { unzipSync, type UnzipFileInfo } from 'fflate'

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

const PROJECT_ID_PATTERN = /^\d{11}$/
const TOR_FILE_PATTERN = /(?:^|[_\W])tor(?:[_\W]|$)|ขอบเขต.*งาน/iu
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

export class CentralEgpAdapter implements ProcurementSourceAdapter {
  private readonly fetchImpl: typeof fetch
  private readonly requestTimeoutMs: number
  private readonly archiveByProjectId = new Map<string, ArchiveMetadata>()

  public constructor(options: CentralEgpAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.requestTimeoutMs = options.requestTimeoutMs ?? 60_000
  }

  public async getProject(externalId: string): Promise<ProcurementProject> {
    const projectId = externalId.trim()
    assertProjectId(projectId)

    const [metadata, details] = await Promise.all([
      this.fetchArchiveMetadata(projectId),
      this.getProjectDetails(projectId),
    ])
    this.archiveByProjectId.set(projectId, metadata)

    const detailUrl = new URL(SEARCH_URL)
    detailUrl.searchParams.set('keywordSearch', projectId)

    return {
      externalId: projectId,
      title: `Central eGP project ${projectId}`,
      detailUrl: detailUrl.toString(),
      ...details,
    }
  }

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

  public async downloadDocuments(project: ProcurementProject): Promise<DownloadDocument[]> {
    const projectId = project.externalId.trim()
    assertProjectId(projectId)

    const metadata =
      this.archiveByProjectId.get(projectId) ?? (await this.fetchArchiveMetadata(projectId))
    this.archiveByProjectId.set(projectId, metadata)
    const url = new URL(DOWNLOAD_URL)
    url.searchParams.set('fileId', metadata.zipId)

    const response = await this.fetchImpl(url, {
      headers: { Accept: 'application/zip, application/octet-stream' },
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    })

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
    const documents = Object.entries(entries).map(([entryName, content]) => ({
      fileName: path.posix.basename(entryName.replaceAll('\\', '/')),
      mimeType: 'application/pdf',
      content: Buffer.from(content),
      sourceUrl: `${url.toString()}#entry=${encodeURIComponent(entryName)}`,
    }))

    if (documents.length === 0) {
      throw new Error(
        `No TOR PDF was found in ${metadata.archiveName} for Central eGP project ${projectId}`,
      )
    }

    return documents
  }

  private async fetchArchiveMetadata(projectId: string): Promise<ArchiveMetadata> {
    const url = new URL(METADATA_URL)
    url.searchParams.set('projectId', projectId)
    const response = await this.fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        noToken: 'noToken',
        noDataProfile: 'noDataProfile',
      },
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    })

    if (!response.ok) {
      throw new Error(`Central eGP metadata request failed (${response.status}) for ${projectId}`)
    }

    return parseArchiveMetadata(await response.json(), projectId)
  }

  private async generateAnnouncementToken(projectId: string): Promise<string> {
    const key = encryptAnnouncementData(encryptAnnouncementData({ projectId }))
    const response = await this.fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        noToken: 'noToken',
        noDataProfile: 'noDataProfile',
      },
      body: JSON.stringify({ key }),
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    })

    if (!response.ok) {
      throw new Error(`Central eGP token request failed (${response.status}) for ${projectId}`)
    }

    const payload: unknown = await response.json()
    if (!isRecord(payload) || typeof payload.data !== 'string' || payload.data.length === 0) {
      throw new Error(`Central eGP returned a malformed announcement token for ${projectId}`)
    }

    return payload.data
  }

  private async fetchJson(
    endpoint: string,
    projectId: string,
    headers: Record<string, string>,
    label: string,
  ): Promise<unknown> {
    const url = new URL(endpoint)
    url.searchParams.set('projectId', projectId)
    const response = await this.fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    })

    if (!response.ok) {
      throw new Error(`Central eGP ${label} request failed (${response.status}) for ${projectId}`)
    }

    return response.json()
  }
}

function encryptAnnouncementData(value: unknown): string {
  // Match the public e-GP client protocol: CryptoJS AES passphrase encryption in OpenSSL format.
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

  const cipher = createCipheriv('aes-256-cbc', derived.subarray(0, 32), derived.subarray(32, 48))
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
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new Error(`Central eGP returned invalid ${field} for ${projectId}`)
  }
  return value.trim() || null
}

function nullablePrice(value: unknown, field: string, projectId: string): number | null {
  if (value === null) return null
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
    throw new Error(`Central eGP has no downloadable announcement archive for ${projectId}`)
  }

  return { zipId, archiveName }
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

function isTorPdf(entryName: string): boolean {
  const normalized = entryName.replaceAll('\\', '/')
  const fileName = path.posix.basename(normalized)
  return fileName.toLowerCase().endsWith('.pdf') && TOR_FILE_PATTERN.test(fileName)
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
    if (done) break

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
