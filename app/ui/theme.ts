import { css } from 'remix/ui'

export const FONT_STACK = "Lexend, system-ui, -apple-system, 'Segoe UI', sans-serif"

export const themeStyles = css({
  colorScheme: 'dark',
  '--page': '#171719',
  '--surface': '#171719',
  '--ink': '#eeeeef',
  '--ink-2': '#aaaab2',
  '--ink-3': '#92929c',
  '--grid': '#2a2a30',
  '--baseline': '#36363e',
  '--blue': '#8d9faa',
  '--blue-text': '#c0cbd1',
  '--critical': '#dc8277',
  '--critical-text': '#efa095',
})

export const cardStyle = css({
  borderTop: '1px solid var(--baseline)',
  padding: '20px 0 0',
})
