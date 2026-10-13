import { createHash, timingSafeEqual } from 'node:crypto'

import { createController } from 'remix/router'

import { refreshDashboard } from '../data/refresh.ts'
import { getDashboard, type Dashboard } from '../data/stats.ts'
import { routes } from '../routes.ts'
import { HomePage } from './home-page.tsx'

// Live numbers are cached at the CDN for five minutes and then served stale while they refresh.
// A saved snapshot is cached only briefly so live data is picked up as soon as it's back.
const cacheControl = ({ source }: Dashboard) =>
  source === 'snapshot' ? 'public, max-age=0, s-maxage=30' : 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'

// No browser scripts or third-party assets; only the local font and inline styles.
const PAGE_POLICY =
  "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'"

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that variable is set on the project.
// Without the variable nothing can authenticate, so the endpoint stays closed.
function isCronRequest(request: Request): boolean {
  let secret = process.env.CRON_SECRET
  if (!secret) return false

  // Hashing first makes the comparison constant-time whatever the lengths.
  let digest = (v: string) => createHash('sha256').update(v).digest()
  return timingSafeEqual(digest(request.headers.get('Authorization') ?? ''), digest(`Bearer ${secret}`))
}

export default createController(routes, {
  actions: {
    async home(context) {
      let d = await getDashboard()
      return context.render(<HomePage {...d} />, {
        headers: {
          'Cache-Control': cacheControl(d),
          'Content-Security-Policy': PAGE_POLICY,
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    },

    async stats() {
      let d = await getDashboard()
      return Response.json(
        { ...d.stats, source: d.source },
        { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': cacheControl(d), 'X-Content-Type-Options': 'nosniff' } },
      )
    },

    async refresh(context) {
      let headers = { 'Cache-Control': 'no-store' }
      if (!isCronRequest(context.request)) return new Response('Unauthorized', { status: 401, headers })

      try {
        return Response.json({ ok: true, ...(await refreshDashboard()) }, { headers })
      } catch (error) {
        console.error('Refreshing the dashboard failed', error)
        return Response.json(
          { ok: false, error: error instanceof Error ? error.message : 'Refresh failed' },
          { status: 500, headers },
        )
      }
    },
  },
})
