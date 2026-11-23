/**
 * Format Thai Baht values for display (฿1.23 พันล้าน, ฿45.60 ล้าน, ฿12,345).
 */
export function formatBahtCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return "—";
  const sign = val < 0 ? "-" : "";
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000) {
    return `${sign}฿${(abs / 1_000_000_000).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} พันล้าน`;
  }
  if (abs >= 1_000_000) {
    return `${sign}฿${(abs / 1_000_000).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ล้าน`;
  }
  return `${sign}฿${abs.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

// "2026-02" -> "ก.พ. 69"
export function formatThaiMonth(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) return month;
  return `${THAI_MONTHS_SHORT[monthIndex - 1]} ${String((year + 543) % 100).padStart(2, "0")}`;
}

// ISO time -> "7 ต.ค. 2569" (Bangkok date)
export function formatThaiDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" })
    .format(date)
    .split("-")
    .map(Number);
  return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${year + 543}`;
}
