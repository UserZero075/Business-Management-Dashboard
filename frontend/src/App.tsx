import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { QueryProvider } from './hooks/useData';
import { ToastProvider } from './hooks/useToast';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectManager from './pages/ProjectManager';
import Infrastructure from './pages/Infrastructure';
import Finances from './pages/Finances';
import Tasks from './pages/Tasks';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import Chat from './pages/Chat';
import UserProfile from './pages/UserProfile';
import Settings from './pages/Settings';
import CRM from './pages/CRM';
import Clients from './pages/Clients';
import Proposals from './pages/Proposals';
import type { ReactNode } from 'react';

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="crm" element={<CRM />} />
        <Route path="clients" element={<Clients />} />
        <Route path="proposals" element={<Proposals />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id/manager" element={<ProjectManager />} />
        <Route path="infrastructure" element={<Infrastructure />} />
        <Route path="finances" element={<Finances />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="team" element={<Navigate to="/settings?tab=equipe" replace />} />
        <Route path="reports" element={<Reports />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="chat" element={<Chat />} />
        <Route path="profile" element={<Navigate to="/settings?tab=perfil" replace />} />
        <Route path="users/:id" element={<UserProfile />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <QueryProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </QueryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
