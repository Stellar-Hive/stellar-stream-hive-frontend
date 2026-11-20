import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0b0e14",
        surface: "#12161f",
        "surface-hover": "#171c28",
        border: "#242b3a",
        primary: {
          DEFAULT: "#6ee7b7",
          dark: "#34d399",
          light: "#a7f3d0",
        },
        accent: {
          DEFAULT: "#818cf8",
          dark: "#6366f1",
        },
        muted: "#8b93a7",
        danger: "#f87171",
        warning: "#fbbf24",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
