// app/profile/forms/company-form.tsx
"use client";

import { useState } from "react";
import {
  BuildingOffice2Icon,
  BanknotesIcon,
  ShieldCheckIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import type { CertificationInput } from "@/api/bidder-profile.api";
import {
  CertificationList,
  NumberField,
  Section,
  errorCls,
  hintCls,
  inputCls,
  labelCls,
  type BadgeTone,
} from "./form-ui";

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
  certifications: CertificationInput[];
  isEgpRegistered: boolean; // saved as the certification EGP_CERTIFICATION_NAME
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
  teamCount: number;
}

const CERT_SUGGESTIONS = ["ISO 9001", "ISO/IEC 27001", "ISO/IEC 20000", "CMMI"];

/* ───────────── Helpers ───────────── */

type SectionKey = "entity" | "size" | "certs" | "contact";

function yearsSince(isoDate?: string): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  const years = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  return years < 0 ? null : Math.floor(years);
}

/* ───────────── Main component ───────────── */

export function CompanyForm({ value, onChange, teamCount }: Props) {
  const certifications = value.certifications ?? [];

  const regNo = value.registrationNumber ?? "";
  const regNoInvalid = regNo.length > 0 && !/^\d{13}$/.test(regNo);

  const budgetInvalid =
    value.budgetMin != null && value.budgetMax != null && value.budgetMin > value.budgetMax;

  const computedYears = yearsSince(value.registeredDate);

  // ── collapsible state ──
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    entity: true,
    size: false,
    certs: false,
    contact: false,
  });
  const toggle = (k: SectionKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const setAll = (v: boolean) => setOpen({ entity: v, size: v, certs: v, contact: v });
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
    [certifications.length > 0, !!value.isEgpRegistered].filter(Boolean).length,
    2,
  );

  const contactStatus = progress(
    [has(value.contactEmail), has(value.phone), has(value.address), has(value.about)].filter(
      Boolean,
    ).length,
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
              ชื่อบริษัท
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
              ประเภทธุรกิจ
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

      {/* ── 2. ขนาดธุรกิจและงบประมาณ ── */}
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
              ทุนจดทะเบียน
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

      {/* ── 3. ใบรับรองและมาตรฐาน ── */}
      <Section
        icon={ShieldCheckIcon}
        title="ใบรับรองและมาตรฐาน"
        subtitle="ใบรับรองของนิติบุคคล (ใบรับรองของบุคลากรกรอกที่ส่วนทีมงาน)"
        open={open.certs}
        onToggle={() => toggle("certs")}
        badge={certsStatus.badge}
        tone={certsStatus.tone}
      >
        <CertificationList
          idPrefix="company-cert"
          value={certifications}
          onChange={(next) => onChange({ certifications: next })}
          suggestions={CERT_SUGGESTIONS}
        />

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

      {/* ── 4. ข้อมูลติดต่อ ── */}
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
