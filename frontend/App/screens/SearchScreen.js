import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useTheme } from '@theme/ThemeContext';
import { api, getSearchSuggestions } from '@services/api';

export default function SearchScreen({ navigation }) {
  const { colors } = useTheme();
  const REFRESH_COOLDOWN_MS = 1500;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedSource, setSelectedSource] = useState('all');
  const [sourceOptions, setSourceOptions] = useState(['all']);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [refreshingSuggestions, setRefreshingSuggestions] = useState(false);
  const [nextRefreshAt, setNextRefreshAt] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const loadSuggestions = async ({ showRefresh = false } = {}) => {
    if (showRefresh) {
      setRefreshingSuggestions(true);
    } else {
      setLoadingSuggestions(true);
    }
    try {
      const data = await getSearchSuggestions({
        source: selectedSource,
        limit: 10,
      });
      setSuggestions(data);
    } catch (suggestionErr) {
      console.warn('Failed to load search suggestions:', suggestionErr?.message);
    } finally {
      if (showRefresh) {
        setRefreshingSuggestions(false);
      } else {
        setLoadingSuggestions(false);
      }
    }
  };

  const handleRefreshSuggestions = () => {
    if (refreshingSuggestions || Date.now() < nextRefreshAt) {
      return;
    }
    setNextRefreshAt(Date.now() + REFRESH_COOLDOWN_MS);
    loadSuggestions({ showRefresh: true });
  };

  useEffect(() => {
    let mounted = true;

    async function loadSources() {
      try {
        const response = await api.get('/sources', {
          params: { include_nsfw: true },
        });
        const names = (response.data || [])
          .map((item) => item?.name)
          .filter((name) => typeof name === 'string' && name.trim().length > 0)
          .slice(0, 6);

        if (mounted && names.length > 0) {
          setSourceOptions(['all', ...names]);
        }
      } catch (loadErr) {
        console.warn('Failed to load source list, using default source selection.', loadErr?.message);
      }
    }

    loadSources();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    loadSuggestions();
    return () => {
      mounted = false;
    };
  }, [selectedSource]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setError('');
    try {
      const response = await api.get('/search', {
        params: {
          q: query.trim(),
          source: selectedSource,
          limit: 60,
          content_type: 'manhwa',
          include_nsfw: true,
        },
      });
      const normalized = (response.data || []).map((item, index) => ({
        id: item.id || `${item.source || 'unknown'}-${index}`,
        title: item.title,
        author: item.author || item.source || 'Unknown',
        description: item.description || '',
        cover_url: item.cover_url || item.cover || '',
        url: item.url,
        source: item.source || selectedSource,
      }));

      setResults(normalized);
    } catch (error) {
      console.error('Search error details:', {
        message: error.message,
        code: error.code,
        url: error.config?.url,
      });
      setResults([]);
      
      let errorMsg = 'Search failed';
      if (error.code === 'ECONNABORTED') {
        errorMsg = 'Search timed out - backend server not responding';
      } else if (error.message?.includes('Network')) {
        errorMsg = 'Network error - backend is unreachable';
      } else if (error.response?.status === 503) {
        errorMsg = 'No sources loaded on backend';
      }
      
      setError(errorMsg);
    } finally {
      setSearching(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 16,
      backgroundColor: colors.background,
    },
    titleBlock: {
      marginBottom: 14,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    headline: {
      color: colors.text,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
    },
    subhead: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 8,
      maxWidth: 340,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 22,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 14,
      borderColor: colors.border,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 4,
    },
    searchIcon: {
      marginRight: 8,
      fontSize: 18,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      paddingVertical: 6,
    },
    sourceSelector: {
      flexDirection: 'row',
      gap: 8,
    },
    sourceButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1.25,
      alignItems: 'center',
    },
    sourceButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    sourceButtonText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    sourceButtonTextActive: {
      color: '#ffffff',
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 12,
    },
    errorContainer: {
      backgroundColor: colors.error + '14',
      borderRadius: 18,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.error + '30',
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
      fontWeight: '500',
    },
    resultCard: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 14,
      marginBottom: 12,
      borderColor: colors.border,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 5,
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    cover: {
      width: 76,
      height: 106,
      borderRadius: 18,
      backgroundColor: colors.background,
    },
    resultBody: {
      flex: 1,
      minHeight: 106,
      justifyContent: 'center',
    },
    resultTitle: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '800',
      marginBottom: 6,
    },
    resultAuthor: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 8,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metaChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignSelf: 'flex-start',
    },
    metaChipText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: '500',
      textAlign: 'center',
      lineHeight: 22,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    suggestionBlock: {
      marginTop: 8,
    },
    suggestionTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    suggestionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
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
      fontSize: 11,
      fontWeight: '700',
    },
    refreshButtonDisabled: {
      opacity: 0.5,
    },
    suggestionCard: {
      width: 118,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      overflow: 'hidden',
      marginRight: 10,
    },
    suggestionCover: {
      width: 118,
      height: 162,
      backgroundColor: colors.background,
    },
    suggestionBody: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      gap: 4,
    },
    suggestionItemTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
      minHeight: 32,
    },
    suggestionMeta: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    suggestionSkeleton: {
      width: 118,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      marginRight: 10,
    },
    suggestionSkeletonCover: {
      width: 118,
      height: 162,
      backgroundColor: colors.surface,
      opacity: 0.7,
    },
    suggestionSkeletonLine: {
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.border,
      marginBottom: 8,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Discover</Text>
          <Text style={styles.headline}>Find the next manhwa to read</Text>
          <Text style={styles.subhead}>
            Search across sources, then jump straight into chapters with the source that actually matched.
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search manga..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
          />
        </View>
        
        <View style={styles.sourceSelector}>
          {sourceOptions.map((source) => (
            <TouchableOpacity
              key={source}
              style={[
                styles.sourceButton,
                selectedSource === source && styles.sourceButtonActive,
              ]}
              onPress={() => setSelectedSource(source)}
            >
              <Text
                style={[
                  styles.sourceButtonText,
                  selectedSource === source && styles.sourceButtonTextActive,
                ]}
              >
                {source === 'all' ? 'All' : source}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.content}>
        {!!error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {searching && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {!searching && !error && results.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Search for a title above to begin.</Text>
          </View>
        )}

        {!searching && !error && results.length === 0 && (suggestions.length > 0 || loadingSuggestions) && (
          <View style={styles.suggestionBlock}>
            <View style={styles.suggestionHeader}>
              <Text style={styles.suggestionTitle}>Suggestions from {selectedSource === 'all' ? 'all sources' : selectedSource}</Text>
              <TouchableOpacity
                style={[styles.refreshButton, (refreshingSuggestions || Date.now() < nextRefreshAt) && styles.refreshButtonDisabled]}
                onPress={handleRefreshSuggestions}
                disabled={refreshingSuggestions || Date.now() < nextRefreshAt}
              >
                <Text style={styles.refreshButtonText}>{refreshingSuggestions ? 'Refreshing...' : 'Refresh'}</Text>
              </TouchableOpacity>
            </View>
            {loadingSuggestions && suggestions.length === 0 ? (
              <FlatList
                horizontal
                data={[0, 1, 2, 3]}
                keyExtractor={(item) => `skeleton-${item}`}
                showsHorizontalScrollIndicator={false}
                renderItem={() => (
                  <View style={styles.suggestionSkeleton}>
                    <View style={styles.suggestionSkeletonCover} />
                    <View style={styles.suggestionBody}>
                      <View style={[styles.suggestionSkeletonLine, { width: '85%' }]} />
                      <View style={[styles.suggestionSkeletonLine, { width: '55%', marginBottom: 0 }]} />
                    </View>
                  </View>
                )}
              />
            ) : (
              <FlatList
                horizontal
                data={suggestions}
                keyExtractor={(item, index) => `${item.id || item.url || item.title}-s-${index}`}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionCard}
                    onPress={() =>
                      navigation.navigate('MangaDetail', {
                        mangaId: item.id,
                        title: item.title,
                        sourceId: item.source || selectedSource || 'all',
                        mangaUrl: item.url,
                        coverUrl: item.cover || '',
                      })
                    }
                  >
                    <Image
                      source={item.cover ? { uri: item.cover } : undefined}
                      style={styles.suggestionCover}
                      resizeMode="cover"
                    />
                    <View style={styles.suggestionBody}>
                      <Text style={styles.suggestionItemTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.suggestionMeta} numberOfLines={1}>{item.source || 'Unknown'}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}
        
        {!searching && (
          <FlatList
            data={results}
            contentContainerStyle={results.length === 0 ? { flexGrow: 1 } : undefined}
            ListEmptyComponent={null}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultCard}
                onPress={() =>
                  navigation.navigate('MangaDetail', {
                    mangaId: item.id,
                    title: item.title,
                    sourceId: item.source || selectedSource || 'all',
                    mangaUrl: item.url,
                    coverUrl: item.cover_url,
                  })
                }
              >
                <Image
                  source={item.cover_url ? { uri: item.cover_url } : undefined}
                  style={styles.cover}
                  resizeMode="cover"
                />
                <View style={styles.resultBody}>
                  <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.resultAuthor} numberOfLines={1}>
                    {item.author || 'Unknown author'}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>From {item.source || selectedSource}</Text>
                    </View>
                    {item.url ? (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipText}>Open chapters</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item, index) => `${item.id || item.url || item.title}-${index}`}
            ListHeaderComponent={results.length > 0 ? <View style={{ height: 4 }} /> : null}
            scrollEnabled={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </View>
  );
}
