import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FAF8F4',
        surface: '#FFFFFF',
        sidebar: '#FCFAF7',
        border: '#EAE5DE',
        'border-subtle': '#EFEAE3',
        text: '#1B1815',
        'text-secondary': '#7A736C',
        'text-tertiary': '#A39B92',
        accent: '#C1552C',
        'accent-hover': '#A8461F',
        'accent-soft': '#FBE7DC',
        online: '#3F9142',
        'input-bg': '#F3EFE9',
        'active-item-bg': '#F3ECE2',
        'bubble-other': '#F5F1EB',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
