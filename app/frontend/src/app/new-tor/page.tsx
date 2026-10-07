"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteNav } from "@/app/components/site_nav";
import { DeadlineBadge } from "@/app/components/deadline_badge";
import { useTors } from "@/hooks/use-tors";

const PAGE_SIZE = 10;
const baht = (n: number) => "฿" + (n / 1_000_000).toFixed(1) + " ล้าน";

export default function NewTorPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useTors({
    days: 7,
    sort: "deadline",
    page,
    limit: PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const visiblePage = Math.min(page, totalPages);

  return (
    <div className="min-h-screen">
      <SiteNav />

      <main className="mx-auto max-w-6xl px-5 pb-24">
        <section className="py-12">
          <Link
            href="/"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ‹ กลับหน้าแรก
          </Link>
          <p className="label-eyebrow mt-4">ประกาศใหม่เข้าระบบสัปดาห์นี้</p>
          <h1 className="mt-2 text-3xl font-semibold">
            TOR ที่เพิ่งเข้าระบบสัปดาห์นี้
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            TOR ที่เข้าระบบภายใน 7 วันล่าสุด
            {data?.total !== undefined && (
              <>
                {" "}· ทั้งหมด{" "}
                <span className="font-semibold text-foreground">
                  {data.total.toLocaleString("th-TH")}
                </span>{" "}
                รายการ
              </>
            )}
          </p>
        </section>

        <section className="panel p-6 md:p-8">
          <ul className="divide-y divide-border">
            {isLoading && (
              <li className="py-10 text-center text-sm text-muted-foreground">
                กำลังโหลด...
              </li>
            )}
            {!isLoading && error && (
              <li className="py-10 text-center text-sm text-warning">
                เกิดข้อผิดพลาดในการโหลดข้อมูล
              </li>
            )}
            {!isLoading && !error && items.length === 0 && (
              <li className="py-10 text-center text-sm text-muted-foreground">
                ยังไม่มี TOR ใหม่เข้าระบบในช่วง 7 วันที่ผ่านมา
              </li>
            )}
            {!isLoading &&
              !error &&
              items.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tor/${t.id}`}
                    className="grid gap-4 rounded-2xl px-3 py-5 transition-colors hover:bg-surface-2 md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                        <span className="rounded bg-surface-2 px-2 py-0.5">
                          {t.externalId}
                        </span>
                        <span>{t.sourceAdapter}</span>
                        <span>
                          · เข้าระบบ{" "}
                          {t.createdAt
                            ? new Date(t.createdAt).toLocaleDateString("th-TH")
                            : "-"}
                        </span>
                        <span>
                          · ปิดรับ{" "}
                          {t.submissionDeadline
                            ? new Date(t.submissionDeadline).toLocaleDateString("th-TH")
                            : "-"}
                        </span>
                      </div>

                      <h3 className="mt-2 text-[15px] leading-snug font-medium">
                        {t.projectTitle}
                      </h3>

                      <div className="mt-1.5">
                        <DeadlineBadge
                          deadline={t.submissionDeadline ?? t.submissionDeadlineText}
                          since={t.announcementDate ?? t.createdAt}
                          projectStatus={t.projectStatus}
                          openOnly
                        />
                      </div>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.agencyName ?? "หน่วยงานรัฐ"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {t.technologies.map((x) => (
                          <span
                            key={x}
                            className="rounded border border-border px-2 py-0.5 text-[11px] text-accent"
                          >
                            {x}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 md:flex-col md:items-end md:gap-2">
                      <p className="font-display text-xl font-semibold">
                        {baht(t.budgetBaht ?? 0)}
                      </p>
                      <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">
                        ดูรายละเอียด
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
          </ul>
        </section>

        <section className="mt-4 flex items-center justify-between px-1 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={visiblePage === 1}
            className="text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            ‹ ก่อนหน้า
          </button>
          <span className="text-muted-foreground">
            หน้า{" "}
            <span className="font-mono font-semibold text-primary">{visiblePage}</span>{" "}
            / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={visiblePage >= totalPages}
            className="text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            หน้าถัดไป ›
          </button>
        </section>
      </main>
    </div>
  );
}