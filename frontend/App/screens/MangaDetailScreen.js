import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '@theme/ThemeContext';

export default function MangaDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { mangaId, title } = route.params;
  const [manga, setManga] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch manga details and chapters
    // const fetchMangaDetails = async () => {
    //   try {
    //     // const response = await axios.get(`http://localhost:8000/manga/${mangaId}`);
    //     // setManga(response.data);
    //   } catch (error) {
    //     console.error('Error fetching manga:', error);
    //   } finally {
    //     setLoading(false);
    //   }
    // };
    // fetchMangaDetails();
    setLoading(false);
  }, [mangaId]);

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
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 6,
      marginVertical: 8,
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
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>Author: Unknown</Text>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Add to Library</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chaptersContainer}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
          Chapters
        </Text>
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
