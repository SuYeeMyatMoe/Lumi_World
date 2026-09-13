import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        lumi: {
          bg: '#0a0a0f',
          panel: '#12121a',
          border: '#22222e',
          text: '#e8e8f0',
          muted: '#8a8a9a',
          focus: '#22d3ee',
          mission: '#a3e635',
          warn: '#f59e0b',
          danger: '#ef4444',
          success: '#34d399',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
