/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src-frontend/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom CSS variables for theme system
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        card: 'var(--color-card)',
        'card-foreground': 'var(--color-card-foreground)',
        popover: 'var(--color-popover)',
        'popover-foreground': 'var(--color-popover-foreground)',
        primary: 'var(--color-primary)',
        'primary-foreground': 'var(--color-primary-foreground)',
        secondary: 'var(--color-secondary)',
        'secondary-foreground': 'var(--color-secondary-foreground)',
        muted: 'var(--color-muted)',
        'muted-foreground': 'var(--color-muted-foreground)',
        accent: 'var(--color-accent)',
        'accent-foreground': 'var(--color-accent-foreground)',
        'accent-muted': 'var(--color-accent-muted)',
        destructive: 'var(--color-destructive)',
        'destructive-foreground': 'var(--color-destructive-foreground)',
        border: 'var(--color-border)',
        input: 'var(--color-input)',
        ring: 'var(--color-ring)',
        // Semantic colors
        success: 'var(--color-success)',
        'success-foreground': 'var(--color-success-foreground)',
        info: 'var(--color-info)',
        'info-foreground': 'var(--color-info-foreground)',
        'accent-alt': 'var(--color-accent-alt)',
      },
    },
  },
  plugins: [],
}