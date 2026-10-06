import {
  extractDocumentsToMarkdown,
  OcrRequiredError,
} from './extraction/opendataloader-text-extractor.js'
import { extractBiddingMethod } from './bidding-method.js'
import { parseThaiDate } from './thai-date.js'

const EGP_ORIGIN = 'https://process5.gprocurement.go.th'

// Returns the announcement archive info; buildName2 is the template id of the ประกาศ PDF.
const ANNOUNCEMENT_ZIP_INFO_URL = `${EGP_ORIGIN}/egp-approval-service/apv-common/infoProcureDocAnnounZip`

// POST only (GET returns 405). Responds with { response, data: "<base64 PDF>" }.
const TEMPLATE_PDF_URL = `${EGP_ORIGIN}/egp-template-service/dant/view-pdf`

const DEFAULT_TIMEOUT_MS = 60_000

const BANGKOK_UTC_OFFSET_HOURS = 7

interface EgpEnvelope<T> {
  response?: { responseCode?: string | number | null }
  data?: T | null
}

interface AnnouncementZipInfo {
  projectId?: string
  buildName1?: string | null
  buildName2?: string | null
  buildName3?: string | null
}

export interface FetchOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export interface SubmitDeadline {
  /** The matched sentence fragment, e.g. "ในวันที่ ๙ ตุลาคม ๒๕๖๙ ระหว่างเวลา ๐๙.๐๐ น. ถึง ๑๒.๐๐ น." */
  text: string
  /** End of the bidding window in UTC; midnight UTC of the day when no time is given. */
  date: Date | null
}

export interface AnnouncementInfo {
  deadline: SubmitDeadline | null
  biddingMethod: string | null
}

export async function fetchAnnouncementTemplateId(
  projectId: string,
  { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: FetchOptions = {},
): Promise<string | null> {
  const url = new URL(ANNOUNCEMENT_ZIP_INFO_URL)
  url.searchParams.set('projectId', projectId)

  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`eGP infoProcureDocAnnounZip failed for ${projectId}: HTTP ${response.status}`)
  }

  const payload = (await response.json()) as EgpEnvelope<AnnouncementZipInfo>
  return payload.data?.buildName2?.trim() || null
}

export async function fetchAnnouncementPdf(
  templateId: string,
  { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: FetchOptions = {},
): Promise<Buffer> {
  const url = new URL(TEMPLATE_PDF_URL)
  url.searchParams.set('templateId', templateId)

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`eGP view-pdf failed for template ${templateId}: HTTP ${response.status}`)
  }

  const payload = (await response.json()) as EgpEnvelope<string>
  if (String(payload.response?.responseCode) !== '0' || !payload.data) {
    throw new Error(`eGP view-pdf returned no PDF for template ${templateId}`)
  }

  const pdf = Buffer.from(payload.data, 'base64')
  if (pdf.subarray(0, 4).toString('latin1') !== '%PDF') {
    throw new Error(`eGP view-pdf returned non-PDF data for template ${templateId}`)
  }
  return pdf
}

/** Extracts the PDF text and parses the submit deadline and bidding method; null when the PDF needs OCR. */
export async function extractAnnouncementInfoFromPdf(
  pdf: Buffer,
): Promise<AnnouncementInfo | null> {
  try {
    const text = await extractDocumentsToMarkdown([
      { fileName: 'announcement.pdf', mimeType: 'application/pdf', content: pdf, sourceUrl: '' },
    ])
    return { deadline: extractSubmitDeadline(text), biddingMethod: extractBiddingMethod(text) }
  } catch (error) {
    if (error instanceof OcrRequiredError) return null
    throw error
  }
}

/** Extracts the PDF text and parses the submit deadline; null when the PDF needs OCR. */
export async function extractSubmitDeadlineFromPdf(pdf: Buffer): Promise<SubmitDeadline | null> {
  return (await extractAnnouncementInfoFromPdf(pdf))?.deadline ?? null
}

const DIGIT = '[0-9๐-๙]'

// "เสนอราคา ... ในวันที่ ๙ ตุลาคม ๒๕๖๙ ระหว่างเวลา ๐๙.๐๐ น. ถึง ๑๒.๐๐ น."
// The lookbehind skips "ภายในวันที่", which the announcement uses for the Q&A deadline.
const SUBMIT_DEADLINE = new RegExp(
  `(?:เสนอราคา|ยื่นข้อเสนอ).{0,160}?(?<!ภาย)(ในวันที่\\s*(${DIGIT}{1,2}\\s*\\S+\\s*(?:พ\\.ศ\\.\\s*)?${DIGIT}{2,4})` +
    `(?:\\s*(?:ระหว่าง)?เวลา\\s*${DIGIT}{1,2}[.:]${DIGIT}{2}\\s*น\\.?\\s*ถึง\\s*(${DIGIT}{1,2})[.:](${DIGIT}{2})\\s*น\\.?)?)`,
  'u',
)

export function extractSubmitDeadline(text: string): SubmitDeadline | null {
  // PDF text wraps mid-sentence, so match over a single line.
  const match = text.replace(/\s+/gu, ' ').match(SUBMIT_DEADLINE)
  if (!match) return null

  const [, matchedText, dateText, endHour, endMinute] = match
  const day = parseThaiDate(dateText)
  if (!day || endHour === undefined || endMinute === undefined) {
    return { text: matchedText!, date: day }
  }

  const date = new Date(day)
  date.setUTCHours(
    Number(toArabicDigits(endHour)) - BANGKOK_UTC_OFFSET_HOURS,
    Number(toArabicDigits(endMinute)),
  )
  return { text: matchedText!, date }
}

/** "2026-10-09T12:00+07:00" */
export function formatBangkokDateTime(date: Date): string {
  const local = new Date(date.getTime() + BANGKOK_UTC_OFFSET_HOURS * 3_600_000)
  return `${local.toISOString().slice(0, 16)}+07:00`
}

function toArabicDigits(value: string): string {
  return value.replace(/[๐-๙]/gu, (digit) => String(digit.charCodeAt(0) - 0x0e50))
}
