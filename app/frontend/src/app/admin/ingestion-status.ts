import type { IngestionStatus } from "@/api/admin.api";

// Why "sync now" cannot run, or null when it can
export function manualSyncBlockedReason(status: IngestionStatus | null): string | null {
  if (!status) return null;
  if (status.manualSyncAvailable === false) {
    return "ระบบยังไม่ได้เปิดใช้การดึงข้อมูล กรุณาแจ้งทีมผู้ดูแลระบบ";
  }
  const sources = status.sources ?? [];
  if (sources.length > 0 && sources.every((source) => !source.enabled)) {
    return "แหล่งข้อมูลถูกปิดอยู่ เปิดได้ที่หน้าตั้งค่าระบบ";
  }
  return null;
}
