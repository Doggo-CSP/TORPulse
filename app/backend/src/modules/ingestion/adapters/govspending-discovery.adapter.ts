import { setTimeout as delay } from 'node:timers/promises'

import { z } from 'zod'

const GOVSPENDING_SERVICE_URL = 'https://opend.data.go.th/govspending/service/egp-contract'
const PROJECT_ID_PATTERN = /^\d{11}$/
const MAX_REQUEST_ATTEMPTS = 3

const projectSchema = z.object({
  project_id: z.string().regex(PROJECT_ID_PATTERN),
  project_name: z.string().min(1),
  year: z.coerce.number().int(),
})

const responseSchema = z.object({
  success: z.literal(true),
  total: z.coerce.number().int().nonnegative(),
  data: z.array(projectSchema),
})

export interface DiscoveredProcurementProject {
  externalId: string
  title: string
  fiscalYear: number
}

export interface GovSpendingPage {
  total: number
  projects: DiscoveredProcurementProject[]
}

export interface ListGovSpendingProjectsInput {
  fiscalYear: number
  keyword: string
  offset: number
  limit: number
  signal?: AbortSignal
}

export interface GovSpendingDiscoveryAdapterOptions {
  apiKey: string
  fetchImpl?: typeof fetch
  requestTimeoutMs?: number
}

export function getThaiFiscalYear(date = new Date()): number {
  return date.getUTCFullYear() + (date.getUTCMonth() >= 9 ? 544 : 543)
}

export class GovSpendingDiscoveryAdapter {
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly requestTimeoutMs: number

  public constructor(options: GovSpendingDiscoveryAdapterOptions) {
    if (!options.apiKey.trim()) {
      throw new Error('GOVSPENDING_API_KEY is required')
    }

    this.apiKey = options.apiKey
    this.fetchImpl = options.fetchImpl ?? fetch
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000
  }

  public async listProjects(input: ListGovSpendingProjectsInput): Promise<GovSpendingPage> {
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

  private async requestPage(input: ListGovSpendingProjectsInput): Promise<GovSpendingPage> {
    const url = new URL(GOVSPENDING_SERVICE_URL)
    url.searchParams.set('api-key', this.apiKey)
    url.searchParams.set('year', String(input.fiscalYear))
    url.searchParams.set('keyword', input.keyword)
    url.searchParams.set('offset', String(input.offset))
    url.searchParams.set('limit', String(input.limit))

    const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs)
    const signal = input.signal ? AbortSignal.any([input.signal, timeoutSignal]) : timeoutSignal
    const response = await this.fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal,
    })

    if (!response.ok) {
      throw new Error(`GovSpending request failed with status ${response.status}`)
    }

    const parsed = responseSchema.safeParse(await response.json())
    if (!parsed.success) {
      throw new Error('GovSpending returned an invalid project-list response')
    }

    return {
      total: parsed.data.total,
      projects: parsed.data.data.map((project) => ({
        externalId: project.project_id,
        title: project.project_name,
        fiscalYear: project.year,
      })),
    }
  }
}
