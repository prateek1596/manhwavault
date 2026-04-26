export interface Manhwa {
  id: string;
  title: string;
  url: string;
  cover: string;
  latestChapter: string;
  source: string;
  status?: string;
  genres?: string[];
  description?: string;
}

export interface Chapter {
  id: string;
  title: string;
  url: string;
  number: number;
  uploadedAt?: string;
  isRead?: boolean;
}

export interface Extension {
  name: string;
  version: string;
  baseUrl: string;
  language: string;
  nsfw: boolean;
  iconUrl?: string;
  repoUrl: string;
  installed: boolean;
  updateAvailable?: boolean;
}

export interface SourceInfo {
  name: string;
  baseUrl: string;
  language: string;
  nsfw: boolean;
  version: string;
  iconUrl?: string;
}

export interface ExtensionStats {
  total: number;
  nsfw: number;
  safe: number;
  byLanguage: Record<string, number>;
}

export interface SourceCatalogResponse {
  items: Manhwa[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  message?: string;
}

export interface SourceSearchGroup {
  source: string;
  iconUrl?: string;
  status: 'ok' | 'error';
  message?: string;
  results: Manhwa[];
  total: number;
}

export interface LibraryEntry {
  manhwa: Manhwa;
  followedAt: string;
  lastReadChapter?: number;
  lastReadAt?: string;
  lastOpenedAt?: string;
  unreadCount?: number;
  notificationsEnabled: boolean;
  bookmarked?: boolean;
  downloaded?: boolean;
}

export type LibraryFilter = 'all' | 'bookmarked' | 'downloaded' | 'history' | 'in-progress' | 'completed';

export type ReadingMode = 'vertical' | 'horizontal';

export type RootTabParamList = {
  Library: undefined;
  Search: undefined;
  Updates: undefined;
  Extensions: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  ManhwaDetail: { manhwa: Manhwa };
  Reader: { manhwa: Manhwa; chapter: Chapter; chapterList: Chapter[] };
  InstallExtension: undefined;
  ExtensionSource: { sourceName: string; initialQuery?: string };
};
