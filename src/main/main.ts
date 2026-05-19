/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { app, BrowserWindow, shell, ipcMain, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import {
  clearCookies,
  httpClient,
  setUnauthorizedHandler,
} from './api/http-client';
import {
  getGridPreferences,
  saveGridPreferences,
} from './repositories/gridPreferences';
import { type GridPreferences } from '../types/gridPreferences';
import { getAppConfig, saveAppConfig } from './repositories/settings';
import { initConfig, cachedBackendUrl, setBackendUrl } from './config';
import { logEnvironmentDetails, logWebRequestModification, log as logger } from './utils/logger';
import { logUIEvent, clearUILog } from './utils/ui-logger';

const execAsync = promisify(exec);

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let isQuitting = false;

// ---------------------------------------------------------------------------
// Persistent hidden BrowserWindow for HTML printing
// Reused across all printers:printHTML calls to avoid the ~200-500ms cost of
// creating a new Chromium renderer process per print.
// ---------------------------------------------------------------------------
let printWindow: BrowserWindow | null = null;
let printWindowReady = false;
// Track which printers have already had the OS driver warmed up this process,
// so renderer reloads (Ctrl+R) don't re-fire the dummy print job and emit
// a blank receipt every time.
const warmedUpPrinters = new Set<string>();

function ensurePrintWindow(): BrowserWindow {
  if (printWindow && !printWindow.isDestroyed()) return printWindow;
  printWindow = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  printWindow.on('closed', () => {
    printWindow = null;
    printWindowReady = false;
  });
  printWindowReady = true;
  return printWindow;
}

async function warmUpPrintWindow(printerName?: string): Promise<void> {
  const win = ensurePrintWindow();
  const blankHtml = '<html><head></head><body></body></html>';
  await win.loadURL(
    'data:text/html;charset=utf-8,' + encodeURIComponent(blankHtml),
  );
  if (printerName) {
    if (warmedUpPrinters.has(printerName)) {
      console.log(
        `[PRINT-TIMING-MAIN] printer "${printerName}" already warmed this session, skipping dummy print`,
      );
      return;
    }
    warmedUpPrinters.add(printerName);
    // Fire a silent dummy print to force the OS to initialise the printer driver
    await new Promise<void>((resolve) => {
      win.webContents.print(
        {
          silent: true,
          deviceName: printerName,
          printBackground: false,
          margins: { marginType: 'none' },
          pageSize: { width: 80000, height: 10000 },
        },
        () => resolve(),
      );
    });
    console.log(
      `[PRINT-TIMING-MAIN] print window pre-warmed with printer "${printerName}"`,
    );
  } else {
    console.log('[PRINT-TIMING-MAIN] print window created (no printer warm-up)');
  }
}

// Splash is created in main-bootstrap.ts (entry) so it shows before this module loads.

// TODO;
// create src/main/ipc and ipc Hnadlers there

// To bypass CORS on development
// Uses persistent cookie jar to maintain session across app reloads
ipcMain.handle('api:post', async (_, url: string, data: any, headers?: any) => {
  console.log('>>> api:post URL:', url);
  console.log('>>> api:post data:', data);
  const res = await httpClient.post(`${cachedBackendUrl}${url}`, data, {
    headers: headers || { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  console.log('ipc login response', JSON.stringify(res.data, null, 2));
  return res.data;
});

ipcMain.handle('api:get', async (_, url: string, config?: any) => {
  // For blob responses, use 'arraybuffer' instead of 'blob' in Node.js
  // axios in Node.js doesn't support 'blob' responseType the same way browsers do
  const responseType =
    config?.responseType === 'blob'
      ? 'arraybuffer'
      : config?.responseType || 'json';

  let res;
  try {
    res = await httpClient.get(`${cachedBackendUrl}${url}`, {
      ...config,
      responseType,
    });
  } catch (error: any) {
    if (error.response?.data) {
      const data = error.response.data;
      if (Buffer.isBuffer(data)) {
        console.error('API Error Response Data (String):', data.toString('utf8'));
      } else {
        console.error('API Error Response Data:', JSON.stringify(data));
      }
    }
    throw error;
  }

  // For blob responses, convert ArrayBuffer/Buffer to base64 string for IPC transfer
  // The renderer will convert it back to Blob
  if (config?.responseType === 'blob') {
    let buffer: Buffer;

    // In Node.js, axios with arraybuffer returns ArrayBuffer
    if (res.data instanceof ArrayBuffer) {
      buffer = Buffer.from(res.data);
    } else if (Buffer.isBuffer(res.data)) {
      buffer = res.data;
    } else if (typeof res.data === 'string') {
      // If somehow returned as string, try binary encoding
      buffer = Buffer.from(res.data, 'binary');
    } else {
      console.error(
        'Unexpected blob response type:',
        typeof res.data,
        'Constructor:',
        res.data?.constructor?.name,
      );
      throw new Error(`Unexpected response type for blob: ${typeof res.data}`);
    }

    // Verify it's a PDF by checking the header
    const header = buffer.slice(0, 4).toString('ascii');
    console.log(
      `PDF response - Header: "${header}", Size: ${buffer.length} bytes`,
    );

    if (header !== '%PDF') {
      console.error('Invalid PDF header in response:', header);
      console.error(
        'First 50 bytes (hex):',
        buffer.slice(0, 50).toString('hex'),
      );
      console.error(
        'First 50 bytes (ascii):',
        buffer.slice(0, 50).toString('ascii'),
      );
      throw new Error(`Invalid PDF: header is "${header}" instead of "%PDF"`);
    }

    const base64 = buffer.toString('base64');
    console.log(`Converted to base64 successfully, length: ${base64.length}`);

    return {
      __isBlob: true,
      data: base64,
      type: 'application/pdf',
    };
  }

  return res.data;
});

ipcMain.handle('gridPreferences:get', async (_, view: string) => {
  return getGridPreferences(view);
});

ipcMain.handle(
  'gridPreferences:save',
  async (_, view: string, prefs: GridPreferences) => {
    saveGridPreferences(view, prefs);
  },
);

ipcMain.handle('appConfig:save', async (_, key: string, value: string) => {
  await saveAppConfig(key, value);
  if (key === 'backendUrl') {
    setBackendUrl(value);
  }
});

ipcMain.handle('appConfig:get', (_, key: string) => {
  return getAppConfig(key);
});

ipcMain.handle('appConfig:getBackendUrl', () => {
  return cachedBackendUrl;
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// UI Debug Logger (renderer -> main -> file)
ipcMain.handle('uiLog:write', async (_, event: string, data?: any) => {
  logUIEvent(event, data);
});

ipcMain.handle('uiLog:clear', async () => {
  clearUILog();
});

ipcMain.handle('cookies:clear', async () => {
  await clearCookies();
});

// Log from renderer process
ipcMain.handle('logger:log', async (_, message: string) => {
  console.log(message); // Force print to terminal
  logger(message);
});

// Sync all data from API to local database
ipcMain.handle('data:sync', async () => {
  try {
    const { syncAllData } = require('./services/data.sync');
    await syncAllData();
    return { success: true };
  } catch (error) {
    console.error('Data sync failed:', error);
    throw error;
  }
});

// Clear all locally cached domain-specific data (products, categories, customers, payment modes, cart, cookies)
// Called on logout and when switching backend (soft reset; see deleteDBFilesAndRestart for full file wipe).
ipcMain.handle('data:clearAll', async () => {
  try {
    const { clearAllProducts } = require('./repositories/products');
    const { clearAllCustomers } = require('./repositories/customers');
    const { clearAllPaymentModes } = require('./repositories/paymentModes');
    const { clearCurrentCart } = require('./repositories/cart');
    const { clearItemGroups } = require('./repositories/itemGroups');
    const { deleteAppConfigKeys } = require('./repositories/settings');

    clearAllProducts();
    clearItemGroups();
    clearAllCustomers();
    clearAllPaymentModes();
    clearCurrentCart();
    await clearCookies();
    deleteAppConfigKeys([
      'last_sync_customers',
      'last_sync_items',
      'restaurant_category_sort_order',
      'restaurant_product_sort_order',
      'category_sort_order',
      'product_sort_order',
    ]);

    console.log('[data:clearAll] All local data cleared successfully');
    return { success: true };
  } catch (error) {
    console.error('[data:clearAll] Failed to clear local data:', error);
    throw error;
  }
});

// Delete all local database files and restart app (complete reset)
// Called on logout or backend URL change to ensure no stale data persists
ipcMain.handle('data:deleteDBFilesAndRestart', async () => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'app.db');
    const productsDbPath = path.join(app.getPath('userData'), 'products.db');
    
    console.log('[data:deleteDBFilesAndRestart] Starting database cleanup...');
    
    // Clear cookies first
    await clearCookies();
    
    // Close all DB connections
    try {
      const db = require('./db/db').default;
      const productsDb = require('./db/db-products').default;
      if (db && typeof db.close === 'function') {
        db.close();
        console.log('[data:deleteDBFilesAndRestart] Closed app.db');
      }
      if (productsDb && typeof productsDb.close === 'function') {
        productsDb.close();
        console.log('[data:deleteDBFilesAndRestart] Closed products.db');
      }
    } catch (err) {
      console.warn('[data:deleteDBFilesAndRestart] Error closing DB connections:', err);
    }

    // Delete DB files and WAL files
    const filesToDelete = [
      dbPath,
      `${dbPath}-wal`,
      `${dbPath}-shm`,
      productsDbPath,
      `${productsDbPath}-wal`,
      `${productsDbPath}-shm`,
    ];

    for (const file of filesToDelete) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`[data:deleteDBFilesAndRestart] Deleted: ${file}`);
        }
      } catch (err) {
        console.warn(`[data:deleteDBFilesAndRestart] Could not delete ${file}:`, err);
      }
    }

    console.log('[data:deleteDBFilesAndRestart] All database files deleted, restarting app...');
    
    // Restart the app to reinitialize everything
    app.relaunch();
    app.exit(0);
    
    return { success: true };
  } catch (error) {
    console.error('[data:deleteDBFilesAndRestart] Failed to delete database files:', error);
    throw error;
  }
});

