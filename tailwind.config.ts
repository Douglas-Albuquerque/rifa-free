import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f5f7f6",
          100: "#e6ebe8",
          200: "#cbd6d0",
          300: "#a5b8ad",
          400: "#7a9586",
          500: "#5c796a",
          600: "#476053",
          700: "#3a4d44",
          800: "#313f39",
          900: "#2b3631",
          950: "#151e1a"
        },
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22"
        },
        paper: "#f7f5ef",
        cream: "#fffdf7"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(21,30,26,.04), 0 8px 24px -12px rgba(21,30,26,.15)",
        lift: "0 18px 40px -24px rgba(2,44,34,.45)"
      },
      keyframes: {
        pop: { "0%": { transform: "scale(.92)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        rise: { "0%": { transform: "translateY(8px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        pulseSoft: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".45" } }
      },
      animation: {
        pop: "pop .25s ease-out",
        rise: "rise .35s ease-out",
        pulseSoft: "pulseSoft 1.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
