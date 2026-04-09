import React from 'react'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  borderRadius?: number | string
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ width, height = 16, borderRadius = 8, className = '', style }: SkeletonProps) {
  return (
    <div
      className={`ui-skeleton ${className}`}
      style={{ width, height, borderRadius, flexShrink: 0, ...style }}
    />
  )
}

// Common presets
export function SkeletonText({ lines = 1, lastWidth = '70%' }: { lines?: number; lastWidth?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 && lines > 1 ? lastWidth : '100%'}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div style={{
      background: 'var(--card-white, #fff)',
      border: '1px solid var(--border, #e8e8e8)',
      borderRadius: 14,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <Skeleton height={height} borderRadius={10} />
      <SkeletonText lines={2} />
    </div>
  )
}
