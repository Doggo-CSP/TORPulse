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
