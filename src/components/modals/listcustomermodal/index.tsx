import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { toast } from 'sonner';
import InputField from '../../ui/input';
import { getCustomers, updateCustomer, type Customer } from '../../../main/api/customers';
import { Pencil, X, Check } from 'lucide-react';

interface Props {
  onSearch?: (query: string) => void;
  onSelect?: (customer: Customer) => void;
  onClose?: () => void;
}

const ListCustomerModalCard: React.FC<Props> = ({ onSearch, onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const editModalRef = useRef<HTMLDivElement>(null);

  const FOCUSABLE_SELECTOR =
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

  const trapEditModalFocus = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    // Always stop propagation so Tab never reaches elements behind the modal
    e.stopPropagation();
    const container = editModalRef.current;
    if (!container) return;
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => el.tabIndex !== -1 && !(el as HTMLInputElement).disabled);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const current = document.activeElement as HTMLElement;
    const idx = focusable.indexOf(current);
    const isInside = idx !== -1;
    if (!isInside) {
      e.preventDefault();
      focusable[0].focus();
      return;
    }
    if (e.shiftKey) {
      e.preventDefault();
      const nextIdx = idx <= 0 ? focusable.length - 1 : idx - 1;
      focusable[nextIdx].focus();
    } else {
      e.preventDefault();
      const nextIdx = idx >= focusable.length - 1 ? 0 : idx + 1;
      focusable[nextIdx].focus();
    }
  };

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getCustomers({
        limit_start: 0,
        limit_page_length: 5000,
      });
      setCustomers(list);
      setFiltered(list);
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      setError(err?.message || 'Failed to fetch customers.');
      setCustomers([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setFiltered(customers);
      return;
    }
    const next = customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.customer_name?.toLowerCase().includes(q) ||
        c.mobile_no?.toLowerCase().includes(q) ||
        c.tax_id?.toLowerCase().includes(q) ||
        c.custom_crn_no?.toLowerCase().includes(q) ||
        c.email_id?.toLowerCase().includes(q)
    );
    setFiltered(next);
  }, [query, customers]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch?.(value);
  };

  const handleSelect = () => {
    if (!selectedId || !onSelect) return;
    const customer = customers.find((c) => c.name === selectedId);
    if (customer) {
      onSelect(customer);
      onClose?.();
    }
  };

  const startEdit = (c: Customer) => {
    setEditingId(c.name);
    setEditForm({
      customer_name: c.customer_name ?? '',
      mobile_no: c.mobile_no ?? '',
      tax_id: c.tax_id ?? '',
      custom_crn_no: c.custom_crn_no ?? '',
      email_id: c.email_id ?? '',
      custom_customer_arabic_name: c.custom_customer_arabic_name ?? '',
      disabled: c.disabled ?? 0,
    });
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setSaveError(null);
  };

  const handleSaveEdit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await updateCustomer({
        customer_name: editingId,
        new_customer_name: editForm.customer_name ?? '',
        mobile_no: editForm.mobile_no ?? '',
        email_id: editForm.email_id ?? '',
        disabled: editForm.disabled ?? 0,
        tax_id: editForm.tax_id ?? '',
        custom_customer_arabic_name: editForm.custom_customer_arabic_name ?? '',
        custom_crn_no: editForm.custom_crn_no ?? '',
      });
      const success = Number(res?.message?.success_key) === 1;
      if (success) {
        // Update local state with the customer returned by the API (no full sync)
        const updated = (res?.message as { customer?: Customer })?.customer;
        if (updated) {
          const merged: Customer = {
            ...updated,
            name: updated.name || editingId,
            // Persist full API response in extra_data so email_id, custom_customer_arabic_name etc. survive in local DB
            extra_data: {
              ...(updated.extra_data && typeof updated.extra_data === 'object' ? updated.extra_data : {}),
              email_id: updated.email_id,
              custom_customer_arabic_name: updated.custom_customer_arabic_name,
              disabled: updated.disabled,
            },
          };
          setCustomers((prev) =>
            prev.map((c) => (c.name === editingId ? merged : c))
          );
          setFiltered((prev) =>
            prev.map((c) => (c.name === editingId ? merged : c))
          );
          // Persist to local SQLite so next time modal opens we show updated data (not stale cache)
          if (typeof (window as any).customers?.save === 'function') {
            try {
              await (window as any).customers.save(merged);
            } catch (err: any) {
              console.error('Failed to update local customer cache:', err);
              toast.error('Saved on server but local list may show old data until refresh.');
            }
          }
        }
        cancelEdit();
      } else {
        const msg =
          res?.message?.message ??
          (res as any)?.exc_type ??
          (res as any)?.message ??
          'Update failed.';
        const isNotFound = typeof msg === 'string' && /not found/i.test(msg);
        const displayMsg = isNotFound
          ? 'This customer may only exist on this device and was never synced to the server, so it cannot be updated via the server.'
          : String(msg);
        setSaveError(displayMsg);
        toast.error(displayMsg);
      }
    } catch (err: any) {
      const msg = err?.message ?? err?.response?.data?.message ?? 'Failed to update customer.';
      const isNotFound = typeof msg === 'string' && /not found/i.test(msg);
      const displayMsg = isNotFound
        ? 'This customer may only exist on this device and was never synced to the server, so it cannot be updated via the server.'
        : String(msg);
      setSaveError(displayMsg);
      toast.error(displayMsg);
    } finally {
      setSaving(false);
    }
  };

  // Keyboard: Escape, Enter, Arrow Up/Down
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) cancelEdit();
        else onClose?.();
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (editingId) return;

      if (e.key === 'Enter' && filtered.length > 0) {
        const id = selectedId ?? filtered[0]?.name ?? null;
        if (id) {
          const customer = customers.find((c) => c.name === id);
          if (customer) {
            e.preventDefault();
            e.stopPropagation();
            startEdit(customer);
          }
        }
        return;
      }

      if (filtered.length === 0) return;
      const idx = selectedId ? filtered.findIndex((c) => c.name === selectedId) : -1;
      const safeIdx = idx < 0 ? 0 : idx;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedId(filtered[Math.min(safeIdx + 1, filtered.length - 1)].name);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedId(filtered[Math.max(safeIdx - 1, 0)].name);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, onSelect, filtered, selectedId, customers, editingId]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  // When edit modal opens, move focus into it so Tab stays trapped
  useEffect(() => {
    if (!editingId) return;
    const frame = requestAnimationFrame(() => {
      const container = editModalRef.current;
      if (!container) return;
      const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (first && first.tabIndex !== -1) first.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [editingId]);

  return (
    <div
      ref={listRef}
      className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white w-full max-w-2xl rounded-xl border border-gray-200"
      role="dialog"
      aria-label="Select customer"
    >
      <div className="px-4 py-3 border-b border-gray-200 shrink-0">
        <InputField
          placeholder="Search customers by name, phone, code..."
          value={query}
          onChange={handleSearchChange}
          className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const id = selectedId ?? filtered[0]?.name;
              if (id) {
                const customer = customers.find((c) => c.name === id);
                if (customer) startEdit(customer);
              }
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose?.();
            }
          }}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading customers...</div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No customers found.</div>
        ) : (
          <ul className="p-2 space-y-1">
            {filtered.map((c) => (
              <li key={c.name}>
                <div
                  ref={selectedId === c.name ? selectedRef : null}
                  onClick={() => setSelectedId(c.name)}
                  onDoubleClick={() => {
                    const cust = customers.find((x) => x.name === c.name);
                    if (cust && onSelect) {
                      onSelect(cust);
                      onClose?.();
                    }
                  }}
                  className={`rounded-lg border-2 p-3 cursor-pointer transition-colors ${selectedId === c.name ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-gray-50 hover:bg-gray-100'
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 truncate">
                        {c.customer_name || c.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Code: {c.name}</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-sm text-gray-600">
                        {c.mobile_no && <span>Mobile: {c.mobile_no}</span>}
                        {c.tax_id && <span>Tax: {c.tax_id}</span>}
                        {c.custom_crn_no && <span>CRN: {c.custom_crn_no}</span>}
                        {c.email_id && <span>Email: {c.email_id}</span>}
                        {c.custom_customer_arabic_name && (
                          <span>Arabic: {c.custom_customer_arabic_name}</span>
                        )}
                        {c.disabled === 1 && <span className="text-amber-600">Disabled</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(c);
                      }}
                      className="p-2 rounded-md text-gray-500 hover:bg-gray-200 hover:text-blue-600 shrink-0"
                      title="Edit customer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSelect}
          disabled={!selectedId}
          className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Select
        </button>
      </div>

      {editingId &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-customer-title"
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                trapEditModalFocus(e);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
              }
              if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveEdit();
              }
            }}
          >
            <div
              ref={editModalRef}
              className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <form
                onSubmit={handleSaveEdit}
                className="flex flex-col flex-1 min-h-0 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
                  <h2 id="edit-customer-title" className="text-lg font-semibold text-gray-900">
                    Edit customer
                  </h2>
                  <div className="flex gap-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {saveError && (
                  <p className="px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100">
                    {saveError}
                  </p>
                )}
                <div className="p-4 overflow-y-auto flex-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-600">Customer name</span>
                      <input
                        autoFocus
                        value={editForm.customer_name ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, customer_name: e.target.value }))}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-600">Mobile</span>
                      <input
                        value={editForm.mobile_no ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, mobile_no: e.target.value }))}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-600">Email</span>
                      <input
                        type="email"
                        value={editForm.email_id ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, email_id: e.target.value }))}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-600">Tax / Reg no</span>
                      <input
                        value={editForm.tax_id ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, tax_id: e.target.value }))}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </label>
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-xs font-medium text-gray-600">CRN no</span>
                      <input
                        value={editForm.custom_crn_no ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, custom_crn_no: e.target.value }))}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </label>
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-xs font-medium text-gray-600">Arabic name</span>
                      <input
                        value={editForm.custom_customer_arabic_name ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, custom_customer_arabic_name: e.target.value }))}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </label>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default ListCustomerModalCard;
