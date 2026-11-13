import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--brand-primary, #D97706)",
          secondary: "var(--brand-secondary, #F59E0B)",
          accent: "var(--brand-accent, #FBBF24)",
          bg: "var(--brand-bg, #0C0A09)",
          surface: "var(--brand-surface, #1C1917)",
          card: "var(--brand-card, #262220)",
          text: "var(--brand-text, #FAFAF9)",
          muted: "var(--brand-muted, #A8A29E)",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading, 'Cairo')", "sans-serif"],
        body: ["var(--font-body, 'Tajawal')", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
