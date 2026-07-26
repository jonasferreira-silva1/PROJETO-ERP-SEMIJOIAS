/** @type {import('tailwindcss').Config} */
module.exports = {
  // Apenas arquivos raiz e pastas dentro de src
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        adorne: {
          teal: '#0B3A34',       // Cor primária institucional
          gold: '#C5A880',       // Dourado para acentos
          background: '#F4F9F8', // Fundo claro sofisticado
          text: '#0F211F',       // Texto primário escuro
          gray: '#607371',       // Texto secundário cinza-azulado
        }
      }
    },
  },
  plugins: [],
}
