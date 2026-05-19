app_name = "pos_api"
app_title = "POS API"
app_publisher = "Aiwa"
app_description = "Aiwa POS backend"
app_email = "dev@aiwa.test"
app_license = "MIT"

# Fixtures shipped with the app (custom fields + print formats + roles)
fixtures = [
    {"dt": "Custom Field", "filters": [["module", "=", "POS API"]]},
    {"dt": "Print Format", "filters": [["module", "=", "POS API"]]},
    {"dt": "Role", "filters": [["role_name", "in", ["Cashier", "Restaurant Manager", "Waiter"]]]},
]

# After-install hook installs custom fields, default roles, POS Settings record
after_install = "pos_api.install.after_install"

# Allow guest-less endpoints
override_whitelisted_methods = {}

# Document events — keep light; specifics added when needed.
doc_events = {}

# Required apps (validated at install)
required_apps = ["erpnext"]
