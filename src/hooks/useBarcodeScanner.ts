import { useEffect, useRef } from 'react';

interface UseBarcodeScannerProps {
    onBarcodeScanned: (barcode: string) => void;
    enabled?: boolean;
    timeThreshold?: number; // ms between keystrokes
    minChars?: number;
    /** If true, scanner events are processed even when focus is in input/textarea. */
    captureInInputs?: boolean;
}

export const useBarcodeScanner = ({
    onBarcodeScanned,
    enabled = true,
    timeThreshold = 50,
    minChars = 3,
    captureInInputs = false,
}: UseBarcodeScannerProps) => {
    const bufferRef = useRef<string>('');
    const lastKeyTimeRef = useRef<number>(0);

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            // Default: ignore input/textarea typing.
            // Supermarket barcode flow can opt in with captureInInputs=true.
            const target = event.target as HTMLElement;
            if (!captureInInputs && target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                return;
            }

            // Ignore functional keys (except Enter)
            if (event.key.length > 1 && event.key !== 'Enter') return;

            const currentTime = Date.now();
            const timeDiff = currentTime - lastKeyTimeRef.current;
            lastKeyTimeRef.current = currentTime;

            if (event.key === 'Enter') {
                if (bufferRef.current.length >= minChars) {
                    // It's a valid scan
                    const scannedBarcode = bufferRef.current;
                    bufferRef.current = '';

                    // Prevent the Enter key from triggering default behavior (like form submission)
                    // if it was part of a high-speed sequence
                    if (timeDiff < timeThreshold * 2) {
                        event.preventDefault();
                        event.stopPropagation();
                        onBarcodeScanned(scannedBarcode);
                    }
                } else {
                    bufferRef.current = '';
                }
                return;
            }

            // If it's the first character or fast enough, keep it in buffer
            if (bufferRef.current === '' || timeDiff <= timeThreshold) {
                bufferRef.current += event.key;

                // Prevent ALL characters in a fast sequence from reaching the input
                // This includes the first character if it's followed quickly by another
                if (timeDiff <= timeThreshold) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            } else {
                // Too slow, reset buffer starting with this key
                bufferRef.current = event.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown, true); // Use capture phase to intercept early
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [enabled, onBarcodeScanned, timeThreshold, minChars, captureInInputs]);
};
