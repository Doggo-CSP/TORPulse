"use client";

import { useState } from "react";
import { BellAlertIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { CompanyQualification, UserProfile } from "@/api/user.api";

// Keys must match CERTIFICATION_KEYS in the backend (modules/notification/qualification.ts)
const CERTIFICATIONS: { key: string; label: string }[] = [
  { key: "iso9001", label: "ISO 9001" },
  { key: "iso27001", label: "ISO/IEC 27001" },
  { key: "iso20000", label: "ISO/IEC 20000" },
  { key: "cmmi_level3", label: "CMMI Level 3" },
  { key: "cmmi_level5", label: "CMMI Level 5" },
  { key: "depa_ts", label: "depa Thailand Trust Mark" },
  { key: "sipa_registered", label: "ขึ้นทะเบียน SIPA" },
  { key: "egp_registered", label: "ลงทะเบียนผู้ค้าในระบบ e-GP" },
];

// Keys must match STAFF_ROLE_KEYS in the backend (modules/notification/qualification.ts)
const STAFF_ROLES: { key: string; label: string }[] = [
  { key: "project_manager", label: "Project Manager" },
  { key: "system_analyst", label: "System Analyst" },
  { key: "developer", label: "Developer / Programmer" },
  { key: "database_admin", label: "Database Administrator" },
  { key: "system_engineer", label: "System Engineer" },
  { key: "ux_ui_designer", label: "UX/UI Designer" },
  { key: "it_support", label: "IT Support" },
  { key: "coordinator", label: "Coordinator" },
  { key: "network_engineer", label: "Network Engineer" },
  { key: "security_specialist", label: "Security Specialist" },
];

const MISSING_FIELD_LABELS: Record<string, string> = {
  accountType: "ประเภทบัญชีเป็น \"บริษัท\"",
  companyName: "ชื่อบริษัท",
  registrationNumber: "เลขทะเบียนนิติบุคคล",
  interests: "หมวดหมู่ที่สนใจอย่างน้อย 1 หมวด (แท็บความสนใจ)",
  "qualification.registeredCapitalBaht": "ทุนจดทะเบียน",
  "qualification.yearsInBusiness": "จำนวนปีที่ดำเนินกิจการ",
  "qualification.maxPastContractValueBaht": "มูลค่าผลงานสูงสุดต่อสัญญา",
  "qualification.isThaiJuristicPerson": "สถานะนิติบุคคลไทย",
  "qualification.isSme": "สถานะ SME",
  "qualification.hasPositiveNetWorth": "มูลค่าสุทธิของกิจการเป็นบวกหรือไม่",
  "qualification.hasBangkokOffice": "มีสำนักงานในกรุงเทพฯ/ปริมณฑลหรือไม่",
};

const EMPTY_QUALIFICATION: CompanyQualification = {
  registeredCapitalBaht: null,
  yearsInBusiness: null,
  maxPastContractValueBaht: null,
  certifications: [],
  isThaiJuristicPerson: null,
  isSme: null,
  hasPositiveNetWorth: null,
  pastContractAgeYears: null,
  hasBangkokOffice: null,
  staffRoles: [],
};

const inputCls =
  "w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]";
const labelCls = "block text-xs font-semibold text-[#5c5446] mb-1.5";

function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function YesNo({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex gap-2">
      {[
        { v: true, label: "ใช่" },
        { v: false, label: "ไม่ใช่" },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onChange(option.v)}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
            value === option.v
              ? "border-[#4a7c59] bg-[#4a7c59] text-white"
              : "border-[#ddd5c8] bg-white text-[#5c5446] hover:bg-[#faf7f2]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// The parent remounts this with a key built from the saved values, so local state resets
// whenever the saved profile changes.
export function NotificationSettings({
  profile,
  saving,
  onSave,
}: {
  profile: UserProfile;
  saving: boolean;
  onSave: (changes: Partial<UserProfile>) => Promise<unknown>;
}) {
  const [emailEnabled, setEmailEnabled] = useState(profile.notificationPrefs?.emailEnabled ?? true);
  const [qualification, setQualification] = useState<CompanyQualification>({
    ...EMPTY_QUALIFICATION,
    ...profile.qualification,
  });

  const missing = profile.notificationMissingFields ?? [];

  const update = <K extends keyof CompanyQualification>(key: K, value: CompanyQualification[K]) =>
    setQualification((prev) => ({ ...prev, [key]: value }));

  const toggleIn = (field: "certifications" | "staffRoles", key: string) =>
    update(
      field,
      qualification[field].includes(key)
        ? qualification[field].filter((k) => k !== key)
        : [...qualification[field], key],
    );

  const toggleEmail = () => {
    const next = !emailEnabled;
    setEmailEnabled(next);
    void onSave({ notificationPrefs: { emailEnabled: next } });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSave({ qualification });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <BellAlertIcon className="mt-0.5 size-6 shrink-0 text-[#4a7c59]" />
            <div>
              <h2 className="text-lg font-bold text-[#2d2d2d]">แจ้งเตือนทางอีเมล</h2>
              <p className="mt-1 text-sm text-[#7a8b6f]">
                ส่งอีเมลเมื่อมี TOR ใหม่ที่บริษัทของคุณมีคุณสมบัติครบทุกข้อ ไปที่{" "}
                <span className="font-medium text-[#2d2d2d]">{profile.contactEmail || profile.email}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={emailEnabled}
            aria-label="เปิดการแจ้งเตือนทางอีเมล"
            disabled={saving}
            onClick={toggleEmail}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#4a7c59] focus:ring-offset-2 disabled:opacity-60 ${
              emailEnabled ? "bg-[#4a7c59]" : "bg-stone-300"
            }`}
          >
            <span
              className={`inline-block size-5 rounded-full bg-white shadow transition ${
                emailEnabled ? "translate-x-5.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {emailEnabled &&
          (missing.length === 0 ? (
            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-[#c4e3cb] bg-[#eaf4ed] p-4 text-sm text-[#2d5a37]">
              <CheckCircleIcon className="size-5 shrink-0" />
              โปรไฟล์ครบถ้วน ระบบจะแจ้งเตือนเมื่อพบ TOR ที่คุณมีคุณสมบัติครบ
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <ExclamationTriangleIcon className="size-5 shrink-0" />
                ยังไม่ได้รับแจ้งเตือน กรุณากรอกข้อมูลต่อไปนี้ให้ครบ
              </div>
              <ul className="ml-7 list-disc space-y-0.5">
                {missing.map((field) => (
                  <li key={field}>{MISSING_FIELD_LABELS[field] ?? field}</li>
                ))}
              </ul>
            </div>
          ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-sm md:p-8"
      >
        <div>
          <h2 className="text-lg font-bold text-[#2d2d2d]">คุณสมบัติของบริษัท</h2>
          <p className="mt-1 text-sm text-[#7a8b6f]">
            ใช้เทียบกับคุณสมบัติผู้ยื่นข้อเสนอใน TOR ระบบจะแจ้งเตือนเฉพาะ TOR ที่ผ่านทุกข้อเท่านั้น
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="registeredCapitalBaht">
              ทุนจดทะเบียน (บาท)
            </label>
            <input
              id="registeredCapitalBaht"
              type="number"
              min={0}
              inputMode="numeric"
              className={inputCls}
              value={qualification.registeredCapitalBaht ?? ""}
              onChange={(e) => update("registeredCapitalBaht", toNumber(e.target.value))}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="yearsInBusiness">
              ดำเนินกิจการมาแล้ว (ปี)
            </label>
            <input
              id="yearsInBusiness"
              type="number"
              min={0}
              inputMode="numeric"
              className={inputCls}
              value={qualification.yearsInBusiness ?? ""}
              onChange={(e) => update("yearsInBusiness", toNumber(e.target.value))}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="maxPastContractValueBaht">
              มูลค่าผลงานสูงสุดต่อสัญญา (บาท)
            </label>
            <input
              id="maxPastContractValueBaht"
              type="number"
              min={0}
              inputMode="numeric"
              className={inputCls}
              value={qualification.maxPastContractValueBaht ?? ""}
              onChange={(e) => update("maxPastContractValueBaht", toNumber(e.target.value))}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="pastContractAgeYears">
              ผลงานนั้นส่งมอบมาแล้ว (ปี)
            </label>
            <input
              id="pastContractAgeYears"
              type="number"
              min={0}
              inputMode="numeric"
              className={inputCls}
              value={qualification.pastContractAgeYears ?? ""}
              onChange={(e) => update("pastContractAgeYears", toNumber(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <span className={labelCls}>เป็นนิติบุคคลที่จดทะเบียนในประเทศไทย</span>
            <YesNo
              value={qualification.isThaiJuristicPerson}
              onChange={(v) => update("isThaiJuristicPerson", v)}
            />
          </div>
          <div>
            <span className={labelCls}>เป็นวิสาหกิจขนาดกลางและขนาดย่อม (SME)</span>
            <YesNo value={qualification.isSme} onChange={(v) => update("isSme", v)} />
          </div>
          <div>
            <span className={labelCls}>มูลค่าสุทธิของกิจการเป็นบวกในปีล่าสุด</span>
            <YesNo
              value={qualification.hasPositiveNetWorth}
              onChange={(v) => update("hasPositiveNetWorth", v)}
            />
          </div>
          <div>
            <span className={labelCls}>มีสำนักงาน สาขา หรือศูนย์บริการในกรุงเทพฯ/ปริมณฑล</span>
            <YesNo
              value={qualification.hasBangkokOffice}
              onChange={(v) => update("hasBangkokOffice", v)}
            />
          </div>
        </div>

        <div>
          <span className={labelCls}>ใบรับรอง / การขึ้นทะเบียน</span>
          <div className="flex flex-wrap gap-2">
            {CERTIFICATIONS.map((cert) => {
              const selected = qualification.certifications.includes(cert.key);
              return (
                <button
                  key={cert.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleIn("certifications", cert.key)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    selected
                      ? "border-[#4a7c59] bg-[#4a7c59] text-white"
                      : "border-[#ddd5c8] bg-white text-[#5c5446] hover:bg-[#faf7f2]"
                  }`}
                >
                  {cert.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className={labelCls}>บุคลากรประจำที่มี</span>
          <div className="flex flex-wrap gap-2">
            {STAFF_ROLES.map((role) => {
              const selected = qualification.staffRoles.includes(role.key);
              return (
                <button
                  key={role.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleIn("staffRoles", role.key)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    selected
                      ? "border-[#4a7c59] bg-[#4a7c59] text-white"
                      : "border-[#ddd5c8] bg-white text-[#5c5446] hover:bg-[#faf7f2]"
                  }`}
                >
                  {role.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#4a7c59] px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-[#3b6647] disabled:opacity-60"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกคุณสมบัติ"}
          </button>
        </div>
      </form>
    </div>
  );
}
