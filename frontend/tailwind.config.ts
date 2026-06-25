import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: 'var(--font-body)',
        heading: 'var(--font-heading)',
        mono: 'var(--font-mono)',
      },
      colors: {
        background: {
          DEFAULT: '#07070f',
          alt: '#090911',
        },
        panel: {
          DEFAULT: '#11101b',
          light: '#151421',
          dark: '#0f0e19',
        },
        input: {
          DEFAULT: '#191727',
          dark: '#0b0a14',
          focus: '#0e0d18',
        },
        border: {
          DEFAULT: '#2b2740',
          muted: '#3b3748',
        },
        primary: {
          DEFAULT: '#ff2d85',
          dark: '#e11d72',
          darker: '#9f0645',
          darkest: '#2b1020',
          light: '#ff5a9d',
          lighter: '#ff8fbd',
          muted: '#5b1738',
        },
        secondary: {
          DEFAULT: '#00f5d4',
          light: '#9ef7ee',
          dark: '#102321',
        },
        light: '#f3edff',
        bright: '#f7f3ff',
        medium: '#cfc7dc',
        muted: '#a69db6',
        placeholder: '#777086',
        danger: {
          DEFAULT: '#ff2222',
          light: '#ff4444',
        },
        warning: '#f8e231',
        orange: {
          DEFAULT: '#ff8a2d',
          light: '#ff9f4a',
        },
      },
      dropShadow: {
        'glow-primary': '0 0 8px rgba(255, 45, 133, 0.5)',
        'glow-secondary': '0 0 8px rgba(0, 245, 212, 0.5)',
        'glow-warning': '0 0 8px rgba(248, 226, 49, 0.5)',
      },
      boxShadow: {
        'glow-primary': '0 0 16px rgba(255, 45, 133, 0.22)',
        'glow-primary-soft': '0 0 22px rgba(255, 45, 133, 0.08)',
        'glow-secondary': '0 0 16px rgba(0, 245, 212, 0.2)',
        'glow-secondary-soft': '0 0 34px rgba(0, 245, 212, 0.08)',
        'glow-danger': '0 0 16px rgba(255, 34, 34, 0.28)',
        'glow-warning': '0 0 16px rgba(248, 226, 49, 0.2)',
        'glow-orange': '0 0 16px rgba(255, 138, 45, 0.18)',
        'glow-primary-inset': 'inset 0 0 12px rgba(255, 45, 133, 0.05)',
        'card': '0 0 0 1px rgba(255, 255, 255, 0.02)',
        'input-date': 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(0,245,212,0.06), 0 10px 28px rgba(0,0,0,0.22)',
        'input-date-hover': 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 18px rgba(255,45,133,0.14)',
        'export-panel': '0 0 0 1px rgba(255,45,133,0.16), 0 24px 70px rgba(0,0,0,0.42), 0 0 44px rgba(0,245,212,0.1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
