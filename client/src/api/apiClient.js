import axios from 'axios';

let accessToken = null;

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://talk-sphere-server.onrender.com',
  withCredentials: true
});

apiClient.setAccessToken = (token) => {
  accessToken = token;
};

apiClient.getAccessToken = () => {
  return accessToken;
};

// Callbacks to synchronize with React state (AuthContext)
apiClient.onTokenRefreshed = null;
apiClient.onRefreshFailed = null;

// Request Interceptor: Automatically inject Bearer access token if available
apiClient.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Catch 401 and refresh access token silently
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Avoid intercepting failures on the auth paths themselves
    if (
      originalRequest.url.includes('/api/auth/refresh-token') ||
      originalRequest.url.includes('/api/auth/request-otp') ||
      originalRequest.url.includes('/api/auth/verify-otp')
    ) {
      return Promise.reject(error);
    }

    // Check if error is 401 and request has not already been retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const localRefreshToken = localStorage.getItem('talk_sphere_refresh_token');
        const res = await apiClient.post('/api/auth/refresh-token', { refreshToken: localRefreshToken });
        const { token, user, refreshToken: serverRefreshToken } = res.data;
        if (!token) {
          throw new Error('Refresh token request returned no token');
        }

        accessToken = token;
        if (serverRefreshToken) {
          localStorage.setItem('talk_sphere_refresh_token', serverRefreshToken);
        }

        // Synchronize with AuthContext state
        if (apiClient.onTokenRefreshed) {
          apiClient.onTokenRefreshed(token, user);
        }

        processQueue(null, token);

        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        
        // Notify AuthContext to log out user
        if (apiClient.onRefreshFailed) {
          apiClient.onRefreshFailed();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
