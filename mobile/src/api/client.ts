import { Manhwa, Chapter, Extension, SourceInfo, ExtensionStats, SourceCatalogResponse, SourceSearchGroup } from '../types';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useSettingsStore } from '../store';

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function extractHost(value?: string): string | undefined {
  if (!value || typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    if (trimmed.includes('://')) {
      return new URL(trimmed).hostname;
    }
  } catch {
    // Fall through to host:port parsing.
  }

  const [host] = trimmed.split(':');
  return host || undefined;
}

function getExplicitBaseUrl(): string | undefined {
  const savedBaseUrl = useSettingsStore.getState().backendUrl;
  if (typeof savedBaseUrl === 'string' && savedBaseUrl.trim().length > 0) {
    return normalizeUrl(savedBaseUrl);
  }

  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return normalizeUrl(envUrl);
  }

  const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string };
  if (typeof extra.apiBaseUrl === 'string' && extra.apiBaseUrl.trim().length > 0) {
    return normalizeUrl(extra.apiBaseUrl);
  }

  return undefined;
}

function getBaseUrl(): string {
  const explicitBaseUrl = getExplicitBaseUrl();
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const hostCandidates: Array<string | undefined> = [
    (Constants.expoConfig as { hostUri?: string } | undefined)?.hostUri,
    (Constants as any).manifest?.debuggerHost,
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost,
  ];

  const host = hostCandidates
    .map(extractHost)
    .find((candidate) => typeof candidate === 'string' && candidate.length > 0);

  if (host) {
    return `http://${host}:8000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://127.0.0.1:8000';
}

function getBaseUrlCandidates(): string[] {
  const candidates: string[] = [];
  const explicit = getExplicitBaseUrl();
  const detected = getBaseUrl();

  if (explicit) candidates.push(explicit);
  if (!candidates.includes(detected)) candidates.push(detected);

  const fallbacks = [
    'http://10.0.2.2:8000',
    'http://127.0.0.1:8000',
    'http://localhost:8000',
  ];
  for (const url of fallbacks) {
    if (!candidates.includes(url)) candidates.push(url);
  }

  return candidates;
}
export function getActiveApiBaseUrl(): string {
  return getBaseUrlCandidates()[0];
}

const REQUEST_TIMEOUT_MS = 15000;

function firstText(localized?: Record<string, string>): string {
  if (!localized) return 'Unknown';
  if (localized.en) return localized.en;
  const firstValue = Object.values(localized).find((value) => typeof value === 'string' && value.trim().length > 0);
  return firstValue || 'Unknown';
}

function mapMangaDexItem(item: any, sourceName: string): Manhwa {
  const mangaId = item?.id ?? '';
  const attributes = item?.attributes ?? {};
  const coverRel = (item?.relationships ?? []).find((rel: any) => rel?.type === 'cover_art');
  const fileName = coverRel?.attributes?.fileName;

  return {
    id: `${mangaId}-${sourceName.toLowerCase().replace(/\s+/g, '-')}`,
    title: firstText(attributes.title),
    url: mangaId,
    cover: fileName ? `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.256.jpg` : '',
    latestChapter: '',
    source: sourceName,
    status: attributes.status,
    genres: (attributes.tags ?? []).map((tag: any) => firstText(tag?.attributes?.name)),
    description: attributes.description ? firstText(attributes.description) : undefined,
  };
}

async function searchMangaDexDirect(query: string, options?: { limit?: number; contentType?: 'manhwa' | 'all' }): Promise<Manhwa[]> {
  const params = new URLSearchParams({
    title: query,
    limit: String(options?.limit ?? 20),
    'includes[]': 'cover_art',
    'order[relevance]': 'desc',
  });

  if ((options?.contentType ?? 'manhwa') === 'manhwa') {
    params.append('originalLanguage[]', 'ko');
  }

  params.append('availableTranslatedLanguage[]', 'en');

  const res = await fetch(`https://api.mangadex.org/manga?${params.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Unknown MangaDex error' }));
    throw new Error(err.message ?? `MangaDex HTTP ${res.status}`);
  }

  const payload = await res.json();
  return (payload?.data ?? []).map((item: any) => mapMangaDexItem(item, 'MangaDex'));
}

