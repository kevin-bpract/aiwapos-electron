"""Shared helpers used across pos_api endpoints."""
from __future__ import annotations

import json
from typing import Any

import frappe
from frappe import _


def ok(**fields: Any) -> dict:
    """Standard success envelope."""
    return {"success_key": 1, **fields}


def fail(message: str, **fields: Any) -> dict:
    """Standard failure envelope (still 200 OK — client checks success_key)."""
    return {"success_key": 0, "message": message, **fields}


def parse_json_param(value, default):
    """Accept a JSON string or a list/dict and return the parsed value."""
    if value is None or value == "":
        return default
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def current_user() -> str:
    return frappe.session.user


def is_privileged(view_all_role: str | None = None) -> bool:
    """True if the session user has the role allowed to view everyone's data."""
    if not view_all_role:
        try:
            view_all_role = frappe.db.get_single_value(
                "POS Settings", "view_all_transaction_role"
            )
        except Exception:
            view_all_role = None
    if not view_all_role:
        return "System Manager" in frappe.get_roles(frappe.session.user)
    return view_all_role in frappe.get_roles(frappe.session.user)


def require_login():
    if frappe.session.user in (None, "", "Guest"):
        frappe.throw(_("Authentication required"), frappe.AuthenticationError)
