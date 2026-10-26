// app/profile/forms/bidder-editors.tsx
// Team members, the individual bidder's own record and past projects. Each item is saved on
// its own through /user/bidder-profile/*, so editing one never overwrites another.
"use client";

import { useState } from "react";
import {
  BriefcaseIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
  IdentificationIcon,
} from "@heroicons/react/24/outline";
import {
  ApiError,
  type BidderProfile,
  type BidderProfileOptions,
  type PastProject,
  type PastProjectInput,
  type Person,
  type PersonInput,
} from "@/api/bidder-profile.api";
import { useBidderProfile, useBidderProfileOptions } from "@/hooks/use-bidder-profile";
import {
  EDUCATION_LEVEL_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  PROJECT_CLIENT_TYPE_LABELS,
  PROJECT_ROLE_LABELS,
  STAFF_ROLE_LABELS,
} from "@/lib/qualification-labels";
import {
  CertificationList,
  NumberField,
  Section,
  errorCls,
  hintCls,
  inputCls,
  labelCls,
  primaryButtonCls,
  secondaryButtonCls,
  toCertificationInputs,
} from "./form-ui";

const errorText = (error: unknown) =>
  error instanceof ApiError && error.status === 400
    ? "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบช่องที่กรอก"
    : "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

const splitTags = (text: string) =>
  text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const formatBaht = (n: number | null) => (n == null ? "-" : `${n.toLocaleString("th-TH")} บาท`);

/* ───────────── Person (team member or the individual bidder) ───────────── */

type PersonDraft = Required<
  Pick<PersonInput, "fullName" | "positionTitle" | "roles" | "employmentType" | "joinedAt">
> & {
  yearsExperience: number | null;
  education: { level: string; field: string }[];
  certifications: NonNullable<PersonInput["certifications"]>;
  skillsText: string;
};

const toPersonDraft = (person: Person | null): PersonDraft => ({
  fullName: person?.fullName ?? "",
  positionTitle: person?.positionTitle ?? "",
  roles: person?.roles ?? [],
  yearsExperience: person?.yearsExperience ?? null,
  employmentType: person?.employmentType ?? null,
  joinedAt: person?.joinedAt ?? null,
  education: (person?.education ?? []).map((e) => ({ level: e.level, field: e.field })),
  certifications: toCertificationInputs(person?.certifications ?? []),
  skillsText: (person?.skills ?? []).join(", "),
});

const toPersonInput = (draft: PersonDraft, isTeamMember: boolean): PersonInput => ({
  ...(isTeamMember && { fullName: draft.fullName, joinedAt: draft.joinedAt }),
  positionTitle: draft.positionTitle,
  roles: draft.roles,
  yearsExperience: draft.yearsExperience,
  employmentType: draft.employmentType,
  education: draft.education.filter((e) => e.level),
  certifications: draft.certifications.filter((c) => c.name.trim()),
  skills: splitTags(draft.skillsText),
});

