import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '@theme/ThemeContext';

const BASE = FileSystem.documentDirectory + 'manhwavault/offline/';

export default function DownloadsScreen({ navigation }) {
  const { colors } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      refresh();
    });

    refresh();
    return unsub;
  }, [navigation]);

  async function refresh() {
    setLoading(true);
    try {
      const exists = await FileSystem.getInfoAsync(BASE);
      if (!exists.exists) {
        setItems([]);
        setLoading(false);
        return;
      }

      const dirs = await FileSystem.readDirectoryAsync(BASE);
      const data = await Promise.all(
        dirs.map(async (d) => {
          const dirPath = BASE + d + '/';
          const files = await FileSystem.readDirectoryAsync(dirPath).catch(() => []);
          let total = 0;
          const fileInfos = await Promise.all(
            files.map(async (f) => {
              const info = await FileSystem.getInfoAsync(dirPath + f);
              total += info.size || 0;
              return { name: f, uri: dirPath + f, size: info.size || 0 };
            })
          );
          return { id: d, name: d, count: fileInfos.length, size: total, files: fileInfos };
        })
      );
      setItems(data);
    } catch (e) {
      console.error('Failed to list downloads', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const openItem = (item) => {
    const uris = item.files.map((f) => f.uri);
    navigation.navigate('Reader', { title: item.name, localFiles: uris });
  };

  const deleteItem = (item) => {
    Alert.alert('Delete', `Delete "${item.name}" from device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await FileSystem.deleteAsync(BASE + item.id, { idempotent: true });
            refresh();
          } catch (e) {
            console.error('Delete failed', e);
            Alert.alert('Delete failed', e?.message || 'Unknown error');
          }
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { padding: 16 },
    title: { color: colors.text, fontSize: 24, fontWeight: '800' },
    subtitle: { color: colors.textSecondary, marginTop: 6 },
    list: { padding: 16 },
    item: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cover: { width: 44, height: 64, borderRadius: 8, backgroundColor: colors.background },
    itemBody: { marginLeft: 8 },
    itemTitle: { color: colors.text, fontWeight: '700' },
    itemMeta: { color: colors.textSecondary, fontSize: 12 },
    actions: { flexDirection: 'row', gap: 8 },
    btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Downloads</Text>
        <Text style={styles.subtitle}>Chapters you've saved to device for offline reading.</Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <Text style={{ color: colors.textSecondary }}>Loading…</Text>
        ) : items.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>No downloads found.</Text>
        ) : (
          items.map((it) => (
            <View key={it.id} style={styles.item}>
              <View style={styles.itemLeft}>
                <Image source={undefined} style={styles.cover} />
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{it.name}</Text>
                  <Text style={styles.itemMeta}>{it.count} files • {(it.size / 1024).toFixed(1)} KB</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => openItem(it)} style={[styles.btn, { backgroundColor: colors.primary }] }>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteItem(it)} style={[styles.btn, { borderWidth: 1, borderColor: colors.border }] }>
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
