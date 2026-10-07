"use client";

import { useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import Link from "next/link";
import dynamic from "next/dynamic";
import { SiteNav } from "@/app/components/site_nav";
import { useProcurementList, useReportCharts, useReportDepartments } from "@/hooks/use-reports";
import {
  exportProcurementCsv,
  formatBahtCurrency,
  formatSnapshotDate,
  formatThaiMonth,
  type ProcurementSortField,
  type ReportFilters,
  type ReportPeriod,
  type SavingsBucketKey,
} from "@/api/reports.api";
import {
  BanknotesIcon,
  ChartBarIcon,
  ArrowTrendingDownIcon,
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  MagnifyingGlassIcon,
  ChevronUpDownIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  SparklesIcon,
  BuildingLibraryIcon,
  InformationCircleIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";

// ───────── Chart data shapes ─────────
interface CategoryBarPoint {
  categoryLabel: string;
  projectCount: number;
  avgMidMillion: number | null;
  avgAwardedMillion: number | null;
  avgSavingsPct: number | null;
}

interface TimelinePoint {
  label: string;
  month: string;
  projectCount: number;
  midMillion: number;
  awardedMillion: number;
  savingsMillion: number;
  avgSavingsPct: number;
}

interface BucketSlice {
  key: SavingsBucketKey;
  label: string;
  count: number;
  pct: number;
  color: string;
}

const toMillion = (baht: number | null) =>
  baht === null ? null : Math.round((baht / 1_000_000) * 100) / 100;

const BUCKET_COLORS: Record<SavingsBucketKey, string> = {
  over: "#e11d48",
  lt5: "#b0a898",
  "5to10": "#e2904d",
  "10to15": "#4a7c59",
  gt15: "#2d6a4f",
};

// Dynamic imports for Recharts to avoid SSR hydration issues
const DynamicPriceBarChart = dynamic(
  () =>
    import("recharts").then((recharts) => {
      const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } =
        recharts;

      return function PriceBarChartComponent({ data }: { data: CategoryBarPoint[] }) {
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 15, right: 15, left: -10, bottom: 25 }} barGap={6}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--color-border)"
                opacity={0.4}
              />
              <XAxis
                dataKey="categoryLabel"
                tick={{ fontSize: 11, fill: "var(--color-foreground)" }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={60}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: number) => `฿${val}M`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0]?.payload as CategoryBarPoint | undefined;
                  if (!item) return null;
                  return (
                    <div className="rounded-xl border border-border bg-surface p-3.5 shadow-xl">
                      <p className="font-semibold text-sm text-foreground">{label}</p>
                      {item.projectCount === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">ยังไม่มีโครงการที่จบแล้วในหมวดนี้</p>
                      ) : (
                        <div className="mt-2 space-y-1 text-xs">
                          <p className="text-muted-foreground">
                            เฉลี่ยต่อโครงการ จาก {item.projectCount} โครงการ
                          </p>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">ราคากลาง:</span>
                            <span className="font-mono font-medium">฿{item.avgMidMillion?.toFixed(2)} ล้าน</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">ราคาที่ชนะ:</span>
                            <span className="font-mono font-semibold text-primary">
                              ฿{item.avgAwardedMillion?.toFixed(2)} ล้าน
                            </span>
                          </div>
                          <div className="pt-1.5 mt-1.5 border-t border-border flex items-center justify-between gap-4 font-medium">
                            <span className="text-emerald-700">ส่วนต่างเฉลี่ย:</span>
                            <span className="font-mono text-emerald-700">{item.avgSavingsPct}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: "10px", fontSize: "12px" }}
              />
              <Bar
                dataKey="avgMidMillion"
                name="ราคากลางเฉลี่ย (ล้านบาท)"
                fill="#e2904dff"
                radius={[5, 5, 0, 0]}
              />
              <Bar
                dataKey="avgAwardedMillion"
                name="ราคาที่ชนะเฉลี่ย (ล้านบาท)"
                fill="#4a7c59"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );
      };
    }),
  { ssr: false }
);

