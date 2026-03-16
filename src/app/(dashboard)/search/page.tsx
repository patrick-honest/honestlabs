"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { UserSearchForm } from "@/components/search/user-search-form";
import { UserInfoCard } from "@/components/search/user-info-card";
import type { UserSearchResult } from "@/types/search";

// Mock result for demo purposes
const mockUser: UserSearchResult = {
  user_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  loc_acct: "LOC-0012345",
  prin_crn: "CRN-9876543",
  current_urn: "URN-2024-001",
  historical_urns: ["URN-2023-042", "URN-2023-018"],
  cma_version: "v3.2.1",
  cma_contract_id: "CTR-20240315-001",
  decision_date: "2024-03-15",
  videocall_verified_date: "2024-03-17",
  card_activation_date: "2024-03-20",
  card_active_date: "2024-03-20",
  first_transaction_date: "2024-03-22",
  days_dormant: 0,
  cycle_date: "2024-04-01",
  next_due_date: "2024-04-25",
  current_minimum_due: 250000,
  credit_limit: 15000000,
  account_status: "ACTIVE",
};

export default function SearchPage() {
  const [result, setResult] = useState<UserSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (userId: string) => {
    setLoading(true);
    setSearched(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 800));
    // For demo, return mock data if UUID-like, else null
    if (userId.length >= 8) {
      setResult({ ...mockUser, user_id: userId });
    } else {
      setResult(null);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col">
      <Header title="User Search" />

      <div className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold text-white">User Search</h2>
          <p className="mt-1 text-sm text-slate-400">
            Look up a cardholder by user ID to view account details
          </p>
        </div>

        <UserSearchForm onSearch={handleSearch} isLoading={loading} />

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}

        {!loading && result && <UserInfoCard user={result} />}

        {!loading && searched && !result && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
            <p className="text-sm text-slate-400">
              No user found. Please check the user ID and try again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
