export interface SalesHistoryItem {
  invoice_name: string;
  customer: string;
  customer_name: string;
  posting_date: string;
  invoice_total: number;
  is_pos: number;
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
  uom: string;
  warehouse: string;
  discount_percentage: number;
  discount_amount: number;
  extra_data?: any;
}

export interface SalesHistorySummary {
  total_invoices: number;
  total_customers: number;
  total_qty: number;
  total_amount: number;
  avg_rate: number;
  pos_invoices: number;
}

export interface GetSalesHistoryParams {
  limit_start?: number;
  limit_page_length?: number;
}

export interface GetSalesHistoryResponse {
  message?: {
    success_key: number;
    message: string;
    history: SalesHistoryItem[];
    summary: SalesHistorySummary;
    total_count: number;
    limit_start: number;
    limit_page_length: number;
  };
}
