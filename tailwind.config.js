/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src_fix/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        heebo: ["Heebo", "sans-serif"],
      },
    },
  },
  plugins: [],
};
