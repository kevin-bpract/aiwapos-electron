import type { ProductItem } from '../main/api/products';
import type { SaleItem } from '../types/saleItem';

export const getPriceFromPriceList = (
  product: ProductItem,
  priceList: string,
  uom: string,
): { price: number; discountPercent: number; discountAmount: number } => {
  if (!product.prices || product.prices.length === 0) {
    return {
      price: product.standard_rate || 0,
      discountPercent: 0,
      discountAmount: 0,
    };
  }

  const priceEntry = product.prices.find(
    (p: any) =>
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
    (p: any) => p.price_list === priceList,
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
};

export const createEmptyRow = (): SaleItem => ({
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
});

export const getMaxDiscountFromPrices = (
  item: SaleItem,
  type: 'percent' | 'amount',
): number => {
  if (!item.prices || !Array.isArray(item.prices) || !item.unit) {
    return type === 'percent'
      ? (item.maxDiscountPercent ?? 100)
      : (item.maxDiscountAmount ?? item.inclusivePrice * item.quantity);
  }

  const discounts = item.prices.filter((price: any) => {
    if (!price.uom || !item.unit) return false;
    const sameUom = price.uom.toLowerCase() === item.unit.toLowerCase();
    const hasDiscount =
      price.discount_amount != null || price.discount_percentage != null;
    return sameUom && hasDiscount;
  });

  const maxDiscount = discounts.reduce(
    (acc, d) =>
      Math.max(
        acc,
        type === 'percent'
          ? d.discount_percentage || 0
          : d.discount_amount || 0,
      ),
    0,
  );

  if (maxDiscount > 0) {
    return maxDiscount;
  }

  return type === 'percent'
    ? (item.maxDiscountPercent ?? 100)
    : (item.maxDiscountAmount ?? item.inclusivePrice * item.quantity);
};

export const productToSaleItem = (
  product: ProductItem,
  userPriceList: string,
  isTaxIncluded: boolean = true,
): SaleItem => {
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
    // If tax is included in the price list rate, then the rate is the inclusive price
    inclusivePrice = price;
    unitPrice = price / (1 + taxRate / 100);
  } else {
    // If tax is NOT included, then the rate is the unit price (pre-tax)
    unitPrice = price;
    inclusivePrice = price * (1 + taxRate / 100);
  }

  return {
    id: `${product.item_code}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    productCode: product.item_code || '',
    quantity: 1,
    barcode: product.barcodes?.[0]?.barcode || product.item_code || '',
    description: product.item_name || product.description || '',
    unit: defaultUom,
    inclusiveTax: isTaxIncluded,
    inclusivePrice: inclusivePrice,
    unitPrice: unitPrice,
    taxRate: taxRate,
    discountPercent: 0,
    discountAmount: 0,
    maxDiscountPercent: discountPercent,
    maxDiscountAmount: discountAmount,

    availableUoms: product.uoms || [],
    prices: product.prices || [],
  };
};

export const calculateTotalAmount = (items: SaleItem[]): number => {
  return items.reduce((sum, item) => {
    const itemTotal = item.inclusivePrice * item.quantity;
    return sum + itemTotal;
  }, 0);
};

export const calculateTotalDiscount = (items: SaleItem[]): number => {
  return items.reduce((sum, item) => {
    const discountAmount =
      item.discountAmount ||
      (item.discountPercent
        ? (item.inclusivePrice * item.quantity * item.discountPercent) / 100
        : 0);
    return sum + discountAmount;
  }, 0);
};

export const calculateTotalTax = (items: SaleItem[]): number => {
  return items.reduce((sum, item) => {
    const discountAmount =
      item.discountAmount ||
      (item.discountPercent
        ? (item.unitPrice * item.quantity * item.discountPercent) / 100
        : 0);
    const taxablePrice = item.unitPrice;
    const totalTaxableAmount = taxablePrice * item.quantity - discountAmount;
    const totalTaxAmount = item.taxRate
      ? (totalTaxableAmount * item.taxRate) / 100
      : 0;
    return sum + totalTaxAmount;
  }, 0);
};

export const calculateTotalTaxableAmount = (items: SaleItem[]): number => {
  return items.reduce((sum, item) => {
    const discountAmount =
      item.discountAmount ||
      (item.discountPercent
        ? (item.unitPrice * item.quantity * item.discountPercent) / 100
        : 0);

    const taxablePrice = item.unitPrice;

    const totalTaxableAmount = taxablePrice * item.quantity - discountAmount;

    return sum + totalTaxableAmount;
  }, 0);
};

export const calculateGrossSubtotal = (items: SaleItem[]): number => {
  return items.reduce((sum, item) => {
    const itemPrice = item.inclusiveTax ? item.inclusivePrice : item.unitPrice;
    return sum + (itemPrice * item.quantity);
  }, 0);
};
