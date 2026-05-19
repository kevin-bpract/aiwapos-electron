// import Portal from '../../../components/portal';
//
// export interface SessionReportModalProps {
//   htmlContent: string;
//   onClose: () => void;
//   onPrint: () => void | Promise<void>;
//   /** Disables Print while a print job is in progress (e.g. from usePrinter) */
//   isPrinting?: boolean;
// }
//
// export default function SessionReportModal({
//   htmlContent,
//   onClose,
//   onPrint,
//   isPrinting = false,
// }: SessionReportModalProps) {
//   return (
//     <Portal modalTitle="Session Report" onClose={onClose}>
//       <div
//         className="p-4"
//         style={{ width: '100%', minWidth: '400px', height: '60vh' }}
//       >
//         <iframe
//           title="Session Report"
//           style={{ width: '100%', height: '100%', border: 'none' }}
//           srcDoc={htmlContent}
//           // Sandbox without `allow-modals` so the template's auto-`window.print()`
//           // is blocked. Real printing only happens via the Print button, which
//           // routes through Electron IPC with the configured printer + page size.
//           sandbox="allow-scripts"
//         />
//       </div>
//       <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
//         <button
//           type="button"
//           disabled={isPrinting}
//           onClick={() => void onPrint()}
//           className="px-6 py-2 rounded-xl bg-green-600 text-white font-semibold shadow-sm hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
//         >
//           {isPrinting ? 'Printing…' : 'Print'}
//         </button>
//         <button
//           type="button"
//           onClick={onClose}
//           className="px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 transition"
//         >
//           Close
//         </button>
//       </div>
//     </Portal>
//   );
// }
//
//
//
//
//
//
//
//
//
//
//
//
//
//

import Portal from '../../../components/portal';

export interface SessionReportModalProps {
  htmlContent: string;
  onClose: () => void;
  onPrint: () => void | Promise<void>;
  isPrinting?: boolean;
}

export default function SessionReportModal({
  htmlContent,
  onClose,
  onPrint,
  isPrinting = false,
}: SessionReportModalProps) {
  return (
    <Portal modalTitle="Session Report" onClose={onClose}>
      <div
        className="flex flex-col"
        style={{ width: '100%', minWidth: '400px', height: '60vh' }}
      >
        {/* Scrollable content */}
        <div className="flex-1 overflow-auto">
          <iframe
            title="Session Report"
            className="w-full h-full border-none"
            srcDoc={htmlContent}
            sandbox="allow-scripts"
          />
        </div>

        {/* Fixed footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([htmlContent], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'session_report_print_test.html';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-6 py-2 rounded-xl bg-orange-600 text-white font-semibold shadow-sm hover:bg-orange-700 transition mr-auto"
          >
            Export HTML
          </button>
          
          <button
            type="button"
            disabled={isPrinting}
            onClick={() => void onPrint()}
            className="px-6 py-2 rounded-xl bg-green-600 text-white font-semibold shadow-sm hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPrinting ? 'Printing…' : 'Print'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </Portal>
  );
}
