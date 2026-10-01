import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { CentralEgpAdapter } from '../modules/ingestion/adapters/central-egp.adapters.js'

const ANNOUNCEMENT_URL =
  'https://process5.gprocurement.go.th/egp-oann10-service/pb/a-egp-allt-project/announcement'

const DEFAULT_OUT_DIR = 'sandbox-output/egp'

interface EgpAnnouncement {
  projectId: string
  projectName: string
  deptName: string | null
  deptSubName: string | null
  announceDate: string | null
  announceType: string | null
  methodId: string | null
  stepId: string | null
  projectStatus: string | null
  projectMoney: number | null
  priceBuild: number | null
  flowName: string | null
}

interface EgpAnnouncementResponse {
  data?: EgpAnnouncement[]
  validateCfTurnTile?: boolean
  response?: { responseCode: number; responseDesc: string }
}

// Usage:
//   EGP_ANNOUNCEMENT_TOKEN=<token> npm run sandbox:egp -- [--budget-year 2570] [--announce-type 1]
//     [--page 1] [--limit 10] [--download] [--out sandbox-output/egp]
//
// Sandbox: lists the eGP announcement search (announceType 1 = ร่าง TOR / ร่างเอกสารประกวดราคา) and,
// with --download, fetches each project's TOR PDFs through CentralEgpAdapter. No DB writes.
//
// The search endpoint is gated by Cloudflare Turnstile, so the token must come from a real
// browser session: open https://process5.gprocurement.go.th/egp-agpc01-web/announcement, run a
// search, then copy the X-Announcement-Token request header from DevTools > Network. It expires
// ~20 minutes after it is issued. Only the search needs it; TOR download does not.
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'budget-year': { type: 'string', default: '2570' },
      'announce-type': { type: 'string', default: '1' },
      page: { type: 'string', default: '1' },
      limit: { type: 'string' },
      download: { type: 'boolean', default: false },
      out: { type: 'string', default: DEFAULT_OUT_DIR },
    },
  })

  const token = process.env.EGP_ANNOUNCEMENT_TOKEN?.trim()
  if (!token) {
    throw new Error('EGP_ANNOUNCEMENT_TOKEN is not set (see usage at the top of this script)')
  }
  warnIfTokenExpired(token)

  const announcements = await fetchAnnouncements(token, {
    budgetYear: values['budget-year'],
    announceType: values['announce-type'],
    page: values.page,
  })
  const limit = values.limit ? Number(values.limit) : announcements.length
  const selected = announcements.slice(0, limit)

  console.log(`Fetched ${announcements.length} announcements (page ${values.page})`)
  console.table(
    selected.map((a) => ({
      projectId: a.projectId,
      announceDate: a.announceDate?.slice(0, 10),
      dept: a.deptName,
      budget: a.projectMoney,
      step: a.stepId,
      name: truncate(a.projectName, 60),
    })),
  )

  if (!values.download) return

  const adapter = new CentralEgpAdapter()
  for (const announcement of selected) {
    const projectDir = path.join(values.out, announcement.projectId)
    try {
      const project = await adapter.getProject(announcement.projectId)
      const documents = await adapter.downloadDocuments(project)

      await mkdir(projectDir, { recursive: true })
      await writeFile(
        path.join(projectDir, 'announcement.json'),
        JSON.stringify(announcement, null, 2),
      )
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

async function fetchAnnouncements(
  token: string,
  query: { budgetYear: string; announceType: string; page: string },
): Promise<EgpAnnouncement[]> {
  const url = new URL(ANNOUNCEMENT_URL)
  url.searchParams.set('budgetYear', query.budgetYear)
  url.searchParams.set('announceType', query.announceType)
  url.searchParams.set('announcementTodayFlag', 'false')
  url.searchParams.set('page', query.page)

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'X-Announcement-Token': token,
    },
  })
  if (!response.ok) {
    throw new Error(`eGP announcement search failed: HTTP ${response.status}`)
  }

  const payload = (await response.json()) as EgpAnnouncementResponse
  if (payload.validateCfTurnTile === false) {
    throw new Error(
      'eGP rejected the token (validateCfTurnTile=false). Copy a fresh X-Announcement-Token from the browser.',
    )
  }
  return payload.data ?? []
}

// Token is base64("EGP-ANNOUNCEMENT-KEY:<expiresAtMs>:<signature>").
function warnIfTokenExpired(token: string): void {
  const expiresAtMs = Number(Buffer.from(token, 'base64').toString('utf8').split(':')[1])
  if (!Number.isFinite(expiresAtMs)) return

  const minutesLeft = Math.floor((expiresAtMs - Date.now()) / 60_000)
  if (minutesLeft < 0) {
    console.warn(`Token expired ${-minutesLeft} min ago; the request will likely be rejected`)
  } else {
    console.log(`Token valid for ~${minutesLeft} more min`)
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
