import React, { useState, useEffect } from 'react';
import Portal from '../../portal';
import ShiftHistoryDetailsModal from './ShiftHistoryDetailsModal';

interface ShiftClosingEntry {
    name: string;
    shift_opening_entry: string;
    status: string;
    company: string;
    user: string;
    posting_date: string;
    posting_time: string;
    period_start_date: string;
    period_end_date: string;
    grand_total: number;
    net_total: number;
    total_quantity: number;
    total_invoices: number;
    payment_reconciliation?: {
        mode_of_payment: string;
        opening_amount: number;
        expected_amount: number;
        closing_amount: number;
        difference: number;
    }[];
    taxes?: {
        account_head: string;
        rate: number;
        amount: number;
    }[];
}

interface ShiftHistoryModalProps {
    onClose: () => void;
}

const ShiftHistoryModal: React.FC<ShiftHistoryModalProps> = ({ onClose }) => {
    const [loading, setLoading] = useState(false);
    const [entries, setEntries] = useState<ShiftClosingEntry[]>([]);
    const [fromDate, setFromDate] = useState<string>('');
    const [toDate, setToDate] = useState<string>('');
    const [status, setStatus] = useState<string>('');
    const [selectedEntry, setSelectedEntry] = useState<ShiftClosingEntry | null>(null);
    const [detailsLoadingFor, setDetailsLoadingFor] = useState<string | null>(null);

    const [totalCount, setTotalCount] = useState(0);

    const openDetails = async (entry: ShiftClosingEntry) => {
        setDetailsLoadingFor(entry.name);
        try {
            const detailed = await window.shift.getSessionDetails(entry.name);
            // Fall back to the list row if the details call returns nothing,
            // so the modal still opens (reconciliation/taxes sections are guarded).
            setSelectedEntry(detailed ?? entry);
        } catch (err) {
            console.error('Failed to fetch session details', err);
            setSelectedEntry(entry);
        } finally {
            setDetailsLoadingFor(null);
        }
    };

    const fetchShiftHistory = async () => {
        setLoading(true);
        try {
            const response = await window.shift.getClosingList({
                from_date: fromDate || undefined,
                to_date: toDate || undefined,
                status: status || undefined,
            });

            if (response && response.message) {
                setEntries(response.message.entries || []);
                setTotalCount(response.message.total_count || 0);
            }
        } catch (err) {
            console.error('Failed to fetch shift history', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const initDates = async () => {
            try {
                const response = await window.shift.getOpenShift();
                if (response && response.message && response.message.shift && response.message.shift.period_start_date) {
                    // Extract YYYY-MM-DD from "2026-03-01 18:50:19.142565"
                    const startDateStr = response.message.shift.period_start_date.split(' ')[0];
                    setFromDate(startDateStr);
                } else {
                    setFromDate(new Date().toISOString().split('T')[0]);
                }
            } catch (err) {
                console.error('Failed to fetch open shift', err);
                setFromDate(new Date().toISOString().split('T')[0]);
            }
            setToDate(new Date().toISOString().split('T')[0]);
        };
        initDates();
    }, []);

    useEffect(() => {
        if (fromDate && toDate) {
            fetchShiftHistory();
        }
    }, [fromDate, toDate, status]);

    return (
        <Portal onClose={onClose} modalTitle="Shift History">
            <div className="flex flex-col h-[75vh] w-[1100px] max-w-[95vw]">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-4 items-end">
                    <div className="flex flex-col gap-1 w-48">
                        <label className="text-sm font-medium text-gray-700">From Date</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex flex-col gap-1 w-48">
                        <label className="text-sm font-medium text-gray-700">To Date</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex flex-col gap-1 w-48">
                        <label className="text-sm font-medium text-gray-700">Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="px-3 py-2 bg-white border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All</option>
                            <option value="Draft">Draft</option>
                            <option value="Submitted">Submitted</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div className="ml-auto text-sm text-gray-500 pb-2">
                        Total entries: {totalCount}
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-white">
                    {loading ? (
                        <div className="flex h-full items-center justify-center text-gray-500">
                            Loading shift history...
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-gray-500">
                            No shift entries found.
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Net Total
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Invoices
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {entries.map((entry) => (
                                    <tr key={entry.name} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-100">
                                            {entry.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-r border-gray-100">
                                            {entry.posting_date} <span className="text-gray-400 text-xs ml-1">{entry.posting_time.split('.')[0]}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-r border-gray-100">
                                            {entry.user}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium border-r border-gray-100">
                                            {entry.net_total.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right border-r border-gray-100">
                                            {entry.total_invoices}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center border-r border-gray-100">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${entry.status === 'Submitted' ? 'bg-green-100 text-green-800' :
                                                entry.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                {entry.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                            <button
                                                onClick={() => openDetails(entry)}
                                                disabled={detailsLoadingFor === entry.name}
                                                className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded transition-colors disabled:opacity-50"
                                            >
                                                {detailsLoadingFor === entry.name ? 'Loading…' : 'View'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {selectedEntry && (
                <ShiftHistoryDetailsModal
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                />
            )}
        </Portal>
    );
};

export default ShiftHistoryModal;
