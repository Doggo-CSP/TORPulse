// app/tors/[id]/qualification-match-card.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import {
    useQualificationMatch,
    type MatchStatus,
    type RequirementMatch,
} from "@/hooks/use-qualification-match";

const STATUS_META: Record<
    MatchStatus,
    { label: string; dot: string; text: string; bg: string }
> = {
    matched: {
        label: "ตรงตามเงื่อนไข",
        dot: "bg-emerald-500",
        text: "text-emerald-700",
        bg: "bg-emerald-50",
    },
    partial: {
        label: "ตรงบางส่วน",
        dot: "bg-amber-500",
        text: "text-amber-700",
        bg: "bg-amber-50",
    },
    missing: {
        label: "ยังไม่ตรง",
        dot: "bg-rose-500",
        text: "text-rose-700",
        bg: "bg-rose-50",
    },
};

const STATUS_ORDER: MatchStatus[] = ["matched", "partial", "missing"];

function verdict(score: number) {
    if (score >= 80)
        return { label: "เหมาะสมสูง", bar: "bg-emerald-500", text: "text-emerald-700" };
    if (score >= 50)
        return { label: "ควรพิจารณา", bar: "bg-amber-500", text: "text-amber-700" };
    return { label: "เสี่ยงสูง", bar: "bg-rose-500", text: "text-rose-700" };
}

function RequirementGroup({
    status,
    items,
}: {
    status: MatchStatus;
    items: RequirementMatch[];
}) {
    const [open, setOpen] = useState(status !== "matched");
    const meta = STATUS_META[status];
    if (items.length === 0) return null;

    return (
        <div className="border-t border-border pt-3">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium"
            >
                <span className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden />
                    {meta.label}
                </span>
                <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.bg} ${meta.text}`}
                >
                    {items.length}
                </span>
            </button>

            {open && (
                <ul className="mt-2 space-y-2">
                    {items.map((item, i) => (
                        <li key={i} className="text-xs leading-relaxed">
                            <p>{item.requirement}</p>
                            {item.reason && (
                                <p className="mt-0.5 text-muted-foreground">{item.reason}</p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function QualificationMatchCard({
    torId,
    isLoggedIn,
}: {
    torId: string;
    isLoggedIn: boolean;
}) {
    const result = useQualificationMatch(torId, isLoggedIn);

    // Shared shell so the card keeps the same look as the other sidebar panels
    const Shell = ({ children }: { children: React.ReactNode }) => (
        <div className="panel p-5">
            <p className="label-eyebrow mb-3">ความเหมาะสมของบริษัท</p>
            {children}
        </div>
    );

    if (result.state === "idle") {
        return (
            <Shell>
                <p className="text-xs leading-relaxed text-muted-foreground">
                    เข้าสู่ระบบเพื่อดูว่าบริษัทของคุณตรงตามเงื่อนไข TOR นี้หรือไม่
                </p>
            </Shell>
        );
    }

    if (result.state === "loading") {
        return (
            <Shell>
                <div className="animate-pulse space-y-3" aria-busy="true">
                    <div className="h-8 w-24 rounded bg-surface-2" />
                    <div className="h-2 w-full rounded-full bg-surface-2" />
                    <div className="h-3 w-2/3 rounded bg-surface-2" />
                </div>
            </Shell>
        );
    }

    if (result.state === "no-profile") {
        return (
            <Shell>
                <p className="text-xs leading-relaxed text-muted-foreground">
                    ยังไม่มีข้อมูลบริษัท กรอกโปรไฟล์บริษัทเพื่อเทียบคุณสมบัติกับ TOR นี้
                </p>
                <Link
                    href="/profile"
                    className="mt-3 inline-flex text-xs font-medium text-primary underline underline-offset-2"
                >
                    กรอกโปรไฟล์บริษัท
                </Link>
            </Shell>
        );
    }

    if (result.state === "error") {
        return (
            <Shell>
                <p className="text-xs leading-relaxed text-muted-foreground">
                    ประเมินความเหมาะสมไม่สำเร็จ กรุณาโหลดหน้านี้อีกครั้ง
                </p>
            </Shell>
        );
    }

    const { score, items } = result.data;
    const v = verdict(score);
    const grouped = STATUS_ORDER.map((status) => ({
        status,
        items: items.filter((i) => i.status === status),
    }));

    return (
        <Shell>
            <div className="flex items-baseline justify-between">
                <p className="font-display text-3xl font-bold">
                    {Math.round(score)}
                    <span className="text-base font-medium text-muted-foreground">%</span>
                </p>
                <span className={`text-sm font-semibold ${v.text}`}>{v.label}</span>
            </div>

            <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-valuenow={Math.round(score)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="คะแนนความเหมาะสม"
            >
                <div className={`h-full ${v.bar}`} style={{ width: `${score}%` }} />
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
                จาก {items.length} เงื่อนไข ·{" "}
                {grouped.map((g) => `${STATUS_META[g.status].label} ${g.items.length}`).join(" · ")}
            </p>

            <div className="mt-4 space-y-3">
                {grouped.map((g) => (
                    <RequirementGroup key={g.status} status={g.status} items={g.items} />
                ))}
            </div>
        </Shell>
    );
}