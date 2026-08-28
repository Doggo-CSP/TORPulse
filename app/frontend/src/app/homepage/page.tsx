"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { SiteNav } from "@/app/components/site_nav";
import {
  type Tor,
  tors,
  categorySplit,
  totalBudgetAmount,
  totalProjectCount,
  homeStats,
  priceComparisonData,
  priceChartSeries,
  isLoggedIn,
  recommended,
} from "./mockData";

// recharts measures container size, so render client-side only — disable SSR for it.
const PriceComparisonChart = dynamic(
  () =>
    import("recharts").then((recharts) => {
      const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = recharts;
      return function ChartComponent({
        data,
        series,
      }: {
        data: Array<{ category: string; [key: string]: string | number }>;
        series: Array<{ key: string; label: string; color: string }>;
      }) {
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `฿${v}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  return (
                    <div className="rounded-xl border border-border bg-background px-4 py-3 shadow-lg">
                      <p className="text-sm font-medium">{label}</p>
                      <div className="mt-1.5 space-y-0.5">
                        {payload.map((entry, i) => (
                          <p
                            key={entry.name ?? i}
                            className="text-xs font-medium"
                            style={{ color: entry.color }}
                          >
                            {entry.name} : ฿{Number(entry.value).toFixed(1)} ล้านบาท
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />
              {series.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      };
    }),
  { ssr: false },
);

/* ---------------------------------------------------------------------- */

const baht = (n: number) => "฿" + (n / 1_000_000).toFixed(1) + " ล้าน";
const toMillion = (n: number) => (n / 1_000_000).toFixed(1);

const categories = ["ทั้งหมด", "Web Application", "Data / BI", "Mobile App", "Enterprise System"];
const trackingGroups = ["ทั้งหมด", "งานพัฒนาเว็บไซต์", "งานข้อมูลและวิเคราะห์", "งานแอปพลิเคชันมือถือ", "งานระบบองค์กร"];
const budgetYears = ["ทั้งหมด", "2569", "2568", "2567"];
const budgetTypes = ["ทั้งหมด", "งบประมาณรายจ่ายประจำปี", "เงินนอกงบประมาณ", "เงินอุดหนุน"];
const statuses = ["ทั้งหมด", "เปิดรับสมัคร", "ใกล้ปิดรับ", "ปิดรับสมัครแล้ว"];
const agencies = ["ทั้งหมด", ...Array.from(new Set(tors.map((t) => t.agency)))];

const ITEMS_PER_PAGE = 4;

export default function HomePage() {
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [name, setName] = useState("");
  const [trackingGroup, setTrackingGroup] = useState("ทั้งหมด");
  const [budgetYear, setBudgetYear] = useState("ทั้งหมด");
  const [budgetType, setBudgetType] = useState("ทั้งหมด");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [agency, setAgency] = useState("ทั้งหมด");
  const [status, setStatus] = useState("ทั้งหมด");
  const [egpOnly, setEgpOnly] = useState(false);
  const [cat, setCat] = useState("ทั้งหมด");

  const [currentPage, setCurrentPage] = useState(1);

  const results = useMemo(
    () =>
      tors.filter((t) => {
        const matchesName =
          (t.title + t.agency + t.tech.join(" ") + t.id)
            .toLowerCase()
            .includes(name.toLowerCase());
        const matchesCat = cat === "ทั้งหมด" || t.category === cat;
        const matchesAgency = agency === "ทั้งหมด" || t.agency === agency;
        const matchesStatus = status === "ทั้งหมด" || t.status === status;
        const matchesEgp = !egpOnly || t.source === "e-GP";
        const min = budgetMin ? Number(budgetMin) * 1_000_000 : -Infinity;
        const max = budgetMax ? Number(budgetMax) * 1_000_000 : Infinity;
        const matchesBudget = t.budget >= min && t.budget <= max;
        return matchesName && matchesCat && matchesAgency && matchesStatus && matchesEgp && matchesBudget;
      }),
    [name, cat, agency, status, egpOnly, budgetMin, budgetMax],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [name, cat, agency, status, egpOnly, budgetMin, budgetMax, trackingGroup, budgetYear, budgetType]);

  const totalPages = Math.max(1, Math.ceil(results.length / ITEMS_PER_PAGE));
  const pagedResults = results.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const clearFilters = () => {
    setName("");
    setTrackingGroup("ทั้งหมด");
    setBudgetYear("ทั้งหมด");
    setBudgetType("ทั้งหมด");
    setBudgetMin("");
    setBudgetMax("");
    setAgency("ทั้งหมด");
    setStatus("ทั้งหมด");
    setEgpOnly(false);
    setCat("ทั้งหมด");
  };


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

        {/* Search + filter panel */}
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between bg-[#F8FAF7] px-6 py-4">
            <h2 className="text-lg font-semibold">ค้นหารายการ</h2>
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground"
            >
              เงื่อนไข
              <span className={`transition-transform ${filtersOpen ? "" : "rotate-180"}`}>▲</span>
            </button>
          </div>

          {filtersOpen && (
            <div className="p-6 md:p-8">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    ชื่อรายการ
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ระบุชื่อรายการ"
                    className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    กลุ่มติดตาม
                  </label>
                  <select
                    value={trackingGroup}
                    onChange={(e) => setTrackingGroup(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-muted-foreground"
                  >
                    {trackingGroups.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    ปีงบประมาณ
                  </label>
                  <select
                    value={budgetYear}
                    onChange={(e) => setBudgetYear(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-muted-foreground"
                  >
                    {budgetYears.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    ประเภทงบประมาณ
                  </label>
                  <select
                    value={budgetType}
                    onChange={(e) => setBudgetType(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-muted-foreground"
                  >
                    {budgetTypes.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    งบประมาณ (ล้านบาท)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      value={budgetMin}
                      onChange={(e) => setBudgetMin(e.target.value)}
                      placeholder="Min"
                      type="number"
                      className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
                    />
                    <span className="text-muted-foreground">-</span>
                    <input
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(e.target.value)}
                      placeholder="Max"
                      type="number"
                      className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    หน่วยงาน
                  </label>
                  <select
                    value={agency}
                    onChange={(e) => setAgency(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-muted-foreground"
                  >
                    {agencies.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    สถานะการดำเนินการ
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-muted-foreground"
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={egpOnly}
                      onChange={(e) => setEgpOnly(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    เฉพาะรายการที่มีใน EGP
                  </label>
                </div>
              </div>

              <div className="mt-5 border-t border-border pt-5">
                <p className="label-eyebrow">หมวดงาน</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {categories.map((f) => (
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
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={clearFilters}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  ล้างค่า
                </button>
                <button className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">
                  ค้นหา
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Results */}
        <section className="panel mt-6 p-6 md:p-8">
          <ul className="divide-y divide-border">
            {pagedResults.map((t) => (
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

        {/* Pagination */}
        <section className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-sm text-muted-foreground">
            แสดง <span className="font-semibold text-foreground">{ITEMS_PER_PAGE}</span> รายการ/หน้า
          </p>

          <div className="flex items-center gap-5 text-sm">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹ ก่อนหน้า
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              หน้าถัดไป ›
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-border px-2 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="หน้าก่อนหน้า"
            >
              ‹
            </button>
            <span className="flex items-center gap-1.5 rounded-md border border-primary px-3 py-1 text-sm">
              <span className="font-mono font-semibold text-primary">{currentPage}</span>
              <span className="text-muted-foreground">of {totalPages}</span>
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-border px-2 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="หน้าถัดไป"
            >
              ›
            </button>
          </div>
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

            {/* Grouped bar chart via recharts, comparing ราคากลาง vs ราคาที่ชนะการประมูล by category */}
            <div className="mt-5" style={{ height: 280 }}>
              <PriceComparisonChart data={priceComparisonData} series={priceChartSeries} />
            </div>

            <div className="mt-3 flex items-center justify-center gap-6">
              {priceChartSeries.map((s) => (
                <span key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                </span>
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
            <div className="mt-6 space-y-3 border-t border-border pt-5">
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="bg-primary px-4 py-2.5">
                  <p className="text-xs font-medium text-primary-foreground">
                    งบประมาณในการจัดซื้อจัดจ้างรวมงบประมาณปี 2569
                  </p>
                </div>
                <div className="px-4 py-4">
                  <p className="font-display text-2xl font-semibold text-primary">
                    {totalBudgetAmount.toLocaleString("th-TH")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">บาท</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="bg-primary px-4 py-2.5">
                  <p className="text-xs font-medium text-primary-foreground">
                    จำนวนโครงการทั้งหมด ปีงบประมาณ 2569
                  </p>
                </div>
                <div className="px-4 py-4">
                  <p className="font-display text-2xl font-semibold text-primary">
                    {totalProjectCount.toLocaleString("th-TH")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">โครงการ</p>
                </div>
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