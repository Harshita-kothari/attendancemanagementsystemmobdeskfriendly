/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#eef6ff',
          100: '#d9ebff',
          200: '#bbdaff',
          300: '#8ec2fe',
          400: '#5aa1fb',
          500: '#3480f7',
          600: '#1d5dec',
          700: '#1648d1',
          800: '#183caa',
          900: '#193786',
          950: '#142253',
        },
        surface: {
          0:   '#ffffff',
          50:  '#f8f9fc',
          100: '#f0f2f8',
          200: '#e4e7f0',
          300: '#cdd2e1',
          400: '#adb7cc',
          500: '#8790ab',
          600: '#5e667c',
          700: '#3d4463',
          800: '#252a45',
          900: '#161b35',
          950: '#0d1124',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease both',
        'slide-up': 'slideUp 0.4s ease both',
        'slide-in': 'slideIn 0.3s ease both',
        'pulse-ring': 'pulseRing 2s ease-out infinite',
        'scan': 'scan 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn: { from: { opacity: 0, transform: 'translateX(-12px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        pulseRing: { '0%': { transform: 'scale(1)', opacity: 0.8 }, '100%': { transform: 'scale(1.6)', opacity: 0 } },
        scan: { '0%, 100%': { top: '0%' }, '50%': { top: '90%' } },
      }
    },
  },
  plugins: [],
}
