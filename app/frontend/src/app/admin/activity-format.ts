import type { ActivityGroup, ActivityItem } from "@/api/admin.api";

// The backend sends one audit-log row per event (`action` + `metadata`) and leaves the wording
// to the frontend. This file turns a row into the Thai sentence shown in the activity feed.

const FIELD_LABELS: Record<string, string> = {
  role: "บทบาท",
  status: "สถานะ",
  name: "ชื่อ",
  jobTitle: "ตำแหน่ง",
  agencyName: "หน่วยงาน",
  companyName: "บริษัท",
  accountType: "ประเภทบัญชี",
  budgetBaht: "งบประมาณ",
  scope: "ขอบเขตงาน",
  technologies: "เทคโนโลยี",
  category: "หมวดหมู่",
  bidderQualifications: "คุณสมบัติผู้ยื่น",
  deliverables: "สิ่งที่ต้องส่งมอบ",
  timeline: "ระยะเวลา",
  evaluationCriteria: "เกณฑ์การพิจารณา",
  ingestionEnabled: "ดึงข้อมูลอัตโนมัติ",
  senderEmail: "อีเมลผู้ส่ง",
  description: "คำอธิบาย",
  keywords: "คำสำคัญ",
  aiHint: "คำแนะนำสำหรับ AI",
  reviewStatus: "สถานะการตรวจสอบ",
};

const VALUE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  user: "ผู้ใช้งานทั่วไป",
  active: "ใช้งานอยู่",
  suspended: "ระงับการใช้งาน",
  personal: "บุคคลธรรมดา",
  company: "นิติบุคคล/บริษัท",
  agency: "หน่วยงานรัฐ",
  unverified: "รอตรวจสอบ",
  verified: "ตรวจสอบแล้ว",
  archived: "เก็บเข้าคลัง",
  deleted: "ลบแล้ว",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "เปิด" : "ปิด";
  if (typeof value === "number") return value.toLocaleString("th-TH");
  if (Array.isArray(value)) return value.length === 0 ? "—" : value.map(formatValue).join(", ");
  if (typeof value === "string") return VALUE_LABELS[value] ?? value;
  return JSON.stringify(value);
}

type Changes = Record<string, { from: unknown; to: unknown }>;

function describeChanges(changes: unknown): string | undefined {
  if (!changes || typeof changes !== "object") return undefined;
  const lines = Object.entries(changes as Changes).map(
    ([field, change]) =>
      `${FIELD_LABELS[field] ?? field}: ${formatValue(change?.from)} → ${formatValue(change?.to)}`
  );
  return lines.length > 0 ? lines.join(" · ") : undefined;
}

const num = (value: unknown) => (typeof value === "number" ? value.toLocaleString("th-TH") : "0");

export function activityActorName(item: ActivityItem): string {
  if (item.actor.type === "system") return "ระบบ (ตั้งเวลาอัตโนมัติ)";
  return item.actor.name ?? "ผู้ดูแลระบบ";
}

export function describeActivity(item: ActivityItem): { title: string; detail?: string } {
  const target = item.target.label ?? item.target.id;
  const meta = item.metadata;
  const changes = describeChanges(meta.changes);

  switch (item.action) {
    case "user.role_changed":
      return { title: `เปลี่ยนบทบาทของ ${target}`, detail: changes };
    case "user.suspended":
      return { title: `ระงับบัญชี ${target}` };
    case "user.reactivated":
      return { title: `เปิดใช้งานบัญชี ${target} อีกครั้ง` };
    case "user.updated":
      return { title: `แก้ไขข้อมูลผู้ใช้ ${target}`, detail: changes };
    case "tor.updated":
      return { title: `แก้ไขข้อมูล TOR ${target}`, detail: changes };
    case "tor.verified":
      return { title: `ยืนยันความถูกต้องของ TOR ${target}` };
    case "tor.archived":
      return { title: `เก็บ TOR ${target} เข้าคลัง` };
    case "tor.deleted":
      return { title: `ลบ TOR ${target}` };
    case "settings.updated":
      return { title: "แก้ไขการตั้งค่าระบบ", detail: changes };
    case "category.created":
      return { title: `เพิ่มหมวดหมู่ "${target}"` };
    case "category.updated":
      return { title: `แก้ไขหมวดหมู่ "${target}"`, detail: changes };
    case "category.shown":
      return { title: `แสดงหมวดหมู่ "${target}"` };
    case "category.hidden":
      return { title: `ซ่อนหมวดหมู่ "${target}"` };
    case "category.deleted":
      return { title: `ลบหมวดหมู่ "${target}"` };
    case "ingestion.completed": {
      const how = meta.trigger === "manual" ? "สั่งดึงเอง" : "ตามรอบเวลา";
      return {
        title: `ดึงข้อมูล ${formatValue(meta.source)} สำเร็จ (${how})`,
        detail: `พบ ${num(meta.fetchedCount)} โครงการ · ใหม่ ${num(meta.createdCount)} · มีอยู่แล้ว ${num(meta.existingCount)}`,
      };
    }
    case "ingestion.failed":
      return {
        title: `ดึงข้อมูล ${formatValue(meta.source)} ไม่สำเร็จ`,
        detail: typeof meta.errorMessage === "string" ? meta.errorMessage : undefined,
      };
    default:
      return { title: `${item.action} · ${target}`, detail: changes };
  }
}

export const ACTIVITY_GROUP_CONFIG: Record<
  ActivityGroup,
  { label: string; filterLabel: string; badge: string; dot: string }
> = {
  users: {
    label: "ผู้ใช้งาน",
    filterLabel: "การจัดการสิทธิ์และผู้ใช้",
    badge: "bg-blue-100 text-blue-800",
    dot: "bg-blue-500",
  },
  ingestion: {
    label: "e-GP",
    filterLabel: "การดึงข้อมูล e-GP",
    badge: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
  tor: {
    label: "TOR",
    filterLabel: "การปรับปรุงประกาศ TOR",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  system: {
    label: "ระบบ",
    filterLabel: "หมวดหมู่และการตั้งค่า",
    badge: "bg-stone-100 text-stone-800",
    dot: "bg-stone-400",
  },
};

export function formatRelativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "—";
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "เมื่อวาน";
  if (days < 7) return `${days} วันที่แล้ว`;
  return formatThaiDateTime(iso);
}

export function formatThaiDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
