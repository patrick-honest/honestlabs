export type SearchField =
  | "user_id"
  | "urn"
  | "crn"
  | "loc"
  | "anonymous_id"
  | "application_id"
  | "phone"      // PII: input only, never displayed
  | "email";     // PII: input only, never displayed

export interface UrnHistoryEntry {
  urn: string;
  date: string;
}

export interface FreshworksTicket {
  ticket_id: string;
  subject: string | null;
  status: string | null;
  priority: string | null;
  category: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

export interface UserSearchResult {
  // Identity
  user_id: string;
  loc_acct: string | null;
  prin_crn: string | null;
  current_urn: string | null;
  current_urn_date: string | null;
  card_type: string | null;
  card_pgm: string | null;        // raw card program code (e.g. "10021")
  product_type: string | null;    // human-readable product type
  card_brand: string | null;
  credit_limit: number | null;

  // Previous URNs
  previous_urns: UrnHistoryEntry[];

  // Timeline
  decision_date: string | null;
  pin_set_date: string | null;
  videocall_verified_date: string | null;
  card_activation_date: string | null;
  cma_accepted_date: string | null;  // Cardholder agreement accepted
  cma_app_version: string | null;    // App version when CMA was signed

  // Account snapshot
  account_status: string | null;
  cycle_date: string | null;
  next_due_date: string | null;
  current_min_due: number | null;
  current_dpd: number | null;
  collections_status: string | null;

  // Banking
  savings_account_number: string | null;

  // Delivery
  awb_number: string | null;
  awb_status: string | null;
  delivery_date: string | null;    // actual delivery date from tracking

  // Blocks / Restrictions
  card_status: string | null;
  restriction_status: string | null;
  has_spending_block: boolean;

  // Repayment history
  repayment_history: RepaymentEntry[];

  // Freshworks
  open_tickets: FreshworksTicket[];
  ticket_history: FreshworksTicket[];
}

export interface RepaymentEntry {
  repayment_code: string | null;
  vendor: string | null;
  amount: string | null;
  currency: string | null;
  date: string | null;
}

export interface SearchResultResponse {
  user: UserSearchResult;
  asOf: string;
  cached: boolean;
}
