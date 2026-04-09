import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../store';

export const palette = {
  purple: '#4F7BFF',
  purpleLight: '#E8EEFF',
  purpleDark: '#2E5EEB',
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
  dark300: '#0E131D',
  dark400: '#151C28',
  dark500: '#1C2432',
};

export const lightTheme = {
  dark: false,
  colors: {
    background: '#F3F6FB',
    surface: palette.white,
    surfaceVariant: '#EAF0FA',
    primary: palette.purple,
    primaryLight: palette.purpleLight,
    text: palette.gray900,
    textSecondary: palette.gray500,
    textMuted: palette.gray400,
    border: '#D7E2F3',
    borderStrong: '#C4D4EC',
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
    primaryLight: '#203C7A',
    text: palette.white,
    textSecondary: '#A8B3C7',
    textMuted: '#74819B',
    border: '#243043',
    borderStrong: '#32435E',
    tabBar: palette.dark400,
    tabBarActive: palette.purple,
    tabBarInactive: palette.gray600,
    card: palette.dark400,
    accent: palette.teal,
    danger: palette.red,
    success: palette.green,
    warning: palette.amber,
    overlay: 'rgba(0,0,0,0.75)',
    shimmer: '#27354B',
  },
};

export const midnightTheme = {
  dark: true,
  colors: {
    background: '#05070B',
    surface: '#0B1020',
    surfaceVariant: '#131B2E',
    primary: '#5A7DFF',
    primaryLight: '#213367',
    text: '#F3F6FF',
    textSecondary: '#A6B2CE',
    textMuted: '#6E7A95',
    border: '#1C2740',
    borderStrong: '#2A3860',
    tabBar: '#0A0F1C',
    tabBarActive: '#6E8DFF',
    tabBarInactive: '#6C7891',
    card: '#0E1424',
    accent: '#22D3EE',
    danger: '#EF4444',
    success: '#22C55E',
    warning: '#F59E0B',
    overlay: 'rgba(0,0,0,0.78)',
    shimmer: '#1A2742',
  },
};

export const oceanTheme = {
  dark: true,
  colors: {
    background: '#081722',
    surface: '#112638',
    surfaceVariant: '#173349',
    primary: '#33B2FF',
    primaryLight: '#184A73',
    text: '#ECF7FF',
    textSecondary: '#A3C6DA',
    textMuted: '#7095AA',
    border: '#20425D',
    borderStrong: '#2D5678',
    tabBar: '#0C1D2B',
    tabBarActive: '#58C0FF',
    tabBarInactive: '#6F90A6',
    card: '#122A3D',
    accent: '#2DD4BF',
    danger: '#F87171',
    success: '#34D399',
    warning: '#FBBF24',
    overlay: 'rgba(0,0,0,0.72)',
    shimmer: '#274D69',
  },
};

export const sunriseTheme = {
  dark: false,
  colors: {
    background: '#FFF5EE',
    surface: '#FFFFFF',
    surfaceVariant: '#FFE8DC',
    primary: '#FF7B54',
    primaryLight: '#FFE2D7',
    text: '#2B1A16',
    textSecondary: '#7D5A4D',
    textMuted: '#A07A6D',
    border: '#F1D4C6',
    borderStrong: '#E7BFAE',
    tabBar: '#FFFFFF',
    tabBarActive: '#FF7B54',
    tabBarInactive: '#A07A6D',
    card: '#FFFFFF',
    accent: '#0EA5A3',
    danger: '#DC2626',
    success: '#16A34A',
    warning: '#D97706',
    overlay: 'rgba(0,0,0,0.45)',
    shimmer: '#F2D9CC',
  },
};

export type AppTheme = typeof lightTheme;

export function useAppTheme(): AppTheme {
  const selectedTheme = useSettingsStore((s) => s.appTheme);
  const scheme = useColorScheme();
  if (selectedTheme === 'midnight') return midnightTheme;
  if (selectedTheme === 'ocean') return oceanTheme;
  if (selectedTheme === 'sunrise') return sunriseTheme;
  return scheme === 'dark' ? darkTheme : lightTheme;
}
