import { setTimeout as delay } from 'node:timers/promises'

import { z } from 'zod'

import type { DiscoveredProcurementProject } from './govspending-discovery.adapter.js'

const BMA_PROJECT_SEARCH_URL = 'https://egp2.bangkok.go.th/appapi/api/Projects/GetProjectFromFilter'

// BMA announce-type master ids from the project-search page filter
// (GET /appapi/api/MasterAnnounceTypes). They only widen discovery to open projects:
// BMA's filing does not match the eGP stage (an eGP draft is often filed under
// ราคากลาง), so the stage is read from the eGP announcement PDF by the worker instead.
export interface BmaAnnounceType {
  announceTypeId: string
  label: string
}

export const BMA_ANNOUNCE_TYPES: BmaAnnounceType[] = [
  { announceTypeId: '24995aa2-d875-4d3d-9dec-d5e22d222aa4', label: 'ร่างขอบเขตของงาน (TOR)' },
  { announceTypeId: '9863983d-44e1-4eee-b38a-bb0b495762c5', label: 'ประกาศราคากลาง' },
  { announceTypeId: '705f1ffb-82e2-4beb-bdd2-2746f0783bf0', label: 'ประกาศเชิญชวน' },
]

// BMA's projectNumber is the Central eGP project id, so the eGP adapter can ingest it.
const PROJECT_ID_PATTERN = /^\d{11}$/
const MAX_REQUEST_ATTEMPTS = 3

const optionalText = z
  .preprocess(
    (value) => (typeof value === 'string' ? value.trim() || null : value),
    z.string().nullable(),
  )
  .catch(null)

const optionalAmount = z
  .preprocess(
    (value) => (value === null || value === undefined || value === '' ? null : Number(value)),
    z.number().finite().nonnegative().nullable(),
  )
  .catch(null)

const projectSchema = z.object({
  projectNumber: z.string().trim().regex(PROJECT_ID_PATTERN),
  projectName: z.string().trim().min(1),
  masterOrgGroupName: optionalText,
  masterOrgDepartmentName: optionalText,
  projectBudget: optionalAmount,
})

const responseSchema = z.object({
  totalCount: z.coerce.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  data: z.array(z.unknown()),
})

export interface BmaPage {
  total: number
  hasNextPage: boolean
  projects: DiscoveredProcurementProject[]
  /** Rows without a valid eGP project number; they cannot be ingested yet. */
  skipped: number
}

export interface ListBmaProjectsInput {
  budgetYear: number
  keyword: string
  /** The BMA announce-type filter to query. */
  announceType: BmaAnnounceType
  pageNo: number
  pageSize: number
  signal?: AbortSignal
}

export interface BmaDiscoveryAdapterOptions {
  fetchImpl?: typeof fetch
  requestTimeoutMs?: number
}

/** Lists BMA (กรุงเทพมหานคร) projects for a given announce-type stage (all methods). */
export class BmaDiscoveryAdapter {
  private readonly fetchImpl: typeof fetch
  private readonly requestTimeoutMs: number

  public constructor(options: BmaDiscoveryAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000
  }

  public async listProjects(input: ListBmaProjectsInput): Promise<BmaPage> {
    let lastError: unknown

    for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
      try {
        return await this.requestPage(input)
      } catch (error) {
        if (input.signal?.aborted) {
          throw error
        }

        lastError = error
        if (attempt < MAX_REQUEST_ATTEMPTS) {
          await delay(500 * 2 ** (attempt - 1), undefined, { signal: input.signal })
        }
      }
    }

    throw lastError
  }

  private async requestPage(input: ListBmaProjectsInput): Promise<BmaPage> {
    const url = new URL(BMA_PROJECT_SEARCH_URL)
    url.searchParams.set('projectSearchText', input.keyword)
    url.searchParams.set('masterAnnounceTypeId', input.announceType.announceTypeId)
    url.searchParams.set('masterBudgetYearId', String(input.budgetYear))
    url.searchParams.set('pageNo', String(input.pageNo))
    url.searchParams.set('pageSize', String(input.pageSize))
    url.searchParams.set('sortBy', 'publishDateDesc')

    const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs)
    const signal = input.signal ? AbortSignal.any([input.signal, timeoutSignal]) : timeoutSignal
    const response = await this.fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal,
    })

    if (!response.ok) {
      throw new Error(`BMA project search failed with status ${response.status}`)
    }

    const parsed = responseSchema.safeParse(await response.json())
    if (!parsed.success) {
      throw new Error('BMA returned an invalid project-search response')
    }

    const projects: DiscoveredProcurementProject[] = []
    for (const row of parsed.data.data) {
      const project = projectSchema.safeParse(row)
      if (project.success) {
        projects.push(toDiscoveredProject(project.data, input.budgetYear))
      }
    }

    return {
      total: parsed.data.totalCount,
      hasNextPage: parsed.data.hasNextPage,
      projects,
      skipped: parsed.data.data.length - projects.length,
    }
  }
}

function toDiscoveredProject(
  project: z.infer<typeof projectSchema>,
  budgetYear: number,
): DiscoveredProcurementProject {
  return {
    externalId: project.projectNumber,
    title: project.projectName,
    fiscalYear: budgetYear,
    metadata: {
      title: project.projectName,
      departmentName: project.masterOrgGroupName,
      departmentSubName: project.masterOrgDepartmentName,
      // Stage, announce date, mid price and method come from the eGP announcement.
      projectStatus: null,
      fiscalYear: budgetYear,
      announceDate: null,
      budgetBaht: project.projectBudget,
      midPriceBaht: null,
      awardedPriceBaht: null,
      biddingMethod: null,
    },
  }
}
