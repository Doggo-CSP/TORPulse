import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { CentralEgpAdapter } from '../modules/ingestion/adapters/central-egp.adapters.js'
import {
  fetchAnnouncements,
  tokenMinutesLeft,
  type EgpAnnouncement,
} from '../modules/ingestion/adapters/egp-announcement-discovery.adapter.js'
import {
  extractSubmitDeadlineFromPdf,
  fetchAnnouncementPdf,
  fetchAnnouncementTemplateId,
  formatBangkokDateTime,
  type SubmitDeadline,
} from '../modules/ingestion/egp-submit-deadline.js'

const DEFAULT_OUT_DIR = 'sandbox-output/egp'

// Same pacing as CentralEgpAdapter (EGP_MIN_REQUEST_INTERVAL_MS).
const EGP_REQUEST_GAP_MS = 1_200

// Usage:
//   EGP_ANNOUNCEMENT_TOKEN=<token> npm run sandbox:egp -- [--budget-year 2570] [--announce-type 1,2,3]
//     [--page 1] [--limit 10] [--download] [--out sandbox-output/egp] [--timeout 180]
//   npm run sandbox:egp -- --project 69099462238 [--download]
//
// Sandbox: lists the eGP announcement search for each announceType (1 = ร่าง TOR / ร่างเอกสารประกวดราคา,
// 2, 3) and resolves each project's submit deadline: infoProcureDocAnnounZip -> buildName2 (template id)
// -> template view-pdf (ประกาศ PDF) -> parse "เสนอราคา ... ในวันที่ ... ถึง hh.mm น.". With --download,
// also fetches the TOR PDFs through CentralEgpAdapter. No DB writes. --project skips the search.
//
// The search endpoint is gated by Cloudflare Turnstile, so the token must come from a real
// browser session: open https://process5.gprocurement.go.th/egp-agpc01-web/announcement, run a
// search, then copy the X-Announcement-Token request header from DevTools > Network. It expires
// ~20 minutes after it is issued. Only the search needs it; the deadline and TOR download do not.
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'budget-year': { type: 'string', default: '2570' },
      'announce-type': { type: 'string', default: '1,2,3' },
      page: { type: 'string', default: '1' },
      limit: { type: 'string' },
      project: { type: 'string' },
      download: { type: 'boolean', default: false },
      out: { type: 'string', default: DEFAULT_OUT_DIR },
      timeout: { type: 'string', default: '180' },
    },
  })
  const timeoutMs = Number(values.timeout) * 1000

  let selected: EgpAnnouncement[]
  if (values.project) {
    selected = [{ projectId: values.project } as EgpAnnouncement]
  } else {
    const token = process.env.EGP_ANNOUNCEMENT_TOKEN?.trim()
    if (!token) {
      throw new Error('EGP_ANNOUNCEMENT_TOKEN is not set (see usage at the top of this script)')
    }
    const minutesLeft = tokenMinutesLeft(token)
    if (minutesLeft !== null) {
      console.log(
        minutesLeft < 0
          ? `Token expired ${-minutesLeft} min ago; the request will likely be rejected`
          : `Token valid for ~${minutesLeft} more min`,
      )
    }

    const announceTypes = values['announce-type'].split(',').map((type) => type.trim())
    const limit = values.limit ? Number(values.limit) : Infinity
    selected = []
    for (const announceType of announceTypes) {
      const announcements = await fetchAnnouncements({
        token,
        budgetYear: Number(values['budget-year']),
        announceType,
        page: Number(values.page),
      })
      console.log(
        `announceType ${announceType}: fetched ${announcements.length} announcements (page ${values.page})`,
      )
      selected.push(
        ...announcements
          .slice(0, limit)
          .map((a) => ({ ...a, announceType: a.announceType ?? announceType })),
      )
      await sleep(EGP_REQUEST_GAP_MS)
    }
  }

  const deadlines = new Map<string, ProjectDeadline>()
  for (const announcement of selected) {
    const deadline = await resolveDeadline(announcement.projectId, timeoutMs)
    deadlines.set(announcement.projectId, deadline)
    if (deadline.error) console.error(`${announcement.projectId}: ${deadline.error}`)
    await sleep(EGP_REQUEST_GAP_MS)
  }

  console.table(
    selected.map((a) => {
      const deadline = deadlines.get(a.projectId)
      return {
        type: a.announceType,
        projectId: a.projectId,
        announceDate: a.announceDate?.slice(0, 10),
        templateId: deadline?.templateId,
        submitDeadline: deadline?.submitDeadline?.date
          ? formatBangkokDateTime(deadline.submitDeadline.date)
          : (deadline?.submitDeadline?.text ?? null),
        dept: a.deptName,
        name: a.projectName ? truncate(a.projectName, 50) : undefined,
      }
    }),
  )

  if (!values.download) return

  const adapter = new CentralEgpAdapter({ requestTimeoutMs: timeoutMs })
  for (const announcement of selected) {
    const projectDir = path.join(values.out, announcement.projectId)
    const deadline = deadlines.get(announcement.projectId)
    try {
      await mkdir(projectDir, { recursive: true })
      await writeFile(
        path.join(projectDir, 'announcement.json'),
        JSON.stringify(
          {
            ...announcement,
            templateId: deadline?.templateId ?? null,
            submitDeadline: deadline?.submitDeadline?.date
              ? formatBangkokDateTime(deadline.submitDeadline.date)
              : null,
            submitDeadlineText: deadline?.submitDeadline?.text ?? null,
          },
          null,
          2,
        ),
      )
      if (deadline?.pdf) {
        await writeFile(path.join(projectDir, 'announcement.pdf'), deadline.pdf)
      }

      const project = await adapter.getProject(announcement.projectId)
      const documents = await adapter.downloadDocuments(project)
      for (const document of documents) {
        await writeFile(path.join(projectDir, document.fileName), document.content)
      }
      console.log(
        `${announcement.projectId}: saved ${documents.map((d) => d.fileName).join(', ')} -> ${projectDir}`,
      )
    } catch (error) {
      console.error(
        `${announcement.projectId}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}

interface ProjectDeadline {
  templateId: string | null
  pdf: Buffer | null
  submitDeadline: SubmitDeadline | null
  error?: string
}

async function resolveDeadline(projectId: string, timeoutMs: number): Promise<ProjectDeadline> {
  const result: ProjectDeadline = { templateId: null, pdf: null, submitDeadline: null }
  try {
    result.templateId = await fetchAnnouncementTemplateId(projectId, { timeoutMs })
    if (!result.templateId) return { ...result, error: 'no buildName2 (announcement template)' }

    await sleep(EGP_REQUEST_GAP_MS)
    result.pdf = await fetchAnnouncementPdf(result.templateId, { timeoutMs })
    result.submitDeadline = await extractSubmitDeadlineFromPdf(result.pdf)
    if (!result.submitDeadline) return { ...result, error: 'submit deadline not found in PDF' }
    return result
  } catch (error) {
    return { ...result, error: error instanceof Error ? error.message : String(error) }
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
