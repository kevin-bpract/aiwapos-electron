import frappe
from frappe.model.document import Document


class ShiftClosingEntry(Document):
    def before_insert(self):
        if not self.user:
            self.user = frappe.session.user
        if not self.company:
            opening = frappe.db.get_value(
                "Shift Opening Entry", self.shift_opening_entry,
                ["company", "cash_in_hand"], as_dict=True,
            )
            if opening:
                self.company = opening.company
                if not self.cash_in_hand:
                    self.cash_in_hand = opening.cash_in_hand

    def validate(self):
        self.difference = (self.cash_count or 0) - (self._expected_cash())

    def _expected_cash(self) -> float:
        return (self.cash_in_hand or 0) + (self.cash_sales or 0)

    def on_submit(self):
        if self.shift_opening_entry:
            frappe.db.set_value(
                "Shift Opening Entry", self.shift_opening_entry, "status", "Closed"
            )
