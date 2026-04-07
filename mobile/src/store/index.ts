import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Manhwa, Chapter, LibraryEntry, ReadingMode } from '../types';

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
  follow: (manhwa: Manhwa) => void;
  unfollow: (manhwaId: string) => void;
  isFollowing: (manhwaId: string) => boolean;
  markChapterRead: (manhwaId: string, chapterNumber: number) => void;
  setLastRead: (manhwaId: string, chapter: Chapter) => void;
  toggleNotifications: (manhwaId: string) => void;
  getEntry: (manhwaId: string) => LibraryEntry | undefined;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      entries: {},

      follow: (manhwa) =>
        set((state) => ({
          entries: {
            ...state.entries,
            [manhwa.id]: {
              manhwa,
              followedAt: new Date().toISOString(),
              notificationsEnabled: true,
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

      getEntry: (manhwaId) => get().entries[manhwaId],
    }),
    {
      name: 'library',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: any) => {
        const state = persistedState?.state ?? persistedState;
        const rawEntries = state?.entries ?? {};
        const entries: Record<string, LibraryEntry> = {};

        for (const [key, entry] of Object.entries(rawEntries) as [string, any][]) {
          entries[key] = {
            ...entry,
            notificationsEnabled: toBoolean(entry?.notificationsEnabled, true),
            lastReadChapter:
              entry?.lastReadChapter === undefined
                ? undefined
                : toNumber(entry.lastReadChapter, 0),
          };
        }

        return {
          ...persistedState,
          state: {
            ...state,
            entries,
          },
        };
      },
    }
  )
);

// ── Settings store ────────────────────────────────────────────────────────────

interface SettingsState {
  defaultReadingMode: ReadingMode;
  setDefaultReadingMode: (mode: ReadingMode) => void;
  imageQuality: 'low' | 'medium' | 'high';
  setImageQuality: (q: 'low' | 'medium' | 'high') => void;
  keepScreenOn: boolean;
  setKeepScreenOn: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultReadingMode: 'vertical',
      setDefaultReadingMode: (mode) => set({ defaultReadingMode: mode }),
      imageQuality: 'high',
      setImageQuality: (q) => set({ imageQuality: q }),
      keepScreenOn: true,
      setKeepScreenOn: (v) => set({ keepScreenOn: v }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
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

        return {
          ...persistedState,
          state: {
            ...state,
            defaultReadingMode: readingMode,
            imageQuality,
            keepScreenOn: toBoolean(state?.keepScreenOn, true),
          },
        };
      },
    }
  )
);
