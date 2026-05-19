import { useState, useEffect, useCallback } from 'react';
import { MoonLoader } from 'react-spinners';
import { toast } from 'sonner';
import Portal from '../../components/portal';
import ShiftOpeningModal from './modals/ShiftOpeningModal';
import ShiftClosingModal from './modals/ShiftClosingModal';
import SessionReportModal from './modals/SessionReportModal';
import { useAuth } from '../contexts/AuthContext';
import { usePrinter } from '../../hooks/usePrinter';
import { getModeOfPayments } from '../../main/api/invoice';
import { format } from 'date-fns';
import { buildSessionReport } from '../../utils/sessionReportPrint';

type Report = {
  shift_opening_entry?: string;
  user?: string;
  sales_person?: string;
  company?: string;
  period_start_date?: string;
  current_time?: string;
  posting_date?: string;
  grand_total?: number;
  net_total?: number;
  total_quantity?: number;
  total_invoices?: number;
  total_returns?: number;
  return_total?: number;
  net_sales?: number;
  payment_summary?: {
    mode_of_payment?: string;
    opening_amount?: number;
    collected?: number;
    expected_balance?: number;
  }[];
  taxes?: any[];
  transactions?: any[];
};

interface ShiftData {
  name: string;
  user: string;
  company: string;
  period_start_date: string;
  posting_date: string;
  status: string;
  balance_details: Array<{
    mode_of_payment: string;
    opening_amount: number;
  }>;
}

interface ShiftManagerProps {
  onSessionToggle?: (openModal: () => void) => void;
  /** True while checking shift or session modal is open — customer dropdown should stay closed */
  onShiftGateChange?: (blockCustomerSelection: boolean) => void;
}

