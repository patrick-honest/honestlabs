"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

// ── KPI definitions ─────────────────────────────────────────────────

export interface KpiDefinition {
  id: string;
  label: string;
  category: string;
  unit: "count" | "percent" | "idr" | "usd" | "ratio";
  description?: string;
}

export const AVAILABLE_KPIS: KpiDefinition[] = [
  // Acquisition
  { id: "applications_submitted", label: "Applications Submitted", category: "Acquisition", unit: "count" },
  { id: "application_approval_rate", label: "Approval Rate", category: "Acquisition", unit: "percent" },
  { id: "application_completion_under_10min", label: "App Completion < 10 min", category: "Acquisition", unit: "percent" },
  { id: "referral_share_approvals", label: "Referral Share Approvals", category: "Acquisition", unit: "count" },
  { id: "referral_approval_rate", label: "Referral Approval Rate", category: "Acquisition", unit: "percent" },

  // Activation
  { id: "account_activation_rate", label: "Account Activation Rate", category: "Activation", unit: "percent" },
  { id: "account_setup_rate", label: "Account Setup Rate", category: "Activation", unit: "percent" },
  { id: "spend_activation_rate", label: "Spend Activation Rate", category: "Activation", unit: "percent" },
  { id: "welcome_call_activation_rate", label: "Welcome Call → Spend Activation", category: "Activation", unit: "percent" },
  { id: "card_delivery_rate", label: "Card Delivery Rate", category: "Activation", unit: "percent" },
  { id: "push_notification_enabled", label: "Push Notification Enabled", category: "Activation", unit: "percent" },

  // Spend
  { id: "active_purchase_rate", label: "Active Purchase Rate", category: "Spend", unit: "percent" },
  { id: "avg_spend_per_user", label: "Avg Spend per User", category: "Spend", unit: "idr" },
  { id: "avg_spend_online", label: "Avg Spend Online", category: "Spend", unit: "idr" },
  { id: "avg_spend_offline", label: "Avg Spend Offline", category: "Spend", unit: "idr" },
  { id: "avg_txn_per_user", label: "Avg Txn per User", category: "Spend", unit: "ratio" },
  { id: "total_spend_volume", label: "Total Spend Volume", category: "Spend", unit: "idr" },
  { id: "physical_card_spend_active", label: "Physical Card Spend Active", category: "Spend", unit: "count" },
  { id: "online_spend_active", label: "Online Spend Active", category: "Spend", unit: "count" },
  { id: "tap_to_pay_spend_active", label: "Tap to Pay Spend Active", category: "Spend", unit: "count" },

  // QRIS
  { id: "qris_spend_active_rate", label: "QRIS Spend Active Rate", category: "QRIS", unit: "percent" },
  { id: "qris_trx_per_user", label: "QRIS Txn per User", category: "QRIS", unit: "ratio" },
  { id: "qris_avg_txn_amount", label: "QRIS Avg Txn Amount", category: "QRIS", unit: "idr" },
  { id: "qris_avg_spend_per_user", label: "QRIS Avg Spend per User", category: "QRIS", unit: "idr" },
  { id: "qris_total_spend_pct", label: "QRIS Total Spend %", category: "QRIS", unit: "percent" },

  // Portfolio
  { id: "card_stock", label: "Card Stock", category: "Portfolio", unit: "count" },
  { id: "eligible_accounts", label: "Eligible Accounts", category: "Portfolio", unit: "count" },
  { id: "undelivered_rate", label: "Undelivered Rate", category: "Portfolio", unit: "percent" },

  // Risk
  { id: "dpd_0_rate", label: "Current (0 DPD) %", category: "Risk", unit: "percent" },
  { id: "dpd_1_30_rate", label: "1–30 DPD Rate", category: "Risk", unit: "percent" },
  { id: "dpd_31_60_rate", label: "31–60 DPD Rate", category: "Risk", unit: "percent" },
  { id: "dpd_61_90_rate", label: "61–90 DPD Rate", category: "Risk", unit: "percent" },
  { id: "dpd_90_plus_rate", label: "90+ DPD Rate", category: "Risk", unit: "percent" },
  { id: "write_off_rate", label: "Write-Off Rate", category: "Risk", unit: "percent" },
  { id: "net_credit_loss", label: "Net Credit Loss", category: "Risk", unit: "percent" },
  { id: "gross_loss_rate", label: "Gross Loss Rate", category: "Risk", unit: "percent" },

  // Collections
  { id: "collection_rate", label: "Collection Rate", category: "Collections", unit: "percent" },
  { id: "recovery_rate", label: "Recovery Rate", category: "Collections", unit: "percent" },
  { id: "promise_to_pay_rate", label: "Promise to Pay Rate", category: "Collections", unit: "percent" },
  { id: "admin_fee_refund_ratio", label: "Admin Fee Refund Ratio", category: "Collections", unit: "percent" },

  // Savings
  { id: "savings_open_success_rate", label: "Savings Open Success Rate", category: "Savings", unit: "percent" },
  { id: "savings_enrollment_rate", label: "Savings Enrollment Rate", category: "Savings", unit: "percent" },
  { id: "savings_deposit_amount", label: "Savings Deposit Amount", category: "Savings", unit: "idr" },
  { id: "savings_closing_balance", label: "Savings Closing Balance", category: "Savings", unit: "idr" },

  // Revenue
  { id: "cashback_amount", label: "Cashback Amount", category: "Revenue", unit: "idr" },
  { id: "points_value_created", label: "Points Value Created", category: "Revenue", unit: "idr" },
  { id: "avg_redemption_value", label: "Avg Redemption Value", category: "Revenue", unit: "idr" },
];

