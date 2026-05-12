/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Roboto Flex"', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['"Roboto Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Material 3 dark surfaces (tonal elevation)
        surface: {
          DEFAULT: '#131316',
          1: '#181a1d',
          2: '#1d1f22',
          3: '#22252a',
          4: '#292c30',
          5: '#2f3236',
        },
        fg: {
          DEFAULT: '#e3e3e7',
          variant: '#c4c6cc',
          muted:   '#8d9199',
          dim:     '#5a5d63',
        },
        outline: {
          DEFAULT: '#43474e',
          variant: '#2d3035',
        },
        primary: {
          DEFAULT:    '#a8c7fa',
          hover:      '#b8d2ff',
          on:         '#062e6f',
          container:  '#284777',
          onContainer:'#d3e3fd',
        },
        warn:  '#ffb74d',
        error: '#ffb4ab',
      },
      borderRadius: {
        'xs': '8px',
        'sm': '12px',
        'md': '16px',
        'lg': '20px',
        'xl': '28px',
      },
    },
  },
  plugins: [],
};
