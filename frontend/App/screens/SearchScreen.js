import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '@theme/ThemeContext';
import { api } from '@services/api';

export default function SearchScreen({ navigation }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedSource, setSelectedSource] = useState('asura');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setError('');
    try {
      console.log(`Searching for "${query}" on source: ${selectedSource}`);
      const response = await api.post(`/search/${selectedSource}`, {
        query: query.trim(),
        page: 1,
      });
      console.log('Search results:', response.data?.results?.length);
      setResults(response.data?.results ?? []);
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
        errorMsg = 'Network error - check if backend is running at 192.168.29.102:8000';
      } else if (error.response?.status === 404) {
        errorMsg = 'Source not found on backend';
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
      paddingTop: 12,
      paddingBottom: 20,
      backgroundColor: colors.background,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 16,
      borderColor: colors.border,
      borderWidth: 1,
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
      borderRadius: 8,
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1.5,
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
      paddingVertical: 12,
    },
    errorContainer: {
      backgroundColor: colors.error + '20',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
      fontWeight: '500',
    },
    resultCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
      borderColor: colors.border,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    resultHeader: {
      marginBottom: 8,
    },
    resultTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 4,
    },
    resultAuthor: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 2,
    },
    resultSource: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '500',
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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
          {['asura', 'flame', 'reaper'].map((source) => (
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
                {source.charAt(0).toUpperCase() + source.slice(1)}
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
            <Text style={styles.emptyText}>Search for manga to get started</Text>
          </View>
        )}
        
        {!searching && (
          <FlatList
            data={results}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultCard}
                onPress={() =>
                  navigation.navigate('MangaDetail', {
                    mangaId: item.id,
                    title: item.title,
                    sourceId: selectedSource,
                    mangaUrl: item.url,
                  })
                }
              >
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>{item.title}</Text>
                  <Text style={styles.resultAuthor}>{item.author || 'Unknown author'}</Text>
                  <Text style={styles.resultSource}>From {selectedSource}</Text>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item, index) => `${item.id || item.url || item.title}-${index}`}
            scrollEnabled={true}
            nestedScrollEnabled={true}
          />
        )}
      </View>
    </View>
  );
}
