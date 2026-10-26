// hooks/use-qualification-match.ts
"use client";

import { useMemo } from "react";
import { TorDetail } from "@/api/tor.api";
import { UserProfile } from "@/api/user.api";
import { useTor } from "./use-tors";
import { useUserProfile } from "./use-user-profile";
import {
  evaluateQualificationMatch,
  type MatchStatus,
  type RequirementMatch,
  type QualificationScoreSummary,
} from "@/lib/qualification-matcher";

export type { MatchStatus, RequirementMatch, QualificationScoreSummary };

export type QualificationMatchState =
  | { state: "idle" } // not logged in
  | { state: "loading" }
  | { state: "no-profile"; data?: QualificationScoreSummary } // user has no company profile yet
  | { state: "error"; message?: string }
  | { state: "ready"; data: QualificationScoreSummary };

export function useQualificationMatch(
  torOrId: TorDetail | string | undefined,
  isLoggedIn: boolean = true,
  providedProfile?: UserProfile | null
): QualificationMatchState {
  const isTorObject = typeof torOrId === "object" && torOrId !== null;
  const torId = isTorObject ? torOrId.id : typeof torOrId === "string" ? torOrId : "";

  // Fetch TOR if only ID was passed and no TOR object
  const { data: fetchedTor, isLoading: loadingTor } = useTor(
    !isTorObject && torId ? torId : ""
  );

  // Fetch profile if not directly supplied
  const { profile: fetchedProfile, loading: loadingProfile } = useUserProfile(
    isLoggedIn && providedProfile === undefined
  );

  const tor = isTorObject ? torOrId : fetchedTor;
  const profile = providedProfile !== undefined ? providedProfile : fetchedProfile;

  const result = useMemo<QualificationMatchState>(() => {
    if (!isLoggedIn) {
      return { state: "idle" };
    }

    if (!torOrId) {
      return { state: "idle" };
    }

    if ((!isTorObject && loadingTor) || (providedProfile === undefined && loadingProfile)) {
      return { state: "loading" };
    }

    if (!tor) {
      return { state: "loading" };
    }

    // Evaluate qualification match against company profile on frontend
    const summary = evaluateQualificationMatch(tor, profile);

    if (!summary.hasCompanyProfile) {
      return { state: "no-profile", data: summary };
    }

    return { state: "ready", data: summary };
  }, [isLoggedIn, torOrId, isTorObject, loadingTor, providedProfile, loadingProfile, tor, profile]);

  return result;
}