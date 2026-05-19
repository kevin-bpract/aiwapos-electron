import db from '../db/db-products';
import { ProductItem } from '../api/products';

// Lazy initialization - prepare statements only when first used
// Force recreation of statements after schema changes
let GET_PRODUCT_BY_CODE: ReturnType<typeof db.prepare> | null = null;
let GET_ALL_PRODUCTS: ReturnType<typeof db.prepare> | null = null;
let GET_PRODUCTS_BY_SEARCH: ReturnType<typeof db.prepare> | null = null;
let UPSERT_PRODUCT: ReturnType<typeof db.prepare> | null = null;
let DELETE_ALL_PRODUCTS: ReturnType<typeof db.prepare> | null = null;

function getProductByCode() {
  if (!GET_PRODUCT_BY_CODE) {
    GET_PRODUCT_BY_CODE = db.prepare(
      'SELECT * FROM products WHERE item_code = ? AND disabled = 0',
    );
  }
  return GET_PRODUCT_BY_CODE;
}

function getAllProducts() {
  if (!GET_ALL_PRODUCTS) {
    GET_ALL_PRODUCTS = db.prepare(
      'SELECT * FROM products WHERE disabled = 0 ORDER BY item_name',
    );
  }
  return GET_ALL_PRODUCTS;
}

function getProductsBySearch() {
  if (!GET_PRODUCTS_BY_SEARCH) {
    GET_PRODUCTS_BY_SEARCH = db.prepare(
      `SELECT DISTINCT p.* FROM products p
       LEFT JOIN json_each(p.barcodes) AS b
       WHERE p.disabled = 0 
       AND (
         p.item_code LIKE ? OR 
         p.item_name LIKE ? OR 
         p.item_name_arabic LIKE ? OR
         p.description LIKE ? OR
         json_extract(b.value, '$.barcode') LIKE ?
       )
       ORDER BY p.item_name
       LIMIT ?`,
    );
  }
  return GET_PRODUCTS_BY_SEARCH;
}

function getUpsertProduct() {
  if (!UPSERT_PRODUCT) {
    UPSERT_PRODUCT = db.prepare(`
      INSERT INTO products (
        item_code, name, item_name, item_name_arabic, item_group, description,
        image, custom_item_tag_list, stock_uom, purchase_uom, sales_uom, standard_rate, current_price,
        price_list, item_tax_template, tax_category, tax_rate,
        last_purchase_price, last_purchase_cost, last_sale_price, last_sale_to_customer,
        warehouse,
        warehouse_stock, total_stock, has_variants, variant_of, is_stock_item,
        is_sales_item, is_purchase_item, has_batch_no, has_serial_no, disabled, custom_is_favorite,
        uoms, prices, item_taxes, stock_by_warehouse, barcodes, synced_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(item_code) DO UPDATE SET
        name = excluded.name,
        item_name = excluded.item_name,
        item_name_arabic = excluded.item_name_arabic,
        item_group = excluded.item_group,
        description = excluded.description,
        image = excluded.image,
        custom_item_tag_list = excluded.custom_item_tag_list,
        stock_uom = excluded.stock_uom,
        purchase_uom = excluded.purchase_uom,
        sales_uom = excluded.sales_uom,
        standard_rate = excluded.standard_rate,
        current_price = excluded.current_price,
        price_list = excluded.price_list,
        item_tax_template = excluded.item_tax_template,
        tax_category = excluded.tax_category,
        tax_rate = excluded.tax_rate,
        last_purchase_price = excluded.last_purchase_price,
        last_purchase_cost = excluded.last_purchase_cost,
        last_sale_price = excluded.last_sale_price,
        last_sale_to_customer = excluded.last_sale_to_customer,
        warehouse = excluded.warehouse,
        warehouse_stock = excluded.warehouse_stock,
        total_stock = excluded.total_stock,
        has_variants = excluded.has_variants,
        variant_of = excluded.variant_of,
        is_stock_item = excluded.is_stock_item,
        is_sales_item = excluded.is_sales_item,
        is_purchase_item = excluded.is_purchase_item,
        has_batch_no = excluded.has_batch_no,
        has_serial_no = excluded.has_serial_no,
        disabled = excluded.disabled,
        custom_is_favorite = excluded.custom_is_favorite,
        uoms = excluded.uoms,
        prices = excluded.prices,
        item_taxes = excluded.item_taxes,
        stock_by_warehouse = excluded.stock_by_warehouse,
        barcodes = excluded.barcodes,
        synced_at = CURRENT_TIMESTAMP
    `);
  }
  return UPSERT_PRODUCT;
}

