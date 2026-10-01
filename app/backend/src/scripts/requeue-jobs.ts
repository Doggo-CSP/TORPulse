import { database } from '../config/mongoose.js'
import { IngestionJobModel } from '../modules/ingestion/ingestion-job.model.js'
import {
  REQUEUEABLE_STATUSES,
  countRequeueableJobs,
  requeueJobs,
  type RequeueableStatus,
} from '../modules/ingestion/ingestion-job.repository.js'

// Usage: npm run requeue:jobs -- [--dry-run] [--status=failed,rejected]
function parseStatuses(args: string[]): RequeueableStatus[] {
  const flag = args.find((arg) => arg.startsWith('--status='))
  if (!flag) {
    return [...REQUEUEABLE_STATUSES]
  }

  const statuses = flag.slice('--status='.length).split(',')
  const invalid = statuses.filter(
    (status) => !REQUEUEABLE_STATUSES.includes(status as RequeueableStatus),
  )
  if (invalid.length > 0) {
    throw new Error(
      `Invalid status: ${invalid.join(', ')}. Allowed: ${REQUEUEABLE_STATUSES.join(', ')}`,
    )
  }

  return statuses as RequeueableStatus[]
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const statuses = parseStatuses(args)
  const dryRun = args.includes('--dry-run')

  await database.connect()

  try {
    await IngestionJobModel.init()

    if (dryRun) {
      const matched = await countRequeueableJobs(statuses)
      console.log('Dry run: jobs that would be requeued', { statuses, matched })
      return
    }

    const result = await requeueJobs(statuses)
    console.log('Requeue completed', { statuses, ...result })
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Requeue failed:', error)
  process.exitCode = 1
})
