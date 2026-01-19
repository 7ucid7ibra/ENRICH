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
          primary: '#8b5cf6', // Violet
          secondary: '#fbbf24', // Gold
          text: {
            main: '#f3f4f6',
            muted: '#9ca3af',
          }
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'everlast-gradient': 'linear-gradient(to right, #8b5cf6, #fbbf24)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
