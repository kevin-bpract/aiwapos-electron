/**
 * Fire-and-forget KOT print for a sales_order or sales_invoice, respecting
 * the configured kotPrintFormat / kotPrintFormatSource in printer settings.
 *
 * Designed to be awaited alongside order/invoice printing without breaking
 * the caller when KOT config is missing or the backend fails.
 */

import { buildKotHTML } from './kotPrint';
import type { KotSource } from '../main/api/kot';

export interface PrintKotOptions {
  source: KotSource;
  /** Called with a 'kot'-typed payload. Typically usePrinter().print. */
  print: (opts: {
    type: 'kot' | 'html' | 'invoice' | 'default';
    data: any;
    title?: string;
  }) => Promise<void>;
  title?: string;
}

/**
 * Build KOT HTML from configured settings and send it through the provided
 * print function. Swallows errors (logs them) so it can never break a
 * successful invoice/order flow.
 */
export async function printKotIfConfigured(
  opts: PrintKotOptions,
): Promise<void> {
  const { source, print, title } = opts;
  try {
    const settings = await window.printerSettings.get();
    if (settings?.kotPrintEnabled === false) return;
    const format: string | undefined = settings?.kotPrintFormat || undefined;
    const sourceKind: 'client_template' | 'server_print_format' =
      settings?.kotPrintFormatSource === 'server_print_format'
        ? 'server_print_format'
        : 'client_template';

    // When format is empty AND source is client_template, fall back to the
    // default 'kot' client template. If it's server_print_format with no
    // format name, let the server pick its default via get_kot_print_html.
    const html = await buildKotHTML(source, {
      format,
      source: sourceKind,
    });
    if (!html) return;

    await print({ type: 'kot', data: html, title });
  } catch (err) {
    console.error('[KOT print] failed:', err);
  }
}
