export interface LoginPayload {
  username: string;
  password: string;
}

/** Response shape from `pos_api.api.pos_login` (message is Frappe-wrapped in IPC return). */
export interface LoginResponse {
  message?: {
    success_key?: number;
    token?: string;
    user_id?: string;
    email?: string;
    /** API may return a string or `{ email, full_name, user_image }` */
    user?: string | { email?: string; full_name?: string; user_image?: string | null };
    message?: string;
  };
}

async function clearStoredAuth(): Promise<void> {
  try {
    await window.app_config.save('auth_token', '');
    await window.app_config.save('auth_user', '');
    await window.app_config.save('api_key', '');
    await window.app_config.save('api_secret', '');
  } catch (e) {
    console.error('[auth] clearStoredAuth:', e);
  }
}

/** Normalize `message.user` whether the API returns a string or `{ email, ... }`. */
export function userIdFromLoginMessage(
  message: LoginResponse['message'],
): string | null {
  if (!message) return null;
  if (message.user_id) return String(message.user_id);
  if (message.email) return String(message.email);
  const raw = message.user;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'email' in raw && raw.email) {
    return String(raw.email);
  }
  return null;
}

export async function login(data: LoginPayload): Promise<LoginResponse> {
  const res = (await window.api.post(
    'api/method/pos_api.api.pos_login',
    { usr: data.username, pwd: data.password },
    {
      'Content-Type': 'application/json',
    },
  )) as LoginResponse;
  console.log('response from auth.ts', res);
  return res;
}

/**
 * On startup: if we have a stored token, validate it with the server.
 * Returns the logged-in user id/email when valid, otherwise null.
 */
export async function getLoggedUser(): Promise<string | null> {
  try {
    const token = await window.app_config.get('auth_token');
    if (!token) {
      return null;
    }

    const res = await window.api.get(
      `api/method/pos_api.api.pos_validate_token`,
    );

    if (res?.message?.success_key === 1) {
      const fromServer = userIdFromLoginMessage(res.message);
      const stored = await window.app_config.get('auth_user');
      return fromServer || stored || null;
    }

    await clearStoredAuth();
    await window.cookies.clear();
    return null;
  } catch (e) {
    console.error('[auth] pos_validate_token failed:', e);
    // Offline / network error: keep token; allow UI if we already know the user.
    const stored = await window.app_config.get('auth_user');
    const token = await window.app_config.get('auth_token');
    if (token && stored) return stored;
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await window.api.post(
      `/api/method/frappe.auth.logout`,
      '',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    await clearStoredAuth();
    await window.cookies.clear();
  }
}
