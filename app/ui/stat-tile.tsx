import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

const tileStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  '& .label': { fontSize: '13px', color: 'var(--ink-2)' },
  // A large standalone number keeps proportional figures; tabular digits only belong in columns.
  '& .value': { fontSize: '32px', fontWeight: 600, lineHeight: 1.15, color: 'var(--ink)' },
  '& .note': { fontSize: '13px', color: 'var(--ink-2)' },
})

export function StatTile(handle: Handle<{ label: string; value: string; note?: string }>) {
  return () => {
    let { label, value, note } = handle.props

    return (
      <div mix={tileStyle}>
        <p class="label">{label}</p>
        <p class="value">{value}</p>
        {note && <p class="note">{note}</p>}
      </div>
    )
  }
}
