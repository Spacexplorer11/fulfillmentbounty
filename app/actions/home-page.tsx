import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { AGE_CAP, type DashboardStats } from '../data/cases.ts'
import type { Dashboard } from '../data/stats.ts'
import { routes } from '../routes.ts'
import { BarList } from '../ui/bar-list.tsx'
import { ColumnChart, niceScale, type Column } from '../ui/column-chart.tsx'
import { formatAsOf, formatCount, formatDay, formatPercent, formatWeek, plural } from '../ui/format.ts'
import { StatTile } from '../ui/stat-tile.tsx'
import { cardStyle } from '../ui/theme.ts'
import { Document } from './document.tsx'

interface HomePageProps {
  stats: DashboardStats
  source: Dashboard['source']
}

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let { stats, source } = handle.props
    let { totals } = stats
    let tiles: [string, number, string][] = [
      ['Total cases', totals.all, `Since ${formatDay(stats.since)}`],
      ['This week', stats.thisWeek, `${formatCount(stats.lastWeek)} last week`],
      ['Resolved', totals.resolved, `${formatPercent(totals.resolved, totals.all)} of all cases`],
      ['Still open', totals.open, `${formatCount(totals.open - stats.overdue)} within the promise`],
    ]

    return (
      <Document
        title="Fulfillment Bounty tracker – Hack Club"
        description={`How Hack Club is tracking against its promise to resolve fulfillment bounty cases within ${stats.slaBusinessDays} business days.`}
      >
        <main mix={pageStyle}>
          {source === 'snapshot' ? (
            <p role="status" mix={noticeStyle}>
              Live data is unavailable. Showing a saved copy from {formatAsOf(stats.asOf)}.
            </p>
          ) : null}

          <Header stats={stats} />
          <Hero stats={stats} />

          <section aria-label="Key numbers" mix={[cardStyle, tilesStyle]}>
            {tiles.map(([label, n, note]) => (
              <StatTile key={label} label={label} value={formatCount(n)} note={note} />
            ))}
          </section>

          <section mix={pairStyle}>
            <WeeklyCard stats={stats} />
            <AgeCard stats={stats} />
          </section>

          <section mix={pairStyle}>
            <StatusCard stats={stats} />
            <NotesCard stats={stats} />
          </section>

          <Footer />
        </main>
      </Document>
    )
  }
}

function Header(handle: Handle<{ stats: DashboardStats }>) {
  return () => {
    let { stats } = handle.props

    return (
      <header mix={headerStyle}>
        <h1>Fulfillment Bounty tracker</h1>
        <p class="asof">
          Updated <time dateTime={stats.asOf}>{formatAsOf(stats.asOf)}</time>. Numbers refresh every
          few minutes.
        </p>
      </header>
    )
  }
}

function Hero(handle: Handle<{ stats: DashboardStats }>) {
  return () => {
    let { stats } = handle.props
    let { open } = stats.totals

    return (
      <section mix={[cardStyle, heroStyle]} aria-labelledby="hero-title">
        <h2 id="hero-title" class="headline">
          <span class={stats.overdue > 0 ? 'figure late' : 'figure'}>{formatCount(stats.overdue)}</span>{' '}
          open {plural(stats.overdue, 'case is', 'cases are')} past the{' '}
          <span style={{ whiteSpace: 'nowrap' }}>{stats.slaBusinessDays}-business-day</span> promise
        </h2>
        <p class="detail">
          {open === 0
            ? 'There are no open cases right now.'
            : `${formatCount(open)} ${plural(open, 'case is', 'cases are')} open. The oldest has waited ${formatCount(stats.oldestOpen)} business ${plural(stats.oldestOpen, 'day')}.`}
        </p>
      </section>
    )
  }
}

function WeeklyCard(handle: Handle<{ stats: DashboardStats }>) {
  return () => {
    let { weekly } = handle.props.stats
    let columns: Column[] = weekly.map(({ weekStart, count }, i) => {
      let current = i === weekly.length - 1
      let label = formatWeek(weekStart)
      return {
        label,
        value: count,
        tone: current ? 'blue-soft' : 'blue',
        tip: `${formatCount(count)} ${plural(count, 'case')} · ${current ? 'this week so far' : `week of ${label}`}`,
      }
    })

    return (
      <article mix={[cardStyle, chartCardStyle]}>
        <h2>Cases per week</h2>
        <p class="sub">Monday–Sunday. The darker bar is this week so far.</p>
        <div class="plot">
          <ColumnChart
            label="New cases per week"
            columns={columns}
            {...niceScale(Math.max(...weekly.map((w) => w.count)))}
            labelEvery={weekly.length > 8 ? 2 : 1}
          />
        </div>
      </article>
    )
  }
}

function AgeCard(handle: Handle<{ stats: DashboardStats }>) {
  return () => {
    let { openAges, slaBusinessDays } = handle.props.stats
    let columns: Column[] = openAges.map((count, days) => {
      let label = days === AGE_CAP ? `${AGE_CAP}+` : String(days)
      return {
        label,
        value: count,
        tone: days > slaBusinessDays ? 'critical' : 'blue',
        tip: `${formatCount(count)} open ${plural(count, 'case')} · waiting ${label} business ${plural(days, 'day')}`,
      }
    })

    return (
      <article mix={[cardStyle, chartCardStyle]}>
        <h2>Days waiting</h2>
        <p class="sub">Business days since each open case was submitted.</p>
        <ul mix={legendStyle} style={{ marginBottom: '16px' }}>
          {[['blue', 'Within'], ['critical', 'Past']].map(([tone, when]) => (
            <li key={tone}>
              <i class={tone} />
              {when} {slaBusinessDays} business days
            </li>
          ))}
        </ul>
        <div class="plot">
          <ColumnChart
            label="Open cases by business days waited"
            columns={columns}
            {...niceScale(Math.max(...openAges))}
            dividerAt={slaBusinessDays + 1}
          />
        </div>
      </article>
    )
  }
}

