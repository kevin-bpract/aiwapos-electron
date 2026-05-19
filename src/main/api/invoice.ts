export interface InvoiceItem {
  item_code: string;
  qty: number;
  uom?: string;
  rate?: number;
  discount_percentage?: number;
  discount_amount?: number;
}

export interface PaymentEntry {
  mode_of_payment: string;
  amount: number;
}

export interface CreateInvoicePayload {
  customer: string;
  items: InvoiceItem[];
  posting_date?: string;
  due_date?: string;
  selling_price_list?: string;
  taxes_and_charges?: string;
  discount_amount?: number;
  additional_discount_percentage?: number;
  apply_discount_on?: string;
  is_pos?: number;
  pos_profile?: string;
  payments?: PaymentEntry[];
  update_stock?: number;
  set_warehouse?: string;
  submit?: number;
  delivery_charge?: number;
  delivery_charge_amount?: number;
}

export interface InvoiceResponse {
  message?: {
    name?: string;
    [key: string]: any;
  };
  name?: string;
  [key: string]: any;
}

export interface ModeOfPayment {
  name: string;
  type: string;
}

export interface ModeOfPaymentResponse {
  message?: {
    success_key?: number;
    message?: string;
    payment_modes: ModeOfPayment[];
    user_mode_of_payment?: string;
  };
  payment_modes?: ModeOfPayment[];
  user_mode_of_payment?: string;
}

export interface ModeOfPaymentsResult {
  modes: ModeOfPayment[];
  defaultMode: string | null;
}

export async function createSalesInvoice(
  data: CreateInvoicePayload,
): Promise<InvoiceResponse> {
  const result = await window.invoice.create(data.customer, data.items);
  return result;
}

export async function createPOSInvoice(
  data: CreateInvoicePayload,
): Promise<InvoiceResponse> {
  const result = await window.invoice.createPOS(data);
  return result;
}

export async function getModeOfPayments(): Promise<ModeOfPaymentsResult> {
  const result = await window.invoice.getModeOfPayments();
  const modes = result?.message?.payment_modes || result?.payment_modes || [];
  const defaultMode = result?.message?.user_mode_of_payment || result?.user_mode_of_payment || null;
  
  return {
    modes,
    defaultMode
  };
}

export async function submitSalesInvoice(invoiceName: string): Promise<any> {
  const result = await window.invoice.submitInvoice(invoiceName);
  return result;
}
