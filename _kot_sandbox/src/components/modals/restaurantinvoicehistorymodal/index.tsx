import React, { useState, useEffect, useRef } from 'react';
import { X, Receipt, Printer, QrCode, FileText, Utensils, Trash2 } from 'lucide-react';
import {
  getSalesInvoices,
  getSalesInvoice,
  getSalesInvoiceHTML,
  generateInvoiceQR,
  getInvoiceQR,
  printSalesInvoicePDF,
  printSalesOrderPDF,
  deleteDraftSalesOrder,
  type SalesInvoice,
} from '../../../main/api/salesOrders';
import { formatCurrency } from '../../../utils/format';
import { format } from 'date-fns';
import PDFViewerModal from '../pdfviewermodal';
import { usePrinter } from '../../../hooks/usePrinter';
import { clientSidePrint } from '../../../utils/clientSidePrint';
import { toast } from 'sonner';
import {
  generateKOTHTML,
  type KOTData,
} from '../../../utils/kotGenerator';
import { getNextBillNumber } from '../../../utils/billNumber';

interface RestaurantInvoiceHistoryModalProps {
  onClose: () => void;
}

const RestaurantInvoiceHistoryModal: React.FC<
  RestaurantInvoiceHistoryModalProps
> = ({ onClose }) => {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfInvoiceName, setPdfInvoiceName] = useState<string | null>(null);
  const [generatingQR, setGeneratingQR] = useState<string | null>(null);
  const [fetchingQR, setFetchingQR] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<{
    invoiceName: string;
    qrCode: string;
  } | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [invoicePrintFormat, setInvoicePrintFormat] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // 30 days ago
    return format(date, 'yyyy-MM-dd');
  });
  const [toDate, setToDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd'),
  );
  const { print, isPrinting: isHookPrinting } = usePrinter();
  // We can remove local printing states if we rely on hook's global loading, 
  // but to keep button specific loading state we might need to track it manually or ignore it.
  // The hook provides a global `isPrinting` state.
  const [printingDoc, setPrintingDoc] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);

  const handleDelete = async (invoiceName: string) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${invoiceName}?`)) {
      return;
    }

    setDeletingDoc(invoiceName);
    try {
      const response = await deleteDraftSalesOrder(invoiceName);
      if (response?.message?.success_key === 1) {
        toast.success(`Invoice ${invoiceName} deleted successfully`);
        fetchInvoices();
      } else {
        const errorMessage = response?.message?.message || 'Failed to delete invoice';
        alert(`ERROR\n\n${errorMessage}`);
      }
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      const errorMessage =
        error?.response?.data?.message?.message ||
        error?.message ||
        'Failed to delete invoice';
      alert(`ERROR\n\n${errorMessage}`);
    } finally {
      setDeletingDoc(null);
    }
  };

  useEffect(() => {
    fetchInvoices();

    // Load printer settings (printer + invoice print format from globalsettings)
    const loadPrinterSettings = async () => {
      try {
        const settings = await window.printerSettings.get();
        if (settings?.printer) {
          setSelectedPrinter(settings.printer);
        }
        if (settings?.invoicePrintFormat !== undefined) {
          setInvoicePrintFormat(settings.invoicePrintFormat || '');
        }
      } catch (error) {
        console.error('Error loading printer settings:', error);
      }
    };

    loadPrinterSettings();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fromDate, toDate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showQRModal && !pdfBlob) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showQRModal, pdfBlob]);

  // Generate QR code on canvas when qrCodeData changes
  useEffect(() => {
    if (qrCodeData && qrCanvasRef.current && showQRModal) {
      const canvas = qrCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Import QRCode dynamically
      import('qrcode')
        .then((QRCode) => {
          QRCode.toCanvas(canvas, qrCodeData.qrCode, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
          }).catch((err: Error) => {
            console.error('Error generating QR code:', err);
          });
        })
        .catch((err) => {
          console.error('Error loading QRCode library:', err);
          // Fallback: just show the text
        });
    }
  }, [qrCodeData, showQRModal]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const data = await getSalesInvoices({
        limit_start: 0,
        limit_page_length: 50,
        from_date: fromDate,
        to_date: toDate,
      });
      setInvoices(data);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      const errorMessage =
        error?.response?.data?.message?.message ||
        error?.message ||
        'Failed to load invoices';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Client-side KOT: generate HTML from invoice data and print directly
  const performPrintKOT = async (invoice: SalesInvoice) => {
    const items = (invoice.items || []).map((item) => ({
      item_name: item.item_name || item.item_code,
      item_code: item.item_code,
      qty: item.qty,
      tags: [] as string[],
    }));

    const kotData: KOTData = {
      billNumber: getNextBillNumber(),
      orderNumber: invoice.name,
      items,
      timestamp: new Date(invoice.posting_date || new Date()),
    };

    const html = generateKOTHTML(kotData);

    const settings = await window.printerSettings.get();
    const useSeparate = settings?.useSeparatePrinters || false;
    const printerName =
      (useSeparate && settings?.kotPrinter
        ? settings.kotPrinter
        : settings?.printer) || '';

    if (!printerName) {
      throw new Error('No printer configured');
    }

    await window.printers.printHTML(html, printerName, {
      pageSize: settings?.paperSize || '80mm',
    });
  };

  // Helper to convert blob to base64
  const blobToBase64 = async (blob: Blob): Promise<string> => {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binaryString);
  };

  const handlePrintKOT = async (invoice: SalesInvoice) => {
    setPrintingDoc(`KOT-PREVIEW-${invoice.name}`);
    try {
      await performPrintKOT(invoice);
      toast.success(`KOT printed for ${invoice.name}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to print KOT');
    } finally {
      setPrintingDoc(null);
    }
  };

  const handlePreviewInvoice = async (invoiceName: string) => {
    setIsPrinting(invoiceName);
    try {
      // Use selected invoice print format from globalsettings so PDF matches create-invoice print
      const formatToUse = invoicePrintFormat || undefined;
      const blob = await printSalesInvoicePDF(invoiceName, formatToUse);
      setPdfBlob(blob);
      setPdfInvoiceName(invoiceName);
    } catch (error: any) {
      console.error('Error previewing invoice:', error);
      alert('Failed to load invoice PDF');
    } finally {
      setIsPrinting(null);
    }
  };

  /** Single print job: invoice only (KOT is separate via Preview KOT / KOT flow). */
  const handlePrintInvoice = async (invoice: SalesInvoice) => {
    setPrintingDoc(`INV-${invoice.name}`);
    try {
      const settings = await window.printerSettings.get();

      if (settings?.clientSidePrintEnabled) {
        // Client-side printing: render locally using cached HTML template
        await clientSidePrint({
          salesInvoice: invoice.name,
          format: settings.clientSidePrintFormat || 'standard',
        });
        toast.success('Invoice sent to printer');
        return;
      }

      const useSeparate = settings?.useSeparatePrinters || false;
      const canPrint =
        Boolean(settings?.printer) ||
        (useSeparate && Boolean(settings?.invoicePrinter));
      if (!canPrint) {
        alert('Please select a printer in Global Settings first');
        return;
      }

      const printMethod = settings?.printMethod || 'native';

      const formatToUse = invoicePrintFormat || undefined;
      if (printMethod === 'html') {
        const invoiceHtml = await getSalesInvoiceHTML(invoice.name, formatToUse);
        await print({
          type: 'html',
          data: invoiceHtml,
        });
      } else {
        const blob = await printSalesInvoicePDF(invoice.name, formatToUse);
        await print({
          type: 'invoice',
          data: blob,
          printSettings: 'fit',
        });
      }

      toast.success('Invoice sent to printer');
    } catch (error) {
      console.error('Error printing invoice:', error);
      alert('Failed to print invoice');
    } finally {
      setPrintingDoc(null);
    }
  };

  // const handleGenerateQR = async (invoiceName: string) => {
  //   setGeneratingQR(invoiceName);
  //   try {
  //     const response = await generateInvoiceQR(invoiceName);
  //     if (
  //       response?.message?.success_key === 1 &&
  //       response?.message?.data?.qr_code
  //     ) {
  //       setQrCodeData({
  //         invoiceName: response.message.data.invoice_name,
  //         qrCode: response.message.data.qr_code,
  //       });
  //       setShowQRModal(true);
  //       alert('SUCCESS\n\nQR code generated successfully!');
  //     } else {
  //       const errorMessage =
  //         response?.message?.message || 'Failed to generate QR code';
  //       alert(`ERROR\n\n${errorMessage}`);
  //     }
  //   } catch (error: any) {
  //     console.error('Error generating QR code:', error);
  //     const errorMessage =
  //       error?.response?.data?.message?.message ||
  //       error?.message ||
  //       'Failed to generate QR code';
  //     alert(`ERROR\n\n${errorMessage}`);
  //   } finally {
  //     setGeneratingQR(null);
  //   }
  // };

  // const handleShowQR = async (invoiceName: string) => {
  //   setFetchingQR(invoiceName);
  //   try {
  //     const response = await getInvoiceQR(invoiceName);
  //     if (
  //       response?.message?.success_key === 1 &&
  //       response?.message?.data?.qr_code
  //     ) {
  //       setQrCodeData({
  //         invoiceName: response.message.data.invoice_name,
  //         qrCode: response.message.data.qr_code,
  //       });
  //       setShowQRModal(true);
  //     } else {
  //       const errorMessage =
  //         response?.message?.message ||
  //         'QR code not found. Please generate it first.';
  //       alert(`ERROR\n\n${errorMessage}`);
  //     }
  //   } catch (error: any) {
  //     console.error('Error fetching QR code:', error);
  //     const errorMessage =
  //       error?.response?.data?.message?.message ||
  //       error?.message ||
  //       'Failed to fetch QR code';
  //     alert(`ERROR\n\n${errorMessage}`);
  //   } finally {
  //     setFetchingQR(null);
  //   }
  // };

  return (
    <div className="fixed inset-0 bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-green-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-white" />
            <h2 className="text-xl font-semibold text-white">
              Invoice History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-green-700 rounded-md p-1.5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions Bar */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Total Invoices:{' '}
              <span className="font-semibold">{invoices.length}</span>
            </span>
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
              onClick={fetchInvoices}
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
              Loading invoices...
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No invoices found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.name}
                  className="bg-white border-2 border-gray-200 hover:border-gray-300 rounded-lg p-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Invoice Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {invoice.name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${invoice.docstatus === 0
                            ? 'bg-yellow-100 text-yellow-800'
                            : invoice.docstatus === 1
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                            }`}
                        >
                          {invoice.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <p>
                          Customer:{' '}
                          {invoice.customer_name || invoice.customer || 'N/A'}
                        </p>
                        <p>
                          Date:{' '}
                          {format(
                            new Date(invoice.posting_date),
                            'dd MMM yyyy',
                          )}
                        </p>
                        <p>
                          Qty: {invoice.total_qty || 0} | Net:{' '}
                          {formatCurrency(invoice.net_total)}
                        </p>
                        <p>
                          Tax: {formatCurrency(invoice.total_taxes_and_charges)}
                        </p>
                        {invoice.outstanding_amount !== undefined &&
                          invoice.outstanding_amount > 0 && (
                            <p className="text-orange-600 font-medium">
                              Outstanding:{' '}
                              {formatCurrency(invoice.outstanding_amount)}
                            </p>
                          )}
                      </div>
                    </div>

                    {/* Total and Actions */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Grand Total</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(invoice.grand_total)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Print KOT Button (Preview HTML) */}
                        <button
                          onClick={() => handlePrintKOT(invoice)}
                          disabled={printingDoc === `KOT-PREVIEW-${invoice.name}`}
                          className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-md transition disabled:opacity-50"
                          title="Preview KOT"
                        >
                          {printingDoc === `KOT-PREVIEW-${invoice.name}` ? (
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <Utensils className="w-4 h-4" />
                          )}
                        </button>

                        {/* Preview Invoice Button */}
                        <button
                          onClick={() => handlePreviewInvoice(invoice.name)}
                          disabled={isPrinting === invoice.name}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition disabled:opacity-50"
                          title="Preview Invoice"
                        >
                          {isPrinting === invoice.name ? (
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </button>

                        {/* Print invoice (one job) */}
                        <button
                          onClick={() => handlePrintInvoice(invoice)}
                          disabled={printingDoc === `INV-${invoice.name}`}
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-md transition disabled:opacity-50"
                          title="Print Invoice"
                        >
                          {printingDoc === `INV-${invoice.name}` ? (
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <Printer className="w-4 h-4" />
                          )}
                        </button>

                        {/* Delete Invoice Button */}
                        <button
                          onClick={() => handleDelete(invoice.name)}
                          disabled={deletingDoc === invoice.name}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition disabled:opacity-50"
                          title="Delete Invoice"
                        >
                          {deletingDoc === invoice.name ? (
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <Trash2 className="w-4 h-4" />
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
      {pdfBlob && pdfInvoiceName && (
        <PDFViewerModal
          blob={pdfBlob}
          title={`Invoice ${pdfInvoiceName}`}
          onClose={() => {
            setPdfBlob(null);
            setPdfInvoiceName(null);
          }}
        />
      )}

      {/* QR Code Modal */}
      {showQRModal && qrCodeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                ZATCA QR Code
              </h3>
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setQrCodeData(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Invoice:{' '}
                <span className="font-semibold">{qrCodeData.invoiceName}</span>
              </p>
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                <canvas ref={qrCanvasRef} className="max-w-full" />
              </div>
              <p className="text-xs text-gray-500 mt-4 break-all">
                {qrCodeData.qrCode}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantInvoiceHistoryModal;
