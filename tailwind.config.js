/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        crm: {
          bgDark: '#070A11',
          cardDark: '#0B0F17',
          borderDark: '#1E293B',
          accent: '#4352E8',
        }
      }
    },
  },
  plugins: [],
}
