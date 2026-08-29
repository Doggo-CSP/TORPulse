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
  assert.match(requestedUrls[0] ?? '', /infoProcureDocAnnounZipTemp/)
  assert.match(requestedUrls[1] ?? '', new RegExp(ZIP_ID))
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
  return (async (input: string | URL | Request) => {
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

    return new Response(Buffer.from(archive), {
      status: 200,
      headers: {
        'content-length': String(archive.byteLength),
        'content-type': 'application/zip',
      },
    })
  }) as typeof fetch
}
