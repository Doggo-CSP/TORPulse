"use client";

import Link from "next/link";
import { useState } from "react";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

const MESSAGES: Record<string, string> = {
  MFA_INVALID: "รหัสไม่ถูกต้อง",
  MFA_EXPIRED: "รหัสหมดอายุแล้ว กรุณากดส่งรหัสใหม่",
  MFA_LOCKED: "ใส่รหัสผิดหลายครั้งเกินไป กรุณาเข้าสู่ระบบใหม่",
  MFA_NO_CHALLENGE: "ไม่พบคำขอเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่",
  MFA_TOO_SOON: "เพิ่งส่งรหัสไป กรุณารอ 1 นาทีแล้วลองใหม่",
  MFA_TOO_MANY: "ขอรหัสครบจำนวนแล้ว กรุณาเข้าสู่ระบบใหม่",
};

// Second sign-in step: the 6-digit code emailed after Google sign-in (ASVS V6.3.3)
export default function VerifyPage() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [mustRestart, setMustRestart] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`${apiUrl}/auth/mfa/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        // Full reload so every hook reads the now complete session
        window.location.href = "/homepage";
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { code?: string; attemptsLeft?: number };
      const text = MESSAGES[body.code ?? ""] ?? "ยืนยันรหัสไม่สำเร็จ";
      setError(
        body.code === "MFA_INVALID" && typeof body.attemptsLeft === "number"
          ? `${text} (เหลืออีก ${body.attemptsLeft} ครั้ง)`
          : text,
      );
      setMustRestart(body.code === "MFA_LOCKED" || body.code === "MFA_NO_CHALLENGE");
      setCode("");
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    const res = await fetch(`${apiUrl}/auth/mfa/resend`, { method: "POST", credentials: "include" });
    if (res.ok) {
      setInfo("ส่งรหัสใหม่ไปที่อีเมลของคุณแล้ว");
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { code?: string };
    setError(MESSAGES[body.code ?? ""] ?? "ส่งรหัสใหม่ไม่สำเร็จ");
    setMustRestart(body.code === "MFA_TOO_MANY" || body.code === "MFA_NO_CHALLENGE");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f0e8] px-4">
      <div className="w-full max-w-[420px] rounded-3xl border border-[#e8e0d0] bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-[#2d2d2d]">ยืนยันการเข้าสู่ระบบ</h1>
        <p className="mb-6 text-sm leading-relaxed text-[#7a8b6f]">
          เราส่งรหัส 6 หลักไปที่อีเมลบัญชี Google ของคุณ รหัสใช้ได้ 10 นาที
        </p>

        {error ? (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {info ? (
          <p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
            {info}
          </p>
        ) : null}

        {mustRestart ? (
          <Link
            href="/auth"
            className="block w-full rounded-xl bg-[#4a7c59] py-3 text-center text-sm font-medium text-white"
          >
            กลับไปเข้าสู่ระบบ
          </Link>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label htmlFor="mfa-code" className="block text-sm font-medium text-[#2d2d2d]">
              รหัสยืนยัน
            </label>
            <input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-[#ddd5c8] px-4 py-3 text-center text-2xl tracking-[0.5em]"
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full rounded-xl bg-[#4a7c59] py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "กำลังตรวจสอบ..." : "ยืนยัน"}
            </button>
            <button
              type="button"
              onClick={() => void resend()}
              className="w-full text-sm text-[#4a7c59] hover:underline"
            >
              ส่งรหัสใหม่
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
