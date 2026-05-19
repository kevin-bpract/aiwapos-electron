import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  DollarSign,
  Receipt,
  Users,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import {
  getModeOfPayments,
  createPOSInvoice,
  type ModeOfPayment,
} from '../../../main/api/invoice';
import {
  createSalesOrder,
  getSalesInvoice,
  getSalesInvoiceHTML,
  getSalesOrderHTML,
  printSalesOrderPDF,
  printSalesInvoicePDF,
} from '../../../main/api/salesOrders';
import type { SaleItem } from '../../../types/saleItem';
import { formatCurrency } from '../../../utils/format';
import { usePrinter } from '../../../hooks/usePrinter';
import { printKotIfConfigured } from '../../../utils/printKot';
import { clientSidePrint } from '../../../utils/clientSidePrint';
import NumericKeypad from '../../numerickeypad/NumericKeypad';
import { type Customer } from '../../../main/api/customers';
// generateKOTHTML / KOTData removed — KOT is now handled by printKotIfConfigured (new API)
import { getNextBillNumber } from '../../../utils/billNumber';

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
  customerName: string;
  refNumber: string;
  contactNumber: string;
  orderType: 'dining' | 'parcel' | 'delivery';
}

type PaymentMethod = 'cash' | 'credit' | 'partial';

interface RestaurantCheckoutModalProps {
  onClose: () => void;
  onComplete?: (data: CheckoutData) => void;
  items: SaleItem[];
  charges: number;
  discount: number;
  total: number;
  error?: string | null;
  onClearError?: () => void;
  showNumericKeypad?: boolean;
  customerName?: string;
  customerCode?: string;
  isTaxIncluded?: boolean;
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
    // Allow empty string, numbers, and decimal points
    if (newValue === '' || /^\d*\.?\d*$/.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (onFocus) {
      onFocus();
    }

    // Only select all text if shouldSelectOnFocus is true (for mouse/touch clicks)
    // Don't select when using virtual keyboard to allow multi-digit entry
    if (shouldSelectOnFocus) {
      setTimeout(() => {
        e.target.select();
      }, 0);
    }

    // Trigger onChange if field is empty or zero to auto-fill
    const currentValue = parseFloat(e.target.value || '0');
    if (currentValue === 0 || e.target.value === '') {
      // This will trigger the handlePaymentValueChange which auto-fills
      const clickEvent = new Event('click', { bubbles: true });
      e.target.dispatchEvent(clickEvent);
    }
  };

  const handleBlur = () => {
    if (onBlur) {
      onBlur();
    }
  };

