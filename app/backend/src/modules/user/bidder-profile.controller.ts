import type { Request, Response } from 'express'

import { enqueueForUser, enqueueInBackground } from '../notification/notification.service.js'
import {
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  JURISTIC_TYPES,
  MAX_PROJECTS,
  MAX_TEAM_MEMBERS,
  ORG_CERTIFICATION_KEYS,
  OTHER_CERTIFICATION_KEY,
  PERSON_CERTIFICATION_KEYS,
  PROJECT_CLIENT_TYPES,
  PROJECT_ROLES,
  STAFF_ROLE_KEYS,
} from './bidder-profile.constants.js'
import type {
  BidderProfileDocument,
  CertificationRecord,
  PastProjectRecord,
  PersonRecord,
} from './bidder-profile.model.js'
import { deriveQualification, profileCompleteness } from './bidder-profile.qualification.js'
import {
  findBidderProfile,
  findOrCreateBidderProfile,
  findProject,
  findTeamMember,
  syncDerivedQualification,
} from './bidder-profile.repository.js'
import {
  createProjectSchema,
  organizationSchema,
  personSchema,
  updateProjectSchema,
} from './bidder-profile.validation.js'
import { findUserById } from './user.repository.js'

type UserDocument = NonNullable<Awaited<ReturnType<typeof findUserById>>>
type AccountType = 'personal' | 'company'

const toDateString = (date: Date | null | undefined) =>
  date ? date.toISOString().slice(0, 10) : null

const toCertificationResponse = (cert: CertificationRecord) => ({
  key: cert.key,
  name: cert.name,
  issuer: cert.issuer,
  issuedAt: toDateString(cert.issuedAt),
  expiresAt: toDateString(cert.expiresAt),
})

const toPersonResponse = (person: PersonRecord) => ({
  id: person._id.toString(),
  fullName: person.fullName,
  positionTitle: person.positionTitle,
  roles: person.roles,
  yearsExperience: person.yearsExperience,
  employmentType: person.employmentType,
  education: person.education.map((item) => ({
    level: item.level,
    field: item.field,
    institution: item.institution,
    graduatedYear: item.graduatedYear,
  })),
  certifications: person.certifications.map(toCertificationResponse),
  skills: person.skills,
})

const toProjectResponse = (project: PastProjectRecord) => ({
  id: project._id.toString(),
  name: project.name,
  clientName: project.clientName,
  clientType: project.clientType,
  contractValueBaht: project.contractValueBaht,
  startDate: toDateString(project.startDate),
  endDate: toDateString(project.endDate),
  role: project.role,
  categories: project.categories,
  technologies: project.technologies,
  description: project.description,
  hasCompletionCertificate: project.hasCompletionCertificate,
  memberIds: project.memberIds.map((id) => id.toString()),
})

const toBidderProfileResponse = (user: UserDocument, profile: BidderProfileDocument | null) => {
  const organization = profile?.organization
  return {
    accountType: user.accountType ?? 'personal',
    organization: {
      juristicType: organization?.juristicType ?? null,
      registeredDate: toDateString(organization?.registeredDate),
      registeredCapitalBaht: organization?.registeredCapitalBaht ?? null,
      isSme: organization?.isSme ?? null,
      hasPositiveNetWorth: organization?.hasPositiveNetWorth ?? null,
      hasBangkokOffice: organization?.hasBangkokOffice ?? null,
      certifications: (organization?.certifications ?? []).map(toCertificationResponse),
    },
    self: profile?.self ? toPersonResponse(profile.self) : null,
    team: (profile?.team ?? []).map(toPersonResponse),
    projects: (profile?.projects ?? []).map(toProjectResponse),
    derivedQualification: profile ? deriveQualification(user, profile) : null,
    completeness: profileCompleteness(user, profile),
  }
}

// Only the keys the client sent, so a partial update leaves the other fields as they are.
const definedFields = <T extends object>(input: T): Partial<T> =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>

const loadUser = async (req: Request, res: Response): Promise<UserDocument | null> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  const user = await findUserById(req.user._id)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return null
  }
  return user
}

const requireAccountType = (user: UserDocument, res: Response, allowed: AccountType[]): boolean => {
  const accountType = user.accountType ?? 'personal'
  if ((allowed as string[]).includes(accountType)) return true
  res.status(409).json({
    error: `Only ${allowed.join(' or ')} accounts can edit this part of the profile (accountType is ${accountType})`,
  })
  return false
}

// After every write: refresh the derived qualification, re-check qualifying TORs (UC-07)
// and return the whole profile so the client can redraw it.
const saveAndRespond = async (
  user: UserDocument,
  profile: BidderProfileDocument,
  res: Response,
  status = 200,
): Promise<void> => {
  await profile.save()
  await syncDerivedQualification(user, profile)

  const userId = user._id
  enqueueInBackground(`user ${userId}`, () => enqueueForUser(userId))

  res.status(status).json({ bidderProfile: toBidderProfileResponse(user, profile) })
}

const unknownMemberIds = (profile: BidderProfileDocument, memberIds: string[] | undefined) =>
  (memberIds ?? []).filter((id) => !findTeamMember(profile.team, id))

export const getBidderProfileHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await loadUser(req, res)
  if (!user) return

  const profile = await findBidderProfile(user._id)
  res.json({ bidderProfile: toBidderProfileResponse(user, profile) })
}

