"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  evaluateTorQualification,
  fetchTorQualification,
  type QualificationMatch,
  type QualificationMatchResponse,
} from "@/api/bidder-profile.api";

export type QualificationMatchState =
  | { state: "idle" } // not logged in
  | { state: "loading" }
  // The AI is working (about 10 seconds); previous is the last result, if any
  | { state: "evaluating"; previous: QualificationMatch | null }
  | { state: "no-profile"; missing: string[] } // required profile fields missing (UC-08)
  | { state: "error"; message: string; canRetry: boolean }
  | { state: "ready"; data: QualificationMatch; isStale: boolean };

const queryKey = (torId: string) => ["torQualification", torId] as const;

function errorState(error: unknown): QualificationMatchState {
  if (error instanceof ApiError) {
    if (error.status === 401) return { state: "idle" };
    if (error.status === 409) {
      const missing =
        (error.body as Partial<QualificationMatchResponse> | null)?.completeness?.missing ?? [];
      return { state: "no-profile", missing };
    }
    if (error.status === 422) {
      return {
        state: "error",
        message: "TOR นี้ยังไม่มีข้อมูลคุณสมบัติผู้ยื่นข้อเสนอให้เปรียบเทียบ",
        canRetry: false,
      };
    }
  }
  return {
    state: "error",
    message: "ไม่สามารถประเมินความเหมาะสมได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
    canRetry: true,
  };
}

/**
 * The AI qualification match of the logged-in user for one TOR. Reads the stored result, and
 * runs the AI once when there is none or it is out of date and the profile is complete.
 */
export function useQualificationMatch(torId: string | undefined, isLoggedIn: boolean) {
  const queryClient = useQueryClient();
  const id = torId ?? "";
  const enabled = isLoggedIn && id !== "";

  const query = useQuery({
    queryKey: queryKey(id),
    queryFn: () => fetchTorQualification(id),
    enabled,
    retry: false,
  });

  const evaluation = useMutation({
    mutationFn: (force: boolean) => evaluateTorQualification(id, force),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey(id), data);
      void queryClient.invalidateQueries({ queryKey: ["cardMatches"] });
    },
  });

  // Run the AI at most once automatically per TOR; the user can ask again with reevaluate()
  const autoRunFor = useRef<string | null>(null);
  const data = query.data;
  const needsEvaluation =
    !!data && data.completeness.isComplete && (data.match === null || data.isStale);

  useEffect(() => {
    if (!needsEvaluation || autoRunFor.current === id) return;
    autoRunFor.current = id;
    evaluation.mutate(false);
  }, [needsEvaluation, id, evaluation]);

  let result: QualificationMatchState;
  if (!enabled) {
    result = { state: "idle" };
  } else if (query.isLoading) {
    result = { state: "loading" };
  } else if (query.error) {
    result = errorState(query.error);
  } else if (!data) {
    result = { state: "loading" };
  } else if (!data.completeness.isComplete) {
    result = { state: "no-profile", missing: data.completeness.missing };
  } else if (evaluation.isPending) {
    result = { state: "evaluating", previous: data.match };
  } else if (evaluation.error) {
    result = errorState(evaluation.error);
  } else if (data.match) {
    result = { state: "ready", data: data.match, isStale: data.isStale };
  } else {
    result = { state: "evaluating", previous: null };
  }

  return {
    result,
    reevaluate: () => evaluation.mutate(true),
  };
}
