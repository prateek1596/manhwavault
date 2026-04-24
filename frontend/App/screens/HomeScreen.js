import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useTheme } from '@theme/ThemeContext';
import { getSearchSuggestions, trackSuggestionTelemetry } from '@services/api';

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const REFRESH_COOLDOWN_MS = 1500;
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [refreshingSuggestions, setRefreshingSuggestions] = useState(false);
  const [nextRefreshAt, setNextRefreshAt] = useState(0);

  const loadSuggestions = useCallback(async ({ showRefresh = false } = {}) => {
    if (showRefresh) {
      setRefreshingSuggestions(true);
    }
    try {
      const items = await getSearchSuggestions({ limit: 12 });
      setSuggestions(items);
    } catch (error) {
      console.warn('Failed to load home suggestions:', error?.message);
    } finally {
      if (showRefresh) {
        setRefreshingSuggestions(false);
      }
    }
  }, []);

  const handleRefreshSuggestions = () => {
    if (refreshingSuggestions || Date.now() < nextRefreshAt) {
      return;
    }
    setNextRefreshAt(Date.now() + REFRESH_COOLDOWN_MS);
    trackSuggestionTelemetry({
      event: 'refresh',
      source: 'all',
      client: 'frontend',
      surface: 'home',
    }).catch(() => {});
    loadSuggestions({ showRefresh: true });
  };

  useEffect(() => {
    let mounted = true;

    loadSuggestions().finally(() => {
      if (mounted) {
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadSuggestions]);

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
      marginBottom: 0,
      marginTop: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    refreshButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    refreshButtonText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    refreshButtonDisabled: {
      opacity: 0.5,
    },
    sectionSub: {
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: 12,
    },
    rowScroller: {
      marginHorizontal: -2,
    },
    rowContent: {
      paddingRight: 8,
      gap: 12,
    },
    card: {
      width: 128,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderColor: colors.border,
      borderWidth: 1,
      overflow: 'hidden',
    },
    cover: {
      width: '100%',
      height: 176,
      backgroundColor: colors.background,
    },
    cardBody: {
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 4,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
      minHeight: 34,
    },
    cardSource: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    skeletonCard: {
      width: 128,
      borderRadius: 16,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    skeletonCover: {
      width: '100%',
      height: 176,
      backgroundColor: colors.surface,
      opacity: 0.7,
    },
    skeletonTextLine: {
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.border,
      marginBottom: 8,
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trending Now</Text>
          <TouchableOpacity
            style={[styles.refreshButton, (refreshingSuggestions || Date.now() < nextRefreshAt) && styles.refreshButtonDisabled]}
            onPress={handleRefreshSuggestions}
            disabled={refreshingSuggestions || Date.now() < nextRefreshAt}
          >
            <Text style={styles.refreshButtonText}>{refreshingSuggestions ? 'Refreshing...' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSub}>Live picks from your loaded backend sources.</Text>

        {(loading || refreshingSuggestions) && suggestions.length === 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroller} contentContainerStyle={styles.rowContent}>
            {[0, 1, 2, 3].map((idx) => (
              <View key={`home-skeleton-${idx}`} style={styles.skeletonCard}>
                <View style={styles.skeletonCover} />
                <View style={styles.cardBody}>
                  <View style={[styles.skeletonTextLine, { width: '90%' }]} />
                  <View style={[styles.skeletonTextLine, { width: '68%', marginBottom: 0 }]} />
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {suggestions.length === 0 ? (
          <Text style={styles.sectionSub}>No suggestions available yet.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroller} contentContainerStyle={styles.rowContent}>
            {suggestions.slice(0, 10).map((item, index) => (
              <TouchableOpacity
                key={`${item.id || item.url || item.title}-${index}`}
                style={styles.card}
                onPress={() =>
                  {
                    trackSuggestionTelemetry({
                      event: 'click',
                      source: item.source || 'all',
                      client: 'frontend',
                      surface: 'home',
                    }).catch(() => {});
                    navigation.navigate('MangaDetail', {
                      mangaId: item.id,
                      title: item.title,
                      sourceId: item.source || 'all',
                      mangaUrl: item.url,
                      coverUrl: item.cover || '',
                    });
                  }
                }
              >
                <Image
                  source={item.cover ? { uri: item.cover } : undefined}
                  style={styles.cover}
                  resizeMode="cover"
                />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardSource} numberOfLines={1}>{item.source || 'Unknown source'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}
