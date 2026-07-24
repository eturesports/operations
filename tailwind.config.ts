import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces & borders (theme-aware via CSS variables → light/dark auto-flip)
        ink: {
          950: "rgb(var(--ink-950) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
        },
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        bone: "rgb(var(--fg) / <alpha-value>)", // alias kept for existing usages
        // Brand marks (fixed in both themes)
        brand: {
          DEFAULT: "#C42B2B",
          light: "#e0433f",
          dark: "#9B1A1A",
        },
        accent: "#C9A227",
        paper: "#EDE8E1",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 12px 40px rgba(0,0,0,.35), 0 0 40px rgba(196,43,43,.14)",
      },
    },
  },
  plugins: [],
};

export default config;
