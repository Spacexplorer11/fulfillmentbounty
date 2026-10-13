import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  AGE_CAP,
  businessDaysBetween,
  computeStats,
  isoDate,
  localDay,
  mondayOf,
  SLA_BUSINESS_DAYS,
  type CaseRecord,
} from './cases.ts'

// Monday 2026-09-28, noon in New York.
const NOW = new Date('2026-09-28T16:00:00Z')

describe('business days', () => {
  it('counts the weekdays after the day a case was submitted', () => {
    let monday = localDay('2026-09-21T16:00:00Z')
    assert.equal(businessDaysBetween(monday, monday), 0)
    assert.equal(businessDaysBetween(monday, monday + 1), 1)
    assert.equal(businessDaysBetween(monday, monday + 4), 4)
    assert.equal(businessDaysBetween(monday, monday + 7), 5)
  })

  it('skips weekends', () => {
    let friday = localDay('2026-09-25T16:00:00Z')
    assert.equal(businessDaysBetween(friday, friday + 3), 1)
    assert.equal(businessDaysBetween(friday + 1, friday + 2), 0)
  })

  it('uses the New York calendar rather than UTC', () => {
    // 02:00 UTC on Tuesday 9/29 is still 10pm Monday 9/28 in New York.
    assert.equal(isoDate(localDay('2026-09-29T02:00:00Z')), '2026-09-28')
  })

  it('starts weeks on Monday', () => {
    assert.equal(isoDate(mondayOf(localDay('2026-10-04T16:00:00Z'))), '2026-09-28')
    assert.equal(isoDate(mondayOf(localDay('2026-09-28T16:00:00Z'))), '2026-09-28')
  })
})

describe('computeStats', () => {
  let cases: CaseRecord[] = [
    { createdAt: '2026-09-28T13:00:00Z', status: null },
    { createdAt: '2026-09-21T13:00:00Z', status: 'Received' },
    { createdAt: '2026-09-17T13:00:00Z', status: 'Notified Program Author' },
    { createdAt: '2026-09-16T13:00:00Z', status: 'Escalated to Leadership' },
    { createdAt: '2026-08-03T13:00:00Z', status: 'Notified Program Author' },
    { createdAt: '2026-07-10T13:00:00Z', status: 'Resolved' },
    { createdAt: '2026-09-22T13:00:00Z', status: 'macondo - ineligible atm, dmed update msg' },
    { createdAt: '2026-09-23T13:00:00Z', status: 'A Status Nobody Planned For' },
  ]
  let stats = computeStats(cases, NOW)

  it('splits cases into open, resolved and not eligible', () => {
    assert.deepEqual(stats.totals, { all: 8, open: 6, resolved: 1, ineligible: 1 })
  })

  it('treats exactly the promised number of business days as on time', () => {
    assert.equal(SLA_BUSINESS_DAYS, 7)
    // Thursday 9/17 has waited 7 business days by Monday 9/28; Wednesday 9/16 has waited 8.
    // Only the 8-day and the 40-day cases are overdue.
    assert.equal(stats.overdue, 2)
    assert.equal(stats.oldestOpen, 40)
  })

  it('buckets open cases by days waited and caps the last bucket', () => {
    assert.equal(stats.openAges.length, AGE_CAP + 1)
    assert.deepEqual(
      stats.openAges.map((count, days) => [days, count]).filter(([, count]) => count > 0),
      [[0, 1], [3, 1], [5, 1], [7, 1], [8, 1], [AGE_CAP, 1]],
    )
  })

  it('counts this week and last week on Monday-to-Sunday weeks', () => {
    assert.equal(stats.thisWeek, 1)
    assert.equal(stats.lastWeek, 3)
  })

  it('fills quiet weeks with zero from the first case to the current week', () => {
    assert.equal(stats.since, '2026-07-10')
    assert.equal(stats.weekly.length, 13)
    assert.deepEqual(stats.weekly[0], { weekStart: '2026-07-06', count: 1 })
    assert.deepEqual(stats.weekly[1], { weekStart: '2026-07-13', count: 0 })
    assert.deepEqual(stats.weekly.at(-1), { weekStart: '2026-09-28', count: 1 })
  })

  it('lists statuses in workflow order with public names', () => {
    assert.deepEqual(stats.byStatus, [
      { label: 'Received', count: 2 },
      { label: 'With program author', count: 2 },
      { label: 'Escalated to leadership', count: 1 },
      { label: 'Resolved', count: 1 },
      { label: 'Not eligible yet', count: 1 },
      { label: 'Other', count: 1 },
    ])
  })

  it('handles an empty table', () => {
    let empty = computeStats([], NOW)
    assert.deepEqual(empty.totals, { all: 0, open: 0, resolved: 0, ineligible: 0 })
    assert.equal(empty.weekly.length, 1)
    assert.equal(empty.overdue, 0)
    assert.equal(empty.since, '2026-09-28')
  })
})
