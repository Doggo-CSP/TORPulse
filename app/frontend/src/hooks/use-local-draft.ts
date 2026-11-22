"use client";

import { useCallback, useState } from "react";

const PREFIX = "torpulse.draft.";

// Unsaved form drafts contain profile data (contact details, team members, projects), so they
// are kept in memory only and never written to localStorage/sessionStorage (ASVS V14.3.3).
// They survive moving between pages of the app, not a reload or a closed tab.
const drafts = new Map<string, unknown>();

// Drafts saved by older versions of the app lived in localStorage: remove them once.
function purgeLegacyDrafts() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(PREFIX)) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing to purge
  }
}
if (typeof window !== "undefined") purgeLegacyDrafts();

function read<T>(key: string): T | undefined {
  return drafts.get(PREFIX + key) as T | undefined;
}

function write(key: string, value: unknown) {
  drafts.set(PREFIX + key, value);
}

/** Removes every saved draft whose key starts with `keyPrefix`. */
export function clearLocalDrafts(keyPrefix: string) {
  for (const key of [...drafts.keys()]) {
    if (key.startsWith(PREFIX + keyPrefix)) drafts.delete(key);
  }
  if (typeof window !== "undefined") purgeLegacyDrafts();
}

/**
 * useState that also keeps the value in memory for this page session, so typing that was not
 * saved yet is still there when the user comes back to the form. With a null key it behaves
 * like plain useState.
 */
export function useLocalDraft<T>(key: string | null, initial: () => T) {
  const [value, setValue] = useState<T>(() => {
    if (key === null) return initial();
    return read<T>(key) ?? initial();
  });

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        if (key !== null) write(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  /** Resets to `fresh` and forgets the saved draft. */
  const reset = useCallback(
    (fresh: T) => {
      if (key !== null) drafts.delete(PREFIX + key);
      setValue(fresh);
    },
    [key],
  );

  return [value, set, reset] as const;
}
