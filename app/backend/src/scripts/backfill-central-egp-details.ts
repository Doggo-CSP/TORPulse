import { database } from '../config/mongoose.js'
import { backfillCentralEgpTorDetails } from '../modules/ingestion/central-egp-details-backfill.js'

async function main(): Promise<void> {
  await database.connect()

  try {
    const result = await backfillCentralEgpTorDetails()
    console.log('Central eGP detail backfill completed', result)
    if (result.failed > 0) process.exitCode = 1
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Central eGP detail backfill failed:', error)
  process.exitCode = 1
})
