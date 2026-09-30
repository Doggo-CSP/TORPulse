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
