import { useColorScheme } from 'react-native';

export const palette = {
  purple: '#7B5CF0',
  purpleLight: '#EDE9FE',
  purpleDark: '#5B3FD4',
  teal: '#14B8A6',
  coral: '#F97066',
  amber: '#F59E0B',
  green: '#22C55E',
  red: '#EF4444',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Dark surfaces
  dark50: '#1A1A2E',
  dark100: '#16213E',
  dark200: '#0F3460',
  dark300: '#1E1E2E',
  dark400: '#2A2A3E',
  dark500: '#313149',
};

export const lightTheme = {
  dark: false,
  colors: {
    background: palette.gray50,
    surface: palette.white,
    surfaceVariant: palette.gray100,
    primary: palette.purple,
    primaryLight: palette.purpleLight,
    text: palette.gray900,
    textSecondary: palette.gray500,
    textMuted: palette.gray400,
    border: palette.gray200,
    borderStrong: palette.gray300,
    tabBar: palette.white,
    tabBarActive: palette.purple,
    tabBarInactive: palette.gray400,
    card: palette.white,
    accent: palette.teal,
    danger: palette.red,
    success: palette.green,
    warning: palette.amber,
    overlay: 'rgba(0,0,0,0.5)',
    shimmer: palette.gray200,
  },
};

export const darkTheme = {
  dark: true,
  colors: {
    background: palette.dark300,
    surface: palette.dark400,
    surfaceVariant: palette.dark500,
    primary: palette.purple,
    primaryLight: '#2D1F6E',
    text: palette.white,
    textSecondary: palette.gray400,
    textMuted: palette.gray600,
    border: '#2E2E42',
    borderStrong: '#3E3E52',
    tabBar: palette.dark400,
    tabBarActive: palette.purple,
    tabBarInactive: palette.gray600,
    card: palette.dark400,
    accent: palette.teal,
    danger: palette.red,
    success: palette.green,
    warning: palette.amber,
    overlay: 'rgba(0,0,0,0.75)',
    shimmer: '#2A2A3E',
  },
};

export type AppTheme = typeof lightTheme;

export function useAppTheme(): AppTheme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
