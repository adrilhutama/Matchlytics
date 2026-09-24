/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ["DM Sans", "system-ui", "sans-serif"],
        mono:  ["DM Mono", "Consolas", "monospace"],
      },
      colors: {
        pitch: {
          950: "#080b11",
          900: "#0e1117",
          850: "#11151f",
          800: "#151a24",
          700: "#1d2536",
          600: "#273045",
          500: "#344055",
        },
        slate: {
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
        },
        amber: {
          500: "#f59e0b",
          400: "#fbbf24",
          300: "#fcd34d",
        },
        emerald: {
          500: "#10b981",
          400: "#34d399",
        },
        rose: {
          500: "#f43f5e",
          400: "#fb7185",
        },
        sky: {
          500: "#0ea5e9",
          400: "#38bdf8",
        },
      },
      animation: {
        "shimmer":       "shimmer 1.6s ease-in-out infinite",
        "fade-in":       "fadeIn 0.35s ease-out both",
        "slide-up":      "slideUp 0.35s ease-out both",
        "pulse-once":    "pulseOnce 0.6s ease-out",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-600px 0" },
          "100%": { backgroundPosition:  "600px 0" },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        slideUp: {
          from: { opacity: 0, transform: "translateY(12px)" },
          to:   { opacity: 1, transform: "translateY(0)" },
        },
        pulseOnce: {
          "0%, 100%": { transform: "scale(1)" },
          "50%":      { transform: "scale(1.04)" },
        },
      },
    },
  },
  plugins: [],
}
