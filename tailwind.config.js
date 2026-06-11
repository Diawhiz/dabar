/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Lora", "Georgia", "serif"],
        sans: [
          "DM Sans",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        paper: "#FAF7F2",
        parchment: "#F5F0E8",
        linen: "#EFE6D7",
        navy: "#1B2A4A",
        gold: "#B8962E",
        walnut: "#6F5A3B",
        umber: "#3D3428",
        clay: "#B48B68",
        cream: "#FFFDF8",
      },
      boxShadow: {
        warm: "0 24px 70px rgba(82, 58, 30, 0.12)",
        soft: "0 14px 34px rgba(82, 58, 30, 0.10)",
      },
    },
  },
  plugins: [],
};
