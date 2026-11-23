"use client";

import { useEffect, useState } from "react";

const TOUR_SEEN_KEY_PREFIX = "torpulse_tour_seen_";

/**
 * Returns whether the guided tour should be shown for the given user (identified by email).
 * The tour is shown once per email address (stored in localStorage).
 *
 * Testing: open the page with `?tour=1` to force the tour to show even if it was already
 * seen for this email (the seen flag is ignored, not deleted).
 *
 * Returns `{ shouldShow, markSeen }`.
 */
export function useTour(email: string | null | undefined) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!email) return undefined;

    const forced = new URLSearchParams(window.location.search).get("tour") === "1";
    const key = `${TOUR_SEEN_KEY_PREFIX}${email}`;

    let alreadySeen = false;
    try {
      alreadySeen = localStorage.getItem(key) === "true";
    } catch {
      // localStorage can throw (private mode / blocked storage) — treat as not seen
    }

    if (alreadySeen && !forced) return undefined;

    // Small delay so the page renders before the tour pops up
    const t = setTimeout(() => setShouldShow(true), 800);
    return () => clearTimeout(t);
  }, [email]);

  const markSeen = (email: string) => {
    try {
      localStorage.setItem(`${TOUR_SEEN_KEY_PREFIX}${email}`, "true");
    } catch {
      // ignore storage errors
    }
    setShouldShow(false);
  };

  return { shouldShow, markSeen };
}