"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { SiteNav } from "@/app/components/site_nav";
import {
  AccountType,
  ActivityGroup,
  ActivityItem,
  AdminCategory,
  AdminSettings,
  AdminStats,
  AdminUserItem,
  AdminUserUpdateInput,
  UserRole,
  UserStatus,
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminActivity,
  fetchAdminCategories,
  fetchAdminSettings,
  fetchAdminStats,
  fetchAdminUsers,
  setAdminCategoryStatus,
  updateAdminCategory,
  updateAdminSettings,
  updateAdminUser,
  updateUserRole,
  updateUserStatus,
} from "@/api/admin.api";
import { useAuth } from "@/hooks/use-auth";
import {
  ACTIVITY_GROUP_CONFIG,
  activityActorName,
  describeActivity,
  formatRelativeTime,
} from "./activity-format";
import { IngestionSourcesCard } from "./ingestion-sources-card";
import { TorManagementPanel } from "./tor-management-panel";
import {
  Squares2X2Icon,
  DocumentTextIcon,
  UserGroupIcon,
  ClockIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  PencilSquareIcon,
  XMarkIcon,
  CheckIcon,
  TagIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

type AdminMenuTab =
  | "overview"
  | "tor_management"
  | "user_roles"
  | "activity_feed"
  | "categories"
  | "settings";

type ToastKind = "success" | "error";

const ACTIVITY_PAGE_SIZE = 20;

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
  suspended: {
    label: "ระงับการใช้งาน",
    badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
    badgeText: "text-rose-700",
    dot: "bg-rose-500",
  },
};

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  personal: "บุคคลธรรมดา",
  company: "นิติบุคคล/บริษัท",
  agency: "หน่วยงานรัฐ",
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

const formatCount = (value: number | undefined) =>
  value === undefined ? "—" : value.toLocaleString("th-TH");

