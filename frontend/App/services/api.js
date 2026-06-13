import axios from 'axios';
import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';

function isLoopbackHost(host) {
  if (!host) return true;
  const normalized = String(host).toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '0.0.0.0' ||
    normalized === '::1'
  );
}

function sanitizeHost(rawHost) {
  if (!rawHost || typeof rawHost !== 'string') {
    return null;
  }
  const cleaned = rawHost
    .replace(/^https?:\/\//, '')
    .replace(/^exp:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .trim();
  return cleaned || null;
}

function getHostFromExpo() {
  const hostUriCandidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.expoGoConfig?.hostUri,
    Constants.manifest2?.extra?.expoClient?.hostUri,
    Constants.manifest?.debuggerHost,
    Constants.manifest?.hostUri,
  ];

  for (const candidate of hostUriCandidates) {
    const host = sanitizeHost(candidate);
    if (host && !isLoopbackHost(host)) return host;
  }

  return null;
}

function getHostFromRuntimeBundle() {
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  const host = sanitizeHost(scriptURL);
  if (!host || isLoopbackHost(host)) {
    return null;
  }
  return host;
}

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function getHostFromEnv() {
  const envUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  if (!envUrl) return null;
  return envUrl;
}

function uniqueUrls(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const normalized = normalizeBaseUrl(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function getApiBaseUrl() {
  const envBase = getHostFromEnv();
  if (envBase) {
    return envBase;
  }

  // Prefer Expo host metadata first (usually your LAN IP), then runtime bundle host.
  const detectedHost = getHostFromExpo() || getHostFromRuntimeBundle();
  if (detectedHost) {
    return `http://${detectedHost}:8010`;
  }

  if (Platform.OS === 'android') {
    // Emulator fallback only; physical devices should resolve LAN host above.
    return 'http://10.0.2.2:8010';
  }

  return 'http://localhost:8010';
}

export const API_BASE_URL = getApiBaseUrl();

const FALLBACK_API_BASE_URLS = uniqueUrls([
  process.env.EXPO_PUBLIC_API_BASE_URL,
  API_BASE_URL,
  'http://192.168.29.102:8010',
  'http://10.0.2.2:8010',
  'http://localhost:8010',
  'http://192.168.29.102:8000',
  'http://10.0.2.2:8000',
  'http://localhost:8000',
]);

console.log('[API] Using base URL:', API_BASE_URL);
console.log('[API] Fallback URLs:', FALLBACK_API_BASE_URLS);

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 25000,
});

// Simple in-memory download progress emitter for UI components to subscribe to.
const _downloadProgressSubscribers = new Set();
export function subscribeDownloadProgress(cb) {
  _downloadProgressSubscribers.add(cb);
  return () => _downloadProgressSubscribers.delete(cb);
}
function _emitDownloadProgress(payload) {
  for (const cb of _downloadProgressSubscribers) {
    try {
      cb(payload);
    } catch (e) {
      // ignore subscriber errors
    }
  }
}

// Active DownloadResumable handlers so callers can cancel ongoing downloads.
const _activeDownloads = new Map(); // key -> DownloadResumable
export async function cancelDownload(title) {
  // cancel all downloads matching this chapter title
  const keys = Array.from(_activeDownloads.keys()).filter((k) => k.startsWith(`${title}:`));
  for (const k of keys) {
    try {
      const resumable = _activeDownloads.get(k);
      if (resumable && typeof resumable.pauseAsync === 'function') {
        // for older SDKs
        await resumable.pauseAsync();
      }
      if (resumable && typeof resumable.cancelAsync === 'function') {
        await resumable.cancelAsync();
      }
    } catch (e) {
      // ignore
    } finally {
      _activeDownloads.delete(k);
    }
  }
}

export async function getSearchSuggestions(params = {}) {
  const requestParams = {
    source: params.source || 'all',
    content_type: params.contentType || 'manhwa',
    include_nsfw: params.includeNsfw ?? true,
    limit: params.limit || 12,
    ...(params.q ? { q: params.q } : {}),
  };

  try {
    const response = await api.get('/search/suggestions', {
      params: requestParams,
    });
    return response.data || [];
  } catch (error) {
    const isAllSource = requestParams.source === 'all';
    const isTimeout = error?.code === 'ECONNABORTED';
    if (!isAllSource || !isTimeout) {
      throw error;
    }

    // Fallback to deterministic bundled source when all-source suggestions are too slow.
    const response = await api.get('/search/suggestions', {
      params: {
        ...requestParams,
        source: 'Vault Picks',
      },
    });
    return response.data || [];
  }
}

export async function trackSuggestionTelemetry(params = {}) {
  const response = await api.post('/telemetry/suggestions/event', {
    event: params.event,
    source: params.source || 'unknown',
    client: params.client || 'frontend',
    surface: params.surface || 'unknown',
  });
  return response.data;
}

export async function getReadingProgress(params = {}) {
  const response = await api.get('/progress', {
    params: {
      manga_id: params.mangaId,
      chapter_url: params.chapterUrl,
      user_id: params.userId,
    },
  });
  return response.data || {};
}

export async function setReadingProgress(payload = {}) {
  const body = {
    user_id: payload.userId,
    manga_id: payload.mangaId,
    chapter_url: payload.chapterUrl,
    page_num: payload.pageNum,
    position: payload.position,
  };
  const response = await api.put('/progress', body);
  return response.data || {};
}

export async function downloadChapter(params = {}) {
  // POST with query params (server expects url, source, title)
  const response = await api.post('/download/chapter', null, {
    params: {
      url: params.chapterUrl,
      source: params.source,
      title: params.title,
    },
    timeout: 120000,
  });
  return response.data || {};
}

export async function deleteDownloadedChapter(params = {}) {
  const response = await api.delete('/download/chapter', {
    params: {
      title: params.title,
    },
  });
  return response.data || {};
}

export async function downloadAndSaveChapter(params = {}, onProgress = null) {
  // Call server to prepare and return file URLs
  const serverRes = await downloadChapter(params);
  const files = serverRes.files || [];
  const saved = [];

  if (files.length === 0) return { server: serverRes, localFiles: [] };

  const safeDir = `${FileSystem.documentDirectory}manhwavault/offline/${serverRes.title}/`;
  try {
    // Ensure directory exists
    await FileSystem.makeDirectoryAsync(safeDir, { intermediates: true });
  } catch (e) {
    // ignore if already exists
  }

  // Helper to download with progress using DownloadResumable
  async function downloadWithProgress(remote, localPath, index, title) {
    const callback = (downloadProgress) => {
      if (onProgress) {
        const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
        const percent = totalBytesExpectedToWrite ? totalBytesWritten / totalBytesExpectedToWrite : null;
        try {
          const payload = { title, index, loaded: totalBytesWritten, total: totalBytesExpectedToWrite, percent, filename: localPath.split('/').pop() };
          onProgress(payload);
          _emitDownloadProgress(payload);
        } catch (e) {
          // ignore
        }
      }
    };

    const maxRetries = 3;
    let attempt = 0;
    let lastError = null;
    while (attempt < maxRetries) {
      attempt += 1;
      try {
        const resumable = FileSystem.createDownloadResumable(remote, localPath, {}, callback);
        // store by title:index so cancelDownload can find it
        const key = `${title}:${index}`;
        _activeDownloads.set(key, resumable);
        const uri = await resumable.downloadAsync();
        _activeDownloads.delete(key);
        return uri.uri || uri;
      } catch (err) {
        lastError = err;
        // remove any stored resumable for this attempt
        try {
          _activeDownloads.delete(`${title}:${index}`);
        } catch (e) {
          // ignore
        }
        // exponential backoff before retrying
        if (attempt < maxRetries) {
          const waitMs = 250 * Math.pow(2, attempt - 1);
          await new Promise((res) => setTimeout(res, waitMs));
          continue;
        }
        // final fallback: try simple download once
        try {
          const r = await FileSystem.downloadAsync(remote, localPath);
          return r.uri;
        } catch (e) {
          throw lastError || e;
        }
      }
    }
  }

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const remote = f && f.startsWith('http') ? f : `${API_BASE_URL}${f}`;
    const filename = remote.split('/').pop().split('?')[0] || `img_${Date.now()}.jpg`;
    const localPath = `${safeDir}${filename}`;
    try {
      const uri = await downloadWithProgress(remote, localPath, i, serverRes.title);
      saved.push(uri);
    } catch (err) {
      console.log('[downloadAndSaveChapter] failed to download', remote, err.message || err);
    }
  }

  // If server provided thumbs, try to save preferred thumb locally as thumb.jpg
  const thumbs = serverRes.thumbs || {};
  const preferred = thumbs.small || thumbs.default || thumbs.webp || thumbs.large || serverRes.thumb;
  if (preferred) {
    try {
      const thumbRemote = preferred.startsWith('http') ? preferred : `${API_BASE_URL}${preferred}`;
      const thumbLocal = `${safeDir}thumb.jpg`;
      try {
        await downloadWithProgress(thumbRemote, thumbLocal, -1);
      } catch (e) {
        // fallback to simple download
        await FileSystem.downloadAsync(thumbRemote, thumbLocal);
      }
      // add thumb to front of saved list for convenience
      saved.unshift(thumbLocal);
    } catch (e) {
      console.log('[downloadAndSaveChapter] failed to download thumb', e?.message || e);
    }
  }

  return { server: serverRes, localFiles: saved };
}

  // unreachable

