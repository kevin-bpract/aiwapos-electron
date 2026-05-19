import React, { useState } from 'react';
import { toast } from 'sonner';
import { createProduct } from '../../../main/api/products';
import { ItemGroup } from '../../../main/api/itemGroups';

interface UOM {
  name: string;
  must_be_whole_number: number;
}

interface Product {
  itemCode: string;
  itemName: string;
  itemGroup: string;
  stockUOM: string;
  standardRate: string;
  description: string;
  barcode: string;
  isStockItem: boolean;
  isSalesItem: boolean;
}

const initialForm: Product = {
  itemCode: '',
  itemName: '',
  itemGroup: '',
  stockUOM: '',
  standardRate: '',
  description: '',
  barcode: '',
  isStockItem: true,
  isSalesItem: true,
};

interface Props {
  onClose: () => void;
  onCreated?: (product: Product) => void;
}

const CreateProductModal: React.FC<Props> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState<Product>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);

  React.useEffect(() => {
    const fetchItemGroups = async () => {
      try {
        const res = await window.itemGroups.getAll();
        console.log('res', res);
        setItemGroups(res);
        if (res.length > 0) {
          setField('itemGroup', res[0].name);
        }
      } catch (error) {
        console.error('Error fetching item groups:', error);
      }
    };
    const fetchUoms = async () => {
      try {
        const res = await window.uoms.getAll();
        console.log('uoms', res);
        setUoms(res);
        if (res.length > 0) {
          setField('stockUOM', res[0].name);
        }
      } catch (error) {
        console.error('Error fetching UOMs:', error);
      }
    };
    fetchItemGroups();
    fetchUoms();
  }, []);

  const setField = (key: keyof Product, value: string | number | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('form', form);
    try {
      const res = await createProduct({
        item_code: form.itemCode.trim(),
        item_name: form.itemName.trim(),
        item_group: form.itemGroup.trim(),
        stock_uom: form.stockUOM.trim(),
        standard_rate: parseFloat(form.standardRate) || 0,
        description: form.description.trim(),
        barcode: form.barcode.trim(),
        is_stock_item: form.isStockItem,
        is_sales_item: form.isSalesItem,
        is_purchase_item: false,
      });
      const success = Number(res?.message?.success_key) === 1;
      if (success) {
        const created = (res?.message as { product?: Product })?.product;
        if (created && typeof (window as any).products?.save === 'function') {
          try {
            await (window as any).products.save(created);
          } catch (err) {
            console.error('Failed to save product locally:', err);
          }
        }
        toast.success(res?.message?.message ?? 'Product created successfully');
        onCreated?.(created as Product);
        onClose();
      } else {
        const msg =
          res?.message?.message ??
          (res as any)?.exc_type ??
          (res as any)?.message ??
          'Failed to create product.';
        setError(String(msg));
        toast.error(String(msg));
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to create product.';
      setError(String(msg));
      toast.error(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'rounded-lg border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  const checkboxCls =
    'w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer';

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white w-[520px] max-w-[95vw] flex flex-col"
    >
      {error && (
        <p className="px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {error}
        </p>
      )}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Item Code</span>
          <input
            autoFocus
            value={form.itemCode}
            onChange={(e) => setField('itemCode', e.target.value)}
            className={inputCls}
            placeholder="e.g. ITEM-001"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Item Name *</span>
          <input
            value={form.itemName}
            onChange={(e) => setField('itemName', e.target.value)}
            className={inputCls}
            required
            placeholder="e.g. Test Item"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Item Group</span>
          <select
            value={form.itemGroup}
            onChange={(e) => setField('itemGroup', e.target.value)}
            className={inputCls}
          >
            <option value="" disabled>
              Select item group
            </option>
            {itemGroups.length > 0 &&
              itemGroups.map((itemGroup) => (
                <option key={itemGroup.name} value={itemGroup.name}>
                  {itemGroup.name}
                </option>
              ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Stock UOM</span>
          <select
            value={form.stockUOM}
            onChange={(e) => setField('stockUOM', e.target.value)}
            className={inputCls}
          >
            <option value="" disabled>
              Select stock UOM
            </option>
            {uoms.length > 0 &&
              uoms.map((uom) => (
                <option key={uom.name} value={uom.name}>
                  {uom.name}
                </option>
              ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">
            Standard Rate
          </span>
          <input
            type="number"
            min={0}
            value={form.standardRate || ''}
            onChange={(e) => {
              const val = e.target.value;
              setField('standardRate', val === '' ? '' : parseFloat(val) || 0);
            }}
            onFocus={(e) => e.target.select()}
            className={inputCls}
            placeholder="0.00"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Barcode</span>
          <input
            value={form.barcode}
            onChange={(e) => setField('barcode', e.target.value)}
            className={inputCls}
            placeholder="e.g. 123456789"
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            className={`${inputCls} resize-none`}
            rows={3}
            placeholder="Item description..."
          />
        </label>

        <div className="sm:col-span-2 flex flex-wrap gap-5 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isStockItem}
              onChange={(e) => setField('isStockItem', e.target.checked)}
              className={checkboxCls}
            />
            <span className="text-sm text-gray-700">Stock Item</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isSalesItem}
              onChange={(e) => setField('isSalesItem', e.target.checked)}
              className={checkboxCls}
            />
            <span className="text-sm text-gray-700">Sales Item</span>
          </label>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {saving ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  );
};

export default CreateProductModal;
