import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Manhwa, Chapter, LibraryEntry, LibraryFilter, ReadingMode } from '../types';

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

// ── Library store ─────────────────────────────────────────────────────────────

interface LibraryState {
  entries: Record<string, LibraryEntry>;
  libraryFilter: LibraryFilter;
  setLibraryFilter: (filter: LibraryFilter) => void;
  follow: (manhwa: Manhwa) => void;
  unfollow: (manhwaId: string) => void;
  isFollowing: (manhwaId: string) => boolean;
  markChapterRead: (manhwaId: string, chapterNumber: number) => void;
  markViewed: (manhwaId: string) => void;
  setLastRead: (manhwaId: string, chapter: Chapter) => void;
  toggleNotifications: (manhwaId: string) => void;
  toggleBookmark: (manhwaId: string) => void;
  toggleDownloaded: (manhwaId: string) => void;
  getEntry: (manhwaId: string) => LibraryEntry | undefined;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      entries: {},
      libraryFilter: 'all',

      setLibraryFilter: (filter) => set({ libraryFilter: filter }),

      follow: (manhwa) =>
        set((state) => ({
          entries: {
            ...state.entries,
            [manhwa.id]: {
              manhwa,
              followedAt: new Date().toISOString(),
              notificationsEnabled: true,
                bookmarked: false,
                downloaded: false,
            },
          },
        })),

      unfollow: (manhwaId) =>
        set((state) => {
          const { [manhwaId]: _, ...rest } = state.entries;
          return { entries: rest };
        }),

      isFollowing: (manhwaId) => !!get().entries[manhwaId],

      markChapterRead: (manhwaId, chapterNumber) =>
        set((state) => {
          const entry = state.entries[manhwaId];
          if (!entry) return state;
          return {
            entries: {
              ...state.entries,
              [manhwaId]: {
                ...entry,
                lastReadChapter: Math.max(
                  chapterNumber,
                  entry.lastReadChapter ?? 0
                ),
                lastOpenedAt: new Date().toISOString(),
              },
            },
          };
        }),

      markViewed: (manhwaId) =>
        set((state) => {
          const entry = state.entries[manhwaId];
          if (!entry) return state;
          return {
            entries: {
              ...state.entries,
              [manhwaId]: {
                ...entry,
                lastOpenedAt: new Date().toISOString(),
              },
            },
          };
        }),

      setLastRead: (manhwaId, chapter) =>
        set((state) => {
          const entry = state.entries[manhwaId];
          if (!entry) return state;
          return {
            entries: {
              ...state.entries,
              [manhwaId]: {
                ...entry,
                lastReadChapter: chapter.number,
                lastReadAt: new Date().toISOString(),
                lastOpenedAt: new Date().toISOString(),
              },
            },
          };
        }),

      toggleNotifications: (manhwaId) =>
        set((state) => {
          const entry = state.entries[manhwaId];
          if (!entry) return state;
          return {
            entries: {
              ...state.entries,
              [manhwaId]: {
                ...entry,
                notificationsEnabled: !entry.notificationsEnabled,
              },
            },
          };
        }),

      toggleBookmark: (manhwaId) =>
        set((state) => {
          const entry = state.entries[manhwaId];
          if (!entry) return state;
          return {
            entries: {
              ...state.entries,
              [manhwaId]: {
                ...entry,
                bookmarked: !entry.bookmarked,
                lastOpenedAt: new Date().toISOString(),
              },
            },
          };
        }),

      toggleDownloaded: (manhwaId) =>
        set((state) => {
          const entry = state.entries[manhwaId];
          if (!entry) return state;
          return {
            entries: {
              ...state.entries,
              [manhwaId]: {
                ...entry,
                downloaded: !entry.downloaded,
              },
            },
          };
        }),

