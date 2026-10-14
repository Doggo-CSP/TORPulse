// app/tor/[id]/qualification-match.tsx
"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { TorDetail } from "@/api/tor.api";
import { UserProfile } from "@/api/user.api";
import {
  useQualificationMatch,
  type MatchStatus,
  type RequirementMatch,
  type QualificationScoreSummary,
} from "@/hooks/use-qualification-match";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BuildingOffice2Icon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
  XMarkIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";

export interface QualificationMatchCardProps {
  torId?: string;
  tor?: TorDetail;
  profile?: UserProfile | null;
  isLoggedIn: boolean;
}

const STATUS_CONFIG: Record<
  MatchStatus,
  {
    label: string;
    dot: string;
    text: string;
    bg: string;
    border: string;
    icon: typeof CheckCircleIcon;
  }
> = {
  matched: {
    label: "ตรงตามเงื่อนไข",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: CheckCircleIcon,
  },
  partial: {
    label: "ตรงบางส่วน",
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: ExclamationTriangleIcon,
  },
  missing: {
    label: "ยังไม่ตรง",
    dot: "bg-rose-500",
    text: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    icon: XCircleIcon,
  },
};

export function QualificationMatchCard({
  torId,
  tor,
  profile,
  isLoggedIn,
}: QualificationMatchCardProps) {
  const result = useQualificationMatch(tor ?? torId, isLoggedIn, profile);
  const [filter, setFilter] = useState<"all" | MatchStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Shared wrapper
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="panel p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <SparklesIcon className="size-4 text-primary" />
          <p className="label-eyebrow">ความเหมาะสมของบริษัท</p>
        </div>
        {isLoggedIn && result.state === "ready" && (
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

  // 1. Idle state (not logged in)
  if (result.state === "idle") {
    return (
      <Shell>
        <div className="rounded-xl border border-dashed border-border bg-surface-2/40 p-4 text-center">
          <BuildingOffice2Icon className="mx-auto size-7 text-muted-foreground/60 mb-2" />
          <p className="text-xs font-medium text-foreground">
            เข้าสู่ระบบเพื่อเทียบคุณสมบัติ
          </p>
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
      <Shell>
        <div className="animate-pulse space-y-3" aria-busy="true">
          <div className="flex justify-between items-center">
            <div className="h-8 w-20 rounded-lg bg-surface-2" />
            <div className="h-6 w-28 rounded-full bg-surface-2" />
          </div>
          <div className="h-2.5 w-full rounded-full bg-surface-2" />
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="h-10 rounded-lg bg-surface-2" />
            <div className="h-10 rounded-lg bg-surface-2" />
            <div className="h-10 rounded-lg bg-surface-2" />
          </div>
          <div className="h-14 rounded-lg bg-surface-2 mt-3" />
        </div>
      </Shell>
    );
  }

  // 3. No profile state
  if (result.state === "no-profile") {
    return (
      <Shell>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-start gap-2.5">
            <BuildingOffice2Icon className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-900">
                ยังไม่มีข้อมูลโปรไฟล์บริษัท
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                กรอกข้อมูลบริษัท ทุนจดทะเบียน สถานะ e-GP และผลงานโครงการเพื่อคำนวณคะแนนความเหมาะสมกับ TOR นี้
              </p>
            </div>
          </div>
          <Link
            href="/profile"
            className="mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition-colors"
          >
            <span>กรอกโปรไฟล์บริษัทตอนนี้</span>
            <ArrowTopRightOnSquareIcon className="size-3.5" />
          </Link>
        </div>
      </Shell>
    );
  }

  // 4. Error state
  if (result.state === "error") {
    return (
      <Shell>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-center">
          <p className="text-xs text-rose-800">
            {result.message || "ไม่สามารถประเมินความเหมาะสมได้ กรุณาลองใหม่อีกครั้ง"}
          </p>
        </div>
      </Shell>
    );
  }

  // 5. Ready state
  const data: QualificationScoreSummary = result.data;
  const { score, verdict, matchedCount, partialCount, missingCount, items, companyName } = data;

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    return item.status === filter;
  });

  return (
    <>
      <Shell>
        {/* Company Name Badge */}
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground border-b border-border pb-2.5">
          <div className="flex items-center gap-1.5 truncate">
            <BuildingOffice2Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium text-foreground">{companyName}</span>
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {items.length} เงื่อนไข
          </span>
        </div>

        {/* Score & Verdict */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              {score}
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
          {verdict.description}
        </p>

        {/* Metric Badges (Clickable Filters) */}
        <div className="mt-3.5 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setFilter(filter === "matched" ? "all" : "matched")}
            className={`flex flex-col items-center justify-center rounded-xl p-2 text-center transition-all border ${
              filter === "matched"
                ? "bg-emerald-100/70 border-emerald-400 ring-1 ring-emerald-400"
                : "bg-emerald-50/60 border-emerald-100 hover:bg-emerald-100/50"
            }`}
          >
            <span className="text-[10px] font-medium text-emerald-800">ตรงเงื่อนไข</span>
            <span className="text-base font-bold text-emerald-700">{matchedCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter(filter === "partial" ? "all" : "partial")}
            className={`flex flex-col items-center justify-center rounded-xl p-2 text-center transition-all border ${
              filter === "partial"
                ? "bg-amber-100/70 border-amber-400 ring-1 ring-amber-400"
                : "bg-amber-50/60 border-amber-100 hover:bg-amber-100/50"
            }`}
          >
            <span className="text-[10px] font-medium text-amber-800">ตรงบางส่วน</span>
            <span className="text-base font-bold text-amber-700">{partialCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter(filter === "missing" ? "all" : "missing")}
            className={`flex flex-col items-center justify-center rounded-xl p-2 text-center transition-all border ${
              filter === "missing"
                ? "bg-rose-100/70 border-rose-400 ring-1 ring-rose-400"
                : "bg-rose-50/60 border-rose-100 hover:bg-rose-100/50"
            }`}
          >
            <span className="text-[10px] font-medium text-rose-800">ยังไม่ตรง</span>
            <span className="text-base font-bold text-rose-700">{missingCount}</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="mt-3.5 flex items-center justify-between border-b border-border pb-2 text-[11px]">
          <span className="font-medium text-muted-foreground">
            {filter === "all"
              ? "แสดงเงื่อนไขทั้งหมด"
              : `กรอง: ${STATUS_CONFIG[filter].label}`}
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
            <p className="py-4 text-center text-xs text-muted-foreground">
              ไม่มีเงื่อนไขในหมวดหมู่นี้
            </p>
          ) : (
            filteredItems.map((item) => {
              const meta = STATUS_CONFIG[item.status];
              const Icon = meta.icon;
              const isExpanded = expandedId === item.id;

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-2.5 transition-colors ${
                    isExpanded ? "border-primary/40 bg-surface-2/30" : "border-border/80 bg-surface"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
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
                            {item.categoryLabel}
                          </span>
                          {item.isCritical && (
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
                      {item.companyValue && (
                        <div>
                          <span className="font-semibold text-muted-foreground block text-[10px]">
                            ข้อมูลบริษัทของคุณ:
                          </span>
                          <p className="font-medium text-foreground">{item.companyValue}</p>
                        </div>
                      )}

                      {item.torRequirement && (
                        <div>
                          <span className="font-semibold text-muted-foreground block text-[10px]">
                            เกณฑ์ที่ต้องการ:
                          </span>
                          <p className="text-muted-foreground">{item.torRequirement}</p>
                        </div>
                      )}

                      <div>
                        <span className="font-semibold text-muted-foreground block text-[10px]">
                          ผลการวิเคราะห์:
                        </span>
                        <p className="leading-relaxed text-foreground">{item.reason}</p>
                      </div>

                      {item.recommendation && (
                        <div className="rounded-lg bg-amber-50 p-2 border border-amber-200/60">
                          <span className="font-semibold text-amber-900 block text-[10px]">
                            💡 คำแนะนำเพื่อเพิ่มโอกาส:
                          </span>
                          <p className="text-amber-800 leading-relaxed mt-0.5">
                            {item.recommendation}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Open Full Comparison Modal Button */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2 transition-colors"
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
                      {score}%
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
                      {verdict.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                    ตรง {matchedCount}
                  </span>
                  <span className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800">
                    บางส่วน {partialCount}
                  </span>
                  <span className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-800">
                    ขาด {missingCount}
                  </span>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  รายการเงื่อนไขและรายละเอียดการเปรียบเทียบ ({items.length} รายการ)
                </h4>

                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-surface">
                  {items.map((item, index) => {
                    const meta = STATUS_CONFIG[item.status];
                    const Icon = meta.icon;

                    return (
                      <div
                        key={item.id}
                        className="p-4 hover:bg-surface-2/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1">
                            <Icon className={`size-5 shrink-0 mt-0.5 ${meta.text}`} />
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`rounded-md px-2 py-0.5 text-xs font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}
                                >
                                  {meta.label}
                                </span>
                                <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground font-medium">
                                  {item.categoryLabel}
                                </span>
                                {item.isCritical && (
                                  <span className="rounded bg-rose-100 text-rose-800 px-2 py-0.5 text-xs font-semibold">
                                    เกณฑ์บังคับ
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-foreground">
                                {item.requirement}
                              </p>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 text-xs">
                                <div className="rounded-lg bg-surface-2/60 p-2.5">
                                  <span className="text-[10px] font-semibold text-muted-foreground block">
                                    ข้อมูลบริษัทของคุณ
                                  </span>
                                  <p className="font-medium text-foreground mt-0.5">
                                    {item.companyValue || "-"}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-surface-2/60 p-2.5">
                                  <span className="text-[10px] font-semibold text-muted-foreground block">
                                    เกณฑ์ที่ TOR ต้องการ
                                  </span>
                                  <p className="text-muted-foreground mt-0.5">
                                    {item.torRequirement || "-"}
                                  </p>
                                </div>
                              </div>

                              <div className="pt-1 text-xs">
                                <span className="font-semibold text-muted-foreground">
                                  การวิเคราะห์:{" "}
                                </span>
                                <span className="text-foreground">{item.reason}</span>
                              </div>

                              {item.recommendation && (
                                <div className="rounded-lg bg-amber-50 border border-amber-200/70 p-2 text-xs text-amber-900 mt-2">
                                  <span className="font-semibold">💡 คำแนะนำ: </span>
                                  {item.recommendation}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border px-6 py-3.5 bg-[#F8FAF7] flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                การแก้ไขข้อมูลในหน้าโปรไฟล์จะมีผลต่อการคำนวณคะแนนทันที
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                >
                  <span>ไปที่หน้าโปรไฟล์บริษัท</span>
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