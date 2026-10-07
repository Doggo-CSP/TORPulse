import { setTimeout as delay } from 'node:timers/promises'

import { z } from 'zod'

import type { DiscoveredProcurementProject } from './discovered-project.js'

const BMA_PROJECT_SEARCH_URL = 'https://egp2.bangkok.go.th/appapi/api/Projects/GetProjectFromFilter'
const BMA_PROJECT_DETAIL_URL = 'https://egp2.bangkok.go.th/appapi/api/Projects/GetProjectDetail'

// Master ids from the BMA project search page filters.
const INVITATION_ANNOUNCE_TYPE_ID = '705f1ffb-82e2-4beb-bdd2-2746f0783bf0' // ประกาศเชิญชวน
const E_BIDDING_METHOD_ID = 'f3c58464-edc9-11e9-9a2c-00155d00442e' // e-bidding
const INVITATION_STATUS = 'ประกาศเชิญชวน'

// BMA's projectNumber is the Central eGP project id, so the eGP adapter can ingest it.
const PROJECT_ID_PATTERN = /^\d{11}$/
const MAX_REQUEST_ATTEMPTS = 3
// Parallel detail requests per search page; keeps load on the BMA API modest.
const DETAIL_CONCURRENCY = 5

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
  projectId: optionalText,
  masterContractAvailableCode: optionalText,
})

const detailSchema = z.object({
  projectAverageBudget: optionalAmount,
  masterContractAvailableCode: optionalText,
  masterContractAvailableName: optionalText,
})

type BmaProject = z.infer<typeof projectSchema>
type BmaProjectDetail = z.infer<typeof detailSchema>

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
  pageNo: number
  pageSize: number
  signal?: AbortSignal
}

/** Fields only the BMA project-detail endpoint provides. */
export interface BmaProjectDetails {
  sourceProjectId: string
  midPriceBaht: number | null
  contractStatus: string | null
  contractStatusCode: string | null
}

export interface BmaDiscoveryAdapterOptions {
  fetchImpl?: typeof fetch
  requestTimeoutMs?: number
}

/** Lists BMA (กรุงเทพมหานคร) e-bidding projects in the ประกาศเชิญชวน stage. */
export class BmaDiscoveryAdapter {
  private readonly fetchImpl: typeof fetch
  private readonly requestTimeoutMs: number

  public constructor(options: BmaDiscoveryAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000
  }

  public async listProjects(input: ListBmaProjectsInput): Promise<BmaPage> {
    const url = new URL(BMA_PROJECT_SEARCH_URL)
    url.searchParams.set('projectSearchText', input.keyword)
    url.searchParams.set('masterAnnounceTypeId', INVITATION_ANNOUNCE_TYPE_ID)
    url.searchParams.set('masterMethodIdId', E_BIDDING_METHOD_ID)
    url.searchParams.set('masterBudgetYearId', String(input.budgetYear))
    url.searchParams.set('pageNo', String(input.pageNo))
    url.searchParams.set('pageSize', String(input.pageSize))
    url.searchParams.set('sortBy', 'publishDateDesc')

    const page = await this.withRetry(() => this.search(url, input.signal), input.signal)

    // Middle price and contract status are only on the detail endpoint. A failed detail
    // request leaves those fields null so the sync never erases values already stored.
    const details = await mapWithConcurrency(page.projects, DETAIL_CONCURRENCY, async (project) => {
      if (!project.projectId) {
        return null
      }
      try {
        return await this.withRetry(
          () => this.requestDetail(project.projectId!, input.signal),
          input.signal,
        )
      } catch (error) {
        if (input.signal?.aborted) {
          throw error
        }
        console.warn('BMA project detail failed', { projectId: project.projectId, error })
        return null
      }
    })

    return {
      total: page.total,
      hasNextPage: page.hasNextPage,
      projects: page.projects.map((project, index) =>
        toDiscoveredProject(project, input.budgetYear, details[index] ?? null),
      ),
      skipped: page.skipped,
    }
  }

