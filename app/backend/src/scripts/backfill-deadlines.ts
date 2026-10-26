import { database } from '../config/mongoose.js'
import { parseThaiDate } from '../modules/ingestion/thai-date.js'
import { TorModel } from '../modules/tor/tor.model.js'

// Usage: npm run backfill:deadlines -- [--dry-run]
// Parses the stored submissionDeadline text into submissionDeadlineAt. No LLM calls.
async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  await database.connect()

  try {
    const cursor = TorModel.find({
      submissionDeadline: { $nin: [null, ''] },
      submissionDeadlineAt: null,
    })
      .select({ _id: 1, submissionDeadline: 1 })
      .lean()
      .cursor()

    let scanned = 0
    let parsed = 0
    const unparsed = new Map<string, number>()

    for await (const tor of cursor) {
      scanned += 1
      const date = parseThaiDate(tor.submissionDeadline)

      if (!date) {
        const text = tor.submissionDeadline ?? ''
        unparsed.set(text, (unparsed.get(text) ?? 0) + 1)
        continue
      }

      parsed += 1
      if (!dryRun) {
        await TorModel.updateOne({ _id: tor._id }, { $set: { submissionDeadlineAt: date } }).exec()
      }
    }

    console.log(dryRun ? 'Dry run' : 'Deadline backfill completed', {
      scanned,
      parsed,
      unparsed: scanned - parsed,
    })
    const examples = [...unparsed].sort((a, b) => b[1] - a[1]).slice(0, 10)
    if (examples.length > 0) {
      console.table(examples.map(([text, count]) => ({ count, text: text.slice(0, 80) })))
    }
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Deadline backfill failed:', error)
  process.exitCode = 1
})
