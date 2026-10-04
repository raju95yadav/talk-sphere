import React from 'react';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import CallModal from './components/CallModal';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';

import { NotificationProvider } from './context/NotificationContext';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID || 'your_google_client_id_here';

const AppContent = () => {
  const { token, loading } = useAuth();

  React.useEffect(() => {
    // Capture invite referral parameter from URL if present
    try {
      const params = new URLSearchParams(window.location.search);
      let ref = params.get('ref') || params.get('invite');
      if (!ref && window.location.pathname.startsWith('/join/')) {
        ref = window.location.pathname.replace('/join/', '');
      }
      if (ref) {
        const clean = decodeURIComponent(ref).replace(/^@/, '').trim();
        if (clean) {
          localStorage.setItem('talksphere_pending_ref', clean);
        }
      }
    } catch (e) {
      console.warn('Referral detection error:', e);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main">
        <div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return token ? <Dashboard /> : <LoginPage />;
};

function App() {
  return (
    <ErrorBoundary module="ROOT_APP">
      <GoogleOAuthProvider clientId={googleClientId}>
        <AuthProvider>
          <SocketProvider>
            <CallProvider>
              <NotificationProvider>
                <AppContent />
                <CallModal />
                <Toaster position="top-right" toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-main)',
                    borderRadius: '16px',
                    boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.45)',
                    fontSize: '13px',
                    fontWeight: '500',
                  },
                }} />
              </NotificationProvider>
            </CallProvider>
          </SocketProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}

export default App;
