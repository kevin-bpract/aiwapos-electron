from frappe.model.document import Document


class ShiftDenominationRow(Document):
    def validate(self):
        try:
            denom = float(self.denomination)
        except (TypeError, ValueError):
            denom = 0
        self.amount = denom * (self.quantity or 0)
