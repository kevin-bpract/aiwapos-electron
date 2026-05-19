"""
pos_api.api package — every public endpoint the Aiwa POS client calls.
Methods are re-exported here so the client can call e.g. `pos_api.api.pos_login`.
"""
from .auth import pos_login, pos_validate_token  # noqa: F401
from .items import (  # noqa: F401
    get_items, sync_items, sync_stock, get_item_details,
    create_item, update_item, update_item_favorite, get_item_groups,
)
from .customers import get_customers, create_customer, update_customer  # noqa: F401
from .settings import (  # noqa: F401
    get_pos_settings, get_company_default_currency,
    get_mode_of_payments, get_uom_list, get_print_formats,
)
from .sales_order import (  # noqa: F401
    create_sales_order, update_sales_order, get_sales_order,
    get_my_orders, delete_draft_sales_order, convert_sales_orders_to_invoice,
)
from .sales_invoice import (  # noqa: F401
    create_sales_invoice, submit_sales_invoice, get_my_invoices,
    get_sales_history, get_sales_summary,
    generate_invoice_qr, get_invoice_qr,
)
from .shift import (  # noqa: F401
    create_shift_opening_entry, get_open_shift, get_live_shift_report,
    create_shift_closing_entry, get_my_sessions, get_session_report,
)
from .kot import (  # noqa: F401
    get_kot_print_formats, get_kot_print_data, get_kot_print_html,
    get_receipt_template, get_client_side_template,
)
from .print_helpers import (  # noqa: F401
    get_sales_invoice_print_html, get_sales_order_print_html,
    print_sales_invoice_pdf, print_sales_order_pdf,
    get_shift_closing_print_html, print_session_report_pdf,
    get_sales_invoice_print_data,
)
