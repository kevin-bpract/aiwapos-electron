import React, { useState, useEffect } from 'react';
import InputField from '../../ui/input';
import Button from '../../ui/buttom';
import { type Column } from 'react-data-grid';
import ProductDataGrid from '../../ProductDataGrid';
import { getItems, type ProductItem } from '../../../main/api/products';
import KeyboardConfig from '../../../constants/kb_config';

interface Props {
  onSearch?: (query: string) => void;
  onSelect?: (product: ProductItem) => void;
  onProductInfo?: (product: ProductItem) => void;
  onEdit?: (product: ProductItem) => void;
  onClose?: () => void;
}

type ProductRow = {
  id: string;
  item_code: string;
  item_name: string;
  description: string;
  stock_uom: string;
  standard_rate: number;
};

const baseColumns: Column<ProductRow>[] = [
  { key: 'item_code', name: 'Item Code', resizable: true },
  { key: 'item_name', name: 'Item Name', resizable: true },
  { key: 'description', name: 'Description', resizable: true },
  { key: 'stock_uom', name: 'UOM', resizable: true },
  { key: 'standard_rate', name: 'Price', resizable: true },
];

const ListProductsModal: React.FC<Props> = ({ onSearch, onSelect, onProductInfo, onEdit, onClose }) => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Fetch products on component mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      // get the entire items list
      const items= await getItems()
      console.log('fetched items list',items.length )
      // const items = await getItems({
      //   limit_start: 0,
      //   limit_page_length: 20,
      // });
      
      // Ensure items is an array
      if (!Array.isArray(items)) {
        console.error('API returned non-array response:', items);
        setError('Invalid response format from server. Please try again.');
        setProducts([]);
        setRows([]);
        return;
      }

      setProducts(items);
      
      // Transform products to rows
      const transformedRows: ProductRow[] = items.map((item) => ({
        id: item.name || item.item_code || String(Date.now() + Math.random()),
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        description: item.description || '',
        stock_uom: item.stock_uom || '',
        standard_rate: item.standard_rate || 0,
      }));
      setRows(transformedRows);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      const errorMessage = 
        err?.response?.data?.message || 
        err?.message || 
        'Failed to fetch products. Please try again.';
      setError(errorMessage);
      setProducts([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (onSearch) {
      onSearch(value);
    }
    // Filter rows based on search query
    if (value.trim() === '') {
      const transformedRows: ProductRow[] = products.map((item) => ({
        id: item.name || item.item_code || String(Date.now() + Math.random()),
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        description: item.description || '',
        stock_uom: item.stock_uom || '',
        standard_rate: item.standard_rate || 0,
      }));
      setRows(transformedRows);
    } else {
      const searchLower = value.toLowerCase().trim();
      // Try to parse as number for price search
      const searchNumber = parseFloat(searchLower);
      const isNumericSearch = !isNaN(searchNumber);
      
      const filtered = products.filter((item) => {
        // Search in item_code
        if (item.item_code?.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Search in item_name
        if (item.item_name?.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Search in description
        if (item.description?.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Search in stock_uom (UOM)
        if (item.stock_uom?.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Search in price (standard_rate) - both exact match and string match
        if (isNumericSearch) {
          // Exact numeric match
          if (item.standard_rate === searchNumber) {
            return true;
          }
          // String representation match (e.g., "4" matches "4.0", "4.00")
          if (item.standard_rate?.toString().includes(searchLower)) {
            return true;
          }
        } else {
          // String search in price (e.g., typing "1.8" as text)
          if (item.standard_rate?.toString().toLowerCase().includes(searchLower)) {
            return true;
          }
        }
        return false;
      });
      
      const transformedRows: ProductRow[] = filtered.map((item) => ({
        id: item.name || item.item_code || String(Date.now() + Math.random()),
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        description: item.description || '',
        stock_uom: item.stock_uom || '',
        standard_rate: item.standard_rate || 0,
      }));
      setRows(transformedRows);
    }
  };

  const handleRowClick = (row: ProductRow, idx: number) => {
    setSelectedRowId(row.id);
  };

  const handleRowDoubleClick = (row: ProductRow) => {
    // Double click opens product info modal
    setSelectedRowId(row.id);
    if (onProductInfo) {
      const product = products.find((p) => (p.name || p.item_code) === row.id);
      if (product) {
        onProductInfo(product);
        // Close the modal when product info is opened
        if (onClose) {
          onClose();
        }
      }
    }
  };

  const openProductInfo = (rowId: string | null) => {
    if (!rowId || !onProductInfo) return;
    const product = products.find((p) => (p.name || p.item_code) === rowId);
    if (product) {
      onProductInfo(product);
      // Close the modal after selecting product
      if (onClose) {
        onClose();
      }
    }
  };

  const handleSelect = () => {
    if (selectedRowId) {
      openProductInfo(selectedRowId);
    }
  };

  const handleEdit = () => {
    if (!selectedRowId || !onEdit) return;
    const product = products.find((p) => (p.name || p.item_code) === selectedRowId);
    if (product) onEdit(product);
  };

  // Keyboard navigation for Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle keyboard events if user is typing in search input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === 'Escape') {
        if (onClose) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-md">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <InputField
              placeholder="Search by code, name, description, UOM, or price..."
              value={query}
              onChange={handleSearchChange}
              className="w-full"
            />
          </div>

          <Button
            type="button"
            onClick={fetchProducts}
            className="px-4 py-2 bg-purple-600 text-white rounded-xl font-medium shadow-sm hover:bg-purple-700 active:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white">
        <ProductDataGrid
          columns={baseColumns}
          rows={rows}
          loading={loading}
          error={error}
          height="420px"
          rowHeight={32}
          onRowClick={handleRowClick}
          onRowDoubleClick={handleRowDoubleClick}
          onRowSelect={setSelectedRowId}
          selectedRowId={selectedRowId}
          showColumnVisibility={true}
          storageKey="listProductsModal"
        />
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
        <Button
          type="button"
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-red-600 text-white font-medium shadow-sm hover:bg-red-700 active:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
        >
          Cancel
        </Button>
        {onEdit && (
          <button
            type="button"
            onClick={handleEdit}
            disabled={!selectedRowId}
            className="px-5 py-2 rounded-xl bg-amber-500 text-white font-semibold shadow-sm hover:bg-amber-600 active:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={handleSelect}
          disabled={!selectedRowId}
          className="px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Select
        </button>
      </div>
    </div>
  );
};

export default ListProductsModal;
