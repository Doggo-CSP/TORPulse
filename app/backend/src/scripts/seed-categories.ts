import { pathToFileURL } from 'node:url'

import { database } from '../config/mongoose.js'
import { CATEGORY_SEED } from '../modules/category/category.constants.js'
import { CategoryModel } from '../modules/category/category.model.js'
import { normalizeKeywords } from '../modules/category/category.repository.js'
import { CATEGORY_RULE_KEYWORDS } from '../modules/tor/tor.controller.js'

// Inserts the 8 original categories when they are missing. Safe to re-run: existing categories
// (matched by key) are never changed, so admin edits survive. Also restores a default category
// that was deleted, so run it on purpose only.
//   npm run seed:categories

export async function seedCategories(): Promise<{ created: number; existing: number }> {
  let created = 0

  for (const [index, category] of CATEGORY_SEED.entries()) {
    const keywords = CATEGORY_RULE_KEYWORDS[category.key as keyof typeof CATEGORY_RULE_KEYWORDS]
    const result = await CategoryModel.updateOne(
      { key: category.key },
      {
        $setOnInsert: {
          key: category.key,
          name: category.name,
          description: category.description,
          aiHint: category.aiHint,
          keywords: normalizeKeywords(keywords ?? []),
          isActive: true,
          sortOrder: index + 1,
        },
      },
      { upsert: true },
    )
    created += result.upsertedCount
  }

  return { created, existing: CATEGORY_SEED.length - created }
}

// Used when the API and the ingestion worker start. It seeds only a database with no categories
// at all, so a default category an admin deleted on purpose does not come back on the next
// restart. `npm run seed:categories` still restores any missing default.
export async function seedCategoriesIfEmpty(): Promise<{ created: number; existing: number }> {
  const existing = await CategoryModel.countDocuments()
  if (existing > 0) {
    return { created: 0, existing }
  }
  return seedCategories()
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  ;(async () => {
    await database.connect()
    try {
      const { created, existing } = await seedCategories()
      console.log(`Categories: ${created} created, ${existing} already present`)
    } finally {
      await database.disconnect()
    }
  })().catch((error: unknown) => {
    console.error('Seeding categories failed:', error)
    process.exitCode = 1
  })
}
