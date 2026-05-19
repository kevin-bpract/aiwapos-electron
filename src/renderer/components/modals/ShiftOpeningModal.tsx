import React, { useState } from 'react';

export interface ShiftOpeningModalProps {
    onConfirm: (amount?: number) => void;
    username: string;
    onCancel?: () => void;
}

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
}

export default function ShiftOpeningModal({
    onConfirm,
    username,
    onCancel,
}: ShiftOpeningModalProps) {
    const [openingAmount, setOpeningAmount] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = openingAmount.trim();
        const amount = trimmed === '' ? undefined : parseFloat(trimmed);
        if (amount !== undefined && (Number.isNaN(amount) || amount < 0)) {
            setError('Please enter a valid amount (0 or greater).');
            return;
        }
        setError('');
        setIsSubmitting(true);
        try {
            await onConfirm(amount);
        } catch (err: any) {
            setError(err?.message || 'Failed to open shift.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 space-y-5">
            {/* Greeting */}
            <div>
                <h2 className="text-xl font-bold text-gray-900 italic">
                    {getGreeting()} {username.toUpperCase()}
                </h2>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    You Don't Have Any Active Session Now, Please Start Your Session
                    Before Start Transaction
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-base font-semibold text-gray-800 mb-2">
                        Opening Cash <span className="text-gray-500 font-normal">(optional)</span>
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="block w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:ring-blue-500 transition-colors"
                        placeholder="0.00"
                        value={openingAmount}
                        onChange={(e) => setOpeningAmount(e.target.value)}
                        disabled={isSubmitting}
                        autoFocus
                    />
                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </div>

                <div className="flex justify-end items-center space-x-3 pt-2">
                    {/* Show cancel button when launched from close request or sidebar */}
                    {onCancel && (
                        <button
                            type="button"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                            onClick={() => {
                                onCancel();
                            }}
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 flex items-center"
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                                Starting...
                            </>
                        ) : (
                            'Start Session'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
