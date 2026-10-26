"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BellAlertIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import type { UserProfile } from "@/api/user.api";
import { missingFieldLabel } from "@/lib/qualification-labels";

// The parent remounts this with a key built from the saved values, so local state resets
// whenever the saved profile changes.
export function NotificationSettings({
  profile,
  saving,
  onSave,
}: {
  profile: UserProfile;
  saving: boolean;
  onSave: (changes: Partial<UserProfile>) => Promise<unknown>;
}) {
  const [emailEnabled, setEmailEnabled] = useState(profile.notificationPrefs?.emailEnabled ?? true);

  // The same fields the qualification score needs (backend profileCompleteness)
  const missing = (profile.notificationMissingFields ?? []).map(missingFieldLabel);

  const toggleEmail = () => {
    const next = !emailEnabled;
    setEmailEnabled(next);
    void onSave({ notificationPrefs: { emailEnabled: next } });
  };

  return (
    <div className="rounded-3xl border border-[#e8e0d0] bg-white p-6 shadow-sm md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <BellAlertIcon className="mt-0.5 size-6 shrink-0 text-[#4a7c59]" />
          <div>
            <h2 className="text-lg font-bold text-[#2d2d2d]">แจ้งเตือนทางอีเมล</h2>
            <p className="mt-1 text-sm text-[#7a8b6f]">
              ส่งอีเมลเมื่อ TOR ที่เปิดรับอยู่ได้คะแนนคุณสมบัติ 100% ไปที่{" "}
              <span className="font-medium text-[#2d2d2d]">{profile.contactEmail || profile.email}</span>
            </p>
            <p className="mt-1 text-xs text-[#998f80]">
              คะแนนคำนวณด้วย AI จากข้อมูลในโปรไฟล์ของคุณ (ข้อมูลพื้นฐาน ผลงาน และบุคลากร)
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={emailEnabled}
          aria-label="เปิดการแจ้งเตือนทางอีเมล"
          disabled={saving}
          onClick={toggleEmail}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#4a7c59] focus:ring-offset-2 disabled:opacity-60 ${
            emailEnabled ? "bg-[#4a7c59]" : "bg-stone-300"
          }`}
        >
          <span
            className={`inline-block size-5 rounded-full bg-white shadow transition ${
              emailEnabled ? "translate-x-5.5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {emailEnabled &&
        (missing.length === 0 ? (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-[#c4e3cb] bg-[#eaf4ed] p-4 text-sm text-[#2d5a37]">
            <CheckCircleIcon className="size-5 shrink-0" />
            โปรไฟล์ครบถ้วน ระบบจะแจ้งเตือนเมื่อพบ TOR ที่ได้คะแนน 100%
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] p-4 text-sm text-[#5c5446]">
            <div className="mb-2 flex items-center gap-2 font-medium text-[#2d2d2d]">
              <ExclamationTriangleIcon className="size-5 shrink-0 text-amber-600" />
              กรอกข้อมูลต่อไปนี้ในโปรไฟล์ เพื่อเริ่มรับการแจ้งเตือน
            </div>
            <ul className="ml-7 list-disc space-y-0.5">
              {missing.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            <Link
              href="/onboarding"
              className="mt-4 inline-flex rounded-full bg-[#4a7c59] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#3b6647]"
            >
              กรอกข้อมูลแบบทีละขั้นตอน →
            </Link>
          </div>
        ))}
    </div>
  );
}
