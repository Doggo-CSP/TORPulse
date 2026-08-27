"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SiteNav } from "@/app/components/site_nav";

// Note: Move metadata to app/homepage/layout.tsx (Server Component) if needed.
// "use client" and `export const metadata` cannot coexist in the same file.


/* ---------------------------------------------------------------------- */
/* Mock data (inlined for now — replace with real data/hooks later)        */
/* ---------------------------------------------------------------------- */

type Tor = {
  id: string;
  title: string;
  agency: string;
  source: string;
  publishedAt: string;
  closesAt: string;
  category: string;
  budget: number;
  match: number;
  tech: string[];
};

const tors: Tor[] = [
  {
    id: "กทม.-2569-0142",
    title: "จ้างพัฒนาระบบบริหารจัดการงานทะเบียนราษฎรออนไลน์",
    agency: "สำนักงานเขตบางรัก",
    source: "e-GP",
    publishedAt: "20 ส.ค. 69",
    closesAt: "10 ก.ย. 69",
    category: "Web Application",
    budget: 18_500_000,
    match: 82,
    tech: ["React", "Node.js", "PostgreSQL"],
  },
  {
    id: "กทม.-2569-0139",
    title: "จ้างเหมาพัฒนาแดชบอร์ดวิเคราะห์ข้อมูลจราจรอัจฉริยะ",
    agency: "สำนักการจราจรและขนส่ง",
    source: "ระบบจัดซื้อจัดจ้าง กทม.",
    publishedAt: "18 ส.ค. 69",
    closesAt: "5 ก.ย. 69",
    category: "Data / BI",
    budget: 24_900_000,
    match: 74,
    tech: ["Python", "Power BI", "Airflow"],
  },
  {
    id: "กทม.-2569-0131",
    title: "พัฒนาแอปพลิเคชันมือถือสำหรับแจ้งปัญหาสาธารณะ",
    agency: "สำนักยุทธศาสตร์และประเมินผล",
    source: "e-GP",
    publishedAt: "15 ส.ค. 69",
    closesAt: "2 ก.ย. 69",
    category: "Mobile App",
    budget: 12_300_000,
    match: 65,
    tech: ["Flutter", "Firebase"],
  },
  {
    id: "กทม.-2569-0125",
    title: "จัดหาระบบ ERP สำหรับบริหารงบประมาณและพัสดุ",
    agency: "สำนักการคลัง",
    source: "ข้อมูลเปิด DGA",
    publishedAt: "10 ส.ค. 69",
    closesAt: "28 ส.ค. 69",
    category: "Enterprise System",
    budget: 42_000_000,
    match: 58,
    tech: [".NET", "SQL Server", "SAP"],
  },
];

const categorySplit = [
  { label: "Web Application", pct: 34 },
  { label: "Data / BI", pct: 22 },
  { label: "Mobile App", pct: 18 },
  { label: "Enterprise System", pct: 26 },
];

const topTech = [
  { label: "React", count: 41 },
  { label: "Node.js", count: 33 },
  { label: "Python", count: 29 },
  { label: ".NET", count: 24 },
  { label: "Flutter", count: 17 },
];

const homeStats = {
  avgMid: 21_400_000,
  avgAwarded: 18_900_000,
  avgDiscountPct: 11.7,
};

const homeBars = [
  { label: "Q1", value: 15_200_000 },
  { label: "Q2", value: 19_800_000 },
  { label: "Q3", value: 22_100_000 },
  { label: "Q4", value: 24_600_000 },
];

const isLoggedIn = false;

const recommended: Array<Tor & { interestScore: number; reason: string }> = [];

/* ---------------------------------------------------------------------- */

const baht = (n: number) => "฿" + (n / 1_000_000).toFixed(1) + " ล้าน";
const toMillion = (n: number) => (n / 1_000_000).toFixed(1);

