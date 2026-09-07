/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  // These classes are built at runtime (`status-${status.replace(...)}` in
  // AdmissionsPage, `grade-${letterGrade}` in GradesPage/ParentDashboardPage),
  // so the content scanner above never sees the literal strings and would
  // otherwise drop these component-layer rules as unused.
  safelist: [
    'status-Applied',
    'status-Reviewed',
    'status-Interview',
    'status-Approved',
    'status-Registered',
    'status-Active',
    'status-Rejected',
    'status-NotAdmitted',
    'status-Withdrawn',
    'grade-A',
    'grade-B',
    'grade-C',
    'grade-D',
    'grade-F',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Lexend', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          DEFAULT: '#1c1917',
          soft: '#78716c',
        },
        paper: '#faf9f7',
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
        },
        accent: {
          50: '#fffbeb',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      borderRadius: {
        xl2: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,25,23,0.04), 0 1px 3px rgba(28,25,23,0.06)',
        'card-lg': '0 8px 24px rgba(28,25,23,0.08), 0 2px 6px rgba(28,25,23,0.06)',
      },
    },
  },
  plugins: [],
};
