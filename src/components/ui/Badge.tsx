import React from 'react'

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  success: { background: 'rgba(34,197,94,0.12)',  color: '#15803d' },
  warning: { background: 'rgba(245,158,11,0.12)', color: '#b45309' },
  error:   { background: 'rgba(239,68,68,0.12)',  color: '#dc2626' },
  info:    { background: 'rgba(59,130,246,0.12)', color: '#1d4ed8' },
  default: { background: 'var(--chip-bg, #f0f0f0)', color: 'var(--text-secondary, #555)' },
  brand:   { background: 'rgba(255,48,8,0.10)',   color: '#FF3008' },
}

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default' | 'brand'
  size?: 'sm' | 'md'
  children: React.ReactNode
  style?: React.CSSProperties
}

export function Badge({ variant = 'default', size = 'sm', children, style }: BadgeProps) {
  const sizeStyle: React.CSSProperties = size === 'sm'
    ? { fontSize: 11, padding: '2px 8px', height: 20 }
    : { fontSize: 12, padding: '4px 10px', height: 24 }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 9999,
      fontWeight: 700,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      whiteSpace: 'nowrap',
      lineHeight: 1,
      ...VARIANT_STYLES[variant],
      ...sizeStyle,
      ...style,
    }}>
      {children}
    </span>
  )
}
