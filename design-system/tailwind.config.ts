import type { Config } from "tailwindcss";

/**
 * The Eture Sports Tailwind mapping, as used by the Operations Database.
 *
 * Two things to keep if you change anything else:
 *
 *  1. `darkMode: ["selector", '[data-theme="dark"]']`. The theme is an
 *     attribute set by an inline script before paint, not a media query and
 *     not a class — that is what keeps the page from flashing the wrong
 *     colours on load.
 *
 *  2. Every surface colour is `rgb(var(--token) / <alpha-value>)`, never a
 *     hex. That placeholder is what makes `bg-ink-900/60` and
 *     `border-ink-600/40` work; a hex here would silently break every alpha
 *     modifier in the codebase.
 *
 * Brand colours are the exception and are hard-coded: a brand colour that
 * changes with the theme is not a brand colour.
 *
 * Pair with tokens.css (or the original src/app/globals.css), which defines
 * the variables this file points at.
 */
const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces and borders — theme-aware through the CSS variables.
        ink: {
          950: "rgb(var(--ink-950) / <alpha-value>)", // the page
          900: "rgb(var(--ink-900) / <alpha-value>)", // raised solid
          800: "rgb(var(--ink-800) / <alpha-value>)", // subtle fill
          700: "rgb(var(--ink-700) / <alpha-value>)", // hover fill, chips
          600: "rgb(var(--ink-600) / <alpha-value>)", // hairlines
        },
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        bone: "rgb(var(--fg) / <alpha-value>)", // alias kept for older usages
        // Brand marks — fixed in both themes.
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
        // The bottom navigation's lift: a shadow plus a faint brand glow.
        glow: "0 12px 40px rgba(0,0,0,.35), 0 0 40px rgba(196,43,43,.14)",
      },
    },
  },
  plugins: [],
};

export default config;
