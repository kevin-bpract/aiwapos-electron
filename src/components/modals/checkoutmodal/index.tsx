import React, { useState, useEffect, useRef } from 'react';
import { X, DollarSign, CreditCard, Wallet, Receipt, Users, Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  getModeOfPayments,
  type ModeOfPayment,
} from '../../../main/api/invoice';
import {
  getSalesInvoiceHTML,
  getSalesOrderHTML,
  printSalesOrderPDF,
  printSalesInvoicePDF,
} from '../../../main/api/salesOrders';
import { usePrinter } from '../../../hooks/usePrinter';
import { clientSidePrint } from '../../../utils/clientSidePrint';
import NumericKeypad from '../../numerickeypad/NumericKeypad';
import { type Customer } from '../../../main/api/customers';
import ReactDOM from 'react-dom';

interface PaymentField {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

interface CheckoutData {
  totalAmount: number;
  charges: number;
  discount: number;
  additionalDiscount: number;
  payments: {
    [key: string]: number;
  };
  paymentMethod: PaymentMethod;
  customerName?: string;
  contactNumber?: string;
  selectedCustomer?: any;
}

type PaymentMethod = 'cash' | 'credit' | 'partial';

interface CheckoutModalProps {
  onClose: () => void;
  onComplete?: (data: CheckoutData) => void | Promise<any>;
  initialData?: Partial<CheckoutData>;
  error?: string | null;
  onClearError?: () => void;
  maxAdditionalDiscount?: number;
  showNumericKeypad?: boolean;
  isTaxInclusive?: boolean;
  onCreateOrder?: (data: CheckoutData) => void | Promise<any>;
}

// Reusable Components
const NumberInput: React.FC<{
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  shouldSelectOnFocus?: boolean;
}> = ({
  id,
  label,
  value,
  onChange,
  placeholder = '0.00',
  className = '',
  fullWidth = false,
  disabled,
  onFocus,
  onBlur,
  shouldSelectOnFocus = false,
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (newValue === '' || /^\d*\.?\d*$/.test(newValue)) {
        onChange(newValue);
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (onFocus) {
        onFocus();
      }
      if (shouldSelectOnFocus) {
        setTimeout(() => {
          e.target.select();
        }, 0);
      }
    };

    const handleBlur = () => {
      if (onBlur) {
        onBlur();
      }
    };

    return (
      <div className={`space-y-2 ${fullWidth ? 'w-full' : ''}`}>
        {label && <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`w-full px-3 py-2 border rounded-md transition !text-slate-900
    ${disabled
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
              : 'bg-white text-slate-900 border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            }
    ${className}
  `}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
      </div>
    );
  };

const AmountDisplay: React.FC<{
  label: string;
  amount: number;
  variant?: 'default' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}> = ({ label, amount, variant = 'default', size = 'md' }) => {
  const bgColors = {
    default: 'bg-slate-50 border-slate-200',
    success: 'bg-green-50 border-green-200',
    danger: 'bg-red-50 border-red-200',
  };

  const textColors = {
    default: 'text-slate-900',
    success: amount >= 0 ? 'text-green-700' : 'text-red-700',
    danger: 'text-red-700',
  };

  const sizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className={`${bgColors[variant]} p-4 border border-slate-200`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        <span className={`${sizes[size]} font-black ${textColors[variant]} tabular-nums`}>
          SAR {Math.abs(amount).toFixed(2)}
        </span>
      </div>
    </div>
  );
};

// Main Component
const CheckoutModal: React.FC<CheckoutModalProps> = ({
  onClose,
  onComplete,
  initialData,
  error,
  onClearError,
  maxAdditionalDiscount = 0,
  showNumericKeypad = false,
  isTaxInclusive = false,
  onCreateOrder,
}) => {
  const { t } = useTranslation();
  const { print } = usePrinter();
  // Display error as toast notification
  useEffect(() => {
    if (error) {
      const cleanError = error
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      toast.error(cleanError, {
        duration: 10000,
        position: 'top-center',
        className: 'text-base',
      });

      if (onClearError) {
        setTimeout(() => onClearError(), 100);
      }
    }
  }, [error]);

  const [totalAmount, setTotalAmount] = useState(initialData?.totalAmount?.toString() || '');
  const [charges, setCharges] = useState(initialData?.charges?.toFixed(2) || '');
  const [additionalDiscount, setAdditionalDiscount] = useState(initialData?.additionalDiscount?.toString() || '');
  const [discount, setDiscount] = useState(initialData?.discount?.toString() || '');

  // Sync core billing figures dynamically if props change while modal is open
  useEffect(() => {
    if (initialData?.totalAmount !== undefined) setTotalAmount(initialData.totalAmount.toString());
    if (initialData?.charges !== undefined) setCharges(initialData.charges.toFixed(2));
    if (initialData?.discount !== undefined) setDiscount(initialData.discount.toString());
  }, [initialData?.totalAmount, initialData?.charges, initialData?.discount]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialData?.paymentMethod || 'cash');
  const [paymentModes, setPaymentModes] = useState<ModeOfPayment[]>([]);
  const [defaultPaymentMode, setDefaultPaymentMode] = useState<string | null>(null);
  const [paymentValues, setPaymentValues] = useState<{ [key: string]: string }>({});
  const [loadingPaymentModes, setLoadingPaymentModes] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastSubmitTimeRef = useRef<number>(0);
  const prevNetAmountRef = useRef<number | null>(null);
  const DEBOUNCE_MS = 500;
  const [focusedPaymentField, setFocusedPaymentField] = useState<string | null>(null);

  // Customer Selection State (Dropdown)
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [customerName, setCustomerName] = useState(initialData?.customerName || '');
  const [contactNumber, setContactNumber] = useState(initialData?.contactNumber || '');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(initialData?.selectedCustomer || null);

  const customerInputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const selectedItemRef = React.useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  useEffect(() => {
    if (initialData?.customerName) setCustomerName(initialData.customerName);
    if (initialData?.contactNumber) setContactNumber(initialData.contactNumber);
    if (initialData?.selectedCustomer) setSelectedCustomer(initialData.selectedCustomer);
  }, [initialData]);

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setLoadingCustomers(true);
        // @ts-ignore
        const data = await window.customers.getAll();
        setCustomers(data);
        setFilteredCustomers(data.slice(0, 50));
      } catch (error) {
        console.error('Error loading customers:', error);
      } finally {
        setLoadingCustomers(false);
      }
    };
    loadCustomers();
  }, []);

  // Filter customers
  useEffect(() => {
    if (!searchQuery) {
      setFilteredCustomers(customers.slice(0, 50));
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = customers.filter((c) =>
      c.name?.toLowerCase().includes(query) ||
      c.customer_name?.toLowerCase().includes(query) ||
      c.mobile_no?.toLowerCase().includes(query) ||
      c.tax_id?.toLowerCase().includes(query)
    );
    setFilteredCustomers(filtered.slice(0, 50));
    setSelectedIndex(0);
  }, [searchQuery, customers]);

  // Scroll highlighted item into view on arrow key navigation
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  const handleCustomerInputClick = () => {
    if (customerInputRef.current) {
      const rect = customerInputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 400),
      });
    }
    setShowDropdown(true);
    setSearchQuery('');
  };

  const handleCustomerSelect = (customer: Customer) => {
    setCustomerName(customer.customer_name || customer.name);
    setContactNumber(customer.mobile_no || '');
    setSelectedCustomer(customer);
    setShowDropdown(false);
    setSearchQuery('');
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        customerInputRef.current &&
        !customerInputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Calculations – use Number(…toFixed(2)) to avoid floating-point precision errors
  const netAmount = Number(
    (
      parseFloat(totalAmount || '0') +
      (isTaxInclusive ? 0 : parseFloat(charges || '0')) -
      parseFloat(discount || '0') -
      parseFloat(additionalDiscount || '0')
    ).toFixed(2),
  );

  // Fetch payment modes on mount
  useEffect(() => {
    const fetchPaymentModes = async () => {
      try {
        setLoadingPaymentModes(true);
        const { modes, defaultMode } = await getModeOfPayments();
        setPaymentModes(modes);
        setDefaultPaymentMode(defaultMode);

        // Pre-fill default mode (or cash) with net amount
        if (paymentMethod === 'cash' && modes.length > 0) {
          // Use user's default mode if available, otherwise first Cash mode
          const defaultModeObj = defaultMode ? modes.find(m => m.name === defaultMode) : null;
          const cashMode = defaultModeObj || modes.find(m => m.type === 'Cash') || modes[0];

          // Calculate the true net amount based on initial data for prefilling
          const initialTotal = parseFloat(initialData?.totalAmount?.toString() || '0');
          const initialCharges = parseFloat(initialData?.charges?.toString() || '0');
          const initialDiscount = parseFloat(initialData?.discount?.toString() || '0');
          const initialAdditionalDiscount = parseFloat(initialData?.additionalDiscount?.toString() || '0');

          const trueNetAmount = initialTotal + (isTaxInclusive ? 0 : initialCharges) - initialDiscount - initialAdditionalDiscount;

          setPaymentValues({ [cashMode.name]: trueNetAmount.toFixed(2) });
          setFocusedPaymentField(cashMode.name);
        }
      } catch (error) {
        console.error('Failed to fetch payment modes:', error);
      } finally {
        setLoadingPaymentModes(false);
      }
    };

    fetchPaymentModes();

    // Listen for data sync completion to refetch payment modes
    const handleSyncComplete = () => {
      console.log('[CheckoutModal] Data sync completed, refetching payment modes...');
      fetchPaymentModes();
    };

    window.addEventListener('data-sync-completed', handleSyncComplete);
    return () => window.removeEventListener('data-sync-completed', handleSyncComplete);
  }, []);

  // Update payment values when paymentMethod or netAmount changes (don't overwrite when switching from Credit with entered values)
  // Skip when user is typing in the additional discount field so we don't steal focus.
  useEffect(() => {
    if (document.activeElement?.id === 'input-additional-discount') {
      prevNetAmountRef.current = netAmount;
      return;
    }
    const totalPaidCurrent = Object.values(paymentValues).reduce((s, v) => s + (parseFloat(v || '0') || 0), 0);
    if (paymentMethod === 'cash' && paymentModes.length > 0) {
      // Use user's default mode if available
      const defaultModeObj = defaultPaymentMode ? paymentModes.find(m => m.name === defaultPaymentMode) : null;
      const cashMode = defaultModeObj || paymentModes.find(m => m.type === 'Cash') || paymentModes[0];
      if (totalPaidCurrent === 0) {
        setPaymentValues({ [cashMode.name]: netAmount.toFixed(2) });
      } else if (
        prevNetAmountRef.current !== null &&
        Math.abs(totalPaidCurrent - prevNetAmountRef.current) < 0.02
      ) {
        // When additional discount (or discount) changes, reduce the payment amount by that discount so the input shows net amount (e.g. 315 → 300 when add. discount 15)
        setPaymentValues({ [cashMode.name]: netAmount.toFixed(2) });
      }
      setFocusedPaymentField(cashMode.name);
    } else if (paymentMethod === 'credit') {
      // Credit: do not set values here; we clear on tab click only so inputs stay empty when selecting Credit
      if (paymentModes.length > 0) setFocusedPaymentField(paymentModes[0].name);
    } else if (paymentMethod === 'partial' && paymentModes.length > 0) {
      if (totalPaidCurrent === 0) {
        setPaymentValues({ [paymentModes[0].name]: netAmount.toFixed(2) });
      } else if (
        prevNetAmountRef.current !== null &&
        Math.abs(totalPaidCurrent - prevNetAmountRef.current) < 0.02
      ) {
        setPaymentValues({ [paymentModes[0].name]: netAmount.toFixed(2) });
      }
      setFocusedPaymentField(paymentModes[0].name);
    }
    prevNetAmountRef.current = netAmount;
  }, [paymentMethod, paymentModes, defaultPaymentMode, netAmount]);

  // Cap additional discount only when it exceeds max (and max is set). Don't cap on every keystroke or when max is 0.
  useEffect(() => {
    if (maxAdditionalDiscount <= 0) return;
    const discountValue = parseFloat(additionalDiscount || '0');
    if (Number.isNaN(discountValue) || discountValue <= maxAdditionalDiscount) return;
    setAdditionalDiscount(maxAdditionalDiscount.toFixed(2));
  }, [maxAdditionalDiscount, additionalDiscount]);

  const totalPaid = Object.values(paymentValues).reduce(
    (sum, value) => sum + parseFloat(value || '0'),
    0,
  );

  const change = Number((totalPaid - netAmount).toFixed(2));
  const creditRemainder = totalPaid < netAmount ? Number((netAmount - totalPaid).toFixed(2)) : 0;
  const creditModeName = paymentModes.find(m => m.type === 'Credit')?.name || 'Credit';

  const paymentMethods: Array<{
    value: PaymentMethod;
    label: string;
    icon: React.ReactNode;
  }> = [
      { value: 'cash', label: t('paymentMethods.cash'), icon: <DollarSign className="w-5 h-5" /> },
      { value: 'credit', label: t('paymentMethods.credit'), icon: <CreditCard className="w-5 h-5" /> },
      { value: 'partial', label: t('paymentMethods.partial'), icon: <Wallet className="w-5 h-5" /> },
    ];

  const handleComplete = async () => {
    if (isSubmitting) return;
    const now = Date.now();
    if (now - lastSubmitTimeRef.current < DEBOUNCE_MS) return;
    lastSubmitTimeRef.current = now;
    onClearError?.();

    if (paymentMethod === 'cash' && change < 0) {
      toast.error(`${t('checkout.insufficientPayment')} ${Math.abs(change).toFixed(2)}`);
      return;
    }

    const payments: { [key: string]: number } = {};
    Object.keys(paymentValues).forEach((key) => {
      const value = parseFloat(paymentValues[key] || '0');
      if (value > 0) payments[key] = value;
    });
    if (creditRemainder > 0) {
      payments[creditModeName] = (payments[creditModeName] || 0) + creditRemainder;
    }

    const data: CheckoutData = {
      totalAmount: parseFloat(totalAmount || '0'),
      charges: parseFloat(charges || '0'),
      discount: parseFloat(discount || '0'),
      additionalDiscount: parseFloat(additionalDiscount || '0'),
      payments,
      paymentMethod,
      customerName,
      contactNumber,
      selectedCustomer,
    };

    setIsSubmitting(true);
    try {
      const invoiceName = await onComplete?.(data);
      if (invoiceName && typeof invoiceName === 'string') {
        try {
          const settings = await window.printerSettings.get();
          if (settings) {
            if (settings.clientSidePrintEnabled) {
              await clientSidePrint({
                salesInvoice: invoiceName,
                format: settings.clientSidePrintFormat || 'standard',
              });
            } else {
              const formatToUse = settings.invoicePrintFormat || undefined;
              if (settings.printMethod === 'html') {
                const htmlContent = await getSalesInvoiceHTML(invoiceName, formatToUse);
                if (htmlContent) {
                  await print({ type: 'html', data: htmlContent });
                }
              } else {
                const pdfBlob = await printSalesInvoicePDF(invoiceName, formatToUse);
                if (pdfBlob) {
                  await print({ type: 'invoice', data: pdfBlob, invoiceNo: invoiceName, printSettings: 'fit' });
                }
              }
            }
          }
        } catch (printError) {
          console.error('Invoice printing failed:', printError);
          toast.error(t('messages.failedToPrintInvoice'));
        }
      }
    } catch (err) {
      console.error('Error during checkout completion:', err);
    } finally {
      // If the component is still mounted, reset the submitting state
      setIsSubmitting(false);
    }
  };

  const handleCreateOrder = async () => {
    if (isSubmitting) return;
    const now = Date.now();
    if (now - lastSubmitTimeRef.current < DEBOUNCE_MS) return;
    lastSubmitTimeRef.current = now;
    onClearError?.();

    if (!onCreateOrder) return;

    const data: CheckoutData = {
      totalAmount: parseFloat(totalAmount || '0'),
      charges: parseFloat(charges || '0'),
      discount: parseFloat(discount || '0'),
      additionalDiscount: parseFloat(additionalDiscount || '0'),
      payments: {},
      paymentMethod,
      customerName,
      contactNumber,
      selectedCustomer,
    };

    setIsSubmitting(true);
    try {
      const orderName = await onCreateOrder(data);
      if (orderName && typeof orderName === 'string') {
        try {
          const settings = await window.printerSettings.get();
          if (settings?.autoprint) {
            if (settings.printMethod === 'html') {
              const orderHtml = await getSalesOrderHTML(orderName);
              if (orderHtml) {
                await print({ type: 'html', data: orderHtml });
              }
            } else {
              const orderBlob = await printSalesOrderPDF(orderName);
              if (orderBlob) {
                await print({ type: 'default', data: orderBlob, title: `Order - ${orderName}` });
              }
            }
          }
        } catch (printError) {
          console.error('Order printing failed:', printError);
          toast.error(t('messages.failedToPrintOrder'));
        }
      }
    } catch (err) {
      console.error('Error during order creation:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentValueChange = (modeName: string, value: string) => {
    const newValues = { ...paymentValues, [modeName]: value };
    const numericValue = parseFloat(value) || 0;
    // In Credit mode, remainder is credit — do not auto-fill another payment mode
    if (paymentMethod === 'cash' && paymentModes.length > 1) {
      const remaining = Number((netAmount - numericValue).toFixed(2));
      const otherMode = paymentModes.find(m => m.name !== modeName);
      if (otherMode) {
        newValues[otherMode.name] = remaining > 0 ? remaining.toFixed(2) : '0.00';
      }
    }
    setPaymentValues(newValues);
  };

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    if (method === 'credit') {
      setPaymentValues({});
      if (paymentModes.length > 0) setFocusedPaymentField(paymentModes[0].name);
    }
    setPaymentMethod(method);
  };

  const handlePaymentFieldClick = (modeName: string) => {
    if (paymentMethod === 'partial') return;
    if (paymentMethod === 'credit') {
      setFocusedPaymentField(modeName);
      return;
    }
    const newValues: { [key: string]: string } = {};
    paymentModes.forEach((mode) => {
      newValues[mode.name] = mode.name === modeName ? netAmount.toFixed(2) : '';
    });
    setPaymentValues(newValues);
    setFocusedPaymentField(modeName);
  };

  const isFieldDisabled = (): boolean => {
    return false;
  };

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return ReactDOM.createPortal(
    <>
      <Toaster richColors closeButton />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-sm">
        {/* Modal Container */}
        <div className="bg-white w-full max-w-7xl h-[85vh] rounded-md flex flex-col overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-600 rounded-sm">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold tracking-wide">{t('checkout.title')}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-8 h-8 text-slate-400 hover:text-white" />
            </button>
          </div>

          {/* Main Content Split */}
          <div className="flex-1 flex flex-row overflow-hidden text-slate-900">

            {/* ZONE 1: Details (30%) - Left Column */}
            <div className="w-[30%] bg-slate-50 flex flex-col border-r border-slate-200">
              <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('checkout.amountDetails')}</h3>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('checkout.customer')}</label>
                    <div className="relative flex-1">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        ref={customerInputRef}
                        type="text"
                        value={customerName || (selectedCustomer?.name ? `(${selectedCustomer.name}) ${selectedCustomer.customer_name}` : '')}
                        onClick={handleCustomerInputClick}
                        readOnly
                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-md focus:border-blue-500 focus:ring-0 font-bold text-slate-700 transition-all text-lg placeholder:font-normal cursor-pointer hover:bg-slate-50"
                        placeholder={t('checkout.selectCustomer')}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('checkout.contact')}</label>
                    <input
                      type="text"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-md focus:border-blue-500 focus:ring-0 font-semibold text-slate-700"
                      placeholder={t('checkout.phoneNumber')}
                      disabled
                    />
                  </div>
                </div>

                <div className="h-px bg-slate-200 my-2"></div>

                <NumberInput
                  label={t('checkout.subtotal')}
                  value={parseFloat(totalAmount || '0').toFixed(2)}
                  onChange={() => { }}
                  disabled={true}
                  className="!text-2xl font-black bg-slate-100"
                  fullWidth
                />

                <div className="grid grid-cols-2 gap-3">
                  <NumberInput
                    label={t('checkout.taxAmount')}
                    value={charges}
                    onChange={setCharges}
                    disabled={true}
                    fullWidth
                  />
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">{t('checkout.additionalDiscount')}</label>
                    <input
                      id="input-additional-discount"
                      type="text"
                      inputMode="decimal"
                      value={additionalDiscount}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d*\.?\d*$/.test(v)) setAdditionalDiscount(v);
                      }}
                      onFocus={(e) => setTimeout(() => e.target.select(), 0)}
                      onBlur={() => {
                        // Sync payment amount to net when leaving additional discount so cash/partial field is up to date
                        if (paymentMethod === 'cash' && paymentModes.length > 0) {
                          const defaultModeObj = defaultPaymentMode ? paymentModes.find(m => m.name === defaultPaymentMode) : null;
                          const cashMode = defaultModeObj || paymentModes.find(m => m.type === 'Cash') || paymentModes[0];
                          setPaymentValues(prev => ({ ...prev, [cashMode.name]: netAmount.toFixed(2) }));
                        } else if (paymentMethod === 'partial' && paymentModes.length > 0) {
                          setPaymentValues(prev => ({ ...prev, [paymentModes[0].name]: netAmount.toFixed(2) }));
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                    />
                    {maxAdditionalDiscount > 0 && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{t('checkout.max')}: {maxAdditionalDiscount.toFixed(2)}</p>}
                  </div>
                </div>
              </div>

              <div className="mt-auto p-6 bg-white border-t border-slate-200">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('checkout.totalPayable')}</div>
                <div className="text-5xl font-black text-slate-900 tabular-nums">
                  SAR {netAmount.toFixed(2)}
                </div>
              </div>
            </div>

            {/* ZONE 2: Payment (35%) - Middle Column */}
            <div className="w-[35%] bg-white flex flex-col border-r border-slate-200">

              {/* Payment Methods Tabs */}
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex gap-3 h-20">
                  {paymentMethods.map(method => (
                    <button
                      key={method.value}
                      onClick={() => handlePaymentMethodChange(method.value)}
                      className={`flex-1 rounded-md border-2 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${paymentMethod === method.value
                        ? 'bg-white border-blue-600 text-blue-700'
                        : 'bg-slate-100 border-transparent text-slate-400 hover:bg-white hover:border-slate-300'
                        }`}
                    >
                      {React.cloneElement(method.icon as React.ReactElement<any>, { className: "w-5 h-5" })}
                      <span className="text-[10px] font-black uppercase tracking-wide">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Breakdown / Inputs */}
              <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('checkout.paymentBreakdown')}</label>
                </div>
                {loadingPaymentModes ? (
                  <div className="p-10 text-center text-slate-400 uppercase tracking-widest text-xs animate-pulse">{t('checkout.loadingModes')}</div>
                ) : (
                  paymentModes.map(mode => (
                    <div
                      key={mode.name}
                      onClick={() => handlePaymentFieldClick(mode.name)}
                      className={`relative border rounded-md transition-all ${focusedPaymentField === mode.name ? 'border-blue-600 bg-blue-50/10' : 'border-slate-100 bg-slate-50'}`}
                    >
                      <span className="absolute top-2 left-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{mode.name}</span>
                      <NumberInput
                        id={`input-${mode.name}`}
                        label=""
                        value={paymentValues[mode.name] || ''}
                        onChange={(val) => handlePaymentValueChange(mode.name, val)}
                        onFocus={() => setFocusedPaymentField(mode.name)}
                        className="!bg-transparent !border-none !text-4xl font-black text-right !p-6 !pt-8 h-20 text-slate-900"
                        fullWidth
                        disabled={false}
                      />
                    </div>
                  ))
                )}
                {paymentMethod === 'credit' && (
                  <p className="text-xs text-slate-500 mt-2">{t('checkout.enterAmountNote')}</p>
                )}
              </div>

              {/* Summary Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-200">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-slate-500 font-medium">
                    <span>{t('checkout.subtotal')}</span>
                    <span className="text-slate-700">{parseFloat(totalAmount || '0').toFixed(2)}</span>
                  </div>
                  {parseFloat(charges || '0') > 0 && (
                    <div className="flex justify-between text-sm text-slate-500 font-medium">
                      <span>{isTaxInclusive ? t('checkout.includesTax') : `${t('checkout.taxAmount')} / VAT`}</span>
                      <span className="text-orange-600">
                        {isTaxInclusive ? '' : '+'}
                        {parseFloat(charges || '0').toFixed(2)}
                      </span>
                    </div>
                  )}
                  {(parseFloat(discount || '0') + parseFloat(additionalDiscount || '0')) > 0 && (
                    <div className="flex justify-between text-sm text-slate-500 font-medium">
                      <span>{t('checkout.discount')}</span>
                      <span className="text-green-600">-${(parseFloat(discount || '0') + parseFloat(additionalDiscount || '0')).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="h-px bg-slate-200 my-2"></div>
                  {paymentMethod === 'credit' && creditRemainder > 0 && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 mb-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-amber-800 uppercase">{t('checkout.creditRemaining')}</span>
                        <span className="text-xl font-black text-amber-700 tabular-nums">SAR {creditRemainder.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline">
                    <span className="text-base font-bold text-slate-900 uppercase">{t('checkout.totalDue')}</span>
                    <span className={`text-3xl font-black ${change < 0 ? 'text-blue-600' : 'text-green-600'}`}>
                      {netAmount.toFixed(2)}
                    </span>
                  </div>
                  {change !== 0 && (
                    <div className="flex justify-end pt-1">
                      {change < 0 ? (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">{t('checkout.due')}: {Math.abs(change).toFixed(2)}</span>
                      ) : (
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">{t('checkout.change')}: {change.toFixed(2)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ZONE 3: Keypad & Quick Actions (35%) - Right Column */}
            <div className="w-[35%] bg-slate-100 flex flex-col p-4 gap-4">
              {showNumericKeypad ? (
                <>
                  <div className="grid grid-cols-4 gap-2 h-24 shrink-0">
                    {[10, 20, 50, 100, 200, 500, 1000, 2000].map(amount => (
                      <button
                        key={amount}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.preventDefault();
                          if (focusedPaymentField) {
                            if (paymentMethod === 'partial') {
                              setPaymentValues(prev => ({ ...prev, [focusedPaymentField]: amount.toString() }));
                            } else {
                              const newValues: { [key: string]: string } = {};
                              paymentModes.forEach(mode => {
                                newValues[mode.name] = mode.name === focusedPaymentField ? amount.toString() : '';
                              });
                              setPaymentValues(newValues);
                            }
                            // Reselect field
                            setTimeout(() => {
                              const el = document.getElementById(`input-${focusedPaymentField}`);
                              if (el) el.focus();
                            }, 0);
                          }
                        }}
                        className="bg-white hover:bg-blue-50 border border-slate-200 rounded-md text-slate-600 hover:text-blue-700 font-bold text-lg active:scale-95 transition-all flex flex-col items-center justify-center shadow-sm"
                      >
                        {amount}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 bg-white border border-slate-200 rounded-md p-2 overflow-hidden flex flex-col min-h-0">
                    <div className="flex-1 w-full h-full [&_button]:!h-full [&_button]:!text-2xl [&_button]:!rounded-md">
                      <NumericKeypad className="w-full h-full !p-0 shadow-none border-none" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1"></div>
              )}

              <div className="grid grid-cols-2 gap-3 h-24 shrink-0">
                <button
                  onClick={handleCreateOrder}
                  disabled={isSubmitting || !onCreateOrder}
                  className={`bg-white border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 rounded-md font-black text-lg uppercase tracking-wide transition-all active:scale-95 flex flex-col items-center justify-center ${isSubmitting || !onCreateOrder ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" aria-hidden />
                      <span>{t('checkout.processing')}</span>
                    </>
                  ) : (
                    <span>{t('checkout.createOrder')}</span>
                  )}
                </button>
                <button
                  onClick={handleComplete}
                  disabled={isSubmitting || (change < 0 && paymentMethod === 'cash')}
                  className={`rounded-md font-black text-xl uppercase tracking-wide transition-all active:scale-95 flex flex-col items-center justify-center gap-2 ${isSubmitting || (change < 0 && paymentMethod === 'cash')
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  title={paymentMethod === 'credit' && creditRemainder > 0 ? `Pay ${totalPaid.toFixed(2)} now; ${creditRemainder.toFixed(2)} as credit` : undefined}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" aria-hidden />
                      <span>{t('checkout.processing')}</span>
                    </>
                  ) : (
                    <span>{t('checkout.payAndPrint')}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dropdown Portal */}
      {showDropdown && dropdownPosition && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 9999,
          }}
          className="bg-white border border-gray-300 rounded-lg shadow-2xl max-h-96 overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedIndex((i) => Math.min(i + 1, filteredCustomers.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const customer = filteredCustomers[selectedIndex] ?? filteredCustomers[0];
                  if (customer) handleCustomerSelect(customer);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setShowDropdown(false);
                }
              }}
              placeholder={t('checkout.searchCustomers')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-80">
            {loadingCustomers ? (
              <div className="p-4 text-center text-gray-500 text-sm">{t('checkout.loadingCustomers')}</div>
            ) : filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer, index) => (
                <div
                  key={customer.name}
                  ref={index === selectedIndex ? selectedItemRef : null}
                  className={`p-4 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-blue-50 transition-colors ${index === selectedIndex ? 'bg-blue-50' : ''}`}
                  onClick={() => handleCustomerSelect(customer)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex flex-col gap-1">
                    <div className="font-bold text-slate-900">{customer.customer_name || customer.name}</div>
                    <div className="text-xs text-slate-500 flex gap-2">
                      <span>{customer.name}</span>
                      {customer.mobile_no && <span>• {customer.mobile_no}</span>}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-gray-500 text-sm">{t('checkout.noCustomersFound')}</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>,
    document.body
  );
};

export default CheckoutModal;
