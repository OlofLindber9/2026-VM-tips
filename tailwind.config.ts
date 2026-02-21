import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ski: {
          blue: "#1a3a5c",
          light: "#2d6a9f",
          snow: "#f0f4f8",
          accent: "#e8a020",
        },
      },
    },
  },
  plugins: [],
};
export default config;
