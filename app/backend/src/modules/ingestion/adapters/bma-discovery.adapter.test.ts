import assert from 'node:assert/strict'
import test from 'node:test'

import { BMA_ANNOUNCE_TYPES, BmaDiscoveryAdapter } from './bma-discovery.adapter.js'

function adapterReturning(body: unknown, onRequest?: (url: URL) => void) {
  return new BmaDiscoveryAdapter({
    requestTimeoutMs: 1_000,
    fetchImpl: (async (input: string | URL | Request) => {
      onRequest?.(new URL(input instanceof Request ? input.url : input.toString()))
      return Response.json(body)
    }) as typeof fetch,
  })
}

const invitationType = BMA_ANNOUNCE_TYPES.find((t) => t.status === 'ประกาศเชิญชวน')!

const listInput = {
  budgetYear: 2570,
  keyword: 'ระบบ',
  announceType: invitationType,
  pageNo: 1,
  pageSize: 100,
}

test('filters the BMA search by keyword, announce-type stage and budget year', async () => {
  let requestedUrl: URL | undefined
  const adapter = adapterReturning(
    { totalCount: 0, hasNextPage: false, data: [] },
    (url) => (requestedUrl = url),
  )

  await adapter.listProjects(listInput)

  assert.equal(requestedUrl?.searchParams.get('projectSearchText'), 'ระบบ')
  assert.equal(requestedUrl?.searchParams.get('masterBudgetYearId'), '2570')
  assert.equal(
    requestedUrl?.searchParams.get('masterAnnounceTypeId'),
    '705f1ffb-82e2-4beb-bdd2-2746f0783bf0',
  )
  // No method filter now: all procurement methods are returned.
  assert.equal(requestedUrl?.searchParams.get('masterMethodIdId'), null)
  assert.equal(requestedUrl?.searchParams.get('pageNo'), '1')
  assert.equal(requestedUrl?.searchParams.get('pageSize'), '100')
})

test('maps a BMA project to a Central eGP project id with metadata', async () => {
  const adapter = adapterReturning({
    totalCount: 1,
    hasNextPage: false,
    data: [
      {
        no: 1,
        projectId: '0819610c-d00d-45aa-8527-abecf9bfdc83',
        projectName: 'ประกวดราคาจ้างบำรุงรักษาระบบเครือข่ายและโปรแกรมประยุกต์',
        projectNumber: '69099316505',
        masterOrgGroupName: 'สำนักดิจิทัลกรุงเทพมหานคร',
        masterOrgDepartmentName: 'สำนักงานพัฒนาระบบสารสนเทศดิจิทัล',
        projectBudget: 7087000,
      },
    ],
  })

  assert.deepEqual(await adapter.listProjects(listInput), {
    total: 1,
    hasNextPage: false,
    skipped: 0,
    projects: [
      {
        externalId: '69099316505',
        title: 'ประกวดราคาจ้างบำรุงรักษาระบบเครือข่ายและโปรแกรมประยุกต์',
        fiscalYear: 2570,
        metadata: {
          title: 'ประกวดราคาจ้างบำรุงรักษาระบบเครือข่ายและโปรแกรมประยุกต์',
          departmentName: 'สำนักดิจิทัลกรุงเทพมหานคร',
          departmentSubName: 'สำนักงานพัฒนาระบบสารสนเทศดิจิทัล',
          projectStatus: 'ประกาศเชิญชวน',
          fiscalYear: 2570,
          announceDate: null,
          budgetBaht: 7087000,
          midPriceBaht: null,
          awardedPriceBaht: null,
          biddingMethod: null,
        },
      },
    ],
  })
})

test('skips rows without an eGP project number instead of failing the page', async () => {
  const adapter = adapterReturning({
    totalCount: 2,
    hasNextPage: false,
    data: [
      { projectNumber: null, projectName: 'No eGP number yet' },
      { projectNumber: '69099075091', projectName: 'ประกวดราคาซื้อวัสดุ', projectBudget: 'bad' },
    ],
  })

  const page = await adapter.listProjects(listInput)

  assert.equal(page.skipped, 1)
  assert.deepEqual(
    page.projects.map((project) => [project.externalId, project.metadata.budgetBaht]),
    [['69099075091', null]],
  )
})

test('rejects a response that is not a BMA project page', async () => {
  const adapter = adapterReturning({ message: 'error' })

  await assert.rejects(() => adapter.listProjects(listInput), /invalid project-search response/)
})