  return (
    <div className={`space-y-2 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`w-full px-3 py-2 border rounded-md transition !text-slate-900
    ${
      disabled
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
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  return (
    <div className={`${bgColors[variant]} p-4 border`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className={`${sizes[size]} font-semibold ${textColors[variant]}`}>
          {formatCurrency(Math.abs(amount))}
        </span>
      </div>
    </div>
  );
};

// Main Component
const RestaurantCheckoutModal: React.FC<RestaurantCheckoutModalProps> = ({
  onClose,
  onComplete,
  items,
  charges,
  discount,
  total,
  error,
  onClearError,
  showNumericKeypad = false,
  customerName: initialCustomerName = '',
  customerCode: initialCustomerCode = '',
  isTaxIncluded = false,
}) => {
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
  }, [error, onClearError]);

  const [orderType, setOrderType] = useState<'dining' | 'parcel' | 'delivery'>(
    'dining',
  );
  const [customerName, setCustomerName] = useState(
    initialCustomerName || 'Cash Customer',
  );
  const [refNumber, setRefNumber] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentModes, setPaymentModes] = useState<ModeOfPayment[]>([]);
  const [defaultPaymentMode, setDefaultPaymentMode] = useState<string | null>(
    null,
  );
  const [paymentValues, setPaymentValues] = useState<{ [key: string]: string }>(
    {},
  );
  const [loadingPaymentModes, setLoadingPaymentModes] = useState(true);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [focusedPaymentField, setFocusedPaymentField] = useState<string | null>(
    null,
  );
  const prevNetAmountRef = useRef<number | null>(null);
  const [additionalDiscount, setAdditionalDiscount] = useState('0');
  const [deliveryCharges, setDeliveryCharges] = useState('0');

  // Inline customer search dropdown
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const customerInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  const netAmount = Number(
    (
      total +
      charges +
      (orderType === 'delivery' ? parseFloat(deliveryCharges) || 0 : 0) -
      discount -
      (parseFloat(additionalDiscount) || 0)
    ).toFixed(2),
  );

  // Load customers once
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setLoadingCustomers(true);
        // @ts-ignore
        const data = await window.customers.getAll();
        setCustomers(data);
        setFilteredCustomers(data.slice(0, 50));
      } catch (err) {
        console.error('Error loading customers:', err);
      } finally {
        setLoadingCustomers(false);
      }
    };
    loadCustomers();
  }, []);

  // Filter customers on search query change
  useEffect(() => {
    if (!searchQuery) {
      setFilteredCustomers(customers.slice(0, 50));
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.customer_name?.toLowerCase().includes(q) ||
        c.mobile_no?.toLowerCase().includes(q) ||
        c.tax_id?.toLowerCase().includes(q),
    );
    setFilteredCustomers(filtered.slice(0, 50));
    setSelectedIndex(0);
  }, [searchQuery, customers]);

  // Scroll highlighted item into view on arrow key navigation
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
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

  // Close dropdown on outside click
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

  // Fetch payment modes on mount
  useEffect(() => {
    const fetchPaymentModes = async () => {
      try {
        setLoadingPaymentModes(true);
        const { modes, defaultMode } = await getModeOfPayments();
        console.log('Modes:', modes, 'defaultmode');
        setPaymentModes(modes);
        setDefaultPaymentMode(defaultMode);

        // Pre-fill default mode (or first mode) with net amount
        if (modes.length > 0) {
          const defaultModeObj = defaultMode
            ? modes.find((m) => m.name === defaultMode)
            : null;
          const firstMode = defaultModeObj || modes[0];
          setPaymentValues({
            [firstMode.name]: netAmount.toFixed(2),
          });
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
      console.log(
        '[RestaurantCheckoutModal] Data sync completed, refetching payment modes...',
      );
      fetchPaymentModes();
    };

    window.addEventListener('data-sync-completed', handleSyncComplete);
    return () =>
      window.removeEventListener('data-sync-completed', handleSyncComplete);
  }, []);

  // Keep payment values in sync when netAmount or paymentMethod changes (don't overwrite when switching from Credit with entered values)
  useEffect(() => {
    const totalPaidCurrent = Object.values(paymentValues).reduce(
      (a, v) => a + (parseFloat(v) || 0),
      0,
    );
    if (paymentMethod === 'cash' && paymentModes.length > 0) {
      // Use user's default mode if available
      const defaultModeObj = defaultPaymentMode
        ? paymentModes.find((m) => m.name === defaultPaymentMode)
        : null;
      const cashMode =
        defaultModeObj ||
        paymentModes.find((m) => m.type === 'Cash') ||
        paymentModes[0];
      if (totalPaidCurrent === 0) {
        setPaymentValues({ [cashMode.name]: netAmount.toFixed(2) });
      } else if (
        prevNetAmountRef.current !== null &&
        Math.abs(totalPaidCurrent - prevNetAmountRef.current) < 0.02
      ) {
        // When additional discount changes, reduce the payment amount so the input shows net amount (e.g. 315 → 300 when add. discount 15)
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

  // Calculate total paid dynamically
  const totalPaid = Object.values(paymentValues).reduce(
    (acc, val) => acc + (parseFloat(val) || 0),
    0,
  );

  const balance = Number((netAmount - totalPaid).toFixed(2));

  // Handle payment auto-fill logic
  // When user focuses a field, if it's 0 or empty, we might want to suggest the remaining balance?
  // User Requirement: "when the user enters 50 on one payment , then the rest of the amount should be added to the second payment method"
  // This implies when one field changes version of "auto-balancing".

  const handlePaymentValueChange = (modeName: string, value: string) => {
    const newValues = { ...paymentValues, [modeName]: value };
    const numericValue = parseFloat(value) || 0;
    // In Credit mode, remainder is credit — do not auto-fill another payment mode
    if (paymentMethod !== 'credit' && paymentModes.length > 1) {
      const remaining = Number((netAmount - numericValue).toFixed(2));
      if (remaining > 0) {
        const otherMode = paymentModes.find((m) => m.name !== modeName);
        if (otherMode) newValues[otherMode.name] = remaining.toFixed(2);
      } else {
        const otherMode = paymentModes.find((m) => m.name !== modeName);
        if (otherMode) newValues[otherMode.name] = '0';
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

  // Ctrl+R blocking removed - users can now refresh to sync new data

  const change = Number((totalPaid - netAmount).toFixed(2));
  const creditRemainder =
    totalPaid < netAmount ? Number((netAmount - totalPaid).toFixed(2)) : 0;
  const creditModeName =
    paymentModes.find((m) => m.type === 'Credit')?.name || 'Credit';

  const paymentMethods: Array<{
    value: PaymentMethod;
    label: string;
    icon: React.ReactNode;
  }> = [
    { value: 'cash', label: 'Cash', icon: <DollarSign className="w-4 h-4" /> },
    {
      value: 'credit',
      label: 'Credit',
      icon: <CreditCard className="w-4 h-4" />,
    },
    {
      value: 'partial',
      label: 'Partial',
      icon: <Wallet className="w-4 h-4" />,
    },
  ];

  const validItems = items.filter(
    (item) => item.productCode && item.productCode.trim() !== '',
  );

  // Extracted invoice printing logic (invoice print ONLY — KOT is handled separately)
  const executeInvoicePrint = async (invoiceName: string) => {
    const tPrintBlock = performance.now();
    try {
      const invoicePrintT0 = performance.now();
      console.log('[PRINT-TIMING] checkout: invoice print start');
      const tSettings = performance.now();
      const settings = await window.printerSettings.get();
      console.log(
        `[PRINT-TIMING] checkout: printerSettings.get = ${(performance.now() - tSettings).toFixed(1)}ms`,
      );
      if (settings) {
        try {
          if (settings.clientSidePrintEnabled) {
            const tClient = performance.now();
            console.log(
              `[PRINT-TIMING] checkout: branch=clientSide, format=${settings.clientSidePrintFormat || 'standard'}`,
            );
            await clientSidePrint({
              salesInvoice: invoiceName,
              format: settings.clientSidePrintFormat || 'standard',
            });
            console.log(
              `[PRINT-TIMING] checkout: clientSidePrint() = ${(performance.now() - tClient).toFixed(1)}ms`,
            );
          } else if (settings.printMethod === 'html') {
            console.log('[PRINT-TIMING] checkout: branch=html');
            const formatToUse = settings.invoicePrintFormat || undefined;
            (window as any).logger.log('DEBUG: HTML Print Mode Detected');
            const tFetch = performance.now();
            const htmlContent = await getSalesInvoiceHTML(
              invoiceName,
              formatToUse,
            );
            console.log(
              `[PRINT-TIMING] checkout: getSalesInvoiceHTML = ${(performance.now() - tFetch).toFixed(1)}ms (len=${htmlContent?.length ?? 0})`,
            );
            (window as any).logger.log(
              `DEBUG: HTML Content Fetched, length: ${htmlContent?.length}`,
            );
            const tPrint = performance.now();
            await print({
              type: 'html',
              data: htmlContent,
            });
            console.log(
              `[PRINT-TIMING] checkout: print(html) = ${(performance.now() - tPrint).toFixed(1)}ms`,
            );
          } else {
            console.log('[PRINT-TIMING] checkout: branch=pdf');
            const formatToUse = settings.invoicePrintFormat || undefined;
            const tFetch = performance.now();
            const pdfBlob = await printSalesInvoicePDF(
              invoiceName,
              formatToUse,
            );
            console.log(
              `[PRINT-TIMING] checkout: printSalesInvoicePDF = ${(performance.now() - tFetch).toFixed(1)}ms (size=${pdfBlob?.size ?? 0}b)`,
            );
            const tPrint = performance.now();
            await print({
              type: 'invoice',
              data: pdfBlob,
              invoiceNo: invoiceName,
              printSettings: 'fit',
            });
            console.log(
              `[PRINT-TIMING] checkout: print(pdf) = ${(performance.now() - tPrint).toFixed(1)}ms`,
            );
          }
        } catch (invError) {
          console.error('Invoice printing failed:', invError);
          toast.error('Failed to print invoice');
        }
      }
      console.log(
        `[PRINT-TIMING] checkout: invoice print TOTAL = ${(performance.now() - invoicePrintT0).toFixed(1)}ms`,
      );
    } catch (printError) {
      console.error('Auto-print failed:', printError);
      toast.error('Auto-print failed, but invoice was created.');
    }
    console.log(
      `[INVOICE-TIMING] print block TOTAL = ${(performance.now() - tPrintBlock).toFixed(1)}ms`,
    );
  };

  const handleCreateOrder = async () => {
    if (validItems.length === 0) {
      toast.error('Please add items to the order');
      return;
    }

    setIsCreatingOrder(true);
    try {
      const orderItems = validItems.map((item) => ({
        item_code: item.productCode || item.barcode,
        qty: item.quantity,
        rate: isTaxIncluded ? item.inclusivePrice : item.unitPrice,
      }));

      const payload: any = {
        customer: initialCustomerCode || customerName.trim() || 'Guest',
        items: orderItems,
      };

      if (orderType === 'delivery') {
        payload.delivery_charge = 1;
        payload.delivery_charge_amount = parseFloat(deliveryCharges) || 0;
      }

      const response = await createSalesOrder(payload);

      if (response?.message?.success_key === 1) {
        const salesOrderName = response.message.sales_order;
        toast.success(
          `Sales Order created successfully!\nOrder ID: ${salesOrderName}`,
        );

        // Auto-print sales order on draft creation if enabled (server HTML/PDF already includes KOT when the format does)
        try {
          const settings = await window.printerSettings.get();
          if (settings?.autoprint) {
            try {
              if (settings.printMethod === 'html') {
                const orderHtml = await getSalesOrderHTML(salesOrderName);
                if (orderHtml) {
                  await print({
                    type: 'html',
                    data: orderHtml,
                  });
                }
              } else {
                const orderBlob = await printSalesOrderPDF(salesOrderName);
                await print({
                  type: 'default',
                  data: orderBlob,
                  title: `Order - ${salesOrderName}`,
                });
              }
            } catch (orderPrintError) {
              console.error('Auto-print Order failed:', orderPrintError);
            }

            // Kitchen copy for draft sales orders created at checkout.
            await printKotIfConfigured({
              source: { sales_order: salesOrderName },
              print,
              title: `KOT - ${salesOrderName}`,
            });
          }
        } catch (printError) {
          console.error('Auto-print settings check failed:', printError);
        }

        const data: CheckoutData = {
          totalAmount: total,
          charges,
          discount,
          additionalDiscount: parseFloat(additionalDiscount) || 0,
          payments: {},
          paymentMethod,
          customerName: customerName.trim(),
          refNumber: refNumber.trim(),
          contactNumber: contactNumber.trim(),
          orderType,
        };

        onComplete?.(data);
        onClose();
      } else if (response?.message?.error_type === 'shift_not_open') {
        toast.error(
          response.message.message ||
            'No active shift found. Please start your shift.',
        );
        window.dispatchEvent(new Event('shift-not-open'));
        onClose();
      } else {
        toast.error('Failed to create order. Please try again.');
      }
    } catch (error: any) {
      console.error('Error creating order:', error);
      const errData = error?.response?.data?.message;
      if (errData?.error_type === 'shift_not_open') {
        toast.error(
          errData.message || 'No active shift found. Please start your shift.',
        );
        window.dispatchEvent(new Event('shift-not-open'));
        onClose();
      } else {
        toast.error('Failed to create order. Please try again.');
      }
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (validItems.length === 0) {
      toast.error('Please add items to the order');
      return;
    }

    const paymentAmount = totalPaid > 0 ? totalPaid : netAmount;
    if (paymentAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    setIsCreatingInvoice(true);
    const invoiceT0 = performance.now();
    console.log('[INVOICE-TIMING] handleCreateInvoice: start');
    try {
      // Prepare Invoice Items
      const invoiceItems = validItems.map((item) => {
        const invoiceItem: any = {
          item_code: item.productCode || item.barcode,
          qty: item.quantity,
          rate: isTaxIncluded ? item.inclusivePrice : item.unitPrice,
        };

        // Add uom if available
        if (item.unit) {
          invoiceItem.uom = item.unit;
        }

        // Calculate discount amount per unit if applicable
        if (item.discountAmount && item.discountAmount > 0) {
          invoiceItem.discount_amount = item.discountAmount;
        } else if (item.discountPercent && item.discountPercent > 0) {
          // If we have a percent but no amount, the backend usually calculates,
          // but passing amount is safer if we have it calculated.
          // Let's pass percentage if that's what we have
          invoiceItem.discount_percentage = item.discountPercent;
        }

        return invoiceItem;
      });

      // Prepare Payments
      const payments: any[] = [];
      Object.keys(paymentValues).forEach((key) => {
        const value = parseFloat(paymentValues[key] || '0');
        if (value > 0) {
          payments.push({
            mode_of_payment: key,
            amount: value,
          });
        }
      });

      // Remainder (totalPaid < netAmount) is recorded as credit
      if (creditRemainder > 0.01) {
        payments.push({
          mode_of_payment: creditModeName,
          amount: creditRemainder,
        });
      }

      // If no explicit payments, use the user's configured default mode of payment
      if (payments.length === 0) {
        payments.push({
          mode_of_payment: defaultPaymentMode || 'Cash',
          amount: paymentAmount,
        });
      }

      // Prepare Payload
      const company = await (window as any).app_config?.get('company_name');
      const payload: any = {
        customer: initialCustomerCode || customerName.trim() || 'Guest',
        items: invoiceItems,
        payments: payments,
        submit: 1, // Auto-submit the invoice
        is_pos: 1,
      };
      if (company) payload.company = company;

      // Add overall discount if exists (flat amount only — do not send percentage to avoid double application on backend)
      const addDiscVal = parseFloat(additionalDiscount) || 0;
      if (discount > 0 || addDiscVal > 0) {
        payload.discount_amount = discount + addDiscVal;
      }

      // When delivery mode: always send delivery_charge_amount (including 0) so backend doesn't apply a default
      if (orderType === 'delivery') {
        payload.delivery_charge = 1;
        const dcAmount = parseFloat(deliveryCharges) || 0;
        payload.delivery_charge_amount = dcAmount;
      }

      // Log invoice payload so we can verify delivery charge, discount, etc.
      console.log(
        '[RestaurantCheckout] POS Invoice payload:',
        JSON.stringify(payload, null, 2),
      );
      console.log(
        '[RestaurantCheckout] orderType:',
        orderType,
        '| delivery_charge:',
        payload.delivery_charge,
        '| delivery_charge_amount:',
        payload.delivery_charge_amount,
        '| discount_amount:',
        payload.discount_amount,
      );
      console.log(
        `[INVOICE-TIMING] payload prepared = ${(performance.now() - invoiceT0).toFixed(1)}ms`,
      );
      const tApi = performance.now();
      const response = await createPOSInvoice(payload);
      console.log(
        `[INVOICE-TIMING] createPOSInvoice API = ${(performance.now() - tApi).toFixed(1)}ms`,
      );

      if (
        response?.message?.success_key === 1 ||
        response?.message?.message === 'Sales invoice created successfully'
      ) {
        // Extract invoice name. The structure might be response.message.invoice.name or response.message.name
        const invoiceName =
          response.message.invoice?.name || response.message.name;

        if (!invoiceName) {
          toast.error('Invoice created but ID not found for printing.');
          return;
        }

        toast.success(`Invoice created successfully!\nID: ${invoiceName}`);

        // Construct payments map for CheckoutData
        const paymentsMap: { [key: string]: number } = {};
        payments.forEach((p) => {
          paymentsMap[p.mode_of_payment] = p.amount;
        });

        const checkoutData: CheckoutData = {
          totalAmount: total,
          charges,
          discount,
          additionalDiscount: parseFloat(additionalDiscount) || 0,
          payments: paymentsMap,
          paymentMethod,
          customerName: customerName.trim(),
          refNumber: refNumber.trim(),
          contactNumber: contactNumber.trim(),
          orderType,
        };

        // KOT always prints immediately (kitchen needs it right away),
        // regardless of askBeforeInvoicePrint or submittingInBackground.
        await printKotIfConfigured({
          source: { sales_invoice: invoiceName },
          print,
          title: `KOT - ${invoiceName}`,
        });

        // Check if we should ask before printing the invoice
        const printSettings = await window.printerSettings.get();
        const shouldAskBeforePrint =
          printSettings?.askBeforeInvoicePrint === true;

        if (shouldAskBeforePrint) {
          // Native blocking confirm runs before React can unmount this modal.
          const shouldPrint = window.confirm(
            `Invoice ${invoiceName} created successfully.\n\nPrint it now?`,
          );
          if (shouldPrint) {
            await executeInvoicePrint(invoiceName);
          }
          onComplete?.(checkoutData);
          onClose();
        } else {
          // Auto-print invoice (KOT already printed above)
          await executeInvoicePrint(invoiceName);
          onComplete?.(checkoutData);
          onClose();
        }
      } else if (response?.message?.error_type === 'shift_not_open') {
        toast.error(
          response.message.message ||
            'No active shift found. Please start your shift.',
        );
        window.dispatchEvent(new Event('shift-not-open'));
        onClose();
      } else {
        console.error('Invoice creation failed:', response);
        toast.error(
          'Failed to create invoice. ' + (response?.message?.message || ''),
        );
      }
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      const errData = error?.response?.data?.message;
      if (errData?.error_type === 'shift_not_open') {
        toast.error(
          errData.message || 'No active shift found. Please start your shift.',
        );
        window.dispatchEvent(new Event('shift-not-open'));
        onClose();
      } else {
        toast.error('Failed to create invoice. Please try again.');
      }
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const isCashPayment = paymentMethod === 'cash';

  // Find which payment field has a value (for cash payment restriction)
  const activePaymentField = isCashPayment
    ? Object.keys(paymentValues).find(
        (key) => parseFloat(paymentValues[key] || '0') > 0,
      )
    : null;

  // Credit: all fields enabled; user enters amount in any mode(s), rest is credit
  const isFieldDisabled = (_fieldName: string): boolean => false;

  // Handle payment field click - auto-fill with net amount
  const handlePaymentFieldClick = (modeName: string) => {
    if (paymentMethod === 'partial') return;
    if (paymentMethod === 'credit') {
      setFocusedPaymentField(modeName);
      return;
    }
    // "Switch" mode logic:
    // If user clicks a field in Cash mode, that field becomes the active one.
    // We clear all others and set this one to the netAmount.

    const newValues: { [key: string]: string } = {};
    paymentModes.forEach((mode) => {
      newValues[mode.name] = mode.name === modeName ? netAmount.toFixed(2) : '';
    });
    setPaymentValues(newValues);
    setFocusedPaymentField(modeName);
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
        {/* Modal Container: Fixed Size, Centered, No floating rounding */}
        <div className="bg-white w-full max-w-7xl h-[85vh] rounded-md flex flex-col overflow-hidden">
          {/* Header Zone (Fixed Height) */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-600">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              <div className="leading-tight">
                <h2 className="text-xl font-bold tracking-wide">Checkout</h2>
                <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">
                  Bill #{getNextBillNumber()}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-8 h-8 text-slate-400 hover:text-white" />
            </button>
          </div>

          {/* Main Workspace (Grid Layout) */}
          <div className="flex-1 flex flex-row overflow-hidden">
            {/* ZONE 1: Context & Order Info (30%) */}
            <div className="w-[30%] bg-slate-50 flex flex-col border-r border-slate-200">
              {/* Order Type Selector */}
              <div className="p-4 bg-white border-b border-slate-100">
                <div className="flex bg-slate-100 p-1 rounded-sm">
                  {['dining', 'parcel', 'delivery'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type as any)}
                      className={`flex-1 py-3 px-2 rounded-sm text-sm font-bold uppercase tracking-wide transition-all ${
                        orderType === type
                          ? 'bg-white text-blue-700'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Search & Info */}
              <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Customer
                  </label>
                  <div className="relative flex-1">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      ref={customerInputRef}
                      type="text"
                      value={
                        customerName ||
                        (selectedCustomer
                          ? `(${selectedCustomer.name}) ${selectedCustomer.customer_name}`
                          : '')
                      }
                      onClick={handleCustomerInputClick}
                      readOnly
                      className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-md focus:border-blue-500 focus:ring-0 font-bold text-slate-700 transition-all text-lg placeholder:font-normal cursor-pointer hover:bg-slate-50"
                      placeholder="Select Customer..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Contact
                    </label>
                    <input
                      type="text"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-md focus:border-blue-500 focus:ring-0 font-semibold text-slate-700"
                      placeholder="Phone Number"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Reference
                    </label>
                    <input
                      type="text"
                      value={refNumber}
                      onChange={(e) => setRefNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-md focus:border-blue-500 focus:ring-0 font-semibold text-slate-700"
                      placeholder="Table / Order Ref"
                    />
                  </div>
                </div>

                <div className="h-px bg-slate-200 my-2"></div>

                <div
                  className={`${orderType === 'delivery' ? 'grid grid-cols-2' : 'grid-cols-1'} grid gap-3`}
                >
                  {orderType === 'delivery' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Delivery Chg.
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={deliveryCharges}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setDeliveryCharges('');
                            return;
                          }
                          const stripped = raw.replace(/[^\d.]/g, '');
                          const parts = stripped.split('.');
                          const allowed =
                            parts.length > 2
                              ? `${parts[0]}.${parts.slice(1).join('')}`
                              : stripped;
                          setDeliveryCharges(allowed);
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Add. Discount
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={additionalDiscount}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setAdditionalDiscount('');
                          return;
                        }
                        const stripped = raw.replace(/[^\d.]/g, '');
                        const parts = stripped.split('.');
                        const allowed =
                          parts.length > 2
                            ? `${parts[0]}.${parts.slice(1).join('')}`
                            : stripped;
                        setAdditionalDiscount(allowed);
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Net Payable Anchor */}
              <div className="mt-auto p-6 bg-white border-t border-slate-200">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Total Payable
                </div>
                <div className="text-5xl font-black text-slate-900 tracking-tight tabular-nums">
                  {formatCurrency(netAmount)}
                </div>
              </div>
            </div>

            {/* ZONE 2: Payment Deck (35%) */}
            <div className="w-[35%] bg-white flex flex-col border-r border-slate-200 relative z-10">
              {/* Payment Methods */}
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex gap-3 h-24">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.value}
                      onClick={() => handlePaymentMethodChange(method.value)}
                      className={`flex-1 rounded-md border-2 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
                        paymentMethod === method.value
                          ? 'bg-white border-blue-600 text-blue-700'
                          : 'bg-slate-100 border-transparent text-slate-400 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      {React.cloneElement(
                        method.icon as React.ReactElement<any>,
                        { className: 'w-6 h-6' },
                      )}
                      <span className="text-xs font-black uppercase tracking-wide">
                        {method.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Ledger / Inputs */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Payment Breakdown
                  </label>
                  {change < 0 && creditRemainder <= 0 ? (
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                      DUE: {formatCurrency(Math.abs(change))}
                    </span>
                  ) : change >= 0 ? (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                      CHANGE: {formatCurrency(change)}
                    </span>
                  ) : null}
                </div>
                {paymentMethod === 'credit' && (
                  <p className="text-xs text-slate-500 -mt-2">
                    Enter amount in Cash/Bank etc.; the rest will be recorded as
                    credit.
                  </p>
                )}

                {loadingPaymentModes ? (
                  <div className="p-8 text-center text-slate-400 animate-pulse">
                    Loading...
                  </div>
                ) : (
                  paymentModes.map((mode) => (
                    <div
                      key={mode.name}
                      className={`
                            relative transition-all duration-200 border rounded-md overflow-hidden
                            ${
                              focusedPaymentField === mode.name
                                ? 'border-blue-500 bg-blue-50/10'
                                : 'border-slate-100 hover:border-slate-300 bg-slate-50'
                            }
                            ${isFieldDisabled(mode.name) ? 'opacity-40 grayscale pointer-events-none' : ''}
                          `}
                      onClick={() => {
                        handlePaymentFieldClick(mode.name);
                        const input = document.getElementById(
                          `payment-input-${mode.name}`,
                        ) as HTMLInputElement;
                        if (input) input.focus();
                      }}
                    >
                      <div className="absolute top-2 left-3 text-xs font-bold text-slate-400 uppercase tracking-wider pointer-events-none">
                        {mode.name}
                      </div>
                      <NumberInput
                        id={`payment-input-${mode.name}`}
                        label=""
                        value={paymentValues[mode.name] || ''}
                        onChange={(value) =>
                          handlePaymentValueChange(mode.name, value)
                        }
                        onFocus={() => setFocusedPaymentField(mode.name)}
                        fullWidth
                        disabled={isFieldDisabled(mode.name)}
                        className={`!text-3xl font-black !p-4 !pt-6 !bg-transparent !border-none !shadow-none text-right h-20 ${focusedPaymentField === mode.name ? 'text-blue-700' : 'text-slate-700'}`}
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Invoice Summary Card */}
              <div className="p-6 bg-slate-50 border-t border-slate-200">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-slate-500 font-medium">
                    <span>Subtotal</span>
                    <span className="text-slate-700">
                      {formatCurrency(total)}
                    </span>
                  </div>
                  {charges > 0 && (
                    <div className="flex justify-between text-sm text-slate-500 font-medium">
                      <span>Charges</span>
                      <span className="text-orange-600">
                        +{formatCurrency(charges)}
                      </span>
                    </div>
                  )}
                  {(discount > 0 || parseFloat(additionalDiscount) > 0) && (
                    <div className="flex justify-between text-sm text-slate-500 font-medium">
                      <span>Discount</span>
                      <span className="text-green-600">
                        -
                        {formatCurrency(
                          discount + (parseFloat(additionalDiscount) || 0),
                        )}
                      </span>
                    </div>
                  )}
                  {orderType === 'delivery' &&
                    parseFloat(deliveryCharges) > 0 && (
                      <div className="flex justify-between text-sm text-slate-500 font-medium">
                        <span>Delivery Chg.</span>
                        <span className="text-orange-600">
                          +{formatCurrency(parseFloat(deliveryCharges))}
                        </span>
                      </div>
                    )}
                  <div className="h-px bg-slate-200 my-2"></div>
                  {paymentMethod === 'credit' && creditRemainder > 0 && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 mb-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-amber-800 uppercase">
                          Credit (remaining)
                        </span>
                        <span className="text-xl font-black text-amber-700 tabular-nums">
                          {formatCurrency(creditRemainder)}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline">
                    <span className="text-base font-bold text-slate-900 uppercase">
                      Total Due
                    </span>
                    <span className="text-3xl font-black text-blue-600">
                      {formatCurrency(netAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ZONE 3: Command Pad (35%) */}
            <div className="w-[35%] bg-slate-100 flex flex-col p-4 gap-4">
              {/* Quick Amounts */}
              <div className="grid grid-cols-4 gap-2 h-24 shrink-0">
                {[10, 20, 50, 100, 200, 500, 1000, 2000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      if (focusedPaymentField) {
                        if (paymentMethod === 'partial') {
                          setPaymentValues((prev) => ({
                            ...prev,
                            [focusedPaymentField]: amount.toString(),
                          }));
                        } else {
                          const newValues: { [key: string]: string } = {};
                          paymentModes.forEach((mode) => {
                            newValues[mode.name] =
                              mode.name === focusedPaymentField
                                ? amount.toString()
                                : '';
                          });
                          setPaymentValues(newValues);
                        }
                        setTimeout(() => {
                          if (focusedPaymentField) {
                            const input = document.getElementById(
                              `payment-input-${focusedPaymentField}`,
                            ) as HTMLInputElement;
                            if (input) input.focus();
                          }
                        }, 0);
                      }
                    }}
                    className="bg-white hover:bg-blue-50 hover:border-blue-200 border border-slate-200 rounded-md text-slate-600 hover:text-blue-700 font-bold text-lg active:scale-95 transition-all"
                  >
                    {amount}
                  </button>
                ))}
              </div>

              {/* Numeric Keypad - Expanded */}
              <div className="flex-1 bg-white rounded-md border border-slate-200 p-2 overflow-hidden flex flex-col">
                {showNumericKeypad && (
                  <div className="flex-1 w-full h-full [&>div]:h-full [&>div]:shadow-none [&>div]:border-none [&_button]:!h-full [&_button]:!text-2xl [&_button]:!rounded-md">
                    <NumericKeypad className="w-full h-full !p-0" />
                  </div>
                )}
              </div>

              {/* Primary Actions */}
              <div className="grid grid-cols-2 gap-3 h-24 shrink-0">
                <button
                  onClick={handleCreateOrder}
                  disabled={isCreatingOrder || validItems.length === 0}
                  className={`rounded-md font-black text-lg uppercase tracking-wide transition-transform active:scale-95 flex flex-col items-center justify-center ${
                    isCreatingOrder || validItems.length === 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-white border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  <span>Create Order</span>
                </button>

                <button
                  onClick={handleCreateInvoice}
                  disabled={
                    isCreatingInvoice ||
                    validItems.length === 0 ||
                    (change < -0.01 && paymentMethod === 'cash')
                  }
                  className={`rounded-md font-black text-xl uppercase tracking-wide transition-transform active:scale-95 flex flex-col items-center justify-center ${
                    isCreatingInvoice ||
                    validItems.length === 0 ||
                    (change < -0.01 && paymentMethod === 'cash')
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  title={
                    paymentMethod === 'credit' && creditRemainder > 0
                      ? `Pay ${formatCurrency(totalPaid)} now; ${formatCurrency(creditRemainder)} as credit`
                      : undefined
                  }
                >
                  <span>Pay & Print</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Customer Search Dropdown */}
      {showDropdown &&
        dropdownPosition &&
        ReactDOM.createPortal(
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
                    setSelectedIndex((i) =>
                      Math.min(i + 1, filteredCustomers.length - 1),
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const customer =
                      filteredCustomers[selectedIndex] ?? filteredCustomers[0];
                    if (customer) handleCustomerSelect(customer);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowDropdown(false);
                  }
                }}
                placeholder="Search customers..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto max-h-80">
              {loadingCustomers ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  Loading...
                </div>
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
                      <div className="font-bold text-slate-900">
                        {customer.customer_name || customer.name}
                      </div>
                      <div className="text-xs text-slate-500 flex gap-2">
                        <span>{customer.name}</span>
                        {customer.mobile_no && (
                          <span>• {customer.mobile_no}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-gray-500 text-sm">
                  No customers found
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>,
    document.body,
  );
};

export default RestaurantCheckoutModal;
