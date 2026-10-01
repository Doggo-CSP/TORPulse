export interface CategoryDefinition {
  key: string
  name: string
  description: string
  aiHint: string | null
  order: number
}

export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  {
    key: 'web',
    name: 'Web Application',
    description: 'ระบบเว็บแอปพลิเคชันและพอร์ทัลบริการประชาชน',
    aiHint: 'Websites, web portals, e-service and citizen-facing web systems.',
    order: 1,
  },
  {
    key: 'data',
    name: 'Data / BI',
    description: 'ระบบข้อมูล วิเคราะห์ และแดชบอร์ดผู้บริหาร',
    aiHint: 'Data warehouses, data platforms, reporting, BI and executive dashboards.',
    order: 2,
  },
  {
    key: 'mobile',
    name: 'Mobile App',
    description: 'แอปพลิเคชันบนมือถือ iOS และ Android',
    aiHint: 'Native or cross-platform apps delivered on iOS or Android.',
    order: 3,
  },
  {
    key: 'enterprise',
    name: 'Enterprise System',
    description: 'ระบบสารสนเทศองค์กรและงานหลังบ้าน',
    aiHint: 'ERP, finance, HR, procurement, document and other back-office systems.',
    order: 4,
  },
  {
    key: 'consulting',
    name: 'Consulting / Architecture',
    description: 'งานที่ปรึกษาและออกแบบสถาปัตยกรรมระบบ',
    aiHint: 'Studies, master plans, IT consulting, system design and architecture work.',
    order: 5,
  },
  {
    key: 'cybersecurity',
    name: 'Cybersecurity',
    description: 'ความมั่นคงปลอดภัยไซเบอร์และการตรวจสอบระบบ',
    aiHint: 'Security systems, SOC, penetration testing, audits and security compliance.',
    order: 6,
  },
  {
    key: 'ai',
    name: 'AI & Machine Learning',
    description: 'ปัญญาประดิษฐ์ การวิเคราะห์ขั้นสูงและระบบอัตโนมัติ',
    aiHint: 'AI, machine learning, computer vision, NLP, chatbots and automation.',
    order: 7,
  },
  {
    key: 'cloud',
    name: 'Cloud & Infrastructure',
    description: 'โครงสร้างพื้นฐาน คลาวด์ และระบบเครือข่าย',
    aiHint: 'Cloud services, servers, data centres, networks and IT infrastructure.',
    order: 8,
  },
]
