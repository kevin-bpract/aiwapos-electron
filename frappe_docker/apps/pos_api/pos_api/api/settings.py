"""POS / company / payment / UOM / print-format settings endpoints."""
from __future__ import annotations

import frappe
from frappe.utils import cint

from ._utils import ok


@frappe.whitelist(methods=["GET"])
def get_pos_settings():
    s = frappe.get_single("POS Settings")
    return ok(settings=dict(
        company=s.company or "",
        view_all_transaction_role=s.view_all_transaction_role or "",
        default_target_warehouse=s.default_target_warehouse or "",
        is_this_tax_included_in_basic_rate=str(cint(s.is_this_tax_included_in_basic_rate)),
        enable_customer_based_price_list=cint(s.enable_customer_based_price_list),
        override_sales_team_in_customer=cint(s.override_sales_team_in_customer),
        payment_entry_based_on_sales_person=cint(s.payment_entry_based_on_sales_person),
        deduction_account=s.deduction_account or "",
        cost_center=s.cost_center or "",
        edit_item_rate=cint(s.edit_item_rate),
        table_list=[t for t in (s.table_list or "").splitlines() if t.strip()],
        mode_of_payment_details=[
            dict(mode_of_payment=r.mode_of_payment) for r in s.mode_of_payment_details
        ],
        sales_person_details=[
            dict(
                sales_person=r.sales_person or "",
                user=r.user or "",
                mode_of_payment=r.mode_of_payment or "",
                warehouse=r.warehouse or "",
                cost_center=r.cost_center or "",
                price_list=r.price_list or "",
                default_tax_category=r.default_tax_category,
                sales_taxes_and_charges=r.sales_taxes_and_charges,
                is_this_tax_included_in_basic_rate=cint(r.is_this_tax_included_in_basic_rate),
                last_sale_to_customer=cint(r.last_sale_to_customer),
                last_sale_price=cint(r.last_sale_price),
                last_purchase_cost=cint(r.last_purchase_cost),
                last_purchase_price=cint(r.last_purchase_price),
                warehouse_list=cint(r.warehouse_list),
                stock_quantity=cint(r.stock_quantity),
                uom=cint(r.uom),
                edit_item_rate=cint(r.edit_item_rate),
                enable_branch=cint(r.enable_branch),
                branch=r.branch,
            ) for r in s.sales_person_details
        ],
        print_format_details=[
            dict(
                print_format=r.print_format or "",
                label=r.label or "",
                doctype_name=r.doctype_name or "",
                is_default=cint(r.is_default),
                description=r.description,
            ) for r in s.print_format_details
        ],
    ))


@frappe.whitelist(methods=["GET"])
def get_company_default_currency():
    company = frappe.db.get_single_value("Global Defaults", "default_company")
    if not company:
        companies = frappe.get_all("Company", limit=1, pluck="name")
        company = companies[0] if companies else ""
    if not company:
        return ok(company="", default_currency="INR", country="India", abbr="")
    info = frappe.db.get_value(
        "Company", company,
        ["default_currency", "country", "abbr"],
        as_dict=True,
    ) or {}
    return ok(
        company=company,
        default_currency=info.get("default_currency") or "INR",
        country=info.get("country") or "India",
        abbr=info.get("abbr") or "",
    )


@frappe.whitelist(methods=["GET"])
def get_mode_of_payments():
    rows = frappe.get_all("Mode of Payment", fields=["name", "type"])
    default_mop = (
        frappe.db.get_value(
            "POS Sales Person Row",
            {"user": frappe.session.user},
            "mode_of_payment",
        )
        or (rows[0].name if rows else "Cash")
    )
    return ok(
        payment_modes=[dict(name=r.name, type=r.type or "Cash") for r in rows],
        user_mode_of_payment=default_mop,
    )


@frappe.whitelist(methods=["GET"])
def get_uom_list():
    rows = frappe.get_all("UOM", fields=["name"])
    return ok(uoms=[dict(name=r.name, conversion_factor=1) for r in rows])


@frappe.whitelist(methods=["GET"])
def get_print_formats(doctype_name: str):
    rows = frappe.get_all(
        "Print Format",
        filters={"doc_type": doctype_name},
        fields=["name"],
    )
    return ok(print_formats=[
        dict(name=r.name, label=r.name, is_default=0) for r in rows
    ])
