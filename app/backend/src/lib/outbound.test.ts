import assert from 'node:assert/strict'
import test from 'node:test'

import { allowlistedFetch, OutboundBlockedError } from './outbound.js'

const redirect = (location: string, status = 302) =>
  new Response(null, { status, headers: { location } })

test('requests to hosts outside the allowlist are refused before any network call', async (t) => {
  const calls: string[] = []
  t.mock.method(globalThis, 'fetch', async (input: string | URL) => {
    calls.push(String(input))
    return new Response('ok')
  })

  for (const url of [
    'https://evil.example/x',
    'http://egp2.bangkok.go.th/api',
    'https://egp2.bangkok.go.th:8443/api',
    'https://user:pass@egp2.bangkok.go.th/api',
    'https://169.254.169.254/latest/meta-data',
  ]) {
    await assert.rejects(allowlistedFetch(url), OutboundBlockedError, url)
  }
  assert.equal(calls.length, 0)
})

test('allowlisted requests go out with automatic redirects turned off', async (t) => {
  let seenInit: RequestInit | undefined
  t.mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    seenInit = init
    return new Response('ok')
  })

  const response = await allowlistedFetch('https://egp2.bangkok.go.th/appapi/x')

  assert.equal(await response.text(), 'ok')
  assert.equal(seenInit?.redirect, 'manual')
})

test('a redirect is followed only to another allowlisted host', async (t) => {
  const responses = [redirect('https://adminapiegp.bangkok.go.th/file.pdf'), new Response('pdf')]
  t.mock.method(globalThis, 'fetch', async () => responses.shift()!)

  const followed = await allowlistedFetch('https://egp2.bangkok.go.th/api/file/1')
  assert.equal(await followed.text(), 'pdf')

  t.mock.restoreAll()
  t.mock.method(globalThis, 'fetch', async () => redirect('https://evil.example/steal'))
  await assert.rejects(
    allowlistedFetch('https://egp2.bangkok.go.th/api/file/1'),
    OutboundBlockedError,
  )
})

test('redirect loops stop after three hops', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => redirect('https://egp2.bangkok.go.th/loop'))

  await assert.rejects(allowlistedFetch('https://egp2.bangkok.go.th/start'), /too many redirects/)
})
