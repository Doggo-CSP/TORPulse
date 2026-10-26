// app/homepage/card-match-badge.tsx
"use client";

import type { CardMatch } from "@/api/bidder-profile.api";
import { verdictFor } from "@/lib/qualification-labels";

/**
 * Qualification score on a TOR card, shown only once there is a score. Profile completeness is
 * shown once, by the banner above the list, instead of on every card.
 */
export function CardMatchBadge({ match }: { match: CardMatch | undefined }) {
  if (!match) return null;

  if ((match.status === "ready" || match.status === "stale") && match.percentage !== null) {
    const verdict = verdictFor(match.percentage, match.allMandatoryMet ?? false);
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${verdict.badgeCls}`}
        title={verdict.label}
      >
        ตรงคุณสมบัติ {match.percentage}%
        {!match.allMandatoryMet && <span className="font-normal">· ขาดเกณฑ์บังคับ</span>}
        {match.status === "stale" && <span className="font-normal opacity-70">· กำลังอัปเดต</span>}
      </span>
    );
  }

  // pending, profile_incomplete, failed, not_evaluated (e.g. closed TORs), no_requirements
  return null;
}
