"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchCategoryComparison,
  fetchPriceOverview,
  fetchProcurementList,
  fetchReportDepartments,
  fetchReportTimeline,
  fetchSavingsDistribution,
  type ProcurementSortField,
  type ReportFilters,
} from "@/api/reports.api";

// Report data changes only when ingestion runs, so a short cache is enough.
const REPORT_STALE_MS = 60 * 1000;

const filterKey = (filters: ReportFilters) => [
  filters.period ?? "all",
  filters.category ?? "",
  filters.department ?? "",
  filters.q ?? "",
  filters.savingsBucket ?? "",
];

const reportQuery = {
  staleTime: REPORT_STALE_MS,
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData,
} as const;

// Overview cards, savings buckets, category chart and timeline for one set of filters
export function useReportCharts(filters: ReportFilters) {
  const key = filterKey(filters);
  const overview = useQuery({
    queryKey: ["reports", "overview", ...key],
    queryFn: () => fetchPriceOverview(filters),
    ...reportQuery,
  });
  const distribution = useQuery({
    queryKey: ["reports", "distribution", ...key],
    queryFn: () => fetchSavingsDistribution(filters),
    ...reportQuery,
  });
  const categories = useQuery({
    queryKey: ["reports", "categories", ...key],
    queryFn: () => fetchCategoryComparison(filters),
    ...reportQuery,
  });
  const timeline = useQuery({
    queryKey: ["reports", "timeline", ...key],
    queryFn: () => fetchReportTimeline(filters),
    ...reportQuery,
  });
  return { overview, distribution, categories, timeline };
}

export function useProcurementList(
  filters: ReportFilters,
  options: {
    page: number;
    pageSize: number;
    sortBy: ProcurementSortField;
    sortOrder: "asc" | "desc";
  }
) {
  return useQuery({
    queryKey: [
      "reports",
      "list",
      ...filterKey(filters),
      options.page,
      options.pageSize,
      options.sortBy,
      options.sortOrder,
    ],
    queryFn: () => fetchProcurementList(filters, options),
    ...reportQuery,
  });
}

export function useReportDepartments() {
  return useQuery({
    queryKey: ["reports", "departments"],
    queryFn: fetchReportDepartments,
    staleTime: REPORT_STALE_MS,
    refetchOnWindowFocus: false,
  });
}
