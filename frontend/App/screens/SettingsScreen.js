import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '@theme/ThemeContext';
import useReaderSettings from '../hooks/useReaderSettings';

export default function SettingsScreen() {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { settings, setReadingMode, setImageFit } = useReaderSettings();

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
    optionRow: {
      flexDirection: 'row',
      gap: 8,
    },
    optionButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    optionButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    optionTextActive: {
      color: '#ffffff',
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
          <View style={styles.optionRow}>
            {[
              { label: 'Paged', value: 'paged' },
              { label: 'Vertical', value: 'vertical' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  settings.readingMode === option.value && styles.optionButtonActive,
                ]}
                onPress={() => setReadingMode(option.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    settings.readingMode === option.value && styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Image Fit</Text>
          <View style={styles.optionRow}>
            {[
              { label: 'Cover', value: 'cover' },
              { label: 'Contain', value: 'contain' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  settings.imageFit === option.value && styles.optionButtonActive,
                ]}
                onPress={() => setImageFit(option.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    settings.imageFit === option.value && styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
