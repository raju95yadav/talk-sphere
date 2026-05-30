import { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/apiClient';

const AuthContext = createContext();

// Create BroadcastChannel for cross-tab auth sync
const authChannel = new BroadcastChannel('talk_sphere_auth');

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync access token with the apiClient local variable synchronously
  const updateToken = (newToken) => {
    setToken(newToken);
    apiClient.setAccessToken(newToken);
  };

  // Synchronize state with Axios interceptor events
  useEffect(() => {
    apiClient.onTokenRefreshed = (newToken, userData) => {
      updateToken(newToken);
      setUser(userData);
      authChannel.postMessage({ type: 'LOGIN', user: userData, token: newToken });
    };

    apiClient.onRefreshFailed = () => {
      updateToken(null);
      setUser(null);
      authChannel.postMessage({ type: 'LOGOUT' });
    };

    return () => {
      apiClient.onTokenRefreshed = null;
      apiClient.onRefreshFailed = null;
    };
  }, []);

  // Listen to BroadcastChannel events from other tabs
  useEffect(() => {
    const handleAuthMessage = (event) => {
      if (event.data?.type === 'LOGIN') {
        setUser(event.data.user);
        updateToken(event.data.token);
        if (event.data.refreshToken) {
          localStorage.setItem('talk_sphere_refresh_token', event.data.refreshToken);
        }
      } else if (event.data?.type === 'LOGOUT') {
        setUser(null);
        updateToken(null);
        localStorage.removeItem('talk_sphere_refresh_token');
      }
    };

    authChannel.addEventListener('message', handleAuthMessage);
    return () => {
      authChannel.removeEventListener('message', handleAuthMessage);
    };
  }, []);

  // Silent authentication: Check for an active session cookie on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const localRefreshToken = localStorage.getItem('talk_sphere_refresh_token');
        const res = await apiClient.post('/api/auth/refresh-token', { refreshToken: localRefreshToken });
        const { token: newToken, user: userData, refreshToken: serverRefreshToken } = res.data;
        if (!newToken) {
          throw new Error('No active session');
        }
        updateToken(newToken);
        setUser(userData);
        if (serverRefreshToken) {
          localStorage.setItem('talk_sphere_refresh_token', serverRefreshToken);
        }
      } catch (err) {
        console.log('No active session found or refresh token expired.');
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const login = (userData, userToken, refreshToken) => {
    setUser(userData);
    updateToken(userToken);
    if (refreshToken) {
      localStorage.setItem('talk_sphere_refresh_token', refreshToken);
    }
    authChannel.postMessage({ type: 'LOGIN', user: userData, token: userToken, refreshToken });
  };

  const refreshUser = async () => {
    try {
      const res = await apiClient.get('/api/users/profile');
      setUser(res.data);
      authChannel.postMessage({ type: 'LOGIN', user: res.data, token });
    } catch (err) {
      console.error('Failed to refresh user profile', err);
    }
  };

  const logout = async () => {
    try {
      const localRefreshToken = localStorage.getItem('talk_sphere_refresh_token');
      await apiClient.post('/api/auth/logout', { refreshToken: localRefreshToken });
    } catch (err) {
      console.error('Failed to log out from server', err);
    } finally {
      setUser(null);
      updateToken(null);
      localStorage.removeItem('talk_sphere_refresh_token');
      authChannel.postMessage({ type: 'LOGOUT' });
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
