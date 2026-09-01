import Link from "next/link";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const googleLoginUrl = `${apiUrl}/auth/google`;

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const authenticationFailed = (await searchParams).error === "google";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f0e8] px-4">
      <div className="w-full max-w-[420px]">
        <div className="rounded-3xl border border-[#e8e0d0] bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#4a7c59] font-mono text-xs font-bold text-white">
              TR
            </span>
            <span className="text-sm font-semibold tracking-wide text-[#4a7c59]">
              TOR
            </span>
          </div>

          <h1 className="mb-2 text-2xl font-bold text-[#2d2d2d]">
            เข้าสู่ระบบ
          </h1>
          <p className="mb-7 text-sm leading-relaxed text-[#7a8b6f]">
            ใช้บัญชี Google เพื่อบันทึก TOR และรับคำแนะนำที่ตรงกับความสนใจของคุณ
          </p>

          {authenticationFailed ? (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองอีกครั้ง
            </p>
          ) : null}

          <a
            id="login-google"
            href={googleLoginUrl}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#ddd5c8] bg-white py-3 text-sm font-medium text-[#2d2d2d] shadow-sm transition-all duration-150 hover:bg-[#faf7f2] active:scale-[0.98]"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            ดำเนินการต่อด้วย Google
          </a>
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-xs text-[#b0a898] transition-colors hover:text-[#7a8b6f]"
          >
            ← กลับหน้าแรก
          </Link>
        </div>
      </div>
    </main>
  );
}
