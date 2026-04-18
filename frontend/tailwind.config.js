/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Surfaces — bg-page, bg-surface, bg-elevated
        page:     'var(--bg)',
        surface:  'var(--surface)',
        elevated: 'var(--elevated)',
        // Borders — border-line (hairline), border-stroke (visible)
        line:   'var(--line)',
        stroke: 'var(--border)',
        // Accent — bg-accent, text-accent, border-accent, bg-accent-soft
        accent: {
          DEFAULT: 'var(--accent)',
          hover:   'var(--accent-h)',
          light:   'var(--accent-l)',
          soft:    'var(--accent-bg)',
        },
        // Text ramp — text-hi, text-mid, text-lo
        hi:  'var(--hi)',
        mid: 'var(--mid)',
        lo:  'var(--lo)',
        // Risk semantic — bg-risk-high, text-risk-high, bg-risk-high-tint etc.
        risk: {
          high:         'var(--risk-high)',
          'high-tint':  'var(--risk-high-tint)',
          medium:       'var(--risk-medium)',
          'medium-tint':'var(--risk-medium-tint)',
          low:          'var(--risk-low)',
          'low-tint':   'var(--risk-low-tint)',
        },
      },
      borderRadius: {
        card: '12px',   // cards, panels, modals
        pill: '9999px', // badges, chips
        ctrl: '8px',    // buttons, inputs, dropdowns
      },
      fontSize: {
        // Design-spec type scale: 11/12/13/14/22/32
        '2xs': ['11px', { lineHeight: '16px' }],
        xs:    ['12px', { lineHeight: '18px' }],
        sm:    ['13px', { lineHeight: '20px' }],
        base:  ['14px', { lineHeight: '22px' }],
        lg:    ['22px', { lineHeight: '30px' }],
        xl:    ['32px', { lineHeight: '40px' }],
      },
    },
  },
  plugins: [],
}