// Cache for printer list
let printerListCache: string[] | null = null;
let printerListCacheTime: number = 0;
const PRINTER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get list of installed printers (Windows via PowerShell, Linux/macOS via CUPS)
ipcMain.handle('printers:get', async (_, forceRefresh: boolean = false) => {
  // Return cached list if valid and not forcing refresh
  if (
    !forceRefresh &&
    printerListCache &&
    Date.now() - printerListCacheTime < PRINTER_CACHE_DURATION
  ) {
    return printerListCache;
  }

  try {
    let printers: string[] = [];

    if (process.platform === 'win32') {
      // Windows: PowerShell
      const { stdout } = await execAsync(
        'powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"',
      );
      printers = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // Always add Virtual PDF Printer as first option on Windows
      if (!printers.includes('Virtual PDF Printer')) {
        printers.unshift('Virtual PDF Printer');
      }
    } else {
      // Linux / macOS: enumerate CUPS queues via lpstat
      const { stdout } = await execAsync('lpstat -p 2>/dev/null || true');
      printers = stdout
        .split('\n')
        .map((line) => {
          // Lines look like: "printer ThermalPrinter is idle. enabled since ..."
          const match = line.match(/^printer\s+(\S+)/);
          return match ? match[1] : null;
        })
        .filter((name): name is string => !!name);
    }

    // Update cache
    printerListCache = printers;
    printerListCacheTime = Date.now();

    return printers;
  } catch (error) {
    console.error('Error getting printers:', error);
    return [];
  }
});

