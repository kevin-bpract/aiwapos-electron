/**
 * Shared SaleItem type used by Sales, Restaurant, Supermarket and hooks/utils.
 * Kept in types/ so build flavors can exclude dashboard screens without breaking shared logic.
 */
export interface SaleItem {
  id: string;
  productCode: string;
  quantity: number;
  barcode: string;
  description: string;
  /** Arabic product name for bilingual cart / receipts (optional) */
  descriptionArabic?: string | null;
  unit: string;
  inclusiveTax: boolean;
  inclusivePrice: number;
  unitPrice: number;
  taxRate?: number;
  discountPercent?: number;
  discountAmount?: number;
  maxDiscountPercent?: number;
  maxDiscountAmount?: number;
  availableUoms?: Array<{
    uom: string;
    conversion_factor: number;
    is_default: number;
  }>;
  prices?: Array<unknown>;
  batch?: string;
  expiry?: string;
  notes?: string;
  selectedTags?: string[];
}
