import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useTheme } from '@theme/ThemeContext';

export default function SearchScreen({ navigation }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedSource, setSelectedSource] = useState('asura');
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    try {
      // Call backend API
      // const response = await axios.post(`http://localhost:8000/search/${selectedSource}`, {
      //   query,
      //   page: 1,
      // });
      // setResults(response.data.results);
    } catch (error) {
      console.error('Search error:', error);
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
      padding: 16,
      backgroundColor: colors.surface,
    },
    searchInput: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      marginBottom: 12,
    },
    sourceSelector: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    sourceButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginHorizontal: 4,
      borderRadius: 6,
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: 'center',
    },
    sourceButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    sourceButtonText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '500',
    },
    content: {
      padding: 16,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textSecondary,
      marginTop: 32,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search manga..."
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
        />
        
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
              <Text style={styles.sourceButtonText}>
                {source.charAt(0).toUpperCase() + source.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.content}>
        {results.length === 0 && (
          <Text style={styles.emptyText}>
            {searching ? 'Searching...' : 'Search for manga to get started'}
          </Text>
        )}
        
        <FlatList
          data={results}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('MangaDetail', {
                  mangaId: item.id,
                  title: item.title,
                })
              }
            >
              <Text style={{ color: colors.text }}>{item.title}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
        />
      </View>
    </View>
  );
}
