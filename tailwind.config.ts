import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ETURE Sports — paleta editorial oscura (del catálogo MSOC)
        ink: {
          950: "#0C0A09", // fondo base (negro cálido)
          900: "#141010",
          800: "#1b1613",
          700: "#241c19",
          600: "#3a2e29", // bordes suaves
        },
        brand: {
          DEFAULT: "#C42B2B",
          light: "#e0433f",
          dark: "#9B1A1A",
        },
        accent: "#C9A227", // oro
        paper: "#EDE8E1",
        bone: "#D0CAC4",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 20px 60px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.10), 0 0 50px rgba(196,43,43,.10)",
      },
    },
  },
  plugins: [],
};

export default config;
