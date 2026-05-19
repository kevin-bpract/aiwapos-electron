import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Receipt, Printer } from 'lucide-react';
import { toast } from 'sonner';
import {
  createRestaurantOrder,
  updateSalesOrder,
  printSalesOrderPDF,
  getSalesOrderHTML,
  type SalesOrder,
} from '../../../main/api/salesOrders';
import type { SaleItem } from '../../../types/saleItem';
import { formatCurrency } from '../../../utils/format';
import { usePrinter } from '../../../hooks/usePrinter';
import { printKotIfConfigured } from '../../../utils/printKot';

interface RestaurantOrderModalProps {
  onClose: () => void;
  onComplete?: (orderName: string) => void;
  items: SaleItem[];
  existingOrder?: SalesOrder | null;
  customerName?: string;
  customerCode?: string;
  isTaxIncluded?: boolean;
}

const RestaurantOrderModal: React.FC<RestaurantOrderModalProps> = ({
  onClose,
  onComplete,
  items,
  existingOrder = null,
  customerName: initialCustomerName = '',
  customerCode: initialCustomerCode = '',
  isTaxIncluded = false,
}) => {
  const [orderType, setOrderType] = useState<'Dining' | 'Parcel' | 'Delivery'>(
    existingOrder ? 'Dining' : 'Dining',
  );
  const [tableNo, setTableNo] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>(
    existingOrder?.customer_name || initialCustomerName || 'Cash Customer',
  );
  const [isCreating, setIsCreating] = useState(false);
  const [orderPrintFormat, setOrderPrintFormat] = useState<string>('');
  const { print, isPrinting } = usePrinter();

  useEffect(() => {
    const loadPrinterSettings = async () => {
      try {
        const settings = await window.printerSettings.get();
        if (settings?.orderPrintFormat !== undefined) {
          setOrderPrintFormat(settings.orderPrintFormat || '');
        }
      } catch (error) {
        console.error('Error loading printer settings:', error);
      }
    };
    loadPrinterSettings();
  }, []);

  // Initialize form fields from existing order
  useEffect(() => {
    if (existingOrder) {
      setOrderType(existingOrder.restaurant_order_type || 'Dining');
      setCustomerName(existingOrder.customer_name || '');
      setTableNo(existingOrder.table_no || '');
      setOrderNotes(existingOrder.order_notes || '');
    }
  }, [existingOrder]);

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

  // In update mode use existing order's items; otherwise use cart items
  const itemsForOrder: SaleItem[] = existingOrder?.items?.length
    ? existingOrder.items.map((row, idx) => ({
        id: row.name || `${existingOrder.name}-${row.item_code}-${idx}`,
        productCode: row.item_code,
        quantity: row.qty,
        barcode: row.item_code,
        description: row.description || row.item_name || row.item_code,
        unit: row.uom || '',
        inclusiveTax: isTaxIncluded,
        inclusivePrice: row.rate,
        unitPrice: row.rate,
        taxRate: 0,
        discountPercent: 0,
        discountAmount: 0,
        availableUoms: [],
        prices: [],
      }))
    : items;

  const validItems = itemsForOrder.filter(
    (item) => item.productCode && item.productCode.trim() !== '',
  );

  const handleCreateOrder = async () => {
    if (validItems.length === 0) {
      toast.error('Please add items to the order');
      return;
    }

    setIsCreating(true);
    try {
      const orderItems = validItems.map((item) => ({
        item_code: item.productCode || item.barcode,
        qty: item.quantity,
        rate: isTaxIncluded ? item.inclusivePrice : item.unitPrice,
      }));

      if (existingOrder) {
        // Update existing order: remove existing lines first so backend replaces (not appends) items
        const removeItemNames = (existingOrder.items ?? [])
          .map((i) => i.name)
          .filter((n): n is string => Boolean(n));
        const updatePayload = {
          sales_order: existingOrder.name,
          items: orderItems,
          remove_items: removeItemNames,
          restaurant_order_type: orderType,
          table_no: tableNo || undefined,
          order_notes: orderNotes || undefined,
        };
        console.log('[RestaurantOrderModal] update_sales_order payload', {
          sales_order: updatePayload.sales_order,
          items_count: orderItems.length,
          remove_items_count: removeItemNames.length,
          orderItems_total: orderItems.reduce((s, i) => s + i.qty * i.rate, 0),
        });
        const response = await updateSalesOrder(updatePayload);

        if (response?.message?.success_key === 1) {
          const orderName = existingOrder.name;
          toast.success(
            `Order updated successfully!\nOrder ID: ${orderName}`,
          );

          // --- Auto-Print Logic Start ---
          try {
            const settings = await window.printerSettings.get();
            if (settings?.autoprint) {
              // Order print
              try {
                const formatToUse = orderPrintFormat || undefined;
                if (settings.printMethod === 'html') {
                  const orderHtml = await getSalesOrderHTML(orderName, formatToUse);
                  if (orderHtml) {
                    await print({ type: 'html', data: orderHtml });
                  }
                } else {
                  const blob = await printSalesOrderPDF(orderName, formatToUse);
                  await print({
                    type: 'default',
                    data: blob,
                    title: `Order - ${orderName}`,
                    printSettings: 'noscale',
                  });
                }
              } catch (orderError) {
                console.error('Auto-print Order (update) failed:', orderError);
              }

              // KOT print (kitchen copy)
              await printKotIfConfigured({
                source: { sales_order: orderName },
                print,
                title: `KOT - ${orderName}`,
              });
            }
          } catch (printError) {
            console.error('Auto-print settings check failed:', printError);
          }
          // --- Auto-Print Logic End ---

          onComplete?.(orderName);
          onClose();
        } else if (response?.message?.error_type === 'shift_not_open') {
          toast.error(response.message.message || 'No active shift found. Please start your shift.');
          window.dispatchEvent(new Event('shift-not-open'));
          onClose();
        } else {
          toast.error('Failed to update order. Please try again.');
        }
      } else {
        // Create new order
        const createTotal = orderItems.reduce((s, i) => s + i.qty * i.rate, 0);
        console.log('[RestaurantOrderModal] create_restaurant_order payload', {
          items_count: orderItems.length,
          total: createTotal,
        });
        const response = await createRestaurantOrder({
          items: orderItems,
          restaurant_order_type: orderType,
          table_no: tableNo || undefined,
          order_notes: orderNotes || undefined,
          customer: initialCustomerCode || customerName.trim() || undefined,
        });

        if (response?.message?.success_key === 1) {
          const orderName = response.message.sales_order;
          toast.success(`Order created successfully!\nOrder ID: ${orderName}`);

          // --- Auto-Print Logic Start ---
          const printT0 = performance.now();
          console.log('[PRINT-TIMING] auto-print: start');
          try {
            const tSettings = performance.now();
            const settings = await window.printerSettings.get();
            console.log(
              `[PRINT-TIMING] auto-print: printerSettings.get = ${(performance.now() - tSettings).toFixed(1)}ms`,
            );
            if (settings?.autoprint) {
              /* KOT print disabled — kitchen copy is included in the Sales Order print format.
              // 1. KOT Print
              try {
                const kotItems = await Promise.all(validItems.map(async (item) => {
                  let tags: string[] = [];
                  try {
                    if ((window as any).products?.get) {
                      const product = await (window as any).products.get(item.productCode);
                      if (product?.custom_item_tag_list) {
                        if (Array.isArray(product.custom_item_tag_list)) {
                          tags = product.custom_item_tag_list;
                        } else if (typeof product.custom_item_tag_list === 'string') {
                          try {
                            const parsed = JSON.parse(product.custom_item_tag_list);
                            tags = Array.isArray(parsed) ? parsed : [];
                          } catch {
                            tags = [];
                          }
                        }
                      }
                    }
                  } catch (err) {
                    console.error('Error fetching tags for KOT:', err);
                  }

                  return {
                    item_name: item.description || item.productCode || 'Item',
                    item_code: item.productCode,
                    qty: item.quantity,
                    tags: tags
                  };
                }));

                const kotData: KOTData = {
                  billNumber: getNextBillNumber(),
                  orderNumber: orderName,
                  orderType: orderType,
                  items: kotItems,
                  timestamp: new Date(),
                  tableNo: tableNo,
                  orderNotes: orderNotes
                };

                const kotHtml = generateKOTHTML(kotData);
                const kotPdfData = await (window as any).pdf.generateFromHTML(kotHtml);

                const binaryString = atob(kotPdfData.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const kotBlob = new Blob([bytes], { type: 'application/pdf' });

                await print({
                  type: 'kot',
                  data: kotBlob,
                  title: `KOT - ${orderName}`
                });

              } catch (kotError) {
                console.error('Auto-print KOT failed:', kotError);
              }
              */

              // Order print only
              try {
                const formatToUse = orderPrintFormat || undefined;
                if (settings.printMethod === 'html') {
                  const tFetch = performance.now();
                  const orderHtml = await getSalesOrderHTML(
                    orderName,
                    formatToUse,
                  );
                  console.log(
                    `[PRINT-TIMING] auto-print: getSalesOrderHTML = ${(performance.now() - tFetch).toFixed(1)}ms (len=${orderHtml?.length ?? 0})`,
                  );
                  if (orderHtml) {
                    const tPrint = performance.now();
                    await print({ type: 'html', data: orderHtml });
                    console.log(
                      `[PRINT-TIMING] auto-print: print(html) = ${(performance.now() - tPrint).toFixed(1)}ms`,
                    );
                  }
                } else {
                  const tFetch = performance.now();
                  const blob = await printSalesOrderPDF(orderName, formatToUse);
                  console.log(
                    `[PRINT-TIMING] auto-print: printSalesOrderPDF = ${(performance.now() - tFetch).toFixed(1)}ms (size=${blob?.size ?? 0}b)`,
                  );
                  const tPrint = performance.now();
                  await print({
                    type: 'default',
                    data: blob,
                    title: `Order - ${orderName}`,
                    printSettings: 'noscale',
                  });
                  console.log(
                    `[PRINT-TIMING] auto-print: print(pdf) = ${(performance.now() - tPrint).toFixed(1)}ms`,
                  );
                }
              } catch (orderError) {
                console.error('Auto-print Order failed:', orderError);
              }

              // KOT print (kitchen copy) — fires in parallel with order print.
              // Uses kotPrinter when useSeparatePrinters is enabled.
              await printKotIfConfigured({
                source: { sales_order: orderName },
                print,
                title: `KOT - ${orderName}`,
              });
            }
          } catch (printError) {
            console.error('Auto-print settings check failed:', printError);
          }
          console.log(
            `[PRINT-TIMING] auto-print: TOTAL = ${(performance.now() - printT0).toFixed(1)}ms`,
          );
          // --- Auto-Print Logic End ---

          onComplete?.(orderName);
          onClose();
        } else if (response?.message?.error_type === 'shift_not_open') {
          toast.error(response.message.message || 'No active shift found. Please start your shift.');
          window.dispatchEvent(new Event('shift-not-open'));
          onClose();
        } else {
          toast.error('Failed to create order. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('Error creating/updating order:', error);
      const errData = error?.response?.data?.message;
      if (errData?.error_type === 'shift_not_open') {
        toast.error(errData.message || 'No active shift found. Please start your shift.');
        window.dispatchEvent(new Event('shift-not-open'));
        onClose();
      } else {
        toast.error('Failed to create/update order. Please try again.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handlePrint = async () => {
    if (!existingOrder) return;

    /* KOT print disabled — kitchen copy is included in the Sales Order print format.
    try {
      const kotData = await (async () => {
        const kotItems = await Promise.all(validItems.map(async (item) => {
          let tags: string[] = [];
          try {
            if ((window as any).products?.get) {
              const product = await (window as any).products.get(item.productCode);
              if (product?.custom_item_tag_list) {
                if (Array.isArray(product.custom_item_tag_list)) tags = product.custom_item_tag_list;
                else if (typeof product.custom_item_tag_list === 'string') {
                  try { tags = JSON.parse(product.custom_item_tag_list); } catch { }
                }
              }
            }
          } catch { }
          return {
            item_name: item.description || item.productCode || 'Item',
            item_code: item.productCode,
            qty: item.quantity,
            tags
          };
        }));

        return {
          billNumber: getNextBillNumber(),
          orderNumber: existingOrder.name,
          orderType: orderType,
          items: kotItems,
          timestamp: new Date(),
          tableNo: tableNo,
          orderNotes: orderNotes
        } as KOTData;
      })();

      const kotHtml = generateKOTHTML(kotData);
      const kotPdfData = await (window as any).pdf.generateFromHTML(kotHtml);
      const binaryString = atob(kotPdfData.data);
      const bytes = new Uint8Array(binaryString.length);
      const kotBlob = new Blob([bytes], { type: 'application/pdf' });

      await print({
        type: 'kot',
        data: kotBlob,
        title: `KOT - ${existingOrder.name}`
      });
    } catch (e) {
      console.error('Manual Print KOT failed', e);
    }
    */

    // Order print only
    const manualT0 = performance.now();
    console.log('[PRINT-TIMING] manual-print: start');
    try {
      const tSettings = performance.now();
      const settings = await window.printerSettings.get();
      console.log(
        `[PRINT-TIMING] manual-print: printerSettings.get = ${(performance.now() - tSettings).toFixed(1)}ms`,
      );
      const formatToUse = orderPrintFormat || undefined;
      if (settings?.printMethod === 'html') {
        const tFetch = performance.now();
        const orderHtml = await getSalesOrderHTML(
          existingOrder.name,
          formatToUse,
        );
        console.log(
          `[PRINT-TIMING] manual-print: getSalesOrderHTML = ${(performance.now() - tFetch).toFixed(1)}ms (len=${orderHtml?.length ?? 0})`,
        );
        if (orderHtml) {
          const tPrint = performance.now();
          await print({ type: 'html', data: orderHtml });
          console.log(
            `[PRINT-TIMING] manual-print: print(html) = ${(performance.now() - tPrint).toFixed(1)}ms`,
          );
        }
      } else {
        const tFetch = performance.now();
        const blob = await printSalesOrderPDF(existingOrder.name, formatToUse);
        console.log(
          `[PRINT-TIMING] manual-print: printSalesOrderPDF = ${(performance.now() - tFetch).toFixed(1)}ms (size=${blob?.size ?? 0}b)`,
        );
        const tPrint = performance.now();
        await print({
          type: 'default',
          data: blob,
          title: `Order - ${existingOrder.name}`,
          printSettings: 'noscale',
        });
        console.log(
          `[PRINT-TIMING] manual-print: print(pdf) = ${(performance.now() - tPrint).toFixed(1)}ms`,
        );
      }
    } catch (error) {
      console.error('Failed to print order:', error);
    }

    // Manual reprint also fires KOT to the kitchen.
    await printKotIfConfigured({
      source: { sales_order: existingOrder.name },
      print,
      title: `KOT - ${existingOrder.name}`,
    });

    console.log(
      `[PRINT-TIMING] manual-print: TOTAL = ${(performance.now() - manualT0).toFixed(1)}ms`,
    );
  };

  const totalAmount = validItems.reduce(
    (sum, item) => sum + item.inclusivePrice * item.quantity,
    0,
  );

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-white" />
            <h2 className="text-xl font-semibold text-white">
              {existingOrder ? 'Update Order' : 'Create Order'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {existingOrder && (
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                className="bg-white/20 hover:bg-white/30 text-white p-1.5 rounded-md transition"
                title="Print Order"
              >
                {isPrinting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Printer className="w-5 h-5" />
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white hover:bg-blue-700 rounded-md p-1.5 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          <div className="space-y-4">
            {/* Order Type */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                Order Type
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setOrderType('Dining')}
                  className={`py-2 px-2 rounded-lg font-medium transition-all duration-200 flex flex-col items-center ${
                    orderType === 'Dining'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <svg
                    className="w-4 h-4 mb-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  <span className="text-xs">Dining</span>
                </button>
                <button
                  onClick={() => setOrderType('Parcel')}
                  className={`py-2 px-2 rounded-lg font-medium transition-all duration-200 flex flex-col items-center ${
                    orderType === 'Parcel'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <svg
                    className="w-4 h-4 mb-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  <span className="text-xs">Parcel</span>
                </button>
                <button
                  onClick={() => setOrderType('Delivery')}
                  className={`py-2 px-2 rounded-lg font-medium transition-all duration-200 flex flex-col items-center ${
                    orderType === 'Delivery'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <svg
                    className="w-4 h-4 mb-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                    />
                  </svg>
                  <span className="text-xs">Delivery</span>
                </button>
              </div>
            </div>

            {/* Customer Name (only for new orders) */}
            {!existingOrder && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Customer Name (Optional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border rounded-md shadow-sm transition bg-white text-slate-900 border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter customer name"
                />
              </div>
            )}

            {/* Table Number */}
            {orderType === 'Dining' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Table Number
                </label>
                <input
                  type="text"
                  value={tableNo}
                  onChange={(e) => setTableNo(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border rounded-md shadow-sm transition bg-white text-slate-900 border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., T1, T2"
                />
              </div>
            )}

            {/* Order Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Order Notes
              </label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded-md shadow-sm transition bg-white text-slate-900 border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="e.g., No onions, extra spicy"
                rows={3}
              />
            </div>

            {/* Items Summary */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                Items
              </label>
              <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                {validItems.length > 0 ? (
                  <div className="space-y-2">
                    {validItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center text-sm"
                      >
                        <span className="text-gray-700">
                          {item.description || item.productCode} x{' '}
                          {item.quantity}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(item.inclusivePrice * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No items in cart
                  </p>
                )}
              </div>
            </div>

            {/* Total */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">
                  Total Amount
                </span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 bg-white text-slate-700 border-2 border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 active:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateOrder}
            disabled={isCreating || validItems.length === 0}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold shadow-sm transition ${
              isCreating || validItems.length === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 border border-blue-600'
            }`}
          >
            {isCreating
              ? 'Creating...'
              : existingOrder
                ? 'Update Order'
                : 'Create Order'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default RestaurantOrderModal;
