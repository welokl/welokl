// src/app/apple-icon.tsx — iOS home screen icon 180×180
import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: 180, height: 180, borderRadius: 40,
        background: '#FF5500',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 52 52" fill="none" width={140} height={140}>
          <path
            d="M26 10C19.4 10 14 15.4 14 22C14 31.2 26 44 26 44C26 44 38 31.2 38 22C38 15.4 32.6 10 26 10Z"
            fill="white"
          />
          <circle cx="26" cy="22" r="6" fill="#FF5500" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
