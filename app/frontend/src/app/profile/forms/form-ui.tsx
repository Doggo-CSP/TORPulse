// app/profile/forms/form-ui.tsx
// Building blocks shared by the profile forms (same tokens as the profile page).
"use client";

import { useState, type ReactNode, type ComponentType } from "react";
import { ChevronDownIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { Certification, CertificationInput } from "@/api/bidder-profile.api";

export const inputCls =
  "w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]";
export const labelCls = "block text-xs font-semibold text-[#5c5446] mb-1.5";
export const hintCls = "mt-1.5 text-[11px] text-[#998f80]";
export const errorCls = "mt-1.5 text-[11px] text-[#CC0000]";
export const secondaryButtonCls =
  "inline-flex items-center gap-1.5 rounded-full border border-[#ddd5c8] bg-white px-5 py-2.5 text-xs font-medium text-[#5c5446] hover:bg-[#faf7f2] disabled:opacity-50";
export const primaryButtonCls =
  "inline-flex items-center gap-1.5 rounded-full bg-[#4a7c59] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#3b6647] disabled:opacity-50";

export type BadgeTone = "done" | "partial" | "empty" | "error";

const BADGE_CLS: Record<BadgeTone, string> = {
  done: "bg-[#e2ede4] text-[#2d5a37]",
  partial: "bg-amber-50 text-amber-700",
  empty: "bg-[#f5f0e8] text-[#998f80]",
  error: "bg-red-50 text-red-700",
};

export function Section({
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
export function NumberField({
  value,
  onChange,
  placeholder,
  suffix,
  grouping = true,
  id,
}: {
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  placeholder?: string;
  suffix?: string;
  grouping?: boolean;
  id?: string;
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

/** Yes/No answer that can also be left unanswered (null). */
export function YesNo({
  value,
  onChange,
  id,
}: {
  value: boolean | null | undefined;
  onChange: (value: boolean | null) => void;
  id?: string;
}) {
  return (
    <div className="flex gap-2" role="group" aria-labelledby={id}>
      {[
        { v: true, label: "ใช่" },
        { v: false, label: "ไม่ใช่" },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={value === option.v}
          // Clicking the chosen answer again clears it
          onClick={() => onChange(value === option.v ? null : option.v)}
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

export type OrganizationFlags = {
  isSme: boolean | null;
  hasPositiveNetWorth: boolean | null;
  hasBangkokOffice: boolean | null;
};

const ORGANIZATION_FLAG_QUESTIONS: { key: keyof OrganizationFlags; label: string }[] = [
  { key: "isSme", label: "เป็นวิสาหกิจขนาดกลางและขนาดย่อม (SME)" },
  { key: "hasPositiveNetWorth", label: "มูลค่าสุทธิของกิจการเป็นบวกในงบการเงินปีล่าสุด" },
  { key: "hasBangkokOffice", label: "มีสำนักงาน สาขา หรือศูนย์บริการในกรุงเทพฯ/ปริมณฑล" },
];

/** SME, positive net worth and Bangkok office: conditions TORs often set on the bidder. */
export function OrganizationFlagFields({
  value,
  onChange,
  idPrefix,
}: {
  value: Partial<OrganizationFlags>;
  onChange: (patch: Partial<OrganizationFlags>) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {ORGANIZATION_FLAG_QUESTIONS.map(({ key, label }) => (
        <div key={key}>
          <p id={`${idPrefix}-${key}`} className={labelCls}>
            {label}
          </p>
          <YesNo
            id={`${idPrefix}-${key}`}
            value={value[key]}
            onChange={(v) => onChange({ [key]: v } as Partial<OrganizationFlags>)}
          />
        </div>
      ))}
    </div>
  );
}

/** Certifications the API returns, as the editable input shape. */
export const toCertificationInputs = (certs: Certification[]): CertificationInput[] =>
  certs.map((c) => ({
    name: c.name,
    issuer: c.issuer,
    issuedAt: c.issuedAt,
    expiresAt: c.expiresAt,
  }));

const isExpired = (expiresAt: string | null | undefined) =>
  Boolean(expiresAt && expiresAt < new Date().toISOString().slice(0, 10));

/**
 * Certifications stored by name, with when they were obtained and when they expire. How long a
 * certificate has been held is counted from the issue date.
 */
export function CertificationList({
  value,
  onChange,
  suggestions = [],
  idPrefix,
}: {
  value: CertificationInput[];
  onChange: (next: CertificationInput[]) => void;
  suggestions?: string[];
  idPrefix: string;
}) {
  const [draft, setDraft] = useState("");
  const names = new Set(value.map((c) => c.name));

  const add = (raw: string) => {
    const name = raw.trim();
    if (!name || names.has(name)) return;
    onChange([...value, { name, issuer: "", issuedAt: null, expiresAt: null }]);
    setDraft("");
  };

  const update = (index: number, patch: Partial<CertificationInput>) =>
    onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-3">
      {value.map((cert, i) => (
        <div
          key={`${cert.name}-${i}`}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-[#e8e0d0] bg-white p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
        >
          <div>
            <label htmlFor={`${idPrefix}-name-${i}`} className={labelCls}>
              ชื่อใบรับรอง
            </label>
            <input
              id={`${idPrefix}-name-${i}`}
              type="text"
              value={cert.name}
              onChange={(e) => update(i, { name: e.target.value })}
              className={inputCls}
            />
            {isExpired(cert.expiresAt) && <p className={errorCls}>หมดอายุแล้ว ระบบจะไม่นับใบนี้</p>}
          </div>
          <div>
            <label htmlFor={`${idPrefix}-issued-${i}`} className={labelCls}>
              วันที่ได้รับ
            </label>
            <input
              id={`${idPrefix}-issued-${i}`}
              type="date"
              value={cert.issuedAt ?? ""}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => update(i, { issuedAt: e.target.value || null })}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-expires-${i}`} className={labelCls}>
              วันหมดอายุ
            </label>
            <input
              id={`${idPrefix}-expires-${i}`}
              type="date"
              value={cert.expiresAt ?? ""}
              onChange={(e) => update(i, { expiresAt: e.target.value || null })}
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            className="grid size-11 place-items-center rounded-full text-[#CC0000] hover:bg-red-50"
            aria-label={`ลบ ${cert.name}`}
          >
            <TrashIcon className="size-5" />
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          id={`${idPrefix}-new`}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder="พิมพ์ชื่อใบรับรองแล้วกด Enter เช่น ISO/IEC 27001:2022"
          aria-label="เพิ่มใบรับรอง"
          className={inputCls}
        />
        <button type="button" onClick={() => add(draft)} className={`${secondaryButtonCls} shrink-0`}>
          <PlusIcon className="size-4" />
          เพิ่ม
        </button>
      </div>

      {suggestions.some((s) => !names.has(s)) && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions
            .filter((s) => !names.has(s))
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="rounded-full border border-dashed border-[#ddd5c8] px-3 py-1 text-[11px] text-[#7a8b6f] hover:border-[#4a7c59] hover:text-[#4a7c59]"
              >
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
