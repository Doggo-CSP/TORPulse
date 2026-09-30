// Single source of truth for TOR categories. The order of CATEGORY_KEYS is the display order
// everywhere (GET /categories, reports, homepage). Keep this file free of model imports so
// tor.model.ts can build its enum from it without a circular import.
export const CATEGORY_KEYS = [
  'web_application',
  'data_bi',
  'mobile_app',
  'enterprise_system',
  'consulting_architecture',
  'cybersecurity',
  'ai_ml',
  'cloud_infrastructure',
] as const

export type TorCategory = (typeof CATEGORY_KEYS)[number]

export const CATEGORY_LABELS: Record<TorCategory, string> = {
  web_application: 'งานพัฒนาเว็บไซต์',
  data_bi: 'งานข้อมูลและวิเคราะห์',
  mobile_app: 'งานแอปพลิเคชันมือถือ',
  enterprise_system: 'งานระบบองค์กร',
  consulting_architecture: 'งานที่ปรึกษาและออกแบบสถาปัตยกรรมระบบ',
  cybersecurity: 'งานความมั่นคงปลอดภัยไซเบอร์',
  ai_ml: 'งานปัญญาประดิษฐ์และแมชชีนเลิร์นนิง',
  cloud_infrastructure: 'งานคลาวด์และโครงสร้างพื้นฐาน',
}

// TODO(LEGACY-INTEREST-IDS): the profile page still sends its own ids instead of category keys.
// PUT /user/interests converts them with this map, and scripts/migrate-categories.ts rewrites
// stored values. Remove this map (and its uses) once the frontend sends category keys.
export const LEGACY_INTEREST_IDS: Record<string, TorCategory> = {
  web: 'web_application',
  data: 'data_bi',
  mobile: 'mobile_app',
  enterprise: 'enterprise_system',
  consulting: 'consulting_architecture',
  cybersecurity: 'cybersecurity',
  ai: 'ai_ml',
  cloud: 'cloud_infrastructure',
}
