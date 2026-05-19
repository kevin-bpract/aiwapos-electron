# Aiwa POS — Backend Specification & Implementation Plan

This document is the spec for the Frappe-based backend that the Aiwa POS Electron client talks to. It is derived from a full audit of `src/main/api/`, `src/main/services/`, and `src/renderer/dashboard/restaurant/` in this repository.

The backend will be a custom Frappe app called **`pos_api`**, installed on top of stock Frappe + ERPNext, deployed via the bundled `frappe_docker/` setup.

---

## 1. High-level architecture

```
┌────────────────────────────┐        HTTPS / HTTP        ┌───────────────────────────────┐
│  Aiwa POS (Electron)       │  ───────────────────────▶ │  Frappe / ERPNext             │
│  - React renderer          │                            │  + custom app: pos_api        │
│  - Main process (Node)     │  Token auth                │  - Whitelisted /api/method/…  │
│  - Local SQLite cache      │  pos_api.api.*             │  - Custom DocTypes            │
│  - axios HTTP client       │                            │  - ERPNext: Item, Customer,   │
│                            │                            │    Sales Order, Sales Invoice │
└────────────────────────────┘                            └───────────────────────────────┘
```

- **Server URL** is configurable at runtime via the client (`config.json` in `userData`). Default for production has been `electronpos.tbo365.cloud`; for local development we point it at `http://localhost:8000`.
- **Authentication** is token-based. The client logs in via `pos_api.api.pos_login`, receives a token, and sends `Authorization: token <token>` on subsequent requests.
- The client also keeps an offline-first local SQLite mirror (items, customers, item groups, settings, sales history) and sync services run periodically against `sync_items`, `sync_stock`, `get_customers`, etc.

---

## 2. Backend stack

| Component        | Choice                                          |
|------------------|-------------------------------------------------|
| Framework        | Frappe v15                                      |
| ERP layer        | ERPNext v15 (provides Item, Customer, Sales Invoice, Sales Order, UOM, Mode of Payment, Company, Print Format) |
| Custom app       | `pos_api` (this project)                        |
| DB               | MariaDB (default for frappe_docker)             |
| Cache / queue    | Redis (default for frappe_docker)               |
| Site name (dev)  | `aiwapos.localhost`                             |
| Currency         | INR (Indian Rupee)                              |
| Country          | India                                           |
| Language         | English only (single-language as requested; Arabic name fields remain on DocTypes but the UI/seed data are English) |

---

## 3. Repository layout for the backend

The new app lives inside `frappe_docker/` so the whole stack is self-contained:

```
frappe_docker/
├── development/
│   ├── apps.json                # ← we add pos_api here
│   └── installer.py
├── apps/
│   └── pos_api/                 # ← new custom app
│       ├── pos_api/
│       │   ├── __init__.py
│       │   ├── hooks.py
│       │   ├── modules.txt
│       │   ├── patches.txt
│       │   ├── api/             # whitelisted methods
│       │   │   ├── __init__.py
│       │   │   ├── auth.py
│       │   │   ├── items.py
│       │   │   ├── customers.py
│       │   │   ├── settings.py
│       │   │   ├── sales_order.py
│       │   │   ├── sales_invoice.py
│       │   │   ├── shift.py
│       │   │   ├── kot.py
│       │   │   └── print_helpers.py
│       │   ├── pos_api/
│       │   │   └── doctype/
│       │   │       ├── pos_settings/
│       │   │       ├── pos_mode_of_payment_row/
│       │   │       ├── pos_sales_person_row/
│       │   │       ├── pos_print_format_row/
│       │   │       ├── shift_opening_entry/
│       │   │       ├── shift_closing_entry/
│       │   │       └── shift_denomination_row/
│       │   ├── fixtures/        # custom fields for Item, Customer
│       │   └── seed/
│       │       └── seed_demo.py
│       ├── pyproject.toml
│       └── README.md
└── compose.yaml
```

---

## 4. Custom DocTypes

These DocTypes are owned by `pos_api`. Stock ERPNext DocTypes (Item, Customer, Sales Invoice, Sales Order, Mode of Payment, UOM, Print Format, Company) are used as-is.

### 4.1 `POS Settings` (Single DocType)

| Field | Type | Notes |
|---|---|---|
| company | Link → Company | required |
| view_all_transaction_role | Link → Role | role that can see other users' transactions |
| default_target_warehouse | Link → Warehouse | |
| is_this_tax_included_in_basic_rate | Check | |
| enable_customer_based_price_list | Check | |
| override_sales_team_in_customer | Check | |
| payment_entry_based_on_sales_person | Check | |
| deduction_account | Link → Account | |
| cost_center | Link → Cost Center | |
| edit_item_rate | Check | |
| mode_of_payment_details | Table → POS Mode of Payment Row | |
| sales_person_details | Table → POS Sales Person Row | |
| print_format_details | Table → POS Print Format Row | |

