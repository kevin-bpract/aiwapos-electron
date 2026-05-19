"""KOT (Kitchen Order Ticket) endpoints."""
from __future__ import annotations

import frappe
from frappe.utils import flt, get_datetime

from ._utils import ok, fail


CLIENT_TEMPLATES_REGISTRY = {
    "kot_standard": dict(file="kot_standard.html", description="80mm KOT template", usage="kitchen"),
    "invoice_standard": dict(file="invoice_standard.html", description="80mm receipt", usage="receipt"),
    # Compact aliases to standard until a dedicated compact template is added.
    "invoice_compact": dict(file="invoice_standard.html", description="80mm receipt (compact)", usage="receipt"),
    "session_report": dict(file="session_report.html", description="Z-Report 80mm", usage="z-report"),
}


def _read_template(name: str) -> str | None:
    import os
    from pos_api import __path__ as _p
    base = os.path.join(_p[0], "templates", "client_side")
    info = CLIENT_TEMPLATES_REGISTRY.get(name)
    if not info:
        return None
    path = os.path.join(base, info["file"])
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


@frappe.whitelist(methods=["GET"])
def get_kot_print_formats():
    server = frappe.get_all(
        "Print Format",
        filters={"doc_type": ["in", ["Sales Order", "Sales Invoice"]]},
        fields=["name", "doc_type", "module"],
    )
    client = [
        dict(
            name=k,
            type="client_template",
            file=v["file"],
            description=v["description"],
            usage=v["usage"],
        ) for k, v in CLIENT_TEMPLATES_REGISTRY.items() if v["usage"] == "kitchen"
    ]
    return ok(
        default_format="KOT - Aiwa" if frappe.db.exists("Print Format", "KOT - Aiwa") else None,
        client_templates=client,
        server_print_formats=[
            dict(name=r.name, type="server_print_format", doctype=r.doc_type, module=r.module)
            for r in server
        ],
        client_count=len(client),
        server_count=len(server),
    )


def _kot_payload(sales_order: str | None, sales_invoice: str | None) -> dict:
    if sales_order:
        doc = frappe.get_doc("Sales Order", sales_order)
        order_no = doc.name
        order_type_raw = doc.get("restaurant_order_type") or "Dining"
    elif sales_invoice:
        doc = frappe.get_doc("Sales Invoice", sales_invoice)
        order_no = doc.name
        order_type_raw = doc.get("restaurant_order_type") or "Dining"
    else:
        return {}

    items = [
        dict(
            item_code=row.item_code,
            item_name=row.item_name,
            item_name_ar=None,
            qty=flt(row.qty),
            uom=row.uom,
            item_group=row.item_group,
            notes=None,
        ) for row in doc.items
    ]
    return dict(
        order_no=order_no,
        order_type=order_type_raw,
        restaurant_order_type=order_type_raw,
        is_dine_in=order_type_raw == "Dining",
        is_parcel=order_type_raw == "Parcel",
        is_delivery=order_type_raw == "Delivery",
        table_number=doc.get("table_no"),
        order_time=str(get_datetime(doc.creation).time().replace(microsecond=0)),
        order_date=str(get_datetime(doc.creation).date()),
        customer=doc.customer,
        customer_name=doc.customer_name,
        cashier=doc.owner,
        sales_person=doc.owner,
        remarks=doc.get("order_notes"),
        items=items,
        total_items=len(items),
        total_qty=sum(it["qty"] for it in items),
    )


@frappe.whitelist(methods=["GET"])
def get_kot_print_data(sales_order: str | None = None, sales_invoice: str | None = None):
    data = _kot_payload(sales_order, sales_invoice)
    if not data:
        return fail("Either sales_order or sales_invoice is required")
    return ok(data=data)


@frappe.whitelist(methods=["GET"])
def get_kot_print_html(sales_order: str | None = None, sales_invoice: str | None = None,
                       format: str | None = None):
    doc_name = sales_order or sales_invoice
    if not doc_name:
        return fail("Either sales_order or sales_invoice is required")
    doctype = "Sales Order" if sales_order else "Sales Invoice"
    print_format = format or ("KOT - Aiwa" if frappe.db.exists("Print Format", "KOT - Aiwa") else None)
    try:
        html = frappe.get_print(doctype, doc_name, print_format=print_format)
    except Exception as e:
        return fail(f"Failed to render: {e}")
    return ok(
        html=html,
        format=print_format,
        source="sales_order" if sales_order else "sales_invoice",
        order_no=doc_name,
        order_type=frappe.db.get_value(doctype, doc_name, "restaurant_order_type") or "Dining",
    )


@frappe.whitelist(methods=["GET"])
def get_receipt_template(format: str | None = None):
    template = _read_template("kot_standard") or _read_template("invoice_standard") or ""
    return ok(template=template, description="Client-side receipt/KOT template")


@frappe.whitelist(methods=["GET"])
def get_client_side_template(template_name: str):
    template = _read_template(template_name)
    if template is None:
        return fail(f"Unknown template '{template_name}'")
    return ok(template=template)
