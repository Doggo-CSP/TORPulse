"use client";

import Link from "next/link";
import { useSimilarProjects } from "@/hooks/use-tors";
import { formatBahtCurrency, formatThaiDate, formatThaiMonth } from "@/api/reports.api";

// UC-05: TORs whose bidding has closed and that are similar to this TOR (shared categories and
// technologies), with their mid and awarded prices, so the user can judge whether this TOR's
// budget is reasonable.
export function SimilarProjects({ torId, budgetBaht }: { torId: string; budgetBaht: number | null }) {
  const { data, isLoading, error } = useSimilarProjects(torId);

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-border bg-[#F8FAF7] px-6 py-4">
        <h2 className="font-semibold">TOR คล้ายกันที่ปิดรับข้อเสนอแล้ว</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          คัดจากหมวดหมู่และเทคโนโลยีที่ตรงกัน เพื่อเทียบงบประมาณกับราคาที่งานลักษณะเดียวกันเคยได้
          {data?.source && ` · ข้อมูล ณ ${formatThaiDate(data.source.as_of)}`}
        </p>
      </div>

      {isLoading ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">กำลังค้นหาโครงการที่คล้ายกัน...</p>
      ) : error ? (
        <p className="px-6 py-8 text-sm text-rose-600">โหลดโครงการที่คล้ายกันไม่สำเร็จ</p>
      ) : !data || data.items.length === 0 ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">
          ยังไม่พบ TOR ที่ปิดรับข้อเสนอแล้วในหมวดเดียวกับ TOR นี้
        </p>
      ) : (
        <>
          <BudgetComparison
            budgetBaht={budgetBaht}
            medianAwarded={data.summary.median_awarded_price_baht}
            medianMid={data.summary.median_mid_price_baht}
            diffPct={data.summary.budget_vs_median_awarded_pct}
            avgSavingsPct={data.summary.avg_savings_pct}
            count={data.summary.project_count}
          />

          <ul className="divide-y divide-border">
            {data.items.map((project) => {
              const over = project.savings_pct < 0;
              return (
                <li key={project.external_id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    <span className="rounded bg-surface-2 px-2 py-0.5">{project.external_id}</span>
                    {project.category_label && <span>{project.category_label}</span>}
                    {project.announce_date && (
                      <span>· {formatThaiMonth(project.announce_date.slice(0, 7))}</span>
                    )}
                  </div>
                  <Link
                    href={`/tor/${encodeURIComponent(project.tor_id)}`}
                    className="mt-1.5 block text-sm font-medium leading-snug hover:text-primary"
                  >
                    {project.project_title}
                  </Link>
                  {project.department_name && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{project.department_name}</p>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs">
                    <span className="text-muted-foreground">
                      ราคากลาง{" "}
                      <span className="font-mono font-medium text-foreground">
                        {formatBahtCurrency(project.mid_price_baht)}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      ราคาที่ชนะ{" "}
                      <span className="font-mono font-semibold text-primary">
                        {formatBahtCurrency(project.awarded_price_baht)}
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono font-semibold ${
                        over ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {over
                        ? `สูงกว่าราคากลาง ${Math.abs(project.savings_pct)}%`
                        : `ต่ำกว่าราคากลาง ${project.savings_pct}%`}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {project.matched_categories.map((category) => (
                      <span
                        key={category.key}
                        className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {category.label}
                      </span>
                    ))}
                    {project.matched_technologies.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-accent"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>

                  {project.requirements.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        ข้อกำหนดหลักของโครงการนี้
                      </summary>
                      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
                        {project.requirements.map((requirement, index) => (
                          <li key={index}>{requirement}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {project.detail_url && (
                    <a
                      href={project.detail_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      ดูประกาศบน e-GP ↗
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function BudgetComparison({
  budgetBaht,
  medianAwarded,
  medianMid,
  diffPct,
  avgSavingsPct,
  count,
}: {
  budgetBaht: number | null;
  medianAwarded: number | null;
  medianMid: number | null;
  diffPct: number | null;
  avgSavingsPct: number | null;
  count: number;
}) {
  return (
    <div className="grid gap-3 border-b border-border px-6 py-4 text-sm sm:grid-cols-3">
      <div>
        <p className="text-xs text-muted-foreground">วงเงินของ TOR นี้</p>
        <p className="mt-0.5 font-mono font-semibold">{formatBahtCurrency(budgetBaht)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">ค่ากลางราคาที่ชนะ ({count} โครงการ)</p>
        <p className="mt-0.5 font-mono font-semibold text-primary">{formatBahtCurrency(medianAwarded)}</p>
        <p className="text-[11px] text-muted-foreground">
          ค่ากลางราคากลาง {formatBahtCurrency(medianMid)}
          {avgSavingsPct !== null && ` · ส่วนต่างเฉลี่ย ${avgSavingsPct}%`}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">เทียบกับงานคล้ายกัน</p>
        {diffPct === null ? (
          <p className="mt-0.5 text-muted-foreground">—</p>
        ) : (
          <p className={`mt-0.5 font-semibold ${diffPct > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {diffPct > 0 ? `สูงกว่า ${diffPct}%` : diffPct < 0 ? `ต่ำกว่า ${Math.abs(diffPct)}%` : "เท่ากัน"}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">ใช้ประกอบการประเมินเท่านั้น ขอบเขตงานอาจต่างกัน</p>
      </div>
    </div>
  );
}
