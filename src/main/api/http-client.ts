import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { CookieJar, Cookie } from 'tough-cookie';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { logRequest, logResponse, logError } from '../utils/logger';
import { getAppConfig, saveAppConfig } from '../repositories/settings';

// Create a persistent cookie jar file path
const cookieJarPath = path.join(app.getPath('userData'), 'cookies.json');

// Create cookie jar
const cookieJar = new CookieJar();

// Load cookies from disk if they exist
if (fs.existsSync(cookieJarPath)) {
  try {
    const cookieData = fs.readFileSync(cookieJarPath, 'utf-8');
    const cookies = JSON.parse(cookieData);
    // Restore cookies to jar
    cookies.forEach((cookieData: any) => {
      const cookie = Cookie.fromJSON(cookieData);
      if (cookie) {
        const domain = cookie.domain || 'electronpos.tbo365.cloud';
        const url = `https://${domain}`;
        cookieJar.setCookieSync(cookie, url);
      }
    });
  } catch (error) {
    console.error('Error loading cookies:', error);
  }
}

// Save cookies to disk
const saveCookies = async (url: string) => {
  try {
    const cookies = await cookieJar.getCookies(url);
    const cookieData = cookies.map((cookie) => cookie.toJSON());
    fs.writeFileSync(cookieJarPath, JSON.stringify(cookieData, null, 2));
  } catch (error) {
    console.error('Error saving cookies:', error);
  }
};

// Get cookie string for a URL (exported for native fetch path)
export const getCookieString = async (url: string): Promise<string> => {
  try {
    const cookies = await cookieJar.getCookies(url);
    return cookies.map((cookie) => cookie.cookieString()).join('; ');
  } catch {
    return '';
  }
};

// Create axios instance
export const httpClient: AxiosInstance = axios.create({
  withCredentials: true,
  // Allow axios to decompress responses automatically
});

/** Login must not send API token or stale session cookies — server returns 401 (same as bare Postman/curl). */
export function isAuthLoginUrl(url: string | undefined): boolean {
  if (!url) return false;
  return (
    /[/]api[/]method[/]pos_api\.api\.pos_login/i.test(url) ||
    /[/]api[/]method[/]pos_api\.auth\.user_login/i.test(url) ||
    /[/]api[/]method[/]frappe\.auth\.login/i.test(url)
  );
}

// Intercept requests to strip problematic headers and add cookies
httpClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Strip Expect header (causes 417 errors on some servers)
    delete config.headers.Expect;
    delete config.headers.expect;

    // Force Accept-Encoding to only gzip and deflate (no brotli)
    config.headers['Accept-Encoding'] = 'gzip, deflate';

    const fullUrl = config.url || '';
    const loginOnly = isAuthLoginUrl(fullUrl);

    if (!loginOnly) {
      const authToken = getAppConfig('auth_token');
      if (authToken) {
        // POS token auth — no Cookie header (avoids long-running session / circular JSON issues)
        config.headers.Authorization = `token ${authToken}`;
      } else {
        const apiKey = getAppConfig('api_key');
        const apiSecret = getAppConfig('api_secret');
        if (apiKey && apiSecret) {
          config.headers.Authorization = `token ${apiKey}:${apiSecret}`;
        }
      }
    } else {
      delete config.headers.Authorization;
      delete config.headers.Cookie;
    }

    // Session cookies only for legacy api_key login paths (no auth_token)
    if (config.url && !loginOnly && !getAppConfig('auth_token')) {
      const cookieString = await getCookieString(config.url);
      if (cookieString) {
        config.headers.Cookie = cookieString;
      }
    }

    // Log the outgoing request
    logRequest({
      method: config.method,
      url: config.url,
      headers: config.headers,
      data: config.data,
    });

    return config;
  },
  (error) => {
    logError(error);
    return Promise.reject(error);
  },
);

