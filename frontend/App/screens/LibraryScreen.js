import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@theme/ThemeContext';

export default function LibraryScreen({ navigation }) {
  const { colors } = useTheme();
  const [library, setLibrary] = useState([]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      try {
        const raw = await AsyncStorage.getItem('library');
        const parsed = raw ? JSON.parse(raw) : {};
        const items = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
        setLibrary(items);
      } catch (e) {
        console.error('Failed to load library:', e);
        setLibrary([]);
      }
    });

    return unsubscribe;
  }, [navigation]);

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
    eyebrow: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    title: {
      color: colors.text,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 8,
      maxWidth: 340,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 28,
      padding: 20,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 5,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    item: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      flexDirection: 'row',
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
      elevation: 4,
    },
    cover: {
      width: 68,
      height: 96,
      borderRadius: 16,
      backgroundColor: colors.background,
    },
    itemBody: {
      flex: 1,
      justifyContent: 'center',
      minHeight: 96,
    },
    itemTitle: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '800',
      marginBottom: 8,
    },
    itemSource: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 8,
    },
    tag: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tagText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Saved</Text>
        <Text style={styles.title}>Your library</Text>
        <Text style={styles.subtitle}>
          Tap any title to jump back into chapters with the saved source and details.
        </Text>
      </View>

      <View style={styles.content}>
        {library.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Your library is empty. Save something from search to keep it here.</Text>
          </View>
        ) : (
          library.map((item) => (
            <TouchableOpacity
              key={item.key || `${item.sourceId}:${item.mangaId}`}
              style={styles.item}
              onPress={() =>
                navigation.navigate('MangaDetail', {
                  mangaId: item.mangaId || item.id,
                  title: item.title,
                  sourceId: item.sourceId || item.source_id,
                  mangaUrl: item.mangaUrl || item.manga_url || item.url,
                  coverUrl: item.coverUrl || item.cover_url,
                })
              }
            >
              <Image
                source={item.coverUrl || item.cover_url ? { uri: item.coverUrl || item.cover_url } : undefined}
                style={styles.cover}
                resizeMode="cover"
              />
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.itemSource} numberOfLines={1}>{item.sourceId || item.source_id}</Text>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Continue reading</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
