import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { fakeServices, stubFetch, TEST_CASES, TEST_ENV, withEnv } from '../testing.ts'
import { computeStats } from './cases.ts'
import { refreshDashboard } from './refresh.ts'

const NOW = new Date('2026-09-28T16:00:00Z')
const minutesBefore = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000)
const writes = (calls: { init?: RequestInit }[]) => calls.filter((call) => call.init?.method === 'PATCH')

describe('refreshDashboard', () => {
  it('stores the dashboard when nothing is stored yet', async (t) => {
    withEnv(t, TEST_ENV)
    let calls = stubFetch(t, fakeServices({ stored: null }))

    let result = await refreshDashboard(NOW)

    assert.equal(result.wrote, true)
    assert.equal(result.asOf, NOW.toISOString())
    assert.deepEqual(result.totals, { all: 3, open: 2, resolved: 1, ineligible: 0 })
    let body = JSON.parse(String(writes(calls)[0].init?.body))
    assert.deepEqual(body.items[0].value.stats, computeStats(TEST_CASES, NOW))
  })

  it('leaves an unchanged, recent copy alone', async (t) => {
    withEnv(t, TEST_ENV)
    let calls = stubFetch(t, fakeServices({ stored: computeStats(TEST_CASES, minutesBefore(5)) }))

    let result = await refreshDashboard(NOW)

    assert.equal(result.wrote, false)
    assert.equal(writes(calls).length, 0)
  })

  it('rewrites an unchanged copy once it is an hour old, so "Updated" stays honest', async (t) => {
    withEnv(t, TEST_ENV)
    let calls = stubFetch(t, fakeServices({ stored: computeStats(TEST_CASES, minutesBefore(61)) }))

    let result = await refreshDashboard(NOW)

    assert.equal(result.wrote, true)
    assert.equal(writes(calls).length, 1)
  })

  it('rewrites when the numbers changed', async (t) => {
    withEnv(t, TEST_ENV)
    let calls = stubFetch(t, fakeServices({ stored: computeStats(TEST_CASES.slice(1), minutesBefore(5)) }))

    let result = await refreshDashboard(NOW)

    assert.equal(result.wrote, true)
    assert.equal(writes(calls).length, 1)
  })

  it('fails without an Airtable token', async (t) => {
    withEnv(t, { ...TEST_ENV, AIRTABLE_TOKEN: undefined })
    let calls = stubFetch(t, fakeServices())

    await assert.rejects(() => refreshDashboard(NOW), /AIRTABLE_TOKEN/)
    assert.equal(calls.length, 0)
  })

  it('surfaces a failed write so the cron run shows as failed', async (t) => {
    withEnv(t, TEST_ENV)
    stubFetch(t, fakeServices({ stored: null, writeStatus: 403 }))

    await assert.rejects(() => refreshDashboard(NOW), /403/)
  })
})
