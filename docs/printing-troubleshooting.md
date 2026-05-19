# POS Receipt Printing — Troubleshooting & Fixes

End-to-end record of every issue we hit when wiring up POS receipt printing
(Frappe backend → Electron app → 80mm thermal printer), with the exact root
cause, the code change, and how to reproduce/verify each fix.

The stack:

- **Frappe/ERPNext** in Docker (`devcontainer-example` compose project,
  service `frappe`, runs `bench start` on `aiwapos.localhost:8000`).
- **Electron POS app** (`aiwapos`) — main process talks to Frappe via Axios,
  renderer uses Handlebars for the client-side template path.
- **Thermal printer** — `Printer_POS-80C` (CUPS queue on Arch Linux).

Three print paths to keep straight:

1. **Server HTML** — Frappe renders the *Sales Invoice* print format to HTML;
   Electron loads it into a hidden `BrowserWindow` and calls
   `webContents.print()`.
2. **Server PDF** — Frappe renders the same format to a PDF, app sends the
   PDF to the printer.
3. **Client-side HTML** — Frappe ships a *Handlebars template* (cached
   locally) plus a JSON data endpoint. The renderer compiles the template,
   loads the rendered HTML into the `BrowserWindow`, prints.

---

## 1. `TypeError: Converting circular structure to JSON` on every POS invoice failure

### Symptom

Every failed POS invoice creation prints a giant stack ending in:

```
Error occurred in handler for 'invoice:createPOS': TypeError: Converting circular structure to JSON
    --> starting at object with constructor 'Agent'
    |     property 'sockets' -> object with constructor 'Object'
    |     ...
    --- property 'agent' closes the circle
    at JSON.stringify (<anonymous>)
    at logError (src/main/utils/logger.ts)
```

### Root cause

`logError` in `src/main/utils/logger.ts` calls `JSON.stringify(error.request, null, 2)`
when an HTTP request has no `error.response`. `error.request` is a Node
`ClientRequest` whose `agent.sockets[*]._httpMessage.agent` forms a cycle —
the stringify throws, masking the *real* HTTP error (the underlying
`ECONNREFUSED`).

### Fix

`src/main/utils/logger.ts:133`

```ts
} else if (error.request) {
  writeLog('Error: No response received from server');
  try {
    const req = error.request;
    const safe = {
      method: req.method,
      path: req.path,
      host: req.host || req.getHeader?.('host'),
      protocol: req.protocol,
    };
    writeLog(`Request Details: ${JSON.stringify(safe, null, 2)}`);
  } catch {
    writeLog('Request Details: [Unable to stringify]');
  }
}
```

### Verify

Stop the Frappe container, trigger any API call → instead of the circular
stringify crash, the log shows the safe scalar fields and the real
`ECONNREFUSED` cause.

---

## 2. Backend `ECONNREFUSED 127.0.0.1:8000`

### Symptom

```
Error: connect ECONNREFUSED 127.0.0.1:8000
```

`curl http://aiwapos.localhost:8000/` fails with "Failed to connect".

### Root cause

The Frappe stack lives in Docker. The project uses two compose files:

- `frappe_docker/devcontainer-example/docker-compose.yml` — db, redis, frappe
  dev container.
- `frappe_docker/development/aiwapos.compose.yaml` — override that publishes
  `8000:8000` and mounts the workspace.

Both must be brought up under the `devcontainer-example` project name so the
existing named volumes (with the configured `aiwapos.localhost` site) get
reused.

After containers are up, the `frappe` service is `sleep infinity` — `bench
start` has to be invoked inside it manually.

### Fix / reproduce

```bash
cd frappe_docker

# Optional first run only: copy .env so ERPNEXT_VERSION is resolved.
[ -f .env ] || cp example.env .env

# Bring up the dev stack under the original compose-project name.
docker compose -p devcontainer-example \
  -f devcontainer-example/docker-compose.yml \
  -f development/aiwapos.compose.yaml \
  up -d

# Start bench inside the frappe container (detached).
docker exec -d devcontainer-example-frappe-1 \
  bash -c "cd frappe-bench && bench start > /tmp/bench.log 2>&1"

# Verify (give it ~15s on first boot).
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://aiwapos.localhost:8000/
# → HTTP 200
```

---

