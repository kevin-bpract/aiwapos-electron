import React, { useEffect, useState } from 'react';
import Portal from '../../portal';
import {
  getSalesSummary,
  SalesSummaryData,
} from '../../../main/api/salesSummary';

interface Props {
  onClose: () => void;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function monthStartISO(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

function fmt(n: number | undefined | null): string {
  if (n == null) return '0.00';
  return n.toFixed(2);
}

const SalesSummaryModal: React.FC<Props> = ({ onClose }) => {
  const [fromDate, setFromDate] = useState<string>(monthStartISO());
  const [toDate, setToDate] = useState<string>(todayISO());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SalesSummaryData | null>(null);

  const fetchSummary = async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getSalesSummary({
        from_date: fromDate,
        to_date: toDate,
      });
      setData(result);
    } catch (err: any) {
      console.error('Failed to fetch sales summary', err);
      setError(err?.message || 'Failed to fetch sales summary');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const t = data?.totals;

  return (
    <Portal onClose={onClose} modalTitle="Sales Summary">
      <div className="flex flex-col h-[80vh] w-[1100px] max-w-[95vw]">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-4 items-end">
          <div className="flex flex-col gap-1 w-48">
            <label className="text-sm font-medium text-gray-700">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1 w-48">
            <label className="text-sm font-medium text-gray-700">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="ml-auto text-sm text-gray-500 pb-2">
            {data ? `${data.total_invoices} invoices` : ''}
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white p-4">
          {loading && (
            <div className="flex h-full items-center justify-center text-gray-500">
              Loading summary...
            </div>
          )}
          {!loading && error && (
            <div className="flex h-full items-center justify-center text-red-600">
              {error}
            </div>
          )}
          {!loading && !error && !data && (
            <div className="flex h-full items-center justify-center text-gray-500">
              No data.
            </div>
          )}
          {!loading && !error && data && (
            <div className="flex flex-col gap-6">
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Totals</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Tile label="Total Sale" value={fmt(t?.total_sale)} />
                  <Tile label="Net Sale" value={fmt(t?.net_sale)} />
                  <Tile label="Cash" value={fmt(t?.cash_sale)} />
                  <Tile label="Card" value={fmt(t?.card_sale)} />
                  <Tile label="Credit" value={fmt(t?.credit_sale)} />
                  <Tile label="Returns" value={fmt(t?.return_total)} />
                </div>
              </section>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Top Products
                    {data.unique_products > data.products.length
                      ? ` (showing top ${data.products.length} of ${data.unique_products})`
                      : ''}
                  </h3>
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <Th>Item Code</Th>
                        <Th>Name</Th>
                        <Th right>Qty</Th>
                        <Th right>Amount</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.products.map((p) => (
                        <tr key={p.item_code}>
                          <Td>{p.item_code}</Td>
                          <Td>{p.name}</Td>
                          <Td right>{p.qty}</Td>
                          <Td right>{fmt(p.amount)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Top Categories
                    {data.unique_categories > data.categories.length
                      ? ` (showing top ${data.categories.length} of ${data.unique_categories})`
                      : ''}
                  </h3>
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <Th>Category</Th>
                        <Th right>Qty</Th>
                        <Th right>Amount</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.categories.map((c) => (
                        <tr key={c.name}>
                          <Td>{c.name}</Td>
                          <Td right>{c.qty}</Td>
                          <Td right>{fmt(c.amount)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Payment Modes</h3>
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Mode</Th>
                      <Th right>Amount</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.payment_modes.map((m) => (
                      <tr key={m.mode_of_payment}>
                        <Td>{m.mode_of_payment}</Td>
                        <Td right>{fmt(m.amount)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
};

const Tile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">
    <div className="text-xs text-gray-500">{label}</div>
    <div className="text-lg font-semibold text-gray-900">{value}</div>
  </div>
);

const Th: React.FC<{ children: React.ReactNode; right?: boolean }> = ({
  children,
  right,
}) => (
  <th
    scope="col"
    className={`px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider ${
      right ? 'text-right' : 'text-left'
    }`}
  >
    {children}
  </th>
);

const Td: React.FC<{ children: React.ReactNode; right?: boolean }> = ({
  children,
  right,
}) => (
  <td
    className={`px-4 py-2 whitespace-nowrap text-gray-700 ${
      right ? 'text-right' : 'text-left'
    }`}
  >
    {children}
  </td>
);

export default SalesSummaryModal;
