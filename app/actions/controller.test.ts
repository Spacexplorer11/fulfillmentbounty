import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { computeStats } from '../data/cases.ts'
import { router } from '../router.ts'
import { routes } from '../routes.ts'
import { fakeServices, NO_ENV, stubFetch, TEST_CASES, TEST_ENV, withEnv } from '../testing.ts'

const get = (href: string, headers: Record<string, string> = {}) =>
  router.fetch(new Request(new URL(href, 'http://localhost'), { headers }))

describe('root controller', () => {
  // With nothing configured the loader serves the saved snapshot, so these run offline.
  it('GET / renders the dashboard as a script-free page', async (t) => {
    withEnv(t, NO_ENV)

    let response = await get(routes.home.href())
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/)
    assert.match(html, /<h1>Fulfillment Bounty tracker<\/h1>/)
    assert.match(html, /7-business-day<\/span> promise/)
    assert.match(html, /saved copy/)
    assert.doesNotMatch(html, /<script/)
    assert.match(html, /name="color-scheme" content="dark"/)
    assert.match(html, /\/fonts\/lexend-latin\.woff2/)
    assert.match(response.headers.get('Content-Security-Policy') ?? '', /font-src 'self'/)
    assert.match(response.headers.get('Content-Security-Policy') ?? '', /default-src 'none'/)
  })

  it('GET /stats.json publishes aggregate counts only', async (t) => {
    withEnv(t, NO_ENV)

    let response = await get(routes.stats.href())
    let body = (await response.json()) as Record<string, unknown>

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
    assert.equal(body.source, 'snapshot')
    assert.deepEqual(Object.keys(body).sort(), [
      'asOf',
      'byStatus',
      'lastWeek',
      'oldestOpen',
      'openAges',
      'overdue',
      'since',
      'slaBusinessDays',
      'source',
      'thisWeek',
      'totals',
      'weekly',
    ])
    assert.doesNotMatch(JSON.stringify(body), /createdAt|@|macondo/)
  })

  it('caches a saved snapshot only briefly', async (t) => {
    withEnv(t, NO_ENV)

    let response = await get(routes.home.href())

    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=0, s-maxage=30')
  })

  it('serves the cron job’s stored numbers with the long CDN cache', async (t) => {
    withEnv(t, TEST_ENV)
    let stored = computeStats(TEST_CASES, new Date('2026-09-28T16:00:00Z'))
    stubFetch(t, fakeServices({ stored }))

    let response = await get(routes.stats.href())
    let body = (await response.json()) as { source: string; totals: { all: number } }

    assert.equal(body.source, 'global-config')
    assert.equal(body.totals.all, 3)
    assert.match(response.headers.get('Cache-Control') ?? '', /s-maxage=300, stale-while-revalidate=3600/)
  })
})

describe('cron refresh', () => {
  const authorized = { Authorization: `Bearer ${TEST_ENV.CRON_SECRET}` }

  it('rejects a request without the secret and does no work', async (t) => {
    withEnv(t, TEST_ENV)
    let calls = stubFetch(t, fakeServices())

    let response = await get(routes.refresh.href())

    assert.equal(response.status, 401)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(calls.length, 0)
  })

  it('rejects the wrong secret', async (t) => {
    withEnv(t, TEST_ENV)
    let calls = stubFetch(t, fakeServices())

    let response = await get(routes.refresh.href(), { Authorization: 'Bearer not-the-secret' })

    assert.equal(response.status, 401)
    assert.equal(calls.length, 0)
  })

  it('stays closed when no secret is configured, whatever the request sends', async (t) => {
    withEnv(t, { ...TEST_ENV, CRON_SECRET: undefined })
    let calls = stubFetch(t, fakeServices())

    for (let sent of ['Bearer undefined', 'Bearer ', '']) {
      let response = await get(routes.refresh.href(), { Authorization: sent })
      assert.equal(response.status, 401)
    }
    assert.equal(calls.length, 0)
  })

  it('refreshes the stored dashboard for Vercel Cron', async (t) => {
    withEnv(t, TEST_ENV)
    let calls = stubFetch(t, fakeServices({ stored: null }))

    let response = await get(routes.refresh.href(), authorized)
    let body = (await response.json()) as { ok: boolean; wrote: boolean; totals: { all: number } }

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.deepEqual([body.ok, body.wrote, body.totals.all], [true, true, 3])
    assert.equal(calls.filter((call) => call.init?.method === 'PATCH').length, 1)
  })

  it('reports a failed refresh without leaking anything sensitive', async (t) => {
    withEnv(t, { ...TEST_ENV, GLOBAL_CONFIG_WRITE_TOKEN: undefined })
    t.mock.method(console, 'error', () => {})
    stubFetch(t, fakeServices({ stored: null }))

    let response = await get(routes.refresh.href(), authorized)
    let body = (await response.json()) as { ok: boolean; error: string }

    assert.equal(response.status, 500)
    assert.equal(body.ok, false)
    assert.match(body.error, /GLOBAL_CONFIG_WRITE_TOKEN is not set/)
    assert.doesNotMatch(JSON.stringify(body), /test-cron-secret|test-airtable-token|test-read-token/)
  })
})