## 3. `PrintFormatError: Unknown column 'custom_item_name_arabic'`

### Symptom

POS prints fail with HTTP 417 from
`/api/method/pos_api.api.get_sales_invoice_print_html`:

```
frappe.exceptions.PrintFormatError: Error in print format on line 230:
(1054, "Unknown column 'custom_item_name_arabic' in 'SELECT'")
```

### Root cause

The *Sales Invoice* print format calls
`frappe.db.get_value("Item", item.item_code, "custom_item_name_arabic")`
inside its Jinja, for an Arabic item-name field that was never installed on
this site. Neither the Custom Field nor the underlying column exists.

### Fix

Remove the Arabic references from the print format (no Arabic support in
this build). Done by editing the `Print Format` doc HTML directly in the DB:

```bash
docker exec -i devcontainer-example-frappe-1 bash -lc \
  "cd frappe-bench && bench --site aiwapos.localhost console" <<'PY'
import frappe
pf = frappe.get_doc('Print Format', 'Sales Invoice')
old1 = '''<td colspan="4" style="word-wrap: break-word; white-space: normal;">{{ item.idx }}. {{ item.item_name }}   <br>
           {{ frappe.db.get_value("Item", item.item_code, "custom_item_name_arabic") }}</td>
           </td>'''
new1 = '''<td colspan="4" style="word-wrap: break-word; white-space: normal;">{{ item.idx }}. {{ item.item_name }}</td>'''
pf.html = pf.html.replace(old1, new1)

old2 = '''{{ row.item_name }}
            {%- set arabic_name = frappe.db.get_value("Item", row.item_code, "custom_item_name_arabic") -%}
            {% if arabic_name %}
                <br>{{ arabic_name }}
            {% endif %}'''
pf.html = pf.html.replace(old2, '{{ row.item_name }}')

pf.save(ignore_permissions=True)
frappe.db.commit()
PY
```

---

## 4. `PrintFormatError: 'get_zatca_phase_1_qr_for_invoice' is undefined`

### Symptom

Same endpoint, next exception:

```
Error in print format on line 286: 'get_zatca_phase_1_qr_for_invoice' is undefined
```

### Root cause

The print format renders a ZATCA QR code via a Jinja helper from a
ZATCA-compliance app that isn't installed. Both the active QR `<div>` *and*
the commented-out one cause the error — Jinja evaluates `{{ ... }}`
expressions even inside HTML comments.

### Fix

Strip both QR blocks from the print format:

```bash
docker exec -i devcontainer-example-frappe-1 bash -lc \
  "cd frappe-bench && bench --site aiwapos.localhost console" <<'PY'
import frappe
pf = frappe.get_doc('Print Format', 'Sales Invoice')

# Active QR div
old_active = '''<div style="text-align:center; width:100%;">
    <img src="data:image/png;base64,{{ get_zatca_phase_1_qr_for_invoice(doc.name) }}"
         style="display:block; margin:0 auto; width:120px;">
</div>'''
pf.html = pf.html.replace(old_active, '')

# Commented QR line (still evaluated by Jinja!)
old_commented = '<!--    <img src="data:image/png;base64,{{ get_zatca_phase_1_qr_for_invoice(doc.name) }}" style="width:120px;">-->'
pf.html = pf.html.replace(old_commented, '')

pf.save(ignore_permissions=True)
frappe.db.commit()
frappe.clear_cache()
PY
```

### Verify

```bash
docker exec devcontainer-example-frappe-1 bash -lc \
  'cd frappe-bench && env/bin/python -c "
import os, frappe
os.chdir(\"sites\"); frappe.init(site=\"aiwapos.localhost\"); frappe.connect()
html = frappe.get_print(\"Sales Invoice\", \"ACC-SINV-2026-00042\", print_format=\"Sales Invoice\")
print(\"OK length:\", len(html))
"'
# → OK length: ~16000
```

---

## 5. False "Failed to create invoice" toast after successful creation

### Symptom

The invoice **was** created on the server, but the renderer shows
`Failed to create invoice.` because the success path also handles printing
and printer setup can throw.

### Root cause

`src/components/modals/restaurantcheckoutmodal/index.tsx` wrapped the entire
post-API flow (KOT print, printer settings fetch, invoice print,
`onComplete`) in the *same* try/catch as the API call. Any post-success
failure looked like a creation failure.

