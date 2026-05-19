import React, { useState } from 'react';
import { toast } from 'sonner';
import { createCustomer, type Customer } from '../../../main/api/customers';

interface Props {
  onClose: () => void;
  onCreated?: (customer: Customer) => void;
}

interface FormState {
  customer_name: string;
  customer_type: string;
  mobile_no: string;
  email_id: string;
  tax_id: string;
  custom_customer_arabic_name: string;
  custom_crn_no: string;
}

const initialForm: FormState = {
  customer_name: '',
  customer_type: 'Individual',
  mobile_no: '',
  email_id: '',
  tax_id: '',
  custom_customer_arabic_name: '',
  custom_crn_no: '',
};

const CreateCustomerModal: React.FC<Props> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim()) {
      setError('Customer name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await createCustomer({
        customer_name: form.customer_name.trim(),
        customer_type: form.customer_type || 'Individual',
        mobile_no: form.mobile_no.trim(),
        email_id: form.email_id.trim(),
        tax_id: form.tax_id.trim(),
        custom_customer_arabic_name: form.custom_customer_arabic_name.trim(),
        custom_crn_no: form.custom_crn_no.trim(),
      });
      const success = Number(res?.message?.success_key) === 1;
      if (success) {
        const created = (res?.message as { customer?: Customer })?.customer;
        if (created && typeof (window as any).customers?.save === 'function') {
          try {
            await (window as any).customers.save(created);
          } catch (err) {
            console.error('Failed to save customer locally:', err);
          }
        }
        toast.success(res?.message?.message ?? 'Customer created successfully');
        onCreated?.(created as Customer);
        onClose();
      } else {
        const msg =
          res?.message?.message ??
          (res as any)?.exc_type ??
          (res as any)?.message ??
          'Failed to create customer.';
        setError(String(msg));
        toast.error(String(msg));
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to create customer.';
      setError(String(msg));
      toast.error(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'rounded-lg border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

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
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Customer name *</span>
          <input
            autoFocus
            value={form.customer_name}
            onChange={(e) => setField('customer_name', e.target.value)}
            className={inputCls}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Customer type</span>
          <select
            value={form.customer_type}
            onChange={(e) => setField('customer_type', e.target.value)}
            className={inputCls}
          >
            <option value="Individual">Individual</option>
            <option value="Company">Company</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Mobile</span>
          <input
            value={form.mobile_no}
            onChange={(e) => setField('mobile_no', e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Email</span>
          <input
            type="email"
            value={form.email_id}
            onChange={(e) => setField('email_id', e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Tax / Reg no</span>
          <input
            value={form.tax_id}
            onChange={(e) => setField('tax_id', e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">CRN no</span>
          <input
            value={form.custom_crn_no}
            onChange={(e) => setField('custom_crn_no', e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Arabic name</span>
          <input
            value={form.custom_customer_arabic_name}
            onChange={(e) => setField('custom_customer_arabic_name', e.target.value)}
            className={inputCls}
            dir="rtl"
          />
        </label>
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

export default CreateCustomerModal;
