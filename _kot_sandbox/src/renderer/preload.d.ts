import { ElectronHandler } from '../main/preload';
import { type GridPreferences } from '../types/gridPreferences';

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    electron: ElectronHandler;
    api: {
      post: (url: string, data: any, headers?: any) => Promise<any>;
      get: (url: string, config?: any) => Promise<any>;
    };
    gridPreferences: {
      get: (view: string) => Promise<GridPreferences | null>;
      save: (view: string, data: GridPreferences) => Promise<void>;
    };
    env: {
      API_BASE_URL: string;
    };
    app_config: {
      get: (key: string) => Promise<string | null>;
      save: (key: string, value: string) => Promise<void>;
    };
    appConfig: {
      getBackendUrl: () => Promise<string>;
    };
    cookies: {
      clear: () => Promise<null>;
    };
    authSession: {
      onSessionExpired: (callback: () => void) => () => void;
    };
    logger: {
      log: (message: string) => Promise<void>;
    };
    dataSync: {
      sync: () => Promise<{ success: boolean }>;
      clearAll: () => Promise<{ success: boolean }>;
    };
    printers: {
      get: (forceRefresh?: boolean) => Promise<string[]>;
      printPDF: (pdfBlob: Blob, printerName?: string, options?: any) => Promise<{ success: boolean }>;
      printPOS: (data: any[], printerName?: string, width?: string) => Promise<any>;
      printHTML: (html: string, printerName?: string, options?: any) => Promise<{ success: boolean }>;
      warmup: (printerName?: string) => Promise<{ success: boolean }>;
    };
    pdf: {
      generateFromHTML: (html: string) => Promise<{ __isBlob: true; data: string; type: string }>;
    };
    products: {
      get: (itemCode: string) => Promise<any>;
      getAll: () => Promise<any[]>;
      search: (query: string, limit?: number) => Promise<any[]>;
      getByBarcode: (barcode: string) => Promise<any>;
      updateFavorite: (itemCode: string, isFavorite: number) => Promise<any>;
    };
    customers: {
      getAll: () => Promise<any[]>;
    };
    salesHistory: {
      getAll: () => Promise<any[]>;
    };
    shift: {
      getClosingList: (params?: { from_date?: string; to_date?: string; status?: string; limit_page_length?: number }) => Promise<any>;
      getOpenShift: () => Promise<any>;
      getSessionDetails: (name: string) => Promise<any>;
    };
    posSettings: {
      get: () => Promise<any>;
    };
    categorySortOrder: {
      get: () => Promise<string[] | null>;
      save: (categoryIds: string[]) => Promise<void>;
    };
    productSortOrder: {
      get: () => Promise<string[] | null>;
      save: (itemCodes: string[]) => Promise<void>;
    };
    printerSettings: {
      get: () => Promise<any>;
      save: (settings: any) => Promise<void>;
    };
    onScreenKeyboardLayout: {
      get: () => Promise<{
        login?: {
          x?: number;
          y?: number;
          w?: number;
          h?: number;
          scale?: number;
          lang?: 'en' | 'ar';
        } | null;
        restaurant?: {
          x?: number;
          y?: number;
          w?: number;
          h?: number;
          scale?: number;
          lang?: 'en' | 'ar';
        } | null;
      }>;
      save: (
        mode: 'login' | 'restaurant',
        state: {
          x?: number;
          y?: number;
          w?: number;
          h?: number;
          scale?: number;
          lang?: 'en' | 'ar';
        },
      ) => Promise<void>;
    };
    itemGroups: {
      getAll: () => Promise<any[]>;
    };
    cart: {
      save: (cart: any) => Promise<number>;
      get: (cartId: number) => Promise<any>;
      getCurrent: () => Promise<any>;
      delete: (cartId: number) => Promise<void>;
      deleteItem: (cartId: number, itemId: string) => Promise<void>;
      clear: () => Promise<void>;
    };
    invoice: {
      create: (customer: string, items: any[]) => Promise<any>;
      createPOS: (payload: any) => Promise<any>;
      getModeOfPayments: () => Promise<any>;
      submitInvoice: (invoiceName: string) => Promise<any>;
    };
  }
}

export { };
