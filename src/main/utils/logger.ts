import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';

const LOG_FILE = 'C:\\temp\\electron-pos-network.log';

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
    console.error('Failed to write to log file:', error);
  }
};

// Log environment details once at startup
export const logEnvironmentDetails = () => {
  writeLog('='.repeat(80));
  writeLog('APPLICATION STARTED - ENVIRONMENT DETAILS');
  writeLog('='.repeat(80));
  writeLog(`App Version: ${app.getVersion()}`);
  writeLog(`Electron Version: ${process.versions.electron}`);
  writeLog(`Chrome Version: ${process.versions.chrome}`);
  writeLog(`Node Version: ${process.versions.node}`);
  writeLog(`Platform: ${process.platform}`);
  writeLog(`Arch: ${process.arch}`);
  writeLog(`OS: ${os.type()} ${os.release()}`);
  writeLog(`OS Platform: ${os.platform()}`);
  writeLog(`OS Arch: ${os.arch()}`);
  writeLog(`Total Memory: ${Math.round(os.totalmem() / 1024 / 1024)} MB`);
  writeLog(`Free Memory: ${Math.round(os.freemem() / 1024 / 1024)} MB`);
  writeLog(`User Data Path: ${app.getPath('userData')}`);
  writeLog(`App Path: ${app.getAppPath()}`);
  writeLog(`Is Packaged: ${app.isPackaged}`);
  writeLog(`Environment Variables:`);
  writeLog(`  - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  writeLog(`  - HTTP_PROXY: ${process.env.HTTP_PROXY || 'not set'}`);
  writeLog(`  - HTTPS_PROXY: ${process.env.HTTPS_PROXY || 'not set'}`);
  writeLog('='.repeat(80));
  writeLog('');
};

// Log HTTP request
export const logRequest = (config: {
  method?: string;
  url?: string;
  headers?: any;
  data?: any;
}) => {
  writeLog('>>> OUTGOING HTTP REQUEST >>>');
  writeLog(`Method: ${config.method?.toUpperCase() || 'UNKNOWN'}`);
  writeLog(`URL: ${config.url || 'UNKNOWN'}`);
  writeLog(`Headers: ${JSON.stringify(config.headers || {}, null, 2)}`);
  if (config.data) {
    try {
      const dataStr = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
      writeLog(`Body: ${dataStr.substring(0, 1000)}${dataStr.length > 1000 ? '... (truncated)' : ''}`);
    } catch (e) {
      writeLog(`Body: [Unable to stringify]`);
    }
  }
  writeLog('');
};

// Log HTTP response
export const logResponse = (response: {
  status?: number;
  statusText?: string;
  headers?: any;
  config?: { method?: string; url?: string };
  data?: any;
}) => {
  writeLog('<<< HTTP RESPONSE <<<');
  writeLog(`Request: ${response.config?.method?.toUpperCase()} ${response.config?.url}`);
  writeLog(`Status: ${response.status} ${response.statusText || ''}`);
  writeLog(`Headers: ${JSON.stringify(response.headers || {}, null, 2)}`);
  if (response.data) {
    try {
      if (Array.isArray(response.data) && response.data.length > 50) {
        writeLog(`Body: [Array with ${response.data.length} items]`);
      } else if (response.data?.message && Array.isArray(response.data.message) && response.data.message.length > 50) {
        writeLog(`Body: [message array with ${response.data.message.length} items]`);
      } else {
        const dataStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        writeLog(`Body: ${dataStr.substring(0, 1000)}${dataStr.length > 1000 ? '... (truncated)' : ''}`);
      }
    } catch (e) {
      writeLog(`Body: [Unable to stringify]`);
    }
  }
  writeLog('');
};

// Log HTTP error
export const logError = (error: any) => {
  writeLog('!!! HTTP REQUEST FAILED !!!');
  
  if (error.config) {
    writeLog(`Request: ${error.config.method?.toUpperCase()} ${error.config.url}`);
    writeLog(`Request Headers: ${JSON.stringify(error.config.headers || {}, null, 2)}`);
  }
  
  if (error.response) {
    writeLog(`Response Status: ${error.response.status} ${error.response.statusText || ''}`);
    writeLog(`Response Headers: ${JSON.stringify(error.response.headers || {}, null, 2)}`);
    if (error.response.data) {
      try {
        const dataStr = typeof error.response.data === 'string' 
          ? error.response.data 
          : JSON.stringify(error.response.data);
        writeLog(`Response Body: ${dataStr.substring(0, 1000)}${dataStr.length > 1000 ? '... (truncated)' : ''}`);
      } catch (e) {
        writeLog(`Response Body: [Unable to stringify]`);
      }
    }
  } else if (error.request) {
    writeLog('Error: No response received from server');
    writeLog(`Request Details: ${JSON.stringify(error.request, null, 2).substring(0, 500)}`);
  } else {
    writeLog(`Error Message: ${error.message || 'Unknown error'}`);
  }
  
  if (error.code) {
    writeLog(`Error Code: ${error.code}`);
  }
  
  if (error.stack) {
    writeLog(`Stack Trace: ${error.stack}`);
  }
  
  writeLog('');
};

// Log webRequest modification
export const logWebRequestModification = (details: {
  id: number;
  url: string;
  method: string;
  originalHeaders: Record<string, string>;
  modifiedHeaders: Record<string, string>;
}) => {
  writeLog('*** WEB REQUEST INTERCEPTED (Electron Session API) ***');
  writeLog(`Request ID: ${details.id}`);
  writeLog(`Method: ${details.method}`);
  writeLog(`URL: ${details.url}`);
  writeLog(`Original Headers: ${JSON.stringify(details.originalHeaders, null, 2)}`);
  writeLog(`Modified Headers: ${JSON.stringify(details.modifiedHeaders, null, 2)}`);
  writeLog('');
};

// Generic log function
export const log = (message: string) => {
  writeLog(message);
};

// Clear log file
export const clearLog = () => {
  try {
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
    }
    writeLog('Log file cleared and restarted');
  } catch (error) {
    console.error('Failed to clear log file:', error);
  }
};
