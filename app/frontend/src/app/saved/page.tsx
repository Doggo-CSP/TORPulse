"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SiteNav } from "@/app/components/site_nav";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile, type TorItem } from "@/hooks/use-user-profile";
import {
  BookmarkIcon as BookmarkSolidIcon,
  CheckIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/solid";
import {
  BookmarkIcon as BookmarkOutlineIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  TagIcon,
  XMarkIcon,
  ArrowsUpDownIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  FolderOpenIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

type SortOption = "recent" | "budget-desc" | "budget-asc" | "deadline" | "title";
type StatusFilter = "all" | "open" | "closed";
type ViewMode = "grid" | "list";

const formatBaht = (amount?: number | null) => {
  if (amount === undefined || amount === null) return "ไม่ระบุงบประมาณ";
  if (amount >= 1_000_000) {
    return `฿${(amount / 1_000_000).toLocaleString("th-TH", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })} ล้านบาท`;
  }
  return `฿${amount.toLocaleString("th-TH")} บาท`;
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

const getDeadlineStatus = (deadlineStr?: string | null) => {
  if (!deadlineStr) return { status: "unknown", label: "ไม่ระบุวันปิดรับ", badgeClass: "bg-surface-2 text-muted-foreground" };
  const deadline = new Date(deadlineStr);
  if (Number.isNaN(deadline.getTime())) {
    return { status: "unknown", label: deadlineStr, badgeClass: "bg-surface-2 text-muted-foreground" };
  }
  const now = new Date();
  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: "closed", label: "ปิดรับข้อเสนอแล้ว", badgeClass: "bg-destructive/10 text-destructive border-destructive/20" };
  }
  if (diffDays <= 7) {
    return {
      status: "closing-soon",
      label: `ใกล้ปิดรับ (เหลือ ${diffDays} วัน)`,
      badgeClass: "bg-warning/15 text-amber-700 border-warning/30",
    };
  }
  return {
    status: "open",
    label: `เปิดรับสมัคร (เหลือ ${diffDays} วัน)`,
    badgeClass: "bg-success/15 text-emerald-700 border-success/30",
  };
};

export default function SavedTorPage() {
  const { user, loading: authLoading } = useAuth();
  const { bookmarkedTors, loading: bookmarksLoading, toggleBookmark } = useUserProfile(!!user);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Modal / Preview state
  const [previewTor, setPreviewTor] = useState<TorItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [recentlyRemoved, setRecentlyRemoved] = useState<TorItem | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Collect all unique technologies from saved items
  const availableTechs = useMemo(() => {
    const techSet = new Set<string>();
    bookmarkedTors.forEach((tor) => {
      tor.technologies?.forEach((tech) => tech && techSet.add(tech));
    });
    return Array.from(techSet).sort();
  }, [bookmarkedTors]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalCount = bookmarkedTors.length;
    let totalBudget = 0;
    let openCount = 0;
    const agencies = new Set<string>();

    const now = new Date();
    bookmarkedTors.forEach((tor) => {
      if (typeof tor.budgetBaht === "number") {
        totalBudget += tor.budgetBaht;
      }
      if (tor.agencyName) {
        agencies.add(tor.agencyName);
      }
      if (tor.submissionDeadline) {
        const d = new Date(tor.submissionDeadline);
        if (!Number.isNaN(d.getTime()) && d.getTime() >= now.getTime()) {
          openCount++;
        }
      }
    });

    return {
      totalCount,
      totalBudget,
      openCount,
      agenciesCount: agencies.size,
    };
  }, [bookmarkedTors]);

  // Filter and sort items
  const filteredTors = useMemo(() => {
    let list = [...bookmarkedTors];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((tor) => {
        return (
          tor.projectTitle?.toLowerCase().includes(q) ||
          tor.agencyName?.toLowerCase().includes(q) ||
          tor.externalId?.toLowerCase().includes(q) ||
          tor.summary?.toLowerCase().includes(q) ||
          tor.classificationReason?.toLowerCase().includes(q) ||
          tor.technologies?.some((t) => t.toLowerCase().includes(q))
        );
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      const now = new Date();
      list = list.filter((tor) => {
        if (!tor.submissionDeadline) return false;
        const d = new Date(tor.submissionDeadline);
        if (Number.isNaN(d.getTime())) return false;
        const isOpen = d.getTime() >= now.getTime();
        return statusFilter === "open" ? isOpen : !isOpen;
      });
    }

    // Tech filter
    if (selectedTech) {
      list = list.filter((tor) => tor.technologies?.includes(selectedTech));
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === "budget-desc") {
        return (b.budgetBaht ?? 0) - (a.budgetBaht ?? 0);
      }
      if (sortBy === "budget-asc") {
        return (a.budgetBaht ?? 0) - (b.budgetBaht ?? 0);
      }
      if (sortBy === "deadline") {
        const timeA = a.submissionDeadline ? new Date(a.submissionDeadline).getTime() : Infinity;
        const timeB = b.submissionDeadline ? new Date(b.submissionDeadline).getTime() : Infinity;
        return timeA - timeB;
      }
      if (sortBy === "title") {
        return (a.projectTitle || "").localeCompare(b.projectTitle || "", "th");
      }
      // default: recent (by created date or array index order)
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  }, [bookmarkedTors, searchQuery, statusFilter, selectedTech, sortBy]);

  // Handle remove bookmark
  const handleRemoveBookmark = async (tor: TorItem) => {
    try {
      await toggleBookmark(tor._id);
      setRecentlyRemoved(tor);
      showToast(`นำ “${tor.projectTitle.slice(0, 30)}...” ออกจากรายการที่บันทึกแล้ว`);
    } catch {
      showToast("เกิดข้อผิดพลาดในการยกเลิกการบันทึก");
    }
  };

  // Undo remove bookmark
  const handleUndoRemove = async () => {
    if (!recentlyRemoved) return;
    try {
      await toggleBookmark(recentlyRemoved._id);
      showToast(`นำกลับเข้าสู่รายการที่บันทึกแล้ว`);
      setRecentlyRemoved(null);
    } catch {
      showToast("ไม่สามารถกู้คืนรายการได้");
    }
  };

  // Copy link
  const handleCopyLink = (torId: string) => {
    const url = `${window.location.origin}/tor/${torId}`;
    navigator.clipboard.writeText(url);
    showToast("คัดลอกลิงก์ไปยังคลิปบอร์ดแล้ว");
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredTors.length === 0) return;
    const headers = ["ID โครงการ", "ชื่อโครงการ", "หน่วยงาน", "งบประมาณ (บาท)", "วันปิดรับข้อเสนอ", "ลิงก์"];
    const rows = filteredTors.map((t) => [
      `"${t.externalId || t._id}"`,
      `"${(t.projectTitle || "").replace(/"/g, '""')}"`,
      `"${(t.agencyName || "").replace(/"/g, '""')}"`,
      t.budgetBaht ?? "",
      t.submissionDeadline ?? "",
      `"${window.location.origin}/tor/${t._id}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `saved-tors-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว");
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <SiteNav />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-3.5 shadow-xl transition-all animate-in fade-in slide-in-from-bottom-5">
          <span className="text-sm font-medium text-foreground">{toastMessage}</span>
          {recentlyRemoved && (
            <button
              onClick={handleUndoRemove}
              className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              เลิกทำ (Undo)
            </button>
          )}
          <button
            onClick={() => setToastMessage(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <XMarkIcon className="size-4" />
          </button>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Breadcrumb & Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link href="/" className="hover:text-primary transition-colors">
                หน้าแรก
              </Link>
              <span>/</span>
              <span className="font-medium text-foreground">TOR ที่บันทึกไว้</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl text-foreground font-display flex items-center gap-3">
              <BookmarkSolidIcon className="size-8 text-primary" />
              <span>TOR Bookmark</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl leading-relaxed">
              จัดการและติดตามประกาศ TOR ที่คุณสนใจ เพื่อกลับมาดูรายละเอียด ข้อกำหนด วงเงิน และข้อมูลติดต่อสำหรับจัดทำข้อเสนอโครงการ
            </p>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={handleExportCsv}
              disabled={filteredTors.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title="ส่งออกรายการเป็นไฟล์ CSV"
            >
              <ArrowDownTrayIcon className="size-4 text-muted-foreground" />
              <span>ส่งออก CSV</span>
            </button>
            <Link
              href="/homepage"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              <span>ค้นหา TOR เพิ่มเติม</span>
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* ── Stats Summary Grid ── */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">รายการที่บันทึก</span>
              <div className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <BookmarkOutlineIcon className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold font-display text-foreground">
              {stats.totalCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">โครงการ</span>
            </p>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">มูลค่างบประมาณรวม</span>
              <div className="grid size-8 place-items-center rounded-xl bg-accent/15 text-accent">
                <BanknotesIcon className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold font-display text-foreground">
              {stats.totalBudget >= 1_000_000
                ? `฿${(stats.totalBudget / 1_000_000).toFixed(1)}M`
                : `฿${(stats.totalBudget / 1_000).toFixed(0)}k`}
            </p>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">เปิดรับสมัครอยู่</span>
              <div className="grid size-8 place-items-center rounded-xl bg-success/15 text-emerald-600">
                <ClockIcon className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold font-display text-foreground">
              {stats.openCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">โครงการ</span>
            </p>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">หน่วยงานที่เกี่ยวข้อง</span>
              <div className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <BuildingOffice2Icon className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold font-display text-foreground">
              {stats.agenciesCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">หน่วยงาน</span>
            </p>
          </div>
        </div>

        {/* ── Filters, Search & Controls Toolbar ── */}
        <div className="mt-8 panel p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อโครงการ, หน่วยงาน, รหัส EGP, หรือเทคโนโลยี..."
                className="w-full rounded-xl border border-input bg-background pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XMarkIcon className="size-4" />
                </button>
              )}
            </div>

            {/* Filter controls row */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Status Tabs */}
              <div className="inline-flex rounded-xl border border-border bg-surface-2 p-1 text-xs font-medium text-muted-foreground">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    statusFilter === "all" ? "bg-background text-foreground shadow-xs" : "hover:text-foreground"
                  }`}
                >
                  ทั้งหมด ({bookmarkedTors.length})
                </button>
                <button
                  onClick={() => setStatusFilter("open")}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    statusFilter === "open" ? "bg-background text-foreground shadow-xs" : "hover:text-foreground"
                  }`}
                >
                  เปิดรับอยู่ ({stats.openCount})
                </button>
                <button
                  onClick={() => setStatusFilter("closed")}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    statusFilter === "closed" ? "bg-background text-foreground shadow-xs" : "hover:text-foreground"
                  }`}
                >
                  ปิดรับแล้ว ({stats.totalCount - stats.openCount})
                </button>
              </div>

              {/* Sort Dropdown */}
              <div className="relative flex items-center">
                <ArrowsUpDownIcon className="pointer-events-none absolute left-3 size-3.5 text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="เรียงลำดับรายการ TOR"
                  className="appearance-none rounded-xl border border-input bg-background pl-8 pr-8 py-2 text-xs font-medium text-foreground outline-none focus:border-primary cursor-pointer"
                >
                  <option value="recent">บันทึกล่าสุด</option>
                  <option value="budget-desc">งบประมาณ: มาก → น้อย</option>
                  <option value="budget-asc">งบประมาณ: น้อย → มาก</option>
                  <option value="deadline">วันปิดรับข้อเสนอ: เร็วสุด</option>
                  <option value="title">ชื่อโครงการ (ก-ฮ)</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="inline-flex rounded-xl border border-border bg-surface-2 p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  aria-label="มุมมองตารางการ์ด (Grid View)"
                  className={`rounded-lg p-1.5 transition-all ${
                    viewMode === "grid" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Squares2X2Icon className="size-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  aria-label="มุมมองรายการ (List View)"
                  className={`rounded-lg p-1.5 transition-all ${
                    viewMode === "list" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ListBulletIcon className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Tech Tag Badges Filter */}
          {availableTechs.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border pt-4">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 mr-1">
                <TagIcon className="size-3.5" /> เทคโนโลยี:
              </span>
              <button
                onClick={() => setSelectedTech(null)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  selectedTech === null
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-surface-2 text-muted-foreground hover:text-foreground hover:bg-surface"
                }`}
              >
                ทั้งหมด
              </button>
              {availableTechs.map((tech) => (
                <button
                  key={tech}
                  onClick={() => setSelectedTech((prev) => (prev === tech ? null : tech))}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    selectedTech === tech
                      ? "bg-primary text-primary-foreground font-semibold ring-1 ring-primary"
                      : "border border-border bg-surface text-foreground hover:border-primary/50"
                  }`}
                >
                  {tech}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Main Content Area ── */}
        <div className="mt-8">
          {/* Guest State */}
          {!authLoading && !user && (
            <div className="panel p-12 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-primary/10 text-primary">
                <BookmarkOutlineIcon className="size-8" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-foreground">
                กรุณาเข้าสู่ระบบเพื่อจัดการ TOR ที่บันทึกไว้
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                เข้าสู่ระบบด้วยบัญชี Google เพื่อให้คุณสามารถบันทึกรายการ TOR ที่สนใจ และกลับมาเปิดอ่านรายละเอียดได้จากทุกอุปกรณ์
              </p>
              <Link
                href="/auth"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
              >
                <span>เข้าสู่ระบบ / สมัครสมาชิก</span>
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          )}

          {/* Loading Skeleton */}
          {(authLoading || bookmarksLoading) && (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="panel p-6 animate-pulse space-y-4">
                  <div className="flex justify-between">
                    <div className="h-4 w-24 rounded bg-surface-2" />
                    <div className="h-6 w-6 rounded-full bg-surface-2" />
                  </div>
                  <div className="h-6 w-4/5 rounded bg-surface-2" />
                  <div className="h-4 w-1/2 rounded bg-surface-2" />
                  <div className="h-8 w-1/3 rounded bg-surface-2" />
                  <div className="flex gap-2 pt-2">
                    <div className="h-5 w-16 rounded-full bg-surface-2" />
                    <div className="h-5 w-16 rounded-full bg-surface-2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State: No Bookmarks at all */}
          {!authLoading && user && !bookmarksLoading && bookmarkedTors.length === 0 && (
            <div className="panel p-12 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-surface-2 text-muted-foreground">
                <FolderOpenIcon className="size-8 text-[#998f80]" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-foreground">ยังไม่มี TOR ที่บันทึกไว้</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                คุณสามารถกดไอคอนบันทึก (Bookmark) ที่โครงการ TOR ในหน้าแรก หรือหน้าค้นหา เพื่อรวบรวมโครงการที่น่าสนใจไว้ทบทวนและเตรียมทำข้อเสนอ
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/homepage"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                >
                  <span>สำรวจ TOR ล่าสุด</span>
                  <ArrowRightIcon className="size-4" />
                </Link>
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-2"
                >
                  <MagnifyingGlassIcon className="size-4 text-muted-foreground" />
                  <span>ค้นหาตามเงื่อนไข</span>
                </Link>
              </div>
            </div>
          )}

          {/* Empty State: Filter yielded no results */}
          {!authLoading && user && !bookmarksLoading && bookmarkedTors.length > 0 && filteredTors.length === 0 && (
            <div className="panel p-12 text-center">
              <MagnifyingGlassIcon className="mx-auto size-10 text-muted-foreground opacity-60" />
              <h3 className="mt-3 text-base font-bold text-foreground">
                ไม่พบโครงการที่ตรงกับเงื่อนไขการค้นหา
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                ลองปรับเปลี่ยนคำค้นหา หรือล้างตัวกรองสถานะและเทคโนโลยี
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setSelectedTech(null);
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-medium text-foreground hover:bg-surface-2"
              >
                <ArrowPathIcon className="size-3.5" />
                <span>ล้างตัวกรองทั้งหมด</span>
              </button>
            </div>
          )}

          {/* ── Bookmarks View: Grid Cards ── */}
          {!authLoading && user && !bookmarksLoading && viewMode === "grid" && filteredTors.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTors.map((tor) => {
                const deadline = getDeadlineStatus(tor.submissionDeadline);

                return (
                  <div
                    key={tor._id}
                    className="group relative flex flex-col justify-between rounded-3xl border border-border bg-card p-6 shadow-xs transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-md"
                  >
                    <div>
                      {/* Card Header: External ID, Source, Bookmark Button */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                          {tor.externalId && (
                            <span className="rounded-md bg-surface-2 px-2 py-0.5 font-semibold text-foreground">
                              {tor.externalId}
                            </span>
                          )}
                          {tor.sourceAdapter && (
                            <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px]">
                              {tor.sourceAdapter}
                            </span>
                          )}
                        </div>

                        {/* Remove Bookmark Button */}
                        <button
                          onClick={() => handleRemoveBookmark(tor)}
                          className="rounded-full p-1.5 text-primary hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="นำออกจากรายการที่บันทึก"
                        >
                          <BookmarkSolidIcon className="size-5" />
                        </button>
                      </div>

                      {/* Project Title */}
                      <h3 className="mt-3 text-base font-bold leading-snug text-card-foreground group-hover:text-primary transition-colors line-clamp-2">
                        <Link href={`/tor/${tor._id}`}>{tor.projectTitle}</Link>
                      </h3>

                      {/* Agency Name */}
                      <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
                        <BuildingOffice2Icon className="size-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="truncate">{tor.agencyName ?? "ไม่ระบุหน่วยงาน"}</span>
                      </p>

                      {/* Budget Highlight */}
                      <div className="mt-4 rounded-2xl bg-surface-2 p-3.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          วงเงินงบประมาณ
                        </span>
                        <span className="font-display text-lg font-bold text-foreground">
                          {formatBaht(tor.budgetBaht)}
                        </span>
                      </div>

                      {/* Deadline Status Badge */}
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">วันปิดรับข้อเสนอ:</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${deadline.badgeClass}`}
                        >
                          <ClockIcon className="size-3" />
                          {formatDate(tor.submissionDeadline)}
                        </span>
                      </div>

                      {/* Tech Tags */}
                      {tor.technologies && tor.technologies.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {tor.technologies.slice(0, 4).map((tech) => (
                            <span
                              key={tech}
                              className="rounded-lg border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-accent"
                            >
                              {tech}
                            </span>
                          ))}
                          {tor.technologies.length > 4 && (
                            <span className="rounded-lg border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              +{tor.technologies.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Summary Snippet */}
                      {tor.summary && (
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                          {tor.summary}
                        </p>
                      )}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs">
                      <div className="flex items-center gap-2">
                        {/* Quick Preview Button */}
                        <button
                          onClick={() => setPreviewTor(tor)}
                          className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-1.5 font-medium text-foreground hover:bg-surface-2 transition-colors"
                          title="ดูสรุปข้อกำหนดด่วน"
                        >
                          <EyeIcon className="size-3.5" />
                          <span>ดูสรุป</span>
                        </button>

                        {/* Copy Link Button */}
                        <button
                          onClick={() => handleCopyLink(tor._id)}
                          className="rounded-xl border border-border bg-surface p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                          title="คัดลอกลิงก์โครงการ"
                        >
                          <ClipboardDocumentIcon className="size-4" />
                        </button>
                      </div>

                      {/* View Full Detail Link */}
                      <Link
                        href={`/tor/${tor._id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all"
                      >
                        <span>ดูรายละเอียด</span>
                        <ArrowRightIcon className="size-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Bookmarks View: Compact List ── */}
          {!authLoading && user && !bookmarksLoading && viewMode === "list" && filteredTors.length > 0 && (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-2/60 text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="py-3.5 pl-6 pr-3">รหัส / แหล่งที่มา</th>
                      <th className="px-3 py-3.5">ชื่อโครงการ / หน่วยงาน</th>
                      <th className="px-3 py-3.5">งบประมาณ</th>
                      <th className="px-3 py-3.5">วันปิดรับข้อเสนอ</th>
                      <th className="px-3 py-3.5">เทคโนโลยี</th>
                      <th className="py-3.5 pl-3 pr-6 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTors.map((tor) => {
                      const deadline = getDeadlineStatus(tor.submissionDeadline);

                      return (
                        <tr key={tor._id} className="transition-colors hover:bg-surface-2/50">
                          <td className="py-4 pl-6 pr-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                            <div className="font-semibold text-foreground">
                              {tor.externalId || tor._id.slice(0, 8)}
                            </div>
                            <div className="text-[10px]">{tor.sourceAdapter ?? "EGP"}</div>
                          </td>
                          <td className="px-3 py-4 max-w-xs sm:max-w-md">
                            <Link
                              href={`/tor/${tor._id}`}
                              className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1"
                            >
                              {tor.projectTitle}
                            </Link>
                            <p className="mt-0.5 text-xs text-muted-foreground truncate">
                              {tor.agencyName ?? "ไม่ระบุหน่วยงาน"}
                            </p>
                          </td>
                          <td className="px-3 py-4 font-display font-semibold text-foreground whitespace-nowrap">
                            {formatBaht(tor.budgetBaht)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${deadline.badgeClass}`}
                            >
                              {formatDate(tor.submissionDeadline)}
                            </span>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {tor.technologies?.slice(0, 2).map((t) => (
                                <span
                                  key={t}
                                  className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-accent font-medium"
                                >
                                  {t}
                                </span>
                              ))}
                              {(tor.technologies?.length ?? 0) > 2 && (
                                <span className="text-[10px] text-muted-foreground self-center">
                                  +{(tor.technologies?.length ?? 0) - 2}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 pl-3 pr-6 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setPreviewTor(tor)}
                                className="rounded-lg border border-border bg-surface p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2"
                                title="ดูตัวอย่างด่วน"
                              >
                                <EyeIcon className="size-4" />
                              </button>
                              <Link
                                href={`/tor/${tor._id}`}
                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                              >
                                รายละเอียด
                              </Link>
                              <button
                                onClick={() => handleRemoveBookmark(tor)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="นำออกจากรายการที่บันทึก"
                              >
                                <XMarkIcon className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Quick Preview Modal / Drawer ── */}
      {previewTor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-border bg-background shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border bg-surface-2/70 px-6 py-5">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span className="rounded bg-surface px-2 py-0.5 font-semibold text-foreground">
                    {previewTor.externalId || previewTor._id}
                  </span>
                  <span>{previewTor.sourceAdapter}</span>
                </div>
                <h2 className="mt-1.5 text-lg font-bold text-foreground line-clamp-2">
                  {previewTor.projectTitle}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {previewTor.agencyName ?? "ไม่ระบุหน่วยงาน"}
                </p>
              </div>
              <button
                onClick={() => setPreviewTor(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="panel p-4">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">วงเงินงบประมาณ</span>
                  <p className="mt-1 font-display text-base font-bold text-foreground">
                    {formatBaht(previewTor.budgetBaht)}
                  </p>
                </div>
                <div className="panel p-4">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">วันปิดรับข้อเสนอ</span>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatDate(previewTor.submissionDeadline)}
                  </p>
                </div>
                <div className="panel p-4 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">เทคโนโลยีที่ระบุ</span>
                  <p className="mt-1 text-xs font-medium text-accent">
                    {previewTor.technologies?.join(", ") || "ไม่ระบุ"}
                  </p>
                </div>
              </div>

              {/* Summary */}
              {previewTor.summary && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    ภาพรวมโครงการ
                  </h3>
                  <p className="rounded-2xl border border-border bg-surface p-4 text-sm leading-relaxed text-foreground">
                    {previewTor.summary}
                  </p>
                </div>
              )}

              {/* Objectives */}
              {previewTor.objectives && previewTor.objectives.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    วัตถุประสงค์และเป้าหมาย
                  </h3>
                  <ul className="space-y-2 rounded-2xl border border-border bg-surface p-4 text-sm">
                    {previewTor.objectives.map((obj, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                          {idx + 1}
                        </span>
                        <span className="text-foreground leading-relaxed">{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Requirements */}
              {previewTor.requirements && previewTor.requirements.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    ข้อกำหนดและขอบเขตงาน
                  </h3>
                  <ul className="space-y-2 rounded-2xl border border-border bg-surface p-4 text-sm">
                    {previewTor.requirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckIcon className="mt-1 size-3.5 shrink-0 text-primary" />
                        <span className="text-foreground leading-relaxed">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Documents */}
              {previewTor.documents && previewTor.documents.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    เอกสารแนบ ({previewTor.documents.length} ฉบับ)
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {previewTor.documents.map((doc, idx) => (
                      <a
                        key={idx}
                        href={doc.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-3 text-xs text-foreground hover:bg-surface-2 transition-colors"
                      >
                        <DocumentTextIcon className="size-4 shrink-0 text-primary" />
                        <span className="truncate flex-1 font-medium">{doc.fileName}</span>
                        <ArrowTopRightOnSquareIcon className="size-3.5 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border bg-surface-2/70 px-6 py-4">
              {previewTor.detailUrl ? (
                <a
                  href={previewTor.detailUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <span>แหล่งข้อมูลต้นทาง</span>
                  <ArrowTopRightOnSquareIcon className="size-3.5" />
                </a>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setPreviewTor(null)}
                  className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-2"
                >
                  ปิด
                </button>
                <Link
                  href={`/tor/${previewTor._id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
                >
                  <span>เปิดหน้ารายละเอียดเต็ม</span>
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
