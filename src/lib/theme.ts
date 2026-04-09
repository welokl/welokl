export const theme = {
  colors: {
    primary:       '#FF3008',
    primaryLight:  '#FFF0EC',
    primaryDark:   '#CC2600',
    bg:            '#F5F5F5',
    surface:       '#FFFFFF',
    surface2:      '#F5F5F5',
    textPrimary:   '#111111',
    textSecondary: '#555555',
    textMuted:     '#888888',
    success:       '#22c55e',
    warning:       '#f59e0b',
    error:         '#ef4444',
    border:        '#e8e8e8',
    borderDark:    '#dddddd',
    overlay:       'rgba(0,0,0,0.5)',
  },
  fonts: {
    sans:    "'Plus Jakarta Sans', system-ui, sans-serif",
    display: "'Syne', system-ui, sans-serif",
  },
  radius: {
    sm:   '6px',
    md:   '10px',
    lg:   '14px',
    xl:   '20px',
    full: '9999px',
  },
  shadow: {
    sm:  '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
    md:  '0 4px 16px rgba(0,0,0,0.08)',
    lg:  '0 8px 32px rgba(0,0,0,0.10)',
  },
  transition: {
    fast:   'all 100ms ease',
    normal: 'all 150ms ease',
    slow:   'all 200ms ease',
  },
} as const

export type Theme = typeof theme
