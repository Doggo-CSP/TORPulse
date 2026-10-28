import type { z } from 'zod'

import type {
  createProjectSchema,
  organizationSchema,
  personSchema,
  preferencesSchema,
  updateProjectSchema,
} from './bidder-profile.validation.js'

export type PersonInput = z.output<typeof personSchema>
export type OrganizationInput = z.output<typeof organizationSchema>
export type PreferencesInput = z.output<typeof preferencesSchema>
export type CreateProjectInput = z.output<typeof createProjectSchema>
export type UpdateProjectInput = z.output<typeof updateProjectSchema>
