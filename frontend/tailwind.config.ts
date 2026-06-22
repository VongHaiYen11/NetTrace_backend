import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      colors: {
        surface: '#F8FAFC',
        ink: '#0F172A',
        muted: '#64748B',
        line: '#E2E8F0',
        panel: '#FFFFFF',
        signal: '#0EA5E9',
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config;
