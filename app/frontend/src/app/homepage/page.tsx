"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import { SiteNav } from "@/app/components/site_nav";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useHomepage } from "@/hooks/use-homepage";
import { formatBudgetSummary, formatLastUpdatedTime } from "@/api/homepage.api";
import { useTorFilterOptions, useTorRecommendations, useTors } from "@/hooks/use-tors";
import { useCategories } from "@/hooks/use-categories";
import { DeadlineBadge } from "@/app/components/deadline_badge";
import { formatThaiDate } from "@/api/reports.api";

// Category labels on the price chart's y axis
const CATEGORY_AXIS_WIDTH = 150;
// Counts characters including Thai vowel and tone marks, which take no width of their own
const CATEGORY_LABEL_MAX_CHARS = 20;

// Splits a Thai label into lines of at most maxChars, breaking between words (Thai has no
// spaces, so Intl.Segmenter finds the word boundaries). A single word longer than maxChars
// stays on its own line.
function wrapLabel(label: string, maxChars: number): string[] {
  const words =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? Array.from(new Intl.Segmenter("th", { granularity: "word" }).segment(label), (s) => s.segment)
      : label.split(/(\s+)/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && (current + word).length > maxChars) {
      lines.push(current.trim());
      current = word.trimStart();
    } else {
      current += word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

// Right-aligned, vertically centred multi-line tick so long category names are not cut off
function WrappedCategoryTick({ x, y, label }: { x: number; y: number; label: string }) {
  const lines = wrapLabel(label, CATEGORY_LABEL_MAX_CHARS);
  return (
    <text x={x - 4} y={y} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">
      {lines.map((line, index) => (
        <tspan
          key={index}
          x={x - 4}
          dy={index === 0 ? `${0.35 - (lines.length - 1) * 0.6}em` : "1.2em"}
        >
          {line}
        </tspan>
      ))}
      <title>{label}</title>
    </text>
  );
}

const PriceComparisonChart = dynamic(
  () =>
    import("recharts").then((recharts) => {
      const {
        BarChart,
        Bar,
        XAxis,
        YAxis,
        Tooltip,
        ResponsiveContainer,
        CartesianGrid,
      } = recharts;
      return function ChartComponent({
        data,
        series,
      }: {
        data: Array<{
          category: string;
          projectCount: number;
          [key: string]: string | number | null;
        }>;
        series: Array<{ key: string; label: string; color: string }>;
      }) {
        // Horizontal bars: the eight Thai category names are too long for an x axis
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 16, left: 0, bottom: 0 }}
              barGap={2}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="var(--border)"
                opacity={0.3}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `฿${v}M`}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={CATEGORY_AXIS_WIDTH}
                tick={(props) => (
                  <WrappedCategoryTick
                    x={Number(props.x)}
                    y={Number(props.y)}
                    label={String(props.payload?.value ?? "")}
                  />
                )}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const row = payload[0]?.payload as { projectCount?: number } | undefined;
                  return (
                    <div className="rounded-xl border border-border bg-background px-4 py-3 shadow-lg">
                      <p className="text-sm font-medium">{label}</p>
                      {!row?.projectCount ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          ยังไม่มี TOR ที่ปิดรับแล้วในหมวดนี้
                        </p>
                      ) : (
                        <div className="mt-1.5 space-y-0.5">
                          <p className="text-xs text-muted-foreground">
                            เฉลี่ยจาก {row.projectCount} โครงการ
                          </p>
                          {payload.map((entry, i) => (
                            <p
                              key={entry.name ?? i}
                              className="text-xs font-medium"
                              style={{ color: entry.color }}
                            >
                              {entry.name} : ฿{Number(entry.value).toFixed(2)} ล้านบาท
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              {series.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  radius={[0, 4, 4, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      };
    }),
  { ssr: false },
);

/* ---------------------------------------------------------------------- */

const baht = (n: number) => "฿" + (n / 1_000_000).toFixed(1) + " ล้าน";
const toMillion = (n: number) => (n / 1_000_000).toFixed(1);
const toMillionOrNull = (n: number | null) =>
  n === null ? null : Math.round((n / 1_000_000) * 100) / 100;

const ITEMS_PER_PAGE = 4;

const priceChartSeries = [
  { key: "midPrice", label: "ราคากลาง", color: "#d18f5dff" },
  { key: "awardedPrice", label: "ราคาที่ชนะ", color: "#4a7c59" },
];

// Maps category keys to accent colors for the left-side result bar and category badge
const CATEGORY_COLORS: Record<string, string> = {
  ai_ml: "#7c5cbf",
  web_application: "#2e7dd6",
  mobile_app: "#e07a2f",
  cloud_infrastructure: "#1a8cad",
  data_bi: "#c04b7a",
  cybersecurity: "#c0392b",
  consulting_architecture: "#5a8c6e",
  enterprise_system: "#8c6e2f",
};

function getCategoryColor(category: string | null | undefined): string {
  return (category && CATEGORY_COLORS[category]) || "#4a7c59";
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile(!!user);
  const { summary, analytics, loadingSummary } = useHomepage();

  // filter options (fiscal years, departments, statuses) come from the TORs in the database
  const { data: filterOptions } = useTorFilterOptions();
  // Category chips list every active category, even one no TOR uses yet (filtering on it
  // then simply finds nothing). /tors/filter-options would drop such categories.
  const { data: activeCategories } = useCategories();
  const budgetYears = useMemo(
    () => ["ทั้งหมด", ...(filterOptions?.years.map(String) ?? [])],
    [filterOptions],
  );
  const departments = useMemo(
    () => ["ทั้งหมด", ...(filterOptions?.departments ?? [])],
    [filterOptions],
  );
  const statuses = useMemo(
    () => ["ทั้งหมด", ...(filterOptions?.statuses ?? [])],
    [filterOptions],
  );
  const categoryOptions = activeCategories ?? [];

  // Share of open TORs (`tors`) per category
  const displayedCategorySplit = useMemo(
    () =>
      (analytics?.categoryDistribution ?? []).map((item) => ({
        label: item.label,
        pct: item.percentage,
      })),
    [analytics],
  );

  // Average mid vs awarded price per category, over TORs whose bidding has closed (mock awarded).
  // Every active category is listed; a category with no finished project has no bars.
  const displayedPriceComparison = useMemo(
    () =>
      (analytics?.priceComparison ?? []).map((p) => ({
        category: p.label,
        projectCount: p.projectCount,
        midPrice: toMillionOrNull(p.avgMidPriceBaht),
        awardedPrice: toMillionOrNull(p.avgAwardedPriceBaht),
      })),
    [analytics],
  );

  // Overall averages over the same finished projects
  const priceSummary = analytics?.priceSummary;
  const priceSource = analytics?.priceSource ?? null;

  const currentUser = user || (profile ? {
    id: profile.id,
    name: profile.displayName || profile.name,
    email: profile.email || profile.contactEmail,
    image: profile.image,
  } : null);

  const isLoggedIn = !!currentUser;
  const isAuthChecking = authLoading;

  const { data: recommendedTors = [] } = useTorRecommendations(isLoggedIn);

  // Immediate (UI-bound) states
  const [nameInput, setNameInput] = useState("");
  const [budgetMinInput, setBudgetMinInput] = useState("");
  const [budgetMaxInput, setBudgetMaxInput] = useState("");

  // Debounced values — these drive the API request (400 ms delay)
  const [debouncedName] = useDebounce(nameInput, 400);
  const [debouncedBudgetMin] = useDebounce(budgetMinInput, 400);
  const [debouncedBudgetMax] = useDebounce(budgetMaxInput, 400);

  const [budgetYear, setBudgetYear] = useState("ทั้งหมด");
  const [department, setDepartment] = useState("ทั้งหมด");
  const [status, setStatus] = useState("ทั้งหมด");
  const [categories, setCategories] = useState<string[]>([]); // selected category keys
  const [sortMode, setSortMode] = useState<"deadline" | "newest">("deadline");
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const toggleCategory = (key: string) => {
    setCategories((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
    setCurrentPage(1);
  };

  const [currentPage, setCurrentPage] = useState(1);

  const recommendedList = useMemo(() => {
    if (!isLoggedIn) return [];
    return recommendedTors.map((item) => ({
      id: item.id,
      title: item.projectTitle,
      agency: item.agencyName || "หน่วยงานรัฐ",
      budget: item.budgetBaht || 0,
      interestScore: item.score,
      // Category display name; empty when the TOR's primary category is hidden
      reason: item.categoryName ? `ตรงกับหมวดหมู่ ${item.categoryName}` : "",
    }));
  }, [isLoggedIn, recommendedTors]);

  // live search + filter against the real API — uses debounced text values to avoid
  // firing a request on every keystroke in the name / budget inputs
  const requestParams = useMemo(
    () => ({
      q: debouncedName || undefined,
      year: budgetYear === "ทั้งหมด" ? undefined : Number(budgetYear),
      budget_min: debouncedBudgetMin ? Number(debouncedBudgetMin) * 1_000_000 : undefined,
      budget_max: debouncedBudgetMax ? Number(debouncedBudgetMax) * 1_000_000 : undefined,
      department,
      status,
      categories: categories.length > 0 ? categories.join(",") : undefined,
      page: currentPage,
      limit: ITEMS_PER_PAGE,
      sort: sortMode as "deadline" | "newest",
    }),
    [debouncedName, budgetYear, debouncedBudgetMin, debouncedBudgetMax, department, status, categories, currentPage, sortMode],
  );

  const { data, isLoading: searching, error: searchError } = useTors(requestParams);
  const pagedResults = data?.items ?? [];
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const visiblePage = Math.min(currentPage, totalPages);

  const clearFilters = () => {
    setNameInput("");
    setBudgetMinInput("");
    setBudgetMaxInput("");
    setBudgetYear("ทั้งหมด");
    setDepartment("ทั้งหมด");
    setStatus("ทั้งหมด");
    setCategories([]);
    setSortMode("deadline");
    setCurrentPage(1);
  };

  // Active filter chips for the summary row
  const activeFilters: { label: string; clear: () => void }[] = [];
  if (debouncedName) activeFilters.push({ label: `"${debouncedName}"`, clear: () => setNameInput("") });
  if (budgetYear !== "ทั้งหมด") activeFilters.push({ label: `ปี ${budgetYear}`, clear: () => setBudgetYear("ทั้งหมด") });
  if (department !== "ทั้งหมด") activeFilters.push({ label: department.length > 20 ? department.slice(0, 20) + "…" : department, clear: () => setDepartment("ทั้งหมด") });
  if (status !== "ทั้งหมด") activeFilters.push({ label: status, clear: () => setStatus("ทั้งหมด") });
  if (debouncedBudgetMin) activeFilters.push({ label: `≥ ฿${debouncedBudgetMin}M`, clear: () => setBudgetMinInput("") });
  if (debouncedBudgetMax) activeFilters.push({ label: `≤ ฿${debouncedBudgetMax}M`, clear: () => setBudgetMaxInput("") });
  categories.forEach((key) => {
    const cat = categoryOptions.find((c) => c.key === key);
    if (cat) activeFilters.push({ label: cat.name, clear: () => toggleCategory(key) });
  });

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="min-h-screen">
      <SiteNav />

      <main className="mx-auto max-w-6xl px-5 pb-24">
        {/* Hero */}
        <section className="grid gap-10 py-16 md:grid-cols-[1.15fr_0.85fr] md:items-center">
          <div>
            <p className="label-eyebrow">
              TOR · แพลตฟอร์มค้นหางานประมูลซอฟต์แวร์
            </p>
            <h1 className="mt-4 text-4xl leading-[1.18] font-semibold md:text-[3rem]">
              เว็บไซต์รวบรวมทุก TOR ที่เกี่ยวข้องกับงานซอฟต์แวร์
              <br />
              <span className="text-primary">รวมไว้ในที่เดียว</span>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              ไม่ต้องเสียเวลาตามหา TOR จากหลายเว็บไซต์ TOR Pulse รวบรวม TOR
              จากแหล่งจัดซื้อจัดจ้างไว้ในที่เดียว ค้นหา เปรียบเทียบ
              และค้นพบโครงการที่ตรงกับความสามารถของทีมคุณ
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
                ดู TOR แบบผู้เยี่ยมชม
              </button>
              <button className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                สร้างโปรไฟล์บริษัท
              </button>
            </div>
          </div>

          <div className="panel p-6">
            <div className="flex items-center justify-between">
              <p className="label-eyebrow">ดัชนีล่าสุด</p>
              {loadingSummary && (
                <span
                  className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
                  title="กำลังอัปเดตข้อมูลล่าสุด..."
                />
              )}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-5">
              {[
                {
                  k: "TOR ที่จัดเก็บแล้ว",
                  v: summary
                    ? summary.total_tors.toLocaleString("th-TH")
                    : loadingSummary
                    ? "..."
                    : "—",
                },
                {
                  k: "แหล่งข้อมูล",
                  v: summary
                    ? summary.total_sources.toLocaleString("th-TH")
                    : loadingSummary
                    ? "..."
                    : "—",
                },
                {
                  k: "งบประมาณรวมที่ติดตาม",
                  v: summary
                    ? formatBudgetSummary(summary.total_budget)
                    : loadingSummary
                    ? "..."
                    : "—",
                  // Third card fills the row on its own
                  wide: true,
                },
                // "TOR เข้าระบบสัปดาห์นี้" (summary.new_this_week) is hidden until its wording
                // is agreed: it counts the date a TOR entered the system, not the announcement.
              ].map((s) => (
                <div key={s.k} className={"wide" in s ? "col-span-2" : undefined}>
                  <p className="font-display text-2xl font-semibold text-primary">
                    {s.v}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.k}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-xs text-muted-foreground">
                ดึงข้อมูลล่าสุด {formatLastUpdatedTime(summary?.last_updated)} · e-GP, ระบบจัดซื้อจัดจ้าง กทม., ข้อมูลเปิด DGA
              </p>
            </div>
          </div>
        </section>

        {/* ── SmartSearch ── */}
        <section className="panel overflow-hidden" id="smart-search">
          {/* Hero search bar */}
          <div className="border-b border-border bg-[#F8FAF7] px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="shrink-0 text-base font-semibold">ค้นหา TOR</h2>
              {/* Sort toggle */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5 text-xs">
                <button
                  onClick={() => { setSortMode("deadline"); setCurrentPage(1); }}
                  className={"rounded-md px-3 py-1.5 font-medium transition-colors " +
                    (sortMode === "deadline" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  ⏱ ใกล้ปิดก่อน
                </button>
                <button
                  onClick={() => { setSortMode("newest"); setCurrentPage(1); }}
                  className={"rounded-md px-3 py-1.5 font-medium transition-colors " +
                    (sortMode === "newest" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  🆕 ใหม่ล่าสุด
                </button>
              </div>
            </div>

            {/* Main search input */}
            <div className="relative mt-4">
              <svg
                className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 6.5 6.5a7.5 7.5 0 0 0 10.15 10.15z" />
              </svg>
              <input
                id="smart-search-input"
                value={nameInput}
                onChange={(e) => { setNameInput(e.target.value); setCurrentPage(1); }}
                placeholder="ค้นหาชื่อโครงการ หน่วยงาน หมายเลข TOR หรือเทคโนโลยี..."
                autoComplete="off"
                className="w-full rounded-xl border border-input bg-background py-3.5 pl-11 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 transition-shadow"
              />
              {nameInput && (
                <button
                  onClick={() => { setNameInput(""); setCurrentPage(1); }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="ล้างคำค้นหา"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Category chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => { setCategories([]); setCurrentPage(1); }}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all " +
                  (categories.length === 0
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")
                }
              >
                ทั้งหมด
              </button>
              {categoryOptions.map((c) => (
                <button
                  key={c.key}
                  onClick={() => toggleCategory(c.key)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium transition-all " +
                    (categories.includes(c.key)
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")
                  }
                >
                  {c.name}
                </button>
              ))}
              <button
                onClick={() => setFiltersExpanded((v) => !v)}
                className={
                  "ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all " +
                  (filtersExpanded
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                </svg>
                ตัวกรองเพิ่มเติม
                {(budgetYear !== "ทั้งหมด" || department !== "ทั้งหมด" || status !== "ทั้งหมด" || budgetMinInput || budgetMaxInput) && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {[
                      budgetYear !== "ทั้งหมด",
                      department !== "ทั้งหมด",
                      status !== "ทั้งหมด",
                      !!budgetMinInput,
                      !!budgetMaxInput,
                    ].filter(Boolean).length}
                  </span>
                )}
                <span className={`transition-transform duration-200 ${filtersExpanded ? "rotate-180" : ""}`}>▾</span>
              </button>
            </div>
          </div>

          {/* Expanded advanced filters */}
          {filtersExpanded && (
            <div className="border-b border-border bg-[#F8FAF7]/60 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">ปีงบประมาณ</label>
                  <select
                    value={budgetYear}
                    onChange={(e) => { setBudgetYear(e.target.value); setCurrentPage(1); }}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-muted-foreground focus:border-ring outline-none"
                  >
                    {budgetYears.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">หน่วยงาน</label>
                  <select
                    value={department}
                    onChange={(e) => { setDepartment(e.target.value); setCurrentPage(1); }}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-muted-foreground focus:border-ring outline-none"
                  >
                    {departments.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">ประเภทการประกาศ</label>
                  <select
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setCurrentPage(1); }}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-muted-foreground focus:border-ring outline-none"
                  >
                    {statuses.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">งบประมาณ (ล้านบาท)</label>
                  <div className="flex items-center gap-2">
                    <input
                      value={budgetMinInput}
                      onChange={(e) => { setBudgetMinInput(e.target.value); setCurrentPage(1); }}
                      placeholder="Min"
                      type="number"
                      min="0"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
                    />
                    <span className="shrink-0 text-muted-foreground">—</span>
                    <input
                      value={budgetMaxInput}
                      onChange={(e) => { setBudgetMaxInput(e.target.value); setCurrentPage(1); }}
                      placeholder="Max"
                      type="number"
                      min="0"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
                    />
                  </div>
                </div>
              </div>
              {(budgetYear !== "ทั้งหมด" || department !== "ทั้งหมด" || status !== "ทั้งหมด" || budgetMinInput || budgetMaxInput) && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setBudgetYear("ทั้งหมด");
                      setDepartment("ทั้งหมด");
                      setStatus("ทั้งหมด");
                      setBudgetMinInput("");
                      setBudgetMaxInput("");
                      setCurrentPage(1);
                    }}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors"
                  >
                    ล้างตัวกรองเพิ่มเติม
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Active filter chips row */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-6 py-3">
              <span className="text-[11px] font-medium text-muted-foreground">กรองด้วย:</span>
              {activeFilters.map((f, i) => (
                <button
                  key={i}
                  onClick={() => { f.clear(); setCurrentPage(1); }}
                  className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-all hover:bg-primary/20"
                >
                  {f.label}
                  <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              <button
                onClick={clearFilters}
                className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                ล้างทั้งหมด
              </button>
            </div>
          )}

          {/* Results header */}
          <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border">
            <p className="text-sm text-muted-foreground">
              {searching ? (
                <span className="inline-flex items-center gap-2">
                  <span className="size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  กำลังค้นหา...
                </span>
              ) : (
                <>
                  พบ{" "}
                  <span className="font-semibold text-foreground">{(data?.total ?? 0).toLocaleString("th-TH")}</span>{" "}
                  รายการ
                  {hasActiveFilters && <span className="text-xs"> (มีตัวกรอง)</span>}
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              หน้า <span className="font-mono font-medium text-foreground">{visiblePage}</span> / {totalPages}
            </p>
          </div>

          {/* Results list */}
          <ul className="divide-y divide-border">
            {searching && ["", "", ""].map((_, i) => (
              <li key={i} className="animate-pulse px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-2.5">
                    <div className="h-3 w-32 rounded bg-surface-2" />
                    <div className="h-4 w-3/4 rounded bg-surface-2" />
                    <div className="h-3 w-1/2 rounded bg-surface-2" />
                    <div className="flex gap-2">
                      <div className="h-5 w-16 rounded-full bg-surface-2" />
                      <div className="h-5 w-20 rounded-full bg-surface-2" />
                    </div>
                  </div>
                  <div className="shrink-0 space-y-2 text-right">
                    <div className="h-6 w-24 rounded bg-surface-2" />
                    <div className="h-7 w-24 rounded-full bg-surface-2" />
                  </div>
                </div>
              </li>
            ))}

            {!searching && searchError && (
              <li className="py-12 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10">
                  <svg className="size-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-medium text-destructive">เกิดข้อผิดพลาดในการค้นหา</p>
                <p className="mt-1 text-xs text-muted-foreground">กรุณาลองใหม่อีกครั้ง</p>
              </li>
            )}

            {!searching && !searchError && pagedResults.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tor/${t.id}`}
                  className="group flex items-start gap-4 px-6 py-5 transition-colors hover:bg-surface-2"
                >
                  {/* Category color bar */}
                  <div
                    className="mt-1 shrink-0 w-1 self-stretch rounded-full opacity-70"
                    style={{ backgroundColor: getCategoryColor(t.category) }}
                  />

                  <div className="flex-1 min-w-0">
                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                      <span className="rounded bg-surface-2 px-2 py-0.5">{t.externalId}</span>
                      <span className="opacity-60">·</span>
                      <span>{t.sourceAdapter}</span>
                      {t.categoryName && (
                        <>
                          <span className="opacity-60">·</span>
                          <span
                            className="rounded px-2 py-0.5 font-medium"
                            style={{
                              backgroundColor: getCategoryColor(t.category) + "22",
                              color: getCategoryColor(t.category),
                            }}
                          >
                            {t.categoryName}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="mt-1.5 text-sm font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {t.projectTitle}
                    </h3>

                    {/* Agency + deadline */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted-foreground">{t.agencyName ?? "หน่วยงานรัฐ"}</p>
                      <DeadlineBadge
                        deadline={t.submissionDeadline ?? t.submissionDeadlineText}
                        since={t.announcementDate ?? t.createdAt}
                        projectStatus={t.projectStatus}
                        openOnly
                      />
                    </div>

                    {/* Tech tags */}
                    {t.technologies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.technologies.slice(0, 5).map((x) => (
                          <span
                            key={x}
                            className="rounded border border-border px-2 py-0.5 text-[11px] text-accent"
                          >
                            {x}
                          </span>
                        ))}
                        {t.technologies.length > 5 && (
                          <span className="text-[11px] text-muted-foreground">+{t.technologies.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Budget + CTA */}
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <p className="font-display text-lg font-semibold">{baht(t.budgetBaht ?? 0)}</p>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                      ดูรายละเอียด →
                    </span>
                  </div>
                </Link>
              </li>
            ))}

            {!searching && !searchError && pagedResults.length === 0 && (
              <li className="py-14 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface-2">
                  <svg className="size-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.3}
                      d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 6.5 6.5a7.5 7.5 0 0 0 10.15 10.15z" />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-medium">ไม่พบ TOR ที่ตรงกับเงื่อนไขนี้</p>
                <p className="mt-1 text-xs text-muted-foreground">ลองปรับคำค้นหาหรือล้างตัวกรอง</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-3 text-xs font-medium text-primary hover:underline"
                  >
                    ล้างตัวกรองทั้งหมด
                  </button>
                )}
              </li>
            )}
          </ul>

          {/* Pagination */}
          {!searching && totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={visiblePage === 1}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹ ก่อนหน้า
              </button>

              {/* Page number buttons (show ±2 around current) */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - visiblePage) <= 2)
                  .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (arr[idx - 1] as number) < p - 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-muted-foreground text-sm">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setCurrentPage(item as number)}
                        className={
                          "size-8 rounded-lg text-sm font-medium transition-colors " +
                          (item === visiblePage
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-surface-2 hover:text-foreground")
                        }
                      >
                        {item}
                      </button>
                    )
                  )}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={visiblePage === totalPages}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                หน้าถัดไป ›
              </button>
            </div>
          )}
        </section>

        {/* TOR Recommadation */}
        <section className="panel mt-8 p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="label-eyebrow">แนะนำสำหรับคุณ</p>
              <h2 className="mt-2 text-lg font-semibold">
                TOR ที่ตรงกับความสนใจของคุณ
              </h2>
            </div>
            <Link
              href="/profile"
              className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              จัดการความสนใจ
            </Link>
          </div>

          {isAuthChecking ? (
            <div className="mt-5 flex items-center justify-center rounded-2xl border border-dashed border-border p-10 text-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>กำลังโหลดข้อมูลผู้ใช้...</span>
              </div>
            </div>
          ) : !isLoggedIn ? (
            <div className="mt-5 rounded-2xl border border-dashed border-border p-8 text-center bg-surface/40">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-foreground">
                เข้าสู่ระบบและเลือกหมวดหมู่ที่สนใจ
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                เข้าสู่ระบบด้วยบัญชี Google เพื่อให้เราคัดสรรและแนะนำ TOR ที่ตรงกับงานและความเชี่ยวชาญของคุณ
              </p>
              <Link
                href="/auth"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                <span>เข้าสู่ระบบ / สมัครสมาชิก</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : recommendedList.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-border/80 bg-gradient-to-br from-surface/90 via-surface to-background p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="relative shrink-0">
                  {currentUser.image ? (
                    <img
                      src={currentUser.image}
                      alt={currentUser.name || currentUser.email}
                      className="size-14 rounded-2xl object-cover ring-2 ring-primary/20 shadow-sm"
                    />
                  ) : (
                    <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#4a7c59] to-[#2e5239] font-mono text-lg font-bold text-white shadow-sm">
                      {(currentUser.name || currentUser.email || "U").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background" title="เข้าสู่ระบบแล้ว">
                    <span className="size-1.5 rounded-full bg-white animate-pulse" />
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                      <span className="size-1.5 rounded-full bg-primary" />
                      เข้าสู่ระบบสำเร็จ
                    </span>
                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[260px] sm:max-w-none">
                      {currentUser.email}
                    </span>
                  </div>

                  <h3 className="mt-2 text-base sm:text-lg font-semibold text-foreground">
                    ยินดีต้อนรับคุณ, <span className="text-primary">{currentUser.name || currentUser.email}</span> 👋
                  </h3>

                  <p className="mt-1 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                    ขณะนี้ยังไม่พบโครงการ TOR ที่ตรงกับความสนใจของคุณ หรือคุณยังไม่ได้ระบุหมวดหมู่ที่สนใจ
                    สามารถไปที่หน้าโปรไฟล์เพื่อเลือกหมวดหมู่ที่ต้องการติดตาม เพื่อให้ระบบช่วยแนะนำงานที่เหมาะกับคุณโดยอัตโนมัติ
                  </p>
                </div>

                <div className="flex sm:flex-col gap-2.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                  <Link
                    href="/profile"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    <span>เลือกความสนใจในโปรไฟล์</span>
                  </Link>
                  <Link
                    href="/search"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-all hover:bg-surface"
                  >
                    <span>ค้นหา TOR ทั้งหมด</span>
                    <span>›</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  แนะนำสำหรับคุณ (<span className="font-mono text-primary">{currentUser.email}</span>)
                </span>
                <span>พบ {recommendedList.length} รายการ</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {recommendedList.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tor/${t.id}`}
                    className="rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
                      <span>{t.id}</span>
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-success">
                        คะแนน {t.interestScore}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium leading-snug">
                      {t.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.agency}
                      {t.reason && ` · ${t.reason}`}
                    </p>
                    <p className="mt-3 font-display text-lg font-semibold">
                      {baht(t.budget)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Charts */}
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="panel flex flex-col p-6 lg:col-span-2">
            <p className="label-eyebrow">สถิติภาพรวมของ TOR</p>
            <h2 className="mt-2 text-lg font-semibold">
              ข้อมูลสำหรับวิเคราะห์ราคาย้อนหลัง
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              ราคากลางเทียบกับราคาที่ชนะของ TOR ที่ผ่านวันปิดรับข้อเสนอแล้ว
              เพื่อช่วยประเมินราคาและเปรียบเทียบกับโครงการปัจจุบัน
            </p>
            {priceSource && (
              <p className="mt-1 text-xs text-muted-foreground">
                จาก {priceSource.project_count.toLocaleString("th-TH")} โครงการ · ข้อมูล ณ{" "}
                {formatThaiDate(priceSource.as_of)}
              </p>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-muted-foreground">ราคากลางเฉลี่ย</p>
                <p className="mt-1 font-display text-xl font-semibold">
                  {priceSummary?.avgMidPriceBaht != null
                    ? `฿${toMillion(priceSummary.avgMidPriceBaht)} ล้าน`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-muted-foreground">
                  ราคาที่ชนะเฉลี่ย
                </p>
                <p className="mt-1 font-display text-xl font-semibold">
                  {priceSummary?.avgAwardedPriceBaht != null
                    ? `฿${toMillion(priceSummary.avgAwardedPriceBaht)} ล้าน`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-muted-foreground">ส่วนต่างรวม</p>
                <p className="mt-1 font-display text-xl font-semibold text-primary">
                  {priceSummary?.avgDiscountPct != null
                    ? `${priceSummary.avgDiscountPct.toFixed(1)}%`
                    : "—"}
                </p>
              </div>
            </div>

            <div className="mt-5" style={{ height: 360 }}>
              {displayedPriceComparison.length > 0 ? (
                <PriceComparisonChart
                  data={displayedPriceComparison}
                  series={priceChartSeries}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {analytics ? "ยังไม่มี TOR ที่มีทั้งราคากลางและราคาที่ชนะ" : "กำลังโหลด..."}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-center gap-6">
              {priceChartSeries.map((s) => (
                <span
                  key={s.label}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                </span>
              ))}
            </div>

            <Link
              href="/reports"
              className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
            >
              ดูรายงานเชิงลึก →
            </Link>
          </div>

          <div className="panel p-6">
            <p className="label-eyebrow">สัดส่วนตามหมวดงาน</p>
            <ul className="mt-5 space-y-3.5">
              {displayedCategorySplit.map((c) => (
                <li key={c.label}>
                  <div className="flex justify-between text-xs">
                    <span>{c.label}</span>
                    <span className="font-mono text-muted-foreground">
                      {c.pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.min(100, c.pct * 2.6)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-3 border-t border-border pt-5">
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="bg-primary px-4 py-2.5">
                  <p className="text-xs font-medium text-primary-foreground">
                    งบประมาณในการจัดซื้อจัดจ้างรวม
                  </p>
                </div>
                <div className="px-4 py-4">
                  <p className="font-display text-2xl font-semibold text-primary">
                    {summary
                      ? summary.total_budget.toLocaleString("th-TH", { maximumFractionDigits: 0 })
                      : "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">บาท</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="bg-primary px-4 py-2.5">
                  <p className="text-xs font-medium text-primary-foreground">
                    วงเงินเฉลี่ยต่อโครงการ
                  </p>
                </div>
                <div className="px-4 py-4">
                  <p className="font-display text-2xl font-semibold text-primary">
                    {summary?.avg_budget != null
                      ? summary.avg_budget.toLocaleString("th-TH", { maximumFractionDigits: 0 })
                      : "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">บาท</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="bg-primary px-4 py-2.5">
                  <p className="text-xs font-medium text-primary-foreground">
                    จำนวนโครงการทั้งหมด
                  </p>
                </div>
                <div className="px-4 py-4">
                  <p className="font-display text-2xl font-semibold text-primary">
                    {summary ? summary.total_tors.toLocaleString("th-TH") : "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    โครงการ
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <p className="mx-auto max-w-6xl px-5 text-xs text-muted-foreground">
          TORPulse © 2026 — เว็บไซต์รวบรวมและค้นหา TOR งานซอฟต์แวร์ของกรุงเทพมหานคร
        </p>
      </footer>
    </div>
  );
}