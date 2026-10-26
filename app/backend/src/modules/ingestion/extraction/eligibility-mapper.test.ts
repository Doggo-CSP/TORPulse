import assert from 'node:assert/strict'
import test from 'node:test'

import { buildEligibilityPrompt, mapEligibility, parseEligibility } from './eligibility-mapper.js'

test('parses eligibility and moves unknown keys to unmapped', () => {
  const eligibility = parseEligibility(
    JSON.stringify({
      minRegisteredCapitalBaht: 5_000_000,
      minYearsInBusiness: null,
      requiredCertifications: ['iso27001', 'made_up_cert'],
      requiresThaiJuristicPerson: true,
      requiresPositiveNetWorth: true,
      maxPastWorkAgeYears: 3,
      requiredStaffRoles: ['project_manager', 'project_manager', 'astronaut'],
      unmappedQualifications: null,
    }),
  )

  assert.deepEqual(eligibility, {
    minRegisteredCapitalBaht: 5_000_000,
    minYearsInBusiness: null,
    minPastContractValueBaht: null,
    requiredCertifications: ['iso27001'],
    requiresThaiJuristicPerson: true,
    smeOnly: null,
    requiresPositiveNetWorth: true,
    maxPastWorkAgeYears: 3,
    requiresBangkokOffice: null,
    requiredStaffRoles: ['project_manager'],
    unmappedQualifications: ['certification: made_up_cert', 'staff role: astronaut'],
  })
})

test('rejects invalid JSON', () => {
  assert.throws(() => parseEligibility('not json'), /invalid JSON/)
})

test('returns null without calling the LLM when there are no qualifications', async () => {
  assert.equal(await mapEligibility([]), null)
  assert.equal(await mapEligibility(['  ']), null)
})

test('prompt lists the keys and the clauses to leave out', () => {
  const prompt = buildEligibilityPrompt()

  assert.match(prompt, /iso27001/)
  assert.match(prompt, /project_manager/)
  assert.match(prompt, /บุคคลธรรมดา/)
  assert.match(prompt, /วงเงินสินเชื่อ/)
  assert.match(prompt, /หลักประกันการเสนอราคา/)
})
