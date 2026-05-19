import React, { useState } from 'react';
import LoadingSvg from '../../../components/ui/loadingsvg';

export interface ShiftClosingModalProps {
  shiftEntryName: string;
  sessionStartDate: string;
  username: string;
  onConfirm: (cashAmount: number) => Promise<void>;
  onCancel: () => void;
  isProcessing?: boolean;
  viewCurrentSession: () => void;
  isProcessingCurrentSession: boolean;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatSessionDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export default function ShiftClosingModal({
  shiftEntryName,
  sessionStartDate,
  username,
  onConfirm,
  onCancel,
  isProcessing = false,
  viewCurrentSession,
  isProcessingCurrentSession,
}: ShiftClosingModalProps) {
  const [closingCash, setClosingCash] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cashAmount = parseFloat(closingCash) || 0;

    if (cashAmount < 0) {
      setError('Amount cannot be negative.');
      return;
    }

    setError('');
    try {
      await onConfirm(cashAmount);
    } catch (err: any) {
      setError(err?.message || 'Failed to close shift.');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 italic">
          {getGreeting()} {username.toUpperCase()}
        </h2>
        <p className="mt-2 text-sm text-gray-700">
          Your Current Session Is Started On{' '}
          <span className="font-semibold">
            {formatSessionDate(sessionStartDate)}
          </span>
        </p>
        <p className="mt-1 text-xs text-gray-500">Shift: {shiftEntryName}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-2">
              Closing Cash
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="block w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:ring-blue-500 transition-colors disabled:bg-gray-100"
              placeholder="0.00"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              disabled={isProcessing}
              autoFocus
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end items-center space-x-3 pt-2">
          <div className="flex items-center space-x-2 mr-auto">
            <button
              className="px-6 py-2.5 text-sm font-medium text-white bg-orange-800 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 flex items-center"
              onClick={viewCurrentSession}
              // by defautl the button works as default type, so this will trigger the form submit, which is not what we want.
              type="button"
            >
              {isProcessingCurrentSession
                ? 'Loading...'
                : 'See Current Session'}
            </button>
          </div>
          <button
            type="button"
            disabled={isProcessing}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            onClick={() => {
              onCancel();
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isProcessing}
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 flex items-center"
          >
            {isProcessing ? (
              <>
                <LoadingSvg />
                Closing...
              </>
            ) : (
              'End Session'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
