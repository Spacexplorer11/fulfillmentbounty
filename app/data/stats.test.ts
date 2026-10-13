import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { fakeServices, NO_ENV, stubFetch, TEST_CASES, TEST_ENV, withEnv } from '../testing.ts'
import { computeStats } from './cases.ts'
import { getDashboard } from './stats.ts'

const airtableCalls = (calls: { url: URL }[]) =>
  calls.filter((call) => call.url.hostname === 'api.airtable.com')

// These run in order and share the module's cache of live results: the fallback case has to come
// before the case that populates it.
describe('getDashboard', () => {
  it('serves what the cron job stored without asking Airtable', async (t) => {
    withEnv(t, TEST_ENV)
    let stored = computeStats(TEST_CASES, new Date('2026-09-28T16:00:00Z'))
    let calls = stubFetch(t, fakeServices({ stored }))

    let dashboard = await getDashboard()

    assert.equal(dashboard.source, 'global-config')
    assert.deepEqual(dashboard.stats, stored)
    assert.equal(airtableCalls(calls).length, 0)
  })

  it('serves the saved snapshot when nothing is configured', async (t) => {
    withEnv(t, NO_ENV)

    let { source, stats } = await getDashboard()

    assert.equal(source, 'snapshot')
    assert.equal(stats.totals.all, 133)
    assert.equal(stats.asOf, '2026-09-28T22:00:00.000Z')
  })

  it('falls back to the snapshot when Airtable fails and nothing is cached', async (t) => {
    withEnv(t, { ...NO_ENV, AIRTABLE_TOKEN: 'test-airtable-token' })
    t.mock.method(console, 'error', () => {})
    stubFetch(t, () => new Response('{}', { status: 500 }))

    let { source } = await getDashboard()

    assert.equal(source, 'snapshot')
  })

  it('asks Airtable directly when the store is empty, and reuses the answer', async (t) => {
    withEnv(t, TEST_ENV)
    let calls = stubFetch(t, fakeServices({ stored: null }))

    let first = await getDashboard()
    let second = await getDashboard()

    assert.equal(first.source, 'airtable')
    assert.equal(first.stats.totals.all, 3)
    assert.equal(second.stats.totals.all, 3)
    assert.equal(airtableCalls(calls).length, 1)
  })
})
