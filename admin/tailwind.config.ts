import type { Config } from "tailwindcss";

const DYNAMIC_COLORS = [
  "emerald",
  "yellow",
  "red",
  "teal",
  "blue",
  "purple",
  "orange",
  "cyan",
  "gray",
] as const;

const safelist: string[] = [];
for (const color of DYNAMIC_COLORS) {
  safelist.push(
    `bg-${color}-500/10`,
    `bg-${color}-500/20`,
    `bg-${color}-500`,
    `text-${color}-400`,
    `text-${color}-500`,
    `border-${color}-500/20`,
    `border-${color}-500/60`,
    `border-${color}-500`,
    `border-r-${color}-500/60`,
    `from-${color}-500`,
    `to-${color}-600`,
    `from-${color}-500/20`,
    `to-${color}-500/20`,
    `shadow-${color}-500/20`,
    `shadow-${color}-500/25`,
  );
}

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  safelist,
  theme: {
    extend: {
      colors: {
        border: "hsl(240 3.7% 15.9%)",
        input: "hsl(240 3.7% 15.9%)",
        ring: "hsl(142 76% 36%)",
        background: "hsl(240 10% 3.9%)",
        foreground: "hsl(0 0% 98%)",
        primary: {
          DEFAULT: "hsl(142 76% 36%)",
          foreground: "hsl(355 100% 97.3%)",
        },
        muted: {
          DEFAULT: "hsl(240 3.7% 15.9%)",
          foreground: "hsl(240 5% 64.9%)",
        },
        card: {
          DEFAULT: "hsl(240 10% 3.9%)",
          foreground: "hsl(0 0% 98%)",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
