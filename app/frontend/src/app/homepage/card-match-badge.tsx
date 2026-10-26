// app/homepage/card-match-badge.tsx
"use client";

import type { CardMatch } from "@/api/bidder-profile.api";
import { verdictFor } from "@/lib/qualification-labels";

/** Qualification score on a TOR card. Shows nothing when there is nothing useful to say. */
export function CardMatchBadge({ match }: { match: CardMatch | undefined }) {
  if (!match) return null;

  if (match.status === "pending") {
    return (
      <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] text-muted-foreground">
        กำลังวิเคราะห์คุณสมบัติ…
      </span>
    );
  }

  if (match.status === "profile_incomplete") {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] text-amber-700">
        กรอกโปรไฟล์เพื่อดูความเหมาะสม
      </span>
    );
  }

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

  // failed, not_evaluated (e.g. closed TORs), no_requirements
  return null;
}
