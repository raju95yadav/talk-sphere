/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'accent-primary': '#ff0055',
        'accent-secondary': '#702cf9',
        'bg-main': '#121218',
        'bg-card': '#21212b',
        'bg-card-secondary': '#2d2d3a',
        'text-muted': '#a0a0b8',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
      },
    },
  },
  plugins: [],
}
