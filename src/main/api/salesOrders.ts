export interface CreateSalesOrderParams {
  customer: string;
  items: Array<{
    item_code: string;
    qty: number;
    rate: number;
  }>;
  delivery_charge?: number;
  delivery_charge_amount?: number;
}

export interface SalesOrderItem {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
  /** Row name from server (single-order API) */
  name?: string;
  description?: string | null;
  uom?: string;
  item_group?: string;
  net_amount?: number;
  discount_percentage?: number;
  discount_amount?: number;
}

export interface CreateSalesOrderResponse {
  message?: {
    success_key?: number;
    message?: string;
    error_type?: string;
    sales_order?: string;
    docstatus?: number;
    customer?: string;
    total?: number;
    grand_total?: number;
    items?: SalesOrderItem[];
  };
  [key: string]: any;
}

export interface GetSalesOrdersParams {
  docstatus?: number;
  limit_start?: number;
  limit_page_length?: number;
  from_date?: string;
  to_date?: string;
}

export interface SalesOrder {
  name: string;
  customer: string;
  customer_name: string;
  transaction_date: string;
  delivery_date: string;
  docstatus: number;
  status: string;
  total: number;
  grand_total: number;
  currency: string;
  items: SalesOrderItem[];
  restaurant_order_type?: 'Dining' | 'Parcel' | 'Delivery';
  table_no?: string;
  order_notes?: string;
}

export interface GetSalesOrdersResponse {
  message?: {
    success_key?: number;
    message?: string;
    /** get_my_orders response key */
    orders?: SalesOrder[];
    /** Legacy get_sales_orders response key */
    sales_orders?: SalesOrder[];
    total_count?: number;
    limit_start?: number;
    limit_page_length?: number;
    has_more?: boolean;
    next_offset?: number;
  };
  [key: string]: any;
}

export interface GetSalesOrderResponse {
  message?: {
    success_key?: number;
    message?: string;
    sales_order?: SalesOrder;
  };
  [key: string]: any;
}

export async function getSalesOrder(salesOrderName: string): Promise<SalesOrder | null> {
  const res = (await window.api.get(
    `/api/method/pos_api.api.get_sales_order?sales_order=${encodeURIComponent(salesOrderName)}`,
    { withCredentials: true },
  )) as GetSalesOrderResponse;

  const msg = res?.message;
  if (!msg?.sales_order) {
    return null;
  }
  return msg.sales_order;
}

export interface CreateRestaurantOrderParams {
  items: Array<{
    item_code: string;
    qty: number;
    rate?: number;
  }>;
  restaurant_order_type?: 'Dining' | 'Parcel' | 'Delivery';
  table_no?: string;
  order_notes?: string;
  customer?: string;
}

export interface UpdateSalesOrderParams {
  sales_order: string;
  items?: Array<{
    item_code: string;
    qty: number;
    rate?: number;
  }>;
  remove_items?: string[];
  restaurant_order_type?: 'Dining' | 'Parcel' | 'Delivery';
  table_no?: string;
  order_notes?: string;
}

export interface UpdateSalesOrderResponse {
  message?: {
    success_key?: number;
    message?: string;
    error_type?: string;
    sales_order?: string;
  };
  [key: string]: any;
}

export async function createSalesOrder(
  params: CreateSalesOrderParams,
): Promise<CreateSalesOrderResponse> {
  const { customer, items, delivery_charge, delivery_charge_amount } = params;

  const formData = new URLSearchParams();
  formData.append('customer', customer);
  formData.append('items', JSON.stringify(items));

  if (delivery_charge !== undefined) {
    formData.append('delivery_charge', delivery_charge.toString());
  }
  if (delivery_charge_amount !== undefined) {
    formData.append('delivery_charge_amount', delivery_charge_amount.toString());
  }

  const res = (await window.api.post(
    '/api/method/pos_api.api.create_sales_order',
    formData.toString(),
    { 'Content-Type': 'application/x-www-form-urlencoded' },
  )) as CreateSalesOrderResponse;

  return res;
}

