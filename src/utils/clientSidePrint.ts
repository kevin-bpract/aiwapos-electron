/**
 * Client-side printing: fetch invoice data from the API, render it into a
 * locally-cached Handlebars HTML template, and print the resulting static HTML
 * via Electron's printHTML.
 *
 * Rendering happens here (Handlebars) BEFORE the HTML is written to the
 * BrowserWindow, so there's no async DOM-mutation race against webContents.print().
 */

import Handlebars from 'handlebars';
import { resolvePageSize } from './printPageSize';

const TEMPLATE_FORMATS = ['standard', 'compact'] as const;
export type ReceiptFormat = (typeof TEMPLATE_FORMATS)[number];

/** Cache key used in app_config for a given format. */
function templateKey(format: ReceiptFormat): string {
  return `receipt_template_${format}`;
}

function templateName(format: ReceiptFormat): string {
  // Backend registry keys (see pos_api/api/kot.py CLIENT_TEMPLATES_REGISTRY):
  //   standard -> invoice_standard
  //   compact  -> invoice_compact (falls back to invoice_standard if absent)
  return format === 'standard' ? 'invoice_standard' : `invoice_${format}`;
}

// ---------------------------------------------------------------------------
// Template fetching & caching
// ---------------------------------------------------------------------------

/** Fetch a single receipt template from the server and cache it locally. */
export async function fetchAndCacheTemplate(
  format: ReceiptFormat,
): Promise<string> {
  const res = await window.api.get(
    `api/method/pos_api.api.get_client_side_template?template_name=${templateName(format)}`,
  );

  // Frappe wraps whitelisted-method responses in { message: ... }; the BE
  // payload is itself { message: { template, success } }, so the value we
  // want lives at res.message.message. Fall back to res.message in case the
  // wrapper is ever flattened.
  const payload = res?.message?.message ?? res?.message;
  const ok = payload?.success_key === 1 || payload?.success === true;
  if (!ok || !payload?.template) {
    const detail =
      typeof payload === 'string'
        ? payload
        : payload?.message || JSON.stringify(payload ?? res);
    throw new Error(`Failed to fetch receipt template (${format}): ${detail}`);
  }

  const html: string = payload.template;
  await window.app_config.save(templateKey(format), html);
  return html;
}

/** Fetch all available receipt templates and cache them. */
export async function fetchAndCacheAllTemplates(): Promise<void> {
  await Promise.all(TEMPLATE_FORMATS.map((f) => fetchAndCacheTemplate(f)));
}

/** Get a cached template (returns null when not yet fetched). */
export async function getCachedTemplate(
  format: ReceiptFormat,
): Promise<string | null> {
  return window.app_config.get(templateKey(format));
}

// ---------------------------------------------------------------------------
// Invoice data fetching
// ---------------------------------------------------------------------------

/** Fetch the print-ready data for a given sales invoice. */
export async function fetchInvoicePrintData(
  salesInvoice: string,
): Promise<any> {
  const res = await window.api.get(
    `api/method/pos_api.api.get_sales_invoice_print_data?sales_invoice=${encodeURIComponent(salesInvoice)}`,
  );

  if (res?.message?.success_key !== 1 || !res.message.data) {
    throw new Error(
      `Failed to fetch invoice print data: ${res?.message?.message || 'unknown error'}`,
    );
  }

  return res.message.data;
}

// ---------------------------------------------------------------------------
// Map BE payload -> template variables
// ---------------------------------------------------------------------------

/**
 * The BE endpoint pos_api.api.get_sales_invoice_print_data returns a structured
 * payload (nested totals, address object, different field names) while the
 * Handlebars receipt templates expect flat, string-friendly variables. This
 * transformer bridges the two so adding new templates only requires picking
 * field names from the table below, not changing the BE.
 *
 * Mapping (template var -> source):
 *   invoice_number          <- invoice_name
 *   invoice_date            <- posting_date
 *   timestamp               <- posting_date + posting_time
 *   total_amount            <- totals.grand_total
 *   subtotal                <- totals.net_total
 *   discount_amount         <- totals.discount_amount (when > 0)
 *   company_address         <- joined string of address object lines
 *   order_type              <- "Dine In" | "Parcel" | "Delivery" | restaurant_order_type
 *   qr_code_image           <- qr_code
 *   items / payments        <- passed through (already compatible)
 *
 * Anything the BE adds in the future is also forwarded under its original key,
 * so a template can reference new fields without touching this function.
 */
