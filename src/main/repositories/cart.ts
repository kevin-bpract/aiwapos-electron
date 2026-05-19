import db from '../db/db';

export interface CartItem {
  id: string;
  product_code: string;
  quantity: number;
  barcode: string;
  description: string;
  description_arabic?: string | null;
  unit: string;
  inclusive_tax: number;
  inclusive_price: number;
  unit_price: number;
  tax_rate: number;
  discount_percent: number;
  discount_amount: number;
  batch?: string;
  expiry?: string;
  notes?: string;
  available_uoms?: string;
  prices?: string;
  max_discount_percent?: number;
  max_discount_amount?: number;
}

export interface Cart {
  id?: number;
  customer_code?: string;
  customer_name?: string;
  items: CartItem[];
  charges: number;
  discount: number;
  discount_percent: number;
  total: number;
  created_at?: string;
  updated_at?: string;
}

// Lazy initialization - prepare statements only when first used
let INSERT_CART: ReturnType<typeof db.prepare> | null = null;
let UPDATE_CART: ReturnType<typeof db.prepare> | null = null;
let GET_CART: ReturnType<typeof db.prepare> | null = null;
let DELETE_CART: ReturnType<typeof db.prepare> | null = null;
let INSERT_CART_ITEM: ReturnType<typeof db.prepare> | null = null;
let DELETE_CART_ITEMS: ReturnType<typeof db.prepare> | null = null;
let GET_CART_ITEMS: ReturnType<typeof db.prepare> | null = null;
let DELETE_CART_ITEM: ReturnType<typeof db.prepare> | null = null;

function getInsertCart() {
  if (!INSERT_CART) {
    INSERT_CART = db.prepare(`
      INSERT INTO carts (
        customer_code,
        customer_name,
        charges,
        discount,
        discount_percent,
        total
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);
  }
  return INSERT_CART;
}

function getUpdateCart() {
  if (!UPDATE_CART) {
    UPDATE_CART = db.prepare(`
      UPDATE carts SET
        customer_code = ?,
        customer_name = ?,
        charges = ?,
        discount = ?,
        discount_percent = ?,
        total = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
  }
  return UPDATE_CART;
}

function getGetCart() {
  if (!GET_CART) {
    GET_CART = db.prepare(`SELECT * FROM carts WHERE id = ?`);
  }
  return GET_CART;
}

function getDeleteCart() {
  if (!DELETE_CART) {
    DELETE_CART = db.prepare(`DELETE FROM carts WHERE id = ?`);
  }
  return DELETE_CART;
}

function getInsertCartItem() {
  if (!INSERT_CART_ITEM) {
    INSERT_CART_ITEM = db.prepare(`
      INSERT INTO cart_items (
        cart_id,
        item_id,
        product_code,
        quantity,
        barcode,
        description,
        description_arabic,
        unit,
        inclusive_tax,
        inclusive_price,
        unit_price,
        tax_rate,
        discount_percent,
        discount_amount,
        batch,
        expiry,
        notes,
        available_uoms,
        prices,
        max_discount_percent,
        max_discount_amount
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }
  return INSERT_CART_ITEM;
}

function getDeleteCartItems() {
  if (!DELETE_CART_ITEMS) {
    DELETE_CART_ITEMS = db.prepare(`DELETE FROM cart_items WHERE cart_id = ?`);
  }
  return DELETE_CART_ITEMS;
}

function getGetCartItems() {
  if (!GET_CART_ITEMS) {
    GET_CART_ITEMS = db.prepare(`SELECT * FROM cart_items WHERE cart_id = ?`);
  }
  return GET_CART_ITEMS;
}

function getDeleteCartItem() {
  if (!DELETE_CART_ITEM) {
    DELETE_CART_ITEM = db.prepare(`DELETE FROM cart_items WHERE cart_id = ? AND item_id = ?`);
  }
  return DELETE_CART_ITEM;
}

export function saveCart(cart: Cart): number {
  const transaction = db.transaction(() => {
    let cartId = cart.id;

    if (cartId) {
      // Update existing cart
      getUpdateCart().run(
        cart.customer_code ?? null,
        cart.customer_name ?? null,
        cart.charges,
        cart.discount,
        cart.discount_percent ?? 0,
        cart.total,
        cartId,
      );
      
      // Delete existing items
      getDeleteCartItems().run(cartId);
    } else {
      // Insert new cart
      const result = getInsertCart().run(
        cart.customer_code ?? null,
        cart.customer_name ?? null,
        cart.charges,
        cart.discount,
        cart.discount_percent ?? 0,
        cart.total,
      );
      cartId = result.lastInsertRowid as number;
    }

    // Insert cart items
    for (const item of cart.items) {
      getInsertCartItem().run(
        cartId,
        item.id,
        item.product_code,
        item.quantity,
        item.barcode,
        item.description,
        item.description_arabic ?? null,
        item.unit,
        item.inclusive_tax ? 1 : 0,
        item.inclusive_price,
        item.unit_price,
        item.tax_rate ?? 0,
        item.discount_percent ?? 0,
        item.discount_amount ?? 0,
        item.batch ?? null,
        item.expiry ?? null,
        item.notes ?? null,
        item.available_uoms ?? null,
        item.prices ?? null,
        item.max_discount_percent ?? null,
        item.max_discount_amount ?? null,
      );
    }

    return cartId;
  });

  return transaction();
}

export function getCart(cartId: number): Cart | null {
  const cartRow = getGetCart().get(cartId) as any;
  if (!cartRow) return null;

  const itemRows = getGetCartItems().all(cartId) as any[];
  
  const items: CartItem[] = itemRows.map((row) => ({
    id: row.item_id,
    product_code: row.product_code,
    quantity: row.quantity,
    barcode: row.barcode,
    description: row.description,
    description_arabic: row.description_arabic ?? null,
    unit: row.unit,
    inclusive_tax: row.inclusive_tax,
    inclusive_price: row.inclusive_price,
    unit_price: row.unit_price,
    tax_rate: row.tax_rate,
    discount_percent: row.discount_percent,
    discount_amount: row.discount_amount,
    batch: row.batch,
    expiry: row.expiry,
    notes: row.notes,
    available_uoms: row.available_uoms,
    prices: row.prices,
    max_discount_percent: row.max_discount_percent,
    max_discount_amount: row.max_discount_amount,
  }));

  return {
    id: cartRow.id,
    customer_code: cartRow.customer_code,
    customer_name: cartRow.customer_name,
    items,
    charges: cartRow.charges,
    discount: cartRow.discount,
    discount_percent: cartRow.discount_percent,
    total: cartRow.total,
    created_at: cartRow.created_at,
    updated_at: cartRow.updated_at,
  };
}

export function deleteCart(cartId: number): void {
  const transaction = db.transaction(() => {
    getDeleteCartItems().run(cartId);
    getDeleteCart().run(cartId);
  });
  transaction();
}

export function deleteCartItem(cartId: number, itemId: string): void {
  getDeleteCartItem().run(cartId, itemId);
}

export function getCurrentCart(): Cart | null {
  // Get the most recent cart
  const result = db.prepare(`
    SELECT * FROM carts 
    ORDER BY updated_at DESC 
    LIMIT 1
  `).get() as any;

  if (!result) return null;
  
  return getCart(result.id);
}

export function clearCurrentCart(): void {
  const currentCart = getCurrentCart();
  if (currentCart && currentCart.id) {
    deleteCart(currentCart.id);
  }
}
