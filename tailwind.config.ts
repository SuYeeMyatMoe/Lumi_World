import type { Config } from 'tailwindcss';

// Palette: deep navy neutrals, indigo hairlines, ONE accent (desaturated violet).
// Semantic colors are softened toward the same value range so nothing screams.
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        lumi: {
          bg: '#0b0d1c',
          panel: '#141833',
          raised: '#1b2040',
          border: '#2a3060',
          text: '#eceefc',
          muted: '#8f95bd',
          focus: '#8b85f5',
          sky: '#7cc4ff',
          mission: '#8b85f5',
          warn: '#f2b76b',
          danger: '#f07d8f',
          success: '#7fe0b8',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        // Tinted to the navy base, never grey/black.
        card: '0 1px 0 rgba(255,255,255,0.05) inset, 0 12px 32px -16px rgba(6, 8, 30, 0.9)',
        cta: '0 8px 24px -10px rgba(139, 133, 245, 0.55)',
      },
      backgroundImage: {
        cta: 'linear-gradient(95deg, #cfc2ff 0%, #b8f0dc 100%)',
        'panel-glow': 'radial-gradient(60% 38% at 50% 0%, rgba(139,133,245,0.16) 0%, rgba(139,133,245,0) 70%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
