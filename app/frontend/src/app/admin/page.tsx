"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { SiteNav } from "@/app/components/site_nav";
import {
  AdminUserItem,
  ActivityItem,
  AdminStats,
  UserRole,
  UserStatus,
  fetchAdminStats,
  fetchAdminUsers,
  fetchAdminActivities,
  updateUserRoleApi,
  updateUserStatusApi,
  INITIAL_ADMIN_STATS,
  INITIAL_ACTIVITIES,
  INITIAL_USERS,
} from "@/api/admin.api";
import {
  Squares2X2Icon,
  DocumentTextIcon,
  UserGroupIcon,
  ClockIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  ExclamationCircleIcon,
  PencilSquareIcon,
  ChevronDownIcon,
  XMarkIcon,
  CheckIcon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

type AdminMenuTab =
  | "overview"
  | "tor_management"
  | "user_roles"
  | "activity_feed"
  | "settings";

const ROLE_CONFIG: Record<
  UserRole,
  { label: string; badgeBg: string; badgeText: string; desc: string }
> = {
  admin: {
    label: "ผู้ดูแลระบบ",
    badgeBg: "bg-emerald-50 border-emerald-200",
    badgeText: "text-emerald-800",
    desc: "สิทธิ์สูงสุด จัดการระบบ ผู้ใช้งาน และตั้งค่าแพลตฟอร์มทั้งหมด",
  },
  editor: {
    label: "บรรณาธิการ",
    badgeBg: "bg-blue-50 border-blue-200",
    badgeText: "text-blue-800",
    desc: "จัดการประกาศ TOR ตรวจสอบข้อมูลราคากลาง และออกรายงาน",
  },
  user: {
    label: "ผู้ใช้งานทั่วไป",
    badgeBg: "bg-stone-100 border-stone-200",
    badgeText: "text-stone-700",
    desc: "ค้นหาข้อมูล TOR บันทึกรายการโปรด และรับแจ้งเตือนโครงการ",
  },
};

const STATUS_CONFIG: Record<
  UserStatus,
  { label: string; badgeBg: string; badgeText: string; dot: string }
> = {
  active: {
    label: "ใช้งานอยู่",
    badgeBg: "bg-green-50 text-green-700 border-green-200",
    badgeText: "text-green-700",
    dot: "bg-green-500",
  },
  pending: {
    label: "รอการอนุมัติ",
    badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
    badgeText: "text-amber-700",
    dot: "bg-amber-500 animate-pulse",
  },
  suspended: {
    label: "ระงับการใช้งาน",
    badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
    badgeText: "text-rose-700",
    dot: "bg-rose-500",
  },
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminMenuTab>("overview");
  const [stats, setStats] = useState<AdminStats>(INITIAL_ADMIN_STATS);
  const [users, setUsers] = useState<AdminUserItem[]>(INITIAL_USERS);
  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);
  const [loading, setLoading] = useState(false);

  // Search and filter states for user role management
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Activity filter state
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");

  // Modal / Toast states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<AdminUserItem | null>(null);
  const [tempRole, setTempRole] = useState<UserRole>("user");

  // Load initial data
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [statsData, usersData, actData] = await Promise.all([
          fetchAdminStats(),
          fetchAdminUsers(),
          fetchAdminActivities(),
        ]);
        if (isMounted) {
          setStats(statsData);
          setUsers(usersData);
          setActivities(actData);
        }
      } catch (err) {
        console.error("Error loading admin data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    void loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Handle direct role update
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const targetUser = users.find((u) => u._id === userId);
    if (!targetUser) return;

    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
    );

    const res = await updateUserRoleApi(userId, newRole);

    // Add activity entry
    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      title: `เปลี่ยนบทบาทของ ${targetUser.displayName} เป็น ${ROLE_CONFIG[newRole].label}`,
      description: `ปรับเปลี่ยนสิทธิ์การเข้าถึงระบบโดยผู้ดูแลระบบ`,
      type: "user_role",
      actor: "ผู้ดูแลระบบ",
      target: targetUser.displayName,
      createdAt: new Date().toISOString(),
    };
    setActivities((prev) => [newActivity, ...prev]);

    showToast(res.message);
  };

  // Handle user status toggle
  const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
    const targetUser = users.find((u) => u._id === userId);
    if (!targetUser) return;

    setUsers((prev) =>
      prev.map((u) => (u._id === userId ? { ...u, status: newStatus } : u))
    );

    const res = await updateUserStatusApi(userId, newStatus);

    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      title: `ปรับสถานะของ ${targetUser.displayName} เป็น ${STATUS_CONFIG[newStatus].label}`,
      description: `อัปเดตสถานะบัญชีผู้ใช้งาน`,
      type: "user_role",
      actor: "ผู้ดูแลระบบ",
      target: targetUser.displayName,
      createdAt: new Date().toISOString(),
    };
    setActivities((prev) => [newActivity, ...prev]);

    showToast(res.message);
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus = statusFilter === "all" || u.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.agencyName && u.agencyName.toLowerCase().includes(q)) ||
        (u.companyName && u.companyName.toLowerCase().includes(q));

      return matchRole && matchStatus && matchSearch;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  // Filtered activities
  const filteredActivities = useMemo(() => {
    if (activityTypeFilter === "all") return activities;
    return activities.filter((a) => a.type === activityTypeFilter);
  }, [activities, activityTypeFilter]);

  // Sidebar Menu Items
  const menuItems = [
    {
      id: "overview" as AdminMenuTab,
      label: "ภาพรวม",
      icon: Squares2X2Icon,
    },
    {
      id: "tor_management" as AdminMenuTab,
      label: "จัดการประกาศ TOR",
      icon: DocumentTextIcon,
    },
    {
      id: "user_roles" as AdminMenuTab,
      label: "จัดการสิทธิ์ผู้ใช้งาน",
      icon: UserGroupIcon,
      badge: `${users.length}`,
    },
    {
      id: "activity_feed" as AdminMenuTab,
      label: "ฟีดกิจกรรม",
      icon: ClockIcon,
    },
    {
      id: "settings" as AdminMenuTab,
      label: "ตั้งค่าระบบ",
      icon: Cog6ToothIcon,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7f4ed] text-[#2d2d2d]">
      <SiteNav />

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-[#2d3a2e] px-5 py-3.5 text-white shadow-xl animate-fade-in transition-all">
          <CheckCircleIcon className="size-5 text-[#86efac]" />
          <span className="text-sm font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-zinc-400 hover:text-white"
          >
            <XMarkIcon className="size-4" />
          </button>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* ────────────────── LEFT SIDEBAR ────────────────── */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="rounded-3xl border border-[#e8e0d0] bg-white p-4 shadow-sm">
              <div className="px-3 py-2 text-xs font-semibold tracking-wider text-[#998f80]">
                เมนูผู้ดูแลระบบ
              </div>

              <nav className="mt-2 space-y-1">
                {menuItems.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-sm font-medium transition-all ${
                        isActive
                          ? "bg-[#eaf1ec] text-[#4a7c59] font-semibold"
                          : "text-[#5c5446] hover:bg-[#f5f0e8] hover:text-[#2d2d2d]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`size-4.5 ${
                            isActive ? "text-[#4a7c59]" : "text-[#8a8070]"
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isActive
                              ? "bg-[#4a7c59] text-white"
                              : "bg-[#e8e0d0] text-[#5c5446]"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Quick Admin Profile Card at bottom of sidebar */}
              <div className="mt-6 border-t border-[#f0e8dc] pt-4">
                <div className="flex items-center gap-3 px-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[#4a7c59] text-sm font-bold text-white shadow-sm">
                    TR
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[#2d2d2d]">
                      ผู้ดูแลระบบ (Admin)
                    </p>
                    <p className="truncate text-[11px] text-[#7a8b6f]">
                      TORPulse Central Control
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* ────────────────── MAIN CONTENT AREA ────────────────── */}
          <section className="flex-1 min-w-0">
            {/* VIEW 1: OVERVIEW (ภาพรวม) */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Header */}
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#2d2d2d] md:text-3xl">
                    แดชบอร์ดผู้ดูแลระบบ
                  </h1>
                  <p className="mt-1 text-sm text-[#7a8b6f]">
                    จัดการประกาศ TOR แหล่งข้อมูล และผู้ใช้งานของแพลตฟอร์มได้จากที่เดียว
                  </p>
                </div>

                {/* 4 Stats Cards (Styled exactly as in the user screenshot) */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {/* Card 1: TOR ทั้งหมด */}
                  <div className="rounded-3xl border border-[#e8e0d0] bg-white p-5 shadow-sm transition hover:shadow-md">
                    <div className="text-3xl font-extrabold text-[#4a7c59]">
                      {stats.total_tors.toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#7a8b6f]">
                      TOR ทั้งหมด
                    </div>
                  </div>

                  {/* Card 2: ประกาศใหม่สัปดาห์นี้ */}
                  <div className="rounded-3xl border border-[#e8e0d0] bg-white p-5 shadow-sm transition hover:shadow-md">
                    <div className="text-3xl font-extrabold text-[#4a7c59]">
                      {stats.new_this_week.toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#7a8b6f]">
                      ประกาศใหม่สัปดาห์นี้
                    </div>
                  </div>

                  {/* Card 3: ผู้ใช้งานที่ใช้งานอยู่ */}
                  <div
                    onClick={() => setActiveTab("user_roles")}
                    className="cursor-pointer rounded-3xl border border-[#e8e0d0] bg-white p-5 shadow-sm transition hover:border-[#4a7c59]/50 hover:shadow-md"
                  >
                    <div className="text-3xl font-extrabold text-[#4a7c59]">
                      {stats.active_users.toLocaleString()}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs font-medium text-[#7a8b6f]">
                      <span>ผู้ใช้งานที่ใช้งานอยู่</span>
                      <span className="text-[11px] text-[#4a7c59] underline">
                        จัดการสิทธิ์
                      </span>
                    </div>
                  </div>

                  {/* Card 4: โครงการที่ประกาศผลแล้ว */}
                  <div className="rounded-3xl border border-[#e8e0d0] bg-white p-5 shadow-sm transition hover:shadow-md">
                    <div className="text-3xl font-extrabold text-[#4a7c59]">
                      {stats.awarded_projects.toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#7a8b6f]">
                      โครงการที่ประกาศผลแล้ว
                    </div>
                  </div>
                </div>

                {/* Recent Activities Card (กิจกรรมล่าสุด) - exactly matching screenshot */}
                <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-bold text-[#2d2d2d]">
                      กิจกรรมล่าสุด
                    </h2>
                    <button
                      onClick={() => setActiveTab("activity_feed")}
                      className="text-xs font-semibold text-[#4a7c59] hover:underline"
                    >
                      ดูฟีดทั้งหมด ({activities.length}) →
                    </button>
                  </div>

                  <div className="divide-y divide-[#f0e8dc]">
                    {activities.slice(0, 5).map((act, index) => (
                      <div
                        key={act.id || act._id || index}
                        className="flex items-center justify-between py-3.5 first:pt-1 last:pb-1"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`size-2 shrink-0 rounded-full ${
                              act.type === "ingestion"
                                ? "bg-emerald-500"
                                : act.type === "user_role"
                                ? "bg-blue-500"
                                : act.type === "tor_update"
                                ? "bg-amber-500"
                                : "bg-stone-400"
                            }`}
                          />
                          <div>
                            <p className="text-sm font-medium text-[#2d2d2d]">
                              {act.title}
                            </p>
                            {act.description && (
                              <p className="text-xs text-[#8a8070]">
                                {act.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-[#998f80]">
                          วันนี้
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Access to User Role Management Preview */}
                <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-[#2d2d2d]">
                        จัดการสิทธิ์และบทบาทผู้ใช้งาน (User Role Management)
                      </h2>
                      <p className="text-xs text-[#7a8b6f]">
                        ควบคุมสิทธิ์ของผู้ใช้งานในระบบ ตรวจสอบบทบาท และปรับสถานะบัญชี
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("user_roles")}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#4a7c59] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#3b6647] transition"
                    >
                      <UserGroupIcon className="size-4" />
                      เปิดระบบจัดการสิทธิ์ผู้ใช้งาน
                    </button>
                  </div>

                  {/* Summary of Roles */}
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 text-center">
                      <p className="text-xs font-medium text-emerald-800">
                        ผู้ดูแลระบบ (Admin)
                      </p>
                      <p className="mt-1 text-xl font-bold text-emerald-900">
                        {users.filter((u) => u.role === "admin").length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3 text-center">
                      <p className="text-xs font-medium text-blue-800">
                        บรรณาธิการ (Editor)
                      </p>
                      <p className="mt-1 text-xl font-bold text-blue-900">
                        {users.filter((u) => u.role === "editor").length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-3 text-center">
                      <p className="text-xs font-medium text-stone-700">
                        ผู้ใช้งานทั่วไป (User)
                      </p>
                      <p className="mt-1 text-xl font-bold text-stone-800">
                        {users.filter((u) => u.role === "user").length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-3 text-center">
                      <p className="text-xs font-medium text-amber-800">
                        รอการอนุมัติ (Pending)
                      </p>
                      <p className="mt-1 text-xl font-bold text-amber-900">
                        {users.filter((u) => u.status === "pending").length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: USER ROLE MANAGEMENT (จัดการสิทธิ์ผู้ใช้งาน) */}
            {activeTab === "user_roles" && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#2d2d2d] md:text-3xl">
                      การจัดการสิทธิ์และบทบาทผู้ใช้งาน
                    </h1>
                    <p className="text-sm text-[#7a8b6f]">
                      กำหนดบทบาท สิทธิ์การเข้าถึง และสถานะการใช้งานของผู้ใช้งานในระบบ
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#eaf1ec] px-3 py-1 text-xs font-semibold text-[#4a7c59]">
                      ผู้ใช้งานทั้งหมด: {users.length} ราย
                    </span>
                  </div>
                </div>

                {/* Role Privilege Explainer Cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                        Admin
                      </span>
                      <span className="text-xs font-semibold text-emerald-700">
                        {users.filter((u) => u.role === "admin").length} บัญชี
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-[#2d2d2d]">
                      ผู้ดูแลระบบ
                    </h3>
                    <p className="mt-1 text-xs text-[#7a8b6f]">
                      เข้าถึงทุกฟังก์ชัน จัดการสิทธิ์ผู้ใช้งาน ดูแลระบบ และวิเคราะห์ข้อมูลระดับองค์กร
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                        Editor
                      </span>
                      <span className="text-xs font-semibold text-blue-700">
                        {users.filter((u) => u.role === "editor").length} บัญชี
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-[#2d2d2d]">
                      บรรณาธิการ
                    </h3>
                    <p className="mt-1 text-xs text-[#7a8b6f]">
                      จัดการประกาศ TOR ตรวจสอบข้อมูลราคากลาง จัดหมวดหมู่ และนำเข้าข้อมูล e-GP
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-700">
                        User
                      </span>
                      <span className="text-xs font-semibold text-stone-600">
                        {users.filter((u) => u.role === "user").length} บัญชี
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-[#2d2d2d]">
                      ผู้ใช้งานทั่วไป
                    </h3>
                    <p className="mt-1 text-xs text-[#7a8b6f]">
                      ค้นหาประกาศ TOR บันทึกโครงการโปรด และตั้งค่าหมวดหมู่ความสนใจ
                    </p>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="rounded-3xl border border-[#e8e0d0] bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-[#8a8070]" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาตามชื่อ, อีเมล, หน่วยงาน หรือบริษัท..."
                        className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] py-2 pl-10 pr-4 text-sm text-[#2d2d2d] placeholder-[#998f80] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Role Filter */}
                    <div className="flex items-center gap-2">
                      <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-3.5 py-2 text-sm text-[#5c5446] focus:border-[#4a7c59] focus:outline-none"
                      >
                        <option value="all">ทุกบทบาท (All Roles)</option>
                        <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                        <option value="editor">บรรณาธิการ (Editor)</option>
                        <option value="user">ผู้ใช้งานทั่วไป (User)</option>
                      </select>

                      {/* Status Filter */}
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-3.5 py-2 text-sm text-[#5c5446] focus:border-[#4a7c59] focus:outline-none"
                      >
                        <option value="all">ทุกสถานะ (All Statuses)</option>
                        <option value="active">ใช้งานอยู่ (Active)</option>
                        <option value="pending">รอการอนุมัติ (Pending)</option>
                        <option value="suspended">ระงับการใช้งาน (Suspended)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Users Table */}
                <div className="overflow-hidden rounded-3xl border border-[#e8e0d0] bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#f0e8dc] bg-[#faf7f2] text-xs font-semibold text-[#7a8b6f]">
                          <th className="px-5 py-3.5">ผู้ใช้งาน</th>
                          <th className="px-5 py-3.5">สังกัด / องค์กร</th>
                          <th className="px-5 py-3.5">ประเภทบัญชี</th>
                          <th className="px-5 py-3.5">บทบาท (Role)</th>
                          <th className="px-5 py-3.5">สถานะ</th>
                          <th className="px-5 py-3.5 text-right">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0e8dc]">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-sm text-[#8a8070]">
                              ไม่พบข้อมูลผู้ใช้งานที่ตรงกับเงื่อนไขค้นหา
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((user) => {
                            const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.user;
                            const statusConfig =
                              STATUS_CONFIG[user.status] || STATUS_CONFIG.active;
                            const initials = (user.displayName || user.name || "U")
                              .slice(0, 2)
                              .toUpperCase();

                            return (
                              <tr
                                key={user._id}
                                className="transition hover:bg-[#faf7f2]/60"
                              >
                                {/* User Column */}
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="relative">
                                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#eaf1ec] font-bold text-[#4a7c59]">
                                        {initials}
                                      </div>
                                      <span
                                        className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white ${statusConfig.dot}`}
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="truncate font-semibold text-[#2d2d2d]">
                                        {user.displayName || user.name}
                                      </div>
                                      <div className="truncate text-xs text-[#8a8070]">
                                        {user.email}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Agency / Company Column */}
                                <td className="px-5 py-4 text-xs text-[#5c5446]">
                                  <div className="font-medium">
                                    {user.agencyName || user.companyName || "-"}
                                  </div>
                                  {user.jobTitle && (
                                    <div className="text-[11px] text-[#998f80]">
                                      {user.jobTitle}
                                    </div>
                                  )}
                                </td>

                                {/* Account Type Column */}
                                <td className="px-5 py-4">
                                  <span className="rounded-full bg-[#f5f0e8] px-2.5 py-1 text-xs font-medium text-[#5c5446]">
                                    {user.accountType === "company"
                                      ? "นิติบุคคล/บริษัท"
                                      : user.accountType === "agency"
                                      ? "หน่วยงานรัฐ"
                                      : "บุคคลธรรมดา"}
                                  </span>
                                </td>

                                {/* Role Selector Dropdown Column */}
                                <td className="px-5 py-4">
                                  <div className="relative inline-block text-left">
                                    <select
                                      value={user.role}
                                      onChange={(e) =>
                                        void handleRoleChange(
                                          user._id,
                                          e.target.value as UserRole
                                        )
                                      }
                                      className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-[#4a7c59] ${roleConfig.badgeBg} ${roleConfig.badgeText}`}
                                    >
                                      <option value="admin">
                                        ผู้ดูแลระบบ (Admin)
                                      </option>
                                      <option value="editor">
                                        บรรณาธิการ (Editor)
                                      </option>
                                      <option value="user">
                                        ผู้ใช้งานทั่วไป (User)
                                      </option>
                                    </select>
                                  </div>
                                </td>

                                {/* Status Column */}
                                <td className="px-5 py-4">
                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusConfig.badgeBg}`}
                                  >
                                    <span
                                      className={`size-1.5 rounded-full ${statusConfig.dot}`}
                                    />
                                    {statusConfig.label}
                                  </span>
                                </td>

                                {/* Actions Column */}
                                <td className="px-5 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {user.status === "pending" && (
                                      <button
                                        onClick={() =>
                                          void handleStatusChange(user._id, "active")
                                        }
                                        title="อนุมัติบัญชี"
                                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                                      >
                                        อนุมัติ
                                      </button>
                                    )}

                                    <button
                                      onClick={() => {
                                        setSelectedUserForEdit(user);
                                        setTempRole(user.role);
                                      }}
                                      className="rounded-lg border border-[#e8e0d0] p-1.5 text-[#7a8b6f] hover:bg-[#faf7f2] hover:text-[#2d2d2d]"
                                      title="ปรับแต่งสิทธิ์แบบละเอียด"
                                    >
                                      <PencilSquareIcon className="size-4" />
                                    </button>

                                    {user.status !== "suspended" ? (
                                      <button
                                        onClick={() =>
                                          void handleStatusChange(
                                            user._id,
                                            "suspended"
                                          )
                                        }
                                        className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                                        title="ระงับบัญชี"
                                      >
                                        <XMarkIcon className="size-4" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() =>
                                          void handleStatusChange(user._id, "active")
                                        }
                                        className="rounded-lg border border-green-200 p-1.5 text-green-600 hover:bg-green-50"
                                        title="เปิดใช้งานอีกครั้ง"
                                      >
                                        <CheckIcon className="size-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 3: ACTIVITY FEED (ฟีดกิจกรรม) */}
            {activeTab === "activity_feed" && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#2d2d2d] md:text-3xl">
                      ฟีดกิจกรรมและการทำงานของระบบ
                    </h1>
                    <p className="text-sm text-[#7a8b6f]">
                      ประวัติการดำเนินงานของผู้ดูแลระบบ การเชื่อมโยง e-GP และการเปลี่ยนแปลงสิทธิ์
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      showToast("รีเฟรชข้อมูลกิจกรรมเรียบร้อยแล้ว");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#e8e0d0] bg-white px-3.5 py-2 text-xs font-semibold text-[#5c5446] shadow-xs hover:bg-[#faf7f2]"
                  >
                    <ArrowPathIcon className="size-4" />
                    รีเฟรชฟีด
                  </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap items-center gap-2 border-b border-[#e8e0d0] pb-3">
                  {[
                    { id: "all", label: "กิจกรรมทั้งหมด" },
                    { id: "user_role", label: "การจัดการสิทธิ์และผู้ใช้" },
                    { id: "ingestion", label: "การดึงข้อมูล e-GP" },
                    { id: "tor_update", label: "การปรับปรุงประกาศ TOR" },
                    { id: "system", label: "ระบบและการสำรองข้อมูล" },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setActivityTypeFilter(filter.id)}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                        activityTypeFilter === filter.id
                          ? "bg-[#4a7c59] text-white shadow-xs"
                          : "bg-white text-[#5c5446] border border-[#e8e0d0] hover:bg-[#faf7f2]"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {/* Activity List Timeline */}
                <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-sm">
                  <div className="space-y-6">
                    {filteredActivities.map((act, index) => {
                      const typeConfig = {
                        ingestion: {
                          label: "e-GP Data",
                          badge: "bg-emerald-100 text-emerald-800",
                          icon: DocumentTextIcon,
                        },
                        user_role: {
                          label: "User Role",
                          badge: "bg-blue-100 text-blue-800",
                          icon: UserGroupIcon,
                        },
                        tor_update: {
                          label: "TOR Update",
                          badge: "bg-amber-100 text-amber-800",
                          icon: SparklesIcon,
                        },
                        system: {
                          label: "System",
                          badge: "bg-stone-100 text-stone-800",
                          icon: Cog6ToothIcon,
                        },
                      }[act.type] || {
                        label: "System",
                        badge: "bg-stone-100 text-stone-800",
                        icon: Cog6ToothIcon,
                      };

                      const Icon = typeConfig.icon;

                      return (
                        <div
                          key={act.id || act._id || index}
                          className="relative flex items-start gap-4"
                        >
                          {index !== filteredActivities.length - 1 && (
                            <div className="absolute left-5 top-10 -bottom-6 w-0.5 bg-[#f0e8dc]" />
                          )}

                          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#faf7f2] border border-[#e8e0d0] shadow-xs">
                            <Icon className="size-5 text-[#4a7c59]" />
                          </div>

                          <div className="min-w-0 flex-1 rounded-2xl border border-[#f0e8dc] bg-[#faf7f2]/50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${typeConfig.badge}`}
                                >
                                  {typeConfig.label}
                                </span>
                                <h3 className="font-semibold text-sm text-[#2d2d2d]">
                                  {act.title}
                                </h3>
                              </div>
                              <span className="text-xs text-[#998f80]">
                                วันนี้
                              </span>
                            </div>

                            {act.description && (
                              <p className="mt-1 text-xs text-[#6e6456]">
                                {act.description}
                              </p>
                            )}

                            <div className="mt-3 flex items-center gap-4 text-[11px] text-[#998f80]">
                              <span>ผู้ดำเนินการ: <strong className="text-[#5c5446]">{act.actor}</strong></span>
                              {act.target && (
                                <span>เป้าหมาย: <strong className="text-[#5c5446]">{act.target}</strong></span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 4: MANAGE TOR (จัดการประกาศ TOR) */}
            {activeTab === "tor_management" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#2d2d2d] md:text-3xl">
                    จัดการประกาศจัดซื้อจัดจ้าง (TOR Management)
                  </h1>
                  <p className="text-sm text-[#7a8b6f]">
                    ตรวจสอบสถานะประกาศ TOR ที่ดึงจากระบบ e-GP และ GovSpending
                  </p>
                </div>

                <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-[#2d2d2d]">
                        การเชื่อมโยงระบบ e-GP ประจำวัน
                      </h2>
                      <p className="text-xs text-[#7a8b6f]">
                        สถานะการทำงานล่าสุด: ซิงก์เสร็จสมบูรณ์เมื่อ 20 นาทีที่ผ่านมา
                      </p>
                    </div>
                    <button
                      onClick={() => showToast("สั่งดึงข้อมูล e-GP รอบใหม่สำเร็จ")}
                      className="rounded-xl bg-[#4a7c59] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#3b6647]"
                    >
                      สั่งดึงข้อมูลทันที (Sync e-GP)
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[#e8e0d0] p-4 text-center">
                      <p className="text-xs text-[#8a8070]">โครงการทั้งหมดในระบบ</p>
                      <p className="mt-1 text-2xl font-bold text-[#4a7c59]">
                        {stats.total_tors.toLocaleString()} รายการ
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#e8e0d0] p-4 text-center">
                      <p className="text-xs text-[#8a8070]">ประกาศใหม่รอบสัปดาห์</p>
                      <p className="mt-1 text-2xl font-bold text-[#4a7c59]">
                        {stats.new_this_week.toLocaleString()} รายการ
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#e8e0d0] p-4 text-center">
                      <p className="text-xs text-[#8a8070]">โครงการประกาศผลแล้ว</p>
                      <p className="mt-1 text-2xl font-bold text-[#4a7c59]">
                        {stats.awarded_projects.toLocaleString()} รายการ
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* VIEW 7: SYSTEM SETTINGS (ตั้งค่าระบบ) */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#2d2d2d] md:text-3xl">
                    การตั้งค่าระบบ (System Settings)
                  </h1>
                  <p className="text-sm text-[#7a8b6f]">
                    กำหนดค่าคอนฟิกูเรชันของแพลตฟอร์มและการซิงก์ข้อมูล
                  </p>
                </div>

                <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-sm space-y-5">
                  <div className="flex items-center justify-between border-b border-[#f0e8dc] pb-4">
                    <div>
                      <p className="font-semibold text-sm text-[#2d2d2d]">
                        การดึงข้อมูลอัตโนมัติ (Automated Ingestion)
                      </p>
                      <p className="text-xs text-[#7a8b6f]">
                        ตั้งเวลารอบการดึงประกาศจัดซื้อจัดจ้างจาก GovSpending และ e-GP ทุก 10 นาที
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                      เปิดใช้งาน (Active)
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-[#f0e8dc] pb-4">
                    <div>
                      <p className="font-semibold text-sm text-[#2d2d2d]">
                        การอนุมัติผู้ใช้งานอัตโนมัติสำหรับอีเมลหน่วยงานรัฐ (.go.th)
                      </p>
                      <p className="text-xs text-[#7a8b6f]">
                        เปิดสิทธิ์เข้าใช้งานทันทีเมื่อยืนยันอีเมลทางการของรัฐ
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                      เปิดใช้งาน
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-[#2d2d2d]">
                        เวอร์ชันระบบแพลตฟอร์ม TORPulse
                      </p>
                      <p className="text-xs text-[#7a8b6f]">
                        TORPulse v2.4.0 (Enterprise Procurement Engine)
                      </p>
                    </div>
                    <span className="text-xs font-mono text-[#998f80]">
                      Node 22 / Bun 1.4 / Next.js 15
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Edit Role Modal */}
      {selectedUserForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#f0e8dc] pb-4">
              <h3 className="text-lg font-bold text-[#2d2d2d]">
                แก้ไขสิทธิ์และบทบาทผู้ใช้งาน
              </h3>
              <button
                onClick={() => setSelectedUserForEdit(null)}
                className="rounded-lg p-1 text-[#8a8070] hover:bg-[#faf7f2] hover:text-[#2d2d2d]"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-[#faf7f2] p-4">
                <p className="text-xs text-[#8a8070]">ผู้ใช้งานที่เลือก:</p>
                <p className="text-base font-bold text-[#2d2d2d]">
                  {selectedUserForEdit.displayName || selectedUserForEdit.name}
                </p>
                <p className="text-xs text-[#5c5446]">
                  {selectedUserForEdit.email}
                </p>
                <p className="mt-1 text-xs text-[#7a8b6f]">
                  {selectedUserForEdit.agencyName || selectedUserForEdit.companyName || "ผู้ใช้งานทั่วไป"}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#7a8b6f] mb-2">
                  เลือกบทบาทใหม่ (Select Role):
                </label>
                <div className="space-y-2">
                  {(["admin", "editor", "user"] as UserRole[]).map((r) => {
                    const cfg = ROLE_CONFIG[r];
                    const isSelected = tempRole === r;
                    return (
                      <label
                        key={r}
                        onClick={() => setTempRole(r)}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${
                          isSelected
                            ? "border-[#4a7c59] bg-[#eaf1ec]/60 ring-1 ring-[#4a7c59]"
                            : "border-[#e8e0d0] bg-white hover:bg-[#faf7f2]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="modal_role"
                          checked={isSelected}
                          onChange={() => setTempRole(r)}
                          className="mt-1 accent-[#4a7c59]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#2d2d2d]">
                              {cfg.label}
                            </span>
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                              {r.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-[#7a8b6f] mt-0.5">
                            {cfg.desc}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#f0e8dc] pt-4">
              <button
                onClick={() => setSelectedUserForEdit(null)}
                className="rounded-xl border border-[#e8e0d0] px-4 py-2 text-sm font-medium text-[#5c5446] hover:bg-[#faf7f2]"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  void handleRoleChange(selectedUserForEdit._id, tempRole);
                  setSelectedUserForEdit(null);
                }}
                className="rounded-xl bg-[#4a7c59] px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#3b6647]"
              >
                บันทึกการเปลี่ยนแปลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
