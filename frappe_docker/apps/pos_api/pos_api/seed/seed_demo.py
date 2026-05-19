"""Demo seed for pos_api.

Run with:
    bench --site aiwapos.localhost execute pos_api.seed.seed_demo.run

Idempotent — safe to run repeatedly.
"""
from __future__ import annotations

import random
from datetime import date, timedelta

import frappe
from frappe.utils import add_days, flt, nowdate
from frappe.utils.password import update_password


COMPANY_NAME = "Aiwa Demo"
COMPANY_ABBR = "AIWA"
CURRENCY = "INR"
COUNTRY = "India"
PRICE_LIST = "Standard Selling"
DEFAULT_WAREHOUSE = f"Stores - {COMPANY_ABBR}"

USERS = [
    dict(email="admin@aiwa.test",    full="Admin",        roles=["System Manager", "Restaurant Manager"]),
    dict(email="manager@aiwa.test",  full="Manager",      roles=["Restaurant Manager", "Sales User", "Accounts User"]),
    dict(email="cashier1@aiwa.test", full="Cashier One",  roles=["Cashier", "Sales User"]),
    dict(email="cashier2@aiwa.test", full="Cashier Two",  roles=["Cashier", "Sales User"]),
    dict(email="cashier3@aiwa.test", full="Cashier Three",roles=["Cashier", "Sales User"]),
    dict(email="cashier4@aiwa.test", full="Cashier Four", roles=["Cashier", "Sales User"]),
    dict(email="cashier5@aiwa.test", full="Cashier Five", roles=["Cashier", "Sales User"]),
    dict(email="waiter1@aiwa.test",  full="Waiter One",   roles=["Waiter"]),
    dict(email="waiter2@aiwa.test",  full="Waiter Two",   roles=["Waiter"]),
    dict(email="waiter3@aiwa.test",  full="Waiter Three", roles=["Waiter"]),
]
DEFAULT_PASSWORD = "aiwa123"

ITEM_GROUPS = [
    "Starters", "Mains", "Tandoor", "Indo-Chinese", "South Indian",
    "Beverages", "Desserts", "Sides", "Combos", "Specials",
]

# 10 items per group → 100 total
GROUP_ITEMS: dict[str, list[tuple[str, int]]] = {
    "Starters": [
        ("Paneer Tikka", 240), ("Chicken 65", 260), ("Veg Spring Roll", 180),
        ("Hara Bhara Kabab", 200), ("Mushroom Manchurian", 220), ("Fish Amritsari", 320),
        ("Tandoori Wings", 280), ("Crispy Corn", 190), ("Onion Pakora", 120),
        ("Cheese Balls", 210),
    ],
    "Mains": [
        ("Butter Chicken", 320), ("Dal Makhani", 220), ("Paneer Butter Masala", 260),
        ("Chicken Biryani", 280), ("Veg Biryani", 220), ("Mutton Rogan Josh", 380),
        ("Kadai Paneer", 240), ("Chana Masala", 180), ("Egg Curry", 200),
        ("Fish Curry", 320),
    ],
    "Tandoor": [
        ("Tandoori Roti", 30), ("Butter Naan", 50), ("Garlic Naan", 70),
        ("Stuffed Kulcha", 90), ("Tandoori Chicken (Half)", 280), ("Seekh Kebab", 240),
        ("Reshmi Kebab", 260), ("Tandoori Prawns", 380), ("Tandoori Mushroom", 200),
        ("Tandoori Paneer", 260),
    ],
    "Indo-Chinese": [
        ("Veg Hakka Noodles", 220), ("Chicken Hakka Noodles", 240),
        ("Veg Fried Rice", 200), ("Chicken Fried Rice", 220),
        ("Schezwan Noodles", 230), ("Chilli Chicken", 280),
        ("Chilli Paneer", 260), ("Gobi Manchurian", 220),
        ("Honey Chilli Potato", 200), ("Veg Manchow Soup", 140),
    ],
    "South Indian": [
        ("Masala Dosa", 140), ("Plain Dosa", 100), ("Onion Uttapam", 130),
        ("Idli Sambar", 90), ("Medu Vada", 90), ("Rava Dosa", 150),
        ("Mysore Masala Dosa", 160), ("Pongal", 110), ("Upma", 90),
        ("Coconut Chutney Plate", 60),
    ],
    "Beverages": [
        ("Masala Chai", 40), ("Filter Coffee", 50), ("Mango Lassi", 90),
        ("Sweet Lassi", 80), ("Lime Soda", 60), ("Coca-Cola", 60),
        ("Cold Coffee", 120), ("Fresh Lime Water", 50), ("Buttermilk", 50),
        ("Mineral Water", 30),
    ],
    "Desserts": [
        ("Gulab Jamun", 90), ("Rasmalai", 110), ("Kulfi", 100),
        ("Gajar Halwa", 120), ("Brownie with Ice Cream", 180),
        ("Kheer", 100), ("Jalebi", 80), ("Rasgulla", 90),
        ("Phirni", 100), ("Cheesecake", 220),
    ],
    "Sides": [
        ("French Fries", 120), ("Onion Rings", 130), ("Salad", 90),
        ("Raita", 60), ("Papad (2 pcs)", 30), ("Pickle", 20),
        ("Mashed Potato", 110), ("Coleslaw", 90), ("Steamed Rice", 110),
        ("Jeera Rice", 130),
    ],
    "Combos": [
        ("Family Combo", 999), ("Veg Thali", 280), ("Non-Veg Thali", 380),
        ("Breakfast Combo", 199), ("Lunch Special", 249), ("Couple Combo", 599),
        ("Biryani Combo", 349), ("Tandoori Platter", 549), ("South Indian Combo", 199),
        ("Chinese Combo", 299),
    ],
    "Specials": [
        ("Chef's Special Thali", 449), ("Royal Mutton Biryani", 499),
        ("Hyderabadi Dum Biryani", 449), ("Tandoori Mixed Grill", 549),
        ("Paneer Lababdar", 279), ("Murg Mussalam", 499),
        ("Galouti Kebab Platter", 499), ("Vegetable Pulao Deluxe", 299),
        ("Aiwa Signature Curry", 359), ("Dessert Sampler", 299),
    ],
}

