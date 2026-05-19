import { Customer, UpdateCustomerParams } from '../../types/customer';
export type { Customer };

export interface GetCustomersParams {
  limit_start?: number;
  limit_page_length?: number;
}

export interface GetCustomersResponse {
  message?: any;
  [key: string]: any;
}

export interface UpdateCustomerResponse {
  message?: {
    success_key?: number;
    message?: string;
    customer?: Customer;
  };
  [key: string]: any;
}

export async function getCustomers(
  params: GetCustomersParams = {},
): Promise<Customer[]> {
  // Use local database via IPC
  if (!window.customers) {
    console.error('Customers API not available');
    return [];
  }

  const { limit_start = 0, limit_page_length = 20 } = params;

  // Get all customers from local database
  const allCustomers = (await window.customers.getAll()) as Customer[];

  // Apply pagination
  const start = limit_start;
  const end = start + limit_page_length;
  return allCustomers.slice(start, end);
}

export interface CreateCustomerParams {
  customer_name: string;
  customer_type?: string;
  mobile_no?: string;
  email_id?: string;
  tax_id?: string;
  custom_customer_arabic_name?: string;
  custom_crn_no?: string;
}

export async function createCustomer(params: CreateCustomerParams): Promise<UpdateCustomerResponse> {
  const formData = new URLSearchParams();
  formData.append('customer_name', params.customer_name);
  formData.append('customer_type', params.customer_type ?? 'Individual');
  formData.append('mobile_no', params.mobile_no ?? '');
  formData.append('email_id', params.email_id ?? '');
  formData.append('tax_id', params.tax_id ?? '');
  formData.append('custom_customer_arabic_name', params.custom_customer_arabic_name ?? '');
  formData.append('custom_crn_no', params.custom_crn_no ?? '');

  const res = (await window.api.post(
    '/api/method/pos_api.api.create_customer',
    formData.toString(),
    { 'Content-Type': 'application/x-www-form-urlencoded' },
  )) as UpdateCustomerResponse;

  return res;
}

export async function updateCustomer(params: UpdateCustomerParams): Promise<UpdateCustomerResponse> {
  const formData = new URLSearchParams();
  formData.append('customer_name', params.customer_name);
  formData.append('new_customer_name', params.new_customer_name ?? '');
  formData.append('mobile_no', params.mobile_no ?? '');
  formData.append('email_id', params.email_id ?? '');
  formData.append('disabled', String(params.disabled ?? 0));
  formData.append('tax_id', params.tax_id ?? '');
  formData.append('custom_customer_arabic_name', params.custom_customer_arabic_name ?? '');
  formData.append('custom_crn_no', params.custom_crn_no ?? '');

  const res = (await window.api.post(
    '/api/method/pos_api.api.update_customer',
    formData.toString(),
    { 'Content-Type': 'application/x-www-form-urlencoded' },
  )) as UpdateCustomerResponse;

  return res;
}
