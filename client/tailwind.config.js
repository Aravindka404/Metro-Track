/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
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
