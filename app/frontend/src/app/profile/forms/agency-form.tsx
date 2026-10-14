// app/profile/forms/agency-form.tsx
"use client";

import { useState, type ReactNode, type ComponentType } from "react";
import {
  BuildingOffice2Icon,
  ShieldCheckIcon,
  BriefcaseIcon,
  PhoneIcon,
  PlusIcon,
  XMarkIcon,
  TrashIcon,
  ChevronDownIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

/* ───────────── Types ───────────── */

export interface AgencyPastProject {
  name: string;
  contractor: string; // ชื่อผู้รับจ้าง (ต่างจาก company ที่เป็น client)
  valueBaht: number | null;
  year: number | null; // พ.ศ.
}

export interface AgencyFormData {
  displayName: string;
  agencyName: string;
  agencyCode: string; // รหัสหน่วยงาน เช่น DBD / MOF
  agencyType: string; // ประเภท เช่น กรม / สำนักงาน / รัฐวิสาหกิจ
  ministry: string; // กระทรวงต้นสังกัด
  foundedYear: number | null; // ปี พ.ศ. ก่อตั้ง
  staffCount: number | null;
  annualBudget: number | null; // งบประมาณรายปี (บาท)
  website: string;
  isEgpRegistered: boolean;
  procurementMethods: string[];
  agencyProjects: AgencyPastProject[]; // renamed to avoid collision with CompanyFormData.pastProjects
  contactEmail: string;
  phone: string;
  fax: string;
  address: string;
  about: string;
}

interface Props {
  value: Partial<AgencyFormData>;
  onChange: (patch: Partial<AgencyFormData>) => void;
}

/* ───────────── Shared styles (same tokens as the profile page) ───────────── */

const inputCls =
  "w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]";
const labelCls = "block text-xs font-semibold text-[#5c5446] mb-1.5";
const hintCls = "mt-1.5 text-[11px] text-[#998f80]";

const PROCUREMENT_SUGGESTIONS = [
  "วิธีเฉพาะเจาะจง",
  "วิธีคัดเลือก",
  "วิธีประกวดราคา (e-bidding)",
  "วิธีสอบราคา",
  "ประกวดแบบ",
  "จ้างออกแบบและควบคุมงาน",
];

const AGENCY_TYPE_OPTIONS = [
  "กรม",
  "สำนักงาน",
  "สำนัก",
  "กอง",
  "รัฐวิสาหกิจ",
  "องค์การมหาชน",
  "หน่วยงานในกำกับ",
  "เขตพื้นที่การศึกษา",
  "มหาวิทยาลัย",
  "โรงพยาบาล",
  "อื่นๆ",
];

/* ───────────── Small building blocks ───────────── */

type SectionKey = "entity" | "budget" | "procurement" | "projects" | "contact";
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

/* ───────────── Main component ───────────── */

export function AgencyForm({ value, onChange }: Props) {
  const [procInput, setProcInput] = useState("");

  const procurementMethods = value.procurementMethods ?? [];
  const projects = value.agencyProjects ?? [];

  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    entity: true,
    budget: false,
    procurement: false,
    projects: false,
    contact: false,
  });
  const toggle = (k: SectionKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const setAll = (v: boolean) =>
    setOpen({ entity: v, budget: v, procurement: v, projects: v, contact: v });
  const allOpen = Object.values(open).every(Boolean);

  const has = (v?: string | null) => Boolean(v?.trim());
  const progress = (done: number, total: number): { badge: string; tone: BadgeTone } => ({
    badge: done === total ? "ครบแล้ว" : `${done}/${total}`,
    tone: done === total ? "done" : done === 0 ? "empty" : "partial",
  });

  const entityStatus = progress(
    [
      has(value.agencyName),
      has(value.agencyType),
      has(value.ministry),
      has(value.agencyCode),
    ].filter(Boolean).length,
    4,
  );

  const budgetStatus = progress(
    [
      value.annualBudget != null,
      value.staffCount != null,
      value.foundedYear != null,
    ].filter(Boolean).length,
    3,
  );

  const procurementStatus = progress(
    [procurementMethods.length > 0, !!value.isEgpRegistered].filter(Boolean).length,
    2,
  );

  const projectsStatus: { badge: string; tone: BadgeTone } =
    projects.length > 0
      ? { badge: `${projects.length} โครงการ`, tone: "done" }
      : { badge: "ยังไม่มี", tone: "empty" };

  const contactStatus = progress(
    [
      has(value.contactEmail),
      has(value.phone),
      has(value.address),
      has(value.website),
    ].filter(Boolean).length,
    4,
  );

  const addProcurement = (raw: string) => {
    const name = raw.trim();
    if (!name || procurementMethods.includes(name)) return;
    onChange({ procurementMethods: [...procurementMethods, name] });
    setProcInput("");
  };

  const updateProject = (index: number, patch: Partial<AgencyPastProject>) =>
    onChange({
      agencyProjects: projects.map((p, i) => (i === index ? { ...p, ...patch } : p)),
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

      {/* ── 1. ข้อมูลหน่วยงาน ── */}
      <Section
        icon={BuildingOffice2Icon}
        title="ข้อมูลหน่วยงาน"
        subtitle="ข้อมูลทั่วไปของหน่วยงานตามการจดทะเบียน"
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
              placeholder="เช่น กรมพัฒนาธุรกิจการค้า"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>ชื่อหน่วยงานเต็ม</label>
            <input
              type="text"
              value={value.agencyName ?? ""}
              onChange={(e) => onChange({ agencyName: e.target.value })}
              placeholder="เช่น กรมพัฒนาธุรกิจการค้า กระทรวงพาณิชย์"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>รหัสหน่วยงาน</label>
            <input
              type="text"
              value={value.agencyCode ?? ""}
              onChange={(e) => onChange({ agencyCode: e.target.value })}
              placeholder="เช่น 0401 / DBD"
              className={inputCls}
            />
            <p className={hintCls}>รหัสตามระบบ e-GP หรือ GFMIS</p>
          </div>
          <div>
            <label className={labelCls}>ประเภทหน่วยงาน</label>
            <select
              value={value.agencyType ?? ""}
              onChange={(e) => onChange({ agencyType: e.target.value })}
              className={inputCls}
            >
              <option value="">-- เลือกประเภท --</option>
              {AGENCY_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>กระทรวงต้นสังกัด</label>
            <input
              type="text"
              value={value.ministry ?? ""}
              onChange={(e) => onChange({ ministry: e.target.value })}
              placeholder="เช่น กระทรวงพาณิชย์ / กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม"
              className={inputCls}
            />
          </div>
        </div>
      </Section>

      {/* ── 2. งบประมาณและขนาดองค์กร ── */}
      <Section
        icon={DocumentTextIcon}
        title="งบประมาณและขนาดองค์กร"
        subtitle="ใช้ประเมินขนาดโครงการและการจัดซื้อจัดจ้าง"
        open={open.budget}
        onToggle={() => toggle("budget")}
        badge={budgetStatus.badge}
        tone={budgetStatus.tone}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div>
            <label className={labelCls}>งบประมาณประจำปี</label>
            <NumberField
              value={value.annualBudget}
              onChange={(n) => onChange({ annualBudget: n })}
              suffix="บาท"
              placeholder="เช่น 500,000,000"
            />
          </div>
          <div>
            <label className={labelCls}>จำนวนบุคลากร</label>
            <NumberField
              value={value.staffCount}
              onChange={(n) => onChange({ staffCount: n })}
              suffix="คน"
            />
          </div>
          <div>
            <label className={labelCls}>ปีที่ก่อตั้ง (พ.ศ.)</label>
            <NumberField
              value={value.foundedYear}
              onChange={(n) => onChange({ foundedYear: n })}
              placeholder="เช่น 2536"
              grouping={false}
            />
          </div>
        </div>
      </Section>

      {/* ── 3. วิธีการจัดซื้อจัดจ้าง ── */}
      <Section
        icon={ShieldCheckIcon}
        title="วิธีการจัดซื้อจัดจ้าง"
        subtitle="วิธีที่หน่วยงานใช้ในการจัดซื้อจัดจ้างและสถานะ e-GP"
        open={open.procurement}
        onToggle={() => toggle("procurement")}
        badge={procurementStatus.badge}
        tone={procurementStatus.tone}
      >
        <div>
          <label className={labelCls}>วิธีการจัดซื้อจัดจ้างที่ใช้</label>

          {procurementMethods.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {procurementMethods.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 rounded-full bg-[#e2ede4] py-1 pl-3 pr-1.5 text-xs font-medium text-[#2d5a37]"
                >
                  {m}
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ procurementMethods: procurementMethods.filter((x) => x !== m) })
                    }
                    className="grid size-5 place-items-center rounded-full hover:bg-[#c4e3cb]"
                    aria-label={`ลบ ${m}`}
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
              value={procInput}
              onChange={(e) => setProcInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addProcurement(procInput);
                }
              }}
              placeholder="พิมพ์วิธีจัดซื้อแล้วกด Enter"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => addProcurement(procInput)}
              className="shrink-0 rounded-full border border-[#ddd5c8] bg-white px-5 text-xs font-medium text-[#5c5446] hover:bg-[#faf7f2]"
            >
              เพิ่ม
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {PROCUREMENT_SUGGESTIONS.filter((s) => !procurementMethods.includes(s)).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addProcurement(s)}
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
              ระบบจัดซื้อจัดจ้างภาครัฐ กรมบัญชีกลาง (gprocurement.go.th)
            </span>
          </span>
        </label>
      </Section>

      {/* ── 4. โครงการจัดซื้อที่ผ่านมา ── */}
      <Section
        icon={BriefcaseIcon}
        title="โครงการจัดซื้อจัดจ้างที่ผ่านมา"
        subtitle="ประวัติโครงการที่หน่วยงานเคยจัดซื้อจัดจ้าง ช่วยให้ผู้เสนอราคาเข้าใจขอบเขตงาน"
        open={open.projects}
        onToggle={() => toggle("projects")}
        badge={projectsStatus.badge}
        tone={projectsStatus.tone}
      >
        {projects.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#ddd5c8] bg-[#faf7f2] p-6 text-center text-xs text-[#7a8b6f]">
            ยังไม่มีโครงการ กดปุ่มด้านล่างเพื่อเพิ่ม
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
                <label className={labelCls}>ผู้รับจ้าง / ผู้ขาย</label>
                <input
                  type="text"
                  value={p.contractor}
                  onChange={(e) => updateProject(i, { contractor: e.target.value })}
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
                  onChange({ agencyProjects: projects.filter((_, idx) => idx !== i) })
                }
                className="grid size-11 place-items-center rounded-full text-[#CC0000] hover:bg-red-50"
                aria-label="ลบโครงการ"
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
                agencyProjects: [
                  ...projects,
                  { name: "", contractor: "", valueBaht: null, year: null },
                ],
              })
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ddd5c8] bg-white px-5 py-2.5 text-xs font-medium text-[#5c5446] hover:bg-[#faf7f2]"
          >
            <PlusIcon className="size-4" />
            เพิ่มโครงการ
          </button>
        )}
      </Section>

      {/* ── 5. ข้อมูลติดต่อ ── */}
      <Section
        icon={PhoneIcon}
        title="ข้อมูลติดต่อ"
        subtitle="ช่องทางติดต่อและที่อยู่หน่วยงาน"
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
          <div>
            <label className={labelCls}>โทรสาร (Fax)</label>
            <input
              type="tel"
              value={value.fax ?? ""}
              onChange={(e) => onChange({ fax: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>เว็บไซต์</label>
            <input
              type="url"
              value={value.website ?? ""}
              onChange={(e) => onChange({ website: e.target.value })}
              placeholder="เช่น https://www.dbd.go.th"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>ที่อยู่หน่วยงาน</label>
            <textarea
              rows={2}
              value={value.address ?? ""}
              onChange={(e) => onChange({ address: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>เกี่ยวกับหน่วยงาน</label>
            <textarea
              rows={3}
              value={value.about ?? ""}
              onChange={(e) => onChange({ about: e.target.value })}
              placeholder="แนะนำหน่วยงานสั้น ๆ ภารกิจ หรือขอบเขตงานที่รับผิดชอบ"
              className={inputCls}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ───────────── Validation (used by page.tsx before saving) ───────────── */

export function getAgencyFormError(_v: Partial<AgencyFormData>): string | null {
  return null;
}
