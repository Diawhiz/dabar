/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        editorial: ["Lora", "serif"],
        display: ["Outfit", "sans-serif"],
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        signal: {
          bg: "var(--color-bg)",
          panel: "var(--color-panel)",
          card: "var(--color-card)",
          border: "var(--color-border)",
          hover: "var(--color-hover)",
        },
        pulse: {
          gold: "var(--color-gold)",
          amber: "var(--color-amber)",
          cyan: "var(--color-cyan)",
          violet: "var(--color-violet)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
        },
      },
      boxShadow: {
        signal: "var(--shadow-signal)",
        pulse: "var(--shadow-pulse)",
        laser: "0 0 25px rgba(234, 88, 12, 0.25)",
        glow: "0 0 40px -10px rgba(245, 158, 11, 0.15)",
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
        'signal-wave': 'signal-wave 1.2s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.3)' },
          '50%': { boxShadow: '0 0 0 12px rgba(245, 158, 11, 0)' },
        },
        'signal-wave': {
          '0%': { transform: 'scaleY(0.25)' },
          '100%': { transform: 'scaleY(1.0)' },
        },
      }
    },
  },
  plugins: [],
};



