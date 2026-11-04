"use client";

import { useEffect, useState } from "react";

const TOUR_SEEN_KEY_PREFIX = "torpulse_tour_seen_";

/**
 * Returns whether the guided tour should be shown for the given user (identified by email).
 * The tour is shown once per email address (stored in localStorage).
 * Returns `{ shouldShow, markSeen }`.
 */
export function useTour(email: string | null | undefined) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!email) return;

    const key = `${TOUR_SEEN_KEY_PREFIX}${email}`;
    const alreadySeen = localStorage.getItem(key) === "true";

    if (!alreadySeen) {
      // Small delay so the page renders before the tour pops up
      const t = setTimeout(() => setShouldShow(true), 800);
      return () => clearTimeout(t);
    }
  }, [email]);

  const markSeen = (email: string) => {
    const key = `${TOUR_SEEN_KEY_PREFIX}${email}`;
    localStorage.setItem(key, "true");
    setShouldShow(false);
  };

  return { shouldShow, markSeen };
}

