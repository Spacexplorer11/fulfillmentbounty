import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'

import { FONT_STACK, themeStyles } from '../ui/theme.ts'

export interface DocumentProps {
  children?: RemixNode
  title: string
  description: string
}

const bodyStyle = css({
  margin: 0,
  minHeight: '100vh',
  background: 'var(--page)',
  color: 'var(--ink)',
  fontFamily: FONT_STACK,
  fontSize: '15px',
  lineHeight: 1.5,
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
})

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, title, description } = handle.props

    return (
      <html lang="en" mix={themeStyles}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="dark" />
          <link rel="preload" href="/fonts/lexend-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
          <style>{`@font-face { font-family: Lexend; font-style: normal; font-weight: 400 700; font-display: swap; src: url('/fonts/lexend-latin.woff2') format('woff2'); }`}</style>
          <meta name="description" content={description} />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{title}</title>
        </head>
        <body mix={bodyStyle}>{children}</body>
      </html>
    )
  }
}
