import { database } from '../config/mongoose.js'
import { CentralEgpAdapter } from '../modules/ingestion/adapters/central-egp.adapters.js'
import { INVITATION_STATUS } from '../modules/ingestion/egp-submit-deadline.js'
import { torFieldsFromAnnouncement } from '../modules/tor/tor.repository.js'
import { TorModel } from '../modules/tor/tor.model.js'

// Usage: npm run refresh:announcements -- [--dry-run] [--all]
// Re-reads the eGP announcement PDF (needs Java, no LLM calls) and updates the stage,
// announce date, mid price, method and deadline. By default only TORs that may still
// change: not yet at ประกาศเชิญชวน, or without a parsed deadline. --all re-reads every eGP TOR.
const EGP_ADAPTERS = ['central_egp', 'bma_egp'] as const

// Stages the BMA search filter used to stamp; they do not match the eGP stage.
const STALE_BMA_STATUSES = ['ร่างขอบเขตของงาน (TOR)', 'ประกาศราคากลาง']

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const all = process.argv.includes('--all')
  const adapter = new CentralEgpAdapter()
  await database.connect()

  try {
    const stillOpen = {
      $or: [{ projectStatus: { $ne: INVITATION_STATUS } }, { submissionDeadlineAt: null }],
    }
    const cursor = TorModel.find(
      all
        ? { sourceAdapter: { $in: EGP_ADAPTERS } }
        : { sourceAdapter: { $in: EGP_ADAPTERS }, ...stillOpen },
    )
      .select({ _id: 1, externalId: 1, projectStatus: 1 })
      .lean()
      .cursor()

    let scanned = 0
    let updated = 0
    let cleared = 0
    const statusChanges = new Map<string, number>()
    const unreadable: string[] = []

    for await (const tor of cursor) {
      scanned += 1
      const fields = torFieldsFromAnnouncement(await adapter.getAnnouncementInfo(tor.externalId))

      if (!fields.projectStatus && STALE_BMA_STATUSES.includes(tor.projectStatus ?? '')) {
        fields.projectStatus = null
        cleared += 1
      }
      if (Object.keys(fields).length === 0) {
        unreadable.push(tor.externalId)
        continue
      }

      if ('projectStatus' in fields && fields.projectStatus !== tor.projectStatus) {
        const change = `${tor.projectStatus ?? '-'} → ${fields.projectStatus ?? '-'}`
        statusChanges.set(change, (statusChanges.get(change) ?? 0) + 1)
      }
      updated += 1
      if (!dryRun) {
        await TorModel.updateOne({ _id: tor._id }, { $set: fields }).exec()
      }
    }

    console.log(dryRun ? 'Dry run' : 'Announcement refresh completed', {
      scanned,
      updated,
      cleared,
      unreadable: unreadable.length,
    })
    if (statusChanges.size > 0) {
      console.table([...statusChanges].map(([change, count]) => ({ change, count })))
    }
    if (unreadable.length > 0) {
      console.log('No readable announcement:', unreadable.slice(0, 20).join(' '))
    }
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Announcement refresh failed:', error)
  process.exitCode = 1
})
