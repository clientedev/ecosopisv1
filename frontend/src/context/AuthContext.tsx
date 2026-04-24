'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  can_post_news?: boolean;
  pode_girar_roleta: boolean;
  addresses?: any[];
  profile_picture?: string;
  total_compras?: number;
  tentativas_roleta?: number;
  ultimo_premio_id?: number;
  cart_json?: string | null;
  cart_updated_at?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; status?: number }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
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
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        if (isTokenExpired(storedToken)) {
          setUser(null);
          setToken(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
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

  const refreshProfile = async () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;
    if (isTokenExpired(storedToken)) {
      logout();
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (error) {
      console.error("Refresh profile error:", error);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; status?: number }> => {
    try {
      const params = new URLSearchParams();
      params.append("username", email);
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

        // Fetch user profile immediately
        const userRes = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        }
        return { success: true };
      }
      return { success: false, status: response.status };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshProfile, isLoading }}>
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