Plus the success check was too narrow:

```ts
response?.message?.success_key === 1 ||
response?.message?.message === 'Sales invoice created successfully'
```

If the backend returned a successful response with a different shape (just
`{ message: { name: "..." } }`), the code fell into the `else` branch which
toasts `'Failed to create invoice. ' + (response?.message?.message || '')`.

### Fix

`src/components/modals/restaurantcheckoutmodal/index.tsx:847`

```ts
const response = await createPOSInvoice(payload);
console.log('[RestaurantCheckout] POS Invoice response:', response);

const invoiceName =
  response?.message?.invoice?.name || response?.message?.name;
const isSuccess =
  response?.message?.success_key === 1 ||
  response?.message?.message === 'Sales invoice created successfully' ||
  !!invoiceName;

if (isSuccess) {
  if (!invoiceName) {
    toast.error('Invoice created but ID not found for printing.');
    return;
  }
  toast.success(`Invoice created successfully!\nID: ${invoiceName}`);

  // ... build checkoutData ...

  // Post-success side effects isolated so a failure here does NOT show
  // "Failed to create invoice" — the invoice already exists on the server.
  try {
    await printKotIfConfigured({ source: { sales_invoice: invoiceName }, print, title: `KOT - ${invoiceName}` });
    const printSettings = await window.printerSettings.get();
    if (printSettings?.askBeforeInvoicePrint === true) {
      if (window.confirm(`Invoice ${invoiceName} created successfully.\n\nPrint it now?`)) {
        await executeInvoicePrint(invoiceName);
      }
    } else {
      await executeInvoicePrint(invoiceName);
    }
  } catch (postErr) {
    console.error('Post-invoice side effects failed:', postErr);
    toast.error('Invoice created, but printing failed.');
  }

  onComplete?.(checkoutData);
  onClose();
}
```

---

## 6. Global Settings → "Invoice Print Format" dropdown only shows one option

### Symptom

Only `Default (POS Invoice)` is selectable, even though Frappe has multiple
Sales Invoice print formats.

### Root cause

`src/components/modals/globalsettings/index.tsx:213` mapped the wrong field
off the API response:

```ts
// API returns: [{ name, label, is_default }, ...]
// But code reads:
setPrintFormats(invoiceFormats.map((f: any) => f.print_format));
```

`f.print_format` is `undefined` → array of undefineds → dropdown empty.

### Fix

`src/components/modals/globalsettings/index.tsx:213`

```ts
setPrintFormats(invoiceFormats.map((f: any) => f.name || f.print_format));
// same for orderFormats
setOrderPrintFormats(formats.map((f: any) => f.name || f.print_format));
```

### Verify

Settings → Printing tab → click **Refresh List** → dropdown lists every
Sales Invoice format on the site (`Sales Invoice`, `POS Receipt - Aiwa`,
`Sales Invoice Return`, `Sales Auditing Voucher`, ...).

---

## 7. Server-HTML 80mm print: huge left margin / content clipped

### Symptom

In *Server HTML* mode at 80mm width, the receipt appears with a huge left
margin and most content cropped on the right.

### Root cause

`frappe.get_print(...)` returns the full Frappe **print view** page, which
wraps the format in `<div class="print-format-gutter">` with `padding:
0.75in` from Frappe's `print.bundle.css`. The print format's inline `<style>`
tries to override this with `!important`, but Frappe also uses `!important`
in places (e.g. `.print-format { padding: 6px !important }`), and rules with
equal specificity tie back to source order — Frappe's bundle wins.

### Fix

Inject a final-pass override stylesheet just before `</body>` for any
thermal page in the HTML print handler — last-loaded rule wins:

`src/main/main.ts` (in the `printers:printHTML` handler):

```ts
let printHtml = html;
if (isThermal) {
  const widthMm = typeof pageSize === 'object'
    ? Math.round(pageSize.width / 1000)
    : 72;
  const thermalOverride = `
<style>
  @page { margin: 0 !important; size: ${widthMm}mm auto !important; }
  html, body {
    width: ${widthMm}mm !important;
    min-width: 0 !important;
    max-width: ${widthMm}mm !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }
  .action-banner, .print-hide { display: none !important; }
  .print-format-gutter,
  .print-format-gutter > * {
    padding: 0 !important;
    margin: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-shadow: none !important;
    border: 0 !important;
  }
  .print-format {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 2mm !important;
    box-sizing: border-box !important;
  }
  .print-format * { box-sizing: border-box !important; }
