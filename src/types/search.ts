export interface UserSearchResult {
  user_id: string;
  loc_acct: string | null;
  prin_crn: string | null;
  current_urn: string | null;
  historical_urns: string[];
  cma_version: string | null;
  cma_contract_id: string | null;
  decision_date: string | null;
  videocall_verified_date: string | null;
  card_activation_date: string | null;
  card_active_date: string | null;
  first_transaction_date: string | null;
  days_dormant: number | null;
  cycle_date: string | null;
  next_due_date: string | null;
  current_minimum_due: number | null;
  credit_limit: number | null;
  account_status: string | null;
}
