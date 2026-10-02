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
const DAY_MS = 24 * 60 * 60 * 1000;

export interface FormatThaiDateOptions {
  /**
   * Used only when the input has month + year but no day (e.g. "มกราคม 2569").
   * - undefined (default): show month + year only ("ม.ค. 69")
   * - "first": assume the 1st of the month
   * - "last": assume the last day of the month (approximation!)
   */
  fallbackDay?: "first" | "last";
}

/** Normalized date parts. `year` is always Gregorian (CE); `day` is null for month-only input. */
interface DateParts {
  year: number;
  monthIdx: number; // 0-11
  day: number | null;
}

/**
 * Convert any year to Gregorian (CE).
 * - 2-digit years are treated as Buddhist Era 25xx (69 -> 2569 -> 2026)
 * - years > 2400 are treated as Buddhist Era
 */
function toCEYear(year: number): number {
  if (year < 100) return 2500 + year - 543;
  return year > 2400 ? year - 543 : year;
}

function daysInMonth(yearCE: number, monthIdx: number): number {
  return new Date(Date.UTC(yearCE, monthIdx + 1, 0)).getUTCDate();
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
 * Single source of truth for parsing dates coming from the backend.
 *
 * Accepts:
 *  - Thai text: "มกราคม 2569", "15 มกราคม 2569", "15 ม.ค. 2569", "15 ม.ค. 69"
 *  - Date-only ISO: "2026-01-31" or "2569-01-31" (BE supported)
 *  - Timestamps: "2026-01-31T10:00:00Z", "2569-01-31T10:00:00+07:00",
 *    and timestamps without timezone (assumed Bangkok time)
 *
 * Returns null if the input can't be parsed or the date doesn't exist (e.g. 31 Feb).
 */
function parseDateParts(input?: string | null): DateParts | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  // 1) Thai text: [day] month year
  const thai = s.match(/^(?:(\d{1,2})\s+)?([^\s\d]+)\s+(\d{2,4})$/);
  if (thai) {
    const monthIdx = findThaiMonth(thai[2]);
    if (monthIdx !== -1) {
      const year = toCEYear(Number(thai[3]));
      const day = thai[1] ? Number(thai[1]) : null;
      if (day !== null && (day < 1 || day > daysInMonth(year, monthIdx))) return null;
      return { year, monthIdx, day };
    }
  }

  // 2) Date-only ISO: parse manually to avoid timezone shifts
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = toCEYear(Number(iso[1]));
    const monthIdx = Number(iso[2]) - 1;
    const day = Number(iso[3]);
    if (monthIdx < 0 || monthIdx > 11) return null;
    if (day < 1 || day > daysInMonth(year, monthIdx)) return null;
    return { year, monthIdx, day };
  }

  // 3) Timestamps. No timezone given -> assume Bangkok so users abroad see the same day.
  const looksLikeDateTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s);
  const hasTz = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const normalized =
    looksLikeDateTime && !hasTz ? `${s.replace(" ", "T")}+07:00` : s;

  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;

  // Shift to Bangkok time so the day matches the local Thai day
  const bkk = new Date(d.getTime() + BANGKOK_OFFSET_MS);
  return {
    year: toCEYear(bkk.getUTCFullYear()), // handles BE years like 2569-01-31T...
    monthIdx: bkk.getUTCMonth(),
    day: bkk.getUTCDate(),
  };
}

/**
 * Format a date as Thai short date, e.g. "1 ม.ค. 69".
 * Month-only inputs return month + year only ("ม.ค. 69") unless
 * options.fallbackDay is provided. Unparseable input is returned as-is.
 */
export function formatThaiDate(
  dateStr?: string | null,
  options?: FormatThaiDateOptions,
): string {
  if (!dateStr || !dateStr.trim()) return "-";

  const parts = parseDateParts(dateStr);
  if (!parts) return dateStr;

  let day = parts.day;
  if (day === null && options?.fallbackDay) {
    day =
      options.fallbackDay === "first"
        ? 1
        : daysInMonth(parts.year, parts.monthIdx);
  }

  const yy = String((parts.year + 543) % 100).padStart(2, "0");
  const month = THAI_MONTHS_SHORT[parts.monthIdx];
  return day ? `${day} ${month} ${yy}` : `${month} ${yy}`;
}

