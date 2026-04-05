import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@theme/ThemeContext';

// Screens
import HomeScreen from '@screens/HomeScreen';
import SearchScreen from '@screens/SearchScreen';
import LibraryScreen from '@screens/LibraryScreen';
import SettingsScreen from '@screens/SettingsScreen';
import MangaDetailScreen from '@screens/MangaDetailScreen';
import ReaderScreen from '@screens/ReaderScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Home Stack Navigator
function HomeStackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        cardStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{
          title: 'ManhwaVault',
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="MangaDetail"
        component={MangaDetailScreen}
        options={({ route }) => ({
          title: route.params?.title || 'Manga',
        })}
      />
      <Stack.Screen
        name="Reader"
        component={ReaderScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}

// Search Stack Navigator
function SearchStackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        cardStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="SearchMain"
        component={SearchScreen}
        options={{
          title: 'Search Manga',
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="MangaDetail"
        component={MangaDetailScreen}
        options={({ route }) => ({
          title: route.params?.title || 'Manga',
        })}
      />
      <Stack.Screen
        name="Reader"
        component={ReaderScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}

// Library Stack Navigator
function LibraryStackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        cardStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="LibraryMain"
        component={LibraryScreen}
        options={{
          title: 'My Library',
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="MangaDetail"
        component={MangaDetailScreen}
        options={({ route }) => ({
          title: route.params?.title || 'Manga',
        })}
      />
      <Stack.Screen
        name="Reader"
        component={ReaderScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}

// Settings Stack Navigator
function SettingsStackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        cardStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerLargeTitle: true,
        }}
      />
    </Stack.Navigator>
  );
}

// Root Tab Navigator
function RootTabNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Search') {
            iconName = 'magnify';
          } else if (route.name === 'Library') {
            iconName = 'library-shelves';
          } else if (route.name === 'Settings') {
            iconName = 'cog';
          }

          return (
            <MaterialCommunityIcons name={iconName} size={size} color={color} />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStackNavigator}
        options={{
          tabBarLabel: 'Search',
        }}
      />
      <Tab.Screen
        name="Library"
        component={LibraryStackNavigator}
        options={{
          tabBarLabel: 'Library',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

// Root Navigator
export default function RootNavigator() {
  const { colors } = useTheme();

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.error,
        },
      }}
    >
      <RootTabNavigator />
    </NavigationContainer>
  );
}
