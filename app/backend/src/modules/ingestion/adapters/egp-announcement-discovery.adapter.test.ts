import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EgpTokenRejectedError,
  listAnnouncements,
  tokenMinutesLeft,
  type EgpAnnouncement,
} from './egp-announcement-discovery.adapter.js'

const ANNOUNCEMENT: EgpAnnouncement = {
  projectId: '69099462238',
  projectName: 'ประกวดราคาซื้อน้ำยาทดสอบ',
  deptName: 'กรุงเทพมหานคร',
  deptSubName: 'สำนักอนามัย',
  announceDate: '2026-10-01T10:00:00',
  announceType: null,
  methodId: '16',
  stepId: null,
  projectStatus: null,
  projectMoney: 1_270_625,
  priceBuild: 1_270_625,
  flowName: null,
}

function jsonFetch(body: unknown, requests: URL[] = [], status = 200): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0]) => {
    requests.push(new URL(String(input)))
    return Response.json(body, { status })
  }) as typeof fetch
}

test('listAnnouncements maps eGP announcements to discovered projects', async () => {
  const requests: URL[] = []
  const projects = await listAnnouncements({
    token: 'token',
    budgetYear: 2570,
    announceType: '3',
    page: 2,
    fetchImpl: jsonFetch({ data: [ANNOUNCEMENT], validateCfTurnTile: true }, requests),
  })

  assert.equal(requests[0]?.searchParams.get('announceType'), '3')
  assert.equal(requests[0]?.searchParams.get('budgetYear'), '2570')
  assert.equal(requests[0]?.searchParams.get('page'), '2')
  assert.deepEqual(projects, [
    {
      externalId: '69099462238',
      title: 'ประกวดราคาซื้อน้ำยาทดสอบ',
      fiscalYear: 2570,
      metadata: {
        title: 'ประกวดราคาซื้อน้ำยาทดสอบ',
        departmentName: 'กรุงเทพมหานคร',
        departmentSubName: 'สำนักอนามัย',
        projectStatus: 'ประกาศเชิญชวน',
        fiscalYear: 2570,
        announceDate: new Date('2026-10-01T00:00:00.000Z'),
        budgetBaht: 1_270_625,
        midPriceBaht: 1_270_625,
        awardedPriceBaht: null,
      },
    },
  ])
})

test('listAnnouncements labels unknown announce types by number', async () => {
  const [project] = await listAnnouncements({
    token: 'token',
    budgetYear: 2570,
    announceType: '2',
    page: 1,
    fetchImpl: jsonFetch({ data: [ANNOUNCEMENT] }),
  })

  assert.equal(project?.metadata.projectStatus, 'announceType 2')
})

test('listAnnouncements rejects a token that failed Turnstile', async () => {
  await assert.rejects(
    listAnnouncements({
      token: 'token',
      budgetYear: 2570,
      announceType: '1',
      page: 1,
      fetchImpl: jsonFetch({ validateCfTurnTile: false }),
    }),
    EgpTokenRejectedError,
  )
})

test('listAnnouncements rejects HTTP 403 as a token error', async () => {
  await assert.rejects(
    listAnnouncements({
      token: 'token',
      budgetYear: 2570,
      announceType: '1',
      page: 1,
      fetchImpl: jsonFetch({}, [], 403),
    }),
    EgpTokenRejectedError,
  )
})

test('tokenMinutesLeft reads the expiry from the token', () => {
  const token = Buffer.from('EGP-ANNOUNCEMENT-KEY:1800000:sig').toString('base64')

  assert.equal(tokenMinutesLeft(token, 0), 30)
  assert.equal(tokenMinutesLeft(token, 2_400_000), -10)
  assert.equal(tokenMinutesLeft('garbage'), null)
})
