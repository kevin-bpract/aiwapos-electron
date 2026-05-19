export interface Customer {
  name: string;
  customer_name?: string;
  mobile_no?: string;
  tax_id?: string;
  custom_crn_no?: string;
  customer_group?: string;
  territory?: string;
  custom_is_default_customer?: number;
  email_id?: string;
  disabled?: number;
  custom_customer_arabic_name?: string;
  extra_data?: Record<string, any>;
}

export interface UpdateCustomerParams {
  customer_name: string;
  new_customer_name?: string;
  mobile_no?: string;
  email_id?: string;
  disabled?: number;
  tax_id?: string;
  custom_customer_arabic_name?: string;
  custom_crn_no?: string;
}