function StatusCard(handle: Handle<{ stats: DashboardStats }>) {
  return () => {
    let { byStatus, totals } = handle.props.stats

    return (
      <article mix={[cardStyle, chartCardStyle]}>
        <h2>Cases by status</h2>
        <p class="sub">Where every case stands right now.</p>
        <BarList
          rows={byStatus.map(({ label, count }) => ({ label, value: count, share: formatPercent(count, totals.all) }))}
        />
      </article>
    )
  }
}

function NotesCard(handle: Handle<{ stats: DashboardStats }>) {
  return () => {
    let { slaBusinessDays } = handle.props.stats

    return (
      <article mix={[cardStyle, notesStyle]}>
        <h2>How we count</h2>
        <ul>
          <li>
            <strong>Open</strong> means a case isn't resolved yet. Cases marked not eligible yet
            are in the total but not treated as open.
          </li>
          <li>
            <strong>Business days</strong> are Monday to Friday in US Eastern time, with no holiday
            calendar, counted from the day after a case is submitted. A case is past the promise
            once it has waited more than {slaBusinessDays}.
          </li>
          <li>
            <strong>Resolved cases</strong> aren't exactly scored since resolution dates are not recorded, so
            the promise is checked against cases that are still open.
          </li>
        </ul>
      </article>
    )
  }
}

function Footer() {
  return () => (
    <footer mix={footerStyle}>
      <nav aria-label="Related links">
        <a href="https://news.hackclub.com/news/fulfillment-bounties">About the fulfillment bounty</a>
        <a href={routes.stats.href()}>Data (JSON)</a>
        <a href="https://hackclub.com">Hack Club</a>
        <a href="https://3kh0.net">Built by Rowan</a>
        <a href="https://remix.run">Powered by Remix</a>
      </nav>
    </footer>
  )
}

const pageStyle = css({
  boxSizing: 'border-box',
  maxWidth: '900px',
  margin: '0 auto',
  padding: '36px 24px 40px',
  display: 'grid',
  gap: '24px',
  '& *, & *::before, & *::after': { boxSizing: 'border-box' },
  '& > *': { minWidth: 0 },
  '& h1, & h2, & p': { margin: 0 },
  '@media (max-width: 520px)': { padding: '24px 12px 48px' },
})

const noticeStyle = css({ fontSize: '14px', color: 'var(--ink-2)', borderLeft: '2px solid var(--baseline)', paddingLeft: '12px' })

const headerStyle = css({
  display: 'grid',
  gap: '6px',
  padding: '0 0 4px',
  '& h1': { fontSize: '26px', fontWeight: 500, lineHeight: 1.15 },
  '& .asof': { fontSize: '13px', color: 'var(--ink-2)' },
  '@media (max-width: 520px)': { '& h1': { fontSize: '23px' } },
})

const heroStyle = css({
  display: 'grid',
  gap: '8px',
  '& .figure': { fontWeight: 700 },
  '& .figure.late': { color: 'var(--critical-text)' },
  '& .headline': { fontSize: '20px', fontWeight: 400, lineHeight: 1.3, maxWidth: '38rem' },
  '& .detail': { color: 'var(--ink-2)' },
})

const legendStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px 16px',
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontSize: '13px',
  color: 'var(--ink-2)',
  '& li': { display: 'flex', alignItems: 'center', gap: '6px' },
  '& i': { flex: 'none', width: '8px', height: '8px' },
  '& i.blue': { background: 'var(--blue)' },
  '& i.critical': { background: 'var(--critical)' },
})

const tilesStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '20px',
  '@media (max-width: 760px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
})

const pairStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '32px',
  '@media (max-width: 860px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

// Align neighbouring plots even when their descriptions wrap differently.
const cardTitle = { fontSize: '16px', fontWeight: 500 }

const chartCardStyle = css({
  display: 'flex',
  flexDirection: 'column',
  '& h2': cardTitle,
  '& .sub': { fontSize: '13px', color: 'var(--ink-2)', margin: '2px 0 20px' },
  '& .plot': { marginTop: 'auto' },
})

const notesStyle = css({
  '& h2': cardTitle,
  '& ul': {
    margin: '12px 0 0',
    paddingLeft: '18px',
    display: 'grid',
    gap: '10px',
    fontSize: '14px',
    color: 'var(--ink-2)',
  },
  '& li::marker': { color: 'var(--ink-3)' },
  '& strong': { fontWeight: 600, color: 'var(--ink)' },
})

const footerStyle = css({
  borderTop: '1px solid var(--baseline)',
  padding: '16px 0 0',
  fontSize: '13px',
  '& nav': { display: 'flex', flexWrap: 'wrap', gap: '8px 20px' },
  '& a': { color: 'var(--blue-text)', textDecoration: 'underline', textUnderlineOffset: '3px' },
  '& a:focus-visible': { outline: '2px solid var(--blue)', outlineOffset: '2px' },
})
