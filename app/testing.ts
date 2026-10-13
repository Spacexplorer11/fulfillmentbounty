import type { TestContext } from 'remix/test'

import type { CaseRecord, DashboardStats } from './data/cases.ts'

/** Everything the app reads from the environment, pointed at the fake services below. */
export const TEST_ENV = {
  AIRTABLE_TOKEN: 'test-airtable-token',
  GLOBAL_CONFIG: 'https://global-config.vercel.com/ecfg_test?token=test-read-token',
  GLOBAL_CONFIG_TEAM_ID: 'team_test',
  GLOBAL_CONFIG_WRITE_TOKEN: 'test-write-token',
  CRON_SECRET: 'test-cron-secret',
}

/** The same variables with every one removed, for tests that must not see a developer's own. */
export const NO_ENV = Object.fromEntries(Object.keys(TEST_ENV).map((name) => [name, undefined]))

export const TEST_CASES: CaseRecord[] = [
  { createdAt: '2026-09-28T13:00:00.000Z', status: 'Received' },
  { createdAt: '2026-09-16T13:00:00.000Z', status: 'Notified Program Author' },
  { createdAt: '2026-08-03T13:00:00.000Z', status: 'Resolved' },
]

interface Services {
  /** What Airtable returns; defaults to TEST_CASES. */
  cases?: CaseRecord[]
  /** What Global Config holds under `dashboard`; null means nothing has been stored yet. */
  stored?: DashboardStats | null
  /** The status the Vercel API answers a write with. */
  writeStatus?: number
}

/** Answers Airtable, Global Config reads, and the Vercel write API; anything else is a bug. */
export function fakeServices({ cases = TEST_CASES, stored = null, writeStatus = 200 }: Services = {}) {
  return (url: URL): Response => {
    switch (url.hostname) {
      case 'api.airtable.com':
        return Response.json({
          records: cases.map(({ createdAt, status }) => ({
            id: 'recTest',
            createdTime: createdAt,
            fields: status === null ? {} : { fldelkdJ0nhMei58I: status },
          })),
        })
      case 'global-config.vercel.com':
        return stored
          ? Response.json({ version: 1, stats: stored })
          : new Response(null, { status: 404, headers: { 'x-edge-config-digest': 'test-digest' } })
      case 'api.vercel.com':
        return Response.json({ status: 'ok' }, { status: writeStatus })
      default:
        throw new Error(`Unexpected request to ${url}`)
    }
  }
}

/** Sets (or, given `undefined`, removes) environment variables for one test and restores them after. */
export function withEnv(t: TestContext, vars: Record<string, string | undefined>): void {
  let set = (name: string, value?: string) => (value === undefined ? delete process.env[name] : (process.env[name] = value))
  for (let [name, value] of Object.entries(vars)) {
    let previous = process.env[name]
    set(name, value)
    t.after(() => set(name, previous))
  }
}

export interface FetchCall {
  url: URL
  init?: RequestInit
}

/** Replaces `fetch` for one test, answering each request with `respond` and recording it. */
export function stubFetch(
  t: TestContext,
  respond: (url: URL, init?: RequestInit) => Response | Promise<Response>,
): FetchCall[] {
  let calls: FetchCall[] = []
  t.mock.method(globalThis, 'fetch', (async (input: URL | string, init?: RequestInit) => {
    let url = new URL(input.toString())
    calls.push({ url, init })
    return respond(url, init)
  }) as typeof fetch)
  return calls
}
