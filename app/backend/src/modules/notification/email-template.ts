export interface QualifyingTorItem {
  id: string
  projectTitle: string
  agencyName: string | null
  budgetBaht: number | null
  submissionDeadlineAt: Date | null
}

export interface QualifyingTorEmail {
  subject: string
  html: string
  text: string
}

const bahtFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'long',
  timeZone: 'Asia/Bangkok',
})

// TOR text comes from source documents and the LLM, so it is escaped before going into HTML.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatBudget(budgetBaht: number | null): string {
  return budgetBaht === null ? 'ไม่ระบุ' : bahtFormatter.format(budgetBaht)
}

export function buildQualifyingTorEmail(
  recipientName: string,
  tors: QualifyingTorItem[],
  frontendUrl: string,
): QualifyingTorEmail {
  const subject = `TOR ใหม่ที่คุณมีคุณสมบัติครบ (${tors.length} รายการ)`
  const settingsUrl = `${frontendUrl}/profile?tab=notifications`
  const items = tors.map((tor) => ({
    ...tor,
    url: `${frontendUrl}/tor/${tor.id}`,
    agency: tor.agencyName ?? 'ไม่ระบุหน่วยงาน',
    budget: formatBudget(tor.budgetBaht),
    deadline: tor.submissionDeadlineAt ? dateFormatter.format(tor.submissionDeadlineAt) : null,
  }))

  const text = [
    `เรียน ${recipientName}`,
    '',
    `มี TOR ใหม่ ${tors.length} รายการที่บริษัทของคุณมีคุณสมบัติครบทุกข้อ:`,
    '',
    ...items.flatMap((item, index) => [
      `${index + 1}. ${item.projectTitle}`,
      `   หน่วยงาน: ${item.agency}`,
      `   งบประมาณ: ${item.budget}`,
      ...(item.deadline ? [`   ยื่นข้อเสนอภายใน: ${item.deadline}`] : []),
      `   ${item.url}`,
      '',
    ]),
    `ปิดการแจ้งเตือนได้ที่ ${settingsUrl}`,
  ].join('\n')

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e5e7eb">
          <a href="${escapeHtml(item.url)}" style="font-weight:600;color:#1d4ed8;text-decoration:none">${escapeHtml(item.projectTitle)}</a>
          <div style="color:#374151;font-size:14px;margin-top:4px">หน่วยงาน: ${escapeHtml(item.agency)}</div>
          <div style="color:#374151;font-size:14px">งบประมาณ: ${escapeHtml(item.budget)}</div>
          ${item.deadline ? `<div style="color:#374151;font-size:14px">ยื่นข้อเสนอภายใน: ${escapeHtml(item.deadline)}</div>` : ''}
        </td>
      </tr>`,
    )
    .join('')

  const html = `<!doctype html>
<html lang="th">
  <body style="font-family:sans-serif;color:#111827;max-width:640px;margin:0 auto;padding:16px">
    <p>เรียน ${escapeHtml(recipientName)}</p>
    <p>มี TOR ใหม่ <strong>${tors.length}</strong> รายการที่บริษัทของคุณมีคุณสมบัติครบทุกข้อ</p>
    <table style="width:100%;border-collapse:collapse">${rows}
    </table>
    <p style="color:#6b7280;font-size:12px;margin-top:24px">
      คุณได้รับอีเมลนี้เพราะเปิดการแจ้งเตือนไว้ <a href="${escapeHtml(settingsUrl)}">ปิดการแจ้งเตือน</a>
    </p>
  </body>
</html>`

  return { subject, html, text }
}
