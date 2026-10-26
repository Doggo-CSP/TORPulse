import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractSubmitDeadline,
  fetchAnnouncementPdf,
  fetchAnnouncementTemplateId,
  formatBangkokDateTime,
} from './egp-submit-deadline.js'

// Wrapped as pdftotext/OpenDataLoader emit it (project 69099462238).
const ANNOUNCEMENT_TEXT = `ผู้ยื่นข้อเสนอต้องยื่นข้อเสนอโดยแสดงหลักฐานถึงขีดความสามารถและความพร้อมที่มีอยู่ใน
วันยื่นข้อเสนอ โดยมีรายละเอียดดังนี้
๑. ผู้ยื่นข้อเสนอจะต้องมีคุณสมบัติให้เป็นไปตามเอกสารประกวดราคาอิเล็กทรอนิกส์กำหนด
๒. ผู้ยื่นข้อเสนอต้องเสนอราคาทางระบบจัดซื้อจัดจ้างภาครัฐด้วยอิเล็กทรอนิกส์ในวันที่ ๙
ตุลาคม ๒๕๖๙ ระหว่างเวลา ๐๙.๐๐ น. ถึง ๑๒.๐๐ น. ซึ่งสามารถจัดเตรียมเอกสารข้อเสนอได้ตั้งแต่วันที่
ประกาศจนถึงวันเสนอราคา
๓. ผู้สนใจสามารถดูรายละเอียด ... จัดจ้างภาครัฐด้วยอิเล็กทรอนิกส์(e-GP)ภายในวันที่ ๖ ตุลาคม ๒๕๖๙`

test('extractSubmitDeadline reads the bidding window end in Bangkok time', () => {
  const deadline = extractSubmitDeadline(ANNOUNCEMENT_TEXT)

  assert.equal(deadline?.date?.toISOString(), '2026-10-09T05:00:00.000Z')
  assert.equal(formatBangkokDateTime(deadline!.date!), '2026-10-09T12:00+07:00')
  assert.equal(deadline?.text, 'ในวันที่ ๙ ตุลาคม ๒๕๖๙ ระหว่างเวลา ๐๙.๐๐ น. ถึง ๑๒.๐๐ น.')
})

test('extractSubmitDeadline ignores the ภายในวันที่ Q&A deadline', () => {
  const text = 'สามารถดูรายละเอียดได้จนถึงวันเสนอราคา หรือสอบถามภายในวันที่ ๖ ตุลาคม ๒๕๖๙'

  assert.equal(extractSubmitDeadline(text), null)
})

test('extractSubmitDeadline falls back to the day when no time is given', () => {
  const deadline = extractSubmitDeadline('กำหนดยื่นข้อเสนอ ในวันที่ 9 ต.ค. 69')

  assert.equal(deadline?.date?.toISOString(), '2026-10-09T00:00:00.000Z')
})

test('extractSubmitDeadline returns null without a deadline sentence', () => {
  assert.equal(extractSubmitDeadline('ประกาศ ณ วันที่ ๑ ตุลาคม พ.ศ. ๒๕๖๙'), null)
})

test('fetchAnnouncementTemplateId returns buildName2', async () => {
  const fetchImpl = (async () =>
    Response.json({
      response: { responseCode: '0' },
      data: { projectId: '69099462238', buildName1: 'x.zip', buildName2: 'tpl-1' },
    })) as typeof fetch

  assert.equal(await fetchAnnouncementTemplateId('69099462238', { fetchImpl }), 'tpl-1')
})

test('fetchAnnouncementPdf POSTs and decodes the base64 PDF', async () => {
  let method: string | undefined
  const fetchImpl = (async (_url: URL, init?: RequestInit) => {
    method = init?.method
    return Response.json({
      response: { responseCode: '0' },
      data: Buffer.from('%PDF-1.7 test').toString('base64'),
    })
  }) as typeof fetch

  const pdf = await fetchAnnouncementPdf('tpl-1', { fetchImpl })

  assert.equal(method, 'POST')
  assert.equal(pdf.toString('latin1'), '%PDF-1.7 test')
})
