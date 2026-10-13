import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { stubFetch } from '../testing.ts'
import { fetchCases } from './airtable.ts'

const STATUS_FIELD = 'fldelkdJ0nhMei58I'

function page(records: { createdTime: string; status?: unknown }[], offset?: string) {
  return Response.json({
    records: records.map(({ createdTime, status }) => ({
      id: 'recTest',
      createdTime,
      fields: status === undefined ? {} : { [STATUS_FIELD]: status },
    })),
    offset,
  })
}

describe('fetchCases', () => {
  it('reads every page and requests only the status field', async (t) => {
    let responses = [
      page(
        [
          { createdTime: '2026-09-01T12:00:00.000Z', status: 'Resolved' },
          { createdTime: '2026-09-02T12:00:00.000Z' },
        ],
        'itrNextPage',
      ),
      page([{ createdTime: '2026-09-03T12:00:00.000Z', status: 42 }]),
    ]
    let calls = stubFetch(t, () => responses.shift()!)

    let cases = await fetchCases('test-token')

    assert.deepEqual(cases, [
      { createdAt: '2026-09-01T12:00:00.000Z', status: 'Resolved' },
      { createdAt: '2026-09-02T12:00:00.000Z', status: null },
      { createdAt: '2026-09-03T12:00:00.000Z', status: null },
    ])
    assert.equal(calls.length, 2)
    for (let { url, init } of calls) {
      assert.deepEqual(url.searchParams.getAll('fields[]'), [STATUS_FIELD])
      assert.deepEqual(init?.headers, { Authorization: 'Bearer test-token' })
    }
    assert.equal(calls[0].url.searchParams.get('offset'), null)
    assert.equal(calls[1].url.searchParams.get('offset'), 'itrNextPage')
  })

  it('throws when Airtable rejects the request', async (t) => {
    stubFetch(t, () => new Response('{}', { status: 401 }))

    await assert.rejects(() => fetchCases('bad-token'), /401/)
  })
})
