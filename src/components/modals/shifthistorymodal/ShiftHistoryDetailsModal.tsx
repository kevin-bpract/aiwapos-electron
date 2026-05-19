import React from 'react';
import Portal from '../../portal';
import { usePrinter } from '../../../hooks/usePrinter';

interface ShiftHistoryDetailsModalProps {
    entry: any; // We'll pass the whole ShiftClosingEntry
    onClose: () => void;
}

const ShiftHistoryDetailsModal: React.FC<ShiftHistoryDetailsModalProps> = ({ entry, onClose }) => {
    const { print, isPrinting } = usePrinter();

    const handlePrint = async () => {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: monospace;
                        font-size: 12px;
                        color: #000;
                        margin: 0;
                        padding: 10px;
                        width: 100%;
                        max-width: 300px;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    .center { text-align: center; }
                    .right { text-align: right; }
                    .left { text-align: left; }
                    .bold { font-weight: bold; }
                    .header h2 { margin: 0; font-size: 18px; }
                    .header p { margin: 2px 0; font-size: 12px; }
                    .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
                    .solid-divider { border-bottom: 1px solid #000; margin: 8px 0; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
                    td { padding: 2px 0; font-size: 12px; vertical-align: top; }
                    .flex-row { display: flex; justify-content: space-between; }
                    .margin-bottom { margin-bottom: 5px; }
                </style>
            </head>
            <body>
                <div class="header center margin-bottom">
                    <h2>${entry.company}</h2>
                    <p class="bold">Shift Report</p>
                    <p>${entry.name}</p>
                    <p>Status: ${entry.status}</p>
                </div>
                
                <div class="divider"></div>
                
                <table class="margin-bottom">
                    <tr><td class="left">User:</td><td class="right">${entry.user}</td></tr>
                    ${entry.sales_person ? `<tr><td class="left">Sales Person:</td><td class="right">${entry.sales_person}</td></tr>` : ''}
                    <tr><td class="left">Opened:</td><td class="right">${entry.period_start_date?.split('.')[0] || 'N/A'}</td></tr>
                    <tr><td class="left">Closed:</td><td class="right">${entry.period_end_date?.split('.')[0] || 'N/A'}</td></tr>
                    <tr><td class="left">Invoices:</td><td class="right">${entry.total_invoices}</td></tr>
                    <tr><td class="left">Quantity:</td><td class="right">${entry.total_quantity}</td></tr>
                </table>
                
                <div class="divider"></div>
                
                <h3 style="margin:5px 0; font-size:14px;">Financials</h3>
                <table class="margin-bottom">
                    <tr><td class="left">Net Total:</td><td class="right">${Number(entry.net_total).toFixed(2)}</td></tr>
                    <tr><td class="left bold">Grand Total:</td><td class="right bold">${Number(entry.grand_total).toFixed(2)}</td></tr>
                </table>
                
                ${entry.taxes && entry.taxes.length > 0 ? `
                    <div class="divider"></div>
                    <h3 style="margin:5px 0; font-size:14px;">Taxes</h3>
                    <table class="margin-bottom">
                        ${entry.taxes.map((t: any) => `
                            <tr><td class="left">${t.account_head} (${t.rate}%)</td><td class="right">${Number(t.amount).toFixed(2)}</td></tr>
                        `).join('')}
                    </table>
                ` : ''}
                
                ${entry.payment_reconciliation && entry.payment_reconciliation.length > 0 ? `
                    <div class="divider"></div>
                    <h3 style="margin:5px 0; font-size:14px;">Payment Reconciliation</h3>
                    ${entry.payment_reconciliation.map((p: any) => `
                        <div style="margin-bottom: 8px;">
                            <div class="bold" style="text-decoration: underline; margin-bottom: 2px;">${p.mode_of_payment}</div>
                            <table>
                                <tr><td class="left">Opening:</td><td class="right">${Number(p.opening_amount).toFixed(2)}</td></tr>
                                <tr><td class="left">Expected:</td><td class="right">${Number(p.expected_amount).toFixed(2)}</td></tr>
                                <tr><td class="left">Closing:</td><td class="right">${Number(p.closing_amount).toFixed(2)}</td></tr>
                                <tr><td class="left bold">Diff:</td><td class="right bold">${Number(p.difference).toFixed(2)}</td></tr>
                            </table>
                        </div>
                    `).join('')}
                ` : ''}
                
                <div class="divider"></div>
                <div class="center" style="margin-top:10px;">
                    <p>End of Report</p>
                </div>
            </body>
            </html>
        `;

        try {
            await print({
                type: 'html',
                data: html
            });
        } catch (error) {
            console.error('Failed to print shift report:', error);
        }
    };

    return (
        <Portal onClose={onClose} modalTitle={`Shift Details: ${entry.name}`}>
            <div className="flex flex-col h-[70vh] w-[600px] max-w-[95vw] bg-white">
                <div className="flex-1 p-6 overflow-y-auto print-content-wrapper hidden-scrollbar">
                    {/* Header Information */}
                    <div className="text-center mb-6">
                        <h2 className="text-xl font-bold font-mono">{entry.company}</h2>
                        <p className="text-sm text-gray-500 font-mono mt-1">Shift Closing: {entry.name}</p>
                        <p className="text-sm text-gray-500 font-mono">Status: {entry.status}</p>
                    </div>

                    <div className="border-t border-b border-gray-200 py-4 mb-6 space-y-2 font-mono text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">User:</span>
                            <span className="font-medium text-gray-900">{entry.user}</span>
                        </div>
                        {entry.sales_person && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Sales Person:</span>
                                <span className="font-medium text-gray-900">{entry.sales_person}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-gray-600">Opened:</span>
                            <span className="font-medium text-gray-900">{entry.period_start_date?.split('.')[0]}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Closed:</span>
                            <span className="font-medium text-gray-900">{entry.period_end_date?.split('.')[0] || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Total Invoices:</span>
                            <span className="font-medium text-gray-900">{entry.total_invoices}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Total Quantity:</span>
                            <span className="font-medium text-gray-900">{entry.total_quantity}</span>
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="mb-6 font-mono">
                        <h3 className="text-lg font-bold border-b border-gray-200 pb-2 mb-3">Financials</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Net Total:</span>
                                <span className="font-medium text-gray-900">{Number(entry.net_total).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100">
                                <span>Grand Total:</span>
                                <span>{Number(entry.grand_total).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Taxes */}
                    {entry.taxes && entry.taxes.length > 0 && (
                        <div className="mb-6 font-mono">
                            <h3 className="text-lg font-bold border-b border-gray-200 pb-2 mb-3">Taxes</h3>
                            <div className="space-y-2 text-sm">
                                {entry.taxes.map((tax: any, idx: number) => (
                                    <div key={idx} className="flex justify-between">
                                        <span className="text-gray-600 truncate mr-4">{tax.account_head} ({tax.rate}%)</span>
                                        <span className="font-medium text-gray-900 whitespace-nowrap">{Number(tax.amount).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Payment Reconciliation */}
                    {entry.payment_reconciliation && entry.payment_reconciliation.length > 0 && (
                        <div className="font-mono">
                            <h3 className="text-lg font-bold border-b border-gray-200 pb-2 mb-3">Payment Reconciliation</h3>
                            <div className="space-y-4 text-sm">
                                {entry.payment_reconciliation.map((payment: any, idx: number) => (
                                    <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="font-bold mb-2 text-gray-800">{payment.mode_of_payment}</div>
                                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 pl-2 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Opening:</span>
                                                <span className="font-medium">{Number(payment.opening_amount).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Expected:</span>
                                                <span className="font-medium">{Number(payment.expected_amount).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Closing:</span>
                                                <span className="font-medium">{Number(payment.closing_amount).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between font-bold">
                                                <span className={payment.difference < 0 ? 'text-red-500' : payment.difference > 0 ? 'text-green-600' : 'text-gray-500'}>Diff:</span>
                                                <span className={payment.difference < 0 ? 'text-red-600' : payment.difference > 0 ? 'text-green-600' : 'text-gray-900'}>
                                                    {Number(payment.difference).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end shrink-0">
                <button
                    type="button"
                    onClick={handlePrint}
                    disabled={isPrinting}
                    className={`mr-3 px-6 py-2 rounded-xl text-gray-800 font-semibold shadow-sm transition ${isPrinting ? 'bg-gray-300 opacity-70 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                >
                    {isPrinting ? 'Printing...' : 'Print'}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 transition"
                >
                    Close
                </button>
            </div>
        </Portal>
    );
};

export default ShiftHistoryDetailsModal;
