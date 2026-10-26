import assert from 'node:assert/strict'
import test from 'node:test'

import { BmaDiscoveryAdapter } from './bma-discovery.adapter.js'

// Routes project-search requests to `body` and project-detail requests to `detail`.
function adapterReturning(
  body: unknown,
  onRequest?: (url: URL) => void,
  detail: (projectId: string) => Response = () => new Response(null, { status: 404 }),
) {
  return new BmaDiscoveryAdapter({
    requestTimeoutMs: 1_000,
    fetchImpl: (async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input.toString())
      onRequest?.(url)
      return url.pathname.endsWith('/GetProjectDetail')
        ? detail(url.searchParams.get('projectId') ?? '')
        : Response.json(body)
    }) as typeof fetch,
  })
}

const BMA_PROJECT_ID = '0819610c-d00d-45aa-8527-abecf9bfdc83'

const searchRow = {
  no: 1,
  projectId: BMA_PROJECT_ID,
  projectName: 'ประกวดราคาจ้างบำรุงรักษาระบบเครือข่ายและโปรแกรมประยุกต์',
  projectNumber: '69099316505',
  masterOrgGroupName: 'สำนักดิจิทัลกรุงเทพมหานคร',
  masterOrgDepartmentName: 'สำนักงานพัฒนาระบบสารสนเทศดิจิทัล',
  masterContractAvailableCode: 'S1',
  masterContractAvailableName: null,
  projectBudget: 7087000,
}

const detailBody = {
  projectId: BMA_PROJECT_ID,
  projectNumber: '69099316505',
  masterContractAvailableCode: 'S1',
  masterContractAvailableName: 'ระหว่างดำเนินการ',
  projectBudget: 7087000,
  projectAverageBudget: 7000000,
}

const listInput = { budgetYear: 2570, keyword: 'ระบบ', pageNo: 1, pageSize: 100 }

test('filters the BMA search by keyword, invitation stage and budget year', async () => {
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
  assert.equal(requestedUrl?.searchParams.get('pageNo'), '1')
  assert.equal(requestedUrl?.searchParams.get('pageSize'), '100')
})

test('maps a BMA project to a Central eGP project id with detail metadata', async () => {
  const detailIds: string[] = []
  const adapter = adapterReturning(
    { totalCount: 1, hasNextPage: false, data: [searchRow] },
    undefined,
    (projectId) => {
      detailIds.push(projectId)
      return Response.json(detailBody)
    },
  )

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
          sourceProjectId: BMA_PROJECT_ID,
          contractStatus: 'ระหว่างดำเนินการ',
          contractStatusCode: 'S1',
          fiscalYear: 2570,
          announceDate: null,
          budgetBaht: 7087000,
          midPriceBaht: 7000000,
          awardedPriceBaht: null,
        },
      },
    ],
  })
  assert.deepEqual(detailIds, [BMA_PROJECT_ID])
})

test('keeps the project with search values when its detail request fails', async () => {
  const adapter = adapterReturning(
    { totalCount: 1, hasNextPage: false, data: [searchRow] },
    undefined,
    () => new Response(null, { status: 500 }),
  )

  const [project] = (await adapter.listProjects(listInput)).projects

  assert.equal(project?.externalId, '69099316505')
  assert.equal(project?.metadata.sourceProjectId, BMA_PROJECT_ID)
  assert.equal(project?.metadata.midPriceBaht, null)
  assert.equal(project?.metadata.contractStatus, null)
  assert.equal(project?.metadata.contractStatusCode, 'S1')
})

test('does not request details for a row without a BMA project id', async () => {
  let detailCalls = 0
  const adapter = adapterReturning(
    { totalCount: 1, hasNextPage: false, data: [{ ...searchRow, projectId: null }] },
    undefined,
    () => {
      detailCalls += 1
      return Response.json(detailBody)
    },
  )

  const [project] = (await adapter.listProjects(listInput)).projects

  assert.equal(detailCalls, 0)
  assert.equal(project?.metadata.sourceProjectId, null)
  assert.equal(project?.metadata.midPriceBaht, null)
})

test('finds project details by eGP project number across all stages', async () => {
  let searchUrl: URL | undefined
  const adapter = adapterReturning(
    {
      totalCount: 2,
      hasNextPage: false,
      data: [{ ...searchRow, projectNumber: '69099316599', projectId: 'other' }, searchRow],
    },
    (url) => {
      if (url.pathname.endsWith('/GetProjectFromFilter')) searchUrl = url
    },
    (projectId) =>
      projectId === BMA_PROJECT_ID ? Response.json(detailBody) : new Response(null, { status: 404 }),
  )

  assert.deepEqual(await adapter.findProjectDetails('69099316505'), {
    sourceProjectId: BMA_PROJECT_ID,
    midPriceBaht: 7000000,
    contractStatus: 'ระหว่างดำเนินการ',
    contractStatusCode: 'S1',
  })
  assert.equal(searchUrl?.searchParams.get('projectSearchText'), '69099316505')
  assert.equal(searchUrl?.searchParams.has('masterAnnounceTypeId'), false)
  assert.equal(searchUrl?.searchParams.has('masterBudgetYearId'), false)
})

test('returns null when BMA does not list the eGP project number', async () => {
  const adapter = adapterReturning({ totalCount: 0, hasNextPage: false, data: [] })

  assert.equal(await adapter.findProjectDetails('69099316505'), null)
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
