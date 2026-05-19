import frappe
from frappe.model.document import Document


class ShiftOpeningEntry(Document):
    def before_insert(self):
        if not self.user:
            self.user = frappe.session.user
        if not self.company:
            self.company = frappe.defaults.get_user_default("Company") or \
                frappe.db.get_single_value("Global Defaults", "default_company")
