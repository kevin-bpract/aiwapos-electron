import React, { useEffect, useState } from 'react';
import { type SalesHistoryItem } from '../../../types/salesHistor';
import { getSalesHistory } from '../../../main/api/salesHistory';
import { format } from 'date-fns';
import { formatCurrency } from '../../../utils/format';
import { type Column } from 'react-data-grid';
import ProductDataGrid from '../../ProductDataGrid';

type SalesRow = {
  id: string;
  name: string;
  customer: string;
  date: string;
  total: number;
  status: string;
  itemCount: number;
};

interface Props {
  onClose?: () => void;
  onSelect?: (sale: any) => void;
}

const formatStatus = (status: string) => (
  <span
    className={`px-2 py-1 text-xs font-medium rounded-full ${
      status === 'Completed'
        ? 'bg-green-100 text-green-800'
        : status === 'Draft'
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-gray-100 text-gray-800'
    }`}
  >
    {status}
  </span>
);

const baseColumns: Column<SalesRow>[] = [
  {
    key: 'name',
    name: 'Invoice',
    resizable: true,
  },
  {
    key: 'customer',
    name: 'Customer',
    resizable: true,
  },
  {
    key: 'date',
    name: 'Date',
    resizable: true,
  },
  {
    key: 'itemCount',
    name: 'Items',
    resizable: true,
  },
  {
    key: 'total',
    name: 'Total',
    resizable: true,
    formatter: (props: any) => formatCurrency(props.row.total) as any,
  },
  {
    key: 'status',
    name: 'Status',
    resizable: true,
    formatter: (props: any) => formatStatus(props.row.status) as any,
  },
];

const SalesHistoryModal: React.FC<Props> = ({ onClose, onSelect }) => {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchSalesHistory = async () => {
      try {
        setLoading(true);
        const { history } = await getSalesHistory({ limit_start: 0, limit_page_length: 200 });

        const invoiceMap = new Map<string, SalesHistoryItem[]>();
        history.forEach((item) => {
          const existing = invoiceMap.get(item.invoice_name) || [];
          invoiceMap.set(item.invoice_name, [...existing, item]);
        });

        const mappedRows: SalesRow[] = Array.from(invoiceMap.entries()).map(
          ([invoiceName, items]) => {
            const firstItem = items[0];
            return {
              id: invoiceName,
              name: invoiceName,
              customer: firstItem.customer_name || 'N/A',
              date: firstItem.posting_date
                ? format(new Date(firstItem.posting_date), 'dd MMM yyyy')
                : 'N/A',
              total: firstItem.invoice_total || 0,
              status: firstItem.is_pos === 1 ? 'POS' : 'Invoice',
              itemCount: items.length,
            };
          },
        );

        setRows(mappedRows);
        setFilteredRows(mappedRows);
      } catch (err) {
        console.error('Error fetching sales history:', err);
        setError('Failed to load sales history');
      } finally {
        setLoading(false);
      }
    };

    fetchSalesHistory();
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);

    if (!query) {
      setFilteredRows(rows);
      return;
    }

    const filtered = rows.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        (row.customer && row.customer.toLowerCase().includes(query)) ||
        (row.status && row.status.toLowerCase().includes(query)),
    );

    setFilteredRows(filtered);
  };

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-md min-w-[800px]">
      <div className="p-4 border-b border-gray-200">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Search by invoice, customer, or status..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex-1 bg-white">
        <ProductDataGrid
          columns={baseColumns}
          rows={filteredRows}
          loading={loading}
          error={error}
          height="calc(100vh - 200px)"
          rowHeight={40}
          onRowSelect={setSelectedRowId}
          selectedRowId={selectedRowId}
          showColumnVisibility={true}
          storageKey="salesHistoryModal"
          noRowsText="No sales history found"
        />
      </div>
    </div>
  );
};

export default SalesHistoryModal;









