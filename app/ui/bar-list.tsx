import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { formatCount } from './format.ts'

export interface BarRow {
  label: string
  value: number
  /** Secondary text at the end of the row, such as a percentage. */
  share: string
}

// Nominal categories, so every bar is the same blue: length carries the value and colour would
// only repeat it. Each row is labelled directly, which makes the list its own table view.
const listStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: '10px',
  '& li': {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 11rem) 1fr 3rem',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
  },
  '& .name': { color: 'var(--ink)' },
  '& .track': { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  '& .bar': { flex: 'none', height: '12px', background: 'var(--blue)' },
  '& .value': { fontWeight: 600, color: 'var(--ink)' },
  '& .share': { textAlign: 'right', fontSize: '13px', color: 'var(--ink-2)' },
  '@media (max-width: 520px)': {
    '& li': { gridTemplateColumns: 'minmax(0, 7rem) 1fr 2.5rem', gap: '8px' },
  },
})

export function BarList(handle: Handle<{ rows: BarRow[] }>) {
  return () => {
    let { rows } = handle.props
    let largest = Math.max(1, ...rows.map((r) => r.value))

    return (
      <ul mix={listStyle}>
        {rows.map(({ label, value, share }) => (
          <li key={label}>
            <span class="name">{label}</span>
            <span class="track">
              <span class="bar" style={{ width: `${(value / largest) * 78}%` }} />
              <span class="value">{formatCount(value)}</span>
            </span>
            <span class="share">{share}</span>
          </li>
        ))}
      </ul>
    )
  }
}
