import { Manhwa, Chapter, Extension } from '../types';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

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

const BASE_URLS = getBaseUrlCandidates();
const BASE_URL = BASE_URLS[0];
export const ACTIVE_API_BASE_URL = BASE_URL;
const REQUEST_TIMEOUT_MS = 15000;

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

  for (const baseUrl of BASE_URLS) {
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
    throw new Error(`Request timed out. Tried: ${BASE_URLS.join(', ')}`);
  }

  throw new Error(`Unable to connect to backend. Tried: ${BASE_URLS.join(', ')}`);
}

// ── Search ──────────────────────────────────────────────────────────────────

export const searchManhwa = (query: string, source = 'all') =>
  request<any[]>(`/search?q=${encodeURIComponent(query)}&source=${source}`)
    .then((list) => list.map(normalizeManhwa));

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

// ── Updates feed ─────────────────────────────────────────────────────────────

export const getUpdates = (manhwaUrls: { url: string; source: string }[]) =>
  request<{ manhwaUrl: string; newChapters: any[] }[]>('/updates', {
    method: 'POST',
    body: JSON.stringify({ series: manhwaUrls }),
  }).then((items) => items.map((item) => ({
    ...item,
    newChapters: item.newChapters.map(normalizeChapter),
  })));
