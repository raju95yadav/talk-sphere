/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'accent-primary': '#6366F1',
        'accent-secondary': '#8B5CF6',
        'accent-indigo': '#6366F1',
        'accent-violet': '#8B5CF6',
        'bg-main': '#090A0F',
        'bg-surface-1': '#12131C',
        'bg-card': '#1C1D2A',
        'bg-card-secondary': '#12131C',
        'text-main': '#F8FAFC',
        'text-muted': '#94A3B8',
        'border-main': 'rgba(255, 255, 255, 0.08)',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
      },
    },
  },
  plugins: [],
}
