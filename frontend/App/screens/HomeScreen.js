import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useTheme } from '@theme/ThemeContext';
import { getSearchSuggestions } from '@services/api';

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function loadSuggestions() {
      try {
        const items = await getSearchSuggestions({ limit: 12 });
        if (mounted) {
          setSuggestions(items);
        }
      } catch (error) {
        console.warn('Failed to load home suggestions:', error?.message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSuggestions();
    return () => {
      mounted = false;
    };
  }, []);

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
      marginBottom: 12,
      marginTop: 16,
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
        <Text style={styles.sectionTitle}>Trending Now</Text>
        <Text style={styles.sectionSub}>Live picks from your loaded backend sources.</Text>

        {suggestions.length === 0 ? (
          <Text style={styles.sectionSub}>No suggestions available yet.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroller} contentContainerStyle={styles.rowContent}>
            {suggestions.slice(0, 10).map((item, index) => (
              <TouchableOpacity
                key={`${item.id || item.url || item.title}-${index}`}
                style={styles.card}
                onPress={() =>
                  navigation.navigate('MangaDetail', {
                    mangaId: item.id,
                    title: item.title,
                    sourceId: item.source || 'all',
                    mangaUrl: item.url,
                    coverUrl: item.cover || '',
                  })
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
