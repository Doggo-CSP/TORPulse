import { z } from 'zod'

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

export const updateInterestsSchema = z.object({
  interests: z.array(z.string().trim()),
})
