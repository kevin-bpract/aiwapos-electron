import { httpClient, fetchFast } from '../api/http-client';
import { cachedBackendUrl } from '../config';
import { saveProducts, clearPreparedStatements, deleteProductByCode, getProductCount, pruneProductsNotIn } from '../repositories/products';
import {
  saveCustomer,
  clearAllCustomers,
} from '../repositories/customers';
import { savePOSSettings, saveAppConfig, getAppConfig } from '../repositories/settings';
import {
  savePaymentModes,
} from '../repositories/paymentModes';
import { getPOSSettings } from '../api/posSettings';
import { getCompanyDefaultCurrency } from '../api/companySettings';
import { ProductItem } from '../api/products';
import { Customer } from '../../types/customer';
import { ModeOfPayment } from '../api/invoice';
import { getItemGroups } from '../api/itemGroups';
import { saveItemGroups } from '../repositories/itemGroups';
import log from 'electron-log';

// ─── Sync API constants ───────────────────────────────────────────────────────

/** get_items supports limit_start offset pagination — used for full sync with 8 workers */
const GET_ITEMS_API      = '/api/method/pos_api.api.get_items';
/** sync_items supports last_sync delta — used only for incremental (single request, small payload) */
const SYNC_ITEMS_API     = '/api/method/pos_api.api.sync_items';
/** get_customers returns customers list (server handles filtering/rules) */
const GET_CUSTOMERS_API = '/api/method/pos_api.api.get_customers';
const SYNC_STOCK_API     = '/api/method/pos_api.api.sync_stock';

const ITEMS_PAGE_SIZE      = 500;
const ITEMS_CONCURRENCY    = 8;
const LAST_SYNC_ITEMS_KEY     = 'last_sync_items';
// Bump this when we need all clients to run a full reconcile pass (e.g. to
// clear stale products that delta sync never removed).
const ITEMS_RECONCILE_VERSION = '1';
const ITEMS_RECONCILE_KEY     = 'items_reconcile_version';

// ─── Parallel offset-paginated fetcher (get_items / sync_customers) ───────────
/**
 * Fetches all pages in parallel using limit_start offset.
 * Only use with APIs that accept limit_start (not sync_items full mode).
 */
async function fetchOffsetParallel(
  endpoint: string,
  pageSize: number,
  concurrency: number,
  extraParams: Record<string, string> = {},
): Promise<{ items: any[]; deletedKeys: string[]; serverTime: string | null }> {
  const baseUrl = cachedBackendUrl.replace(/\/$/, '');
  const all: any[] = [];
  const allDeleted: string[] = [];
  let nextOffset = 0;
  let noMore = false;
  let serverTime: string | null = null;

  async function worker(): Promise<void> {
    while (!noMore) {
      const offset = nextOffset;
      nextOffset += pageSize;
      const params = new URLSearchParams({
        limit_page_length: String(pageSize),
        limit_start: String(offset),
        ...extraParams,
      });
      const url = `${baseUrl}${endpoint}?${params.toString()}`;
      const data = await fetchFast<any>(url);
      const msg = data?.message;
      const page: any[] =
        (Array.isArray(msg) ? msg : null) ??
        msg?.items ??
        msg?.customers ??
        msg?.data ??
        [];
      all.push(...page);
      if (msg?.server_time && !serverTime) serverTime = msg.server_time;
      const del: string[] = msg?.deleted_items ?? msg?.deleted_customers ?? [];
      if (del.length > 0) allDeleted.push(...del);
      if (page.length < pageSize) {
        noMore = true;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { items: all, deletedKeys: allDeleted, serverTime };
}

// ─── Items: full once (persisted), then delta on startup ───────────────────────
// Products are stored in a persistent DB file. First run or empty DB: full sync.
// Later runs: only fetch changes via sync_items (last_sync).
async function syncItems(): Promise<void> {
  const lastSync = getAppConfig(LAST_SYNC_ITEMS_KEY) || null;
  const productCount = getProductCount();
  const hasLocalProducts = productCount > 0;
  const reconcileVersion = getAppConfig(ITEMS_RECONCILE_KEY) || null;
  const needsReconcile = reconcileVersion !== ITEMS_RECONCILE_VERSION;

  if (lastSync && hasLocalProducts && !needsReconcile) {
    log.info(`Items: using delta sync (last_sync found, ${productCount} products in DB)`);
    await syncItemsDelta(lastSync);
  } else {
    log.info(
      `Items: using full sync (${
        !lastSync ? 'no last_sync' : !hasLocalProducts ? 'empty DB' : 'reconcile required'
      })`,
    );
    await syncItemsFullParallel();
    saveAppConfig(ITEMS_RECONCILE_KEY, ITEMS_RECONCILE_VERSION);
  }
}

/** Fetch only changed items since last_sync; apply and save new server_time */
async function syncItemsDelta(lastSync: string): Promise<void> {
  const t = Date.now();
  log.info(`Syncing items delta since ${lastSync}...`);
  const baseUrl = cachedBackendUrl.replace(/\/$/, '');
  let allItems: ProductItem[] = [];
  let allDeleted: string[] = [];
  let serverTime: string | null = null;
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      last_sync: lastSync,
      limit_page_length: String(ITEMS_PAGE_SIZE),
      limit_start: String(offset),
    });
    const data = await fetchFast<any>(`${baseUrl}${SYNC_ITEMS_API}?${params.toString()}`);
    const msg = data?.message ?? {};
    const page: ProductItem[] = msg.items ?? [];
    const deleted: string[] = msg.deleted_items ?? [];
    allItems = allItems.concat(page);
    allDeleted = allDeleted.concat(deleted);
    if (msg.server_time) serverTime = msg.server_time;
    if (!msg.has_more || page.length === 0) break;
    offset =
      typeof msg.next_offset === 'number'
        ? msg.next_offset
        : offset + ITEMS_PAGE_SIZE;
  }

  for (const code of allDeleted) deleteProductByCode(code);
  if (allItems.length > 0) saveProducts(allItems);
  if (serverTime) saveAppConfig(LAST_SYNC_ITEMS_KEY, serverTime);
  log.info(`✅ Items delta: ${allItems.length} updated, ${allDeleted.length} deleted in ${Date.now() - t}ms`);
}

