import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'

import { IngestionJobModel } from './ingestion-job.model.js'
import { buildPipelineReport, renderPipelineHtml } from './ingestion-report.js'
import router from './ingestion-report.routes.js'

const rows = [
  { status: 'queued', stage: 'queued', count: 10 },
  { status: 'processing', stage: 'downloading', count: 1 },
  { status: 'skipped', stage: 'fetching_details', count: 6 },
  { status: 'failed', stage: 'fetching_details', count: 2 },
  { status: 'rejected', stage: 'classifying', count: 3 },
  { status: 'completed', stage: 'completed', count: 4 },
  { status: 'failed', stage: 'mystery_stage', count: 1 },
]

test('counts jobs that reached each stage and where the others stopped', () => {
  const report = buildPipelineReport(rows)
  const byStage = Object.fromEntries(report.stages.map((node) => [node.stage, node]))

  assert.equal(report.total, 27)
  assert.equal(report.completed, 4)
  assert.equal(report.unmapped, 1)
  assert.equal(byStage.queued?.reached, 26)
  assert.equal(byStage.fetching_details?.reached, 16)
  assert.equal(byStage.downloading?.reached, 8)
  assert.equal(byStage.classifying?.reached, 7)
  assert.equal(byStage.storing?.reached, 4)
  assert.deepEqual(byStage.fetching_details?.stopped, [
    { status: 'skipped', count: 6 },
    { status: 'failed', count: 2 },
  ])
  assert.deepEqual(byStage.queued?.stopped, [{ status: 'queued', count: 10 }])
})

test('renders every stage, the completed count and escapes text', () => {
  const html = renderPipelineHtml(
    buildPipelineReport([{ status: '<b>x</b>', stage: 'queued', count: 1 }]),
    new Date('2026-01-01T00:00:00Z'),
  )

  assert.match(html, /fetching details/)
  assert.match(html, /completed/)
  assert.match(html, /2026-01-01T00:00:00.000Z/)
  assert.ok(!html.includes('<b>x</b>'))
})

test('GET /report serves HTML and ?format=json serves the numbers', async (context) => {
  context.mock.method(IngestionJobModel, 'aggregate', async () =>
    rows.map(({ status, stage, count }) => ({ _id: { status, stage }, count })),
  )
  const app = express()
  app.use('/ingestion', router)

  const html = await request(app).get('/ingestion/report')
  assert.equal(html.status, 200)
  assert.match(html.headers['content-type'] ?? '', /text\/html/)
  assert.match(html.text, /Ingestion pipeline/)

  const json = await request(app).get('/ingestion/report').query({ format: 'json' })
  assert.equal(json.status, 200)
  assert.equal(json.body.data.completed, 4)
})