const filters = ["ทั้งหมด", "Web Application", "Data / BI", "Mobile App", "Enterprise System"];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("ทั้งหมด");

  const results = useMemo(
    () =>
      tors.filter(
        (t) =>
          (cat === "ทั้งหมด" || t.category === cat) &&
          (t.title + t.agency + t.tech.join(" ") + t.id)
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [query, cat],
  );

  const maxBar = Math.max(...homeBars.map((b) => b.value));

  return (
    <div className="min-h-screen">
      <SiteNav />

      <main className="mx-auto max-w-6xl px-5 pb-24">
        {/* Hero */}
        <section className="grid gap-10 py-16 md:grid-cols-[1.15fr_0.85fr] md:items-center">
          <div>
            <p className="label-eyebrow">TOR · แพลตฟอร์มค้นหางานประมูลซอฟต์แวร์</p>
            <h1 className="mt-4 text-4xl leading-[1.18] font-semibold md:text-[3rem]">
              ทุก TOR งานซอฟต์แวร์ของ กทม.
              <br />
              <span className="text-primary">รวมไว้ในเรดาร์เดียว</span>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              TOR กระจายอยู่ตามเว็บไซต์จัดซื้อจัดจ้างหลายแห่งและถูกซ่อนอยู่ในไฟล์ PDF
              เราดึงข้อมูลมาให้อัตโนมัติ สกัดงบประมาณ ขอบเขตงาน เทคโนโลยี และเกณฑ์การประเมินด้วย AI
              แล้วบอกคุณว่าโครงการไหนที่ทีมของคุณมีคุณสมบัติผ่านจริง
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
                ดู TOR แบบผู้เยี่ยมชม
              </button>
              <button className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                สร้างโปรไฟล์บริษัท
              </button>
            </div>
          </div>

          <div className="panel p-6">
            <p className="label-eyebrow">ดัชนีล่าสุด</p>
            <div className="mt-5 grid grid-cols-2 gap-5">
              {[
                { k: "TOR ที่จัดเก็บแล้ว", v: "1,284" },
                { k: "แหล่งข้อมูล", v: "6" },
                { k: "งบประมาณรวมที่ติดตาม", v: "฿3.4 พันล้าน" },
                { k: "ประกาศใหม่สัปดาห์นี้", v: "37" },
              ].map((s) => (
                <div key={s.k}>
                  <p className="font-display text-2xl font-semibold text-primary">{s.v}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.k}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-xs text-muted-foreground">
                ดึงข้อมูลล่าสุด 08:40 น. · e-GP, ระบบจัดซื้อจัดจ้าง กทม., ข้อมูลเปิด DGA
              </p>
            </div>
          </div>
        </section>

        {/* Search + list */}
        <section className="panel p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหา TOR จากชื่อโครงการ หน่วยงาน เทคโนโลยี หรือเลขที่ประกาศ…"
              className="min-w-[240px] flex-1 rounded-md border border-input bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
            />
            <select className="rounded-md border border-input bg-background px-3 py-2.5 text-sm text-muted-foreground">
              <option>ประกาศ: 30 วันล่าสุด</option>
              <option>7 วันล่าสุด</option>
              <option>ปีนี้</option>
            </select>
            <select className="rounded-md border border-input bg-background px-3 py-2.5 text-sm text-muted-foreground">
              <option>งบประมาณ: ทั้งหมด</option>
              <option>ต่ำกว่า ฿10 ล้าน</option>
              <option>฿10 – ฿30 ล้าน</option>
              <option>มากกว่า ฿30 ล้าน</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setCat(f)}
                className={
                  "rounded-full border px-3.5 py-1.5 text-xs transition-colors " +
                  (cat === f
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                {f}
              </button>
            ))}
          </div>

          <ul className="mt-6 divide-y divide-border">
            {results.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tor/${t.id}`}
                  className="grid gap-4 rounded-2xl px-3 py-5 transition-colors hover:bg-surface-2 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                      <span className="rounded bg-surface-2 px-2 py-0.5">{t.id}</span>
                      <span>{t.source}</span>
                      <span>· ประกาศ {t.publishedAt}</span>
                      <span className="text-warning">· ปิดรับ {t.closesAt}</span>
                    </div>
                    <h3 className="mt-2 text-[15px] leading-snug font-medium">{t.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t.agency}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {t.tech.map((x) => (
                        <span
                          key={x}
                          className="rounded border border-border px-2 py-0.5 text-[11px] text-accent"
                        >
                          {x}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 md:flex-col md:items-end md:gap-2">
                    <p className="font-display text-xl font-semibold">{baht(t.budget)}</p>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{ width: `${t.match}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-success">ตรง {t.match}%</span>
                    </div>
                    <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">
                      ดูรายละเอียด
                    </span>
                  </div>
                </Link>
              </li>
            ))}
            {results.length === 0 && (
              <li className="py-10 text-center text-sm text-muted-foreground">
                ไม่พบ TOR ที่ตรงกับเงื่อนไขนี้
              </li>
            )}
          </ul>
        </section>

        {/* คำแนะนำเฉพาะบุคคล */}
        <section className="panel mt-8 p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="label-eyebrow">แนะนำสำหรับคุณ</p>
              <h2 className="mt-2 text-lg font-semibold">TOR ที่ตรงกับความสนใจของคุณ</h2>
            </div>
            <Link
              href="/profile"
              className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              จัดการความสนใจ
            </Link>
          </div>

          {!isLoggedIn ? (
            <div className="mt-5 rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                เข้าสู่ระบบและเลือกหมวดหมู่ที่สนใจ เพื่อให้เราแนะนำ TOR ที่ตรงกับงานของคุณ
              </p>
              <Link
                href="/auth"
                className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                เข้าสู่ระบบ / สมัครสมาชิก
              </Link>
            </div>
          ) : recommended.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                ยังไม่พบ TOR ที่ตรงกับความสนใจของคุณ ลองเลือกหมวดหมู่ที่สนใจในหน้าโปรไฟล์
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {recommended.map((t) => (
                <Link
                  key={t.id}
                  href={`/tor/${t.id}`}
                  className="rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
                    <span>{t.id}</span>
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-success">
                      คะแนน {t.interestScore}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-snug">{t.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.agency} · {t.reason}
                  </p>
                  <p className="mt-3 font-display text-lg font-semibold">{baht(t.budget)}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Charts */}
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="panel flex flex-col p-6 lg:col-span-2">
            <p className="label-eyebrow">สถิติภาพรวม</p>
            <h2 className="mt-2 text-lg font-semibold">วิเคราะห์ราคาย้อนหลัง</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              ดูแนวโน้มราคาจัดซื้อจัดจ้างโครงการซอฟต์แวร์จากข้อมูลโครงการที่ผ่านมา
              เพื่อช่วยประเมินระดับราคาและเปรียบเทียบกับโครงการปัจจุบัน
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-muted-foreground">ราคากลางเฉลี่ย</p>
                <p className="mt-1 font-display text-xl font-semibold">
                  ฿{toMillion(homeStats.avgMid)} ล้าน
                </p>
              </div>
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-muted-foreground">ราคาที่ชนะเฉลี่ย</p>
                <p className="mt-1 font-display text-xl font-semibold">
                  ฿{toMillion(homeStats.avgAwarded)} ล้าน
                </p>
              </div>
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-muted-foreground">ส่วนต่างเฉลี่ย</p>
                <p className="mt-1 font-display text-xl font-semibold text-primary">
                  {homeStats.avgDiscountPct.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Simple inline bar chart (no external chart component) */}
            <div className="mt-5 flex h-[220px] items-end gap-4 border-b border-border pb-2">
              {homeBars.map((b) => (
                <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    ฿{toMillion(b.value)}ล.
                  </span>
                  <div
                    className="w-full rounded-t-md bg-primary/80"
                    style={{ height: `${(b.value / maxBar) * 160}px` }}
                  />
                  <span className="text-xs font-medium">{b.label}</span>
                </div>
              ))}
            </div>

            <Link
              href="/reports"
              className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
            >
              ดูรายงานเชิงลึก →
            </Link>
          </div>

          <div className="panel p-6">
            <p className="label-eyebrow">สัดส่วนตามหมวดงาน</p>
            <ul className="mt-5 space-y-3.5">
              {categorySplit.map((c) => (
                <li key={c.label}>
                  <div className="flex justify-between text-xs">
                    <span>{c.label}</span>
                    <span className="font-mono text-muted-foreground">{c.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${c.pct * 2.6}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-border pt-5">
              <p className="label-eyebrow">เทคโนโลยีที่พบบ่อย</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {topTech.map((t) => (
                  <span
                    key={t.label}
                    className="rounded border border-border px-2 py-1 font-mono text-[11px]"
                  >
                    {t.label} <span className="text-muted-foreground">{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Feature strip */}
        <section className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            {
              t: "รวม TOR ไว้ที่เดียว",
              d: "TOR งานซอฟต์แวร์จากทุกแหล่งจัดซื้อจัดจ้างของ กทม. คัดรายการซ้ำออก เหลือฟีดเดียวที่ครบถ้วน",
            },
            {
              t: "สกัดข้อมูลด้วย AI",
              d: "แปลงไฟล์ PDF เป็นข้อมูลที่ใช้งานได้ ทั้งงบประมาณ ขอบเขตงาน เทคโนโลยี ผลงานที่ต้องส่งมอบ และเกณฑ์การประเมิน",
            },
            {
              t: "เทียบราคาและคุณสมบัติ",
              d: "เทียบโปรไฟล์บริษัทกับแต่ละ TOR พร้อมราคาโครงการใกล้เคียงที่ประมูลผ่านแล้ว และแจ้งเตือนทางอีเมล",
            },
          ].map((f) => (
            <div key={f.t} className="panel p-6">
              <h3 className="text-[15px] font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <p className="mx-auto max-w-6xl px-5 text-xs text-muted-foreground">
          TOR — ระบบรวมและค้นหา TOR งานซอฟต์แวร์ของกรุงเทพมหานคร
        </p>
      </footer>
    </div>
  );
}