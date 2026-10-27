"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCardMatches, type CardMatch } from "@/api/bidder-profile.api";

// Scores are computed in the background, so cards waiting for one ask again every 30 seconds.
const PENDING_REFETCH_MS = 30_000;

/** Precomputed qualification scores for the TOR cards on one page (max 50 ids). */
export function useCardMatches(torIds: string[], enabled: boolean) {
  const ids = torIds.slice(0, 50);

  const query = useQuery({
    queryKey: ["cardMatches", ids],
    queryFn: () => fetchCardMatches(ids),
    enabled: enabled && ids.length > 0,
    retry: false,
    refetchInterval: (q) =>
      q.state.data?.items.some((item) => item.status === "pending" || item.status === "stale")
        ? PENDING_REFETCH_MS
        : false,
  });

  const byTorId = new Map<string, CardMatch>(
    (query.data?.items ?? []).map((item) => [item.torId, item]),
  );
  return { byTorId, completeness: query.data?.completeness ?? null };
}
