const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

// Counts over `tors`, the TORs still open for bidding
export interface HomepageSummary {
  total_tors: number;
  total_sources: number;
  total_budget: number;
  // Average budget over the TORs that state one
  avg_budget: number | null;
  // TORs that entered the system this week (Monday start, Bangkok time)
  new_this_week: number;
  last_updated: string | null;
}

export interface TechnologyMetric {
  _id: string;
  count: number;
  percentage: number;
}

export interface CategoryMetric {
  category: string;
  label: string;
  percentage: number;
}

// Prices come from finished projects (newest tors_bk_* snapshot). Every active category is
// listed; averages are null when a category has no finished project.
export interface PriceComparisonMetric {
  category: string;
  label: string;
  projectCount: number;
  avgMidPriceBaht: number | null;
  avgAwardedPriceBaht: number | null;
}

export interface PriceSummary {
  projectCount: number;
  avgMidPriceBaht: number | null;
  avgAwardedPriceBaht: number | null;
  avgDiscountPct: number | null;
}

export interface HomepageAnalytics {
  topTechnologies: TechnologyMetric[];
  categoryDistribution: CategoryMetric[];
  priceComparison: PriceComparisonMetric[];
  priceSummary: PriceSummary;
  // Which snapshot the prices come from; null when there is none
  priceSource: { collection: string; snapshot_date: string; project_count: number } | null;
}

/**
 * Fetch homepage summary stats (total TORs, sources, budget, new this week)
 */
export async function fetchHomepageSummary(): Promise<HomepageSummary> {
  const res = await fetch(`${apiUrl}/api/v1/homepage/summary`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch homepage summary (${res.status})`);
  }

  return await res.json();
}

/**
 * Fetch homepage analytics (top technologies and category distribution)
 */
export async function fetchHomepageAnalytics(): Promise<HomepageAnalytics> {
  const res = await fetch(`${apiUrl}/api/v1/homepage/analytics`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch homepage analytics (${res.status})`);
  }

  return await res.json();
}

/**
 * Format budget amount to readable Thai currency (e.g. ฿3.4 พันล้าน, ฿619.2 ล้าน)
 */
export function formatBudgetSummary(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "฿0";
  if (amount >= 1_000_000_000) {
    const val = amount / 1_000_000_000;
    return `฿${val >= 100 ? val.toFixed(0) : val.toFixed(1)} พันล้าน`;
  }
  if (amount >= 1_000_000) {
    const val = amount / 1_000_000;
    return `฿${val >= 100 ? val.toFixed(0) : val.toFixed(1)} ล้าน`;
  }
  return `฿${amount.toLocaleString("th-TH")}`;
}

/**
 * Format ISO date string into Thai time string (e.g. "08:40 น." or "13:47 น.")
 */
export function formatLastUpdatedTime(isoDateStr?: string | null): string {
  if (!isoDateStr) return "08:40 น.";
  try {
    const date = new Date(isoDateStr);
    if (isNaN(date.getTime())) return "08:40 น.";
    const timeStr = date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Bangkok",
    });
    return `${timeStr} น.`;
  } catch {
    return "08:40 น.";
  }
}