function getDeleteAllProducts() {
  if (!DELETE_ALL_PRODUCTS) {
    DELETE_ALL_PRODUCTS = db.prepare('DELETE FROM products');
  }
  return DELETE_ALL_PRODUCTS;
}

// Convert database row to ProductItem
function rowToProductItem(row: any): ProductItem {
  return {
    item_code: row.item_code,
    name: row.name,
    item_name: row.item_name,
    item_name_arabic: row.item_name_arabic,
    item_group: row.item_group,
    description: row.description,
    image: row.image,
    custom_item_tag_list: row.custom_item_tag_list
      ? (typeof row.custom_item_tag_list === 'string'
        ? (() => {
          try {
            const parsed = JSON.parse(row.custom_item_tag_list);
            return Array.isArray(parsed) ? parsed : null;
          } catch {
            return null;
          }
        })()
        : Array.isArray(row.custom_item_tag_list)
          ? row.custom_item_tag_list
          : null)
      : null,
    stock_uom: row.stock_uom,
    purchase_uom: row.purchase_uom,
    sales_uom: row.sales_uom,
    standard_rate: row.standard_rate,
    current_price: row.current_price,
    price_list: row.price_list,
    item_tax_template: row.item_tax_template,
    tax_category: row.tax_category,
    tax_rate: row.tax_rate,
    last_purchase_price: row.last_purchase_price,
    last_purchase_cost: row.last_purchase_cost,
    last_sale_price: row.last_sale_price,
    last_sale_to_customer: row.last_sale_to_customer,
    warehouse: row.warehouse,
    warehouse_stock: row.warehouse_stock,
    total_stock: row.total_stock,
    has_variants: row.has_variants,
    variant_of: row.variant_of,
    is_stock_item: row.is_stock_item,
    is_sales_item: row.is_sales_item,
    is_purchase_item: row.is_purchase_item,
    has_batch_no: row.has_batch_no,
    has_serial_no: row.has_serial_no,
    disabled: row.disabled,
    custom_is_favorite: row.custom_is_favorite || 0,
    uoms: row.uoms ? JSON.parse(row.uoms) : [],
    prices: row.prices ? JSON.parse(row.prices) : [],
    item_taxes: row.item_taxes ? JSON.parse(row.item_taxes) : [],
    stock_by_warehouse: row.stock_by_warehouse
      ? JSON.parse(row.stock_by_warehouse)
      : [],
    barcodes: row.barcodes ? JSON.parse(row.barcodes) : [],
  };
}

export function getProduct(itemCode: string): ProductItem | null {
  const row = getProductByCode().get(itemCode) as any;
  if (!row) return null;
  return rowToProductItem(row);
}

export function getAllProductsList(): ProductItem[] {
  const rows = getAllProducts().all() as any[];
  return rows.map(rowToProductItem);
}

export function getProductCount(): number {
  const row = db.prepare('SELECT COUNT(*) AS c FROM products WHERE disabled = 0').get() as { c: number };
  return row?.c ?? 0;
}

export function searchProducts(query: string, limit: number = 100): ProductItem[] {
  const searchTerm = `%${query}%`;
  const rows = getProductsBySearch().all(
    searchTerm,
    searchTerm,
    searchTerm,
    searchTerm,
    searchTerm,
    limit,
  ) as any[];
  return rows.map(rowToProductItem);
}

const PRODUCT_UPSERT_COLUMNS = 38;

