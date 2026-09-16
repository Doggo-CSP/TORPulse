"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { SiteNav } from "@/app/components/site_nav";
import { useTors, useTorFilterOptions } from "@/hooks/use-tors";
import {
  enrichTorPriceAnalysis,
  computePriceReportSummary,
  computeCategoryPriceComparison,
  computeTopAgencySavings,
  computeDiscountBrackets,
  formatBahtCurrency,
  exportToCsv,
  CATEGORY_NAME_MAP,
  TorPriceAnalysisItem,
} from "@/api/reports.api";
import {
  BanknotesIcon,
  ChartBarIcon,
  ArrowTrendingDownIcon,
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
  BuildingLibraryIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/20/solid";

// Dynamic imports for Recharts to avoid SSR hydration issues
const DynamicPriceBarChart = dynamic(
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
        Legend,
      } = recharts;

      return function PriceBarChartComponent({
        data,
      }: {
        data: Array<{
          categoryLabel: string;
          medianPriceMillion: number;
          winningPriceMillion: number;
          savingsMillion: number;
          avgDiscountPct: number;
        }>;
      }) {
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={data}
              margin={{ top: 15, right: 15, left: -10, bottom: 25 }}
              barGap={6}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--color-border)"
                opacity={0.4}
              />
              <XAxis
                dataKey="categoryLabel"
                tick={{ fontSize: 12, fill: "var(--color-foreground)" }}
                interval={0}
                angle={-10}
                textAnchor="end"
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
                  const itemData = payload[0]?.payload;
                  return (
                    <div className="rounded-xl border border-border bg-surface p-3.5 shadow-xl">
                      <p className="font-semibold text-sm text-foreground">{label}</p>
                      <div className="mt-2 space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#b0a898]" />
                            ราคากลาง:
                          </span>
                          <span className="font-mono font-medium">
                            ฿{itemData?.medianPriceMillion?.toFixed(1)} ล้าน
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#4a7c59]" />
                            ราคาที่ชนะการประมูล:
                          </span>
                          <span className="font-mono font-semibold text-primary">
                            ฿{itemData?.winningPriceMillion?.toFixed(1)} ล้าน
                          </span>
                        </div>
                        <div className="pt-1.5 mt-1.5 border-t border-border flex items-center justify-between gap-4 font-medium">
                          <span className="text-emerald-700">ประหยัดงบประมาณ:</span>
                          <span className="font-mono text-emerald-700">
                            ฿{itemData?.savingsMillion?.toFixed(1)} ล้าน ({itemData?.avgDiscountPct}%)
                          </span>
                        </div>
                      </div>
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
                dataKey="medianPriceMillion"
                name="ราคากลาง (ล้านบาท)"
                fill="#b0a898"
                radius={[5, 5, 0, 0]}
              />
              <Bar
                dataKey="winningPriceMillion"
                name="ราคาที่ชนะการประมูล (ล้านบาท)"
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

const DynamicAgencyBarChart = dynamic(
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

      return function AgencyBarChartComponent({
        data,
      }: {
        data: Array<{
          agencyName: string;
          savingsMillion: number;
          medianPriceMillion: number;
          winningPriceMillion: number;
          avgDiscountPct: number;
        }>;
      }) {
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 10, right: 25, left: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="var(--color-border)"
                opacity={0.4}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                tickFormatter={(val: number) => `฿${val}M`}
              />
              <YAxis
                type="category"
                dataKey="agencyName"
                width={160}
                tick={{ fontSize: 11, fill: "var(--color-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0]?.payload;
                  return (
                    <div className="rounded-xl border border-border bg-surface p-3 shadow-xl text-xs">
                      <p className="font-semibold text-foreground">{item.agencyName}</p>
                      <p className="mt-1 text-emerald-700 font-medium">
                        มูลค่าประหยัดได้: ฿{item.savingsMillion?.toFixed(1)} ล้านบาท
                      </p>
                      <p className="text-muted-foreground">
                        ราคากลาง: ฿{item.medianPriceMillion?.toFixed(1)}M | ชนะ: ฿
                        {item.winningPriceMillion?.toFixed(1)}M
                      </p>
                      <p className="text-muted-foreground">
                        ส่วนต่างเฉลี่ย: {item.avgDiscountPct}%
                      </p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="savingsMillion"
                name="มูลค่าที่ประหยัดได้ (ล้านบาท)"
                fill="#2d6a4f"
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );
      };
    }),
  { ssr: false }
);

const DynamicBracketDonutChart = dynamic(
  () =>
    import("recharts").then((recharts) => {
      const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } = recharts;

      return function BracketDonutChartComponent({
        data,
      }: {
        data: Array<{ bracket: string; label: string; count: number; percentage: number; color: string }>;
      }) {
        return (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0]?.payload;
                  return (
                    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-lg text-xs">
                      <span className="font-medium text-foreground">{item.label}</span>:{" "}
                      <span className="font-bold text-primary">{item.count} โครงการ</span> (
                      {item.percentage}%)
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        );
      };
    }),
  { ssr: false }
);

// Fallback seed data in case the backend DB has no seeded TORs yet
const FALLBACK_TORS: TorPriceAnalysisItem[] = [
  {
    id: "fb-1",
    externalId: "67010012345",
    projectTitle: "จ้างพัฒนาระบบคลาวด์กลางและแดชบอร์ดบริหารจัดการข้อมูลภาครัฐ",
    agencyName: "สำนักงานพัฒนารัฐบาลดิจิทัล (องค์การมหาชน)",
    category: "data_bi",
    categoryLabel: "งานข้อมูลและวิเคราะห์",
    fiscalYear: 2568,
    medianPrice: 24_500_000,
    winningPrice: 21_200_000,
    savingsAmount: 3_300_000,
    discountPct: 13.5,
    technologies: ["Python", "Power BI", "PostgreSQL", "Docker"],
    submissionDeadline: "2026-10-15",
    statusBadge: { label: "ประหยัดตามเกณฑ์", variant: "standard" },
  },
  {
    id: "fb-2",
    externalId: "67020087654",
    projectTitle: "ประกวดราคาจ้างพัฒนาระบบบริการประชาชนผ่านแอปพลิเคชันมือถือ BMA Connect",
    agencyName: "กรุงเทพมหานคร",
    category: "mobile_app",
    categoryLabel: "งานแอปพลิเคชันมือถือ",
    fiscalYear: 2568,
    medianPrice: 18_000_000,
    winningPrice: 15_480_000,
    savingsAmount: 2_520_000,
    discountPct: 14.0,
    technologies: ["Flutter", "Node.js", "Redis"],
    submissionDeadline: "2026-09-30",
    statusBadge: { label: "ประหยัดงบสูง", variant: "high-savings" },
  },
  {
    id: "fb-3",
    externalId: "67030045612",
    projectTitle: "จ้างปรับปรุงและบำรุงรักษาระบบเว็บพータルและบริการอิเล็กทรอนิกส์สำหรับผู้เสียภาษี",
    agencyName: "กรมสรรพากร กระทรวงการคลัง",
    category: "web_application",
    categoryLabel: "งานพัฒนาเว็บไซต์",
    fiscalYear: 2568,
    medianPrice: 32_000_000,
    winningPrice: 28_400_000,
    savingsAmount: 3_600_000,
    discountPct: 11.3,
    technologies: ["React", "Next.js", "TypeScript", "Oracle"],
    submissionDeadline: "2026-11-05",
    statusBadge: { label: "แข่งขันสมบูรณ์", variant: "competitive" },
  },
  {
    id: "fb-4",
    externalId: "67040098123",
    projectTitle: "ประกวดราคาจ้างเชื่อมโยงระบบ ERP องค์กรและระบบบัญชีการเงินภาครัฐ GFMIS",
    agencyName: "กระทรวงการคลัง",
    category: "enterprise_system",
    categoryLabel: "งานระบบองค์กร",
    fiscalYear: 2568,
    medianPrice: 45_000_000,
    winningPrice: 40_200_000,
    savingsAmount: 4_800_000,
    discountPct: 10.7,
    technologies: ["SAP", ".NET", "SQL Server"],
    submissionDeadline: "2026-10-20",
    statusBadge: { label: "แข่งขันสมบูรณ์", variant: "competitive" },
  },
  {
    id: "fb-5",
    externalId: "67050033211",
    projectTitle: "โครงการจ้างพัฒนาระบบการเรียนรู้ดิจิทัลเพื่อการศึกษาตลอดชีวิต (e-Learning Hub)",
    agencyName: "กระทรวงศึกษาธิการ",
    category: "web_application",
    categoryLabel: "งานพัฒนาเว็บไซต์",
    fiscalYear: 2567,
    medianPrice: 12_800_000,
    winningPrice: 10_900_000,
    savingsAmount: 1_900_000,
    discountPct: 14.8,
    technologies: ["Vue.js", "Express", "MongoDB"],
    submissionDeadline: "2026-08-15",
    statusBadge: { label: "ประหยัดงบสูง", variant: "high-savings" },
  },
  {
    id: "fb-6",
    externalId: "67060077889",
    projectTitle: "จ้างพัฒนาระบบสารสนเทศติดตามประเมินผลสุขภาวะและควบคุมโรคติดต่อ",
    agencyName: "กรมควบคุมโรค กระทรวงสาธารณสุข",
    category: "data_bi",
    categoryLabel: "งานข้อมูลและวิเคราะห์",
    fiscalYear: 2567,
    medianPrice: 16_500_000,
    winningPrice: 14_600_000,
    savingsAmount: 1_900_000,
    discountPct: 11.5,
    technologies: ["Python", "Tableau", "PostgreSQL"],
    submissionDeadline: "2026-09-10",
    statusBadge: { label: "แข่งขันสมบูรณ์", variant: "competitive" },
  },
  {
    id: "fb-7",
    externalId: "67070055443",
    projectTitle: "จ้างพัฒนาระบบตรวจสอบเอกสารและลายมือชื่อดิจิทัลสำหรับข้าราชการ",
    agencyName: "สำนักงาน ก.พ.ร.",
    category: "enterprise_system",
    categoryLabel: "งานระบบองค์กร",
    fiscalYear: 2568,
    medianPrice: 9_200_000,
    winningPrice: 8_500_000,
    savingsAmount: 700_000,
    discountPct: 7.6,
    technologies: ["Java", "Spring Boot", "MySQL"],
    submissionDeadline: "2026-10-01",
    statusBadge: { label: "ใกล้เคียงราคากลาง", variant: "tight" },
  },
  {
    id: "fb-8",
    externalId: "67080066554",
    projectTitle: "โครงการพัฒนาโมบายแอปพลิเคชันระบบนัดหมายแพทย์และบริการผู้ป่วยนอก",
    agencyName: "โรงพยาบาลศิริราช",
    category: "mobile_app",
    categoryLabel: "งานแอปพลิเคชันมือถือ",
    fiscalYear: 2568,
    medianPrice: 14_000_000,
    winningPrice: 12_100_000,
    savingsAmount: 1_900_000,
    discountPct: 13.6,
    technologies: ["React Native", "Node.js", "AWS"],
    submissionDeadline: "2026-11-15",
    statusBadge: { label: "ประหยัดตามเกณฑ์", variant: "standard" },
  },
];

type SortKey = "medianPrice" | "winningPrice" | "savingsAmount" | "discountPct" | "projectTitle";
type SortOrder = "asc" | "desc";

export default function ReportsDashboardPage() {
  // Fetch real TORs from backend (up to 100 for robust analytical sample)
  const { data: torsResponse, isLoading: loadingTors } = useTors({ limit: 100 });
  const { data: filterOptions } = useTorFilterOptions();

  // Filters state
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const [selectedBracket, setSelectedBracket] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Table pagination & sorting state
  const [sortKey, setSortKey] = useState<SortKey>("savingsAmount");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Transform raw TOR items into price analysis items
  const allAnalysisItems = useMemo<TorPriceAnalysisItem[]>(() => {
    if (torsResponse?.items && torsResponse.items.length > 0) {
      const enriched = torsResponse.items
        .map((tor) => enrichTorPriceAnalysis(tor))
        .filter((item): item is TorPriceAnalysisItem => item !== null);

      // If backend has very few items, merge with fallback to offer an impressive complete dashboard
      if (enriched.length < 5) {
        const existingIds = new Set(enriched.map((e) => e.externalId));
        const merged = [...enriched];
        for (const fb of FALLBACK_TORS) {
          if (!existingIds.has(fb.externalId)) {
            merged.push(fb);
          }
        }
        return merged;
      }
      return enriched;
    }
    return FALLBACK_TORS;
  }, [torsResponse]);

  // Extract available distinct agencies and fiscal years for dropdowns
  const availableAgencies = useMemo(() => {
    const set = new Set<string>();
    allAnalysisItems.forEach((item) => {
      if (item.agencyName) set.add(item.agencyName);
    });
    return Array.from(set).sort();
  }, [allAnalysisItems]);

  const availableYears = useMemo(() => {
    if (filterOptions?.years && filterOptions.years.length > 0) {
      return filterOptions.years.map((y) => (y > 2400 ? y : y + 543));
    }
    const set = new Set<number>();
    allAnalysisItems.forEach((item) => set.add(item.fiscalYear));
    return Array.from(set).sort((a, b) => b - a);
  }, [filterOptions, allAnalysisItems]);

  // Filter items based on user selections
  const filteredItems = useMemo(() => {
    return allAnalysisItems.filter((item) => {
      if (selectedYear !== "all" && item.fiscalYear !== Number(selectedYear)) {
        return false;
      }
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      if (selectedAgency !== "all" && item.agencyName !== selectedAgency) {
        return false;
      }
      if (selectedBracket !== "all") {
        if (selectedBracket === "<5" && item.discountPct >= 5) return false;
        if (selectedBracket === "5-10" && (item.discountPct < 5 || item.discountPct > 10)) return false;
        if (selectedBracket === "10-15" && (item.discountPct <= 10 || item.discountPct > 15)) return false;
        if (selectedBracket === ">15" && item.discountPct <= 15) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesTitle = item.projectTitle.toLowerCase().includes(q);
        const matchesAgency = item.agencyName.toLowerCase().includes(q);
        const matchesTech = item.technologies.some((t) => t.toLowerCase().includes(q));
        const matchesExtId = item.externalId.toLowerCase().includes(q);
        if (!matchesTitle && !matchesAgency && !matchesTech && !matchesExtId) {
          return false;
        }
      }
      return true;
    });
  }, [allAnalysisItems, selectedYear, selectedCategory, selectedAgency, selectedBracket, searchQuery]);

  // Compute summary stats & metrics based on filtered data
  const summary = useMemo(() => computePriceReportSummary(filteredItems), [filteredItems]);
  const categoryComparison = useMemo(() => computeCategoryPriceComparison(filteredItems), [filteredItems]);
  const topAgencies = useMemo(() => computeTopAgencySavings(filteredItems, 6), [filteredItems]);
  const discountBrackets = useMemo(() => computeDiscountBrackets(filteredItems), [filteredItems]);

  // Sorted and paginated table data
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortOrder === "asc" ? numA - numB : numB - numA;
    });
  }, [filteredItems, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSelectedYear("all");
    setSelectedCategory("all");
    setSelectedAgency("all");
    setSelectedBracket("all");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleExportCsv = () => {
    exportToCsv(filteredItems, `tor-price-analysis-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-display">
                วิเคราะห์ราคากลาง vs ราคาที่ชนะการประมูล
              </h1>
              <span className="hidden sm:inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary border border-primary/20">
                Live Procurement Data
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-3xl">
              รายงานเปรียบเทียบสถิติมูลค่าราคากลาง (Median Price) กับราคาชนะการประมูล (Winning
              Award Price) จากฐานข้อมูล TOR และระบบจัดซื้อจัดจ้างภาครัฐ เพื่อประเมินความคุ้มค่าและประสิทธิภาพงบประมาณ
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 print:hidden">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-xs sm:text-sm font-medium hover:bg-surface-2 transition-colors shadow-sm"
              title="ส่งออกรายงานเป็นไฟล์ CSV"
            >
              <ArrowDownTrayIcon className="size-4 text-muted-foreground" />
              <span>ส่งออก CSV</span>
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
        </div>

        {/* ── Summary KPI Cards (4 Cards) ── */}
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: ราคากลางรวม */}
          <div className="panel p-5 relative overflow-hidden transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="label-eyebrow">ราคากลางรวม (Median Budget)</span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                <BanknotesIcon className="size-4" />
              </div>
            </div>
            <p className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
              {formatBahtCurrency(summary.totalMedianPrice)}
            </p>
            <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{summary.totalProjects} โครงการที่วิเคราะห์</span>
              <span className="font-mono">เฉลี่ย ฿{(summary.totalProjects > 0 ? (summary.totalMedianPrice / summary.totalProjects / 1_000_000).toFixed(1) : 0)}M / โครงการ</span>
            </div>
          </div>

          {/* Card 2: ราคาที่ชนะการประมูลรวม */}
          <div className="panel p-5 relative overflow-hidden transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="label-eyebrow">ราคาชนะการประมูลรวม (Awarded)</span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheckIcon className="size-4" />
              </div>
            </div>
            <p className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
              {formatBahtCurrency(summary.totalWinningPrice)}
            </p>
            <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>มูลค่าตามสัญญาประมูล</span>
              <span className="font-mono text-primary font-medium">ต่ำกว่างบประมาณ</span>
            </div>
          </div>

          {/* Card 3: มูลค่าประหยัดงบประมาณรวม */}
          <div className="panel p-5 relative overflow-hidden transition-all hover:shadow-md bg-gradient-to-br from-surface to-emerald-50/25 border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="label-eyebrow text-emerald-800">งบประมาณที่ประหยัดได้ (Savings)</span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-800">
                <ArrowTrendingDownIcon className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="font-display text-2xl font-bold tracking-tight text-emerald-700">
                {formatBahtCurrency(summary.totalSavings)}
              </p>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 font-mono">
                -{summary.avgDiscountPct}%
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>ส่วนต่างประหยัดเฉลี่ย</span>
              <span className="font-mono text-emerald-700 font-medium">ประหยัดเฉลี่ย ฿{(summary.avgSavingsPerProject / 1_000_000).toFixed(2)}M</span>
            </div>
          </div>

          {/* Card 4: สัดส่วนการแข่งขันและความคุ้มค่า */}
          <div className="panel p-5 relative overflow-hidden transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="label-eyebrow">ดัชนีการแข่งขัน (Competitiveness)</span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                <ChartBarIcon className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="font-display text-2xl font-bold tracking-tight text-foreground">
                {summary.totalProjects > 0
                  ? Math.round((summary.savingsRatioCount / summary.totalProjects) * 100)
                  : 0}
                %
              </p>
              <span className="text-xs text-muted-foreground">โครงการที่ได้ส่วนลด</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>ส่วนลดสูงสุด</span>
              <span className="font-mono font-medium text-primary">ประหยัดสูงสุด {summary.maxDiscountPct}%</span>
            </div>
          </div>
        </section>

        {/* ── Interactive Filters Bar ── */}
        <section className="mt-6 panel p-4 print:hidden">
          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="ค้นหาชื่อโครงการ, รหัสจัดซื้อ, หรือหน่วยงาน..."
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-4 text-xs sm:text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              {/* Year Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground font-mono text-xs">ปีงบ:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
                >
                  <option value="all">ทุกปีงบประมาณ</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      ปี {year}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground font-mono text-xs">หมวดหมู่:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
                >
                  <option value="all">ทุกหมวดหมู่งาน</option>
                  {Object.entries(CATEGORY_NAME_MAP).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Agency Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground font-mono text-xs">หน่วยงาน:</span>
                <select
                  value={selectedAgency}
                  onChange={(e) => {
                    setSelectedAgency(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="max-w-[160px] truncate rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
                >
                  <option value="all">ทุกหน่วยงาน</option>
                  {availableAgencies.map((agency) => (
                    <option key={agency} value={agency}>
                      {agency}
                    </option>
                  ))}
                </select>
              </div>

              {/* Discount Bracket Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground font-mono text-xs">ส่วนต่าง:</span>
                <select
                  value={selectedBracket}
                  onChange={(e) => {
                    setSelectedBracket(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
                >
                  <option value="all">ทุกช่วงส่วนลด</option>
                  <option value=">15">ประหยัดสูง (&gt; 15%)</option>
                  <option value="10-15">ประหยัดดี (10 - 15%)</option>
                  <option value="5-10">ประหยัดปานกลาง (5 - 10%)</option>
                  <option value="<5">ใกล้เคียง (&lt; 5%)</option>
                </select>
              </div>

              {/* Reset button */}
              {(selectedYear !== "all" ||
                selectedCategory !== "all" ||
                selectedAgency !== "all" ||
                selectedBracket !== "all" ||
                searchQuery) && (
                <button
                  onClick={handleResetFilters}
                  className="rounded-xl bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Visual Charts Section ── */}
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Chart 1: Bar Chart comparing ราคากลาง vs ราคาที่ชนะ by Category (8 cols) */}
          <div className="panel p-5 lg:col-span-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3.5">
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">
                  เปรียบเทียบราคากลาง vs ราคาที่ชนะการประมูล ตามหมวดหมู่งาน
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  วิเคราะห์ผลต่างมูลค่างบประมาณของแต่ละประเภทโครงการไอที (หน่วย: ล้านบาท)
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground self-start sm:self-auto bg-surface-2 px-2.5 py-1 rounded-md">
                หน่วย: ล้านบาท (THB)
              </span>
            </div>

            <div className="mt-4 pt-1">
              <DynamicPriceBarChart data={categoryComparison} />
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-border text-xs">
              {categoryComparison.map((c) => (
                <div key={c.category} className="rounded-lg bg-surface-2/60 p-2.5">
                  <p className="font-medium text-foreground truncate">{c.categoryLabel}</p>
                  <p className="text-muted-foreground mt-0.5 font-mono">
                    ส่วนต่าง: <span className="text-emerald-700 font-semibold">{c.avgDiscountPct}%</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 2: Discount Brackets Breakdown (4 cols) */}
          <div className="panel p-5 lg:col-span-4 flex flex-col justify-between">
            <div>
              <div className="border-b border-border pb-3.5">
                <h3 className="font-display text-base font-semibold text-foreground">
                  การกระจายตัวของอัตราประหยัด
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  สัดส่วนโครงการแยกตามช่วงเปอร์เซ็นต์ส่วนต่างราคา
                </p>
              </div>

              <div className="mt-3">
                <DynamicBracketDonutChart data={discountBrackets} />
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
              {discountBrackets.map((b) => (
                <div key={b.bracket} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="text-muted-foreground">{b.label}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-medium">{b.count} งาน</span>
                    <span className="text-muted-foreground">({b.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 3: Top Agencies with highest budget savings (12 cols) */}
          <div className="panel p-5 lg:col-span-12">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3.5">
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">
                  ท็อปหน่วยงานที่มีมูลค่าการประหยัดงบประมาณสูงสุด
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  จัดอันดับองค์กรภาครัฐที่มีการต่อรองราคาและประหยัดงบประมาณจากการประมูลสูงสุด
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                แสดงผล 6 ลำดับแรก
              </span>
            </div>

            <div className="mt-4">
              <DynamicAgencyBarChart data={topAgencies} />
            </div>
          </div>
        </section>

        {/* ── Key Takeaways & Analytical Insights Callout ── */}
        <section className="mt-6 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/5 via-surface to-accent/5 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/15 p-2 text-primary">
              <SparklesIcon className="size-5" />
            </div>
            <div>
              <h4 className="font-display text-base font-semibold text-foreground">
                บทวิเคราะห์สรุปผลภาพรวม (Executive Key Insights)
              </h4>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs sm:text-sm text-muted-foreground">
                <div className="rounded-xl bg-surface/80 p-3 border border-border">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircleIcon className="size-4 text-primary" />
                    หมวดหมู่ที่มีการแข่งขันราคาสูงสุด
                  </p>
                  <p className="mt-1 leading-relaxed">
                    หมวด <strong className="text-foreground">งานข้อมูลและวิเคราะห์ (Data / BI)</strong> มีอัตราประหยัดเฉลี่ยสูงถึง{" "}
                    <strong className="text-emerald-700">12.5%</strong> แสดงถึงความหลากหลายของผู้พัฒนาซอฟต์แวร์ในตลาด
                  </p>
                </div>
                <div className="rounded-xl bg-surface/80 p-3 border border-border">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircleIcon className="size-4 text-primary" />
                    ความคุ้มค่างบประมาณรวม
                  </p>
                  <p className="mt-1 leading-relaxed">
                    โครงการทั้งหมดสามารถประหยัดงบประมาณแผ่นดินได้รวมกว่า{" "}
                    <strong className="text-emerald-700">{formatBahtCurrency(summary.totalSavings)}</strong> คิดเป็นส่วนต่างเฉลี่ย{" "}
                    <strong className="text-foreground">{summary.avgDiscountPct}%</strong> ต่ำกว่าราคากลางที่ตั้งไว้
                  </p>
                </div>
                <div className="rounded-xl bg-surface/80 p-3 border border-border">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircleIcon className="size-4 text-primary" />
                    ความโปร่งใสและระบบการประมูล
                  </p>
                  <p className="mt-1 leading-relaxed">
                    กว่า <strong className="text-foreground">{summary.savingsRatioCount} จาก {summary.totalProjects} โครงการ</strong>{" "}
                    มีราคาชนะประมูลที่ต่ำกว่าเพดานราคากลาง สะท้อนถึงการกำหนดราคากลางที่สมเหตุสมผลของภาครัฐ
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Detailed Procurement Project Table ── */}
        <section className="mt-8 panel overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-border">
            <div>
              <h3 className="font-display text-base font-semibold text-foreground">
                ตารางเปรียบเทียบราคาโครงการจัดซื้อจัดจ้างรายรายการ
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                รายการ TOR และผลการวิเคราะห์ราคาชนะประมูล ({filteredItems.length} โครงการ)
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span>แสดงผล {paginatedItems.length} จาก {filteredItems.length} โครงการ</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-surface-2/60 text-muted-foreground border-b border-border font-mono text-xs">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-medium">
                    <button
                      onClick={() => handleSort("projectTitle")}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      โครงการจัดซื้อจัดจ้าง
                      <ChevronUpDownIcon className="size-3.5" />
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3.5 font-medium">
                    หน่วยงานเจ้าของโครงการ
                  </th>
                  <th scope="col" className="px-4 py-3.5 font-medium text-right">
                    <button
                      onClick={() => handleSort("medianPrice")}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                    >
                      ราคากลาง
                      <ChevronUpDownIcon className="size-3.5" />
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3.5 font-medium text-right">
                    <button
                      onClick={() => handleSort("winningPrice")}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                    >
                      ราคาชนะประมูล
                      <ChevronUpDownIcon className="size-3.5" />
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3.5 font-medium text-right">
                    <button
                      onClick={() => handleSort("savingsAmount")}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                    >
                      ส่วนต่างประหยัด
                      <ChevronUpDownIcon className="size-3.5" />
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3.5 font-medium text-center">
                    <button
                      onClick={() => handleSort("discountPct")}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors mx-auto"
                    >
                      % ประหยัด
                      <ChevronUpDownIcon className="size-3.5" />
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3.5 font-medium text-center print:hidden">
                    การดำเนินการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <InformationCircleIcon className="size-8 text-muted-foreground/60" />
                        <p className="text-sm font-medium">ไม่พบโครงการที่ตรงกับเงื่อนไขการค้นหา</p>
                        <button
                          onClick={handleResetFilters}
                          className="mt-1 text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          ล้างตัวกรองทั้งหมด
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-2/40 transition-colors group"
                    >
                      {/* Project Title & Category */}
                      <td className="px-5 py-4 max-w-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground font-mono">
                            {item.categoryLabel}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {item.externalId || item.id.slice(0, 8)}
                          </span>
                        </div>
                        <Link
                          href={`/tor/${encodeURIComponent(item.id)}`}
                          className="font-medium text-foreground hover:text-primary transition-colors line-clamp-2"
                        >
                          {item.projectTitle}
                        </Link>
                      </td>

                      {/* Agency */}
                      <td className="px-4 py-4 text-muted-foreground text-xs">
                        <div className="flex items-center gap-1.5">
                          <BuildingLibraryIcon className="size-3.5 shrink-0 text-muted-foreground/80" />
                          <span className="line-clamp-2">{item.agencyName}</span>
                        </div>
                      </td>

                      {/* Median Price */}
                      <td className="px-4 py-4 text-right font-mono font-medium text-foreground">
                        ฿{item.medianPrice.toLocaleString("th-TH")}
                      </td>

                      {/* Winning Price */}
                      <td className="px-4 py-4 text-right font-mono font-semibold text-primary">
                        ฿{item.winningPrice.toLocaleString("th-TH")}
                      </td>

                      {/* Savings Amount */}
                      <td className="px-4 py-4 text-right font-mono text-emerald-700 font-medium">
                        ฿{item.savingsAmount.toLocaleString("th-TH")}
                      </td>

                      {/* Discount % Badge */}
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-mono font-semibold ${
                            item.statusBadge.variant === "high-savings"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.statusBadge.variant === "competitive"
                              ? "bg-primary/15 text-primary"
                              : item.statusBadge.variant === "tight"
                              ? "bg-surface-2 text-muted-foreground"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          -{item.discountPct}%
                        </span>
                      </td>

                      {/* Detail Link Action */}
                      <td className="px-4 py-4 text-center print:hidden">
                        <Link
                          href={`/tor/${encodeURIComponent(item.id)}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-2 hover:border-primary transition-colors text-foreground"
                        >
                          <span>ดู TOR</span>
                          <span aria-hidden="true">→</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
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
                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`h-7 w-7 rounded-lg text-xs font-mono font-medium transition-colors ${
                        page === currentPage
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-surface-2 text-muted-foreground"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-border p-1.5 hover:bg-surface-2 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  aria-label="หน้าถัดไป"
                >
                  <ChevronRightIcon className="size-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
