// app/profile/forms/company-form.tsx
"use client";

import { useState, type ReactNode, type ComponentType } from "react";
import {
  BuildingOffice2Icon,
  BanknotesIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  PhoneIcon,
  PlusIcon,
  XMarkIcon,
  TrashIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

/* ───────────── Types ───────────── */

export interface PastProject {
  name: string;
  client: string;
  valueBaht: number | null;
  year: number | null; // พ.ศ.
}

export interface CompanyFormData {
  displayName: string;
  companyName: string;
  registrationNumber: string;
  businessType: string;
  registeredDate: string; // YYYY-MM-DD
  registeredCapital: number | null;
  yearsExperience: number | null;
  teamSize: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  businessObjectives: string;
  certifications: string[];
  isEgpRegistered: boolean;
  pastProjects: PastProject[];
  contactEmail: string;
  phone: string;
  address: string;
  about: string;
}

interface Props {
  value: Partial<CompanyFormData>;
  onChange: (patch: Partial<CompanyFormData>) => void;
}

/* ───────────── Shared styles (same tokens as the profile page) ───────────── */

const inputCls =
  "w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]";
const labelCls = "block text-xs font-semibold text-[#5c5446] mb-1.5";
const hintCls = "mt-1.5 text-[11px] text-[#998f80]";
const errorCls = "mt-1.5 text-[11px] text-[#CC0000]";

const CERT_SUGGESTIONS = [
  "ISO 9001",
  "ISO 27001",
  "ISO 20000",
  "CMMI",
  "PMP (ทีมงาน)",
  "CISSP (ทีมงาน)",
];

/* ───────────── Small building blocks ───────────── */

type SectionKey = "entity" | "size" | "certs" | "projects" | "contact";

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
  value,
  onChange,
  placeholder,
  suffix,
  grouping = true,
}: {
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  placeholder?: string;
  suffix?: string;
  grouping?: boolean;
}) {
  return (
    <div className="relative">
      <input
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

export function CompanyForm({ value, onChange }: Props) {
  const [certInput, setCertInput] = useState("");

  const certifications = value.certifications ?? [];
  const projects = value.pastProjects ?? [];

  const regNo = value.registrationNumber ?? "";
  const regNoInvalid = regNo.length > 0 && !/^\d{13}$/.test(regNo);

  const budgetInvalid =
    value.budgetMin != null &&
    value.budgetMax != null &&
    value.budgetMin > value.budgetMax;

  const computedYears = yearsSince(value.registeredDate);

  // ── collapsible state ──
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    entity: true,
    size: false,
    certs: false,
    projects: false,
    contact: false,
  });
  const toggle = (k: SectionKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const setAll = (v: boolean) =>
    setOpen({ entity: v, size: v, certs: v, projects: v, contact: v });
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
          value.yearsExperience != null,
          value.teamSize != null,
          value.budgetMin != null || value.budgetMax != null,
        ].filter(Boolean).length,
        4,
      );

  const certsStatus = progress(
    [certifications.length > 0, !!value.isEgpRegistered].filter(Boolean).length,
    2,
  );

  const projectsStatus: { badge: string; tone: BadgeTone } =
    projects.length > 0
      ? { badge: `${projects.length} รายการ`, tone: "done" }
      : { badge: "ยังไม่มี", tone: "empty" };

  const contactStatus = progress(
    [
      has(value.contactEmail),
      has(value.phone),
      has(value.address),
      has(value.about),
    ].filter(Boolean).length,
    4,
  );

  const addCert = (raw: string) => {
    const name = raw.trim();
    if (!name || certifications.includes(name)) return;
    onChange({ certifications: [...certifications, name] });
    setCertInput("");
  };

  const updateProject = (index: number, patch: Partial<PastProject>) =>
    onChange({
      pastProjects: projects.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    });

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
            <label className={labelCls}>ชื่อที่แสดง</label>
            <input
              type="text"
              value={value.displayName ?? ""}
              onChange={(e) => onChange({ displayName: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>ชื่อบริษัท</label>
            <input
              type="text"
              value={value.companyName ?? ""}
              onChange={(e) => onChange({ companyName: e.target.value })}
              placeholder="เช่น บริษัท เทคโนโลยีไทย จำกัด"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>เลขทะเบียนนิติบุคคล (13 หลัก)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={13}
              value={regNo}
              onChange={(e) =>
                onChange({ registrationNumber: e.target.value.replace(/\D/g, "") })
              }
              placeholder="เช่น 0105567012345"
              className={inputCls}
              aria-invalid={regNoInvalid}
            />
            {regNoInvalid && <p className={errorCls}>ต้องเป็นตัวเลข 13 หลัก</p>}
          </div>
          <div>
            <label className={labelCls}>วันที่จดทะเบียนจัดตั้ง</label>
            <input
              type="date"
              value={value.registeredDate ?? ""}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                const years = yearsSince(e.target.value);
                onChange({
                  registeredDate: e.target.value,
                  ...(years != null ? { yearsExperience: years } : {}),
                });
              }}
              className={inputCls}
            />
            {computedYears != null && (
              <p className={hintCls}>ประกอบธุรกิจมาแล้วประมาณ {computedYears} ปี</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>ประเภทธุรกิจ</label>
            <input
              type="text"
              value={value.businessType ?? ""}
              onChange={(e) => onChange({ businessType: e.target.value })}
              placeholder="เช่น ผู้พัฒนาซอฟต์แวร์ / ตัวแทนจำหน่ายซอฟต์แวร์"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>วัตถุประสงค์ตามหนังสือรับรอง</label>
            <textarea
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
            <label className={labelCls}>ทุนจดทะเบียน</label>
            <NumberField
              value={value.registeredCapital}
              onChange={(n) => onChange({ registeredCapital: n })}
              suffix="บาท"
              placeholder="เช่น 10,000,000"
            />
          </div>
          <div>
            <label className={labelCls}>ประสบการณ์</label>
            <NumberField
              value={value.yearsExperience}
              onChange={(n) => onChange({ yearsExperience: n })}
              suffix="ปี"
            />
            {computedYears != null && (
              <p className={hintCls}>คำนวณจากวันที่จดทะเบียน</p>
            )}
          </div>
          <div>
            <label className={labelCls}>ขนาดทีม</label>
            <NumberField
              value={value.teamSize}
              onChange={(n) => onChange({ teamSize: n })}
              suffix="คน"
            />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>ช่วงงบประมาณโครงการที่รับได้</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <NumberField
                value={value.budgetMin}
                onChange={(n) => onChange({ budgetMin: n })}
                suffix="บาท"
                placeholder="ต่ำสุด"
              />
              <span className="hidden text-center text-xs text-[#998f80] sm:block">ถึง</span>
              <NumberField
                value={value.budgetMax}
                onChange={(n) => onChange({ budgetMax: n })}
                suffix="บาท"
                placeholder="สูงสุด (เว้นว่าง = ไม่จำกัด)"
              />
            </div>
            {budgetInvalid ? (
              <p className={errorCls}>งบประมาณต่ำสุดต้องไม่มากกว่างบประมาณสูงสุด</p>
            ) : (
              <p className={hintCls}>
                ใช้เป็นแนวทางคัดกรอง ไม่นับเป็นเงื่อนไขคุณสมบัติใน TOR
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* ── 3. ใบรับรองและมาตรฐาน ── */}
      <Section
        icon={ShieldCheckIcon}
        title="ใบรับรองและมาตรฐาน"
        subtitle="ใช้เทียบกับข้อกำหนดด้านมาตรฐานและบุคลากรใน TOR"
        open={open.certs}
        onToggle={() => toggle("certs")}
        badge={certsStatus.badge}
        tone={certsStatus.tone}
      >
        <div>
          <label className={labelCls}>ใบรับรอง / มาตรฐานที่บริษัทมี</label>

          {certifications.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {certifications.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full bg-[#e2ede4] py-1 pl-3 pr-1.5 text-xs font-medium text-[#2d5a37]"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ certifications: certifications.filter((x) => x !== c) })
                    }
                    className="grid size-5 place-items-center rounded-full hover:bg-[#c4e3cb]"
                    aria-label={`ลบ ${c}`}
                  >
                    <XMarkIcon className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={certInput}
              onChange={(e) => setCertInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCert(certInput);
                }
              }}
              placeholder="พิมพ์ชื่อแล้วกด Enter"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => addCert(certInput)}
              className="shrink-0 rounded-full border border-[#ddd5c8] bg-white px-5 text-xs font-medium text-[#5c5446] hover:bg-[#faf7f2]"
            >
              เพิ่ม
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {CERT_SUGGESTIONS.filter((s) => !certifications.includes(s)).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addCert(s)}
                className="rounded-full border border-dashed border-[#ddd5c8] px-3 py-1 text-[11px] text-[#7a8b6f] hover:border-[#4a7c59] hover:text-[#4a7c59]"
              >
                + {s}
              </button>
            ))}
          </div>
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

      {/* ── 4. ผลงานที่ผ่านมา ── */}
      <Section
        icon={BriefcaseIcon}
        title="ผลงานที่ผ่านมา"
        subtitle="TOR ส่วนใหญ่กำหนดมูลค่าผลงานขั้นต่ำ ยิ่งกรอกครบ ผลประเมินยิ่งแม่น"
        open={open.projects}
        onToggle={() => toggle("projects")}
        badge={projectsStatus.badge}
        tone={projectsStatus.tone}
      >
        {projects.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#ddd5c8] bg-[#faf7f2] p-6 text-center text-xs text-[#7a8b6f]">
            ยังไม่มีผลงาน กดปุ่มด้านล่างเพื่อเพิ่ม
          </p>
        )}

        <div className="space-y-3">
          {projects.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-[#e8e0d0] bg-white p-4 md:grid-cols-[2fr_1.5fr_1.2fr_90px_auto] md:items-end"
            >
              <div>
                <label className={labelCls}>ชื่อโครงการ</label>
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updateProject(i, { name: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>ผู้ว่าจ้าง</label>
                <input
                  type="text"
                  value={p.client}
                  onChange={(e) => updateProject(i, { client: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>มูลค่า</label>
                <NumberField
                  value={p.valueBaht}
                  onChange={(n) => updateProject(i, { valueBaht: n })}
                  suffix="บาท"
                />
              </div>
              <div>
                <label className={labelCls}>ปี พ.ศ.</label>
                <NumberField
                  value={p.year}
                  onChange={(n) => updateProject(i, { year: n })}
                  placeholder="2567"
                  grouping={false}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({ pastProjects: projects.filter((_, idx) => idx !== i) })
                }
                className="grid size-11 place-items-center rounded-full text-[#CC0000] hover:bg-red-50"
                aria-label="ลบผลงาน"
              >
                <TrashIcon className="size-5" />
              </button>
            </div>
          ))}
        </div>

        {projects.length < 20 && (
          <button
            type="button"
            onClick={() =>
              onChange({
                pastProjects: [
                  ...projects,
                  { name: "", client: "", valueBaht: null, year: null },
                ],
              })
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ddd5c8] bg-white px-5 py-2.5 text-xs font-medium text-[#5c5446] hover:bg-[#faf7f2]"
          >
            <PlusIcon className="size-4" />
            เพิ่มผลงาน
          </button>
        )}
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
            <label className={labelCls}>อีเมลติดต่อ</label>
            <input
              type="email"
              value={value.contactEmail ?? ""}
              onChange={(e) => onChange({ contactEmail: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>เบอร์โทรศัพท์</label>
            <input
              type="tel"
              value={value.phone ?? ""}
              onChange={(e) => onChange({ phone: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>ที่อยู่สำนักงาน</label>
            <textarea
              rows={2}
              value={value.address ?? ""}
              onChange={(e) => onChange({ address: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>เกี่ยวกับบริษัท</label>
            <textarea
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