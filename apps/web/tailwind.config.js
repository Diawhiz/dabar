/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Literata"', "Georgia", "serif"],
        body: ['"Work Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#14110F",
        paper: "#F7F3EA",
        ember: "#E4572E",
        muted: "#5C574E",
        surface: "#EDE8DC",
        border: "#D6D0C4",
      },
      boxShadow: {
        card: "0 2px 8px rgba(20, 17, 15, 0.06)",
        lifted: "0 8px 24px rgba(20, 17, 15, 0.08)",
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
  plugins: [],
};