// Generate PDF from HTML using Electron's printToPDF
ipcMain.handle('pdf:generateFromHTML', async (_, html: string, options?: any) => {
  return new Promise((resolve, reject) => {
    // Create a hidden browser window with proper size
    const win = new BrowserWindow({
      show: false,
      width: 400, // Minimum width to ensure content renders
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Safety: auto-destroy after 30s to prevent leaked windows
    const safetyTimer = setTimeout(() => {
      console.warn('pdf:generateFromHTML safety timeout — destroying leaked window');
      if (!win.isDestroyed()) win.destroy();
      reject(new Error('PDF generation timed out after 30s'));
    }, 30000);

    const cleanup = () => {
      clearTimeout(safetyTimer);
      if (!win.isDestroyed()) win.close();
    };

    // Load HTML content
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    console.log('Loading HTML for PDF generation, length:', html.length);
    win.loadURL(dataUrl);

    win.webContents.once('did-finish-load', () => {
      console.log('HTML loaded, waiting for render...');
      // Wait a bit for content to render
      setTimeout(() => {
        console.log('Generating PDF...');

        // Prepare PDF options
        const pdfOptions: any = {
          margins: {
            top: 0.1,
            bottom: 0.1,
            left: 0.1,
            right: 0.1,
          },
          printBackground: true,
        };

        // Apply page size if provided
        if (options?.pageSize) {
          pdfOptions.pageSize = options.pageSize;
        }

        // Apply margins if provided
        if (options?.margins) {
          pdfOptions.margins = options.margins;
        }

        // Generate PDF - let content determine size naturally
        win.webContents
          .printToPDF(pdfOptions)
          .then((data) => {
            // Convert Buffer to base64
            const base64 = data.toString('base64');
            cleanup();
            resolve({
              __isBlob: true,
              data: base64,
              type: 'application/pdf',
            });
          })
          .catch((error) => {
            cleanup();
            reject(error);
          });
      }, 500); // Wait 500ms for content to render
    });

    win.webContents.once('did-fail-load', (_, errorCode, errorDescription) => {
      cleanup();
      reject(new Error(`Failed to load HTML: ${errorDescription}`));
    });
  });
});

// Helper to get SumatraPDF path
const getSumatraPath = () => {
  const { app } = require('electron');
  const path = require('path');

  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true') {
    return path.join(__dirname, '../../assets/SumatraPDF.exe');
  }
  return path.join(process.resourcesPath, 'assets', 'SumatraPDF.exe');
};

// Print PDF (Physical or Virtual)
ipcMain.handle(
  'printers:printPDF',
  async (_, pdfBlobData: { data: string; type: string }, printerName?: string, options?: any) => {
    const tHandler = Date.now();
    try {
      console.log('DEBUG: printers:printPDF called');
      console.log('DEBUG: Printer Name:', printerName);
      console.log('DEBUG: Options:', JSON.stringify(options));
      console.log('DEBUG: Blob Data Length:', pdfBlobData?.data?.length);
      console.log(`[PRINT-TIMING-MAIN] handler enter t=0ms`);

      const { app, dialog, BrowserWindow } = require('electron');
      const path = require('path');
      const fs = require('fs').promises;
      const { spawn } = require('child_process');

      if (!pdfBlobData || !pdfBlobData.data) {
        throw new Error('Invalid PDF data received');
      }

      // Handle Virtual PDF Printer - save to Downloads
      if (printerName === 'Virtual PDF Printer') {
        const downloadsPath = app.getPath('downloads');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `print-${timestamp}.pdf`;
        const filepath = path.join(downloadsPath, filename);

        const tDecode = Date.now();
        const buffer = Buffer.from(pdfBlobData.data, 'base64');
        console.log(`[PRINT-TIMING-MAIN] virtual: base64 decode = ${Date.now() - tDecode}ms (bytes=${buffer.length})`);
        const tWrite = Date.now();
        await fs.writeFile(filepath, buffer);
        console.log(`[PRINT-TIMING-MAIN] virtual: file write = ${Date.now() - tWrite}ms`);

        console.log(`Virtual printer: PDF saved to ${filepath}`);

        const tDialog = Date.now();
        dialog.showMessageBox({
          type: 'info',
          title: 'PDF Saved',
          message: 'Virtual Printer',
          detail: `PDF saved to Downloads folder:\n${filename}`,
          buttons: ['OK']
        });
        console.log(`[PRINT-TIMING-MAIN] virtual: dialog.showMessageBox (non-blocking) = ${Date.now() - tDialog}ms`);

        console.log(`[PRINT-TIMING-MAIN] virtual: handler TOTAL = ${Date.now() - tHandler}ms`);
        return { success: true, filepath };
      }

      // Create temp file for Physical Printer
      const tDecode = Date.now();
      const buffer = Buffer.from(pdfBlobData.data, 'base64');
      console.log(`[PRINT-TIMING-MAIN] base64 decode = ${Date.now() - tDecode}ms (bytes=${buffer.length})`);

      const tempDir = app.getPath('temp');
      const tempFileName = `print-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.pdf`;
      const tempFilePath = path.join(tempDir, tempFileName);

      const tWrite = Date.now();
      await fs.writeFile(tempFilePath, buffer);
      console.log(`[PRINT-TIMING-MAIN] temp file write = ${Date.now() - tWrite}ms`);
      console.log(`Created temp print file: ${tempFilePath}`);

      // Attempt Primary Print (SumatraPDF)
      try {
        const sumatraPath = getSumatraPath();
        console.log(`Attempting to print using SumatraPDF at: ${sumatraPath}`);
        const tSumatra = Date.now();

        const args = ['-print-to', printerName || 'default'];

        // Scale from Global Settings (fit = default for thermal, noscale otherwise).
        // Optionally first page only (from settings).
        const isThermalSize =
          options?.paperSize === '80mm' || options?.paperSize === '58mm';
        const scale =
          options?.printSettings || (isThermalSize ? 'fit' : 'noscale');
        const firstPageOnly = options?.printFirstPageOnly === true;
        const printSettings = firstPageOnly ? `1,${scale}` : scale;
        console.log(
          `[PRINT-TIMING-MAIN] SumatraPDF args: paperSize=${options?.paperSize} thermal=${isThermalSize} scale=${scale} firstPageOnly=${firstPageOnly} -> -print-settings ${printSettings}`,
        );
        args.push('-print-settings', printSettings);

        args.push('-silent');
        args.push(tempFilePath);

        if (!printerName) {
          args[0] = '-print-to-default';
          args.splice(1, 1);
        }

        await new Promise<void>((resolve, reject) => {
          const child = spawn(sumatraPath, args);

          child.on('error', (err: any) => {
            console.error('SumatraPDF spawn error:', err);
            reject(err);
          });

          child.on('close', (code: number) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`SumatraPDF exited with code ${code}`));
            }
          });
        });

        console.log(`[PRINT-TIMING-MAIN] SumatraPDF spawn->exit = ${Date.now() - tSumatra}ms`);
        console.log('SumatraPDF print successful');

        // Cleanup
        try { await fs.unlink(tempFilePath); } catch (e) { /* ignore */ }

        console.log(`[PRINT-TIMING-MAIN] handler TOTAL = ${Date.now() - tHandler}ms`);
        return { success: true };

      } catch (sumatraError: any) {
        console.warn('SumatraPDF failed, attempting fallback to Electron native print:', sumatraError);
        console.warn('Fallback error details:', sumatraError.message);

        // Fallback: Native Electron Printing
        let fallbackWin: BrowserWindow | null = null;
        try {
          fallbackWin = new BrowserWindow({
            show: false,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true
            }
          });

          await fallbackWin.loadURL(`data:application/pdf;base64,${pdfBlobData.data}`);

          // Use paper size and margins from Global Settings so thermal prints as one part (not 3)
          const paperSize = options?.paperSize || 'A4';
          const margins =
            options?.margins === 'none'
              ? { marginType: 'none' as const }
              : undefined;
          const printOpts: Electron.WebContentsPrintOptions = {
            silent: true,
            deviceName: printerName || '',
            printBackground: true,
          };
          if (paperSize === '80mm') {
            printOpts.pageSize = { width: 80000, height: 200000 }; // 80mm × 200mm
            printOpts.margins = { marginType: 'none' };
          } else if (paperSize === '58mm') {
            printOpts.pageSize = { width: 58000, height: 200000 }; // 58mm × 200mm
            printOpts.margins = { marginType: 'none' };
          } else if (margins) {
            printOpts.margins = margins;
          }
          console.log(
            `[PRINT-TIMING-MAIN] Electron fallback print opts:`,
            JSON.stringify(printOpts),
          );

          return await new Promise<{ success: boolean }>((resolve) => {
            fallbackWin!.webContents.print(printOpts, (success, errorType) => {
              if (!success) console.error('Native print fallback failed:', errorType);
              resolve({ success });
              setTimeout(() => {
                if (fallbackWin && !fallbackWin.isDestroyed()) fallbackWin.close();
              }, 500);
            });
          });
        } catch (fbError) {
          console.error('Fallback failed:', fbError);
          return { success: false };
        } finally {
          // Safety: ensure fallback window is always destroyed
          setTimeout(() => {
            if (fallbackWin && !fallbackWin.isDestroyed()) {
              console.warn('printers:printPDF fallback window still alive — destroying');
              fallbackWin.destroy();
            }
          }, 10000);
        }
      }

    } catch (error) {
      console.error('Error printing PDF:', error);
      throw error;
    }
  }
);

