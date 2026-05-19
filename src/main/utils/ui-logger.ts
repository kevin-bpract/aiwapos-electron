import fs from 'fs';
import path from 'path';

const LOG_FILE = 'C:\\temp\\electron-pos-ui-debug.log';

// Ensure the directory exists
const ensureLogDirectory = () => {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

// Format timestamp
const getTimestamp = () => {
    const now = new Date();
    return now.toISOString();
};

// Write to log file
const writeLog = (message: string) => {
    try {
        ensureLogDirectory();
        const logMessage = `[${getTimestamp()}] ${message}\n`;
        fs.appendFileSync(LOG_FILE, logMessage, 'utf-8');
    } catch (error) {
        console.error('Failed to write to UI log file:', error);
    }
};

// Log a UI event from the renderer
export const logUIEvent = (event: string, data?: any) => {
    let msg = `[UI] ${event}`;
    if (data !== undefined) {
        try {
            const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
            msg += ` | ${dataStr.substring(0, 2000)}`;
        } catch {
            msg += ' | [Unable to stringify data]';
        }
    }
    writeLog(msg);
};

// Clear UI log file
export const clearUILog = () => {
    try {
        if (fs.existsSync(LOG_FILE)) {
            fs.unlinkSync(LOG_FILE);
        }
        writeLog('UI Debug log file cleared and restarted');
    } catch (error) {
        console.error('Failed to clear UI log file:', error);
    }
};
