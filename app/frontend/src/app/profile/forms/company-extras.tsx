"use client";

const inputCls =
  "w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]";
const labelCls = "block text-xs font-semibold text-[#5c5446] mb-1.5";

/* ───────── ผู้รับผิดชอบหลัก ───────── */

export interface PrimaryContact {
  name: string;
  position: string;
  education: string;
  startDate: string; // yyyy-mm-dd
}

const EDUCATION_OPTIONS = [
  "ต่ำกว่าปริญญาตรี",
  "ประกาศนียบัตร (ปวช./ปวส.)",
  "ปริญญาตรี",
  "ปริญญาโท",
  "ปริญญาเอก",
  "อื่นๆ",
];

export function PrimaryContactFields({
  value,
  onChange,
}: {
  value?: PrimaryContact;
  onChange: (v: PrimaryContact) => void;
}) {
  const v: PrimaryContact = value ?? { name: "", position: "", education: "", startDate: "" };
  const set = (patch: Partial<PrimaryContact>) => onChange({ ...v, ...patch });

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div>
        <label className={labelCls}>ชื่อ-นามสกุล</label>
        <input
          type="text"
          className={inputCls}
          value={v.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      <div>
        <label className={labelCls}>ตำแหน่งงาน</label>
        <input
          type="text"
          className={inputCls}
          value={v.position}
          placeholder="เช่น ผู้จัดการโครงการ / วิศวกรใหญ่"
          onChange={(e) => set({ position: e.target.value })}
        />
      </div>
      <div>
        <label className={labelCls}>วุฒิการศึกษา</label>
        <select
          className={inputCls}
          value={v.education}
          onChange={(e) => set({ education: e.target.value })}
        >
          <option value="">เลือกวุฒิการศึกษา</option>
          {EDUCATION_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>วันที่เข้ามาทำงานที่บริษัท</label>
        <input
          type="date"
          className={inputCls}
          value={v.startDate}
          onChange={(e) => set({ startDate: e.target.value })}
        />
      </div>
    </div>
  );
}

/** จำนวนช่องที่กรอกแล้ว (0–4) ใช้แสดง badge เช่น "2/4" */
export const primaryContactProgress = (v?: PrimaryContact) =>
  [v?.name, v?.position, v?.education, v?.startDate].filter((x) => x?.trim()).length;