const DynamicTimelineAreaChart = dynamic(
  () =>
    import("recharts").then((recharts) => {
      const { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } =
        recharts;

      return function TimelineAreaChartComponent({ data }: { data: TimelinePoint[] }) {
        if (!data.length) {
          return (
            <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
              ไม่มีข้อมูลไทม์ไลน์สำหรับเงื่อนไขการค้นหาที่เลือก
            </div>
          );
        }

        return (
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={data} margin={{ top: 15, right: 25, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorMedian" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8c827a" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8c827a" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="colorWinning" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2d6a4f" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#2d6a4f" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                tickFormatter={(val: number) => `฿${val}M`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0]?.payload as TimelinePoint | undefined;
                  if (!item) return null;
                  return (
                    <div className="rounded-xl border border-border bg-surface p-3.5 shadow-xl text-xs max-w-sm">
                      <div className="flex items-center justify-between gap-2 border-b border-border pb-2 mb-2">
                        <span className="font-semibold text-foreground">{item.label}</span>
                        <span className="text-[11px] font-mono text-muted-foreground bg-surface-2 px-2 py-0.5 rounded">
                          {item.projectCount} โครงการ
                        </span>
                      </div>
                      <div className="space-y-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between gap-4 text-muted-foreground">
                          <span>ราคากลางรวม:</span>
                          <span className="font-medium text-foreground">฿{item.midMillion.toFixed(2)} ล้าน</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-muted-foreground">
                          <span>ราคาที่ชนะรวม:</span>
                          <span className="font-medium text-emerald-700">
                            ฿{item.awardedMillion.toFixed(2)} ล้าน
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-border/60 text-emerald-800 font-semibold">
                          <span>ส่วนต่าง:</span>
                          <span>
                            ฿{item.savingsMillion.toFixed(2)}M (เฉลี่ย {item.avgSavingsPct}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ paddingTop: 14, fontSize: 12 }} iconType="circle" />
              <Area
                type="monotone"
                dataKey="midMillion"
                name="ราคากลางรวม (ล้านบาท)"
                stroke="#e19b62ff"
                strokeWidth={2.5}
                fill="url(#colorMedian)"
                dot={{ r: 3, fill: "#d7945eff" }}
                activeDot={{ r: 6 }}
              />
              <Area
                type="monotone"
                dataKey="awardedMillion"
                name="ราคาที่ชนะรวม (ล้านบาท)"
                stroke="#2d6a4f"
                strokeWidth={2.5}
                fill="url(#colorWinning)"
                dot={{ r: 3, fill: "#2d6a4f" }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="savingsMillion"
                name="ส่วนต่างที่ประหยัดได้ (ล้านบาท)"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: "#10b981" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      };
    }),
  { ssr: false }
);

const DynamicBracketDonutChart = dynamic(
  () =>
    import("recharts").then((recharts) => {
      const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } = recharts;

      return function BracketDonutChartComponent({ data }: { data: BucketSlice[] }) {
        const slices = data.filter((slice) => slice.count > 0);
        if (!slices.length) {
          return (
            <div className="flex h-[260px] items-center justify-center text-xs text-muted-foreground">
              ไม่มีโครงการตามเงื่อนไขที่เลือก
            </div>
          );
        }
        return (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {slices.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0]?.payload as BucketSlice | undefined;
                  if (!item) return null;
                  return (
                    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-lg text-xs">
                      <span className="font-medium text-foreground">{item.label}</span>:{" "}
                      <span className="font-bold text-primary">{item.count} โครงการ</span> ({item.pct}%)
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        );
      };
    }),
  { ssr: false }
);

type SortKey = Exclude<ProcurementSortField, "announceDate">;
type SortOrder = "asc" | "desc";

const PAGE_SIZE = 10;

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "3y", label: "3 ปีล่าสุด" },
  { value: "1y", label: "1 ปีล่าสุด" },
  { value: "6m", label: "6 เดือนล่าสุด" },
];

// Smallest number of projects a category needs before the insight card calls it the best saver
const MIN_PROJECTS_FOR_INSIGHT = 5;

export default function ReportsDashboardPage() {
  // Filters
  const [period, setPeriod] = useState<ReportPeriod>("all");
  const [category, setCategory] = useState("");
  const [department, setDepartment] = useState("");
  const [savingsBucket, setSavingsBucket] = useState<SavingsBucketKey | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch] = useDebounce(searchInput, 400);

  // Table
  const [sortKey, setSortKey] = useState<ProcurementSortField>("announceDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const filters: ReportFilters = useMemo(
    () => ({
      period,
      category: category || undefined,
      department: department || undefined,
      q: debouncedSearch.trim() || undefined,
      savingsBucket: savingsBucket || undefined,
    }),
    [period, category, department, debouncedSearch, savingsBucket]
  );

  const charts = useReportCharts(filters);
  const list = useProcurementList(filters, {
    page: currentPage,
    pageSize: PAGE_SIZE,
    sortBy: sortKey,
    sortOrder,
  });
  const { data: departments = [] } = useReportDepartments();

  const overview = charts.overview.data?.data;
  const source = charts.overview.data?.source ?? null;
  const categoryRows = useMemo(
    () => charts.categories.data?.data.categories ?? [],
    [charts.categories.data]
  );
  const buckets = useMemo(
    () => charts.distribution.data?.data.buckets ?? [],
    [charts.distribution.data]
  );
  const months = useMemo(() => charts.timeline.data?.data.months ?? [], [charts.timeline.data]);
  const page = list.data?.data;

  const loadError =
    charts.overview.error ?? charts.categories.error ?? charts.distribution.error ?? charts.timeline.error;
  const noSnapshot = charts.overview.isSuccess && source === null;

  const categoryBars: CategoryBarPoint[] = useMemo(
    () =>
      categoryRows.map((row) => ({
        categoryLabel: row.category_label,
        projectCount: row.project_count,
        avgMidMillion: toMillion(row.avg_mid_price_baht),
        avgAwardedMillion: toMillion(row.avg_awarded_price_baht),
        avgSavingsPct: row.avg_savings_pct,
      })),
    [categoryRows]
  );

  const timelinePoints: TimelinePoint[] = useMemo(
    () =>
      months.map((month) => ({
        label: formatThaiMonth(month.month),
        month: month.month,
        projectCount: month.project_count,
        midMillion: toMillion(month.total_mid_price_baht) ?? 0,
        awardedMillion: toMillion(month.total_awarded_price_baht) ?? 0,
        savingsMillion: toMillion(month.total_savings_baht) ?? 0,
        avgSavingsPct: month.avg_savings_pct,
      })),
    [months]
  );

  const bucketSlices: BucketSlice[] = useMemo(
    () => buckets.map((bucket) => ({ ...bucket, color: BUCKET_COLORS[bucket.key] })),
    [buckets]
  );

  // Category with the highest average savings, among those with enough projects to mean something
  const bestCategory = useMemo(() => {
    const candidates = categoryRows.filter(
      (row) => row.project_count >= MIN_PROJECTS_FOR_INSIGHT && row.avg_savings_pct !== null
    );
    return candidates.sort((a, b) => (b.avg_savings_pct ?? 0) - (a.avg_savings_pct ?? 0))[0] ?? null;
  }, [categoryRows]);
  const overBudgetCount = buckets.find((bucket) => bucket.key === "over")?.count ?? 0;

  // Changing any filter starts the table from page 1
  const withPageReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setCurrentPage(1);
    };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const hasFilters =
    period !== "all" || Boolean(category) || Boolean(department) || Boolean(savingsBucket) || Boolean(searchInput);

  const handleResetFilters = () => {
    setPeriod("all");
    setCategory("");
    setDepartment("");
    setSavingsBucket("");
    setSearchInput("");
    setCurrentPage(1);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await exportProcurementCsv(
        filters,
        sortKey,
        sortOrder,
        `tor-price-analysis-${new Date().toISOString().slice(0, 10)}.csv`
      );
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "ส่งออก CSV ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const totalPages = page?.total_pages ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <SiteNav />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        {/* Breadcrumbs & Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
          <div>
            <nav className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-2">
              <Link href="/" className="hover:text-foreground transition-colors">
                หน้าแรก
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">รายงานการวิเคราะห์ราคา</span>
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-display">
                วิเคราะห์ราคากลาง vs ราคาที่ชนะการประมูล
              </h1>
              {source && (
                <span
                  className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary border border-primary/20"
                  title={`ข้อมูลจาก ${source.collection}`}
                >
                  ข้อมูล ณ {formatSnapshotDate(source.snapshot_date)}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-3xl">
              เปรียบเทียบราคากลางกับราคาที่ชนะการประมูลของโครงการซอฟต์แวร์ภาครัฐที่ทำสัญญาแล้ว
              {source && ` (${source.project_count.toLocaleString("th-TH")} โครงการ)`}{" "}
              เพื่อใช้ประเมินราคาและความคุ้มค่าของงานลักษณะเดียวกัน
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 print:hidden">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => void handleExportCsv()}
                disabled={exporting || noSnapshot || !overview?.project_count}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-xs sm:text-sm font-medium hover:bg-surface-2 transition-colors shadow-sm disabled:opacity-50"
                title="ส่งออกโครงการตามตัวกรองเป็นไฟล์ CSV"
              >
                <ArrowDownTrayIcon className="size-4 text-muted-foreground" />
                <span>{exporting ? "กำลังส่งออก..." : "ส่งออก CSV"}</span>
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs sm:text-sm font-medium hover:bg-surface-2 transition-colors shadow-sm"
                title="พิมพ์รายงาน"
              >
                <PrinterIcon className="size-4 text-muted-foreground" />
                <span className="hidden sm:inline">พิมพ์</span>
              </button>
            </div>
            {exportError && <p className="text-xs text-rose-600">{exportError}</p>}
          </div>
        </div>

        {loadError && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            โหลดรายงานไม่สำเร็จ: {loadError.message}
          </div>
        )}

        {noSnapshot ? (
          <section className="mt-8 panel flex flex-col items-center gap-2 px-6 py-16 text-center">
            <InformationCircleIcon className="size-10 text-muted-foreground/60" />
            <p className="text-base font-semibold text-foreground">ยังไม่มีข้อมูลโครงการที่ทำสัญญาแล้ว</p>
            <p className="max-w-lg text-sm text-muted-foreground">
              รายงานนี้คำนวณจากโครงการที่ประกาศผู้ชนะและมีทั้งราคากลางและราคาที่ชนะ
              เมื่อมีข้อมูลชุดแรก รายงานจะแสดงที่นี่
            </p>
          </section>
        ) : (
          <>
            {/* ── Summary KPI Cards (4 Cards) ── */}
            <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="panel p-5 relative overflow-hidden transition-all hover:shadow-md print:break-inside-avoid">
                <div className="flex items-center justify-between">
                  <span className="label-eyebrow">ราคากลางรวม</span>
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                    <BanknotesIcon className="size-4" />
                  </div>
                </div>
                <p className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
                  {formatBahtCurrency(overview?.total_mid_price_baht)}
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{(overview?.project_count ?? 0).toLocaleString("th-TH")} โครงการ</span>
                  <span className="font-mono">เฉลี่ย {formatBahtCurrency(overview?.avg_mid_price_baht)}</span>
                </div>
              </div>

              <div className="panel p-5 relative overflow-hidden transition-all hover:shadow-md print:break-inside-avoid">
                <div className="flex items-center justify-between">
                  <span className="label-eyebrow">ราคาที่ชนะการประมูลรวม</span>
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheckIcon className="size-4" />
                  </div>
                </div>
                <p className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
                  {formatBahtCurrency(overview?.total_awarded_price_baht)}
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>มูลค่าตามสัญญา</span>
                  <span className="font-mono">เฉลี่ย {formatBahtCurrency(overview?.avg_awarded_price_baht)}</span>
                </div>
              </div>

              <div className="panel p-5 relative overflow-hidden transition-all hover:shadow-md bg-gradient-to-br from-surface to-emerald-50/25 border-emerald-500/20 print:break-inside-avoid">
                <div className="flex items-center justify-between">
                  <span className="label-eyebrow text-emerald-800">ส่วนต่างที่ประหยัดได้</span>
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-800">
                    <ArrowTrendingDownIcon className="size-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="font-display text-2xl font-bold tracking-tight text-emerald-700">
                    {formatBahtCurrency(overview?.total_savings_baht)}
                  </p>
                  {overview?.overall_savings_pct !== null && overview?.overall_savings_pct !== undefined && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 font-mono">
                      {overview.overall_savings_pct}%
                    </span>
                  )}
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>ค่ากลางต่อโครงการ</span>
                  <span className="font-mono text-emerald-700 font-medium">
                    {overview?.median_savings_pct ?? "—"}%
                  </span>
                </div>
              </div>

              <div className="panel p-5 relative overflow-hidden transition-all hover:shadow-md print:break-inside-avoid">
                <div className="flex items-center justify-between">
                  <span className="label-eyebrow">ได้ราคาต่ำกว่าราคากลาง</span>
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                    <ChartBarIcon className="size-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="font-display text-2xl font-bold tracking-tight text-foreground">
                    {overview?.pct_projects_below_reference ?? "—"}%
                  </p>
                  <span className="text-xs text-muted-foreground">ของโครงการ</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>ส่วนต่างสูงสุด</span>
                  <span className="font-mono font-medium text-primary">{overview?.max_savings_pct ?? "—"}%</span>
                </div>
              </div>
            </section>

            {/* ── Interactive Filters Bar ── */}
            <section className="mt-6 panel p-4 print:hidden">
              <div className="flex flex-col gap-3.5 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative flex-1 min-w-[240px]">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    id="report-search"
                    type="text"
                    value={searchInput}
                    onChange={(e) => withPageReset(setSearchInput)(e.target.value)}
                    placeholder="ค้นหาชื่อโครงการ หรือเลขที่โครงการ..."
                    className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-8 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => withPageReset(setSearchInput)("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                      title="ล้างคำค้นหา"
                    >
                      <XMarkIcon className="size-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="report-period" className="text-muted-foreground font-mono text-xs">
                      ช่วงประกาศ:
                    </label>
                    <select
                      id="report-period"
                      value={period}
                      onChange={(e) => withPageReset(setPeriod)(e.target.value as ReportPeriod)}
                      className="h-9 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium focus:border-primary focus:outline-none cursor-pointer"
                    >
                      {PERIOD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label htmlFor="report-category" className="text-muted-foreground font-mono text-xs">
                      หมวดหมู่:
                    </label>
                    <select
                      id="report-category"
                      value={category}
                      onChange={(e) => withPageReset(setCategory)(e.target.value)}
                      className="h-9 max-w-[200px] rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium focus:border-primary focus:outline-none cursor-pointer"
                    >
                      <option value="">ทุกหมวดหมู่งาน</option>
                      {categoryRows.map((row) => (
                        <option key={row.category} value={row.category}>
                          {row.category_label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground font-mono text-xs">หน่วยงาน:</span>
                    <Listbox value={department} onChange={withPageReset(setDepartment)}>
                      <div className="relative">
                        <ListboxButton className="flex h-9 w-[180px] items-center justify-between gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-left text-xs font-medium focus:border-primary focus:outline-none cursor-pointer">
                          <span className="block truncate">{department || "ทุกหน่วยงาน"}</span>
                          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        </ListboxButton>
                        <ListboxOptions
                          anchor="bottom end"
                          transition
                          className="z-50 mt-1 max-h-60 w-[280px] overflow-y-auto rounded-xl border border-border bg-background p-1 shadow-lg focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 [--anchor-gap:4px]"
                        >
                          <ListboxOption
                            value=""
                            className="cursor-pointer rounded-lg px-3 py-2 text-xs data-[focus]:bg-muted data-[selected]:font-semibold"
                          >
                            ทุกหน่วยงาน
                          </ListboxOption>
                          {departments.map((name) => (
                            <ListboxOption
                              key={name}
                              value={name}
                              className="cursor-pointer rounded-lg px-3 py-2 text-xs data-[focus]:bg-muted data-[selected]:font-semibold truncate"
                              title={name}
                            >
                              {name}
                            </ListboxOption>
                          ))}
                        </ListboxOptions>
                      </div>
                    </Listbox>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label htmlFor="report-bucket" className="text-muted-foreground font-mono text-xs">
                      ส่วนต่าง:
                    </label>
                    <select
                      id="report-bucket"
                      value={savingsBucket}
                      onChange={(e) => withPageReset(setSavingsBucket)(e.target.value as SavingsBucketKey | "")}
                      className="h-9 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium focus:border-primary focus:outline-none cursor-pointer"
                    >
                      <option value="">ทุกช่วงส่วนต่าง</option>
                      {buckets.map((bucket) => (
                        <option key={bucket.key} value={bucket.key}>
                          {bucket.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {hasFilters && (
                    <button
                      onClick={handleResetFilters}
                      className="h-9 rounded-xl bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-surface-3"
                    >
                      ล้างตัวกรอง
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                ตัวกรองใช้กับทุกส่วนของหน้า ยกเว้นกราฟเปรียบเทียบตามหมวดที่แสดงทุกหมวดเสมอ
                และกราฟการกระจายตัวที่แสดงทุกช่วงส่วนต่างเสมอ
              </p>
            </section>

            {/* ── Visual Charts Section ── */}
            <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="panel p-5 lg:col-span-8 print:break-inside-avoid">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3.5">
                  <div>
                    <h3 className="font-display text-base font-semibold text-foreground">
                      ราคากลาง vs ราคาที่ชนะ เฉลี่ยต่อโครงการ ตามหมวดหมู่งาน
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ค่าเฉลี่ยต่อหนึ่งโครงการในแต่ละหมวด เพื่อเทียบขนาดงานและส่วนต่างระหว่างหมวด
                    </p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground self-start sm:self-auto bg-surface-2 px-2.5 py-1 rounded-md">
                    หน่วย: ล้านบาท
                  </span>
                </div>

                <div className="mt-4 pt-1">
                  <DynamicPriceBarChart data={categoryBars} />
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-border text-xs">
                  {categoryRows.map((row) => (
                    <div key={row.category} className="rounded-lg bg-surface-2/60 p-2.5">
                      <p className="font-medium text-foreground truncate" title={row.category_label}>
                        {row.category_label}
                      </p>
                      <p className="text-muted-foreground mt-0.5 font-mono">
                        {row.project_count} โครงการ · ส่วนต่าง{" "}
                        <span className="text-emerald-700 font-semibold">
                          {row.avg_savings_pct === null ? "—" : `${row.avg_savings_pct}%`}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel p-5 lg:col-span-4 flex flex-col justify-between print:break-inside-avoid">
                <div>
                  <div className="border-b border-border pb-3.5">
                    <h3 className="font-display text-base font-semibold text-foreground">
                      การกระจายตัวของส่วนต่างราคา
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      สัดส่วนโครงการตามช่วง % ที่ราคาที่ชนะต่ำกว่าราคากลาง
                    </p>
                  </div>
                  <div className="mt-3">
                    <DynamicBracketDonutChart data={bucketSlices} />
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
                  {bucketSlices.map((bucket) => (
                    <div key={bucket.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: bucket.color }} />
                        <span className="text-muted-foreground">{bucket.label}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-medium">{bucket.count} งาน</span>
                        <span className="text-muted-foreground">({bucket.pct}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel p-5 lg:col-span-12 print:break-inside-avoid">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3.5">
                  <div>
                    <h3 className="font-display text-base font-semibold text-foreground">
                      {department
                        ? `แนวโน้มมูลค่าโครงการรายเดือน — ${department}`
                        : "แนวโน้มมูลค่าโครงการรายเดือน"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ราคากลางรวม ราคาที่ชนะรวม และส่วนต่าง แยกตามเดือนที่ประกาศ
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 self-start sm:self-auto text-xs font-mono text-muted-foreground">
                    <span className="bg-surface-2 px-2.5 py-1 rounded-md">หน่วย: ล้านบาท</span>
                    <span className="bg-surface-2 px-2.5 py-1 rounded-md">{timelinePoints.length} เดือน</span>
                  </div>
                </div>
                <div className="mt-4 pt-1">
                  <DynamicTimelineAreaChart data={timelinePoints} />
                </div>
              </div>
            </section>

            {/* ── Key insights, computed from the numbers above ── */}
            {overview && overview.project_count > 0 && (
              <section className="mt-6 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/5 via-surface to-accent/5 p-5 shadow-sm print:break-inside-avoid">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/15 p-2 text-primary">
                    <SparklesIcon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-display text-base font-semibold text-foreground">สรุปจากข้อมูล</h4>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs sm:text-sm text-muted-foreground">
                      {bestCategory && (
                        <div className="rounded-xl bg-surface/80 p-3 border border-border">
                          <p className="font-semibold text-foreground flex items-center gap-1.5">
                            <CheckCircleIcon className="size-4 text-primary" />
                            หมวดที่ส่วนต่างเฉลี่ยสูงสุด
                          </p>
                          <p className="mt-1 leading-relaxed">
                            <strong className="text-foreground">{bestCategory.category_label}</strong>{" "}
                            ราคาที่ชนะต่ำกว่าราคากลางเฉลี่ย{" "}
                            <strong className="text-emerald-700">{bestCategory.avg_savings_pct}%</strong> (จาก{" "}
                            {bestCategory.project_count} โครงการ)
                          </p>
                        </div>
                      )}
                      <div className="rounded-xl bg-surface/80 p-3 border border-border">
                        <p className="font-semibold text-foreground flex items-center gap-1.5">
                          <CheckCircleIcon className="size-4 text-primary" />
                          ส่วนต่างรวม
                        </p>
                        <p className="mt-1 leading-relaxed">
                          {overview.project_count.toLocaleString("th-TH")} โครงการ ได้ราคาต่ำกว่าราคากลางรวม{" "}
                          <strong className="text-emerald-700">{formatBahtCurrency(overview.total_savings_baht)}</strong>{" "}
                          หรือ <strong className="text-foreground">{overview.overall_savings_pct}%</strong>{" "}
                          ของราคากลางทั้งหมด
                        </p>
                      </div>
                      <div className="rounded-xl bg-surface/80 p-3 border border-border">
                        <p className="font-semibold text-foreground flex items-center gap-1.5">
                          <CheckCircleIcon className="size-4 text-primary" />
                          ส่วนต่างที่พบบ่อย
                        </p>
                        <p className="mt-1 leading-relaxed">
                          ครึ่งหนึ่งของโครงการได้ส่วนต่างไม่เกิน{" "}
                          <strong className="text-foreground">{overview.median_savings_pct}%</strong>
                          {overBudgetCount > 0 && (
                            <>
                              {" "}
                              และมี <strong className="text-rose-700">{overBudgetCount} โครงการ</strong>{" "}
                              ที่ราคาที่ชนะสูงกว่าราคากลาง
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ── Detailed Procurement Project Table ── */}
            <section className="mt-8 panel overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-border">
                <div>
                  <h3 className="font-display text-base font-semibold text-foreground">
                    รายการโครงการที่ทำสัญญาแล้ว
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(page?.total_count ?? 0).toLocaleString("th-TH")} โครงการตามตัวกรอง
                    ลิงก์ไปยังประกาศต้นฉบับบน e-GP
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSortKey("announceDate");
                    setSortOrder(sortKey === "announceDate" && sortOrder === "desc" ? "asc" : "desc");
                    setCurrentPage(1);
                  }}
                  className="inline-flex items-center gap-1 self-start rounded-lg border border-border px-2.5 py-1 text-xs font-mono text-muted-foreground hover:text-foreground"
                >
                  เรียงตามวันประกาศ
                  {sortKey === "announceDate" && (sortOrder === "desc" ? " (ใหม่ก่อน)" : " (เก่าก่อน)")}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-surface-2/60 text-muted-foreground border-b border-border font-mono text-xs">
                    <tr>
                      {(
                        [
                          { key: "projectTitle", label: "โครงการ", align: "" },
                          { key: null, label: "หน่วยงาน", align: "" },
                          { key: "midPriceBaht", label: "ราคากลาง", align: "text-right" },
                          { key: "awardedPriceBaht", label: "ราคาที่ชนะ", align: "text-right" },
                          { key: "savings_amount", label: "ส่วนต่าง", align: "text-right" },
                          { key: "savings_pct", label: "% ส่วนต่าง", align: "text-center" },
                        ] as { key: SortKey | null; label: string; align: string }[]
                      ).map((column) => (
                        <th key={column.label} scope="col" className={`px-4 py-3.5 font-medium first:px-5 ${column.align}`}>
                          {column.key ? (
                            <button
                              onClick={() => handleSort(column.key!)}
                              className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
                                sortKey === column.key ? "text-foreground" : ""
                              }`}
                            >
                              {column.label}
                              <ChevronUpDownIcon className="size-3.5" />
                            </button>
                          ) : (
                            column.label
                          )}
                        </th>
                      ))}
                      <th scope="col" className="px-4 py-3.5 font-medium text-center print:hidden">
                        ต้นฉบับ
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y divide-border ${list.isFetching ? "opacity-60" : ""}`}>
                    {list.error ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-sm text-rose-600">
                          {list.error.message}
                        </td>
                      </tr>
                    ) : !page ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                          กำลังโหลดรายการ...
                        </td>
                      </tr>
                    ) : page.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <InformationCircleIcon className="size-8 text-muted-foreground/60" />
                            <p className="text-sm font-medium">ไม่พบโครงการที่ตรงกับเงื่อนไขการค้นหา</p>
                            {hasFilters && (
                              <button
                                onClick={handleResetFilters}
                                className="mt-1 text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                              >
                                ล้างตัวกรองทั้งหมด
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      page.items.map((item) => {
                        const overReference = item.savings_pct < 0;
                        return (
                          <tr
                            key={item.external_id}
                            className="hover:bg-surface-2/40 transition-colors print:break-inside-avoid"
                          >
                            <td className="px-5 py-4 max-w-sm">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground font-mono">
                                  {item.category_label}
                                </span>
                                <span className="font-mono text-[11px] text-muted-foreground">{item.external_id}</span>
                                {item.announce_date && (
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    · {formatThaiMonth(item.announce_date.slice(0, 7))}
                                  </span>
                                )}
                              </div>
                              <p className="font-medium text-foreground line-clamp-2">{item.project_title}</p>
                            </td>

                            <td className="px-4 py-4 text-muted-foreground text-xs">
                              <div className="flex items-center gap-1.5">
                                <BuildingLibraryIcon className="size-3.5 shrink-0 text-muted-foreground/80" />
                                <span className="line-clamp-2">{item.department_name ?? item.agency_name ?? "—"}</span>
                              </div>
                            </td>

                            <td className="px-4 py-4 text-right font-mono font-medium text-foreground whitespace-nowrap">
                              ฿{item.mid_price_baht.toLocaleString("th-TH")}
                            </td>
                            <td className="px-4 py-4 text-right font-mono font-semibold text-primary whitespace-nowrap">
                              ฿{item.awarded_price_baht.toLocaleString("th-TH")}
                            </td>
                            <td
                              className={`px-4 py-4 text-right font-mono font-medium whitespace-nowrap ${
                                overReference ? "text-rose-700" : "text-emerald-700"
                              }`}
                            >
                              {formatBahtCurrency(item.savings_amount_baht)}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-mono font-semibold ${
                                  overReference
                                    ? "bg-rose-50 text-rose-700"
                                    : item.savings_pct >= 15
                                      ? "bg-emerald-100 text-emerald-800"
                                      : item.savings_pct >= 5
                                        ? "bg-primary/15 text-primary"
                                        : "bg-surface-2 text-muted-foreground"
                                }`}
                                title={overReference ? "ราคาที่ชนะสูงกว่าราคากลาง" : undefined}
                              >
                                {overReference ? `+${Math.abs(item.savings_pct)}%` : `-${item.savings_pct}%`}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center print:hidden">
                              {item.detail_url ? (
                                <a
                                  href={item.detail_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-2 hover:border-primary transition-colors text-foreground"
                                >
                                  <span className="whitespace-nowrap">e-GP</span>
                                  <ArrowTopRightOnSquareIcon className="size-3.5" />
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
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
                <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs">
                  <div className="text-muted-foreground">
                    หน้า <span className="font-semibold text-foreground">{currentPage}</span> จาก{" "}
                    <span className="font-semibold text-foreground">{totalPages}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-lg border border-border p-1.5 hover:bg-surface-2 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      aria-label="หน้าก่อนหน้า"
                    >
                      <ChevronLeftIcon className="size-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="rounded-lg border border-border p-1.5 hover:bg-surface-2 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      aria-label="หน้าถัดไป"
                    >
                      <ChevronRightIcon className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