function normalizeManhwa(raw: any): Manhwa {
  return {
    id: raw.id,
    title: raw.title,
    url: raw.url,
    cover: raw.cover,
    latestChapter: raw.latestChapter ?? raw.latest_chapter ?? '',
    source: raw.source,
    status: raw.status,
    genres: raw.genres ?? [],
    description: raw.description,
  };
}

function normalizeChapter(raw: any): Chapter {
  return {
    id: raw.id,
    title: raw.title,
    url: raw.url,
    number: Number(raw.number ?? 0),
    uploadedAt: raw.uploadedAt ?? raw.uploaded_at,
    isRead: raw.isRead,
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let lastNetworkError: any = null;
  const baseUrls = getBaseUrlCandidates();

  for (const baseUrl of baseUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        ...options,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }

      return res.json();
    } catch (error: any) {
      const isNetworkLike =
        error?.name === 'AbortError' ||
        String(error?.message ?? '').toLowerCase().includes('network request failed') ||
        String(error?.message ?? '').toLowerCase().includes('failed to fetch');

      if (!isNetworkLike) {
        throw error;
      }

      lastNetworkError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastNetworkError?.name === 'AbortError') {
    throw new Error(`Request timed out. Tried: ${baseUrls.join(', ')}`);
  }

  throw new Error(`Unable to connect to backend. Tried: ${baseUrls.join(', ')}`);
}

// ── Search ──────────────────────────────────────────────────────────────────

export const searchManhwa = (
  query: string,
  source = 'all',
  options?: { includeNsfw?: boolean; limit?: number; contentType?: 'manhwa' | 'all' }
) => {
  const params = new URLSearchParams({
    q: query,
    source,
  });

  if (typeof options?.includeNsfw === 'boolean') {
    params.set('include_nsfw', options.includeNsfw ? 'true' : 'false');
  }
  if (typeof options?.limit === 'number') {
    params.set('limit', String(options.limit));
  }
  if (options?.contentType) {
    params.set('content_type', options.contentType);
  }

  return request<any[]>(`/search?${params.toString()}`)
    .then((list) => list.map(normalizeManhwa))
    .catch(async (error) => {
      if (source !== 'all' && source !== 'MangaDex' && source !== 'MangaDex (All Languages)') {
        throw error;
      }

      const fallbackResults = await searchMangaDexDirect(query, {
        limit: options?.limit ?? 20,
        contentType: options?.contentType,
      });

      if (fallbackResults.length > 0) {
        return fallbackResults;
      }

      throw error;
    });
};

export const searchManhwaBySource = (
  query: string,
  options?: { includeNsfw?: boolean; limitPerSource?: number; contentType?: 'manhwa' | 'all' }
) => {
  const params = new URLSearchParams({
    q: query,
    include_nsfw: options?.includeNsfw ? 'true' : 'false',
    limit_per_source: String(options?.limitPerSource ?? 6),
    content_type: options?.contentType ?? 'manhwa',
  });

  return request<any[]>(`/search/by-source?${params.toString()}`).then(
    (groups): SourceSearchGroup[] =>
      groups.map((group) => ({
        source: group.source,
        iconUrl: group.iconUrl,
        status: group.status,
        message: group.message,
        total: Number(group.total ?? 0),
        results: (group.results ?? []).map(normalizeManhwa),
      }))
  ).catch(async (error) => {
    const fallbackResults = await searchMangaDexDirect(query, {
      limit: options?.limitPerSource ?? 6,
      contentType: options?.contentType,
    });

    if (fallbackResults.length > 0) {
      return [
        {
          source: 'MangaDex',
          iconUrl: 'https://www.google.com/s2/favicons?sz=128&domain_url=https://api.mangadex.org',
          status: 'ok' as const,
          message: 'Backend unavailable. Using MangaDex fallback.',
          total: fallbackResults.length,
          results: fallbackResults,
        },
      ];
    }

    throw error;
  });
};

  export const getSearchSuggestions = (
    options?: { q?: string; source?: string; includeNsfw?: boolean; limit?: number; contentType?: 'manhwa' | 'all' }
  ) => {
    const params = new URLSearchParams({
      source: options?.source ?? 'all',
      include_nsfw: options?.includeNsfw ? 'true' : 'false',
      limit: String(options?.limit ?? 12),
      content_type: options?.contentType ?? 'manhwa',
    });

    if (options?.q && options.q.trim().length > 0) {
      params.set('q', options.q.trim());
    }

    return request<any[]>(`/search/suggestions?${params.toString()}`).then((list) =>
      (list ?? []).map(normalizeManhwa)
    );
  };

  export const trackSuggestionTelemetry = (
    options: { event: 'refresh' | 'click'; source?: string; client?: string; surface?: string }
  ) =>
    request<{ ok: boolean; event: string; source: string }>('/telemetry/suggestions/event', {
      method: 'POST',
      body: JSON.stringify({
        event: options.event,
        source: options.source ?? 'unknown',
        client: options.client ?? 'mobile',
        surface: options.surface ?? 'unknown',
      }),
    });

