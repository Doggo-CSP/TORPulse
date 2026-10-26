import type { z } from 'zod'

import type {
  createProjectSchema,
  organizationSchema,
  personSchema,
  updateProjectSchema,
} from './bidder-profile.validation.js'

export type PersonInput = z.output<typeof personSchema>
export type OrganizationInput = z.output<typeof organizationSchema>
export type CreateProjectInput = z.output<typeof createProjectSchema>
export type UpdateProjectInput = z.output<typeof updateProjectSchema>