### 4.2 `POS Mode of Payment Row` (Child)
- `mode_of_payment` — Link → Mode of Payment

### 4.3 `POS Sales Person Row` (Child)
- `sales_person`, `user`, `mode_of_payment`, `warehouse`, `cost_center`, `price_list`, `default_tax_category`, `sales_taxes_and_charges`, `branch` (Links)
- `is_this_tax_included_in_basic_rate`, `last_sale_to_customer`, `last_sale_price`, `last_purchase_cost`, `last_purchase_price`, `warehouse_list`, `stock_quantity`, `uom`, `edit_item_rate`, `enable_branch` (Checks)

### 4.4 `POS Print Format Row` (Child)
- `print_format` — Link → Print Format
- `label`, `doctype_name`, `description` — Data
- `is_default` — Check

### 4.5 `Shift Opening Entry`
| Field | Type |
|---|---|
| user | Link → User (auto = session user) |
| shift_date | Date |
| posting_time | Time |
| status | Select(Open, Closed) — default Open |
| cash_in_hand | Currency |
| company | Link → Company |
| amount_denomination | Table → Shift Denomination Row |
| remarks | Small Text |

### 4.6 `Shift Closing Entry`
| Field | Type |
|---|---|
| shift_opening_entry | Link → Shift Opening Entry |
| user | Link → User |
| shift_date | Date |
| cash_in_hand | Currency (carry-over from opening) |
| cash_count | Currency |
| cash_sales | Currency |
| card_sales | Currency |
| credit_sales | Currency |
| total_sales | Currency |
| total_quantity | Float |
| invoices_count | Int |
| difference | Currency |
| amount_denomination | Table → Shift Denomination Row |
| remarks | Small Text |

On submit, sets the linked `Shift Opening Entry.status = "Closed"`.

### 4.7 `Shift Denomination Row` (Child)
- `denomination` — Data (e.g., `"500"`)
- `quantity` — Int
- `amount` — Currency (computed)

### 4.8 Custom fields (fixtures)

Added via fixture on install:

**Item**
- `custom_is_favorite` (Check)
- `custom_item_tag_list` (Small Text — JSON array)
- `item_name_arabic` (Data) — kept on the DocType for parity with the client model; not used by English-only seed data

**Customer**
- `custom_is_default_customer` (Check)
- `custom_customer_arabic_name` (Data)
- `custom_crn_no` (Data)

**Sales Order**
- `restaurant_order_type` (Select: Dining, Parcel, Delivery)
- `table_no` (Data)
- `order_notes` (Small Text)

**Sales Invoice**
- `restaurant_order_type`, `table_no`, `order_notes` (mirrors of Sales Order, for invoices created directly from KOT/POS)

---

## 5. API surface

> Naming convention: every endpoint is a Python function in `pos_api/api/<module>.py` decorated with `@frappe.whitelist()` and invoked as `pos_api.api.<function_name>` from the client. All responses are wrapped in `{ "message": <payload> }` automatically by Frappe.

Standard payload contract:

```jsonc
{
  "message": {
    "success_key": 1,         // 1 = success, 0 = error
    "message": "human text",  // optional
    // ... endpoint-specific fields
  }
}
```

### 5.1 Auth (`auth.py`)
| Method | HTTP | Purpose |
|---|---|---|
| `pos_login` | POST | Validate username + password; mint API-key/secret pair stored on `User`; return token `"<key>:<secret>"`. |
| `pos_validate_token` | GET | Returns the resolved user if the request's `Authorization: token …` is valid. |
| `frappe.auth.logout` | POST | Stock Frappe — clears session cookie. |

### 5.2 Items & catalog (`items.py`)
- `get_items` (paginated full pull)
- `sync_items` (delta since `last_sync`)
- `sync_stock` (light stock-only)
- `get_item_details` (price + tax for an item × customer)
- `create_item`, `update_item`
- `update_item_favorite`
- `get_item_groups`

### 5.3 Customers (`customers.py`)
- `get_customers`
- `create_customer`
- `update_customer`

### 5.4 Settings (`settings.py`)
- `get_pos_settings`
- `get_company_default_currency`
- `get_mode_of_payments`
- `get_uom_list`
- `get_print_formats`

### 5.5 Sales Order — restaurant orders (`sales_order.py`)
- `create_sales_order` (incl. `restaurant_order_type`, `table_no`, `order_notes`)
- `update_sales_order`
- `get_sales_order`
- `get_my_orders`
- `delete_draft_sales_order`
- `convert_sales_orders_to_invoice`

### 5.6 Sales Invoice (`sales_invoice.py`)
- `create_sales_invoice`
- `submit_sales_invoice`
- `get_my_invoices`
- `get_sales_history`
- `get_sales_summary`
- `generate_invoice_qr`, `get_invoice_qr` (ZATCA-compatible TLV → base64 PNG)

