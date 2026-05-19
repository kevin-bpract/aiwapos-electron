import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
}

const AlertModal: React.FC<AlertModalProps> = ({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
}) => {
    const { t } = useTranslation();
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Auto-focus the OK button when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                buttonRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    // Handle Enter and Escape to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Render icon based on type
    const renderIcon = () => {
        switch (type) {
            case 'success':
                return (
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                        <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                    </div>
                );
            case 'error':
                return (
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                        <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
                        </svg>
                    </div>
                );
            case 'info':
            default:
                return (
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                        <svg className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                        </svg>
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-20 backdrop-blur-sm">
            <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-2xl transition-all">
                {/* Header Icon */}
                <div className="mb-6">
                    {renderIcon()}
                </div>

                {/* Content */}
                <div className="text-center">
                    <h3 className="text-2xl font-bold leading-6 text-gray-900 mb-4">
                        {title}
                    </h3>
                    <div className="mt-2">
                        <p className="text-base text-gray-600 whitespace-pre-wrap">
                            {message}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 flex justify-center">
                    <button
                        ref={buttonRef}
                        type="button"
                        className={`inline-flex w-full justify-center rounded-xl px-4 py-3 text-lg font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${type === 'success' ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' :
                            type === 'error' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' :
                                'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                            }`}
                        onClick={onClose}
                    >
                        {t('modals.ok')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AlertModal;
