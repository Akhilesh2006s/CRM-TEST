/** CRM mobile light palette — aligned with web app/globals.css soft sky theme */
export const colors = {
  /* Soft sky accent (readable on light surfaces) */
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryLight: '#60A5FA',
  primaryForeground: '#FFFFFF',

  accent: '#EFF6FF',
  accentForeground: '#1E3A5F',

  background: '#F8FAFC',
  backgroundLight: '#FFFFFF',
  backgroundMuted: '#F1F5F9',
  /* Alias for screens that still reference backgroundDark */
  backgroundDark: '#F1F5F9',

  textPrimary: '#1E293B',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textMuted: '#94A3B8',
  textLight: '#FFFFFF',

  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#CA8A04',
  warningLight: '#FEF9C3',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  tableHeader: '#F1F5F9',
  shadow: 'rgba(15, 23, 42, 0.06)',
  shadowDark: 'rgba(15, 23, 42, 0.1)',
};

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/** Button / CTA gradients (headers use ScreenShell neutral bar, not these). */
export const gradients = {
  primary: ['#3B82F6', '#2563EB'],
  accent: ['#EFF6FF', '#DBEAFE'],
  success: ['#16A34A', '#15803D'],
  sunset: ['#F59E0B', '#EF4444'],
};
