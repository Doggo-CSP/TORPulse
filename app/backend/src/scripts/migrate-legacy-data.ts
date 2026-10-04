import { pathToFileURL } from 'node:url'

import { database } from '../config/mongoose.js'
import { AuditLogModel } from '../modules/admin/audit-log.model.js'
import { User } from '../modules/auth/user.model.js'
import { TorModel } from '../modules/tor/tor.model.js'

// Brings existing data in line with the current rules before deploying. Safe to re-run.
//   npm run migrate:legacy-data            -> dry run (default), lists what would change
//   npm run migrate:legacy-data -- --apply -> writes the changes
// Never run --apply against the shared/production database without the team's approval.
//
// 1. Users: the 'pending' status and the 'editor' role no longer exist.
//    status pending -> active, role editor -> user.
// 2. TORs edited through the admin API before lastEditedAt existed (audit action 'tor.update',
//    later renamed 'tor.updated') get lastEditedAt from their latest edit log, so a sync can
//    no longer overwrite those edits.

export interface UserAccessFix {
  status?: 'active'
  role?: 'user'
}

export function planUserFix(user: {
  status?: string | null
  role?: string | null
}): UserAccessFix | null {
  const fix: UserAccessFix = {}
  if (user.status === 'pending') fix.status = 'active'
  if (user.role === 'editor') fix.role = 'user'
  return Object.keys(fix).length > 0 ? fix : null
}

export function planTorEditStamp(
  tor: { lastEditedAt?: Date | null },
  lastEditLogAt: Date,
): Date | null {
  return tor.lastEditedAt ? null : lastEditLogAt
}

async function migrateLegacyData(apply: boolean): Promise<void> {
  await database.connect()

  try {
    console.log(apply ? '=== APPLY: writing changes ===' : '=== DRY RUN: nothing is written ===')

    // --- Users --------------------------------------------------------------
    // The native collection is used because 'pending' and 'editor' are no longer in the
    // Mongoose enums.
    const users = await User.collection
      .find<{ _id: unknown; email: string; status?: string; role?: string }>(
        { $or: [{ status: 'pending' }, { role: 'editor' }] },
        { projection: { email: 1, status: 1, role: 1 } },
      )
      .toArray()

    const userWrites: { _id: unknown; fix: UserAccessFix }[] = []
    for (const user of users) {
      const fix = planUserFix(user)
      if (!fix) continue
      userWrites.push({ _id: user._id, fix })
      const changes = [
        fix.status ? `status ${user.status} -> ${fix.status}` : null,
        fix.role ? `role ${user.role} -> ${fix.role}` : null,
      ].filter(Boolean)
      console.log(`  ${user.email}: ${changes.join(', ')}`)
    }
    console.log(`Users to convert: ${userWrites.length}`)

    // --- TORs edited before lastEditedAt existed --------------------------------
    const lastEdits = await AuditLogModel.aggregate<{ _id: unknown; lastEditedAt: Date }>([
      { $match: { targetType: 'tor', action: { $in: ['tor.update', 'tor.updated'] } } },
      { $group: { _id: '$targetId', lastEditedAt: { $max: '$createdAt' } } },
    ])
    const tors = await TorModel.find(
      { _id: { $in: lastEdits.map((edit) => edit._id) } },
      { externalId: 1, lastEditedAt: 1 },
    ).lean()
    const lastEditById = new Map(lastEdits.map((edit) => [String(edit._id), edit.lastEditedAt]))

    const torWrites: { _id: unknown; lastEditedAt: Date }[] = []
    for (const tor of tors) {
      const stamp = planTorEditStamp(tor, lastEditById.get(String(tor._id))!)
      if (!stamp) continue
      torWrites.push({ _id: tor._id, lastEditedAt: stamp })
      console.log(`  TOR ${tor.externalId}: lastEditedAt -> ${stamp.toISOString()}`)
    }
    console.log(`TORs with edit logs: ${tors.length}, to stamp: ${torWrites.length}`)

    if (!apply) return

    if (userWrites.length > 0) {
      await User.collection.bulkWrite(
        userWrites.map((write) => ({
          updateOne: { filter: { _id: write._id as never }, update: { $set: write.fix } },
        })),
      )
    }
    if (torWrites.length > 0) {
      await TorModel.bulkWrite(
        torWrites.map((write) => ({
          updateOne: {
            filter: { _id: write._id },
            update: { $set: { lastEditedAt: write.lastEditedAt } },
          },
        })),
      )
    }
    console.log(`Wrote ${userWrites.length} users and ${torWrites.length} TORs`)
  } finally {
    await database.disconnect()
  }
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  migrateLegacyData(process.argv.includes('--apply')).catch((error: unknown) => {
    console.error('Legacy data migration failed:', error)
    process.exitCode = 1
  })
}
