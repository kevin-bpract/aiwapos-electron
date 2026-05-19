"""Customer endpoints."""
from __future__ import annotations

import frappe
from frappe.utils import cint

from ._utils import ok, fail


def _customer_to_dict(name: str) -> dict:
    c = frappe.db.get_value(
        "Customer",
        name,
        ["name", "customer_name", "mobile_no", "email_id", "tax_id",
         "customer_group", "territory", "disabled",
         "custom_crn_no", "custom_is_default_customer", "custom_customer_arabic_name"],
        as_dict=True,
    )
    if not c:
        return {}
    return dict(
        name=c.name,
        customer_name=c.customer_name,
        mobile_no=c.mobile_no or "",
        email_id=c.email_id or "",
        tax_id=c.tax_id or "",
        custom_crn_no=c.custom_crn_no or "",
        customer_group=c.customer_group or "",
        territory=c.territory or "",
        custom_is_default_customer=cint(c.custom_is_default_customer or 0),
        disabled=cint(c.disabled or 0),
        custom_customer_arabic_name=c.custom_customer_arabic_name or "",
    )


@frappe.whitelist(methods=["GET"])
def get_customers(limit_start: int = 0, limit_page_length: int = 500):
    names = frappe.get_all(
        "Customer", pluck="name",
        order_by="modified desc",
        limit_start=cint(limit_start),
        limit_page_length=cint(limit_page_length),
    )
    return ok(customers=[_customer_to_dict(n) for n in names])


@frappe.whitelist(methods=["POST"])
def create_customer(customer_name: str, customer_type: str = "Individual",
                    mobile_no: str | None = None, email_id: str | None = None,
                    tax_id: str | None = None,
                    custom_customer_arabic_name: str | None = None,
                    custom_crn_no: str | None = None):
    if frappe.db.exists("Customer", customer_name):
        return fail("Customer already exists")

    doc = frappe.new_doc("Customer")
    doc.customer_name = customer_name
    doc.customer_type = customer_type
    doc.customer_group = frappe.db.get_value(
        "Selling Settings", "Selling Settings", "customer_group"
    ) or "All Customer Groups"
    doc.territory = frappe.db.get_value(
        "Selling Settings", "Selling Settings", "territory"
    ) or "All Territories"
    if mobile_no:
        doc.mobile_no = mobile_no
    if email_id:
        doc.email_id = email_id
    if tax_id:
        doc.tax_id = tax_id
    if custom_customer_arabic_name:
        doc.custom_customer_arabic_name = custom_customer_arabic_name
    if custom_crn_no:
        doc.custom_crn_no = custom_crn_no
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return ok(message="Customer created", customer=_customer_to_dict(doc.name))


@frappe.whitelist(methods=["POST"])
def update_customer(customer_name: str, new_customer_name: str | None = None,
                    mobile_no: str | None = None, email_id: str | None = None,
                    disabled: int | None = None, tax_id: str | None = None,
                    custom_customer_arabic_name: str | None = None,
                    custom_crn_no: str | None = None):
    if not frappe.db.exists("Customer", customer_name):
        return fail("Customer not found")
    doc = frappe.get_doc("Customer", customer_name)
    if new_customer_name and new_customer_name != customer_name:
        doc.customer_name = new_customer_name
    if mobile_no is not None:
        doc.mobile_no = mobile_no
    if email_id is not None:
        doc.email_id = email_id
    if tax_id is not None:
        doc.tax_id = tax_id
    if disabled is not None:
        doc.disabled = cint(disabled)
    if custom_customer_arabic_name is not None:
        doc.custom_customer_arabic_name = custom_customer_arabic_name
    if custom_crn_no is not None:
        doc.custom_crn_no = custom_crn_no
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return ok(message="Customer updated", customer=_customer_to_dict(doc.name))
