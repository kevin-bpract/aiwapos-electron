import qz from 'qz-tray';
import { sha256 } from 'js-sha256';

// Initialize QZ Tray interface
// SHA256 Hashing for QZ Tray usually needed for signing, but for basic usage we might bypass if no certificate.
// However, qz-tray usually needs a way to hash messages.
qz.api.setSha256Type((data: any) => sha256(data));

// Promise wrapper for connection state
let isConnected = false;

export const connectToQZ = async () => {
    if (qz.websocket.isActive()) {
        return;
    }
    try {
        await qz.websocket.connect();
        isConnected = true;
        console.log("Connected to QZ Tray");
    } catch (err) {
        console.error("QZ Tray Connection Error:", err);
        isConnected = false;
        throw new Error("Could not connect to QZ Tray. Make sure it is installed and running.");
    }
};

export const disconnectQZ = async () => {
    if (qz.websocket.isActive()) {
        await qz.websocket.disconnect();
        isConnected = false;
    }
};

export const getQZPrinters = async (): Promise<string[]> => {
    await connectToQZ();
    return qz.printers.find();
};

export const printPDFViaQZ = async (
    base64Data: string,
    printerName: string,
    options?: { scaleContent?: boolean }
) => {
    await connectToQZ();

    const config = qz.configs.create(printerName, {
        scaleContent: options?.scaleContent ?? true, // Default to true to fit page?
        // size: { width: 80, height: ... } // QZ usually handles PDF scaling automatically if scaleContent is true
    });

    const data = [
        {
            type: 'pdf',
            format: 'base64',
            data: base64Data,
        }
    ];

    await qz.print(config, data);
};
