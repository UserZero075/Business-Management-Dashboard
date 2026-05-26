import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCompany } from '../hooks/useCompany';
import { Avatar } from '../utils/userVisuals';
import { roleLabel } from '../utils/labels';
import {
  LayoutDashboard, FolderKanban, Server, Wallet,
  CheckSquare, BarChart3, Users, LogOut, Bell, Menu, MessageSquare, UserCircle, Moon, Sun, Settings
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projetos' },
  { to: '/infrastructure', icon: Server, label: 'Infraestrutura' },
  { to: '/finances', icon: Wallet, label: 'Finanças' },
  { to: '/tasks', icon: CheckSquare, label: 'Tarefas' },
  { to: '/team', icon: Users, label: 'Equipe' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/notifications', icon: Bell, label: 'Notificações' },
  { to: '/profile', icon: UserCircle, label: 'Meu perfil' },
  { to: '/settings', icon: Settings, label: 'Empresa' },
  { to: '/reports', icon: BarChart3, label: 'Relatórios' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { companyName, companyLogoUrl } = useCompany();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebar = (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {companyLogoUrl && <img src={companyLogoUrl} alt={companyName} className="w-9 h-9 object-contain rounded-lg bg-white/10" />}
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-blue-400 truncate">{companyName}</h1>
              <p className="text-xs text-slate-400">Gestão</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
              onClick={() => setMobileOpen(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <Avatar user={user} size={40} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-400">{roleLabel(user?.role)}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white w-full"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="hidden md:block md:fixed md:inset-y-0 md:left-0 md:z-30">
        {sidebar}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />
          <div className="relative h-full">
            {sidebar}
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0 md:ml-64">
        <header className="bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 text-gray-600 hover:text-gray-900">
              <Menu size={22} />
            </button>
          <h2 className="text-sm sm:text-lg font-semibold text-gray-800 truncate">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h2>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-gray-500 hover:text-gray-700 relative" title="Alternar tema">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => navigate('/notifications')} className="p-2 text-gray-500 hover:text-gray-700 relative">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
