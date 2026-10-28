import axios from 'axios';

const axiosClient = axios.create();

axiosClient.interceptors.request.use((config) => {
  const appConfig = window.GRIEVANCE_CONFIG || {};
  const baseUrl = appConfig.apiUrl || '';

  // ✅ FIX: Fallback to storage if token is missing in config
  let token = appConfig.token;
  if (!token) {
    try {
      token =
        (typeof localStorage !== 'undefined' && localStorage.getItem('JWT_TOKEN')) ||
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('JWT_TOKEN')) ||
        '';
    } catch (e) {
      token = '';
    }
  }

  // Prepend base URL to relative paths
  if (baseUrl && config.url && config.url.startsWith('/')) {
    config.url = baseUrl + config.url;
  }

  // Attach bearer token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('[axios] ✅', config.method?.toUpperCase(), config.url, '| token len:', token.length);
  } else {
    console.warn('[axios] ⚠️ No token for', config.method?.toUpperCase(), config.url);
  }

  return config;
});

export default axiosClient;