import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ScrollView, Switch, StyleSheet, useWindowDimensions,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../theme';
import { useLibraryStore, useSettingsStore } from '../store';
import { ManhwaCard, LoadingSpinner, EmptyState, SectionHeader } from '../components';
import * as api from '../api/client';
import { Manhwa } from '../types';

// ── Library ───────────────────────────────────────────────────────────────────

export function LibraryScreen({ navigation }: any) {
  const theme = useAppTheme();
  const entries = useLibraryStore((s) => s.entries);
  const { width } = useWindowDimensions();
  const cardWidth = (width - 48) / 2;
  const library = Object.values(entries);

  if (library.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          icon="📚"
          title="Your library is empty"
          subtitle="Search for manhwa and follow series to add them here"
          action={{ label: 'Browse', onPress: () => navigation.navigate('Search') }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <SectionHeader title="Library" />
      <FlatList
        data={library}
        numColumns={2}
        keyExtractor={(item) => item.manhwa.id}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <ManhwaCard
            manhwa={item.manhwa}
            width={cardWidth}
            onPress={() => navigation.navigate('ManhwaDetail', { manhwa: item.manhwa })}
          />
        )}
      />
    </View>
  );
}

// ── Search ────────────────────────────────────────────────────────────────────

export function SearchScreen({ navigation }: any) {
  const theme = useAppTheme();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const { width } = useWindowDimensions();
  const cardWidth = (width - 48) / 2;

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['search', submitted],
    queryFn: () => api.searchManhwa(submitted),
    enabled: submitted.length > 1,
    staleTime: 0,
    gcTime: 1000 * 60,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  const handleSearch = () => {
    const next = query.trim();
    if (!next) return;
    if (next === submitted) {
      refetch();
      return;
    }
    setSubmitted(next);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder="Search manhwa..."
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={handleSearch} style={[styles.searchBtn, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {isFetching && <LoadingSpinner />}
      {isError && (
        <EmptyState
          icon="⚠️"
          title="Search failed"
          subtitle={`Backend URL: ${api.ACTIVE_API_BASE_URL}\n${(error as Error | undefined)?.message ?? 'Check backend, firewall, and that phone + PC are on same WiFi.'}`}
        />
      )}
      {!isFetching && data?.length === 0 && (
        <EmptyState icon="🔍" title="No results" subtitle={`Nothing found for "${submitted}"`} />
      )}
      {data && data.length > 0 && (
        <FlatList
          data={data}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ManhwaCard
              manhwa={item}
              width={cardWidth}
              onPress={() => navigation.navigate('ManhwaDetail', { manhwa: item })}
            />
          )}
        />
      )}
      {!submitted && !isFetching && (
        <EmptyState icon="🔎" title="Search across all sources" subtitle="Type a title and hit Search" />
      )}
    </View>
  );
}

// ── Updates ───────────────────────────────────────────────────────────────────

