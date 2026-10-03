import React, { createContext, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import apiClient from '../api/apiClient';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user, token, login, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const userId = user?._id || user?.id;

  useEffect(() => {
    let s = null;
    
    if (token && userId) {
      // Connect to Socket.io and pass JWT in the auth handshake configuration
      s = io(import.meta.env.VITE_API_URL || 'https://talk-sphere-server.onrender.com', {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        timeout: 20000,
        withCredentials: true,
      });
      
      s.on('connect', () => {
        setIsConnected(true);
        setIsReconnecting(false);
        console.log('Socket connected successfully:', s.id);
        s.emit('join', userId.toString());
      });
      
      s.on('disconnect', (reason) => {
        setIsConnected(false);
        console.warn('Socket disconnected. Reason:', reason);
      });

      s.on('reconnect_attempt', () => {
        setIsReconnecting(true);
        console.log('Attempting socket reconnection...');
      });

      s.on('reconnect_failed', () => {
        setIsReconnecting(false);
        console.error('Socket reconnection failed after maximum attempts');
      });

      // Handle socket authorization error (e.g. JWT expired during connection attempt)
      s.on('connect_error', async (err) => {
        setIsReconnecting(false);
        console.warn('Socket connection error:', err.message);
        
        if (err.message && err.message.includes('Authentication error')) {
          console.log('Socket token authentication failed. Attempting silent token refresh...');
          try {
            const localRefreshToken = localStorage.getItem('talk_sphere_refresh_token');
            const res = await apiClient.post('/api/auth/refresh-token', { refreshToken: localRefreshToken });
            const { token: newToken, user: userData, refreshToken: newRefreshToken } = res.data || {};
            if (!newToken) {
              console.warn('Silent refresh returned empty token; keeping session active.');
              return;
            }
            // Update auth state which will re-trigger this useEffect with the new token
            login(userData, newToken, newRefreshToken || localRefreshToken);
            if (s) {
              s.auth = { token: newToken };
              s.connect();
            }
          } catch (refreshErr) {
            console.warn('Silent refresh temporary failure during socket error. Keeping session intact.');
          }
        }
      });

      // Remote Device Disconnected specifically by user from Linked Devices
      s.on('device:removed', (data) => {
        const mySessionId = localStorage.getItem('ts_device_id') || sessionStorage.getItem('ts_session_id');
        if (data?.sessionId && data.sessionId === mySessionId) {
          console.warn('This device session was disconnected by the user.');
          toast.error('This device was unlinked from your account');
          logout();
        }
      });

      // User clicked "Log out from all other devices"
      s.on('device:all_removed', (data) => {
        const mySessionId = localStorage.getItem('ts_device_id') || sessionStorage.getItem('ts_session_id');
        if (data?.currentSessionId && data.currentSessionId !== mySessionId) {
          console.warn('This device was logged out because user logged out all other devices.');
          toast.error('You were logged out from this device');
          logout();
        }
      });

      // Targeted session invalidation listener
      s.on('session_invalidated', (data) => {
        const mySessionId = localStorage.getItem('ts_device_id') || sessionStorage.getItem('ts_session_id');
        if (!data?.sessionId || data.sessionId === mySessionId || data?.reason === 'password_reset') {
          console.warn('Active session invalidated. Terminating locally.');
          logout();
        }
      });
      
      setSocket(s);

      return () => {
        if (s) {
          s.disconnect();
        }
      };
    } else {
      setSocket(null);
      setIsConnected(false);
      setIsReconnecting(false);
    }
  }, [token, userId]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, isReconnecting }}>
      {children}
    </SocketContext.Provider>
  );
};

// Returns the raw socket object directly for backward compatibility
export const useSocket = () => {
  const context = useContext(SocketContext);
  return context ? context.socket : null;
};

// Exposes connectivity state separately to avoid breaking components relying on useSocket
export const useSocketStatus = () => {
  const context = useContext(SocketContext);
  if (!context) return { isConnected: false, isReconnecting: false };
  return { isConnected: context.isConnected, isReconnecting: context.isReconnecting };
};
