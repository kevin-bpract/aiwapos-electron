// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { type GridPreferences } from '../types/gridPreferences';

export type Channels = 'ipc-example';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

contextBridge.exposeInMainWorld('app', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
});

contextBridge.exposeInMainWorld('api', {
  post: (url: string, data: any, headers?: any) => {
    return ipcRenderer.invoke('api:post', url, data, headers);
  },
  get: (url: string, config?: any) => {
    return ipcRenderer.invoke('api:get', url, config);
  },
});

contextBridge.exposeInMainWorld('gridPreferences', {
  get: (view: string) => ipcRenderer.invoke('gridPreferences:get', view),
  save: (view: string, data: GridPreferences) =>
    ipcRenderer.invoke('gridPreferences:save', view, data),
});

contextBridge.exposeInMainWorld('app_config', {
  get: (key: string) => ipcRenderer.invoke('appConfig:get', key),
  save: (key: string, value: string) =>
    ipcRenderer.invoke('appConfig:save', key, value),
});

contextBridge.exposeInMainWorld('appConfig', {
  getBackendUrl: () => ipcRenderer.invoke('appConfig:getBackendUrl'),
});

contextBridge.exposeInMainWorld('cookies', {
  clear: () => ipcRenderer.invoke('cookies:clear'),
});

contextBridge.exposeInMainWorld('authSession', {
  onSessionExpired: (callback: () => void) => {
    const channel = 'auth:session-expired';
    const listener = () => callback();
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});

contextBridge.exposeInMainWorld('logger', {
  log: (message: string) => ipcRenderer.invoke('logger:log', message),
});

contextBridge.exposeInMainWorld('dataSync', {
  sync: () => ipcRenderer.invoke('data:sync'),
  clearAll: () => ipcRenderer.invoke('data:clearAll'),
  deleteDBFilesAndRestart: () => ipcRenderer.invoke('data:deleteDBFilesAndRestart'),
});

contextBridge.exposeInMainWorld('env', {
  API_BASE_URL: () => ipcRenderer.invoke('appConfig:get', 'backendUrl'),
});

contextBridge.exposeInMainWorld('printers', {
  get: () => ipcRenderer.invoke('printers:get'),
  printPDF: (data: Blob, printerName?: string, options?: any) => ipcRenderer.invoke('printers:printPDF', data, printerName, options),
  printPOS: (data: any[], printerName?: string, width?: string) => ipcRenderer.invoke('printers:printPOS', data, printerName, width),
  printHTML: (html: string, printerName?: string, options?: any) => ipcRenderer.invoke('printers:printHTML', html, printerName, options),
  warmup: (printerName?: string) => ipcRenderer.invoke('printers:warmup', printerName),
});

contextBridge.exposeInMainWorld('pdf', {
  generateFromHTML: (html: string, options?: any) => ipcRenderer.invoke('pdf:generateFromHTML', html, options),
});

contextBridge.exposeInMainWorld('products', {
  get: (itemCode: string) => ipcRenderer.invoke('products:get', itemCode),
  getAll: () => ipcRenderer.invoke('products:getAll'),
  search: (query: string, limit?: number) =>
    ipcRenderer.invoke('products:search', query, limit),
  getByBarcode: (barcode: string) =>
    ipcRenderer.invoke('products:getByBarcode', barcode),
  updateFavorite: (itemCode: string, isFavorite: number) =>
    ipcRenderer.invoke('products:updateFavorite', itemCode, isFavorite),
});

contextBridge.exposeInMainWorld('customers', {
  getAll: () => ipcRenderer.invoke('customers:getAll'),
  save: (customer: import('../../types/customer').Customer) =>
    ipcRenderer.invoke('customers:save', customer),
});

contextBridge.exposeInMainWorld('salesHistory', {
  getAll: () => ipcRenderer.invoke('salesHistory:getAll'),
});

contextBridge.exposeInMainWorld('shift', {
  getClosingList: (params: any) => ipcRenderer.invoke('shift:getClosingList', params),
  getOpenShift: () => ipcRenderer.invoke('shift:getOpenShift'),
  getSessionDetails: (name: string) => ipcRenderer.invoke('shift:getSessionDetails', name),
});

contextBridge.exposeInMainWorld('posSettings', {
  get: () => ipcRenderer.invoke('posSettings:get'),
});

contextBridge.exposeInMainWorld('categorySortOrder', {
  get: () => ipcRenderer.invoke('categorySortOrder:get'),
  save: (categoryIds: string[]) =>
    ipcRenderer.invoke('categorySortOrder:save', categoryIds),
});

contextBridge.exposeInMainWorld('productSortOrder', {
  get: () => ipcRenderer.invoke('productSortOrder:get'),
  save: (itemCodes: string[]) =>
    ipcRenderer.invoke('productSortOrder:save', itemCodes),
});

contextBridge.exposeInMainWorld('printerSettings', {
  get: () => ipcRenderer.invoke('printerSettings:get'),
  save: (settings: any) =>
    ipcRenderer.invoke('printerSettings:save', settings),
});

contextBridge.exposeInMainWorld('onScreenKeyboardLayout', {
  get: () => ipcRenderer.invoke('onScreenKeyboardLayout:get'),
  save: (mode: 'login' | 'restaurant', state: Record<string, unknown>) =>
    ipcRenderer.invoke('onScreenKeyboardLayout:save', mode, state),
});

contextBridge.exposeInMainWorld('itemGroups', {
  getAll: () => ipcRenderer.invoke('itemGroups:getAll'),
});

contextBridge.exposeInMainWorld('uoms', {
  getAll: () => ipcRenderer.invoke('uoms:getAll'),
});

contextBridge.exposeInMainWorld('cart', {
  save: (cart: any) => ipcRenderer.invoke('cart:save', cart),
  get: (cartId: number) => ipcRenderer.invoke('cart:get', cartId),
  getCurrent: () => ipcRenderer.invoke('cart:getCurrent'),
  delete: (cartId: number) => ipcRenderer.invoke('cart:delete', cartId),
  deleteItem: (cartId: number, itemId: string) =>
    ipcRenderer.invoke('cart:deleteItem', cartId, itemId),
  clear: () => ipcRenderer.invoke('cart:clear'),
});

contextBridge.exposeInMainWorld('invoice', {
  create: (customer: string, items: any[]) =>
    ipcRenderer.invoke('invoice:create', customer, items),
  createPOS: (payload: any) =>
    ipcRenderer.invoke('invoice:createPOS', payload),
  getModeOfPayments: () =>
    ipcRenderer.invoke('invoice:getModeOfPayments'),
  submitInvoice: (invoiceName: string) =>
    ipcRenderer.invoke('invoice:submitInvoice', invoiceName),
});

export type ElectronHandler = typeof electronHandler;

contextBridge.exposeInMainWorld('ui_log', {
  write: (event: string, data?: any) => ipcRenderer.invoke('uiLog:write', event, data),
  clear: () => ipcRenderer.invoke('uiLog:clear'),
});
