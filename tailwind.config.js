/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'roboto': ['var(--font-roboto)', 'sans-serif'],
        'orbitron': ['var(--font-orbitron)', 'sans-serif'],
        'ibm-plex-mono': ['var(--font-ibm-plex-mono)', 'monospace'],
        'montserrat': ['var(--font-montserrat)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
