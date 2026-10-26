// app/homepage/profile-progress-banner.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProfileCompleteness } from "@/api/bidder-profile.api";
import { missingFieldLabel } from "@/lib/qualification-labels";

const HIDDEN_KEY = "torpulse.profileBannerHidden";

const readHidden = () => {
  try {
    return window.sessionStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
};

/** Ring showing the profile completeness percentage. */
function ProgressRing({ percentage }: { percentage: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="size-[72px] shrink-0" role="img" aria-label={`โปรไฟล์ครบ ${percentage}%`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="#e8e0d0" strokeWidth="8" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="#4a7c59"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${(c * percentage) / 100} ${c}`}
        transform="rotate(-90 40 40)"
        className="transition-all duration-500"
      />
      <text x="40" y="46" textAnchor="middle" className="fill-foreground font-display text-[17px] font-bold">
        {percentage}%
      </text>
    </svg>
  );
}

/**
 * Invites a logged-in user with an incomplete profile to finish it, so every open TOR gets a
 * qualification score. "ซ่อนไว้ก่อน" hides it for the rest of the browser session.
 */
export function ProfileProgressBanner({ completeness }: { completeness: ProfileCompleteness }) {
  const [hidden, setHidden] = useState(readHidden);

  if (completeness.isComplete || hidden) return null;

  const hide = () => {
    try {
      window.sessionStorage.setItem(HIDDEN_KEY, "1");
    } catch {
      // Storage blocked: hide for this page view only
    }
    setHidden(true);
  };

  return (
    <section className="panel grid grid-cols-1 items-center gap-5 px-6 py-5 sm:grid-cols-[auto_1fr_auto]">
      <ProgressRing percentage={completeness.percentage} />
      <div className="min-w-0">
        <p className="font-semibold text-foreground">ดูว่าคุณมีคุณสมบัติตรงกับ TOR ไหนบ้าง</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          กรอกอีกเล็กน้อย ระบบจะคำนวณเปอร์เซ็นต์ความเหมาะสมให้ทุก TOR ที่เปิดรับ
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {completeness.missing.map((key) => (
            <span
              key={key}
              className="rounded-full border border-dashed border-[#c9bfae] px-2.5 py-0.5 text-xs text-[#5c5446]"
            >
              ○ {missingFieldLabel(key)}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
        <Link
          href="/onboarding"
          className="rounded-full bg-[#4a7c59] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3b6647]"
        >
          กรอกต่อ →
        </Link>
        <button type="button" onClick={hide} className="text-xs text-muted-foreground hover:underline">
          ซ่อนไว้ก่อน
        </button>
      </div>
    </section>
  );
}
