/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        metro: {
          teal: '#00A896',
          green: '#8CC63F',
          cyan: '#00E5FF',
          dark: '#0B0F19',
          card: 'rgba(15, 23, 42, 0.78)',
        }
      }
    },
  },
  plugins: [],
}
