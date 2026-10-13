import { TIME_ZONE } from '../data/cases.ts'

const count = new Intl.NumberFormat('en-US')
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const longDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const stamp = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: TIME_ZONE,
})

export const formatCount = (n: number) => count.format(n)
export const formatPercent = (part: number, whole: number) => `${whole && Math.round((part / whole) * 100)}%`
export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)
// A date-only ISO string parses as UTC midnight, which is the zone both formatters print in.
/** `Sep 21` for a `YYYY-MM-DD` calendar date. */
export const formatWeek = (day: string) => shortDate.format(new Date(day))
/** `Sep 21, 2026` for a `YYYY-MM-DD` calendar date. */
export const formatDay = (day: string) => longDate.format(new Date(day))
export const formatAsOf = (instant: string) => `${stamp.format(new Date(instant))} ET`
