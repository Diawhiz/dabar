/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        body: ['"Source Serif 4"', "Georgia", "serif"],
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      colors: {
        base: "var(--bg-base)",
        surface: "var(--bg-surface)",
        "surface-hover": "var(--bg-surface-hover)",
        border: "var(--border-base)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        unconfirmed: "var(--text-unconfirmed)",
        confirmed: "var(--text-confirmed)",
        accent: "var(--accent)",
      },
    },
  },
  plugins: [],
};
