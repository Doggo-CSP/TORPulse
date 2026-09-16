import assert from 'node:assert/strict'
import test from 'node:test'

import { strToU8, zipSync } from 'fflate'

import { CentralEgpAdapter } from './central-egp.adapters.js'

const PROJECT_ID = '67119538991'
const ZIP_ID = 'cefa9bcbd513448ea9ad54f80aea5f56'
const PDF = strToU8('%PDF-1.4\n%%EOF')

test('downloads only TOR PDFs from the Central eGP archive', async () => {
  const archive = zipSync({
    'folder/Attach_TOR_1.pdf': PDF,
    'folder/annoudoc.pdf': PDF,
    'folder/readme.txt': strToU8('not a PDF'),
  })
  const requestedUrls: string[] = []
  const adapter = new CentralEgpAdapter({
    fetchImpl: createFetchMock(archive, requestedUrls),
  })

  const project = await adapter.getProject(PROJECT_ID)
  const documents = await adapter.downloadDocuments(project)

  assert.equal(project.externalId, PROJECT_ID)
  assert.match(project.detailUrl, new RegExp(PROJECT_ID))
  assert.equal(documents.length, 1)
  assert.equal(documents[0]?.fileName, 'Attach_TOR_1.pdf')
  assert.equal(documents[0]?.mimeType, 'application/pdf')
  assert.equal(documents[0]?.content.subarray(0, 5).toString(), '%PDF-')
  assert.ok(requestedUrls.some((url) => url.includes('infoProcureDocAnnounZipTemp')))
  assert.ok(requestedUrls.some((url) => url.includes(ZIP_ID)))
})

test('loads authoritative project details with an announcement token', async () => {
  const requests: Array<{ url: string; headers: Headers }> = []
  const adapter = new CentralEgpAdapter({
    fetchImpl: createDetailFetchMock(requests),
  })

  const details = await adapter.getProjectDetails(PROJECT_ID)

  assert.deepEqual(details, {
    departmentName: 'กรมชลประทาน',
    departmentSubName: 'สำนักบริหารจัดการน้ำและอุทกวิทยา',
    projectStatus: 'จัดทำสัญญา/บริหารสัญญา',
    midPriceBaht: 9_014_000,
    awardedPriceBaht: 9_000_000,
  })
  assert.equal(requests.length, 3)
  assert.equal(
    requests
      .find(({ url }) => url.includes('getProjectDetail'))
      ?.headers.get('X-Announcement-Token'),
    'test-token',
  )
})

for (const { name, response, error } of [
  {
    name: 'rejected token',
    response: { validateAnnouncementToken: false },
    error: /rejected the announcement token/,
  },
  {
    name: 'null data',
    response: { response: { responseCode: '0' }, data: null },
    error: /malformed project detail/,
  },
  {
    name: 'mismatched project id',
    response: detailResponse({ projectId: '00000000000' }),
    error: /mismatched project detail/,
  },
  {
    name: 'malformed department',
    response: detailResponse({ deptName: null }),
    error: /invalid deptName/,
  },
] as const) {
  test(`rejects ${name} from Central eGP details`, async () => {
    const adapter = new CentralEgpAdapter({
      fetchImpl: createDetailFetchMock([], response),
    })

    await assert.rejects(() => adapter.getProjectDetails(PROJECT_ID), error)
  })
}

test('rejects Central eGP detail HTTP failures', async () => {
  const adapter = new CentralEgpAdapter({
    fetchImpl: createDetailFetchMock([], new Response('unavailable', { status: 503 })),
  })

  await assert.rejects(() => adapter.getProjectDetails(PROJECT_ID), /request failed \(503\)/)
})

test('rejects malformed Central eGP prices', async () => {
  const adapter = new CentralEgpAdapter({
    fetchImpl: createDetailFetchMock([], detailResponse(), {
      response: { responseCode: '0' },
      data: {
        projectId: PROJECT_ID,
        flowName: null,
        priceBuild: -1,
        priceAgree: null,
      },
    }),
  })

  await assert.rejects(() => adapter.getProjectDetails(PROJECT_ID), /invalid priceBuild/)
})

test('rejects invalid Central eGP project IDs before making a request', async () => {
  let requestCount = 0
  const adapter = new CentralEgpAdapter({
    fetchImpl: (async () => {
      requestCount += 1
      return new Response()
    }) as typeof fetch,
  })

  await assert.rejects(() => adapter.getProject('not-an-id'), /exactly 11 digits/)
  assert.equal(requestCount, 0)
})

test('rejects unsafe paths in a Central eGP ZIP', async () => {
  const archive = zipSync({ '../Attach_TOR_1.pdf': PDF })
  const adapter = new CentralEgpAdapter({ fetchImpl: createFetchMock(archive, []) })
  const project = await adapter.getProject(PROJECT_ID)

  await assert.rejects(() => adapter.downloadDocuments(project), /unsafe path/)
})

function createFetchMock(archive: Uint8Array, requestedUrls: string[]): typeof fetch {
  const detailFetch = createDetailFetchMock([])

  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString()
    requestedUrls.push(url)

    if (url.includes('infoProcureDocAnnounZipTemp')) {
      return Response.json({
        response: { responseCode: '0' },
        data: {
          projectId: PROJECT_ID,
          buildName1: `${PROJECT_ID}_28112567.zip`,
          zipId: ZIP_ID,
        },
      })
    }

    if (
      url.includes('generateToken') ||
      url.includes('getProjectDetail') ||
      url.includes('getProcurementDetail')
    ) {
      return detailFetch(input, init)
    }

    return new Response(Buffer.from(archive), {
      status: 200,
      headers: {
        'content-length': String(archive.byteLength),
        'content-type': 'application/zip',
      },
    })
  }) as typeof fetch
}

function createDetailFetchMock(
  requests: Array<{ url: string; headers: Headers }>,
  projectResponse: unknown | Response = detailResponse(),
  procurementResponse: unknown = {
    response: { responseCode: '0' },
    data: {
      projectId: PROJECT_ID,
      flowName: 'จัดทำสัญญา/บริหารสัญญา',
      priceBuild: 9_014_000,
      priceAgree: 9_000_000,
    },
  },
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString()
    requests.push({ url, headers: new Headers(init?.headers) })

    if (url.includes('generateToken')) {
      const body = JSON.parse(String(init?.body))
      assert.equal(typeof body.key, 'string')
      assert.ok(body.key.length > 0)
      return Response.json({ data: 'test-token' })
    }
    if (url.includes('getProjectDetail')) {
      return projectResponse instanceof Response ? projectResponse : Response.json(projectResponse)
    }
    if (url.includes('getProcurementDetail')) {
      return Response.json(procurementResponse)
    }

    throw new Error(`Unexpected URL: ${url}`)
  }) as typeof fetch
}

function detailResponse(overrides: Record<string, unknown> = {}) {
  return {
    response: { responseCode: '0' },
    data: {
      projectId: PROJECT_ID,
      deptName: 'กรมชลประทาน',
      deptSubName: 'สำนักบริหารจัดการน้ำและอุทกวิทยา',
      ...overrides,
    },
  }
}
