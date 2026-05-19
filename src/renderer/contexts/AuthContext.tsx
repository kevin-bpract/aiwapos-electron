import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { getLoggedUser, logout as apiLogout } from '../../main/api/auth';

interface AuthContextType {
  user: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (user: string) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  /** HTTP 401 on an API (main already cleared credentials) — sync React state only. */
  notifySessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    console.log('[AuthContext] Checking authentication...');
    try {
      const loggedUser = await getLoggedUser();
      console.log('[AuthContext] Auth check result:', loggedUser);
      setUser(loggedUser);
    } catch (error) {
      console.error('[AuthContext] Auth check failed:', error);
      console.error(
        '[AuthContext] Error details:',
        error instanceof Error ? error.stack : error,
      );
      setUser(null);
    } finally {
      setLoading(false);
      console.log('[AuthContext] Auth check complete, loading set to false');
    }
  };

  // initialize auth check on mount
  useEffect(() => {
    console.log('[AuthContext] Component mounted, starting auth check');
    checkAuth().catch((err) => {
      console.error('[AuthContext] Critical error in checkAuth:', err);
      setLoading(false);
    });
  }, []);

  const login = (userEmail: string) => {
    console.log('Setting user in auth context:', userEmail);
    setUser(userEmail);
    setLoading(false);
  };

  const notifySessionExpired = useCallback(() => {
    setUser(null);
    setLoading(false);
  }, []);

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Keep app running; just return to sign-in screen.
      // Clear user/session-scoped local data but do not restart the whole app.
      try {
        await (window as any).app_config?.save?.('auth_token', '');
        await (window as any).app_config?.save?.('auth_user', '');
        await (window as any).app_config?.save?.('api_key', '');
        await (window as any).app_config?.save?.('api_secret', '');
      } catch (saveError) {
        console.error('[AuthContext] Failed to clear auth credentials:', saveError);
      }
      try {
        await (window as any).dataSync?.clearAll?.();
      } catch (clearError) {
        console.error('[AuthContext] Failed to clear local synced data on logout:', clearError);
      }
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    checkAuth,
    notifySessionExpired,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
