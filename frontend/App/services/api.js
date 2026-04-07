import axios from 'axios';
import { Platform } from 'react-native';

// Use the host machine IP address directly
// This is 192.168.29.102 - your PC's IP on the local network
export const API_BASE_URL = 'http://192.168.29.102:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
});

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
  (error) => {
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
