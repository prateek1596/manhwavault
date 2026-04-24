import axios from 'axios';
import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';

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
    return `http://${detectedHost}:8000`;
  }

  if (Platform.OS === 'android') {
    // Emulator fallback only; physical devices should resolve LAN host above.
    return 'http://10.0.2.2:8000';
  }

  return 'http://localhost:8000';
}

export const API_BASE_URL = getApiBaseUrl();

const FALLBACK_API_BASE_URLS = uniqueUrls([
  process.env.EXPO_PUBLIC_API_BASE_URL,
  API_BASE_URL,
  'http://192.168.29.102:8000',
  'http://10.0.2.2:8000',
  'http://localhost:8000',
]);

console.log('[API] Using base URL:', API_BASE_URL);
console.log('[API] Fallback URLs:', FALLBACK_API_BASE_URLS);

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
});

export async function getSearchSuggestions(params = {}) {
  const response = await api.get('/search/suggestions', {
    params: {
      source: params.source || 'all',
      content_type: params.contentType || 'manhwa',
      include_nsfw: params.includeNsfw ?? true,
      limit: params.limit || 12,
      ...(params.q ? { q: params.q } : {}),
    },
  });
  return response.data || [];
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

    if (cfg && isNetworkError) {
      const tried = cfg.__triedBaseUrls || [];
      const nextBase = FALLBACK_API_BASE_URLS.find((u) => !tried.includes(u));

      if (nextBase) {
        const nextTried = [...tried, nextBase];
        console.log(`[API Retry] Network error. Retrying ${cfg.url} via ${nextBase}`);
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
