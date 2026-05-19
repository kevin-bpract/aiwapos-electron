import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { MoonLoader } from 'react-spinners';
import { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './auth/login';
import DashboardLayout from './dashboard';
import Restaurant from './dashboard/restaurant';
import { initializeCurrency } from '../utils/format';
import { fetchAndCacheSessionReportTemplate } from '../utils/sessionReportPrint';

// Error Boundary to catch rendering errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('ErrorBoundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary - Uncaught error:', error);
    console.error('ErrorBoundary - Error info:', errorInfo);
    console.error('ErrorBoundary - Stack:', error.stack);
  }

  render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center h-screen p-8"
          style={{ background: 'var(--color-primary-tint)' }}
        >
          <div
            className="bg-white p-8 max-w-2xl w-full"
            style={{
              borderRadius: 28,
              border: '1px solid var(--color-line)',
              boxShadow:
                '0 30px 80px rgba(15,23,42,0.10), 0 8px 24px rgba(15,23,42,0.04)',
            }}
          >
            <h1
              className="text-2xl font-extrabold mb-3 tracking-tight"
              style={{ color: 'var(--color-primary-deep)' }}
            >
              Application Error
            </h1>
            <p
              className="mb-4 text-[14px]"
              style={{ color: 'var(--color-ink-muted)' }}
            >
              Something went wrong. Please check the console for details.
            </p>
            {error && (
              <pre
                className="p-4 text-[12px] overflow-auto max-h-96"
                style={{
                  background: 'var(--color-page)',
                  borderRadius: 12,
                  border: '1px solid var(--color-line)',
                  color: 'var(--color-ink)',
                }}
              >
                {error.toString()}
                {error.stack}
              </pre>
            )}
            <button
              type="button"
              className="ds-btn ds-btn-primary mt-5"
              onClick={() => window.location.reload()}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

/** Listens for main-process HTTP 401 (credentials already cleared there). */
function AuthSessionBridge() {
  const navigate = useNavigate();
  const { notifySessionExpired } = useAuth();

  useEffect(() => {
    const off = window.authSession?.onSessionExpired?.(() => {
      notifySessionExpired();
      navigate('/login', { replace: true });
    });
    return () => off?.();
  }, [navigate, notifySessionExpired]);

  return null;
}

function AppRoutes() {
  const { loading, isAuthenticated } = useAuth();
  const [isReloadSyncing, setIsReloadSyncing] = useState(false);
  console.log(
    '[AppRoutes] Rendering - isAuthenticated:',
    isAuthenticated,
    'loading:',
    loading,
  );

  // Initialize currency and settings on app load
  useEffect(() => {
    console.log('[AppRoutes] Initializing currency...');
    initializeCurrency()
      .then(() => console.log('[AppRoutes] Currency initialized successfully'))
      .catch((error) => {
        console.error('[AppRoutes] Failed to initialize currency:', error);
      });

    // Apply saved appearance settings + warm up print subsystem
    const applySettings = async () => {
      try {
        const savedSettings = (await window.printerSettings.get()) as any;
        if (savedSettings) {
          if (savedSettings.scale) {
            try {
              // webFrame.setZoomFactor breaks touch event coordinates in Electron
              // so inputs become un-clickable on touch screens. CSS zoom handles it correctly.
              (document.documentElement as any).style.zoom = savedSettings.scale;
            } catch (err) {
              console.error('Failed to set CSS zoom:', err);
            }
          }
          if (savedSettings.fontSize) {
            document.documentElement.style.fontSize = `${savedSettings.fontSize}px`;
          }
          // Pre-warm the hidden print BrowserWindow + OS printer driver
          // so the first real print doesn't pay the cold-start penalty.
          const printer = savedSettings.printer;
          if (printer) {
            window.printers.warmup(printer).catch(() => {});
          }
          // Pre-fetch session report template if client-side session report is enabled
          if (savedSettings.sessionReportClientPrintEnabled) {
            fetchAndCacheSessionReportTemplate().catch((err) =>
              console.warn('[AppRoutes] Failed to pre-cache session report template:', err),
            );
          }
        }
      } catch (error) {
        console.error('Failed to load appearance settings:', error);
      }
    };
    applySettings();

    // Trigger a background data sync on app reload/mount if authenticated
    if (isAuthenticated) {
      console.log('[AppRoutes] Triggering background data sync on reload...');

      // Import toast dynamically
      import('sonner').then(({ toast }) => {
        toast.info('Syncing data in background...', {
          duration: 2000,
          id: 'background-sync',
        });

        window.dataSync.sync()
          .then(() => {
            console.log('[AppRoutes] Background data sync completed');
            toast.success('Data synced successfully', {
              duration: 2000,
              id: 'background-sync',
            });

            // Dispatch event so checkout modals can refetch payment modes
            window.dispatchEvent(new CustomEvent('data-sync-completed'));
          })
          .catch((error) => {
            console.error('[AppRoutes] Background data sync failed:', error);
            toast.error('Data sync failed - using cached data', {
              duration: 3000,
              id: 'background-sync',
            });
          });
      });
    }
  }, [isAuthenticated]);

  // Ctrl+R / Cmd+R / F5 should sync all data first, then reload renderer.
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleReloadWithSync = async (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isReloadKey = (event.ctrlKey || event.metaKey) && key === 'r';
      const isF5 = event.key === 'F5';
      if (!isReloadKey && !isF5) return;

      event.preventDefault();
      if (isReloadSyncing) return;
      setIsReloadSyncing(true);

      const { toast } = await import('sonner');
      toast.loading('Refreshing data from server...', { id: 'reload-sync' });

      try {
        await window.dataSync.sync();
        window.dispatchEvent(new CustomEvent('data-sync-completed'));
        toast.success('Data refreshed. Reloading...', {
          id: 'reload-sync',
          duration: 1200,
        });
        setTimeout(() => window.location.reload(), 250);
      } catch (error) {
        console.error('[AppRoutes] Reload sync failed:', error);
        toast.error('Refresh sync failed. Reloading with cached data...', {
          id: 'reload-sync',
          duration: 1500,
        });
        setTimeout(() => window.location.reload(), 250);
      }
    };

    window.addEventListener('keydown', handleReloadWithSync);
    return () => window.removeEventListener('keydown', handleReloadWithSync);
  }, [isAuthenticated, isReloadSyncing]);

  // useEffect(() => {
  //   initHttpClient()
  //     .then(() => console.log('baseurl configured'))
  //     .catch(console.error);
  // }, []);

  if (loading || isReloadSyncing) {
    console.log('[AppRoutes] Showing loading spinner');
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{
          background:
            'linear-gradient(160deg, #F04654 0%, #D02230 45%, #8E0D18 100%)',
        }}
      >
        <MoonLoader color="white" />
      </div>
    );
  }

  console.log(
    '[AppRoutes] Rendering routes - isAuthenticated:',
    isAuthenticated,
  );
  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Restaurant />} />
        <Route path="restaurant" element={<Restaurant />} />
      </Route>

      <Route
        path="/"
        element={
          <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
        }
      />

      <Route
        path="*"
        element={
          <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
        }
      />
    </Routes>
  );
}

export default function App() {
  console.log('[App] Rendering App component');

  useEffect(() => {
    console.log('[App] App component mounted');
    console.log('[App] Environment:', process.env.NODE_ENV);
    console.log('[App] User Agent:', navigator.userAgent);
  }, []);

  return (
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <AuthSessionBridge />
          <AppRoutes />
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
