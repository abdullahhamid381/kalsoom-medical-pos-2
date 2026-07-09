/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef2f8',
          100: '#d6e0ee',
          200: '#aec0dd',
          300: '#7f9bc8',
          400: '#5577ad',
          500: '#365b91',
          600: '#264576',
          700: '#1c3460',
          800: '#13244a',
          900: '#0c1933',
          950: '#070f20'
        },
        crimson: {
          50: '#fdecec',
          100: '#fbd2d2',
          200: '#f5a3a3',
          300: '#ec7272',
          400: '#e14a4a',
          500: '#d62828',
          600: '#b81f20',
          700: '#94181c',
          800: '#73151a',
          900: '#561318'
        },
        ink: '#0f1b2d',
        mist: '#f5f7fb'
      },
      fontFamily: {
        display: ['var(--font-sora)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-jbmono)', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,27,45,0.04), 0 4px 16px rgba(15,27,45,0.06)',
        pop: '0 8px 30px rgba(15,27,45,0.12)'
      }
    }
  },
  plugins: []
};
