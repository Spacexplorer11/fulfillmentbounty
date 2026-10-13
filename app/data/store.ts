import { createClient } from '@vercel/global-config'

import type { DashboardStats } from './cases.ts'

const KEY = 'dashboard'
/** Bump when DashboardStats changes shape, so new code ignores a copy written by old code. */
const VERSION = 1

interface Stored {
  version: number
  stats: DashboardStats
}

/** The dashboard the cron job last precomputed, or null when there isn't a usable copy. */
export async function readStored(): Promise<DashboardStats | null> {
  let connection = process.env.GLOBAL_CONFIG
  if (!connection) return null

  try {
    let s = await createClient(connection).get<Stored>(KEY)
    return s?.version === VERSION && s.stats ? s.stats : null
  } catch (error) {
    console.error('Reading Global Config failed', error)
    return null
  }
}

/**
 * Writes the dashboard to Global Config. The SDK only reads, so this goes through the Vercel REST
 * API with an access token; the read token in the connection string can't write.
 */
export async function writeStored(stats: DashboardStats): Promise<void> {
  let connection = process.env.GLOBAL_CONFIG
  let token = process.env.GLOBAL_CONFIG_WRITE_TOKEN
  if (!connection) throw new Error('GLOBAL_CONFIG is not set')
  if (!token) throw new Error('GLOBAL_CONFIG_WRITE_TOKEN is not set')

  // The store's id is the path of its connection string: https://global-config.vercel.com/<id>?token=...
  let url = new URL(`https://api.vercel.com/v1/global-config/${new URL(connection).pathname.slice(1)}/items`)
  let team = process.env.GLOBAL_CONFIG_TEAM_ID
  if (team) url.searchParams.set('teamId', team)

  let value: Stored = { version: VERSION, stats }
  let response = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ operation: 'upsert', key: KEY, value }] }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new Error(`Writing Global Config failed with ${response.status}`)
}
