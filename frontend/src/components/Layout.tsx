import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCompany } from '../hooks/useCompany';
import { Avatar } from '../utils/userVisuals';
import { roleLabel } from '../utils/labels';
import { ViewportPortal } from './ViewportPortal';
import {
  LayoutDashboard, FolderKanban, Server, Wallet,
  CheckSquare, BarChart3, LogOut, Bell, Menu, MessageSquare, Moon, Sun, Settings,
  Target, Briefcase, FileText
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Painel' },
  { to: '/crm', icon: Target, label: 'CRM' },
  { to: '/proposals', icon: FileText, label: 'Propostas' },
  { to: '/clients', icon: Briefcase, label: 'Clientes' },
  { to: '/projects', icon: FolderKanban, label: 'Projetos' },
  { to: '/infrastructure', icon: Server, label: 'Infraestrutura' },
  { to: '/finances', icon: Wallet, label: 'Finanças' },
  { to: '/tasks', icon: CheckSquare, label: 'Tarefas' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/notifications', icon: Bell, label: 'Notificações' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
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
    <aside className="w-64 bg-slate-900/90 dark:bg-slate-950/80 border-r border-slate-800 dark:border-white/5 text-white flex flex-col h-full backdrop-blur-xl">
      <div className="p-6 border-b border-slate-800 dark:border-white/5">
        <div className="flex items-center gap-3">
          {companyLogoUrl ? (
            <img
              src={companyLogoUrl}
              alt={companyName}
              className="w-10 h-10 object-contain rounded-xl bg-white/5 p-1 border border-white/10"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center font-bold text-white text-lg shadow-md orange-glow">
              {companyName?.[0] || 'W'}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white tracking-tight truncate font-display">{companyName}</h1>
            <p className="text-[9px] uppercase font-bold tracking-widest text-brand-500">Gestão Inteligente</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
                isActive
                  ? 'bg-brand-500 text-white shadow-lg orange-glow scale-[1.02]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
              }`
            }
            onClick={() => setMobileOpen(false)}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 dark:border-white/5 bg-slate-950/30">
        <div className="flex items-center gap-3 mb-4 p-2.5 rounded-xl bg-white/5 border border-white/5">
          <Avatar user={user} size={36} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{roleLabel(user?.role)}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-red-400 py-2.5 px-4 w-full rounded-xl border border-white/5 hover:border-red-500/20 hover:bg-red-500/10 transition-all duration-300 font-medium"
        >
          <LogOut size={14} />
          Sair da conta
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans transition-colors duration-300">
      {/* Sidebar Desktop */}
      <div className="hidden md:block md:fixed md:inset-y-0 md:left-0 md:z-30">
        {sidebar}
      </div>

      {/* Sidebar Mobile Overlay */}
      {mobileOpen && (
        <ViewportPortal>
          <div className="fixed inset-0 z-50 md:hidden animate-fade-in">
            <button
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            />
            <div className="relative h-full w-64 animate-slide-up">
              {sidebar}
            </div>
          </div>
        </ViewportPortal>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 md:ml-64">
        <header className="bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/50 dark:border-white/5 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md transition-colors duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 transition-all"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:block text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-3.5 py-2 rounded-xl border border-slate-200/10">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            {/* Logo alternativo mobile */}
            <div className="sm:hidden font-bold text-slate-800 dark:text-white text-sm truncate font-display">
              {companyName}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl text-slate-500 hover:text-brand-500 dark:text-slate-400 dark:hover:text-brand-500 bg-slate-100 dark:bg-white/5 border border-slate-200/10 hover:scale-105 active:scale-95 transition-all"
              title="Alternar tema"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => navigate('/notifications')}
              className="p-2.5 rounded-xl text-slate-500 hover:text-brand-500 dark:text-slate-400 dark:hover:text-brand-500 bg-slate-100 dark:bg-white/5 border border-slate-200/10 hover:scale-105 active:scale-95 transition-all relative"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full animate-pulse orange-glow"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto max-w-7xl w-full mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