### 5.7 Shift management (`shift.py`)
- `create_shift_opening_entry`
- `get_open_shift`
- `get_live_shift_report`
- `create_shift_closing_entry`
- `get_my_sessions`
- `get_session_report`

### 5.8 KOT & printing (`kot.py`, `print_helpers.py`)
- `get_kot_print_formats`
- `get_kot_print_data`
- `get_kot_print_html`
- `get_receipt_template`, `get_client_side_template`
- `get_sales_invoice_print_html`, `get_sales_order_print_html`
- `print_sales_invoice_pdf`, `print_sales_order_pdf`
- `get_shift_closing_print_html`, `print_session_report_pdf`

> The exhaustive request/response shape for every method is captured in the Explore audit and inlined as docstrings on the Python functions when implemented; see `src/main/api/*.ts` for the canonical client expectations.

---

## 6. Restaurant flow (the part we focus on)

The client treats restaurant orders as **Sales Orders** that may later be converted to **Sales Invoices**, plus KOT printing to the kitchen.

```
Login ──▶ Open Shift ──▶ Pick Table / Order Type ──▶ Add Items ──▶ Save SO (Draft) ──▶ Print KOT
                                                                            │
                                                                            ▼
                                                                Recall ──▶ Edit / Add items
                                                                            │
                                                                            ▼
                                                                  Convert to Sales Invoice
                                                                            │
                                                                            ▼
                                                                  Payment → Submit SI → Print receipt
                                                                            │
                                                                            ▼
                                                                    Close shift → Print Z-report
```

Key custom fields driving this flow: `restaurant_order_type`, `table_no`, `order_notes` (on Sales Order and Sales Invoice).

---

## 7. Seed data (English-only, INR)

`pos_api/seed/seed_demo.py` runs idempotently via `bench --site aiwapos.localhost execute pos_api.seed.seed_demo.run`. It creates **~10 entries per table** (a "rich" demo).

**Company / financials**
- Company: `Aiwa Demo` (abbr `AIWA`), currency `INR`, country `India`
- Warehouse: `Stores - AIWA`
- Modes of Payment: `Cash`, `Card`, `UPI`, `Credit`, `Wallet`
- Price List: `Standard Selling` (INR)
- Tax Template: `GST 5% - AIWA`, `GST 12% - AIWA`, `GST 18% - AIWA`

**Users (10 — password `aiwa123` for all)**
| User | Role(s) |
|---|---|
| `admin@aiwa.test` | System Manager |
| `manager@aiwa.test` | Restaurant Manager + Sales User + Accounts User |
| `cashier1@aiwa.test` … `cashier5@aiwa.test` | Cashier |
| `waiter1@aiwa.test` … `waiter3@aiwa.test` | Waiter |

API key/secret are minted for every non-System user and printed at the end of the seed.

**Item Groups (10)**
Starters, Mains, Tandoor, Indo-Chinese, South Indian, Beverages, Desserts, Sides, Combos, Specials.

**Items (~10 per group → ~100 total)** — all stock-tracked with 1000 opening qty.

A sample slice (full list in `seed_demo.py`):

| Code | Name | Group | Rate (INR) |
|---|---|---|---|
| ITM-0001 | Paneer Tikka | Starters | 240 |
| ITM-0010 | Butter Chicken | Mains | 320 |
| ITM-0020 | Tandoori Roti | Tandoor | 30 |
| ITM-0030 | Veg Hakka Noodles | Indo-Chinese | 220 |
| ITM-0040 | Masala Dosa | South Indian | 140 |
| ITM-0050 | Masala Chai | Beverages | 40 |
| ITM-0060 | Gulab Jamun | Desserts | 90 |
| ITM-0070 | French Fries | Sides | 120 |
| ITM-0080 | Family Combo | Combos | 999 |
| ITM-0090 | Chef's Special Thali | Specials | 449 |

**Customers (10)**
`Walk-in Customer` (default), plus 9 named customers with mobile / GSTIN.

**Tables (10)** — `T-01` … `T-10` stored on POS Settings as a static list (custom field).

**Sample Sales Orders / Invoices (10)** — historical data spread over the last 30 days so reports have something to render.

**Shift Entries (10)** — 9 closed + 1 currently open for the default cashier so the Z-report screen has data.

**POS Settings**
- Wired with the company, default warehouse, all five Modes of Payment, Sales Person Rows for each cashier, and rows for the three custom Print Formats (POS Receipt, KOT, Z-Report).

---

## 8. Running locally

### 8.1 First-time bring-up

