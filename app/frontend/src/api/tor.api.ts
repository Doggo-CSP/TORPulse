const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export interface TorDocument {
  fileName: string;
  mimeType: string;
  sourceUrl: string;
}

export interface TorDetail {
  id: string;
  externalId: string;
  sourceAdapter: string;
  sourceVersion: string;
  detailUrl: string;
  projectTitle: string;
  agencyName: string | null;
  departmentName: string | null;
  departmentSubName: string | null;
  projectStatus: string | null;
  summary: string | null;
  objectives: string[];
  requirements: string[];
  bidderQualifications: string[];
  technologies: string[];
  budgetBaht: number | null;
  midPriceBaht: number | null;
  awardedPriceBaht: number | null;
  announcementDate: string | null;
  submissionDeadline: string | null;
  contactInformation: string[];
  classificationReason: string;
  confidence: number;
  analyzedAt: string;
  documents: TorDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface TorListItem {
  id: string;
  externalId: string;
  sourceAdapter: string;
  projectTitle: string;
  agencyName: string | null;
  summary: string | null;
  detailUrl: string | null;
  budgetBaht: number | null;
  announcementDate: string | null;
  submissionDeadline: string | null;
  technologies: string[];
  createdAt: string;
  category: string;
}

export interface RecommendedTorItem extends TorListItem {
  score: number;
}

export interface TorFilterOptions {
  years: number[];
  technologies: string[];
}

export interface FetchTorsParams {
  q?: string;
  budget_min?: number;
  budget_max?: number;
  year?: number | string;
  technologies?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "deadline";
}

export interface FetchTorsResponse {
  items: TorListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export async function fetchTorById(id: string): Promise<TorDetail | null> {
  const response = await fetch(`${apiUrl}/api/v1/tors/${encodeURIComponent(id)}`);

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch TOR (${response.status})`);

  return response.json();
}

/**
 * Fetch filter options (available years and technologies from database)
 */
export async function fetchTorFilterOptions(): Promise<TorFilterOptions> {
  const res = await fetch(`${apiUrl}/api/v1/tors/filter-options`);
  if (!res.ok) {
    throw new Error(`Failed to fetch filter options (${res.status})`);
  }
  return await res.json();
}

/**
 * Fetch filtered TOR items from backend
 */
export async function fetchTors(params: FetchTorsParams = {}): Promise<FetchTorsResponse> {
  const searchParams = new URLSearchParams();

  if (params.q && params.q.trim()) {
    searchParams.set("q", params.q.trim());
  }

  if (params.year !== undefined && params.year !== "all" && params.year !== "ทั้งหมด" && params.year !== "") {
    searchParams.set("year", String(params.year));
  }

  if (params.budget_min !== undefined && !isNaN(params.budget_min)) {
    searchParams.set("budget_min", String(params.budget_min));
  }

  if (params.budget_max !== undefined && !isNaN(params.budget_max)) {
    searchParams.set("budget_max", String(params.budget_max));
  }

  if (
    params.technologies &&
    params.technologies !== "all" &&
    params.technologies !== "ทั้งหมด" &&
    params.technologies.trim() !== ""
  ) {
    searchParams.set("technologies", params.technologies.trim());
  }

  if (params.page !== undefined && params.page > 0) {
    searchParams.set("page", String(params.page));
  }

  if (params.limit !== undefined && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }

  if (params.sort) {
    searchParams.set("sort", params.sort);
  }

  const queryString = searchParams.toString();
  const url = `${apiUrl}/api/v1/tors${queryString ? `?${queryString}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch TORs (${res.status})`);
  }

