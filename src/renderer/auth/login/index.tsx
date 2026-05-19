import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import './styles.scss';
import { login, userIdFromLoginMessage } from '../../../main/api/auth';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAndCacheAllTemplates } from '../../../utils/clientSidePrint';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcut';
import KeyboardConfig from '../../../constants/kb_config';
import Portal from '../../../components/portal';
import EnvModal from '../../../components/modals/envmodal';
import OnScreenKeyboard from '../../../components/onscreenkeyboard/OnScreenKeyboard';
import OnScreenKeyboardToggleButton from '../OnScreenKeyboardToggleButton';

interface FormData {
  username: string;
  password: string;
}

export default function Login() {
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [envModalVisible, setEnvModalVisible] = useState<boolean>(false);
  const [currentBackendUrl, setCurrentBackendUrl] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  useKeyboardShortcuts({
    [KeyboardConfig.envModal]: () => setEnvModalVisible<boolean>(true),
  });

  const [formData, setFormData] = useState<FormData>({
    username: '',
    password: '',
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { login: setAuthUser } = useAuth();
  const [loginKeyboardOpen, setLoginKeyboardOpen] = useState(false);

  // Gtt the path user was trying to access, or default to dashboard
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    '/dashboard';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setError(null);
    setLoading(true);
    setLoadingMessage('Authenticating user...');

    try {
      const res = await login(formData);

      console.log(
        'login resposne from client side',
        JSON.stringify(res, null, 2),
      );
      if (res?.message?.success_key === 1) {
        const token = res?.message?.token;
        const userId = userIdFromLoginMessage(res.message) ?? undefined;

        if (token) {
          await window.app_config.save('auth_token', String(token));
        }
        if (userId) {
          await window.app_config.save('auth_user', userId);
        }

        if (userId && token) {
          // Sync all application data after successful login before mounting dashboard
          try {
            setLoadingMessage(
              'Downloading products, customers, payment modes, and settings...',
            );
            console.log('Syncing application data...');
            await window.dataSync.sync();
            console.log('Data sync completed successfully');
          } catch (syncError) {
            console.error('Data sync failed:', syncError);
            // Continue to dashboard even if sync fails
          }

          // Fetch receipt templates for client-side printing (non-blocking)
          fetchAndCacheAllTemplates()
            .then(() => console.log('Receipt templates cached'))
            .catch((err) =>
              console.warn('Failed to cache receipt templates:', err),
            );

          setAuthUser(userId);

          navigate(from === '/dashboard' ? '/dashboard' : from, {
            replace: true,
          });
        } else {
          setError(
            !token
              ? 'Login succeeded but no auth token was returned.'
              : 'Login successful but user information not found.',
          );
        }
      } else {
        const errorMessage =
          res?.message?.message ||
          'Login failed. Please check your credentials.';
        setError(errorMessage);
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'An error occurred during login. Please try again.';
      setError(errorMessage);
      console.error('Login error:', error);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleChangeENV = async (backendUrl: string) => {
    // Save new backend URL first (persists to config.json, survives DB deletion)
    await window.app_config.save('backendUrl', backendUrl);
    console.log('[Login] Backend URL saved:', backendUrl);

    setEnvModalVisible(false);

    // Small delay to ensure file write completes
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Delete all database files and restart app (complete reset)
    try {
      await window.dataSync.deleteDBFilesAndRestart();
      // App will restart automatically, no need for manual reload
    } catch (err) {
      console.error('Failed to delete database files and restart:', err);
      // Fallback: just reload
      window.location.reload();
    }
  };

  useEffect(() => {
    const fetchCurrentBackEndUrl = async () => {
      const result = await window.app_config.get('backendUrl');
      setCurrentBackendUrl(result || '');
      if (!result) {
        setEnvModalVisible(true);
      }
    };

    fetchCurrentBackEndUrl();
  }, []);

  return (
    <>
      <div className="login-container">
        <div className="login-card">
          <aside className="logo-section">
            <div className="brand-mark">
              <span className="brand-dot">A</span>
              <span className="brand-name">Aiwa POS</span>
            </div>

            <div className="brand-hero" aria-hidden>
              <div className="receipt-card">
                <div className="receipt-card__header">
                  <span className="receipt-brand">AIWA POS</span>
                  <span className="receipt-id">#0042</span>
                </div>
                <div className="receipt-card__lines">
                  <div className="receipt-line">
                    <span>Espresso</span>
                    <span>$3.50</span>
                  </div>
                  <div className="receipt-line">
                    <span>Croissant</span>
                    <span>$4.20</span>
                  </div>
                  <div className="receipt-line">
                    <span>Iced Latte</span>
                    <span>$5.00</span>
                  </div>
                </div>
                <div className="receipt-card__total">
                  <span>Total</span>
                  <span>$12.70</span>
                </div>
                <div className="receipt-card__barcode" />
              </div>
            </div>

            <h2 className="brand-tagline">
              Powering Modern{' '}
              <span className="brand-tagline__accent">Commerce</span>
            </h2>
          </aside>

          <section className="login-panel">
            <div className="login-header">
              <h2>Login to your account</h2>
              <p>
                Sign in to manage sales, inventory, customers, and payments —
                from anywhere in the store.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="login-form">
                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    type="text"
                    id="username"
                    value={formData.username}
                    onChange={handleChange}
                    onKeyDown={handleKeyPress}
                    placeholder="Enter your username"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <div className="password-input-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      value={formData.password}
                      onChange={handleChange}
                      onKeyDown={handleKeyPress}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Please wait...' : 'Login'}
                </button>

                <div className="login-form__divider">
                  <span>or</span>
                </div>

                <OnScreenKeyboardToggleButton
                  open={loginKeyboardOpen}
                  onToggle={() => setLoginKeyboardOpen((o) => !o)}
                />

                {loading && (
                  <div
                    className="login-loading-status"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="loading-dot" />
                    <span>
                      {loadingMessage || 'Preparing your session...'}
                    </span>
                  </div>
                )}
              </div>
            </form>

            <p className="login-footer-hint">
              Need to change the backend? Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>
              +<kbd>E</kbd>
            </p>
          </section>
        </div>
        {envModalVisible && (
          <Portal
            onClose={() => setEnvModalVisible(false)}
            modalTitle="Change Backend URL"
          >
            <EnvModal
              onSubmit={handleChangeENV}
              currentUrl={currentBackendUrl}
              onClose={() => setEnvModalVisible(false)}
            />
          </Portal>
        )}
      </div>
      <OnScreenKeyboard
        mode="login"
        settingsEnabled
        manualOpen={loginKeyboardOpen}
        onManualOpenChange={setLoginKeyboardOpen}
      />
    </>
  );
}
