import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "รายละเอียด TOR | TORPulse",
  description: "รายละเอียดโครงการจัดซื้อจัดจ้างภาครัฐ",
};

export default function TorDetailLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
