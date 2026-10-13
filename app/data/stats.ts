import { fetchCases } from './airtable.ts'
import { computeStats, type DashboardStats } from './cases.ts'
import { SNAPSHOT, SNAPSHOT_AT } from './snapshot.ts'
import { readStored } from './store.ts'

export interface Dashboard {
  stats: DashboardStats
  /**
   * `global-config` is the normal case: the cron job's precomputed numbers. `airtable` means they
   * were computed on the spot, and `snapshot` means Airtable was unconfigured or unreachable and
   * saved numbers are showing.
   */
  source: 'global-config' | 'airtable' | 'snapshot'
}

/** Page views read what the cron job stored; nothing else is consulted unless that is unavailable. */
export async function getDashboard(): Promise<Dashboard> {
  let stored = await readStored()
  return stored ? { stats: stored, source: 'global-config' } : getLiveDashboard()
}

// The fallback for local development, a store that hasn't been filled yet, and a failed read. The
// CDN in front of the app caches pages for minutes; this keeps a burst of misses from each hitting
// Airtable (5 requests/second per base) and lets one refresh serve concurrent callers.
const FRESH_MS = 60_000

let cached: (Dashboard & { loadedAt: number }) | undefined
let inflight: Promise<Dashboard> | undefined

async function getLiveDashboard(): Promise<Dashboard> {
  let token = process.env.AIRTABLE_TOKEN
  if (!token) return snapshotDashboard()

  if (cached && Date.now() - cached.loadedAt < FRESH_MS) return cached

  inflight ??= load(token).finally(() => (inflight = undefined))
  try {
    return await inflight
  } catch (error) {
    console.error('Refreshing from Airtable failed', error)
    return cached ?? snapshotDashboard()
  }
}

async function load(token: string): Promise<Dashboard> {
  cached = { stats: computeStats(await fetchCases(token)), source: 'airtable', loadedAt: Date.now() }
  return cached
}

const snapshotDashboard = (): Dashboard => ({
  stats: computeStats(SNAPSHOT.map(([createdAt, status]) => ({ createdAt, status })), new Date(SNAPSHOT_AT)),
  source: 'snapshot',
})