CUSTOMERS = [
    dict(name="Walk-in Customer", default=1, mobile="", gstin=""),
    dict(name="Rajesh Kumar",      mobile="+919876500001", gstin=""),
    dict(name="Priya Sharma",      mobile="+919876500002", gstin=""),
    dict(name="Amit Patel",        mobile="+919876500003", gstin=""),
    dict(name="Sneha Iyer",        mobile="+919876500004", gstin=""),
    dict(name="Rohit Verma",       mobile="+919876500005", gstin=""),
    dict(name="Anita Desai",       mobile="+919876500006", gstin=""),
    dict(name="Aiwa Foods LLP",    mobile="+919876500007", gstin="29ABCDE1234F1Z5"),
    dict(name="Spice Route Pvt",   mobile="+919876500008", gstin="29XYZAB5678G1Z2"),
    dict(name="Festive Caterers",  mobile="+919876500009", gstin="29PQRST9012H1Z3"),
]

MODES_OF_PAYMENT = ["Cash", "Card", "UPI", "Credit", "Wallet"]
TABLES = [f"T-{i:02d}" for i in range(1, 11)]


def run():
    frappe.flags.in_install = True
    print("🌱 Seeding Aiwa POS demo data...")
    _ensure_company()
    _ensure_warehouse()
    _ensure_price_list()
    _ensure_modes_of_payment()
    _ensure_users()
    _ensure_item_groups()
    _ensure_items()
    _ensure_customers()
    _ensure_pos_settings()
    _seed_historical_invoices()
    _seed_shift_entries()
    _print_credentials()
    frappe.db.commit()
    print("✅ Done.")


# ---------- creators -------------------------------------------------------

def _ensure_company():
    if frappe.db.exists("Company", COMPANY_NAME):
        return
    print(f"  · Company: {COMPANY_NAME}")
    company = frappe.new_doc("Company")
    company.company_name = COMPANY_NAME
    company.abbr = COMPANY_ABBR
    company.default_currency = CURRENCY
    company.country = COUNTRY
    company.insert(ignore_permissions=True)
    frappe.db.set_single_value("Global Defaults", "default_company", COMPANY_NAME)


def _ensure_warehouse():
    if frappe.db.exists("Warehouse", DEFAULT_WAREHOUSE):
        return
    print(f"  · Warehouse: {DEFAULT_WAREHOUSE}")
    w = frappe.new_doc("Warehouse")
    w.warehouse_name = "Stores"
    w.company = COMPANY_NAME
    w.insert(ignore_permissions=True)


def _ensure_price_list():
    if not frappe.db.exists("Price List", PRICE_LIST):
        print(f"  · Price List: {PRICE_LIST}")
        p = frappe.new_doc("Price List")
        p.price_list_name = PRICE_LIST
        p.currency = CURRENCY
        p.selling = 1
        p.insert(ignore_permissions=True)
    frappe.db.set_single_value("Selling Settings", "selling_price_list", PRICE_LIST)


def _ensure_modes_of_payment():
    for m in MODES_OF_PAYMENT:
        if not frappe.db.exists("Mode of Payment", m):
            print(f"  · Mode of Payment: {m}")
            mop = frappe.new_doc("Mode of Payment")
            mop.mode_of_payment = m
            mop.type = "Cash" if m == "Cash" else "Bank"
            mop.enabled = 1
            mop.insert(ignore_permissions=True)