// Intercept responses to save cookies and log responses
httpClient.interceptors.response.use(
  async (response) => {
    // Log the response
    logResponse({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config: response.config,
      data: response.data,
    });

    // Extract cookies from Set-Cookie headers
    const setCookieHeaders =
      response.headers['set-cookie'] || response.headers['set-cookie'] || [];
    const cookieHeaders = Array.isArray(setCookieHeaders)
      ? setCookieHeaders
      : [setCookieHeaders];

    if (cookieHeaders.length > 0 && response.config.url) {
      const url = new URL(response.config.url);
      for (const cookieHeader of cookieHeaders) {
        if (cookieHeader) {
          try {
            const cookie = Cookie.parse(cookieHeader);
            if (cookie) {
              await cookieJar.setCookie(cookie, url.origin);
              // console.log(
              //   'Saved cookie:',
              //   cookie.key,
              //   'for domain:',
              //   url.origin,
              // );
            }
          } catch (error) {
            console.error('Error parsing cookie:', cookieHeader, error);
          }
        }
      }
      await saveCookies(url.origin);
    }
    return response;
  },
  async (error) => {
    // Log the error
    logError(error);

    // Also save cookies on error if response has cookies
    if (error.response?.headers?.['set-cookie'] && error.config?.url) {
      const url = new URL(error.config.url);
      const setCookieHeaders = error.response.headers['set-cookie'];
      const cookieHeaders = Array.isArray(setCookieHeaders)
        ? setCookieHeaders
        : [setCookieHeaders];

      for (const cookieHeader of cookieHeaders) {
        if (cookieHeader) {
          try {
            const cookie = Cookie.parse(cookieHeader);
            if (cookie) {
              await cookieJar.setCookie(cookie, url.origin);
            }
          } catch (parseError) {
            console.error('Error parsing cookie:', parseError);
          }
        }
      }
      await saveCookies(url.origin);
    }

    const status = error.response?.status;
    const reqUrl = error.config?.url as string | undefined;
    if (status === 401) {
      await handleUnauthorizedFromApiCall(reqUrl);
    }

    return Promise.reject(error);
  },
);

/**
 * Fast GET using Node's native fetch (undici) - no axios, no interceptors.
 * Use for large responses (e.g. get_items) where axios is slow and curl is fast.
 */
export async function fetchFast<T = unknown>(url: string): Promise<T> {
  const authToken = getAppConfig('auth_token');
  const apiKey = getAppConfig('api_key');
  const apiSecret = getAppConfig('api_secret');
  const cookieString = authToken ? '' : await getCookieString(url);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };
  if (authToken) {
    headers['Authorization'] = `token ${authToken}`;
  } else if (apiKey && apiSecret) {
    headers['Authorization'] = `token ${apiKey}:${apiSecret}`;
  }
  if (cookieString) {
    headers['Cookie'] = cookieString;
  }
  const res = await fetch(url, { headers });
  if (res.status === 401) {
    await handleUnauthorizedFromApiCall(url);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const clearCookies = async (): Promise<void> => {
  try {
    // Clear in-memory cookie jar
    await new Promise<void>((resolve, reject) => {
      cookieJar.removeAllCookies((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Delete persisted cookie file
    if (fs.existsSync(cookieJarPath)) {
      fs.unlinkSync(cookieJarPath);
    }
  } catch (error) {
    console.error('Error clearing cookies:', error);
  }
};

const UNAUTH_NOTIFY_DEBOUNCE_MS = 2500;
let lastUnauthorizedNotifyAt = 0;
let onUnauthorizedCallback: (() => void) | null = null;

/** Main registers this so the renderer can navigate to login when any API returns 401. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorizedCallback = handler;
}

/**
 * Clear stored credentials and cookies after HTTP 401. Skips login endpoints so bad
 * credentials on sign-in do not trigger a global "session expired" flow.
 */
export async function handleUnauthorizedFromApiCall(
  fullUrl: string | undefined,
): Promise<void> {
  if (!fullUrl || isAuthLoginUrl(fullUrl)) {
    return;
  }

  try {
    saveAppConfig('auth_token', '');
    saveAppConfig('auth_user', '');
    saveAppConfig('api_key', '');
    saveAppConfig('api_secret', '');
  } catch (e) {
    console.error('[httpClient] failed to clear auth on 401', e);
  }

  try {
    await clearCookies();
  } catch (e) {
    console.error('[httpClient] clearCookies on 401', e);
  }

  const now = Date.now();
  if (now - lastUnauthorizedNotifyAt < UNAUTH_NOTIFY_DEBOUNCE_MS) {
    return;
  }
  lastUnauthorizedNotifyAt = now;

  try {
    onUnauthorizedCallback?.();
  } catch (e) {
    console.error('[httpClient] onUnauthorized callback', e);
  }
}
