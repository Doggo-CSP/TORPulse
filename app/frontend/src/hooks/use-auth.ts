"use client";

import { useCallback, useEffect, useState } from "react";

import { clearLocalDrafts } from "@/hooks/use-local-draft";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role?: "admin" | "user";
  status?: "active" | "suspended";
  // What this account may do, granted by its role (see backend modules/auth/scopes.ts)
  scopes?: string[];
  // Set when the sign-in email (where the sign-in code is sent) changed: the user is offered to
  // sign out every other device (ASVS V7.4.3)
  sessionReview?: { reason: "email_changed"; at: string };
}

interface MeResponse {
  user: AuthUser | null;
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    void fetch(`${apiUrl}/auth/me`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          return { user: null } satisfies MeResponse;
        }

        if (!response.ok) {
          throw new Error("Unable to load the current user");
        }

        return (await response.json()) as MeResponse;
      })
      .then((result) => setUser(result.user))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const signOut = useCallback(async () => {
    // Clear what this browser keeps about the account even if the API cannot be reached
    // (ASVS V14.3.1): saved form drafts hold profile data, and session flags are per login.
    clearLocalDrafts("");
    try {
      window.sessionStorage.clear();
    } catch {
      // Storage blocked: nothing was stored
    }

    const response = await fetch(`${apiUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Unable to sign out");
    }

    setUser(null);
  }, []);

  // Signs out every other browser or device; this one stays signed in (ASVS V7.4.3).
  // Returns how many sessions were ended.
  const revokeOtherSessions = useCallback(async (): Promise<number> => {
    const response = await fetch(`${apiUrl}/auth/sessions/revoke-others`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Unable to sign out other devices");
    }
    const result = (await response.json()) as { revoked: number };
    setUser((current) => (current ? { ...current, sessionReview: undefined } : current));
    return result.revoked;
  }, []);

  // Keeps the other sessions and hides the offer
  const dismissSessionReview = useCallback(async () => {
    const response = await fetch(`${apiUrl}/auth/sessions/review/dismiss`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Unable to dismiss the session review");
    }
    setUser((current) => (current ? { ...current, sessionReview: undefined } : current));
  }, []);

  return { user, loading, signOut, revokeOtherSessions, dismissSessionReview };
}
