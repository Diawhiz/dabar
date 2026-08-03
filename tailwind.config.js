/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Lora", "Georgia", "serif"],
        sans: [
          "Plus Jakarta Sans",
          "DM Sans",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      colors: {
        paper: "#FAF7F2",
        parchment: "#F5F0E8",
        linen: "#EFE6D7",
        navy: {
          DEFAULT: "#1B2A4A",
          dark: "#0F1A30",
          light: "#2B3F68",
        },
        gold: {
          DEFAULT: "#B8962E",
          light: "#D4AF37",
          dark: "#96781D",
        },
        walnut: "#6F5A3B",
        umber: "#3D3428",
        clay: "#B48B68",
        cream: "#FFFDF8",
      },
      boxShadow: {
        warm: "0 24px 70px rgba(82, 58, 30, 0.12)",
        soft: "0 14px 34px rgba(82, 58, 30, 0.08)",
        glow: "0 0 30px rgba(184, 150, 46, 0.25)",
        navyGlow: "0 10px 40px rgba(27, 42, 74, 0.22)",
      },
      animation: {
        'soft-pulse': 'soft-pulse 2.4s ease-in-out infinite',
        'subtle-float': 'subtle-float 4s ease-in-out infinite',
        'wave-bar': 'wave-bar 1.2s ease-in-out infinite alternate',
      },
      keyframes: {
        'soft-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(184, 150, 46, 0.35)' },
          '50%': { boxShadow: '0 0 0 14px rgba(184, 150, 46, 0)' },
        },
        'subtle-float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'wave-bar': {
          '0%': { transform: 'scaleY(0.3)' },
          '100%': { transform: 'scaleY(1)' },
        }
      }
    },
  },
  plugins: [],
};