// Valid HTML Printing Handler — reuses persistent printWindow
ipcMain.handle('printers:printHTML', async (_event, html: string, printerName?: string, options?: any) => {
  const tHandler = Date.now();
  console.log(`Printing HTML to: ${printerName || 'Default'}`);
  console.log(`HTML Print Options:`, JSON.stringify(options));

  try {
    const tWin = Date.now();
    const win = ensurePrintWindow();
    console.log(`[PRINT-TIMING-MAIN] ensurePrintWindow = ${Date.now() - tWin}ms (reused=${printWindowReady})`);

    // Determine Page Size (microns). Map thermal widths to a short page so a
    // short receipt doesn't get padded to A4 length and split into multiple
    // blank pages by the OS driver.
    let pageSize: string | { width: number; height: number } = 'A4';
    let isThermal = false;
    if (options?.pageSize === '80mm') {
      pageSize = { width: 80000, height: 200000 }; // 80mm × 200mm
      isThermal = true;
    } else if (options?.pageSize === '58mm') {
      pageSize = { width: 58000, height: 200000 }; // 58mm × 200mm
      isThermal = true;
    } else if (options?.pageSize) {
      pageSize = options.pageSize;
    }

    // Resize the print window viewport BEFORE loadURL so Chromium does its
    // initial layout at the correct paper width. Without this, content laid
    // out at 800px gets clipped/misaligned on narrow 80mm paper (~302px).
    const viewportWidth =
      typeof pageSize === 'object'
        ? Math.round((pageSize.width / 25400) * 96) // microns → px at 96 DPI
        : 794; // A4 at 96 DPI ≈ 794px
    win.setSize(viewportWidth, 1200);

    // Load HTML into the existing window
    const tLoad = Date.now();
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    console.log(`[PRINT-TIMING-MAIN] loadURL = ${Date.now() - tLoad}ms`);

    // Print
    const tPrint = Date.now();
    const result = await new Promise<{ success: boolean }>((resolve) => {
      win.webContents.print({
        silent: true,
        deviceName: printerName || '',
        printBackground: true,
        margins: isThermal
          ? { marginType: 'none' }
          : { marginType: 'printableArea' },
        pageSize: pageSize as any
      }, (success, errorType) => {
        if (!success) {
          console.error('HTML Print failed:', errorType);
          resolve({ success: false });
        } else {
          console.log('HTML Print success');
          resolve({ success: true });
        }
      });
    });
    console.log(`[PRINT-TIMING-MAIN] webContents.print = ${Date.now() - tPrint}ms`);
    console.log(`[PRINT-TIMING-MAIN] printHTML handler TOTAL = ${Date.now() - tHandler}ms`);
    return result;
  } catch (err) {
    console.error('printers:printHTML error:', err);
    // If the window got into a bad state, destroy it so the next call gets a fresh one
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.destroy();
      printWindow = null;
      printWindowReady = false;
    }
    return { success: false };
  }
});

