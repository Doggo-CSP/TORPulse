"use client";

import { useCallback, useState } from "react";

const PREFIX = "torpulse.draft.";

function read<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the draft lives only in this page view
  }
}

/** Removes every saved draft whose key starts with `keyPrefix`. */
export function clearLocalDrafts(keyPrefix: string) {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(PREFIX + keyPrefix)) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing was saved
  }
}

/**
 * useState that also keeps the value in this browser, so typing that was not saved yet is still
 * there when the user comes back. With a null key it behaves like plain useState.
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
      if (key !== null) {
        try {
          window.localStorage.removeItem(PREFIX + key);
        } catch {
          // Storage blocked
        }
      }
      setValue(fresh);
    },
    [key],
  );

  return [value, set, reset] as const;
}
