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

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID || 'your_google_client_id_here';

const AppContent = () => {
  const { token, loading } = useAuth();

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
              <AppContent />
              <CallModal />
              <Toaster position="bottom-right" toastOptions={{
                style: {
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-main)',
                },
              }} />
            </CallProvider>
          </SocketProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}

export default App;
