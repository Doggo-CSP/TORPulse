"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { SiteNav } from "@/app/components/site_nav";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useTorRecommendations } from "@/hooks/use-tors";
import { useCategories } from "@/hooks/use-categories";
import { useAuth } from "@/hooks/use-auth";
import { CompanyForm } from "./forms/company-form";
import { ProjectsEditor, SelfEditor, TeamEditor } from "./forms/bidder-editors";
import { PersonalForm } from "./forms/personal-form";
import {
  mainFormError,
  toMainProfileForm,
  useSaveMainProfile,
  type MainProfileForm,
} from "./forms/main-profile";
import { useBidderProfile } from "@/hooks/use-bidder-profile";
import { missingFieldLabel } from "@/lib/qualification-labels";
import {
  GlobeAltIcon,
  ChartBarIcon,
  DevicePhoneMobileIcon,
  BuildingOfficeIcon,
  AcademicCapIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ServerStackIcon,
  BookmarkIcon as BookmarkOutlineIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolidIcon } from "@heroicons/react/24/solid";
import { NotificationSettings } from "./notification-settings";

// ไอคอนตาม key (ชื่อ/ลำดับ/การซ่อนมาจาก backend)
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  web_application: GlobeAltIcon,
  data_bi: ChartBarIcon,
  mobile_app: DevicePhoneMobileIcon,
  enterprise_system: BuildingOfficeIcon,
  consulting_architecture: AcademicCapIcon,
  cybersecurity: ShieldCheckIcon,
  ai_ml: SparklesIcon,
  cloud_infrastructure: ServerStackIcon,
};

// คำอธิบายสำรอง ใช้เมื่อ API ไม่ส่ง description มา
const CATEGORY_FALLBACK_DESCRIPTIONS: Record<string, string> = {
  web_application: "ระบบเว็บแอปพลิเคชันและพอร์ทัลบริการประชาชน",
  data_bi: "ระบบข้อมูล วิเคราะห์ และแดชบอร์ดผู้บริหาร",
  mobile_app: "แอปพลิเคชันบนมือถือ iOS และ Android",
  enterprise_system: "ระบบสารสนเทศองค์กรและงานหลังบ้าน",
  consulting_architecture: "งานที่ปรึกษาและออกแบบสถาปัตยกรรมระบบ",
  cybersecurity: "ความมั่นคงปลอดภัยไซเบอร์และการตรวจสอบระบบ",
  ai_ml: "ปัญญาประดิษฐ์ การวิเคราะห์ขั้นสูงและระบบอัตโนมัติ",
  cloud_infrastructure: "โครงสร้างพื้นฐาน คลาวด์ และระบบเครือข่าย",
};

// กันข้อมูลเก่าที่ users.interests ยังเป็น id เดิม (ลบได้หลังรัน migrate-categories)
const LEGACY_INTEREST_IDS: Record<string, string> = {
  web: "web_application",
  data: "data_bi",
  mobile: "mobile_app",
  enterprise: "enterprise_system",
  consulting: "consulting_architecture",
  cybersecurity: "cybersecurity",
  ai: "ai_ml",
  cloud: "cloud_infrastructure",
};

type TabType = "profile" | "interests" | "bookmarks" | "recommended" | "notifications";
const TABS: TabType[] = ["profile", "interests", "bookmarks", "recommended", "notifications"];

// The main form; the same fields onboarding asks for (forms/main-profile.ts)
type FormState = MainProfileForm;

