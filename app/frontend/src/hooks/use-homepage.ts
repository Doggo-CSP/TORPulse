"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchHomepageSummary,
  fetchHomepageAnalytics,
  type HomepageSummary,
  type HomepageAnalytics,
} from "@/api/homepage.api";

export function useHomepage() {
  const {
    data: summary,
    isLoading: loadingSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery<HomepageSummary>({
    queryKey: ["homepageSummary"],
    queryFn: fetchHomepageSummary,
    staleTime: 60 * 1000, // 1 minute fresh
    refetchOnWindowFocus: false,
  });

  const {
    data: analytics,
    isLoading: loadingAnalytics,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useQuery<HomepageAnalytics>({
    queryKey: ["homepageAnalytics"],
    queryFn: fetchHomepageAnalytics,
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
    refetchOnWindowFocus: false,
  });

  return {
    summary: summary ?? null,
    analytics: analytics ?? null,
    loadingSummary,
    loadingAnalytics,
    summaryError,
    analyticsError,
    refetchSummary,
    refetchAnalytics,
  };
}
