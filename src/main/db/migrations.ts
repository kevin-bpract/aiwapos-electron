import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database) {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT
    )
  `,
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS grid_preferences (
      view TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `,
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS customers (
      name TEXT PRIMARY KEY,
      customer_name TEXT,
      mobile_no TEXT,
      tax_id TEXT,
      custom_crn_no TEXT,
      email_id TEXT,
      customer_group TEXT,
      territory TEXT,
      extra_data TEXT,
      custom_is_default_customer INTEGER DEFAULT 0
    )
  `,
  ).run();

  // Migration: Add custom_crn_no column to customers table if it doesn't exist
  try {
    db.prepare(`ALTER TABLE customers ADD COLUMN custom_crn_no TEXT`).run();
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add custom_is_default_customer column to customers table if it doesn't exist
  try {
    db.prepare(`ALTER TABLE customers ADD COLUMN custom_is_default_customer INTEGER DEFAULT 0`).run();
  } catch (e) {
    // Column already exists, ignore
  }

  // Products table with all fields from API response
  db.prepare(
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

  // Create index for faster lookups
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_products_item_name ON products(item_name)`,
  ).run();
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_products_disabled ON products(disabled)`,
  ).run();

  // Sales history table
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS sales_history (
      invoice_name TEXT NOT NULL,
      customer TEXT,
      customer_name TEXT,
      posting_date TEXT,
      invoice_total REAL DEFAULT 0,
      is_pos INTEGER DEFAULT 0,
      item_code TEXT NOT NULL,
      item_name TEXT,
      qty REAL DEFAULT 0,
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      uom TEXT,
      warehouse TEXT,
      discount_percentage REAL DEFAULT 0,
      extra_data TEXT,
      PRIMARY KEY (invoice_name, item_code)
    )
  `,
  ).run();

  // Create indexes for faster lookups
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_sales_history_invoice ON sales_history(invoice_name)`,
  ).run();
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_sales_history_customer ON sales_history(customer_name)`,
  ).run();
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_sales_history_date ON sales_history(posting_date)`,
  ).run();

  // Carts table
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_code TEXT,
      customer_name TEXT,
      charges REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      total REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  // Cart items table
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      product_code TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      barcode TEXT,
      description TEXT,
      unit TEXT,
      inclusive_tax INTEGER DEFAULT 0,
      inclusive_price REAL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      batch TEXT,
      expiry TEXT,
      notes TEXT,
      FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE
    )
  `,
  ).run();

  // Create indexes for cart items
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id)`,
  ).run();
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_cart_items_item_id ON cart_items(item_id)`,
  ).run();

  // Migration: Add historical price columns to products table if they don't exist
  try {
    db.prepare(`ALTER TABLE products ADD COLUMN last_purchase_price REAL`).run();
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.prepare(`ALTER TABLE products ADD COLUMN last_purchase_cost REAL`).run();
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.prepare(`ALTER TABLE products ADD COLUMN last_sale_price REAL`).run();
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.prepare(`ALTER TABLE products ADD COLUMN last_sale_to_customer REAL`).run();
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add custom_item_tag_list column to products table if it doesn't exist
  try {
    db.prepare(`ALTER TABLE products ADD COLUMN custom_item_tag_list TEXT`).run();
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add custom_is_favorite column to products table if it doesn't exist
  try {
    db.prepare(`ALTER TABLE products ADD COLUMN custom_is_favorite INTEGER DEFAULT 0`).run();
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add available_uoms column to cart_items table if it doesn't exist
  try {
    db.prepare(`ALTER TABLE cart_items ADD COLUMN available_uoms TEXT`).run();
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add prices column to cart_items table if it doesn't exist
  try {
    db.prepare(`ALTER TABLE cart_items ADD COLUMN prices TEXT`).run();
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add max_discount_percent column to cart_items table if it doesn't exist
  try {
    db.prepare(`ALTER TABLE cart_items ADD COLUMN max_discount_percent REAL`).run();
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add max_discount_amount column to cart_items table if it doesn't exist
  try {
    db.prepare(`ALTER TABLE cart_items ADD COLUMN max_discount_amount REAL`).run();
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add description_arabic for bilingual cart display (restaurant / POS)
  try {
    db.prepare(`ALTER TABLE cart_items ADD COLUMN description_arabic TEXT`).run();
  } catch (e) {
    // Column already exists, ignore
  }

  // Payment modes table
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS payment_modes (
      name TEXT PRIMARY KEY,
      type TEXT NOT NULL
    )
  `,
  ).run();

  // Item Groups table
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS item_groups (
      name TEXT PRIMARY KEY,
      parent_item_group TEXT,
      image TEXT,
      custom_is_favorite_group INTEGER DEFAULT 0,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();
}
