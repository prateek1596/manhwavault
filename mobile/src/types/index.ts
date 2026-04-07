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
  repoUrl: string;
  installed: boolean;
  updateAvailable?: boolean;
}

export interface LibraryEntry {
  manhwa: Manhwa;
  followedAt: string;
  lastReadChapter?: number;
  lastReadAt?: string;
  unreadCount?: number;
  notificationsEnabled: boolean;
}

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
};
