"""Sales Invoice endpoints — POS-mode invoices, history, summary, QR."""
from __future__ import annotations

import base64
import io
from collections import defaultdict

import frappe
from frappe.utils import cint, flt, getdate, nowdate

from ._utils import ok, fail, parse_json_param, is_privileged


def _si_to_dict(name: str, include_items: bool = True) -> dict:
    si = frappe.get_doc("Sales Invoice", name)
    out = dict(
        name=si.name,
        customer=si.customer,
        customer_name=si.customer_name,
        posting_date=str(si.posting_date),
        due_date=str(si.due_date),
        docstatus=si.docstatus,
        status=si.status,
        grand_total=flt(si.grand_total),
        outstanding_amount=flt(si.outstanding_amount),
        currency=si.currency,
        total_qty=flt(si.total_qty),
        net_total=flt(si.net_total),
        total_taxes_and_charges=flt(si.total_taxes_and_charges),
        discount_amount=flt(si.discount_amount),
        additional_discount_percentage=flt(si.additional_discount_percentage),
        restaurant_order_type=si.get("restaurant_order_type"),
        table_no=si.get("table_no"),
        order_notes=si.get("order_notes"),
    )
    if include_items:
        out["items"] = [
            dict(
                item_code=r.item_code,
                item_name=r.item_name,
                qty=flt(r.qty),
                rate=flt(r.rate),
                amount=flt(r.amount),
                uom=r.uom,
                item_group=r.item_group,
            ) for r in si.items
        ]
    return out


@frappe.whitelist(methods=["POST"])
def create_sales_invoice(customer: str, items=None,
                         company: str | None = None,
                         posting_date: str | None = None,
                         due_date: str | None = None,
                         selling_price_list: str | None = None,
                         is_pos: int = 1,
                         pos_profile: str | None = None,
                         update_stock: int = 1,
                         set_warehouse: str | None = None,
                         submit: int = 0,
                         discount_amount: float = 0,
                         additional_discount_percentage: float = 0,
                         delivery_charge: float = 0,
                         delivery_charge_amount: float = 0,
                         payments=None,
                         restaurant_order_type: str | None = None,
                         table_no: str | None = None,
                         order_notes: str | None = None):
    items_list = parse_json_param(items, [])
    if not items_list:
        return fail("Items list is required")
    if not frappe.db.exists("Customer", customer):
        return fail("Customer not found")

    if not company:
        company = (
            frappe.defaults.get_user_default("company")
            or frappe.db.get_single_value("Global Defaults", "default_company")
        )
    if not company:
        return fail("Please select a Company")

    si = frappe.new_doc("Sales Invoice")
    si.company = company
    si.customer = customer
    si.posting_date = getdate(posting_date) if posting_date else nowdate()
    si.due_date = getdate(due_date) if due_date else si.posting_date
    si.is_pos = cint(is_pos)
    si.update_stock = cint(update_stock)
    if selling_price_list:
        si.selling_price_list = selling_price_list
    if pos_profile and frappe.db.exists("POS Profile", pos_profile):
        si.pos_profile = pos_profile
    if set_warehouse:
        si.set_warehouse = set_warehouse
    if restaurant_order_type:
        si.restaurant_order_type = restaurant_order_type
    if table_no:
        si.table_no = table_no
    if order_notes:
        si.order_notes = order_notes
    si.discount_amount = flt(discount_amount)
    si.additional_discount_percentage = flt(additional_discount_percentage)

    for it in items_list:
        row = dict(
            item_code=it.get("item_code"),
            qty=flt(it.get("qty") or 1),
            rate=flt(it.get("rate") or 0),
        )
        if set_warehouse:
            row["warehouse"] = set_warehouse
        si.append("items", row)

    payments_list = parse_json_param(payments, []) or []
    if si.is_pos and not payments_list:
        # default: full amount on Cash
        payments_list = [{"mode_of_payment": "Cash"}]
    for p in payments_list:
        si.append("payments", dict(
            mode_of_payment=p.get("mode_of_payment"),
            amount=flt(p.get("amount") or 0),
        ))

    # Resolve the default Sales Taxes and Charges Template from the customer's
    # tax_category (Frappe's controller doesn't auto-attach it when the invoice
    # is created via API, so we do it explicitly here).
    if not si.taxes_and_charges:
        tax_category = frappe.db.get_value("Customer", customer, "tax_category")
        if tax_category:
            template_name = frappe.db.get_value(
                "Sales Taxes and Charges Template",
                {"tax_category": tax_category, "company": company, "is_default": 1, "disabled": 0},
                "name",
            ) or frappe.db.get_value(
                "Sales Taxes and Charges Template",
                {"tax_category": tax_category, "company": company, "disabled": 0},
                "name",
            )
            if template_name:
                si.taxes_and_charges = template_name
                # Populate si.taxes child rows from the template
                for tx in frappe.get_doc("Sales Taxes and Charges Template", template_name).taxes:
                    si.append("taxes", {
                        "charge_type": tx.charge_type,
                        "account_head": tx.account_head,
                        "description": tx.description,
                        "rate": tx.rate,
                        "cost_center": tx.cost_center,
                        "row_id": tx.row_id,
                        "included_in_print_rate": tx.included_in_print_rate,
                    })

    si.insert(ignore_permissions=True)

    # default the full grand total to the first payment row if amount missing
    if si.is_pos and si.payments and not any(flt(p.amount) for p in si.payments):
        si.payments[0].amount = si.grand_total
        si.save(ignore_permissions=True)

    if cint(submit):
        si.submit()

    frappe.db.commit()
    return {"name": si.name, "docstatus": si.docstatus, **_si_to_dict(si.name)}


