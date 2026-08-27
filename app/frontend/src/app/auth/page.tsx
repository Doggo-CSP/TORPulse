"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: connect to backend auth
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8] px-4">
      <div className="w-full max-w-[420px]">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-[#e8e0d0] p-8">
          {/* Logo / brand */}
          <div className="flex items-center gap-2 mb-6">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#4a7c59] font-mono text-xs font-bold text-white">
              TR
            </span>
            <span className="text-sm font-semibold text-[#4a7c59] tracking-wide">TOR</span>
          </div>

          <h1 className="text-2xl font-bold text-[#2d2d2d] mb-2">เข้าสู่ระบบ</h1>
          <p className="text-sm text-[#7a8b6f] leading-relaxed mb-7">
            สร้างโปรไฟล์และเลือกหมวดหมู่ที่สนใจ เพื่อให้เราแนะนำ<br />
            TOR ที่ตรงกับความต้องการของคุณมากขึ้น
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-[#2d2d2d] mb-1.5"
              >
                อีเมล
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-[#ddd5c8] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] placeholder:text-[#b0a898] outline-none focus:border-[#4a7c59] focus:ring-2 focus:ring-[#4a7c59]/15 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-[#2d2d2d] mb-1.5"
              >
                รหัสผ่าน
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  required
                  className="w-full rounded-xl border border-[#ddd5c8] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] placeholder:text-[#b0a898] outline-none focus:border-[#4a7c59] focus:ring-2 focus:ring-[#4a7c59]/15 transition-all pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b0a898] hover:text-[#7a8b6f] transition-colors"
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="mt-1.5 text-right">
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-[#7a8b6f] hover:text-[#4a7c59] transition-colors"
                >
                  ลืมรหัสผ่าน?
                </Link>
              </div>
            </div>

            {/* Submit — green button */}
            <button
              id="login-submit"
              type="submit"
              className="mt-1 w-full rounded-xl bg-[#4a7c59] py-3 text-sm font-semibold text-white hover:bg-[#3d6b4a] active:scale-[0.98] transition-all duration-150 shadow-sm"
            >
              เข้าสู่ระบบ
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e8e0d0]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-[#b0a898]">หรือดำเนินการด้วย</span>
            </div>
          </div>

          {/* Google sign-in — BELOW the green เข้าสู่ระบบ button */}
          <button
            id="login-google"
            type="button"
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-[#ddd5c8] bg-white py-3 text-sm font-medium text-[#2d2d2d] hover:bg-[#faf7f2] active:scale-[0.98] transition-all duration-150 shadow-sm"
          >
            {/* Google "G" SVG logo */}
            <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
            ดำเนินการต่อด้วย Google
          </button>

          {/* Sign up link */}
          <p className="mt-6 text-center text-sm text-[#7a8b6f]">
            ยังไม่มีบัญชี?{" "}
            <Link
              href="/auth/signup"
              className="font-semibold text-[#4a7c59] hover:underline"
            >
              สมัครสมาชิก
            </Link>
          </p>
        </div>

        {/* Back to home */}
        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-xs text-[#b0a898] hover:text-[#7a8b6f] transition-colors"
          >
            ← กลับหน้าแรก
          </Link>
        </div>
      </div>
    </div>
  );
}
