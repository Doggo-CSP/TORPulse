// Thai labels for the keys the bidder profile and qualification match API return.

import type {
  RequirementCategory,
  RequirementStatus,
} from "@/api/bidder-profile.api";

export const REQUIREMENT_CATEGORY_LABELS: Record<RequirementCategory, string> = {
  legal: "คุณสมบัติตามกฎหมาย",
  financial: "ฐานะการเงิน",
  experience: "ผลงาน/ประสบการณ์",
  personnel: "บุคลากร",
  certification: "ใบรับรอง",
  technical: "ด้านเทคนิค",
  other: "อื่นๆ",
};

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  met: "ตรงตามเงื่อนไข",
  partial: "ตรงบางส่วน",
  not_met: "ยังไม่ตรง",
  unknown: "ไม่มีข้อมูล",
};

// Keys of completeness.missing (backend profileCompleteness)
const MISSING_FIELD_LABELS: Record<string, string> = {
  accountType: "เลือกประเภทบัญชีเป็นบุคคลธรรมดาหรือนิติบุคคล",
  name: "ชื่อ-นามสกุล หรือชื่อที่แสดง",
  contact: "อีเมลหรือเบอร์โทรติดต่อ",
  companyName: "ชื่อบริษัท",
  businessType: "ประเภทธุรกิจ",
  "organization.registeredCapitalBaht": "ทุนจดทะเบียน",
  projects: "ผลงานที่ผ่านมาอย่างน้อย 1 โครงการ พร้อมมูลค่าสัญญา",
};

export const missingFieldLabel = (key: string) => MISSING_FIELD_LABELS[key] ?? key;

/** The fields profileCompleteness requires, per account type, in the order they are asked. */
export const REQUIRED_PROFILE_FIELDS: Record<"personal" | "company", string[]> = {
  personal: ["name", "contact", "projects"],
  company: ["companyName", "businessType", "organization.registeredCapitalBaht", "projects"],
};

export const STAFF_ROLE_LABELS: Record<string, string> = {
  project_manager: "ผู้จัดการโครงการ (PM)",
  system_analyst: "นักวิเคราะห์ระบบ (SA)",
  developer: "นักพัฒนาโปรแกรม",
  database_admin: "ผู้ดูแลฐานข้อมูล",
  system_engineer: "วิศวกรระบบ",
  ux_ui_designer: "นักออกแบบ UX/UI",
  it_support: "เจ้าหน้าที่ IT Support",
  coordinator: "ผู้ประสานงาน",
  network_engineer: "วิศวกรเครือข่าย",
  security_specialist: "ผู้เชี่ยวชาญความปลอดภัย",
};

export const EDUCATION_LEVEL_LABELS: Record<string, string> = {
  vocational: "ปวช.",
  high_vocational: "ปวส.",
  bachelor: "ปริญญาตรี",
  master: "ปริญญาโท",
  doctorate: "ปริญญาเอก",
};

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  permanent: "พนักงานประจำ",
  contract: "สัญญาจ้าง",
};

export const JURISTIC_TYPE_LABELS: Record<string, string> = {
  company_limited: "บริษัทจำกัด",
  public_company_limited: "บริษัทมหาชนจำกัด",
  limited_partnership: "ห้างหุ้นส่วนจำกัด",
  registered_partnership: "ห้างหุ้นส่วนสามัญนิติบุคคล",
  other: "อื่นๆ",
};

export const PROJECT_CLIENT_TYPE_LABELS: Record<string, string> = {
  government: "หน่วยงานรัฐ",
  state_enterprise: "รัฐวิสาหกิจ",
  private: "เอกชน",
};

export const PROJECT_ROLE_LABELS: Record<string, string> = {
  prime: "คู่สัญญาหลัก",
  consortium: "กิจการร่วมค้า",
  subcontractor: "ผู้รับจ้างช่วง",
};

export interface Verdict {
  label: string;
  description: string;
  badgeCls: string;
  barCls: string;
}

/**
 * Verdict shown next to the score: the thresholds and wording of the original frontend matcher,
 * except that a mandatory requirement not met always gives "ขาดคุณสมบัติสำคัญ", whatever the score.
 */
export function verdictFor(percentage: number | null, allMandatoryMet: boolean): Verdict {
  if (percentage === null) {
    return {
      label: "ยังประเมินไม่ได้",
      description: "TOR นี้ไม่มีเงื่อนไขคุณสมบัติที่ประเมินได้",
      badgeCls: "bg-surface-2 text-muted-foreground border-border",
      barCls: "bg-muted-foreground/40",
    };
  }
  if (!allMandatoryMet) {
    return {
      label: "ขาดคุณสมบัติสำคัญ",
      description: "บริษัทขาดเกณฑ์บังคับในการยื่นข้อเสนอ ควรปรับปรุงข้อมูลหรือแก้เงื่อนไขก่อนยื่น",
      badgeCls: "bg-rose-50 text-rose-700 border-rose-200",
      barCls: "bg-rose-500",
    };
  }
  if (percentage >= 80) {
    return {
      label: "ผ่านเกณฑ์ (คุณสมบัติเหมาะสม)",
      description: "บริษัทมีคุณสมบัติตรงตามเกณฑ์ส่วนใหญ่ พร้อมสำหรับการจัดทำข้อเสนอประกวดราคา",
      badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      barCls: "bg-emerald-500",
    };
  }
  if (percentage >= 50) {
    return {
      label: "ผ่านเกณฑ์บางส่วน (ควรพิจารณา)",
      description: "มีโอกาสยื่นข้อเสนอได้ แต่ต้องเตรียมเอกสารหรือหาพาร์ทเนอร์เสริมในส่วนที่ขาด",
      badgeCls: "bg-amber-50 text-amber-700 border-amber-200",
      barCls: "bg-amber-500",
    };
  }
  return {
    label: "ไม่ผ่านเกณฑ์ (ไม่เหมาะสม)",
    description: "มีหลายเงื่อนไขที่ยังไม่ตรงกับโปรไฟล์บริษัท อาจไม่ผ่านการประเมินเบื้องต้น",
    badgeCls: "bg-rose-50 text-rose-700 border-rose-200",
    barCls: "bg-rose-500",
  };
}
