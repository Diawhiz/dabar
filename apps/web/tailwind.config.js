/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        body: ['"Source Serif 4"', "Georgia", "serif"],
        sans: ['"Work Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        base: "#1C1815",
        unconfirmed: "#8A7F73",
        confirmed: "#F5EFE6",
        accent: "#D4913A",
        ember: "#D4913A", // Alias for accent
        paper: "#FAF6EF",
        surface: "#28231E",
        border: "#3D352E",
        ink: "#1C1815",
        muted: "#8A7F73",
      },
      boxShadow: {
        card: "0 2px 8px rgba(28, 24, 21, 0.08)",
        lifted: "0 8px 24px rgba(28, 24, 21, 0.12)",
        glow: "0 0 16px rgba(212, 145, 58, 0.35)",
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
  plugins: [],
};
