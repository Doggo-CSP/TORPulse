import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'

import router from './category.routes.js'

test('GET /categories lists all 8 categories in display order with Thai names', async () => {
  const app = express()
  app.use('/categories', router)

  const response = await request(app).get('/categories')

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, [
    { key: 'web_application', name: 'งานพัฒนาเว็บไซต์' },
    { key: 'data_bi', name: 'งานข้อมูลและวิเคราะห์' },
    { key: 'mobile_app', name: 'งานแอปพลิเคชันมือถือ' },
    { key: 'enterprise_system', name: 'งานระบบองค์กร' },
    { key: 'consulting_architecture', name: 'งานที่ปรึกษาและออกแบบสถาปัตยกรรมระบบ' },
    { key: 'cybersecurity', name: 'งานความมั่นคงปลอดภัยไซเบอร์' },
    { key: 'ai_ml', name: 'งานปัญญาประดิษฐ์และแมชชีนเลิร์นนิง' },
    { key: 'cloud_infrastructure', name: 'งานคลาวด์และโครงสร้างพื้นฐาน' },
  ])
})