def _ensure_users():
    for u in USERS:
        if frappe.db.exists("User", u["email"]):
            continue
        print(f"  · User: {u['email']}")
        doc = frappe.new_doc("User")
        doc.email = u["email"]
        doc.first_name = u["full"]
        doc.send_welcome_email = 0
        doc.enabled = 1
        doc.new_password = DEFAULT_PASSWORD
        for r in u["roles"]:
            if frappe.db.exists("Role", r):
                doc.append("roles", dict(role=r))
        doc.insert(ignore_permissions=True)
        # ensure password is set (in case the new_password path skipped)
        update_password(u["email"], DEFAULT_PASSWORD)


def _ensure_item_groups():
    if not frappe.db.exists("Item Group", "All Item Groups"):
        ig = frappe.new_doc("Item Group")
        ig.item_group_name = "All Item Groups"
        ig.is_group = 1
        ig.insert(ignore_permissions=True)
    for g in ITEM_GROUPS:
        if frappe.db.exists("Item Group", g):
            continue
        print(f"  · Item Group: {g}")
        doc = frappe.new_doc("Item Group")
        doc.item_group_name = g
        doc.parent_item_group = "All Item Groups"
        doc.insert(ignore_permissions=True)


def _ensure_items():
    idx = 0
    for group, items in GROUP_ITEMS.items():
        for name, rate in items:
            idx += 1
            code = f"ITM-{idx:04d}"
            if frappe.db.exists("Item", code):
                continue
            doc = frappe.new_doc("Item")
            doc.item_code = code
            doc.item_name = name
            doc.item_group = group
            doc.stock_uom = "Nos"
            doc.is_stock_item = 1
            doc.is_sales_item = 1
            doc.standard_rate = rate
            doc.description = name
            doc.append("item_defaults", dict(
                company=COMPANY_NAME,
                default_warehouse=DEFAULT_WAREHOUSE,
            ))
            doc.insert(ignore_permissions=True)
            _set_item_price(code, rate)
            _stock_in(code, qty=1000)
    print(f"  · Items: created up to ITM-{idx:04d}")


def _set_item_price(item_code: str, rate: float):
    existing = frappe.db.get_value(
        "Item Price",
        {"item_code": item_code, "price_list": PRICE_LIST, "selling": 1},
        "name",
    )
    if existing:
        return
    p = frappe.new_doc("Item Price")
    p.item_code = item_code
    p.price_list = PRICE_LIST
    p.selling = 1
    p.price_list_rate = rate
    p.insert(ignore_permissions=True)


def _stock_in(item_code: str, qty: float = 1000):
    # Skip if any submitted SLE already exists for this item (idempotent)
    if frappe.db.exists("Stock Ledger Entry", {"item_code": item_code, "is_cancelled": 0}):
        return
    try:
        se = frappe.new_doc("Stock Entry")
        se.stock_entry_type = "Material Receipt"
        se.company = COMPANY_NAME
        se.append("items", dict(
            item_code=item_code,
            qty=qty,
            t_warehouse=DEFAULT_WAREHOUSE,
            basic_rate=frappe.db.get_value("Item", item_code, "standard_rate") or 1,
        ))
        se.insert(ignore_permissions=True)
        se.submit()
    except Exception as e:
        frappe.log_error(title=f"seed_demo stock-in {item_code}", message=str(e))


def _ensure_customers():
    for c in CUSTOMERS:
        if frappe.db.exists("Customer", c["name"]):
            continue
        print(f"  · Customer: {c['name']}")
        doc = frappe.new_doc("Customer")
        doc.customer_name = c["name"]
        doc.customer_type = "Individual" if " " in c["name"] else "Company"
        doc.customer_group = "Individual"
        doc.territory = "All Territories"
        if c.get("mobile"):
            doc.mobile_no = c["mobile"]
        if c.get("gstin"):
            doc.tax_id = c["gstin"]
        if c.get("default"):
            doc.custom_is_default_customer = 1
        doc.insert(ignore_permissions=True)


def _ensure_pos_settings():
    s = frappe.get_single("POS Settings")
    s.company = COMPANY_NAME
    s.default_target_warehouse = DEFAULT_WAREHOUSE
    s.view_all_transaction_role = "Restaurant Manager"
    s.edit_item_rate = 1
    s.table_list = "\n".join(TABLES)

    s.mode_of_payment_details = []
    for m in MODES_OF_PAYMENT:
        s.append("mode_of_payment_details", dict(mode_of_payment=m))

    s.sales_person_details = []
    for u in USERS:
        if "Cashier" not in u["roles"]:
            continue
        s.append("sales_person_details", dict(
            user=u["email"],
            warehouse=DEFAULT_WAREHOUSE,
            price_list=PRICE_LIST,
            mode_of_payment="Cash",
            edit_item_rate=1,
        ))

    s.print_format_details = []
    for label, pf, dt in [
        ("Receipt", "POS Receipt - Aiwa", "Sales Invoice"),
        ("KOT",     "KOT - Aiwa",         "Sales Order"),
        ("Z-Report","Z-Report - Aiwa",    "Shift Closing Entry"),
    ]:
        if frappe.db.exists("Print Format", pf):
            s.append("print_format_details", dict(
                print_format=pf, label=label, doctype_name=dt, is_default=1,
            ))
    s.flags.ignore_permissions = True
    s.save(ignore_permissions=True)


