/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Military theme colors
        military: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Tactical dark theme
        tactical: {
          bg: '#0a0a0a',
          card: '#171717',
          border: '#333333',
          hover: '#262626',
        },
        // Alert/Accent colors
        alert: {
          orange: '#f97316',
          red: '#ef4444',
          blue: '#3b82f6',
        }
      },
      fontFamily: {
        sans: ['Roboto', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px #f97316, 0 0 10px #f97316' },
          '50%': { boxShadow: '0 0 20px #f97316, 0 0 30px #f97316' },
        }
      }
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}
