/**
 * KOT (Kitchen Order Ticket) PDF Generator Utility
 */

import { type SalesOrder } from '../main/api/salesOrders';
import { getNextBillNumber } from './billNumber';
import { format } from 'date-fns';

/**
 * Format date and time in 12-hour format
 */
function formatDateTime12Hour(date: Date): string {
  const dateStr = format(date, 'dd MMM yyyy');
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  const minutesStr = minutes.toString().padStart(2, '0');
  return `${dateStr} ${hours12}:${minutesStr} ${ampm}`;
}

export interface KOTData {
  billNumber: number;
  orderNumber: string;
  orderNotes?: string;
  tableNo?: string;
  orderType?: string;
  items: Array<{
    item_name: string;
    item_code: string;
    qty: number;
    tags?: string[];
  }>;
  timestamp: Date;
}

/**
 * Generate HTML for KOT (Kitchen Order Ticket)
 */
export function generateKOTHTML(kotData: KOTData): string {
  const { billNumber, orderNumber, orderNotes, tableNo, orderType, items, timestamp } = kotData;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html {
      background: white;
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      padding: 20px 2mm 10px 2mm; /* Increased top padding for thermal header safety */
      background: white;
      color: #000;
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      min-height: 100px;
      overflow-x: hidden; /* Prevent horizontal scroll */
    }
    .kot-header {
      text-align: center;
      border-bottom: 2px dashed #000;
      padding-bottom: 15px;
      margin-bottom: 15px;
    }
    .kot-title {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 5px;
      text-transform: uppercase;
    }
    .kot-subtitle {
      font-size: 12px;
      margin-bottom: 10px;
    }
    .kot-info {
      margin-bottom: 10px;
    }
    .kot-info-row {
      margin-bottom: 8px;
    }
    .kot-info-label {
      font-weight: bold;
      display: inline-block;
      min-width: 100px;
    }
    .kot-items {
      margin-top: 20px;
    }
    .kot-item {
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px dashed #ccc;
    }
    .kot-item-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 5px;
    }
    .kot-item-name {
      font-weight: bold;
      font-size: 14px;
      flex: 1; /* Take available space */
      margin-right: 5px;
      word-break: break-word; /* Wrap long names */
    }
    .kot-item-qty {
      font-weight: bold;
      font-size: 16px;
      white-space: nowrap; /* Don't wrap qty */
    }
    .kot-item-code {
      font-size: 10px;
      color: #666;
      margin-top: 2px;
    }
    .kot-item-tags {
      margin-top: 5px;
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .kot-tag {
      background: #f0f0f0;
      border: 1px solid #ccc;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: bold;
    }
    .kot-notes {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 2px dashed #000;
    }
    .kot-notes-label {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .kot-notes-text {
      font-style: italic;
      white-space: pre-wrap;
    }
    .kot-footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 2px dashed #000;
      text-align: center;
      font-size: 9px;
      color: #666;
    }
    @media print {
      body {
        padding: 10px;
      }
    }
  </style>
</head>
<body>
  <div class="kot-header">
    <div class="kot-title">Kitchen Order Ticket</div>
    <div class="kot-subtitle">KOT</div>
  </div>

  <div class="kot-info">
    <div class="kot-info-row">
      <span class="kot-info-label">Bill No:</span>
      <span>#${billNumber}</span>
    </div>
    <div class="kot-info-row">
      <span class="kot-info-label">Order No:</span>
      <span>${orderNumber}</span>
    </div>
    <div class="kot-info-row">
      <span class="kot-info-label">Date & Time:</span>
      <span>${formatDateTime12Hour(timestamp)}</span>
    </div>
    ${orderType ? `
    <div class="kot-info-row">
      <span class="kot-info-label">Type:</span>
      <span style="font-weight: bold; text-transform: uppercase;">${orderType}</span>
    </div>
    ` : ''}
    ${tableNo ? `
    <div class="kot-info-row">
      <span class="kot-info-label">Table:</span>
      <span>${tableNo}</span>
    </div>
    ` : ''}
  </div>

  <div class="kot-items">
    ${items.map((item) => `
      <div class="kot-item">
        <div class="kot-item-header">
          <div>
            <div class="kot-item-name">${item.item_name || item.item_code}</div>
            <div class="kot-item-code">${item.item_code}</div>
          </div>
          <div class="kot-item-qty">x${item.qty}</div>
        </div>
        ${item.tags && item.tags.length > 0 ? `
          <div class="kot-item-tags">
            ${item.tags.map(tag => `<span class="kot-tag">${tag}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `).join('')}
  </div>

  ${orderNotes ? `
    <div class="kot-notes">
      <div class="kot-notes-label">Order Notes:</div>
      <div class="kot-notes-text">${orderNotes}</div>
    </div>
  ` : ''}

  <div class="kot-footer">
    Generated on ${formatDateTime12Hour(timestamp)}
  </div>
</body>
</html>
  `;

  return html.trim();
}

/**
 * Convert SalesOrder to KOTData
 * Fetches tags from products if available
 */
export async function salesOrderToKOTData(order: SalesOrder): Promise<KOTData> {
  const billNumber = getNextBillNumber();

  // Fetch tags for each item from products
  const itemsWithTags = await Promise.all(
    (order.items || []).map(async (item) => {
      let tags: string[] = [];

      try {
        // Try to get product to fetch tags
        if (window.products?.get) {
          const product = await window.products.get(item.item_code);
          if (product?.custom_item_tag_list) {
            // Handle tags which can be array, string, or null
            if (Array.isArray(product.custom_item_tag_list)) {
              tags = product.custom_item_tag_list;
            } else if (typeof product.custom_item_tag_list === 'string') {
              try {
                const parsed = JSON.parse(product.custom_item_tag_list);
                tags = Array.isArray(parsed) ? parsed : [];
              } catch {
                tags = [];
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching tags for ${item.item_code}:`, error);
        // Continue without tags
      }

      return {
        item_name: item.item_name || item.item_code,
        item_code: item.item_code,
        qty: item.qty,
        tags,
      };
    })
  );

  return {
    billNumber,
    orderNumber: order.name,
    orderNotes: order.order_notes,
    tableNo: order.table_no,
    orderType: order.restaurant_order_type,
    items: itemsWithTags,
    timestamp: new Date(order.transaction_date || new Date()),
  };
}

