import { SalesHistoryItem } from '../../types/salesHistor';
import db from '../db/db';

// Lazy initialization - prepare statements only when first used
let UPSERT_SALES_HISTORY: ReturnType<typeof db.prepare> | null = null;
let LIST_SALES_HISTORY: ReturnType<typeof db.prepare> | null = null;
let CLEAR_SALES_HISTORY: ReturnType<typeof db.prepare> | null = null;

function getUpsertSalesHistory() {
  if (!UPSERT_SALES_HISTORY) {
    UPSERT_SALES_HISTORY = db.prepare(`
      INSERT INTO sales_history (
        invoice_name,
        customer,
        customer_name,
        posting_date,
        invoice_total,
        is_pos,
        item_code,
        item_name,
        qty,
        rate,
        amount,
        uom,
        warehouse,
        discount_percentage,
        extra_data
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(invoice_name, item_code) DO UPDATE SET
        customer = excluded.customer,
        customer_name = excluded.customer_name,
        posting_date = excluded.posting_date,
        invoice_total = excluded.invoice_total,
        is_pos = excluded.is_pos,
        item_name = excluded.item_name,
        qty = excluded.qty,
        rate = excluded.rate,
        amount = excluded.amount,
        uom = excluded.uom,
        warehouse = excluded.warehouse,
        discount_percentage = excluded.discount_percentage,
        extra_data = excluded.extra_data
    `);
  }
  return UPSERT_SALES_HISTORY;
}

function getListSalesHistory() {
  if (!LIST_SALES_HISTORY) {
    LIST_SALES_HISTORY = db.prepare(`
      SELECT * FROM sales_history
      ORDER BY posting_date DESC, invoice_name
    `);
  }
  return LIST_SALES_HISTORY;
}

function getClearSalesHistory() {
  if (!CLEAR_SALES_HISTORY) {
    CLEAR_SALES_HISTORY = db.prepare(`DELETE FROM sales_history`);
  }
  return CLEAR_SALES_HISTORY;
}

export function getSalesHistoryList(): SalesHistoryItem[] {
  return getListSalesHistory().all() as SalesHistoryItem[];
}

export function saveSalesHistory(salesItem: SalesHistoryItem) {
  getUpsertSalesHistory().run(
    salesItem.invoice_name,
    salesItem.customer ?? null,
    salesItem.customer_name ?? null,
    salesItem.posting_date ?? null,
    salesItem.invoice_total ?? null,
    salesItem.is_pos ?? null,
    salesItem.item_code,
    salesItem.item_name ?? null,
    salesItem.qty ?? null,
    salesItem.rate ?? null,
    salesItem.amount ?? null,
    salesItem.uom ?? null,
    salesItem.warehouse ?? null,
    salesItem.discount_percentage ?? null,
    salesItem.extra_data ? JSON.stringify(salesItem.extra_data) : null,
  );
}

export function clearSalesHistory() {
  getClearSalesHistory().run();
}

export function saveSalesHistoryBatch(salesHistory: SalesHistoryItem[]) {
  const upsert = getUpsertSalesHistory();
  db.transaction(() => {
    for (const item of salesHistory) {
      saveSalesHistory(item);
    }
  })();
}
