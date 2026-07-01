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
                                        rose: '#fb7185',
                                        cyan: '#06b6d4'
                                },
                                ink: {
                                        950: '#030509',
                                        900: '#0a0e1a',
                                        850: '#0f1424',
                                        800: '#151b30',
                                        750: '#1a213d',
                                        700: '#212848',
                                        600: '#2a335c',
                                        500: '#354070',
                                        primary: '#e8ecf4',
                                        secondary: '#8b95a8',
                                        muted: '#5a6478',
                                        faint: '#3a4256'
                                }
                        },
                        fontFamily: {
                                sans: ['Tajawal', 'Inter', 'system-ui', 'sans-serif'],
                                mono: ['SFMono-Regular', 'Menlo', 'monospace']
                        },
                        animation: {
                                'spin-slow': 'spin 3s linear infinite',
                                'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
                                float: 'float 6s ease-in-out infinite',
                                shimmer: 'shimmer 2s linear infinite',
                                'slide-up': 'slide-up 0.3s ease-out',
                                'slide-down': 'slide-down 0.3s ease-out',
                                'fade-in': 'fade-in 0.3s ease-out',
                                'scale-in': 'scale-in 0.2s ease-out',
                                'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
                                'ping': 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
                                'aurora-1': 'aurora-1 12s ease-in-out infinite',
                                'aurora-2': 'aurora-2 15s ease-in-out infinite',
                                'aurora-3': 'aurora-3 18s ease-in-out infinite',
                                'aurora-4': 'aurora-4 20s ease-in-out infinite'
                        },
                        keyframes: {
                                'pulse-soft': {
                                        '0%, 100%': { opacity: '1' },
                                        '50%': { opacity: '0.6' }
                                },
                                float: {
                                        '0%, 100%': { transform: 'translateY(0)' },
                                        '50%': { transform: 'translateY(-8px)' }
                                },
                                shimmer: {
                                        '0%': { backgroundPosition: '-200% 0' },
                                        '100%': { backgroundPosition: '200% 0' }
                                },
                                'slide-up': {
                                        '0%': { transform: 'translateY(8px)', opacity: '0' },
                                        '100%': { transform: 'translateY(0)', opacity: '1' }
                                },
                                'slide-down': {
                                        '0%': { transform: 'translateY(-8px)', opacity: '0' },
                                        '100%': { transform: 'translateY(0)', opacity: '1' }
                                },
                                'fade-in': {
                                        '0%': { opacity: '0' },
                                        '100%': { opacity: '1' }
                                },
                                'scale-in': {
                                        '0%': { transform: 'scale(0.95)', opacity: '0' },
                                        '100%': { transform: 'scale(1)', opacity: '1' }
                                },
                                'glow-pulse': {
                                        '0%, 100%': { boxShadow: '0 0 8px rgba(245,181,68,0.3)' },
                                        '50%': { boxShadow: '0 0 20px rgba(245,181,68,0.6)' }
                                },
                                'aurora-1': {
                                        '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                                        '33%': { transform: 'translate(30px, -30px) scale(1.1)' },
                                        '66%': { transform: 'translate(-20px, 20px) scale(0.9)' }
                                },
                                'aurora-2': {
                                        '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                                        '33%': { transform: 'translate(-25px, 25px) scale(0.9)' },
                                        '66%': { transform: 'translate(35px, -15px) scale(1.1)' }
                                },
                                'aurora-3': {
                                        '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                                        '33%': { transform: 'translate(20px, 20px) scale(1.05)' },
                                        '66%': { transform: 'translate(-30px, -10px) scale(0.95)' }
                                },
                                'aurora-4': {
                                        '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                                        '33%': { transform: 'translate(-15px, -25px) scale(1.1)' },
                                        '66%': { transform: 'translate(25px, 15px) scale(0.9)' }
                                }
                        }
                }
        },
        plugins: []
};
