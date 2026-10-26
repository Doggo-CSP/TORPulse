import { pathToFileURL } from 'node:url'

import { database } from '../config/mongoose.js'
import { User } from '../modules/auth/user.model.js'
import { LEGACY_INTEREST_IDS } from '../modules/category/category.constants.js'
import { CategoryModel } from '../modules/category/category.model.js'
import { deriveCategory } from '../modules/tor/tor.controller.js'
import { TorModel } from '../modules/tor/tor.model.js'

// Moves existing data onto the 8-category set. Safe to re-run.
//   npm run migrate:categories                          -> dry run of user interests and legacy
//                                                          TOR keys (default)
//   npm run migrate:categories -- --apply               -> rewrites user interests and renames
//                                                          legacy TOR keys ("web" -> "web_application")
//   npm run migrate:categories -- --include-tors        -> also plans TOR categories (dry run)
// TOR categorisation from real data is next sprint's work: do not combine --include-tors with
// --apply on a shared or production database.

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

export function deriveOldCategory(technologies: string[]): string {
  const normalized = technologies.map((tech) => tech.toLowerCase())
  if (oldMatchesAny(normalized, OLD_MOBILE_APP)) return 'mobile_app'
  const hasWeb = oldMatchesAny(normalized, OLD_WEB_APPLICATION)
  if (oldMatchesAny(normalized, OLD_DATA_BI) && !hasWeb) return 'data_bi'
  if (hasWeb) return 'web_application'
  if (oldMatchesAny(normalized, OLD_CONSULTING_ARCHITECTURE)) return 'consulting_architecture'
  return 'enterprise_system'
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
  | { type: 'unchanged'; category: string }
  | { type: 'update'; from: string; to: string }

export function planTorCategory(tor: TorForMigration): TorMigrationPlan {
  if (tor.categoryOverridden) return { type: 'skip', reason: 'overridden' }
  if (tor.lastEditedAt) return { type: 'skip', reason: 'edited' }
  if (tor.reviewStatus === 'verified') return { type: 'skip', reason: 'verified' }

  const to = deriveCategory(tor.technologies ?? [])
  const from =
    (tor.category as string | null | undefined) ?? deriveOldCategory(tor.technologies ?? [])

  // A missing stored category is written even when the derived value did not move.
  if (tor.category === to) return { type: 'unchanged', category: to }
  return { type: 'update', from, to }
}

// Renames legacy keys ("web", "ai", ...) stored by the old AI classifier to their category keys,
// keeping the AI's choice. Returns null when nothing changes.
export function mapLegacyTorCategories(tor: {
  category?: string | null
  categories?: string[] | null
}): { category: string | null; categories: string[] } | null {
  const rename = (key: string) => LEGACY_INTEREST_IDS[key] ?? key
  const category = tor.category ? rename(tor.category) : (tor.category ?? null)
  const categories = [...new Set((tor.categories ?? []).map(rename))]

  const changed =
    category !== (tor.category ?? null) ||
    categories.length !== (tor.categories ?? []).length ||
    categories.some((key, i) => key !== tor.categories?.[i])
  return changed ? { category, categories } : null
}

// categoryKeys: every key in the categories collection (hidden ones included).
export function mapInterests(
  interests: string[],
  categoryKeys: ReadonlySet<string>,
): {
  mapped: string[]
  unmapped: string[]
  changed: boolean
} {
  const mapped: string[] = []
  const unmapped: string[] = []

  for (const value of interests) {
    const key = categoryKeys.has(value) ? value : LEGACY_INTEREST_IDS[value]
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

async function migrateCategories(apply: boolean, includeTors: boolean): Promise<void> {
  await database.connect()

  try {
    console.log(apply ? '=== APPLY: writing changes ===' : '=== DRY RUN: nothing is written ===')

    // --- TORs (only with --include-tors) -----------------------------------
    const tors = includeTors
      ? await TorModel.find(
          {},
          { category: 1, categoryOverridden: 1, reviewStatus: 1, lastEditedAt: 1, technologies: 1 },
        ).lean()
      : []

    const moves = new Map<string, number>()
    const skipped = { edited: 0, verified: 0, overridden: 0 }
    let unchanged = 0
    const torWrites: { _id: unknown; category: string }[] = []

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

    if (!includeTors) {
      console.log('TORs: skipped (pass --include-tors to plan them)')
    } else {
      console.log(`TORs scanned: ${tors.length}`)
      console.log(`  already correct: ${unchanged}`)
      console.log(
        `  skipped: edited=${skipped.edited} verified=${skipped.verified} overridden=${skipped.overridden}`,
      )
      console.log(`  to write: ${torWrites.length} (old -> new)`)
      for (const [pair, count] of [...moves.entries()].sort()) {
        console.log(`    ${pair}: ${count}`)
      }
    }

    // --- Legacy TOR keys (always) -----------------------------------------
    const legacyKeys = Object.keys(LEGACY_INTEREST_IDS).filter(
      (key) => LEGACY_INTEREST_IDS[key] !== key,
    )
    const legacyTors = await TorModel.find(
      { $or: [{ category: { $in: legacyKeys } }, { categories: { $in: legacyKeys } }] },
      { category: 1, categories: 1 },
    ).lean()
    const legacyWrites: { _id: unknown; category: string | null; categories: string[] }[] = []
    for (const tor of legacyTors) {
      const mapped = mapLegacyTorCategories(tor)
      if (mapped) legacyWrites.push({ _id: tor._id, ...mapped })
    }
    console.log(`TORs with legacy category keys to rename: ${legacyWrites.length}`)

    // --- User interests ---------------------------------------------------
    const users = await User.find(
      { interests: { $exists: true, $ne: [] } },
      { email: 1, interests: 1 },
    ).lean()
    const categoryKeys = new Set(
      (await CategoryModel.find({}, { key: 1 }).lean()).map((category) => category.key),
    )
    const userWrites: { _id: unknown; interests: string[] }[] = []
    let usersWithUnmapped = 0

    for (const user of users) {
      const { mapped, unmapped, changed } = mapInterests(user.interests ?? [], categoryKeys)
      if (unmapped.length > 0) {
        // Leave the whole list untouched so nothing is dropped silently.
        usersWithUnmapped += 1
        console.log(`  UNMAPPED interests for ${user.email}: ${unmapped.join(', ')} (left as is)`)
      } else if (changed) {
        userWrites.push({ _id: user._id, interests: mapped })
        console.log(`  ${user.email}: ${(user.interests ?? []).join(', ')} -> ${mapped.join(', ')}`)
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
    if (legacyWrites.length > 0) {
      await TorModel.bulkWrite(
        legacyWrites.map(({ _id, category, categories }) => ({
          updateOne: { filter: { _id }, update: { $set: { category, categories } } },
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
    console.log(
      `Wrote ${torWrites.length} TORs, renamed legacy keys on ${legacyWrites.length} TORs, and ${userWrites.length} users`,
    )
  } finally {
    await database.disconnect()
  }
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  migrateCategories(
    process.argv.includes('--apply'),
    process.argv.includes('--include-tors'),
  ).catch((error: unknown) => {
    console.error('Category migration failed:', error)
    process.exitCode = 1
  })
}
