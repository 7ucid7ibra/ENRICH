/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        everlast: {
          bg: '#050505',
          surface: '#0A0A0A',
          primary: '#cbd5e1', // Silver
          secondary: '#fbbf24', // Gold
          gold: {
            light: '#ffd060', // Brighter gold
            DEFAULT: '#fbbf24',
            dark: '#b45309', // Deep Amber/Gold
          },
          silver: {
            light: '#f8fafc',
            DEFAULT: '#cbd5e1',
            dark: '#64748b',
          },
          text: {
            main: '#f3f4f6',
            muted: '#9ca3af',
          }
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'everlast-gradient': 'linear-gradient(to right, #cbd5e1, #fbbf24)',
        'gold-metallic': 'linear-gradient(135deg, #b45309 0%, #fbbf24 50%, #ffd060 100%)',
        'glass-panel': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        breathe: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.8, transform: 'scale(1.02)' },
        }
      }
    },
  },
  plugins: [],
}
