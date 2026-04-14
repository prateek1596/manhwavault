import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAppTheme } from '../theme';
import {
  LibraryScreen, SearchScreen, UpdatesScreen,
  ExtensionsScreen, SettingsScreen,
} from '../screens/TabScreens';
import { ManhwaDetailScreen, InstallExtensionScreen, ExtensionSourceScreen } from '../screens/StackScreens';
import { ReaderScreen } from '../screens/ReaderScreen';
import { RootTabParamList, RootStackParamList } from '../types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const icons: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
    Library: 'bookshelf',
    Search: 'magnify',
    Updates: 'bell-ring-outline',
    Extensions: 'puzzle-outline',
    Settings: 'cog-outline',
  };
  return <MaterialCommunityIcons name={icons[name]} size={focused ? 23 : 21} color={color} />;
}

function TabNavigator() {
  const theme = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name} focused={focused} color={color} />
        ),
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarActiveBackgroundColor: theme.colors.primaryLight,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          height: 76,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarItemStyle: {
          marginHorizontal: 4,
          borderRadius: 18,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Updates" component={UpdatesScreen} />
      <Tab.Screen name="Extensions" component={ExtensionsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const theme = useAppTheme();

  const navTheme = {
    ...(theme.dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.dark ? DarkTheme : DefaultTheme).colors,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      primary: theme.colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
        <Stack.Screen
          name="ManhwaDetail"
          component={ManhwaDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Reader"
          component={ReaderScreen}
          options={{ headerShown: false, animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="InstallExtension"
          component={InstallExtensionScreen}
          options={{ title: 'Install Extension', presentation: 'modal' }}
        />
        <Stack.Screen
          name="ExtensionSource"
          component={ExtensionSourceScreen}
          options={{ title: 'Browse Source' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