</style>`;
  printHtml = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${thermalOverride}</body>`)
    : html + thermalOverride;
}
```

Also append an `@media print` hard-override to the *Sales Invoice* print
format itself (idempotent — re-running this just replaces the previous
block):

```python
# scripts/inject_thermal_overrides.py (run via env/bin/python from sites/)
import frappe, re
frappe.init(site="aiwapos.localhost"); frappe.connect()

EXTRA = r"""
<style>
/* === Aiwa thermal hard-overrides — last in source wins on equal specificity. */
@page { margin: 0 !important; size: 72mm auto !important; }
* { box-sizing: border-box !important; }
html, body {
  width: 72mm !important; min-width: 0 !important; max-width: 72mm !important;
  margin: 0 !important; padding: 0 !important; background: #fff !important;
}
.action-banner, .print-hide, .visible-pdf, .hidden-pdf { display: none !important; }
.print-format-gutter, .print-format-gutter > *,
.print-format-container, [class*="col-"],
.frappe-control, .print-format-main {
  width: 100% !important; max-width: 100% !important; min-width: 0 !important;
  margin: 0 !important; padding: 0 !important; border: 0 !important;
  box-shadow: none !important; background: transparent !important;
}
.print-format {
  width: 100% !important; max-width: 100% !important; min-width: 0 !important;
  margin: 0 !important; padding: 2mm 1.5mm !important;
  font-size: 12px !important; font-family: Arial, sans-serif !important;
}
@media print {
  @page { margin: 0 !important; size: 72mm auto !important; }
  html, body { width: 72mm !important; margin: 0 !important; padding: 0 !important; }
  .print-format-gutter, .print-format-gutter > * { padding: 0 !important; margin: 0 !important; }
  .print-format { padding: 2mm 1.5mm !important; }
}
</style>
"""

pf = frappe.get_doc("Print Format", "Sales Invoice")
html = pf.html
marker = "Aiwa thermal hard-overrides"
if marker in html:
    html = re.sub(r"<style>\s*/\*\s*===\s*Aiwa thermal hard-overrides[\s\S]*?</style>\s*", "", html)
