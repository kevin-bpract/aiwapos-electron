/**
 * KOT (Kitchen Order Ticket) print APIs.
 *
 * Three endpoints:
 *   - get_kot_print_formats  → list client templates + server Print Formats
 *   - get_kot_print_data     → raw KOT data (JSON) for local template rendering
 *   - get_kot_print_html     → fully-rendered HTML (one-call convenience)
 */

export interface KotClientTemplate {
  name: string;
  type: 'client_template';
  file: string;
  description?: string;
  usage?: string;
}

export interface KotServerPrintFormat {
  name: string;
  type: 'server_print_format';
  doctype?: string;
  module?: string;
}

export interface GetKotPrintFormatsResponse {
  default_format: string | null;
  client_templates: KotClientTemplate[];
  server_print_formats: KotServerPrintFormat[];
  client_count: number;
  server_count: number;
}

export async function getKotPrintFormats(): Promise<GetKotPrintFormatsResponse> {
  const res = (await window.api.get(
    '/api/method/pos_api.api.get_kot_print_formats',
    { withCredentials: true },
  )) as any;

  const msg = res?.message;
  if (!msg || msg.success_key !== 1) {
    throw new Error(msg?.message || 'Failed to fetch KOT print formats');
  }

  return {
    default_format: msg.default_format ?? null,
    client_templates: Array.isArray(msg.client_templates) ? msg.client_templates : [],
    server_print_formats: Array.isArray(msg.server_print_formats)
      ? msg.server_print_formats
      : [],
    client_count: msg.client_count ?? 0,
    server_count: msg.server_count ?? 0,
  };
}

export interface KotDataItem {
  item_code: string;
  item_name: string;
  item_name_ar?: string | null;
  qty: number;
  uom?: string;
  item_group?: string;
  notes?: string | null;
}

export interface KotData {
  order_no: string;
  order_type?: string;
  restaurant_order_type?: string;
  is_dine_in?: boolean;
  is_parcel?: boolean;
  is_delivery?: boolean;
  table_number?: string | null;
  order_time?: string;
  order_date?: string;
  customer?: string;
  customer_name?: string;
  cashier?: string;
  sales_person?: string;
  remarks?: string | null;
  items: KotDataItem[];
  total_items: number;
  total_qty: number;
}

export interface KotSource {
  sales_order?: string;
  sales_invoice?: string;
}

function buildQuery(source: KotSource, extra: Record<string, string> = {}): string {
  const qp = new URLSearchParams(extra);
  if (source.sales_order) qp.set('sales_order', source.sales_order);
  if (source.sales_invoice) qp.set('sales_invoice', source.sales_invoice);
  return qp.toString();
}

export async function getKotPrintData(source: KotSource): Promise<KotData | null> {
  if (!source.sales_order && !source.sales_invoice) return null;
  const qs = buildQuery(source);
  const res = (await window.api.get(
    `/api/method/pos_api.api.get_kot_print_data?${qs}`,
    { withCredentials: true },
  )) as any;

  const msg = res?.message;
  if (!msg || msg.success_key !== 1 || !msg.data) {
    throw new Error(msg?.message || 'Failed to fetch KOT print data');
  }
  return msg.data as KotData;
}

export interface GetKotPrintHtmlResponse {
  html: string;
  format?: string;
  source?: string;
  order_no?: string;
  order_type?: string;
}

export async function getKotPrintHtml(
  source: KotSource,
  format?: string,
): Promise<GetKotPrintHtmlResponse | null> {
  if (!source.sales_order && !source.sales_invoice) return null;
  const extra: Record<string, string> = {};
  if (format) extra.format = format;
  const qs = buildQuery(source, extra);
  const res = (await window.api.get(
    `/api/method/pos_api.api.get_kot_print_html?${qs}`,
    { withCredentials: true },
  )) as any;

  const msg = res?.message;
  if (!msg || msg.success_key !== 1 || !msg.html) {
    throw new Error(msg?.message || 'Failed to fetch KOT print HTML');
  }
  return {
    html: msg.html,
    format: msg.format,
    source: msg.source,
    order_no: msg.order_no,
    order_type: msg.order_type,
  };
}
