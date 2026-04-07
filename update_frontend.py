import os
import json

os.chdir('c:\\Users\\prate\\OneDrive\\Desktop\\manhwavault')

# Update MangaDetailScreen.js
manga_detail_code = '''import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@theme/ThemeContext';
import { api } from '@services/api';

export default function MangaDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { mangaId, title, sourceId, mangaUrl } = route.params;
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInLibrary, setIsInLibrary] = useState(false);
  const [addingToLibrary, setAddingToLibrary] = useState(false);

  useEffect(() => {
    const fetchChapters = async () => {
      if (!sourceId || !mangaUrl) {
        setLoading(false);
        return;
      }

      setError('');
      try {
        console.log(`Fetching chapters for ${title}...`);
        const response = await api.post(`/manga/${sourceId}/chapters`, {
          manga_url: mangaUrl,
        });
        console.log('Chapters received:', response.data?.chapters?.length);
        setChapters(response.data?.chapters ?? []);
      } catch (fetchError) {
        console.error('Error fetching chapters:', fetchError.message);
        setError('Could not load chapters. Try again.');
      } finally {
        setLoading(false);
      }
    };

    checkLibraryStatus();
    fetchChapters();
  }, [sourceId, mangaUrl, mangaId]);

  const checkLibraryStatus = async () => {
    try {
      const library = await AsyncStorage.getItem('library');
      if (library) {
        const items = JSON.parse(library);
        const key = `${sourceId}:${mangaId}`;
        setIsInLibrary(!!items[key]);
      }
    } catch (e) {
      console.log('Error checking library:', e);
    }
  };

  const handleAddToLibrary = async () => {
    setAddingToLibrary(true);
    try {
      const library = await AsyncStorage.getItem('library');
      const items = library ? JSON.parse(library) : {};
      const key = `${sourceId}:${mangaId}`;

      items[key] = {
        id: mangaId,
        title: title,
        source_id: sourceId,
        manga_url: mangaUrl,
        added_at: new Date().toISOString(),
      };

      await AsyncStorage.setItem('library', JSON.stringify(items));
      setIsInLibrary(true);

      try {
        await api.post('/library/add', {
          manga_id: mangaId,
          title: title,
          source_id: sourceId,
          manga_url: mangaUrl,
        });
      } catch (backendError) {
        console.log('Backend sync failed:', backendError.message);
      }

      Alert.alert('Success', `"${title}" added to your library!`);
    } catch (error) {
      console.error('Error adding to library:', error);
      Alert.alert('Error', 'Failed to add to library.');
    } finally {
      setAddingToLibrary(false);
    }
  };

  const handleRemoveFromLibrary = async () => {
    Alert.alert(
      'Remove from Library?',
      `Remove "${title}"?`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Remove',
          onPress: async () => {
            try {
              const library = await AsyncStorage.getItem('library');
              if (library) {
                const items = JSON.parse(library);
                const key = `${sourceId}:${mangaId}`;
                delete items[key];
                await AsyncStorage.setItem('library', JSON.stringify(items));
              }
              setIsInLibrary(false);
              Alert.alert('Removed', `"${title}" removed.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to remove.');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    libraryButton: {
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: isInLibrary ? colors.error : colors.primary,
      alignItems: 'center',
    },
    libraryButtonText: {
      color: '#ffffff',
      fontWeight: '600',
      fontSize: 14,
    },
    chaptersContainer: {
      flex: 1,
      padding: 16,
    },
    chaptersTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    errorText: {
      color: colors.error,
      marginBottom: 10,
      padding: 10,
      backgroundColor: colors.error + '20',
      borderRadius: 6,
    },
    chapterItem: {
      paddingVertical: 14,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderRadius: 8,
      marginBottom: 10,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    chapterTitle: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    chapterDate: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 20,
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Loading chapters...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity
          style={styles.libraryButton}
          onPress={isInLibrary ? handleRemoveFromLibrary : handleAddToLibrary}
          disabled={addingToLibrary}
        >
          <Text style={styles.libraryButtonText}>
            {addingToLibrary ? 'Adding...' : isInLibrary ? '❌ Remove' : '➕ Add to Library'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.chaptersContainer}>
        <Text style={styles.chaptersTitle}>Chapters ({chapters.length})</Text>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {chapters.length === 0 ? (
          <Text style={styles.emptyText}>No chapters available</Text>
        ) : (
          chapters.map((chapter) => (
            <TouchableOpacity
              key={chapter.id}
              style={styles.chapterItem}
              onPress={() =>
                navigation.navigate('Reader', {
                  chapterId: chapter.id,
                  title: chapter.title,
                  sourceId,
                  chapterUrl: chapter.url,
                })
              }
            >
              <Text style={styles.chapterTitle}>{chapter.title}</Text>
              <Text style={styles.chapterDate}>{chapter.published_date}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
'''

with open('frontend/App/screens/MangaDetailScreen.js', 'w') as f:
    f.write(manga_detail_code)

print("✅ Frontend updated!")
