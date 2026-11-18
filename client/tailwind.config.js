/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paper White — the working surface (≈60%)
        paper: '#ffffff',
        canvas: '#fbfbfc',

        // Ink Black — type, dark surfaces (≈30%)
        ink: {
          950: '#050505',
          900: '#0a0a0a',
          800: '#1c1c1c',
          700: '#333333',
          600: '#4d4d4d',
          500: '#6b6b6b',
          400: '#8f8f8f',
          300: '#b4b4b4',
          200: '#d9d9d9',
          100: '#ededed',
          50: '#f7f7f7',
        },

        // Hairlines are ink at low opacity
        line: '#e6e6e7',
        'line-strong': '#d5d5d7',

        // Cornflower Blue — interaction and importance (≈10%)
        accent: {
          50: '#eef4ff',
          100: '#dce8ff',
          200: '#b9d2ff',
          300: '#93b9ff',
          500: '#548cff',
          600: '#548cff',
          700: '#2b62c4',
        },

        // Semantic states only — never decorative
        positive: { 50: '#ecf6f0', 100: '#d7ebdf', 600: '#1f7a4d', 700: '#18603d' },
        warn:     { 50: '#fdf4e6', 100: '#f7e6c9', 600: '#94631a', 700: '#7a5013' },
        danger:   { 50: '#fdeeee', 100: '#f7d8d7', 600: '#b4302e', 700: '#962725' },

        // Legacy aliases so older files still resolve to the palette
        surface: {
          900: '#ffffff',
          800: '#ffffff',
          700: '#f7f7f7',
          600: '#ededed',
          500: '#d9d9d9',
        },
        primary: {
          300: '#93b9ff',
          400: '#548cff',
          500: '#548cff',
          600: '#548cff',
          700: '#2b62c4',
        },
      },

      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      fontSize: {
        '2xs': ['11px', '16px'],
      },

      borderRadius: {
        control: '8px',
        card: '14px',
        panel: '16px',
      },

      boxShadow: {
        // Raised paper surface
        raised: '0 2px 5px rgba(5,5,5,0.06), 0 1px 2px rgba(5,5,5,0.04)',
        // Floating layer (modal, popover, assistant)
        float: '0 8px 24px rgba(5,5,5,0.08), 0 2px 6px rgba(5,5,5,0.04)',
        // Recessed control
        inset: 'inset 0 1px 3px rgba(5,5,5,0.08)',
        // Manufactured button
        btn: '0 1px 2px rgba(5,5,5,0.10), inset 0 1px 0 rgba(255,255,255,0.07)',
        'btn-pressed': 'inset 0 1px 2px rgba(5,5,5,0.22)',
        // Dark rail
        rail: '1px 0 0 rgba(5,5,5,0.9)',
        panel: '0 2px 5px rgba(5,5,5,0.06), 0 1px 2px rgba(5,5,5,0.04)',
      },

      animation: {
        'fade-in': 'fadeIn 180ms ease-out',
        'rise-in': 'riseIn 200ms cubic-bezier(0.2, 0.8, 0.3, 1)',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
