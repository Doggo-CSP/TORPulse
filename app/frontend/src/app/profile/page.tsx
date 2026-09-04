"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { SiteNav } from "@/app/components/site_nav";
import { useUserProfile, type UserProfileData } from "@/hooks/use-user-profile";
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

interface CategoryOption {
  id: string;
  title: string;
  description: string;
  icon: any;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: "web",
    title: "Web Application",
    description: "ระบบเว็บแอปพลิเคชันและพอร์ทัลบริการประชาชน",
    icon: GlobeAltIcon,
  },
  {
    id: "data",
    title: "Data / BI",
    description: "ระบบข้อมูล วิเคราะห์ และแดชบอร์ดผู้บริหาร",
    icon: ChartBarIcon,
  },
  {
    id: "mobile",
    title: "Mobile App",
    description: "แอปพลิเคชันบนมือถือ iOS และ Android",
    icon: DevicePhoneMobileIcon,
  },
  {
    id: "enterprise",
    title: "Enterprise System",
    description: "ระบบสารสนเทศองค์กรและงานหลังบ้าน",
    icon: BuildingOfficeIcon,
  },
  {
    id: "consulting",
    title: "Consulting / Architecture",
    description: "งานที่ปรึกษาและออกแบบสถาปัตยกรรมระบบ",
    icon: AcademicCapIcon,
  },
  {
    id: "cybersecurity",
    title: "Cybersecurity",
    description: "ความมั่นคงปลอดภัยไซเบอร์และการตรวจสอบระบบ",
    icon: ShieldCheckIcon,
  },
  {
    id: "ai",
    title: "AI & Machine Learning",
    description: "ปัญญาประดิษฐ์ การวิเคราะห์ขั้นสูงและระบบอัตโนมัติ",
    icon: SparklesIcon,
  },
  {
    id: "cloud",
    title: "Cloud & Infrastructure",
    description: "โครงสร้างพื้นฐาน คลาวด์ และระบบเครือข่าย",
    icon: ServerStackIcon,
  },
];

type TabType = "profile" | "interests" | "bookmarks" | "recommended";

