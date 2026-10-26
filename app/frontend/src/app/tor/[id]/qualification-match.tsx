// app/tor/[id]/qualification-match.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { TorDetail } from "@/api/tor.api";
import { UserProfile } from "@/api/user.api";
import type { QualificationMatch, RequirementStatus } from "@/api/bidder-profile.api";
import { useQualificationMatch } from "@/hooks/use-qualification-match";
import {
  REQUIREMENT_CATEGORY_LABELS,
  REQUIREMENT_STATUS_LABELS,
  missingFieldLabel,
  verdictFor,
} from "@/lib/qualification-labels";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  QuestionMarkCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BuildingOffice2Icon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export interface QualificationMatchCardProps {
  torId?: string;
  tor?: TorDetail;
  profile?: UserProfile | null;
  isLoggedIn: boolean;
}

const STATUS_CONFIG: Record<
  RequirementStatus,
  {
    label: string;
    text: string;
    bg: string;
    border: string;
    tile: string;
    tileActive: string;
    icon: typeof CheckCircleIcon;
  }
> = {
  met: {
    label: REQUIREMENT_STATUS_LABELS.met,
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    tile: "bg-emerald-50/60 border-emerald-100 hover:bg-emerald-100/50",
    tileActive: "bg-emerald-100/70 border-emerald-400 ring-1 ring-emerald-400",
    icon: CheckCircleIcon,
  },
  partial: {
    label: REQUIREMENT_STATUS_LABELS.partial,
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    tile: "bg-amber-50/60 border-amber-100 hover:bg-amber-100/50",
    tileActive: "bg-amber-100/70 border-amber-400 ring-1 ring-amber-400",
    icon: ExclamationTriangleIcon,
  },
  not_met: {
    label: REQUIREMENT_STATUS_LABELS.not_met,
    text: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    tile: "bg-rose-50/60 border-rose-100 hover:bg-rose-100/50",
    tileActive: "bg-rose-100/70 border-rose-400 ring-1 ring-rose-400",
    icon: XCircleIcon,
  },
  unknown: {
    label: REQUIREMENT_STATUS_LABELS.unknown,
    text: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-200",
    tile: "bg-slate-50/60 border-slate-100 hover:bg-slate-100/50",
    tileActive: "bg-slate-100/70 border-slate-400 ring-1 ring-slate-400",
    icon: QuestionMarkCircleIcon,
  },
};

const STATUS_ORDER: RequirementStatus[] = ["met", "partial", "not_met", "unknown"];

const countOf = (match: QualificationMatch, status: RequirementStatus) =>
  status === "not_met" ? match.counts.notMet : match.counts[status];

const formatThaiDateTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

