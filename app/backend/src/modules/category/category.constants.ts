// The category a TOR gets when the keyword fallback matches nothing (see deriveCategory in
// tor.controller.ts). Admins cannot hide or delete it, so that fallback always points at a live,
// filterable category.
export const DEFAULT_CATEGORY_KEY = 'enterprise_system'

// Seed data only. Categories live in the `categories` collection and are managed by admins;
// application code must read them from the database (category.repository.ts), never from here.
// scripts/seed-categories.ts inserts these once (keywords come from the keyword rules in
// tor.controller.ts). Descriptions are the texts of the profile page's interest cards.
export const CATEGORY_SEED: {
  key: string
  name: string
  description: string
  aiHint: string
}[] = [
  {
    key: 'web_application',
    name: 'งานพัฒนาเว็บไซต์',
    description: 'ระบบเว็บแอปพลิเคชันและพอร์ทัลบริการประชาชน',
    aiHint: 'Websites, web portals, e-service and citizen-facing web systems.',
  },
  {
    key: 'data_bi',
    name: 'งานข้อมูลและวิเคราะห์',
    description: 'ระบบข้อมูล วิเคราะห์ และแดชบอร์ดผู้บริหาร',
    aiHint: 'Data warehouses, data platforms, reporting, BI and executive dashboards.',
  },
  {
    key: 'mobile_app',
    name: 'งานแอปพลิเคชันมือถือ',
    description: 'แอปพลิเคชันบนมือถือ iOS และ Android',
    aiHint: 'Native or cross-platform apps delivered on iOS or Android.',
  },
  {
    key: 'enterprise_system',
    name: 'งานระบบองค์กร',
    description: 'ระบบสารสนเทศองค์กรและงานหลังบ้าน',
    aiHint: 'ERP, finance, HR, procurement, document and other back-office systems.',
  },
  {
    key: 'consulting_architecture',
    name: 'งานที่ปรึกษาและออกแบบสถาปัตยกรรมระบบ',
    description: 'งานที่ปรึกษาและออกแบบสถาปัตยกรรมระบบ',
    aiHint: 'Studies, master plans, IT consulting, system design and architecture work.',
  },
  {
    key: 'cybersecurity',
    name: 'งานความมั่นคงปลอดภัยไซเบอร์',
    description: 'ความมั่นคงปลอดภัยไซเบอร์และการตรวจสอบระบบ',
    aiHint: 'Security systems, SOC, penetration testing, audits and security compliance.',
  },
  {
    key: 'ai_ml',
    name: 'งานปัญญาประดิษฐ์และแมชชีนเลิร์นนิง',
    description: 'ปัญญาประดิษฐ์ การวิเคราะห์ขั้นสูงและระบบอัตโนมัติ',
    aiHint: 'AI, machine learning, computer vision, NLP, chatbots and automation.',
  },
  {
    key: 'cloud_infrastructure',
    name: 'งานคลาวด์และโครงสร้างพื้นฐาน',
    description: 'โครงสร้างพื้นฐาน คลาวด์ และระบบเครือข่าย',
    aiHint: 'Cloud services, servers, data centres, networks and IT infrastructure.',
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
