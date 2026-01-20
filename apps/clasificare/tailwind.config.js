/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        categorie: {
          u: '#22c55e',
          mpg: '#3b82f6',
          g: '#f97316',
          dg: '#ef4444',
          eg: '#7c3aed'
        }
      }
    },
  },
  plugins: [],
}