// ---------------------------------------------------------------------------
// Deadline / recency helpers
// ---------------------------------------------------------------------------

/** Day number (Bangkok calendar) of the given date, or null if no full date is available. */
function toBangkokDayIndex(
  dateStr?: string | null,
  fallbackDay?: "first" | "last",
): number | null {
  const parts = parseDateParts(dateStr);
  if (!parts) return null;

  let day = parts.day;
  if (day === null) {
    if (!fallbackDay) return null;
    day = fallbackDay === "first" ? 1 : daysInMonth(parts.year, parts.monthIdx);
  }
  return Date.UTC(parts.year, parts.monthIdx, day) / DAY_MS;
}

function todayIndex(now: Date): number {
  return Math.floor((now.getTime() + BANGKOK_OFFSET_MS) / DAY_MS);
}

export type DeadlineTone = "open" | "soon" | "closed" | "unknown";

export interface DeadlineInfo {
  daysLeft: number | null;
  label: string;
  tone: DeadlineTone;
  approximate?: boolean;
}

function formatRemaining(days: number): string {
  if (days < 14) return `${days} วัน`;
  if (days < 60) {
    const weeks = Math.floor(days / 7);
    const rest = days % 7;
    return rest === 0 ? `${weeks} สัปดาห์` : `${weeks} สัปดาห์ ${rest} วัน`;
  }
  const months = Math.floor(days / 30);
  return `${months} เดือน`;
}

/**
 * Days remaining until the submission deadline (Bangkok calendar days).
 *
 * - Month-only deadlines (e.g. "มกราคม 2569") are reported as unknown.
 * - If `since` (announcement date) is given and the deadline is before it,
 *   the deadline is treated as unreliable (likely an extraction error)
 *   and reported as unknown.
 */
/** แปลงจำนวนวันเป็นข้อความช่วงเวลา เช่น "7 วัน", "2 สัปดาห์", "3 เดือน" */

export function getDeadlineInfo(
  deadline?: string | null,
  since?: string | null,
  now: Date = new Date(),
): DeadlineInfo {
  const deadlineDay = toBangkokDayIndex(deadline, "last");
  if (deadlineDay === null) {
    return { daysLeft: null, label: "ไม่ระบุวันปิดรับ", tone: "unknown" };
  }

  // ไม่มีวันที่ในข้อมูลต้นทาง = ใช้วันสุดท้ายของเดือนเป็นค่าประมาณ
  const approximate = parseDateParts(deadline)?.day === null;

  const sinceDay = toBangkokDayIndex(since);
  if (sinceDay !== null && deadlineDay < sinceDay) {
    return { daysLeft: null, label: "วันปิดรับไม่น่าเชื่อถือ", tone: "unknown" };
  }

  const daysLeft = deadlineDay - todayIndex(now);
  const prefix = approximate ? "ประมาณ " : "";

  if (daysLeft < 0) return { daysLeft, label: "ปิดรับแล้ว", tone: "closed", approximate };
  if (daysLeft === 0) return { daysLeft, label: "ปิดรับวันนี้", tone: "soon", approximate };

  const label = `เหลืออีก ${prefix}${formatRemaining(daysLeft)}`;
  return { daysLeft, label, tone: daysLeft <= 7 ? "soon" : "open", approximate };
}

/**
 * Was this TOR announced within the last N days?
 * Uses announcementDate when it has a full date, otherwise falls back to
 * createdAt (the time it entered our system, not the real announcement date).
 */
export function isRecentTor(
  item: { announcementDate?: string | null; createdAt: string },
  withinDays = 7,
  now: Date = new Date(),
): boolean {
  const day =
    toBangkokDayIndex(item.announcementDate) ??
    toBangkokDayIndex(item.createdAt);
  if (day === null) return false;
  const age = todayIndex(now) - day;
  return age >= 0 && age <= withinDays;
}