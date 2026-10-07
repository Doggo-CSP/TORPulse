// Whether the scheduled queue-producer looks alive, judged only from what it leaves in MongoDB.
// The API and the producer are separate processes, so the admin panel cannot ask the producer
// directly: a producer that stopped simply stops creating scheduled collection runs.

export type SchedulerState =
  | 'running' // a sync is in progress right now
  | 'ok' // the last scheduled run started recently enough
  | 'waiting' // switched on recently, the first scheduled run has not started yet
  | 'stalled' // switched on, but no scheduled run for too long: the producer is probably down
  | 'off' // the admin turned automatic ingestion off
  | 'source_disabled' // every data source is disabled
  | 'not_configured' // the deployment has no discovery source (BMA_SYNC_ENABLED=false)

export interface SchedulerHealthInput {
  configured: boolean
  ingestionEnabled: boolean
  anySourceEnabled: boolean
  isRunning: boolean
  lastScheduledStartedAt: Date | null
  // Latest time an admin switched ingestion or a source back on; a fresh switch gets a grace period
  enabledSince: Date | null
  intervalMs: number
  leaseMs: number
  now: Date
}

export interface SchedulerHealth {
  state: SchedulerState
  // A scheduled run is expected to have started by this time; null when none is expected
  expectedBy: Date | null
}

// One missed tick is normal (a long sync pushes the next one back), so the scheduler only
// counts as stalled after two intervals plus one full lease.
export function staleAfterMs(intervalMs: number, leaseMs: number): number {
  return intervalMs * 2 + leaseMs
}

export function schedulerHealth(input: SchedulerHealthInput): SchedulerHealth {
  if (!input.configured) return { state: 'not_configured', expectedBy: null }
  if (!input.ingestionEnabled) return { state: 'off', expectedBy: null }
  if (!input.anySourceEnabled) return { state: 'source_disabled', expectedBy: null }
  if (input.isRunning) return { state: 'running', expectedBy: null }

  const reference = latest(input.lastScheduledStartedAt, input.enabledSince)
  if (!reference) return { state: 'stalled', expectedBy: null }

  const expectedBy = new Date(reference.getTime() + staleAfterMs(input.intervalMs, input.leaseMs))
  if (input.now.getTime() > expectedBy.getTime()) return { state: 'stalled', expectedBy }

  const ranSinceEnabled =
    input.lastScheduledStartedAt !== null &&
    (input.enabledSince === null ||
      input.lastScheduledStartedAt.getTime() >= input.enabledSince.getTime())
  return { state: ranSinceEnabled ? 'ok' : 'waiting', expectedBy }
}

function latest(a: Date | null, b: Date | null): Date | null {
  if (!a) return b
  if (!b) return a
  return a.getTime() >= b.getTime() ? a : b
}
