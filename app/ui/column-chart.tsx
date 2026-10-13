import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { formatCount } from './format.ts'

export interface Column {
  label: string
  value: number
  tone: 'blue' | 'blue-soft' | 'critical'
  /** Read out on hover and on keyboard focus, value first. */
  tip: string
}

export interface ColumnChartProps {
  /** Names the chart for screen readers. */
  label: string
  columns: Column[]
  /** Top of the y-axis; must be the last entry of `ticks`. */
  max: number
  ticks: number[]
  /** Name every nth column counting back from the last, so the newest is always labelled. */
  labelEvery?: number
  /** Index of the first column after a vertical divider. */
  dividerAt?: number
}

/** A y-axis that tops out on a round number with at most four gridline steps. */
export function niceScale(largest: number): { max: number; ticks: number[] } {
  let step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find((s) => Math.ceil(largest / s) <= 4) ?? 1000
  let steps = Math.max(1, Math.ceil(largest / step))
  return { max: steps * step, ticks: Array.from({ length: steps + 1 }, (_, i) => i * step) }
}

const tooltipSide = (i: number, n: number) => (i < n / 3 ? 'start' : i >= (n * 2) / 3 ? 'end' : 'mid')

const PLOT_HEIGHT = '168px'
const AXIS_WIDTH = '32px'

// Bars are thin and square-ended. Each column's whole slot is the hover and focus target, so a short
// bar is as easy to hit as a tall one, and the tooltip is pure CSS: this page ships no JavaScript.
const chartStyle = css({
  position: 'relative',
  paddingLeft: AXIS_WIDTH,
  '& .grid': { position: 'absolute', left: AXIS_WIDTH, right: 0, top: 0, height: PLOT_HEIGHT },
  '& .tick': { position: 'absolute', left: 0, right: 0, height: 0, borderTop: '1px solid var(--grid)' },
  '& .tick.zero': { borderTopColor: 'var(--baseline)' },
  '& .tick span': {
    position: 'absolute',
    right: 'calc(100% + 8px)',
    top: 0,
    transform: 'translateY(-50%)',
    fontSize: '11px',
    color: 'var(--ink-3)',
    fontVariantNumeric: 'tabular-nums',
  },
  '& .columns': { position: 'relative', display: 'flex' },
  '& .slot': { flex: '1 1 0', minWidth: 0 },
  '& .slot.divider': { borderLeft: '1px solid var(--baseline)' },
  '& .hit': {
    position: 'relative',
    height: PLOT_HEIGHT,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    outline: 'none',
  },
  '& .hit:focus-visible': { outline: '2px solid var(--blue)', outlineOffset: '-2px', borderRadius: '4px' },
  '& .bar': {
    width: 'calc(100% - 2px)',
    maxWidth: '24px',
    borderRadius: 0,
    transition: 'filter 120ms ease',
  },
  '& .bar.blue, & .bar.blue-soft': { background: 'var(--blue)' },
  '& .bar.blue-soft': { opacity: 0.55 },
  '& .bar.critical': { background: 'var(--critical)' },
  '& .hit:hover .bar, & .hit:focus-visible .bar': { filter: 'brightness(1.15)' },
  '& .hit::after': {
    content: 'attr(data-tip)',
    position: 'absolute',
    bottom: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 2,
    padding: '4px 8px',
    borderRadius: '6px',
    background: 'var(--ink)',
    color: 'var(--surface)',
    fontSize: '12px',
    width: 'max-content',
    maxWidth: '180px',
    pointerEvents: 'none',
    opacity: 0,
    transition: 'opacity 100ms ease',
  },
  '& .hit:hover::after, & .hit:focus-visible::after': { opacity: 1 },
  // A hidden tooltip still counts toward the page's scroll width, so tooltips are capped at 180px
  // and pinned to the near edge in each outer third of the chart: none can spill past the viewport.
  '& .hit.start::after': { left: 0, transform: 'none' },
  '& .hit.end::after': { left: 'auto', right: 0, transform: 'none' },
  '& .label': {
    display: 'flex',
    justifyContent: 'center',
    height: '22px',
    paddingTop: '6px',
    fontSize: '11px',
    color: 'var(--ink-3)',
    whiteSpace: 'nowrap',
  },
  '& .label span': { flex: 'none' },
  // On the narrowest phones, name every other labelled column so neighbours don't touch.
  '@media (max-width: 360px)': { '& .label.minor span': { visibility: 'hidden' } },
})

export function ColumnChart(handle: Handle<ColumnChartProps>) {
  return () => {
    let { label, columns, max, ticks, labelEvery = 1, dividerAt } = handle.props

    return (
      <div mix={chartStyle} role="group" aria-label={label}>
        <div class="grid" aria-hidden="true">
          {ticks.map((tick) => (
            <div key={tick} class={tick === 0 ? 'tick zero' : 'tick'} style={{ bottom: `${(tick / max) * 100}%` }}>
              <span>{formatCount(tick)}</span>
            </div>
          ))}
        </div>
        <div class="columns">
          {columns.map((c, i) => {
            let back = columns.length - 1 - i
            return (
              <div key={i} class={i === dividerAt ? 'slot divider' : 'slot'}>
                <div class={`hit ${tooltipSide(i, columns.length)}`} tabindex={0} role="img" aria-label={c.tip} data-tip={c.tip}>
                  <div class={`bar ${c.tone}`} style={{ height: `${(c.value / max) * 100}%` }} />
                </div>
                <div class={back % (labelEvery * 2) === 0 ? 'label' : 'label minor'} aria-hidden="true">
                  <span>{back % labelEvery === 0 ? c.label : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}
