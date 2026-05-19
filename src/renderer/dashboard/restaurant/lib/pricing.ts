/**
 * Restaurant-owned pricing logic. Separate from utils/pricing (used by Sales/Supermarket)
 * so changes to sales/supermarket pricing do not affect restaurant.
 */
import type { ProductItem } from '../../../main/api/products';
import type { SaleItem } from '../../../types/saleItem';

export function getPriceFromPriceList(
  product: ProductItem,
  priceList: string,
  uom: string,
): { price: number; discountPercent: number; discountAmount: number } {
  if (!product.prices || product.prices.length === 0) {
    return {
      price: product.standard_rate || 0,
      discountPercent: 0,
      discountAmount: 0,
    };
  }

  const priceEntry = product.prices.find(
    (p: { price_list?: string; uom?: string }) =>
      p.price_list === priceList && p.uom?.toLowerCase() === uom.toLowerCase(),
  );

  if (priceEntry) {
    return {
      price: priceEntry.price_list_rate || product.standard_rate || 0,
      discountPercent: priceEntry.discount_percentage || 0,
      discountAmount: priceEntry.discount_amount || 0,
    };
  }

  const fallbackEntry = product.prices.find(
    (p: { price_list?: string }) => p.price_list === priceList,
  );

  if (fallbackEntry) {
    return {
      price: fallbackEntry.price_list_rate || product.standard_rate || 0,
      discountPercent: fallbackEntry.discount_percentage || 0,
      discountAmount: fallbackEntry.discount_amount || 0,
    };
  }

  return {
    price: product.standard_rate || 0,
    discountPercent: 0,
    discountAmount: 0,
  };
}

export function createEmptyRow(): SaleItem {
  return {
    id: `empty-${Date.now()}-${Math.random()}`,
    productCode: '',
    quantity: 1,
    barcode: '',
    description: '',
    unit: '',
    inclusiveTax: false,
    inclusivePrice: 0,
    unitPrice: 0,
    taxRate: 0,
    discountPercent: 0,
    discountAmount: 0,
    batch: '',
    expiry: '',
    notes: '',
  };
}

export function productToSaleItem(
  product: ProductItem,
  userPriceList: string,
  isTaxIncluded: boolean = true,
): SaleItem {
  const defaultUom = product.stock_uom || '';
  const { price, discountPercent, discountAmount } = getPriceFromPriceList(
    product,
    userPriceList,
    defaultUom,
  );

  const taxRate = product.tax_rate || 0;
  let unitPrice = price;
  let inclusivePrice = price;

  if (isTaxIncluded) {
    inclusivePrice = price;
    unitPrice = price / (1 + taxRate / 100);
  } else {
    unitPrice = price;
    inclusivePrice = price * (1 + taxRate / 100);
  }

  return {
    id: `${product.item_code}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    productCode: product.item_code || '',
    quantity: 1,
    barcode: product.barcodes?.[0]?.barcode || product.item_code || '',
    description: product.item_name || product.description || '',
    descriptionArabic: product.item_name_arabic?.trim() || undefined,
    unit: defaultUom,
    inclusiveTax: isTaxIncluded,
    inclusivePrice,
    unitPrice,
    taxRate,
    discountPercent: 0,
    discountAmount: 0,
    maxDiscountPercent: discountPercent,
    maxDiscountAmount: discountAmount,
    availableUoms: product.uoms || [],
    prices: product.prices || [],
  };
}

export function calculateTotalAmount(items: SaleItem[]): number {
  return items.reduce((sum, item) => {
    return sum + item.inclusivePrice * item.quantity;
  }, 0);
}
