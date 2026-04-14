import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@theme/ThemeContext';
import { api } from '@services/api';

export default function MangaDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { mangaId, title, sourceId, mangaUrl, coverUrl } = route.params;
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
        const response = await api.get('/manhwa/chapters', {
          params: {
            url: mangaUrl,
            source: sourceId,
          },
        });

        const list = Array.isArray(response.data) ? response.data : [];
        setChapters(list);
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
        coverUrl,
        addedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem('library', JSON.stringify(libraryObject));

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
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 12,
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 28,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 5,
      overflow: 'hidden',
    },
    heroTop: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'flex-start',
    },
    cover: {
      width: 90,
      height: 126,
      borderRadius: 20,
      backgroundColor: colors.background,
    },
    heroMeta: {
      flex: 1,
      minHeight: 126,
      justifyContent: 'space-between',
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    title: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    tag: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignSelf: 'flex-start',
    },
    tagText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    button: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 18,
      marginTop: 4,
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
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 20,
    },
    chapterItem: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: 20,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chapterTitle: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '700',
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.header}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Image
              source={coverUrl ? { uri: coverUrl } : undefined}
              style={styles.cover}
              resizeMode="cover"
            />
            <View style={styles.heroMeta}>
              <View>
                <Text style={styles.eyebrow}>Manga Detail</Text>
                <Text style={styles.title} numberOfLines={3}>{title}</Text>
                <Text style={styles.description}>Author: Unknown</Text>
              </View>
              <View style={styles.tagRow}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{chapters.length} chapters</Text>
                </View>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{sourceId}</Text>
                </View>
              </View>
            </View>
          </View>

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
              {addingToLibrary ? 'Please wait...' : isInLibrary ? 'Remove from Library' : 'Add to Library'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chaptersContainer}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 }}>
          Chapters
        </Text>
        {!!error && (
          <View style={{ marginBottom: 10, backgroundColor: colors.error + '14', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.error + '30' }}>
            <Text style={{ color: colors.error }}>{error}</Text>
          </View>
        )}
        {chapters.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>No chapters available yet.</Text>
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
              {!!chapter.number && (
                <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                  Chapter {chapter.number}
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
