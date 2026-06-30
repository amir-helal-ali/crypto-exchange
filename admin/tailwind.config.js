/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        accent: {
          gold: '#f5b544',
          violet: '#a855f7',
          mint: '#22d3a4',
          azure: '#3b82f6',
          rose: '#f43f7a',
          cyan: '#22d3ee'
        }
      },
      fontFamily: {
        sans: ['Tajawal', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['SFMono-Regular', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
};
