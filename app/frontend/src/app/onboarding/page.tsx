"use client";

// Step-by-step profile setup offered after the first login (UC-07). It asks for exactly what the
// profile page asks for, using the same forms and saving through the same API. Required fields
// must be filled before "บันทึกและถัดไป"; every step can be skipped, and anything typed but not
// saved is kept in this browser until the user comes back.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, UserIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { updateOnboardingStatus, type UserProfile } from "@/api/user.api";
import type { BidderProfile } from "@/api/bidder-profile.api";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useBidderProfile } from "@/hooks/use-bidder-profile";
import { useCategories } from "@/hooks/use-categories";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { missingFieldLabel } from "@/lib/qualification-labels";
import { ProjectsEditor, SelfEditor, TeamEditor } from "../profile/forms/bidder-editors";
import { CompanyForm } from "../profile/forms/company-form";
import { PersonalForm } from "../profile/forms/personal-form";
import {
  mainFormError,
  missingMainFields,
  toMainProfileForm,
  useSaveMainProfile,
  type MainProfileForm,
} from "../profile/forms/main-profile";
import { errorCls, primaryButtonCls, secondaryButtonCls } from "../profile/forms/form-ui";

type AccountType = "personal" | "company";
type StepKey = "type" | "basics" | "projects" | "team" | "self" | "interests";

const STEP_LABELS: Record<StepKey, string> = {
  type: "ประเภทผู้ยื่น",
  basics: "ข้อมูลพื้นฐาน",
  projects: "ผลงานที่ผ่านมา",
  team: "บุคลากรในทีม",
  self: "ความเชี่ยวชาญของคุณ",
  interests: "หมวดที่สนใจ",
};
const OPTIONAL_STEPS = new Set<StepKey>(["team", "self", "interests"]);

const stepsFor = (accountType: AccountType): StepKey[] =>
  accountType === "company"
    ? ["type", "basics", "projects", "team", "interests"]
    : ["type", "basics", "projects", "self", "interests"];

/** A past project counts for the score with a value, and for a company also a delivery date. */
const hasQualifyingProject = (bidder: BidderProfile, accountType: AccountType) =>
  bidder.projects.some(
    (p) => p.contractValueBaht != null && (accountType === "personal" || p.endDate !== null),
  );

/* ───────────── Shared step frame ───────────── */

