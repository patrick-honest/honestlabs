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
  product_type: string | null;
  card_brand: string | null;
  credit_limit: number | null;

  // Previous URNs
  previous_urns: UrnHistoryEntry[];

  // Timeline
  decision_date: string | null;
  pin_set_date: string | null;
  videocall_verified_date: string | null;
  card_activation_date: string | null;

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

  // Blocks / Restrictions
  card_status: string | null;
  restriction_status: string | null;
  has_spending_block: boolean;

  // Freshworks
  open_tickets: FreshworksTicket[];
  ticket_history: FreshworksTicket[];
}

export interface SearchResultResponse {
  user: UserSearchResult;
  asOf: string;
  cached: boolean;
}
