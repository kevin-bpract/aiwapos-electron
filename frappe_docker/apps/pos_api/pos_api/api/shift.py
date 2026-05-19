"""Shift / cash session endpoints."""
from __future__ import annotations

import frappe
from frappe.utils import cint, flt, getdate, nowdate, nowtime

from ._utils import ok, fail, parse_json_param, is_privileged


def _denom_amount(rows: list[dict]) -> float:
    total = 0.0
    for r in rows or []:
        try:
            total += float(r.get("denomination") or 0) * float(r.get("quantity") or 0)
        except (TypeError, ValueError):
            continue
    return total


@frappe.whitelist(methods=["POST"])
def create_shift_opening_entry(cash_in_hand: float = 0, amount_denomination=None,
                               remarks: str | None = None):
    denoms = parse_json_param(amount_denomination, []) or []

    doc = frappe.new_doc("Shift Opening Entry")
    doc.user = frappe.session.user
    doc.shift_date = nowdate()
    doc.posting_time = nowtime()
    doc.cash_in_hand = flt(cash_in_hand) or _denom_amount(denoms)
    doc.remarks = remarks
    for d in denoms:
        doc.append("amount_denomination", dict(
            denomination=str(d.get("denomination")),
            quantity=cint(d.get("quantity") or 0),
        ))
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "docstatus": doc.docstatus}


@frappe.whitelist(methods=["GET"])
def get_open_shift():
    name = frappe.db.get_value(
        "Shift Opening Entry",
        {"user": frappe.session.user, "status": "Open"},
        "name",
        order_by="creation desc",
    )
    if not name:
        return ok(name=None, cash_in_hand=0, status="None")
    doc = frappe.get_doc("Shift Opening Entry", name)
    return ok(name=doc.name, cash_in_hand=flt(doc.cash_in_hand), status=doc.status)


def _shift_aggregates(opening_name: str) -> dict:
    """Aggregate sales since a shift opened, for the same user."""
    opening = frappe.get_doc("Shift Opening Entry", opening_name)
    from_dt = f"{opening.shift_date} {opening.posting_time or '00:00:00'}"
    invoices = frappe.db.sql(
        """
        SELECT name, grand_total, total_qty
        FROM `tabSales Invoice`
        WHERE owner = %s AND docstatus = 1 AND creation >= %s
        """,
        (opening.user, from_dt),
        as_dict=True,
    )
    inv_names = [i.name for i in invoices]
    pay_rows = []
    if inv_names:
        pay_rows = frappe.db.sql(
            """
            SELECT mode_of_payment, SUM(amount) AS amount
            FROM `tabSales Invoice Payment`
            WHERE parent IN %(names)s
            GROUP BY mode_of_payment
            """,
            {"names": tuple(inv_names)},
            as_dict=True,
        )
    by_mode = {r.mode_of_payment: flt(r.amount) for r in pay_rows}
    return dict(
        invoices=invoices,
        invoice_count=len(invoices),
        total_sales=sum(flt(i.grand_total) for i in invoices),
        total_quantity=sum(flt(i.total_qty) for i in invoices),
        cash_sales=by_mode.get("Cash", 0),
        card_sales=by_mode.get("Card", 0),
        credit_sales=by_mode.get("Credit", 0),
        upi_sales=by_mode.get("UPI", 0),
        wallet_sales=by_mode.get("Wallet", 0),
    )


@frappe.whitelist(methods=["GET"])
def get_live_shift_report():
    opening_name = frappe.db.get_value(
        "Shift Opening Entry",
        {"user": frappe.session.user, "status": "Open"},
        "name",
    )
    if not opening_name:
        return fail("No open shift")
    opening = frappe.get_doc("Shift Opening Entry", opening_name)
    agg = _shift_aggregates(opening_name)
    return ok(
        shift_opening_entry=opening_name,
        cash_in_hand=flt(opening.cash_in_hand),
        total_cash_received=agg["cash_sales"],
        cash_sales=agg["cash_sales"],
        card_sales=agg["card_sales"],
        credit_sales=agg["credit_sales"],
        total_sales=agg["total_sales"],
        total_quantity=agg["total_quantity"],
        invoices_count=agg["invoice_count"],
    )


