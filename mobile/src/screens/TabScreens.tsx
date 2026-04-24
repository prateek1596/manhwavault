import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  useWindowDimensions,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../theme';
import { useLibraryStore, useSettingsStore } from '../store';
import { ManhwaCard, LoadingSpinner, EmptyState, Chip, SourceIcon } from '../components';
import * as api from '../api/client';
import { SourceInfo } from '../types';

function parseChapterFromText(value?: string | number): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value) return null;
  const match = String(value).match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

// ── Library ───────────────────────────────────────────────────────────────────

export function LibraryScreen({ navigation }: any) {
  const theme = useAppTheme();
  const entries = useLibraryStore((s) => s.entries);
  const { width } = useWindowDimensions();
  const cardWidth = (width - 48) / 2;
  const library = Object.values(entries).sort((a, b) => {
    const aTime = new Date(a.lastReadAt || a.followedAt || 0).getTime();
    const bTime = new Date(b.lastReadAt || b.followedAt || 0).getTime();
    return bTime - aTime;
  });

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View style={styles.screenPad}>
        <TouchableOpacity
          style={[styles.searchShell, { backgroundColor: theme.colors.surfaceVariant }]}
          onPress={() => navigation.navigate('Search')}
        >
          <MaterialCommunityIcons name="magnify" size={22} color={theme.colors.textMuted} style={styles.searchGlyph} />
          <Text style={[styles.searchPrompt, { color: theme.colors.textSecondary }]}>Search manga</Text>
          <MaterialCommunityIcons name="dots-vertical" size={21} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <View style={[styles.filterPill, { borderColor: theme.colors.borderStrong }]}>
            <Text style={[styles.filterPillText, { color: theme.colors.text }]}>On device</Text>
          </View>
          <View style={[styles.filterPill, { borderColor: theme.colors.borderStrong }]}>
            <Text style={[styles.filterPillText, { color: theme.colors.text }]}>New chapters</Text>
          </View>
          <View style={[styles.filterPill, { borderColor: theme.colors.borderStrong }]}>
            <Text style={[styles.filterPillText, { color: theme.colors.text }]}>Completed</Text>
          </View>
        </ScrollView>

        <Text style={[styles.sectionHead, { color: theme.colors.textSecondary }]}>Recent</Text>
      </View>

      {library.length === 0 ? (
        <EmptyState
          icon="📚"
          title="Your library is empty"
          subtitle="Search and follow series to build your history."
          action={{ label: 'Browse', onPress: () => navigation.navigate('Search') }}
        />
      ) : (
        <FlatList
          data={library}
          numColumns={2}
          keyExtractor={(item) => item.manhwa.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.listContent, { paddingTop: 0 }]}
          renderItem={({ item }) => {
            const latestChapter = parseChapterFromText(item.manhwa.latestChapter);
            const progressPercent =
              latestChapter && item.lastReadChapter !== undefined
                ? Math.max(0, Math.min(100, (item.lastReadChapter / latestChapter) * 100))
                : undefined;

            return (
              <ManhwaCard
                manhwa={item.manhwa}
                width={cardWidth}
                progressPercent={progressPercent}
                onPress={() => navigation.navigate('ManhwaDetail', { manhwa: item.manhwa })}
              />
            );
          }}
        />
      )}
    </View>
  );
}

// ── Search ────────────────────────────────────────────────────────────────────

