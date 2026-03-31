'use client'

/**
 * Welokl wordmark — "Wel" + location-pin "o" + "kl"
 * Uses HTML spans (not SVG text) so the web font loads correctly.
 */
export function WelklLogo({
  height = 32,
  dark = false,
}: {
  height?: number
  dark?: boolean
}) {
  const c    = '#FF5500'
  const hole = dark ? '#111' : '#fff'
  const fs   = Math.round(height * 1.28)   // font size relative to desired height
  const pb   = Math.round(height * 0.05)   // nudge text baseline to meet pin tip

  const textStyle: React.CSSProperties = {
    fontFamily: "'Plus Jakarta Sans', 'Nunito', system-ui, sans-serif",
    fontStyle:  'italic',
    fontWeight: 800,
    fontSize:   `${fs}px`,
    letterSpacing: '-0.03em',
    color: c,
    lineHeight: 1,
    paddingBottom: `${pb}px`,
    display: 'block',
  }

  return (
    <span
      aria-label="Welokl"
      style={{
        display:    'inline-flex',
        alignItems: 'flex-end',
        userSelect: 'none',
        lineHeight: 1,
      }}
    >
      <span style={textStyle}>Wel</span>

      {/* Location-pin "o" */}
      <svg
        viewBox="0 0 22 38"
        height={height}
        width={Math.round(height * (22 / 38))}
        fill="none"
        style={{ display: 'block', flexShrink: 0 }}
        aria-hidden="true"
      >
        <path
          d="M11 1C5.4 1 1 5.4 1 11C1 19.2 11 37 11 37C11 37 21 19.2 21 11C21 5.4 16.6 1 11 1Z"
          fill={c}
        />
        <circle cx="11" cy="11" r="4.2" fill={hole} />
      </svg>

      <span style={textStyle}>kl</span>
    </span>
  )
}