idx = html.find("</style>")
insert_at = (idx + len("</style>")) if idx != -1 else 0
pf.html = html[:insert_at] + "\n" + EXTRA + html[insert_at:]
pf.save(ignore_permissions=True); frappe.db.commit(); frappe.clear_cache()
```

Also replaced `marginType: 'none'` with explicit zero custom margins
(`'none'` silently falls back to driver default on some Electron/OS combos):

`src/main/main.ts`

```ts
win.webContents.print({
  silent: true,
  deviceName: printerName || '',
  printBackground: true,
  margins: isThermal
    ? ({ marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 } as any)
    : { marginType: 'printableArea' },
  pageSize: pageSize as any,
}, ...);
```

---

## 8. Client-side printing: "Template not yet cached. Fetch it before printing."

### Symptom

In Global Settings → Printing → Client-Side Printing, clicking
**Fetch standard template** showed a giant red error containing the literal
template HTML.

### Root causes

Three bugs stacked:

**(a) Template-name mismatch** — frontend asked for `sales_invoice_standard`
but the backend registry only knows `invoice_standard` /
`invoice_compact`.

**(b) Response-shape check used wrong key** — frontend checked
`payload.success`; backend returns `payload.success_key === 1`. The check
failed, threw, and the catch block dumped the whole template into the error
toast.

**(c) Template wasn't actually Handlebars** — the BE file shipped
`invoice_standard.html` was a `<script>`-DOM-mutation template
(`window.RECEIPT_DATA`). The frontend pipeline runs Handlebars; with no
`{{...}}` placeholders the compile is a no-op, and the printed window then
relies on an injected `window.RECEIPT_DATA` that's never set → blank
receipt.

### Fix

**(a)** `src/utils/clientSidePrint.ts:21`

```ts
function templateName(format: ReceiptFormat): string {
  // BE registry keys (see pos_api/api/kot.py CLIENT_TEMPLATES_REGISTRY)
  return format === 'standard' ? 'invoice_standard' : `invoice_${format}`;
}
```

Add a `invoice_compact` registry alias so the UI's "Compact" option doesn't
404:

`frappe_docker/apps/pos_api/pos_api/api/kot.py`

```python
CLIENT_TEMPLATES_REGISTRY = {
    "kot_standard": dict(file="kot_standard.html", description="80mm KOT template", usage="kitchen"),
    "invoice_standard": dict(file="invoice_standard.html", description="80mm receipt", usage="receipt"),
    "invoice_compact": dict(file="invoice_standard.html", description="80mm receipt (compact)", usage="receipt"),
    "session_report": dict(file="session_report.html", description="Z-Report 80mm", usage="z-report"),
}
```

**(b)** `src/utils/clientSidePrint.ts:42`

```ts
const payload = res?.message?.message ?? res?.message;
const ok = payload?.success_key === 1 || payload?.success === true;
if (!ok || !payload?.template) {
  const detail = typeof payload === 'string'
    ? payload
    : payload?.message || JSON.stringify(payload ?? res);
  throw new Error(`Failed to fetch receipt template (${format}): ${detail}`);
}
```

**(c)** Rewrote `apps/pos_api/pos_api/templates/client_side/invoice_standard.html`
as a proper Handlebars template using the variables produced by
`mapInvoiceDataToTemplate`. See the file for the full template — relevant
variables it uses:

```
{{company_name}} {{company_address}} {{company_phone}} {{company_tax_id}}
{{invoice_number}} {{timestamp}} {{customer_name}} {{customer_phone}}
{{order_type}} {{reference_number}}
{{#each items}}{{item_name}} {{qty}} {{rate}} {{amount}} {{uom}}{{/each}}
{{subtotal}} {{discount_amount}} {{charges}} {{delivery_charge_amount}}
{{total_taxes_and_charges}} {{total_amount}}
{{#each payments}}{{mode_of_payment}} {{amount}}{{/each}}
{{credit_remainder}} {{change}} {{footer_text}}
```

### Verify

```
# In the app:
Settings → Printing → POS (Thermal) → enable Client-Side Printing →
Receipt Format: Standard → Fetch standard template → "Cached" badge appears.
Pay & Print → receipt prints.
```

---

## 9. Missing endpoint: `pos_api.api.get_sales_invoice_print_data`

### Symptom

After fetching the template successfully, the actual print failed with:

```
AttributeError: module 'pos_api.api' has no attribute 'get_sales_invoice_print_data'.
Did you mean: 'get_sales_invoice_print_html'?
```

### Root cause

The frontend (`clientSidePrint.ts → fetchInvoicePrintData`) calls a JSON
endpoint that doesn't exist on the BE. The HTML endpoint exists, but the
client side path needs structured data, not pre-rendered HTML.

### Fix

Add the endpoint that returns the structured invoice payload.

`frappe_docker/apps/pos_api/pos_api/api/print_helpers.py`

```python
@frappe.whitelist(methods=["GET"])
def get_sales_invoice_print_data(sales_invoice: str):
    """Structured payload for the client-side Handlebars receipt template."""
    if not frappe.db.exists("Sales Invoice", sales_invoice):
        return fail("Invoice not found")

    doc = frappe.get_doc("Sales Invoice", sales_invoice)
    company = frappe.get_doc("Company", doc.company) if doc.company else None

    company_address = None
    if doc.company_address:
        try:
            addr = frappe.get_doc("Address", doc.company_address)
            company_address = {
                "line1": addr.address_line1, "line2": addr.address_line2,
                "city": addr.city, "state": addr.state,
                "pincode": addr.pincode, "country": addr.country,
            }
        except Exception:
            company_address = None

    items = [{
        "item_code": it.item_code, "item_name": it.item_name,
        "qty": it.qty, "uom": it.uom,
        "rate": it.rate, "amount": it.amount,
        "tax_amount": getattr(it, "tax_amount", 0) or 0,
    } for it in (doc.items or [])]

    payments = [{"mode_of_payment": p.mode_of_payment, "amount": p.amount}
                for p in (doc.payments or [])]

    data = {
        "invoice_name": doc.name,
        "posting_date": frappe.utils.formatdate(doc.posting_date) if doc.posting_date else None,
        "posting_time": str(doc.posting_time) if doc.posting_time else None,
        "customer": doc.customer, "customer_name": doc.customer_name,
        "customer_phone": getattr(doc, "contact_mobile", None),
        "customer_tax_id": doc.tax_id,
        "company": doc.company,
        "company_name": company.company_name if company else doc.company,
        "company_address": company_address,
        "company_phone": getattr(company, "phone_no", None) if company else None,
        "company_tax_id": getattr(company, "tax_id", None) if company else None,
        "company_logo": getattr(company, "company_logo", None) if company else None,
        "restaurant_order_type": getattr(doc, "custom_order_type", None),
        "reference_number": doc.po_no or None,
        "totals": {
            "net_total": doc.net_total,
            "grand_total": doc.grand_total,
            "rounded_total": getattr(doc, "rounded_total", None),
            "discount_amount": doc.discount_amount or 0,
        },
        "total_taxes_and_charges": doc.total_taxes_and_charges or 0,
        "delivery_charge_amount": getattr(doc, "custom_delivery_charge_amount", 0) or 0,
        "change": getattr(doc, "change_amount", 0) or 0,
        "paid_amount": doc.paid_amount,
        "items": items, "payments": payments,
        "footer_text": doc.terms or None,
    }
    return ok(data=data)
```

Re-export from the package:

`frappe_docker/apps/pos_api/pos_api/api/__init__.py`

```python
from .print_helpers import (  # noqa: F401
    get_sales_invoice_print_html, get_sales_order_print_html,
    print_sales_invoice_pdf, print_sales_order_pdf,
    get_shift_closing_print_html, print_session_report_pdf,
    get_sales_invoice_print_data,
)
```

Restart bench so the new symbol is registered:

```bash
docker exec devcontainer-example-frappe-1 bash -lc \
  'pkill -f "bench worker|bench schedule|gunicorn|werkzeug|honcho|bench start" 2>/dev/null; true'
docker exec -d devcontainer-example-frappe-1 \
  bash -c "cd frappe-bench && bench start > /tmp/bench.log 2>&1"
```

### Verify

```bash
curl -sS "http://aiwapos.localhost:8000/api/method/pos_api.api.get_sales_invoice_print_data?sales_invoice=<INVOICE>" \
  -H "Authorization: token <api_key>:<api_secret>"
# → {"message":{"success_key":1,"data":{"invoice_name":...,"items":[...],"payments":[...]}}}
```

---

## 10. Print physically appeared as a thin vertical strip on the wrong side of the paper

### Symptom

Printed paper showed only the first 1–2 characters of each row, in a 4mm
column on the right edge of an A4-looking sheet.

### Root cause

Two-fold:

1. **`Printer_POS-80C`** is an "80mm" thermal printer, but the actual print
   head's printable width is **72mm**. Standard for POS-80C / XPrinter /
   Epson TM. Sending an 80mm-wide page made the driver clip/offset the
   8mm overflow.
2. CUPS queue's default `PageSize` (`X72MMY210MM`) had finite height that
   didn't agree with Electron's custom 80mm × 200mm request.

### Fix

(a) Pin CUPS queue default to a finite 72mm × 297mm page:

```bash
lpadmin -p Printer_POS-80C -o PageSize=X72MMY297MM
lpoptions -p Printer_POS-80C -l | grep PageSize
# → PageSize/Media Size: X72MMY210MM *X72MMY297MM X72MMY3276MM
```

(b) Match Electron's print pageSize and viewport to the *printable* width:

`src/main/main.ts`

```ts
if (options?.pageSize === '80mm') {
  // 80mm roll → 72mm printable width on POS-80C / XPrinter / Epson TM.
  // Height matches CUPS-supported X72MMY297MM so the driver doesn't
  // fall back to a mismatched default and cut early.
  pageSize = { width: 72000, height: 297000 };
  isThermal = true;
} else if (options?.pageSize === '58mm') {
  pageSize = { width: 48000, height: 297000 };
  isThermal = true;
}

// ... later, inside the thermal override block:
const widthMm = typeof pageSize === 'object'
  ? Math.round(pageSize.width / 1000)
  : 72;
```

(c) Change every `80mm` → `72mm` in the *Sales Invoice* print format and
the client-side `invoice_standard.html`:

```bash
# Print format (DB):
docker exec -i devcontainer-example-frappe-1 bash -lc \
  "cd frappe-bench/sites && ../env/bin/python -c '
import re, frappe
frappe.init(site=\"aiwapos.localhost\"); frappe.connect()
pf = frappe.get_doc(\"Print Format\", \"Sales Invoice\")
pf.html = re.sub(r\"\b80mm\b\", \"72mm\", pf.html)
pf.save(ignore_permissions=True); frappe.db.commit(); frappe.clear_cache()'"

# Client-side template (file):
sed -i 's/80mm/72mm/g' \
  frappe_docker/apps/pos_api/pos_api/templates/client_side/invoice_standard.html
```

### Why this works

- Driver, OS, and HTML all agree on the same 72mm logical width — no
  clipping or off-paper positioning.
- 297mm height is finite (not the 3276mm continuous mode), so the print
  spooler issues one cut at the end of the rendered content; receipts
  don't feed a meter of blank paper.

### Verify

Pay & Print on the POS → receipt is full-width on the strip, content
flows top-down, single cut at the end.

---

## Reproduction checklist (clean machine)

```bash
# 1) Start the stack
cd frappe_docker
[ -f .env ] || cp example.env .env
docker compose -p devcontainer-example \
  -f devcontainer-example/docker-compose.yml \
  -f development/aiwapos.compose.yaml up -d
docker exec -d devcontainer-example-frappe-1 \
  bash -c "cd frappe-bench && bench start > /tmp/bench.log 2>&1"
sleep 15
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://aiwapos.localhost:8000/   # → 200

# 2) Patch the Sales Invoice print format
#    (drops Arabic field refs, drops ZATCA QR, injects thermal overrides,
#     swaps 80mm → 72mm). One-shot script — see §3/§4/§7/§10.

# 3) Add the structured-data endpoint (§9), restart bench.

# 4) Configure CUPS for the thermal printer
lpadmin -p Printer_POS-80C -o PageSize=X72MMY297MM

# 5) Build / run the Electron app
npm install
npm start

# 6) In the app
#    Global Settings → Printing → POS (Thermal):
#      Default Printer: Printer_POS-80C
#      POS Paper Width: 80mm
#      Server HTML (or Enable Client-Side Printing + Fetch standard template)
#      Invoice Print Format: Sales Invoice  (or another)
#    Save → make a sale → Pay & Print.
```

---

## Files touched

| File | Reason |
|---|---|
| `src/main/utils/logger.ts` | Don't `JSON.stringify` `error.request` (cycle). |
| `src/main/main.ts` | Thermal pageSize 72mm × 297mm; explicit zero custom margins; final-pass thermal override CSS. |
| `src/components/modals/restaurantcheckoutmodal/index.tsx` | Broader success detection; isolated post-success try/catch. |
| `src/components/modals/globalsettings/index.tsx` | Read `f.name` instead of `f.print_format` from the formats API. |
| `src/utils/clientSidePrint.ts` | Template name now matches BE registry; check `success_key`. |
| `frappe_docker/apps/pos_api/pos_api/api/kot.py` | Add `invoice_compact` alias. |
| `frappe_docker/apps/pos_api/pos_api/api/print_helpers.py` | New endpoint `get_sales_invoice_print_data`. |
| `frappe_docker/apps/pos_api/pos_api/api/__init__.py` | Re-export new endpoint. |
| `frappe_docker/apps/pos_api/pos_api/templates/client_side/invoice_standard.html` | Rewritten as Handlebars; 72mm width. |
| Frappe **Print Format → Sales Invoice** (DB) | Removed Arabic refs + ZATCA QR; injected thermal overrides; 80mm → 72mm. |
| CUPS queue `Printer_POS-80C` | `PageSize=X72MMY297MM`. |

---

## Reference: numbers you need

| Logical paper | Roll width | Printable width | Microns sent to Electron |
|---|---|---|---|
| 80mm thermal | 80mm | **72mm** | `{ width: 72000, height: 297000 }` |
| 58mm thermal | 58mm | **48mm** | `{ width: 48000, height: 297000 }` |

Electron's `pageSize` is in microns (1/1000 mm). At 96 DPI, 72mm = ~272px,
which is the BrowserWindow viewport width we set before `loadURL` so
Chromium does its initial layout at the right size.
