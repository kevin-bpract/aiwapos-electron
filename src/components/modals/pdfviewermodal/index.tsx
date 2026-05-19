import React, { useState, useEffect } from 'react';
import { X, Download, Printer } from 'lucide-react';

// Note: Using native Electron PDF viewer via iframe instead of react-pdf
// This avoids worker loading issues in Electron and uses Electron's built-in PDF support

interface PDFViewerModalProps {
  blob: Blob;
  title: string;
  onClose: () => void;
}

const PDFViewerModal: React.FC<PDFViewerModalProps> = ({ blob, title, onClose }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    // Create object URL from blob
    try {
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);

      // Verify blob is valid PDF
      blob.arrayBuffer().then((buffer) => {
        const view = new Uint8Array(buffer);
        const header = String.fromCharCode(...view.slice(0, 4));
        console.log('PDF blob verification - Header:', header, 'Size:', blob.size, 'bytes');

        if (header !== '%PDF') {
          console.error('Invalid PDF header:', header);
          setError('Invalid PDF file: missing PDF header');
          setLoading(false);
        } else {
          // PDF is valid, iframe will handle loading
          setLoading(false);
        }
      }).catch((err) => {
        console.error('Error reading blob:', err);
        setError('Failed to read PDF file');
        setLoading(false);
      });

      // Cleanup URL when component unmounts
      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error('Error creating object URL from blob:', err);
      setError('Failed to load PDF document');
      setLoading(false);
    }
  }, [blob]);

  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      // Convert blob to base64 for IPC transfer
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Convert Uint8Array to base64 string
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binaryString);

      // Use Windows print API if available
      if (window.printers?.printPDF) {
        try {
          await window.printers.printPDF(
            { __isBlob: true, data: base64, type: 'application/pdf' } as any,
            undefined // Use default printer
          );
        } catch (err: any) {
          console.error('Print error:', err);
          alert(`ERROR\n\nFailed to print PDF: ${err.message || 'Unknown error'}`);
        }
      } else {
        // Fallback: use browser print dialog
        const iframe = document.querySelector(`iframe[title="${title}"]`) as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.print();
        } else {
          window.print();
        }
      }
    } catch (err: any) {
      console.error('Print error:', err);
      alert(`ERROR\n\nFailed to print PDF: ${err.message || 'Unknown error'}`);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white shadow-xl w-full h-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {pdfUrl && (
              <>
                <button
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${isPrinting
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                >
                  {isPrinting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Printing...
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      Print
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-white hover:bg-blue-700 rounded-md p-1.5 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer - Using native Electron PDF viewer */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          {error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-600 font-medium mb-2">{error}</p>
                <p className="text-sm text-gray-500">Please try downloading the PDF instead</p>
                {pdfUrl && (
                  <button
                    onClick={handleDownload}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  >
                    Download PDF
                  </button>
                )}
              </div>
            </div>
          ) : pdfUrl ? (
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Loading PDF...</p>
                    <p className="text-xs text-gray-400 mt-1">Size: {(blob.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
              )}
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title={title}
                onLoad={() => {
                  setLoading(false);
                  setError(null);
                }}
                onError={() => {
                  setError('Failed to load PDF in iframe. Electron may not support PDF viewing in this context.');
                  setLoading(false);
                }}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Preparing PDF...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFViewerModal;
