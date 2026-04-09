import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ScrollView, Switch, StyleSheet, useWindowDimensions, Modal, Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../theme';
import { useLibraryStore, useSettingsStore } from '../store';
import { ManhwaCard, LoadingSpinner, EmptyState, SectionHeader, Chip, SourceIcon } from '../components';
import * as api from '../api/client';
import { SourceInfo } from '../types';

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
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const { width } = useWindowDimensions();
  const cardWidth = (width - 48) / 2;

  const {
    includeNsfwSources,
    preferredSearchSource,
    setPreferredSearchSource,
    searchResultLimit,
  } = useSettingsStore();

  const sourcesQuery = useQuery({
    queryKey: ['sources', includeNsfwSources],
    queryFn: () => api.listSources(includeNsfwSources),
  });

  const groupedSearchQuery = useQuery({
    queryKey: ['search-by-source', submitted, includeNsfwSources],
    queryFn: () =>
      api.searchManhwaBySource(submitted, {
        includeNsfw: includeNsfwSources,
        limitPerSource: 4,
        contentType: 'manhwa',
      }),
    enabled: submitted.length > 1 && preferredSearchSource === 'all',
    staleTime: 0,
    gcTime: 1000 * 60,
    refetchOnMount: 'always',
  });

  const flatSearchQuery = useQuery({
    queryKey: ['search', submitted, preferredSearchSource, includeNsfwSources, searchResultLimit],
    queryFn: () =>
      api.searchManhwa(submitted, preferredSearchSource, {
        includeNsfw: includeNsfwSources,
        limit: searchResultLimit,
        contentType: 'manhwa',
      }),
    enabled: submitted.length > 1 && preferredSearchSource !== 'all',
    staleTime: 0,
    gcTime: 1000 * 60,
    refetchOnMount: 'always',
  });

  const sourceOptions = useMemo(() => {
    const all: SourceInfo = { name: 'all', baseUrl: '', language: 'multi', nsfw: false, version: '1.0.0' };
    return [all, ...(sourcesQuery.data ?? [])];
  }, [sourcesQuery.data]);

  const isSearchingAll = preferredSearchSource === 'all';
  const loading = isSearchingAll ? groupedSearchQuery.isFetching : flatSearchQuery.isFetching;
  const searchError = isSearchingAll ? groupedSearchQuery.error : flatSearchQuery.error;
  const groupedResults = groupedSearchQuery.data ?? [];
  const flatResults = flatSearchQuery.data ?? [];

  const handleSearch = () => {
    const next = query.trim();
    if (!next) return;
    setSubmitted(next);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.searchTopRow}>
        <Text style={[styles.searchScreenTitle, { color: theme.colors.text }]}>Search</Text>
        <TouchableOpacity
          onPress={() => setShowSourceMenu((v) => !v)}
          style={[styles.menuBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <Text style={[styles.menuBtnText, { color: theme.colors.text }]}>⋮</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder="Search manga / manhwa"
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

      <Text style={[styles.searchContext, { color: theme.colors.textMuted }]}>
        Source: {preferredSearchSource === 'all' ? 'All sources' : preferredSearchSource}
      </Text>

      <Modal
        transparent
        animationType="fade"
        visible={showSourceMenu}
        onRequestClose={() => setShowSourceMenu(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowSourceMenu(false)}>
          <Pressable
            style={[styles.sourceSheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => {}}
          >
            <View style={[styles.sheetHandle, { backgroundColor: theme.colors.borderStrong }]} />
            <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Search menu</Text>
            <TouchableOpacity
              style={[styles.sheetActionBtn, { borderColor: theme.colors.border }]}
              onPress={() => {
                setShowSourceMenu(false);
                navigation.navigate('Settings');
              }}
            >
              <Text style={[styles.sheetActionText, { color: theme.colors.text }]}>Open Settings</Text>
            </TouchableOpacity>
            <Text style={[styles.sheetSectionTitle, { color: theme.colors.textMuted }]}>Select source</Text>
            <ScrollView style={styles.sourceMenuScroll} nestedScrollEnabled>
              {sourceOptions.map((src) => (
                <TouchableOpacity
                  key={src.name}
                  style={styles.sourceMenuItem}
                  onPress={() => {
                    setPreferredSearchSource(src.name);
                    setShowSourceMenu(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sourceMenuItemText,
                      { color: preferredSearchSource === src.name ? theme.colors.primary : theme.colors.text },
                    ]}
                  >
                    {src.name === 'all' ? 'All sources' : src.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {loading && <LoadingSpinner />}
      {(groupedSearchQuery.isError || flatSearchQuery.isError) && (
        <EmptyState
          icon="⚠️"
          title="Search failed"
          subtitle={(searchError as Error | undefined)?.message ?? 'Unable to query backend.'}
        />
      )}
      {!loading && submitted.length > 1 && isSearchingAll && groupedResults.length === 0 && (
        <EmptyState icon="🔍" title="No source results" subtitle={`Nothing found for "${submitted}"`} />
      )}
      {!loading && submitted.length > 1 && !isSearchingAll && flatResults.length === 0 && (
        <EmptyState icon="🔍" title="No results" subtitle={`Nothing found for "${submitted}"`} />
      )}

      {!loading && isSearchingAll && groupedResults.length > 0 && (
        <ScrollView contentContainerStyle={styles.groupedSearchWrap}>
          <Text style={[styles.groupedHeader, { color: theme.colors.text }]}>Search results</Text>
          {groupedResults.map((group) => (
            <View key={group.source} style={styles.groupSection}>
              <View style={styles.groupTitleRow}>
                <View style={styles.groupTitleLeft}>
                  <SourceIcon name={group.source} iconUrl={group.iconUrl} size={20} />
                  <Text style={[styles.groupTitleText, { color: theme.colors.text }]}>{group.source}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('ExtensionSource', { sourceName: group.source, initialQuery: submitted })}>
                  <Text style={[styles.groupShowAll, { color: theme.colors.primary }]}>Show all</Text>
                </TouchableOpacity>
              </View>

              {group.status === 'error' ? (
                <Text style={[styles.groupError, { color: theme.colors.danger }]} numberOfLines={1}>
                  {group.message ?? 'Source error'}
                </Text>
              ) : group.message ? (
                <Text style={[styles.groupHint, { color: theme.colors.textMuted }]} numberOfLines={1}>
                  {group.message}
                </Text>
              ) : null}

              {group.results.length > 0 ? (
                <FlatList
                  horizontal
                  data={group.results}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.groupRowCards}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={styles.groupCardWrap}>
                      <ManhwaCard
                        manhwa={item}
                        width={96}
                        onPress={() => navigation.navigate('ManhwaDetail', { manhwa: item })}
                      />
                    </View>
                  )}
                />
              ) : (
                <Text style={[styles.groupEmpty, { color: theme.colors.textMuted }]}>No matches in this source.</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {!loading && !isSearchingAll && flatResults.length > 0 && (
        <FlatList
          data={flatResults}
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

      {!submitted && !loading && (
        <EmptyState icon="🔎" title="Search manhwa" subtitle="Use the menu to pick source, then search." />
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
                  <Text style={[styles.updateChapterText, { color: theme.colors.primary }]}>{ch.title}</Text>
                  {ch.uploadedAt && <Text style={[styles.updateDate, { color: theme.colors.textMuted }]}>{ch.uploadedAt}</Text>}
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

  const extensionsQuery = useQuery({ queryKey: ['extensions'], queryFn: api.listExtensions });
  const statsQuery = useQuery({ queryKey: ['extension-stats'], queryFn: api.getExtensionStats });

  const reloadMutation = useMutation({
    mutationFn: api.reloadExtensions,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['extensions'] });
      qc.invalidateQueries({ queryKey: ['sources'] });
      qc.invalidateQueries({ queryKey: ['extension-stats'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: api.updateExtension,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['extensions'] }),
  });

  const removeMutation = useMutation({
    mutationFn: api.removeExtension,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['extensions'] });
      qc.invalidateQueries({ queryKey: ['sources'] });
      qc.invalidateQueries({ queryKey: ['extension-stats'] });
    },
  });

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}> 
      <SectionHeader
        title="Extensions"
        action={{ label: '+ Install', onPress: () => navigation.navigate('InstallExtension') }}
      />

      <View style={styles.extensionSummaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>Installed</Text>
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{statsQuery.data?.total ?? 0}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>Safe</Text>
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{statsQuery.data?.safe ?? 0}</Text>
        </View>
        <TouchableOpacity
          style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border }]}
          onPress={() => reloadMutation.mutate()}
        >
          <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>Sync</Text>
          <Text style={[styles.summaryValue, { color: theme.colors.primary }]}>{reloadMutation.isPending ? '...' : 'Reload'}</Text>
        </TouchableOpacity>
      </View>

      {extensionsQuery.isLoading && <LoadingSpinner />}
      <ScrollView contentContainerStyle={styles.listContent}>
        {extensionsQuery.data?.map((ext) => (
          <View key={ext.name} style={[styles.extCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
            <View style={styles.extRow}>
              <TouchableOpacity style={styles.extInfo} onPress={() => navigation.navigate('ExtensionSource', { sourceName: ext.name })}>
                <View style={styles.extTitleRow}>
                  <SourceIcon name={ext.name} iconUrl={ext.iconUrl} size={26} />
                  <Text style={[styles.extName, { color: theme.colors.text }]}>{ext.name}</Text>
                </View>
                <Text style={[styles.extUrl, { color: theme.colors.textSecondary }]} numberOfLines={1}>{ext.baseUrl}</Text>
                <Text style={[styles.extVersion, { color: theme.colors.textMuted }]}>v{ext.version} · {ext.language.toUpperCase()}</Text>
              </TouchableOpacity>
              <View style={styles.extActions}>
                <TouchableOpacity
                  style={[styles.extBtn, { borderColor: theme.colors.primary }]}
                  onPress={() => navigation.navigate('ExtensionSource', { sourceName: ext.name })}
                >
                  <Text style={[styles.extBtnText, { color: theme.colors.primary }]}>Open</Text>
                </TouchableOpacity>
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
        {extensionsQuery.data?.length === 0 && (
          <EmptyState icon="🧩" title="No extensions installed" subtitle="Tap + Install and paste a GitHub repo URL" />
        )}
      </ScrollView>
    </View>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const theme = useAppTheme();
  const {
    appTheme,
    setAppTheme,
    backendUrl,
    setBackendUrl,
    defaultReadingMode,
    setDefaultReadingMode,
    keepScreenOn,
    setKeepScreenOn,
    imageQuality,
    setImageQuality,
    includeNsfwSources,
    setIncludeNsfwSources,
    searchResultLimit,
    setSearchResultLimit,
  } = useSettingsStore();
  const [backendInput, setBackendInput] = useState(backendUrl);

  useEffect(() => {
    setBackendInput(backendUrl);
  }, [backendUrl]);

  const row = [styles.settingRow];
  const label = [styles.settingLabel, { color: theme.colors.text }];
  const sub = [styles.settingSub, { color: theme.colors.textSecondary }];

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}> 
      <SectionHeader title="Settings" />
      <ScrollView>
        <Text style={[styles.settingGroup, { color: theme.colors.textMuted }]}>Appearance</Text>
        <View style={[styles.settingCard, { backgroundColor: theme.colors.surface }]}> 
          <View style={styles.settingRow}>
            <View>
              <Text style={label}>Theme preset</Text>
              <Text style={sub}>Choose your app look</Text>
            </View>
          </View>
          <View style={styles.limitChipWrap}>
            {[
              { key: 'system', label: 'System' },
              { key: 'midnight', label: 'Midnight' },
              { key: 'ocean', label: 'Ocean' },
              { key: 'sunrise', label: 'Sunrise' },
            ].map((preset) => (
              <Chip
                key={preset.key}
                label={preset.label}
                active={appTheme === preset.key}
                onPress={() => setAppTheme(preset.key as 'system' | 'midnight' | 'ocean' | 'sunrise')}
              />
            ))}
          </View>
        </View>

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
              <Text style={[styles.modeToggleText, { color: theme.colors.primary }]}>{defaultReadingMode === 'vertical' ? '↕' : '↔'}</Text>
            </TouchableOpacity>
          </View>
          <View style={row}>
            <Text style={label}>Keep screen on while reading</Text>
            <Switch value={keepScreenOn} onValueChange={setKeepScreenOn} trackColor={{ true: theme.colors.primary }} />
          </View>
        </View>

        <Text style={[styles.settingGroup, { color: theme.colors.textMuted }]}>Sources</Text>
        <View style={[styles.settingCard, { backgroundColor: theme.colors.surface }]}> 
          <View style={styles.settingRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={label}>Backend URL</Text>
              <Text style={sub}>Use your deployed API here for APK installs</Text>
            </View>
          </View>
          <View style={styles.backendUrlRow}>
            <TextInput
              value={backendInput}
              onChangeText={setBackendInput}
              placeholder="https://api.example.com"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[
                styles.backendUrlInput,
                {
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.background,
                },
              ]}
            />
            <TouchableOpacity
              style={[styles.backendUrlButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setBackendUrl(backendInput)}
            >
              <Text style={styles.backendUrlButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.backendUrlActions}>
            <TouchableOpacity
              style={[styles.backendUrlGhost, { borderColor: theme.colors.border }]}
              onPress={() => {
                setBackendInput('');
                setBackendUrl('');
              }}
            >
              <Text style={[styles.backendUrlGhostText, { color: theme.colors.textSecondary }]}>Use default</Text>
            </TouchableOpacity>
            <Text style={[styles.backendUrlHint, { color: theme.colors.textMuted }]}>Current: {backendUrl || 'auto-detected'}</Text>
          </View>
          <View style={row}>
            <View>
              <Text style={label}>Include NSFW sources</Text>
              <Text style={sub}>Allow adult-tagged extensions in search/catalog</Text>
            </View>
            <Switch value={includeNsfwSources} onValueChange={setIncludeNsfwSources} trackColor={{ true: theme.colors.primary }} />
          </View>
          <View style={styles.settingRow}>
            <View>
              <Text style={label}>Search result limit</Text>
              <Text style={sub}>{searchResultLimit} items per query</Text>
            </View>
          </View>
          <View style={styles.limitChipWrap}>
            {[30, 60, 100, 150, 200].map((limit) => (
              <Chip
                key={limit}
                label={`${limit}`}
                active={searchResultLimit === limit}
                onPress={() => setSearchResultLimit(limit)}
              />
            ))}
          </View>
        </View>

        <Text style={[styles.settingGroup, { color: theme.colors.textMuted }]}>Images</Text>
        <View style={[styles.settingCard, { backgroundColor: theme.colors.surface }]}> 
          {(['low', 'medium', 'high'] as const).map((q) => (
            <TouchableOpacity key={q} style={row} onPress={() => setImageQuality(q)}>
              <Text style={label}>{q.charAt(0).toUpperCase() + q.slice(1)} quality</Text>
              {imageQuality === q && <Text style={{ color: theme.colors.primary }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { paddingHorizontal: 16, gap: 16 },
  listContent: { padding: 16 },
  searchTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  searchScreenTitle: { fontSize: 20, fontWeight: '800' },
  menuBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  menuBtnText: { fontSize: 19, fontWeight: '700', lineHeight: 19 },
  searchBar: { flexDirection: 'row', margin: 16, borderRadius: 16, borderWidth: 0.5, overflow: 'hidden', alignItems: 'center' },
  searchInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  searchBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  searchContext: { fontSize: 12, paddingHorizontal: 16, paddingBottom: 6 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sourceSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 0.5,
    borderBottomWidth: 0,
    maxHeight: '65%',
    paddingBottom: 14,
  },
  sheetHandle: { width: 44, height: 5, borderRadius: 99, alignSelf: 'center', marginTop: 10, marginBottom: 10 },
  sheetTitle: { fontSize: 15, fontWeight: '700', paddingHorizontal: 16, paddingBottom: 8 },
  sheetActionBtn: { marginHorizontal: 16, borderWidth: 0.5, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
  sheetActionText: { fontSize: 14, fontWeight: '600' },
  sheetSectionTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, paddingBottom: 4, fontWeight: '700' },
  sourceMenuScroll: { maxHeight: 220 },
  sourceMenuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  sourceMenuItemText: { fontSize: 14, fontWeight: '600' },
  groupedSearchWrap: { paddingHorizontal: 10, paddingBottom: 20 },
  groupedHeader: { fontSize: 14, fontWeight: '700', marginHorizontal: 6, marginBottom: 4, marginTop: 4 },
  groupSection: { paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingBottom: 3 },
  groupTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitleText: { fontSize: 12, fontWeight: '700' },
  groupShowAll: { fontSize: 11, fontWeight: '600' },
  groupError: { fontSize: 11, paddingHorizontal: 6, paddingBottom: 4 },
  groupHint: { fontSize: 10, paddingHorizontal: 6, paddingBottom: 4 },
  groupEmpty: { fontSize: 11, paddingHorizontal: 6, paddingVertical: 6 },
  groupRowCards: { paddingHorizontal: 2 },
  groupCardWrap: { marginRight: 8 },
  updateCard: { borderRadius: 10, borderWidth: 0.5, padding: 12, marginBottom: 10 },
  updateTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  updateChapter: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  updateChapterText: { fontSize: 13 },
  updateDate: { fontSize: 12 },
  extensionSummaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 6 },
  summaryCard: { flex: 1, borderRadius: 10, borderWidth: 0.5, paddingVertical: 8, paddingHorizontal: 10 },
  summaryLabel: { fontSize: 11 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  extCard: { borderRadius: 10, borderWidth: 0.5, padding: 12, marginBottom: 10 },
  extRow: { flexDirection: 'row', gap: 10 },
  extInfo: { flex: 1, gap: 2 },
  extTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 1 },
  extName: { fontSize: 15, fontWeight: '700' },
  extUrl: { fontSize: 12 },
  extVersion: { fontSize: 11 },
  extActions: { gap: 6, justifyContent: 'center' },
  extBtn: { borderWidth: 0.5, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  extBtnText: { fontSize: 12, fontWeight: '600' },
  backendUrlRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  backendUrlInput: { flex: 1, borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  backendUrlButton: { borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  backendUrlButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  backendUrlActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  backendUrlGhost: { borderWidth: 0.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  backendUrlGhostText: { fontSize: 12, fontWeight: '600' },
  backendUrlHint: { flex: 1, fontSize: 11, textAlign: 'right' },
  settingGroup: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  settingCard: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', marginBottom: 10, paddingVertical: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, marginVertical: 2 },
  settingLabel: { fontSize: 15 },
  settingSub: { fontSize: 12, marginTop: 2 },
  modeToggle: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modeToggleText: { fontSize: 18 },
  limitChipWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2 },
});
