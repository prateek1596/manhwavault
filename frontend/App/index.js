import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RootNavigator from '@navigation/RootNavigator';
import { ThemeProvider } from '@theme/ThemeContext';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = React.useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Load custom fonts
        await Font.loadAsync({
          // Add custom fonts here
        });

        // Initialize app storage and settings
        // await initializeApp();
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the splash screen to hide after loading resources
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <ThemeProvider>
      <RootNavigator />
      <StatusBar barStyle="light-content" />
    </ThemeProvider>
  );
}
