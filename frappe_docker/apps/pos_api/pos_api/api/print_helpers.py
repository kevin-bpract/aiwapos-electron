"""HTML/PDF rendering helpers."""
from __future__ import annotations

import frappe
from frappe.utils.pdf import get_pdf

from ._utils import ok, fail


def _render_html(doctype: str, name: str, print_format: str | None = None) -> str:
    return frappe.get_print(doctype, name, print_format=print_format)


def _send_pdf(html: str, filename: str):
    pdf = get_pdf(html)
    frappe.local.response.filename = filename
    frappe.local.response.filecontent = pdf
    frappe.local.response.type = "pdf"


@frappe.whitelist(methods=["GET"])
def get_sales_invoice_print_html(sales_invoice: str, format: str | None = None):
    if not frappe.db.exists("Sales Invoice", sales_invoice):
        return fail("Invoice not found")
    return {"html": _render_html("Sales Invoice", sales_invoice, format or "POS Receipt - Aiwa")}


@frappe.whitelist(methods=["GET"])
def get_sales_order_print_html(sales_order: str, format: str | None = None):
    if not frappe.db.exists("Sales Order", sales_order):
        return fail("Sales Order not found")
    return {"html": _render_html("Sales Order", sales_order, format or "KOT - Aiwa")}


@frappe.whitelist(methods=["GET"])
def print_sales_invoice_pdf(sales_invoice: str, print_format: str | None = None):
    if not frappe.db.exists("Sales Invoice", sales_invoice):
        return fail("Invoice not found")
    html = _render_html("Sales Invoice", sales_invoice, print_format or "POS Receipt - Aiwa")
    _send_pdf(html, f"{sales_invoice}.pdf")


@frappe.whitelist(methods=["GET"])
def print_sales_order_pdf(sales_order: str, format: str | None = None):
    if not frappe.db.exists("Sales Order", sales_order):
        return fail("Sales Order not found")
    html = _render_html("Sales Order", sales_order, format or "KOT - Aiwa")
    _send_pdf(html, f"{sales_order}.pdf")


@frappe.whitelist(methods=["GET"])
def get_shift_closing_print_html(shift_closing_entry: str):
    if not frappe.db.exists("Shift Closing Entry", shift_closing_entry):
        return fail("Shift closing entry not found")
    return {"html": _render_html("Shift Closing Entry", shift_closing_entry, "Z-Report - Aiwa")}


@frappe.whitelist(methods=["GET"])
def get_sales_invoice_print_data(sales_invoice: str):
    """Structured payload for the client-side Handlebars receipt template."""
    if not frappe.db.exists("Sales Invoice", sales_invoice):
        return fail("Invoice not found")

    doc = frappe.get_doc("Sales Invoice", sales_invoice)
    company = frappe.get_doc("Company", doc.company) if doc.company else None

    # Company address (flatten)
    company_address = None
    if doc.company_address:
        try:
            addr = frappe.get_doc("Address", doc.company_address)
            company_address = {
                "line1": addr.address_line1,
                "line2": addr.address_line2,
                "city": addr.city,
                "state": addr.state,
                "pincode": addr.pincode,
                "country": addr.country,
            }
        except Exception:
            company_address = None

    items = [
        {
            "item_code": it.item_code,
            "item_name": it.item_name,
            "qty": it.qty,
            "uom": it.uom,
            "rate": it.rate,
            "amount": it.amount,
            "tax_amount": getattr(it, "tax_amount", 0) or 0,
        }
        for it in (doc.items or [])
    ]

    payments = [
        {"mode_of_payment": p.mode_of_payment, "amount": p.amount}
        for p in (doc.payments or [])
    ]

    taxes = [
        {
            "description": (t.description or t.account_head or "Tax"),
            "account_head": t.account_head,
            "rate": float(t.rate or 0),
            "tax_amount": float(t.tax_amount or 0),
        }
        for t in (doc.taxes or [])
        if float(t.tax_amount or 0) != 0
    ]

    data = {
        "invoice_name": doc.name,
        "posting_date": frappe.utils.formatdate(doc.posting_date) if doc.posting_date else None,
        "posting_time": str(doc.posting_time) if doc.posting_time else None,
        "customer": doc.customer,
        "customer_name": doc.customer_name,
        "customer_phone": getattr(doc, "contact_mobile", None),
        "customer_tax_id": doc.tax_id,
        "company": doc.company,
        "company_name": company.company_name if company else doc.company,
        "company_address": company_address,
        "company_phone": getattr(company, "phone_no", None) if company else None,
        "company_tax_id": getattr(company, "tax_id", None) if company else None,
        "company_logo": getattr(company, "company_logo", None) if company else None,
        "restaurant_order_type": getattr(doc, "custom_order_type", None),
        "reference_number": doc.po_no or None,
        "totals": {
            "net_total": doc.net_total,
            "grand_total": doc.grand_total,
            "rounded_total": getattr(doc, "rounded_total", None),
            "discount_amount": doc.discount_amount or 0,
        },
        "total_taxes_and_charges": doc.total_taxes_and_charges or 0,
        "delivery_charge_amount": getattr(doc, "custom_delivery_charge_amount", 0) or 0,
        "change": getattr(doc, "change_amount", 0) or 0,
        "paid_amount": doc.paid_amount,
        "items": items,
        "payments": payments,
        "taxes": taxes,
        "footer_text": doc.terms or None,
    }
    return ok(data=data)


@frappe.whitelist(methods=["GET"])
def print_session_report_pdf(shift_closing_entry: str, thermal: int = 0, width: int = 80):
    if not frappe.db.exists("Shift Closing Entry", shift_closing_entry):
        return fail("Shift closing entry not found")
    html = _render_html("Shift Closing Entry", shift_closing_entry, "Z-Report - Aiwa")
    _send_pdf(html, f"{shift_closing_entry}.pdf")
