import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { env } from '../config/env.js'
import {
  buildQualifyingTorEmail,
  type QualifyingTorItem,
} from '../modules/notification/email-template.js'
import { createSmtpMailer } from '../modules/notification/mailer.js'

// Sends the real "qualifying TOR" notification email, filled with sample TORs, to any inbox.
// Needs SMTP_* and NOTIFICATION_FROM in .env. No MongoDB or worker needed.
//   npm run email:sample -- customer@example.com
//   npm run email:sample -- customer@example.com --name "บริษัท ตัวอย่าง จำกัด"
//   npm run email:sample -- --preview        write HTML to sandbox-output/, send nothing
// The subject is prefixed with [ตัวอย่าง] so the recipient knows it is a demo.

const DAY_MS = 24 * 60 * 60 * 1000

function sampleTors(now: Date): QualifyingTorItem[] {
  return [
    {
      id: 'sample-1',
      projectTitle: 'จ้างพัฒนาระบบบริหารจัดการข้อมูลบุคลากร (HRMS) ระยะที่ 2',
      agencyName: 'สำนักงานตัวอย่างจังหวัด',
      budgetBaht: 4_850_000,
      submissionDeadlineAt: new Date(now.getTime() + 14 * DAY_MS),
    },
    {
      id: 'sample-2',
      projectTitle: 'จ้างพัฒนาแอปพลิเคชันบริการประชาชนบนอุปกรณ์เคลื่อนที่',
      agencyName: 'เทศบาลนครตัวอย่าง',
      budgetBaht: 2_300_000,
      submissionDeadlineAt: new Date(now.getTime() + 9 * DAY_MS),
    },
    {
      id: 'sample-3',
      projectTitle: 'จ้างปรับปรุงเว็บไซต์และระบบสารสนเทศเพื่อการบริหาร',
      agencyName: null,
      budgetBaht: null,
      submissionDeadlineAt: null,
    },
  ]
}

interface Args {
  to: string | null
  name: string
  preview: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { to: null, name: 'คุณลูกค้า', preview: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--preview') {
      args.preview = true
    } else if (arg === '--name') {
      const value = argv[++i]
      if (!value) throw new Error('--name needs a value')
      args.name = value
    } else if (arg && !arg.startsWith('--')) {
      args.to = arg
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const email = buildQualifyingTorEmail(args.name, sampleTors(new Date()), env.FRONTEND_URL)
  const subject = `[ตัวอย่าง] ${email.subject}`

  if (args.preview) {
    const outDir = path.resolve('sandbox-output')
    await mkdir(outDir, { recursive: true })
    const htmlPath = path.join(outDir, 'sample-email.html')
    await writeFile(htmlPath, email.html, 'utf8')
    console.log(`Subject: ${subject}`)
    console.log(`Preview written to ${htmlPath}`)
    return
  }

  if (!args.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.to)) {
    throw new Error('Usage: npm run email:sample -- <recipient@example.com> [--name "..."]')
  }
  if (!env.NOTIFICATION_FROM) {
    throw new Error('NOTIFICATION_FROM is required to send the sample email')
  }

  await createSmtpMailer().send({
    from: env.NOTIFICATION_FROM,
    to: args.to,
    subject,
    html: email.html,
    text: email.text,
  })
  console.log(`Sample email sent to ${args.to}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