function flattenCompanyAddress(addr: any): string | null {
  if (!addr) return null;
  if (typeof addr === 'string') return addr;
  if (typeof addr !== 'object') return String(addr);
  const parts = [
    addr.line1,
    addr.line2,
    addr.city,
    addr.state,
    addr.pincode,
    addr.country,
  ].filter((p) => p && String(p).trim().length > 0);
  return parts.join(', ') || null;
}

function deriveOrderType(data: any): string | null {
  if (data?.is_dine_in) return 'Dine In';
  if (data?.is_parcel) return 'Parcel';
  if (data?.is_delivery) return 'Delivery';
  return data?.restaurant_order_type || null;
}

function fmt(n: any): string | null {
  if (n === null || n === undefined) return null;
  const num = typeof n === 'number' ? n : parseFloat(n);
  if (!isFinite(num)) return null;
  return num.toFixed(2);
}

export function mapInvoiceDataToTemplate(raw: any): Record<string, any> {
  if (!raw || typeof raw !== 'object') return {};
  const totals = raw.totals || {};
  const discountAmount =
    Number(totals.discount_amount) > 0 ? fmt(totals.discount_amount) : null;

  const mapped: Record<string, any> = {
    // Pass-through (lets future BE fields render without code change)
    ...raw,

    // Identification
    invoice_number: raw.invoice_name || raw.name || null,
    invoice_date: raw.posting_date || null,
    timestamp:
      raw.posting_date && raw.posting_time
        ? `${raw.posting_date} ${String(raw.posting_time).split('.')[0]}`
        : raw.posting_date || null,

    // Customer
    customer_name: raw.customer_name || raw.customer || null,
    customer_phone: raw.customer_phone || raw.contact_mobile || null,
    customer_tax_id: raw.customer_tax_id || null,

    // Company
    company_name: raw.company_name || raw.company || null,
    company_address: flattenCompanyAddress(raw.company_address),
    company_phone: raw.company_phone || null,
    company_tax_id: raw.company_tax_id || null,
    company_logo: raw.company_logo || null,

    // Order context
    order_type: deriveOrderType(raw),
    reference_number: raw.reference_number || raw.linked_sales_order || null,

    // Totals (flatten + format)
    subtotal: fmt(totals.net_total),
    total_amount: fmt(totals.rounded_total ?? totals.grand_total),
    discount_amount: discountAmount,
    charges: fmt(raw.charges),
    delivery_charge_amount:
      Number(raw.delivery_charge_amount) > 0
        ? fmt(raw.delivery_charge_amount)
        : null,
    credit_remainder: fmt(raw.credit_remainder),
    change: fmt(raw.change),

    // Items: format numeric fields so {{rate}}/{{amount}} render with 2dp
    items: Array.isArray(raw.items)
      ? raw.items.map((it: any) => ({
          ...it,
          qty: it.qty,
          rate: fmt(it.rate),
          amount: fmt(it.amount),
          tax_amount: Number(it.tax_amount) > 0 ? fmt(it.tax_amount) : null,
        }))
      : [],

    // Payments
    payments: Array.isArray(raw.payments)
      ? raw.payments.map((p: any) => ({
          mode_of_payment: p.mode_of_payment,
          amount: fmt(p.amount),
        }))
      : [],

    // Tax rows (one per Sales Taxes and Charges line)
    taxes: Array.isArray(raw.taxes)
      ? raw.taxes.map((t: any) => ({
          description: t.description || t.account_head || 'Tax',
          rate: t.rate != null ? Number(t.rate) : null,
          tax_amount: fmt(t.tax_amount),
        }))
      : [],

    // Misc
    qr_code_image: raw.qr_code_image || raw.qr_code || null,
    footer_text: raw.footer_text || null,
  };

  return mapped;
}