export const getManhwaDetail = (url: string, source: string) =>
  request<any>(`/manhwa/detail?url=${encodeURIComponent(url)}&source=${source}`)
    .then(normalizeManhwa);

export const getChapters = (manhwaUrl: string, source: string) =>
  request<any[]>(`/manhwa/chapters?url=${encodeURIComponent(manhwaUrl)}&source=${source}`)
    .then((list) => list.map(normalizeChapter));

export const getChapterImages = (chapterUrl: string, source: string) =>
  request<string[]>(`/chapter/images?url=${encodeURIComponent(chapterUrl)}&source=${source}`);

// ── Extensions ───────────────────────────────────────────────────────────────

export const listExtensions = () =>
  request<Extension[]>('/extensions');

export const reloadExtensions = () =>
  request<{ loaded: number; extensions: string[] }>('/extensions/reload', {
    method: 'POST',
  });

export const getExtensionStats = () =>
  request<ExtensionStats>('/extensions/stats');

export const installExtension = (gitUrl: string) =>
  request<{ installed: string }>(`/extensions/install?git_url=${encodeURIComponent(gitUrl)}`, {
    method: 'POST',
  });

export const updateExtension = (name: string) =>
  request<{ updated: string }>(`/extensions/update/${encodeURIComponent(name)}`, {
    method: 'POST',
  });

export const removeExtension = (name: string) =>
  request<{ removed: string }>(`/extensions/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });

export const checkExtensionUpdates = () =>
  request<{ name: string; hasUpdate: boolean }[]>('/extensions/check-updates');

export const listSources = (includeNsfw = false) =>
  request<SourceInfo[]>(`/sources?include_nsfw=${includeNsfw ? 'true' : 'false'}`);

export const getSourceCatalog = (
  source: string,
  options?: { q?: string; page?: number; limit?: number; includeNsfw?: boolean; contentType?: 'manhwa' | 'all' }
) => {
  const params = new URLSearchParams({
    source,
    page: String(options?.page ?? 1),
    limit: String(options?.limit ?? 30),
    include_nsfw: options?.includeNsfw ? 'true' : 'false',
  });
  if (options?.q && options.q.trim().length > 0) {
    params.set('q', options.q.trim());
  }
  if (options?.contentType) {
    params.set('content_type', options.contentType);
  }
  return request<any>(`/source/catalog?${params.toString()}`).then((payload): SourceCatalogResponse => ({
    ...payload,
    items: (payload.items ?? []).map(normalizeManhwa),
  }));
};

// ── Updates feed ─────────────────────────────────────────────────────────────

export const getUpdates = (manhwaUrls: { url: string; source: string }[]) =>
  request<{ manhwaUrl: string; source?: string; newChapters: any[] }[]>('/updates', {
    method: 'POST',
    body: JSON.stringify({ series: manhwaUrls }),
  }).then((items) => items.map((item) => ({
    ...item,
    source: item.source,
    newChapters: item.newChapters.map(normalizeChapter),
  })));
