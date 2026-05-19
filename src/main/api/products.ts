export interface GetItemsParams {
  limit_start?: number;
  limit_page_length?: number;
}

export interface ProductItem {
  name?: string;
  item_code: string;
  item_name: string;
  item_name_arabic?: string | null;
  item_group?: string;
  description?: string;
  image?: string | null;
  custom_item_tag_list?: string[] | string | null;
  stock_uom?: string;
  purchase_uom?: string | null;
  sales_uom?: string | null;
  uoms?: Array<{
    uom: string;
    conversion_factor: number;
    is_default: number;
  }>;
  standard_rate?: number;
  current_price?: number;
  price_list?: string;
  prices?: Array<{
    price_list: string;
    price_list_rate: number;
    currency: string;
    uom: string;
    discount_percentage: number;
    discount_amount: number;
  }>;
  last_purchase_price?: number | null;
  last_purchase_cost?: number | null;
  last_sale_price?: number | null;
  last_sale_to_customer?: number | null;
  item_tax_template?: string;
  tax_category?: string;
  tax_rate?: number;
  item_taxes?: Array<{
    item_tax_template: string;
    tax_category: string;
    valid_from: string | null;
    tax_details: Array<{
      tax_type: string;
      tax_rate: number;
    }>;
  }>;
  warehouse?: string;
  warehouse_stock?: number;
  total_stock?: number;
  stock_by_warehouse?: any[];
  has_variants?: number;
  variant_of?: string | null;
  is_stock_item?: number;
  is_sales_item?: number;
  is_purchase_item?: number;
  has_batch_no?: number;
  has_serial_no?: number;
  disabled?: number;
  custom_is_favorite?: number;
  barcodes?: Array<{
    barcode: string;
    barcode_type: string;
  }>;
  stock?: any[];
  stock_qty?: number;
  [key: string]: any; // Allow for additional fields from API
}

export interface GetItemResponse {
  message?: {
    success_key?: number;
    message?: string;
    item?: ProductItem;
  };
  [key: string]: any;
}

export interface GetItemsResponse {
  message?: ProductItem[];
  [key: string]: any;
}

// Fetch multiple items from local database
export async function getItems(
  params: GetItemsParams = {},
): Promise<ProductItem[]> {
  // Use local database via IPC
  if (!window.products) {
    console.error('Products API not available');
    return [];
  }

  // Return all products from the local database (no pagination)
  const allProducts = ((await window.products.getAll()) as ProductItem[]) || [];
  if (!Array.isArray(allProducts)) {
    console.error('Products.getAll() returned non-array:', allProducts);
    return [];
  }
  return allProducts;
}

// Fetch single item by code from local database
export async function getItem(itemCode: string): Promise<ProductItem | null> {
  if (!itemCode) return null;

  // Use local database via IPC
  if (!window.products) {
    console.error('Products API not available');
    return null;
  }

  return (await window.products.get(itemCode)) as ProductItem | null;
}

// Fetch item by barcode
export interface GetItemByBarcodeResponse {
  message?: {
    success_key?: number;
    message?: string;
    item?: ProductItem;
  };
  [key: string]: any;
}

export async function getItemByBarcode(
  barcode: string,
): Promise<ProductItem | null> {
  if (!barcode?.trim()) return null;

  // Use local database via IPC
  if (!window.products) {
    console.error('Products API not available');
    return null;
  }

  return (await window.products.getByBarcode(
    barcode.trim(),
  )) as ProductItem | null;
}

export interface GetItemDetailsParams {
  item_code: string;
  customer: string;
}

export interface GetItemDetailsResponse {
  message?: {
    success_key?: number;
    message?: string;
    item?: ProductItem;
    pricing?: {
      unit_price?: number;
      price_list?: string;
      all_prices?: Array<any>;
      last_purchase_price?: number;
      last_purchase_cost?: number;
      last_sale_price?: number;
      last_sale_to_customer?: number;
    };
    pricing_visibility?: any;
    tax?: any;
  };
  [key: string]: any;
}

export interface CreateProductParams {
  item_code: string;
  item_name: string;
  item_group: string;
  stock_uom: string;
  standard_rate: number;
  description: string;
  barcode: string;
  is_stock_item: boolean;
  is_sales_item: boolean;
  is_purchase_item: boolean;
}

export interface CreateProductResponse {
  message?: {
    success_key?: number;
    message?: string;
    product?: ProductItem;
  };
}

export async function getItemDetails(
  item_code: string,
  customer: string,
): Promise<GetItemDetailsResponse | null> {
  if (!item_code || !customer) return null;
  try {
    const res = (await window.api.get(
      `/api/method/pos_api.api.get_item_details?item_code=${encodeURIComponent(item_code)}&customer=${encodeURIComponent(customer)}`,
    )) as GetItemDetailsResponse;
    return res;
  } catch (error) {
    console.error('Error fetching item details from API:', error);
    return null;
  }
}

export interface UpdateItemParams {
  item_code: string;
  item_name: string;
  item_group: string;
  standard_rate: number;
  description: string;
}

export async function updateItem(params: UpdateItemParams): Promise<any> {
  const formData = new URLSearchParams();
  formData.append('item_code', params.item_code);
  formData.append('item_name', params.item_name);
  formData.append('item_group', params.item_group);
  formData.append('standard_rate', String(params.standard_rate));
  formData.append('description', params.description);

  return window.api.post(
    '/api/method/pos_api.api.update_item',
    formData.toString(),
    { 'Content-Type': 'application/x-www-form-urlencoded' },
  );
}

export async function createProduct(
  params: CreateProductParams,
): Promise<CreateProductResponse> {
  const formData = new URLSearchParams();
  formData.append('item_code', params.item_code);
  formData.append('item_name', params.item_name);
  formData.append('item_group', params.item_group);
  formData.append('stock_uom', params.stock_uom);
  formData.append('standard_rate', String(params.standard_rate));
  formData.append('description', params.description);
  formData.append('barcode', params.barcode);
  formData.append('is_stock_item', params.is_stock_item ? '1' : '0');
  formData.append('is_sales_item', params.is_sales_item ? '1' : '0');
  formData.append('is_purchase_item', params.is_purchase_item ? '1' : '0');

  console.log('>>> Create product params:', {
    item_code: params.item_code,
    item_name: params.item_name,
    item_group: params.item_group,
    stock_uom: params.stock_uom,
    standard_rate: params.standard_rate,
    description: params.description,
    barcode: params.barcode,
  });
  console.log('>>> Create product formData:', formData.toString());

  const res = (await window.api.post(
    '/api/method/pos_api.api.create_item',
    formData.toString(),
    { 'Content-Type': 'application/x-www-form-urlencoded' },
  )) as CreateProductResponse;

  return res;
}