// Warm up the persistent print window + OS printer driver on demand.
// The renderer calls this after loading printer settings so first real print is fast.
ipcMain.handle('printers:warmup', async (_, printerName?: string) => {
  try {
    await warmUpPrintWindow(printerName || undefined);
    return { success: true };
  } catch (e: any) {
    console.warn('printers:warmup failed:', e.message);
    return { success: false };
  }
});

// Print using electron-pos-printer
ipcMain.handle(
  'printers:printPOS',
  async (_, data: any[], printerName: string, width: string = '80mm') => {
    try {
      const { PosPrinter } = require('electron-pos-printer');
      const { BrowserWindow } = require('electron');

      console.log(`Printing POS to ${printerName} (${width})`);

      const options = {
        preview: false,
        width,
        margin: '0 0 0 0',
        copies: 1,
        printerName,
        timeOutPerLine: 400,
        silent: true,
      };

      // Get the main window for rendering
      const window = BrowserWindow.getAllWindows()[0];

      return new Promise((resolve, reject) => {
        PosPrinter.print(data, options)
          .then(() => resolve({ success: true }))
          .catch((error: any) => {
            console.error('POS Print error:', error);
            reject(error);
          });
      });
    } catch (error) {
      console.error('Error in printPOS:', error);
      throw error;
    }
  },
);

