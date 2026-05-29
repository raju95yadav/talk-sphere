import React from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';

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
    <AuthProvider>
      <SocketProvider>
        <AppContent />
        <Toaster position="bottom-right" toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            border: '1px solid var(--border-main)',
          },
        }} />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
