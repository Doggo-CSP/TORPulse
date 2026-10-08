// hooks/use-qualification-match.ts
"use client";

import { useEffect, useState } from "react";

export type MatchStatus = "matched" | "partial" | "missing";

export interface RequirementMatch {
    /** The requirement text extracted from the TOR (tor.bidderQualifications / tor.requirements) */
    requirement: string;
    status: MatchStatus;
    /** Why it was judged this way, e.g. "บริษัทมีผลงาน 2 โครงการ ต้องการ 3 โครงการ" */
    reason?: string;
}

export interface QualificationMatchResult {
    /** 0–100 */
    score: number;
    items: RequirementMatch[];
}

export type QualificationMatchState =
    | { state: "idle" } // not logged in
    | { state: "loading" }
    | { state: "no-profile" } // user has no company profile yet
    | { state: "error" }
    | { state: "ready"; data: QualificationMatchResult };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export function useQualificationMatch(
    torId: string | undefined,
    enabled: boolean,
): QualificationMatchState {
    const [result, setResult] = useState<QualificationMatchState>({ state: "idle" });

    useEffect(() => {
        if (!enabled || !torId) {
            setResult({ state: "idle" });
            return;
        }

        const controller = new AbortController();
        setResult({ state: "loading" });

        fetch(`${API_BASE}/tors/${encodeURIComponent(torId)}/qualification-match`, {
            credentials: "include",
            signal: controller.signal,
        })
            .then(async (res) => {
                if (res.status === 404 || res.status === 422) {
                    // Backend signals "no company profile" this way (adjust to your API)
                    setResult({ state: "no-profile" });
                    return;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = (await res.json()) as QualificationMatchResult;
                setResult({ state: "ready", data });
            })
            .catch((err) => {
                if (err?.name === "AbortError") return;
                setResult({ state: "error" });
            });

        return () => controller.abort();
    }, [torId, enabled]);

    return result;
}