/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}", 
    "./pages/**/*.{js,ts,jsx,tsx,mdx}", 
    "./components/**/*.{js,ts,jsx,tsx,mdx}", 
  ],
  theme: {
    extend: {
      // You can add your theme customizations here
      // For example:
      // colors: {
      //   brand: '#123456',
      // },
    },
  },
  plugins: [
    // You can add Tailwind plugins here if needed
  ],
}; 