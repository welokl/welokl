import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Nunito', 'sans-serif'],
        body: ['Nunito', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50: '#fff3ef',
          100: '#ffe0d4',
          500: '#ff5722',
          600: '#e64a19',
          700: '#bf360c',
        },
        ink: '#1a1a2e',
        paper: '#fafaf8',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}
export default config
