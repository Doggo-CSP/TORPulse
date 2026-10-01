import assert from 'node:assert/strict'
import test from 'node:test'

import { cleanDateText, parseThaiDate, toIsoDateString } from './thai-date.js'

const cases: Array<[string | null, string | null]> = [
  ['2026-01-15', '2026-01-15'],
  ['2569-01-15', '2026-01-15'],
  ['2026-01-15T09:00:00+07:00', '2026-01-15'],
  ['15 มกราคม 2569', '2026-01-15'],
  ['15 มกราคม พ.ศ. 2569 เวลา 16.30 น.', '2026-01-15'],
  ['ภายในวันที่ ๒๐ กุมภาพันธ์ ๒๕๖๙', '2026-02-20'],
  ['19 มิ.ย. 68', '2025-06-19'],
  ['4 ธ.ค. 67', '2024-12-04'],
  ['1 มี.ค. 2569', '2026-03-01'],
  ['15/01/2569', '2026-01-15'],
  ['5-2-69', '2026-02-05'],
  ['มกราคม 2569', null],
  ['31 ก.พ. 68', null],
  ['-', null],
  ['ไม่ระบุ', null],
  ['', null],
  [null, null],
]

for (const [input, expected] of cases) {
  test(`parseThaiDate(${JSON.stringify(input)}) -> ${expected}`, () => {
    assert.equal(toIsoDateString(parseThaiDate(input)), expected)
  })
}

test('cleanDateText drops AI placeholders and keeps real text', () => {
  assert.equal(cleanDateText('null'), null)
  assert.equal(cleanDateText(' - '), null)
  assert.equal(cleanDateText('ไม่ระบุ'), null)
  assert.equal(cleanDateText('มกราคม 2569'), 'มกราคม 2569')
})
