// src/app/apple-icon.tsx — iOS home screen icon 180×180
import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: 180, height: 180, borderRadius: 40,
        background: '#FF3008',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 52 52" fill="none" width={140} height={140}>
          <path
            d="M26 11C19.9 11 15 15.9 15 22C15 30.2 26 43 26 43C26 43 37 30.2 37 22C37 15.9 32.1 11 26 11Z"
            stroke="white" strokeWidth="2" fill="rgba(255,255,255,0.18)"
          />
          <path
            d="M20 21L22.8 28L26 23L29.2 28L32 21"
            stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  )
}
