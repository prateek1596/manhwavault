import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@theme/ThemeContext';
import { api } from '@services/api';

export default function MangaDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { mangaId, title, sourceId, mangaUrl } = route.params;
  const [manga, setManga] = useState(null);
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
        const response = await api.post(`/manga/${sourceId}/chapters`, {
          manga_url: mangaUrl,
        });
        setChapters(response.data?.chapters ?? []);
      } catch (fetchError) {
        console.error('Error fetching chapters:', fetchError);
        setError('Could not load chapters. Try again in a moment.');
      } finally {
        setLoading(false);
      }
    };

    fetchChapters();
  }, [sourceId, mangaUrl, mangaId]);

  useEffect(() => {
    const checkLibraryStatus = async () => {
      try {
        const libraryRaw = await AsyncStorage.getItem('library');
        const parsedLibrary = libraryRaw ? JSON.parse(libraryRaw) : {};
        const libraryKey = `${sourceId}:${mangaId}`;

        if (Array.isArray(parsedLibrary)) {
          const existsInArray = parsedLibrary.some((item) => {
            if (!item) {
              return false;
            }

            return (
              item.key === libraryKey ||
              `${item.sourceId}:${item.mangaId}` === libraryKey ||
              item.id === libraryKey
            );
          });
          setIsInLibrary(existsInArray);
          return;
        }

        setIsInLibrary(Boolean(parsedLibrary?.[libraryKey]));
      } catch (storageError) {
        console.error('Error checking library status:', storageError);
        setIsInLibrary(false);
      }
    };

    checkLibraryStatus();
  }, [sourceId, mangaId]);

  const handleAddToLibrary = async () => {
    setAddingToLibrary(true);

    try {
      const libraryRaw = await AsyncStorage.getItem('library');
      const parsedLibrary = libraryRaw ? JSON.parse(libraryRaw) : {};
      const libraryObject = !Array.isArray(parsedLibrary) && parsedLibrary ? parsedLibrary : {};
      const libraryKey = `${sourceId}:${mangaId}`;

      libraryObject[libraryKey] = {
        key: libraryKey,
        mangaId,
        sourceId,
        title,
        mangaUrl,
        addedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem('library', JSON.stringify(libraryObject));

      try {
        await api.post('/library/add', {
          manga_id: mangaId,
          source_id: sourceId,
          title,
          manga_url: mangaUrl,
        });
      } catch (apiError) {
        console.warn('Backend library sync failed:', apiError);
      }

      setIsInLibrary(true);
      Alert.alert('Success', 'Added to library.');
    } catch (storageError) {
      console.error('Error adding to library:', storageError);
      Alert.alert('Error', 'Could not add this manga to your library.');
    } finally {
      setAddingToLibrary(false);
    }
  };

  const handleRemoveFromLibrary = () => {
    Alert.alert('Remove from Library', 'Remove this manga from your library?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setAddingToLibrary(true);
          try {
            const libraryRaw = await AsyncStorage.getItem('library');
            const parsedLibrary = libraryRaw ? JSON.parse(libraryRaw) : {};
            const libraryObject = !Array.isArray(parsedLibrary) && parsedLibrary ? parsedLibrary : {};
            const libraryKey = `${sourceId}:${mangaId}`;

            if (libraryObject[libraryKey]) {
              delete libraryObject[libraryKey];
              await AsyncStorage.setItem('library', JSON.stringify(libraryObject));
            }

            setIsInLibrary(false);
            Alert.alert('Success', 'Removed from library.');
          } catch (storageError) {
            console.error('Error removing from library:', storageError);
            Alert.alert('Error', 'Could not remove this manga from your library.');
          } finally {
            setAddingToLibrary(false);
          }
        },
      },
    ]);
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
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    button: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 6,
      marginVertical: 8,
    },
    addButton: {
      backgroundColor: '#1f9d55',
    },
    removeButton: {
      backgroundColor: '#d64545',
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: '#ffffff',
      textAlign: 'center',
      fontWeight: '500',
    },
    chaptersContainer: {
      padding: 16,
    },
    chapterItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: 6,
      marginBottom: 8,
    },
    chapterTitle: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 10,
      color: colors.textSecondary,
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading chapters...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>Author: Unknown</Text>
        <TouchableOpacity
          style={[
            styles.button,
            isInLibrary ? styles.removeButton : styles.addButton,
            addingToLibrary && styles.buttonDisabled,
          ]}
          onPress={isInLibrary ? handleRemoveFromLibrary : handleAddToLibrary}
          disabled={addingToLibrary}
        >
          <Text style={styles.buttonText}>
            {addingToLibrary ? 'Please wait...' : isInLibrary ? '❌ Remove' : '➕ Add to Library'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chaptersContainer}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
          Chapters ({chapters.length})
        </Text>
        {!!error && <Text style={{ color: colors.error, marginBottom: 10 }}>{error}</Text>}
        {chapters.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>No chapters available</Text>
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
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
