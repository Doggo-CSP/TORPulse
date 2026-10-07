"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { SiteNav } from "@/app/components/site_nav";
import { useUserProfile, type UserProfileData } from "@/hooks/use-user-profile";
import { useTorRecommendations, useTorFilterOptions } from "@/hooks/use-tors";
import { useAuth } from "@/hooks/use-auth";
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
  CameraIcon,
} from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolidIcon } from "@heroicons/react/24/solid";

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

const inputCls =
  "w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]";
const labelCls = "block text-xs font-semibold text-[#5c5446] mb-1.5";

type TabType = "profile" | "interests" | "bookmarks" | "recommended";

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
  const { data: recommendedTors = [], refetch: refetchRecommendations } =
    useTorRecommendations(!!authUser);
  const { data: filterOptions, isLoading: categoriesLoading } = useTorFilterOptions();

  const categoryOptions = useMemo(
    () =>
      (filterOptions?.categories ?? []).map((c) => ({
        key: c.key,
        name: c.name,
        description:
          (c as { description?: string }).description ||
          CATEGORY_FALLBACK_DESCRIPTIONS[c.key] ||
          "",
        Icon: CATEGORY_ICONS[c.key] ?? GlobeAltIcon,
      })),
    [filterOptions],
  );

  const categoryNameByKey = useMemo(
    () => new Map(categoryOptions.map((c) => [c.key, c.name])),
    [categoryOptions],
  );

  const selectedInterests = useMemo(() => {
    const mapped = Array.from(
      new Set((profile?.interests || []).map((id) => LEGACY_INTEREST_IDS[id] ?? id)),
    );
    // รอหมวดโหลดเสร็จก่อน ค่อยตัด key ที่ไม่มีในรายการ (ซ่อนอยู่/ไม่มีใน DB)
    if (categoryOptions.length === 0) return mapped;
    return mapped.filter((k) => categoryNameByKey.has(k));
  }, [profile?.interests, categoryOptions.length, categoryNameByKey]);

  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [formData, setFormData] = useState<Partial<UserProfileData>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("ขนาดไฟล์ต้องไม่เกิน 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, image: reader.result as string }));
    };
    reader.readAsDataURL(file);

    // allow re-selecting the same file later
    e.target.value = "";
  };

  const handleInterestToggle = (catKey: string) => {
    const nextInterests = selectedInterests.includes(catKey)
      ? selectedInterests.filter((id) => id !== catKey)
      : [...selectedInterests, catKey];
    void Promise.resolve(updateInterests(nextInterests)).then(() =>
      refetchRecommendations(),
    );
  };

  useEffect(() => {
    if (profile) {
      setFormData({
        accountType: profile.accountType || "personal",
        displayName: profile.displayName || profile.name || "",
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        jobTitle: profile.jobTitle || "",
        contactEmail: profile.contactEmail || profile.email || "",
        phone: profile.phone || "",
        image: profile.image || "",
        address: profile.address || "",
        about: profile.about || "",
        companyName: (profile as any).companyName || "",
        registrationNumber: (profile as any).registrationNumber || "",
        businessType: (profile as any).businessType || "",
        agencyName: (profile as any).agencyName || "",
        agencyType: (profile as any).agencyType || "",
        website: profile.website || "",
      });
    }
  }, [profile]);

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
    profile?.accountType === "company"
      ? "บริษัท"
      : profile?.accountType === "agency"
      ? "หน่วยงาน"
      : "บุคคล / ผู้ใช้งาน";

  const liveCompletionPercentage = (() => {
    const fields = [
      Boolean(formData.displayName?.trim()),
      Boolean(formData.firstName?.trim()),
      Boolean(formData.lastName?.trim()),
      Boolean(formData.jobTitle?.trim()),
      Boolean(formData.contactEmail?.trim()),
      Boolean(formData.phone?.trim()),
      Boolean(formData.image?.trim()),
      Boolean(formData.address?.trim()),
      Boolean(formData.about?.trim()),
      selectedInterests.length > 0,
    ];
    const completed = fields.filter(Boolean).length;
    return Math.round((completed / fields.length) * 100);
  })();

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void updateProfile(formData);
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
                {profile?.displayName || profile?.name || "Kantapon Hemmadhun"}
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
                  {liveCompletionPercentage}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8e0d0]">
                <div
                  className="h-full rounded-full bg-[#4a7c59] transition-all duration-500"
                  style={{ width: `${liveCompletionPercentage}%` }}
                />
              </div>
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
            <form onSubmit={handleFormSubmit} className="space-y-6">
              {/* Top Section */}
              <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_auto] md:items-start">
                {/* Account Type — Left */}
                <div>
                  <h2 className="text-lg font-bold text-[#2d2d2d]">ประเภทบัญชี</h2>
                  <p className="mt-1 text-sm text-[#7a8b6f]">
                    เลือกประเภทให้ตรงกับผู้ใช้งาน เพื่อให้เราแสดงข้อมูลที่เกี่ยวข้องได้อย่างถูกต้อง
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {[
                      { id: "personal", label: "บุคคล / ผู้ใช้งาน" },
                      { id: "company", label: "บริษัท" },
                      { id: "agency", label: "หน่วยงาน" },
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, accountType: type.id as any })
                        }
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

                {/* Avatar — Right */}
                <div className="grid grid-cols-1 gap-5 pt-2">
                  <label className="mb-1.5 block text-xs font-semibold text-[#5c5446]">
                    Avatar / รูปโปรไฟล์
                  </label>

                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[#e8e0d0] bg-[#faf7f2] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
                    >
                      {formData.image ? (
                        <img
                          src={formData.image}
                          alt="รูปโปรไฟล์"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[#b0a898]">
                          <UserIcon className="size-8" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <CameraIcon className="size-6 text-white" />
                      </div>
                    </button>

                    <div>
                      <button
                        type="button"
                        onClick={handleAvatarClick}
                        className="rounded-full border border-[#ddd5c8] bg-white px-4 py-2 text-xs font-medium text-[#5c5446] hover:bg-[#faf7f2]"
                      >
                        เลือกรูปภาพ
                      </button>

                      {formData.image && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, image: "" })}
                          className="ml-2 text-xs font-medium text-[#CC0000] hover:underline"
                        >
                          ลบรูป
                        </button>
                      )}

                      <p className="mt-1.5 text-xs text-[#CC0000]">
                        รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 5MB
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* ── PERSONAL ── */}
              {formData.accountType === "personal" && (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 pt-2">
                  <div>
                    <label className={labelCls}>ชื่อที่แสดง</label>
                    <input
                      type="text"
                      value={formData.displayName || ""}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder="เช่น Kantapon Hemmadhun"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>ชื่อ</label>
                    <input
                      type="text"
                      value={formData.firstName || ""}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>นามสกุล</label>
                    <input
                      type="text"
                      value={formData.lastName || ""}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>ตำแหน่งงาน</label>
                    <input
                      type="text"
                      value={formData.jobTitle || ""}
                      onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                      placeholder="เช่น นักพัฒนาซอฟต์แวร์"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>อีเมล</label>
                    <input
                      type="email"
                      value={formData.contactEmail || ""}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>เบอร์โทรศัพท์</label>
                    <input
                      type="tel"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>ที่อยู่</label>
                    <textarea
                      rows={2}
                      value={formData.address || ""}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>เกี่ยวกับคุณ</label>
                    <textarea
                      rows={3}
                      value={formData.about || ""}
                      onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                      placeholder="แนะนำตัวสั้น ๆ เช่น ทักษะ ความถนัด หรือประสบการณ์"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* ── COMPANY ── */}
              {formData.accountType === "company" && (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 pt-2">
                  <div>
                    <label className={labelCls}>ชื่อที่แสดง</label>
                    <input
                      type="text"
                      value={formData.displayName || ""}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder="เช่น Kantapon Hemmadhun"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>ชื่อบริษัท</label>
                    <input
                      type="text"
                      value={(formData as any).companyName || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, companyName: e.target.value } as any)
                      }
                      placeholder="เช่น บริษัท เทคโนโลยีไทย จำกัด"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>เลขทะเบียนนิติบุคคล</label>
                    <input
                      type="text"
                      value={(formData as any).registrationNumber || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, registrationNumber: e.target.value } as any)
                      }
                      placeholder="เช่น 0105567012345"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>ประเภทธุรกิจ</label>
                    <input
                      type="text"
                      value={(formData as any).businessType || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, businessType: e.target.value } as any)
                      }
                      placeholder="เช่น ผู้พัฒนาซอฟต์แวร์"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>อีเมลติดต่อ</label>
                    <input
                      type="email"
                      value={formData.contactEmail || ""}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>เบอร์โทรศัพท์</label>
                    <input
                      type="tel"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>ที่อยู่สำนักงาน</label>
                    <textarea
                      rows={2}
                      value={formData.address || ""}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>เกี่ยวกับบริษัท</label>
                    <textarea
                      rows={3}
                      value={formData.about || ""}
                      onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                      placeholder="แนะนำบริษัทสั้น ๆ ผลงาน หรือความเชี่ยวชาญ"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* ── AGENCY ── */}
              {formData.accountType === "agency" && (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 pt-2">
                  <div>
                    <label className={labelCls}>ชื่อที่แสดง</label>
                    <input
                      type="text"
                      value={formData.displayName || ""}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder="เช่น Kantapon Hemmadhun"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>ชื่อหน่วยงาน</label>
                    <input
                      type="text"
                      value={(formData as any).agencyName || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, agencyName: e.target.value } as any)
                      }
                      placeholder="เช่น กรมพัฒนาธุรกิจการค้า"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>ประเภทหน่วยงาน</label>
                    <input
                      type="text"
                      value={(formData as any).agencyType || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, agencyType: e.target.value } as any)
                      }
                      placeholder="เช่น สำนัก / สำนักงานเขต / รัฐวิสาหกิจ"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>อีเมลติดต่อ</label>
                    <input
                      type="email"
                      value={formData.contactEmail || ""}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>เบอร์โทรศัพท์</label>
                    <input
                      type="tel"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>เว็บไซต์</label>
                    <input
                      type="url"
                      value={formData.website || ""}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="เช่น https://agency.go.th"
                      className={inputCls}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>ที่อยู่หน่วยงาน</label>
                    <textarea
                      rows={2}
                      value={formData.address || ""}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>เกี่ยวกับหน่วยงาน</label>
                    <textarea
                      rows={3}
                      value={formData.about || ""}
                      onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                      placeholder="แนะนำหน่วยงานสั้น ๆ ภารกิจ หรือขอบเขตงาน"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Form Footer */}
              <div className="flex flex-col sm:flex-row items-center gap-4 border-t border-[#f0e8dc] pt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-[#4a7c59] px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#3b6647] disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                </button>
                <span className="text-xs text-[#998f80]">
                  ข้อมูลส่วนบุคคลของคุณเป็นความลับ ผู้ใช้อื่นมองไม่เห็น
                </span>
              </div>
            </form>
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
                    ? categoryNameByKey.get(tor.category) ?? tor.category
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
      </main>
    </div>
  );
}