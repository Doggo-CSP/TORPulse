// app/homepage/profile-progress-banner.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import type { ProfileCompleteness } from "@/api/bidder-profile.api";
import { REQUIRED_PROFILE_FIELDS, missingFieldLabel } from "@/lib/qualification-labels";

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
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 100 100"
      className="size-28 shrink-0 drop-shadow-sm"
      role="img"
      aria-label={`โปรไฟล์ครบ ${percentage}%`}
    >
      <circle cx="50" cy="50" r="46" fill="white" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e3ece5" strokeWidth="9" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="#4a7c59"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(c * percentage) / 100} ${c}`}
        transform="rotate(-90 50 50)"
        className="transition-all duration-700"
      />
      <text x="50" y="52" textAnchor="middle" className="fill-[#2d2d2d] font-display text-[22px] font-bold">
        {percentage}%
      </text>
      <text x="50" y="67" textAnchor="middle" className="fill-[#7a8b6f] text-[9px]">
        ครบแล้ว
      </text>
    </svg>
  );
}

/**
 * Invites a logged-in user with an incomplete profile to finish it, so every open TOR gets a
 * qualification score. Sits on its own above the search; "ไว้ทีหลัง" hides it for the rest of
 * the browser session.
 */
export function ProfileProgressBanner({
  completeness,
  accountType,
}: {
  completeness: ProfileCompleteness;
  accountType: "personal" | "company";
}) {
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

  const missing = new Set(completeness.missing);
  const required = REQUIRED_PROFILE_FIELDS[accountType];
  const remaining = required.filter((key) => missing.has(key)).length;

  return (
    <section className="relative mb-8 overflow-hidden rounded-3xl border border-[#cfe2d5] bg-gradient-to-br from-[#e9f3ec] via-[#f7fbf8] to-[#fbf5ea] px-6 py-7 shadow-[0_18px_40px_-28px_rgba(74,124,89,0.55)] md:px-9">
      {/* soft decorative glow */}
      <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-[#4a7c59]/10 blur-3xl" />

      <div className="relative grid grid-cols-1 items-center gap-7 md:grid-cols-[auto_1fr_auto]">
        <ProgressRing percentage={completeness.percentage} />

        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-[#4a7c59] ring-1 ring-[#cfe2d5]">
            <SparklesIcon className="size-3.5" />
            คะแนนความเหมาะสมด้วย AI
          </p>
          <h2 className="mt-3 text-xl font-bold leading-snug text-[#2d2d2d] md:text-2xl">
            อีก {remaining} ขั้นตอน ก็เห็นว่าคุณมีคุณสมบัติตรงกับ TOR ไหนบ้าง
          </h2>
          <p className="mt-1.5 text-sm text-[#5c5446]">
            กรอกให้ครบ ระบบจะคำนวณเปอร์เซ็นต์ความเหมาะสมให้ทุก TOR ที่เปิดรับ และแสดงบนการ์ดแต่ละใบ
          </p>

          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {required.map((key) => {
              const done = !missing.has(key);
              return (
                <li key={key}>
                  {done ? (
                    <span className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2 text-sm text-[#2d5a37]">
                      <span className="grid size-5 place-items-center rounded-full bg-[#4a7c59] text-white">
                        <CheckIcon className="size-3.5" />
                      </span>
                      <span className="line-through decoration-[#4a7c59]/40">{missingFieldLabel(key)}</span>
                    </span>
                  ) : (
                    <Link
                      href="/onboarding"
                      className="group flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-[#2d2d2d] ring-1 ring-[#e3d9c8] transition-all hover:ring-[#4a7c59] hover:shadow-sm"
                    >
                      <span className="size-5 rounded-full border-2 border-dashed border-[#b9ac96] group-hover:border-[#4a7c59]" />
                      <span className="flex-1">{missingFieldLabel(key)}</span>
                      <span className="text-[#4a7c59] opacity-0 transition-opacity group-hover:opacity-100">→</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-row items-center gap-4 md:flex-col md:items-stretch md:gap-2.5">
          <Link
            href="/onboarding"
            className="rounded-full bg-[#4a7c59] px-7 py-3.5 text-center text-sm font-semibold text-white shadow-md shadow-[#4a7c59]/25 transition-all hover:-translate-y-0.5 hover:bg-[#3b6647]"
          >
            กรอกต่อเลย →
          </Link>
          <p className="hidden text-center text-[11px] text-[#7a8b6f] md:block">ใช้เวลาประมาณ 2 นาที</p>
          <button
            type="button"
            onClick={hide}
            className="text-xs font-medium text-[#7a8b6f] hover:text-[#2d2d2d] hover:underline"
          >
            ไว้ทีหลัง
          </button>
        </div>
      </div>
    </section>
  );
}
