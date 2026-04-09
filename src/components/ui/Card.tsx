import React from 'react'

interface CardProps {
  padding?: number | string
  hover?: boolean
  onClick?: () => void
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export function Card({ padding = 16, hover = false, onClick, className = '', style, children }: CardProps) {
  return (
    <div
      className={`ui-card${hover ? ' ui-card-hover' : ''} ${className}`}
      onClick={onClick}
      style={{ padding, cursor: onClick ? 'pointer' : undefined, ...style }}
    >
      {children}
    </div>
  )
}
