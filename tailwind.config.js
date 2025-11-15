/** @type {import('tailwindcss').Config} */
module.exports = {
  // Purge unused CSS for production
  content: [
    './layouts/**/*.html',
    './layouts/**/*.html.html',
    './content/**/*.md',
    './content/**/*.html',
    './static/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0066FF',
        accent: '#FFD700',
        emergency: '#FF0000',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      height: {
        '20': '3.2rem',
      },
    }
  },
  plugins: [],
}