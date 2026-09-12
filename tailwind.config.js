/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0F1729",
        inkline: "#1B2740",
        paper: "#F7F5F0",
        paperline: "#E6E1D6",
        slate: "#64748B",
        flag: "#E8A23D",
        verified: "#2D9C8A",
        alert: "#C4523A"
      },
      fontFamily: {
        serif: ["Source Serif 4", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"]
      }
    }
  },
  plugins: []
};
