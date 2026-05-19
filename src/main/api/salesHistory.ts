import {
  GetSalesHistoryParams,
  SalesHistoryItem,
  GetSalesHistoryResponse,
  SalesHistorySummary,
} from '../../types/salesHistor';

export async function getSalesHistory(
  params: GetSalesHistoryParams = {},
): Promise<{
  history: SalesHistoryItem[];
  summary: SalesHistorySummary | null;
  total_count: number;
}> {
  const { limit_start = 0, limit_page_length = 50 } = params;

  const queryParams = new URLSearchParams({
    limit_start: limit_start.toString(),
    limit_page_length: limit_page_length.toString(),
  });

  const res = (await window.api.get(
    `/api/method/pos_api.api.get_sales_history?${queryParams.toString()}`,
    { withCredentials: true },
  )) as GetSalesHistoryResponse;

  const msg = res?.message;

  if (!msg || !Array.isArray(msg.history)) {
    console.warn('Unexpected get_sales_history API response structure:', res);
    return {
      history: [],
      summary: null,
      total_count: 0,
    };
  }

  return {
    history: msg.history,
    summary: msg.summary,
    total_count: msg.total_count,
  };
}
