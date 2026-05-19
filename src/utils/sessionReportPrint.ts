/**
 * Client-side session report printing: fetch report data from the API, render
 * it into a locally-cached Handlebars HTML template, and return/print the
 * resulting static HTML.
 *
 * Endpoints:
 * - Template: GET /api/method/pos_api.api.get_client_side_template?template_name=session_report
 *             → { message: { template: "...", success: true } }
 * - Data:     GET /api/method/pos_api.api.get_session_report?shift_closing_entry=<name>
 */

import Handlebars from 'handlebars';

const SESSION_REPORT_TEMPLATE_KEY = 'session_report_template';
const SESSION_REPORT_TEMPLATE_NAME = 'session_report';

// ---------------------------------------------------------------------------
// Template fetching & caching
// ---------------------------------------------------------------------------

/** Fetch the session report template from the server and cache it locally. */
export async function fetchAndCacheSessionReportTemplate(): Promise<string> {
  const res = await window.api.get(
    `api/method/pos_api.api.get_client_side_template?template_name=${SESSION_REPORT_TEMPLATE_NAME}`,
  );

  // BE returns { message: { template, success } } and the IPC layer wraps in
  // another { message: ... }, so payload lives at res.message.message.
  const payload = res?.message?.message ?? res?.message;
  if (!payload?.success || !payload.template) {
    throw new Error(
      `Failed to fetch session report template: ${typeof payload === 'string' ? payload : JSON.stringify(payload ?? res)}`,
    );
  }

  const html: string = payload.template;
  await window.app_config.save(SESSION_REPORT_TEMPLATE_KEY, html);
  return html;
}

/** Get the cached session report template (returns null when not yet fetched). */
export async function getCachedSessionReportTemplate(): Promise<string | null> {
  return window.app_config.get(SESSION_REPORT_TEMPLATE_KEY);
}

// ---------------------------------------------------------------------------
// Report data fetching
// ---------------------------------------------------------------------------

/** Fetch session report data for a given shift closing entry. */
export async function fetchSessionReportData(
  shiftClosingEntry: string,
): Promise<any> {
  const res = await window.api.get(
    `api/method/pos_api.api.get_session_report?shift_closing_entry=${encodeURIComponent(shiftClosingEntry)}`,
  );

  if (res?.message?.success_key !== 1 || !res.message.data) {
    throw new Error(
      `Failed to fetch session report data: ${res?.message?.message || 'unknown error'}`,
    );
  }

  return res.message.data;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const PRINT_STYLES = `
<style>
  @page {
    size: 80mm auto;
    margin: 4mm 3mm;
  }
  body, html {
    width: 80mm !important;
    max-width: 80mm !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    font-size: 11px !important;
    font-family: 'Courier New', Courier, monospace;
  }
  @media print {
    @page {
      size: 80mm auto;
      margin: 4mm 3mm;
    }
    body, html {
      width: 80mm !important;
      max-width: 80mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: white !important;
    }
  }
</style>`;

function renderSessionReport(templateHtml: string, data: any): string {
  const compiled = Handlebars.compile(templateHtml, { noEscape: false });
  const rendered = compiled(data || {});

  // Inject 80mm thermal print styles into the rendered HTML.
  if (rendered.includes('</head>')) {
    return rendered.replace('</head>', `${PRINT_STYLES}\n</head>`);
  }
  if (rendered.includes('<body')) {
    return rendered.replace('<body', `${PRINT_STYLES}\n<body`);
  }
  return PRINT_STYLES + rendered;
}

// ---------------------------------------------------------------------------
// Full client-side session report flow
// ---------------------------------------------------------------------------

export interface SessionReportPrintOptions {
  shiftClosingEntry: string;
  printerName?: string;
}

/**
 * Build the session report HTML from cached template + data API.
 * Returns the final HTML string (for display in SessionReportModal and/or printing).
 */
export async function buildSessionReport(
  shiftClosingEntry: string,
): Promise<string> {
  let template = await getCachedSessionReportTemplate();
  if (!template) {
    template = await fetchAndCacheSessionReportTemplate();
  }

  const data = await fetchSessionReportData(shiftClosingEntry);

  return renderSessionReport(template, data);
}
