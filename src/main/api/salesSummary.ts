export interface SalesSummaryTotals {
  total_sale: number;
  card_sale: number;
  cash_sale: number;
  credit_sale: number;
  return_total: number;
  net_sale: number;
}

export interface SalesSummaryProduct {
  item_code: string;
  name: string;
  item_group: string;
  qty: number;
  amount: number;
}

export interface SalesSummaryCategory {
  name: string;
  qty: number;
  amount: number;
}

export interface SalesSummaryPaymentMode {
  mode_of_payment: string;
  amount: number;
}

export interface SalesSummaryData {
  from_date: string;
  to_date: string;
  user: string | null;
  company: string | null;
  total_invoices: number;
  unique_products: number;
  unique_categories: number;
  totals: SalesSummaryTotals;
  top_product: { name: string; qty: number } | null;
  top_category: { name: string; qty: number } | null;
  products: SalesSummaryProduct[];
  categories: SalesSummaryCategory[];
  payment_modes: SalesSummaryPaymentMode[];
}

export interface GetSalesSummaryParams {
  from_date: string;
  to_date: string;
  top_n?: number;
  user?: string;
  company?: string;
}

interface GetSalesSummaryResponse {
  message?: {
    success_key?: number;
    message?: string;
    data?: SalesSummaryData;
  };
  [key: string]: any;
}

export async function getSalesSummary(
  params: GetSalesSummaryParams,
): Promise<SalesSummaryData | null> {
  const queryParams = new URLSearchParams({
    from_date: params.from_date,
    to_date: params.to_date,
  });
  if (typeof params.top_n === 'number') queryParams.set('top_n', String(params.top_n));
  if (params.user) queryParams.set('user', params.user);
  if (params.company) queryParams.set('company', params.company);

  const res = (await window.api.get(
    `/api/method/pos_api.api.get_sales_summary?${queryParams.toString()}`,
    { withCredentials: true },
  )) as GetSalesSummaryResponse;

  return res?.message?.data ?? null;
}
