import React, { useState, useEffect } from 'react';
import { X, Receipt, Printer, FileText, Utensils, Trash2 } from 'lucide-react';
import {
  getSalesOrders,
  convertSalesOrdersToInvoice,
  printSalesOrderPDF,
  getSalesOrderHTML,
  printSalesInvoicePDF,
  getSalesInvoiceHTML,
  deleteDraftSalesOrder,
  type SalesOrder,
} from '../../../main/api/salesOrders';
import { formatCurrency } from '../../../utils/format';
import { format } from 'date-fns';
import PDFViewerModal from '../pdfviewermodal';
import {
  generateKOTHTML,
  salesOrderToKOTData,
} from '../../../utils/kotGenerator';
import { toast } from 'sonner';
import { usePrinter } from '../../../hooks/usePrinter';
import { clientSidePrint } from '../../../utils/clientSidePrint';
import { getModeOfPayments } from '../../../main/api/invoice';

interface RestaurantOrderHistoryModalProps {
  onClose: () => void;
  onSelectOrder?: (order: SalesOrder) => void;
}

const RestaurantOrderHistoryModal: React.FC<
  RestaurantOrderHistoryModalProps
> = ({ onClose, onSelectOrder }) => {
  const { print } = usePrinter();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [convertingOrders, setConvertingOrders] = useState<Set<string>>(
    new Set(),
  );
  const [isPrinting, setIsPrinting] = useState<string | null>(null);
  const [isPrintingKOT, setIsPrintingKOT] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfOrderName, setPdfOrderName] = useState<string | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [invoicePrintFormat, setInvoicePrintFormat] = useState<string>('');
  const [orderPrintFormat, setOrderPrintFormat] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return format(date, 'yyyy-MM-dd');
  });
  const [toDate, setToDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd'),
  );
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();

    // Load printer settings (printer + invoice print format for PDF after convert-to-invoice)
    const loadPrinterSettings = async () => {
      try {
        const settings = await window.printerSettings.get();
        if (settings?.printer) {
          setSelectedPrinter(settings.printer);
        }
        if (settings?.invoicePrintFormat !== undefined) {
          setInvoicePrintFormat(settings.invoicePrintFormat || '');
        }
        if (settings?.orderPrintFormat !== undefined) {
          console.log('Loaded orderPrintFormat:', settings.orderPrintFormat);
          setOrderPrintFormat(settings.orderPrintFormat || '');
        }
      } catch (error) {
        console.error('Error loading printer settings:', error);
      }
    };

    loadPrinterSettings();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fromDate, toDate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pdfBlob) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, pdfBlob]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await getSalesOrders({
        docstatus: 0,
        limit_start: 0,
        limit_page_length: 50,
        from_date: fromDate,
        to_date: toDate,
      });
      setOrders(data);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      const errorMessage =
        error?.response?.data?.message?.message ||
        error?.message ||
        'Failed to load orders';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOrder = (orderName: string) => {
    setSelectedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderName)) {
        newSet.delete(orderName);
      } else {
        newSet.add(orderName);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map((o) => o.name)));
    }
  };

  const handleConvertToInvoice = async (orderName?: string) => {
    const ordersToConvert = orderName
      ? [orderName]
      : Array.from(selectedOrders);

    if (ordersToConvert.length === 0) {
      alert('Please select at least one order');
      return;
    }

    // Add all orders being converted to the set
    setConvertingOrders(new Set(ordersToConvert));

    // Calculate total from selected orders
    const selectedOrdersData = orders.filter((order) =>
      ordersToConvert.includes(order.name),
    );
    const totalAmount = selectedOrdersData.reduce(
      (sum, order) => sum + (order.grand_total || order.total || 0),
      0,
    );

    try {
      const { defaultMode } = await getModeOfPayments();
      const modeOfPayment = defaultMode || 'Cash';
      const response = await convertSalesOrdersToInvoice({
        sales_orders: ordersToConvert,
        payments: [{ mode_of_payment: modeOfPayment, amount: totalAmount }],
      });

      console.log(
        'Convert to invoice response:',
        JSON.stringify(response, null, 2),
      );

      if (response?.message?.success_key === 1) {
        // Handle both single invoice (sales_invoice) and multiple invoices (invoices array)
        const invoiceName = response.message.sales_invoice;
        const invoiceNames =
          response.message.invoices || (invoiceName ? [invoiceName] : []);
        const grandTotal = response.message.grand_total;
        const customer = response.message.customer;

        if (invoiceNames.length > 0) {
          const invoiceLabel =
            invoiceNames.length === 1
              ? `Invoice ${invoiceNames[0]} created`
              : `${invoiceNames.length} invoices created`;
          toast.success(invoiceLabel);
          fetchOrders();
          setSelectedOrders(new Set());

          // Print invoices (same path as restaurant checkout — no on-screen preview)
          try {
            const settings = await window.printerSettings.get();
            if (settings) {
              if (settings.clientSidePrintEnabled) {
                // Client-side printing: render locally using cached HTML template
                for (const invName of invoiceNames) {
                  try {
                    await clientSidePrint({
                      salesInvoice: invName,
                      format: settings.clientSidePrintFormat || 'standard',
                    });
                  } catch (oneInvError) {
                    console.error(
                      `Client-side print failed for ${invName}:`,
                      oneInvError,
                    );
                    toast.error(
                      `Invoice ${invName} created but printing failed.`,
                    );
                  }
                }
              } else {
                const useSeparate = settings.useSeparatePrinters || false;
                const targetPrinter =
                  settings.printMethod === 'html'
                    ? settings.printer
                    : useSeparate && settings.invoicePrinter
                      ? settings.invoicePrinter
                      : settings.printer;

                if (targetPrinter) {
                  const formatToUse = invoicePrintFormat || undefined;
                  for (const invName of invoiceNames) {
                    try {
                      if (settings.printMethod === 'html') {
                        const htmlContent = await getSalesInvoiceHTML(
                          invName,
                          formatToUse,
                        );
                        if (htmlContent) {
                          await print({ type: 'html', data: htmlContent });
                        }
                      } else {
                        const pdfBlob = await printSalesInvoicePDF(
                          invName,
                          formatToUse,
                        );
                        await print({
                          type: 'invoice',
                          data: pdfBlob,
                          invoiceNo: invName,
                          printSettings: 'fit',
                        });
                      }
                    } catch (oneInvError) {
                      console.error(
                        `Invoice print failed for ${invName}:`,
                        oneInvError,
                      );
                      toast.error(
                        `Invoice ${invName} created but printing failed.`,
                      );
                    }
                  }
                } else {
                  console.log(
                    'No printer configured — skipping invoice print after conversion',
                  );
                }
              }
            }
          } catch (printError) {
            console.error(
              'Error auto-printing invoices after conversion:',
              printError,
            );
            toast.error('Invoice created but printing failed.');
          }
        } else {
          alert('ERROR\n\nInvoice created but no invoice ID returned');
        }
      } else if (response?.message?.error_type === 'shift_not_open') {
        toast.error(response.message.message || 'No active shift found. Please start your shift.');
        window.dispatchEvent(new Event('shift-not-open'));
        onClose();
      } else {
        // Extract error message from response
        let errorMessage = 'Failed to create invoice.';

        if (response?.message?.message) {
          errorMessage = response.message.message;
        } else if (response?.message?.error) {
          errorMessage = response.message.error;
        } else if (response?._server_messages) {
          try {
            const serverMessages = JSON.parse(response._server_messages);
            if (Array.isArray(serverMessages) && serverMessages.length > 0) {
              const firstMessage = JSON.parse(serverMessages[0]);
              errorMessage = firstMessage.message || errorMessage;
            }
          } catch (e) {
            console.error('Error parsing server messages:', e);
          }
        }

        alert(`ERROR\n\n${errorMessage}`);
        console.error('Convert to invoice failed:', response);
      }
    } catch (error: any) {
      console.error('Error converting to invoice:', error);

      const errData = error?.response?.data?.message;
      if (errData?.error_type === 'shift_not_open') {
        toast.error(errData.message || 'No active shift found. Please start your shift.');
        window.dispatchEvent(new Event('shift-not-open'));
        onClose();
        return;
      }

      let errorMessage = 'Failed to create invoice. Please try again.';

      if (error?.response?.data) {
        const errorData = error.response.data;
        if (errorData?.message?.message) {
          errorMessage = errorData.message.message;
        } else if (errorData?.message?.error) {
          errorMessage = errorData.message.error;
        } else if (errorData?._server_messages) {
          try {
            const serverMessages = JSON.parse(errorData._server_messages);
            if (Array.isArray(serverMessages) && serverMessages.length > 0) {
              const firstMessage = JSON.parse(serverMessages[0]);
              errorMessage = firstMessage.message || errorMessage;
            }
          } catch (e) {
            console.error('Error parsing server messages:', e);
          }
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      alert(`ERROR\n\n${errorMessage}`);
    } finally {
      // Remove all converted orders from the set
      setConvertingOrders((prev) => {
        const newSet = new Set(prev);
        ordersToConvert.forEach((order) => newSet.delete(order));
        return newSet;
      });
    }
  };

  const handlePrintOrder = async (orderName: string) => {
    setIsPrinting(orderName);
    try {
      const settings = await window.printerSettings.get();
      const formatToUse = orderPrintFormat || undefined;
      let blob;

      if (settings?.printMethod === 'html') {
        const orderHtml = await getSalesOrderHTML(orderName, formatToUse);
        if (orderHtml) {
          const pdfData = await window.pdf.generateFromHTML(orderHtml);
          const cleanBase64 = pdfData.data.replace(/\s/g, '');
          const binaryString = atob(cleanBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: 'application/pdf' });
        }
      } else {
        blob = await printSalesOrderPDF(orderName, formatToUse);
      }

      if (blob) {
        setPdfBlob(blob);
        setPdfOrderName(orderName);
      }
      setIsPrinting(null);
    } catch (error: any) {
      console.error('Error printing order:', error);
      let errorMessage = 'Failed to load order PDF';

      if (error?.response?.data?.message?.message) {
        errorMessage = error.response.data.message.message;
      } else if (error?.response?.data?.message?.error) {
        errorMessage = error.response.data.message.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      alert(`ERROR\n\n${errorMessage}`);
      setIsPrinting(null);
    }
  };

  const handlePrintKOT = async (order: SalesOrder) => {
    setIsPrintingKOT(order.name);
    try {
      // Convert order to KOT data (async, fetches tags)
      const kotData = await salesOrderToKOTData(order);

      // Generate HTML
      const html = generateKOTHTML(kotData);

      // Print directly via persistent print window
      const settings = await window.printerSettings.get();
      const useSeparate = settings?.useSeparatePrinters || false;
      const printerName =
        (useSeparate && settings?.kotPrinter
          ? settings.kotPrinter
          : settings?.printer) || '';

      if (!printerName) {
        toast.error('No printer configured');
        setIsPrintingKOT(null);
        return;
      }

      await window.printers.printHTML(html, printerName, {
        pageSize: settings?.paperSize || '80mm',
      });
      toast.success(`KOT printed for ${order.name}`);
    } catch (error: any) {
      console.error('Error printing KOT:', error);
      toast.error(error?.message || 'Failed to print KOT');
    } finally {
      setIsPrintingKOT(null);
    }
  };

  const handleDirectPrintAll = async (order: SalesOrder) => {
    if (!selectedPrinter) {
      alert('Please select a printer in Global Settings first');
      return;
    }

    setIsPrinting(order.name); // reusing print state or add new one
    try {
      // KOT is not printed here — kitchen copy is typically part of the Sales Order
      // print format from the server; separate KOT uses Preview KOT (Utensils).

      // Print Order (HTML or PDF from Global Settings)
      const settings = await window.printerSettings.get();
      const formatToUse = orderPrintFormat || undefined;
      if (settings?.printMethod === 'html') {
        const orderHtml = await getSalesOrderHTML(order.name, formatToUse);
        if (orderHtml) {
          await window.printers.printHTML(orderHtml, selectedPrinter, {
            pageSize: settings?.paperSize || 'A4',
          });
        }
      } else {
        const blob = await printSalesOrderPDF(order.name, formatToUse);
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binaryString);
        await window.printers.printPDF(
          { __isBlob: true, data: base64, type: 'application/pdf' } as any,
          selectedPrinter,
        );
      }

      console.log('Order sent to printer');
    } catch (error: any) {
      console.error('Error printing all:', error);
      alert(`Failed to print documents: ${error.message || 'Unknown error'}`);
    } finally {
      setIsPrinting(null);
    }
  };

  const handleEditOrder = (order: SalesOrder) => {
    onSelectOrder?.(order);
    onClose();
  };

  const handleDelete = async (orderName: string) => {
    setDeletingOrder(orderName);
    try {
      const response = await deleteDraftSalesOrder(orderName);
      if (response?.message?.success_key === 1) {
        toast.success(`Order ${orderName} deleted successfully`);
        setSelectedOrders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(orderName);
          return newSet;
        });
        fetchOrders();
      } else {
        const errorMessage =
          response?.message?.message || 'Failed to delete order';
        alert(`ERROR\n\n${errorMessage}`);
      }
    } catch (error: any) {
      console.error('Error deleting order:', error);
      const errorMessage =
        error?.response?.data?.message?.message ||
        error?.message ||
        'Failed to delete order';
      alert(`ERROR\n\n${errorMessage}`);
    } finally {
      setDeletingOrder(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-white" />
            <h2 className="text-xl font-semibold text-white">Order History</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-700 rounded-md p-1.5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions Bar */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
            >
              {selectedOrders.size === orders.length
                ? 'Deselect All'
                : 'Select All'}
            </button>
            {selectedOrders.size > 0 && (
              <button
                onClick={() => handleConvertToInvoice()}
                disabled={convertingOrders.size > 0}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${convertingOrders.size > 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
              >
                {convertingOrders.size > 0
                  ? 'Converting...'
                  : `Convert ${selectedOrders.size} to Invoice${selectedOrders.size > 1 ? 's' : ''}`}
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-700">From:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-700">To:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={fetchOrders}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-10 text-gray-500">
              Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No draft orders found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.name}
                  className={`bg-white border-2 rounded-lg p-4 transition-all ${selectedOrders.has(order.name)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Checkbox and Order Info */}
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.name)}
                        onChange={() => handleToggleOrder(order.name)}
                        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {order.name}
                          </h3>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${order.status === 'Draft'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                              }`}
                          >
                            {order.status}
                          </span>
                          {order.restaurant_order_type && (
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded ${order.restaurant_order_type === 'Dining'
                                ? 'bg-blue-100 text-blue-800'
                                : order.restaurant_order_type === 'Parcel'
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-indigo-100 text-indigo-800'
                                }`}
                            >
                              {order.restaurant_order_type}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <p>
                            Customer:{' '}
                            {order.customer_name || order.customer || 'N/A'}
                          </p>
                          <p>
                            Date:{' '}
                            {format(
                              new Date(order.transaction_date),
                              'dd MMM yyyy',
                            )}
                          </p>
                          <p>Items: {order.items?.length || 0}</p>
                        </div>
                        {order.items && order.items.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="text-xs text-gray-600 space-y-1">
                              {order.items.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>
                                    {item.item_name || item.item_code} x{' '}
                                    {item.qty}
                                  </span>
                                  <span className="font-medium">
                                    {formatCurrency(item.amount)}
                                  </span>
                                </div>
                              ))}
                              {order.items.length > 3 && (
                                <p className="text-gray-500">
                                  +{order.items.length - 3} more items
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Total and Actions */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Total</p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(order.grand_total || order.total)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePrintKOT(order)}
                          disabled={isPrintingKOT === order.name}
                          className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-md transition disabled:opacity-50"
                          title="Preview KOT"
                        >
                          {isPrintingKOT === order.name ? (
                            <svg
                              className="animate-spin w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                          ) : (
                            <Utensils className="w-4 h-4" />
                          )}
                        </button>

                        {/* Direct print Sales Order only (server format; often includes kitchen lines) */}
                        <button
                          onClick={() => handleDirectPrintAll(order)}
                          disabled={isPrinting === order.name}
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-md transition disabled:opacity-50"
                          title="Print Order"
                        >
                          {isPrinting === order.name ? (
                            <svg
                              className="animate-spin w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                          ) : (
                            <Printer className="w-4 h-4" />
                          )}
                        </button>
                        {/* Preview Order Button */}
                        <button
                          onClick={() => handlePrintOrder(order.name)}
                          disabled={isPrinting === order.name}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition disabled:opacity-50"
                          title="Preview Order PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleConvertToInvoice(order.name)}
                          disabled={convertingOrders.has(order.name)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${convertingOrders.has(order.name)
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700'
                            } flex items-center gap-1.5`}
                          title="Convert to Invoice"
                        >
                          {convertingOrders.has(order.name) ? (
                            <>
                              <svg
                                className="animate-spin w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Converting...
                            </>
                          ) : (
                            <>
                              <FileText className="w-3 h-3" />
                              Invoice
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleEditOrder(order)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(order.name)}
                          disabled={deletingOrder === order.name}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition disabled:opacity-50 flex items-center gap-1.5"
                          title="Delete Order"
                        >
                          {deletingOrder === order.name ? (
                            <>
                              <svg
                                className="animate-spin w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {pdfBlob && pdfOrderName && (
        <PDFViewerModal
          blob={pdfBlob}
          title={`Order ${pdfOrderName}`}
          onClose={() => {
            setPdfBlob(null);
            setPdfOrderName(null);
          }}
        />
      )}
    </div>
  );
};

export default RestaurantOrderHistoryModal;
