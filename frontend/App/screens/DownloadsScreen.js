import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '@theme/ThemeContext';
import { deleteDownloadedChapter, subscribeDownloadProgress, cancelDownload } from '@services/api';

const BASE = FileSystem.documentDirectory + 'manhwavault/offline/';

export default function DownloadsScreen({ navigation }) {
  const { colors } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ total: 0, done: 0, current: '' });
  const [downloadProgressMap, setDownloadProgressMap] = useState({});
  const [toast, setToast] = useState(null);

  function showToast(message, ms = 2500) {
    setToast(message);
    try {
      setTimeout(() => setToast(null), ms);
    } catch (e) {}
  }

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      refresh();
    });

    const unsubProgress = subscribeDownloadProgress((p) => {
      if (!p || !p.title) return;
      if (p.canceled) {
        try {
          // non-blocking toast instead of Alert
          showToast(`Download for '${p.title}' canceled`);
        } catch (e) {}
        setDownloadProgressMap((m) => {
          const copy = { ...m };
          delete copy[p.title];
          return copy;
        });
        return;
      }
      // show retry toasts for retry attempts (>1)
      if (p.attempt && p.attempt > 1) {
        try { showToast(`${p.title}: retry ${p.attempt}`); } catch (e) {}
      }
      setDownloadProgressMap((m) => ({ ...m, [p.title]: p }));
    });

    refresh();
    return () => {
      try { unsub(); } catch (e) {}
      try { unsubProgress(); } catch (e) {}
    };
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
              return { name: f, uri: dirPath + f, size: info.size || 0, modificationTime: info.modificationTime };
            })
          );
          const thumbEntry = fileInfos.find((x) => x.name.toLowerCase() === 'thumb.jpg' || x.name.toLowerCase() === 'thumb_small.jpg' || x.name.toLowerCase() === 'thumb.webp');
          const thumbnail = thumbEntry ? thumbEntry.uri : fileInfos[0]?.uri || null;
          const lastMod = fileInfos.reduce((m, f) => (f.modificationTime && (!m || f.modificationTime > m) ? f.modificationTime : m), null);
          return { id: d, name: d, count: fileInfos.length, size: total, files: fileInfos, thumbnail, lastModified: lastMod };
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

  const totalBytes = useMemo(() => items.reduce((sum, item) => sum + (item.size || 0), 0), [items]);

  const formatBytes = (bytes) => {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const openItem = async (item) => {
    setBusyId(`open:${item.id}`);
    const uris = item.files.map((f) => f.uri);
    navigation.navigate('OfflineViewer', { title: item.name, localFiles: uris });
    setBusyId(null);
  };

  const cancelItemDownload = async (item) => {
    try {
      await cancelDownload(item.id);
      setDownloadProgressMap((m) => {
        const copy = { ...m };
        delete copy[item.id];
        return copy;
      });
    } catch (e) {
      console.error('Cancel failed', e);
    }
  };

  const deleteItem = (item) => {
    Alert.alert('Delete', `Delete "${item.name}" from device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(`delete:${item.id}`);
          try {
            const [serverResult, localResult] = await Promise.allSettled([
              deleteDownloadedChapter({ title: item.id }),
              FileSystem.deleteAsync(BASE + item.id, { idempotent: true }),
            ]);

            if (localResult.status === 'rejected') {
              throw localResult.reason;
            }

            if (serverResult.status === 'rejected') {
              Alert.alert('Deleted locally', 'The device copy was removed, but the server copy may still remain.');
            }

            await refresh();
          } catch (e) {
            console.error('Delete failed', e);
            Alert.alert('Delete failed', e?.message || 'Unknown error');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const bulkDelete = async () => {
    setBulkBusy(true);
    setBulkProgress({ total: items.length, done: 0, current: '' });
    const failures = [];
    try {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        setBulkProgress({ total: items.length, done: i, current: it.id });
        try {
          const [serverResult, localResult] = await Promise.allSettled([
            deleteDownloadedChapter({ title: it.id }),
            FileSystem.deleteAsync(BASE + it.id, { idempotent: true }),
          ]);

          if (localResult.status === 'rejected') {
            failures.push({ id: it.id, error: String(localResult.reason) });
          }
          if (serverResult.status === 'rejected') {
            failures.push({ id: it.id, error: `server:${String(serverResult.reason)}` });
          }
        } catch (e) {
          failures.push({ id: it.id, error: String(e) });
        }
      }
    } finally {
      setBulkProgress((p) => ({ ...p, done: p.total }));
      setBulkBusy(false);
      await refresh();
      if (failures.length) {
        Alert.alert('Clear all completed', `Some items failed to delete (${failures.length}).`);
      } else {
        Alert.alert('Clear all completed', 'All downloads removed from device.');
      }
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { padding: 16 },
    title: { color: colors.text, fontSize: 24, fontWeight: '800' },
    subtitle: { color: colors.textSecondary, marginTop: 6 },
    list: { padding: 16 },
    summary: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
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
    itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
    cover: { width: 44, height: 64, borderRadius: 8, backgroundColor: colors.background },
    coverFallback: {
      width: 44,
      height: 64,
      borderRadius: 8,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemBody: { marginLeft: 8 },
    itemTitle: { color: colors.text, fontWeight: '700' },
    itemMeta: { color: colors.textSecondary, fontSize: 12 },
    actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    busyOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.08)',
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Downloads</Text>
        <Text style={styles.subtitle}>Chapters you've saved to device for offline reading.</Text>
      </View>

      {bulkBusy && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={{ backgroundColor: '#ffefef', padding: 8, borderRadius: 8 }}>
            <Text style={{ color: '#8a1f1f' }}>Clearing {bulkProgress.done}/{bulkProgress.total} — {bulkProgress.current}</Text>
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.summary}>
          {items.length} download{items.length === 1 ? '' : 's'} • {formatBytes(totalBytes)} total
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (items.length === 0) return Alert.alert('Clear downloads', 'No downloads to delete.');
            Alert.alert('Clear all downloads', `Delete all ${items.length} download${items.length === 1 ? '' : 's'} from device?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => bulkDelete() },
            ]);
          }}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
          disabled={bulkBusy || !!busyId}
        >
          {bulkBusy ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Clear all</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <Text style={{ color: colors.textSecondary }}>Loading…</Text>
        ) : items.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>No downloads found.</Text>
        ) : (
          items.map((it) => {
            const prog = downloadProgressMap[it.id];
            const progressPercent = prog && prog.percent ? Math.max(0, Math.min(1, prog.percent)) : null;

            return (
              <Swipeable key={it.id} renderRightActions={() => (
                <TouchableOpacity onPress={() => deleteItem(it)} style={{ backgroundColor: '#ff4444', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 14, marginBottom: 12 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
                </TouchableOpacity>
              )}>
                <View style={styles.item}>
                  <View style={styles.itemLeft}>
                    {it.thumbnail ? (
                      <Image source={{ uri: it.thumbnail }} style={styles.cover} resizeMode="cover" />
                    ) : (
                      <View style={styles.coverFallback}>
                        <Text style={{ color: colors.textSecondary, fontWeight: '800', fontSize: 10 }}>{it.count}</Text>
                      </View>
                    )}
                    <View style={styles.itemBody}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{it.name}</Text>
                      <Text style={styles.itemMeta}>{it.count} files • {formatBytes(it.size)}{it.lastModified ? ` • ${new Date(it.lastModified * 1000).toLocaleDateString()}` : ''}</Text>
                      {progressPercent !== null && (
                        <View style={{ marginTop: 8 }}>
                          <View style={{ height: 6, backgroundColor: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                            <View style={{ height: 6, backgroundColor: colors.primary, width: `${Math.round(progressPercent * 100)}%` }} />
                          </View>
                          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>{Math.round(progressPercent * 100)}%</Text>
                          {prog && prog.attempt ? (
                            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>Attempt {prog.attempt}</Text>
                          ) : null}
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => openItem(it)}
                      style={[styles.btn, { backgroundColor: colors.primary, opacity: busyId ? 0.7 : 1 }]}
                      disabled={!!busyId}
                    >
                      {busyId === `open:${it.id}` ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={{ color: '#fff', fontWeight: '700' }}>Open</Text>
                      )}
                    </TouchableOpacity>
                    {progressPercent !== null && progressPercent < 1 ? (
                      <TouchableOpacity
                        onPress={() => cancelItemDownload(it)}
                        style={[styles.btn, { borderWidth: 1, borderColor: colors.border, minWidth: 76, alignItems: 'center', opacity: busyId ? 0.7 : 1 }]}
                        disabled={!!busyId}
                      >
                        <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => deleteItem(it)}
                        style={[styles.btn, { borderWidth: 1, borderColor: colors.border, minWidth: 76, alignItems: 'center', opacity: busyId ? 0.7 : 1 }]}
                        disabled={!!busyId}
                      >
                        {busyId === `delete:${it.id}` ? (
                          <ActivityIndicator size="small" color={colors.textSecondary} />
                        ) : (
                          <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Delete</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                  {busyId === `delete:${it.id}` ? <View style={styles.busyOverlay} /> : null}
                </View>
              </Swipeable>
            );
          })
        )}
      </ScrollView>
      {toast ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24, alignItems: 'center' }} pointerEvents="box-none">
          <View style={{ backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>{toast}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