```bash
cd frappe_docker

# 1. Start the dev container stack (Frappe + MariaDB + Redis)
docker compose -f development/docker-compose.yml up -d

# 2. Exec into the dev container
docker compose -f development/docker-compose.yml exec frappe bash

# Inside the container:
bench init --skip-redis-config-generation --frappe-branch version-15 frappe-bench
cd frappe-bench

bench new-site aiwapos.localhost --admin-password admin --mariadb-root-password root
bench --site aiwapos.localhost install-app erpnext

# Install pos_api (mounted from ./apps/pos_api)
bench get-app pos_api /workspace/development/apps/pos_api
bench --site aiwapos.localhost install-app pos_api

# Seed demo data
bench --site aiwapos.localhost execute pos_api.seed.seed_demo.run

# Run
bench start
```

Backend is now reachable at `http://aiwapos.localhost:8000`.

### 8.2 Point the client at it

In the Electron client, open the server URL settings dialog (gear icon) and set:

```
http://aiwapos.localhost:8000
```

Or, for a packaged build, edit `~/.config/aiwa-pos/config.json`:

```json
{ "backendUrl": "http://aiwapos.localhost:8000" }
```

Then log in with `cashier@aiwa.test` / `aiwa123`.

---

## 9. Implementation order (matches the task list)

1. **Documentation** — *this file* ✅
2. **Scaffold `pos_api`** — hooks, modules, pyproject
3. **DocTypes** — POS Settings, Shift Opening/Closing Entry, child tables, custom-field fixtures
4. **Auth endpoints**
5. **Items / item groups / customers**
6. **Settings endpoints** (POS Settings, currency, MOP, UOM)
7. **Sales Order endpoints** (restaurant)
8. **Sales Invoice endpoints** (incl. ZATCA QR stub)
9. **Shift endpoints**
10. **KOT & print helpers** (HTML first; PDF via Frappe's built-in `frappe.utils.print_format.download_pdf`)
11. **Seed script**
12. **Docker wiring** (`apps.json`, build steps, README)
13. **End-to-end smoke test** with the live Electron client.

Each step is its own task in the harness task list and will be checked off as it lands.

---

## 10. Custom print formats

Three Jinja-based Print Formats are shipped with `pos_api` and installed via fixtures:

1. **POS Receipt — Aiwa** (DocType: Sales Invoice) — 80mm thermal layout: header (company + GSTIN), itemized lines with HSN, taxes by rate (CGST/SGST), grand total, payment mode breakdown, footer with QR code.
2. **KOT — Aiwa** (DocType: Sales Order) — 80mm: order no, table no, order type tag (DINE/PARCEL/DELIVERY), waiter, large-print item lines with qty + notes, time/date.
3. **Z-Report — Aiwa** (DocType: Shift Closing Entry) — 80mm: cashier, shift open/close times, opening cash, sales by mode of payment, sales by item group, total invoices/qty, denomination breakdown, declared vs expected difference.

All three live in `pos_api/print_format/` as `.json` fixtures and `pos_api/templates/print_formats/*.html` for the Jinja bodies.

---

## 11. Smoke test runbook

After `setup_aiwapos.sh` finishes and `bench start` is running:

1. **Health check** — open `http://aiwapos.localhost:8000/api/method/ping` in a browser; should return `{"message":"pong"}`.
2. **Login** — `POST http://aiwapos.localhost:8000/api/method/pos_api.api.pos_login` with `{"usr":"cashier1@aiwa.test","pwd":"aiwa123"}` → expect `success_key:1` and a token.
3. **Items** — copy that token, then `GET …/pos_api.api.get_items?limit_page_length=5` with header `Authorization: token <key:secret>` → expect 5 items.
4. **Open in Electron client**
   - Launch the app.
   - On first run, click the gear/settings icon → set Server URL to `http://aiwapos.localhost:8000` → Save.
   - Log in with `cashier1@aiwa.test` / `aiwa123`.
   - Open a shift (any opening cash > 0).
   - Pick a table (T-01..T-10), add 2–3 items, save as Sales Order, print KOT.
   - Recall the order, convert to invoice, take payment in Cash, submit, print receipt.
   - Close the shift, print Z-Report.
5. **Reports** — navigate to Sales History and Sales Summary. Seed data over the last 30 days should render.

If any endpoint returns 500, check `bench --site aiwapos.localhost console` → `frappe.get_traceback()` or tail `frappe-bench/logs/web.error.log`.

---

## 12. Out of scope (for now)

- Arabic UI / RTL print layouts — the client retains the columns, but seed data is English-only as requested.
- ZATCA / Indian e-invoice signing — `generate_invoice_qr` returns a UPI-payload QR for INR. Real e-invoice IRN/QR via NIC belongs in a separate app.
- Pricing rules, loyalty points, gift cards — schema is in place via ERPNext but no UI surface in the client yet.
- Multi-bench / multi-site deployment — single-site is sufficient for the pilot.
