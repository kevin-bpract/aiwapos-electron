/**
 * Persistent SQLite database for products (file on disk).
 * Fetched once via full sync, then updated incrementally via sync_items delta.
 */
import path from 'path';
import { app } from 'electron';
import Database from 'better-sqlite3';

const dbPath = path.join(app.getPath('userData'), 'products.db');
const productsDb = new Database(dbPath);
productsDb.pragma('journal_mode = WAL');
productsDb.pragma('synchronous = NORMAL');
productsDb.pragma('cache_size = -64000');

productsDb.prepare(
  `
  CREATE TABLE IF NOT EXISTS products (
    item_code TEXT PRIMARY KEY,
    name TEXT,
    item_name TEXT NOT NULL,
    item_name_arabic TEXT,
    item_group TEXT,
    description TEXT,
    image TEXT,
    custom_item_tag_list TEXT,
    stock_uom TEXT,
    purchase_uom TEXT,
    sales_uom TEXT,
    standard_rate REAL DEFAULT 0,
    current_price REAL DEFAULT 0,
    price_list TEXT,
    item_tax_template TEXT,
    tax_category TEXT,
    tax_rate REAL DEFAULT 0,
    last_purchase_price REAL,
    last_purchase_cost REAL,
    last_sale_price REAL,
    last_sale_to_customer REAL,
    warehouse TEXT,
    warehouse_stock REAL DEFAULT 0,
    total_stock REAL DEFAULT 0,
    has_variants INTEGER DEFAULT 0,
    variant_of TEXT,
    is_stock_item INTEGER DEFAULT 0,
    is_sales_item INTEGER DEFAULT 0,
    is_purchase_item INTEGER DEFAULT 0,
    has_batch_no INTEGER DEFAULT 0,
    has_serial_no INTEGER DEFAULT 0,
    disabled INTEGER DEFAULT 0,
    custom_is_favorite INTEGER DEFAULT 0,
    uoms TEXT,
    prices TEXT,
    item_taxes TEXT,
    stock_by_warehouse TEXT,
    barcodes TEXT,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`,
).run();
productsDb.prepare('CREATE INDEX IF NOT EXISTS idx_products_item_name ON products(item_name)').run();
productsDb.prepare('CREATE INDEX IF NOT EXISTS idx_products_disabled ON products(disabled)').run();

export default productsDb;
