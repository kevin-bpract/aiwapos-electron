/**
 * Client-side KOT printing: fetch raw data from the API, inject into a
 * locally-cached HTML template (get_receipt_template?format=<kot>), and let
 * renderReceipt() run on load via window.RECEIPT_DATA — mirrors the existing
 * session report / invoice client-print flow.
 *
 * When the chosen format is a server-side Print Format (not a client template),
 * falls back to get_kot_print_html which returns pre-rendered HTML.
 */

import {
  getKotPrintData,
  getKotPrintHtml,
  KotSource,
} from '../main/api/kot';

const KOT_TEMPLATE_KEY_PREFIX = 'kot_template:';

function cacheKeyFor(format: string): string {
  return `${KOT_TEMPLATE_KEY_PREFIX}${format}`;
}

/** Fetch a KOT client template from the server and cache it locally. */
export async function fetchAndCacheKotTemplate(format: string): Promise<string> {
  const res: any = await window.api.get(
    `api/method/pos_api.api.get_receipt_template?format=${encodeURIComponent(format)}`,
  );
  const msg = res?.message;
  if (!msg || msg.success_key !== 1 || !msg.html) {
    throw new Error(
      `Failed to fetch KOT template '${format}': ${msg?.message || 'unknown error'}`,
    );
  }
  const html: string = msg.html;
  await window.app_config.save(cacheKeyFor(format), html);
  return html;
}

export async function getCachedKotTemplate(format: string): Promise<string | null> {
  return window.app_config.get(cacheKeyFor(format));
}

function inject(templateHtml: string, data: unknown): string {
  const payload = `<script>window.RECEIPT_DATA = ${JSON.stringify(data)};</script>`;
  if (templateHtml.includes('</head>')) {
    return templateHtml.replace('</head>', `${payload}\n</head>`);
  }
  if (templateHtml.includes('<body')) {
    return templateHtml.replace('<body', `${payload}\n<body`);
  }
  return payload + templateHtml;
}

export interface KotFormatSelection {
  /** Format identifier. For client templates this is the file stem (e.g. 'kot').
   *  For server print formats this is the Print Format doctype name. Empty = server default. */
  format?: string;
  /** 'client_template' | 'server_print_format'. When omitted, defaults to client_template. */
  source?: 'client_template' | 'server_print_format';
}

/**
 * Build the final printable KOT HTML. Callers pass either a sales_order or a
 * sales_invoice (or both). Returns null when neither is provided.
 */
export async function buildKotHTML(
  source: KotSource,
  selection: KotFormatSelection = {},
): Promise<string | null> {
  if (!source.sales_order && !source.sales_invoice) return null;

  const src = selection.source ?? 'client_template';

  if (src === 'server_print_format') {
    const rendered = await getKotPrintHtml(source, selection.format);
    return rendered?.html ?? null;
  }

  // client_template path — cache + inject data
  const format = selection.format || 'kot';
  let template = await getCachedKotTemplate(format);
  if (!template) {
    template = await fetchAndCacheKotTemplate(format);
  }
  const data = await getKotPrintData(source);
  if (!data) return null;
  return inject(template, data);
}
