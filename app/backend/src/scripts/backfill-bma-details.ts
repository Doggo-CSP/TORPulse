import { database } from '../config/mongoose.js'
import { backfillBmaTorDetails } from '../modules/ingestion/bma-details-backfill.js'

// Usage: npm run backfill:bma-details -- [--dry-run] [--all]
// Fills middle price, contract status and hearing announcements on BMA TORs from the BMA API.
// --all revisits every BMA TOR (refreshes contract status and announcements), not only those
// missing a middle price or announcements.
async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const onlyMissing = !process.argv.includes('--all')
  await database.connect()

  try {
    const result = await backfillBmaTorDetails({ dryRun, onlyMissing })
    console.log(dryRun ? 'Dry run' : 'BMA detail backfill completed', result)
    if (result.failed > 0) process.exitCode = 1
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('BMA detail backfill failed:', error)
  process.exitCode = 1
})
