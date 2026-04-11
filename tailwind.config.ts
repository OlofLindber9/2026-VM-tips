import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: {
          midnight: "#040d08",
          deep:     "#091a10",
          green:    "#0f2d1a",
          light:    "#1a4a28",
          pitch:    "#2d6a4f",
          accent:   "#e8a020",
          gold:     "#f5c842",
          ice:      "#b8f0c8",
          frost:    "#d4f7e2",
        },
      },
      fontFamily: {
        heading: ["Barlow Condensed", "Impact", "sans-serif"],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(28px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseGold: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(232, 160, 32, 0)" },
          "50%": { boxShadow: "0 0 20px 4px rgba(232, 160, 32, 0.35)" },
        },
        floatUp: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in":    "fadeIn 0.7s ease-out forwards",
        "slide-up":   "slideUp 0.6s ease-out forwards",
        "slide-up-1": "slideUp 0.6s ease-out 0.1s forwards",
        "slide-up-2": "slideUp 0.6s ease-out 0.2s forwards",
        "slide-up-3": "slideUp 0.6s ease-out 0.3s forwards",
        "slide-up-4": "slideUp 0.6s ease-out 0.4s forwards",
        "slide-down": "slideDown 0.5s ease-out forwards",
        shimmer:      "shimmer 2.5s linear infinite",
        "pulse-gold": "pulseGold 2.5s ease-in-out infinite",
        "float-up":   "floatUp 4s ease-in-out infinite",
        "scale-in":   "scaleIn 0.5s ease-out forwards",
      },
      backgroundImage: {
        "pitch-gradient":
          "linear-gradient(160deg, #040d08 0%, #091a10 40%, #0f2d1a 75%, #1a4a28 100%)",
        "gold-shimmer":
          "linear-gradient(90deg, transparent, rgba(232,160,32,0.4), transparent)",
        "deep-gradient":
          "linear-gradient(135deg, #091a10 0%, #0f2d1a 50%, #1a4a28 100%)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
