import { pathToFileURL } from 'node:url'

import { database } from '../config/mongoose.js'
import { User } from '../modules/auth/user.model.js'
import { CATEGORY_KEYS, type TorCategory } from '../modules/category/category.constants.js'
import { deriveCategory } from '../modules/tor/tor.controller.js'
import { TorModel } from '../modules/tor/tor.model.js'

// Moves existing data onto the 8-category set. Safe to re-run.
//   npm run migrate:categories            -> dry run (default), prints what would change
//   npm run migrate:categories -- --apply -> writes the changes
// Never run --apply against the shared/production database without the team's approval.

// Frozen copy of the 5-category rules that existed before the 8-category change, used only to
// report "old -> new" for TORs that never had a stored category. Do not update this list.
const OLD_MOBILE_APP = ['flutter', 'react native', 'swift', 'kotlin', 'android', 'ios']
const OLD_DATA_BI = [
  'python',
  'power bi',
  'tableau',
  'machine learning',
  'sql server',
  'postgresql',
]
const OLD_WEB_APPLICATION = ['react', 'next.js', 'vue', 'angular', 'node.js', 'express', 'django']
const OLD_CONSULTING_ARCHITECTURE = [
  'consulting',
  'advisory',
  'enterprise architecture',
  'business analysis',
  'it strategy',
  'it governance',
  'togaf',
]

const oldMatchesAny = (technologies: string[], keywords: string[]): boolean =>
  technologies.some((tech) => keywords.some((keyword) => tech.includes(keyword)))

export function deriveOldCategory(technologies: string[]): TorCategory {
  const normalized = technologies.map((tech) => tech.toLowerCase())
  if (oldMatchesAny(normalized, OLD_MOBILE_APP)) return 'mobile_app'
  const hasWeb = oldMatchesAny(normalized, OLD_WEB_APPLICATION)
  if (oldMatchesAny(normalized, OLD_DATA_BI) && !hasWeb) return 'data_bi'
  if (hasWeb) return 'web_application'
  if (oldMatchesAny(normalized, OLD_CONSULTING_ARCHITECTURE)) return 'consulting_architecture'
  return 'enterprise_system'
}

// Ids the profile page stored before interests used category keys.
// TODO(QUESTION-5): confirm this mapping; see QUESTIONS.md
export const LEGACY_INTEREST_MAP: Record<string, TorCategory> = {
  web: 'web_application',
  data: 'data_bi',
  mobile: 'mobile_app',
  enterprise: 'enterprise_system',
  consulting: 'consulting_architecture',
  cybersecurity: 'cybersecurity',
  ai: 'ai_ml',
  cloud: 'cloud_infrastructure',
}

interface TorForMigration {
  category?: string | null
  categoryOverridden?: boolean
  reviewStatus?: string | null
  lastEditedAt?: Date | null
  technologies?: string[]
}

export type TorMigrationPlan =
  | { type: 'skip'; reason: 'edited' | 'verified' | 'overridden' }
  | { type: 'unchanged'; category: TorCategory }
  | { type: 'update'; from: TorCategory; to: TorCategory }

// TODO(QUESTION-3): protected TORs with no stored category still resolve with the new rules; see QUESTIONS.md
export function planTorCategory(tor: TorForMigration): TorMigrationPlan {
  if (tor.categoryOverridden) return { type: 'skip', reason: 'overridden' }
  if (tor.lastEditedAt) return { type: 'skip', reason: 'edited' }
  if (tor.reviewStatus === 'verified') return { type: 'skip', reason: 'verified' }

  const to = deriveCategory(tor.technologies ?? [])
  const from =
    (tor.category as TorCategory | null | undefined) ?? deriveOldCategory(tor.technologies ?? [])

  // A missing stored category is written even when the derived value did not move.
  if (tor.category === to) return { type: 'unchanged', category: to }
  return { type: 'update', from, to }
}

