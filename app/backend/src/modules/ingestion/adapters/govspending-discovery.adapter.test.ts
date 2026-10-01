import assert from 'node:assert/strict'
import test from 'node:test'

import { GovSpendingDiscoveryAdapter } from './govspending-discovery.adapter.js'

test('maps a valid GovSpending project page and encodes its query', async () => {
  let requestedUrl = ''
  const adapter = new GovSpendingDiscoveryAdapter({
    apiKey: 'test-key',
    fetchImpl: (async (input: string | URL | Request) => {
      requestedUrl = input instanceof Request ? input.url : input.toString()
      return Response.json({
        success: true,
        total: 1,
        data: [
          {
            project_id: '67119538991',
            project_name: 'โครงการพัฒนาระบบ',
            year: 2569,
          },
        ],
      })
    }) as typeof fetch,
  })

  const page = await adapter.listProjects({
    fiscalYear: 2569,
    keyword: 'ระบบสารสนเทศ',
    offset: 0,
    limit: 1000,
  })

  const url = new URL(requestedUrl)
  assert.equal(url.searchParams.get('api-key'), 'test-key')
  assert.equal(url.searchParams.get('keyword'), 'ระบบสารสนเทศ')
  assert.deepEqual(page, {
    total: 1,
    projects: [
      {
        externalId: '67119538991',
        title: 'โครงการพัฒนาระบบ',
        fiscalYear: 2569,
        metadata: {
          title: 'โครงการพัฒนาระบบ',
          departmentName: null,
          departmentSubName: null,
          projectStatus: null,
          fiscalYear: 2569,
          announceDate: null,
          budgetBaht: null,
          midPriceBaht: null,
          awardedPriceBaht: null,
        },
      },
    ],
  })
})

test('rejects malformed GovSpending project IDs', async () => {
  const adapter = new GovSpendingDiscoveryAdapter({
    apiKey: 'test-key',
    requestTimeoutMs: 1_000,
    fetchImpl: (async () =>
      Response.json({
        success: true,
        total: 1,
        data: [{ project_id: 'bad-id', project_name: 'Invalid', year: 2569 }],
      })) as typeof fetch,
  })

  await assert.rejects(
    () =>
      adapter.listProjects({
        fiscalYear: 2569,
        keyword: 'software',
        offset: 0,
        limit: 1000,
      }),
    /invalid project-list response/,
  )
})

function listOne(row: Record<string, unknown>) {
  const adapter = new GovSpendingDiscoveryAdapter({
    apiKey: 'test-key',
    fetchImpl: (async () =>
      Response.json({ success: true, total: 1, data: [row] })) as typeof fetch,
  })

  return adapter.listProjects({ fiscalYear: 2568, keyword: 'software', offset: 0, limit: 1 })
}

test('maps GovSpending project metadata', async () => {
  const page = await listOne({
    project_id: '68069160377',
    project_name: 'ประกวดราคาซื้อระบบงานบัญชี',
    year: 2568,
    dept_name: 'การทางพิเศษแห่งประเทศไทย',
    dept_sub_name: 'การทางพิเศษแห่งประเทศไทย (กทพ.) กรุงเทพฯ',
    project_status: 'ระหว่างดำเนินการ',
    announce_date: '19 มิ.ย. 68',
    project_money: 317790000,
    price_build: 317683000,
    sum_price_agree: 155192800,
  })

  assert.deepEqual(page.projects[0]?.metadata, {
    title: 'ประกวดราคาซื้อระบบงานบัญชี',
    departmentName: 'การทางพิเศษแห่งประเทศไทย',
    departmentSubName: 'การทางพิเศษแห่งประเทศไทย (กทพ.) กรุงเทพฯ',
    projectStatus: 'ระหว่างดำเนินการ',
    fiscalYear: 2568,
    announceDate: new Date('2025-06-19T00:00:00Z'),
    budgetBaht: 317790000,
    midPriceBaht: 317683000,
    awardedPriceBaht: 155192800,
  })
})

test('keeps a project whose optional metadata is invalid', async () => {
  const page = await listOne({
    project_id: '68069160377',
    project_name: 'Project',
    year: 2568,
    dept_name: 42,
    price_build: -1,
    sum_price_agree: 'not a number',
    project_money: '1000',
  })

  const metadata = page.projects[0]?.metadata
  assert.equal(metadata?.departmentName, null)
  assert.equal(metadata?.midPriceBaht, null)
  assert.equal(metadata?.awardedPriceBaht, null)
  assert.equal(metadata?.budgetBaht, 1000)
})

test('maps a missing GovSpending announce date to null', async () => {
  const page = await listOne({
    project_id: '68069160377',
    project_name: 'Project',
    year: 2568,
    announce_date: '-',
  })

  assert.equal(page.projects[0]?.metadata.announceDate, null)
})