function PersonFields({
  draft,
  onChange,
  options,
  isTeamMember,
  idPrefix,
}: {
  draft: PersonDraft;
  onChange: (patch: Partial<PersonDraft>) => void;
  options: BidderProfileOptions | undefined;
  isTeamMember: boolean;
  idPrefix: string;
}) {
  const toggleRole = (role: string) =>
    onChange({
      roles: draft.roles.includes(role)
        ? draft.roles.filter((r) => r !== role)
        : [...draft.roles, role],
    });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {isTeamMember && (
          <div>
            <label htmlFor={`${idPrefix}-name`} className={labelCls}>
              ชื่อ-นามสกุล (ไม่บังคับ)
            </label>
            <input
              id={`${idPrefix}-name`}
              type="text"
              value={draft.fullName}
              onChange={(e) => onChange({ fullName: e.target.value })}
              className={inputCls}
            />
            <p className={hintCls}>ไม่ส่งชื่อนี้ให้ AI ใช้แสดงในโปรไฟล์ของคุณเท่านั้น</p>
          </div>
        )}
        <div>
          <label htmlFor={`${idPrefix}-position`} className={labelCls}>
            ตำแหน่ง
          </label>
          <input
            id={`${idPrefix}-position`}
            type="text"
            value={draft.positionTitle}
            onChange={(e) => onChange({ positionTitle: e.target.value })}
            placeholder="เช่น Senior Backend Developer"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-years`} className={labelCls}>
            ประสบการณ์ทำงาน
          </label>
          <NumberField
            id={`${idPrefix}-years`}
            value={draft.yearsExperience}
            onChange={(n) => onChange({ yearsExperience: n })}
            suffix="ปี"
            grouping={false}
          />
        </div>
        {isTeamMember && (
          <>
            <div>
              <label htmlFor={`${idPrefix}-employment`} className={labelCls}>
                ประเภทการจ้าง
              </label>
              <select
                id={`${idPrefix}-employment`}
                value={draft.employmentType ?? ""}
                onChange={(e) => onChange({ employmentType: e.target.value || null })}
                className={inputCls}
              >
                <option value="">ไม่ระบุ</option>
                {(options?.employmentTypes ?? []).map((t) => (
                  <option key={t} value={t}>
                    {EMPLOYMENT_TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${idPrefix}-joined`} className={labelCls}>
                วันที่เข้าร่วมบริษัท
              </label>
              <input
                id={`${idPrefix}-joined`}
                type="date"
                value={draft.joinedAt ?? ""}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => onChange({ joinedAt: e.target.value || null })}
                className={inputCls}
              />
              <p className={hintCls}>TOR หลายฉบับกำหนดให้บุคลากรทำงานกับบริษัทมาแล้วไม่น้อยกว่า 1 ปี</p>
            </div>
          </>
        )}
      </div>

      <div>
        <p className={labelCls}>บทบาทในโครงการ</p>
        <div className="flex flex-wrap gap-2">
          {(options?.staffRoles ?? []).map((role) => {
            const selected = draft.roles.includes(role);
            return (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? "border-[#4a7c59] bg-[#4a7c59] text-white"
                    : "border-[#ddd5c8] bg-white text-[#5c5446] hover:bg-[#faf7f2]"
                }`}
              >
                {STAFF_ROLE_LABELS[role] ?? role}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className={labelCls}>วุฒิการศึกษา</p>
        <div className="space-y-2">
          {draft.education.map((edu, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <select
                aria-label="ระดับการศึกษา"
                value={edu.level}
                onChange={(e) =>
                  onChange({
                    education: draft.education.map((x, idx) =>
                      idx === i ? { ...x, level: e.target.value } : x,
                    ),
                  })
                }
                className={inputCls}
              >
                {(options?.educationLevels ?? []).map((level) => (
                  <option key={level} value={level}>
                    {EDUCATION_LEVEL_LABELS[level] ?? level}
                  </option>
                ))}
              </select>
              <input
                type="text"
                aria-label="สาขาวิชา"
                value={edu.field}
                onChange={(e) =>
                  onChange({
                    education: draft.education.map((x, idx) =>
                      idx === i ? { ...x, field: e.target.value } : x,
                    ),
                  })
                }
                placeholder="สาขา เช่น วิศวกรรมคอมพิวเตอร์"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => onChange({ education: draft.education.filter((_, idx) => idx !== i) })}
                className="grid size-11 place-items-center rounded-full text-[#CC0000] hover:bg-red-50"
                aria-label="ลบวุฒิการศึกษา"
              >
                <TrashIcon className="size-5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({ education: [...draft.education, { level: "bachelor", field: "" }] })
            }
            className={secondaryButtonCls}
          >
            <PlusIcon className="size-4" />
            เพิ่มวุฒิการศึกษา
          </button>
        </div>
      </div>

      <div>
        <p className={labelCls}>ใบรับรอง (Certificate)</p>
        <CertificationList
          idPrefix={`${idPrefix}-cert`}
          value={draft.certifications}
          onChange={(next) => onChange({ certifications: next })}
          suggestions={["PMP", "ITIL", "CISSP", "AWS Certified Solutions Architect"]}
        />
        <p className={hintCls}>ระบบนับจำนวนปีที่ถือใบรับรองจากวันที่ได้รับ</p>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-skills`} className={labelCls}>
          ทักษะ / เทคโนโลยี
        </label>
        <input
          id={`${idPrefix}-skills`}
          type="text"
          value={draft.skillsText}
          onChange={(e) => onChange({ skillsText: e.target.value })}
          placeholder="คั่นด้วยเครื่องหมายจุลภาค เช่น React, Node.js, PostgreSQL"
          className={inputCls}
        />
      </div>
    </div>
  );
}

