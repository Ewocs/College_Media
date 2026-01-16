export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'rgb(var(--bg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--bg-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--bg-tertiary) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
        },
        brand: {
          primary: 'rgb(var(--brand-primary) / <alpha-value>)',
        },
        border: 'rgb(var(--border-color) / <alpha-value>)',
        coral: {
          50: "#fef5f3",
          100: "#fde9e5",
          200: "#fbd3cb",
          300: "#f8b3a1",
          400: "#f48968",
          500: "#ee6c4d",
          600: "#dc4a2a",
          700: "#b83820",
          800: "#97311e",
          900: "#7d2d1f",
        },
      },
    },
  },
  plugins: [],
};
