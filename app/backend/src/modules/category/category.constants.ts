// Seed data only. Categories live in the `categories` collection and are managed by admins;
// application code must read them from the database (category.repository.ts), never from here.
// scripts/seed-categories.ts inserts these once (keywords come from the keyword rules in
// tor.controller.ts). Descriptions are the texts of the profile page's interest cards.
export const CATEGORY_SEED: { key: string; name: string; description: string }[] = [
  {
    key: 'web_application',
    name: 'งานพัฒนาเว็บไซต์',
    description: 'ระบบเว็บแอปพลิเคชันและพอร์ทัลบริการประชาชน',
  },
  {
    key: 'data_bi',
    name: 'งานข้อมูลและวิเคราะห์',
    description: 'ระบบข้อมูล วิเคราะห์ และแดชบอร์ดผู้บริหาร',
  },
  {
    key: 'mobile_app',
    name: 'งานแอปพลิเคชันมือถือ',
    description: 'แอปพลิเคชันบนมือถือ iOS และ Android',
  },
  {
    key: 'enterprise_system',
    name: 'งานระบบองค์กร',
    description: 'ระบบสารสนเทศองค์กรและงานหลังบ้าน',
  },
  {
    key: 'consulting_architecture',
    name: 'งานที่ปรึกษาและออกแบบสถาปัตยกรรมระบบ',
    description: 'งานที่ปรึกษาและออกแบบสถาปัตยกรรมระบบ',
  },
  {
    key: 'cybersecurity',
    name: 'งานความมั่นคงปลอดภัยไซเบอร์',
    description: 'ความมั่นคงปลอดภัยไซเบอร์และการตรวจสอบระบบ',
  },
  {
    key: 'ai_ml',
    name: 'งานปัญญาประดิษฐ์และแมชชีนเลิร์นนิง',
    description: 'ปัญญาประดิษฐ์ การวิเคราะห์ขั้นสูงและระบบอัตโนมัติ',
  },
  {
    key: 'cloud_infrastructure',
    name: 'งานคลาวด์และโครงสร้างพื้นฐาน',
    description: 'โครงสร้างพื้นฐาน คลาวด์ และระบบเครือข่าย',
  },
]

// TODO(LEGACY-INTEREST-IDS): the profile page still sends its own ids instead of category keys.
// PUT /user/interests converts them with this map, and scripts/migrate-categories.ts rewrites
// stored values. Remove this map (and its uses) once the frontend sends category keys.
export const LEGACY_INTEREST_IDS: Record<string, string> = {
  web: 'web_application',
  data: 'data_bi',
  mobile: 'mobile_app',
  enterprise: 'enterprise_system',
  consulting: 'consulting_architecture',
  cybersecurity: 'cybersecurity',
  ai: 'ai_ml',
  cloud: 'cloud_infrastructure',
}
