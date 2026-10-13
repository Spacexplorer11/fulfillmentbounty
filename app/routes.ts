import { get, route } from 'remix/routes'

export const routes = route({
  home: '/',
  stats: get('/stats.json'),
  // Called by Vercel Cron (see vercel.json), never by visitors.
  refresh: get('/api/cron/refresh'),
})
