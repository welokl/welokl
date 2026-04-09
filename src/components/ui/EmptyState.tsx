import React from 'react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
  style?: React.CSSProperties
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction, style }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      ...style,
    }}>
      {icon && (
        <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.5, lineHeight: 1 }}>
          {icon}
        </div>
      )}
      <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #111)', margin: '0 0 8px' }}>
        {title}
      </p>
      {subtitle && (
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #555)', margin: '0 0 24px', maxWidth: 280, lineHeight: 1.5 }}>
          {subtitle}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="ui-btn ui-btn-primary ui-btn-md"
          style={{ minWidth: 140 }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