// Product repository IPC handlers
ipcMain.handle('products:get', async (_, itemCode: string) => {
  const { getProduct } = require('./repositories/products');
  return getProduct(itemCode);
});

ipcMain.handle('products:getAll', async () => {
  const { getAllProductsList } = require('./repositories/products');
  return getAllProductsList();
});

ipcMain.handle(
  'products:search',
  async (_, query: string, limit: number = 100) => {
    const { searchProducts } = require('./repositories/products');
    return searchProducts(query, limit);
  },
);

ipcMain.handle('products:getByBarcode', async (_, barcode: string) => {
  const { getProductByBarcode } = require('./repositories/products');
  return getProductByBarcode(barcode);
});

ipcMain.handle(
  'products:updateFavorite',
  async (_, itemCode: string, isFavorite: number) => {
    const { updateItemFavorite } = require('./api/favorites');
    const { getProduct, saveProduct } = require('./repositories/products');

    try {
      // Update via API
      await updateItemFavorite(itemCode, isFavorite);

      // Update local database
      const product = getProduct(itemCode);
      if (product) {
        product.custom_is_favorite = isFavorite;
        saveProduct(product);
      }

      return { success: true };
    } catch (error) {
      log.error('Error updating favorite:', error);
      throw error;
    }
  },
);

// Customer repository IPC handlers
ipcMain.handle('customers:getAll', async () => {
  const { getCustomerList } = require('./repositories/customers');
  return getCustomerList();
});

ipcMain.handle('customers:save', async (_, customer: import('../types/customer').Customer) => {
  const { saveCustomer } = require('./repositories/customers');
  saveCustomer(customer);
});

// Sales history repository IPC handlers
ipcMain.handle('salesHistory:getAll', async () => {
  const { getSalesHistoryList } = require('./repositories/salesHistory');
  return getSalesHistoryList();
});

// Shift closing IPC handlers
ipcMain.handle('shift:getClosingList', async (_, params: any) => {
  const { getClosingList } = require('./api/shift');
  return getClosingList(params);
});

ipcMain.handle('shift:getOpenShift', async () => {
  const { getOpenShift } = require('./api/shift');
  return getOpenShift();
});

ipcMain.handle('shift:getSessionDetails', async (_, name: string) => {
  const { getSessionDetails } = require('./api/shift');
  return getSessionDetails(name);
});

// POS Settings repository IPC handlers
ipcMain.handle('posSettings:get', async () => {
  const { getPOSSettings } = require('./repositories/settings');
  return getPOSSettings();
});

// Category sort order IPC handlers
ipcMain.handle('categorySortOrder:get', async () => {
  const { getCategorySortOrder } = require('./repositories/settings');
  return getCategorySortOrder();
});

ipcMain.handle('categorySortOrder:save', async (_, categoryIds: string[]) => {
  const { saveCategorySortOrder } = require('./repositories/settings');
  return saveCategorySortOrder(categoryIds);
});

