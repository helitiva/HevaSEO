const preset = require('@heva/ui/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
};