export default function AdminPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const isAdmin = !!authUser && authUser.role === "admin";

  const [activeTab, setActiveTab] = useState<AdminMenuTab>("overview");

  // Toast
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dashboard numbers
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Users
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<AdminUserItem | null>(null);
  const [userForm, setUserForm] = useState({
    role: "user" as UserRole,
    name: "",
    jobTitle: "",
    agencyName: "",
    companyName: "",
    accountType: "personal" as AccountType,
  });
  const [userSaving, setUserSaving] = useState(false);

  // Activity: the latest few for the overview, and the paged feed tab
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [recentActivityError, setRecentActivityError] = useState<string | null>(null);
  const [activityGroup, setActivityGroup] = useState<ActivityGroup | "all">("all");
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityReloadKey, setActivityReloadKey] = useState(0);

  // Categories
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [categoryCounts, setCategoryCounts] = useState({ total: 0, activeCount: 0 });
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    aiHint: "",
    keywords: "",
  });
  const [categorySaving, setCategorySaving] = useState(false);
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<AdminCategory | null>(null);

  // Settings
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [senderEmailDraft, setSenderEmailDraft] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ───────── Loaders (each one owns its own error message) ─────────
  // State is set in the promise callbacks, after the request answers.
  const loadStats = useCallback(
    () =>
      fetchAdminStats().then(
        (data) => {
          setStats(data);
          setStatsError(null);
        },
        (error: unknown) => setStatsError(errorMessage(error))
      ),
    []
  );

  const loadUsers = useCallback(
    () =>
      fetchAdminUsers()
        .then(
          (data) => {
            setUsers(data);
            setUsersError(null);
          },
          (error: unknown) => setUsersError(errorMessage(error))
        )
        .finally(() => setUsersLoading(false)),
    []
  );

  const loadRecentActivity = useCallback(
    () =>
      fetchAdminActivity({ limit: 5 }).then(
        (page) => {
          setRecentActivity(page.items);
          setRecentActivityError(null);
        },
        (error: unknown) => setRecentActivityError(errorMessage(error))
      ),
    []
  );

  const loadCategories = useCallback(
    () =>
      fetchAdminCategories().then(
        (data) => {
          setCategories(data.categories);
          setCategoryCounts({ total: data.total, activeCount: data.activeCount });
          setCategoriesError(null);
        },
        (error: unknown) => setCategoriesError(errorMessage(error))
      ),
    []
  );

  const loadSettings = useCallback(
    () =>
      fetchAdminSettings().then(
        (data) => {
          setSettings(data);
          setSenderEmailDraft(data.senderEmail ?? "");
          setSettingsError(null);
        },
        (error: unknown) => setSettingsError(errorMessage(error))
      ),
    []
  );

  // After any change: refresh the numbers and every view of the audit log
  const refreshAfterChange = useCallback(() => {
    void loadStats();
    void loadRecentActivity();
    setActivityReloadKey((key) => key + 1);
  }, [loadStats, loadRecentActivity]);

  // Load everything once the admin is known
  useEffect(() => {
    if (authLoading || !isAdmin) return;
    void loadStats();
    void loadUsers();
    void loadRecentActivity();
    void loadCategories();
    void loadSettings();
  }, [authLoading, isAdmin, loadStats, loadUsers, loadRecentActivity, loadCategories, loadSettings]);

  // Activity feed: first page of the chosen group
  useEffect(() => {
    if (authLoading || !isAdmin) return;
    let cancelled = false;
    fetchAdminActivity({
      page: 1,
      limit: ACTIVITY_PAGE_SIZE,
      group: activityGroup === "all" ? undefined : activityGroup,
    })
      .then((page) => {
        if (cancelled) return;
        setActivityItems(page.items);
        setActivityTotal(page.total);
        setActivityPage(1);
        setActivityError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setActivityError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAdmin, activityGroup, activityReloadKey]);

  // Clear pending toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, kind });
    toastTimer.current = setTimeout(
      () => {
        setToast(null);
        toastTimer.current = null;
      },
      kind === "error" ? 6000 : 3500
    );
  }, []);

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

  // Filtered categories
  const filteredCategories = useMemo(() => {
    const q = categorySearch.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.key.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [categories, categorySearch]);

  // ───────── ALL HOOKS ARE ABOVE THIS LINE. Early returns are safe below. ─────────

  // Admin-only access guard
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf7f2]">
        <div className="text-center">
          <ArrowPathIcon className="mx-auto size-8 animate-spin text-[#4a7c59]" />
          <p className="mt-3 text-sm text-[#7a8b6f]">กำลังตรวจสอบสิทธิ์การเข้าถึง...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf7f2]">
        <div className="text-center">
          <ShieldCheckIcon className="mx-auto size-14 text-rose-400" />
          <h1 className="mt-4 text-xl font-bold text-[#2d2d2d]">ไม่มีสิทธิ์เข้าถึง</h1>
          <p className="mt-2 text-sm text-[#7a8b6f]">หน้านี้สำหรับผู้ดูแลระบบ (Admin) เท่านั้น</p>
          <a
            href="/homepage"
            className="mt-5 inline-block rounded-xl bg-[#4a7c59] px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#3b6647]"
          >
            กลับหน้าหลัก
          </a>
        </div>
      </div>
    );
  }

  // ───────── User handlers ─────────
  // Role and status change only after the backend accepts; it refuses changes to your own
  // account and to the last active admin, and the toast shows its reason.
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const targetUser = users.find((u) => u._id === userId);
    if (!targetUser || targetUser.role === newRole) return;

    setBusyUserId(userId);
    try {
      const message = await updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u)));
      showToast(message);
      refreshAfterChange();
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
    const targetUser = users.find((u) => u._id === userId);
    if (!targetUser || targetUser.status === newStatus) return;

    setBusyUserId(userId);
    try {
      const message = await updateUserStatus(userId, newStatus);
      setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, status: newStatus } : u)));
      showToast(message);
      refreshAfterChange();
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setBusyUserId(null);
    }
  };

  const openUserModal = (user: AdminUserItem) => {
    setSelectedUserForEdit(user);
    setUserForm({
      role: user.role,
      name: user.name ?? "",
      jobTitle: user.jobTitle ?? "",
      agencyName: user.agencyName ?? "",
      companyName: user.companyName ?? "",
      accountType: user.accountType,
    });
  };

  const handleSaveUser = async () => {
    const target = selectedUserForEdit;
    if (!target) return;

    const name = userForm.name.trim();
    if (!name) {
      showToast("กรุณากรอกชื่อผู้ใช้งาน", "error");
      return;
    }

    // Send only the fields that changed, so the audit log records the real edit
    const profileChanges: AdminUserUpdateInput = {};
    if (name !== target.name) profileChanges.name = name;
    for (const field of ["jobTitle", "agencyName", "companyName"] as const) {
      const next = userForm[field].trim();
      if (next !== (target[field] ?? "").trim()) profileChanges[field] = next;
    }
    if (userForm.accountType !== target.accountType) {
      profileChanges.accountType = userForm.accountType;
    }
    const roleChanged = userForm.role !== target.role;

    if (!roleChanged && Object.keys(profileChanges).length === 0) {
      setSelectedUserForEdit(null);
      return;
    }

    setUserSaving(true);
    try {
      const messages: string[] = [];
      if (Object.keys(profileChanges).length > 0) {
        messages.push(await updateAdminUser(target._id, profileChanges));
      }
      if (roleChanged) {
        messages.push(await updateUserRole(target._id, userForm.role));
      }
      showToast(messages.join(" · "));
      setSelectedUserForEdit(null);
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setUserSaving(false);
      // Some changes may have saved before an error, so always reload the list
      void loadUsers();
      refreshAfterChange();
    }
  };

  // ───────── Category handlers ─────────
  const openCategoryModal = (cat?: AdminCategory) => {
    setEditingCategory(cat ?? null);
    setCategoryForm({
      name: cat?.name ?? "",
      description: cat?.description ?? "",
      aiHint: cat?.aiHint ?? "",
      keywords: cat ? cat.keywords.join(", ") : "",
    });
    setCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
    setCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const handleSaveCategory = async () => {
    const name = categoryForm.name.trim();
    if (!name) {
      showToast("กรุณากรอกชื่อหมวดหมู่", "error");
      return;
    }

    // The backend also removes blanks and case-insensitive duplicates
    const keywords = categoryForm.keywords
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter(Boolean);
    const payload = {
      name,
      description: categoryForm.description.trim(),
      aiHint: categoryForm.aiHint.trim() || null,
      keywords,
    };

    setCategorySaving(true);
    try {
      const result = editingCategory
        ? await updateAdminCategory(editingCategory.id, payload)
        : await createAdminCategory(payload);
      showToast(result.message);
      closeCategoryModal();
      void loadCategories();
      refreshAfterChange();
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setCategorySaving(false);
    }
  };

  const handleToggleCategory = async (cat: AdminCategory) => {
    setBusyCategoryId(cat.id);
    try {
      const result = await setAdminCategoryStatus(cat.id, !cat.isActive);
      showToast(result.message);
      void loadCategories();
      refreshAfterChange();
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setBusyCategoryId(null);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const target = categoryToDelete;
    setBusyCategoryId(target.id);
    try {
      const result = await deleteAdminCategory(target.id);
      showToast(result.message);
      void loadCategories();
      refreshAfterChange();
    } catch (error) {
      // 409 explains who still uses the category and suggests hiding it instead
      showToast(errorMessage(error), "error");
    } finally {
      setBusyCategoryId(null);
      setCategoryToDelete(null);
    }
  };

  // ───────── Activity handlers ─────────
  const changeActivityGroup = (group: ActivityGroup | "all") => {
    if (group === activityGroup) return;
    setActivityLoading(true);
    setActivityGroup(group);
  };

  const reloadActivity = () => {
    setActivityLoading(true);
    setActivityReloadKey((key) => key + 1);
  };

  const loadMoreActivity = async () => {
    const nextPage = activityPage + 1;
    setActivityLoading(true);
    try {
      const page = await fetchAdminActivity({
        page: nextPage,
        limit: ACTIVITY_PAGE_SIZE,
        group: activityGroup === "all" ? undefined : activityGroup,
      });
      setActivityItems((prev) => [...prev, ...page.items]);
      setActivityTotal(page.total);
      setActivityPage(nextPage);
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setActivityLoading(false);
    }
  };

  // ───────── Settings handlers ─────────
  const saveSettings = async (input: { ingestionEnabled?: boolean; senderEmail?: string | null }) => {
    setSettingsSaving(true);
    try {
      const result = await updateAdminSettings(input);
      setSettings(result.settings);
      setSenderEmailDraft(result.settings.senderEmail ?? "");
      showToast(result.message);
      refreshAfterChange();
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setSettingsSaving(false);
    }
  };

  // Sidebar Menu Items
  const menuItems = [
    { id: "overview" as AdminMenuTab, label: "ภาพรวม", icon: Squares2X2Icon },
    { id: "tor_management" as AdminMenuTab, label: "จัดการประกาศ TOR", icon: DocumentTextIcon },
    {
      id: "user_roles" as AdminMenuTab,
      label: "จัดการสิทธิ์ผู้ใช้งาน",
      icon: UserGroupIcon,
      badge: usersLoading ? undefined : `${users.length}`,
    },
    { id: "activity_feed" as AdminMenuTab, label: "ฟีดกิจกรรม", icon: ClockIcon },
    { id: "categories" as AdminMenuTab, label: "หมวดหมู่ TOR", icon: TagIcon },
    { id: "settings" as AdminMenuTab, label: "ตั้งค่าระบบ", icon: Cog6ToothIcon },
  ];

  const adminInitials = (authUser.name || authUser.email || "A").slice(0, 2).toUpperCase();
  const hasMoreActivity = activityItems.length < activityTotal;

  return (
    <div className="min-h-screen bg-[#f7f4ed] text-[#2d2d2d]">
      <SiteNav />

      {/* Toast Alert */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[60] flex max-w-md items-start gap-3 rounded-2xl px-5 py-3.5 text-white shadow-xl animate-fade-in transition-all ${
            toast.kind === "error" ? "bg-rose-700" : "bg-[#2d3a2e]"
          }`}
        >
          {toast.kind === "error" ? (
            <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0 text-rose-200" />
          ) : (
            <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-[#86efac]" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 shrink-0 text-white/70 hover:text-white"
            aria-label="ปิดข้อความ"
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

              {/* Signed-in admin */}
              <div className="mt-6 border-t border-[#f0e8dc] pt-4">
                <div className="flex items-center gap-3 px-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[#4a7c59] text-sm font-bold text-white shadow-sm">
                    {adminInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[#2d2d2d]">{authUser.name}</p>
                    <p className="truncate text-[11px] text-[#7a8b6f]">{authUser.email}</p>
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

                {statsError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    โหลดตัวเลขสรุปไม่สำเร็จ: {statsError}
                  </div>
                )}

                {/* 4 Stats Cards */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-3xl border border-[#e8e0d0] bg-white p-5 shadow-sm transition hover:shadow-md">
                    <div className="text-3xl font-extrabold tabular-nums text-[#4a7c59]">
                      {formatCount(stats?.tors.total)}
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#7a8b6f]">TOR ทั้งหมด</div>
                  </div>

                  <div className="rounded-3xl border border-[#e8e0d0] bg-white p-5 shadow-sm transition hover:shadow-md">
                    <div className="text-3xl font-extrabold tabular-nums text-[#4a7c59]">
                      {formatCount(stats?.tors.newThisWeek)}
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#7a8b6f]">
                      TOR เข้าระบบสัปดาห์นี้
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveTab("user_roles")}
                    className="cursor-pointer rounded-3xl border border-[#e8e0d0] bg-white p-5 shadow-sm transition hover:border-[#4a7c59]/50 hover:shadow-md"
                  >
                    <div className="text-3xl font-extrabold tabular-nums text-[#4a7c59]">
                      {formatCount(stats?.users.byStatus.active)}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs font-medium text-[#7a8b6f]">
                      <span>ผู้ใช้งานที่ใช้งานอยู่</span>
                      <span className="text-[11px] text-[#4a7c59] underline">จัดการสิทธิ์</span>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[#e8e0d0] bg-white p-5 shadow-sm transition hover:shadow-md">
                    <div className="text-3xl font-extrabold tabular-nums text-[#4a7c59]">
                      {formatCount(stats?.tors.awarded)}
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#7a8b6f]">
                      โครงการที่ประกาศผลแล้ว
                    </div>
                  </div>
                </div>

                {/* Recent Activities Card (กิจกรรมล่าสุด) */}
                <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-bold text-[#2d2d2d]">กิจกรรมล่าสุด</h2>
                    <button
                      onClick={() => setActiveTab("activity_feed")}
                      className="text-xs font-semibold text-[#4a7c59] hover:underline"
                    >
                      ดูฟีดทั้งหมด →
                    </button>
                  </div>

                  {recentActivityError ? (
                    <p className="text-sm text-rose-600">{recentActivityError}</p>
                  ) : recentActivity.length === 0 ? (
                    <p className="text-sm text-[#8a8070]">ยังไม่มีกิจกรรม</p>
                  ) : (
                    <div className="divide-y divide-[#f0e8dc]">
                      {recentActivity.map((act) => {
                        const { title, detail } = describeActivity(act);
                        const group = act.group ? ACTIVITY_GROUP_CONFIG[act.group] : null;
                        return (
                          <div
                            key={act.id}
                            className="flex items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-1"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className={`size-2 shrink-0 rounded-full ${group?.dot ?? "bg-stone-400"}`}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[#2d2d2d]">{title}</p>
                                <p className="truncate text-xs text-[#8a8070]">
                                  {activityActorName(act)}
                                  {detail && ` · ${detail}`}
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 text-xs text-[#998f80]">
                              {formatRelativeTime(act.createdAt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
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

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 text-center">
                      <p className="text-xs font-medium text-emerald-800">ผู้ดูแลระบบ (Admin)</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-emerald-900">
                        {formatCount(stats?.users.byRole.admin)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-3 text-center">
                      <p className="text-xs font-medium text-stone-700">ผู้ใช้งานทั่วไป (User)</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-stone-800">
                        {formatCount(stats?.users.byRole.user)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3 text-center">
                      <p className="text-xs font-medium text-rose-700">ถูกระงับ</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-rose-800">
                        {formatCount(stats?.users.byStatus.suspended)}
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                        Admin
                      </span>
                      <span className="text-xs font-semibold text-emerald-700">
                        {users.filter((u) => u.role === "admin").length} บัญชี
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-[#2d2d2d]">ผู้ดูแลระบบ</h3>
                    <p className="mt-1 text-xs text-[#7a8b6f]">
                      เข้าถึงทุกฟังก์ชัน จัดการสิทธิ์ผู้ใช้งาน ดูแลระบบ และวิเคราะห์ข้อมูลระดับองค์กร
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
                    <h3 className="mt-2 text-sm font-bold text-[#2d2d2d]">ผู้ใช้งานทั่วไป</h3>
                    <p className="mt-1 text-xs text-[#7a8b6f]">
                      ค้นหาประกาศ TOR บันทึกโครงการโปรด และตั้งค่าหมวดหมู่ความสนใจ
                    </p>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="rounded-3xl border border-[#e8e0d0] bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative flex-1">
                      <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-[#8a8070]" />
                      <input
                        id="admin-user-search"
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
                          aria-label="ล้างคำค้นหา"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        id="admin-user-role-filter"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-3.5 py-2 text-sm text-[#5c5446] focus:border-[#4a7c59] focus:outline-none"
                      >
                        <option value="all">ทุกบทบาท (All Roles)</option>
                        <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                        <option value="user">ผู้ใช้งานทั่วไป (User)</option>
                      </select>

                      <select
                        id="admin-user-status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-3.5 py-2 text-sm text-[#5c5446] focus:border-[#4a7c59] focus:outline-none"
                      >
                        <option value="all">ทุกสถานะ (All Statuses)</option>
                        <option value="active">ใช้งานอยู่ (Active)</option>
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
                        {usersError ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-sm text-rose-600">
                              {usersError}
                            </td>
                          </tr>
                        ) : usersLoading ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-sm text-[#8a8070]">
                              กำลังโหลดรายชื่อผู้ใช้งาน...
                            </td>
                          </tr>
                        ) : filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-sm text-[#8a8070]">
                              ไม่พบข้อมูลผู้ใช้งานที่ตรงกับเงื่อนไขค้นหา
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((user) => {
                            const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.user;
                            const statusConfig = STATUS_CONFIG[user.status] || STATUS_CONFIG.active;
                            const initials = (user.displayName || user.name || "U")
                              .slice(0, 2)
                              .toUpperCase();
                            const isSelf = user._id === authUser.id;
                            const busy = busyUserId === user._id;

                            return (
                              <tr key={user._id} className="transition hover:bg-[#faf7f2]/60">
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
                                        {isSelf && (
                                          <span className="ml-1.5 text-[11px] font-medium text-[#998f80]">
                                            (คุณ)
                                          </span>
                                        )}
                                      </div>
                                      <div className="truncate text-xs text-[#8a8070]">{user.email}</div>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-5 py-4 text-xs text-[#5c5446]">
                                  <div className="font-medium">
                                    {user.agencyName || user.companyName || "-"}
                                  </div>
                                  {user.jobTitle && (
                                    <div className="text-[11px] text-[#998f80]">{user.jobTitle}</div>
                                  )}
                                </td>

                                <td className="px-5 py-4">
                                  <span className="rounded-full bg-[#f5f0e8] px-2.5 py-1 text-xs font-medium text-[#5c5446]">
                                    {ACCOUNT_TYPE_LABELS[user.accountType] ?? ACCOUNT_TYPE_LABELS.personal}
                                  </span>
                                </td>

                                <td className="px-5 py-4">
                                  <select
                                    aria-label={`บทบาทของ ${user.displayName || user.name}`}
                                    value={user.role}
                                    disabled={isSelf || busy}
                                    title={isSelf ? "เปลี่ยนบทบาทของตัวเองไม่ได้" : undefined}
                                    onChange={(e) =>
                                      void handleRoleChange(user._id, e.target.value as UserRole)
                                    }
                                    className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-[#4a7c59] disabled:cursor-not-allowed disabled:opacity-60 ${roleConfig.badgeBg} ${roleConfig.badgeText}`}
                                  >
                                    <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                                    <option value="user">ผู้ใช้งานทั่วไป (User)</option>
                                  </select>
                                </td>

                                <td className="px-5 py-4">
                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusConfig.badgeBg}`}
                                  >
                                    <span className={`size-1.5 rounded-full ${statusConfig.dot}`} />
                                    {statusConfig.label}
                                  </span>
                                </td>

                                <td className="px-5 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => openUserModal(user)}
                                      disabled={busy}
                                      className="rounded-lg border border-[#e8e0d0] p-1.5 text-[#7a8b6f] hover:bg-[#faf7f2] hover:text-[#2d2d2d] disabled:opacity-50"
                                      title="แก้ไขข้อมูลและบทบาท"
                                    >
                                      <PencilSquareIcon className="size-4" />
                                    </button>

                                    {!isSelf &&
                                      (user.status !== "suspended" ? (
                                        <button
                                          onClick={() => void handleStatusChange(user._id, "suspended")}
                                          disabled={busy}
                                          className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                          title="ระงับบัญชี"
                                        >
                                          <XMarkIcon className="size-4" />
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => void handleStatusChange(user._id, "active")}
                                          disabled={busy}
                                          className="rounded-lg border border-green-200 p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-50"
                                          title="เปิดใช้งานอีกครั้ง"
                                        >
                                          <CheckIcon className="size-4" />
                                        </button>
                                      ))}
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#2d2d2d] md:text-3xl">
                      ฟีดกิจกรรมและการทำงานของระบบ
                    </h1>
                    <p className="text-sm text-[#7a8b6f]">
                      ประวัติการดำเนินงานของผู้ดูแลระบบ การดึงข้อมูล e-GP และการเปลี่ยนแปลงสิทธิ์
                    </p>
                  </div>
                  <button
                    onClick={reloadActivity}
                    disabled={activityLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#e8e0d0] bg-white px-3.5 py-2 text-xs font-semibold text-[#5c5446] shadow-xs hover:bg-[#faf7f2] disabled:opacity-60"
                  >
                    <ArrowPathIcon className={`size-4 ${activityLoading ? "animate-spin" : ""}`} />
                    รีเฟรชฟีด
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-b border-[#e8e0d0] pb-3">
                  {[
                    { id: "all" as const, label: "กิจกรรมทั้งหมด" },
                    ...(Object.keys(ACTIVITY_GROUP_CONFIG) as ActivityGroup[]).map((group) => ({
                      id: group,
                      label: ACTIVITY_GROUP_CONFIG[group].filterLabel,
                    })),
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => changeActivityGroup(filter.id)}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                        activityGroup === filter.id
                          ? "bg-[#4a7c59] text-white shadow-xs"
                          : "bg-white text-[#5c5446] border border-[#e8e0d0] hover:bg-[#faf7f2]"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-sm">
                  {activityError ? (
                    <p className="text-sm text-rose-600">{activityError}</p>
                  ) : activityItems.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[#8a8070]">
                      {activityLoading ? "กำลังโหลดกิจกรรม..." : "ยังไม่มีกิจกรรมในกลุ่มนี้"}
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {activityItems.map((act, index) => {
                        const { title, detail } = describeActivity(act);
                        const group = act.group ? ACTIVITY_GROUP_CONFIG[act.group] : null;
                        const Icon =
                          act.group === "users"
                            ? UserGroupIcon
                            : act.group === "ingestion" || act.group === "tor"
                              ? DocumentTextIcon
                              : act.group === "system"
                                ? TagIcon
                                : Cog6ToothIcon;

                        return (
                          <div key={act.id} className="relative flex items-start gap-4">
                            {index !== activityItems.length - 1 && (
                              <div className="absolute left-5 top-10 -bottom-6 w-0.5 bg-[#f0e8dc]" />
                            )}

                            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#faf7f2] border border-[#e8e0d0] shadow-xs">
                              <Icon className="size-5 text-[#4a7c59]" />
                            </div>

                            <div className="min-w-0 flex-1 rounded-2xl border border-[#f0e8dc] bg-[#faf7f2]/50 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${group?.badge ?? "bg-stone-100 text-stone-800"}`}
                                  >
                                    {group?.label ?? "อื่นๆ"}
                                  </span>
                                  <h3 className="font-semibold text-sm text-[#2d2d2d]">{title}</h3>
                                </div>
                                <span
                                  className="text-xs text-[#998f80]"
                                  title={new Date(act.createdAt).toLocaleString("th-TH")}
                                >
                                  {formatRelativeTime(act.createdAt)}
                                </span>
                              </div>

                              {detail && (
                                <p className="mt-1 break-words text-xs text-[#6e6456]">{detail}</p>
                              )}

                              <div className="mt-3 text-[11px] text-[#998f80]">
                                ผู้ดำเนินการ:{" "}
                                <strong className="text-[#5c5446]">{activityActorName(act)}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {hasMoreActivity && !activityError && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={() => void loadMoreActivity()}
                        disabled={activityLoading}
                        className="rounded-xl border border-[#e8e0d0] px-4 py-2 text-xs font-semibold text-[#5c5446] hover:bg-[#faf7f2] disabled:opacity-60"
                      >
                        {activityLoading
                          ? "กำลังโหลด..."
                          : `โหลดเพิ่ม (แสดง ${activityItems.length} จาก ${activityTotal})`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VIEW 4: MANAGE TOR (จัดการประกาศ TOR) */}
            {activeTab === "tor_management" && (
              <TorManagementPanel
                stats={stats}
                categories={categories}
                onToast={showToast}
                onChanged={refreshAfterChange}
              />
            )}

            {/* VIEW 4.5: TOR CATEGORIES (หมวดหมู่ TOR) */}
            {activeTab === "categories" && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#2d2d2d] md:text-3xl">
                      หมวดหมู่ TOR
                    </h1>
                    <p className="text-sm text-[#7a8b6f]">
                      หมวดหมู่ที่ AI ใช้จัดประเภท TOR ตอนดึงข้อมูล และที่ผู้ใช้เลือกเป็นความสนใจในหน้าโปรไฟล์
                    </p>
                  </div>
                  <button
                    onClick={() => openCategoryModal()}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#4a7c59] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#3b6647] transition"
                  >
                    <PlusIcon className="size-4" />
                    เพิ่มหมวดหมู่
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#eaf1ec] px-3 py-1 text-xs font-semibold text-[#4a7c59]">
                    ทั้งหมด: {categoryCounts.total} หมวด
                  </span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    เปิดใช้งาน: {categoryCounts.activeCount} หมวด
                  </span>
                </div>

                <div className="rounded-3xl border border-[#e8e0d0] bg-white p-4 shadow-sm">
                  <div className="relative">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-[#8a8070]" />
                    <input
                      id="admin-category-search"
                      type="text"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="ค้นหาตามชื่อ key หรือคำสำคัญ..."
                      className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] py-2 pl-10 pr-4 text-sm text-[#2d2d2d] placeholder-[#998f80] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                    />
                  </div>
                </div>

                {categoriesError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    โหลดหมวดหมู่ไม่สำเร็จ: {categoriesError}
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[#e8e0d0] bg-white py-14 text-center">
                    <TagIcon className="mx-auto size-10 text-[#c9bfae]" />
                    <p className="mt-3 text-sm text-[#8a8070]">
                      {categories.length === 0
                        ? "ยังไม่มีหมวดหมู่ เริ่มต้นด้วยการเพิ่มหมวดหมู่แรก"
                        : "ไม่พบหมวดหมู่ที่ตรงกับคำค้นหา"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {filteredCategories.map((cat) => {
                      const busy = busyCategoryId === cat.id;
                      const cannotHide = cat.isDefault && cat.isActive;
                      return (
                        <div
                          key={cat.id}
                          className={`flex flex-col rounded-3xl border border-[#e8e0d0] bg-white p-5 shadow-sm transition ${
                            cat.isActive ? "" : "opacity-70"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-bold text-[#2d2d2d]">{cat.name}</h3>
                              <p className="mt-0.5 truncate font-mono text-[11px] text-[#998f80]">
                                {cat.key}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#998f80]">
                                ผู้ใช้เลือกไว้ {cat.userCount.toLocaleString("th-TH")} ราย
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  cat.isActive
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-stone-100 text-stone-600"
                                }`}
                              >
                                {cat.isActive ? "เปิดใช้งาน" : "ซ่อนอยู่"}
                              </span>
                              {cat.isDefault && (
                                <span
                                  className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-800"
                                  title="TOR ที่จัดหมวดอื่นไม่ได้จะอยู่หมวดนี้ จึงซ่อนหรือลบไม่ได้"
                                >
                                  หมวดเริ่มต้น
                                </span>
                              )}
                            </div>
                          </div>

                          {cat.description && (
                            <p className="mt-2 text-xs text-[#6e6456]">{cat.description}</p>
                          )}
                          {cat.aiHint && (
                            <p className="mt-1.5 text-[11px] text-[#7a8b6f]">
                              <span className="font-semibold">คำแนะนำสำหรับ AI:</span> {cat.aiHint}
                            </p>
                          )}

                          <div className="mb-4 mt-3 flex flex-wrap gap-1.5">
                            {cat.keywords.length === 0 ? (
                              <span className="text-[11px] text-[#998f80]">ยังไม่มีคำสำคัญ</span>
                            ) : (
                              cat.keywords.map((k) => (
                                <span
                                  key={k}
                                  className="rounded-full bg-[#f5f0e8] px-2.5 py-0.5 text-[11px] font-medium text-[#5c5446]"
                                >
                                  {k}
                                </span>
                              ))
                            )}
                          </div>

                          <div className="mt-auto flex items-center justify-end gap-1.5 border-t border-[#f0e8dc] pt-3">
                            <button
                              onClick={() => void handleToggleCategory(cat)}
                              disabled={busy || cannotHide}
                              title={cannotHide ? "หมวดเริ่มต้นซ่อนไม่ได้" : undefined}
                              className="rounded-lg border border-[#e8e0d0] px-2.5 py-1 text-xs font-semibold text-[#5c5446] hover:bg-[#faf7f2] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {cat.isActive ? "ซ่อน" : "แสดง"}
                            </button>
                            <button
                              onClick={() => openCategoryModal(cat)}
                              disabled={busy}
                              className="rounded-lg border border-[#e8e0d0] p-1.5 text-[#7a8b6f] hover:bg-[#faf7f2] hover:text-[#2d2d2d] disabled:opacity-40"
                              title="แก้ไขหมวดหมู่"
                            >
                              <PencilSquareIcon className="size-4" />
                            </button>
                            <button
                              onClick={() => setCategoryToDelete(cat)}
                              disabled={busy || cat.isDefault}
                              className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                              title={cat.isDefault ? "หมวดเริ่มต้นลบไม่ได้" : "ลบหมวดหมู่"}
                            >
                              <TrashIcon className="size-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 5: SYSTEM SETTINGS (ตั้งค่าระบบ) */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#2d2d2d] md:text-3xl">
                    การตั้งค่าระบบ (System Settings)
                  </h1>
                  <p className="text-sm text-[#7a8b6f]">กำหนดการดึงข้อมูลและค่าของแพลตฟอร์ม</p>
                </div>

                {settingsError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    โหลดการตั้งค่าไม่สำเร็จ: {settingsError}
                  </div>
                ) : !settings ? (
                  <p className="text-sm text-[#8a8070]">กำลังโหลดการตั้งค่า...</p>
                ) : (
                  <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-sm space-y-5">
                    <div className="flex items-center justify-between gap-4 border-b border-[#f0e8dc] pb-4">
                      <div>
                        <p className="font-semibold text-sm text-[#2d2d2d]">
                          การดึงข้อมูลอัตโนมัติ (Automated Ingestion)
                        </p>
                        <p className="text-xs text-[#7a8b6f]">
                          เปิดไว้ ระบบจะดึงประกาศใหม่ทุก {settings.ingestionIntervalMinutes} นาที
                        </p>
                        <p className="text-xs text-[#7a8b6f]">
                          ถ้าปิด ยังกด &quot;สั่งดึงข้อมูลทันที&quot; ในหน้าจัดการ TOR ได้
                        </p>
                      </div>
                      <button
                        role="switch"
                        aria-checked={settings.ingestionEnabled}
                        aria-label="การดึงข้อมูลอัตโนมัติ"
                        disabled={settingsSaving}
                        onClick={() => void saveSettings({ ingestionEnabled: !settings.ingestionEnabled })}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#4a7c59] focus:ring-offset-2 disabled:opacity-60 ${
                          settings.ingestionEnabled ? "bg-[#4a7c59]" : "bg-stone-300"
                        }`}
                      >
                        <span
                          className={`inline-block size-5 rounded-full bg-white shadow transition ${
                            settings.ingestionEnabled ? "translate-x-5.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    <form
                      className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveSettings({ senderEmail: senderEmailDraft.trim() || null });
                      }}
                    >
                      <div className="flex-1">
                        <label
                          htmlFor="admin-sender-email"
                          className="font-semibold text-sm text-[#2d2d2d]"
                        >
                          อีเมลผู้ส่ง (Sender Email)
                        </label>
                        <p className="text-xs text-[#7a8b6f]">
                          ยังไม่ได้ใช้ส่งอีเมล (เตรียมไว้สำหรับระบบแจ้งเตือน)
                        </p>
                        <input
                          id="admin-sender-email"
                          type="email"
                          value={senderEmailDraft}
                          onChange={(e) => setSenderEmailDraft(e.target.value)}
                          placeholder="noreply@example.com"
                          className="mt-2 w-full max-w-sm rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-2 text-sm text-[#2d2d2d] placeholder-[#998f80] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={
                          settingsSaving ||
                          (senderEmailDraft.trim() || null) === settings.senderEmail
                        }
                        className="rounded-xl bg-[#4a7c59] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#3b6647] disabled:opacity-50"
                      >
                        บันทึกอีเมล
                      </button>
                    </form>
                  </div>
                )}

                <IngestionSourcesCard
                  onToast={showToast}
                  onChanged={refreshAfterChange}
                />
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Add / Edit Category Modal */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-fade-in">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-[#e8e0d0] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#f0e8dc] p-6 pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#2d2d2d]">
                  {editingCategory ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}
                </h3>
                {editingCategory && (
                  <p className="font-mono text-[11px] text-[#998f80]">
                    key: {editingCategory.key} (แก้ไขไม่ได้)
                  </p>
                )}
              </div>
              <button
                onClick={closeCategoryModal}
                className="rounded-lg p-1 text-[#8a8070] hover:bg-[#faf7f2] hover:text-[#2d2d2d]"
                aria-label="ปิด"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-6">
              <div>
                <label htmlFor="category-name" className="mb-1.5 block text-xs font-bold text-[#7a8b6f]">
                  ชื่อหมวดหมู่
                </label>
                <input
                  id="category-name"
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="เช่น งานระบบภูมิสารสนเทศ (GIS)"
                  maxLength={100}
                  className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-2 text-sm text-[#2d2d2d] placeholder-[#998f80] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                />
                {!editingCategory && (
                  <p className="mt-1 text-[11px] text-[#998f80]">
                    ระบบสร้าง key ให้อัตโนมัติจากชื่อ และเปลี่ยนภายหลังไม่ได้
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="category-description"
                  className="mb-1.5 block text-xs font-bold text-[#7a8b6f]"
                >
                  คำอธิบาย (ไม่บังคับ)
                </label>
                <textarea
                  id="category-description"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  maxLength={500}
                  placeholder="อธิบายสั้น ๆ ว่าหมวดหมู่นี้ครอบคลุมโครงการประเภทใด"
                  className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-2 text-sm text-[#2d2d2d] placeholder-[#998f80] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                />
                <p className="mt-1 text-[11px] text-[#998f80]">
                  แสดงบนการ์ดในหน้าโปรไฟล์ และส่งให้ AI ใช้ประกอบการจัดหมวด
                </p>
              </div>

              <div>
                <label htmlFor="category-ai-hint" className="mb-1.5 block text-xs font-bold text-[#7a8b6f]">
                  คำแนะนำสำหรับ AI (ไม่บังคับ)
                </label>
                <textarea
                  id="category-ai-hint"
                  value={categoryForm.aiHint}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, aiHint: e.target.value }))}
                  rows={2}
                  maxLength={500}
                  placeholder="เช่น GIS, map services, spatial data platforms"
                  className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-2 text-sm text-[#2d2d2d] placeholder-[#998f80] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                />
                <p className="mt-1 text-[11px] text-[#998f80]">
                  ตัวอย่างหรือขอบเขตงานของหมวดนี้ ช่วยให้ AI จัดหมวดแม่นขึ้น มีผลกับ TOR ที่ดึงเข้ามาหลังจากนี้
                </p>
              </div>

              <div>
                <label htmlFor="category-keywords" className="mb-1.5 block text-xs font-bold text-[#7a8b6f]">
                  คำสำคัญ
                </label>
                <textarea
                  id="category-keywords"
                  value={categoryForm.keywords}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, keywords: e.target.value }))}
                  rows={3}
                  placeholder="คั่นด้วยเครื่องหมายจุลภาค เช่น GIS, ArcGIS, QGIS"
                  className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-2 text-sm text-[#2d2d2d] placeholder-[#998f80] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                />
                <p className="mt-1 text-[11px] text-[#998f80]">
                  ใช้ค้นหาหมวดหมู่ในหน้านี้ ระบบยังไม่ได้ใช้คำเหล่านี้จัดหมวด TOR อัตโนมัติ
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#f0e8dc] p-6 pt-4">
              <button
                onClick={closeCategoryModal}
                className="rounded-xl border border-[#e8e0d0] px-4 py-2 text-sm font-medium text-[#5c5446] hover:bg-[#faf7f2]"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => void handleSaveCategory()}
                disabled={categorySaving}
                className="rounded-xl bg-[#4a7c59] px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#3b6647] disabled:opacity-60"
              >
                {categorySaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirm */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-[#2d2d2d]">
              ลบหมวดหมู่ &quot;{categoryToDelete.name}&quot;
            </h3>
            <p className="mt-2 text-sm text-[#6e6456]">
              ลบได้เฉพาะหมวดที่ไม่มีผู้ใช้เลือกและไม่มี TOR ใช้อยู่ หากมีการใช้งาน ระบบจะแจ้งให้เลือก
              &quot;ซ่อน&quot; แทน ซึ่งเก็บข้อมูลเดิมไว้ครบ
            </p>
            {categoryToDelete.userCount > 0 && (
              <p className="mt-2 text-sm font-medium text-rose-700">
                ตอนนี้มีผู้ใช้เลือกหมวดนี้ {categoryToDelete.userCount.toLocaleString("th-TH")} ราย
              </p>
            )}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setCategoryToDelete(null)}
                className="rounded-xl border border-[#e8e0d0] px-4 py-2 text-sm font-medium text-[#5c5446] hover:bg-[#faf7f2]"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => void handleDeleteCategory()}
                disabled={busyCategoryId === categoryToDelete.id}
                className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
              >
                ลบหมวดหมู่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {selectedUserForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-fade-in">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-[#e8e0d0] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#f0e8dc] p-6 pb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-[#2d2d2d]">แก้ไขข้อมูลและบทบาทผู้ใช้งาน</h3>
                <p className="truncate text-xs text-[#5c5446]">{selectedUserForEdit.email}</p>
              </div>
              <button
                onClick={() => setSelectedUserForEdit(null)}
                className="rounded-lg p-1 text-[#8a8070] hover:bg-[#faf7f2] hover:text-[#2d2d2d]"
                aria-label="ปิด"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="user-name" className="mb-1.5 block text-xs font-bold text-[#7a8b6f]">
                    ชื่อ
                  </label>
                  <input
                    id="user-name"
                    type="text"
                    value={userForm.name}
                    onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-2 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                  />
                </div>
                <div>
                  <label htmlFor="user-account-type" className="mb-1.5 block text-xs font-bold text-[#7a8b6f]">
                    ประเภทบัญชี
                  </label>
                  <select
                    id="user-account-type"
                    value={userForm.accountType}
                    onChange={(e) =>
                      setUserForm((f) => ({ ...f, accountType: e.target.value as AccountType }))
                    }
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-3.5 py-2 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:outline-none"
                  >
                    {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((type) => (
                      <option key={type} value={type}>
                        {ACCOUNT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="user-job-title" className="mb-1.5 block text-xs font-bold text-[#7a8b6f]">
                    ตำแหน่ง
                  </label>
                  <input
                    id="user-job-title"
                    type="text"
                    value={userForm.jobTitle}
                    onChange={(e) => setUserForm((f) => ({ ...f, jobTitle: e.target.value }))}
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-2 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                  />
                </div>
                <div>
                  <label htmlFor="user-agency" className="mb-1.5 block text-xs font-bold text-[#7a8b6f]">
                    หน่วยงาน
                  </label>
                  <input
                    id="user-agency"
                    type="text"
                    value={userForm.agencyName}
                    onChange={(e) => setUserForm((f) => ({ ...f, agencyName: e.target.value }))}
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-2 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                  />
                </div>
                <div>
                  <label htmlFor="user-company" className="mb-1.5 block text-xs font-bold text-[#7a8b6f]">
                    บริษัท
                  </label>
                  <input
                    id="user-company"
                    type="text"
                    value={userForm.companyName}
                    onChange={(e) => setUserForm((f) => ({ ...f, companyName: e.target.value }))}
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-2 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#7a8b6f]">
                  บทบาท (Role)
                </p>
                {selectedUserForEdit._id === authUser.id && (
                  <p className="mb-2 text-xs text-[#998f80]">เปลี่ยนบทบาทของตัวเองไม่ได้</p>
                )}
                <div className="space-y-2">
                  {(["admin", "user"] as UserRole[]).map((r) => {
                    const cfg = ROLE_CONFIG[r];
                    const isSelected = userForm.role === r;
                    const disabled = selectedUserForEdit._id === authUser.id;
                    return (
                      <label
                        key={r}
                        className={`flex items-start gap-3 rounded-2xl border p-3.5 transition ${
                          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                        } ${
                          isSelected
                            ? "border-[#4a7c59] bg-[#eaf1ec]/60 ring-1 ring-[#4a7c59]"
                            : "border-[#e8e0d0] bg-white hover:bg-[#faf7f2]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="modal_role"
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => setUserForm((f) => ({ ...f, role: r }))}
                          className="mt-1 accent-[#4a7c59]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#2d2d2d]">{cfg.label}</span>
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                              {r.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-[#7a8b6f] mt-0.5">{cfg.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#f0e8dc] p-6 pt-4">
              <button
                onClick={() => setSelectedUserForEdit(null)}
                className="rounded-xl border border-[#e8e0d0] px-4 py-2 text-sm font-medium text-[#5c5446] hover:bg-[#faf7f2]"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => void handleSaveUser()}
                disabled={userSaving}
                className="rounded-xl bg-[#4a7c59] px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#3b6647] disabled:opacity-60"
              >
                {userSaving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
