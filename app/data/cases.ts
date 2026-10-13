// Pure case math for the dashboard. Nothing here touches the network or the clock unless asked to.

/** The promise we report against. Change it here and every number on the page follows. */
export const SLA_BUSINESS_DAYS = 7
/** Business days and weeks are counted on the calendar in this zone. */
export const TIME_ZONE = 'America/New_York'
/** The weekly chart shows at most this many weeks, ending with the current one. */
export const MAX_WEEKS = 26
/** Open cases waiting this many business days or more share the last histogram bucket. */
export const AGE_CAP = 15

export interface CaseRecord {
  createdAt: string
  status: string | null
}

type CaseState = 'open' | 'resolved' | 'ineligible'

interface StatusInfo {
  state: CaseState
  /** Public wording; the raw status names are internal. */
  label: string
}

// Insertion order is the order the status list renders in.
const STATUSES = new Map<string, StatusInfo>([
  ['Received', { state: 'open', label: 'Received' }],
  ['Notified Program Author', { state: 'open', label: 'With program author' }],
  ['Escalated to Leadership', { state: 'open', label: 'Escalated to leadership' }],
  ['Resolved', { state: 'resolved', label: 'Resolved' }],
  ['macondo - ineligible atm, dmed update msg', { state: 'ineligible', label: 'Not eligible yet' }],
])
const LABEL_ORDER = [...STATUSES.values()].map((info) => info.label).concat('Other')

// A blank status is a submission nobody has triaged yet. An unrecognised status stays open so a
// new workflow state can't quietly hide part of the backlog.
const classify = (status: string | null): StatusInfo =>
  STATUSES.get(status ?? 'Received') ?? { state: 'open', label: 'Other' }

const MS_PER_DAY = 86_400_000
const dateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

/** Whole days since 1970-01-01 for the calendar date `instant` falls on in TIME_ZONE. */
export function localDay(instant: Date | string): number {
  let parts = dateParts.formatToParts(new Date(instant))
  let read = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  return Date.UTC(read('year'), read('month') - 1, read('day')) / MS_PER_DAY
}

// 1970-01-01 was a Thursday; 0 = Sunday.
const weekday = (day: number) => (day + 4) % 7

/** Weekdays in the half-open range (from, to]: submitted Monday, checked Tuesday, is 1 business day. */
export function businessDaysBetween(from: number, to: number): number {
  let count = 0
  for (let day = from + 1; day <= to; day++) if (![0, 6].includes(weekday(day))) count++
  return count
}

export const mondayOf = (day: number) => day - ((weekday(day) + 6) % 7)

/** `YYYY-MM-DD` for a day number. */
export const isoDate = (day: number) => new Date(day * MS_PER_DAY).toISOString().slice(0, 10)

export interface DashboardStats {
  /** When these numbers were computed; ages and "this week" are relative to it. */
  asOf: string
  slaBusinessDays: number
  /** Date of the earliest case. */
  since: string
  totals: { all: number; open: number; resolved: number; ineligible: number }
  /** Cases submitted in the current and previous Monday-to-Sunday weeks. */
  thisWeek: number
  lastWeek: number
  /** Open cases still waiting after `slaBusinessDays` business days. */
  overdue: number
  /** Business days the oldest open case has waited. */
  oldestOpen: number
  /** Cases submitted per week, oldest first, ending with the current week. */
  weekly: { weekStart: string; count: number }[]
  /** Open cases by business days waited; the last entry is AGE_CAP or more. */
  openAges: number[]
  byStatus: { label: string; count: number }[]
}

export function computeStats(cases: CaseRecord[], now: Date = new Date()): DashboardStats {
  let today = localDay(now)
  let thisMonday = mondayOf(today)

  let totals = { all: cases.length, open: 0, resolved: 0, ineligible: 0 }
  let labelCounts = new Map<string, number>()
  let weekCounts = new Map<number, number>()
  let openAges = new Array<number>(AGE_CAP + 1).fill(0)
  let overdue = 0
  let oldestOpen = 0
  let firstDay = today

  for (let record of cases) {
    let info = classify(record.status)
    totals[info.state]++
    labelCounts.set(info.label, (labelCounts.get(info.label) ?? 0) + 1)

    let day = localDay(record.createdAt)
    firstDay = Math.min(firstDay, day)
    let monday = mondayOf(day)
    weekCounts.set(monday, (weekCounts.get(monday) ?? 0) + 1)

    if (info.state === 'open') {
      let waited = businessDaysBetween(day, today)
      openAges[Math.min(waited, AGE_CAP)]++
      if (waited > SLA_BUSINESS_DAYS) overdue++
      oldestOpen = Math.max(oldestOpen, waited)
    }
  }

  let weeks = Math.min(MAX_WEEKS, (thisMonday - mondayOf(firstDay)) / 7 + 1)
  let weekly = Array.from({ length: weeks }, (_, i) => {
    let monday = thisMonday - 7 * (weeks - 1 - i)
    return { weekStart: isoDate(monday), count: weekCounts.get(monday) ?? 0 }
  })

  return {
    asOf: now.toISOString(),
    slaBusinessDays: SLA_BUSINESS_DAYS,
    since: isoDate(firstDay),
    totals,
    thisWeek: weekCounts.get(thisMonday) ?? 0,
    lastWeek: weekCounts.get(thisMonday - 7) ?? 0,
    overdue,
    oldestOpen,
    weekly,
    openAges,
    byStatus: LABEL_ORDER.map((label) => ({ label, count: labelCounts.get(label) ?? 0 })).filter((r) => r.count > 0),
  }
}