export default function ProfilePage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const {
    profile,
    loading,
    saving,
    message,
    bookmarkedTors,
    recommendedTors,
    updateProfile,
    updateInterests,
    toggleBookmark,
  } = useUserProfile();

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

  const selectedInterests = profile?.interests || [];

  // Calculate live completion percentage starting at 0% for blank profiles
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
      Boolean(selectedInterests.length > 0),
    ];

    const completed = fields.filter(Boolean).length;
    return Math.round((completed / fields.length) * 100);
  })();

  const handleInterestToggle = (catId: string) => {
    let nextInterests: string[];
    if (selectedInterests.includes(catId)) {
      nextInterests = selectedInterests.filter((id) => id !== catId);
    } else {
      nextInterests = [...selectedInterests, catId];
    }
    void updateInterests(nextInterests);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void updateProfile(formData);
  };

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
            <button
              onClick={() => setActiveTab("profile")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                activeTab === "profile"
                  ? "bg-[#4a7c59] text-white shadow-sm"
                  : "bg-[#f5f0e8] text-[#5c5446] hover:bg-[#e8e0d0]"
              }`}
            >
              โปรไฟล์
            </button>

            <button
              onClick={() => setActiveTab("interests")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                activeTab === "interests"
                  ? "bg-[#4a7c59] text-white shadow-sm"
                  : "bg-[#f5f0e8] text-[#5c5446] hover:bg-[#e8e0d0]"
              }`}
            >
              ความสนใจ
            </button>

            <button
              onClick={() => setActiveTab("bookmarks")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                activeTab === "bookmarks"
                  ? "bg-[#4a7c59] text-white shadow-sm"
                  : "bg-[#f5f0e8] text-[#5c5446] hover:bg-[#e8e0d0]"
              }`}
            >
              TOR ที่บันทึกไว้ ({profile?.bookmarkedTorIds?.length || 0})
            </button>

            <button
              onClick={() => setActiveTab("recommended")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                activeTab === "recommended"
                  ? "bg-[#4a7c59] text-white shadow-sm"
                  : "bg-[#f5f0e8] text-[#5c5446] hover:bg-[#e8e0d0]"
              }`}
            >
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
            <h2 className="text-lg font-bold text-[#2d2d2d]">
              ประเภทบัญชี
            </h2>

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
                    setFormData({
                      ...formData,
                      accountType: type.id as any,
                    })
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

              {/* Avatar */}
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

                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <CameraIcon className="size-6 text-white" />
                </div>
              </button>

              {/* Upload controls */}
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
                    onClick={() =>
                      setFormData({
                        ...formData,
                        image: "",
                      })
                    }
                    className="ml-2 text-xs font-medium text-red-500 hover:underline"
                  >
                    ลบรูป
                  </button>
                )}

                <p className="mt-1.5 text-xs text-[#998f80]">
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

              {/* Form Grid */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[#5c5446] mb-1.5">
                    ชื่อที่แสดง
                  </label>
                  <input
                    type="text"
                    value={formData.displayName || ""}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="Kantapon Hemmadhun"
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5c5446] mb-1.5">
                    ชื่อผู้ใช้งาน
                  </label>
                  <input
                    type="text"
                    value={formData.firstName || ""}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5c5446] mb-1.5">
                    นามสกุล
                  </label>
                  <input
                    type="text"
                    value={formData.lastName || ""}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5c5446] mb-1.5">
                    ตำแหน่งงาน
                  </label>
                  <input
                    type="text"
                    value={formData.jobTitle || ""}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5c5446] mb-1.5">
                    อีเมล
                  </label>
                  <input
                    type="email"
                    value={formData.contactEmail || ""}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5c5446] mb-1.5">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-[#5c5446] mb-1.5">
                    ที่อยู่
                  </label>
                  <textarea
                    rows={3}
                    value={formData.address || ""}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-[#5c5446] mb-1.5">
                    เกี่ยวกับคุณ
                  </label>
                  <textarea
                    rows={3}
                    value={formData.about || ""}
                    onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                  />
                </div>
              </div>

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

        {/* ── TAB 2: Interests Grid (Matching Screenshot 2) ── */}
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
              {CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isSelected = selectedInterests.includes(cat.id);

                return (
                  <div
                    key={cat.id}
                    onClick={() => handleInterestToggle(cat.id)}
                    className={`group relative flex cursor-pointer flex-col justify-between rounded-3xl p-5 transition-all border ${
                      isSelected
                        ? "border-[#4a7c59] bg-[#f7f9f7] shadow-sm ring-1 ring-[#4a7c59]"
                        : "border-[#e8e0d0] bg-white hover:border-[#4a7c59]/50 hover:bg-[#faf7f2]"
                    }`}
                  >
                    {/* Top Row: Icon & Radio Check */}
                    <div className="mb-4 flex items-center justify-between">
                      <div
                        className={`grid h-12 w-12 place-items-center rounded-2xl transition-colors ${
                          isSelected ? "bg-[#e2ede4] text-[#4a7c59]" : "bg-[#f5f0e8] text-[#7a8b6f]"
                        }`}
                      >
                        <IconComponent className="size-6" />
                      </div>

                      {/* Selection Radio Circle */}
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

                    {/* Content */}
                    <div>
                      <h3 className="text-base font-bold text-[#2d2d2d] group-hover:text-[#4a7c59]">
                        {cat.title}
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-[#2d2d2d]">TOR ที่แนะนำสำหรับคุณ</h2>
                <p className="mt-1 text-sm text-[#7a8b6f]">
                  คัดสรรตามความสนใจของคุณ:{" "}
                  {selectedInterests.length > 0
                    ? selectedInterests.join(", ")
                    : "กรุณาเลือกหมวดหมู่ความสนใจในแท็บ 'ความสนใจ'"}
                </p>
              </div>
            </div>

            {recommendedTors.length === 0 ? (
              <div className="my-8 rounded-2xl border border-dashed border-[#ddd5c8] bg-[#faf7f2] p-12 text-center">
                <SparklesIcon className="mx-auto mb-3 size-10 text-[#b0a898]" />
                <h3 className="text-base font-semibold text-[#2d2d2d]">ไม่พบรายการ TOR แนะนำ</h3>
                <p className="mt-1 text-xs text-[#7a8b6f]">
                  ลองเลือกหมวดหมู่ที่คุณสนใจเพิ่มเติมในแท็บ 'ความสนใจ' เพื่อเพิ่มโอกาสการจับคู่
                </p>
                <button
                  onClick={() => setActiveTab("interests")}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#4a7c59] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#3b6647]"
                >
                  เลือกความสนใจตอนนี้
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {recommendedTors.map((tor) => {
                  const isBookmarked = profile?.bookmarkedTorIds?.includes(tor._id);

                  return (
                    <div
                      key={tor._id}
                      className="flex flex-col justify-between rounded-2xl border border-[#e8e0d0] bg-white p-5 shadow-sm hover:border-[#4a7c59]"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-bold text-[#2d2d2d] line-clamp-2">
                            {tor.projectTitle}
                          </h3>
                          <button
                            onClick={() => void toggleBookmark(tor._id)}
                            className="text-[#4a7c59] hover:opacity-75"
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
