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
      } else if (event.data?.type === 'LOGOUT') {
        setUser(null);
        updateToken(null);
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
        const res = await apiClient.post('/api/auth/refresh-token');
        const { token: newToken, user: userData } = res.data;
        if (!newToken) {
          throw new Error('No active session');
        }
        updateToken(newToken);
        setUser(userData);
      } catch (err) {
        console.log('No active session found or refresh token expired.');
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const login = (userData, userToken) => {
    setUser(userData);
    updateToken(userToken);
    authChannel.postMessage({ type: 'LOGIN', user: userData, token: userToken });
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
      await apiClient.post('/api/auth/logout');
    } catch (err) {
      console.error('Failed to log out from server', err);
    } finally {
      setUser(null);
      updateToken(null);
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
