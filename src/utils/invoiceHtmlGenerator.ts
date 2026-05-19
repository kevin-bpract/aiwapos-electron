/**
 * Invoice HTML Generator for 80mm PDF Printing
 */

import { formatCurrency } from './format';
import { format } from 'date-fns';

export interface InvoiceData {
  invoiceNo: string;
  customerName: string;
  date: Date;
  items: Array<{
    name: string;
    qty: number;
    rate: number;
    amount: number;
  }>;
  subTotal: number;
  discount: number;
  charges: number;
  total: number;
  paymentMethod: string;
  payments?: { [key: string]: number };
  tableNo?: string;
  footerMessage?: string;
}

function formatDateTime12Hour(date: Date): string {
  try {
    const dateStr = format(date, 'dd MMM yyyy');
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const minutesStr = minutes.toString().padStart(2, '0');
    return `${dateStr} ${hours12}:${minutesStr} ${ampm}`;
  } catch {
    return date.toDateString();
  }
}

export function generateInvoiceHTML(data: InvoiceData): string {
  const {
    invoiceNo, customerName, date, items,
    subTotal, discount, charges, total,
    paymentMethod, payments, tableNo, footerMessage
  } = data;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { background: white; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      padding: 0 5mm;
      background: white;
      color: #000;
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }
    .header { text-align: center; margin-bottom: 20px; }
    .title { font-size: 18px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
    .subtitle { font-size: 12px; margin-bottom: 5px; }
    .info { margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .label { font-weight: bold; }
    
    .table-header { 
      display: flex; 
      font-weight: bold; 
      border-bottom: 1px solid #000; 
      padding-bottom: 5px; 
      margin-bottom: 5px; 
    }
    .col-item { flex: 2; text-align: left; }
    .col-qty { width: 30px; text-align: center; }
    .col-price { width: 50px; text-align: right; }
    .col-amt { width: 60px; text-align: right; }
    
    .item-row { display: flex; margin-bottom: 8px; }
    .item-name { flex: 2; }
    
    .totals { margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px; }
    .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .total-final { font-size: 16px; font-weight: bold; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px; }
    
    .payments { margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc; }
    .footer { text-align: center; margin-top: 20px; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">INVOICE</div>
    <!-- <div class="subtitle">Restaurant Name</div> -->
  </div>

  <div class="info">
    <div class="info-row">
      <span class="label">Invoice:</span>
      <span>${invoiceNo}</span>
    </div>
    <div class="info-row">
      <span class="label">Date:</span>
      <span>${formatDateTime12Hour(date)}</span>
    </div>
    <div class="info-row">
      <span class="label">Customer:</span>
      <span>${customerName}</span>
    </div>
    ${tableNo ? `
    <div class="info-row">
      <span class="label">Table:</span>
      <span>${tableNo}</span>
    </div>
    ` : ''}
  </div>

  <div class="items">
    <div class="table-header">
      <div class="col-item">Item</div>
      <div class="col-qty">Qty</div>
      <div class="col-price">Rate</div>
      <div class="col-amt">Amt</div>
    </div>
    ${items.map(item => `
      <div class="item-row">
        <div class="col-item">${item.name}</div>
        <div class="col-qty">${item.qty}</div>
        <div class="col-price">${formatCurrency(item.rate).replace('$', '')}</div>
        <div class="col-amt">${formatCurrency(item.amount).replace('$', '')}</div>
      </div>
    `).join('')}
  </div>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal:</span>
      <span>${formatCurrency(subTotal)}</span>
    </div>
    ${discount > 0 ? `
    <div class="total-row">
      <span>Discount:</span>
      <span>-${formatCurrency(discount)}</span>
    </div>
    ` : ''}
    ${charges > 0 ? `
    <div class="total-row">
      <span>Charges:</span>
      <span>+${formatCurrency(charges)}</span>
    </div>
    ` : ''}
    <div class="total-row total-final">
      <span>Total:</span>
      <span>${formatCurrency(total)}</span>
    </div>
  </div>

  ${payments && Object.keys(payments).length > 0 ? `
    <div class="payments">
      <div style="font-weight: bold; margin-bottom: 5px;">Payment Details:</div>
      ${Object.entries(payments).map(([mode, amount]) => `
        <div class="info-row">
          <span>${mode}:</span>
          <span>${formatCurrency(amount)}</span>
        </div>
      `).join('')}
    </div>
  ` : `
    <div class="payments">
      <div class="info-row">
        <span class="label">Payment Mode:</span>
        <span>${paymentMethod}</span>
      </div>
    </div>
  `}

  <div class="footer">
    ${footerMessage || 'Thank you for your visit!'}
  </div>
</body>
</html>
  `;

  return html.trim();
}