  /**
   * Looks up one project by its eGP project number (any stage, any year) and returns its
   * detail fields, or null when BMA does not list it.
   */
  public async findProjectDetails(
    projectNumber: string,
    signal?: AbortSignal,
  ): Promise<BmaProjectDetails | null> {
    const url = new URL(BMA_PROJECT_SEARCH_URL)
    url.searchParams.set('projectSearchText', projectNumber)
    url.searchParams.set('pageNo', '1')
    url.searchParams.set('pageSize', '10')

    const page = await this.withRetry(() => this.search(url, signal), signal)
    const project = page.projects.find((row) => row.projectNumber === projectNumber)
    if (!project?.projectId) {
      return null
    }

    const detail = await this.withRetry(() => this.requestDetail(project.projectId!, signal), signal)
    return toProjectDetails(project, detail)
  }

  private async withRetry<T>(request: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    let lastError: unknown

    for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
      try {
        return await request()
      } catch (error) {
        if (signal?.aborted) {
          throw error
        }

        lastError = error
        if (attempt < MAX_REQUEST_ATTEMPTS) {
          await delay(500 * 2 ** (attempt - 1), undefined, { signal })
        }
      }
    }

    throw lastError
  }

  private async getJson(url: URL, label: string, signal?: AbortSignal): Promise<unknown> {
    const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs)
    const response = await this.fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
    })

    if (!response.ok) {
      throw new Error(`BMA ${label} failed with status ${response.status}`)
    }

    return response.json()
  }

  private async search(
    url: URL,
    signal?: AbortSignal,
  ): Promise<{ total: number; hasNextPage: boolean; projects: BmaProject[]; skipped: number }> {
    const parsed = responseSchema.safeParse(await this.getJson(url, 'project search', signal))
    if (!parsed.success) {
      throw new Error('BMA returned an invalid project-search response')
    }

    const projects: BmaProject[] = []
    for (const row of parsed.data.data) {
      const project = projectSchema.safeParse(row)
      if (project.success) {
        projects.push(project.data)
      }
    }

    return {
      total: parsed.data.totalCount,
      hasNextPage: parsed.data.hasNextPage,
      projects,
      skipped: parsed.data.data.length - projects.length,
    }
  }

  private async requestDetail(projectId: string, signal?: AbortSignal): Promise<BmaProjectDetail> {
    const url = new URL(BMA_PROJECT_DETAIL_URL)
    url.searchParams.set('projectId', projectId)

    const parsed = detailSchema.safeParse(await this.getJson(url, 'project detail', signal))
    if (!parsed.success) {
      throw new Error('BMA returned an invalid project-detail response')
    }

    return parsed.data
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await map(items[index]!)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

function toProjectDetails(project: BmaProject, detail: BmaProjectDetail | null): BmaProjectDetails {
  return {
    sourceProjectId: project.projectId!,
    midPriceBaht: detail?.projectAverageBudget ?? null,
    contractStatus: detail?.masterContractAvailableName ?? null,
    contractStatusCode:
      detail?.masterContractAvailableCode ?? project.masterContractAvailableCode ?? null,
  }
}

function toDiscoveredProject(
  project: BmaProject,
  budgetYear: number,
  detail: BmaProjectDetail | null,
): DiscoveredProcurementProject {
  return {
    externalId: project.projectNumber,
    title: project.projectName,
    fiscalYear: budgetYear,
    metadata: {
      title: project.projectName,
      departmentName: project.masterOrgGroupName,
      departmentSubName: project.masterOrgDepartmentName,
      projectStatus: INVITATION_STATUS,
      sourceProjectId: project.projectId,
      contractStatus: detail?.masterContractAvailableName ?? null,
      contractStatusCode:
        detail?.masterContractAvailableCode ?? project.masterContractAvailableCode ?? null,
      fiscalYear: budgetYear,
      announceDate: null,
      budgetBaht: project.projectBudget,
      midPriceBaht: detail?.projectAverageBudget ?? null,
      awardedPriceBaht: null,
    },
  }
}
