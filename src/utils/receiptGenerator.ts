import { formatCurrency } from './format';

export interface PosPrintData {
    type: 'text' | 'barCode' | 'qrCode' | 'image' | 'table';
    value?: string;
    css?: any;
    style?: any;
    width?: string;
    height?: string;
    fontsize?: number;
    displayValue?: boolean;
    position?: 'left' | 'center' | 'right';
    tableHeader?: any[];
    tableBody?: any[][];
    tableFooter?: any[];
    tableHeaderStyle?: any;
    tableBodyStyle?: any;
    tableFooterStyle?: any;
}

export const generateReceiptData = (
    data: {
        title: string;
        customerName?: string;
        table?: string;
        invoiceNo: string;
        date: string;
        items: any[];
        subtotal: number;
        discount: number;
        charges: number;
        total: number;
        paymentMethod?: string;
        footerMessage?: string;
    },
    width: '58mm' | '80mm' = '80mm'
): PosPrintData[] => {
    const line = {
        type: 'text',
        value: '-'.repeat(width === '58mm' ? 32 : 48),
        style: { fontWeight: 'bold', textAlign: 'center', marginBottom: '5px' }
    } as PosPrintData;

    const printData: PosPrintData[] = [
        {
            type: 'text',
            value: data.title,
            style: { fontWeight: 'bold', textAlign: 'center', fontSize: '24px', marginBottom: '10px' }
        },
        {
            type: 'text',
            value: `Date: ${data.date}`,
            style: { fontSize: '12px', textAlign: 'left' }
        },
        {
            type: 'text',
            value: `Invoice: ${data.invoiceNo}`,
            style: { fontSize: '12px', textAlign: 'left', marginBottom: '5px' }
        },
    ];

    if (data.customerName) {
        printData.push({
            type: 'text',
            value: `Customer: ${data.customerName}`,
            style: { fontSize: '12px', textAlign: 'left' }
        });
    }

    if (data.table) {
        printData.push({
            type: 'text',
            value: `Table: ${data.table}`,
            style: { fontSize: '12px', textAlign: 'left' }
        });
    }

    printData.push(line);

    // Items Table
    printData.push({
        type: 'table',
        style: { border: 'none' },
        tableHeader: ['Item', 'Qty', 'Price', 'Amt'],
        tableBody: data.items.map(item => [
            item.item_name || item.item_code,
            item.qty.toString(),
            formatCurrency(item.rate).replace('$', ''),
            formatCurrency(item.amount).replace('$', '')
        ]),
        tableHeaderStyle: { fontSize: '12px', fontWeight: 'bold' },
        tableBodyStyle: { fontSize: '12px' },
    });

    printData.push(line);

    // Totals
    const totalsStyle = { fontSize: '12px', textAlign: 'right', display: 'flex', justifyContent: 'space-between' };

    printData.push({
        type: 'text',
        value: `Subtotal: ${formatCurrency(data.subtotal)}`,
        style: { ...totalsStyle, textAlign: 'right' }
    });

    if (data.discount > 0) {
        printData.push({
            type: 'text',
            value: `Discount: -${formatCurrency(data.discount)}`,
            style: { ...totalsStyle, textAlign: 'right' }
        });
    }

    if (data.charges > 0) {
        printData.push({
            type: 'text',
            value: `Charges: +${formatCurrency(data.charges)}`,
            style: { ...totalsStyle, textAlign: 'right' }
        });
    }

    printData.push({
        type: 'text',
        value: `Total: ${formatCurrency(data.total)}`,
        style: { fontWeight: 'bold', fontSize: '16px', textAlign: 'right', marginTop: '5px' }
    });

    if (data.paymentMethod) {
        printData.push({
            type: 'text',
            value: `Paid via: ${data.paymentMethod}`,
            style: { fontSize: '12px', textAlign: 'left', marginTop: '5px' }
        });
    }

    printData.push(line);

    if (data.footerMessage) {
        printData.push({
            type: 'text',
            value: data.footerMessage,
            style: { textAlign: 'center', fontSize: '12px' }
        });
    }

    return printData;
};
