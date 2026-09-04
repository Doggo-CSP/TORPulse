"use client";

import Link from "next/link";
import { use } from "react";
import { SiteNav } from "@/app/components/site_nav";
import { tors } from "@/app/homepage/mockData";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const baht = (n: number) =>
  n === 0 ? "-" : "฿" + n.toLocaleString("th-TH") + " บาท";

const bahtM = (n: number) =>
  n === 0 ? "-" : "฿" + (n / 1_000_000).toFixed(2) + " ล้าน";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    เปิดรับสมัคร:
      "bg-emerald-100 text-emerald-700 border-emerald-200",
    ใกล้ปิดรับ: "bg-amber-100 text-amber-700 border-amber-200",
    ปิดรับสมัครแล้ว: "bg-zinc-100 text-zinc-500 border-zinc-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${map[status] ?? "bg-surface-2 text-muted-foreground border-border"}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${status === "เปิดรับสมัคร" ? "bg-emerald-500" : status === "ใกล้ปิดรับ" ? "bg-amber-500" : "bg-zinc-400"}`}
      />
      {status}
    </span>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "application/pdf")
    return (
      <svg className="h-4 w-4 text-destructive" fill="currentColor" viewBox="0 0 20 20">
        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
      </svg>
    );
  return (
    <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function TorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const tor = tors.find((t) => t.id === decodeURIComponent(id));

  /* ---- 404 state ---- */
  if (!tor) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-5xl px-5 py-20 text-center">
          <p className="font-display text-5xl font-bold text-primary">404</p>
          <p className="mt-4 text-lg font-medium">ไม่พบ TOR ที่คุณค้นหา</p>
          <p className="mt-2 text-sm text-muted-foreground">
            รหัส TOR &ldquo;{decodeURIComponent(id)}&rdquo; ไม่มีในระบบ
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
          >
            ← กลับหน้าแรก
          </Link>
        </main>
      </div>
    );
  }

  const saving = tor.savingRatePct ?? 0;
  const disbursement = tor.disbursementRatePct ?? 0;
  const awarded = tor.awardedPriceBaht ?? 0;

  /* ---- metadata fields ---- */
  const metaRows: { label: string; value: string }[] = [
    { label: "เลขที่โครงการ", value: tor.id },
    { label: "ชื่อโครงการ", value: tor.title },
    { label: "หน่วยงานพัฒนา / ผู้ว่าจ้าง", value: tor.agency },
    { label: "แหล่งข้อมูล", value: tor.source },
    {
      label: "ส่วนราชการ / ประเภทการจัดซื้อจัดจ้าง",
      value: tor.projectType ?? "-",
    },
    { label: "ส่วนราชการต้องการ", value: tor.contractType ?? "-" },
    { label: "ประเภทสัญญา", value: tor.contractType ?? "-" },
    { label: "พัสดุหลัก / หมวดงาน", value: `${tor.mainProduct ?? tor.category} — ${tor.category}` },
    { label: "จำนวนกำรซื้อหรือจ้าง", value: tor.quantity ?? "-" },
    {
      label: "ราคากลาง",
      value: baht(tor.midPriceBaht ?? tor.budget),
    },
    {
      label: "ราคาที่ได้ / ราคาชนะการประมูล",
      value: awarded > 0 ? baht(awarded) : "-",
    },
    { label: "ปีงบประมาณ", value: tor.budgetYear ?? "-" },
    { label: "ประกาศเมื่อ", value: tor.publishedAt },
    { label: "ปิดรับข้อเสนอ", value: tor.closesAt },
    { label: "สถานะโครงการ", value: tor.status },
  ];

  return (
    <div className="min-h-screen">
      <SiteNav />

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-6">
        {/* ── Back ── */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          ‹ กลับ
        </Link>

        {/* ── Page header ── */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <span className="rounded bg-surface-2 px-2 py-0.5">{tor.id}</span>
              <span>{tor.source}</span>
              <span>· {tor.category}</span>
            </div>
            <h1 className="mt-2 max-w-2xl text-2xl font-semibold leading-snug md:text-[1.7rem]">
              {tor.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={tor.status} />
              <span className="text-xs text-muted-foreground">
                · 0 views
              </span>
            </div>
          </div>
        </div>

        {/* ── Stat cards + budget box ── */}
        <div className="mt-6 flex flex-wrap gap-4 md:flex-nowrap">
          {/* Saving rate */}
          <div className="panel flex-1 p-5">
            <p className="label-eyebrow mb-2">อัตราการประหยัด</p>
            <p
              className={`font-display text-3xl font-bold ${saving > 0 ? "text-primary" : "text-muted-foreground"}`}
            >
              {saving > 0 ? `${saving.toFixed(2)}%` : "-%"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ({saving > 0 ? bahtM((tor.midPriceBaht ?? tor.budget) - awarded) : "0.00 บาท"})
            </p>
          </div>

          {/* Disbursement rate */}
          <div className="panel flex-1 p-5">
            <p className="label-eyebrow mb-2">อัตราเบิกจ่าย</p>
            <p
              className={`font-display text-3xl font-bold ${disbursement > 0 ? "text-accent" : "text-muted-foreground"}`}
            >
              {disbursement > 0 ? `${disbursement.toFixed(2)}%` : "-%"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ({disbursement > 0 ? bahtM(awarded * (disbursement / 100)) : "0.00 บาท"})
            </p>
          </div>

          {/* Budget box */}
          <div className="panel flex min-w-[220px] flex-col justify-between p-5">
            <div>
              <p className="label-eyebrow mb-1">วงเงิน (บาท)</p>
              <p className="font-display text-2xl font-bold text-foreground">
                {(tor.budget).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                id="btn-download"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                ดาวน์โหลด
              </button>
              <button
                id="btn-print"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                พิมพ์
              </button>
            </div>
          </div>
        </div>

        {/* ── Main 2-col layout ── */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            {/* ── Project summary ── */}
            {tor.summary && (
              <section className="panel p-6">
                <p className="label-eyebrow mb-3">ภาพรวมโครงการ</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {tor.summary}
                </p>
              </section>
            )}

            {/* ── Project details metadata ── */}
            <section className="panel overflow-hidden">
              <div className="border-b border-border bg-[#F8FAF7] px-6 py-4">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h2 className="font-semibold">รายละเอียดโครงการ</h2>
                </div>
              </div>
              <div className="divide-y divide-border">
                {metaRows.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[180px_1fr] gap-4 px-6 py-3 text-sm"
                  >
                    <span className="font-medium text-muted-foreground">
                      {row.label}
                    </span>
                    <span className="break-words">{row.value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Tech stack ── */}
            {tor.tech.length > 0 && (
              <section className="panel p-6">
                <p className="label-eyebrow mb-3">เทคโนโลยีที่ระบุ</p>
                <div className="flex flex-wrap gap-2">
                  {tor.tech.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-accent"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* ── Objectives ── */}
            {tor.objectives && tor.objectives.length > 0 && (
              <section className="panel p-6">
                <p className="label-eyebrow mb-3">วัตถุประสงค์และเป้าหมาย</p>
                <ul className="space-y-2">
                  {tor.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{obj}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Requirements ── */}
            {tor.requirements && tor.requirements.length > 0 && (
              <section className="panel p-6">
                <p className="label-eyebrow mb-3">ข้อกำหนดและคุณสมบัติ</p>
                <ul className="space-y-2">
                  {tor.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="leading-relaxed">{req}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Bidders table ── */}
            <section className="panel overflow-hidden">
              <div className="border-b border-border bg-[#F8FAF7] px-6 py-4">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h2 className="font-semibold">ข้อมูลสำคัญสำหรับผู้รับเหมา</h2>
                </div>
              </div>

              {!tor.bidders || tor.bidders.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  ยังไม่มีข้อมูลผู้ยื่นข้อเสนอในระบบ
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-2/60 text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">#</th>
                        <th className="px-4 py-3 text-left font-medium">ข้อมูลผู้ยื่น</th>
                        <th className="px-4 py-3 text-left font-medium">เลขที่สัญญา</th>
                        <th className="px-4 py-3 text-left font-medium">วันที่ลงนามใน สัญญา</th>
                        <th className="px-4 py-3 text-right font-medium">มูลค่าของสัญญา</th>
                        <th className="px-4 py-3 text-left font-medium">ประเภทสัญญา</th>
                        <th className="px-4 py-3 text-left font-medium">พฤติการณ์ที่เลือก</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tor.bidders.map((b, i) => (
                        <tr key={i} className="hover:bg-surface-2/40 transition-colors">
                          <td className="px-4 py-4 font-mono text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-4">
                            <p className="font-medium leading-snug text-foreground">
                              {b.name}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                              เลขที่ผู้เสียภาษี: {b.taxId}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-primary">
                              <span>ระยะเวลาเริ่มต้นสัญญา: {b.signedAt}</span>
                              <span>ระยะเวลาสิ้นสุดสัญญา: {b.deadline}</span>
                              <span>ระยะเวลาส่งมอบงาน (วัน): 15</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                            {tor.id}
                          </td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">
                            {b.signedAt}
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-medium">
                            {b.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-4 text-xs">
                            {b.status === "ได้รับการคัดเลือก" ? (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                                {b.status}
                              </span>
                            ) : b.status === "อยู่ระหว่างพิจารณา" ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                                {b.status}
                              </span>
                            ) : (
                              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                                {b.status}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">
                            {b.detail}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between border-t border-border px-6 py-3">
                    <span className="text-xs text-muted-foreground">
                      แสดง{" "}
                      <span className="font-semibold text-foreground">10</span>{" "}
                      รายการ/หน้า
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <button className="rounded border border-border px-2 py-1 opacity-40" disabled>
                        ‹ ก่อนหน้า
                      </button>
                      <button className="rounded border border-border px-2 py-1 opacity-40" disabled>
                        หน้าถัดไป ›
                      </button>
                      <span className="rounded border border-primary px-3 py-1">
                        <span className="font-mono font-semibold text-primary">1</span>
                        <span className="ml-1 text-muted-foreground">
                          of 1
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-5">
            {/* Match score */}
            <div className="panel p-5">
              <p className="label-eyebrow mb-3">คะแนนความเหมาะสม</p>
              <div className="flex items-end gap-3">
                <p className="font-display text-4xl font-bold text-primary">
                  {tor.match}
                </p>
                <p className="mb-1 text-sm text-muted-foreground">/ 100</p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${tor.match}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                คะแนนนี้คำนวณจากความตรงกันระหว่างโปรไฟล์บริษัทของคุณกับ TOR นี้
              </p>
            </div>

            {/* Related notices */}
            {tor.relatedNotices && tor.relatedNotices.length > 0 && (
              <div className="panel p-5">
                <div className="mb-3 flex items-center gap-2">
                  <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="label-eyebrow">ประกาศที่เกี่ยวข้อง</p>
                </div>
                <div className="space-y-3">
                  {tor.relatedNotices.map((n, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border p-3"
                    >
                      <p className="text-xs leading-snug text-foreground">
                        {n.title}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {n.date}
                        </span>
                        {n.url && (
                          <a
                            href={n.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
                          >
                            ดูประกาศ
                          </a>
                        )}
                        {!n.url && (
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                            ดูประกาศ
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contact */}
            {tor.contactInformation && tor.contactInformation.length > 0 && (
              <div className="panel p-5">
                <p className="label-eyebrow mb-3">ติดต่อสอบถาม</p>
                <ul className="space-y-1.5">
                  {tor.contactInformation.map((c, i) => (
                    <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Documents */}
            {tor.documents && tor.documents.length > 0 && (
              <div className="panel p-5">
                <p className="label-eyebrow mb-3">เอกสารแนบ</p>
                <ul className="space-y-2">
                  {tor.documents.map((doc, i) => (
                    <li key={i}>
                      <a
                        href={doc.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-xs transition-colors hover:bg-surface-2"
                      >
                        <FileIcon mimeType={doc.mimeType} />
                        <span className="flex-1 break-all leading-snug text-muted-foreground hover:text-foreground">
                          {doc.fileName}
                        </span>
                        <svg className="h-3.5 w-3.5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* External source link */}
            {tor.detailUrl && (
              <a
                href={tor.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="panel flex w-full items-center justify-between p-4 text-sm font-medium text-primary transition-colors hover:bg-surface-2"
              >
                <span>ดูจากแหล่งข้อมูลต้นทาง</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* ── Bottom action bar ── */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 border-t border-border pt-8">
          <Link
            href="/"
            className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← กลับในระบบ
          </Link>
          {tor.documents && tor.documents.length > 0 && (
            <button
              id="btn-download-all"
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              ดาวน์โหลดเอกสารทั้งหมด
            </button>
          )}
        </div>
      </main>

      <footer className="border-t border-border py-8">
        <p className="mx-auto max-w-5xl px-5 text-xs text-muted-foreground">
          TOR — ระบบรวมและค้นหา TOR งานซอฟต์แวร์ของกรุงเทพมหานคร
        </p>
      </footer>
    </div>
  );
}