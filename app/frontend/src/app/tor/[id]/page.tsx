"use client";

import Link from "next/link";
import { use, useState, useMemo } from "react";
import { SiteNav } from "@/app/components/site_nav";
import { useTor } from "@/hooks/use-tors";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { BookmarkIcon as BookmarkSolidIcon } from "@heroicons/react/24/solid";
import { BookmarkIcon as BookmarkOutlineIcon } from "@heroicons/react/24/outline";
import { formatThaiDate, getDeadlineInfo } from "@/api/tor.api";
import { DeadlineBadge } from "@/app/components/deadline_badge";
import { SimilarProjects } from "./similar-projects";

const formatBaht = (amount: number | null) =>
    amount === null
        ? "-"
        : `${amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;

// ใช้ formatThaiDate แทน toLocaleDateString เพื่อไม่ให้บวก 543 ซ้ำ
// รองรับทั้งข้อความไทย ("มกราคม 2569") และ ISO date
const formatDate = (
    value: string | null,
    options?: { fallbackDay?: "first" | "last" },
) => formatThaiDate(value, options);

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

export default function TorDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const decodedId = decodeURIComponent(id);
    const { data: tor, isLoading, error } = useTor(decodedId);
    const { user } = useAuth();
    const { bookmarkedTors, toggleBookmark } = useUserProfile(!!user);
    const [savingBookmark, setSavingBookmark] = useState(false);
    const [bookmarkFeedback, setBookmarkFeedback] = useState<string | null>(null);

    const isBookmarked = useMemo(() => {
        if (!tor) return false;
        return bookmarkedTors.some(
            (t) => t._id === tor.id || t._id === decodedId || (tor.externalId && t.externalId === tor.externalId)
        );
    }, [bookmarkedTors, tor, decodedId]);

    const handleBookmarkToggle = async () => {
        if (!user) {
            alert("กรุณาเข้าสู่ระบบเพื่อบันทึก TOR");
            return;
        }
        const targetId = tor?.id || decodedId;
        try {
            setSavingBookmark(true);
            await toggleBookmark(targetId);
            setBookmarkFeedback(isBookmarked ? "นำออกจากรายการที่บันทึกแล้ว" : "บันทึกในรายการเรียบร้อยแล้ว");
            setTimeout(() => setBookmarkFeedback(null), 3000);
        } catch {
            alert("เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setSavingBookmark(false);
        }
    };

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

    // วันที่ใช้เทียบว่า deadline ต้องไม่อยู่ก่อนวันประกาศ
    const since = tor.announcementDate ?? tor.createdAt;
    // ISO date when the backend parsed an exact day; otherwise the TOR's own wording
    // (e.g. "มกราคม 2569"), which formatDate/getDeadlineInfo also understand.
    const submissionDeadline = tor.submissionDeadline ?? tor.submissionDeadlineText;
    const deadlineInfo = getDeadlineInfo(submissionDeadline, since);
    const deadlineUnreliable =
        deadlineInfo.label === "วันปิดรับไม่น่าเชื่อถือ";

    console.log({
        raw: submissionDeadline,
        announcementDate: tor.announcementDate,
        createdAt: tor.createdAt,
        deadlineInfo,
    });

    const metaRows = [
        { label: "เลขที่โครงการ", value: tor.externalId },
        { label: "ชื่อโครงการ", value: tor.projectTitle },
        { label: "หน่วยงานพัฒนา / ผู้ว่าจ้าง", value: tor.agencyName ?? "-" },
        { label: "หน่วยงาน", value: tor.departmentName ?? "-" },
        { label: "หน่วยงานย่อย", value: tor.departmentSubName ?? "-" },
        { label: "สถานะโครงการ", value: tor.contractStatus ?? "-" },
        { label: "ประเภทการประกาศ", value: tor.projectStatus ?? "-" },
        { label: "วงเงิน", value: formatBaht(tor.budgetBaht) },
        { label: "ราคากลาง", value: formatBaht(tor.midPriceBaht) },
        // { label: "ราคาที่ชนะการเสนอราคา", value: formatBaht(tor.awardedPriceBaht) },
        {
            label: "ปิดรับข้อเสนอ",
            value: formatDate(submissionDeadline, { fallbackDay: "last" }),
        },
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
                    <div className="max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                            <span className="rounded bg-surface-2 px-2 py-0.5">
                                {tor.externalId}
                            </span>
                            <span>{tor.sourceAdapter}</span>
                        </div>
                        <h1 className="mt-2 text-2xl font-semibold leading-snug md:text-[1.7rem]">
                            {tor.projectTitle}
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {tor.agencyName ?? "ไม่ระบุหน่วยงาน"}
                        </p>
                        {/* แสดงเฉพาะจอเล็ก เพราะจอใหญ่มีการ์ดใน sidebar แล้ว */}
                        <div className="mt-3 lg:hidden">
                            <DeadlineBadge
                                deadline={submissionDeadline}
                                since={since}
                                projectStatus={tor.projectStatus}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col gap-3 min-w-[220px]">
                        <div className="panel p-5">
                            <p className="label-eyebrow mb-1">วงเงิน (บาท)</p>
                            <p className="font-display text-2xl font-bold text-foreground">
                                {formatBaht(tor.budgetBaht)}
                            </p>
                        </div>

                        {/* Bookmark button */}
                        <button
                            onClick={handleBookmarkToggle}
                            disabled={savingBookmark}
                            className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all shadow-xs ${isBookmarked
                                ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                                : "border-border bg-surface text-foreground hover:border-primary/50 hover:bg-surface-2"
                                }`}
                        >
                            {isBookmarked ? (
                                <>
                                    <BookmarkSolidIcon className="size-5 text-primary" />
                                    <span>บันทึกแล้ว</span>
                                </>
                            ) : (
                                <>
                                    <BookmarkOutlineIcon className="size-5 text-muted-foreground" />
                                    <span>บันทึก TOR นี้</span>
                                </>
                            )}
                        </button>
                        {bookmarkFeedback && (
                            <p className="text-center text-xs font-medium text-primary animate-in fade-in">
                                {bookmarkFeedback}
                            </p>
                        )}
                        {isBookmarked && (
                            <Link
                                href="/saved"
                                className="text-center text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                            >
                                ไปยังหน้า TOR ที่บันทึกไว้ →
                            </Link>
                        )}
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
                            {/* <p className="mt-2 text-xs text-muted-foreground">
                                ความมั่นใจ {(tor.confidence * 100).toFixed(0)}%
                            </p> */}
                        </section>

                        <SimilarProjects torId={tor.id} budgetBaht={tor.budgetBaht} />
                    </div>

                    <aside className="space-y-5">
                        {submissionDeadline && (
                            <div className="panel p-5">
                                <p className="label-eyebrow mb-3">กำหนดปิดรับข้อเสนอ</p>
                                <p className="text-base font-semibold">
                                    {formatDate(submissionDeadline, {
                                        fallbackDay: "last",
                                    })}
                                </p>
                                <div className="mt-2">
                                    <DeadlineBadge
                                        deadline={submissionDeadline}
                                        since={since}
                                        projectStatus={tor.projectStatus}
                                    />
                                </div>
                                {deadlineUnreliable && (
                                    <p className="mt-2 text-xs leading-relaxed text-amber-700">
                                        วันปิดรับอาจไม่ถูกต้อง กรุณาตรวจสอบจากแหล่งข้อมูลต้นทาง
                                    </p>
                                )}
                            </div>
                        )}

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