export function SearchScreen({ navigation }: any) {
  const theme = useAppTheme();
  const REFRESH_COOLDOWN_MS = 1500;
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [nextSuggestionRefreshAt, setNextSuggestionRefreshAt] = useState(0);
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
  const sourceGrid = sourceOptions.filter((src) => src.name !== 'all').slice(0, 12);

  const suggestionsQuery = useQuery({
    queryKey: ['search-suggestions', preferredSearchSource, includeNsfwSources],
    queryFn: () =>
      api.getSearchSuggestions({
        source: preferredSearchSource,
        includeNsfw: includeNsfwSources,
        limit: 10,
        contentType: 'manhwa',
      }),
    enabled: submitted.length === 0,
    staleTime: 1000 * 60 * 3,
  });
  const suggestions = suggestionsQuery.data ?? [];

  const handleSuggestionRefresh = () => {
    if (suggestionsQuery.isFetching || Date.now() < nextSuggestionRefreshAt) {
      return;
    }
    setNextSuggestionRefreshAt(Date.now() + REFRESH_COOLDOWN_MS);
    suggestionsQuery.refetch();
  };

  const handleSearch = () => {
    const next = query.trim();
    if (!next) return;
    setSubmitted(next);
    setRecentQueries((prev) => {
      const deduped = prev.filter((item) => item.toLowerCase() !== next.toLowerCase());
      return [next, ...deduped].slice(0, 6);
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View style={styles.screenPad}>
        <View style={[styles.searchShell, { backgroundColor: theme.colors.surfaceVariant }]}>
          <MaterialCommunityIcons name="magnify" size={22} color={theme.colors.textMuted} style={styles.searchGlyph} />
          <TextInput
            style={[styles.searchInputInline, { color: theme.colors.text }]}
            placeholder="Search manga"
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowSourceMenu(true)}>
            <MaterialCommunityIcons name="dots-vertical" size={21} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <View style={[styles.filterPill, { borderColor: theme.colors.borderStrong }]}>
            <Text style={[styles.filterPillText, { color: theme.colors.textSecondary }]}>Local storage</Text>
          </View>
          <View style={[styles.filterPill, { borderColor: theme.colors.borderStrong }]}>
            <Text style={[styles.filterPillText, { color: theme.colors.textSecondary }]}>Bookmarks</Text>
          </View>
          <View style={[styles.filterPill, { borderColor: theme.colors.borderStrong }]}>
            <Text style={[styles.filterPillText, { color: theme.colors.textSecondary }]}>Random</Text>
          </View>
          <View style={[styles.filterPill, { borderColor: theme.colors.borderStrong }]}>
            <Text style={[styles.filterPillText, { color: theme.colors.textSecondary }]}>Downloads</Text>
          </View>
        </ScrollView>
      </View>

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

      {!loading && submitted.length > 1 && isSearchingAll && groupedResults.length > 0 && (
        <ScrollView contentContainerStyle={styles.groupedSearchWrap}>
          <Text style={[styles.sectionHead, { color: theme.colors.text }]}>Results</Text>
          {groupedResults.map((group) => (
            <View key={group.source} style={[styles.groupSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.groupTitleRow}>
                <View style={styles.groupTitleLeft}>
                  <SourceIcon name={group.source} iconUrl={group.iconUrl} size={20} />
                  <Text style={[styles.groupTitleText, { color: theme.colors.text }]}>{group.source}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('ExtensionSource', { sourceName: group.source, initialQuery: submitted })}>
                  <Text style={[styles.groupShowAll, { color: theme.colors.primary }]}>Show all</Text>
                </TouchableOpacity>
              </View>

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
                        width={104}
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

      {!loading && submitted.length > 1 && !isSearchingAll && flatResults.length > 0 && (
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
        <ScrollView contentContainerStyle={styles.discoveryWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHead, { color: theme.colors.text }]}>Suggestions</Text>
            <TouchableOpacity onPress={handleSuggestionRefresh} disabled={suggestionsQuery.isFetching || Date.now() < nextSuggestionRefreshAt}>
              <Text style={[styles.sectionMore, { color: theme.colors.primary }]}>
                {suggestionsQuery.isFetching ? 'Refreshing...' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.discoveryText, { color: theme.colors.textSecondary }]}>Use search or pick a source below to explore quickly.</Text>

          {suggestionsQuery.isLoading && suggestions.length === 0 && (
            <FlatList
              horizontal
              data={[0, 1, 2, 3]}
              keyExtractor={(item) => `mobile-suggestion-skeleton-${item}`}
              contentContainerStyle={styles.groupRowCards}
              showsHorizontalScrollIndicator={false}
              renderItem={() => (
                <View style={[styles.suggestionSkeletonCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <View style={[styles.suggestionSkeletonCover, { backgroundColor: theme.colors.surfaceVariant }]} />
                  <View style={styles.suggestionSkeletonBody}>
                    <View style={[styles.suggestionSkeletonLine, { backgroundColor: theme.colors.border, width: '85%' }]} />
                    <View style={[styles.suggestionSkeletonLine, { backgroundColor: theme.colors.border, width: '55%', marginBottom: 0 }]} />
                  </View>
                </View>
              )}
            />
          )}

          {suggestions.length > 0 && (
            <FlatList
              horizontal
              data={suggestions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.groupRowCards}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.groupCardWrap}>
                  <ManhwaCard
                    manhwa={item}
                    width={112}
                    onPress={() => navigation.navigate('ManhwaDetail', { manhwa: item })}
                  />
                </View>
              )}
            />
          )}

          {recentQueries.length > 0 && (
            <>
              <View style={[styles.sectionHeaderRow, { marginTop: 12 }]}>
                <Text style={[styles.sectionHead, { color: theme.colors.text }]}>Recent searches</Text>
              </View>
              <View style={styles.limitChipWrap}>
                {recentQueries.map((value) => (
                  <Chip
                    key={value}
                    label={value}
                    onPress={() => {
                      setQuery(value);
                      setSubmitted(value);
                    }}
                  />
                ))}
              </View>
            </>
          )}

          <View style={[styles.sectionHeaderRow, { marginTop: 16 }]}>
            <Text style={[styles.sectionHead, { color: theme.colors.text }]}>Manga sources</Text>
            <Text style={[styles.sectionMore, { color: theme.colors.primary }]}>Manage</Text>
          </View>
          <View style={styles.sourceGrid}>
            {sourceGrid.map((src) => (
              <TouchableOpacity
                key={src.name}
                style={styles.sourceGridItem}
                onPress={() => {
                  setPreferredSearchSource(src.name);
                  navigation.navigate('ExtensionSource', { sourceName: src.name });
                }}
              >
                <SourceIcon name={src.name} iconUrl={src.iconUrl} size={52} />
                <Text style={[styles.sourceGridText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {src.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── Updates ───────────────────────────────────────────────────────────────────

export function UpdatesScreen({ navigation }: any) {
  const theme = useAppTheme();
  const entries = useLibraryStore((s) => s.entries);
  const libraryEntries = Object.values(entries);
  const followed = libraryEntries.filter((e) => e.notificationsEnabled).map((e) => ({
    url: e.manhwa.url,
    source: e.manhwa.source,
  }));
  const followedSignature = followed.map((item) => `${item.source}|${item.url}`);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['updates', ...followedSignature],
    queryFn: () => api.getUpdates(followed),
    enabled: followed.length > 0,
  });

  if (libraryEntries.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <EmptyState icon="🔔" title="No followed series" subtitle="Follow manhwa from your library to see updates here" />
      </View>
    );
  }

  if (followed.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <EmptyState icon="🔕" title="Notifications are off" subtitle="Enable alerts on a series in its detail page to receive updates." />
      </View>
    );
  }

  const updates = data ?? [];
  const topCards = updates
    .map((update) => {
      const entry = Object.values(entries).find((e) => {
        if (!update.source) return e.manhwa.url === update.manhwaUrl;
        return e.manhwa.url === update.manhwaUrl && e.manhwa.source === update.source;
      });
      if (!entry) return null;
      return {
        id: `${update.source ?? 'unknown'}-${update.manhwaUrl}`,
        manhwa: entry.manhwa,
      };
    })
    .filter(Boolean) as Array<{ id: string; manhwa: any }>;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.feedWrap} showsVerticalScrollIndicator={false}>
        <View style={styles.screenPad}>
          <TouchableOpacity
            style={[styles.searchShell, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={() => navigation.navigate('Search')}
          >
            <MaterialCommunityIcons name="magnify" size={22} color={theme.colors.textMuted} style={styles.searchGlyph} />
            <Text style={[styles.searchPrompt, { color: theme.colors.textSecondary }]}>Search manga</Text>
            <MaterialCommunityIcons name="dots-vertical" size={21} color={theme.colors.textMuted} />
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <View style={[styles.filterPill, { borderColor: theme.colors.borderStrong }]}>
              <Text style={[styles.filterPillText, { color: theme.colors.text }]}>Read later</Text>
            </View>
            <View style={[styles.filterPill, { borderColor: theme.colors.borderStrong }]}>
              <Text style={[styles.filterPillText, { color: theme.colors.text }]}>Secret</Text>
            </View>
            <TouchableOpacity style={[styles.filterPillSolid, { backgroundColor: theme.colors.primary }]} onPress={() => refetch()}>
              <Text style={styles.filterPillSolidText}>Refresh</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {isFetching && <LoadingSpinner />}

        {topCards.length > 0 && (
          <View style={styles.topUpdatesBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHead, { color: theme.colors.text }]}>Updates</Text>
              <Text style={[styles.sectionMore, { color: theme.colors.primary }]}>More</Text>
            </View>
            <FlatList
              horizontal
              data={topCards}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.topUpdatesRow}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.topUpdateCard}
                  onPress={() => navigation.navigate('ManhwaDetail', { manhwa: item.manhwa })}
                >
                  <Image source={{ uri: item.manhwa.cover }} style={styles.topUpdateImage} resizeMode="cover" />
                  <Text style={[styles.topUpdateTitle, { color: theme.colors.text }]} numberOfLines={2}>{item.manhwa.title}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHead, { color: theme.colors.text }]}>Today</Text>
        </View>

        {updates.map((update) => {
          const entry = Object.values(entries).find((e) => {
            if (!update.source) return e.manhwa.url === update.manhwaUrl;
            return e.manhwa.url === update.manhwaUrl && e.manhwa.source === update.source;
          });
          if (!entry || update.newChapters.length === 0) return null;
          return (
            <View key={`${update.source ?? 'unknown'}-${update.manhwaUrl}`} style={styles.feedItem}>
              <Image source={{ uri: entry.manhwa.cover }} style={styles.feedThumb} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.feedTitle, { color: theme.colors.text }]} numberOfLines={1}>{entry.manhwa.title}</Text>
                {update.newChapters.map((ch) => (
                  <TouchableOpacity
                    key={ch.id}
                    style={styles.feedChapterRow}
                    onPress={() => navigation.navigate('Reader', {
                      manhwa: entry.manhwa,
                      chapter: ch,
                      chapterList: update.newChapters,
                    })}
                  >
                    <Text style={[styles.feedDot, { color: '#E9B4B0' }]}>●</Text>
                    <Text style={[styles.feedChapter, { color: theme.colors.textSecondary }]} numberOfLines={1}>{ch.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
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
      <View style={styles.screenPad}>
        <Text style={[styles.sectionHead, { color: theme.colors.text }]}>Extensions</Text>
      </View>

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
      <ScrollView contentContainerStyle={styles.settingsWrap} showsVerticalScrollIndicator={false}>
        <Text style={[styles.settingGroup, { color: theme.colors.textMuted }]}>Appearance</Text>
        <View style={[styles.settingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
        <View style={[styles.settingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={row}>
            <View>
              <Text style={label}>Default reading mode</Text>
              <Text style={sub}>{defaultReadingMode === 'vertical' ? 'Vertical scroll' : 'Horizontal pages'}</Text>
            </View>
            <TouchableOpacity
              style={[styles.modeToggle, { backgroundColor: theme.colors.primaryLight }]}
              onPress={() => setDefaultReadingMode(defaultReadingMode === 'vertical' ? 'horizontal' : 'vertical')}
            >
              <MaterialCommunityIcons
                name={defaultReadingMode === 'vertical' ? 'swap-vertical' : 'swap-horizontal'}
                size={20}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          </View>
          <View style={row}>
            <Text style={label}>Keep screen on while reading</Text>
            <Switch value={keepScreenOn} onValueChange={setKeepScreenOn} trackColor={{ true: theme.colors.primary }} />
          </View>
        </View>

        <Text style={[styles.settingGroup, { color: theme.colors.textMuted }]}>Sources</Text>
        <View style={[styles.settingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
        <View style={[styles.settingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
  screenPad: { paddingHorizontal: 16, paddingTop: 12 },
  row: { paddingHorizontal: 16, gap: 16 },
  listContent: { padding: 16, paddingBottom: 28 },
  settingsWrap: { paddingBottom: 24 },

  searchShell: {
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchGlyph: { marginRight: 10 },
  searchPrompt: { flex: 1, fontSize: 16, fontWeight: '500' },
  searchInputInline: { flex: 1, fontSize: 16, paddingVertical: 0 },

  filterRow: { paddingBottom: 8, gap: 8 },
  filterPill: {
    borderWidth: 1.25,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterPillText: { fontSize: 13, fontWeight: '700' },
  filterPillSolid: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  filterPillSolidText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  sectionHead: { fontSize: 15, fontWeight: '800', marginBottom: 9 },
  sectionHeaderRow: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionMore: { fontSize: 13, fontWeight: '700' },

  groupedSearchWrap: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  groupSection: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  groupTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitleText: { fontSize: 12, fontWeight: '800' },
  groupShowAll: { fontSize: 12, fontWeight: '700' },
  groupEmpty: { fontSize: 12, paddingVertical: 6 },
  groupRowCards: { paddingRight: 4 },
  groupCardWrap: { marginRight: 8 },

  discoveryWrap: { paddingHorizontal: 16, paddingBottom: 24 },
  discoveryText: { fontSize: 13, lineHeight: 19 },
  suggestionSkeletonCard: {
    width: 112,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: 8,
  },
  suggestionSkeletonCover: {
    width: '100%',
    height: 162,
    opacity: 0.75,
  },
  suggestionSkeletonBody: { paddingHorizontal: 8, paddingVertical: 8 },
  suggestionSkeletonLine: { height: 10, borderRadius: 999, marginBottom: 8 },
  sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  sourceGridItem: { width: '22%', alignItems: 'center', gap: 7 },
  sourceGridText: { fontSize: 12, textAlign: 'center', width: '100%' },

  feedWrap: { paddingBottom: 24 },
  topUpdatesBlock: { marginTop: 4 },
  topUpdatesRow: { paddingHorizontal: 16, gap: 10 },
  topUpdateCard: { width: 130 },
  topUpdateImage: { width: 130, height: 184, borderRadius: 16, marginBottom: 6 },
  topUpdateTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700' },

  feedItem: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    alignItems: 'center',
  },
  feedThumb: { width: 50, height: 50, borderRadius: 10 },
  feedTitle: { fontSize: 15, fontWeight: '700', marginBottom: 1 },
  feedChapterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  feedDot: { fontSize: 11 },
  feedChapter: { fontSize: 13 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sourceSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '65%',
    paddingBottom: 14,
  },
  sheetHandle: { width: 44, height: 5, borderRadius: 99, alignSelf: 'center', marginTop: 10, marginBottom: 10 },
  sheetTitle: { fontSize: 15, fontWeight: '800', paddingHorizontal: 16, paddingBottom: 8 },
  sheetActionBtn: { marginHorizontal: 16, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
  sheetActionText: { fontSize: 14, fontWeight: '600' },
  sheetSectionTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, paddingBottom: 4, fontWeight: '700' },
  sourceMenuScroll: { maxHeight: 220 },
  sourceMenuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  sourceMenuItemText: { fontSize: 14, fontWeight: '600' },

  extensionSummaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 6 },
  summaryCard: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 10 },
  summaryLabel: { fontSize: 11 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  extCard: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10 },
  extRow: { flexDirection: 'row', gap: 10 },
  extInfo: { flex: 1, gap: 2 },
  extTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 1 },
  extName: { fontSize: 15, fontWeight: '700' },
  extUrl: { fontSize: 12 },
  extVersion: { fontSize: 11 },
  extActions: { gap: 6, justifyContent: 'center' },
  extBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  extBtnText: { fontSize: 12, fontWeight: '600' },

  backendUrlRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  backendUrlInput: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  backendUrlButton: { borderRadius: 18, paddingHorizontal: 14, justifyContent: 'center' },
  backendUrlButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  backendUrlActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  backendUrlGhost: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  backendUrlGhostText: { fontSize: 12, fontWeight: '600' },
  backendUrlHint: { flex: 1, fontSize: 11, textAlign: 'right' },
  settingGroup: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  settingCard: { marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', marginBottom: 10, paddingVertical: 4, borderWidth: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, marginVertical: 2 },
  settingLabel: { fontSize: 15 },
  settingSub: { fontSize: 12, marginTop: 2 },
  modeToggle: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  limitChipWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2, gap: 8 },
});
