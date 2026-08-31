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
    const temp = await response.json()
    console.log(temp, 'raw metadata')
    const metadata = parseArchiveMetadata(temp, projectId)
    this.archiveByProjectId.set(projectId, metadata)

    const detailUrl = new URL(SEARCH_URL)
    detailUrl.searchParams.set('keywordSearch', projectId)

    return {
      externalId: projectId,
      title: `Central eGP project ${projectId}`,
      detailUrl: detailUrl.toString(),
    }
  }

  public async downloadDocuments(project: ProcurementProject): Promise<DownloadDocument[]> {
    const projectId = project.externalId.trim()
    assertProjectId(projectId)

    const metadata =
      this.archiveByProjectId.get(projectId) ??
      (await this.loadArchiveMetadataWithoutReplacingProject(projectId))
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

  private async loadArchiveMetadataWithoutReplacingProject(
    projectId: string,
  ): Promise<ArchiveMetadata> {
    await this.getProject(projectId)
    const metadata = this.archiveByProjectId.get(projectId)

    if (!metadata) {
      throw new Error(`Central eGP archive metadata was not cached for ${projectId}`)
    }

    return metadata
  }
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
