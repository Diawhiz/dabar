/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "sans-serif"],
        editorial: ['"Newsreader"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', "Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        base: "var(--bg-base)",
        surface: "var(--bg-surface)",
        "surface-hover": "var(--bg-surface-hover)",
        "surface-active": "var(--bg-surface-active)",
        border: "var(--border-base)",
        "border-strong": "var(--border-strong)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-muted": "var(--accent-muted)",
        "accent-glow": "var(--accent-glow)",
        "accent-fg": "var(--accent-fg)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      borderRadius: {
        "3xl": "1.75rem",
        "4xl": "2.25rem",
        "5xl": "3rem",
      },
      transitionTimingFunction: {
        fluid: "cubic-bezier(0.32, 0.72, 0, 1)",
        spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      },
      boxShadow: {
        "inner-glow": "inset 0 1px 1px 0 rgba(255, 255, 255, 0.12)",
        "inner-gold": "inset 0 1px 1px 0 rgba(229, 169, 60, 0.25)",
        "double-bezel": "0 0 0 1px rgba(255, 255, 255, 0.07), 0 20px 50px -15px rgba(0, 0, 0, 0.7)",
        ambient: "0 30px 70px -15px rgba(0, 0, 0, 0.5)",
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
        "3xs": ["0.55rem", { lineHeight: "0.85rem" }],
      },
      spacing: {
        sidebar: "240px",
      },
    },
  },
  plugins: [],
};
