// app/profile/forms/company-form.tsx
"use client";

import { useState, type ReactNode, type ComponentType } from "react";
import {
  BuildingOffice2Icon,
  BanknotesIcon,
  ShieldCheckIcon,
  PhoneIcon,
  ChevronDownIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";
import type { CertificationInput } from "@/api/bidder-profile.api";
import {
  PrimaryContactFields,
  primaryContactProgress,
  CertificateUploader,
  type PrimaryContact,
  type CertificateFile,
} from "./company-extras";

/* ───────────── Types ───────────── */

// Saved with PUT /user/profile (names, contact, business type), PUT /user/bidder-profile/
// organization (registration date, capital, certifications) and .../preferences (budget range,
// objectives). Past projects and team members are saved one by one in bidder-editors.tsx.
export interface CompanyFormData {
  displayName: string;
  companyName: string;
  registrationNumber: string;
  businessType: string;
  registeredDate: string; // YYYY-MM-DD
  registeredCapital: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  businessObjectives: string;
  isSme: boolean | null;
  hasPositiveNetWorth: boolean | null;
  hasBangkokOffice: boolean | null;
  certifications: CertificationInput[];
  certificateFiles: CertificateFile[]; // ไฟล์ใบรับรอง (PDF/รูป)
  primaryContact: PrimaryContact; // ผู้รับผิดชอบหลัก
  isEgpRegistered: boolean;
  contactEmail: string;
  phone: string;
  address: string;
  about: string;
}

/** The e-GP checkbox is stored as a certification with this name, so the AI matcher sees it. */
export const EGP_CERTIFICATION_NAME = "ลงทะเบียนผู้ค้าในระบบ e-GP";

interface Props {
  value: Partial<CompanyFormData>;
  onChange: (patch: Partial<CompanyFormData>) => void;
  /** จำนวนบุคลากรในทีมที่บันทึกแล้ว (จาก TeamEditor) ใช้แสดงเป็น "ขนาดทีม" */
  teamCount?: number;
  strict?: boolean;
  defaultOpen?: boolean;
}

/* ───────────── Shared styles (same tokens as the profile page) ───────────── */

const inputCls =
  "w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]";
const labelCls = "block text-xs font-semibold text-[#5c5446] mb-1.5";
const hintCls = "mt-1.5 text-[11px] text-[#998f80]";
const errorCls = "mt-1.5 text-[11px] text-[#CC0000]";

/** Red asterisk for required fields */
const star = (
  <span className="text-[#CC0000]" aria-hidden="true">
    {" "}
    *
  </span>
);

/* ───────────── Helpers ───────────── */

type SectionKey = "entity" | "contactPerson" | "size" | "certs" | "contact";

type BadgeTone = "done" | "partial" | "empty" | "error";

const BADGE_CLS: Record<BadgeTone, string> = {
  done: "bg-[#e2ede4] text-[#2d5a37]",
  partial: "bg-amber-50 text-amber-700",
  empty: "bg-[#f5f0e8] text-[#998f80]",
  error: "bg-red-50 text-red-700",
};

function Section({
  icon: Icon,
  title,
  subtitle,
  open,
  onToggle,
  badge,
  tone = "empty",
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  badge: string;
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[#f0e8dc] pt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-[#faf7f2]"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e2ede4] text-[#4a7c59]">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[#2d2d2d]">{title}</h3>
          <p className="truncate text-xs text-[#7a8b6f]">{subtitle}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${BADGE_CLS[tone]}`}
        >
          {badge}
        </span>
        <ChevronDownIcon
          className={`size-5 shrink-0 text-[#998f80] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && <div className="space-y-4 px-2 pb-2 pt-4">{children}</div>}
    </section>
  );
}

/** Text input that shows 10,000,000 but stores a number (no spinner arrows). */
function NumberField({
  id,
  value,
  onChange,
  placeholder,
  suffix,
  grouping = true,
}: {
  id?: string;
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  placeholder?: string;
  suffix?: string;
  grouping?: boolean;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value == null ? "" : grouping ? value.toLocaleString("en-US") : String(value)}
        placeholder={placeholder}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "");
          onChange(digits === "" ? null : Number(digits));
        }}
        className={`${inputCls} ${suffix ? "pr-14" : ""}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#998f80]">
          {suffix}
        </span>
      )}
    </div>
  );
}

function yearsSince(isoDate?: string): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  const years = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  return years < 0 ? null : Math.floor(years);
}

/* ───────────── Main component ───────────── */

export function CompanyForm({ value, onChange, teamCount = 0 }: Props) {
  const certificateFiles = value.certificateFiles ?? [];

  const regNo = value.registrationNumber ?? "";
  const regNoInvalid = regNo.length > 0 && !/^\d{13}$/.test(regNo);

  const budgetInvalid =
    value.budgetMin != null && value.budgetMax != null && value.budgetMin > value.budgetMax;

  const computedYears = yearsSince(value.registeredDate);

  // ── collapsible state ──
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    entity: true,
    contactPerson: false,
    size: false,
    certs: false,
    contact: false,
  });
  const toggle = (k: SectionKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const setAll = (v: boolean) =>
    setOpen({
      entity: v,
      contactPerson: v,
      size: v,
      certs: v,
      contact: v,
    });
  const allOpen = Object.values(open).every(Boolean);

  const has = (v?: string | null) => Boolean(v?.trim());
  const progress = (done: number, total: number): { badge: string; tone: BadgeTone } => ({
    badge: done === total ? "ครบแล้ว" : `${done}/${total}`,
    tone: done === total ? "done" : done === 0 ? "empty" : "partial",
  });

  const entityStatus = regNoInvalid
    ? { badge: "ต้องแก้ไข", tone: "error" as BadgeTone }
    : progress(
        [
          has(value.companyName),
          has(value.registrationNumber),
          has(value.registeredDate),
          has(value.businessType),
          has(value.businessObjectives),
        ].filter(Boolean).length,
        5,
      );

  const contactPersonStatus = progress(primaryContactProgress(value.primaryContact), 4);

  const sizeStatus = budgetInvalid
    ? { badge: "ต้องแก้ไข", tone: "error" as BadgeTone }
    : progress(
        [
          value.registeredCapital != null,
          value.budgetMin != null || value.budgetMax != null,
        ].filter(Boolean).length,
        2,
      );

  const certsStatus = progress(
    [certificateFiles.length > 0, !!value.isEgpRegistered].filter(Boolean).length,
    2,
  );

  const contactStatus = progress(
    [
      has(value.contactEmail),
      has(value.phone),
      has(value.address),
      has(value.about),
    ].filter(Boolean).length,
    4,
  );

  return (
    <div className="space-y-4 pt-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAll(!allOpen)}
          className="text-xs font-medium text-[#4a7c59] hover:underline"
        >
          {allOpen ? "ย่อทั้งหมด" : "ขยายทั้งหมด"}
        </button>
      </div>

      {/* ── 1. ข้อมูลนิติบุคคล ── */}
      <Section
        icon={BuildingOffice2Icon}
        title="ข้อมูลนิติบุคคล"
        subtitle="ตรงกับหนังสือรับรองบริษัท ใช้ตรวจคุณสมบัติผู้เสนอราคา"
        open={open.entity}
        onToggle={() => toggle("entity")}
        badge={entityStatus.badge}
        tone={entityStatus.tone}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="company-display-name" className={labelCls}>
              ชื่อที่แสดง
            </label>
            <input
              id="company-display-name"
              type="text"
              value={value.displayName ?? ""}
              onChange={(e) => onChange({ displayName: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="company-name" className={labelCls}>
              ชื่อบริษัท{star}
            </label>
            <input
              id="company-name"
              type="text"
              value={value.companyName ?? ""}
              onChange={(e) => onChange({ companyName: e.target.value })}
              placeholder="เช่น บริษัท เทคโนโลยีไทย จำกัด"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="company-reg-no" className={labelCls}>
              เลขทะเบียนนิติบุคคล (13 หลัก)
            </label>
            <input
              id="company-reg-no"
              type="text"
              inputMode="numeric"
              maxLength={13}
              value={regNo}
              onChange={(e) => onChange({ registrationNumber: e.target.value.replace(/\D/g, "") })}
              placeholder="เช่น 0105567012345"
              className={inputCls}
              aria-invalid={regNoInvalid}
            />
            {regNoInvalid && <p className={errorCls}>ต้องเป็นตัวเลข 13 หลัก</p>}
          </div>
          <div>
            <label htmlFor="company-registered-date" className={labelCls}>
              วันที่จดทะเบียนจัดตั้ง
            </label>
            <input
              id="company-registered-date"
              type="date"
              value={value.registeredDate ?? ""}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => onChange({ registeredDate: e.target.value })}
              className={inputCls}
            />
            {computedYears != null && (
              <p className={hintCls}>ประกอบธุรกิจมาแล้วประมาณ {computedYears} ปี</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="company-business-type" className={labelCls}>
              ประเภทธุรกิจ{star}
            </label>
            <input
              id="company-business-type"
              type="text"
              value={value.businessType ?? ""}
              onChange={(e) => onChange({ businessType: e.target.value })}
              placeholder="เช่น ผู้พัฒนาซอฟต์แวร์ / ตัวแทนจำหน่ายซอฟต์แวร์"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="company-objectives" className={labelCls}>
              วัตถุประสงค์ตามหนังสือรับรอง
            </label>
            <textarea
              id="company-objectives"
              rows={2}
              value={value.businessObjectives ?? ""}
              onChange={(e) => onChange({ businessObjectives: e.target.value })}
              placeholder="คัดลอกข้อความจากหนังสือรับรอง เช่น จำหน่ายและพัฒนาซอฟต์แวร์คอมพิวเตอร์"
              className={inputCls}
            />
            <p className={hintCls}>
              TOR หลายฉบับกำหนดให้วัตถุประสงค์ต้องตรงกับลักษณะงานที่เสนอราคา
            </p>
          </div>
        </div>
      </Section>

      {/* ── 2. ผู้รับผิดชอบหลัก ── */}
      <Section
        icon={AcademicCapIcon}
        title="ผู้รับผิดชอบหลัก"
        subtitle="ชื่อ ตำแหน่ง วุฒิการศึกษา และวันที่เข้าทำงานที่บริษัท"
        open={open.contactPerson}
        onToggle={() => toggle("contactPerson")}
        badge={contactPersonStatus.badge}
        tone={contactPersonStatus.tone}
      >
        <PrimaryContactFields
          value={value.primaryContact}
          onChange={(primaryContact) => onChange({ primaryContact })}
        />
      </Section>

      {/* ── 3. ขนาดธุรกิจและงบประมาณ ── */}
      <Section
        icon={BanknotesIcon}
        title="ขนาดธุรกิจและงบประมาณ"
        subtitle="ใช้จับคู่ TOR ที่ขนาดพอดีกับคุณ"
        open={open.size}
        onToggle={() => toggle("size")}
        badge={sizeStatus.badge}
        tone={sizeStatus.tone}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div>
            <label htmlFor="company-capital" className={labelCls}>
              ทุนจดทะเบียน{star}
            </label>
            <NumberField
              id="company-capital"
              value={value.registeredCapital}
              onChange={(n) => onChange({ registeredCapital: n })}
              suffix="บาท"
              placeholder="เช่น 10,000,000"
            />
          </div>
          <div>
            <p className={labelCls}>ประสบการณ์</p>
            <p className="rounded-2xl border border-[#e8e0d0] bg-[#f5f0e8] px-4 py-3 text-sm text-[#5c5446]">
              {computedYears != null ? `${computedYears} ปี` : "-"}
            </p>
            <p className={hintCls}>คำนวณจากวันที่จดทะเบียน</p>
          </div>
          <div>
            <p className={labelCls}>ขนาดทีม</p>
            <p className="rounded-2xl border border-[#e8e0d0] bg-[#f5f0e8] px-4 py-3 text-sm text-[#5c5446]">
              {teamCount} คน
            </p>
            <p className={hintCls}>นับจากบุคลากรในทีมด้านล่าง</p>
          </div>
          <div className="md:col-span-3">
            <p className={labelCls}>ช่วงงบประมาณโครงการที่รับได้</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <NumberField
                id="company-budget-min"
                value={value.budgetMin}
                onChange={(n) => onChange({ budgetMin: n })}
                suffix="บาท"
                placeholder="ต่ำสุด"
              />
              <span className="hidden text-center text-xs text-[#998f80] sm:block">ถึง</span>
              <NumberField
                id="company-budget-max"
                value={value.budgetMax}
                onChange={(n) => onChange({ budgetMax: n })}
                suffix="บาท"
                placeholder="สูงสุด (เว้นว่าง = ไม่จำกัด)"
              />
            </div>
            {budgetInvalid ? (
              <p className={errorCls}>งบประมาณต่ำสุดต้องไม่มากกว่างบประมาณสูงสุด</p>
            ) : (
              <p className={hintCls}>ใช้เป็นแนวทางคัดกรอง ไม่นับเป็นเงื่อนไขคุณสมบัติใน TOR</p>
            )}
          </div>
        </div>
      </Section>

      {/* ── 4. ใบรับรองและมาตรฐาน ── */}
      <Section
        icon={ShieldCheckIcon}
        title="ใบรับรองและมาตรฐาน"
        subtitle="อัปโหลดไฟล์ใบรับรอง (PDF หรือรูปภาพ) และสถานะ e-GP"
        open={open.certs}
        onToggle={() => toggle("certs")}
        badge={certsStatus.badge}
        tone={certsStatus.tone}
      >
        <div>
          <p className={labelCls}>ไฟล์ Certificate / ใบรับรอง</p>
          <CertificateUploader
            files={certificateFiles}
            onChange={(files) => onChange({ certificateFiles: files })}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] p-4">
          <input
            type="checkbox"
            checked={!!value.isEgpRegistered}
            onChange={(e) => onChange({ isEgpRegistered: e.target.checked })}
            className="mt-0.5 size-4 accent-[#4a7c59]"
          />
          <span className="text-sm text-[#2d2d2d]">
            ลงทะเบียนในระบบ e-GP แล้ว
            <span className="block text-xs text-[#7a8b6f]">
              จำเป็นสำหรับการยื่นข้อเสนอผ่านระบบจัดซื้อจัดจ้างภาครัฐ
            </span>
          </span>
        </label>
      </Section>

      {/* ── 5. ข้อมูลติดต่อ ── */}
      <Section
        icon={PhoneIcon}
        title="ข้อมูลติดต่อ"
        subtitle="ช่องทางติดต่อและรายละเอียดเพิ่มเติมของบริษัท"
        open={open.contact}
        onToggle={() => toggle("contact")}
        badge={contactStatus.badge}
        tone={contactStatus.tone}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="company-email" className={labelCls}>
              อีเมลติดต่อ
            </label>
            <input
              id="company-email"
              type="email"
              value={value.contactEmail ?? ""}
              onChange={(e) => onChange({ contactEmail: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="company-phone" className={labelCls}>
              เบอร์โทรศัพท์
            </label>
            <input
              id="company-phone"
              type="tel"
              value={value.phone ?? ""}
              onChange={(e) => onChange({ phone: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="company-address" className={labelCls}>
              ที่อยู่สำนักงาน
            </label>
            <textarea
              id="company-address"
              rows={2}
              value={value.address ?? ""}
              onChange={(e) => onChange({ address: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="company-about" className={labelCls}>
              เกี่ยวกับบริษัท
            </label>
            <textarea
              id="company-about"
              rows={3}
              value={value.about ?? ""}
              onChange={(e) => onChange({ about: e.target.value })}
              placeholder="แนะนำบริษัทสั้น ๆ ผลงาน หรือความเชี่ยวชาญ"
              className={inputCls}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ───────────── Validation (used by page.tsx before saving) ───────────── */

export function getCompanyFormError(v: Partial<CompanyFormData>): string | null {
  const regNo = v.registrationNumber ?? "";
  if (regNo.length > 0 && !/^\d{13}$/.test(regNo)) {
    return "เลขทะเบียนนิติบุคคลต้องเป็นตัวเลข 13 หลัก";
  }
  if (v.budgetMin != null && v.budgetMax != null && v.budgetMin > v.budgetMax) {
    return "งบประมาณต่ำสุดต้องไม่มากกว่างบประมาณสูงสุด";
  }
  return null;
}