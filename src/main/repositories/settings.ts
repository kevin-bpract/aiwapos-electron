/*
 * File to store application configuration ( not user settings )
 * Useful for storing App version, Backend url and stuff
 * */

import db from '../db/db';

// Lazy initialization - prepare statements only when first used
let UPSERT_SETTINGS: ReturnType<typeof db.prepare> | null = null;
let APP_CONFIG: ReturnType<typeof db.prepare> | null = null;

function getUpsertSettings() {
  if (!UPSERT_SETTINGS) {
    UPSERT_SETTINGS = db.prepare(`
      INSERT INTO app_config (key,value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value=excluded.value
    `);
  }
  return UPSERT_SETTINGS;
}

function getAppConfigQuery() {
  if (!APP_CONFIG) {
    APP_CONFIG = db.prepare(`SELECT value FROM app_config WHERE key= ? `);
  }
  return APP_CONFIG;
}

export function saveAppConfig(key: string, value: string): void {
  getUpsertSettings().run(key, value);
}

export function getAppConfig(key: string) {
  const row = getAppConfigQuery().get(key);
  return row?.value;
}

/** Remove config keys (e.g. sync cursors after clearAll so next sync is full) */
export function deleteAppConfigKeys(keys: string[]): void {
  if (keys.length === 0) return;
  const ph = keys.map(() => '?').join(',');
  db.prepare(`DELETE FROM app_config WHERE key IN (${ph})`).run(...keys);
}

/**
 * Save POS settings to database
 */
export function savePOSSettings(settings: any): void {
  saveAppConfig('pos_settings', JSON.stringify(settings));
}

/**
 * Get POS settings from database
 */
export function getPOSSettings(): any | null {
  const settingsJson = getAppConfig('pos_settings');
  if (settingsJson) {
    try {
      return JSON.parse(settingsJson as string);
    } catch (error) {
      console.error('Error parsing POS settings:', error);
      return null;
    }
  }
  return null;
}

// Restaurant-only keys so sales/supermarket are not affected
const RESTAURANT_CATEGORY_SORT_KEY = 'restaurant_category_sort_order';
const RESTAURANT_PRODUCT_SORT_KEY = 'restaurant_product_sort_order';
const LEGACY_CATEGORY_SORT_KEY = 'category_sort_order';
const LEGACY_PRODUCT_SORT_KEY = 'product_sort_order';

/**
 * Save category sort order to database (restaurant dashboard only)
 */
export function saveCategorySortOrder(categoryIds: string[]): void {
  saveAppConfig(RESTAURANT_CATEGORY_SORT_KEY, JSON.stringify(categoryIds));
}

/**
 * Get category sort order from database (restaurant dashboard only).
 * Migrates from legacy key if present.
 */
