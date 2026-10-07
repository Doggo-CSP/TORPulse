import assert from 'node:assert/strict'
import test from 'node:test'

import { schedulerHealth, staleAfterMs, type SchedulerHealthInput } from './ingestion-health.js'

const MINUTE = 60_000
const now = new Date('2026-10-07T12:00:00Z')
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * MINUTE)

// Interval 10 min + lease 15 min → stalled after 35 minutes without a scheduled run
const base: SchedulerHealthInput = {
  configured: true,
  ingestionEnabled: true,
  anySourceEnabled: true,
  isRunning: false,
  lastScheduledStartedAt: minutesAgo(5),
  enabledSince: null,
  intervalMs: 10 * MINUTE,
  leaseMs: 15 * MINUTE,
  now,
}

test('staleAfterMs allows two intervals plus one lease', () => {
  assert.equal(staleAfterMs(10 * MINUTE, 15 * MINUTE), 35 * MINUTE)
})

test('a recent scheduled run means the scheduler is ok', () => {
  const health = schedulerHealth(base)
  assert.equal(health.state, 'ok')
  assert.deepEqual(health.expectedBy, new Date(minutesAgo(5).getTime() + 35 * MINUTE))
})

test('no scheduled run for longer than the stale window means stalled', () => {
  assert.equal(schedulerHealth({ ...base, lastScheduledStartedAt: minutesAgo(36) }).state, 'stalled')
  assert.equal(schedulerHealth({ ...base, lastScheduledStartedAt: minutesAgo(35) }).state, 'ok')
})

test('never having a scheduled run is stalled unless it was just switched on', () => {
  assert.equal(schedulerHealth({ ...base, lastScheduledStartedAt: null }).state, 'stalled')
  assert.equal(
    schedulerHealth({ ...base, lastScheduledStartedAt: null, enabledSince: minutesAgo(2) }).state,
    'waiting',
  )
})

test('switching back on after a long pause waits for the next run instead of warning', () => {
  const input = { ...base, lastScheduledStartedAt: minutesAgo(300), enabledSince: minutesAgo(3) }
  assert.equal(schedulerHealth(input).state, 'waiting')
  assert.equal(schedulerHealth({ ...input, enabledSince: minutesAgo(40) }).state, 'stalled')
})

test('a run after the switch counts as ok again', () => {
  const input = { ...base, lastScheduledStartedAt: minutesAgo(1), enabledSince: minutesAgo(3) }
  assert.equal(schedulerHealth(input).state, 'ok')
})

test('a sync in progress is running even when the last scheduled run is old', () => {
  assert.equal(
    schedulerHealth({ ...base, isRunning: true, lastScheduledStartedAt: minutesAgo(90) }).state,
    'running',
  )
})

test('switched-off states win over run times and expect no run', () => {
  const old = { ...base, lastScheduledStartedAt: minutesAgo(500), isRunning: true }
  assert.deepEqual(schedulerHealth({ ...old, configured: false }), {
    state: 'not_configured',
    expectedBy: null,
  })
  assert.deepEqual(schedulerHealth({ ...old, ingestionEnabled: false }), {
    state: 'off',
    expectedBy: null,
  })
  assert.deepEqual(schedulerHealth({ ...old, anySourceEnabled: false }), {
    state: 'source_disabled',
    expectedBy: null,
  })
})