// Choices for the profile form's dropdowns
export const getBidderProfileOptionsHandler = (_req: Request, res: Response): void => {
  res.json({
    accountTypes: ['personal', 'company'],
    juristicTypes: JURISTIC_TYPES,
    staffRoles: STAFF_ROLE_KEYS,
    orgCertifications: [...ORG_CERTIFICATION_KEYS, OTHER_CERTIFICATION_KEY],
    personCertifications: [...PERSON_CERTIFICATION_KEYS, OTHER_CERTIFICATION_KEY],
    educationLevels: EDUCATION_LEVELS,
    employmentTypes: EMPLOYMENT_TYPES,
    projectClientTypes: PROJECT_CLIENT_TYPES,
    projectRoles: PROJECT_ROLES,
    limits: { teamMembers: MAX_TEAM_MEMBERS, projects: MAX_PROJECTS },
  })
}

export const updateOrganizationHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await loadUser(req, res)
  if (!user || !requireAccountType(user, res, ['company'])) return

  const parsed = organizationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const profile = await findOrCreateBidderProfile(user._id)
  Object.assign(profile.organization, definedFields(parsed.data))
  await saveAndRespond(user, profile, res)
}

export const updateSelfHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await loadUser(req, res)
  if (!user || !requireAccountType(user, res, ['personal'])) return

  const parsed = personSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const profile = await findOrCreateBidderProfile(user._id)
  if (profile.self) {
    Object.assign(profile.self, definedFields(parsed.data))
  } else {
    profile.self = definedFields(parsed.data) as PersonRecord
  }
  await saveAndRespond(user, profile, res)
}

export const addTeamMemberHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await loadUser(req, res)
  if (!user || !requireAccountType(user, res, ['company'])) return

  const parsed = personSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const profile = await findOrCreateBidderProfile(user._id)
  if (profile.team.length >= MAX_TEAM_MEMBERS) {
    res.status(400).json({ error: `A team can have at most ${MAX_TEAM_MEMBERS} members` })
    return
  }

  profile.team.push(definedFields(parsed.data) as PersonRecord)
  await saveAndRespond(user, profile, res, 201)
}

export const updateTeamMemberHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await loadUser(req, res)
  if (!user || !requireAccountType(user, res, ['company'])) return

  const parsed = personSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const profile = await findBidderProfile(user._id)
  const member = profile && findTeamMember(profile.team, String(req.params.memberId))
  if (!profile || !member) {
    res.status(404).json({ error: 'Team member not found' })
    return
  }

  Object.assign(member, definedFields(parsed.data))
  await saveAndRespond(user, profile, res)
}

export const removeTeamMemberHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await loadUser(req, res)
  if (!user || !requireAccountType(user, res, ['company'])) return

  const memberId = String(req.params.memberId)
  const profile = await findBidderProfile(user._id)
  if (!profile || !findTeamMember(profile.team, memberId)) {
    res.status(404).json({ error: 'Team member not found' })
    return
  }

  profile.team = profile.team.filter((member) => member._id.toString() !== memberId)
  // Projects keep no reference to a member who has left the team
  for (const project of profile.projects) {
    project.memberIds = project.memberIds.filter((id) => id.toString() !== memberId)
  }
  await saveAndRespond(user, profile, res)
}

export const addProjectHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await loadUser(req, res)
  if (!user || !requireAccountType(user, res, ['personal', 'company'])) return

  const parsed = createProjectSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const profile = await findOrCreateBidderProfile(user._id)
  if (profile.projects.length >= MAX_PROJECTS) {
    res.status(400).json({ error: `A profile can have at most ${MAX_PROJECTS} projects` })
    return
  }
  const unknownIds = unknownMemberIds(profile, parsed.data.memberIds)
  if (unknownIds.length > 0) {
    res.status(400).json({ error: `Unknown team members: ${unknownIds.join(', ')}` })
    return
  }

  profile.projects.push(definedFields(parsed.data) as unknown as PastProjectRecord)
  await saveAndRespond(user, profile, res, 201)
}

export const updateProjectHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await loadUser(req, res)
  if (!user || !requireAccountType(user, res, ['personal', 'company'])) return

  const parsed = updateProjectSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const profile = await findBidderProfile(user._id)
  const project = profile && findProject(profile.projects, String(req.params.projectId))
  if (!profile || !project) {
    res.status(404).json({ error: 'Project not found' })
    return
  }
  const unknownIds = unknownMemberIds(profile, parsed.data.memberIds)
  if (unknownIds.length > 0) {
    res.status(400).json({ error: `Unknown team members: ${unknownIds.join(', ')}` })
    return
  }

  // The schema checks the dates only when both are sent; check the merged result too
  const startDate = parsed.data.startDate !== undefined ? parsed.data.startDate : project.startDate
  const endDate = parsed.data.endDate !== undefined ? parsed.data.endDate : project.endDate
  if (startDate && endDate && startDate > endDate) {
    res.status(400).json({ error: 'endDate must not be before startDate' })
    return
  }

  Object.assign(project, definedFields(parsed.data))
  await saveAndRespond(user, profile, res)
}

export const removeProjectHandler = async (req: Request, res: Response): Promise<void> => {
  const user = await loadUser(req, res)
  if (!user || !requireAccountType(user, res, ['personal', 'company'])) return

  const projectId = String(req.params.projectId)
  const profile = await findBidderProfile(user._id)
  if (!profile || !findProject(profile.projects, projectId)) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  profile.projects = profile.projects.filter((project) => project._id.toString() !== projectId)
  await saveAndRespond(user, profile, res)
}
