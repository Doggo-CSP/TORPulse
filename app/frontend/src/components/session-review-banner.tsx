"use client";

import { useState } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/**
 * Shown after the sign-in email changed (ASVS V7.4.3). The sign-in code is sent to that address,
 * so the user is offered to sign out every other device. Either choice clears the offer.
 */
export function SessionReviewBanner({
  onRevoke,
  onDismiss,
}: {
  onRevoke: () => Promise<number>;
  onDismiss: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError("ทำรายการไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center">
        <ExclamationTriangleIcon className="size-6 shrink-0 text-amber-600" aria-hidden="true" />
        <p className="flex-1 text-sm text-amber-900">
          อีเมลที่ใช้รับรหัสเข้าสู่ระบบของบัญชีนี้เปลี่ยนแล้ว หากคุณไม่ได้เปลี่ยนเอง
          หรือต้องการความปลอดภัย ควรออกจากระบบในอุปกรณ์อื่นทั้งหมด
          {error && <span className="mt-1 block text-red-700">{error}</span>}
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(onRevoke)}
            className="rounded-full bg-[#4a7c59] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#3d6a4b] disabled:opacity-60"
          >
            ออกจากระบบอุปกรณ์อื่น
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(onDismiss)}
            className="rounded-full border border-amber-300 px-4 py-1.5 text-sm text-amber-900 hover:bg-amber-100 disabled:opacity-60"
          >
            ไม่ต้อง
          </button>
        </div>
      </div>
    </div>
  );
}