// ---------------------------------------------------------------------------
// Handlebars render
// ---------------------------------------------------------------------------

/**
 * Compile the Handlebars template and render it with the data. Returns a fully
 * static HTML string with no remaining `{{ ... }}` placeholders, ready to be
 * written to the BrowserWindow and printed.
 */
function renderTemplate(templateHtml: string, data: any): string {
  const compiled = Handlebars.compile(templateHtml, { noEscape: false });
  return compiled(data || {});
}

// ---------------------------------------------------------------------------
// Client-side print
// ---------------------------------------------------------------------------

export interface ClientSidePrintOptions {
  salesInvoice: string;
  format?: ReceiptFormat;
  printerName?: string;
}

/**
 * Full client-side print flow:
 * 1. Load cached template (or fetch if missing)
 * 2. Fetch invoice data from API
 * 3. Render template with Handlebars (static output, no runtime JS)
 * 4. Print via Electron printHTML
 */
export async function clientSidePrint(
  options: ClientSidePrintOptions,
): Promise<void> {
  const csT0 = performance.now();
  console.log('[PRINT-TIMING] clientSidePrint: start');
  const format = options.format || 'standard';

  // 1. Get template
  const tTpl = performance.now();
  let template = await getCachedTemplate(format);
  const cached = !!template;
  if (!template) {
    template = await fetchAndCacheTemplate(format);
  }
  console.log(
    `[PRINT-TIMING] clientSidePrint: template load = ${(performance.now() - tTpl).toFixed(1)}ms (cached=${cached}, len=${template?.length ?? 0})`,
  );

  // 2. Get invoice data
  const tData = performance.now();
  const data = await fetchInvoicePrintData(options.salesInvoice);
  console.log(
    `[PRINT-TIMING] clientSidePrint: fetchInvoicePrintData = ${(performance.now() - tData).toFixed(1)}ms`,
  );

  // 3. Render with Handlebars. The BE returns a structured payload (nested
  // totals, address object, different field names) — flatten it to match the
  // template variables before compile.
  const templateData = mapInvoiceDataToTemplate(data);
  console.log('[CLIENT-PRINT][DEBUG] raw BE data:', data);
  console.log('[CLIENT-PRINT][DEBUG] mapped template data:', templateData);

  const tRender = performance.now();
  const html = renderTemplate(template, templateData);
  console.log(
    `[PRINT-TIMING] clientSidePrint: handlebars render = ${(performance.now() - tRender).toFixed(1)}ms (len=${html.length})`,
  );
  console.log('[CLIENT-PRINT][DEBUG] rendered HTML:\n', html);

  // 4. Determine printer + page size
  const tSettings = performance.now();
  const settings = await window.printerSettings.get();
  console.log(
    `[PRINT-TIMING] clientSidePrint: printerSettings.get = ${(performance.now() - tSettings).toFixed(1)}ms`,
  );
  const useSeparate = settings?.useSeparatePrinters || false;
  const printerName =
    options.printerName ||
    (useSeparate && settings?.invoicePrinter
      ? settings.invoicePrinter
      : settings?.printer) ||
    '';

  if (!printerName) {
    throw new Error('No printer selected in settings');
  }

  const pageSize = resolvePageSize(settings);
  console.log(
    `[CLIENT-PRINT][DEBUG] resolved pageSize=${pageSize} (printerType=${settings?.printerType}, posPrinterWidth=${settings?.posPrinterWidth}, paperSize=${settings?.paperSize})`,
  );

  // 5. Print
  const tPrint = performance.now();
  await window.printers.printHTML(html, printerName, { pageSize });
  console.log(
    `[PRINT-TIMING] clientSidePrint: printers.printHTML = ${(performance.now() - tPrint).toFixed(1)}ms`,
  );
  console.log(
    `[PRINT-TIMING] clientSidePrint: TOTAL = ${(performance.now() - csT0).toFixed(1)}ms`,
  );
}
