/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./security.html",
    "./legacy.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        carbon: {
          950: '#0C0605',
          900: '#120B09',
          850: '#17100E',
          800: '#211613',
          700: '#2F201C',
          600: '#42302A',
          500: '#522C1B',
        },
        copper: {
          DEFAULT: '#9E5839',
          light: '#CD8D66',
          dark: '#7A3F25',
          glow: 'rgba(158, 88, 57, 0.25)',
        },
        warm: {
          sand: '#D4B4A3',
          pale: '#F6DAC8',
          slate: '#727976',
        },
        status: {
          green: '#10B981',
          amber: '#F59E0B',
          orange: '#F97316',
          red: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
      },
      boxShadow: {
        'copper-glow': '0 0 15px rgba(158, 88, 57, 0.2)',
        'panel': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
      }
    },
  },
  plugins: [],
}