export function UpdatesScreen({ navigation }: any) {
  const theme = useAppTheme();
  const entries = useLibraryStore((s) => s.entries);
  const followed = Object.values(entries).map((e) => ({
    url: e.manhwa.url,
    source: e.manhwa.source,
  }));

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['updates'],
    queryFn: () => api.getUpdates(followed),
    enabled: followed.length > 0,
  });

  if (followed.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <EmptyState icon="🔔" title="No followed series" subtitle="Follow manhwa from your library to see updates here" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <SectionHeader title="Updates" action={{ label: 'Refresh', onPress: () => refetch() }} />
      {isFetching && <LoadingSpinner />}
      <ScrollView contentContainerStyle={styles.listContent}>
        {data?.map((update) => {
          const entry = Object.values(entries).find((e) => e.manhwa.url === update.manhwaUrl);
          if (!entry || update.newChapters.length === 0) return null;
          return (
            <View key={update.manhwaUrl} style={[styles.updateCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.updateTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {entry.manhwa.title}
              </Text>
              {update.newChapters.map((ch) => (
                <TouchableOpacity
                  key={ch.id}
                  style={styles.updateChapter}
                  onPress={() => navigation.navigate('Reader', {
                    manhwa: entry.manhwa,
                    chapter: ch,
                    chapterList: update.newChapters,
                  })}
                >
                  <Text style={[styles.updateChapterText, { color: theme.colors.primary }]}>
                    {ch.title}
                  </Text>
                  {ch.uploadedAt && (
                    <Text style={[styles.updateDate, { color: theme.colors.textMuted }]}>
                      {ch.uploadedAt}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Extensions ────────────────────────────────────────────────────────────────

export function ExtensionsScreen({ navigation }: any) {
  const theme = useAppTheme();
  const qc = useQueryClient();

  const { data: extensions, isLoading } = useQuery({
    queryKey: ['extensions'],
    queryFn: api.listExtensions,
  });

  const updateMutation = useMutation({
    mutationFn: api.updateExtension,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['extensions'] }),
  });

  const removeMutation = useMutation({
    mutationFn: api.removeExtension,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['extensions'] }),
  });

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <SectionHeader
        title="Extensions"
        action={{ label: '+ Install', onPress: () => navigation.navigate('InstallExtension') }}
      />
      {isLoading && <LoadingSpinner />}
      <ScrollView contentContainerStyle={styles.listContent}>
        {extensions?.map((ext) => (
          <View key={ext.name} style={[styles.extCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.extRow}>
              <View style={styles.extInfo}>
                <Text style={[styles.extName, { color: theme.colors.text }]}>{ext.name}</Text>
                <Text style={[styles.extUrl, { color: theme.colors.textSecondary }]}>{ext.baseUrl}</Text>
                <Text style={[styles.extVersion, { color: theme.colors.textMuted }]}>v{ext.version} · {ext.language.toUpperCase()}</Text>
              </View>
              <View style={styles.extActions}>
                <TouchableOpacity
                  style={[styles.extBtn, { borderColor: theme.colors.primary }]}
                  onPress={() => updateMutation.mutate(ext.name)}
                >
                  <Text style={[styles.extBtnText, { color: theme.colors.primary }]}>Update</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.extBtn, { borderColor: theme.colors.danger }]}
                  onPress={() => removeMutation.mutate(ext.name)}
                >
                  <Text style={[styles.extBtnText, { color: theme.colors.danger }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
        {extensions?.length === 0 && (
          <EmptyState icon="🧩" title="No extensions installed" subtitle="Tap + Install and paste a GitHub repo URL" />
        )}
      </ScrollView>
    </View>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const theme = useAppTheme();
  const { defaultReadingMode, setDefaultReadingMode, keepScreenOn, setKeepScreenOn, imageQuality, setImageQuality } = useSettingsStore();

  const row = [styles.settingRow, { borderBottomColor: theme.colors.border }];
  const label = [styles.settingLabel, { color: theme.colors.text }];
  const sub = [styles.settingSub, { color: theme.colors.textSecondary }];

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <SectionHeader title="Settings" />
      <ScrollView>
        <Text style={[styles.settingGroup, { color: theme.colors.textMuted }]}>Reader</Text>

        <View style={[styles.settingCard, { backgroundColor: theme.colors.surface }]}>
          <View style={row}>
            <View>
              <Text style={label}>Default reading mode</Text>
              <Text style={sub}>{defaultReadingMode === 'vertical' ? 'Vertical scroll' : 'Horizontal pages'}</Text>
            </View>
            <TouchableOpacity
              style={[styles.modeToggle, { backgroundColor: theme.colors.primaryLight }]}
              onPress={() => setDefaultReadingMode(defaultReadingMode === 'vertical' ? 'horizontal' : 'vertical')}
            >
              <Text style={[styles.modeToggleText, { color: theme.colors.primary }]}>
                {defaultReadingMode === 'vertical' ? '↕' : '↔'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={row}>
            <Text style={label}>Keep screen on while reading</Text>
            <Switch
              value={keepScreenOn}
              onValueChange={setKeepScreenOn}
              trackColor={{ true: theme.colors.primary }}
            />
          </View>
        </View>

        <Text style={[styles.settingGroup, { color: theme.colors.textMuted }]}>Images</Text>

        <View style={[styles.settingCard, { backgroundColor: theme.colors.surface }]}>
          {(['low', 'medium', 'high'] as const).map((q) => (
            <TouchableOpacity
              key={q}
              style={row}
              onPress={() => setImageQuality(q)}
            >
              <Text style={label}>{q.charAt(0).toUpperCase() + q.slice(1)} quality</Text>
              {imageQuality === q && <Text style={{ color: theme.colors.primary }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.settingGroup, { color: theme.colors.textMuted }]}>About</Text>
        <View style={[styles.settingCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.settingRow}>
            <Text style={label}>ManhwaVault</Text>
            <Text style={sub}>v1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { paddingHorizontal: 16, gap: 16 },
  listContent: { padding: 16, gap: 0 },
  searchBar: { flexDirection: 'row', margin: 16, borderRadius: 10, borderWidth: 0.5, overflow: 'hidden', alignItems: 'center' },
  searchInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  searchBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  updateCard: { borderRadius: 10, borderWidth: 0.5, padding: 12, marginBottom: 10 },
  updateTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  updateChapter: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  updateChapterText: { fontSize: 13 },
  updateDate: { fontSize: 12 },
  extCard: { borderRadius: 10, borderWidth: 0.5, padding: 12, marginBottom: 10 },
  extRow: { flexDirection: 'row', gap: 10 },
  extInfo: { flex: 1, gap: 2 },
  extName: { fontSize: 15, fontWeight: '700' },
  extUrl: { fontSize: 12 },
  extVersion: { fontSize: 11 },
  extActions: { gap: 6, justifyContent: 'center' },
  extBtn: { borderWidth: 0.5, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  extBtnText: { fontSize: 12, fontWeight: '600' },
  settingGroup: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  settingCard: { marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5 },
  settingLabel: { fontSize: 15 },
  settingSub: { fontSize: 12, marginTop: 2 },
  modeToggle: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modeToggleText: { fontSize: 18 },
});
