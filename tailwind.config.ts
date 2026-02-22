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
          // New cinematic palette
          midnight: "#050e1a",
          deep: "#0d1f35",
          ice: "#a8d4f0",
          frost: "#d4ebf7",
          gold: "#f5c842",
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
        speedLine: {
          "0%": { transform: "translateX(-120%) skewX(-20deg)", opacity: "0" },
          "30%": { opacity: "1" },
          "100%": { transform: "translateX(120vw) skewX(-20deg)", opacity: "0" },
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
        "fade-in": "fadeIn 0.7s ease-out forwards",
        "slide-up": "slideUp 0.6s ease-out forwards",
        "slide-up-1": "slideUp 0.6s ease-out 0.1s forwards",
        "slide-up-2": "slideUp 0.6s ease-out 0.2s forwards",
        "slide-up-3": "slideUp 0.6s ease-out 0.3s forwards",
        "slide-up-4": "slideUp 0.6s ease-out 0.4s forwards",
        "slide-down": "slideDown 0.5s ease-out forwards",
        shimmer: "shimmer 2.5s linear infinite",
        "pulse-gold": "pulseGold 2.5s ease-in-out infinite",
        "speed-line": "speedLine 2.4s ease-in-out infinite",
        "float-up": "floatUp 4s ease-in-out infinite",
        "scale-in": "scaleIn 0.5s ease-out forwards",
      },
      backgroundImage: {
        "alpine-gradient":
          "linear-gradient(160deg, #050e1a 0%, #0d1f35 40%, #1a3a5c 75%, #2d4a20 100%)",
        "gold-shimmer":
          "linear-gradient(90deg, transparent, rgba(232,160,32,0.4), transparent)",
        "ice-gradient":
          "linear-gradient(135deg, #0d1f35 0%, #1a3a5c 50%, #2d6a9f 100%)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