export async function createRestaurantOrder(
  params: CreateRestaurantOrderParams,
): Promise<CreateSalesOrderResponse> {
  const { items, restaurant_order_type, table_no, order_notes, customer } = params;

  const formData = new URLSearchParams();
  if (customer) {
    formData.append('customer', customer);
  }
  formData.append('items', JSON.stringify(items));
  if (restaurant_order_type) {
    formData.append('restaurant_order_type', restaurant_order_type);
  }
  if (table_no) {
    formData.append('table_no', table_no);
  }
  if (order_notes) {
    formData.append('order_notes', order_notes);
  }

  const res = (await window.api.post(
    '/api/method/pos_api.api.create_sales_order',
    formData.toString(),
    { 'Content-Type': 'application/x-www-form-urlencoded' },
  )) as CreateSalesOrderResponse;

  return res;
}

export async function updateSalesOrder(
  params: UpdateSalesOrderParams,
): Promise<UpdateSalesOrderResponse> {
  const { sales_order, items, remove_items, restaurant_order_type, table_no, order_notes } = params;

  const formData = new URLSearchParams();
  formData.append('sales_order', sales_order);
  if (items && items.length > 0) {
    formData.append('items', JSON.stringify(items));
  }
  if (remove_items && remove_items.length > 0) {
    formData.append('remove_items', JSON.stringify(remove_items));
  }
  if (restaurant_order_type) {
    formData.append('restaurant_order_type', restaurant_order_type);
  }
  if (table_no) {
    formData.append('table_no', table_no);
  }
  if (order_notes) {
    formData.append('order_notes', order_notes);
  }

  const res = (await window.api.post(
    '/api/method/pos_api.api.update_sales_order',
    formData.toString(),
    { 'Content-Type': 'application/x-www-form-urlencoded' },
  )) as UpdateSalesOrderResponse;

  return res;
}

