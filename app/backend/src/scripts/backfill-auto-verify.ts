import { database } from '../config/mongoose.js'
import { AUTO_VERIFY_MIN_CONFIDENCE, TorModel } from '../modules/tor/tor.model.js'

// Usage: npm run backfill:auto-verify -- [--dry-run]
// Applies the confidence rule to TORs already in the database: one still waiting for review
// whose AI confidence is at least AUTO_VERIFY_MIN_CONFIDENCE becomes verified automatically,
// as ingestion now does for new TORs. TORs an admin edited, verified, archived or deleted are
// left as they are. No LLM calls.
async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  await database.connect()

  try {
    // Records from before reviewStatus existed have no value and count as waiting
    const waiting = {
      $or: [{ reviewStatus: 'unverified' as const }, { reviewStatus: { $exists: false } }],
      lastEditedAt: null,
    }
    const filter = { ...waiting, confidence: { $gte: AUTO_VERIFY_MIN_CONFIDENCE } }

    const [waitingCount, toVerify] = await Promise.all([
      TorModel.countDocuments(waiting),
      TorModel.countDocuments(filter),
    ])

    let verified = 0
    if (!dryRun) {
      const result = await TorModel.updateMany(filter, {
        $set: { reviewStatus: 'verified', autoVerified: true },
      }).exec()
      verified = result.modifiedCount
    }

    console.log(dryRun ? 'Dry run' : 'Auto-verify backfill completed', {
      threshold: AUTO_VERIFY_MIN_CONFIDENCE,
      waitingForReview: waitingCount,
      atOrAboveThreshold: toVerify,
      stillWaiting: waitingCount - toVerify,
      ...(dryRun ? {} : { verified }),
    })
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Auto-verify backfill failed:', error)
  process.exitCode = 1
})