@frappe.whitelist(methods=["POST"])
def submit_sales_invoice(invoice_name: str):
    if not frappe.db.exists("Sales Invoice", invoice_name):
        return fail("Invoice not found")
    si = frappe.get_doc("Sales Invoice", invoice_name)
    if si.docstatus == 0:
        si.submit()
        frappe.db.commit()
    return ok(message="Invoice submitted")


@frappe.whitelist(methods=["GET"])
def get_my_invoices(docstatus: int = 1, limit_start: int = 0, limit_page_length: int = 20,
                    from_date: str | None = None, to_date: str | None = None,
                    customer: str | None = None, status: str | None = None,
                    include_payments: int = 0):
    filters = {"docstatus": cint(docstatus)}
    if not is_privileged():
        filters["owner"] = frappe.session.user
    if customer:
        filters["customer"] = customer
    if status:
        filters["status"] = status
    if from_date and to_date:
        filters["posting_date"] = ["between", [getdate(from_date), getdate(to_date)]]
    elif from_date:
        filters["posting_date"] = [">=", getdate(from_date)]
    elif to_date:
        filters["posting_date"] = ["<=", getdate(to_date)]

    limit_start = cint(limit_start)
    limit_page_length = cint(limit_page_length)
    total_count = frappe.db.count("Sales Invoice", filters=filters)
    names = frappe.get_all(
        "Sales Invoice", filters=filters, pluck="name",
        order_by="modified desc",
        limit_start=limit_start, limit_page_length=limit_page_length,
    )
    next_offset = limit_start + limit_page_length
    return ok(
        user=frappe.session.user,
        invoices=[_si_to_dict(n) for n in names],
        total_count=total_count,
        has_more=next_offset < total_count,
        next_offset=next_offset,
    )


@frappe.whitelist(methods=["GET"])
def get_sales_history(limit_start: int = 0, limit_page_length: int = 50):
    limit_start = cint(limit_start)
    limit_page_length = cint(limit_page_length)
    rows = frappe.db.sql(
        """
        SELECT
            sii.parent AS invoice_name,
            si.customer AS customer,
            si.customer_name AS customer_name,
            si.posting_date AS posting_date,
            si.grand_total AS invoice_total,
            si.is_pos AS is_pos,
            sii.item_code, sii.item_name, sii.qty, sii.rate, sii.amount,
            sii.uom, sii.warehouse,
            sii.discount_percentage, sii.discount_amount
        FROM `tabSales Invoice Item` sii
        INNER JOIN `tabSales Invoice` si ON si.name = sii.parent
        WHERE si.docstatus = 1
        ORDER BY si.posting_date DESC, sii.parent DESC
        LIMIT %s, %s
        """,
        (limit_start, limit_page_length),
        as_dict=True,
    )

    summary = frappe.db.sql(
        """
        SELECT
            COUNT(DISTINCT si.name) AS total_invoices,
            COUNT(DISTINCT si.customer) AS total_customers,
            COALESCE(SUM(sii.qty), 0) AS total_qty,
            COALESCE(SUM(sii.amount), 0) AS total_amount,
            COALESCE(AVG(sii.rate), 0) AS avg_rate,
            SUM(CASE WHEN si.is_pos = 1 THEN 1 ELSE 0 END) AS pos_invoices
        FROM `tabSales Invoice Item` sii
        INNER JOIN `tabSales Invoice` si ON si.name = sii.parent
        WHERE si.docstatus = 1
        """,
        as_dict=True,
    )[0]
    total_count = frappe.db.count("Sales Invoice Item")
    return ok(
        message="History fetched",
        history=[{**r, "posting_date": str(r["posting_date"]), "extra_data": {}} for r in rows],
        summary={k: flt(v) if k != "total_invoices" and k != "total_customers" and k != "pos_invoices" else cint(v)
                 for k, v in summary.items()},
        total_count=total_count,
        limit_start=limit_start,
        limit_page_length=limit_page_length,
    )


