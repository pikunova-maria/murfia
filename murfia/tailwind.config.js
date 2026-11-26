/** @type {import('tailwindcss').Config} */
// Кошачья тема: тёплая днём, синяя ночью. Ночной режим включается классом `dark` на корне.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: '#FFF3E0', 200: '#FFE6C2', 300: '#FAD7A0' },
        paw: { DEFAULT: '#F4A261', 600: '#E07B39', 700: '#C2611F' },
        ink: { DEFAULT: '#2A2118', soft: '#5A4636' },
        night: { 950: '#080F24', 900: '#0E1A3A', 800: '#15244D', 700: '#1E3266', 600: '#2B4488' },
        moon: '#FDF2B8',
        gold: { DEFAULT: '#C9A45C', light: '#E8C987', dark: '#8A6B2E' },
        navy: { DEFAULT: '#16243E', light: '#22365C' },
        mafia: '#8B5CF6',
      },
      fontFamily: {
        display: ['Oswald', '"Arial Narrow"', 'Impact', 'sans-serif'],
        sans: ['Nunito', 'ui-rounded', '"SF Pro Rounded"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        soft: '0 6px 0 0 rgba(42,33,24,0.12)',
        glow: '0 0 28px 4px rgba(253,242,184,0.45)',
        card: '0 12px 28px -14px rgba(42,33,24,0.45)',
      },
      keyframes: {
        twinkle: { '0%,100%': { opacity: '0.2' }, '50%': { opacity: '1' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        wiggle: { '0%,100%': { transform: 'rotate(-4deg)' }, '50%': { transform: 'rotate(4deg)' } },
        zzz: { '0%': { opacity: '0', transform: 'translate(0,0) scale(.7)' }, '40%': { opacity: '1' }, '100%': { opacity: '0', transform: 'translate(14px,-22px) scale(1.2)' } },
      },
      animation: {
        twinkle: 'twinkle 3s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
        wiggle: 'wiggle 0.5s ease-in-out infinite',
        zzz: 'zzz 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