function StepFooter({
  onBack,
  onSkip,
  onNext,
  nextLabel = "ถัดไป →",
  busy = false,
  blockedReason,
}: {
  onBack?: () => void;
  onSkip?: () => void;
  onNext: () => void;
  nextLabel?: string;
  busy?: boolean;
  /** When set, the next button is disabled and this says what is still missing. */
  blockedReason?: string | null;
}) {
  return (
    <div className="mt-6">
      {blockedReason && (
        <p className="mb-3 rounded-2xl border border-[#e8e0d0] bg-white px-4 py-2.5 text-right text-xs text-[#7a8b6f]">
          {blockedReason}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} disabled={busy} className={secondaryButtonCls}>
            ← ย้อนกลับ
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {onSkip && (
            <button type="button" onClick={onSkip} disabled={busy} className={secondaryButtonCls}>
              ข้ามขั้นนี้
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={busy || Boolean(blockedReason)}
            className={`${primaryButtonCls} disabled:cursor-not-allowed`}
          >
            {busy ? "กำลังบันทึก..." : nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1 className="text-2xl font-bold text-[#2d2d2d] md:text-[28px]">{title}</h1>
      <p className="mt-1.5 text-sm text-[#7a8b6f]">{subtitle}</p>
    </>
  );
}

const box = "mt-6 rounded-3xl border border-[#e8e0d0] bg-white p-6 md:p-7";

/* ───────────── Step 1: account type ───────────── */

function TypeStep({
  draftKey,
  initial,
  onNext,
  onSkip,
}: {
  draftKey: string;
  initial: AccountType;
  onNext: (type: AccountType) => Promise<void>;
  onSkip: () => void;
}) {
  const [type, setType, resetType] = useLocalDraft<AccountType>(`${draftKey}:type`, () => initial);
  const [busy, setBusy] = useState(false);
  const options: { id: AccountType; title: string; text: string; Icon: typeof UserIcon }[] = [
    { id: "personal", title: "บุคคลธรรมดา", text: "ฟรีแลนซ์หรือยื่นในนามตัวเอง", Icon: UserIcon },
    { id: "company", title: "นิติบุคคล", text: "บริษัท/หจก. เพิ่มทีมงานได้", Icon: BuildingOffice2Icon },
  ];

  return (
    <>
      <StepHeading title="คุณยื่นประมูลงานในนามใคร?" subtitle="เลือกให้ตรงกับเอกสารที่ใช้ยื่นจริง" />
      <div className={`${box} grid grid-cols-1 gap-4 sm:grid-cols-2`}>
        {options.map(({ id, title, text, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setType(id)}
            aria-pressed={type === id}
            className={`rounded-[20px] p-5 text-left transition-colors ${
              type === id
                ? "border-2 border-[#4a7c59] bg-[#eef5f0]"
                : "border border-[#ddd5c8] bg-[#faf7f2] hover:bg-white"
            }`}
          >
            <Icon className="mb-3 size-7 text-[#4a7c59]" />
            <span className="block text-base font-bold text-[#2d2d2d]">{title}</span>
            <span className="text-sm text-[#7a8b6f]">{text}</span>
          </button>
        ))}
      </div>
      <StepFooter
        busy={busy}
        onSkip={onSkip}
        nextLabel="บันทึกและถัดไป →"
        onNext={async () => {
          setBusy(true);
          try {
            await onNext(type);
            resetType(type);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

/* ───────────── Step 2: basic information (the profile page's main form) ───────────── */

function BasicsStep({
  draftKey,
  accountType,
  profile,
  bidderProfile,
  onBack,
  onNext,
}: {
  draftKey: string;
  accountType: AccountType;
  profile: UserProfile;
  bidderProfile: BidderProfile;
  onBack: () => void;
  onNext: () => void;
}) {
  const saveMainProfile = useSaveMainProfile();
  const [stored, setForm, resetForm] = useLocalDraft<MainProfileForm>(
    `${draftKey}:basics:${accountType}`,
    () => toMainProfileForm(profile, bidderProfile),
  );
  // The account type is chosen in step 1, whatever an older draft says
  const form: MainProfileForm = { ...stored, accountType };
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isCompany = accountType === "company";

  const missing = missingMainFields(form);
  const formatError = mainFormError(form);
  const blockedReason =
    missing.length > 0
      ? `กรอกให้ครบก่อนบันทึก: ${missing.join(", ")}`
      : formatError;

  const update = (patch: Partial<MainProfileForm>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      await saveMainProfile(form);
      resetForm(form);
      onNext();
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <StepHeading
        title={isCompany ? "ข้อมูลนิติบุคคล" : "ข้อมูลของคุณ"}
        subtitle="ข้อมูลเดียวกับหน้าโปรไฟล์ · ช่องที่มี * จำเป็นสำหรับการคำนวณคะแนน"
      />
      <div className={box}>
        {isCompany ? (
          <CompanyForm
            value={form}
            onChange={update}
            teamCount={bidderProfile.team.length}
            strict
            defaultOpen
          />
        ) : (
          <PersonalForm value={form} onChange={update} strict />
        )}
      </div>
      {error && <p className={errorCls}>{error}</p>}
      <StepFooter
        busy={busy}
        onBack={onBack}
        onSkip={onNext}
        onNext={save}
        nextLabel="บันทึกและถัดไป →"
        blockedReason={blockedReason}
      />
    </>
  );
}

/* ───────────── Step: interest categories ───────────── */

function InterestsStep({
  draftKey,
  initial,
  onBack,
  onNext,
}: {
  draftKey: string;
  initial: string[];
  onBack: () => void;
  onNext: () => void;
}) {
  const { data: categories = [] } = useCategories();
  const { updateInterests } = useUserProfile(false);
  const [selected, setSelected, resetSelected] = useLocalDraft<string[]>(
    `${draftKey}:interests`,
    () => initial,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: string) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  return (
    <>
      <StepHeading
        title="สนใจงานหมวดไหนบ้าง?"
        subtitle="ใช้แนะนำ TOR และแจ้งเตือนเมื่อมีประกาศใหม่ · เลือกได้หลายหมวด"
      />
      <div className={`${box} flex flex-wrap gap-2.5`}>
        {categories.map((c) => {
          const on = selected.includes(c.key);
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c.key)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                on
                  ? "border-[#4a7c59] bg-[#4a7c59] text-white"
                  : "border-[#ddd5c8] bg-white text-[#5c5446] hover:bg-[#faf7f2]"
              }`}
            >
              {on && <CheckIcon className="-ml-1 mr-1 inline size-4" />}
              {c.name}
            </button>
          );
        })}
      </div>
      {error && <p className={errorCls}>{error}</p>}
      <StepFooter
        busy={busy}
        onBack={onBack}
        onSkip={onNext}
        nextLabel="บันทึกและเสร็จสิ้น →"
        onNext={async () => {
          setBusy(true);
          setError(null);
          try {
            await updateInterests(selected);
            resetSelected(selected);
            onNext();
          } catch {
            setError("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

/* ───────────── Page ───────────── */

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: authUser, loading: authLoading } = useAuth();
  const { profile, loading, updateProfile } = useUserProfile(!!authUser);
  const bidder = useBidderProfile(!!authUser);
  const bidderProfile = bidder.profile;
  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const leave = async (status: "completed" | "dismissed", to: string) => {
    setLeaving(true);
    try {
      await updateOnboardingStatus(status);
      queryClient.setQueryData(["userProfile"], (old: UserProfile | undefined) =>
        old ? { ...old, onboardingStatus: status } : old,
      );
    } finally {
      router.push(to);
    }
  };

  if (authLoading || loading || (authUser && !bidderProfile)) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f0e8]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#4a7c59] border-t-transparent" />
      </div>
    );
  }

  if (!authUser || !profile || !bidderProfile) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f0e8] px-4">
        <div className="rounded-3xl border border-[#e8e0d0] bg-white p-8 text-center shadow-sm">
          <p className="mb-4 text-sm text-[#7a8b6f]">กรุณาเข้าสู่ระบบก่อนตั้งค่าโปรไฟล์</p>
          <Link href="/auth" className={primaryButtonCls}>
            เข้าสู่ระบบด้วย Google
          </Link>
        </div>
      </div>
    );
  }

  // Drafts are kept per user, so two people sharing a browser do not see each other's typing
  const draftKey = `onboarding:${profile.id}`;
  const accountType: AccountType = profile.accountType === "company" ? "company" : "personal";
  const steps = stepsFor(accountType);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const { completeness } = bidderProfile;
  const projectsReady = hasQualifyingProject(bidderProfile, accountType);

  // Ticks in the sidebar follow what is saved, not what was visited
  const isStepDone = (key: StepKey, index: number): boolean => {
    if (key === "type") return index < stepIndex || finished;
    if (key === "basics")
      return missingMainFields(toMainProfileForm(profile, bidderProfile)).length === 0;
    if (key === "projects") return projectsReady;
    if (key === "team") return bidderProfile.team.length > 0;
    if (key === "self") return bidderProfile.self !== null;
    return profile.interests.length > 0;
  };

  const next = () => (stepIndex + 1 < steps.length ? setStepIndex(stepIndex + 1) : setFinished(true));
  const back = () => setStepIndex(Math.max(0, stepIndex - 1));

  return (
    <div className="grid min-h-screen bg-[#f5f0e8] md:grid-cols-[300px_1fr]">
      {/* ── Steps and progress ── */}
      <aside className="border-b border-[#e8e0d0] bg-white px-7 py-8 md:border-b-0 md:border-r">
        <Link href="/homepage" className="font-display text-xl font-bold text-[#4a7c59]">
          TORPulse
        </Link>
        <div className="mt-7 flex items-center justify-between text-[13px] text-[#5c5446]">
          <span>ความครบของโปรไฟล์</span>
          <b className="text-[#4a7c59]">{completeness.percentage}%</b>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8e0d0]">
          <div
            className="h-full rounded-full bg-[#4a7c59] transition-all duration-500"
            style={{ width: `${completeness.percentage}%` }}
          />
        </div>
        <ol className="mt-7 space-y-1">
          {steps.map((key, i) => {
            const current = !finished && i === stepIndex;
            const done = isStepDone(key, i);
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => {
                    setFinished(false);
                    setStepIndex(i);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left text-sm ${
                    current ? "font-semibold text-[#2d2d2d]" : done ? "text-[#2d5a37]" : "text-[#998f80]"
                  }`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs ${
                      current
                        ? "border-[#4a7c59] bg-[#4a7c59] text-white"
                        : done
                          ? "border-[#c4e3cb] bg-[#e2ede4] text-[#2d5a37]"
                          : "border-[#ddd5c8]"
                    }`}
                  >
                    {done && !current ? <CheckIcon className="size-4" /> : i + 1}
                  </span>
                  <span>
                    {STEP_LABELS[key]}
                    {OPTIONAL_STEPS.has(key) && (
                      <span className="ml-1 text-[11px] font-normal text-[#998f80]">(ไม่บังคับ)</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-[11.5px] leading-relaxed text-[#7a8b6f]">
          ข้อมูลนี้ใช้คำนวณว่าคุณมีคุณสมบัติตรงกับ TOR แต่ละฉบับกี่เปอร์เซ็นต์ แก้ไขภายหลังได้ที่หน้าโปรไฟล์
          ข้อมูลที่พิมพ์ค้างไว้จะถูกจำไว้ในเบราว์เซอร์นี้
        </p>
      </aside>

      {/* ── Current step ── */}
      <main className="px-5 py-8 md:px-16 md:py-12">
        <div className="mx-auto max-w-3xl">
          {!finished && (
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => leave("dismissed", "/homepage")}
                disabled={leaving}
                className="text-[13px] text-[#7a8b6f] hover:underline"
              >
                ข้ามไปก่อน ›
              </button>
            </div>
          )}

          {finished ? (
            <div className="pt-10 text-center">
              <h1 className="text-[28px] font-bold text-[#2d2d2d]">
                {completeness.isComplete ? "โปรไฟล์พร้อมคำนวณคะแนนแล้ว" : `โปรไฟล์ครบ ${completeness.percentage}%`}
              </h1>
              <p className="mx-auto mt-2 max-w-xl text-sm text-[#7a8b6f]">
                {completeness.isComplete
                  ? "ระบบกำลังคำนวณความเหมาะสมกับ TOR ที่เปิดรับอยู่ คะแนนจะขึ้นบนการ์ดภายในไม่กี่นาที"
                  : "กรอกส่วนที่เหลือเมื่อพร้อม เพื่อให้ระบบคำนวณความเหมาะสมกับ TOR ได้"}
              </p>
              {!completeness.isComplete && (
                <ul className="mx-auto mt-4 inline-block text-left text-sm text-[#5c5446]">
                  {completeness.missing.map((key) => (
                    <li key={key}>○ {missingFieldLabel(key)}</li>
                  ))}
                </ul>
              )}
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => leave("completed", "/profile")}
                  disabled={leaving}
                  className={secondaryButtonCls}
                >
                  แก้ไขโปรไฟล์
                </button>
                <button
                  type="button"
                  onClick={() => leave("completed", "/homepage")}
                  disabled={leaving}
                  className={primaryButtonCls}
                >
                  ไปดู TOR ที่เหมาะกับฉัน →
                </button>
              </div>
            </div>
          ) : step === "type" ? (
            <TypeStep
              draftKey={draftKey}
              initial={accountType}
              onSkip={next}
              onNext={async (type) => {
                if (type !== profile.accountType) {
                  await updateProfile({ accountType: type });
                  await bidder.refresh();
                }
                next();
              }}
            />
          ) : step === "basics" ? (
            <BasicsStep
              draftKey={draftKey}
              accountType={accountType}
              profile={profile}
              bidderProfile={bidderProfile}
              onBack={back}
              onNext={next}
            />
          ) : step === "projects" ? (
            <>
              <StepHeading
                title="ผลงานที่ผ่านมา"
                subtitle={
                  accountType === "company"
                    ? "ต้องมีอย่างน้อย 1 โครงการ: ชื่อโครงการ งบ และวันที่ส่งมอบ"
                    : "ต้องมีอย่างน้อย 1 โครงการ: ชื่อโครงการ และงบ"
                }
              />
              <div className={box}>
                <ProjectsEditor profile={bidderProfile} bare strict draftKey={draftKey} />
              </div>
              <StepFooter
                onBack={back}
                onSkip={next}
                onNext={next}
                blockedReason={
                  projectsReady
                    ? null
                    : accountType === "company"
                      ? "บันทึกผลงานอย่างน้อย 1 โครงการ ที่มีงบและวันที่ส่งมอบก่อน"
                      : "บันทึกผลงานอย่างน้อย 1 โครงการ ที่มีงบก่อน"
                }
              />
            </>
          ) : step === "team" ? (
            <>
              <StepHeading
                title="บุคลากรในทีม"
                subtitle="ตำแหน่ง วุฒิ ใบรับรอง และวันที่เข้าร่วมบริษัท · ใส่เฉพาะคนที่ใช้ยื่นงานบ่อย"
              />
              <div className={box}>
                <TeamEditor profile={bidderProfile} bare strict draftKey={draftKey} />
              </div>
              <StepFooter onBack={back} onSkip={next} onNext={next} />
            </>
          ) : step === "self" ? (
            <>
              <StepHeading
                title="ความเชี่ยวชาญของคุณ"
                subtitle="ตำแหน่ง วุฒิ และใบรับรอง ใช้เทียบกับคุณสมบัติบุคลากรใน TOR"
              />
              <div className={box}>
                <SelfEditor profile={bidderProfile} bare draftKey={draftKey} />
              </div>
              <StepFooter onBack={back} onSkip={next} onNext={next} />
            </>
          ) : (
            <InterestsStep
              draftKey={draftKey}
              initial={profile.interests}
              onBack={back}
              onNext={next}
            />
          )}
        </div>
      </main>
    </div>
  );
}
