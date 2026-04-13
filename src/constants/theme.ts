export const COLORS = {
  cream: '#F5F0E8',
  creamDark: '#E8E0D0',
  primary: '#2d5a3d',
  primaryDark: '#1a3a2a',
  primaryLight: '#3d7a5d',
  accent: '#c4a265',
  white: '#FFFFFF',
  black: '#1a1a1a',
  gray: '#8a8a8a',
  grayLight: '#d4d0c8',
  grayDark: '#5a5a5a',
  red: '#d9534f',
  green: '#5cb85c',
  yellow: '#f0ad4e',
  meditGreen: '#2d5a3d',
  cardBg: '#FFFCF5',
  shadow: 'rgba(0,0,0,0.08)',
} as const;

export const FONTS = {
  regular: 'System',
  bold: 'System',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
} as const;
