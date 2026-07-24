import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ETURE Sports dark editorial palette
        ink: {
          950: "#0a0b0f",
          900: "#0f1117",
          800: "#161922",
          700: "#1e222e",
          600: "#2a2f3d",
        },
        brand: {
          DEFAULT: "#e11d2a",
          light: "#ff3b47",
          dark: "#b3131e",
        },
        accent: "#f5c518",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
