"use client";

import { useState, useCallback } from "react";
import { ShieldCheck, CreditCard, Truck, Headphones, ChevronDown, ChevronUp, Banknote, AlertTriangle, Copy, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import type { UserSearchResult, FreshworksTicket } from "@/types/search";

interface UserInfoCardProps {
  user: UserSearchResult;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-1.5 shrink-0"
      aria-label={`Copy ${value}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-[var(--success)]" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]" />
      )}
    </button>
  );
}

function formatDate(date: string | null): string {
  if (!date) return "--";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: number | null): string {
  if (value === null) return "--";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface FieldProps {
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
  mono?: boolean;
}

function Field({ label, value, highlight, mono }: FieldProps) {
  const displayValue = value ?? "--";
  const hasCopyable = value != null && value !== "--";

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-medium group flex items-center",
          highlight ? "text-[var(--danger)]" : "text-[var(--text-primary)]",
          mono && "font-mono text-xs"
        )}
      >
        {displayValue}
        {hasCopyable && <CopyButton value={String(value)} />}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const colorMap: Record<string, string> = {
    "Good / Normal": "bg-[var(--success)]/20 text-[var(--success)]",
    Active: "bg-[var(--success)]/20 text-[var(--success)]",
    Closed: "bg-[var(--danger)]/20 text-[var(--danger)]",
    Blocked: "bg-[var(--warning)]/20 text-[var(--warning)]",
    Suspended: "bg-[var(--warning)]/20 text-[var(--warning)]",
    Delinquent: "bg-[var(--danger)]/20 text-[var(--danger)]",
    "Write-off": "bg-[var(--danger)]/20 text-[var(--danger)]",
  };
  const cls = status ? colorMap[status] ?? "bg-[var(--surface-elevated)] text-[var(--text-secondary)]" : "bg-[var(--surface-elevated)] text-[var(--text-secondary)]";

  return (
    <span className={cn("rounded-full px-3 py-1 text-xs font-medium", cls)}>
      {status ?? "Unknown"}
    </span>
  );
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-1.5">
      {icon}
      {title}
      {count !== undefined && (
        <span className="ml-1 rounded-full bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[9px]">{count}</span>
      )}
    </h4>
  );
}

function TicketTable({ tickets, emptyMessage }: { tickets: FreshworksTicket[]; emptyMessage: string }) {
  const { isDark } = useTheme();

  if (tickets.length === 0) {
    return <p className="text-xs text-[var(--text-muted)] italic">{emptyMessage}</p>;
  }

  const priorityColor: Record<string, string> = {
    Urgent: "text-red-400",
    High: "text-orange-400",
    Medium: "text-yellow-400",
    Low: "text-[var(--text-secondary)]",
  };

  const statusColor: Record<string, string> = {
    Open: "bg-blue-500/20 text-blue-400",
    Pending: "bg-yellow-500/20 text-yellow-400",
    Resolved: "bg-emerald-500/20 text-emerald-400",
    Closed: "bg-[var(--surface-elevated)] text-[var(--text-muted)]",
    "Waiting on Customer": "bg-orange-500/20 text-orange-400",
    "Waiting on Third Party": "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-1.5 pr-3 font-medium text-[var(--text-muted)]">ID</th>
            <th className="text-left py-1.5 pr-3 font-medium text-[var(--text-muted)]">Subject</th>
            <th className="text-left py-1.5 pr-3 font-medium text-[var(--text-muted)]">Status</th>
            <th className="text-left py-1.5 pr-3 font-medium text-[var(--text-muted)]">Priority</th>
            <th className="text-left py-1.5 pr-3 font-medium text-[var(--text-muted)]">Category</th>
            <th className="text-left py-1.5 font-medium text-[var(--text-muted)]">Created</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t, i) => (
            <tr key={`${t.ticket_id}-${i}`} className="border-b border-[var(--border)]/50">
              <td className="py-1.5 pr-3 font-mono text-[var(--text-secondary)]">
                <span className="group inline-flex items-center">
                  #{t.ticket_id}
                  {t.ticket_id && <CopyButton value={String(t.ticket_id)} />}
                </span>
              </td>
              <td className="py-1.5 pr-3 text-[var(--text-primary)] max-w-[300px] truncate">{t.subject ?? "--"}</td>
              <td className="py-1.5 pr-3">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", statusColor[t.status ?? ""] ?? "bg-[var(--surface-elevated)] text-[var(--text-muted)]")}>
                  {t.status ?? "--"}
                </span>
              </td>
              <td className={cn("py-1.5 pr-3", priorityColor[t.priority ?? ""] ?? "text-[var(--text-secondary)]")}>{t.priority ?? "--"}</td>
              <td className="py-1.5 pr-3 text-[var(--text-secondary)] max-w-[200px] truncate">{t.category ?? "--"}</td>
              <td className="py-1.5 text-[var(--text-secondary)]">{t.created_at ? formatDate(t.created_at) : "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UserInfoCard({ user }: UserInfoCardProps) {
  const { isDark } = useTheme();
  const [showTicketHistory, setShowTicketHistory] = useState(false);
  const dpdHighlight = user.current_dpd !== null && user.current_dpd > 0;

  return (
    <div className={cn(
      "rounded-xl border p-6 transition-colors",
      isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)] shadow-sm"
    )}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          User Details
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <ShieldCheck className="h-3 w-3" />
            <span>PII hidden</span>
          </div>
          <StatusBadge status={user.account_status} />
        </div>
      </div>

      {/* Spending Block Banner */}
      {user.has_spending_block && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-red-400">Spending Blocked</span>
            <span className="text-[var(--text-secondary)] ml-2">
              {[
                user.card_status && user.card_status !== "Verified / Active" ? `Card: ${user.card_status}` : null,
                user.restriction_status ? `Restriction: ${user.restriction_status}` : null,
                user.account_status && !["Good / Normal", "Active"].includes(user.account_status) ? `Account: ${user.account_status}` : null,
              ].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>
      )}

      {/* Identity Section */}
      <div className="mb-5">
        <SectionHeader icon={<CreditCard className="h-3 w-3" />} title="Identity" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
          <Field label="User ID" value={user.user_id} mono />
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">MoEngage</span>
            <a
              href={`https://dashboard-01.moengage.com/v4/users/${user.user_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 text-xs font-mono text-[var(--accent-light)] hover:underline"
            >
              <span>Open Dashboard</span>
              <ExternalLink className="h-3 w-3" />
              <CopyButton value={`https://dashboard-01.moengage.com/v4/users/${user.user_id}`} />
            </a>
          </div>
          <Field label="LOC Account" value={user.loc_acct} mono />
          <Field label="CRN" value={user.prin_crn} mono />
          <Field label="Current URN" value={user.current_urn ? `${user.current_urn}${user.current_urn_date ? ` (${formatDate(user.current_urn_date)})` : ""}` : null} mono />
          <Field label="Card Type" value={user.card_type} />
          <Field label="Card Program" value={user.card_pgm} mono />
          <Field label="Product Type" value={user.product_type} />
          <Field label="Card Brand" value={user.card_brand} />
          <Field label="Credit Limit" value={formatCurrency(user.credit_limit)} />
        </div>

        {/* Previous URNs */}
        {user.previous_urns.length > 0 && (
          <div className="mt-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Previous URNs
            </span>
            <div className="mt-1 flex flex-wrap gap-2">
              {user.previous_urns.map((entry, i) => (
                <span
                  key={i}
                  className="group inline-flex items-center rounded-md bg-[var(--surface-elevated)] px-2 py-1 text-xs font-mono text-[var(--text-secondary)]"
                >
                  {entry.urn} <span className="text-[var(--text-muted)]">({formatDate(entry.date)})</span>
                  <CopyButton value={String(entry.urn)} />
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Timeline Section */}
      <div className="mb-5 border-t border-[var(--border)] pt-4">
        <SectionHeader icon={null} title="Timeline" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
          <Field label="Decision Date" value={formatDate(user.decision_date)} />
          <Field label="Videocall Verified" value={formatDate(user.videocall_verified_date)} />
          <Field label="CMA Accepted" value={formatDate(user.cma_accepted_date)} />
          <Field label="Card Activation" value={formatDate(user.card_activation_date)} />
          <Field label="PIN Set Date" value={formatDate(user.pin_set_date)} />
        </div>
      </div>

      {/* Account Snapshot Section */}
      <div className="mb-5 border-t border-[var(--border)] pt-4">
        <SectionHeader icon={<Banknote className="h-3 w-3" />} title="Account Snapshot" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
          <Field label="Account Status" value={user.account_status} />
          <Field label="Cycle Date" value={formatDate(user.cycle_date)} />
          <Field label="Next Due Date" value={formatDate(user.next_due_date)} />
          <Field label="Current Min Due" value={formatCurrency(user.current_min_due)} />
          <Field label="Current DPD" value={user.current_dpd !== null ? String(user.current_dpd) : null} highlight={dpdHighlight} />
          <Field label="Collections Status" value={user.collections_status} highlight={user.collections_status !== null && user.collections_status !== "Current" && user.collections_status !== "No collections"} />
          <Field label="CMA Version" value={user.cma_app_version} mono />
          <Field label="Savings Account" value={user.savings_account_number} mono />
        </div>
      </div>

      {/* Delivery Section */}
      {(user.awb_number || user.awb_status) && (
        <div className="mb-5 border-t border-[var(--border)] pt-4">
          <SectionHeader icon={<Truck className="h-3 w-3" />} title="Card Delivery" />
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
            <Field label="AWB Number" value={user.awb_number} mono />
            <Field label="Delivery Status" value={user.awb_status?.replace(/_/g, " ")} />
            <Field label="Delivered" value={formatDate(user.delivery_date)} />
          </div>
        </div>
      )}

      {/* Freshworks Tickets Section */}
      <div className="border-t border-[var(--border)] pt-4">
        <SectionHeader icon={<Headphones className="h-3 w-3" />} title="Open Tickets" count={user.open_tickets.length} />
        <TicketTable tickets={user.open_tickets} emptyMessage="No open tickets" />

        {/* Ticket history (collapsible) */}
        {user.ticket_history.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowTicketHistory(!showTicketHistory)}
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Past Tickets ({user.ticket_history.length})
              {showTicketHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showTicketHistory && (
              <div className="mt-2">
                <TicketTable tickets={user.ticket_history} emptyMessage="No ticket history" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