      getEntry: (manhwaId) => get().entries[manhwaId],
    }),
    {
      name: 'library',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState: any) => {
        const state = persistedState?.state ?? persistedState;
        const rawEntries = state?.entries ?? {};
        const entries: Record<string, LibraryEntry> = {};

        for (const [key, entry] of Object.entries(rawEntries) as [string, any][]) {
          entries[key] = {
            ...entry,
            notificationsEnabled: toBoolean(entry?.notificationsEnabled, true),
            bookmarked: toBoolean(entry?.bookmarked, false),
            downloaded: toBoolean(entry?.downloaded, false),
            lastReadChapter:
              entry?.lastReadChapter === undefined
                ? undefined
                : toNumber(entry.lastReadChapter, 0),
          };
        }

        const libraryFilter: LibraryFilter =
          state?.libraryFilter === 'bookmarked' ||
          state?.libraryFilter === 'downloaded' ||
          state?.libraryFilter === 'history' ||
          state?.libraryFilter === 'in-progress' ||
          state?.libraryFilter === 'completed'
            ? state.libraryFilter
            : 'all';

        return {
          ...persistedState,
          state: {
            ...state,
            entries,
            libraryFilter,
          },
        };
      },
    }
  )
);

// ── Settings store ────────────────────────────────────────────────────────────

interface SettingsState {
  appTheme: 'system' | 'midnight' | 'ocean' | 'sunrise';
  setAppTheme: (theme: 'system' | 'midnight' | 'ocean' | 'sunrise') => void;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  defaultReadingMode: ReadingMode;
  setDefaultReadingMode: (mode: ReadingMode) => void;
  imageQuality: 'low' | 'medium' | 'high';
  setImageQuality: (q: 'low' | 'medium' | 'high') => void;
  keepScreenOn: boolean;
  setKeepScreenOn: (v: boolean) => void;
  includeNsfwSources: boolean;
  setIncludeNsfwSources: (v: boolean) => void;
  preferredSearchSource: string;
  setPreferredSearchSource: (source: string) => void;
  searchResultLimit: number;
  setSearchResultLimit: (limit: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      appTheme: 'system',
      setAppTheme: (theme) => set({ appTheme: theme }),
      backendUrl: '',
      setBackendUrl: (url) => set({ backendUrl: url.trim() }),
      defaultReadingMode: 'vertical',
      setDefaultReadingMode: (mode) => set({ defaultReadingMode: mode }),
      imageQuality: 'high',
      setImageQuality: (q) => set({ imageQuality: q }),
      keepScreenOn: true,
      setKeepScreenOn: (v) => set({ keepScreenOn: v }),
      includeNsfwSources: true,
      setIncludeNsfwSources: (v) => set({ includeNsfwSources: v }),
      preferredSearchSource: 'all',
      setPreferredSearchSource: (source) => set({ preferredSearchSource: source || 'all' }),
      searchResultLimit: 60,
      setSearchResultLimit: (limit) =>
        set({ searchResultLimit: Math.max(10, Math.min(200, Math.round(limit))) }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState: any) => {
        const state = persistedState?.state ?? persistedState;

        const readingMode: ReadingMode =
          state?.defaultReadingMode === 'horizontal' ? 'horizontal' : 'vertical';

        const imageQuality =
          state?.imageQuality === 'low' ||
          state?.imageQuality === 'medium' ||
          state?.imageQuality === 'high'
            ? state.imageQuality
            : 'high';

        const appTheme =
          state?.appTheme === 'midnight' ||
          state?.appTheme === 'ocean' ||
          state?.appTheme === 'sunrise' ||
          state?.appTheme === 'system'
            ? state.appTheme
            : 'system';

        return {
          ...persistedState,
          state: {
            ...state,
            appTheme,
            backendUrl:
              typeof state?.backendUrl === 'string'
                ? state.backendUrl.trim()
                : '',
            defaultReadingMode: readingMode,
            imageQuality,
            keepScreenOn: toBoolean(state?.keepScreenOn, true),
            includeNsfwSources: toBoolean(state?.includeNsfwSources, true),
            preferredSearchSource:
              typeof state?.preferredSearchSource === 'string' && state.preferredSearchSource.trim().length > 0
                ? state.preferredSearchSource
                : 'all',
            searchResultLimit: Math.max(10, Math.min(200, toNumber(state?.searchResultLimit, 60))),
          },
        };
      },
    }
  )
);
