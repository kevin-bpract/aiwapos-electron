import { formatCurrency } from './currency';

export interface POSInvoiceData {
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
    payments: { [key: string]: number };
    tableNo?: string;
}

export const generatePOSInvoiceData = (data: POSInvoiceData): any[] => {
    const {
        invoiceNo,
        customerName,
        date,
        items,
        subTotal,
        discount,
        charges,
        total,
        paymentMethod,
        payments,
        tableNo,
    } = data;

    const formatDate = (d: Date) => {
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Convert Items to Table Body
    // electron-pos-printer table header style
    const tableHeader = ['Item', 'Qty', 'Price', 'Amt'];
    const tableBody = items.map((item) => [
        item.name,
        item.qty.toString(),
        formatCurrency(item.rate).replace('SAR', '').trim(),
        formatCurrency(item.amount).replace('SAR', '').trim(),
    ]);

    // Construct Data Array
    const printerData: any[] = [
        {
            type: 'text',
            value: 'ELECTROJS DEMO',
            style: 'text-align:center; font-weight: bold; font-size: 18px;',
        },
        {
            type: 'text',
            value: 'Riyadh, Saudi Arabia',
            style: 'text-align:center; font-size: 12px;',
        },
        {
            type: 'text',
            value: 'Tel: +966 50 000 0000',
            style: 'text-align:center; font-size: 12px; margin-bottom: 10px;',
        },
        {
            type: 'text',
            value: '--------------------------------',
            style: 'text-align:center;',
        },
        {
            type: 'text',
            value: `Invoice: ${invoiceNo}`,
            style: 'font-size: 12px; font-weight: bold;',
        },
        {
            type: 'text',
            value: `Date: ${formatDate(date)}`,
            style: 'font-size: 12px;',
        },
        {
            type: 'text',
            value: `Customer: ${customerName}`,
            style: 'font-size: 12px;',
        },
        ...(tableNo ? [{
            type: 'text',
            value: `Table: ${tableNo}`,
            style: 'font-size: 12px;',
        }] : []),
        {
            type: 'text',
            value: '--------------------------------',
            style: 'text-align:center;',
        },
        {
            type: 'table',
            style: 'border: 1px solid #ddd',
            tableHeader: tableHeader,
            tableBody: tableBody,
            tableHeaderStyle: 'background-color: #eee; color: #000; font-weight: bold;',
            tableBodyStyle: 'border: 0.5px solid #ddd;',
            tableCellStyle: 'padding: 2px; font-size: 11px;', // Smaller font for table
        },
        {
            type: 'text',
            value: '--------------------------------',
            style: 'text-align:center;',
        },
        {
            type: 'text',
            value: `Subtotal: ${formatCurrency(subTotal)}`,
            style: 'text-align:right; font-size: 12px;',
        },
    ];

    if (discount > 0) {
        printerData.push({
            type: 'text',
            value: `Discount: -${formatCurrency(discount)}`,
            style: 'text-align:right; font-size: 12px;',
        });
    }

    printerData.push({
        type: 'text',
        value: `Total: ${formatCurrency(total)}`,
        style: 'text-align:right; font-weight: bold; font-size: 16px;',
    });

    printerData.push({
        type: 'text',
        value: '--------------------------------',
        style: 'text-align:center;',
    });

    // Payments
    Object.entries(payments).forEach(([mode, amount]) => {
        printerData.push({
            type: 'text',
            value: `${mode}: ${formatCurrency(amount)}`,
            style: 'text-align:right; font-size: 12px;',
        });
    });

    printerData.push({
        type: 'text',
        value: 'Thank you for visiting!',
        style: 'text-align:center; margin-top: 10px; font-size: 12px;',
    });

    return printerData;
};
