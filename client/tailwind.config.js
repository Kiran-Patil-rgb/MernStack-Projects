
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ], theme: {
    extend: {
      colors: {
        purple: "#9112BC",
        lightpur: "#AE75DA",
        offbrown: "#E9E294",
        offwhite: "#FFFCB8",
         dark: "#000000",
         light: "#EFECE3",
         primary:'#9112BC',

      }
    },
  },
  plugins: [],
}
