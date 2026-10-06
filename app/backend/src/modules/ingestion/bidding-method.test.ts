import assert from 'node:assert/strict'
import test from 'node:test'

import { E_BIDDING_METHOD, extractBiddingMethod } from './bidding-method.js'

test('extractBiddingMethod reads e-bidding from a project title', () => {
  const title =
    'ประกวดราคาซื้อน้ำยาตรวจทางห้องปฏิบัติการ พร้อมกับระบบ Total Lab Automation ด้วยวิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding)'

  assert.equal(extractBiddingMethod(title), E_BIDDING_METHOD)
})

test('extractBiddingMethod reads a wrapped announcement heading', () => {
  const text = `ประกาศ กรมชลประทาน
เรื่อง ประกวดราคาจ้างพัฒนาระบบสารสนเทศ ด้วยวิธี
ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)
-------------------`

  assert.equal(extractBiddingMethod(text), E_BIDDING_METHOD)
})

test('extractBiddingMethod normalizes e-market and specific methods', () => {
  assert.equal(
    extractBiddingMethod('ซื้อคอมพิวเตอร์ ด้วยวิธีตลาดอิเล็กทรอนิกส์ (e-market)'),
    'ตลาดอิเล็กทรอนิกส์ (e-market)',
  )
  assert.equal(extractBiddingMethod('จ้างบำรุงรักษาระบบ โดยวิธีเฉพาะเจาะจง'), 'เฉพาะเจาะจง')
  assert.equal(extractBiddingMethod('จ้างที่ปรึกษา โดยวิธีคัดเลือก'), 'คัดเลือก')
})

test('extractBiddingMethod keeps an unknown method as raw text', () => {
  assert.equal(extractBiddingMethod('จ้างออกแบบ ด้วยวิธีพิเศษ'), 'พิเศษ')
})

test('extractBiddingMethod returns null without a method phrase', () => {
  assert.equal(extractBiddingMethod('จ้างพัฒนาระบบบริหารจัดการข้อมูล'), null)
  assert.equal(extractBiddingMethod(null), null)
})