// Product sort order IPC handlers (restaurant dashboard)
ipcMain.handle('productSortOrder:get', async () => {
  const { getProductSortOrder } = require('./repositories/settings');
  return getProductSortOrder();
});

ipcMain.handle('productSortOrder:save', async (_, itemCodes: string[]) => {
  const { saveProductSortOrder } = require('./repositories/settings');
  return saveProductSortOrder(itemCodes);
});

// Printer settings IPC handlers
ipcMain.handle('printerSettings:get', async () => {
  const { getPrinterSettings } = require('./repositories/settings');
  return getPrinterSettings();
});

ipcMain.handle('printerSettings:save', async (_, settings: { printer?: string }) => {
  const { savePrinterSettings } = require('./repositories/settings');
  return savePrinterSettings(settings);
});

ipcMain.handle('onScreenKeyboardLayout:get', async () => {
  const { getOnScreenKeyboardLayoutSnapshot } = require('./repositories/settings');
  return getOnScreenKeyboardLayoutSnapshot();
});

ipcMain.handle(
  'onScreenKeyboardLayout:save',
  async (
    _,
    mode: 'login' | 'restaurant',
    state: { x?: number; y?: number; w?: number; h?: number; scale?: number; lang?: string },
  ) => {
    const { saveOnScreenKeyboardLayoutForMode } = require('./repositories/settings');
    saveOnScreenKeyboardLayoutForMode(mode, {
      ...state,
      lang: state.lang === 'ar' || state.lang === 'en' ? state.lang : undefined,
    });
  },
);

ipcMain.handle('itemGroups:getAll', async () => {
  const { getItemGroupsList } = require('./repositories/itemGroups');
  return getItemGroupsList();
});

ipcMain.handle('uoms:getAll', async () => {
  try {
    const { httpClient } = require('./api/http-client');
    const response = await httpClient.get(
      `${cachedBackendUrl}/api/method/pos_api.api.get_uom_list`,
      { withCredentials: true },
    );
    return response.data.message.uoms || [];
  } catch (error) {
    console.error('Error fetching UOMs:', error);
    return [];
  }
});

// Cart repository IPC handlers
ipcMain.handle('cart:save', async (_, cart: any) => {
  const { saveCart } = require('./repositories/cart');
  return saveCart(cart);
});

ipcMain.handle('cart:get', async (_, cartId: number) => {
  const { getCart } = require('./repositories/cart');
  return getCart(cartId);
});

ipcMain.handle('cart:getCurrent', async () => {
  const { getCurrentCart } = require('./repositories/cart');
  return getCurrentCart();
});

ipcMain.handle('cart:delete', async (_, cartId: number) => {
  const { deleteCart } = require('./repositories/cart');
  return deleteCart(cartId);
});

ipcMain.handle('cart:deleteItem', async (_, cartId: number, itemId: string) => {
  const { deleteCartItem } = require('./repositories/cart');
  return deleteCartItem(cartId, itemId);
});

ipcMain.handle('cart:clear', async () => {
  const { clearCurrentCart } = require('./repositories/cart');
  return clearCurrentCart();
});

// Invoice IPC handlers
ipcMain.handle('invoice:create', async (_, customer: string, items: any[]) => {
  const form = new URLSearchParams();
  form.append('customer', customer);
  form.append('items', JSON.stringify(items));

  const res = await httpClient.post(
    `${cachedBackendUrl}api/method/pos_api.api.create_sales_invoice`,
    form.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );

  console.log('Invoice creation response:', JSON.stringify(res.data, null, 2));
  return res.data;
});

ipcMain.handle('invoice:createPOS', async (_, payload: any) => {
  const form = new URLSearchParams();

  // Add all fields to the form
  Object.keys(payload).forEach((key) => {
    const value = payload[key];
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        form.append(key, JSON.stringify(value));
      } else {
        form.append(key, String(value));
      }
    }
  });

  const url = `${cachedBackendUrl}api/method/pos_api.api.create_sales_invoice`;
  const body = form.toString();
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  // Log full request for comparison with Postman (Cookie is added by httpClient interceptor)
  console.log('[POS Invoice] ========== REQUEST ==========');
  console.log('[POS Invoice] URL:', url);
  console.log('[POS Invoice] Method: POST');
  console.log('[POS Invoice] Headers (app-set):', JSON.stringify(headers, null, 2));
  console.log('[POS Invoice] Headers note: Cookie is added by httpClient from session.');
  console.log('[POS Invoice] Body (raw payload object):', JSON.stringify(payload, null, 2));
  console.log('[POS Invoice] Body (x-www-form-urlencoded string):', body);
  // Parsed body for easy copy to Postman
  const parsed: Record<string, string> = {};
  form.forEach((value, key) => {
    parsed[key] = value;
  });
  console.log('[POS Invoice] Body (parsed key-value):', JSON.stringify(parsed, null, 2));
  console.log('[POS Invoice] ======================================');

  const res = await httpClient.post(url, body, { headers });

  console.log(
    '[POS Invoice] ========== RESPONSE ==========',
  );
  console.log(
    '[POS Invoice] Status:',
    res.status,
    res.statusText,
  );
  console.log(
    '[POS Invoice] Response data:',
    JSON.stringify(res.data, null, 2),
  );
  console.log('[POS Invoice] ======================================');
  return res.data;
});