def _seed_historical_invoices():
    """Create 10 submitted sales invoices over the last 30 days for demo reports."""
    if frappe.db.count("Sales Invoice") >= 10:
        return
    item_codes = frappe.get_all("Item", filters={"is_sales_item": 1}, pluck="name", limit=20)
    if not item_codes:
        return
    customer_names = [c["name"] for c in CUSTOMERS if frappe.db.exists("Customer", c["name"])]
    if not customer_names:
        return
    today = date.today()
    for i in range(10):
        d = today - timedelta(days=i * 3)
        si = frappe.new_doc("Sales Invoice")
        si.customer = random.choice(customer_names)
        si.posting_date = d
        si.due_date = d
        si.is_pos = 1
        si.update_stock = 1
        si.set_warehouse = DEFAULT_WAREHOUSE
        si.restaurant_order_type = random.choice(["Dining", "Parcel", "Delivery"])
        si.table_no = random.choice(TABLES) if si.restaurant_order_type == "Dining" else None
        for code in random.sample(item_codes, k=min(3, len(item_codes))):
            si.append("items", dict(
                item_code=code,
                qty=random.randint(1, 3),
                rate=frappe.db.get_value("Item", code, "standard_rate") or 100,
                warehouse=DEFAULT_WAREHOUSE,
            ))
        si.append("payments", dict(
            mode_of_payment=random.choice(MODES_OF_PAYMENT), amount=0,
        ))
        try:
            si.insert(ignore_permissions=True)
            si.payments[0].amount = si.grand_total
            si.save(ignore_permissions=True)
            si.submit()
        except Exception as e:
            frappe.log_error(title=f"seed_demo SI #{i}", message=str(e))


def _seed_shift_entries():
    """9 closed + 1 open shift for cashier1."""
    user = "cashier1@aiwa.test"
    if frappe.db.count("Shift Opening Entry", filters={"user": user}) >= 10:
        return
    today = date.today()
    for i in range(10):
        d = today - timedelta(days=i)
        opening = frappe.new_doc("Shift Opening Entry")
        opening.user = user
        opening.company = COMPANY_NAME
        opening.shift_date = d
        opening.posting_time = "09:00:00"
        opening.status = "Open" if i == 0 else "Closed"
        opening.cash_in_hand = 5000
        opening.append("amount_denomination", dict(denomination="500", quantity=10))
        try:
            opening.insert(ignore_permissions=True)
        except Exception as e:
            frappe.log_error(title=f"seed shift opening {i}", message=str(e))
            continue
        if i == 0:
            continue
        closing = frappe.new_doc("Shift Closing Entry")
        closing.shift_opening_entry = opening.name
        closing.user = user
        closing.company = COMPANY_NAME
        closing.shift_date = d
        closing.cash_in_hand = 5000
        sales = random.randint(5000, 20000)
        closing.cash_sales = sales * 0.6
        closing.card_sales = sales * 0.3
        closing.credit_sales = sales * 0.1
        closing.total_sales = sales
        closing.total_quantity = random.randint(20, 60)
        closing.invoices_count = random.randint(5, 20)
        closing.cash_count = closing.cash_in_hand + closing.cash_sales
        closing.append("amount_denomination", dict(denomination="500", quantity=20))
        try:
            closing.insert(ignore_permissions=True)
            closing.submit()
        except Exception as e:
            frappe.log_error(title=f"seed shift closing {i}", message=str(e))


def _print_credentials():
    print("\n" + "=" * 60)
    print("  API CREDENTIALS  (use either the password or the token)")
    print("=" * 60)
    for u in USERS:
        if u["email"] == "admin@aiwa.test":
            continue
        try:
            doc = frappe.get_doc("User", u["email"])
            api_key = doc.api_key or frappe.generate_hash(length=15)
            api_secret = frappe.generate_hash(length=15)
            doc.api_key = api_key
            doc.api_secret = api_secret
            doc.flags.ignore_permissions = True
            doc.save(ignore_permissions=True)
            print(f"  {u['email']:30s} pwd={DEFAULT_PASSWORD}  token={api_key}:{api_secret}")
        except Exception as e:
            print(f"  {u['email']}: could not mint token ({e})")
    print("=" * 60 + "\n")
