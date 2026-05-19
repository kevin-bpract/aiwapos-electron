export type KeyboardShortcutId =
  | 'showProductList'
  | 'showCustomerList'
  | 'showSalesHistory'
  | 'showSettings'
  | 'selectProduct'
  | 'closeModal'
  | 'envModal'
  | 'showCustomerListDropdown'
  | 'newTransaction'
  | 'changeQuantity'
  | 'changeRate'
  | 'pay'
  | 'scan'
  | 'itemDiscount'
  | 'findItem'
  | 'holdTransaction'
  | 'holdList'
  | 'openCashDrawer'
  | 'sessionStart'
  | 'sessionEnd'
  | 'lockScreen'
  | 'focusQuantity'
  | 'focusProductSearch'
  | 'changeUnitPrice'
  | 'showGlobalSettingsModal'
  | 'clearCart'
  | 'showInvoiceList'
  | 'showOrderList'
  | 'createOrder'
  | 'showSalesSummary';

export interface KeyboardShortcut {
  id: KeyboardShortcutId;
  key: string;
  action: string;
  description: string;
}

export const KeyboardShortcuts: Record<KeyboardShortcutId, KeyboardShortcut> = {
  showProductList: {
    id: 'showProductList',
    key: 'F1',
    action: 'Show Product List',
    description: 'Open product selection modal',
  },
  showCustomerList: {
    id: 'showCustomerList',
    key: 'F2',
    action: 'Show Customer List',
    description: 'Open customer selection modal',
  },
  showCustomerListDropdown: {
    id: 'showCustomerListDropdown',
    key: 'F7',
    action: 'Show Customer List Dropdown',
    description: 'Open customer selection Dropdown',
  },
  showSalesHistory: {
    id: 'showSalesHistory',
    key: 'F3',
    action: 'Show Sales History',
    description: 'Open sales history modal',
  },
  selectProduct: {
    id: 'selectProduct',
    key: 'Control+S',
    action: 'Save Product Line',
    description: 'Save product details in product info modal',
  },
  closeModal: {
    id: 'closeModal',
    key: 'Escape',
    action: 'Close Active Modal',
    description: 'Close the currently open modal',
  },
  envModal: {
    id: 'envModal',
    key: 'F9',
    action: 'Show Env Modal',
    description:
      'Shows a modal which lets you change the backend url (Works only on Login Screen)',
  },
  showSettings: {
    id: 'showSettings',
    key: 'F10',
    action: 'Show Settings',
    description: 'Open application settings modal',
  },
  newTransaction: {
    id: 'newTransaction',
    key: 'Control+N',
    action: 'New Transaction',
    description: 'Clear all fields and start with a fresh screen',
  },
  changeQuantity: {
    id: 'changeQuantity',
    key: 'F5',
    action: 'Change Quantity',
    description: 'Change quantity of selected item',
  },
  changeRate: {
    id: 'changeRate',
    key: 'F6',
    action: 'Change Rate',
    description: 'Change rate of selected item',
  },
  pay: {
    id: 'pay',
    key: 'F12',
    action: 'Pay',
    description: 'Open payment/checkout modal',
  },
  scan: {
    id: 'scan',
    key: 'Control+F3',
    action: 'Scan',
    description: 'Scan barcode or product',
  },
  itemDiscount: {
    id: 'itemDiscount',
    key: 'Control+F7',
    action: 'Item Discount',
    description: 'Apply discount to selected item',
  },
  findItem: {
    id: 'findItem',
    key: 'Control+F',
    action: 'Find Item',
    description: 'Search for an item',
  },
  holdTransaction: {
    id: 'holdTransaction',
    key: 'Control+F10',
    action: 'Hold Transaction',
    description: 'Hold current transaction',
  },
  holdList: {
    id: 'holdList',
    key: 'Control+F11',
    action: 'Hold List',
    description: 'View held transactions',
  },
  openCashDrawer: {
    id: 'openCashDrawer',
    key: 'Control+F12',
    action: 'Open Cash Drawer',
    description: 'Open physical cash drawer',
  },
  sessionStart: {
    id: 'sessionStart',
    key: 'Control+Shift+S',
    action: 'Session Start',
    description: 'Open session modal (start or end session)',
  },
  sessionEnd: {
    id: 'sessionEnd',
    key: 'Control+Shift+S',
    action: 'Session End',
    description: 'Open session modal (start or end session)',
  },
  lockScreen: {
    id: 'lockScreen',
    key: 'Control+L',
    action: 'Lock Screen',
    description: 'Lock the screen',
  },
  focusQuantity: {
    id: 'focusQuantity',
    key: 'Control+Q',
    action: 'Focus Quantity',
    description: 'Focus quantity input field of selected or last item',
  },
  focusProductSearch: {
    id: 'focusProductSearch',
    key: 'Control+B',
    action: 'Focus Product Search',
    description: 'Focus product search input field',
  },
  changeUnitPrice: {
    id: 'changeRate',
    key: 'Control+U',
    action: 'Change Unit Price',
    description: 'Focus Unit Price field of selected or last item',
  },
  showGlobalSettingsModal: {
    id: 'showSettings',
    key: 'Control+D',
    action: 'Show Global Settings Modal',
    description: 'Open global settings modal',
  },
  clearCart: {
    id: 'clearCart',
    key: 'Control+X',
    action: 'Clear Cart',
    description: 'Clear the cart and start fresh',
  },
  showInvoiceList: {
    id: 'showInvoiceList',
    key: 'Control+Shift+I',
    action: 'Invoice List',
    description: 'Open sales invoice history modal',
  },
  showOrderList: {
    id: 'showOrderList',
    key: 'Control+Shift+O',
    action: 'Order List',
    description: 'Open order history modal',
  },
  createOrder: {
    id: 'createOrder',
    key: 'Control+Shift+Enter',
    action: 'Create Order',
    description: 'Create order (same as Order button)',
  },
  showSalesSummary: {
    id: 'showSalesSummary',
    key: 'Control+Shift+M',
    action: 'Show Sales Summary',
    description: 'Open date-range sales summary modal',
  },
};

