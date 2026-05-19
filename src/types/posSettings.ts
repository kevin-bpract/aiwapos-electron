export interface ModeOfPaymentDetail {
  mode_of_payment: string;
}

export interface SalesPersonDetail {
  sales_person: string;
  user: string;
  mode_of_payment: string;
  warehouse: string;
  cost_center: string;
  price_list: string;

  default_tax_category: string | null;
  sales_taxes_and_charges: string | null;
  is_this_tax_included_in_basic_rate: number;
  last_sale_to_customer: number;
  last_sale_price: number;
  last_purchase_cost: number;
  last_purchase_price: number;
  warehouse_list: number;
  stock_quantity: number;
  uom: number;
  edit_item_rate: number;
  enable_branch: number;
  branch: string | null;
}

export interface PrintFormatDetail {
  print_format: string;
  label: string;
  doctype_name: string;
  is_default: number;
  description: string | null;
}

export interface POSSettings {
  company: string;
  view_all_transaction_role: string;
  default_target_warehouse: string;
  is_this_tax_included_in_basic_rate: string; // comes as "0"
  enable_customer_based_price_list: number;
  override_sales_team_in_customer: number;
  payment_entry_based_on_sales_person: number;
  deduction_account: string;
  cost_center: string;

  edit_item_rate: number;

  mode_of_payment_details: ModeOfPaymentDetail[];
  sales_person_details: SalesPersonDetail[];
  print_format_details: PrintFormatDetail[];
}

export interface POSSettingsResponse {
  message: {
    success_key: number;
    message: string;
    settings: POSSettings;
  };
}
