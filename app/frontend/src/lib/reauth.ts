const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

// The API answers 403 { code: "REAUTH_REQUIRED" } for changes that need the user to sign in to
// Google again (role/status changes, settings, deletions, contact email). The user is sent to
// Google and comes back to the same page with ?reauth=ok, then repeats the action.
export function isReauthRequired(status: number, body: unknown): boolean {
  return status === 403 && (body as { code?: unknown } | null)?.code === "REAUTH_REQUIRED";
}

export function redirectToReauth(): void {
  const here = `${window.location.pathname}${window.location.search}`;
  window.location.href = `${apiUrl}/auth/google/reauth?returnTo=${encodeURIComponent(here)}`;
}

export const REAUTH_MESSAGE =
  "การเปลี่ยนแปลงนี้ต้องยืนยันตัวตนกับ Google อีกครั้ง กด OK เพื่อยืนยัน แล้วทำรายการเดิมซ้ำอีกครั้ง";

// Asks first, so a user in the middle of editing is not sent away without warning
export function promptReauth(): void {
  if (window.confirm(REAUTH_MESSAGE)) redirectToReauth();
}