/** Full catalog fetch (first run or empty DB); save server_time for future deltas */
async function syncItemsFullParallel(startTime = Date.now()): Promise<void> {
  log.info(`Fetching all items via get_items (${ITEMS_CONCURRENCY} workers, ${ITEMS_PAGE_SIZE}/page)...`);
  const { items } = await fetchOffsetParallel(
    GET_ITEMS_API,
    ITEMS_PAGE_SIZE,
    ITEMS_CONCURRENCY,
  );
  saveProducts(items as ProductItem[]);

  // Reconcile: drop any local item_codes not present in the authoritative full response.
  // Guard against an unexpectedly empty payload so a bad network run can't wipe the DB.
  if (items.length > 0) {
    const keep = (items as ProductItem[])
      .map((p) => p.item_code)
      .filter((c): c is string => typeof c === 'string' && c.length > 0);
    const pruned = pruneProductsNotIn(keep);
    if (pruned > 0) log.info(`🧹 Pruned ${pruned} stale products not present in backend`);
  } else {
    log.warn('Skipping prune: full sync returned 0 items');
  }

  try {
    const syncData = await fetchFast<any>(
      `${cachedBackendUrl.replace(/\/$/, '')}${SYNC_ITEMS_API}?limit_page_length=1`,
    );
    const st = syncData?.message?.server_time;
    if (st) saveAppConfig(LAST_SYNC_ITEMS_KEY, st);
  } catch {
    // non-fatal
  }
  log.info(`✅ Items full sync: ${items.length} upserted in ${Date.now() - startTime}ms`);
}

// ─── Customers (full refresh via get_customers) ───────────────────────────────
async function syncCustomers(): Promise<void> {
  log.info('Syncing customers (full via get_customers)...');
  const t = Date.now();

  const url = `${cachedBackendUrl.replace(/\/$/, '')}${GET_CUSTOMERS_API}`;
  const data = await fetchFast<any>(url);
  const customers: Customer[] =
    data?.message?.customers && Array.isArray(data.message.customers)
      ? (data.message.customers as Customer[])
      : [];

  // Replace local customers to avoid stale/removed records lingering.
  clearAllCustomers();
  for (const c of customers) saveCustomer(c);
  log.info(`✅ Customers synced: ${customers.length} upserted in ${Date.now() - t}ms`);
}

