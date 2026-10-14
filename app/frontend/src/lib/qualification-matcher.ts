import { TorDetail } from "@/api/tor.api";
import { UserProfile, PastProject } from "@/api/user.api";

export type MatchStatus = "matched" | "partial" | "missing";

export interface RequirementMatch {
  id: string;
  requirement: string;
  category:
    | "egp"
    | "legal"
    | "financial"
    | "track_record"
    | "experience"
    | "standards"
    | "capacity"
    | "technical"
    | "general";
  categoryLabel: string;
  status: MatchStatus;
  weight: number;
  scoreContribution: number;
  companyValue?: string;
  torRequirement?: string;
  reason: string;
  recommendation?: string;
  isCritical?: boolean;
}

export interface QualificationScoreSummary {
  score: number; // 0 - 100
  verdict: {
    label: string;
    description: string;
    color: string;
    badgeCls: string;
    barCls: string;
    glowCls: string;
  };
  matchedCount: number;
  partialCount: number;
  missingCount: number;
  totalCount: number;
  criticalMissingCount: number;
  items: RequirementMatch[];
  companyName: string;
  hasCompanyProfile: boolean;
}

const formatBaht = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return "-";
  return `${amount.toLocaleString("th-TH")} บาท`;
};

/**
 * Extracts a numeric baht amount from Thai text phrases, e.g.:
 * - "ไม่น้อยกว่า 5,000,000 บาท" -> 5000000
 * - "ไม่ต่ำกว่า 2 ล้านบาท" -> 2000000
 * - "วงเงิน 500,000 บาท" -> 500000
 */
function extractBahtAmount(text: string): number | null {
  // Check for "X ล้านบาท"
  const millionMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*ล้านบาท/);
  if (millionMatch) {
    const val = parseFloat(millionMatch[1]);
    if (!isNaN(val)) return val * 1_000_000;
  }

  // Check for "X,XXX,XXX บาท"
  const commaNumberMatch = text.match(/([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?)\s*บาท/);
  if (commaNumberMatch) {
    const val = parseFloat(commaNumberMatch[1].replace(/,/g, ""));
    if (!isNaN(val)) return val;
  }

  // Check for plain number before บาท
  const plainMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*บาท/);
  if (plainMatch) {
    const val = parseFloat(plainMatch[1]);
    if (!isNaN(val) && val > 1000) return val;
  }

  return null;
}

/**
 * Extracts required years of experience from Thai text, e.g. "ไม่น้อยกว่า 3 ปี"
 */
function extractYears(text: string): number | null {
  const match = text.match(/ไม่น้อยกว่า\s*([0-9]+)\s*ปี/) || text.match(/([0-9]+)\s*ปีขึ้นไป/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (!isNaN(val)) return val;
  }
  return null;
}

/**
 * Checks if text references standard ISO or certification keywords
 */
function extractCertKeyword(text: string): string | null {
  const match = text.match(/ISO\s*[0-9]{4,5}|CMMI(?:\s*Level\s*[0-9]+)?|ITIL|CISSP|PMP/i);
  return match ? match[0].toUpperCase() : null;
}

