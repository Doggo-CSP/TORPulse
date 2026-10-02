import { getDeadlineInfo } from "@/api/tor.api";

export function DeadlineBadge({
    deadline,
    since,
}: {
    deadline: string | null;
    since?: string | null; // announcementDate ?? createdAt
}) {
    const { daysLeft, label, tone } = getDeadlineInfo(deadline, since);
    if (tone === "unknown") return null;

    const style =
        tone === "closed"
            ? "bg-surface-2 text-muted-foreground border-border"
            : tone === "soon" && daysLeft !== null && daysLeft <= 3
              ? "bg-red-50 text-red-600 border-red-200"
              : tone === "soon"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200";

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}
        >
            ⏱ {label}
        </span>
    );
}