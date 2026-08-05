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
          bg: "#0B0F19",       // Ink Midnight — deep acoustic dark foundation
          panel: "#141C2E",    // Transmission Slate — dark structured surface
          card: "#1E293B",     // Frequency Card — contrast elevated surface
          border: "#2A3852",   // Frequency Line — precise low-contrast border
          hover: "#334155",    // Interactive hover state
        },
        pulse: {
          gold: "#F2B824",     // Spoken Pulse — energetic signal accent
          amber: "#F97316",    // Laser Cut Highlight — active distillation marker
          cyan: "#38BDF8",     // Transmission Blue — secondary status indicator
        },
        text: {
          primary: "#F8FAFC",  // Pure Vocal White — high contrast readable text
          secondary: "#94A3B8",// Waveform Gray — secondary metadata
          muted: "#64748B",    // Subtle label gray
        },
      },
      boxShadow: {
        signal: "0 20px 50px -10px rgba(11, 15, 25, 0.8)",
        pulse: "0 0 35px rgba(242, 184, 36, 0.22)",
        laser: "0 0 25px rgba(249, 115, 22, 0.3)",
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
        'signal-wave': 'signal-wave 1.2s ease-in-out infinite alternate',
        'laser-scan': 'laser-scan 3s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(242, 184, 36, 0.3)' },
          '50%': { boxShadow: '0 0 0 12px rgba(242, 184, 36, 0)' },
        },
        'signal-wave': {
          '0%': { transform: 'scaleY(0.25)' },
          '100%': { transform: 'scaleY(1.0)' },
        },
        'laser-scan': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        }
      }
    },
  },
  plugins: [],
};
