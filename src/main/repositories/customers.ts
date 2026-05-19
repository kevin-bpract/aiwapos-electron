import { Customer } from '../../types/customer';
import db from '../db/db';

// Lazy initialization - prepare statements only when first used
let UPSERT_CUSTOMERS: ReturnType<typeof db.prepare> | null = null;
let LIST_CUSTOMERS: ReturnType<typeof db.prepare> | null = null;
let DELETE_ALL_CUSTOMERS: ReturnType<typeof db.prepare> | null = null;

function getUpsertCustomers() {
  if (!UPSERT_CUSTOMERS) {
    UPSERT_CUSTOMERS = db.prepare(`
      INSERT INTO customers (
        name,
        customer_name,
        mobile_no,
        tax_id,
        custom_crn_no,
        customer_group,
        territory,
        extra_data,
        custom_is_default_customer
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        customer_name = excluded.customer_name,
        mobile_no = excluded.mobile_no,
        tax_id = excluded.tax_id,
        custom_crn_no = excluded.custom_crn_no,
        customer_group = excluded.customer_group,
        territory = excluded.territory,
        extra_data = excluded.extra_data,
        custom_is_default_customer = excluded.custom_is_default_customer
    `);
  }
  return UPSERT_CUSTOMERS;
}

function getListCustomers() {
  if (!LIST_CUSTOMERS) {
    LIST_CUSTOMERS = db.prepare(`SELECT * FROM customers`);
  }
  return LIST_CUSTOMERS;
}

function getDeleteAllCustomers() {
  if (!DELETE_ALL_CUSTOMERS) {
    DELETE_ALL_CUSTOMERS = db.prepare(`DELETE FROM customers`);
  }
  return DELETE_ALL_CUSTOMERS;
}

/** Returns customers with extra_data parsed and merged so email_id, custom_customer_arabic_name etc. are top-level */
export function getCustomerList(): Customer[] {
  const rows = getListCustomers().all() as Record<string, unknown>[];
  return rows.map((row) => {
    const extra =
      row.extra_data != null
        ? typeof row.extra_data === 'string'
          ? (JSON.parse(row.extra_data as string) as Record<string, unknown>)
          : (row.extra_data as Record<string, unknown>)
        : {};
    return { ...row, ...extra, extra_data: extra } as Customer;
  });
}

export function saveCustomer(customer: Customer) {
  // Merge fields that don't have dedicated DB columns into extra_data
  // so they survive sync round-trips (email_id, custom_customer_arabic_name, disabled)
  const extra: Record<string, any> = {
    ...(customer.extra_data && typeof customer.extra_data === 'object' ? customer.extra_data : {}),
  };
  if (customer.email_id !== undefined) extra.email_id = customer.email_id;
  if (customer.custom_customer_arabic_name !== undefined) extra.custom_customer_arabic_name = customer.custom_customer_arabic_name;
  if (customer.disabled !== undefined) extra.disabled = customer.disabled;

  getUpsertCustomers().run(
    customer.name,
    customer.customer_name ?? null,
    customer.mobile_no ?? null,
    customer.tax_id ?? null,
    customer.custom_crn_no ?? null,
    customer.customer_group ?? null,
    customer.territory ?? null,
    JSON.stringify(extra),
    customer.custom_is_default_customer ?? 0
  );
}

export function clearAllCustomers(): void {
  getDeleteAllCustomers().run();
}

export function deleteCustomerByName(name: string): void {
  db.prepare('DELETE FROM customers WHERE name = ?').run(name);
}

export function getCustomerCount(): number {
  const row = db.prepare('SELECT COUNT(1) AS c FROM customers').get() as
    | { c: number }
    | undefined;
  return row?.c ?? 0;
}
