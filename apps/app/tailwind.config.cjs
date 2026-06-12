const preset = require('@heva/ui/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // next/font injects these CSS variables (see src/app/layout.tsx)
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-inter-tight)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
};
