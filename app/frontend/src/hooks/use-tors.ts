"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchTorFilterOptions,
  fetchTors,
  fetchTorRecommendations,
  type FetchTorsParams,
  type TorFilterOptions,
  type FetchTorsResponse,
  type RecommendedTorItem,
} from "@/api/tor.api";

export function useTorFilterOptions() {
  return useQuery<TorFilterOptions>({
    queryKey: ["torFilterOptions"],
    queryFn: fetchTorFilterOptions,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false,
  });
}

export function useTors(params: FetchTorsParams) {
  return useQuery<FetchTorsResponse>({
    queryKey: [
      "tors",
      params.q ?? "",
      params.year ?? "all",
      params.budget_min ?? 0,
      params.budget_max ?? 0,
      params.technologies ?? "all",
      params.page ?? 1,
      params.limit ?? 4,
    ],
    queryFn: () => fetchTors(params),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}

export function useTorRecommendations(enabled = true) {
  return useQuery<RecommendedTorItem[]>({
    queryKey: ["torRecommendations"],
    queryFn: fetchTorRecommendations,
    enabled,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
