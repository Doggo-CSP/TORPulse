import { database } from '../config/mongoose.js'
import { IngestionJobModel } from '../modules/ingestion/ingestion-job.model.js'

const ERROR_STATUSES = ['failed', 'rejected', 'review_required', 'skipped'] as const
const MAX_ERROR_GROUPS = 25

// Usage: npm run report:job-failures
// Read-only: job counts by status and currentStage, then error messages grouped by both.
async function main(): Promise<void> {
  await database.connect()

  try {
    const byStatusAndStage = await IngestionJobModel.aggregate<{
      _id: { status: string; stage: string }
      count: number
    }>([
      { $group: { _id: { status: '$status', stage: '$currentStage' }, count: { $sum: 1 } } },
      { $sort: { '_id.status': 1, count: -1 } },
    ])
    console.table(
      byStatusAndStage.map(({ _id, count }) => ({ status: _id.status, stage: _id.stage, count })),
    )

    const jobs = await IngestionJobModel.find({ status: { $in: ERROR_STATUSES } })
      .select({ status: 1, currentStage: 1, 'lastError.message': 1 })
      .lean()
      .exec()

    const groups = new Map<
      string,
      { status: string; stage: string; message: string; count: number }
    >()
    for (const job of jobs) {
      const message = (job.lastError?.message ?? '').replace(/\d{6,}/g, '<id>').slice(0, 160)
      const key = `${job.status}\0${job.currentStage}\0${message}`
      const group = groups.get(key) ?? {
        status: job.status,
        stage: job.currentStage,
        message,
        count: 0,
      }
      group.count += 1
      groups.set(key, group)
    }

    console.table([...groups.values()].sort((a, b) => b.count - a.count).slice(0, MAX_ERROR_GROUPS))
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Job failure report failed:', error)
  process.exitCode = 1
})
