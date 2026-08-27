/**
 * useAuth — minimal stub.
 * Replace with your real auth provider (Supabase, Firebase, NextAuth, etc.).
 */

import { useState } from "react";

type User = {
  id: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
} | null;

export function useAuth() {
  // TODO: wire up to your real auth solution
  const [user] = useState<User>(null);
  const [loading] = useState(false);

  async function signOut() {
    // TODO: call your auth provider's sign-out method
    console.warn("signOut() not yet implemented");
  }

  return { user, loading, signOut };
}
