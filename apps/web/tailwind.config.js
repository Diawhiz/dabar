/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "-apple-system", "sans-serif"],
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
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
      },
      spacing: {
        sidebar: "220px",
      },
    },
  },
  plugins: [],
};