export function getCategorySortOrder(): string[] | null {
  let orderJson = getAppConfig(RESTAURANT_CATEGORY_SORT_KEY);
  if (!orderJson) {
    orderJson = getAppConfig(LEGACY_CATEGORY_SORT_KEY);
    if (orderJson) {
      try {
        const parsed = JSON.parse(orderJson as string);
        saveAppConfig(RESTAURANT_CATEGORY_SORT_KEY, orderJson as string);
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  }
  try {
    return JSON.parse(orderJson as string);
  } catch (error) {
    console.error('Error parsing category sort order:', error);
    return null;
  }
}

/**
 * Save product sort order to database (restaurant dashboard only)
 */
export function saveProductSortOrder(itemCodes: string[]): void {
  saveAppConfig(RESTAURANT_PRODUCT_SORT_KEY, JSON.stringify(itemCodes));
}

/**
 * Get product sort order from database (restaurant dashboard only).
 * Migrates from legacy key if present.
 */
export function getProductSortOrder(): string[] | null {
  let orderJson = getAppConfig(RESTAURANT_PRODUCT_SORT_KEY);
  if (!orderJson) {
    orderJson = getAppConfig(LEGACY_PRODUCT_SORT_KEY);
    if (orderJson) {
      try {
        const parsed = JSON.parse(orderJson as string);
        saveAppConfig(RESTAURANT_PRODUCT_SORT_KEY, orderJson as string);
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  }
  try {
    return JSON.parse(orderJson as string);
  } catch (error) {
    console.error('Error parsing product sort order:', error);
    return null;
  }
}

/**
 * Save printer settings to database
 */
export function savePrinterSettings(settings: {
  printer?: string;
  invoicePrinter?: string;
  kotPrinter?: string;
  useSeparatePrinters?: boolean;
  printerType?: 'pdf' | 'pos';
  posPrinterWidth?: '58mm' | '80mm';
  categoryPrinters?: Record<string, string>;
  autoprint?: boolean;
  printMethod?: 'native' | 'qz-tray' | 'html';
  paperSize?: string;
  invoicePrintFormat?: string;
  orderPrintFormat?: string;
  kotPrintFormat?: string;
  kotPrintFormatSource?: 'client_template' | 'server_print_format';
  scale?: number;
  fontSize?: number;
  /** PDF print scale for Sumatra: "fit" (default) or "noscale" */
  pdfPrintScale?: 'fit' | 'noscale';
  /** When true, print only first page of PDF (e.g. for thermal to get one slip). Default true for 80mm. */
  printFirstPageOnly?: boolean;
  /** Show touch on-screen keyboard on login / restaurant POS when true */
  onScreenKeyboardEnabled?: boolean;
  /** When true, print a separate KOT after invoice/order creation. Default true. */
  kotPrintEnabled?: boolean;
}): void {
  console.log('Saving printer settings:', JSON.stringify(settings, null, 2));
  saveAppConfig('printer_settings', JSON.stringify(settings));
}

/**
 * Get printer settings from database
 */
export function getPrinterSettings(): {
  printer?: string;
  invoicePrinter?: string;
  kotPrinter?: string;
  useSeparatePrinters?: boolean;
  printerType?: 'pdf' | 'pos';
  posPrinterWidth?: '58mm' | '80mm';
  categoryPrinters?: Record<string, string>;
  autoprint?: boolean;
  printMethod?: 'native' | 'qz-tray' | 'html';
  paperSize?: string;
  invoicePrintFormat?: string;
  orderPrintFormat?: string;
  kotPrintFormat?: string;
  kotPrintFormatSource?: 'client_template' | 'server_print_format';
  scale?: number;
  fontSize?: number;
  pdfPrintScale?: 'fit' | 'noscale';
  printFirstPageOnly?: boolean;
  onScreenKeyboardEnabled?: boolean;
  kotPrintEnabled?: boolean;
} | null {
  const settingsJson = getAppConfig('printer_settings');
  if (settingsJson) {
    try {
      const parsed = JSON.parse(settingsJson as string);
      console.log('Retrieved printer settings:', parsed);
      return parsed;
    } catch (error) {
      console.error('Error parsing printer settings:', error);
      return null;
    }
  }
  return null;
}

/** Persisted in SQLite `app_config` under key `on_screen_keyboard_state` */
const ON_SCREEN_KEYBOARD_STATE_KEY = 'on_screen_keyboard_state';

export type OnScreenKeyboardLayoutMode = 'login' | 'restaurant';

export interface OnScreenKeyboardLayoutPersisted {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  scale?: number;
  lang?: 'en' | 'ar';
}

export interface OnScreenKeyboardLayoutSnapshot {
  login?: OnScreenKeyboardLayoutPersisted | null;
  restaurant?: OnScreenKeyboardLayoutPersisted | null;
}

export function getOnScreenKeyboardLayoutSnapshot(): OnScreenKeyboardLayoutSnapshot {
  const raw = getAppConfig(ON_SCREEN_KEYBOARD_STATE_KEY);
  if (!raw || typeof raw !== 'string') return {};
  try {
    const p = JSON.parse(raw) as OnScreenKeyboardLayoutSnapshot;
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

export function saveOnScreenKeyboardLayoutForMode(
  mode: OnScreenKeyboardLayoutMode,
  state: OnScreenKeyboardLayoutPersisted,
): void {
  const prev = getOnScreenKeyboardLayoutSnapshot();
  const next: OnScreenKeyboardLayoutSnapshot = { ...prev, [mode]: state };
  saveAppConfig(ON_SCREEN_KEYBOARD_STATE_KEY, JSON.stringify(next));
}
