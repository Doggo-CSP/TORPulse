import { database } from '../config/mongoose.js'
import { CategoryModel } from '../modules/category/category.model.js'
import { ensureDefaultCategories } from '../modules/category/category.repository.js'

async function main(): Promise<void> {
  await database.connect()

  try {
    await CategoryModel.init()
    const result = await ensureDefaultCategories()
    console.log('Category seed completed', result)
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Category seed failed:', error)
  process.exitCode = 1
})
