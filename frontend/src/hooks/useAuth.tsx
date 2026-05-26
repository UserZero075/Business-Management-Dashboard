import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi, api } from '../api/client';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  avatar?: string;
  color?: string;
  bio?: string;
  githubUrl?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, otp: string) => Promise<void>;
  updateProfile: (data: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.setToken(token);
      authApi.me()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('token');
          api.setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { user, token } = await authApi.login(email, password);
    api.setToken(token);
    setUser(user);
  };

  const register = async (email: string, password: string, name: string, otp: string) => {
    const { user, token } = await authApi.register(email, password, name, otp);
    api.setToken(token);
    setUser(user);
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
  };

  const updateProfile = async (data: any) => {
    const updated = await authApi.updateMe(data);
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
