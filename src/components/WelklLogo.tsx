'use client'

/**
 * Welokl wordmark SVG — "Wel" + location-pin "o" + "kl", all in orange.
 * dark=true swaps the pin hole to dark so it works on dark backgrounds.
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

  return (
    <svg
      viewBox="0 0 152 44"
      height={height}
      width={height * (152 / 44)}
      fill="none"
      aria-label="Welokl"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* "Wel" */}
      <text
        x="0" y="38"
        fontSize="40" fontWeight="900" fontStyle="italic"
        fontFamily="'Plus Jakarta Sans', 'Nunito', system-ui, sans-serif"
        fill={c}
        letterSpacing="-1"
      >Wel</text>

      {/* Location-pin "o" */}
      <g transform="translate(68, 0)">
        <path
          d="M12 1C5.9 1 1 5.9 1 12C1 20.5 12 38 12 38C12 38 23 20.5 23 12C23 5.9 18.1 1 12 1Z"
          fill={c}
        />
        <circle cx="12" cy="12" r="5" fill={hole} />
      </g>

      {/* "kl" */}
      <text
        x="95" y="38"
        fontSize="40" fontWeight="900" fontStyle="italic"
        fontFamily="'Plus Jakarta Sans', 'Nunito', system-ui, sans-serif"
        fill={c}
        letterSpacing="-1"
      >kl</text>
    </svg>
  )
}