// ─── Stock (lightweight, no delta key needed) ─────────────────────────────────
async function syncStock(): Promise<void> {
  log.info('Syncing stock...');
  const t = Date.now();
  const url = `${cachedBackendUrl.replace(/\/$/, '')}${SYNC_STOCK_API}`;
  const data = await fetchFast<any>(url);
  const stock: { item_code: string; actual_qty: number }[] = data?.message?.stock ?? [];
  if (stock.length > 0) {
    const { updateProductStock } = require('../repositories/products');
    for (const s of stock) updateProductStock(s.item_code, s.actual_qty);
    log.info(`✅ Stock synced: ${stock.length} items in ${Date.now() - t}ms`);
  }
}

/**
 * Fetch all payment modes from the API
 */
async function fetchAllPaymentModes(): Promise<{ modes: ModeOfPayment[]; defaultMode: string | null }> {
  try {
    log.info('Fetching all payment modes from API...');

    const res = await httpClient.get(
      `${cachedBackendUrl}/api/method/pos_api.api.get_mode_of_payments`,
      {
        withCredentials: true,
      },
    );

    let paymentModes: ModeOfPayment[] = [];
    let defaultMode: string | null = null;

    // Handle different response structures
    if (res.data?.message?.payment_modes && Array.isArray(res.data.message.payment_modes)) {
      paymentModes = res.data.message.payment_modes;
      defaultMode = res.data.message.user_mode_of_payment || null;
    } else if (res.data?.payment_modes && Array.isArray(res.data.payment_modes)) {
      paymentModes = res.data.payment_modes;
      defaultMode = res.data.user_mode_of_payment || null;
    }

    log.info(`Fetched ${paymentModes.length} payment modes from API (default: ${defaultMode || 'none'})`);
    return { modes: paymentModes, defaultMode };
  } catch (error) {
    log.error('Error fetching payment modes:', error);
    throw error;
  }
}

/**
 * Sync all data from the API to local database.
 * Runs at application startup. Uses delta sync when last_sync timestamps exist.
 */
export async function syncAllData(): Promise<void> {
  try {
    log.info('Starting data sync...');
    clearPreparedStatements();

    // Products (items) — full or delta
    try {
      await syncItems();
    } catch (error) {
      log.error('Failed to sync items:', error);
    }

    // Customers — full or delta
    try {
      await syncCustomers();
    } catch (error) {
      log.error('Failed to sync customers:', error);
    }

    // POS settings
    try {
      const settings = await getPOSSettings();
      savePOSSettings(settings);
      log.info('✅ Synced POS settings');
    } catch (error) {
      log.error('Failed to sync POS settings:', error);
    }

    // Payment modes (replace local set to avoid stale/removed modes lingering)
    try {
      const { modes: paymentModes, defaultMode } = await fetchAllPaymentModes();
      const { clearAllPaymentModes } = require('../repositories/paymentModes');
      clearAllPaymentModes();
      savePaymentModes(paymentModes);
      if (defaultMode) {
        const { saveDefaultPaymentMode } = require('../repositories/paymentModes');
        saveDefaultPaymentMode(defaultMode);
      }
      log.info(`✅ Synced ${paymentModes.length} payment modes (default: ${defaultMode || 'none'})`);
    } catch (error) {
      log.error('Failed to sync payment modes:', error);
    }

    // Item groups
    try {
      const itemGroups = await getItemGroups();
      saveItemGroups(itemGroups);
      log.info(`✅ Synced ${itemGroups.length} item groups`);
    } catch (error) {
      log.error('Failed to sync item groups:', error);
    }

    // Company settings
    try {
      const companySettings = await getCompanyDefaultCurrency();
      saveAppConfig('default_currency', companySettings.default_currency);
      saveAppConfig('company_name', companySettings.company);
      saveAppConfig('company_country', companySettings.country);
      saveAppConfig('company_abbr', companySettings.abbr);
      log.info(`✅ Synced company settings (currency: ${companySettings.default_currency})`);
    } catch (error) {
      log.error('Failed to sync company settings:', error);
    }

    log.info('✅ Data sync completed');
  } catch (error) {
    log.error('Error during data sync:', error);
    throw error;
  }
}

/**
 * Lightweight stock refresh — call periodically (every 2–5 min) after initial sync.
 */
export async function syncStockOnly(): Promise<void> {
  try {
    await syncStock();
  } catch (error) {
    log.error('Failed to sync stock:', error);
  }
}

/**
 * Check if we have data in local database
 */
export function hasLocalData(): boolean {
  const { getAllProductsList } = require('../repositories/products');
  const products = getAllProductsList();
  return products.length > 0;
}