const KeyboardConfig = {
  showProductList: KeyboardShortcuts.showProductList.key,
  showCustomerList: KeyboardShortcuts.showCustomerList.key,
  showSalesHistory: KeyboardShortcuts.showSalesHistory.key,
  closeModal: KeyboardShortcuts.closeModal.key,
  selectProduct: KeyboardShortcuts.selectProduct.key,
  envModal: KeyboardShortcuts.envModal.key,
  showSettings: KeyboardShortcuts.showSettings.key,
  newTransaction: KeyboardShortcuts.newTransaction.key,
  changeQuantity: KeyboardShortcuts.changeQuantity.key,
  changeRate: KeyboardShortcuts.changeRate.key,
  pay: KeyboardShortcuts.pay.key,
  scan: KeyboardShortcuts.scan.key,
  itemDiscount: KeyboardShortcuts.itemDiscount.key,
  findItem: KeyboardShortcuts.findItem.key,
  holdTransaction: KeyboardShortcuts.holdTransaction.key,
  holdList: KeyboardShortcuts.holdList.key,
  openCashDrawer: KeyboardShortcuts.openCashDrawer.key,
  lockScreen: KeyboardShortcuts.lockScreen.key,
  sessionStart: KeyboardShortcuts.sessionStart.key,
  sessionEnd: KeyboardShortcuts.sessionEnd.key,
  focusQuantity: KeyboardShortcuts.focusQuantity.key,
  focusProductSearch: KeyboardShortcuts.focusProductSearch.key,
  changeUnitPrice: KeyboardShortcuts.changeUnitPrice.key,
  showGlobalSettingsModal: KeyboardShortcuts.showGlobalSettingsModal.key,
  clearCart: KeyboardShortcuts.clearCart.key,
  showInvoiceList: KeyboardShortcuts.showInvoiceList.key,
  showOrderList: KeyboardShortcuts.showOrderList.key,
  createOrder: KeyboardShortcuts.createOrder.key,
  showSalesSummary: KeyboardShortcuts.showSalesSummary.key,
};

export default KeyboardConfig;
