"""Sales Order endpoints — including restaurant fields (order type, table, notes)."""
from __future__ import annotations

import frappe
from frappe.utils import cint, flt, getdate, nowdate, add_days

from ._utils import ok, fail, parse_json_param, is_privileged


def _so_summary(name: str, include_items: bool = True) -> dict:
    so = frappe.get_doc("Sales Order", name)
    out = dict(
        name=so.name,
        customer=so.customer,
        customer_name=so.customer_name,
        transaction_date=str(so.transaction_date) if so.transaction_date else "",
        delivery_date=str(so.delivery_date) if so.delivery_date else "",
        docstatus=so.docstatus,
        status=so.status,
        total=flt(so.total),
        grand_total=flt(so.grand_total),
        currency=so.currency,
        restaurant_order_type=so.get("restaurant_order_type") or None,
        table_no=so.get("table_no") or None,
        order_notes=so.get("order_notes") or None,
    )
    if include_items:
        out["items"] = [
            dict(
                name=row.name,
                item_code=row.item_code,
                item_name=row.item_name,
                qty=flt(row.qty),
                rate=flt(row.rate),
                amount=flt(row.amount),
                description=row.description,
                uom=row.uom,
                item_group=row.item_group,
                net_amount=flt(row.net_amount),
                discount_percentage=flt(row.discount_percentage),
                discount_amount=flt(row.discount_amount),
            ) for row in so.items
        ]
    return out


def _default_company() -> str | None:
    return (
        frappe.defaults.get_user_default("company")
        or frappe.db.get_single_value("Global Defaults", "default_company")
        or (frappe.get_all("Company", limit=1, pluck="name") or [None])[0]
    )


@frappe.whitelist(methods=["POST"])
def create_sales_order(customer: str, items=None,
                       company: str | None = None,
                       restaurant_order_type: str | None = None,
                       table_no: str | None = None,
                       order_notes: str | None = None,
                       delivery_charge: float = 0,
                       delivery_charge_amount: float = 0):
    items_list = parse_json_param(items, [])
    if not items_list:
        return fail("Items list is required")
    if not frappe.db.exists("Customer", customer):
        return fail("Customer not found")
    if not company:
        company = _default_company()
    if not company:
        return fail("Please select a Company")

    doc = frappe.new_doc("Sales Order")
    doc.company = company
    doc.customer = customer
    doc.transaction_date = nowdate()
    doc.delivery_date = nowdate()
    if restaurant_order_type:
        doc.restaurant_order_type = restaurant_order_type
    if table_no:
        doc.table_no = table_no
    if order_notes:
        doc.order_notes = order_notes
    for it in items_list:
        doc.append("items", dict(
            item_code=it.get("item_code"),
            qty=flt(it.get("qty") or 1),
            rate=flt(it.get("rate") or 0),
            delivery_date=nowdate(),
        ))
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return ok(message="Sales Order created", sales_order=doc.name, **_so_summary(doc.name))


@frappe.whitelist(methods=["POST"])
def update_sales_order(sales_order: str, items=None, remove_items=None,
                       restaurant_order_type: str | None = None,
                       table_no: str | None = None,
                       order_notes: str | None = None):
    if not frappe.db.exists("Sales Order", sales_order):
        return fail("Sales Order not found")
    doc = frappe.get_doc("Sales Order", sales_order)
    if doc.docstatus != 0:
        return fail("Only draft orders can be edited")

    remove_set = set(parse_json_param(remove_items, []) or [])
    if remove_set:
        doc.items = [row for row in doc.items if row.name not in remove_set]

    new_items = parse_json_param(items, []) or []
    for it in new_items:
        existing = next(
            (r for r in doc.items if r.item_code == it.get("item_code")), None
        )
        if existing:
            existing.qty = flt(it.get("qty") or existing.qty)
            existing.rate = flt(it.get("rate") or existing.rate)
        else:
            doc.append("items", dict(
                item_code=it.get("item_code"),
                qty=flt(it.get("qty") or 1),
                rate=flt(it.get("rate") or 0),
                delivery_date=nowdate(),
            ))

    if restaurant_order_type is not None:
        doc.restaurant_order_type = restaurant_order_type
    if table_no is not None:
        doc.table_no = table_no
    if order_notes is not None:
        doc.order_notes = order_notes

    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return ok(message="Sales Order updated", sales_order=doc.name)


