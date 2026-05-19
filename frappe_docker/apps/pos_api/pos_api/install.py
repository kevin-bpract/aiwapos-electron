"""after_install hook — creates Roles, Custom Fields, default POS Settings record."""
import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


CUSTOM_ROLES = ["Cashier", "Restaurant Manager", "Waiter"]


ITEM_FIELDS = {
    "Item": [
        dict(fieldname="custom_is_favorite", label="Is Favorite",
             fieldtype="Check", insert_after="disabled"),
        dict(fieldname="custom_item_tag_list", label="Tag List (JSON)",
             fieldtype="Small Text", insert_after="custom_is_favorite"),
        dict(fieldname="item_name_arabic", label="Item Name (Arabic)",
             fieldtype="Data", insert_after="item_name"),
    ],
    "Customer": [
        dict(fieldname="custom_is_default_customer", label="Is Default Customer",
             fieldtype="Check", insert_after="disabled"),
        dict(fieldname="custom_customer_arabic_name", label="Customer Name (Arabic)",
             fieldtype="Data", insert_after="customer_name"),
        dict(fieldname="custom_crn_no", label="CRN",
             fieldtype="Data", insert_after="tax_id"),
    ],
    "Sales Order": [
        dict(fieldname="restaurant_order_type", label="Order Type",
             fieldtype="Select",
             options="\nDining\nParcel\nDelivery",
             insert_after="order_type"),
        dict(fieldname="table_no", label="Table No",
             fieldtype="Data", insert_after="restaurant_order_type"),
        dict(fieldname="order_notes", label="Kitchen Notes",
             fieldtype="Small Text", insert_after="table_no"),
    ],
    "Sales Invoice": [
        dict(fieldname="restaurant_order_type", label="Order Type",
             fieldtype="Select",
             options="\nDining\nParcel\nDelivery",
             insert_after="is_pos"),
        dict(fieldname="table_no", label="Table No",
             fieldtype="Data", insert_after="restaurant_order_type"),
        dict(fieldname="order_notes", label="Kitchen Notes",
             fieldtype="Small Text", insert_after="table_no"),
    ],
}


def after_install():
    _make_roles()
    create_custom_fields(ITEM_FIELDS, update=True)
    _ensure_pos_settings()
    frappe.db.commit()


def _make_roles():
    for r in CUSTOM_ROLES:
        if not frappe.db.exists("Role", r):
            doc = frappe.new_doc("Role")
            doc.role_name = r
            doc.desk_access = 1
            doc.insert(ignore_permissions=True)


def _ensure_pos_settings():
    if frappe.db.exists("DocType", "POS Settings") and not frappe.db.exists("POS Settings", "POS Settings"):
        # Single DocType — get_single creates the row
        frappe.get_single("POS Settings")
