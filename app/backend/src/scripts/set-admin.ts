import { pathToFileURL } from 'node:url'
import { database } from '../config/mongoose.js'
import { User } from '../modules/auth/user.model.js'

async function setAdmin(email: string): Promise<void> {
  await database.connect()
  try {
    const targetEmail = email.trim().toLowerCase()
    const user = await User.findOne({ email: targetEmail })

    if (!user) {
      console.log(`⚠️ ไม่พบผู้ใช้ที่มีอีเมล "${targetEmail}" ในฐานข้อมูล`)
      console.log(`💡 กรุณาเข้าสู่ระบบผ่านหน้าเว็บด้วย Google Account นี้ก่อน 1 ครั้ง เพื่อให้สร้าง User Record ใน MongoDB Atlas จากนั้นรันคำสั่งนี้อีกครั้ง`)
      return
    }

    user.role = 'admin'
    user.status = 'active'
    await user.save()

    console.log(`✅ อัปเดตสิทธิ์สำเร็จ: ผู้ใช้ "${user.name}" (${user.email}) ได้รับสิทธิ์ "admin" เรียบร้อยแล้วใน MongoDB Atlas!`)
  } finally {
    await database.disconnect()
  }
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  const targetEmail = process.argv[2]
  if (!targetEmail) {
    console.error('❌ กรุณาระบุอีเมล เช่น: bun run set-admin your.email@gmail.com')
    process.exitCode = 1
  } else {
    setAdmin(targetEmail).catch((error: unknown) => {
      console.error('Set admin failed:', error)
      process.exitCode = 1
    })
  }
}
