'use client'
import React from 'react'

interface InputProps {
  label?: string
  placeholder?: string
  error?: string
  hint?: string
  type?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  required?: boolean
  disabled?: boolean
  maxLength?: number
  autoComplete?: string
  prefix?: React.ReactNode  // e.g. "+91" or an icon
  suffix?: React.ReactNode  // e.g. show/hide password toggle
  style?: React.CSSProperties
  inputStyle?: React.CSSProperties
  name?: string
}

export function Input({
  label, placeholder, error, hint, type = 'text', value, onChange, onFocus, onBlur,
  required, disabled, maxLength, autoComplete, prefix, suffix, style, inputStyle, name,
}: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
      {label && (
        <label style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text-secondary, #555)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && (
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 14, color: 'var(--text-muted, #888)', fontWeight: 600,
            pointerEvents: 'none', userSelect: 'none',
          }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          autoComplete={autoComplete}
          className={`ui-input${error ? ' ui-input-error' : ''}`}
          style={{
            paddingLeft: prefix ? 46 : undefined,
            paddingRight: suffix ? 44 : undefined,
            opacity: disabled ? 0.6 : 1,
            ...inputStyle,
          }}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, margin: 0,
          fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p style={{ fontSize: 12, color: 'var(--text-muted, #888)', margin: 0,
          fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {hint}
        </p>
      )}
    </div>
  )
}
