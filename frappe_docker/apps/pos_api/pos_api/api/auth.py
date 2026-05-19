"""Authentication endpoints — token-based POS auth."""
from __future__ import annotations

import frappe
from frappe import _
from frappe.utils.password import check_password

from ._utils import ok, fail


def _ensure_api_credentials(user_doc) -> str:
    """Return `<api_key>:<api_secret>` for the given user, creating them if missing."""
    if not user_doc.api_key:
        user_doc.api_key = frappe.generate_hash(length=15)
    api_secret = frappe.generate_hash(length=15)
    user_doc.api_secret = api_secret
    user_doc.flags.ignore_permissions = True
    user_doc.save(ignore_permissions=True)
    frappe.db.commit()
    return f"{user_doc.api_key}:{api_secret}"


def _user_payload(user_doc) -> dict:
    return {
        "email": user_doc.name,
        "full_name": user_doc.full_name or user_doc.name,
        "user_image": user_doc.user_image or None,
    }


@frappe.whitelist(allow_guest=True, methods=["POST"])
def pos_login(usr: str | None = None, pwd: str | None = None):
    """Validate credentials and return an API token."""
    if not usr or not pwd:
        return fail("Username and password are required")

    try:
        user_name = frappe.db.get_value("User", {"name": usr}) or \
            frappe.db.get_value("User", {"username": usr}) or \
            frappe.db.get_value("User", {"email": usr})
        if not user_name:
            return fail("User not found")

        check_password(user_name, pwd)
    except frappe.AuthenticationError:
        return fail("Invalid credentials")
    except Exception as e:
        frappe.log_error(title="pos_login error", message=str(e))
        return fail("Login failed")

    user_doc = frappe.get_doc("User", user_name)
    if user_doc.enabled == 0:
        return fail("User is disabled")

    token = _ensure_api_credentials(user_doc)
    return ok(
        token=token,
        user_id=user_doc.name,
        email=user_doc.name,
        user=_user_payload(user_doc),
        message="Login successful",
    )


@frappe.whitelist(methods=["GET"])
def pos_validate_token():
    """If the Authorization header validated, session.user is set. Return user info."""
    if frappe.session.user in (None, "", "Guest"):
        return fail("Not authenticated")

    user_doc = frappe.get_doc("User", frappe.session.user)
    return ok(
        user_id=user_doc.name,
        email=user_doc.name,
        user=_user_payload(user_doc),
    )
