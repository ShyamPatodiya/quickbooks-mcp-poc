export interface ItemSummary {
  id: string;
  name: string | null;
  type: string | null;
  description: string | null;
  unit_price: number | null;
  active: boolean | null;
}

export interface QboItem {
  Id?: string;
  Name?: string;
  Type?: string;
  Description?: string;
  UnitPrice?: number;
  Active?: boolean;
}

export interface CustomerSummary {
  id: string;
  display_name: string | null;
  given_name: string | null;
  family_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  active: boolean | null;
}

export interface InvoiceLineSummary {
  description: string | null;
  amount: number | null;
  quantity: number | null;
  unit_price: number | null;
  item_id: string | null;
}

export interface InvoiceSummary {
  id: string;
  doc_number: string | null;
  customer_id: string | null;
  txn_date: string | null;
  due_date: string | null;
  total_amount: number | null;
  balance: number | null;
  currency: string | null;
  line_items?: InvoiceLineSummary[];
}

export interface CustomerFinancialSummary {
  customer: {
    id: string;
    display_name: string | null;
    active: boolean | null;
  };
  invoice_count: number;
  total_invoiced: number | null;
  total_outstanding: number | null;
  overdue_invoice_count: number;
  overdue_amount: number | null;
  currency: string | null;
  limitations: string[];
}

export interface QboRef {
  value?: string;
  name?: string;
}

export interface QboCustomer {
  Id?: string;
  DisplayName?: string;
  GivenName?: string;
  FamilyName?: string;
  CompanyName?: string;
  Active?: boolean;
  PrimaryEmailAddr?: { Address?: string };
  PrimaryPhone?: { FreeFormNumber?: string };
}

export interface QboInvoiceLine {
  DetailType?: string;
  Description?: string;
  Amount?: number;
  SalesItemLineDetail?: {
    ItemRef?: QboRef;
    Qty?: number;
    UnitPrice?: number;
  };
}

export interface QboInvoice {
  Id?: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt?: number;
  Balance?: number;
  CurrencyRef?: QboRef;
  CustomerRef?: QboRef;
  Line?: QboInvoiceLine[];
}
