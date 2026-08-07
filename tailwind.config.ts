import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: { soho: { dark: '#171717', cream: '#fff7ed', accent: '#f97316' } } } },
  plugins: []
};
export default config;
