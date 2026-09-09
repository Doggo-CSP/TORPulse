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
  summary: string | null;
  objectives: string[];
  requirements: string[];
  bidderQualifications: string[];
  technologies: string[];
  budgetBaht: number | null;
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
  budgetBaht: number | null;
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

/**
 * Helper to format Thai short date (e.g. "2026-09-01T13:47:00.084Z" -> "1 ก.ย. 69")
 */
export function formatThaiDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    const month = months[d.getMonth()];
    const thaiYearShort = String((d.getFullYear() + 543) % 100).padStart(2, "0");
    return `${day} ${month} ${thaiYearShort}`;
  } catch {
    return dateStr;
  }
}