// Shared wrapper; defined outside the component so React keeps its children mounted
function Shell({ children, showEditLink }: { children: React.ReactNode; showEditLink: boolean }) {
  return (
    <div className="panel p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <SparklesIcon className="size-4 text-primary" />
          <p className="label-eyebrow">ความเหมาะสมของบริษัท</p>
        </div>
        {showEditLink && (
          <Link
            href="/profile"
            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            title="อัปเดตข้อมูลบริษัทในหน้าโปรไฟล์"
          >
            <span>แก้ไขโปรไฟล์</span>
            <ArrowTopRightOnSquareIcon className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function LoadingSkeleton({ note }: { note?: string }) {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true">
      <div className="flex justify-between items-center">
        <div className="h-8 w-20 rounded-lg bg-surface-2" />
        <div className="h-6 w-28 rounded-full bg-surface-2" />
      </div>
      <div className="h-2.5 w-full rounded-full bg-surface-2" />
      <div className="grid grid-cols-4 gap-2 pt-2">
        <div className="h-10 rounded-lg bg-surface-2" />
        <div className="h-10 rounded-lg bg-surface-2" />
        <div className="h-10 rounded-lg bg-surface-2" />
        <div className="h-10 rounded-lg bg-surface-2" />
      </div>
      {note && <p className="text-center text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

export function QualificationMatchCard({
  torId,
  tor,
  profile,
  isLoggedIn,
}: QualificationMatchCardProps) {
  const { result, reevaluate } = useQualificationMatch(tor?.id ?? torId, isLoggedIn);
  const [filter, setFilter] = useState<"all" | RequirementStatus>("all");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const companyName =
    profile?.companyName || profile?.displayName || profile?.name || "บริษัทของคุณ";

  // 1. Idle state (not logged in)
  if (result.state === "idle") {
    return (
      <Shell showEditLink={false}>
        <div className="rounded-xl border border-dashed border-border bg-surface-2/40 p-4 text-center">
          <BuildingOffice2Icon className="mx-auto size-7 text-muted-foreground/60 mb-2" />
          <p className="text-xs font-medium text-foreground">เข้าสู่ระบบเพื่อเทียบคุณสมบัติ</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            ระบบจะวิเคราะห์เงื่อนไข TOR เทียบกับข้อมูลและผลงานบริษัทของคุณโดยอัตโนมัติ
          </p>
          <Link
            href="/auth/signin"
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            เข้าสู่ระบบเพื่อดูคะแนน
          </Link>
        </div>
      </Shell>
    );
  }

  // 2. Loading state
  if (result.state === "loading") {
    return (
      <Shell showEditLink={false}>
        <LoadingSkeleton />
      </Shell>
    );
  }

  // 3. AI is evaluating (about 10 seconds)
  if (result.state === "evaluating") {
    return (
      <Shell showEditLink={false}>
        <LoadingSkeleton
          note={
            result.previous
              ? "ข้อมูลเปลี่ยนแปลง กำลังวิเคราะห์ใหม่ด้วย AI (ประมาณ 10 วินาที)"
              : "AI กำลังวิเคราะห์คุณสมบัติเทียบกับ TOR (ประมาณ 10 วินาที)"
          }
        />
      </Shell>
    );
  }

  // 4. Profile missing required fields (UC-08)
  if (result.state === "no-profile") {
    return (
      <Shell showEditLink={false}>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-start gap-2.5">
            <BuildingOffice2Icon className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-900">ข้อมูลโปรไฟล์ยังไม่ครบ</p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                กรอกข้อมูลต่อไปนี้เพื่อคำนวณคะแนนความเหมาะสมกับ TOR นี้
              </p>
              {result.missing.length > 0 && (
                <ul className="mt-1.5 list-disc pl-4 text-[11px] leading-relaxed text-amber-800">
                  {result.missing.map((key) => (
                    <li key={key}>{missingFieldLabel(key)}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <Link
            href="/profile"
            className="mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition-colors"
          >
            <span>กรอกโปรไฟล์ตอนนี้</span>
            <ArrowTopRightOnSquareIcon className="size-3.5" />
          </Link>
        </div>
      </Shell>
    );
  }

  // 5. Error state
  if (result.state === "error") {
    return (
      <Shell showEditLink={false}>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-center">
          <p className="text-xs text-rose-800">{result.message}</p>
          {result.canRetry && (
            <button
              type="button"
              onClick={reevaluate}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:underline"
            >
              <ArrowPathIcon className="size-3.5" />
              ลองใหม่
            </button>
          )}
        </div>
      </Shell>
    );
  }

  // 6. Ready state
  const match = result.data;
  const verdict = verdictFor(match.percentage, match.allMandatoryMet);
  const score = match.percentage ?? 0;
  const items = match.requirements.map((item, index) => ({ ...item, index }));
  const filteredItems = filter === "all" ? items : items.filter((item) => item.status === filter);

  return (
    <>
      <Shell showEditLink>
        {/* Company Name Badge */}
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground border-b border-border pb-2.5">
          <div className="flex items-center gap-1.5 truncate">
            <BuildingOffice2Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium text-foreground">{companyName}</span>
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground">{items.length} เงื่อนไข</span>
        </div>

        {/* Score & Verdict */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              {match.percentage ?? "-"}
            </span>
            <span className="text-sm font-semibold text-muted-foreground">%</span>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${verdict.badgeCls}`}
          >
            {verdict.label}
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div
          className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="คะแนนความเหมาะสมของบริษัท"
        >
          <div
            className={`h-full transition-all duration-700 ease-out ${verdict.barCls}`}
            style={{ width: `${score}%` }}
          />
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {match.summary || verdict.description}
        </p>

        {result.isStale && (
          <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200/70 px-2 py-1.5 text-[11px] text-amber-800">
            ข้อมูลโปรไฟล์หรือ TOR เปลี่ยนไปหลังการประเมินครั้งนี้ กด &quot;ประเมินใหม่&quot; เพื่ออัปเดต
          </p>
        )}

        {/* Metric Badges (Clickable Filters) */}
        <div className="mt-3.5 grid grid-cols-4 gap-1.5">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_CONFIG[status];
            return (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(filter === status ? "all" : status)}
                className={`flex flex-col items-center justify-center rounded-xl p-2 text-center transition-all border ${
                  filter === status ? meta.tileActive : meta.tile
                }`}
              >
                <span className={`text-[10px] font-medium ${meta.text}`}>{meta.label}</span>
                <span className={`text-base font-bold ${meta.text}`}>{countOf(match, status)}</span>
              </button>
            );
          })}
        </div>

        {/* Filter Tabs */}
        <div className="mt-3.5 flex items-center justify-between border-b border-border pb-2 text-[11px]">
          <span className="font-medium text-muted-foreground">
            {filter === "all" ? "แสดงเงื่อนไขทั้งหมด" : `กรอง: ${STATUS_CONFIG[filter].label}`}
          </span>
          {filter !== "all" && (
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="font-medium text-primary hover:underline"
            >
              แสดงทั้งหมด
            </button>
          )}
        </div>

        {/* Requirement Item List */}
        <div className="mt-2.5 space-y-2 max-h-[380px] overflow-y-auto pr-0.5 custom-scrollbar">
          {filteredItems.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">ไม่มีเงื่อนไขในหมวดหมู่นี้</p>
          ) : (
            filteredItems.map((item) => {
              const meta = STATUS_CONFIG[item.status];
              const Icon = meta.icon;
              const isExpanded = expandedIndex === item.index;

              return (
                <div
                  key={item.index}
                  className={`rounded-xl border p-2.5 transition-colors ${
                    isExpanded ? "border-primary/40 bg-surface-2/30" : "border-border/80 bg-surface"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(isExpanded ? null : item.index)}
                    aria-expanded={isExpanded}
                    className="flex w-full items-start justify-between gap-2 text-left"
                  >
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Icon className={`size-4 shrink-0 mt-0.5 ${meta.text}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}
                          >
                            {meta.label}
                          </span>
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] text-muted-foreground font-medium">
                            {REQUIREMENT_CATEGORY_LABELS[item.category]}
                          </span>
                          {item.mandatory && (
                            <span className="rounded bg-rose-100 text-rose-800 px-1.5 py-0.5 text-[9px] font-semibold">
                              เกณฑ์บังคับ
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-medium leading-snug text-foreground">
                          {item.requirement}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUpIcon className="size-3.5 shrink-0 text-muted-foreground mt-1" />
                    ) : (
                      <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground mt-1" />
                    )}
                  </button>

                  {/* Expanded Accordion Content */}
                  {isExpanded && (
                    <div className="mt-2.5 pt-2 border-t border-border/60 text-[11px] space-y-2 animate-in fade-in">
                      <div>
                        <span className="font-semibold text-muted-foreground block text-[10px]">
                          ผลการวิเคราะห์:
                        </span>
                        <p className="leading-relaxed text-foreground">{item.reason || "-"}</p>
                      </div>

                      {item.suggestion && (
                        <div className="rounded-lg bg-amber-50 p-2 border border-amber-200/60">
                          <span className="font-semibold text-amber-900 block text-[10px]">
                            💡 คำแนะนำเพื่อเพิ่มโอกาส:
                          </span>
                          <p className="text-amber-800 leading-relaxed mt-0.5">{item.suggestion}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Evaluated at + re-run */}
        <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>ประเมินโดย AI เมื่อ {formatThaiDateTime(match.evaluatedAt)}</span>
          <button
            type="button"
            onClick={reevaluate}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <ArrowPathIcon className="size-3" />
            ประเมินใหม่
          </button>
        </div>

        {/* Open Full Comparison Modal Button */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2 transition-colors"
        >
          <span>ดูรายละเอียดการเปรียบเทียบทั้งหมด</span>
          <ArrowTopRightOnSquareIcon className="size-3.5 text-muted-foreground" />
        </button>
      </Shell>

      {/* Full Comparison Modal Dialog */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-surface border border-border shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-[#F8FAF7]">
              <div>
                <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                  <SparklesIcon className="size-5 text-primary" />
                  การวิเคราะห์และเปรียบเทียบคุณสมบัติ (Qualification Analysis)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  เปรียบเทียบข้อกำหนด TOR กับข้อมูลของ {companyName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Score Summary Banner */}
              <div className="rounded-2xl border border-border bg-surface-2/40 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center rounded-2xl bg-surface border border-border size-20 shadow-xs">
                    <span className="font-display text-2xl font-black text-foreground">
                      {match.percentage ?? "-"}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">คะแนน</span>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${verdict.badgeCls}`}
                    >
                      {verdict.label}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md">
                      {match.summary || verdict.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  {STATUS_ORDER.map((status) => (
                    <span
                      key={status}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].border} ${STATUS_CONFIG[status].text}`}
                    >
                      {STATUS_CONFIG[status].label} {countOf(match, status)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Comparison Table */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  รายการเงื่อนไขและรายละเอียดการเปรียบเทียบ ({items.length} รายการ)
                </h4>

                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-surface">
                  {items.map((item) => {
                    const meta = STATUS_CONFIG[item.status];
                    const Icon = meta.icon;

                    return (
                      <div key={item.index} className="p-4 hover:bg-surface-2/30 transition-colors">
                        <div className="flex items-start gap-2.5">
                          <Icon className={`size-5 shrink-0 mt-0.5 ${meta.text}`} />
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`rounded-md px-2 py-0.5 text-xs font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}
                              >
                                {meta.label}
                              </span>
                              <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground font-medium">
                                {REQUIREMENT_CATEGORY_LABELS[item.category]}
                              </span>
                              {item.mandatory && (
                                <span className="rounded bg-rose-100 text-rose-800 px-2 py-0.5 text-xs font-semibold">
                                  เกณฑ์บังคับ
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-foreground">{item.requirement}</p>

                            <div className="pt-1 text-xs">
                              <span className="font-semibold text-muted-foreground">การวิเคราะห์: </span>
                              <span className="text-foreground">{item.reason || "-"}</span>
                            </div>

                            {item.suggestion && (
                              <div className="rounded-lg bg-amber-50 border border-amber-200/70 p-2 text-xs text-amber-900 mt-2">
                                <span className="font-semibold">💡 คำแนะนำ: </span>
                                {item.suggestion}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border px-6 py-3.5 bg-[#F8FAF7] flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                แก้ไขโปรไฟล์แล้ว ระบบจะประเมินใหม่ให้อัตโนมัติ (ภายในไม่กี่นาที)
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                >
                  <span>ไปที่หน้าโปรไฟล์</span>
                  <ArrowTopRightOnSquareIcon className="size-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
