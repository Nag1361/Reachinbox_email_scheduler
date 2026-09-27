import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ComposePage from './pages/ComposePage';
import EmailDetailPage from './pages/EmailDetailPage';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-gray-950 text-gray-300">Loading your workspace…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout><Outlet /></AppLayout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-gray-950 text-gray-300">Loading your workspace…</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/compose" element={<ComposePage />} />
        <Route path="/email/:id" element={<EmailDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
