import { parseThaiDate } from '../thai-date.js'
import type { DiscoveredProcurementProject } from './discovered-project.js'

const ANNOUNCEMENT_URL =
  'https://process5.gprocurement.go.th/egp-oann10-service/pb/a-egp-allt-project/announcement'

const DEFAULT_TIMEOUT_MS = 60_000

/**
 * Open announcements come from the eGP search. Its project status is stored as
 * the announcement stage.
 */
const ANNOUNCE_TYPE_LABELS: Record<string, string> = {
  '1': 'ร่างประกาศ',
  '3': 'ประกาศเชิญชวน',
}

export interface EgpAnnouncement {
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
}

export interface ListAnnouncementsInput {
  token: string
  budgetYear: number
  announceType: string
  page: number
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/**
 * The search is gated by Cloudflare Turnstile, so the token must be copied
 * from a real browser session (X-Announcement-Token request header).
 */
export class EgpTokenRejectedError extends Error {
  public constructor(message = 'eGP rejected the announcement token') {
    super(`${message}. Copy a fresh X-Announcement-Token from the browser.`)
    this.name = 'EgpTokenRejectedError'
  }
}

export async function fetchAnnouncements({
  token,
  budgetYear,
  announceType,
  page,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ListAnnouncementsInput): Promise<EgpAnnouncement[]> {
  const url = new URL(ANNOUNCEMENT_URL)
  url.searchParams.set('budgetYear', String(budgetYear))
  url.searchParams.set('announceType', announceType)
  url.searchParams.set('announcementTodayFlag', 'false')
  url.searchParams.set('page', String(page))

  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'X-Announcement-Token': token,
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (response.status === 401 || response.status === 403) {
    throw new EgpTokenRejectedError(`eGP announcement search returned HTTP ${response.status}`)
  }
  if (!response.ok) {
    throw new Error(`eGP announcement search failed: HTTP ${response.status}`)
  }

  const payload = (await response.json()) as EgpAnnouncementResponse
  if (payload.validateCfTurnTile === false) {
    throw new EgpTokenRejectedError('eGP rejected the token (validateCfTurnTile=false)')
  }
  return payload.data ?? []
}

export async function listAnnouncements(
  input: ListAnnouncementsInput,
): Promise<DiscoveredProcurementProject[]> {
  const announcements = await fetchAnnouncements(input)
  return announcements.map((announcement) => toDiscoveredProject(announcement, input))
}

export function toDiscoveredProject(
  announcement: EgpAnnouncement,
  { budgetYear, announceType }: Pick<ListAnnouncementsInput, 'budgetYear' | 'announceType'>,
): DiscoveredProcurementProject {
  const type = announcement.announceType ?? announceType
  return {
    externalId: announcement.projectId,
    title: announcement.projectName,
    fiscalYear: budgetYear,
    metadata: {
      title: announcement.projectName,
      departmentName: announcement.deptName,
      departmentSubName: announcement.deptSubName,
      projectStatus: ANNOUNCE_TYPE_LABELS[type] ?? `announceType ${type}`,
      sourceProjectId: null,
      contractStatus: null,
      contractStatusCode: null,
      fiscalYear: budgetYear,
      announceDate: parseThaiDate(announcement.announceDate),
      budgetBaht: announcement.projectMoney,
      midPriceBaht: announcement.priceBuild,
      awardedPriceBaht: null,
    },
  }
}

/**
 * Token is base64("EGP-ANNOUNCEMENT-KEY:<expiresAtMs>:<signature>").
 * Returns null when the token has no readable expiry.
 */
export function tokenMinutesLeft(token: string, now = Date.now()): number | null {
  const expiresAtMs = Number(Buffer.from(token, 'base64').toString('utf8').split(':')[1])
  return Number.isFinite(expiresAtMs) ? Math.floor((expiresAtMs - now) / 60_000) : null
}
