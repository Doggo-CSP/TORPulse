"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { IngestionStatus, fetchIngestionStatus, updateDataSource } from "@/api/admin.api";
import { formatRelativeTime } from "./activity-format";

type ToastKind = "success" | "error";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

// Loads GET /admin/ingestion/status again whenever refreshKey changes
function useIngestionStatus(refreshKey: unknown) {
  const [status, setStatus] = useState<IngestionStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // State is set in the promise callbacks, after the request answers.
  const load = useCallback(
    () =>
      fetchIngestionStatus().then(
        (data) => {
          setStatus(data);
          setLoadError(null);
        },
        (error: unknown) => setLoadError(errorMessage(error))
      ),
    []
  );

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return { status, loadError, load };
}

interface IngestionSourcesSectionProps {
  onToast: (message: string, kind?: ToastKind) => void;
  // Called after a source is switched so the activity feed picks up the audit log
  onChanged: () => void;
}

// UC-12: the on/off switch for each website TORs are collected from. Rendered inside the
// automatic-ingestion card on the settings tab, so it has no card frame of its own.
export function IngestionSourcesSection({ onToast, onChanged }: IngestionSourcesSectionProps) {
  const { status, loadError, load } = useIngestionStatus(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const toggleSource = async (key: string, label: string, enabled: boolean) => {
    if (
      !enabled &&
      !window.confirm(
        `ปิด ${label}?\nระบบจะหยุดดึงประกาศใหม่จากเว็บไซต์นี้จนกว่าจะเปิดอีกครั้ง (TOR ที่มีอยู่แล้วไม่หาย)`
      )
    ) {
      return;
    }

    setSavingKey(key);
    try {
      const result = await updateDataSource(key, enabled);
      onToast(result.message);
      onChanged();
      await load();
    } catch (error) {
      onToast(errorMessage(error), "error");
    } finally {
      setSavingKey(null);
    }
  };

  const sources = status?.sources;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-sm text-[#2d2d2d]">แหล่งข้อมูล (Data Sources)</p>
          <p className="text-xs text-[#7a8b6f]">
            เว็บไซต์ที่ระบบไปดึงประกาศ TOR มา ปิดได้ถ้าต้องการหยุดดึงชั่วคราว
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-xl border border-[#e8e0d0] p-2 text-[#5c5446] hover:bg-[#faf7f2]"
          title="รีเฟรช"
        >
          <ArrowPathIcon className="size-4" />
        </button>
      </div>

      {loadError || (status && !sources) ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          โหลดข้อมูลไม่สำเร็จ ลองกดรีเฟรชอีกครั้ง
        </p>
      ) : !sources ? (
        <p className="text-sm text-[#8a8070]">กำลังโหลด...</p>
      ) : sources.length === 0 ? (
        <p className="text-xs text-[#8a8070]">ยังไม่มีแหล่งข้อมูล</p>
      ) : (
        <ul className="divide-y divide-[#f0e8dc] rounded-2xl border border-[#f0e8dc] px-4">
          {sources.map((source) => (
            <li key={source.key} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#2d2d2d]">{source.label}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-[#7a8b6f]">
                  <li>สถานะ: {source.enabled ? "เปิดใช้งาน" : "ปิดอยู่ (ไม่ดึงประกาศใหม่)"}</li>
                  <li>
                    ดึงข้อมูลสำเร็จล่าสุด:{" "}
                    {source.lastSucceededAt ? formatRelativeTime(source.lastSucceededAt) : "ยังไม่เคย"}
                  </li>
                  {source.lastError && (
                    <li className="text-rose-600" title={source.lastError.message}>
                      ครั้งล่าสุดดึงไม่สำเร็จ
                      {source.lastError.occurredAt
                        ? ` (${formatRelativeTime(source.lastError.occurredAt)})`
                        : ""}{" "}
                      ระบบจะลองใหม่รอบถัดไป
                    </li>
                  )}
                </ul>
              </div>
              <button
                role="switch"
                aria-checked={source.enabled}
                aria-label={`เปิดใช้งาน ${source.label}`}
                disabled={savingKey !== null}
                onClick={() => void toggleSource(source.key, source.label, !source.enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#4a7c59] focus:ring-offset-2 disabled:opacity-60 ${
                  source.enabled ? "bg-[#4a7c59]" : "bg-stone-300"
                }`}
              >
                <span
                  className={`inline-block size-5 rounded-full bg-white shadow transition ${
                    source.enabled ? "translate-x-5.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
