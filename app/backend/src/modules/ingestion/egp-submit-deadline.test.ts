import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DRAFT_ANNOUNCEMENT_STATUS,
  extractAnnounceDate,
  extractAnnouncementStatus,
  extractMidPrice,
  extractSubmitDeadline,
  INVITATION_STATUS,
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

// OpenDataLoader output of a draft (eGP B0) announcement, project 69109017140.
const DRAFT_ANNOUNCEMENT = `# ร่าง

## ประกาศกรุงเทพมหานคร เรื่อง ประกวดราคาจ้างค่าบำรุงรักษาระบบเครือข่ายสื่อสารสายเคเบิลเส้นใยนำแสง

กรุงเทพมหานคร มีความประสงค์จะประกวดราคาจ้าง ... ด้วยวิธีประกวดราคาอิเล็กทรอนิกส์ (ebidding) ราคากลางของงานจ้าง ในการประกวดราคาครั้งนี้ เป็นเงินทั้งสิ้น ๑๕,๕๙๗,๐๗๒.๘๖ บาท (สิบห้า ล้านห้าแสนเก้าหมื่นเจ็ดพันเจ็ดสิบสองบาทแปดสิบหกสตางค์) จำนวน ๑ รายการ
๒. ผู้ยื่นข้อเสนอต้องเสนอราคาทางระบบจัดซื้อจัดจ้างภาครัฐด้วยอิเล็กทรอนิกส์ในวันที่

ระหว่างเวลา น. ถึง น. ซึ่งสามารถจัดเตรียมเอกสารข้อเสนอได้ตั้งแต่วันที่ประกาศจนถึงวันเสนอ ราคา

ประกาศ ณ วันที่ ตุลาคม พ.ศ. ๒๕๖๙

### จีรษา หลักเมือง นักจัดการงานทั่วไปชำนาญการ ประกาศขึ้นเว็บวันที่ ๒ ตุลาคม ๒๕๖๙ โดย นางสาวจีรษา หลักเมือง`

// Published (eGP D0) announcement, project 69099312832; the amount wraps as "เป็น เงินทั้งสิ้น".
const PUBLISHED_ANNOUNCEMENT = `# (สำเนา)

## ประกาศกรุงเทพมหานคร เรื่อง ประกวดราคาจ้างบำรุงรักษาระบบเครือข่ายและโปรแกรมประยุกต์

กรุงเทพมหานคร มีความประสงค์จะประกวดราคาจ้าง ... ราคากลางของงานจ้าง ในการประกวดราคาครั้งนี้ เป็น เงินทั้งสิ้น ๖,๐๕๕,๐๐๐.๐๐ บาท (หกล้านห้าหมื่นห้าพันบาทถ้วน) จำนวน ๑ รายการ

### ประกาศ ณ วันที่ ๑ ตุลาคม พ.ศ. ๒๕๖๙

สุมาลา คำนนท์ เจ้าพนักงานธุรการ ประกาศขึ้นเว็บวันที่ ๑ ตุลาคม ๒๕๖๙ โดย นางสาวสุมาลา คำนนท์`

test('extractAnnouncementStatus tells a draft from a published announcement', () => {
  assert.equal(extractAnnouncementStatus(DRAFT_ANNOUNCEMENT), DRAFT_ANNOUNCEMENT_STATUS)
  assert.equal(extractAnnouncementStatus(PUBLISHED_ANNOUNCEMENT), INVITATION_STATUS)
  // Without the heading, a blank signing day still marks a draft.
  assert.equal(
    extractAnnouncementStatus(DRAFT_ANNOUNCEMENT.replace('# ร่าง', '')),
    DRAFT_ANNOUNCEMENT_STATUS,
  )
  assert.equal(extractAnnouncementStatus('ไม่มีข้อความประกาศ'), null)
})

test('a draft announcement has no submit deadline', () => {
  assert.equal(extractSubmitDeadline(DRAFT_ANNOUNCEMENT), null)
})

test('extractMidPrice reads the ราคากลาง amount in Thai digits', () => {
  assert.equal(extractMidPrice(DRAFT_ANNOUNCEMENT), 15_597_072.86)
  assert.equal(extractMidPrice(PUBLISHED_ANNOUNCEMENT), 6_055_000)
  assert.equal(extractMidPrice('ไม่มีราคา'), null)
})

test('extractAnnounceDate reads the day the announcement went online', () => {
  assert.equal(extractAnnounceDate(DRAFT_ANNOUNCEMENT)?.toISOString(), '2026-10-02T00:00:00.000Z')
  assert.equal(
    extractAnnounceDate(PUBLISHED_ANNOUNCEMENT)?.toISOString(),
    '2026-10-01T00:00:00.000Z',
  )
  assert.equal(extractAnnounceDate('ไม่มีวันที่'), null)
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
