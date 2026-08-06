/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        signal: {
          bg: "#090A0F",       // Deep Obsidian Midnight
          panel: "#12151E",    // Dark Velvet Surface
          card: "#1A1E2B",     // Elevated Glass Card
          border: "#252B3B",   // Crisp Precision Border
          hover: "#222736",    // Interactive Hover Surface
        },
        pulse: {
          gold: "#F59E0B",     // Warm Regal Gold
          amber: "#EA580C",    // Sunset Orange Accent
          cyan: "#06B6D4",     // Electric Cyan Accent
          violet: "#8B5CF6",   // Royal Violet Accent
        },
        text: {
          primary: "#F8FAFC",  // High-Contrast White
          secondary: "#94A3B8",// Refined Slate Gray
          muted: "#64748B",    // Subtle Muted Gray
        },
      },
      boxShadow: {
        signal: "0 20px 40px -15px rgba(0, 0, 0, 0.7)",
        pulse: "0 0 25px rgba(245, 158, 11, 0.25)",
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

