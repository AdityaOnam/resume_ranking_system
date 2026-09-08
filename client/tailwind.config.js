/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "bg": "var(--rr-bg)",
        "surface": "var(--rr-surface)",
        "surface-2": "var(--rr-surface-2)",
        "line": "var(--rr-line)",
        "line-strong": "var(--rr-line-strong)",
        "text": "var(--rr-text)",
        "muted": "var(--rr-muted)",
        "accent": "var(--rr-accent)",
        "accent-text": "var(--rr-accent-text)",
        "tint": "var(--rr-tint)",
        "tint-strong": "var(--rr-tint-strong)",
        "success": "#10B981",
        "warning": "#fbbf24",
        "error": "#ffb4ab",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["Geist", "monospace"],
        display: ["Inter", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.375rem",
        md: "0.5rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px",
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.7s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'pulse-slow': 'pulse 3s infinite',
        'ticker': 'tickerFade 3s ease-in-out both',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeInUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        tickerFade: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '12%, 88%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
};