const CATEGORIES = [...new Set(AVAILABLE_KPIS.map((k) => k.category))];

// ── KPI Selector Component ──────────────────────────────────────────

interface KpiSelectorProps {
  selected: string[];
  onChange: (kpiIds: string[]) => void;
  maxSelections?: number;
}

export function KpiSelector({ selected, onChange, maxSelections = 8 }: KpiSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = AVAILABLE_KPIS.filter(
    (k) =>
      k.label.toLowerCase().includes(search.toLowerCase()) ||
      k.category.toLowerCase().includes(search.toLowerCase())
  );

  const toggleKpi = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (selected.length < maxSelections) {
      onChange([...selected, id]);
    }
  };

  const removeKpi = (id: string) => {
    onChange(selected.filter((s) => s !== id));
  };

  return (
    <div ref={ref} className="relative">
      {/* Selected KPI chips */}
      <div
        className={cn(
          "flex flex-wrap gap-1.5 min-h-[44px] rounded-xl border px-3 py-2 cursor-pointer transition-colors",
          isDark
            ? "border-[var(--border)] bg-[var(--surface)] hover:border-[#5B22FF]/40"
            : "border-[var(--border)] bg-[var(--surface)] hover:border-[#D00083]/40"
        )}
        onClick={() => setOpen(true)}
      >
        {selected.length === 0 && (
          <span className="text-xs text-[var(--text-muted)] py-0.5">
            Click to select KPIs (up to {maxSelections})...
          </span>
        )}
        {selected.map((id) => {
          const kpi = AVAILABLE_KPIS.find((k) => k.id === id);
          if (!kpi) return null;
          return (
            <span
              key={id}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium",
                isDark
                  ? "bg-[#5B22FF]/15 text-[#B39DFF]"
                  : "bg-[#D00083]/10 text-[#D00083]"
              )}
            >
              {kpi.label}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeKpi(id);
                }}
                className="hover:text-[var(--danger)] transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border shadow-2xl",
            isDark
              ? "border-[var(--border)] bg-[#141226] shadow-black/50"
              : "border-[var(--border)] bg-white shadow-black/10"
          )}
        >
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
            <Search className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              placeholder="Search KPIs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-[var(--text-muted)]">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* KPI list by category */}
          <div className="max-h-64 overflow-y-auto py-1">
            {CATEGORIES.map((cat) => {
              const kpis = filtered.filter((k) => k.category === cat);
              if (kpis.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {cat}
                  </div>
                  {kpis.map((kpi) => {
                    const isSelected = selected.includes(kpi.id);
                    const isDisabled = !isSelected && selected.length >= maxSelections;
                    return (
                      <button
                        key={kpi.id}
                        onClick={() => !isDisabled && toggleKpi(kpi.id)}
                        disabled={isDisabled}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                          isSelected
                            ? isDark
                              ? "text-[#7C4DFF]"
                              : "text-[#D00083]"
                            : isDisabled
                              ? "text-[var(--text-muted)] opacity-40 cursor-not-allowed"
                              : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-3.5 w-3.5 items-center justify-center rounded border shrink-0",
                            isSelected
                              ? isDark
                                ? "border-[#5B22FF] bg-[#5B22FF]"
                                : "border-[#D00083] bg-[#D00083]"
                              : "border-[var(--border)]"
                          )}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        <span className="truncate">{kpi.label}</span>
                        <span className="ml-auto text-[10px] text-[var(--text-muted)]">
                          {kpi.unit === "percent" ? "%" : kpi.unit === "idr" ? "IDR" : kpi.unit === "usd" ? "USD" : kpi.unit === "ratio" ? "#" : "#"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">
                No KPIs match &quot;{search}&quot;
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2">
            <span className="text-[10px] text-[var(--text-muted)]">
              {selected.length}/{maxSelections} selected
            </span>
            <div className="flex gap-2">
              {selected.length > 0 && (
                <button
                  onClick={() => onChange([])}
                  className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)]"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-3 py-1 text-[11px] font-medium text-white",
                  isDark ? "bg-[#5B22FF]" : "bg-[#D00083]"
                )}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
