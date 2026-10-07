"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import {
  ArrowPathIcon,
  ArchiveBoxIcon,
  CheckBadgeIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  AdminCategory,
  AdminStats,
  AdminTorDetail,
  AdminTorItem,
  AdminTorPage,
  AdminTorUpdateInput,
  CollectionRun,
  TorReviewStatus,
  changeAdminTorStatus,
  fetchAdminTor,
  fetchAdminTors,
  fetchIngestionStatus,
  triggerIngestionSync,
  updateAdminTor,
} from "@/api/admin.api";
import { formatRelativeTime, formatThaiDateTime } from "./activity-format";

type ToastKind = "success" | "error";

interface TorManagementPanelProps {
  stats: AdminStats | null;
  categories: AdminCategory[];
  onToast: (message: string, kind?: ToastKind) => void;
  // Called after a change so the page can refresh its stats and activity feed
  onChanged: () => void;
}

const PAGE_SIZE = 10;
const SYNC_POLL_MS = 5_000;

const REVIEW_STATUS_CONFIG: Record<TorReviewStatus, { label: string; badge: string }> = {
  unverified: { label: "รอตรวจสอบ", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  verified: { label: "ตรวจสอบแล้ว", badge: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  archived: { label: "เก็บเข้าคลัง", badge: "bg-stone-100 text-stone-600 border-stone-200" },
  deleted: { label: "ลบแล้ว", badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

const RUN_STATUS_CONFIG: Record<CollectionRun["status"], { label: string; badge: string }> = {
  running: { label: "กำลังดึงข้อมูล", badge: "bg-blue-100 text-blue-800" },
  success: { label: "สำเร็จ", badge: "bg-emerald-100 text-emerald-800" },
  failed: { label: "ไม่สำเร็จ", badge: "bg-rose-100 text-rose-700" },
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

const formatBaht = (value: number | null) =>
  value === null ? "—" : `${value.toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท`;

const splitList = (text: string, separator: RegExp) =>
  Array.from(
    new Set(
      text
        .split(separator)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

export function TorManagementPanel({
  stats,
  categories,
  onToast,
  onChanged,
}: TorManagementPanelProps) {
  // ───────── e-GP sync status ─────────
  const [lastRun, setLastRun] = useState<CollectionRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncStarting, setSyncStarting] = useState(false);

  // Remembers the previous answer so a run that just finished refreshes the page's numbers once
  const wasRunning = useRef(false);

  // State is set in the promise callbacks, after the request answers.
  const loadSyncStatus = useCallback(
    () =>
      fetchIngestionStatus().then(
        (status) => {
          setLastRun(status.lastRun);
          setIsRunning(status.isRunning);
          setSyncError(null);
          if (wasRunning.current && !status.isRunning) onChanged();
          wasRunning.current = status.isRunning;
        },
        (error: unknown) => setSyncError(errorMessage(error))
      ),
    [onChanged]
  );

  useEffect(() => {
    void loadSyncStatus();
  }, [loadSyncStatus]);

  // While a sync runs, check again every few seconds so the card shows the result.
  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => void loadSyncStatus(), SYNC_POLL_MS);
    return () => clearInterval(timer);
  }, [isRunning, loadSyncStatus]);

  const handleSync = async () => {
    setSyncStarting(true);
    try {
      const result = await triggerIngestionSync();
      onToast(result.message);
      await loadSyncStatus();
    } catch (error) {
      onToast(errorMessage(error), "error");
    } finally {
      setSyncStarting(false);
    }
  };

  // ───────── TOR list ─────────
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch] = useDebounce(searchInput, 400);
  const [statusFilter, setStatusFilter] = useState<TorReviewStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [torPage, setTorPage] = useState<AdminTorPage | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAdminTors({
      q: debouncedSearch.trim() || undefined,
      status: statusFilter,
      category: categoryFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setTorPage(result);
        setListError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setListError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, statusFilter, categoryFilter, page, reloadKey]);

  const reloadList = () => {
    setListLoading(true);
    setReloadKey((key) => key + 1);
  };

  const changeFilter = (apply: () => void) => {
    apply();
    setPage(1);
    setListLoading(true);
  };

  // ───────── Review status actions ─────────
  const [busyTorId, setBusyTorId] = useState<string | null>(null);
  const [torToDelete, setTorToDelete] = useState<AdminTorItem | null>(null);

  const handleStatusAction = async (tor: AdminTorItem, action: "verify" | "archive" | "delete") => {
    setBusyTorId(tor.id);
    try {
      const result = await changeAdminTorStatus(tor.id, action);
      onToast(result.message);
      reloadList();
      onChanged();
    } catch (error) {
      onToast(errorMessage(error), "error");
    } finally {
      setBusyTorId(null);
      setTorToDelete(null);
    }
  };

  // ───────── Edit modal ─────────
  const [editing, setEditing] = useState<AdminTorDetail | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    category: "",
    budgetBaht: "",
    technologies: "",
    scope: "",
    bidderQualifications: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = async (tor: AdminTorItem) => {
    setEditLoadingId(tor.id);
    try {
      const detail = await fetchAdminTor(tor.id);
      setEditing(detail);
      setEditForm({
        category: detail.category,
        budgetBaht: detail.budgetBaht === null ? "" : String(detail.budgetBaht),
        technologies: detail.technologies.join(", "),
        scope: detail.scope ?? "",
        bidderQualifications: detail.bidderQualifications.join("\n"),
      });
    } catch (error) {
      onToast(errorMessage(error), "error");
    } finally {
      setEditLoadingId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;

    const budgetText = editForm.budgetBaht.trim();
    const budget = budgetText === "" ? null : Number(budgetText.replace(/,/g, ""));
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
      onToast("งบประมาณต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป", "error");
      return;
    }

    // Send only what changed, so the audit log records the real edit
    const input: AdminTorUpdateInput = {};
    if (editForm.category !== editing.category) input.category = editForm.category;
    if (budget !== editing.budgetBaht) input.budgetBaht = budget;
    const technologies = splitList(editForm.technologies, /[,\n]/);
    if (!sameList(technologies, editing.technologies)) input.technologies = technologies;
    const scope = editForm.scope.trim() || null;
    if (scope !== editing.scope) input.scope = scope;
    const qualifications = splitList(editForm.bidderQualifications, /\n/);
    if (!sameList(qualifications, editing.bidderQualifications)) {
      input.bidderQualifications = qualifications;
    }

    if (Object.keys(input).length === 0) {
      setEditing(null);
      return;
    }

    setEditSaving(true);
    try {
      const result = await updateAdminTor(editing.id, input);
      onToast(result.message);
      setEditing(null);
      reloadList();
      onChanged();
    } catch (error) {
      onToast(errorMessage(error), "error");
    } finally {
      setEditSaving(false);
    }
  };

  // Active categories can be assigned; a TOR already on a hidden one keeps it as an option.
  const editCategoryOptions = editing
    ? categories.filter((c) => c.isActive || c.key === editing.category)
    : [];

  const runStatus = lastRun ? RUN_STATUS_CONFIG[lastRun.status] : null;
  const tors = torPage?.tors ?? [];
  const totalPages = torPage?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#2d2d2d] md:text-3xl">
          จัดการประกาศจัดซื้อจัดจ้าง (TOR Management)
        </h1>
        <p className="text-sm text-[#7a8b6f]">
          ตรวจสอบ แก้ไข และจัดสถานะประกาศ TOR ที่ดึงจากระบบ e-GP
        </p>
      </div>

      {/* e-GP sync */}
      <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#2d2d2d]">การดึงข้อมูลจาก GovSpending (e-GP)</h2>
              {runStatus && (
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${runStatus.badge}`}>
                  {isRunning ? RUN_STATUS_CONFIG.running.label : runStatus.label}
                </span>
              )}
            </div>
            {syncError ? (
              <p className="mt-1 text-xs text-rose-600">{syncError}</p>
            ) : lastRun ? (
              <div className="mt-1 space-y-0.5 text-xs text-[#7a8b6f]">
                <p>
                  รอบล่าสุด{lastRun.trigger === "manual" ? " (สั่งดึงเอง)" : " (ตามรอบเวลา)"} เริ่ม{" "}
                  {formatRelativeTime(lastRun.startedAt)}
                  {lastRun.finishedAt && ` · เสร็จ ${formatThaiDateTime(lastRun.finishedAt)}`}
                </p>
                <p>
                  พบ {lastRun.fetchedCount.toLocaleString("th-TH")} โครงการ · ใหม่{" "}
                  {lastRun.createdCount.toLocaleString("th-TH")} · มีอยู่แล้ว{" "}
                  {lastRun.existingCount.toLocaleString("th-TH")}
                </p>
                {lastRun.errorMessage && <p className="text-rose-600">{lastRun.errorMessage}</p>}
              </div>
            ) : (
              <p className="mt-1 text-xs text-[#7a8b6f]">ยังไม่เคยดึงข้อมูล</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => void loadSyncStatus()}
              className="rounded-xl border border-[#e8e0d0] p-2 text-[#5c5446] hover:bg-[#faf7f2]"
              title="รีเฟรชสถานะ"
            >
              <ArrowPathIcon className="size-4" />
            </button>
            <button
              onClick={() => void handleSync()}
              disabled={isRunning || syncStarting}
              className="rounded-xl bg-[#4a7c59] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#3b6647] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunning || syncStarting ? "กำลังดึงข้อมูล..." : "สั่งดึงข้อมูลทันที"}
            </button>
          </div>
        </div>

        {stats && (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: "TOR ในระบบ (ไม่รวมที่ลบ)", value: stats.tors.total },
                { label: "เข้าระบบสัปดาห์นี้", value: stats.tors.newThisWeek },
                { label: "ประกาศผู้ชนะแล้ว", value: stats.tors.awarded },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl border border-[#e8e0d0] p-4 text-center">
                  <p className="text-xs text-[#8a8070]">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold text-[#4a7c59]">
                    {card.value.toLocaleString("th-TH")} รายการ
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
              <span className="text-[#998f80]">งานประมวลผล TOR:</span>
              {[
                { label: "รอคิว", value: stats.ingestionJobs.queued },
                { label: "กำลังทำ", value: stats.ingestionJobs.processing },
                { label: "สำเร็จ", value: stats.ingestionJobs.completed },
                { label: "ไม่ใช่งานซอฟต์แวร์", value: stats.ingestionJobs.rejected },
                { label: "ต้องตรวจเอง", value: stats.ingestionJobs.reviewRequired },
                { label: "ล้มเหลว", value: stats.ingestionJobs.failed },
              ].map((job) => (
                <span
                  key={job.label}
                  className="rounded-full bg-[#f5f0e8] px-2.5 py-0.5 font-medium text-[#5c5446]"
                >
                  {job.label} {job.value.toLocaleString("th-TH")}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-3xl border border-[#e8e0d0] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-[#8a8070]" />
            <input
              id="admin-tor-search"
              type="text"
              value={searchInput}
              onChange={(e) => changeFilter(() => setSearchInput(e.target.value))}
              placeholder="ค้นหาตามชื่อโครงการ..."
              className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] py-2 pl-10 pr-4 text-sm text-[#2d2d2d] placeholder-[#998f80] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="admin-tor-status"
              value={statusFilter}
              onChange={(e) =>
                changeFilter(() => setStatusFilter(e.target.value as TorReviewStatus | "all"))
              }
              className="rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-3.5 py-2 text-sm text-[#5c5446] focus:border-[#4a7c59] focus:outline-none"
            >
              <option value="all">ทุกสถานะ (ไม่รวมที่ลบ)</option>
              <option value="unverified">รอตรวจสอบ</option>
              <option value="verified">ตรวจสอบแล้ว</option>
              <option value="archived">เก็บเข้าคลัง</option>
              <option value="deleted">ลบแล้ว</option>
            </select>
            <select
              id="admin-tor-category"
              value={categoryFilter}
              onChange={(e) => changeFilter(() => setCategoryFilter(e.target.value))}
              className="rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-3.5 py-2 text-sm text-[#5c5446] focus:border-[#4a7c59] focus:outline-none"
            >
              <option value="">ทุกหมวดหมู่</option>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                  {c.isActive ? "" : " (ซ่อนอยู่)"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TOR table */}
      <div className="overflow-hidden rounded-3xl border border-[#e8e0d0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#f0e8dc] bg-[#faf7f2] text-xs font-semibold text-[#7a8b6f]">
                <th className="px-5 py-3.5">โครงการ</th>
                <th className="px-5 py-3.5">หมวดหมู่</th>
                <th className="px-5 py-3.5 text-right">งบประมาณ</th>
                <th className="px-5 py-3.5 text-right">ความมั่นใจ AI</th>
                <th className="px-5 py-3.5">สถานะ</th>
                <th className="px-5 py-3.5 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e8dc]">
              {listError ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-rose-600">
                    {listError}
                  </td>
                </tr>
              ) : listLoading && !torPage ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-[#8a8070]">
                    กำลังโหลดรายการ TOR...
                  </td>
                </tr>
              ) : tors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-[#8a8070]">
                    ไม่พบ TOR ที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                tors.map((tor) => {
                  const status = REVIEW_STATUS_CONFIG[tor.reviewStatus];
                  const busy = busyTorId === tor.id;
                  const isDeleted = tor.reviewStatus === "deleted";
                  return (
                    <tr
                      key={tor.id}
                      className={`transition hover:bg-[#faf7f2]/60 ${listLoading ? "opacity-60" : ""}`}
                    >
                      <td className="max-w-md px-5 py-4">
                        <a
                          href={`/tor/${tor.id}`}
                          className="line-clamp-2 font-semibold text-[#2d2d2d] hover:text-[#4a7c59] hover:underline"
                        >
                          {tor.projectTitle}
                        </a>
                        <div className="mt-0.5 truncate text-xs text-[#8a8070]">
                          {tor.externalId}
                          {tor.agencyName && ` · ${tor.agencyName}`}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-[#5c5446]">{tor.categoryLabel}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-xs tabular-nums text-[#5c5446]">
                        {formatBaht(tor.budgetBaht)}
                        {tor.budgetSource === "mid_price" && (
                          <div className="text-[10px] text-[#998f80]">(ราคากลาง)</div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right text-xs tabular-nums text-[#5c5446]">
                        {Math.round(tor.confidence * 100)}%
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.badge}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {!isDeleted && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => void openEdit(tor)}
                              disabled={busy || editLoadingId === tor.id}
                              className="rounded-lg border border-[#e8e0d0] p-1.5 text-[#7a8b6f] hover:bg-[#faf7f2] hover:text-[#2d2d2d] disabled:opacity-50"
                              title="แก้ไขข้อมูล"
                            >
                              <PencilSquareIcon className="size-4" />
                            </button>
                            {tor.reviewStatus !== "verified" && (
                              <button
                                onClick={() => void handleStatusAction(tor, "verify")}
                                disabled={busy}
                                className="rounded-lg border border-emerald-200 p-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                title="ยืนยันว่าข้อมูลถูกต้อง"
                              >
                                <CheckBadgeIcon className="size-4" />
                              </button>
                            )}
                            {tor.reviewStatus !== "archived" && (
                              <button
                                onClick={() => void handleStatusAction(tor, "archive")}
                                disabled={busy}
                                className="rounded-lg border border-[#e8e0d0] p-1.5 text-[#7a8b6f] hover:bg-[#faf7f2] disabled:opacity-50"
                                title="เก็บเข้าคลัง (ซ่อนจากหน้าผู้ใช้)"
                              >
                                <ArchiveBoxIcon className="size-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setTorToDelete(tor)}
                              disabled={busy}
                              className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                              title="ลบ TOR"
                            >
                              <TrashIcon className="size-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#f0e8dc] px-5 py-3 text-xs text-[#7a8b6f]">
            <span>
              หน้า {page} จาก {totalPages} · ทั้งหมด {(torPage?.total ?? 0).toLocaleString("th-TH")} รายการ
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  setListLoading(true);
                }}
                disabled={page <= 1}
                className="rounded-lg border border-[#e8e0d0] px-3 py-1 font-semibold hover:bg-[#faf7f2] disabled:opacity-40"
              >
                ก่อนหน้า
              </button>
              <button
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1));
                  setListLoading(true);
                }}
                disabled={page >= totalPages}
                className="rounded-lg border border-[#e8e0d0] px-3 py-1 font-semibold hover:bg-[#faf7f2] disabled:opacity-40"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {torToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-[#2d2d2d]">ลบ TOR {torToDelete.externalId}</h3>
            <p className="mt-2 text-sm text-[#6e6456]">{torToDelete.projectTitle}</p>
            <p className="mt-3 text-sm text-[#6e6456]">
              TOR จะหายจากทุกหน้าของผู้ใช้ และย้อนกลับจากหน้านี้ไม่ได้ ข้อมูลยังเก็บอยู่ในฐานข้อมูล
              หากแค่ต้องการซ่อนชั่วคราว ให้ใช้ &quot;เก็บเข้าคลัง&quot; แทน
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setTorToDelete(null)}
                className="rounded-xl border border-[#e8e0d0] px-4 py-2 text-sm font-medium text-[#5c5446] hover:bg-[#faf7f2]"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => void handleStatusAction(torToDelete, "delete")}
                disabled={busyTorId === torToDelete.id}
                className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
              >
                ลบ TOR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-fade-in">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-[#e8e0d0] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#f0e8dc] p-6 pb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-[#2d2d2d]">แก้ไขข้อมูล TOR</h3>
                <p className="mt-0.5 line-clamp-2 text-xs text-[#7a8b6f]">
                  {editing.externalId} · {editing.projectTitle}
                </p>
                <a
                  href={editing.detailUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs font-semibold text-[#4a7c59] hover:underline"
                >
                  เปิดประกาศต้นฉบับบน e-GP ↗
                </a>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-[#8a8070] hover:bg-[#faf7f2] hover:text-[#2d2d2d]"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-6">
              <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                เมื่อบันทึกแล้ว การดึงข้อมูลรอบต่อไปจะไม่เขียนทับข้อมูลที่ AI สกัดของ TOR นี้
                การเลือกหมวดหมู่เองจะล็อกหมวดหมู่ไว้
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-tor-category" className="mb-1.5 block text-xs font-bold text-[#7a8b6f]">
                    หมวดหมู่หลัก
                  </label>
                  <select
                    id="edit-tor-category"
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-3.5 py-2 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:outline-none"
                  >
                    {!editCategoryOptions.some((c) => c.key === editForm.category) && (
                      <option value={editForm.category}>{editing.categoryLabel}</option>
                    )}
                    {editCategoryOptions.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.name}
                        {c.isActive ? "" : " (ซ่อนอยู่)"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-tor-budget" className="mb-1.5 block text-xs font-bold text-[#7a8b6f]">
                    งบประมาณ (บาท)
                  </label>
                  <input
                    id="edit-tor-budget"
                    type="text"
                    inputMode="decimal"
                    value={editForm.budgetBaht}
                    onChange={(e) => setEditForm((f) => ({ ...f, budgetBaht: e.target.value }))}
                    placeholder="เว้นว่างถ้าไม่ทราบ"
                    className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-2 text-sm tabular-nums text-[#2d2d2d] placeholder-[#998f80] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-tor-technologies" className="mb-1.5 block text-xs font-bold text-[#7a8b6f]">
                  เทคโนโลยี (คั่นด้วยจุลภาค)
                </label>
                <input
                  id="edit-tor-technologies"
                  type="text"
                  value={editForm.technologies}
                  onChange={(e) => setEditForm((f) => ({ ...f, technologies: e.target.value }))}
                  className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-2 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                />
              </div>

              <div>
                <label htmlFor="edit-tor-scope" className="mb-1.5 block text-xs font-bold text-[#7a8b6f]">
                  ขอบเขตงาน
                </label>
                <textarea
                  id="edit-tor-scope"
                  value={editForm.scope}
                  onChange={(e) => setEditForm((f) => ({ ...f, scope: e.target.value }))}
                  rows={3}
                  className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-2 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                />
              </div>

              <div>
                <label htmlFor="edit-tor-qualifications" className="mb-1.5 block text-xs font-bold text-[#7a8b6f]">
                  คุณสมบัติผู้ยื่นข้อเสนอ (บรรทัดละ 1 ข้อ)
                </label>
                <textarea
                  id="edit-tor-qualifications"
                  value={editForm.bidderQualifications}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, bidderQualifications: e.target.value }))
                  }
                  rows={5}
                  className="w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-2 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                />
              </div>

              <p className="text-[11px] text-[#998f80]">
                AI: {editing.analysisModel} ({editing.analysisVersion}) · วิเคราะห์เมื่อ{" "}
                {formatThaiDateTime(editing.analyzedAt)} · ความมั่นใจ{" "}
                {Math.round(editing.confidence * 100)}%
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#f0e8dc] p-6 pt-4">
              <button
                onClick={() => setEditing(null)}
                className="rounded-xl border border-[#e8e0d0] px-4 py-2 text-sm font-medium text-[#5c5446] hover:bg-[#faf7f2]"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => void handleSaveEdit()}
                disabled={editSaving}
                className="rounded-xl bg-[#4a7c59] px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#3b6647] disabled:opacity-60"
              >
                {editSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
