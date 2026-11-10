'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  cpf?: string;
  auth_provider?: string;
  google_id?: string;
  role: string;
  can_post_news?: boolean;
  scratch_used?: boolean;
  scratch_reward_id?: number;
  addresses?: any[];
  profile_picture?: string;
  total_compras?: number;
  cart_json?: string | null;
  cart_updated_at?: string | null;
  is_guest_created?: boolean;
  must_change_password?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, remember?: boolean) => Promise<{ success: boolean; status?: number; detail?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<boolean>;
  updateUser: (data: Partial<User>) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isTokenExpired = (jwt: string) => {
    // The user prefers sessions not to expire.
    // Return false so we don't log them out on the client side.
    return false;
  };

  useEffect(() => {
    const initAuth = async () => {
      // Clear credentials on new session if user didn't request to stay connected
      if (typeof window !== 'undefined') {
        const sessionActive = sessionStorage.getItem('session_active');
        if (!sessionActive) {
          const rememberMe = localStorage.getItem('remember_me');
          if (rememberMe === 'false') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('remember_me');
          }
          sessionStorage.setItem('session_active', 'true');
        }
      }

      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        if (isTokenExpired(storedToken)) {
          setUser(null);
          setToken(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('remember_me');
          setIsLoading(false);
          return;
        }
        setToken(storedToken);
        try {
          // Verify token and fetch fresh user profile
          const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${storedToken}` }
          });
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          } else if (response.status === 401 || response.status === 403) {
            // Only clear token if it's explicitly unauthorized/forbidden
            setUser(null);
            setToken(null);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('remember_me');
          } else {
            // For 500 or other errors, try to use stored user as fallback
            const storedUser = localStorage.getItem('user');
            if (storedUser) setUser(JSON.parse(storedUser));
          }
        } catch (error) {
          console.error("Initial auth fetch error:", error);
          // Fallback to stored user if fetch fails
          const storedUser = localStorage.getItem('user');
          if (storedUser) setUser(JSON.parse(storedUser));
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const refreshProfile = async (): Promise<boolean> => {
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!storedToken) {
      return false;
    }
    if (isTokenExpired(storedToken)) {
      logout();
      return false;
    }

    setToken(storedToken);
    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        return true;
      } else if (response.status === 401 || response.status === 403) {
        logout();
        return false;
      }
      return false;
    } catch (error) {
      console.error("Refresh profile error:", error);
      return false;
    }
  };

  const login = async (email: string, password: string, remember: boolean = false): Promise<{ success: boolean; status?: number; detail?: string }> => {
    try {
      const params = new URLSearchParams();
      params.append("username", email.trim());
      params.append("password", password);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.access_token);
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('remember_me', remember ? 'true' : 'false');
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('session_active', 'true');
          sessionStorage.removeItem("roulette_spin_shown");
        }

        // Fetch user profile immediately
        try {
          const userRes = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${data.access_token}` }
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            if ((data.must_change_password || userData.must_change_password) && typeof window !== 'undefined' && !window.location.pathname.startsWith('/redefinir-senha')) {
              setTimeout(() => {
                window.location.href = '/redefinir-senha?first_access=1';
              }, 300);
            }
          } else {
            // Fallback minimo para garantir exibição imediata da conta caso /me oscile
            const fallbackUser: User = {
              id: 0,
              email: email.trim(),
              full_name: email.trim().split('@')[0],
              role: data.role || 'client',
              must_change_password: Boolean(data.must_change_password),
            };
            setUser(fallbackUser);
            localStorage.setItem('user', JSON.stringify(fallbackUser));
          }
        } catch {
          const fallbackUser: User = {
            id: 0,
            email: email.trim(),
            full_name: email.trim().split('@')[0],
            role: data.role || 'client',
            must_change_password: Boolean(data.must_change_password),
          };
          setUser(fallbackUser);
          localStorage.setItem('user', JSON.stringify(fallbackUser));
        }
        return { success: true };
      }

      let detail = undefined;
      try {
        const errBody = await response.json();
        detail = typeof errBody?.detail === 'string' ? errBody.detail : undefined;
      } catch {
        // ignore parse errors
      }
      return { success: false, status: response.status, detail };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, detail: 'Falha na conexão com o servidor.' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('remember_me');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('session_active');
    }
  };

  const updateUser = (data: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshProfile, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
