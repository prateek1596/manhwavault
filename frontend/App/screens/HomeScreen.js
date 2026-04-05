import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@theme/ThemeContext';

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize home screen data
    // Fetch latest chapters, trending manga, etc.
    setLoading(false);
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
      marginTop: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Latest Updates</Text>
        <Text style={{ color: colors.textSecondary }}>Coming soon...</Text>

        <Text style={styles.sectionTitle}>Trending Now</Text>
        <Text style={{ color: colors.textSecondary }}>Coming soon...</Text>

        <Text style={styles.sectionTitle}>Recommended</Text>
        <Text style={{ color: colors.textSecondary }}>Coming soon...</Text>
      </View>
    </ScrollView>
  );
}
