import { pathToFileURL } from 'node:url'

import { database } from '../config/mongoose.js'
import { CATEGORY_SEED } from '../modules/category/category.constants.js'
import { CategoryModel } from '../modules/category/category.model.js'
import { normalizeKeywords } from '../modules/category/category.repository.js'
import { CATEGORY_RULE_KEYWORDS } from '../modules/tor/tor.controller.js'

// Inserts the 8 original categories when they are missing. Safe to re-run: existing categories
// (matched by key) are never changed, so admin edits survive. Run once before deploying.
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
