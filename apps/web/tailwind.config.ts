/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#11161c",
        panelMuted: "#16202a",
        line: "#273341",
        fg: "#dde4eb",
        fgMuted: "#98a7b8",
        success: "#3aa675",
        warning: "#d39b3b",
        critical: "#d45c4a"
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"]
      }
    }
  },
  plugins: []
};