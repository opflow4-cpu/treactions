import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cyan: {
          DEFAULT: '#00d4ff',
          dim:     'rgba(0,212,255,0.12)',
          glow:    'rgba(0,212,255,0.35)',
        },
        surface: {
          DEFAULT: 'rgba(5,12,30,0.75)',
          dark:    'rgba(2,6,18,0.95)',
          border:  'rgba(0,212,255,0.1)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      keyframes: {
        'glow-pulse': {
          '0%,100%': { opacity: '0.5' },
          '50%':     { opacity: '1'   },
        },
        'scan': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'border-flow': {
          '0%,100%': { borderColor: 'rgba(0,212,255,0.15)' },
          '50%':     { borderColor: 'rgba(0,212,255,0.45)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)'   },
        },
      },
      animation: {
        'glow-pulse':   'glow-pulse 2.5s ease-in-out infinite',
        'scan':         'scan 6s linear infinite',
        'border-flow':  'border-flow 3s ease-in-out infinite',
        'fade-in':      'fade-in 0.35s ease-out',
      },
      backgroundImage: {
        'hud-grid': `
          linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
        `,
        'radial-glow-tl': 'radial-gradient(ellipse at 0% 0%, rgba(0,100,255,0.08) 0%, transparent 55%)',
        'radial-glow-br': 'radial-gradient(ellipse at 100% 100%, rgba(120,0,200,0.06) 0%, transparent 55%)',
      },
      backgroundSize: {
        'hud-grid': '48px 48px',
      },
      boxShadow: {
        'cyan-sm': '0 0 12px rgba(0,212,255,0.25)',
        'cyan-md': '0 0 30px rgba(0,212,255,0.2), 0 0 60px rgba(0,212,255,0.08)',
        'cyan-lg': '0 0 60px rgba(0,212,255,0.25), 0 0 120px rgba(0,212,255,0.1)',
        'card':    '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.6), 0 0 30px rgba(0,212,255,0.1), inset 0 1px 0 rgba(0,212,255,0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