@frappe.whitelist(methods=["GET"])
def get_sales_summary(from_date: str, to_date: str, top_n: int = 10,
                      user: str | None = None, company: str | None = None):
    from_d = getdate(from_date)
    to_d = getdate(to_date)
    conds = ["si.docstatus = 1", "si.posting_date BETWEEN %(fd)s AND %(td)s"]
    params = {"fd": from_d, "td": to_d}
    if user:
        conds.append("si.owner = %(user)s")
        params["user"] = user
    if company:
        conds.append("si.company = %(company)s")
        params["company"] = company
    where = " AND ".join(conds)

    rows = frappe.db.sql(
        f"""
        SELECT sii.item_code, sii.item_name, sii.item_group,
               SUM(sii.qty) AS qty, SUM(sii.amount) AS amount
        FROM `tabSales Invoice Item` sii
        INNER JOIN `tabSales Invoice` si ON si.name = sii.parent
        WHERE {where}
        GROUP BY sii.item_code
        ORDER BY amount DESC
        """,
        params, as_dict=True,
    )
    products = [dict(item_code=r.item_code, name=r.item_name, item_group=r.item_group,
                     qty=flt(r.qty), amount=flt(r.amount)) for r in rows[:cint(top_n)]]
    cat_totals: dict[str, dict[str, float]] = defaultdict(lambda: {"qty": 0.0, "amount": 0.0})
    for r in rows:
        cat_totals[r.item_group]["qty"] += flt(r.qty)
        cat_totals[r.item_group]["amount"] += flt(r.amount)
    categories = sorted(
        [dict(name=k, qty=v["qty"], amount=v["amount"]) for k, v in cat_totals.items()],
        key=lambda x: x["amount"], reverse=True,
    )[:cint(top_n)]

    pay_rows = frappe.db.sql(
        f"""
        SELECT sip.mode_of_payment, SUM(sip.amount) AS amount
        FROM `tabSales Invoice Payment` sip
        INNER JOIN `tabSales Invoice` si ON si.name = sip.parent
        WHERE {where}
        GROUP BY sip.mode_of_payment
        """,
        params, as_dict=True,
    )
    payment_modes = [dict(mode_of_payment=r.mode_of_payment, amount=flt(r.amount)) for r in pay_rows]

    by_mode = {r["mode_of_payment"]: r["amount"] for r in payment_modes}
    totals = dict(
        total_sale=sum(by_mode.values()),
        card_sale=by_mode.get("Card", 0),
        cash_sale=by_mode.get("Cash", 0),
        credit_sale=by_mode.get("Credit", 0),
        return_total=0,
        net_sale=sum(by_mode.values()),
    )

    inv_count = frappe.db.sql(
        f"SELECT COUNT(*) FROM `tabSales Invoice` si WHERE {where}",
        params,
    )[0][0]

    return ok(data=dict(
        from_date=str(from_d), to_date=str(to_d), user=user, company=company,
        total_invoices=cint(inv_count),
        unique_products=len(rows),
        unique_categories=len(cat_totals),
        totals=totals,
        top_product=(dict(name=products[0]["name"], qty=products[0]["qty"]) if products else None),
        top_category=(dict(name=categories[0]["name"], qty=categories[0]["qty"]) if categories else None),
        products=products,
        categories=categories,
        payment_modes=payment_modes,
    ))


# --------- ZATCA-style QR (used as UPI QR for INR; payload is generic) ----

def _build_qr_payload(invoice) -> str:
    company = frappe.get_doc("Company", invoice.company)
    return (
        f"Invoice:{invoice.name}|Company:{company.name}|"
        f"Date:{invoice.posting_date}|Total:{flt(invoice.grand_total)} {invoice.currency}|"
        f"Tax:{flt(invoice.total_taxes_and_charges)}"
    )


def _png_qr_base64(text: str) -> str:
    try:
        import qrcode  # type: ignore
    except ImportError:
        return ""
    img = qrcode.make(text)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


@frappe.whitelist(methods=["POST"])
def generate_invoice_qr(invoice_name: str):
    if not frappe.db.exists("Sales Invoice", invoice_name):
        return fail("Invoice not found")
    si = frappe.get_doc("Sales Invoice", invoice_name)
    payload = _build_qr_payload(si)
    qr = _png_qr_base64(payload)
    return ok(message="QR code generated", data=dict(invoice_name=invoice_name, qr_code=qr))


@frappe.whitelist(methods=["GET"])
def get_invoice_qr(invoice_name: str):
    return generate_invoice_qr(invoice_name)
