import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

const lightColors = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  background: '#ffffff',
  surface: '#f5f5f5',
  text: '#000000',
  textSecondary: '#666666',
  border: '#e5e5e5',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
};

const darkColors = {
  primary: '#818cf8',
  secondary: '#a78bfa',
  background: '#000000',
  surface: '#1a1a1a',
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  border: '#333333',
  error: '#fca5a5',
  success: '#86efac',
  warning: '#fcd34d',
};

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    // Load saved theme preference
    AsyncStorage.getItem('theme_preference').then((savedTheme) => {
      if (savedTheme) {
        setIsDarkMode(savedTheme === 'dark');
      } else {
        setIsDarkMode(systemColorScheme === 'dark');
      }
      setThemeReady(true);
    });
  }, [systemColorScheme]);

  const toggleTheme = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    await AsyncStorage.setItem('theme_preference', newMode ? 'dark' : 'light');
  };

  const colors = isDarkMode ? darkColors : lightColors;

  const value = {
    isDarkMode,
    colors,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
