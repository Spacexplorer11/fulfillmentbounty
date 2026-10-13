import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { fakeServices, NO_ENV, stubFetch, TEST_CASES, TEST_ENV, withEnv } from '../testing.ts'
import { computeStats } from './cases.ts'
import { readStored, writeStored } from './store.ts'

const NOW = new Date('2026-09-28T16:00:00Z')
const stats = computeStats(TEST_CASES, NOW)

describe('readStored', () => {
  it('returns null without a connection string and never asks the network', async (t) => {
    withEnv(t, NO_ENV)
    let calls = stubFetch(t, fakeServices())

    assert.equal(await readStored(), null)
    assert.equal(calls.length, 0)
  })

  it('returns the stats the cron job stored', async (t) => {
    withEnv(t, TEST_ENV)
    let calls = stubFetch(t, fakeServices({ stored: stats }))

    assert.deepEqual(await readStored(), stats)
    assert.equal(calls[0].url.href, 'https://global-config.vercel.com/ecfg_test/item/dashboard?version=1')
  })

  it('ignores a copy written in a different shape', async (t) => {
    withEnv(t, TEST_ENV)
    stubFetch(t, () => Response.json({ version: 99, stats }))

    assert.equal(await readStored(), null)
  })

  it('returns null when nothing has been stored yet', async (t) => {
    withEnv(t, TEST_ENV)
    stubFetch(t, fakeServices({ stored: null }))

    assert.equal(await readStored(), null)
  })

  it('returns null and logs when Global Config is unreachable', async (t) => {
    withEnv(t, TEST_ENV)
    let log = t.mock.method(console, 'error', () => {})
    stubFetch(t, () => new Response('{}', { status: 500 }))

    assert.equal(await readStored(), null)
    assert.equal(log.mock.calls.length, 1)
  })
})

describe('writeStored', () => {
  it('upserts the dashboard through the Vercel REST API', async (t) => {
    withEnv(t, TEST_ENV)
    let calls = stubFetch(t, fakeServices())

    await writeStored(stats)

    assert.equal(calls.length, 1)
    assert.equal(
      calls[0].url.href,
      'https://api.vercel.com/v1/global-config/ecfg_test/items?teamId=team_test',
    )
    assert.equal(calls[0].init?.method, 'PATCH')
    assert.deepEqual(calls[0].init?.headers, {
      Authorization: 'Bearer test-write-token',
      'Content-Type': 'application/json',
    })
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      items: [{ operation: 'upsert', key: 'dashboard', value: { version: 1, stats } }],
    })
  })

  it('needs a write token, because the read token in the connection string cannot write', async (t) => {
    withEnv(t, { ...TEST_ENV, GLOBAL_CONFIG_WRITE_TOKEN: undefined })
    let calls = stubFetch(t, fakeServices())

    await assert.rejects(() => writeStored(stats), /GLOBAL_CONFIG_WRITE_TOKEN/)
    assert.equal(calls.length, 0)
  })

  it('throws when Vercel rejects the write', async (t) => {
    withEnv(t, TEST_ENV)
    stubFetch(t, fakeServices({ writeStatus: 403 }))

    await assert.rejects(() => writeStored(stats), /403/)
  })
})
