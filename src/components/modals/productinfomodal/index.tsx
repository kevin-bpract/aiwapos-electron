import React, { useState, useEffect } from 'react';
import Button from '../../ui/buttom';
import { ProductItem, getItem, getItemDetails } from '../../../main/api/products';

import { POSSettings } from '../../../types/posSettings';
import { useAuth } from '../../../renderer/contexts/AuthContext';

interface Props {
  product?: ProductItem | null;
  itemCode?: string;
  customerCode?: string | null;
  initialData?: Partial<SalesDetailsData>;
  onClose: () => void;
  onSave?: (data: SalesDetailsData) => void;
}

export interface SalesDetailsData {
  product: ProductItem | null;
  quantity: number;
  unit: string;
  inclusiveTax: boolean;
  inclusivePrice: number;
  unitPrice: number;
  totalAmount: number;
  discountPercent: number;
  discountAmount: number;
  taxable: number;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;
  batch?: string;
  expiry?: string;
  notes?: string;
}

const ProductInfoModal: React.FC<Props> = ({
  product,
  itemCode,
  customerCode,
  initialData,
  onClose,
  onSave,
}) => {
  const { user } = useAuth();
  const [userPriceList, setUserPriceList] = useState<string>('Standard');
  const [canEditRate, setCanEditRate] = useState<boolean>(false);



  useEffect(() => {
    const fetchUserPriceList = async () => {
      try {
        const settings: POSSettings | null = await window.posSettings.get();
        if (settings) {
          const salesPersonDetail = user
            ? settings.sales_person_details?.find(
              (sp) =>
                sp.user.toLowerCase() === user.toLowerCase() ||
                sp.sales_person.toLowerCase() === user.toLowerCase(),
            )
            : settings.sales_person_details?.[0];

          // Check for edit rate permission
          setCanEditRate(salesPersonDetail?.edit_item_rate === 1);

          if (salesPersonDetail?.price_list) {
            setUserPriceList(salesPersonDetail.price_list);
          }


          // Initialize inclusiveTax from settings if not provided in initialData
          if (initialData?.inclusiveTax === undefined) {
            const isTaxIncluded =
              (salesPersonDetail?.is_this_tax_included_in_basic_rate ??
                parseInt(settings.is_this_tax_included_in_basic_rate || '0')) ===
              1;

            setFormData((prev) => ({
              ...prev,
              inclusiveTax: isTaxIncluded,
            }));
          }

        }
      } catch (error) {
        console.error(
          'Error fetching user price list from POS settings:',
          error,
        );
      }
    };

    fetchUserPriceList();
  }, []);


  useEffect(() => {
    if (userPriceList && userPriceList !== 'Standard') {
      const currentProduct = fullProduct || product;
      if (!currentProduct) return;

      const newPrice = getPriceByUserPriceList(currentProduct, formData.unit);

      if (
        !initialData?.inclusivePrice &&
        newPrice !== formData.inclusivePrice
      ) {
        setFormData((prev) => ({
          ...prev,
          inclusivePrice: newPrice,
          unitPrice: newPrice,
          totalAmount: newPrice * prev.quantity,
          taxable: newPrice,
          lineTotal: newPrice * prev.quantity,
        }));
      }
    }
  }, [userPriceList]);

  const getPriceByUserPriceList = (
    productData: ProductItem | null,
    uom: string,
  ): number => {
    if (!productData?.prices) return productData?.standard_rate || 0;

    const priceEntry = productData.prices.find(
      (price: any) =>
        price.price_list === userPriceList &&
        price.uom?.toLowerCase() === uom.toLowerCase(),
    );

    return priceEntry?.price_list_rate || productData.standard_rate || 0;
  };

  const [fullProduct, setFullProduct] = useState<ProductItem | null>(
    product || null,
  );
  const [loading, setLoading] = useState(false);
  const [apiHistoricalPrices, setApiHistoricalPrices] = useState<{
    lastPurchasePrice: number;
    lastPurchaseCost: number;
    lastSalePrice: number;
    lastSaleToCustomer: number;
  } | null>(null);
  const [formData, setFormData] = useState<SalesDetailsData>(() => {
    const initialUnit = initialData?.unit || product?.stock_uom || '';
    const initialPrice =
      initialData?.inclusivePrice ??
      getPriceByUserPriceList(product || null, initialUnit);

    return {
      product: product || null,
      quantity: initialData?.quantity ?? 1,
      unit: initialUnit,
      inclusiveTax: initialData?.inclusiveTax ?? false,
      inclusivePrice: initialPrice,
      unitPrice: initialData?.unitPrice ?? initialPrice,
      totalAmount: initialData?.totalAmount ?? initialPrice,
      discountPercent: initialData?.discountPercent ?? 0,
      discountAmount: initialData?.discountAmount ?? 0,
      taxable: initialData?.taxable ?? initialPrice,
      taxPercent: initialData?.taxPercent ?? 15,
      taxAmount: initialData?.taxAmount ?? 0,
      lineTotal: initialData?.lineTotal ?? initialPrice,
      batch: initialData?.batch || '',
      expiry: initialData?.expiry || '',
      notes: initialData?.notes || '',
    };
  });

  const [rateInputText, setRateInputText] = useState<string>(
    formData.inclusiveTax ? formData.inclusivePrice.toFixed(2) : formData.unitPrice.toFixed(2)
  );

  // Sync internal display text if the core pricing updates programmatically (like changing UOM)
  useEffect(() => {
    setRateInputText(
      formData.inclusiveTax ? formData.inclusivePrice.toFixed(2) : formData.unitPrice.toFixed(2)
    );
  }, [formData.inclusivePrice, formData.unitPrice, formData.inclusiveTax]);

  const [uomOptions, setUomOptions] = useState<
    { uom: string; conversion_factor: number; is_default: number }[]
  >(() => {
    if (product && Array.isArray(product.uoms) && product.uoms.length > 0) {
      return product.uoms.map((u) => ({
        uom: u.uom || product.stock_uom || 'PCS',
        conversion_factor: u.conversion_factor || 1,
        is_default: u.is_default || 0,
      }));
    }
    return [
      {
        uom: product?.stock_uom || 'PCS',
        conversion_factor: 1.0,
        is_default: 1,
      },
    ];
  });

  useEffect(() => {
    const fetchProductDetails = async () => {
      const codeToFetch = itemCode || product?.item_code;
      if (!codeToFetch) return;

      setLoading(true);
      try {
        const fetchedProduct = await getItem(codeToFetch);
        if (fetchedProduct) {
          setFullProduct(fetchedProduct);

          const selectedUnit = formData.unit || fetchedProduct.stock_uom;
          const basePrice = getPriceByUserPriceList(
            fetchedProduct,
            selectedUnit,
          );
          setFormData((prev) => {
            // If initialData supplied prices (item is from cart), keep them.
            // Only use the DB price when opening fresh (no initialData prices).
            const hasExistingPrices =
              initialData?.inclusivePrice !== undefined ||
              initialData?.unitPrice !== undefined;

            return {
              ...prev,
              product: fetchedProduct,
              unit: selectedUnit,
              ...(hasExistingPrices
                ? {}
                : {
                  inclusivePrice: basePrice,
                  unitPrice: basePrice,
                  totalAmount: basePrice * prev.quantity,
                  taxable: basePrice,
                  lineTotal: basePrice * prev.quantity,
                }),
            };
          });

          if (
            Array.isArray(fetchedProduct.uoms) &&
            fetchedProduct.uoms.length > 0
          ) {
            setUomOptions(
              fetchedProduct.uoms.map((u) => ({
                uom: u.uom || fetchedProduct.stock_uom || 'PCS',
                conversion_factor: u.conversion_factor || 1,
                is_default: u.is_default || 0,
              })),
            );
          } else if (fetchedProduct.stock_uom) {
            setUomOptions([
              {
                uom: fetchedProduct.stock_uom,
                conversion_factor: 1.0,
                is_default: 1,
              },
            ]);
          }
        }
      } catch (error) {
        console.error('Error fetching product details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [itemCode, product?.item_code]);

  // Fetch live pricing data from API when product or customer changes
  useEffect(() => {
    const fetchApiPricing = async () => {
      const codeToFetch = itemCode || product?.item_code;
      if (!codeToFetch || !customerCode) return;

      try {
        const apiDetails = await getItemDetails(codeToFetch, customerCode);
        if (apiDetails?.message?.pricing) {
          const pricing = apiDetails.message.pricing;
          setApiHistoricalPrices({
            lastPurchasePrice: pricing.last_purchase_price ?? 0,
            lastPurchaseCost: pricing.last_purchase_cost ?? 0,
            lastSalePrice: pricing.last_sale_price ?? 0,
            lastSaleToCustomer: pricing.last_sale_to_customer ?? 0,
          });
        }
      } catch (err) {
        console.error('Error fetching item details for pricing:', err);
      }
    };
    fetchApiPricing();
  }, [itemCode, product?.item_code, customerCode]);

  useEffect(() => {
    const {
      quantity,
      unitPrice,
      discountPercent,
      taxPercent,
    } = formData;

    const taxRate = taxPercent / 100;

    // Unit Price in state IS pre-tax
    const truePreTaxUnitPrice = unitPrice;

    // Calculate discount on pre-tax amount — rounded to avoid floating point errors
    const discountAmount = Number(((truePreTaxUnitPrice * quantity * discountPercent) / 100).toFixed(4));

    // Taxable amount (net)
    const taxable = Number((truePreTaxUnitPrice * quantity - discountAmount).toFixed(4));

    // Tax amount
    const taxAmount = Number((taxable * taxRate).toFixed(4));

    // Line total (gross)
    const lineTotal = Number((taxable + taxAmount).toFixed(4));

    setFormData((prev) => ({
      ...prev,
      discountAmount,
      taxable,
      taxAmount,
      lineTotal,
      totalAmount: lineTotal,
    }));
  }, [
    formData.quantity,
    formData.unitPrice,
    formData.discountPercent,
    formData.taxPercent,
  ]);

  const handleInputChange = (
    field: keyof SalesDetailsData,
    value: string | number | boolean,
  ) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      const taxRate = prev.taxPercent / 100;

      if (field === 'unit' && typeof value === 'string') {
        const newPrice = getPriceByUserPriceList(fullProduct, value);
        if (prev.inclusiveTax) {
          // Input is inclusive
          updated.inclusivePrice = newPrice;
          updated.unitPrice = newPrice / (1 + taxRate);
        } else {
          // Input is exclusive
          updated.unitPrice = newPrice;
          updated.inclusivePrice = newPrice * (1 + taxRate);
        }
      }

      if (field === 'unitPrice' && typeof value === 'number') {
        // Here unitPrice is the "Basic Rate" field
        if (prev.inclusiveTax) {
          // Basic Rate is Inclusive
          updated.inclusivePrice = value;
          updated.unitPrice = value / (1 + taxRate);
        } else {
          // Basic Rate is Exclusive
          updated.unitPrice = value;
          updated.inclusivePrice = value * (1 + taxRate);
        }
      }

      if (field === 'inclusivePrice' && typeof value === 'number') {
        updated.inclusivePrice = value;
        updated.unitPrice = value / (1 + taxRate);
      }

      if (field === 'inclusiveTax' && typeof value === 'boolean') {
        if (value) {
          // Switch to Inclusive: Input was prev.unitPrice (exclusive)
          // We keep inclusivePrice and derive new true unitPrice?
          // Actually, let's keep inclusivePrice and derive unitPrice.
          updated.unitPrice = prev.inclusivePrice / (1 + taxRate);
        } else {
          // Switch to Exclusive:
          updated.unitPrice = prev.unitPrice; // unitPrice is always pre-tax
          updated.inclusivePrice = prev.unitPrice * (1 + taxRate);
        }
      }

      if (field === 'taxPercent' && typeof value === 'number') {
        const newRate = value / 100;
        updated.inclusivePrice = prev.unitPrice * (1 + newRate);
      }

      return updated;
    });
  };

  const handleSave = () => {
    if (onSave) {
      onSave(formData);
    }
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
        return;
      }

      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData, onSave, onClose]);

  // Get price list data from fullProduct (prioritize) or product
  const priceListData = (fullProduct?.prices || product?.prices || []).filter(
    (price: any) => price && price.price_list_rate !== undefined,
  );

  const stockByWarehouse = fullProduct?.stock_by_warehouse || [];

  // Get the UOM data used for both table and select dropdown
  const tableUomData =
    Array.isArray(fullProduct?.uoms) && fullProduct!.uoms!.length > 0
      ? fullProduct!.uoms!
      : uomOptions;

  // Get selected UOM conversion factor
  const selectedUomFactor =
    tableUomData.find((u) => u.uom === formData.unit)?.conversion_factor || 1;

  // Calculate historical prices: prefer live API data, fallback to local DB * UOM factor
  const historicalPrices = {
    lastPurchasePrice: apiHistoricalPrices
      ? apiHistoricalPrices.lastPurchasePrice * selectedUomFactor
      : (fullProduct?.last_purchase_price ?? 0.0) * selectedUomFactor,
    lastPurchaseCost: apiHistoricalPrices
      ? apiHistoricalPrices.lastPurchaseCost * selectedUomFactor
      : (fullProduct?.last_purchase_cost ?? 0.0) * selectedUomFactor,
    lastSalePrice: apiHistoricalPrices
      ? apiHistoricalPrices.lastSalePrice * selectedUomFactor
      : (fullProduct?.last_sale_price ?? 0.0) * selectedUomFactor,
    lastSaleToCustomer: apiHistoricalPrices
      ? apiHistoricalPrices.lastSaleToCustomer * selectedUomFactor
      : (fullProduct?.last_sale_to_customer ?? 0.0) * selectedUomFactor,
  };

  const selectedCustomerType = priceListData.filter((price) => {
    return price.price_list === userPriceList;
  });

  const filtedProducts = priceListData.filter((price) => {
    if (!price.uom) return false;
    return price.uom.toLowerCase() === formData.unit.toLowerCase();
  });

  const discounts = priceListData.filter((price) => {
    if (!price.uom || !formData.unit) return false;

    const sameUom = price.uom.toLowerCase() === formData.unit.toLowerCase();

    const hasDiscount =
      price.discount_amount != null || price.discount_percentage != null;

    return sameUom && hasDiscount;
  });

  const maxDiscount = discounts.reduce(
    (acc, d) => ({
      discount_amount: Math.max(acc.discount_amount, d.discount_amount || 0),
      discount_percentage: Math.max(
        acc.discount_percentage,
        d.discount_percentage || 0,
      ),
    }),
    { discount_amount: 0, discount_percentage: 0 },
  );

  useEffect(() => {
    // Only cap the discount if user has entered a value exceeding the allowed max.
    // Never auto-fill the discount — default should always be 0 (user's choice).
    if (maxDiscount.discount_percentage > 0 && formData.discountPercent > maxDiscount.discount_percentage) {
      setFormData((prev) => ({ ...prev, discountPercent: maxDiscount.discount_percentage }));
    }
    if (maxDiscount.discount_amount > 0 && formData.discountAmount > maxDiscount.discount_amount) {
      setFormData((prev) => ({ ...prev, discountAmount: maxDiscount.discount_amount }));
    }
  }, [
    maxDiscount.discount_percentage,
    maxDiscount.discount_amount,
    formData.discountPercent,
    formData.discountAmount,
  ]);

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h4 className="text-lg font-semibold text-gray-800">
            &lt;&lt; Sales Details
          </h4>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading product details...</div>
            </div>
          ) : (
            <div className="flex gap-4">
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product:
                  </label>
                  <input
                    type="text"
                    value={
                      fullProduct
                        ? `${fullProduct.item_name || ''}${fullProduct.item_name_arabic ? ' — ' + fullProduct.item_name_arabic : ''} (${fullProduct.item_code || ''})`
                        : ''
                    }
                    readOnly
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-gray-700"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity :
                    </label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) =>
                        handleInputChange(
                          'quantity',
                          parseInt(e.target.value, 10) || 0,
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      min="1"
                      step="1"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit :
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) =>
                        handleInputChange('unit', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    >
                      {tableUomData.map((option: any, index: number) => (
                        <option key={index} value={option.uom}>
                          {option.uom}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.inclusiveTax ? 'Basic Rate (Tax Inclusive):' : 'Basic Rate (Tax Exclusive):'}
                    </label>
                    <input
                      type="text"
                      value={rateInputText}
                      onChange={(e) => setRateInputText(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => {
                        const val = parseFloat(rateInputText) || 0;
                        handleInputChange('unitPrice', val);
                        setRateInputText(val.toFixed(2));
                      }}
                      readOnly={!canEditRate}
                      className={`w-full px-3 py-2 border rounded text-sm font-bold ${canEditRate
                        ? 'border-gray-300 text-blue-700 bg-white'
                        : 'border-transparent text-gray-500 bg-gray-100'
                        }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.inclusiveTax ? 'Unit Price (Pre-Tax):' : 'Inclusive Price (Post-Tax):'}
                    </label>
                    <input
                      type="number"
                      value={formData.inclusiveTax ? formData.unitPrice.toFixed(2) : formData.inclusivePrice.toFixed(2)}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      TotalAmount :
                    </label>
                    <input
                      type="number"
                      value={formData.totalAmount.toFixed(2)}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Disc %:
                    </label>
                    <input
                      type="number"
                      value={formData.discountPercent}
                      onChange={(e) =>
                        handleInputChange(
                          'discountPercent',
                          parseFloat(e.target.value),
                        )
                      }
                      max={maxDiscount.discount_percentage}
                      step="0.001"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-xs text-gray-500">
                      Max allowed: {maxDiscount.discount_percentage}%
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Disc Amount:
                    </label>
                    <input
                      type="number"
                      value={Number(formData.discountAmount.toFixed(4))}
                      onChange={(e) =>
                        handleInputChange(
                          'discountAmount',
                          parseFloat(e.target.value),
                        )
                      }
                      max={maxDiscount.discount_amount}
                      step="0.001"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-xs text-gray-500">
                      Max allowed: {maxDiscount.discount_amount}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="inclusiveTax"
                      checked={formData.inclusiveTax}
                      onChange={(e) =>
                        handleInputChange('inclusiveTax', e.target.checked)
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="inclusiveTax"
                      className="text-sm font-medium text-gray-700 cursor-pointer"
                    >
                      Is this Tax included in Basic Rate?
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Taxable:
                    </label>
                    <input
                      type="number"
                      value={formData.taxable.toFixed(2)}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax %:
                    </label>
                    <input
                      type="number"
                      value={formData.taxPercent.toFixed(2)}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-gray-600"
                      step="0.001"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Amount:
                    </label>
                    <input
                      type="number"
                      value={formData.taxAmount.toFixed(2)}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Line Total:
                    </label>
                    <input
                      type="number"
                      value={formData.lineTotal.toFixed(2)}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-gray-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes:
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    rows={3}
                  />
                </div>
              </div>

              <div className="w-64 space-y-4">
                <div className="space-y-2">
                  <div className="bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium">
                    Last Purchase Price
                  </div>
                  <div className="bg-gray-100 px-3 py-2 rounded text-sm text-gray-800 text-right">
                    {historicalPrices.lastPurchasePrice.toFixed(2)}
                  </div>

                  <div className="bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium">
                    Last Purchase Cost
                  </div>
                  <div className="bg-gray-100 px-3 py-2 rounded text-sm text-gray-800 text-right">
                    {historicalPrices.lastPurchaseCost.toFixed(2)}
                  </div>

                  <div className="bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium">
                    Last Sale Price
                  </div>
                  <div className="bg-gray-100 px-3 py-2 rounded text-sm text-gray-800 text-right">
                    {historicalPrices.lastSalePrice.toFixed(2)}
                  </div>

                  <div className="bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium">
                    Last Sale To Customer
                  </div>
                  <div className="bg-gray-100 px-3 py-2 rounded text-sm text-gray-800 text-right">
                    {historicalPrices.lastSaleToCustomer.toFixed(2)}
                  </div>
                </div>

                {/* UOM Table */}
                <div>
                  <div className="text-sm font-medium mb-2">
                    Product Packing Details
                  </div>
                  <div className="border border-gray-300 rounded overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-2 py-1 text-left border-b border-gray-300 whitespace-nowrap">
                            UOM
                          </th>
                          <th className="px-2 py-1 text-right border-b border-gray-300 whitespace-nowrap">
                            Conv. Rate
                          </th>
                          <th className="px-2 py-1 text-right border-b border-gray-300 whitespace-nowrap">
                            W Stock Qty
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableUomData.map((option: any, index: number) => {
                          const conversionFactor = Number(
                            option.conversion_factor ||
                            option.conversionFactor ||
                            1,
                          );
                          return (
                            <tr key={index}>
                              <td className="px-2 py-1 border-b border-gray-200 bg-blue-50 whitespace-nowrap">
                                {option.uom}
                              </td>
                              <td className="px-2 py-1 border-b border-gray-200 text-right whitespace-nowrap">
                                {conversionFactor.toFixed(2)}
                              </td>
                              <td className="px-2 py-1 border-b border-gray-200 text-right whitespace-nowrap">
                                {/* Fixed warehouse stock calculation - using example data */}
                                {fullProduct?.stock
                                  ?.reduce(
                                    (total: number, stockItem: any) =>
                                      total + (stockItem.qty || 0),
                                    0,
                                  )
                                  ?.toFixed(0) || '0'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Price List Table */}
                {filtedProducts.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2 mt-4">
                      Price List
                    </div>
                    <div className="border border-gray-300 rounded overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-2 py-1 text-left border-b border-gray-300 whitespace-nowrap">
                              Type
                            </th>
                            <th className="px-2 py-1 text-right border-b border-gray-300 whitespace-nowrap">
                              Price
                            </th>
                            <th className="px-2 py-1 text-right border-b border-gray-300 whitespace-nowrap">
                              Disc %
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtedProducts.map((price: any, index: number) => (
                            <tr key={index}>
                              <td className="px-2 py-1 border-b border-gray-200 bg-blue-50 whitespace-nowrap">
                                {price.price_list || 'Standard'}
                              </td>
                              <td className="px-2 py-1 border-b border-gray-200 text-right whitespace-nowrap">
                                {Number(price.price_list_rate || 0).toFixed(2)}
                              </td>
                              <td className="px-2 py-1 border-b border-gray-200 text-right whitespace-nowrap">
                                {Number(price.discount_percentage || 0).toFixed(
                                  2,
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Stock By Warehouse Table */}
                {stockByWarehouse.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2 mt-4">
                      Stock By Warehouse
                    </div>
                    <div className="border border-gray-300 rounded overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-2 py-1 text-left border-b border-gray-300 whitespace-nowrap">
                              Warehouse
                            </th>
                            <th className="px-2 py-1 text-right border-b border-gray-300 whitespace-nowrap">
                              Actual Quantity
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {stockByWarehouse.map((stock: any, index: number) => (
                            <tr key={index}>
                              <td className="px-2 py-1 border-b border-gray-200 bg-blue-50 whitespace-nowrap">
                                {stock.warehouse || 'Warehouse'}
                              </td>
                              <td className="px-2 py-1 border-b border-gray-200 text-right whitespace-nowrap">
                                {Number(stock.actual_qty || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-center gap-3">
          <Button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gray-500 text-white rounded font-medium hover:bg-gray-600"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 bg-gray-600 text-white rounded font-medium hover:bg-gray-700"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductInfoModal;