function productToUpsertParams(p: ProductItem): (string | number | null)[] {
  return [
    p.item_code,
    p.name || null,
    p.item_name,
    p.item_name_arabic || null,
    p.item_group || null,
    p.description || null,
    p.image || null,
    p.custom_item_tag_list ? JSON.stringify(p.custom_item_tag_list) : null,
    p.stock_uom || null,
    p.purchase_uom || null,
    p.sales_uom || null,
    p.standard_rate ?? 0,
    p.current_price ?? 0,
    p.price_list || null,
    p.item_tax_template || null,
    p.tax_category || null,
    p.tax_rate ?? 0,
    p.last_purchase_price || null,
    p.last_purchase_cost || null,
    p.last_sale_price || null,
    p.last_sale_to_customer || null,
    p.warehouse || null,
    p.warehouse_stock ?? 0,
    p.total_stock ?? 0,
    p.has_variants ?? 0,
    p.variant_of || null,
    p.is_stock_item ?? 0,
    p.is_sales_item ?? 0,
    p.is_purchase_item ?? 0,
    p.has_batch_no ?? 0,
    p.has_serial_no ?? 0,
    p.disabled ?? 0,
    p.custom_is_favorite ?? 0,
    p.uoms ? JSON.stringify(p.uoms) : null,
    p.prices ? JSON.stringify(p.prices) : null,
    p.item_taxes ? JSON.stringify(p.item_taxes) : null,
    p.stock_by_warehouse ? JSON.stringify(p.stock_by_warehouse) : null,
    p.barcodes ? JSON.stringify(p.barcodes) : null,
  ];
}

export function saveProduct(product: ProductItem): void {
  const upsert = getUpsertProduct();
  upsert.run(...productToUpsertParams(product));
}

export function saveProducts(products: ProductItem[]): void {
  if (products.length === 0) return;
  const transaction = db.transaction((items: ProductItem[]) => {
    const upsert = getUpsertProduct();
    for (const p of items) {
      upsert.run(...productToUpsertParams(p));
    }
  });
  transaction(products);
}

export function clearAllProducts(): void {
  getDeleteAllProducts().run();
}

export function getProductByBarcode(barcode: string): ProductItem | null {
  const allProducts = getAllProductsList();
  for (const product of allProducts) {
    // 1. Check if the item_code itself is the barcode
    if (product.item_code === barcode) {
      return product;
    }

    // 2. Search in explicit barcodes JSON array
    if (product.barcodes && Array.isArray(product.barcodes)) {
      const found = product.barcodes.find((b) =>
        typeof b === 'object' && b.barcode === barcode
      );
      if (found) {
        return product;
      }
    }
  }
  return null;
}

export function deleteProductByCode(itemCode: string): void {
  db.prepare('DELETE FROM products WHERE item_code = ?').run(itemCode);
}

export function getAllItemCodes(): string[] {
  const rows = db.prepare('SELECT item_code FROM products').all() as { item_code: string }[];
  return rows.map((r) => r.item_code);
}

// Delete every local product whose item_code is NOT in the provided set.
// Uses a temp table to avoid SQLite's parameter limit (~32k) on large catalogs.
export function pruneProductsNotIn(itemCodes: string[]): number {
  const prune = db.transaction((codes: string[]) => {
    db.prepare('CREATE TEMP TABLE IF NOT EXISTS _keep_codes (item_code TEXT PRIMARY KEY)').run();
    db.prepare('DELETE FROM _keep_codes').run();
    const insert = db.prepare('INSERT OR IGNORE INTO _keep_codes (item_code) VALUES (?)');
    for (const c of codes) insert.run(c);
    const result = db
      .prepare('DELETE FROM products WHERE item_code NOT IN (SELECT item_code FROM _keep_codes)')
      .run();
    db.prepare('DELETE FROM _keep_codes').run();
    return result.changes as number;
  });
  return prune(itemCodes);
}

export function updateProductStock(itemCode: string, actualQty: number): void {
  db.prepare(
    'UPDATE products SET warehouse_stock = ?, total_stock = ? WHERE item_code = ?',
  ).run(actualQty, actualQty, itemCode);
}

export function clearPreparedStatements(): void {
  GET_PRODUCT_BY_CODE = null;
  GET_ALL_PRODUCTS = null;
  GET_PRODUCTS_BY_SEARCH = null;
  UPSERT_PRODUCT = null;
  DELETE_ALL_PRODUCTS = null;
}