export default function ProfilePage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const {
    profile,
    loading,
    saving,
    message,
    bookmarkedTors,
    updateProfile,
    updateInterests,
    toggleBookmark,
  } = useUserProfile(!!authUser);
  const bidder = useBidderProfile(!!authUser);
  const bidderProfile = bidder.profile;
  const saveMainProfile = useSaveMainProfile();
  const { data: recommendedTors = [], refetch: refetchRecommendations } =
    useTorRecommendations(!!authUser);
  // Every active category, whether or not any TOR uses it right now. (/tors/filter-options only
  // lists categories some TOR uses, so a category with no TOR yet would vanish from here.)
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  const categoryOptions = useMemo(
    () =>
      (categories ?? []).map((c) => ({
        key: c.key,
        name: c.name,
        description: c.description || CATEGORY_FALLBACK_DESCRIPTIONS[c.key] || "",
        Icon: CATEGORY_ICONS[c.key] ?? GlobeAltIcon,
      })),
    [categories],
  );

  const categoryNameByKey = useMemo(
    () => new Map(categoryOptions.map((c) => [c.key, c.name])),
    [categoryOptions],
  );

  // Everything the user has saved, including categories an admin has since hidden
  const savedInterests = useMemo(
    () =>
      Array.from(new Set((profile?.interests || []).map((id) => LEGACY_INTEREST_IDS[id] ?? id))),
    [profile?.interests],
  );

  // What the cards show as selected: only categories that are offered right now
  const selectedInterests = useMemo(() => {
    // รอหมวดโหลดเสร็จก่อน ค่อยตัด key ที่ไม่มีในรายการ (ซ่อนอยู่/ไม่มีใน DB)
    if (categoryOptions.length === 0) return savedInterests;
    return savedInterests.filter((k) => categoryNameByKey.has(k));
  }, [savedInterests, categoryOptions.length, categoryNameByKey]);

  // Notification emails link to /profile?tab=notifications. The first render is the loading
  // spinner on both server and client, so reading the URL here causes no visible mismatch.
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window === "undefined") return "profile";
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab && (TABS as string[]).includes(tab) ? (tab as TabType) : "profile";
  });
  const [formData, setFormData] = useState<FormState>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Toggle against everything saved, not just the cards on screen, so interests in hidden
  // categories are kept (the backend accepts hidden keys the user already has).
  const handleInterestToggle = (catKey: string) => {
    const nextInterests = savedInterests.includes(catKey)
      ? savedInterests.filter((id) => id !== catKey)
      : [...savedInterests, catKey];
    void Promise.resolve(updateInterests(nextInterests)).then(() =>
      refetchRecommendations(),
    );
  };

  // Load the main form once both are available. Later saves of team members or projects refresh
  // the bidder profile too, and must not reset what the user is typing here.
  const formLoaded = useRef(false);
  useEffect(() => {
    if (profile && bidderProfile && !formLoaded.current) {
      formLoaded.current = true;
      setFormData(toMainProfileForm(profile, bidderProfile));
    }
  }, [profile, bidderProfile]);

  // ซ่อนข้อความ "บันทึกสำเร็จ" เองหลัง 4 วินาที
  useEffect(() => {
    if (!saveResult?.ok) return;
    const t = setTimeout(() => setSaveResult(null), 4000);
    return () => clearTimeout(t);
  }, [saveResult]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#f5f0e8]">
        <SiteNav />
        <main className="mx-auto max-w-5xl px-4 py-12">
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#4a7c59] border-t-transparent"></div>
          </div>
        </main>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-[#f5f0e8]">
        <SiteNav />
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <div className="rounded-3xl border border-[#e8e0d0] bg-white p-8 shadow-sm">
            <UserIcon className="mx-auto mb-4 size-12 text-[#7a8b6f]" />
            <h2 className="mb-2 text-xl font-bold text-[#2d2d2d]">กรุณาเข้าสู่ระบบ</h2>
            <p className="mb-6 text-sm text-[#7a8b6f]">
              คุณต้องเข้าสู่ระบบก่อนเพื่อจัดการโปรไฟล์และตั้งค่าความสนใจ
            </p>
            <Link
              href="/auth"
              className="inline-block rounded-xl bg-[#4a7c59] px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-[#3b6647]"
            >
              เข้าสู่ระบบด้วย Google
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const accountTypeLabel =
    profile?.accountType === "company" ? "บริษัท" : "บุคคล / ผู้ใช้งาน";

  // Required fields for qualification matching, as saved (UC-07)
  const completeness = bidderProfile?.completeness;
  const completionPercentage = completeness?.percentage ?? 0;

  // Saves the main form; team members and projects are saved by their own editors. Incomplete
  // profiles are saved as drafts (UC-07): only values in a wrong format stop the save.
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveResult(null);

    const error = mainFormError(formData);
    if (error) {
      setFormError(error);
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      await saveMainProfile(formData);
      setSaveResult({ ok: true, text: "บันทึกสำเร็จ" });
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? `บันทึกไม่สำเร็จ: ${error.message}`
          : "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const tabClass = (tab: TabType) =>
    `rounded-full px-5 py-2 text-sm font-medium transition-all ${
      activeTab === tab
        ? "bg-[#4a7c59] text-white shadow-sm"
        : "bg-[#f5f0e8] text-[#5c5446] hover:bg-[#e8e0d0]"
    }`;

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      <SiteNav />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* ── Top Header Profile Summary Card ── */}
        <div className="mb-6 rounded-3xl border border-[#e8e0d0] bg-white p-6 md:p-8 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#998f80]">
                บัญชีผู้ใช้งาน
              </span>
              <h1 className="mt-1 text-2xl font-bold text-[#2d2d2d] md:text-3xl">
                {profile?.displayName || profile?.name || profile?.email || authUser?.email}
              </h1>
              <p className="mt-1 text-sm text-[#7a8b6f]">
                {accountTypeLabel}
                {(profile?.email || authUser?.email) && (
                  <> · {profile?.email || authUser?.email}</>
                )}
              </p>
            </div>

            {/* Profile Completion Bar */}
            <div className="w-full max-w-[240px] rounded-xl bg-[#faf7f2] p-3 border border-[#f0eafe]">
              <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#5c5446]">
                <span>ความสมบูรณ์ของโปรไฟล์</span>
                <span className="font-semibold text-[#4a7c59]">
                  {completionPercentage}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8e0d0]">
                <div
                  className="h-full rounded-full bg-[#4a7c59] transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <Link
                href="/onboarding"
                className="mt-2 inline-block text-[11px] font-semibold text-[#4a7c59] hover:underline"
              >
                กรอกแบบทีละขั้นตอน →
              </Link>
              {completeness && !completeness.isComplete && (
                <div className="mt-2 text-[11px] text-[#7a8b6f]">
                  <p className="font-medium text-[#5c5446]">กรอกเพิ่มเพื่อประเมินคุณสมบัติกับ TOR:</p>
                  <ul className="mt-0.5 list-disc pl-4">
                    {completeness.missing.map((key) => (
                      <li key={key}>{missingFieldLabel(key)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Tab Pills */}
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[#f0e8dc] pt-6">
            <button onClick={() => setActiveTab("profile")} className={tabClass("profile")}>
              โปรไฟล์
            </button>
            <button onClick={() => setActiveTab("interests")} className={tabClass("interests")}>
              ความสนใจ
            </button>
            <button onClick={() => setActiveTab("bookmarks")} className={tabClass("bookmarks")}>
              TOR ที่บันทึกไว้ ({profile?.bookmarkedCount || 0})
            </button>
            <button onClick={() => setActiveTab("recommended")} className={tabClass("recommended")}>
              TOR ที่แนะนำ
            </button>
            <button
              onClick={() => setActiveTab("notifications")}
              className={tabClass("notifications")}
            >
              การแจ้งเตือน
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {message && (
          <div
            className={`mb-6 rounded-2xl p-4 text-sm font-medium ${
              message.type === "success"
                ? "bg-[#eaf4ed] text-[#2d5a37] border border-[#c4e3cb]"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* ── TAB 1: Profile CRUD ── */}
        {activeTab === "profile" && (
          <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-sm md:p-8">
            <form id="profile-main-form" onSubmit={handleFormSubmit} className="space-y-6">
              {/* Account type */}
              <div>
                <h2 className="text-lg font-bold text-[#2d2d2d]">ประเภทบัญชี</h2>
                <p className="mt-1 text-sm text-[#7a8b6f]">
                  เลือกประเภทให้ตรงกับผู้ใช้งาน เพื่อให้เราแสดงข้อมูลที่เกี่ยวข้องได้อย่างถูกต้อง
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  {(
                    [
                      { id: "personal", label: "บุคคล / ผู้ใช้งาน" },
                      { id: "company", label: "นิติบุคคล" },
                    ] as const
                  ).map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, accountType: type.id })}
                      className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-all ${
                        formData.accountType === type.id
                          ? "border-[#4a7c59] bg-[#4a7c59] text-white shadow-sm"
                          : "border-[#ddd5c8] bg-white text-[#5c5446] hover:bg-[#faf7f2]"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── PERSONAL (forms/personal-form.tsx, shared with onboarding) ── */}
              {formData.accountType === "personal" && (
                <PersonalForm
                  value={formData}
                  onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
                />
              )}

              {/* ── นิติบุคคล (แยกไปที่ forms/company-form.tsx) ── */}
              {formData.accountType === "company" && (
                <CompanyForm
                  value={formData}
                  onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch } as FormState))}
                  teamCount={bidderProfile?.team.length ?? 0}
                />
              )}
            </form>

            {/* Saved one item at a time, separately from the form above */}
            {bidderProfile && (
              <div className="mt-8 space-y-4 border-t border-[#f0e8dc] pt-6">
                <div>
                  <h2 className="text-lg font-bold text-[#2d2d2d]">ข้อมูลสำหรับประเมินคุณสมบัติ</h2>
                  <p className="mt-1 text-sm text-[#7a8b6f]">
                    แต่ละรายการบันทึกทันทีเมื่อกดบันทึก ระบบจะประเมินความเหมาะสมกับ TOR ใหม่ให้อัตโนมัติ
                  </p>
                </div>
                {bidderProfile.accountType !== formData.accountType && (
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    กด &quot;บันทึกการเปลี่ยนแปลง&quot; เพื่อเปลี่ยนประเภทบัญชีก่อน แล้วจึงกรอกข้อมูลด้านล่าง
                  </p>
                )}
                {bidderProfile.accountType === "company" ? (
                  <TeamEditor profile={bidderProfile} />
                ) : (
                  <SelfEditor profile={bidderProfile} />
                )}
                <ProjectsEditor profile={bidderProfile} />
              </div>
            )}

            {/* Save bar: stays at the bottom of the screen while the card is in view */}
            <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-8 flex flex-col gap-3 rounded-b-3xl border-t border-[#f0e8dc] bg-white/95 px-6 py-4 backdrop-blur sm:flex-row-reverse sm:items-center md:-mx-8 md:-mb-8 md:px-8">
              <button
                type="submit"
                form="profile-main-form"
                disabled={submitting}
                className="rounded-full bg-[#4a7c59] px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#3b6647] disabled:opacity-50"
              >
                {submitting ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
              </button>

              <div aria-live="polite" className="min-w-0 flex-1 text-sm sm:text-right">
                {formError ? (
                  <p
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-red-700"
                  >
                    {formError}
                  </p>
                ) : saveResult ? (
                  <p className="flex items-center gap-1.5 font-medium text-[#2d5a37]">
                    <CheckCircleIcon className="size-5" />
                    {saveResult.text}
                  </p>
                ) : (
                  <span className="text-xs text-[#998f80]">
                    ข้อมูลส่วนบุคคลของคุณเป็นความลับ ผู้ใช้อื่นมองไม่เห็น
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: Interests Grid ── */}
        {activeTab === "interests" && (
          <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 md:p-8 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-[#2d2d2d]">ความสนใจของคุณ</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#7a8b6f]">
                เลือกหมวดหมู่งานที่คุณสนใจได้มากกว่าหนึ่งหมวด
                ระบบจะใช้ข้อมูลนี้จัดลำดับ TOR ที่แนะนำให้คุณโดยเฉพาะ (เลือกแล้วบันทึกอัตโนมัติ)
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categoriesLoading && (
                <p className="col-span-full text-sm text-[#7a8b6f]">กำลังโหลดหมวดหมู่...</p>
              )}
              {!categoriesLoading && categoryOptions.length === 0 && (
                <p className="col-span-full text-sm text-[#7a8b6f]">ไม่พบหมวดหมู่</p>
              )}
              {categoryOptions.map((cat) => {
                const IconComponent = cat.Icon;
                const isSelected = selectedInterests.includes(cat.key);

                return (
                  <div
                    key={cat.key}
                    onClick={() => handleInterestToggle(cat.key)}
                    className={`group relative flex cursor-pointer flex-col justify-between rounded-3xl p-5 transition-all border ${
                      isSelected
                        ? "border-[#4a7c59] bg-[#f7f9f7] shadow-sm ring-1 ring-[#4a7c59]"
                        : "border-[#e8e0d0] bg-white hover:border-[#4a7c59]/50 hover:bg-[#faf7f2]"
                    }`}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div
                        className={`grid h-12 w-12 place-items-center rounded-2xl transition-colors ${
                          isSelected
                            ? "bg-[#e2ede4] text-[#4a7c59]"
                            : "bg-[#f5f0e8] text-[#7a8b6f]"
                        }`}
                      >
                        <IconComponent className="size-6" />
                      </div>
                      <div
                        className={`grid h-6 w-6 place-items-center rounded-full border transition-all ${
                          isSelected
                            ? "border-[#4a7c59] bg-[#4a7c59] text-white"
                            : "border-[#ddd5c8] bg-white"
                        }`}
                      >
                        {isSelected && <CheckCircleIcon className="size-5 text-white" />}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#2d2d2d] group-hover:text-[#4a7c59]">
                        {cat.name}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#7a8b6f]">
                        {cat.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selection Counter */}
            <div className="mt-8 flex items-center justify-between border-t border-[#f0e8dc] pt-6 text-xs text-[#998f80]">
              <span>เลือกไว้แล้ว {selectedInterests.length} หมวดหมู่</span>
              {saving && <span className="text-[#4a7c59]">กำลังบันทึกความสนใจ...</span>}
            </div>
          </div>
        )}

        {/* ── TAB 3: Bookmarked TORs ── */}
        {activeTab === "bookmarks" && (
          <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 md:p-8 shadow-sm">
            <h2 className="mb-2 text-xl font-bold text-[#2d2d2d]">TOR ที่บันทึกไว้</h2>
            <p className="mb-6 text-sm text-[#7a8b6f]">
              รายการประกาศ TOR ที่คุณกดบันทึกเพื่อติดตามย้อนหลัง
            </p>

            {bookmarkedTors.length === 0 ? (
              <div className="my-8 rounded-2xl border border-dashed border-[#ddd5c8] bg-[#faf7f2] p-12 text-center">
                <BookmarkOutlineIcon className="mx-auto mb-3 size-10 text-[#b0a898]" />
                <h3 className="text-base font-semibold text-[#2d2d2d]">ยังไม่มี TOR ที่บันทึกไว้</h3>
                <p className="mt-1 text-xs text-[#7a8b6f]">
                  คุณสามารถกดปุ่มบันทึกที่รายการ TOR ในหน้าหลักเพื่อเก็บไว้อ่านภายหลังได้
                </p>
                <Link
                  href="/homepage"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#4a7c59] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#3b6647]"
                >
                  ค้นหา TOR ล่าสุด <ArrowRightIcon className="size-4" />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {bookmarkedTors.map((tor) => (
                  <div
                    key={tor._id}
                    className="flex flex-col justify-between rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] p-5 shadow-sm hover:border-[#4a7c59]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-[#2d2d2d] line-clamp-2">
                          {tor.projectTitle}
                        </h3>
                        <button
                          onClick={() => void toggleBookmark(tor._id)}
                          className="text-[#4a7c59] hover:opacity-75"
                          title="ยกเลิกการบันทึก"
                        >
                          <BookmarkSolidIcon className="size-6" />
                        </button>
                      </div>

                      {tor.agencyName && (
                        <p className="mt-1 text-xs text-[#7a8b6f]">{tor.agencyName}</p>
                      )}
                      {tor.summary && (
                        <p className="mt-2 text-xs text-[#5c5446] line-clamp-2">{tor.summary}</p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[#e8e0d0] pt-3 text-xs">
                      <span className="font-semibold text-[#4a7c59]">
                        {tor.budgetBaht
                          ? `งบประมาณ: ${tor.budgetBaht.toLocaleString()} บาท`
                          : "ไม่ระบุงบประมาณ"}
                      </span>
                      {tor.detailUrl && (
                        <a
                          href={tor.detailUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-[#4a7c59] hover:underline"
                        >
                          ดูรายละเอียด →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: Recommended TORs ── */}
        {activeTab === "recommended" && (
          <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 md:p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#2d2d2d]">TOR ที่แนะนำสำหรับคุณ</h2>
              <p className="mt-1 text-sm text-[#7a8b6f]">
                คัดสรรตามความสนใจของคุณ:{" "}
                {selectedInterests.length > 0
                  ? selectedInterests.map((k) => categoryNameByKey.get(k) ?? k).join(", ")
                  : "ยังไม่ได้เลือกหมวดหมู่"}
              </p>
            </div>

            {selectedInterests.length === 0 ? (
              <div className="my-8 rounded-2xl border border-dashed border-[#ddd5c8] bg-[#faf7f2] p-12 text-center">
                <SparklesIcon className="mx-auto mb-3 size-10 text-[#b0a898]" />
                <h3 className="text-base font-semibold text-[#2d2d2d]">ยังไม่ได้เลือกความสนใจ</h3>
                <p className="mt-1 text-xs text-[#7a8b6f]">
                  เลือกหมวดหมู่ที่สนใจ แล้วระบบจะแนะนำ TOR ที่ตรงกับคุณ
                </p>
                <button
                  onClick={() => setActiveTab("interests")}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#4a7c59] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#3b6647]"
                >
                  เลือกความสนใจตอนนี้
                </button>
              </div>
            ) : recommendedTors.length === 0 ? (
              <div className="my-8 rounded-2xl border border-dashed border-[#ddd5c8] bg-[#faf7f2] p-12 text-center">
                <SparklesIcon className="mx-auto mb-3 size-10 text-[#b0a898]" />
                <h3 className="text-base font-semibold text-[#2d2d2d]">
                  ยังไม่มี TOR ที่ตรงกับความสนใจ
                </h3>
                <p className="mt-1 text-xs text-[#7a8b6f]">
                  ลองเลือกหมวดหมู่เพิ่มเติมเพื่อเพิ่มโอกาสการจับคู่
                </p>
                <button
                  onClick={() => setActiveTab("interests")}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#4a7c59] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#3b6647]"
                >
                  แก้ไขความสนใจ
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {recommendedTors.map((tor) => {
                  const isBookmarked = bookmarkedTors.some((b) => b._id === tor.id);
                  const categoryName = tor.category
                    ? (categoryNameByKey.get(tor.category) ?? null)
                    : null;

                  return (
                    <div
                      key={tor.id}
                      className="flex flex-col justify-between rounded-2xl border border-[#e8e0d0] bg-white p-5 shadow-sm hover:border-[#4a7c59]"
                    >
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {categoryName && (
                            <span className="rounded-full bg-[#e2ede4] px-2.5 py-0.5 text-[11px] font-medium text-[#2d5a37]">
                              {categoryName}
                            </span>
                          )}
                          {typeof tor.score === "number" && (
                            <span className="rounded-full bg-[#f5f0e8] px-2.5 py-0.5 text-[11px] text-[#5c5446]">
                              คะแนน {tor.score}
                            </span>
                          )}
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <Link
                            href={`/tor/${tor.id}`}
                            className="font-bold text-[#2d2d2d] line-clamp-2 hover:text-[#4a7c59]"
                          >
                            {tor.projectTitle}
                          </Link>
                          <button
                            onClick={() => void toggleBookmark(tor.id)}
                            className="shrink-0 hover:opacity-75"
                            title={isBookmarked ? "ยกเลิกการบันทึก" : "บันทึก TOR"}
                          >
                            {isBookmarked ? (
                              <BookmarkSolidIcon className="size-6 text-[#4a7c59]" />
                            ) : (
                              <BookmarkOutlineIcon className="size-6 text-[#998f80]" />
                            )}
                          </button>
                        </div>

                        {tor.agencyName && (
                          <p className="mt-1 text-xs text-[#7a8b6f]">{tor.agencyName}</p>
                        )}
                        {tor.summary && (
                          <p className="mt-2 text-xs text-[#5c5446] line-clamp-2">{tor.summary}</p>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-[#f0e8dc] pt-3 text-xs">
                        <span className="font-semibold text-[#4a7c59]">
                          {tor.budgetBaht
                            ? `งบประมาณ: ${tor.budgetBaht.toLocaleString("th-TH")} บาท`
                            : "ไม่ระบุงบประมาณ"}
                        </span>
                        <Link
                          href={`/tor/${tor.id}`}
                          className="font-medium text-[#4a7c59] hover:underline"
                        >
                          ดูรายละเอียด →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 5: Qualifying-TOR email notifications ── */}
        {activeTab === "notifications" && profile && (
          <NotificationSettings
            key={JSON.stringify([profile.qualification, profile.notificationPrefs])}
            profile={profile}
            saving={saving}
            onSave={updateProfile}
          />
        )}
      </main>
    </div>
  );
}