export async function printSalesInvoicePDF(sales_invoice: string, printFormat?: string): Promise<Blob> {
  // For PDF printing, we need to handle blob response
  // The API returns PDF as binary data
  let formatToUse = printFormat;
  if (!formatToUse) {
    const settings = await window.printerSettings.get();
    formatToUse = settings?.invoicePrintFormat || 'Standard';
  }

  const res = await window.api.get(
    `api/method/pos_api.api.print_sales_invoice_pdf?sales_invoice=${encodeURIComponent(sales_invoice)}&print_format=${encodeURIComponent(formatToUse)}`,
    { responseType: 'blob' },
  );

  console.log('DEBUG: Raw API Response for Invoice PDF:', res);
  if (res && (res as any).__isBlob) {
    console.log('DEBUG: Response is IPC Blob wrapper');
    console.log('DEBUG: Wrapper Type:', (res as any).type);
    console.log('DEBUG: Wrapper Data Length:', (res as any).data?.length);
  } else {
    console.log('DEBUG: Response is NOT recognized as Blob wrapper');
  }

  console.log('PDF response type:', typeof res, res instanceof Blob, res instanceof ArrayBuffer);

  // Handle the base64 encoded blob from IPC
  if (res && typeof res === 'object' && (res as any).__isBlob) {
    const blobData = res as { __isBlob: true; data: string; type: string };
    console.log('Converting base64 to Blob, base64 length:', blobData.data.length);

    try {
      // Convert base64 string directly to Uint8Array using a more reliable method
      // Remove any whitespace/newlines from base64 string
      const base64Clean = blobData.data.replace(/\s/g, '');

      // Use browser's built-in base64 decoding
      const binaryString = atob(base64Clean);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      console.log('Converted to Uint8Array, length:', bytes.length);
      console.log('First 10 bytes:', Array.from(bytes.slice(0, 10)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));

      // Verify it's a valid PDF by checking the first bytes (PDF magic number: %PDF)
      const firstBytes = bytes.slice(0, 4);
      const pdfHeader = String.fromCharCode(...firstBytes);
      console.log('PDF header check:', pdfHeader, 'Expected: %PDF');

      if (pdfHeader !== '%PDF') {
        console.error('Invalid PDF header:', pdfHeader);
        console.error('First 20 bytes as hex:', Array.from(bytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.error('First 20 bytes as chars:', String.fromCharCode(...bytes.slice(0, 20)));
        throw new Error(`Invalid PDF file: header is "${pdfHeader}" instead of "%PDF"`);
      }

      const blob = new Blob([bytes], { type: blobData.type || 'application/pdf' });
      console.log('Created Blob successfully, size:', blob.size, 'bytes, type:', blob.type);

      return blob;
    } catch (error) {
      console.error('Error converting base64 to Blob:', error);
      console.error('Base64 preview (first 100 chars):', blobData.data.substring(0, 100));
      throw new Error(`Failed to convert PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fallback: if it's already a Blob
  if (res instanceof Blob) {
    console.log('Response is already a Blob, size:', res.size);
    return res;
  }

  // Fallback: if it's an ArrayBuffer
  if (res instanceof ArrayBuffer) {
    console.log('Response is ArrayBuffer, size:', res.byteLength);
    return new Blob([res], { type: 'application/pdf' });
  }

  // Last resort: try to convert directly
  try {
    const uint8Array = res instanceof Uint8Array ? res : new Uint8Array(res as any);
    console.log('Converting to Uint8Array, length:', uint8Array.length);
    return new Blob([uint8Array], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error converting PDF to Blob:', error, 'Response:', res);
    throw new Error('Failed to convert PDF response to Blob: unexpected response format');
  }
}

export async function printSalesOrderPDF(sales_order: string, printFormat?: string): Promise<Blob> {
  // For PDF printing, we need to handle blob response
  // The API returns PDF as binary data
  let formatToUse = printFormat;
  if (!formatToUse) {
    const settings = await window.printerSettings.get();
    formatToUse = settings?.orderPrintFormat || 'POS Invoice';
  }

  const res = await window.api.get(
    `/api/method/pos_api.api.print_sales_order_pdf?sales_order=${encodeURIComponent(sales_order)}&format=${encodeURIComponent(formatToUse)}`,
    { responseType: 'blob' },
  );

  console.log('PDF response type:', typeof res, res instanceof Blob, res instanceof ArrayBuffer);

  // Handle the base64 encoded blob from IPC
  if (res && typeof res === 'object' && (res as any).__isBlob) {
    const blobData = res as { __isBlob: true; data: string; type: string };
    console.log('Converting base64 to Blob, base64 length:', blobData.data.length);

    try {
      // Convert base64 string directly to Uint8Array using a more reliable method
      // Remove any whitespace/newlines from base64 string
      const base64Clean = blobData.data.replace(/\s/g, '');

      // Use browser's built-in base64 decoding
      const binaryString = atob(base64Clean);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      console.log('Converted to Uint8Array, length:', bytes.length);
      console.log('First 10 bytes:', Array.from(bytes.slice(0, 10)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));

      // Verify it's a valid PDF by checking the first bytes (PDF magic number: %PDF)
      const firstBytes = bytes.slice(0, 4);
      const pdfHeader = String.fromCharCode(...firstBytes);
      console.log('PDF header check:', pdfHeader, 'Expected: %PDF');

      if (pdfHeader !== '%PDF') {
        console.error('Invalid PDF header:', pdfHeader);
        console.error('First 20 bytes as hex:', Array.from(bytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.error('First 20 bytes as chars:', String.fromCharCode(...bytes.slice(0, 20)));
        throw new Error(`Invalid PDF file: header is "${pdfHeader}" instead of "%PDF"`);
      }

      const blob = new Blob([bytes], { type: blobData.type || 'application/pdf' });
      console.log('Created Blob successfully, size:', blob.size, 'bytes, type:', blob.type);

      return blob;
    } catch (error) {
      console.error('Error converting base64 to Blob:', error);
      console.error('Base64 preview (first 100 chars):', blobData.data.substring(0, 100));
      throw new Error(`Failed to convert PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fallback: if it's already a Blob
  if (res instanceof Blob) {
    console.log('Response is already a Blob, size:', res.size);
    return res;
  }

  // Fallback: if it's an ArrayBuffer
  if (res instanceof ArrayBuffer) {
    console.log('Response is ArrayBuffer, size:', res.byteLength);
    return new Blob([res], { type: 'application/pdf' });
  }

  // Last resort: try to convert directly
  try {
    const uint8Array = res instanceof Uint8Array ? res : new Uint8Array(res as any);
    console.log('Converting to Uint8Array, length:', uint8Array.length);
    return new Blob([uint8Array], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error converting PDF to Blob:', error, 'Response:', res);
    throw new Error('Failed to convert PDF response to Blob: unexpected response format');
  }
}

export async function getSalesOrders(
  params: GetSalesOrdersParams = {},
): Promise<SalesOrder[]> {
  const { docstatus = 0, limit_start = 0, limit_page_length = 20, from_date = '', to_date = '' } = params;

  const queryParams = new URLSearchParams({
    docstatus: docstatus.toString(),
    limit_start: limit_start.toString(),
    limit_page_length: limit_page_length.toString(),
    from_date: from_date,
    to_date: to_date,
    include_items: '1',
  });

  const res = (await window.api.get(
    `/api/method/pos_api.api.get_my_orders?${queryParams.toString()}`,
    { withCredentials: true },
  )) as GetSalesOrdersResponse;

  const msg = res?.message;
  // Server returns `orders`; legacy callers still destructure `sales_orders`.
  const orders = msg?.orders ?? msg?.sales_orders;

  if (!msg || !Array.isArray(orders)) {
    console.warn('Unexpected get_my_orders API response structure:', res);
    return [];
  }

  return orders as SalesOrder[];
}

export interface ConvertSalesOrdersToInvoiceParams {
  sales_orders: string[];
  payments?: Array<{
    mode_of_payment: string;
    amount: number;
  }>;
}

export interface ConvertSalesOrdersToInvoiceResponse {
  message?: {
    success_key?: number;
    message?: string;
    error_type?: string;
    sales_invoice?: string;
    invoices?: string[];
    sales_orders_linked?: string[];
    customer?: string;
    grand_total?: number;
    docstatus?: number;
    error?: string;
    items?: Array<{
      item_code: string;
      item_name: string;
      qty: number;
      rate: number;
      amount: number;
      sales_order?: string;
    }>;
  };
  [key: string]: any;
}

export async function convertSalesOrdersToInvoice(
  params: ConvertSalesOrdersToInvoiceParams,
): Promise<ConvertSalesOrdersToInvoiceResponse> {
  const { sales_orders, payments } = params;

  const formData = new URLSearchParams();
  formData.append('sales_orders', JSON.stringify(sales_orders));
  if (payments && payments.length > 0) {
    formData.append('payments', JSON.stringify(payments));
  }

  const res = (await window.api.post(
    '/api/method/pos_api.api.convert_sales_orders_to_invoice',
    formData.toString(),
    { 'Content-Type': 'application/x-www-form-urlencoded' },
  )) as ConvertSalesOrdersToInvoiceResponse;

  return res;
}

// ZATCA QR Code interfaces and functions
export interface GenerateInvoiceQRResponse {
  message?: {
    success_key?: number;
    message?: string;
    data?: {
      invoice_name: string;
      qr_code: string;
    };
  };
  _server_messages?: string;
  [key: string]: any;
}

export interface GetInvoiceQRResponse {
  message?: {
    success_key?: number;
    message?: string;
    data?: {
      invoice_name: string;
      qr_code: string;
    };
  };
  _server_messages?: string;
  [key: string]: any;
}

export async function generateInvoiceQR(
  invoiceName: string,
): Promise<GenerateInvoiceQRResponse> {
  const res = (await window.api.post(
    '/api/method/pos_api.api.generate_invoice_qr',
    JSON.stringify({ invoice_name: invoiceName }),
    { 'Content-Type': 'application/json' },
  )) as GenerateInvoiceQRResponse;

  return res;
}

export async function getSalesInvoiceHTML(sales_invoice: string, printFormat?: string): Promise<string> {
  let formatToUse = printFormat;
  if (!formatToUse) {
    const settings = await window.printerSettings.get();
    formatToUse = settings?.invoicePrintFormat || 'Standard';
  }

  // Use get_sales_invoice_print_html: sales_invoice + format (same as backend API)
  const res = (await window.api.get(
    `api/method/pos_api.api.get_sales_invoice_print_html?sales_invoice=${encodeURIComponent(sales_invoice)}&format=${encodeURIComponent(formatToUse)}`
  )) as any;

  // API returns { message: { html: "..." } }
  if (res && res.message && res.message.html) {
    return res.message.html;
  }

  // Fallback or error logging
  console.warn('getSalesInvoiceHTML: unexpected response format', res);
  return '';
}

export async function getSalesOrderHTML(sales_order: string, printFormat?: string): Promise<string> {
  let formatToUse = printFormat;
  if (!formatToUse) {
    const settings = await window.printerSettings.get();
    formatToUse = settings?.orderPrintFormat || 'POS Invoice';
  }

  const res = (await window.api.get(
    `api/method/pos_api.api.get_sales_order_print_html?sales_order=${encodeURIComponent(sales_order)}&format=${encodeURIComponent(formatToUse)}`
  )) as any;

  if (res && res.message && res.message.html) {
    return res.message.html;
  }

  console.warn('getSalesOrderHTML: unexpected response format', res);
  return '';
}

export async function getInvoiceQR(
  invoiceName: string,
): Promise<GetInvoiceQRResponse> {
  const res = (await window.api.get(
    `/api/method/pos_api.api.get_invoice_qr?invoice_name=${invoiceName}`,
  )) as GetInvoiceQRResponse;

  return res;
}

// Sales Invoices interfaces and functions
export interface SalesInvoice {
  name: string;
  customer: string;
  customer_name: string;
  posting_date: string;
  due_date: string;
  docstatus: number;
  status: string;
  grand_total: number;
  outstanding_amount: number;
  currency: string;
  total_qty: number;
  net_total: number;
  total_taxes_and_charges: number;
  discount_amount: number;
  additional_discount_percentage: number;
  items?: SalesOrderItem[];
}

export interface GetSalesInvoicesParams {
  docstatus?: number;
  limit_start?: number;
  limit_page_length?: number;
  from_date?: string;
  to_date?: string;
  customer?: string;
  status?: string;
  include_payments?: boolean;
}

export interface GetSalesInvoicesResponse {
  message?: {
    success_key?: number;
    message?: string;
    user?: string;
    invoices?: SalesInvoice[];
    total_count?: number;
    has_more?: boolean;
    next_offset?: number;
  };
  [key: string]: any;
}

export async function getSalesInvoices(
  params: GetSalesInvoicesParams = {},
): Promise<SalesInvoice[]> {
  const {
    limit_start = 0,
    limit_page_length = 20,
    from_date = '',
    to_date = '',
    customer,
    status,
    include_payments,
  } = params;

  const queryParams = new URLSearchParams({
    limit_start: limit_start.toString(),
    limit_page_length: limit_page_length.toString(),
    from_date,
    to_date,
  });
  if (customer) queryParams.set('customer', customer);
  if (status) queryParams.set('status', status);
  if (include_payments) queryParams.set('include_payments', '1');

  const res = (await window.api.get(
    `/api/method/pos_api.api.get_my_invoices?${queryParams.toString()}`,
    { withCredentials: true },
  )) as GetSalesInvoicesResponse;

  const msg = res?.message;

  if (!msg || !Array.isArray(msg.invoices)) {
    console.warn('Unexpected get_my_invoices API response structure:', res);
    return [];
  }

  return msg.invoices;
}

export async function getSalesInvoice(name: string): Promise<SalesInvoice> {
  // Fetch single invoice details including child tables
  const res = (await window.api.get(
    `/api/resource/Sales Invoice/${encodeURIComponent(name)}`,
  )) as { data: SalesInvoice };

  if (!res || !res.data) {
    throw new Error('Invoice not found');
  }

  return res.data;
}

export interface DeleteDraftSalesOrderResponse {
  message?: {
    success_key?: number;
    message?: string;
  };
  [key: string]: any;
}

export async function deleteDraftSalesOrder(
  sales_order: string,
): Promise<DeleteDraftSalesOrderResponse> {
  const res = (await window.api.post(
    '/api/method/pos_api.api.delete_draft_sales_order',
    JSON.stringify({ sales_order }),
    { 'Content-Type': 'application/json' },
  )) as DeleteDraftSalesOrderResponse;

  return res;
}