export function evaluateQualificationMatch(
  tor: TorDetail,
  profile: UserProfile | null | undefined
): QualificationScoreSummary {
  // Check if user has a valid company profile
  const hasCompanyProfile = Boolean(
    profile &&
      (profile.accountType === "company" ||
        profile.companyName ||
        profile.registrationNumber ||
        (profile.pastProjects && profile.pastProjects.length > 0) ||
        profile.isEgpRegistered)
  );

  const companyName =
    profile?.companyName || profile?.displayName || profile?.name || "บริษัทของคุณ";

  if (!hasCompanyProfile || !profile) {
    return {
      score: 0,
      verdict: {
        label: "ยังไม่ได้ระบุข้อมูลบริษัท",
        description: "กรอกข้อมูลโปรไฟล์บริษัทเพื่อประเมินความเหมาะสมกับ TOR นี้",
        color: "text-amber-700",
        badgeCls: "bg-amber-50 text-amber-700 border-amber-200",
        barCls: "bg-amber-400",
        glowCls: "shadow-amber-100",
      },
      matchedCount: 0,
      partialCount: 0,
      missingCount: 0,
      totalCount: 0,
      criticalMissingCount: 0,
      items: [],
      companyName,
      hasCompanyProfile: false,
    };
  }

  const items: RequirementMatch[] = [];
  const handledPillars = new Set<string>();

  const bidderQualifications = tor.bidderQualifications ?? [];
  const projectBudget = tor.budgetBaht ?? tor.midPriceBaht ?? 0;

  // Process explicit bidder qualifications from TOR
  bidderQualifications.forEach((rawText, idx) => {
    const text = rawText.trim();
    if (!text) return;

    const lower = text.toLowerCase();
    const id = `extracted-${idx}`;

    // 1. e-GP requirement
    if (
      lower.includes("e-gp") ||
      lower.includes("egp") ||
      lower.includes("กรมบัญชีกลาง") ||
      lower.includes("จัดซื้อจัดจ้างภาครัฐ")
    ) {
      handledPillars.add("egp");
      if (profile.isEgpRegistered) {
        items.push({
          id,
          requirement: text,
          category: "egp",
          categoryLabel: "ระบบ e-GP",
          status: "matched",
          weight: 20,
          scoreContribution: 20,
          companyValue: "ลงทะเบียน e-GP เรียบร้อยแล้ว",
          torRequirement: "ต้องเป็นผู้ค้าที่ลงทะเบียนในระบบ e-GP ของกรมบัญชีกลาง",
          reason: "บริษัทของคุณลงทะเบียนในระบบจัดซื้อจัดจ้างภาครัฐ (e-GP) แล้ว มีคุณสมบัติถูกต้องครบถ้วน",
          isCritical: true,
        });
      } else {
        items.push({
          id,
          requirement: text,
          category: "egp",
          categoryLabel: "ระบบ e-GP",
          status: "missing",
          weight: 20,
          scoreContribution: 0,
          companyValue: "ยังไม่ได้ลงทะเบียน หรือยังไม่ได้ระบุในโปรไฟล์",
          torRequirement: "ต้องเป็นผู้ค้าที่ลงทะเบียนในระบบ e-GP ของกรมบัญชีกลาง",
          reason: "TOR กำหนดให้ต้องเป็นผู้ประกอบการที่ลงทะเบียนในระบบ e-GP แต่โปรไฟล์ยังไม่มีสถานะลงทะเบียน",
          recommendation: "ลงทะเบียนผู้ค้าภาครัฐในระบบ e-GP (www.gprocurement.go.th) และเปิดสถานะในหน้าโปรไฟล์",
          isCritical: true,
        });
      }
      return;
    }

    // 2. Legal entity / Registration
    if (
      lower.includes("นิติบุคคล") ||
      lower.includes("จดทะเบียน") ||
      lower.includes("ผู้มีอาชีพรับจ้าง") ||
      lower.includes("หนังสือรับรองการจดทะเบียน")
    ) {
      handledPillars.add("legal");
      const hasRegNum = Boolean(profile.registrationNumber && profile.registrationNumber.trim());
      const hasName = Boolean(profile.companyName && profile.companyName.trim());

      if (hasRegNum && hasName) {
        items.push({
          id,
          requirement: text,
          category: "legal",
          categoryLabel: "สถานะนิติบุคคล",
          status: "matched",
          weight: 15,
          scoreContribution: 15,
          companyValue: `${profile.companyName} (เลขทะเบียน ${profile.registrationNumber})`,
          torRequirement: "ต้องเป็นนิติบุคคลผู้มีอาชีพรับจ้างงานที่ประกวดราคา",
          reason: "เป็นนิติบุคคลจดทะเบียนถูกต้องตามกฎหมาย และมีเลขทะเบียนนิติบุคคลระบุชัดเจนในระบบ",
          isCritical: true,
        });
      } else if (hasName) {
        items.push({
          id,
          requirement: text,
          category: "legal",
          categoryLabel: "สถานะนิติบุคคล",
          status: "partial",
          weight: 15,
          scoreContribution: 7.5,
          companyValue: `${profile.companyName} (ยังไม่ได้ระบุเลขทะเบียน 13 หลัก)`,
          torRequirement: "ต้องเป็นนิติบุคคลจดทะเบียน",
          reason: "ระบุชื่อบริษัทแล้ว แต่ยังไม่ได้กรอกเลขทะเบียนนิติบุคคล 13 หลักในโปรไฟล์",
          recommendation: "กรอกเลขทะเบียนนิติบุคคล 13 หลักในหน้าแก้ไขโปรไฟล์เพื่อความสมบูรณ์",
          isCritical: true,
        });
      } else {
        items.push({
          id,
          requirement: text,
          category: "legal",
          categoryLabel: "สถานะนิติบุคคล",
          status: "missing",
          weight: 15,
          scoreContribution: 0,
          companyValue: "ยังไม่ได้ระบุข้อมูลนิติบุคคล",
          torRequirement: "ต้องเป็นนิติบุคคลจดทะเบียน",
          reason: "ยังไม่ได้กรอกชื่อบริษัทและเลขทะเบียนนิติบุคคลในโปรไฟล์",
          recommendation: "อัปเดตข้อมูลบริษัทในหน้าโปรไฟล์",
          isCritical: true,
        });
      }
      return;
    }

    // 3. Past Projects / Track Record
    if (
      lower.includes("ผลงาน") ||
      lower.includes("สัญญา") ||
      lower.includes("คู่สัญญา") ||
      lower.includes("ส่งมอบงาน")
    ) {
      handledPillars.add("track_record");
      const pastProjects: PastProject[] = profile.pastProjects ?? [];
      const projectCount = pastProjects.length;
      const maxProjectVal = pastProjects.reduce(
        (max, p) => Math.max(max, p.valueBaht ?? 0),
        0
      );

      const requiredVal = extractBahtAmount(text);
      const benchmarkVal = requiredVal ?? (projectBudget > 0 ? projectBudget * 0.4 : 1_000_000);

      if (projectCount === 0) {
        items.push({
          id,
          requirement: text,
          category: "track_record",
          categoryLabel: "ผลงานโครงการ",
          status: "missing",
          weight: 20,
          scoreContribution: 0,
          companyValue: "ยังไม่มีข้อมูลผลงานในระบบ",
          torRequirement: requiredVal
            ? `ผลงานไม่น้อยกว่า ${formatBaht(requiredVal)}`
            : "มีผลงานประเภทเดียวกันกับงานที่ประกวดราคา",
          reason: "TOR กำหนดให้มีผลงานโครงการที่ผ่านมา แต่บริษัทยังไม่ได้ระบุประวัติผลงานในระบบ",
          recommendation: "เพิ่มผลงานโครงการที่เคยส่งมอบ พร้อมระบุมูลค่าสัญญาในหน้าโปรไฟล์",
          isCritical: true,
        });
      } else if (maxProjectVal >= benchmarkVal || (!requiredVal && projectCount >= 2)) {
        items.push({
          id,
          requirement: text,
          category: "track_record",
          categoryLabel: "ผลงานโครงการ",
          status: "matched",
          weight: 20,
          scoreContribution: 20,
          companyValue: `มี ${projectCount} โครงการ (สัญญาเดี่ยวสูงสุด ${formatBaht(maxProjectVal)})`,
          torRequirement: requiredVal
            ? `ไม่น้อยกว่า ${formatBaht(requiredVal)}`
            : `มีผลงานครอบคลุมวงเงินโครงการ`,
          reason: `มีผลงานโครงการที่ผ่านมาครอบคลุมเกณฑ์ (มูลค่าสูงสุด ${formatBaht(maxProjectVal)})`,
        });
      } else {
        items.push({
          id,
          requirement: text,
          category: "track_record",
          categoryLabel: "ผลงานโครงการ",
          status: "partial",
          weight: 20,
          scoreContribution: 10,
          companyValue: `มี ${projectCount} โครงการ (มูลค่าสูงสุด ${formatBaht(maxProjectVal)})`,
          torRequirement: requiredVal
            ? `ไม่น้อยกว่า ${formatBaht(requiredVal)}`
            : `ประมาณการเกณฑ์มาตรฐาน ${formatBaht(benchmarkVal)}`,
          reason: `บริษัทมีประวัติผลงาน ${projectCount} โครงการ แต่วงเงินสัญญาเดี่ยวสูงสุด (${formatBaht(maxProjectVal)}) อาจยังต่ำกว่าเกณฑ์ประมาณการ (${formatBaht(benchmarkVal)})`,
          recommendation: "ตรวจสอบว่ามีผลงานอื่นที่ครอบคลุมเกณฑ์หรือไม่ หรือพิจารณายื่นในนามกิจการร่วมค้า (JV)",
        });
      }
      return;
    }

    // 4. Financial / Registered Capital
    if (
      lower.includes("ทุนจดทะเบียน") ||
      lower.includes("ทุน") ||
      lower.includes("ฐานะการเงิน") ||
      lower.includes("งบการเงิน")
    ) {
      handledPillars.add("financial");
      const requiredCapital = extractBahtAmount(text) ?? (projectBudget > 0 ? projectBudget * 0.15 : 1_000_000);
      const cap = profile.registeredCapital;

      if (cap && cap >= requiredCapital) {
        items.push({
          id,
          requirement: text,
          category: "financial",
          categoryLabel: "ทุนจดทะเบียน",
          status: "matched",
          weight: 15,
          scoreContribution: 15,
          companyValue: `ทุนจดทะเบียน ${formatBaht(cap)}`,
          torRequirement: `เกณฑ์ขั้นต่ำ ${formatBaht(requiredCapital)}`,
          reason: `ทุนจดทะเบียนของบริษัท (${formatBaht(cap)}) ครอบคลุมเกณฑ์ที่กำหนด (${formatBaht(requiredCapital)})`,
        });
      } else if (cap && cap > 0) {
        items.push({
          id,
          requirement: text,
          category: "financial",
          categoryLabel: "ทุนจดทะเบียน",
          status: "partial",
          weight: 15,
          scoreContribution: 7.5,
          companyValue: `ทุนจดทะเบียน ${formatBaht(cap)}`,
          torRequirement: `เกณฑ์ขั้นต่ำ ${formatBaht(requiredCapital)}`,
          reason: `ทุนจดทะเบียน (${formatBaht(cap)}) ต่ำกว่าเกณฑ์ที่คาดหวัง (${formatBaht(requiredCapital)})`,
          recommendation: "ตรวจสอบเงื่อนไขหลักประกันสัญญาหรือพิจารณาเพิ่มทุนจดทะเบียน",
        });
      } else {
        items.push({
          id,
          requirement: text,
          category: "financial",
          categoryLabel: "ทุนจดทะเบียน",
          status: "missing",
          weight: 15,
          scoreContribution: 0,
          companyValue: "ยังไม่ได้ระบุทุนจดทะเบียน",
          torRequirement: `เกณฑ์แนะนำ ${formatBaht(requiredCapital)}`,
          reason: "ยังไม่ได้ระบุข้อมูลทุนจดทะเบียนในหน้าโปรไฟล์บริษัท",
          recommendation: "กรอกทุนจดทะเบียนที่ชำระแล้วในหน้าโปรไฟล์",
        });
      }
      return;
    }

    // 5. Experience
    if (lower.includes("ประสบการณ์") || lower.includes("ดำเนินงานมาแล้ว")) {
      handledPillars.add("experience");
      const requiredYears = extractYears(text) ?? 2;
      const exp = profile.yearsExperience;

      if (exp && exp >= requiredYears) {
        items.push({
          id,
          requirement: text,
          category: "experience",
          categoryLabel: "ประสบการณ์",
          status: "matched",
          weight: 10,
          scoreContribution: 10,
          companyValue: `ประสบการณ์ ${exp} ปี`,
          torRequirement: `ไม่น้อยกว่า ${requiredYears} ปี`,
          reason: `ประสบการณ์ดำเนินธุรกิจ ${exp} ปี ผ่านเกณฑ์ที่ต้องการ (${requiredYears} ปี)`,
        });
      } else if (exp && exp > 0) {
        items.push({
          id,
          requirement: text,
          category: "experience",
          categoryLabel: "ประสบการณ์",
          status: "partial",
          weight: 10,
          scoreContribution: 5,
          companyValue: `ประสบการณ์ ${exp} ปี`,
          torRequirement: `ไม่น้อยกว่า ${requiredYears} ปี`,
          reason: `ประสบการณ์ ${exp} ปี ใกล้เคียงแต่ต่ำกว่าเกณฑ์ (${requiredYears} ปี)`,
          recommendation: "เตรียมเอกสารผลงานและประวัติของผู้บริหาร/บุคลากรเพื่อเสริมความเชี่ยวชาญ",
        });
      } else {
        items.push({
          id,
          requirement: text,
          category: "experience",
          categoryLabel: "ประสบการณ์",
          status: "missing",
          weight: 10,
          scoreContribution: 0,
          companyValue: "ยังไม่ได้ระบุประสบการณ์",
          torRequirement: `ไม่น้อยกว่า ${requiredYears} ปี`,
          reason: "ยังไม่ได้ระบุจำนวนปีประสบการณ์ในโปรไฟล์",
          recommendation: "ระบุจำนวนปีที่ดำเนินงานในหน้าโปรไฟล์",
        });
      }
      return;
    }

    // 6. Standards / Certifications
    if (
      lower.includes("iso") ||
      lower.includes("cmmi") ||
      lower.includes("มาตรฐาน") ||
      lower.includes("ใบรับรอง")
    ) {
      handledPillars.add("standards");
      const targetCert = extractCertKeyword(text);
      const companyCerts = profile.certifications ?? [];

      const hasExactCert = targetCert
        ? companyCerts.some((c) => c.toUpperCase().includes(targetCert))
        : false;

      if (hasExactCert) {
        items.push({
          id,
          requirement: text,
          category: "standards",
          categoryLabel: "มาตรฐาน/ใบรับรอง",
          status: "matched",
          weight: 10,
          scoreContribution: 10,
          companyValue: companyCerts.join(", "),
          torRequirement: targetCert ? `มาตรฐาน ${targetCert}` : "มีมาตรฐานรับรองคุณภาพ",
          reason: `บริษัทมีใบรับรองมาตรฐาน ${targetCert ?? ""} ตรงตามที่ TOR กำหนด`,
        });
      } else if (companyCerts.length > 0) {
        items.push({
          id,
          requirement: text,
          category: "standards",
          categoryLabel: "มาตรฐาน/ใบรับรอง",
          status: "partial",
          weight: 10,
          scoreContribution: 5,
          companyValue: companyCerts.join(", "),
          torRequirement: targetCert ? `ต้องการ ${targetCert}` : "มีมาตรฐานรับรอง",
          reason: `บริษัทมีใบรับรอง (${companyCerts.join(", ")}) แต่ควรตรวจสอบว่าครอบคลุมเกณฑ์เฉพาะ ${targetCert ?? "ของโครงการ"} หรือไม่`,
          recommendation: "ตรวจสอบรายละเอียดการเทียบโอนมาตรฐานหรือขอหนังสือรับรองเทียบเท่า",
        });
      } else {
        items.push({
          id,
          requirement: text,
          category: "standards",
          categoryLabel: "มาตรฐาน/ใบรับรอง",
          status: "missing",
          weight: 10,
          scoreContribution: 0,
          companyValue: "ไม่มีข้อมูลใบรับรอง",
          torRequirement: targetCert ? `มาตรฐาน ${targetCert}` : "มีหนังสือรับรองมาตรฐาน",
          reason: "โปรไฟล์ยังไม่ได้ระบุใบรับรองมาตรฐานคุณภาพ",
          recommendation: "เพิ่มข้อมูลใบรับรองมาตรฐานที่บริษัทได้รับในหน้าโปรไฟล์",
        });
      }
      return;
    }

    // 7. Non-blacklist / Clean Record
    if (
      lower.includes("ทิ้งงาน") ||
      lower.includes("ผลประโยชน์ร่วมกัน") ||
      lower.includes("พ.ร.บ.จัดซื้อจัดจ้าง")
    ) {
      handledPillars.add("non_blacklist");
      items.push({
        id,
        requirement: text,
        category: "legal",
        categoryLabel: "คุณสมบัติตามกฎหมาย",
        status: profile.isEgpRegistered ? "matched" : "partial",
        weight: 10,
        scoreContribution: profile.isEgpRegistered ? 10 : 5,
        companyValue: profile.isEgpRegistered
          ? "สถานะผู้ค้าภาครัฐปกติ (ไม่มีประวัติทิ้งงาน)"
          : "ต้องจัดเตรียมหนังสือรับรองตนเอง",
        torRequirement: "ไม่เป็นผู้มีผลประโยชน์ร่วมกัน และไม่เป็นผู้ถูกระบุชื่อไว้ในบัญชีผู้ทิ้งงาน",
        reason: profile.isEgpRegistered
          ? "มีสถานะปกติในระบบ e-GP กรมบัญชีกลาง ไม่พบประวัติทิ้งงาน"
          : "สามารถจัดทำหนังสือรับรองตนเองตามแบบฟอร์มของหน่วยงานเพื่อยื่นข้อเสนอได้",
        recommendation: !profile.isEgpRegistered
          ? "ดาวน์โหลดและจัดเตรียมแบบฟอร์มยืนยันคุณสมบัติผู้ยื่นข้อเสนอ"
          : undefined,
      });
      return;
    }

    // 8. Other / General Bidder Qualification
    items.push({
      id,
      requirement: text,
      category: "general",
      categoryLabel: "เงื่อนไขทั่วไป",
      status: "partial",
      weight: 10,
      scoreContribution: 5,
      companyValue: profile.companyName ? "ตรวจสอบจากเอกสารเสนอราคา" : "-",
      torRequirement: text,
      reason: "เป็นเงื่อนไขเฉพาะที่ต้องตรวจสอบรายละเอียดข้อเสนอกับเอกสารแนบของบริษัท",
      recommendation: "ตรวจสอบเอกสารแนบท้าย TOR และเตรียมเอกสารประกอบตามที่หน่วยงานกำหนด",
    });
  });

  // Ensure key procurement pillars are always evaluated, even if the TOR extractor
  // didn't separate them into bidderQualifications (standard government e-GP criteria).
  if (!handledPillars.has("egp")) {
    items.unshift({
      id: "std-egp",
      requirement: "การลงทะเบียนในระบบจัดซื้อจัดจ้างภาครัฐด้วยอิเล็กทรอนิกส์ (e-GP)",
      category: "egp",
      categoryLabel: "ระบบ e-GP",
      status: profile.isEgpRegistered ? "matched" : "missing",
      weight: 20,
      scoreContribution: profile.isEgpRegistered ? 20 : 0,
      companyValue: profile.isEgpRegistered
        ? "ลงทะเบียน e-GP เรียบร้อยแล้ว"
        : "ยังไม่ได้ระบุสถานะ e-GP",
      torRequirement: "เกณฑ์บังคับในการยื่นข้อเสนอจัดซื้อจัดจ้างภาครัฐ",
      reason: profile.isEgpRegistered
        ? "บริษัทของคุณมีสถานะเป็นผู้ค้าภาครัฐในระบบ e-GP แล้ว"
        : "การยื่นประมูลงานภาครัฐจำเป็นต้องลงทะเบียนผู้ค้าในระบบ e-GP ของกรมบัญชีกลาง",
      recommendation: !profile.isEgpRegistered
        ? "ลงทะเบียนในระบบ e-GP (www.gprocurement.go.th) และเปิดสถานะในหน้าโปรไฟล์"
        : undefined,
      isCritical: true,
    });
  }

  if (!handledPillars.has("legal")) {
    const hasRegNum = Boolean(profile.registrationNumber?.trim());
    const hasName = Boolean(profile.companyName?.trim());
    const isMatched = hasRegNum && hasName;

    items.push({
      id: "std-legal",
      requirement: "การจดทะเบียนนิติบุคคลและสถานะการประกอบธุรกิจ",
      category: "legal",
      categoryLabel: "สถานะนิติบุคคล",
      status: isMatched ? "matched" : hasName ? "partial" : "missing",
      weight: 15,
      scoreContribution: isMatched ? 15 : hasName ? 7.5 : 0,
      companyValue: hasName
        ? `${profile.companyName} ${hasRegNum ? `(${profile.registrationNumber})` : "(ยังไม่มีเลขทะเบียน)"}`
        : "ยังไม่ได้ระบุ",
      torRequirement: "ต้องเป็นนิติบุคคลจดทะเบียนถูกต้องตามกฎหมาย",
      reason: isMatched
        ? "เป็นนิติบุคคลและมีเลขทะเบียนนิติบุคคลระบุครบถ้วน"
        : hasName
          ? "ระบุชื่อบริษัทแล้ว แต่ยังไม่ได้กรอกเลขทะเบียนนิติบุคคล 13 หลัก"
          : "ยังไม่มีข้อมูลนิติบุคคลในโปรไฟล์",
      recommendation: !isMatched
        ? "กรอกเลขทะเบียนนิติบุคคล 13 หลักในหน้าแก้ไขโปรไฟล์"
        : undefined,
      isCritical: true,
    });
  }

  if (!handledPillars.has("track_record")) {
    const pastProjects: PastProject[] = profile.pastProjects ?? [];
    const count = pastProjects.length;
    const maxVal = pastProjects.reduce((m, p) => Math.max(m, p.valueBaht ?? 0), 0);
    const benchmark = projectBudget > 0 ? projectBudget * 0.35 : 500_000;

    let status: MatchStatus = "missing";
    let scoreCont = 0;
    let reason = "ยังไม่มีข้อมูลผลงานโครงการที่บันทึกไว้ในโปรไฟล์";

    if (count > 0 && maxVal >= benchmark) {
      status = "matched";
      scoreCont = 20;
      reason = `มีผลงาน ${count} โครงการ มูลค่าสูงสุด ${formatBaht(maxVal)} ครอบคลุมสัดส่วนวงเงินโครงการ`;
    } else if (count > 0) {
      status = "partial";
      scoreCont = 10;
      reason = `มีผลงาน ${count} โครงการ แต่วงเงินสัญญาเดี่ยว (${formatBaht(maxVal)}) ต่ำกว่าเกณฑ์ประเมินเบื้องต้น (${formatBaht(benchmark)})`;
    }

    items.push({
      id: "std-track_record",
      requirement: `ผลงานโครงการที่ผ่านมา (อ้างอิงวงเงินโครงการ: ${formatBaht(projectBudget)})`,
      category: "track_record",
      categoryLabel: "ผลงานโครงการ",
      status,
      weight: 20,
      scoreContribution: scoreCont,
      companyValue:
        count > 0
          ? `${count} โครงการ (สูงสุด: ${formatBaht(maxVal)})`
          : "ยังไม่มีการบันทึกผลงาน",
      torRequirement: `ควรมีผลงานสัญญาเดี่ยวไม่น้อยกว่า ~35% ของวงเงิน (${formatBaht(benchmark)})`,
      reason,
      recommendation:
        status !== "matched"
          ? "เพิ่มประวัติผลงานโครงการที่คุณเคยส่งมอบในหน้าโปรไฟล์ หรือร่วมทุนกับพาร์ทเนอร์"
          : undefined,
      isCritical: true,
    });
  }

  if (!handledPillars.has("financial") && projectBudget > 0) {
    const cap = profile.registeredCapital;
    const targetCapital = projectBudget * 0.15; // 15% guideline

    let status: MatchStatus = "missing";
    let scoreCont = 0;
    let reason = "ยังไม่ได้ระบุข้อมูลทุนจดทะเบียนในโปรไฟล์";

    if (cap && cap >= targetCapital) {
      status = "matched";
      scoreCont = 15;
      reason = `ทุนจดทะเบียน ${formatBaht(cap)} เพียงพอต่อสัดส่วนวงเงินของโครงการ (${formatBaht(projectBudget)})`;
    } else if (cap && cap > 0) {
      status = "partial";
      scoreCont = 7.5;
      reason = `ทุนจดทะเบียน ${formatBaht(cap)} อาจต่ำกว่าสัดส่วน 15% ของวงเงินโครงการ (${formatBaht(targetCapital)})`;
    }

    items.push({
      id: "std-financial",
      requirement: `ทุนจดทะเบียนและความพร้อมทางการเงินสัมพันธ์กับวงเงินโครงการ (${formatBaht(projectBudget)})`,
      category: "financial",
      categoryLabel: "ทุนจดทะเบียน",
      status,
      weight: 15,
      scoreContribution: scoreCont,
      companyValue: cap ? `ทุนจดทะเบียน ${formatBaht(cap)}` : "ยังไม่ได้ระบุ",
      torRequirement: `เกณฑ์แนะนำประมาณ 15% ของงบประมาณ (${formatBaht(targetCapital)})`,
      reason,
      recommendation:
        status !== "matched"
          ? "อัปเดตทุนจดทะเบียนในโปรไฟล์ หรือเตรียมหนังสือค้ำประกันทางการเงินจากสถาบันการเงิน"
          : undefined,
    });
  }

  // Technology alignment check if TOR specifies technologies
  if (tor.technologies && tor.technologies.length > 0) {
    const techList = tor.technologies;
    const companyKeywords = [
      ...(profile.interests || []),
      ...(profile.certifications || []),
      profile.businessObjectives || "",
      profile.about || "",
      profile.businessType || "",
      ...(profile.pastProjects?.map((p) => p.name) || []),
    ]
      .join(" ")
      .toLowerCase();

    const matchedTechs = techList.filter((tech) =>
      companyKeywords.includes(tech.toLowerCase())
    );

    let status: MatchStatus = "missing";
    let scoreCont = 0;
    let reason = "ทักษะและเทคโนโลยีของโครงการยังไม่ตรงกับข้อมูลในโปรไฟล์";

    if (matchedTechs.length === techList.length || matchedTechs.length >= 2) {
      status = "matched";
      scoreCont = 10;
      reason = `ตรงกับความเชี่ยวชาญของบริษัท: ${matchedTechs.join(", ")}`;
    } else if (matchedTechs.length > 0) {
      status = "partial";
      scoreCont = 5;
      reason = `ตรงบางส่วน: ${matchedTechs.join(", ")} (ขาด: ${techList.filter((t) => !matchedTechs.includes(t)).join(", ")})`;
    }

    items.push({
      id: "std-tech",
      requirement: `ความเชี่ยวชาญด้านเทคโนโลยีที่โครงการต้องการ (${techList.join(", ")})`,
      category: "technical",
      categoryLabel: "เทคโนโลยี",
      status,
      weight: 10,
      scoreContribution: scoreCont,
      companyValue:
        matchedTechs.length > 0
          ? `เชี่ยวชาญ: ${matchedTechs.join(", ")}`
          : "ยังไม่มีข้อมูลทักษะนี้ในโปรไฟล์",
      torRequirement: techList.join(", "),
      reason,
      recommendation:
        status !== "matched"
          ? "ระบุความสนใจ ความเชี่ยวชาญ หรือโปรเจกต์ที่ใช้เทคโนโลยีนี้ในหน้าโปรไฟล์"
          : undefined,
    });
  }

  // Calculate final weighted score
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const totalScoreContribution = items.reduce(
    (sum, item) => sum + item.scoreContribution,
    0
  );

  const rawScore = totalWeight > 0 ? (totalScoreContribution / totalWeight) * 100 : 0;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  const matchedCount = items.filter((i) => i.status === "matched").length;
  const partialCount = items.filter((i) => i.status === "partial").length;
  const missingCount = items.filter((i) => i.status === "missing").length;
  const criticalMissingCount = items.filter(
    (i) => i.isCritical && i.status === "missing"
  ).length;

  // Determine qualitative verdict
  let verdict: QualificationScoreSummary["verdict"];
  if (criticalMissingCount > 0 && score < 50) {
    verdict = {
      label: "ขาดคุณสมบัติสำคัญ",
      description: "บริษัทขาดเกณฑ์บังคับในการยื่นข้อเสนอ ควรปรับปรุงข้อมูลหรือแก้เงื่อนไขก่อนยื่น",
      color: "text-rose-600",
      badgeCls: "bg-rose-50 text-rose-700 border-rose-200",
      barCls: "bg-rose-500",
      glowCls: "shadow-rose-100",
    };
  } else if (score >= 80) {
    verdict = {
      label: "ผ่านเกณฑ์ (คุณสมบัติเหมาะสม)",
      description: "บริษัทมีคุณสมบัติตรงตามเกณฑ์ส่วนใหญ่ พร้อมสำหรับการจัดทำข้อเสนอประกวดราคา",
      color: "text-emerald-700",
      badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      barCls: "bg-emerald-500",
      glowCls: "shadow-emerald-100",
    };
  } else if (score >= 50) {
    verdict = {
      label: "ผ่านเกณฑ์บางส่วน (ควรพิจารณา)",
      description: "มีโอกาสยื่นข้อเสนอได้ แต่ต้องเตรียมเอกสารหรือหาพาร์ทเนอร์เสริมในส่วนที่ขาด",
      color: "text-amber-700",
      badgeCls: "bg-amber-50 text-amber-700 border-amber-200",
      barCls: "bg-amber-500",
      glowCls: "shadow-amber-100",
    };
  } else {
    verdict = {
      label: "ไม่ผ่านเกณฑ์ (ไม่เหมาะสม)",
      description: "มีหลายเงื่อนไขที่ยังไม่ตรงกับโปรไฟล์บริษัท อาจไม่ผ่านการประเมินเบื้องต้น",
      color: "text-rose-600",
      badgeCls: "bg-rose-50 text-rose-700 border-rose-200",
      barCls: "bg-rose-500",
      glowCls: "shadow-rose-100",
    };
  }

  return {
    score,
    verdict,
    matchedCount,
    partialCount,
    missingCount,
    totalCount: items.length,
    criticalMissingCount,
    items,
    companyName,
    hasCompanyProfile: true,
  };
}
