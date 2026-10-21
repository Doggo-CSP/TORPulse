import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'

import { database } from '../../config/mongoose.js'
import { User } from '../auth/user.model.js'
import { BidderProfileModel } from './bidder-profile.model.js'
import router from './user.routes.js'

const SEED_PREFIX = 'seed-bidder-profile-routes-test-'

test('bidder profile routes: organization, team, projects and derived qualification', async (t) => {
  await database.connect()

  const testUser = await User.create({
    googleId: `${SEED_PREFIX}google-id`,
    name: 'Bidder Test User',
    email: `${SEED_PREFIX}user@example.com`,
    image: null,
  })

  t.after(async () => {
    await BidderProfileModel.deleteMany({ userId: testUser._id })
    await User.deleteOne({ _id: testUser._id })
    await database.disconnect()
  })

  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = {
      _id: testUser._id,
      googleId: testUser.googleId,
      name: testUser.name,
      email: testUser.email,
      image: testUser.image,
    }
    next()
  })
  app.use('/user', router)

  await t.test(
    'GET /user/bidder-profile returns an empty profile before anything is saved',
    async () => {
      const response = await request(app).get('/user/bidder-profile')

      assert.equal(response.status, 200)
      assert.equal(response.body.bidderProfile.accountType, 'personal')
      assert.equal(response.body.bidderProfile.self, null)
      assert.deepEqual(response.body.bidderProfile.team, [])
      assert.equal(response.body.bidderProfile.derivedQualification, null)
      assert.equal(response.body.bidderProfile.completeness.isComplete, false)
    },
  )

  await t.test('GET /user/bidder-profile/options lists the dropdown keys', async () => {
    const response = await request(app).get('/user/bidder-profile/options')

    assert.equal(response.status, 200)
    assert.ok(response.body.staffRoles.includes('project_manager'))
    assert.ok(response.body.personCertifications.includes('pmp'))
    assert.ok(response.body.orgCertifications.includes('other'))
  })

  await t.test('PUT /user/bidder-profile/self saves an individual bidder', async () => {
    const response = await request(app)
      .put('/user/bidder-profile/self')
      .send({
        positionTitle: 'Freelance developer',
        roles: ['developer', 'developer'],
        yearsExperience: 4,
        education: [{ level: 'bachelor', field: 'Computer Engineering' }],
        certifications: [{ key: 'aws_certified', expiresAt: '2099-01-01' }],
      })

    assert.equal(response.status, 200)
    const profile = response.body.bidderProfile
    assert.deepEqual(profile.self.roles, ['developer'])
    assert.equal(profile.self.certifications[0].expiresAt, '2099-01-01')
    assert.equal(profile.derivedQualification.isThaiJuristicPerson, false)
    assert.deepEqual(profile.derivedQualification.staffRoles, ['developer'])
  })

  await t.test('company-only routes are refused for a personal account', async () => {
    const response = await request(app)
      .post('/user/bidder-profile/team')
      .send({ roles: ['developer'] })

    assert.equal(response.status, 409)
  })

  await t.test('switching to company re-derives users.qualification', async () => {
    const response = await request(app).put('/user/profile').send({ accountType: 'company' })

    assert.equal(response.status, 200)
    assert.equal(response.body.user.qualification.isThaiJuristicPerson, true)
    // An individual's own roles do not count for a company
    assert.deepEqual(response.body.user.qualification.staffRoles, [])
  })

  await t.test('PUT /user/bidder-profile/organization merges partial updates', async () => {
    await request(app)
      .put('/user/bidder-profile/organization')
      .send({ juristicType: 'company_limited', registeredCapitalBaht: 5_000_000 })

    const response = await request(app)
      .put('/user/bidder-profile/organization')
      .send({
        registeredDate: '2020-01-15',
        isSme: true,
        certifications: [{ key: 'iso27001' }],
      })

    assert.equal(response.status, 200)
    const { organization, derivedQualification } = response.body.bidderProfile
    assert.equal(organization.juristicType, 'company_limited')
    assert.equal(organization.registeredCapitalBaht, 5_000_000)
    assert.equal(organization.registeredDate, '2020-01-15')
    assert.equal(derivedQualification.registeredCapitalBaht, 5_000_000)
    assert.deepEqual(derivedQualification.certifications, ['iso27001'])
    assert.ok(derivedQualification.yearsInBusiness >= 6)
  })

  await t.test('PUT /user/bidder-profile/organization rejects bad input', async () => {
    const otherWithoutName = await request(app)
      .put('/user/bidder-profile/organization')
      .send({ certifications: [{ key: 'other' }] })
    assert.equal(otherWithoutName.status, 400)

    const personCertOnCompany = await request(app)
      .put('/user/bidder-profile/organization')
      .send({ certifications: [{ key: 'pmp' }] })
    assert.equal(personCertOnCompany.status, 400)

    const badDate = await request(app)
      .put('/user/bidder-profile/organization')
      .send({ registeredDate: '15/01/2020' })
    assert.equal(badDate.status, 400)
  })

  let memberId = ''
  let projectId = ''

  await t.test('team members can be added, updated and linked to projects', async () => {
    const added = await request(app)
      .post('/user/bidder-profile/team')
      .send({
        fullName: 'A',
        positionTitle: 'Project Manager',
        roles: ['project_manager'],
        yearsExperience: 8,
        certifications: [{ key: 'pmp', issuer: 'PMI' }],
      })
    assert.equal(added.status, 201)
    memberId = added.body.bidderProfile.team[0].id

    const updated = await request(app)
      .patch(`/user/bidder-profile/team/${memberId}`)
      .send({ roles: ['project_manager', 'system_analyst'] })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.bidderProfile.team[0].fullName, 'A')
    assert.deepEqual(updated.body.bidderProfile.derivedQualification.staffRoles, [
      'project_manager',
      'system_analyst',
    ])

    const project = await request(app)
      .post('/user/bidder-profile/projects')
      .send({
        name: 'ระบบสารสนเทศ',
        clientName: 'กรุงเทพมหานคร',
        clientType: 'government',
        contractValueBaht: 3_500_000,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        role: 'prime',
        categories: ['web_application'],
        memberIds: [memberId],
      })
    assert.equal(project.status, 201)
    projectId = project.body.bidderProfile.projects[0].id
    assert.equal(
      project.body.bidderProfile.derivedQualification.maxPastContractValueBaht,
      3_500_000,
    )
    assert.equal(project.body.bidderProfile.completeness.missing.includes('projects'), false)
  })

  await t.test('projects reject unknown members and dates out of order', async () => {
    const unknownMember = await request(app)
      .post('/user/bidder-profile/projects')
      .send({ name: 'X', memberIds: ['0123456789abcdef01234567'] })
    assert.equal(unknownMember.status, 400)

    const endBeforeStart = await request(app)
      .patch(`/user/bidder-profile/projects/${projectId}`)
      .send({ startDate: '2025-06-01' })
    assert.equal(endBeforeStart.status, 400)

    const missing = await request(app)
      .patch('/user/bidder-profile/projects/0123456789abcdef01234567')
      .send({ name: 'Y' })
    assert.equal(missing.status, 404)
  })

  await t.test('removing a team member also unlinks them from projects', async () => {
    const response = await request(app).delete(`/user/bidder-profile/team/${memberId}`)

    assert.equal(response.status, 200)
    assert.deepEqual(response.body.bidderProfile.team, [])
    assert.deepEqual(response.body.bidderProfile.projects[0].memberIds, [])
    assert.deepEqual(response.body.bidderProfile.derivedQualification.staffRoles, [])
  })

  await t.test('removing the last project clears the past-work qualification', async () => {
    const response = await request(app).delete(`/user/bidder-profile/projects/${projectId}`)

    assert.equal(response.status, 200)
    assert.equal(response.body.bidderProfile.derivedQualification.maxPastContractValueBaht, null)

    const stored = await User.findById(testUser._id).lean()
    assert.equal(stored?.qualification?.maxPastContractValueBaht, null)
  })
})