function ReportView({ report }: { report?: Report }) {
  if (!report)
    return (
      <div className="p-8 text-center text-gray-500">
        No session data available
      </div>
    );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return format(d, 'MMM dd, yyyy - hh:mm a');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 max-h-[70vh] overflow-y-auto space-y-8">
      {/* Header Info */}
      <div className="grid grid-cols-2 gap-4 border-b pb-6">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            Shift
          </p>
          <p className="font-semibold text-gray-900 mt-1">
            {report.shift_opening_entry ?? '-'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            User
          </p>
          <p className="font-semibold text-gray-900 mt-1">
            {report.user ?? '-'}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            Start Time
          </p>
          <p className="font-semibold text-gray-900 mt-1">
            {formatDate(report.period_start_date)}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            Current Time
          </p>
          <p className="font-semibold text-gray-900 mt-1">
            {formatDate(report.current_time)}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            Company
          </p>
          <p className="font-semibold text-gray-900 mt-1">
            {report.company ?? '-'}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Sales Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Invoices
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {report.total_invoices ?? 0}
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Returns
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {report.total_returns ?? 0}
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Quantity
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {report.total_quantity ?? 0}
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Net Sales
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {report.net_sales?.toFixed(2) ?? '0.00'}
            </p>
          </div>
        </div>
      </div>

      {/* Payments */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Payment Details
        </h3>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {report.payment_summary?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs">
                      Mode
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs text-right">
                      Opening
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs text-right">
                      Collected
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs text-right">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {report.payment_summary.map((p, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {p.mode_of_payment ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {p.opening_amount?.toFixed(2) ?? '0.00'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium">
                        {p.collected?.toFixed(2) ?? '0.00'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {p.expected_balance?.toFixed(2) ?? '0.00'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
              No payment records found
            </div>
          )}
        </div>
      </div>

      {!report.transactions?.length && (
        <div className="border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-gray-500 text-sm">
            No transactions available for this session
          </p>
        </div>
      )}
    </div>
  );
}

export default function ShiftManager({
  onSessionToggle,
  onShiftGateChange,
}: ShiftManagerProps) {
  const { isAuthenticated, user } = useAuth();
  const { print, isPrinting } = usePrinter();
  const [isLoading, setIsLoading] = useState(true);
  const [shiftData, setShiftData] = useState<ShiftData | null>(null);

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [currentSessionModalVisible, setCurrentSessionModalVisible] =
    useState<boolean>(false);

  // Is it a closing request from app exit?
  const [isProcessingClose, setIsProcessingClose] = useState(false);
  const [lastClosingEntryName, setLastClosingEntryName] = useState<string | null>(null);

  const [isProcessingCurrentSession, setIsProcessingCurrentSession] =
    useState(false);

  // Public method to open the session modal (called by sidebar)
  const openSessionModal = useCallback(() => {
    setShowSessionModal(true);
  }, []);

  // Register the openSessionModal callback with the parent
  useEffect(() => {
    if (onSessionToggle) {
      onSessionToggle(openSessionModal);
    }
  }, [onSessionToggle, openSessionModal]);

  // Fetch the currently open shift for this user, if any.
  // Returns the hydrated ShiftData or null. Does not touch state.
  const fetchOpenShift = useCallback(async (): Promise<ShiftData | null> => {
    const response = await window.api.get(
      '/api/method/pos_api.api.get_open_shift',
    );
    if (response?.message?.success_key === 1 && response?.message?.shift) {
      const shift = response.message.shift;
      if (typeof shift === 'string') {
        return {
          name: shift,
          user: '',
          company: '',
          period_start_date: '',
          posting_date: '',
          status: 'Open',
          balance_details: [],
        };
      }
      return shift as ShiftData;
    }
    return null;
  }, []);

  // Check open shift status on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    const checkOpenShift = async () => {
      // Retry once on transient failure before assuming no shift exists —
      // otherwise a flaky first call drops us into the opening modal, and
      // the backend then blocks creation with "user already has an open shift".
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const shift = await fetchOpenShift();
          if (shift) {
            setShiftData(shift);
            toast.success('Resuming active session...');
          } else {
            setShiftData(null);
            setShowSessionModal(true);
          }
          setIsLoading(false);
          return;
        } catch (error) {
          lastError = error;
        }
      }
      console.error('Failed to check open shift:', lastError);
      setShiftData(null);
      setShowSessionModal(true);
      setIsLoading(false);
    };

    checkOpenShift();
  }, [isAuthenticated, fetchOpenShift]);

  useEffect(() => {
    const blocked = isLoading || showSessionModal;
    onShiftGateChange?.(blocked);
  }, [isLoading, showSessionModal, onShiftGateChange]);

  useEffect(() => {
    const unsub = window.electron.ipcRenderer.on(
      'window-close-request' as any,
      () => {
        if (shiftData) {
          const proceed = window.confirm(
            'You still have an open session. Closing the app will leave it open — you will need to close it on next login. Close anyway?',
          );
          if (!proceed) return;
        }
        window.electron.ipcRenderer.sendMessage('app-quit' as any);
      },
    );

    return () => {
      unsub();
    };
  }, [shiftData]);

  // When any API returns error_type: "shift_not_open", reset state and show opening modal
  useEffect(() => {
    const handleShiftNotOpen = () => {
      console.log(
        '[ShiftManager] Received shift-not-open event — resetting shift state',
      );
      setShiftData(null);
      setShowSessionModal(true);
    };
    window.addEventListener('shift-not-open', handleShiftNotOpen);
    return () =>
      window.removeEventListener('shift-not-open', handleShiftNotOpen);
  }, []);

  // this can be called from the frontend, because it always hits erpnet backend.

  const handleOpenShift = async (amount?: number) => {
    try {
      const { defaultMode } = await getModeOfPayments();
      const balanceItem: { mode_of_payment: string; opening_amount?: number } =
        {
          mode_of_payment: defaultMode || 'Cash',
        };
      if (amount != null && !Number.isNaN(amount) && amount >= 0) {
        balanceItem.opening_amount = amount;
      }
      const payload = {
        params: {
          balance_details: [balanceItem],
        },
      };

      const response = await window.api.post(
        '/api/method/pos_api.api.create_shift_opening_entry',
        payload,
        { 'Content-Type': 'application/json' },
      );

      if (response?.message?.success_key === 1) {
        const soe = response.message.shift_opening_entry;
        setShiftData(soe);
        setShowSessionModal(false);
      } else {
        throw new Error(response?.message?.message || 'Failed to open shift');
      }
    } catch (error: any) {
      console.error('Error opening shift:', error);
      const msg =
        error.response?.data?.message?.message ||
        error.message ||
        'Error opening shift';

      // Conflict recovery: backend may reject creation because a shift is
      // already open for this user (e.g. app was closed without closing the
      // session). Re-check and, if found, swap to the closing modal so the
      // user isn't stuck.
      try {
        const existing = await fetchOpenShift();
        if (existing) {
          setShiftData(existing);
          setShowSessionModal(true);
          toast.info(
            'You already have an open session. Please close it to continue.',
          );
          return;
        }
      } catch (recoveryErr) {
        console.error(
          'Failed to recover open shift after conflict:',
          recoveryErr,
        );
      }

      throw new Error(msg);
    }
  };

  const handleCurrentSession = async () => {
    setIsProcessingCurrentSession(true);
    try {
      const response = await window.api.get(
        '/api/method/pos_api.api.get_live_shift_report',
      );

      if (response.message.success_key === 1) {
        setReport(response.message.report);
        setCurrentSessionModalVisible(true);
        setIsProcessingCurrentSession(false);
      } else {
        console.log('fail');
        setIsProcessingCurrentSession(false);
      }
    } catch (error) {
      console.error('Error opening shift:', error);
      setIsProcessingCurrentSession(false);
    }
  };

  const handleCloseShift = async (cashAmount: number) => {
    if (!shiftData) return;

    setIsProcessingClose(true);
    try {
      const payload = {
        params: {
          shift_opening_entry: shiftData.name,
          closing_amounts: {
            Cash: cashAmount,
          },
        },
      };

      // 1. Close Shift
      const closeResponse = await window.api.post(
        '/api/method/pos_api.api.create_shift_closing_entry',
        payload,
        { 'Content-Type': 'application/json' },
      );

      if (closeResponse?.message?.success_key !== 1) {
        throw new Error(
          closeResponse?.message?.message || 'Failed to close shift',
        );
      }

      const closingEntryName = closeResponse.message.shift_closing_entry.name;
      console.log('Shift closed:', closingEntryName);
      setLastClosingEntryName(closingEntryName);

      // 2. Fetch HTML for viewing in SessionReportModal
      try {
        const settings = await window.printerSettings.get();
        let html: string | null = null;

        if (settings?.sessionReportClientPrintEnabled) {
          // Client HTML path — template + data API (used for both viewing and HTML printing)
          html = await buildSessionReport(closingEntryName);
        } else {
          // Server HTML path — used for viewing in both "server" and "pdf" modes
          const printResponse = await window.api.get(
            `/api/method/pos_api.api.get_shift_closing_print_html?shift_closing_entry=${closingEntryName}`,
          );
          if (
            printResponse?.message?.success_key === 1 &&
            printResponse?.message?.html
          ) {
            html = printResponse.message.html;
          }
        }

        if (html) {
          setReportHtml(html);
          // Auto-print on shift close disabled — only print when the user
          // explicitly clicks the Print button in SessionReportModal.
          // try {
          //   await print({ type: 'html', data: html });
          // } catch {
          //   // usePrinter already surfaces a toast on failure
          // }
        }
      } catch (printErr) {
        console.error('Failed to print shift closing:', printErr);
        // Continue regardless of print failure
      }

      setShiftData(null);

      // After closing shift, keep modal open showing "no session" state
      // so user can immediately start a new session
      setShowSessionModal(true);
    } catch (error: any) {
      console.error('Error closing shift:', error);
      throw error;
    } finally {
      setIsProcessingClose(false);
    }
  };

  const handleCancelModal = () => {
    // Allow closing modal so users can switch accounts or change backend URL
    setShowSessionModal(false);
  };

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm">
        <MoonLoader color="#ffffff" />
      </div>
    );
  }

  return (
    <>
      {showSessionModal && (
        <Portal modalTitle="Session" onClose={handleCancelModal}>
          {shiftData ? (
            // Active session → show closing UI
            <ShiftClosingModal
              shiftEntryName={shiftData.name}
              sessionStartDate={shiftData.period_start_date}
              username={user || 'User'}
              onConfirm={handleCloseShift}
              onCancel={handleCancelModal}
              isProcessing={isProcessingClose}
              viewCurrentSession={handleCurrentSession}
              isProcessingCurrentSession={isProcessingCurrentSession}
            />
          ) : (
            // No session → show opening UI
            <ShiftOpeningModal
              onConfirm={handleOpenShift}
              username={user || 'User'}
              onCancel={handleCancelModal}
            />
          )}
        </Portal>
      )}

      {/* Session Report Modal */}
      {reportHtml && (
        <SessionReportModal
          htmlContent={reportHtml}
          isPrinting={isPrinting}
          onClose={() => setReportHtml(null)}
          onPrint={async () => {
            try {
              const settings = await window.printerSettings.get();
              if (settings?.sessionReportClientPrintEnabled) {
                // Client HTML path — rendered at 80mm thermal width
                if (!reportHtml) return;
                const printer = settings?.printer || '';
                const result = await window.printers.printHTML(reportHtml, printer, { pageSize: '80mm' });
                if (!result?.success) {
                  toast.error('Print failed');
                }
              } else if (settings?.sessionReportPdfPrintEnabled && lastClosingEntryName) {
                const width = settings.sessionReportPdfWidth;
                let pdfUrl = `/api/method/pos_api.api.print_session_report_pdf?shift_closing_entry=${lastClosingEntryName}`;
                if (width === '80mm') pdfUrl += '&thermal=1&width=80';
                else if (width === '58mm') pdfUrl += '&thermal=1&width=58';
                const pdfData = await window.api.get(pdfUrl, { responseType: 'blob' });
                const binaryString = atob(pdfData.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'application/pdf' });
                await print({ type: 'default', data: blob });
              } else {
                if (!reportHtml) return;
                await print({ type: 'html', data: reportHtml });
              }
            } catch {
              // usePrinter already shows error toast
            }
          }}
        />
      )}

      {currentSessionModalVisible && (
        <Portal
          modalTitle="Current Session"
          onClose={() => setCurrentSessionModalVisible(false)}
        >
          <ReportView report={report} />
        </Portal>
      )}
    </>
  );
}
