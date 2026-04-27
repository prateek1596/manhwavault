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
import DraggableFlatList from 'react-native-draggable-flatlist';
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

function getManhwaLatestChapterNumber(latestChapter?: string): number | null {
  return parseChapterFromText(latestChapter);
}

function getLibraryActivityTime(entry: any): number {
  return new Date(entry.lastOpenedAt || entry.lastReadAt || entry.followedAt || 0).getTime();
}

function isCompletedEntry(entry: any): boolean {
  const latest = getManhwaLatestChapterNumber(entry?.manhwa?.latestChapter);
  if (!latest || entry?.lastReadChapter === undefined) return false;
  return entry.lastReadChapter >= latest;
}

function isInProgressEntry(entry: any): boolean {
  const latest = getManhwaLatestChapterNumber(entry?.manhwa?.latestChapter);
  if (!latest || entry?.lastReadChapter === undefined) return false;
  return entry.lastReadChapter > 0 && entry.lastReadChapter < latest;
}

// ── Library ───────────────────────────────────────────────────────────────────

export function LibraryScreen({ navigation }: any) {
  const theme = useAppTheme();
  const entries = useLibraryStore((s) => s.entries);
  const libraryFilter = useLibraryStore((s) => s.libraryFilter);
  const setLibraryFilter = useLibraryStore((s) => s.setLibraryFilter);
  const { width } = useWindowDimensions();
  const cardWidth = (width - 48) / 2;
  const library = useMemo(
    () => Object.values(entries).sort((a, b) => getLibraryActivityTime(b) - getLibraryActivityTime(a)),
    [entries]
  );
  const filteredLibrary = useMemo(() => {
    switch (libraryFilter) {
      case 'bookmarked':
        return library.filter((entry) => entry.bookmarked);
      case 'downloaded':
        return library.filter((entry) => entry.downloaded);
      case 'history':
        return library.filter((entry) => entry.lastOpenedAt || entry.lastReadAt);
      case 'in-progress':
        return library.filter((entry) => isInProgressEntry(entry));
      case 'completed':
        return library.filter((entry) => isCompletedEntry(entry));
      case 'all':
      default:
        return library;
    }
  }, [library, libraryFilter]);

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
          {[
            { key: 'all', label: 'All' },
            { key: 'bookmarked', label: 'Read later' },
            { key: 'downloaded', label: 'Downloads' },
            { key: 'history', label: 'History' },
            { key: 'in-progress', label: 'In progress' },
            { key: 'completed', label: 'Completed' },
          ].map((filter) => (
            <Chip
              key={filter.key}
              label={filter.label}
              active={libraryFilter === filter.key}
              onPress={() => setLibraryFilter(filter.key as any)}
            />
          ))}
        </ScrollView>

        <View style={styles.libraryHeaderRow}>
          <Text style={[styles.sectionHead, { color: theme.colors.textSecondary, marginBottom: 0 }]}>Recent</Text>
          <TouchableOpacity
            style={[styles.libraryHeaderBtn, { borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('Downloads')}
          >
            <Text style={[styles.libraryHeaderBtnText, { color: theme.colors.textSecondary }]}>Downloads View</Text>
          </TouchableOpacity>
        </View>
      </View>

      {filteredLibrary.length === 0 ? (
        <EmptyState
          icon="📚"
          title="Your library is empty"
          subtitle={libraryFilter === 'all' ? 'Search and follow series to build your history.' : 'No series match this filter yet.'}
          action={{ label: 'Browse', onPress: () => navigation.navigate('Search') }}
        />
      ) : (
        <FlatList
          data={filteredLibrary}
          numColumns={2}
          keyExtractor={(item) => item.manhwa.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.listContent, { paddingTop: 0 }]}
          renderItem={({ item }) => {
            const latestChapter = getManhwaLatestChapterNumber(item.manhwa.latestChapter);
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
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [nextSuggestionRefreshAt, setNextSuggestionRefreshAt] = useState(0);
  const { width } = useWindowDimensions();
  const cardWidth = (width - 48) / 2;
  const libraryEntries = useLibraryStore((s) => s.entries);
  const setLibraryFilter = useLibraryStore((s) => s.setLibraryFilter);

  const {
    includeNsfwSources,
    preferredSearchSource,
    setPreferredSearchSource,
    searchResultLimit,
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    favoriteSources,
    toggleFavoriteSource,
    clearFavoriteSources,
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

  const favoriteSourceSet = useMemo(() => new Set(favoriteSources), [favoriteSources]);

  const isSearchingAll = preferredSearchSource === 'all';
  const loading = isSearchingAll ? groupedSearchQuery.isFetching : flatSearchQuery.isFetching;
  const searchError = isSearchingAll ? groupedSearchQuery.error : flatSearchQuery.error;
  const groupedResults = groupedSearchQuery.data ?? [];
  const flatResults = flatSearchQuery.data ?? [];
  const sourceGrid = useMemo(() => {
    const nonAllSources = sourceOptions.filter((src) => src.name !== 'all');
    const sourceByName = new Map(nonAllSources.map((source) => [source.name, source]));
    const pinnedOrdered = favoriteSources
      .map((name) => sourceByName.get(name))
      .filter((source): source is SourceInfo => Boolean(source));
    const pinnedSet = new Set(pinnedOrdered.map((source) => source.name));

    const remaining = nonAllSources
      .filter((source) => !pinnedSet.has(source.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    const combined = showPinnedOnly ? pinnedOrdered : [...pinnedOrdered, ...remaining];
    return combined.slice(0, 12);
  }, [favoriteSources, showPinnedOnly, sourceOptions]);

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
  const libraryManhwa = useMemo(() => Object.values(libraryEntries).map((entry) => entry.manhwa), [libraryEntries]);

  const openLibraryWithFilter = (filter: 'all' | 'bookmarked' | 'downloaded' | 'history') => {
    setLibraryFilter(filter);
    navigation.navigate('Library');
  };

  const handleSuggestionRefresh = () => {
    if (suggestionsQuery.isFetching || Date.now() < nextSuggestionRefreshAt) {
      return;
    }
    setNextSuggestionRefreshAt(Date.now() + REFRESH_COOLDOWN_MS);
    api.trackSuggestionTelemetry({
      event: 'refresh',
      source: preferredSearchSource,
      client: 'mobile',
      surface: 'search-discovery',
    }).catch(() => {});
    suggestionsQuery.refetch();
  };

  const handleSearch = () => {
    const next = query.trim();
    if (!next) return;
    setSubmitted(next);
    addRecentSearch(next);
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
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setSubmitted('');
              }}
            >
              <MaterialCommunityIcons name="close-circle" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowSourceMenu(true)}>
            <MaterialCommunityIcons name="dots-vertical" size={21} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Chip label="Local storage" onPress={() => openLibraryWithFilter('all')} />
          <Chip label="Read later" onPress={() => openLibraryWithFilter('bookmarked')} />
          <Chip
            label="Random"
            onPress={() => {
              const pool = suggestions.length > 0 ? suggestions : libraryManhwa;
              if (pool.length === 0) return;
              const picked = pool[Math.floor(Math.random() * pool.length)];
              navigation.navigate('ManhwaDetail', { manhwa: picked });
            }}
          />
          <Chip label="Downloads" onPress={() => openLibraryWithFilter('downloaded')} />
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
            {preferredSearchSource !== 'all' && (
              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderColor: theme.colors.border }]}
                onPress={() => {
                  setPreferredSearchSource('all');
                  if (query.trim()) {
                    setSubmitted(query.trim());
                  }
                  setShowSourceMenu(false);
                }}
              >
                <Text style={[styles.sheetActionText, { color: theme.colors.text }]}>Reset to all sources</Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.sheetSectionTitle, { color: theme.colors.textMuted }]}>Select source</Text>
            <ScrollView style={styles.sourceMenuScroll} nestedScrollEnabled>
              {sourceOptions.map((src) => (
                <View
                  key={src.name}
                  style={styles.sourceMenuItemRow}
                >
                  <TouchableOpacity
                    style={styles.sourceMenuItemMain}
                    onPress={() => {
                      setPreferredSearchSource(src.name);
                      if (query.trim()) {
                        setSubmitted(query.trim());
                      }
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
                  {src.name !== 'all' && (
                    <TouchableOpacity
                      style={styles.sourceMenuStarBtn}
                      onPress={() => toggleFavoriteSource(src.name)}
                    >
                      <MaterialCommunityIcons
                        name={favoriteSourceSet.has(src.name) ? 'star' : 'star-outline'}
                        size={18}
                        color={favoriteSourceSet.has(src.name) ? theme.colors.primary : theme.colors.textMuted}
                      />
                    </TouchableOpacity>
                  )}
                </View>
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
                    onPress={() => {
                      api.trackSuggestionTelemetry({
                        event: 'click',
                        source: item.source || preferredSearchSource,
                        client: 'mobile',
                        surface: 'search-discovery',
                      }).catch(() => {});
                      navigation.navigate('ManhwaDetail', { manhwa: item });
                    }}
                  />
                </View>
              )}
            />
          )}

          {recentSearches.length > 0 && (
            <>
              <View style={[styles.sectionHeaderRow, { marginTop: 12 }]}>
                <Text style={[styles.sectionHead, { color: theme.colors.text }]}>Recent searches</Text>
                <TouchableOpacity onPress={clearRecentSearches}>
                  <Text style={[styles.sectionMore, { color: theme.colors.primary }]}>Clear</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.limitChipWrap}>
                {recentSearches.slice(0, 8).map((value) => (
                  <View key={value} style={styles.recentSearchChipWrap}>
                    <Chip
                      label={value}
                      onPress={() => {
                        setQuery(value);
                        setSubmitted(value);
                      }}
                    />
                    <TouchableOpacity
                      style={[styles.recentSearchRemoveBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
                      onPress={() => removeRecentSearch(value)}
                    >
                      <MaterialCommunityIcons name="close" size={13} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={[styles.sectionHeaderRow, { marginTop: 16 }]}>
            <Text style={[styles.sectionHead, { color: theme.colors.text }]}>Manga sources</Text>
            <View style={styles.sectionHeaderActions}>
              <Chip
                label="Pinned only"
                active={showPinnedOnly}
                onPress={() => setShowPinnedOnly((prev) => !prev)}
              />
              {favoriteSources.length > 0 ? (
                <TouchableOpacity onPress={clearFavoriteSources}>
                  <Text style={[styles.sectionMore, { color: theme.colors.primary }]}>Clear Pins</Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.sectionMore, { color: theme.colors.primary }]}>Long press to pin</Text>
              )}
            </View>
          </View>
          {showPinnedOnly && sourceGrid.length === 0 && (
            <Text style={[styles.sourceGridEmptyText, { color: theme.colors.textMuted }]}>No pinned sources yet. Long press a source card to pin it.</Text>
          )}
          <View style={styles.sourceGrid}>
            {sourceGrid.map((src) => (
              <TouchableOpacity
                key={src.name}
                style={styles.sourceGridItem}
                onPress={() => {
                  setPreferredSearchSource(src.name);
                  navigation.navigate('ExtensionSource', { sourceName: src.name, initialQuery: query.trim() || submitted.trim() || undefined });
                }}
                onLongPress={() => toggleFavoriteSource(src.name)}
              >
                <SourceIcon name={src.name} iconUrl={src.iconUrl} size={52} />
                <Text style={[styles.sourceGridText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {src.name}
                </Text>
                <MaterialCommunityIcons
                  name={favoriteSourceSet.has(src.name) ? 'star' : 'star-outline'}
                  size={13}
                  color={favoriteSourceSet.has(src.name) ? theme.colors.primary : theme.colors.textMuted}
                />
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
            <Chip
              label="Read later"
              onPress={() => {
                useLibraryStore.getState().setLibraryFilter('bookmarked');
                navigation.navigate('Library');
              }}
            />
            <Chip label="Settings" onPress={() => navigation.navigate('Settings')} />
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
              <TouchableOpacity onPress={() => navigation.navigate('Library')}>
                <Text style={[styles.sectionMore, { color: theme.colors.primary }]}>View all</Text>
              </TouchableOpacity>
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
    recentSearches,
    clearRecentSearches,
    favoriteSources,
    toggleFavoriteSource,
    clearFavoriteSources,
    moveFavoriteSource,
  } = useSettingsStore();
  const libraryEntries = useLibraryStore((s) => Object.values(s.entries));
  const clearDownloadedMarks = useLibraryStore((s) => s.clearDownloadedMarks);
  const clearBookmarkMarks = useLibraryStore((s) => s.clearBookmarkMarks);
  const [backendInput, setBackendInput] = useState(backendUrl);

  const downloadedCount = libraryEntries.filter((entry) => entry.downloaded).length;
  const bookmarkCount = libraryEntries.filter((entry) => entry.bookmarked).length;

  const telemetryQuery = useQuery({
    queryKey: ['telemetry-suggestions'],
    queryFn: api.getSuggestionTelemetry,
    staleTime: 0,
  });

  const telemetrySources = Object.entries(telemetryQuery.data?.bySource ?? {})
    .map(([name, stats]) => ({
      name,
      refresh: Number((stats as any)?.refresh ?? 0),
      click: Number((stats as any)?.click ?? 0),
    }))
    .sort((a, b) => (b.refresh + b.click) - (a.refresh + a.click))
    .slice(0, 8);

  const telemetryClients = Object.entries(telemetryQuery.data?.byClientDetailed ?? {})
    .map(([name, stats]) => ({
      name,
      events: Number((stats as any)?.events ?? 0),
      refresh: Number((stats as any)?.refresh ?? 0),
      click: Number((stats as any)?.click ?? 0),
    }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 5);

  const telemetrySurfaces = Object.entries(telemetryQuery.data?.bySurfaceDetailed ?? {})
    .map(([name, stats]) => ({
      name,
      events: Number((stats as any)?.events ?? 0),
      refresh: Number((stats as any)?.refresh ?? 0),
      click: Number((stats as any)?.click ?? 0),
    }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 5);

  const telemetryRecent = (telemetryQuery.data?.recent ?? []).slice(0, 6);

  const sourcesQuery = useQuery({
    queryKey: ['sources', includeNsfwSources],
    queryFn: () => api.listSources(includeNsfwSources),
  });

  const favoriteSourceSet = useMemo(() => new Set(favoriteSources), [favoriteSources]);
  const availableSources = useMemo(
    () =>
      (sourcesQuery.data ?? [])
        .filter((source) => source.name !== 'all')
        .sort((a, b) => {
          const aFav = favoriteSourceSet.has(a.name) ? 1 : 0;
          const bFav = favoriteSourceSet.has(b.name) ? 1 : 0;
          if (aFav !== bFav) return bFav - aFav;
          return a.name.localeCompare(b.name);
        }),
    [favoriteSourceSet, sourcesQuery.data]
  );

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

        <Text style={[styles.settingGroup, { color: theme.colors.textMuted }]}>Source Personalization</Text>
        <View style={[styles.settingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={row}>
            <View>
              <Text style={label}>Pinned sources</Text>
              <Text style={sub}>{favoriteSources.length} pinned source{favoriteSources.length === 1 ? '' : 's'}</Text>
            </View>
            <TouchableOpacity
              style={[styles.backendUrlGhost, { borderColor: theme.colors.border }]}
              onPress={clearFavoriteSources}
              disabled={favoriteSources.length === 0}
            >
              <Text style={[styles.backendUrlGhostText, { color: favoriteSources.length === 0 ? theme.colors.textMuted : theme.colors.textSecondary }]}>Clear pins</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.limitChipWrap}>
            {availableSources.slice(0, 18).map((source) => (
              <Chip
                key={source.name}
                label={favoriteSourceSet.has(source.name) ? `★ ${source.name}` : source.name}
                active={favoriteSourceSet.has(source.name)}
                onPress={() => toggleFavoriteSource(source.name)}
              />
            ))}
            {availableSources.length === 0 && !sourcesQuery.isFetching && (
              <Text style={[styles.settingSub, { color: theme.colors.textMuted, paddingHorizontal: 16 }]}>No sources available yet.</Text>
            )}
          </View>
          {favoriteSources.length > 1 && (
            <>
              <Text style={[styles.settingSub, { color: theme.colors.textMuted, paddingHorizontal: 16, paddingBottom: 8 }]}>Long press and drag pinned sources to reorder.</Text>
              <DraggableFlatList<string>
                data={favoriteSources}
                keyExtractor={(item) => item}
                scrollEnabled={false}
                onDragEnd={({ from, to }: { from: number; to: number }) => moveFavoriteSource(from, to)}
                contentContainerStyle={styles.pinnedListWrap}
                renderItem={({ item, drag, isActive }: { item: string; drag: () => void; isActive: boolean }) => (
                  <Pressable
                    onLongPress={drag}
                    delayLongPress={120}
                    style={[
                      styles.pinnedListItem,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: isActive ? theme.colors.surfaceVariant : theme.colors.background,
                      },
                    ]}
                  >
                    <View style={styles.pinnedListMain}>
                      <MaterialCommunityIcons name="drag" size={18} color={theme.colors.textMuted} />
                      <Text style={[styles.pinnedListText, { color: theme.colors.text }]} numberOfLines={1}>{item}</Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleFavoriteSource(item)}>
                      <MaterialCommunityIcons name="star-off-outline" size={18} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </Pressable>
                )}
              />
            </>
          )}
        </View>

        <Text style={[styles.settingGroup, { color: theme.colors.textMuted }]}>Library Maintenance</Text>
        <View style={[styles.settingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={row}>
            <View>
              <Text style={label}>Read later titles</Text>
              <Text style={sub}>{bookmarkCount} currently saved</Text>
            </View>
            <TouchableOpacity style={[styles.backendUrlGhost, { borderColor: theme.colors.border }]} onPress={clearBookmarkMarks}>
              <Text style={[styles.backendUrlGhostText, { color: theme.colors.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={row}>
            <View>
              <Text style={label}>Downloaded markers</Text>
              <Text style={sub}>{downloadedCount} currently marked</Text>
            </View>
            <TouchableOpacity style={[styles.backendUrlGhost, { borderColor: theme.colors.border }]} onPress={clearDownloadedMarks}>
              <Text style={[styles.backendUrlGhostText, { color: theme.colors.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={row}>
            <View>
              <Text style={label}>Recent search history</Text>
              <Text style={sub}>{recentSearches.length} saved queries</Text>
            </View>
            <TouchableOpacity style={[styles.backendUrlGhost, { borderColor: theme.colors.border }]} onPress={clearRecentSearches}>
              <Text style={[styles.backendUrlGhostText, { color: theme.colors.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.settingGroup, { color: theme.colors.textMuted }]}>Telemetry (Debug)</Text>
        <View style={[styles.settingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.settingRow}>
            <View>
              <Text style={label}>Suggestion events</Text>
              <Text style={sub}>Refresh/click counters by source</Text>
            </View>
            <View style={styles.telemetryActionsRow}>
              <TouchableOpacity
                style={[styles.backendUrlGhost, { borderColor: theme.colors.border }]}
                onPress={async () => {
                  await api.resetSuggestionTelemetry();
                  telemetryQuery.refetch();
                }}
              >
                <Text style={[styles.backendUrlGhostText, { color: theme.colors.danger }]}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.backendUrlGhost, { borderColor: theme.colors.border }]} onPress={() => telemetryQuery.refetch()}>
                <Text style={[styles.backendUrlGhostText, { color: theme.colors.textSecondary }]}>
                  {telemetryQuery.isFetching ? 'Refreshing...' : 'Refresh'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.telemetrySummaryRow}>
            <Text style={[styles.telemetrySummaryText, { color: theme.colors.textSecondary }]}>Refresh: {telemetryQuery.data?.total?.refresh ?? 0}</Text>
            <Text style={[styles.telemetrySummaryText, { color: theme.colors.textSecondary }]}>Click: {telemetryQuery.data?.total?.click ?? 0}</Text>
            <Text style={[styles.telemetrySummaryText, { color: theme.colors.textSecondary }]}>Events: {telemetryQuery.data?.total?.events ?? 0}</Text>
            <Text style={[styles.telemetrySummaryText, { color: theme.colors.textSecondary }]}>Sources: {telemetryQuery.data?.total?.sources ?? 0}</Text>
            <Text style={[styles.telemetrySummaryText, { color: theme.colors.textSecondary }]}>Clients: {telemetryQuery.data?.total?.clients ?? 0}</Text>
            <Text style={[styles.telemetrySummaryText, { color: theme.colors.textSecondary }]}>Surfaces: {telemetryQuery.data?.total?.surfaces ?? 0}</Text>
          </View>

          {telemetrySources.length === 0 && !telemetryQuery.isFetching && (
            <Text style={[styles.telemetryEmpty, { color: theme.colors.textMuted }]}>No source telemetry yet.</Text>
          )}

          {telemetrySources.map((source) => (
            <View key={source.name} style={styles.telemetryRow}>
              <Text style={[styles.telemetrySource, { color: theme.colors.text }]} numberOfLines={1}>{source.name}</Text>
              <Text style={[styles.telemetryStats, { color: theme.colors.textSecondary }]}>R {source.refresh} / C {source.click}</Text>
            </View>
          ))}

          {telemetryClients.length > 0 && (
            <View style={styles.telemetrySectionWrap}>
              <Text style={[styles.telemetrySectionLabel, { color: theme.colors.textMuted }]}>Top clients</Text>
              {telemetryClients.map((client) => (
                <View key={client.name} style={styles.telemetryRow}>
                  <Text style={[styles.telemetrySource, { color: theme.colors.text }]} numberOfLines={1}>{client.name}</Text>
                  <Text style={[styles.telemetryStats, { color: theme.colors.textSecondary }]}>E {client.events} / R {client.refresh} / C {client.click}</Text>
                </View>
              ))}
            </View>
          )}

          {telemetrySurfaces.length > 0 && (
            <View style={styles.telemetrySectionWrap}>
              <Text style={[styles.telemetrySectionLabel, { color: theme.colors.textMuted }]}>Top surfaces</Text>
              {telemetrySurfaces.map((surface) => (
                <View key={surface.name} style={styles.telemetryRow}>
                  <Text style={[styles.telemetrySource, { color: theme.colors.text }]} numberOfLines={1}>{surface.name}</Text>
                  <Text style={[styles.telemetryStats, { color: theme.colors.textSecondary }]}>E {surface.events} / R {surface.refresh} / C {surface.click}</Text>
                </View>
              ))}
            </View>
          )}

          {telemetryRecent.length > 0 && (
            <View style={styles.telemetrySectionWrap}>
              <Text style={[styles.telemetrySectionLabel, { color: theme.colors.textMuted }]}>Recent events</Text>
              {telemetryRecent.map((item, index) => (
                <View key={`${item.timestamp}-${item.source}-${index}`} style={styles.telemetryRow}>
                  <Text style={[styles.telemetrySource, { color: theme.colors.text }]} numberOfLines={1}>
                    {item.event.toUpperCase()} · {item.source}
                  </Text>
                  <Text style={[styles.telemetryStats, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {item.client} / {item.surface}
                  </Text>
                </View>
              ))}
            </View>
          )}
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
  sectionHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionMore: { fontSize: 13, fontWeight: '700' },
  recentSearchChipWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recentSearchRemoveBtn: { width: 22, height: 22, borderRadius: 11, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  libraryHeaderRow: {
    marginTop: 2,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  libraryHeaderBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  libraryHeaderBtnText: { fontSize: 12, fontWeight: '700' },

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
  sourceGridEmptyText: { fontSize: 12, paddingHorizontal: 16, marginBottom: 10 },
  pinnedListWrap: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  pinnedListItem: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinnedListMain: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 10 },
  pinnedListText: { fontSize: 13, fontWeight: '600' },

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
  sourceMenuItemRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  sourceMenuItemMain: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
  sourceMenuStarBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
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
  telemetrySummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  telemetrySummaryText: { fontSize: 12, fontWeight: '600' },
  telemetryEmpty: { fontSize: 12, paddingHorizontal: 16, paddingBottom: 8 },
  telemetryActionsRow: { flexDirection: 'row', gap: 8 },
  telemetrySectionWrap: { paddingTop: 4, paddingBottom: 2 },
  telemetrySectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: 16, paddingBottom: 4 },
  telemetryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  telemetrySource: { flex: 1, marginRight: 8, fontSize: 12, fontWeight: '600' },
  telemetryStats: { fontSize: 12, fontWeight: '700' },
});