export function mapInterests(interests: string[]): {
  mapped: TorCategory[]
  unmapped: string[]
  changed: boolean
} {
  const keys = CATEGORY_KEYS as readonly string[]
  const mapped: TorCategory[] = []
  const unmapped: string[] = []

  for (const value of interests) {
    const key = keys.includes(value) ? (value as TorCategory) : LEGACY_INTEREST_MAP[value]
    if (key) {
      if (!mapped.includes(key)) mapped.push(key)
    } else {
      unmapped.push(value)
    }
  }

  const changed =
    unmapped.length === 0 &&
    (mapped.length !== interests.length || mapped.some((key, i) => key !== interests[i]))
  return { mapped, unmapped, changed }
}

async function migrateCategories(apply: boolean): Promise<void> {
  await database.connect()

  try {
    console.log(apply ? '=== APPLY: writing changes ===' : '=== DRY RUN: nothing is written ===')

    // --- TORs -------------------------------------------------------------
    const tors = await TorModel.find(
      {},
      { category: 1, categoryOverridden: 1, reviewStatus: 1, lastEditedAt: 1, technologies: 1 },
    ).lean()

    const moves = new Map<string, number>()
    const skipped = { edited: 0, verified: 0, overridden: 0 }
    let unchanged = 0
    const torWrites: { _id: unknown; category: TorCategory }[] = []

    for (const tor of tors) {
      const plan = planTorCategory(tor)
      if (plan.type === 'skip') {
        skipped[plan.reason] += 1
      } else if (plan.type === 'unchanged') {
        unchanged += 1
      } else {
        const pair = `${plan.from} -> ${plan.to}`
        moves.set(pair, (moves.get(pair) ?? 0) + 1)
        torWrites.push({ _id: tor._id, category: plan.to })
      }
    }

    console.log(`TORs scanned: ${tors.length}`)
    console.log(`  already correct: ${unchanged}`)
    console.log(
      `  skipped: edited=${skipped.edited} verified=${skipped.verified} overridden=${skipped.overridden}`,
    )
    console.log(`  to write: ${torWrites.length} (old -> new)`)
    for (const [pair, count] of [...moves.entries()].sort()) {
      console.log(`    ${pair}: ${count}`)
    }

    // --- User interests ---------------------------------------------------
    const users = await User.find(
      { interests: { $exists: true, $ne: [] } },
      { email: 1, interests: 1 },
    ).lean()
    const userWrites: { _id: unknown; interests: TorCategory[] }[] = []
    let usersWithUnmapped = 0

    for (const user of users) {
      const { mapped, unmapped, changed } = mapInterests(user.interests ?? [])
      if (unmapped.length > 0) {
        // Leave the whole list untouched so nothing is dropped silently.
        usersWithUnmapped += 1
        console.log(`  UNMAPPED interests for ${user.email}: ${unmapped.join(', ')} (left as is)`)
      } else if (changed) {
        userWrites.push({ _id: user._id, interests: mapped })
      }
    }

    console.log(`Users with interests: ${users.length}`)
    console.log(`  to rewrite: ${userWrites.length}`)
    console.log(`  with unmapped values (not changed): ${usersWithUnmapped}`)

    if (!apply) return

    if (torWrites.length > 0) {
      await TorModel.bulkWrite(
        torWrites.map((write) => ({
          updateOne: { filter: { _id: write._id }, update: { $set: { category: write.category } } },
        })),
      )
    }
    if (userWrites.length > 0) {
      await User.bulkWrite(
        userWrites.map((write) => ({
          updateOne: {
            filter: { _id: write._id },
            update: { $set: { interests: write.interests } },
          },
        })),
      )
    }
    console.log(`Wrote ${torWrites.length} TORs and ${userWrites.length} users`)
  } finally {
    await database.disconnect()
  }
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  migrateCategories(process.argv.includes('--apply')).catch((error: unknown) => {
    console.error('Category migration failed:', error)
    process.exitCode = 1
  })
}
