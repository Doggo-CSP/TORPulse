export const E_BIDDING_METHOD = 'ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)'

// Checked in order; the first pattern found in the method phrase wins.
const KNOWN_METHODS: Array<[RegExp, string]> = [
  [/e-?bidding|ประกวดราคาอิเล็กทรอนิกส์/iu, E_BIDDING_METHOD],
  [/e-?market|ตลาดอิเล็กทรอนิกส์/iu, 'ตลาดอิเล็กทรอนิกส์ (e-market)'],
  [/ประกวดแบบ/u, 'ประกวดแบบ'],
  [/คัดเลือก/u, 'คัดเลือก'],
  [/เฉพาะเจาะจง/u, 'เฉพาะเจาะจง'],
  [/ประกาศเชิญชวนทั่วไป/u, 'ประกาศเชิญชวนทั่วไป'],
]

const MAX_RAW_LENGTH = 80

// "ประกวดราคาจ้าง... ด้วยวิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding)"
const METHOD_PHRASE = /(?:โดย|ด้วย)วิธี\s*([^()\n]{1,80}?(?:\s*\([^)\n]{1,20}\))?)(?=\s|$|[,.])/u

/**
 * Reads the procurement method from an announcement or project title,
 * e.g. "ด้วยวิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding)". Known methods are
 * normalized to one label; null when the text names no method.
 */
export function extractBiddingMethod(text: string | null | undefined): string | null {
  if (!text) return null

  const match = text.replace(/\s+/gu, ' ').match(METHOD_PHRASE)
  if (!match) return null

  const phrase = match[1]!.trim()
  for (const [pattern, label] of KNOWN_METHODS) {
    if (pattern.test(phrase)) return label
  }
  return phrase.slice(0, MAX_RAW_LENGTH) || null
}
