/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F5F0E8',
        'cream-dark': '#E8E0D0',
        primary: '#2d5a3d',
        'primary-dark': '#1a3a2a',
        'primary-light': '#3d7a5d',
        accent: '#c4a265',
      },
    },
  },
  plugins: [],
};