const personSummary = (person: Person) =>
  [
    person.roles.map((r) => STAFF_ROLE_LABELS[r] ?? r).join(", "),
    person.yearsExperience != null && `ประสบการณ์ ${person.yearsExperience} ปี`,
    person.yearsAtCompany != null && `อยู่กับบริษัท ${Math.floor(person.yearsAtCompany)} ปี`,
    person.certifications.length > 0 &&
      `ใบรับรอง: ${person.certifications.map((c) => c.name).join(", ")}`,
  ]
    .filter(Boolean)
    .join(" · ");

/* ───────────── Team (company accounts) ───────────── */

export function TeamEditor({ profile }: { profile: BidderProfile }) {
  const bidder = useBidderProfile();
  const { data: options } = useBidderProfileOptions();
  const [open, setOpen] = useState(true);
  // null: no editor open; "new": adding; otherwise the id of the member being edited
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<PersonDraft>(toPersonDraft(null));
  const [error, setError] = useState<string | null>(null);

  const startEdit = (member: Person | null) => {
    setDraft(toPersonDraft(member));
    setEditing(member ? member.id : "new");
    setError(null);
  };

  const save = async () => {
    setError(null);
    try {
      const input = toPersonInput(draft, true);
      if (editing === "new") await bidder.addTeamMember(input);
      else if (editing) await bidder.updateTeamMember(editing, input);
      setEditing(null);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("ลบบุคลากรคนนี้ออกจากทีม?")) return;
    setError(null);
    try {
      await bidder.removeTeamMember(id);
      if (editing === id) setEditing(null);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const limit = options?.limits.teamMembers ?? 100;

  return (
    <Section
      icon={UserGroupIcon}
      title="บุคลากรในทีม (ไม่บังคับ)"
      subtitle="TOR ส่วนใหญ่กำหนดคุณสมบัติบุคลากร เช่น ตำแหน่ง วุฒิ และใบรับรอง"
      open={open}
      onToggle={() => setOpen(!open)}
      badge={profile.team.length > 0 ? `${profile.team.length} คน` : "ยังไม่มี"}
      tone={profile.team.length > 0 ? "done" : "empty"}
    >
      {profile.team.length === 0 && editing !== "new" && (
        <p className="rounded-2xl border border-dashed border-[#ddd5c8] bg-[#faf7f2] p-6 text-center text-xs text-[#7a8b6f]">
          ยังไม่มีบุคลากร กดปุ่มด้านล่างเพื่อเพิ่ม
        </p>
      )}

      <div className="space-y-3">
        {profile.team.map((member, index) =>
          editing === member.id ? (
            <div key={member.id} className="rounded-2xl border border-[#4a7c59]/40 bg-white p-4">
              <PersonFields
                draft={draft}
                onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
                options={options}
                isTeamMember
                idPrefix={`member-${member.id}`}
              />
              <EditorActions saving={bidder.saving} onSave={save} onCancel={() => setEditing(null)} />
            </div>
          ) : (
            <div
              key={member.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-[#e8e0d0] bg-white p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#2d2d2d]">
                  {member.fullName || `บุคลากรคนที่ ${index + 1}`}
                  {member.positionTitle && (
                    <span className="font-normal text-[#7a8b6f]"> · {member.positionTitle}</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-[#7a8b6f]">{personSummary(member) || "-"}</p>
              </div>
              <RowActions
                label={member.fullName || `บุคลากรคนที่ ${index + 1}`}
                disabled={bidder.saving}
                onEdit={() => startEdit(member)}
                onRemove={() => remove(member.id)}
              />
            </div>
          ),
        )}

        {editing === "new" && (
          <div className="rounded-2xl border border-[#4a7c59]/40 bg-white p-4">
            <PersonFields
              draft={draft}
              onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              options={options}
              isTeamMember
              idPrefix="member-new"
            />
            <EditorActions saving={bidder.saving} onSave={save} onCancel={() => setEditing(null)} />
          </div>
        )}
      </div>

      {error && <p className={errorCls}>{error}</p>}

      {editing === null && profile.team.length < limit && (
        <button type="button" onClick={() => startEdit(null)} className={secondaryButtonCls}>
          <PlusIcon className="size-4" />
          เพิ่มบุคลากร
        </button>
      )}
    </Section>
  );
}

/* ───────────── The individual bidder's own record (personal accounts) ───────────── */

export function SelfEditor({ profile }: { profile: BidderProfile }) {
  const bidder = useBidderProfile();
  const { data: options } = useBidderProfileOptions();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PersonDraft>(() => toPersonDraft(profile.self));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setStatus(null);
    try {
      await bidder.saveSelf(toPersonInput(draft, false));
      setStatus({ ok: true, text: "บันทึกแล้ว" });
    } catch (e) {
      setStatus({ ok: false, text: errorText(e) });
    }
  };

  return (
    <Section
      icon={IdentificationIcon}
      title="ความเชี่ยวชาญของคุณ (ไม่บังคับ)"
      subtitle="ตำแหน่ง วุฒิ และใบรับรอง ใช้เทียบกับคุณสมบัติบุคลากรใน TOR"
      open={open}
      onToggle={() => setOpen(!open)}
      badge={profile.self ? "มีข้อมูล" : "ยังไม่มี"}
      tone={profile.self ? "done" : "empty"}
    >
      <PersonFields
        draft={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        options={options}
        isTeamMember={false}
        idPrefix="self"
      />
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={bidder.saving} className={primaryButtonCls}>
          {bidder.saving ? "กำลังบันทึก..." : "บันทึกความเชี่ยวชาญ"}
        </button>
        {status && (
          <span className={`text-xs ${status.ok ? "text-[#2d5a37]" : "text-[#CC0000]"}`}>
            {status.text}
          </span>
        )}
      </div>
    </Section>
  );
}

/* ───────────── Past projects (both account types) ───────────── */

type ProjectDraft = {
  name: string;
  clientName: string;
  clientType: string | null;
  contractValueBaht: number | null;
  startDate: string | null;
  endDate: string | null;
  role: string | null;
  technologiesText: string;
  description: string;
  hasCompletionCertificate: boolean;
  memberIds: string[];
};

const toProjectDraft = (project: PastProject | null): ProjectDraft => ({
  name: project?.name ?? "",
  clientName: project?.clientName ?? "",
  clientType: project?.clientType ?? null,
  contractValueBaht: project?.contractValueBaht ?? null,
  startDate: project?.startDate ?? null,
  endDate: project?.endDate ?? null,
  role: project?.role ?? null,
  technologiesText: (project?.technologies ?? []).join(", "),
  description: project?.description ?? "",
  hasCompletionCertificate: project?.hasCompletionCertificate ?? false,
  memberIds: project?.memberIds ?? [],
});

const toProjectInput = (draft: ProjectDraft, withMembers: boolean): PastProjectInput => ({
  name: draft.name.trim(),
  clientName: draft.clientName,
  clientType: draft.clientType,
  contractValueBaht: draft.contractValueBaht,
  startDate: draft.startDate,
  endDate: draft.endDate,
  role: draft.role,
  technologies: splitTags(draft.technologiesText),
  description: draft.description,
  hasCompletionCertificate: draft.hasCompletionCertificate,
  ...(withMembers && { memberIds: draft.memberIds }),
});

function ProjectFields({
  draft,
  onChange,
  options,
  team,
  idPrefix,
}: {
  draft: ProjectDraft;
  onChange: (patch: Partial<ProjectDraft>) => void;
  options: BidderProfileOptions | undefined;
  team: Person[] | null; // null for personal accounts
  idPrefix: string;
}) {
  const datesInvalid = Boolean(draft.startDate && draft.endDate && draft.startDate > draft.endDate);

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-name`} className={labelCls}>
          ชื่อโครงการ *
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-client`} className={labelCls}>
          ผู้ว่าจ้าง
        </label>
        <input
          id={`${idPrefix}-client`}
          type="text"
          value={draft.clientName}
          onChange={(e) => onChange({ clientName: e.target.value })}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-client-type`} className={labelCls}>
          ประเภทผู้ว่าจ้าง
        </label>
        <select
          id={`${idPrefix}-client-type`}
          value={draft.clientType ?? ""}
          onChange={(e) => onChange({ clientType: e.target.value || null })}
          className={inputCls}
        >
          <option value="">ไม่ระบุ</option>
          {(options?.projectClientTypes ?? []).map((t) => (
            <option key={t} value={t}>
              {PROJECT_CLIENT_TYPE_LABELS[t] ?? t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-value`} className={labelCls}>
          งบ/มูลค่าโครงการ
        </label>
        <NumberField
          id={`${idPrefix}-value`}
          value={draft.contractValueBaht}
          onChange={(n) => onChange({ contractValueBaht: n })}
          suffix="บาท"
        />
        <p className={hintCls}>ต้องมีผลงานที่ระบุมูลค่าอย่างน้อย 1 โครงการ เพื่อประเมินคุณสมบัติ</p>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-role`} className={labelCls}>
          บทบาทในสัญญา
        </label>
        <select
          id={`${idPrefix}-role`}
          value={draft.role ?? ""}
          onChange={(e) => onChange({ role: e.target.value || null })}
          className={inputCls}
        >
          <option value="">ไม่ระบุ</option>
          {(options?.projectRoles ?? []).map((r) => (
            <option key={r} value={r}>
              {PROJECT_ROLE_LABELS[r] ?? r}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-start`} className={labelCls}>
          วันที่เริ่มสัญญา
        </label>
        <input
          id={`${idPrefix}-start`}
          type="date"
          value={draft.startDate ?? ""}
          onChange={(e) => onChange({ startDate: e.target.value || null })}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-end`} className={labelCls}>
          วันที่ส่งมอบงาน
        </label>
        <input
          id={`${idPrefix}-end`}
          type="date"
          value={draft.endDate ?? ""}
          onChange={(e) => onChange({ endDate: e.target.value || null })}
          className={inputCls}
        />
        {datesInvalid ? (
          <p className={errorCls}>วันที่ส่งมอบต้องไม่ก่อนวันที่เริ่มสัญญา</p>
        ) : (
          <p className={hintCls}>เว้นว่างถ้ายังดำเนินการอยู่</p>
        )}
      </div>
      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-tech`} className={labelCls}>
          เทคโนโลยีที่ใช้
        </label>
        <input
          id={`${idPrefix}-tech`}
          type="text"
          value={draft.technologiesText}
          onChange={(e) => onChange({ technologiesText: e.target.value })}
          placeholder="คั่นด้วยเครื่องหมายจุลภาค เช่น React, Java, Oracle"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-desc`} className={labelCls}>
          รายละเอียดงาน
        </label>
        <textarea
          id={`${idPrefix}-desc`}
          rows={2}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="ลักษณะงานโดยย่อ ช่วยให้ AI เทียบกับ TOR ที่เป็นงานประเภทเดียวกันได้แม่นขึ้น"
          className={inputCls}
        />
      </div>
      <label className="flex cursor-pointer items-center gap-3 md:col-span-2">
        <input
          type="checkbox"
          checked={draft.hasCompletionCertificate}
          onChange={(e) => onChange({ hasCompletionCertificate: e.target.checked })}
          className="size-4 accent-[#4a7c59]"
        />
        <span className="text-sm text-[#2d2d2d]">มีหนังสือรับรองผลงาน</span>
      </label>
      {team && team.length > 0 && (
        <div className="md:col-span-2">
          <p className={labelCls}>บุคลากรที่ร่วมโครงการ</p>
          <div className="flex flex-wrap gap-2">
            {team.map((member, i) => {
              const selected = draft.memberIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    onChange({
                      memberIds: selected
                        ? draft.memberIds.filter((id) => id !== member.id)
                        : [...draft.memberIds, member.id],
                    })
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? "border-[#4a7c59] bg-[#4a7c59] text-white"
                      : "border-[#ddd5c8] bg-white text-[#5c5446] hover:bg-[#faf7f2]"
                  }`}
                >
                  {member.fullName || member.positionTitle || `บุคลากรคนที่ ${i + 1}`}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectsEditor({ profile }: { profile: BidderProfile }) {
  const bidder = useBidderProfile();
  const { data: options } = useBidderProfileOptions();
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProjectDraft>(toProjectDraft(null));
  const [error, setError] = useState<string | null>(null);

  const isCompany = profile.accountType === "company";
  const team = isCompany ? profile.team : null;
  const limit = options?.limits.projects ?? 100;

  const startEdit = (project: PastProject | null) => {
    setDraft(toProjectDraft(project));
    setEditing(project ? project.id : "new");
    setError(null);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setError("กรุณากรอกชื่อโครงการ");
      return;
    }
    if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) {
      setError("วันที่ส่งมอบต้องไม่ก่อนวันที่เริ่มสัญญา");
      return;
    }
    setError(null);
    try {
      const input = toProjectInput(draft, isCompany);
      if (editing === "new") await bidder.addProject(input);
      else if (editing) await bidder.updateProject(editing, input);
      setEditing(null);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("ลบผลงานนี้?")) return;
    setError(null);
    try {
      await bidder.removeProject(id);
      if (editing === id) setEditing(null);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const editor = (key: string) => (
    <div key={key} className="rounded-2xl border border-[#4a7c59]/40 bg-white p-4">
      <ProjectFields
        draft={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        options={options}
        team={team}
        idPrefix={`project-${key}`}
      />
      <EditorActions saving={bidder.saving} onSave={save} onCancel={() => setEditing(null)} />
    </div>
  );

  return (
    <Section
      icon={BriefcaseIcon}
      title="ผลงานที่ผ่านมา"
      subtitle="TOR ส่วนใหญ่กำหนดมูลค่าผลงานขั้นต่ำ ยิ่งกรอกครบ ผลประเมินยิ่งแม่น"
      open={open}
      onToggle={() => setOpen(!open)}
      badge={profile.projects.length > 0 ? `${profile.projects.length} รายการ` : "ยังไม่มี"}
      tone={profile.projects.length > 0 ? "done" : "empty"}
    >
      {profile.projects.length === 0 && editing !== "new" && (
        <p className="rounded-2xl border border-dashed border-[#ddd5c8] bg-[#faf7f2] p-6 text-center text-xs text-[#7a8b6f]">
          ยังไม่มีผลงาน กดปุ่มด้านล่างเพื่อเพิ่ม
        </p>
      )}

      <div className="space-y-3">
        {profile.projects.map((project) =>
          editing === project.id ? (
            editor(project.id)
          ) : (
            <div
              key={project.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-[#e8e0d0] bg-white p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#2d2d2d]">{project.name}</p>
                <p className="mt-1 text-xs text-[#7a8b6f]">
                  {[
                    project.clientName,
                    formatBaht(project.contractValueBaht),
                    project.endDate ? `ส่งมอบ ${project.endDate}` : "ยังดำเนินการอยู่",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <RowActions
                label={project.name}
                disabled={bidder.saving}
                onEdit={() => startEdit(project)}
                onRemove={() => remove(project.id)}
              />
            </div>
          ),
        )}
        {editing === "new" && editor("new")}
      </div>

      {error && <p className={errorCls}>{error}</p>}

      {editing === null && profile.projects.length < limit && (
        <button type="button" onClick={() => startEdit(null)} className={secondaryButtonCls}>
          <PlusIcon className="size-4" />
          เพิ่มผลงาน
        </button>
      )}
    </Section>
  );
}

/* ───────────── Shared row controls ───────────── */

function EditorActions({
  saving,
  onSave,
  onCancel,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <button type="button" onClick={onSave} disabled={saving} className={primaryButtonCls}>
        {saving ? "กำลังบันทึก..." : "บันทึก"}
      </button>
      <button type="button" onClick={onCancel} disabled={saving} className={secondaryButtonCls}>
        ยกเลิก
      </button>
    </div>
  );
}

function RowActions({
  label,
  disabled,
  onEdit,
  onRemove,
}: {
  label: string;
  disabled: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        className="grid size-9 place-items-center rounded-full text-[#4a7c59] hover:bg-[#e2ede4]"
        aria-label={`แก้ไข ${label}`}
      >
        <PencilSquareIcon className="size-5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="grid size-9 place-items-center rounded-full text-[#CC0000] hover:bg-red-50"
        aria-label={`ลบ ${label}`}
      >
        <TrashIcon className="size-5" />
      </button>
    </div>
  );
}