@frappe.whitelist(methods=["GET"])
def get_sales_order(sales_order: str):
    if not frappe.db.exists("Sales Order", sales_order):
        return fail("Sales Order not found")
    return ok(sales_order=_so_summary(sales_order))


@frappe.whitelist(methods=["GET"])
def get_my_orders(docstatus: int = 0, limit_start: int = 0, limit_page_length: int = 20,
                  from_date: str | None = None, to_date: str | None = None,
                  include_items: int = 1):
    filters = {"docstatus": cint(docstatus)}
    if not is_privileged():
        filters["owner"] = frappe.session.user
    if from_date:
        filters["transaction_date"] = [">=", getdate(from_date)]
    if to_date:
        existing = filters.get("transaction_date")
        if existing:
            filters["transaction_date"] = ["between", [getdate(from_date), getdate(to_date)]]
        else:
            filters["transaction_date"] = ["<=", getdate(to_date)]

    limit_start = cint(limit_start)
    limit_page_length = cint(limit_page_length)

    total_count = frappe.db.count("Sales Order", filters=filters)
    names = frappe.get_all(
        "Sales Order", filters=filters, pluck="name",
        order_by="modified desc",
        limit_start=limit_start, limit_page_length=limit_page_length,
    )
    orders = [_so_summary(n, include_items=bool(cint(include_items))) for n in names]
    next_offset = limit_start + limit_page_length
    return ok(
        orders=orders,
        total_count=total_count,
        limit_start=limit_start,
        limit_page_length=limit_page_length,
        has_more=next_offset < total_count,
        next_offset=next_offset,
    )


@frappe.whitelist(methods=["POST"])
def delete_draft_sales_order(sales_order: str):
    if not frappe.db.exists("Sales Order", sales_order):
        return fail("Sales Order not found")
    doc = frappe.get_doc("Sales Order", sales_order)
    if doc.docstatus != 0:
        return fail("Only draft orders can be deleted")
    doc.delete(ignore_permissions=True)
    frappe.db.commit()
    return ok(message="Sales Order deleted")


@frappe.whitelist(methods=["POST"])
def convert_sales_orders_to_invoice(sales_orders=None, payments=None):
    so_list = parse_json_param(sales_orders, [])
    payments_list = parse_json_param(payments, [])
    if not so_list:
        return fail("No sales orders given")

    invoices_created = []
    items_aggregated = []
    customer = None
    total = 0.0
    company = _default_company()

    for so_name in so_list:
        if not so_name or not frappe.db.exists("Sales Order", so_name):
            continue
        so = frappe.get_doc("Sales Order", so_name)
        if so.docstatus == 0:
            so.submit()

        si = frappe.new_doc("Sales Invoice")
        si.company = so.company or company
        si.customer = so.customer
        customer = so.customer
        si.posting_date = nowdate()
        si.due_date = nowdate()
        si.is_pos = 1
        si.update_stock = 1
        si.restaurant_order_type = so.get("restaurant_order_type")
        si.table_no = so.get("table_no")
        si.order_notes = so.get("order_notes")
        for row in so.items:
            si.append("items", dict(
                item_code=row.item_code,
                qty=row.qty,
                rate=row.rate,
                sales_order=so.name,
                so_detail=row.name,
            ))
        for p in payments_list:
            si.append("payments", dict(
                mode_of_payment=p.get("mode_of_payment"),
                amount=flt(p.get("amount")),
            ))
        si.insert(ignore_permissions=True)
        si.submit()
        invoices_created.append(si.name)
        total += flt(si.grand_total)
        for row in si.items:
            items_aggregated.append(dict(
                item_code=row.item_code,
                item_name=row.item_name,
                qty=flt(row.qty),
                rate=flt(row.rate),
                amount=flt(row.amount),
                sales_order=row.sales_order,
            ))

    frappe.db.commit()
    return ok(
        message="Converted successfully",
        sales_invoice=invoices_created[0] if len(invoices_created) == 1 else None,
        invoices=invoices_created,
        sales_orders_linked=so_list,
        customer=customer,
        grand_total=total,
        docstatus=1,
        items=items_aggregated,
    )
