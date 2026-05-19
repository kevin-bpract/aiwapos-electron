import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { generateReceiptData } from '../utils/receiptGenerator';
import { printPDFViaQZ } from '../utils/qzTrayPrinter';
import { clientSidePrint } from '../utils/clientSidePrint';
import { resolvePageSize, isThermalPageSize } from '../utils/printPageSize';

interface PrintOptions {
    type: 'invoice' | 'kot' | 'default' | 'html';
    data: any; // PDF Blob for 'pdf' mode, Data Object for 'pos' mode, string for 'html'
    // POS specific meta-data
    title?: string;
    invoiceNo?: string;
    copies?: number;
    printSettings?: string; // e.g., "noscale", "fit", "paper=A4"
}

export const usePrinter = () => {
    const [isPrinting, setIsPrinting] = useState(false);

    const print = useCallback(async (options: PrintOptions) => {
        setIsPrinting(true);
        const toastId = toast.loading('Printing...');

        try {
            // 0. Client-side print shortcut (for invoices only)
            const settings = await window.printerSettings.get();
            if (
                settings?.clientSidePrintEnabled &&
                options.type === 'invoice' &&
                options.invoiceNo
            ) {
                await clientSidePrint({
                    salesInvoice: options.invoiceNo,
                    format: settings.clientSidePrintFormat || 'standard',
                });
                toast.success('Printed successfully', { id: toastId });
                return;
            }

            // 1. Get Settings (already fetched above)

            const printerType = settings?.printerType || 'pdf';
            const useSeparate = settings?.useSeparatePrinters || false;

            let targetPrinter = settings?.printer || '';

            // Determine correct printer
            if (useSeparate) {
                if (options.type === 'invoice' && settings?.invoicePrinter) {
                    targetPrinter = settings.invoicePrinter;
                } else if (options.type === 'kot' && settings?.kotPrinter) {
                    targetPrinter = settings.kotPrinter;
                }
            }

            if (!targetPrinter) {
                throw new Error('No printer selected in settings');
            }

            // 2. Print Logic
            // Treat KOT with string payload as HTML print — it still uses the kot
            // printer selected above; only the dispatch path changes.
            const isHtmlDispatch =
                options.type === 'html' ||
                (options.type === 'kot' && typeof options.data === 'string');
            if (isHtmlDispatch) {
                // HTML Printing Logic
                if (typeof options.data !== 'string') {
                    throw new Error('Invalid data for HTML printing. Expected HTML string.');
                }
                (window as any).logger.log('DEBUG: usePrinter calling printHTML');

                const effectivePageSize = resolvePageSize(settings);
                console.log(
                    `[PRINT][usePrinter] HTML print resolved pageSize=${effectivePageSize} (printerType=${settings?.printerType}, posPrinterWidth=${settings?.posPrinterWidth}, paperSize=${settings?.paperSize})`,
                );
                const htmlPrintOptions = { pageSize: effectivePageSize };

                await window.printers.printHTML(options.data, targetPrinter, htmlPrintOptions);
                (window as any).logger.log('DEBUG: usePrinter printHTML returned');

            } else if (printerType === 'pos' && !(options.data instanceof Blob)) {
                // POS Printing logic - Only if we have structured data, not a Blob
                if (!options.data) {
                    throw new Error('Invalid data for POS printing.');
                }

                const width = settings?.posPrinterWidth || '80mm';
                const posData = generateReceiptData(options.data, width);

                await window.printers.printPOS(posData, targetPrinter, width);

            } else {
                // PDF Printing logic (works for any printer if data is Blob)
                let pdfBlob = options.data;

                if (!(pdfBlob instanceof Blob)) {
                    // if we are here and printerType IS pos, then we fell through?
                    // No, if printerType is pos and data IS blob, we are here.
                    // If printerType is NOT pos, we are here.
                    // So if data is NOT blob here, it's an error.
                    if (printerType === 'pos') {
                        throw new Error('Invalid data for POS printing. Expected object, got ' + typeof options.data);
                    }
                    throw new Error('Printing failed: PDF Blob expected for PDF Mode');
                }

                // Convert blob to base64
                const arrayBuffer = await pdfBlob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                let binaryString = '';
                for (let i = 0; i < uint8Array.length; i++) {
                    binaryString += String.fromCharCode(uint8Array[i]);
                }
                const base64 = btoa(binaryString);

                // Check print method
                const printMethod = settings.printMethod || 'native';

                if (printMethod === 'qz-tray') {
                    // QZ Tray Logic
                    await printPDFViaQZ(base64, targetPrinter);

                } else {
                    // Native (SumatraPDF) Logic - scale and first-page-only from Global Settings
                    const paperSize = resolvePageSize(settings);
                    const thermal = isThermalPageSize(paperSize);
                    const scale = options.printSettings ?? settings?.pdfPrintScale ?? (thermal ? 'fit' : 'noscale');
                    const printFirstPageOnly = settings?.printFirstPageOnly !== false;
                    console.log(
                        `[PRINT][usePrinter] PDF print resolved paperSize=${paperSize} thermal=${thermal} scale=${scale} firstPageOnly=${printFirstPageOnly} (printerType=${settings?.printerType}, posPrinterWidth=${settings?.posPrinterWidth})`,
                    );
                    await window.printers.printPDF(
                        { __isBlob: true, data: base64, type: 'application/pdf' } as any,
                        targetPrinter,
                        {
                            printSettings: scale,
                            printFirstPageOnly,
                            paperSize,
                            margins: thermal ? 'none' : undefined
                        }
                    );
                }
            }

            toast.success('Printed successfully', { id: toastId });
        } catch (error: any) {
            console.error('Print failed:', error);
            toast.error(`Print failed: ${error.message || 'Unknown error'}`, { id: toastId });
            throw error;
        } finally {
            setIsPrinting(false);
        }
    }, []);

    return {
        print,
        isPrinting
    };
};
