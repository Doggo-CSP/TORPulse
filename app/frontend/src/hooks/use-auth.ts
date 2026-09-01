"use client";

import { useCallback, useEffect, useState } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface MeResponse {
  user: AuthUser | null;
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

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
    const response = await fetch(`${apiUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Unable to sign out");
    }

    setUser(null);
  }, []);

  return { user, loading, signOut };
}
