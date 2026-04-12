import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthGuard({ children }) {
  const location = useLocation();
  const { isAuthenticated, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={S.loading}>
        <span style={S.loadingText}>Loading account...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

const S = {
  loading: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
  },
};
