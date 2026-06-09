import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '@theme/ThemeContext';
import { StatusBar } from 'expo-status-bar';

export default function OfflineViewer({ route, navigation }) {
  const { colors } = useTheme();
  const { title, localFiles = [] } = route.params || {};
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { paddingTop: 14, paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { color: colors.text, fontSize: 16, fontWeight: '800' },
    closeBtn: { paddingHorizontal: 10, paddingVertical: 6 },
    page: { width: '100%', backgroundColor: '#000' },
    image: { width: '100%', height: '100%', resizeMode: 'contain', backgroundColor: '#000' },
    loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{title || 'Offline'}</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Close</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {localFiles.map((uri, idx) => (
            <View key={`${uri}-${idx}`} style={styles.page}>
              <Image source={{ uri }} style={[styles.image, { aspectRatio: 0.7 }]} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