export async function getSuggestionTelemetry() {
  const response = await api.get('/telemetry/suggestions');
  return response.data || {
    total: { refresh: 0, click: 0, events: 0 },
    bySource: {},
    byClient: {},
    bySurface: {},
  };
}

export async function resetSuggestionTelemetry() {
  const response = await api.post('/telemetry/suggestions/reset');
  return response.data;
}

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`[API Request] ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.log('[API Request Error]', error.message);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.status} from ${response.config.url}`);
    return response;
  },
  async (error) => {
    const cfg = error?.config;
    const isNetworkError = !error?.response && (error?.code === 'ERR_NETWORK' || String(error?.message || '').includes('Network Error'));
    const status = Number(error?.response?.status || 0);
    const isServerError = status >= 500;

    if (cfg && (isNetworkError || isServerError)) {
      const tried = cfg.__triedBaseUrls || (cfg.baseURL ? [cfg.baseURL] : []);
      const nextBase = FALLBACK_API_BASE_URLS.find((u) => !tried.includes(u));

      if (nextBase) {
        const nextTried = [...tried, nextBase];
        const reason = isServerError ? `HTTP ${status}` : 'network error';
        console.log(`[API Retry] ${reason}. Retrying ${cfg.url} via ${nextBase}`);
        return axios.request({
          ...cfg,
          baseURL: nextBase,
          __triedBaseUrls: nextTried,
        });
      }
    }

    if (error.response) {
      console.log(`[API Response Error] ${error.response.status}: ${error.response.statusText}`);
    } else if (error.request) {
      console.log('[API Request Error] No response received:', error.message);
    } else {
      console.log('[API Error]', error.message);
    }
    return Promise.reject(error);
  }
);
