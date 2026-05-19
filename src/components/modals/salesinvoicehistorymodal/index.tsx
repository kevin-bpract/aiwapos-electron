import React, { useState, useEffect, useRef } from 'react';
import { X, Receipt, Printer, QrCode } from 'lucide-react';
import { format } from 'date-fns';
import {
  getSalesInvoices,
  generateInvoiceQR,
  getInvoiceQR,
  printSalesInvoicePDF,
  type SalesInvoice,
} from '../../../main/api/salesOrders';
import PDFViewerModal from '../pdfviewermodal';
import { formatCurrency } from '../../../utils/format';

interface SalesInvoiceHistoryModalProps {
  onClose: () => void;
}

const SalesInvoiceHistoryModal: React.FC<
  SalesInvoiceHistoryModalProps
> = ({ onClose }) => {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfInvoiceName, setPdfInvoiceName] = useState<string | null>(null);
  const [generatingQR, setGeneratingQR] = useState<string | null>(null);
  const [fetchingQR, setFetchingQR] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<{ invoiceName: string; qrCode: string } | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [fromDate, setFromDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return format(date, 'yyyy-MM-dd');
  });
  const [toDate, setToDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd'),
  );

  useEffect(() => {
    fetchInvoices();
  }, [fromDate, toDate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (showQRModal) {
        setShowQRModal(false);
        setQrCodeData(null);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, showQRModal]);

  // Generate QR code on canvas when qrCodeData changes
  useEffect(() => {
    if (qrCodeData && qrCanvasRef.current && showQRModal) {
      const canvas = qrCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Import QRCode dynamically
      import('qrcode').then((QRCode) => {
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
      }).catch((err) => {
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

  const handlePrintInvoice = async (invoiceName: string) => {
    setIsPrinting(invoiceName);
    try {
      // Use the proper PDF API that returns binary data
      const blob = await printSalesInvoicePDF(invoiceName);
      setPdfBlob(blob);
      setPdfInvoiceName(invoiceName);
      setIsPrinting(null);
    } catch (error: any) {
      console.error('Error printing invoice:', error);
      let errorMessage = 'Failed to load invoice PDF';

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

  const handleGenerateQR = async (invoiceName: string) => {
    setGeneratingQR(invoiceName);
    try {
      const response = await generateInvoiceQR(invoiceName);
      if (response?.message?.success_key === 1 && response?.message?.data?.qr_code) {
        setQrCodeData({
          invoiceName: response.message.data.invoice_name,
          qrCode: response.message.data.qr_code,
        });
        setShowQRModal(true);
        alert('SUCCESS\n\nQR code generated successfully!');
      } else {
        const errorMessage = response?.message?.message || 'Failed to generate QR code';
        alert(`ERROR\n\n${errorMessage}`);
      }
    } catch (error: any) {
      console.error('Error generating QR code:', error);
      const errorMessage = error?.response?.data?.message?.message || error?.message || 'Failed to generate QR code';
      alert(`ERROR\n\n${errorMessage}`);
    } finally {
      setGeneratingQR(null);
    }
  };

  const handleShowQR = async (invoiceName: string) => {
    setFetchingQR(invoiceName);
    try {
      const response = await getInvoiceQR(invoiceName);
      if (response?.message?.success_key === 1 && response?.message?.data?.qr_code) {
        setQrCodeData({
          invoiceName: response.message.data.invoice_name,
          qrCode: response.message.data.qr_code,
        });
        setShowQRModal(true);
      } else {
        const errorMessage = response?.message?.message || 'QR code not found. Please generate it first.';
        alert(`ERROR\n\n${errorMessage}`);
      }
    } catch (error: any) {
      console.error('Error fetching QR code:', error);
      const errorMessage = error?.response?.data?.message?.message || error?.message || 'Failed to fetch QR code';
      alert(`ERROR\n\n${errorMessage}`);
    } finally {
      setFetchingQR(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-white" />
            <h2 className="text-xl font-semibold text-white">Sales Invoice History</h2>
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
            <span className="text-sm text-gray-600">
              Total Invoices: <span className="font-semibold">{invoices.length}</span>
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
                          Qty: {invoice.total_qty || 0} | Net: {formatCurrency(invoice.net_total)}
                        </p>
                        <p>
                          Tax: {formatCurrency(invoice.total_taxes_and_charges)}
                        </p>
                        {invoice.outstanding_amount !== undefined && invoice.outstanding_amount > 0 && (
                          <p className="text-orange-600 font-medium">
                            Outstanding: {formatCurrency(invoice.outstanding_amount)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Total and Actions */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Grand Total</p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(invoice.grand_total)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleGenerateQR(invoice.name)}
                          disabled={generatingQR === invoice.name}
                          className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-md transition disabled:opacity-50"
                          title="Generate ZATCA QR Code"
                        >
                          {generatingQR === invoice.name ? (
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
                            <QrCode className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleShowQR(invoice.name)}
                          disabled={fetchingQR === invoice.name}
                          className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition disabled:opacity-50"
                          title="Show QR Code"
                        >
                          {fetchingQR === invoice.name ? (
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
                            <Receipt className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handlePrintInvoice(invoice.name)}
                          disabled={isPrinting === invoice.name}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition disabled:opacity-50"
                          title="Print Invoice"
                        >
                          {isPrinting === invoice.name ? (
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
              <h3 className="text-lg font-semibold text-gray-900">ZATCA QR Code</h3>
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
                Invoice: <span className="font-semibold">{qrCodeData.invoiceName}</span>
              </p>
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                <canvas
                  ref={qrCanvasRef}
                  className="max-w-full"
                />
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

export default SalesInvoiceHistoryModal;
