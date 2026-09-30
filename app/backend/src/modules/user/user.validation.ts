import { z } from 'zod'

import { CATEGORY_KEYS } from '../category/category.constants.js'

export const updateProfileSchema = z.object({
  accountType: z.enum(['personal', 'company', 'agency']).optional(),
  displayName: z.string().trim().optional(),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  jobTitle: z.string().trim().optional(),
  contactEmail: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  image: z.string().trim().optional(),
  address: z.string().trim().optional(),
  about: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
  businessType: z.string().trim().optional(),
  agencyName: z.string().trim().optional(),
  agencyType: z.string().trim().optional(),
  website: z.string().trim().optional(),
})

// TODO(QUESTION-4): the profile page still sends its own ids ("web", "ai", ...); those are now
// rejected until it switches to GET /categories keys; see QUESTIONS.md
export const updateInterestsSchema = z.object({
  interests: z.array(z.enum(CATEGORY_KEYS)),
})
