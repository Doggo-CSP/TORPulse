"use client";

import Link from "next/link";
import { use } from "react";
import { SiteNav } from "@/app/components/site_nav";
import { useTor } from "@/hooks/use-tors";

const formatBaht = (amount: number | null) =>
  amount === null
    ? "-"
    : `${amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("th-TH", { dateStyle: "medium" });
};

function PageMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-5 py-20 text-center">
        <p className="text-lg font-medium">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
        >
          ← กลับหน้าแรก
        </Link>
      </main>
    </div>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  return (
    <svg
      className={`h-4 w-4 ${mimeType === "application/pdf" ? "text-destructive" : "text-blue-500"}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
    </svg>
  );
}

export default function TorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const decodedId = decodeURIComponent(id);
  const { data: tor, isLoading, error } = useTor(decodedId);

  if (isLoading) {
    return (
      <PageMessage title="กำลังโหลดรายละเอียด TOR..." detail="กรุณารอสักครู่" />
    );
  }

  if (error) {
    return (
      <PageMessage
        title="โหลดรายละเอียด TOR ไม่สำเร็จ"
        detail="กรุณาลองใหม่อีกครั้ง"
      />
    );
  }

  if (!tor) {
    return (
      <PageMessage
        title="ไม่พบ TOR ที่คุณค้นหา"
        detail={`รหัส TOR “${decodedId}” ไม่มีในระบบ`}
      />
    );
  }

  const metaRows = [
    { label: "เลขที่โครงการ", value: tor.externalId },
    { label: "ชื่อโครงการ", value: tor.projectTitle },
    { label: "หน่วยงานพัฒนา / ผู้ว่าจ้าง", value: tor.agencyName ?? "-" },
    { label: "แหล่งข้อมูล", value: tor.sourceAdapter },
    { label: "รุ่นข้อมูล", value: tor.sourceVersion },
    { label: "วงเงิน", value: formatBaht(tor.budgetBaht) },
    { label: "ประกาศเมื่อ", value: formatDate(tor.createdAt) },
    { label: "ปิดรับข้อเสนอ", value: formatDate(tor.submissionDeadline) },
    { label: "วิเคราะห์เมื่อ", value: formatDate(tor.analyzedAt) },
    { label: "อัปเดตล่าสุด", value: formatDate(tor.updatedAt) },
  ];

  const detailSections = [
    { title: "วัตถุประสงค์และเป้าหมาย", items: tor.objectives },
    { title: "ข้อกำหนด", items: tor.requirements },
    { title: "คุณสมบัติผู้เสนอราคา", items: tor.bidderQualifications },
  ];

  return (
    <div className="min-h-screen">
      <SiteNav />

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-6">
        <Link
          href="/"
          className="inline-flex rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          ‹ กลับ
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <span className="rounded bg-surface-2 px-2 py-0.5">
                {tor.externalId}
              </span>
              <span>{tor.sourceAdapter}</span>
            </div>
            <h1 className="mt-2 max-w-2xl text-2xl font-semibold leading-snug md:text-[1.7rem]">
              {tor.projectTitle}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {tor.agencyName ?? "ไม่ระบุหน่วยงาน"}
            </p>
          </div>

          <div className="panel min-w-[220px] p-5">
            <p className="label-eyebrow mb-1">วงเงิน (บาท)</p>
            <p className="font-display text-2xl font-bold text-foreground">
              {formatBaht(tor.budgetBaht)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            {tor.summary && (
              <section className="panel p-6">
                <p className="label-eyebrow mb-3">ภาพรวมโครงการ</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {tor.summary}
                </p>
              </section>
            )}

            <section className="panel overflow-hidden">
              <div className="border-b border-border bg-[#F8FAF7] px-6 py-4">
                <h2 className="font-semibold">รายละเอียดโครงการ</h2>
              </div>
              <div className="divide-y divide-border">
                {metaRows.map((row) => (
                  <div
                    key={row.label}
                    className="grid gap-1 px-6 py-3 text-sm sm:grid-cols-[180px_1fr] sm:gap-4"
                  >
                    <span className="font-medium text-muted-foreground">
                      {row.label}
                    </span>
                    <span className="break-words">{row.value}</span>
                  </div>
                ))}
              </div>
            </section>

            {tor.technologies.length > 0 && (
              <section className="panel p-6">
                <p className="label-eyebrow mb-3">เทคโนโลยีที่ระบุ</p>
                <div className="flex flex-wrap gap-2">
                  {tor.technologies.map((technology) => (
                    <span
                      key={technology}
                      className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-accent"
                    >
                      {technology}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {detailSections.map(({ title, items }) =>
              items.length > 0 ? (
                <section key={title} className="panel p-6">
                  <p className="label-eyebrow mb-3">{title}</p>
                  <ul className="space-y-2">
                    {items.map((item, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 text-sm"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] font-semibold text-primary">
                          {index + 1}
                        </span>
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null,
            )}

            <section className="panel p-6">
              <p className="label-eyebrow mb-3">ผลการวิเคราะห์</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {tor.classificationReason}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                ความมั่นใจ {(tor.confidence * 100).toFixed(0)}%
              </p>
            </section>
          </div>

          <aside className="space-y-5">
            {tor.contactInformation.length > 0 && (
              <div className="panel p-5">
                <p className="label-eyebrow mb-3">ติดต่อสอบถาม</p>
                <ul className="space-y-1.5">
                  {tor.contactInformation.map((contact, index) => (
                    <li
                      key={index}
                      className="text-xs leading-relaxed text-muted-foreground"
                    >
                      {contact}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tor.documents.length > 0 && (
              <div className="panel p-5">
                <p className="label-eyebrow mb-3">เอกสารแนบ</p>
                <ul className="space-y-2">
                  {tor.documents.map((document) => (
                    <li key={document.sourceUrl}>
                      <a
                        href={document.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-xs transition-colors hover:bg-surface-2"
                      >
                        <FileIcon mimeType={document.mimeType} />
                        <span className="flex-1 break-all leading-snug text-muted-foreground">
                          {document.fileName}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <a
              href={tor.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="panel flex w-full items-center justify-between p-4 text-sm font-medium text-primary transition-colors hover:bg-surface-2"
            >
              <span>ดูจากแหล่งข้อมูลต้นทาง</span>
              <span aria-hidden>↗</span>
            </a>
          </aside>
        </div>
      </main>
    </div>
  );
}
