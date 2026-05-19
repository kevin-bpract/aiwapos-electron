import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getHeldCarts, deleteHeldCart, type HeldCart } from '../../../main/api/heldCarts';
import { formatCurrency } from '../../../utils/format';
import ProductDataGrid from '../../ProductDataGrid';
import { type Column } from 'react-data-grid';
import InputField from '../../ui/input';
import Button from '../../ui/buttom';

type HoldListRow = {
  id: string;
  holdId: string;
  customerName: string;
  customerCode: string;
  itemCount: number;
  total: number;
  heldAt: string;
};

interface Props {
  onClose?: () => void;
  onSelect?: (cart: HeldCart) => void;
  onDelete?: (id: string) => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

const HoldListModal: React.FC<Props> = ({ onClose, onSelect, onDelete }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<HoldListRow[]>([]);
  const [carts, setCarts] = useState<HeldCart[]>([]);
  const [filteredRows, setFilteredRows] = useState<HoldListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const filteredRowsRef = useRef<HoldListRow[]>([]);
  const selectedRowIdRef = useRef<string | null>(null);
  const cartsRef = useRef<HeldCart[]>([]);
  filteredRowsRef.current = filteredRows;
  selectedRowIdRef.current = selectedRowId;
  cartsRef.current = carts;

  const trapFocus = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const container = modalRef.current;
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => el.tabIndex !== -1 && !(el as HTMLInputElement).disabled);
    if (focusable.length === 0) return;
    const current = document.activeElement as HTMLElement;
    const idx = focusable.indexOf(current);
    const isInside = idx !== -1;
    if (!isInside) {
      e.preventDefault();
      focusable[0].focus();
      return;
    }
    if (e.shiftKey) {
      if (idx <= 0) {
        e.preventDefault();
        focusable[focusable.length - 1].focus();
      }
    } else {
      if (idx >= focusable.length - 1) {
        e.preventDefault();
        focusable[0].focus();
      }
    }
  };

  useEffect(() => {
    const fetchHeldCarts = async () => {
      try {
        setLoading(true);
        const data = await getHeldCarts({
          limit_start: 0,
          limit_page_length: 100,
        });

        setCarts(data);

        const mappedRows: HoldListRow[] = data.map((cart) => ({
          id: cart.id,
          holdId: cart.id,
          customerName: cart.customerName || 'Walk-in Customer',
          customerCode: cart.customerCode || 'N/A',
          itemCount: cart.items.length,
          total: cart.total,
          heldAt: format(new Date(cart.heldAt), 'dd MMM yyyy HH:mm'),
        }));

        setRows(mappedRows);
        setFilteredRows(mappedRows);
      } catch (err) {
        console.error('Error fetching held carts:', err);
        setError(t('errors.failedToLoadData'));
      } finally {
        setLoading(false);
      }
    };

    fetchHeldCarts();
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
        row.holdId.toLowerCase().includes(query) ||
        (row.customerName && row.customerName.toLowerCase().includes(query)) ||
        (row.customerCode && row.customerCode.toLowerCase().includes(query))
    );
    setFilteredRows(filtered);
  };

  const handleRowClick = (row: HoldListRow) => {
    setSelectedRowId(row.id);
  };

  const handleRowDoubleClick = (row: HoldListRow) => {
    const cart = carts.find((c) => c.id === row.id);
    if (cart && onSelect) {
      onSelect(cart);
      if (onClose) onClose();
    }
  };

  const handleSelect = () => {
    if (selectedRowId && onSelect) {
      const cart = carts.find((c) => c.id === selectedRowId);
      if (cart) {
        onSelect(cart);
        if (onClose) onClose();
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedRowId) return;

    try {
      await deleteHeldCart(selectedRowId);
      
      const updatedCarts = carts.filter((c) => c.id !== selectedRowId);
      setCarts(updatedCarts);

      const updatedRows = rows.filter((r) => r.id !== selectedRowId);
      setRows(updatedRows);
      setFilteredRows(updatedRows.filter((r) => 
        !searchQuery || 
        r.holdId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.customerName && r.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.customerCode && r.customerCode.toLowerCase().includes(searchQuery.toLowerCase()))
      ));

      setSelectedRowId(null);

      if (onDelete) {
        onDelete(selectedRowId);
      }
    } catch (err) {
      console.error('Error deleting held cart:', err);
      setError(t('heldOrders.failedToDelete'));
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Enter') {
        const id = selectedRowIdRef.current;
        if (id && onSelect) {
          const cart = cartsRef.current.find((c) => c.id === id);
          if (cart) {
            event.preventDefault();
            event.stopPropagation();
            onSelect(cart);
            onClose?.();
          }
        }
        return;
      }
      const target = event.target as HTMLElement;
      const isInputFocused =
        modalRef.current?.contains(target) &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (isInputFocused && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        event.stopPropagation();
        const rows = filteredRowsRef.current;
        if (rows.length === 0) return;
        const idx = selectedRowIdRef.current
          ? rows.findIndex((r) => r.id === selectedRowIdRef.current)
          : -1;
        if (event.key === 'ArrowDown') {
          const nextIdx = idx < rows.length - 1 ? idx + 1 : 0;
          setSelectedRowId(rows[nextIdx].id);
        } else {
          const nextIdx = idx > 0 ? idx - 1 : rows.length - 1;
          setSelectedRowId(rows[nextIdx].id);
        }
        return;
      }
      trapFocus(event);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, onSelect]);

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const focusFirst = () => {
      const first = el.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (first && first.tabIndex !== -1) first.focus();
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(focusFirst);
    });
    const t = setTimeout(focusFirst, 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const container = modalRef.current;
    if (!container) return;
    const handleFocusIn = () => {
      const active = document.activeElement as Node;
      if (container.contains(active)) return;
      const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!first || first.tabIndex === -1) return;
      container.focus();
      requestAnimationFrame(() => {
        first.focus();
        if (document.activeElement !== first) {
          requestAnimationFrame(() => first.focus());
        }
      });
    };
    document.addEventListener('focusin', handleFocusIn, true);
    return () => document.removeEventListener('focusin', handleFocusIn, true);
  }, []);

  const baseColumns: Column<HoldListRow>[] = [
    {
      key: 'holdId',
      name: t('heldOrders.holdId'),
      resizable: true,
    },
    {
      key: 'customerName',
      name: t('heldOrders.customer'),
      resizable: true,
    },
    {
      key: 'customerCode',
      name: t('heldOrders.code'),
      resizable: true,
    },
    {
      key: 'itemCount',
      name: t('common.allItems'),
      resizable: true,
    },
    {
      key: 'total',
      name: t('common.totalAmount'),
      resizable: true,
      formatter: (props: any) => formatCurrency(props.row.total) as any,
    },
    {
      key: 'heldAt',
      name: t('heldOrders.heldAt'),
      resizable: true,
    },
  ];

  return (
    <div
      ref={modalRef}
      tabIndex={-1}
      className="flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xl min-w-[720px] w-[85vw] max-w-[1000px] h-[78vh] max-h-[720px] outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Held carts"
    >
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">{t('heldOrders.title')}</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <InputField
              placeholder={t('heldOrders.searchPlaceholder')}
              value={searchQuery}
              onChange={handleSearch}
              className="w-full rounded-lg border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {searchQuery && (
            <Button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilteredRows(rows);
              }}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
            >
              {t('buttons.clear')}
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {filteredRows.length} cart{filteredRows.length !== 1 ? 's' : ''} • Double‑click or select and press Restore
        </p>
      </div>

      <div className="flex-1 min-h-0 bg-white">
        <ProductDataGrid
          columns={baseColumns}
          rows={filteredRows}
          loading={loading}
          error={error}
          height="100%"
          rowHeight={40}
          onRowClick={handleRowClick}
          onRowDoubleClick={handleRowDoubleClick}
          onRowSelect={setSelectedRowId}
          selectedRowId={selectedRowId}
          showColumnVisibility={true}
          storageKey="holdListModal"
        />
      </div>

      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center gap-4 shrink-0">
        <div className="text-sm text-slate-600">
          {selectedRowId ? (
            <span>Selected: <strong>{filteredRows.find((r) => r.id === selectedRowId)?.holdId ?? selectedRowId}</strong></span>
          ) : (
            <span>{t('heldOrders.selectToRestore')}</span>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
          >
            {t('buttons.cancel')}
          </Button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!selectedRowId}
            className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('buttons.delete')}
          </button>
          <button
            type="button"
            onClick={handleSelect}
            disabled={!selectedRowId}
            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('heldOrders.restore')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HoldListModal;
