/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Tajawal"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', 'monospace']
      },
      colors: {
        // Unique dark theme: deep navy → obsidian → subtle violet accents
        ink: {
          950: '#050813',
          900: '#0a0e1f',
          800: '#10152a',
          700: '#1a2138',
          600: '#252e4d',
          500: '#3a4570'
        },
        accent: {
          gold: '#f5b544',
          mint: '#22d3a4',
          rose: '#f43f7a',
          azure: '#3b82f6',
          violet: '#a855f7'
        }
      },
      backgroundImage: {
        'grid-glow':
          'radial-gradient(circle at 1px 1px, rgba(245,181,68,0.08) 1px, transparent 0)',
        'hero-radial':
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(168,85,247,0.15), transparent)'
      },
      boxShadow: {
        glow: '0 0 24px rgba(245,181,68,0.25)',
        'glow-mint': '0 0 24px rgba(34,211,164,0.25)',
        'glow-rose': '0 0 24px rgba(244,63,122,0.25)',
        'inset-line': 'inset 0 1px 0 rgba(255,255,255,0.04)'
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'float': 'float 6s ease-in-out infinite'
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' }
        }
      }
    }
  },
  plugins: []
};
