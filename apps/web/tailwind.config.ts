import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
        poppins: ['var(--font-poppins)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Pixell brand colors
        pixell: {
          black: '#272323',
          grey: '#ABABAB',
          yellow: '#DCFB24',
          orange: '#FF6C1A',
        },
        // Semantic colors mapped to dark theme
        // 3-level background depth system
        background: '#272323',  // Level 1: Base layer
        surface: '#2f2b2b',     // Level 2: Cards, tab bars
        elevated: '#383333',    // Level 3: Popovers, dialogs, tooltips
        foreground: 'rgba(255, 255, 255, 0.9)',
        border: 'rgba(255, 255, 255, 0.1)',
        input: 'rgba(255, 255, 255, 0.1)',
        ring: 'rgba(220, 251, 36, 0.5)',
        card: {
          DEFAULT: '#2f2b2b',
          foreground: 'rgba(255, 255, 255, 0.9)',
        },
        popover: {
          DEFAULT: '#383333',
          foreground: 'rgba(255, 255, 255, 0.9)',
        },
        primary: {
          DEFAULT: '#DCFB24',
          foreground: '#272323',
        },
        secondary: {
          DEFAULT: 'rgba(255, 255, 255, 0.1)',
          foreground: 'rgba(255, 255, 255, 0.9)',
        },
        muted: {
          DEFAULT: 'rgba(255, 255, 255, 0.05)',
          foreground: 'rgba(255, 255, 255, 0.6)',
        },
        accent: {
          DEFAULT: 'rgba(255, 255, 255, 0.05)',
          foreground: 'rgba(255, 255, 255, 0.9)',
        },
        destructive: {
          DEFAULT: 'rgba(239, 68, 68, 0.2)',
          foreground: '#ef4444',
        },
        // Chart colors for dark theme
        chart: {
          '1': '#3b82f6', // blue
          '2': '#22c55e', // green
          '3': '#f97316', // orange
          '4': '#a855f7', // purple
          '5': '#ec4899', // pink
        },
      },
      borderRadius: {
        lg: '12px',
        md: '10px',
        sm: '8px',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
