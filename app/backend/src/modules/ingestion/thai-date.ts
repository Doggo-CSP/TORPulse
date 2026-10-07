const THAI_MONTHS: Array<[number, string[]]> = [
  [0, ['มกราคม', 'ม.ค.']],
  [1, ['กุมภาพันธ์', 'ก.พ.']],
  [2, ['มีนาคม', 'มี.ค.']],
  [3, ['เมษายน', 'เม.ย.']],
  [4, ['พฤษภาคม', 'พ.ค.']],
  [5, ['มิถุนายน', 'มิ.ย.']],
  [6, ['กรกฎาคม', 'ก.ค.']],
  [7, ['สิงหาคม', 'ส.ค.']],
  [8, ['กันยายน', 'ก.ย.']],
  [9, ['ตุลาคม', 'ต.ค.']],
  [10, ['พฤศจิกายน', 'พ.ย.']],
  [11, ['ธันวาคม', 'ธ.ค.']],
]

const MONTH_BY_NAME = new Map(
  THAI_MONTHS.flatMap(([month, names]) => names.map((name) => [name, month] as const)),
)

// Full names first so "มีนาคม" is not matched as "มี.ค." fragments.
const MONTH_PATTERN = [...MONTH_BY_NAME.keys()]
  .sort((a, b) => b.length - a.length)
  .map((name) => name.replaceAll('.', '\\.'))
  .join('|')

const THAI_TEXT_DATE = new RegExp(
  `(\\d{1,2})\\s*(${MONTH_PATTERN})\\s*(?:พ\\.ศ\\.|ค\\.ศ\\.)?\\s*(\\d{4}|\\d{2})(?!\\d)`,
  'u',
)
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/
const NUMERIC_DATE = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/

function toArabicDigits(value: string): string {
  return value.replace(/[๐-๙]/gu, (digit) => String(digit.charCodeAt(0) - 0x0e50))
}

/**
 * Thai documents use Buddhist-era years (CE + 543), often as 2 digits
 * ("68" = 2568). 4-digit years above 2400 are treated as BE.
 */
function toGregorianYear(yearText: string): number {
  const year = Number(yearText)
  if (yearText.length === 2) return 2500 + year - 543
  return year > 2400 ? year - 543 : year
}

function utcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month, day))
  // Rejects overflow such as 31 February.
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day
    ? date
    : null
}

/**
 * Parse a date from Thai procurement text into midnight UTC. Supports:
 *
 * "2026-01-15"            ISO (BE years are converted)
 * "15/01/2569", "15-1-69" day/month/year
 * "15 มกราคม 2569"        Thai month name or abbreviation, optional "พ.ศ.", Thai digits
 * "19 มิ.ย. 68"
 *
 * Returns null when no exact day is present ("มกราคม 2569", "-", free text).
 */
export function parseThaiDate(value: string | null | undefined): Date | null {
  const text = toArabicDigits(value?.trim() ?? '')
  if (!text) return null

  const iso = text.match(ISO_DATE)
  if (iso) {
    return utcDate(toGregorianYear(iso[1]!), Number(iso[2]) - 1, Number(iso[3]))
  }

  const thai = text.match(THAI_TEXT_DATE)
  if (thai) {
    return utcDate(toGregorianYear(thai[3]!), MONTH_BY_NAME.get(thai[2]!)!, Number(thai[1]))
  }

  const numeric = text.match(NUMERIC_DATE)
  if (numeric) {
    return utcDate(toGregorianYear(numeric[3]!), Number(numeric[2]) - 1, Number(numeric[1]))
  }

  return null
}

export function toIsoDateString(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null
}

const EMPTY_TEXT = new Set(['', '-', 'null', 'none', 'n/a', 'ไม่ระบุ'])

// The AI sometimes returns placeholders such as "null" or "-" instead of null.
export function cleanDateText(value: string | null | undefined): string | null {
  const text = value?.trim() ?? ''
  return EMPTY_TEXT.has(text.toLowerCase()) ? null : text
}

// The Thai fiscal year starts on 1 October and is numbered in the Buddhist era.
export function getThaiFiscalYear(date = new Date()): number {
  return date.getUTCFullYear() + (date.getUTCMonth() >= 9 ? 544 : 543)
}
