import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '@theme/ThemeContext';

export default function SettingsScreen() {
  const { colors, isDarkMode, toggleTheme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    section: {
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    settingLabel: {
      fontSize: 14,
      color: colors.text,
    },
  });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Display</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Dark Mode</Text>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={isDarkMode ? colors.primary : colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reader</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Reading Mode</Text>
          <Text style={{ color: colors.textSecondary }}>Vertical Scroll</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Extensions</Text>
        <TouchableOpacity>
          <Text style={{ color: colors.primary, fontSize: 14 }}>
            Manage Extensions
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          ManhwaVault v0.1.0
        </Text>
      </View>
    </ScrollView>
  );
}
