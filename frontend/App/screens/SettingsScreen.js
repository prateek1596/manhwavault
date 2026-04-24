import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '@theme/ThemeContext';
import useReaderSettings from '../hooks/useReaderSettings';
import { getSuggestionTelemetry } from '@services/api';

export default function SettingsScreen() {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { settings, setReadingMode, setImageFit } = useReaderSettings();
  const [telemetry, setTelemetry] = useState(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(true);
  const [telemetryError, setTelemetryError] = useState('');

  const loadTelemetry = async () => {
    setLoadingTelemetry(true);
    setTelemetryError('');
    try {
      const data = await getSuggestionTelemetry();
      setTelemetry(data);
    } catch (error) {
      setTelemetryError(error?.message || 'Unable to load telemetry');
    } finally {
      setLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    loadTelemetry();
  }, []);

  const sourceRows = useMemo(() => {
    const bySource = telemetry?.bySource || {};
    return Object.entries(bySource)
      .map(([source, stats]) => ({
        source,
        refresh: Number(stats?.refresh || 0),
        click: Number(stats?.click || 0),
      }))
      .sort((a, b) => (b.click + b.refresh) - (a.click + a.refresh))
      .slice(0, 8);
  }, [telemetry]);

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
    telemetryCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
      marginTop: 8,
    },
    telemetryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    telemetryTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    telemetryRefresh: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    telemetrySummary: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 10,
    },
    telemetryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    telemetryRowSource: {
      color: colors.text,
      fontSize: 12,
      flex: 1,
      marginRight: 8,
    },
    telemetryRowStats: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    telemetryError: {
      color: colors.error,
      fontSize: 12,
      marginBottom: 10,
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Telemetry (Debug)</Text>
        <View style={styles.telemetryCard}>
          <View style={styles.telemetryHeader}>
            <Text style={styles.telemetryTitle}>Suggestion Events</Text>
            <TouchableOpacity onPress={loadTelemetry}>
              <Text style={styles.telemetryRefresh}>{loadingTelemetry ? 'Refreshing...' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>

          {telemetryError ? <Text style={styles.telemetryError}>{telemetryError}</Text> : null}

          <Text style={styles.telemetrySummary}>
            Refresh: {telemetry?.total?.refresh ?? 0} | Click: {telemetry?.total?.click ?? 0} | Events: {telemetry?.total?.events ?? 0}
          </Text>

          {sourceRows.length === 0 && !loadingTelemetry ? (
            <Text style={styles.telemetrySummary}>No source events yet.</Text>
          ) : null}

          {sourceRows.map((row) => (
            <View key={row.source} style={styles.telemetryRow}>
              <Text style={styles.telemetryRowSource} numberOfLines={1}>{row.source}</Text>
              <Text style={styles.telemetryRowStats}>R {row.refresh} / C {row.click}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
