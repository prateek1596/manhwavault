import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  FlatList, TextInput, StyleSheet, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../theme';
import { useLibraryStore, useSettingsStore } from '../store';
import { LoadingSpinner, Chip, ManhwaCard, EmptyState } from '../components';
import * as api from '../api/client';
import { Chapter, Manhwa } from '../types';

// ── ManhwaDetail ──────────────────────────────────────────────────────────────

export function ManhwaDetailScreen({ route, navigation }: any) {
  const theme = useAppTheme();
  const { manhwa }: { manhwa: Manhwa } = route.params;
  const { follow, unfollow, isFollowing, getEntry, toggleNotifications, toggleBookmark, toggleDownloaded, markViewed } = useLibraryStore();
  const following = isFollowing(manhwa.id);
  const entry = getEntry(manhwa.id);

  useEffect(() => {
    markViewed(manhwa.id);
  }, [markViewed, manhwa.id]);

  const { data: chapters, isLoading } = useQuery({
    queryKey: ['chapters', manhwa.url],
    queryFn: () => api.getChapters(manhwa.url, manhwa.source),
  });

  const handleFollow = () => {
    if (following) unfollow(manhwa.id);
    else follow(manhwa);
  };

  const handleReadChapter = (chapter: Chapter) => {
    navigation.navigate('Reader', {
      manhwa,
      chapter,
      chapterList: chapters ?? [],
    });
  };

  const handleResume = () => {
    if (!chapters || !entry?.lastReadChapter) return;
    const next = chapters.find((c) => c.number > (entry.lastReadChapter ?? 0));
    const target = next ?? chapters[0];
    handleReadChapter(target);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView>
        {/* Hero */}
        <View style={styles.hero}>
          <Image source={{ uri: manhwa.cover }} style={styles.heroCover} resizeMode="cover" />
          <View style={[styles.heroOverlay, { backgroundColor: theme.colors.background }]} />
          <View style={styles.heroContent}>
            <Image source={{ uri: manhwa.cover }} style={styles.heroPoster} resizeMode="cover" />
            <View style={styles.heroInfo}>
              <Text style={[styles.heroTitle, { color: theme.colors.text }]} numberOfLines={3}>
                {manhwa.title}
              </Text>
              <Text style={[styles.heroSub, { color: theme.colors.textSecondary }]}>
                {manhwa.source}
              </Text>
              {manhwa.status && (
                <View style={[styles.statusPill, { backgroundColor: theme.colors.primaryLight }]}>
                  <Text style={[styles.statusText, { color: theme.colors.primary }]}>
                    {manhwa.status}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: following ? theme.colors.surfaceVariant : theme.colors.primary }]}
            onPress={handleFollow}
          >
            <Text style={[styles.actionBtnText, { color: following ? theme.colors.text : '#fff' }]}>
              {following ? '✓ In Library' : '+ Add to Library'}
            </Text>
          </TouchableOpacity>
          {following && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.colors.surface, borderWidth: 0.5, borderColor: theme.colors.border }]}
              onPress={() => toggleNotifications(manhwa.id)}
            >
              <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>
                {entry?.notificationsEnabled ? '🔔 Alerts On' : '🔕 Alerts Off'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: entry?.bookmarked ? theme.colors.primaryLight : theme.colors.surface,
                borderWidth: 0.5,
                borderColor: entry?.bookmarked ? theme.colors.primary : theme.colors.border,
              },
            ]}
            onPress={() => toggleBookmark(manhwa.id)}
          >
            <Text style={[styles.actionBtnText, { color: entry?.bookmarked ? theme.colors.primary : theme.colors.text }]}>
              {entry?.bookmarked ? '★ Bookmarked' : '☆ Bookmark'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: entry?.downloaded ? theme.colors.primaryLight : theme.colors.surface,
                borderWidth: 0.5,
                borderColor: entry?.downloaded ? theme.colors.primary : theme.colors.border,
              },
            ]}
            onPress={() => toggleDownloaded(manhwa.id)}
          >
            <Text style={[styles.actionBtnText, { color: entry?.downloaded ? theme.colors.primary : theme.colors.text }]}>
              {entry?.downloaded ? '⬇ Downloaded' : '⬇ Mark Downloaded'}
            </Text>
          </TouchableOpacity>
          {following && entry?.lastReadChapter !== undefined && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.colors.surface, borderWidth: 0.5, borderColor: theme.colors.border }]}
              onPress={handleResume}
            >
              <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Resume</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Genres */}
        {manhwa.genres && manhwa.genres.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genres} contentContainerStyle={styles.genresContent}>
            {manhwa.genres.map((g) => <Chip key={g} label={g} />)}
          </ScrollView>
        )}

        {/* Description */}
        {manhwa.description && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Synopsis</Text>
            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{manhwa.description}</Text>
          </View>
        )}

        {/* Chapters */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Chapters {chapters ? `(${chapters.length})` : ''}
          </Text>
          {isLoading && <LoadingSpinner />}
          {chapters?.map((ch) => {
            const isRead = (entry?.lastReadChapter ?? 0) >= ch.number;
            return (
              <TouchableOpacity
                key={ch.id}
                style={[styles.chapterRow, { borderBottomColor: theme.colors.border }]}
                onPress={() => handleReadChapter(ch)}
              >
                <View>
                  <Text style={[styles.chapterTitle, { color: isRead ? theme.colors.textMuted : theme.colors.text }]}>
                    {ch.title}
                  </Text>
                  {ch.uploadedAt && (
                    <Text style={[styles.chapterDate, { color: theme.colors.textMuted }]}>{ch.uploadedAt}</Text>
                  )}
                </View>
                {isRead && <Text style={[styles.readBadge, { color: theme.colors.textMuted }]}>Read</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ── InstallExtension ──────────────────────────────────────────────────────────

export function InstallExtensionScreen({ navigation }: any) {
  const theme = useAppTheme();
  const [url, setUrl] = useState('');
  const qc = useQueryClient();

  const installMutation = useMutation({
    mutationFn: api.installExtension,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['extensions'] });
      Alert.alert('Installed', `"${data.installed}" is ready to use.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (err: Error) => {
      Alert.alert('Install failed', err.message);
    },
  });

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.installContent}>
        <Text style={[styles.installTitle, { color: theme.colors.text }]}>Install extension</Text>
        <Text style={[styles.installSub, { color: theme.colors.textSecondary }]}>
          Paste a GitHub repository URL. The repo must contain an{' '}
          <Text style={{ fontWeight: '700' }}>extension.json</Text> and{' '}
          <Text style={{ fontWeight: '700' }}>scraper.py</Text>.
        </Text>

        <View style={[styles.urlInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <TextInput
            style={[styles.urlTextInput, { color: theme.colors.text }]}
            placeholder="https://github.com/username/ext-sitename"
            placeholderTextColor={theme.colors.textMuted}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.installBtn, { backgroundColor: url.trim() ? theme.colors.primary : theme.colors.surfaceVariant }]}
          onPress={() => installMutation.mutate(url.trim())}
          disabled={!url.trim() || installMutation.isPending}
        >
          <Text style={[styles.installBtnText, { color: url.trim() ? '#fff' : theme.colors.textMuted }]}>
            {installMutation.isPending ? 'Installing...' : 'Install'}
          </Text>
        </TouchableOpacity>

        <View style={[styles.exampleBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.exampleTitle, { color: theme.colors.text }]}>Example repos</Text>
          {[
            'https://github.com/you/ext-asura-scans',
            'https://github.com/you/ext-flame-scans',
            'https://github.com/you/ext-manga-buddy',
          ].map((ex) => (
            <TouchableOpacity key={ex} onPress={() => setUrl(ex)}>
              <Text style={[styles.exampleUrl, { color: theme.colors.primary }]}>{ex}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ── ExtensionSource ──────────────────────────────────────────────────────────

export function ExtensionSourceScreen({ route, navigation }: any) {
  const theme = useAppTheme();
  const { sourceName, initialQuery }: { sourceName: string; initialQuery?: string } = route.params;
  const includeNsfwSources = useSettingsStore((s) => s.includeNsfwSources);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<Manhwa[]>([]);

  const browseLimit = 30;
  const isSearching = submittedQuery.trim().length > 0;

  const catalogQuery = useQuery({
    queryKey: ['source-catalog', sourceName, submittedQuery, page, includeNsfwSources],
    queryFn: () =>
      api.getSourceCatalog(sourceName, {
        q: submittedQuery,
        page,
        limit: browseLimit,
        includeNsfw: includeNsfwSources,
        contentType: 'manhwa',
      }),
  });

  useEffect(() => {
    const items = catalogQuery.data?.items ?? [];
    if (page === 1) {
      setCatalog(items);
      return;
    }
    if (items.length > 0) {
      setCatalog((prev) => {
        const seen = new Set(prev.map((m) => `${m.source}-${m.url}`));
        const next = [...prev];
        for (const item of items) {
          const key = `${item.source}-${item.url}`;
          if (!seen.has(key)) {
            seen.add(key);
            next.push(item);
          }
        }
        return next;
      });
    }
  }, [catalogQuery.data?.items, page]);

  const canLoadMore = useMemo(() => Boolean(catalogQuery.data?.hasMore) && !isSearching, [catalogQuery.data?.hasMore, isSearching]);

  const submitSearch = () => {
    const next = query.trim();
    setPage(1);
    setSubmittedQuery(next);
  };

  useEffect(() => {
    const preset = (initialQuery ?? '').trim();
    if (!preset) {
      return;
    }
    setQuery(preset);
    setSubmittedQuery(preset);
    setPage(1);
  }, [initialQuery]);

  const clearSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setPage(1);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.installContent}>
        <Text style={[styles.installTitle, { color: theme.colors.text }]}>Browse {sourceName}</Text>
        <Text style={[styles.installSub, { color: theme.colors.textSecondary }]}>Manhwa-first catalog and source-specific search.</Text>
        <View style={[styles.urlInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <TextInput
            style={[styles.urlTextInput, { color: theme.colors.text }]}
            placeholder="Search title inside this source"
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={submitSearch}
          />
        </View>
        <View style={styles.catalogActions}>
          <TouchableOpacity style={[styles.catalogActionBtn, { backgroundColor: theme.colors.primary }]} onPress={submitSearch}>
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.catalogActionBtn, { backgroundColor: theme.colors.surface, borderWidth: 0.5, borderColor: theme.colors.border }]} onPress={clearSearch}>
            <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Catalog</Text>
          </TouchableOpacity>
        </View>
      </View>

      {catalogQuery.isLoading && page === 1 ? <LoadingSpinner /> : null}
      {!catalogQuery.isLoading && catalog.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No titles found"
          subtitle={catalogQuery.data?.message ?? 'Try another keyword or open another extension.'}
        />
      ) : (
        <FlatList
          data={catalog}
          keyExtractor={(item) => `${item.source}-${item.url}`}
          numColumns={2}
          contentContainerStyle={styles.sourceGrid}
          columnWrapperStyle={styles.sourceGridRow}
          renderItem={({ item }) => (
            <ManhwaCard
              manhwa={item}
              width={156}
              onPress={() => navigation.navigate('ManhwaDetail', { manhwa: item })}
            />
          )}
          ListFooterComponent={
            canLoadMore ? (
              <TouchableOpacity
                style={[styles.installBtn, { backgroundColor: theme.colors.surfaceVariant, marginHorizontal: 16, marginBottom: 24 }]}
                onPress={() => setPage((p) => p + 1)}
                disabled={catalogQuery.isFetching}
              >
                <Text style={[styles.installBtnText, { color: theme.colors.text }]}>
                  {catalogQuery.isFetching ? 'Loading...' : 'Load more'}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { height: 220, position: 'relative', marginBottom: 8 },
  heroCover: { width: '100%', height: 220, position: 'absolute', opacity: 0.3 },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, opacity: 0.9 },
  heroContent: { position: 'absolute', bottom: 0, left: 16, right: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  heroPoster: { width: 90, height: 130, borderRadius: 8 },
  heroInfo: { flex: 1, gap: 4, paddingBottom: 8 },
  heroTitle: { fontSize: 18, fontWeight: '800', lineHeight: 24 },
  heroSub: { fontSize: 13 },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
  genres: { marginBottom: 4 },
  genresContent: { paddingHorizontal: 16, gap: 0 },
  section: { paddingHorizontal: 16, paddingVertical: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  description: { fontSize: 14, lineHeight: 22 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5 },
  chapterTitle: { fontSize: 14, fontWeight: '500' },
  chapterDate: { fontSize: 11, marginTop: 2 },
  readBadge: { fontSize: 12 },
  installContent: { padding: 24, gap: 16 },
  installTitle: { fontSize: 22, fontWeight: '800' },
  installSub: { fontSize: 14, lineHeight: 22 },
  urlInput: { borderRadius: 10, borderWidth: 0.5, overflow: 'hidden' },
  urlTextInput: { padding: 14, fontSize: 14 },
  installBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  installBtnText: { fontSize: 15, fontWeight: '700' },
  exampleBox: { borderRadius: 10, borderWidth: 0.5, padding: 14, gap: 8 },
  exampleTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  exampleUrl: { fontSize: 12 },
  sourceGrid: { paddingHorizontal: 12, paddingBottom: 20 },
  sourceGridRow: { justifyContent: 'space-between', paddingHorizontal: 4 },
  catalogActions: { flexDirection: 'row', gap: 10 },
  catalogActionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
});
