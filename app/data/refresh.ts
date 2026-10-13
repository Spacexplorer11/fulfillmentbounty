import { fetchCases } from './airtable.ts'
import { computeStats, type DashboardStats } from './cases.ts'
import { readStored, writeStored } from './store.ts'

// Global Config is built for many reads and few writes, so a run that finds the same numbers
// leaves the stored copy alone. It still rewrites once an hour so the "Updated" time on the page
// stays honest when nothing has changed.
const HEARTBEAT_MS = 60 * 60_000

export interface RefreshResult {
  wrote: boolean
  asOf: string
  totals: DashboardStats['totals']
}

/**
 * Reads the latest cases, computes the dashboard, and stores it for the page to read. Every run
 * recomputes from scratch, so a missed or duplicated cron delivery can't leave it wrong.
 */
export async function refreshDashboard(now: Date = new Date()): Promise<RefreshResult> {
  let token = process.env.AIRTABLE_TOKEN
  if (!token) throw new Error('AIRTABLE_TOKEN is not set')

  let stats = computeStats(await fetchCases(token), now)
  let s = await readStored()
  let wrote = !s || numbers(s) !== numbers(stats) || now.getTime() - Date.parse(s.asOf) >= HEARTBEAT_MS

  if (wrote) await writeStored(stats)
  return { wrote, asOf: stats.asOf, totals: stats.totals }
}

const numbers = (s: DashboardStats) => JSON.stringify({ ...s, asOf: '' })
