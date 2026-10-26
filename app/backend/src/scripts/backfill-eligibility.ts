import { database } from '../config/mongoose.js'
import { mapEligibility } from '../modules/ingestion/extraction/eligibility-mapper.js'
import { PUBLIC_TOR_FILTER, TorModel } from '../modules/tor/tor.model.js'

// Usage: npm run backfill:eligibility -- [--all] [--dry-run]
// Re-maps each TOR's stored bidderQualifications onto structured eligibility (one small LLM
// call per TOR, no PDF download). Notifications follow the AI qualification score instead.
// By default only public TORs still open for bidding; --all covers every TOR.
async function main(): Promise<void> {
  const all = process.argv.includes('--all')
  const dryRun = process.argv.includes('--dry-run')
  await database.connect()

  try {
    const now = new Date()
    const filter = all
      ? { 'bidderQualifications.0': { $exists: true } }
      : {
          ...PUBLIC_TOR_FILTER,
          'bidderQualifications.0': { $exists: true },
          $or: [{ submissionDeadlineAt: null }, { submissionDeadlineAt: { $gt: now } }],
        }

    const tors = await TorModel.find(filter)
      .select({ _id: 1, projectTitle: 1, bidderQualifications: 1 })
      .lean()

    console.log(`Mapping eligibility for ${tors.length} TOR(s)${dryRun ? ' (dry run)' : ''}`)
    let mapped = 0
    let failed = 0

    for (const tor of tors) {
      try {
        const eligibility = await mapEligibility(tor.bidderQualifications)
        mapped += 1

        console.log(
          `${tor._id} unmapped=${eligibility?.unmappedQualifications.length ?? '-'} ${tor.projectTitle.slice(0, 60)}`,
        )
        for (const item of eligibility?.unmappedQualifications ?? []) {
          console.log(`    - ${item}`)
        }

        if (dryRun) continue

        await TorModel.updateOne({ _id: tor._id }, { $set: { eligibility } }).exec()
      } catch (error) {
        failed += 1
        console.error(`${tor._id} failed:`, error instanceof Error ? error.message : error)
      }
    }

    console.log('Eligibility backfill completed', { scanned: tors.length, mapped, failed })
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Eligibility backfill failed:', error)
  process.exitCode = 1
})
