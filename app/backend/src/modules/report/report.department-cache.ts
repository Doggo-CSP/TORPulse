import { TorModel } from '../tor/tor.model.js'
import { UNKNOWN_DEPARTMENT_LABEL } from './report.constants.js'

const TTL_MS = 60 * 60 * 1000

let cache: { values: string[]; hasUnknown: boolean; expiresAt: number } | null = null

async function loadDepartments(): Promise<{ values: string[]; hasUnknown: boolean }> {
  const [distinctAgencyNames, hasUnknown] = await Promise.all([
    TorModel.distinct('agencyName', { awardedPriceBaht: { $ne: null } }),
    TorModel.exists({
      awardedPriceBaht: { $ne: null },
      $or: [{ agencyName: null }, { agencyName: '' }],
    }).then((doc) => doc !== null),
  ])

  const values = (distinctAgencyNames as (string | null)[])
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .sort((a, b) => a.localeCompare(b))

  return { values, hasUnknown }
}

export async function getKnownDepartments(): Promise<string[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.hasUnknown ? [...cache.values, UNKNOWN_DEPARTMENT_LABEL] : cache.values
  }

  const { values, hasUnknown } = await loadDepartments()
  cache = { values, hasUnknown, expiresAt: Date.now() + TTL_MS }
  return hasUnknown ? [...values, UNKNOWN_DEPARTMENT_LABEL] : values
}

export async function isKnownDepartment(agencyName: string): Promise<boolean> {
  if (agencyName === UNKNOWN_DEPARTMENT_LABEL) return true
  const known = await getKnownDepartments()
  return known.includes(agencyName)
}

export function agencyNameMatchForDepartment(agencyName: string): Record<string, unknown> {
  if (agencyName === UNKNOWN_DEPARTMENT_LABEL) {
    return { $or: [{ agencyName: null }, { agencyName: '' }] }
  }
  return { agencyName }
}
