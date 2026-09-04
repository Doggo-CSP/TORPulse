import type { Metadata } from "next";
import type { ReactNode } from "react";
import { tors } from "@/app/homepage/mockData";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tor = tors.find((t) => t.id === decodeURIComponent(id));
  if (!tor) {
    return { title: "ไม่พบ TOR | TORPulse" };
  }
  return {
    title: `${tor.title} | TORPulse`,
    description:
      tor.summary ??
      `รายละเอียด TOR ${tor.id} — ${tor.agency} งบประมาณ ${(tor.budget / 1_000_000).toFixed(1)} ล้านบาท`,
    openGraph: {
      title: tor.title,
      description: tor.summary ?? `${tor.agency} · ${tor.category}`,
    },
  };
}

export default function TorDetailLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}