@frappe.whitelist(methods=["POST"])
def create_shift_closing_entry(shift_opening_entry: str, cash_count: float = 0,
                               amount_denomination=None, difference: float | None = None,
                               remarks: str | None = None):
    if not frappe.db.exists("Shift Opening Entry", shift_opening_entry):
        return fail("Opening entry not found")
    denoms = parse_json_param(amount_denomination, []) or []
    agg = _shift_aggregates(shift_opening_entry)
    opening = frappe.get_doc("Shift Opening Entry", shift_opening_entry)

    doc = frappe.new_doc("Shift Closing Entry")
    doc.shift_opening_entry = shift_opening_entry
    doc.user = opening.user
    doc.company = opening.company
    doc.shift_date = opening.shift_date
    doc.cash_in_hand = opening.cash_in_hand
    doc.cash_count = flt(cash_count) or _denom_amount(denoms)
    doc.cash_sales = agg["cash_sales"]
    doc.card_sales = agg["card_sales"]
    doc.credit_sales = agg["credit_sales"]
    doc.total_sales = agg["total_sales"]
    doc.total_quantity = agg["total_quantity"]
    doc.invoices_count = agg["invoice_count"]
    if difference is not None:
        doc.difference = flt(difference)
    doc.remarks = remarks
    for d in denoms:
        doc.append("amount_denomination", dict(
            denomination=str(d.get("denomination")),
            quantity=cint(d.get("quantity") or 0),
        ))
    doc.insert(ignore_permissions=True)
    doc.submit()
    frappe.db.commit()
    return {"name": doc.name, "docstatus": doc.docstatus}


@frappe.whitelist(methods=["GET"])
def get_my_sessions(from_date: str | None = None, to_date: str | None = None,
                    status: str | None = None, limit_page_length: int = 20,
                    name: str | None = None, include_details: int = 0):
    filters = {}
    if not is_privileged():
        filters["user"] = frappe.session.user
    if from_date:
        filters["shift_date"] = [">=", getdate(from_date)]
    if to_date:
        if "shift_date" in filters:
            filters["shift_date"] = ["between", [getdate(from_date), getdate(to_date)]]
        else:
            filters["shift_date"] = ["<=", getdate(to_date)]
    if name:
        filters["name"] = name

    openings = frappe.get_all(
        "Shift Opening Entry", filters=filters,
        fields=["name", "user", "shift_date", "status", "cash_in_hand"],
        order_by="shift_date desc, creation desc",
        limit_page_length=cint(limit_page_length),
    )
    sessions = []
    for o in openings:
        if status and o.status != status:
            continue
        closing = frappe.db.get_value(
            "Shift Closing Entry",
            {"shift_opening_entry": o.name, "docstatus": 1},
            ["cash_count", "total_sales", "invoices_count"],
            as_dict=True,
        ) or {}
        sessions.append(dict(
            name=o.name,
            user=o.user,
            shift_date=str(o.shift_date),
            status=o.status,
            opening_balance=flt(o.cash_in_hand),
            closing_balance=flt(closing.get("cash_count") or 0),
            cash_received=flt(closing.get("cash_count") or 0),
            invoices_count=cint(closing.get("invoices_count") or 0),
            total_sales=flt(closing.get("total_sales") or 0),
        ))
    return ok(sessions=sessions, entries=sessions)


@frappe.whitelist(methods=["GET"])
def get_session_report(shift_closing_entry: str):
    if not frappe.db.exists("Shift Closing Entry", shift_closing_entry):
        return fail("Shift closing entry not found")
    doc = frappe.get_doc("Shift Closing Entry", shift_closing_entry)
    denoms = [
        dict(
            denomination=float(d.denomination) if d.denomination else 0,
            qty=cint(d.quantity),
            amount=flt(d.amount),
        ) for d in doc.amount_denomination
    ]
    return ok(
        session_opening_entry=doc.shift_opening_entry,
        session_closing_entry=doc.name,
        date=str(doc.shift_date),
        user=doc.user,
        opening_balance=flt(doc.cash_in_hand),
        cash_sales=flt(doc.cash_sales),
        card_sales=flt(doc.card_sales),
        credit_sales=flt(doc.credit_sales),
        total_invoices=cint(doc.invoices_count),
        total_quantity=flt(doc.total_quantity),
        cash_counted=flt(doc.cash_count),
        difference=flt(doc.difference),
        denomination_details=denoms,
    )
