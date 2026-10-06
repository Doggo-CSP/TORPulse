import { database } from '../config/mongoose.js'
import { CentralEgpAdapter } from '../modules/ingestion/adapters/central-egp.adapters.js'
import { extractBiddingMethod } from '../modules/ingestion/bidding-method.js'
import { TorModel } from '../modules/tor/tor.model.js'

// Usage: npm run backfill:bidding-method -- [--dry-run] [--fetch-announcement]
// Fills biddingMethod from the project title.
// --fetch-announcement reads the eGP announcement PDF for the rest (needs Java). No LLM calls.
async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const fetchAnnouncement = process.argv.includes('--fetch-announcement')
  const adapter = fetchAnnouncement ? new CentralEgpAdapter() : null
  await database.connect()

  try {
    const cursor = TorModel.find({ biddingMethod: null })
      .select({ _id: 1, externalId: 1, projectTitle: 1 })
      .lean()
      .cursor()

    let scanned = 0
    const filledBy = { title: 0, announcement: 0 }
    const unmatched: string[] = []

    for await (const tor of cursor) {
      scanned += 1
      let biddingMethod = extractBiddingMethod(tor.projectTitle)
      if (biddingMethod) {
        filledBy.title += 1
      } else if (adapter) {
        biddingMethod = (await adapter.getAnnouncementInfo(tor.externalId))?.biddingMethod ?? null
        if (biddingMethod) filledBy.announcement += 1
      }

      if (!biddingMethod) {
        unmatched.push(tor.projectTitle)
        continue
      }
      if (!dryRun) {
        await TorModel.updateOne({ _id: tor._id }, { $set: { biddingMethod } }).exec()
      }
    }

    console.log(dryRun ? 'Dry run' : 'Bidding method backfill completed', {
      scanned,
      filledBy,
      unmatched: unmatched.length,
    })
    if (unmatched.length > 0) {
      console.table(unmatched.slice(0, 10).map((title) => ({ title: title.slice(0, 80) })))
    }
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Bidding method backfill failed:', error)
  process.exitCode = 1
})