ipcMain.handle('invoice:getModeOfPayments', async () => {
  const { getAllPaymentModes, getDefaultPaymentMode } = require('./repositories/paymentModes');
  const paymentModes = getAllPaymentModes();
  const defaultMode = getDefaultPaymentMode();

  // Return in the same format as the API (including user_mode_of_payment)
  return {
    message: {
      payment_modes: paymentModes,
      user_mode_of_payment: defaultMode,
    },
  };
});

ipcMain.handle('invoice:submitInvoice', async (_, invoiceName: string) => {
  const form = new URLSearchParams();
  form.append('invoice_name', invoiceName);

  const res = await httpClient.post(
    `${cachedBackendUrl}api/method/pos_api.api.submit_sales_invoice`,
    form.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );

  console.log('Invoice submit response:', JSON.stringify(res.data, null, 2));
  return res.data;
});

// Prevent auto-scaling on different DPI displays
// app.commandLine.appendSwitch('high-dpi-support', '1');
// app.commandLine.appendSwitch('force-device-scale-factor', '1');

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

// toggle developer tools on startup , kinda annoying btw
// if (isDebug) {
// require('electron-debug').default();
// }

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    /// application will be opendd in fullscreen mode
    fullscreen: false,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      // Enable session persistence for cookies
      partition: 'persist:main',
    },
  });

  setUnauthorizedHandler(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:session-expired');
    }
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  // show logs on production
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    // Close splash before showing main window
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }

    // Pre-create the hidden print BrowserWindow so the first print is fast.
    // Printer name isn't known yet (loaded later by renderer via printerSettings),
    // so we just create the window without a dummy print for now.
    warmUpPrintWindow().catch((e) =>
      console.warn('Print window warm-up failed:', e),
    );
  });

  mainWindow.on('closed', () => {
    setUnauthorizedHandler(null);
    mainWindow = null;
  });



  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

// Quit when all windows are closed (prevents zombie processes from leaked hidden print windows)
app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
});

ipcMain.on('app-quit', () => {
  console.log('MAIN_PROCESS: Received app-quit signal from renderer. Setting isQuitting to true and calling app.quit().');
  isQuitting = true;
  app.quit();
});

/**
 * Called from main-bootstrap after splash is shown. Runs init, sync, then creates main window.
 */
export async function boot(splash: BrowserWindow): Promise<void> {
  splashWindow = splash;
  const updateSplash = (msg: string) => {
    try {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.executeJavaScript(
          `document.getElementById('t') && (document.getElementById('t').textContent = ${JSON.stringify(msg)})`,
        ).catch(() => {});
      }
    } catch {}
  };

  logEnvironmentDetails();
  logger('Application initialized');

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const originalHeaders = { ...details.requestHeaders };
    delete details.requestHeaders.Expect;
    delete details.requestHeaders.expect;
    if (details.requestHeaders['Accept-Encoding']) {
      details.requestHeaders['Accept-Encoding'] = 'gzip, deflate';
    }
    logWebRequestModification({
      id: details.id,
      url: details.url,
      method: details.method,
      originalHeaders,
      modifiedHeaders: details.requestHeaders,
    });
    callback({ requestHeaders: details.requestHeaders });
  });

  logger('WebRequest handler configured');

  updateSplash('Initializing…');
  await initConfig();

  updateSplash('Syncing data…');
  const SYNC_BOOT_TIMEOUT_MS = 90_000;
  try {
    const { syncAllData } = require('./services/data.sync');
    await Promise.race([
      syncAllData(),
      new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                `Startup sync timed out after ${SYNC_BOOT_TIMEOUT_MS / 1000}s — opening app with local data`,
              ),
            ),
          SYNC_BOOT_TIMEOUT_MS,
        );
      }),
    ]);
    console.log('✅ Data sync completed successfully');
    logger('✅ Data sync completed successfully');
  } catch (error) {
    console.error('❌ Data sync failed or timed out:', error);
    logger(`❌ Data sync failed or timed out: ${error}`);
    updateSplash('Offline / sync issue — opening app…');
    await new Promise((r) => setTimeout(r, 800));
  }

  updateSplash('Loading…');
  createWindow();
}