  return await res.json();
}

/**
 * Fetch personalized TOR recommendations (cookie/session authenticated)
 */
export async function fetchTorRecommendations(): Promise<RecommendedTorItem[]> {
  const res = await fetch(`${apiUrl}/api/v1/tors/recommendations`, {
    credentials: "include",
  });

  if (res.status === 401) {
    return [];
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch recommendations (${res.status})`);
  }

  const data = await res.json();
  return data.items || [];
}

/**
 * Helper to format Buddhist era year (e.g. 2026 -> 2569)
 */
export function formatBuddhistYear(year: number): string {
  if (year > 2400) return String(year);
  return `${year + 543} (${year})`;
}

// ---------------------------------------------------------------------------
// Thai date helpers
// ---------------------------------------------------------------------------

const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface FormatThaiDateOptions {
  /**
   * Used only when the input has month + year but no day (e.g. "มกราคม 2569").
   * - undefined (default): show month + year only ("ม.ค. 69")
   * - "first": assume the 1st of the month
   * - "last": assume the last day of the month (approximation!)
   */
  fallbackDay?: "first" | "last";
}

/** Convert any year to Buddhist Era (years > 2400 are assumed to be BE already). */
function toBuddhistEra(year: number): number {
  return year > 2400 ? year : year + 543;
}

function formatParts(
  day: number | null,
  monthIdx: number,
  yearBE: number,
  fallbackDay?: "first" | "last",
): string {
  const yy = String(yearBE % 100).padStart(2, "0");
  const month = THAI_MONTHS_SHORT[monthIdx];

  let d = day;
  if (!d && fallbackDay) {
    const yearCE = yearBE - 543;
    d =
      fallbackDay === "first"
        ? 1
        : new Date(Date.UTC(yearCE, monthIdx + 1, 0)).getUTCDate();
  }
  return d ? `${d} ${month} ${yy}` : `${month} ${yy}`;
}

/** Match a Thai month name (full or short, with/without trailing dot). Returns index or -1. */
function findThaiMonth(token: string): number {
  const t = token.trim();
  let idx = THAI_MONTHS_FULL.indexOf(t);
  if (idx !== -1) return idx;

  idx = THAI_MONTHS_SHORT.indexOf(t);
  if (idx !== -1) return idx;

  // short form without the trailing dot, e.g. "ม.ค"
  return THAI_MONTHS_SHORT.findIndex((m) => m.replace(/\.$/, "") === t);
}

/**
 * Format a date as Thai short date, e.g. "1 ม.ค. 69".
 *
 * Accepts:
 *  - Thai text from backend: "มกราคม 2569", "15 มกราคม 2569", "15 ม.ค. 2569"
 *    (year is Buddhist Era -> never add 543 again)
 *  - ISO / parseable dates: "2026-01-01", "2026-09-01T13:47:00.084Z"
 *    (Gregorian -> converted to Buddhist Era, evaluated in Asia/Bangkok time)
 *  - ISO-like with BE year: "2569-01-01" (year > 2400 -> treated as BE)
 *
 * Month-only inputs return month + year only ("ม.ค. 69") unless
 * options.fallbackDay is provided.
 */
export function formatThaiDate(
  dateStr?: string | null,
  options?: FormatThaiDateOptions,
): string {
  if (!dateStr) return "-";
  const s = dateStr.trim();
  if (!s) return "-";

  // 1) Thai text: [day] month year
  const thaiMatch = s.match(/^(?:(\d{1,2})\s+)?([^\s\d]+)\s+(\d{4})$/);
  if (thaiMatch) {
    const monthIdx = findThaiMonth(thaiMatch[2]);
    if (monthIdx !== -1) {
      const day = thaiMatch[1] ? Number(thaiMatch[1]) : null;
      const year = Number(thaiMatch[3]);
      return formatParts(day, monthIdx, toBuddhistEra(year), options?.fallbackDay);
    }
  }

  // 2) Date-only ISO (YYYY-MM-DD): parse manually, avoids timezone shifts
  const isoDateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const year = Number(isoDateOnly[1]);
    const monthIdx = Number(isoDateOnly[2]) - 1;
    const day = Number(isoDateOnly[3]);
    if (monthIdx >= 0 && monthIdx < 12 && day >= 1 && day <= 31) {
      return formatParts(day, monthIdx, toBuddhistEra(year));
    }
  }

  // 3) Anything else JS can parse (full ISO timestamps, etc.)
  const d = new Date(s);
  if (isNaN(d.getTime())) return dateStr;

  // Shift to Bangkok time so the displayed day matches local day
  const bkk = new Date(d.getTime() + BANGKOK_OFFSET_MS);
  return formatParts(bkk.getUTCDate(), bkk.getUTCMonth(), toBuddhistEra(bkk.getUTCFullYear()));
}


// ---------------------------------------------------------------------------
// Deadline / recency helpers
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Day number (Bangkok calendar) of the given date, or null if no full date is available. */
function toBangkokDayIndex(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const s = dateStr.trim();
  if (!s) return null;

  // Thai text with a full date, e.g. "15 มกราคม 2569"
  const thai = s.match(/^(\d{1,2})\s+([^\s\d]+)\s+(\d{4})$/);
  if (thai) {
    const monthIdx = findThaiMonth(thai[2]);
    if (monthIdx === -1) return null;
    const yearCE = toBuddhistEra(Number(thai[3])) - 543;
    return Date.UTC(yearCE, monthIdx, Number(thai[1])) / DAY_MS;
  }

  // YYYY-MM-DD (BE years supported)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const yearCE = toBuddhistEra(Number(iso[1])) - 543;
    return Date.UTC(yearCE, Number(iso[2]) - 1, Number(iso[3])) / DAY_MS;
  }

  // Full timestamp
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() + BANGKOK_OFFSET_MS) / DAY_MS);
}

export type DeadlineTone = "open" | "soon" | "closed" | "unknown";

export interface DeadlineInfo {
  daysLeft: number | null;
  label: string;
  tone: DeadlineTone;
}

/**
 * Days remaining until the submission deadline (Bangkok calendar days).
 * Month-only deadlines (e.g. "มกราคม 2569") have no exact day, so they are
 * reported as unknown instead of guessing.
 */
export function getDeadlineInfo(
  deadline?: string | null,
  now: Date = new Date(),
): DeadlineInfo {
  const deadlineDay = toBangkokDayIndex(deadline);
  if (deadlineDay === null) {
    return { daysLeft: null, label: "ไม่ระบุวันปิดรับ", tone: "unknown" };
  }

  const today = Math.floor((now.getTime() + BANGKOK_OFFSET_MS) / DAY_MS);
  const daysLeft = deadlineDay - today;

  if (daysLeft < 0) return { daysLeft, label: "ปิดรับแล้ว", tone: "closed" };
  if (daysLeft === 0) return { daysLeft, label: "ปิดรับวันนี้", tone: "soon" };
  if (daysLeft <= 7) return { daysLeft, label: `เหลือ ${daysLeft} วัน`, tone: "soon" };
  return { daysLeft, label: `เหลือ ${daysLeft} วัน`, tone: "open" };
}

/**
 * Was this TOR announced within the last N days?
 * Uses announcementDate when available, otherwise falls back to createdAt
 * (which is the time it entered our system, not the real announcement date).
 */
export function isRecentTor(
  item: { announcementDate?: string | null; createdAt: string },
  withinDays = 7,
  now: Date = new Date(),
): boolean {
  const day = toBangkokDayIndex(item.announcementDate ?? item.createdAt);
  if (day === null) return false;
  const today = Math.floor((now.getTime() + BANGKOK_OFFSET_MS) / DAY_MS);
  const age = today - day;
  return age >= 0 && age <= withinDays;
}