const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

// Reports are computed by the backend from finished projects (contract signed, mid and awarded
// prices known) in the newest `tors_bk_*` snapshot, not from the open TORs in `tors`.
// Money is in baht.

export type ReportPeriod = "6m" | "1y" | "3y" | "all";
export type SavingsBucketKey = "over" | "lt5" | "5to10" | "10to15" | "gt15";
export type ProcurementSortField =
  | "projectTitle"
  | "midPriceBaht"
  | "awardedPriceBaht"
  | "savings_amount"
  | "savings_pct"
  | "announceDate";

export interface ReportFilters {
  period?: ReportPeriod;
  category?: string;
  department?: string;
  q?: string;
  savingsBucket?: SavingsBucketKey;
}

// Which snapshot the numbers come from; null when the database has no snapshot yet
export interface ReportSource {
  collection: string;
  snapshot_date: string;
  project_count: number;
}

export interface PriceOverview {
  project_count: number;
  total_mid_price_baht: number;
  total_awarded_price_baht: number;
  total_savings_baht: number;
  overall_savings_pct: number | null;
  avg_mid_price_baht: number | null;
  avg_awarded_price_baht: number | null;
  avg_savings_baht: number | null;
  median_savings_pct: number | null;
  pct_projects_below_reference: number | null;
  max_savings_pct: number | null;
}

export interface SavingsBucket {
  key: SavingsBucketKey;
  label: string;
  count: number;
  pct: number;
}

export interface CategoryComparisonRow {
  category: string;
  category_label: string;
  project_count: number;
  total_mid_price_baht: number;
  total_awarded_price_baht: number;
  avg_mid_price_baht: number | null;
  avg_awarded_price_baht: number | null;
  avg_savings_pct: number | null;
}

export interface TimelineMonth {
  month: string; // YYYY-MM
  project_count: number;
  total_mid_price_baht: number;
  total_awarded_price_baht: number;
  total_savings_baht: number;
  avg_savings_pct: number;
}

export interface ProcurementRow {
  external_id: string;
  project_title: string;
  department_name: string | null;
  agency_name: string | null;
  category: string;
  category_label: string;
  announce_date: string | null;
  budget_baht: number | null;
  mid_price_baht: number;
  awarded_price_baht: number;
  savings_amount_baht: number;
  savings_pct: number;
  detail_url: string | null;
}

export interface ProcurementPage {
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: ProcurementRow[];
}

interface ReportResponse<T> {
  success: boolean;
  data: T;
  source: ReportSource | null;
}

export interface ReportResult<T> {
  data: T;
  source: ReportSource | null;
}

function filterParams(filters: ReportFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.period && filters.period !== "all") params.set("period", filters.period);
  if (filters.category) params.set("category", filters.category);
  if (filters.department) params.set("department", filters.department);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.savingsBucket) params.set("savings_bucket", filters.savingsBucket);
  return params;
}

async function getReport<T>(path: string, params: URLSearchParams): Promise<ReportResult<T>> {
  const query = params.toString();
  const res = await fetch(`${apiUrl}/api/v1/reports${path}${query ? `?${query}` : ""}`);
  const body = (await res.json().catch(() => null)) as
    | (ReportResponse<T> & { message?: string })
    | null;
  if (!res.ok || !body) {
    throw new Error(body?.message ?? `โหลดรายงานไม่สำเร็จ (HTTP ${res.status})`);
  }
  return { data: body.data, source: body.source };
}

export function fetchPriceOverview(filters: ReportFilters) {
  return getReport<PriceOverview>("/price-overview", filterParams(filters));
}

export function fetchSavingsDistribution(filters: ReportFilters) {
  return getReport<{ total_projects: number; buckets: SavingsBucket[] }>(
    "/savings-distribution",
    filterParams(filters)
  );
}

export function fetchCategoryComparison(filters: ReportFilters) {
  return getReport<{ categories: CategoryComparisonRow[] }>(
    "/category-comparison",
    filterParams(filters)
  );
}

export function fetchReportTimeline(filters: ReportFilters) {
  return getReport<{ months: TimelineMonth[] }>("/timeline", filterParams(filters));
}

export function fetchProcurementList(
  filters: ReportFilters,
  options: {
    page: number;
    pageSize: number;
    sortBy: ProcurementSortField;
    sortOrder: "asc" | "desc";
  }
) {
  const params = filterParams(filters);
  params.set("page", String(options.page));
  params.set("page_size", String(options.pageSize));
  params.set("sort_by", options.sortBy);
  params.set("sort_order", options.sortOrder);
  return getReport<ProcurementPage>("/procurement-list", params);
}

export async function fetchReportDepartments(): Promise<string[]> {
  const result = await getReport<{ departments: string[] }>(
    "/filters/departments",
    new URLSearchParams()
  );
  return result.data.departments;
}

/**
 * Format Thai Baht values for display (฿1.23 พันล้าน, ฿45.60 ล้าน, ฿12,345).
 */
export function formatBahtCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return "—";
  const sign = val < 0 ? "-" : "";
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000) {
    return `${sign}฿${(abs / 1_000_000_000).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} พันล้าน`;
  }
  if (abs >= 1_000_000) {
    return `${sign}฿${(abs / 1_000_000).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ล้าน`;
  }
  return `${sign}฿${abs.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

// "2026-02" -> "ก.พ. 69"
export function formatThaiMonth(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) return month;
  return `${THAI_MONTHS_SHORT[monthIndex - 1]} ${String((year + 543) % 100).padStart(2, "0")}`;
}

// "2026-10-04" -> "4 ต.ค. 2569"
export function formatSnapshotDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${year + 543}`;
}

const csvCell = (value: string | number | null) => {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Download every project that matches the filters as CSV (UTF-8 with BOM for Excel).
 * Pages through the procurement list 100 rows at a time.
 */
export async function exportProcurementCsv(
  filters: ReportFilters,
  sortBy: ProcurementSortField,
  sortOrder: "asc" | "desc",
  filename: string
): Promise<number> {
  const rows: ProcurementRow[] = [];
  for (let page = 1; ; page += 1) {
    const { data } = await fetchProcurementList(filters, { page, pageSize: 100, sortBy, sortOrder });
    rows.push(...data.items);
    if (page >= data.total_pages) break;
  }

  const header = [
    "เลขที่โครงการ",
    "ชื่อโครงการ",
    "หน่วยงาน",
    "หมวดหมู่",
    "วันประกาศ",
    "ราคากลาง (บาท)",
    "ราคาที่ชนะ (บาท)",
    "ส่วนต่าง (บาท)",
    "ส่วนต่าง (%)",
    "ลิงก์ e-GP",
  ];
  const lines = rows.map((row) =>
    [
      row.external_id,
      row.project_title,
      row.department_name,
      row.category_label,
      row.announce_date?.slice(0, 10) ?? null,
      row.mid_price_baht,
      row.awarded_price_baht,
      row.savings_amount_baht,
      row.savings_pct,
      row.detail_url,
    ]
      .map(csvCell)
      .join(",")
  );

  const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return rows.length;
}
