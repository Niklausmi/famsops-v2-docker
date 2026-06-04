/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['"DM Mono"', 'monospace'],
        display: ['"Syne"', 'sans-serif'],
      },
      colors: {
        // Dark theme
        dark: {
          bg:       '#0a0c0f',
          surface:  '#111318',
          surface2: '#181c23',
          surface3: '#1e2230',
        },
        // Light theme
        light: {
          bg:       '#f0f2f7',
          surface:  '#ffffff',
          surface2: '#f5f7fb',
          surface3: '#eaecf4',
        },
        accent:  { DEFAULT: '#38d9f5', dark: '#1ab8d4' },
        accent2: { DEFAULT: '#7b6fff', dark: '#5e54d4' },
        accent3: { DEFAULT: '#ff7eb3' },
        success: { DEFAULT: '#3dffa0', dark: '#22c97a' },
        warn:    { DEFAULT: '#ffb347' },
        danger:  { DEFAULT: '#ff5f6d' },
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.07)',
      },
      animation: {
        'fade-up':   'fadeUp 0.3s ease',
        'slide-in':  'slideIn 0.25s ease',
        'shake':     'shake 0.35s ease',
      },
      keyframes: {
        fadeUp:  { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn: { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        shake:   { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-6px)' }, '75%': { transform: 'translateX(6px)' } },
      },
    },
  },
  plugins: [],
}
