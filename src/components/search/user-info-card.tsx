"use client";

import { useState, useCallback } from "react";
import { ShieldCheck, CreditCard, Truck, Headphones, ChevronDown, ChevronUp, Banknote, AlertTriangle, Copy, Check, ExternalLink, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useTranslations } from "next-intl";
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
  const tCommon = useTranslations("common");
  const isEmpty = value == null || value === "" || value === "--";
  const displayValue = isEmpty ? tCommon("dataNotAvailable") : value;
  const hasCopyable = !isEmpty;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-medium group flex items-center",
          isEmpty
            ? "text-[var(--text-muted)] italic text-xs"
            : highlight ? "text-[var(--danger)]" : "text-[var(--text-primary)]",
          mono && !isEmpty && "font-mono text-xs"
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

// ── Chronological Timeline ─────────────────────────────────────────────────

interface TimelineMilestone {
  label: string;
  date: string | null;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function TimelineView({ user, isDark }: { user: UserSearchResult; isDark: boolean }) {
  const tSearch = useTranslations("search");
  const tCommon = useTranslations("common");
  const decisionDate = user.decision_date;

  // Build milestones in logical onboarding order
  const milestones: TimelineMilestone[] = [
    { label: tSearch("decisionDate"), date: user.decision_date },
    { label: tSearch("cmaAccepted"), date: user.cma_accepted_date },
    { label: tSearch("pinSetDate"), date: user.pin_set_date },
    { label: tSearch("videocallVerified"), date: user.videocall_verified_date },
    { label: tSearch("cardActivation"), date: user.card_activation_date },
    { label: tSearch("deliveryDate"), date: user.delivery_date },
  ];

  // Sort by date (nulls at the end)
  const sorted = [...milestones].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  return (
    <div className="flex flex-col gap-0">
      {sorted.map((ms, i) => {
        const hasDate = ms.date != null;
        const days = hasDate && decisionDate ? daysBetween(decisionDate, ms.date!) : null;
        const isFirst = ms.label === tSearch("decisionDate");
        const isLast = i === sorted.length - 1;
        const accentColor = isDark ? "#7C4DFF" : "#D00083";

        return (
          <div key={ms.label} className="flex items-start gap-3">
            {/* Vertical line + dot */}
            <div className="flex flex-col items-center shrink-0 w-4">
              {i > 0 && (
                <div
                  className="w-px flex-1 min-h-[8px]"
                  style={{ backgroundColor: hasDate ? accentColor : "var(--border)" }}
                />
              )}
              <div
                className={cn(
                  "shrink-0 rounded-full",
                  hasDate ? "h-2.5 w-2.5" : "h-2 w-2",
                )}
                style={{
                  backgroundColor: hasDate ? accentColor : "var(--border)",
                  opacity: hasDate ? 1 : 0.4,
                }}
              />
              {!isLast && (
                <div
                  className="w-px flex-1 min-h-[8px]"
                  style={{ backgroundColor: hasDate && sorted[i + 1]?.date ? accentColor : "var(--border)" }}
                />
              )}
            </div>

            {/* Content */}
            <div className={cn("flex items-baseline gap-2 pb-3 -mt-0.5", !hasDate && "opacity-50")}>
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-wider w-28 shrink-0",
                hasDate ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
              )}>
                {ms.label}
              </span>
              {hasDate ? (
                <>
                  <span className="text-xs font-medium text-[var(--text-primary)] group flex items-center gap-1">
                    {formatDate(ms.date)}
                    <CopyButton value={ms.date!} />
                  </span>
                  {days !== null && !isFirst && (
                    <span className={cn(
                      "text-[10px] font-medium rounded-full px-1.5 py-0.5",
                      isDark ? "bg-[#5B22FF]/10 text-[#7C4DFF]" : "bg-[#D00083]/8 text-[#D00083]"
                    )}>
                      {days === 0 ? tSearch("sameDay") : `+${days}d`}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs italic text-[var(--text-muted)]">{tCommon("dataNotAvailable")}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
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
  const tSearch = useTranslations("search");
  const tCommon = useTranslations("common");
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
            <span className="font-semibold text-red-400">{tSearch("spendingBlocked")}</span>
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
        <SectionHeader icon={<CreditCard className="h-3 w-3" />} title={tSearch("identity")} />
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
          <Field label={tSearch("userId")} value={user.user_id} mono />
          <Field label={tSearch("locAcct")} value={user.loc_acct} mono />
          <Field label="CRN" value={user.prin_crn} mono />
          <Field label="Current URN" value={user.current_urn ? `${user.current_urn}${user.current_urn_date ? ` (${formatDate(user.current_urn_date)})` : ""}` : null} mono />
          <Field label={tSearch("cardType")} value={user.card_type} />
          <Field label="Card Program" value={user.card_pgm} mono />
          <Field label="Product Type" value={user.product_type} />
          <Field label="Card Brand" value={user.card_brand} />
          <Field label={tSearch("creditLimit")} value={formatCurrency(user.credit_limit)} />
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">{tSearch("moengageId")}</span>
            <a
              href={`https://dashboard-01.moengage.com/v4/users/${user.user_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 text-xs font-mono text-[var(--accent-light)] hover:underline"
            >
              <span className="truncate max-w-[140px]">{user.user_id}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
              <CopyButton value={user.user_id} />
            </a>
          </div>
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

      {/* Timeline Section — chronological with days since decision */}
      <div className="mb-5 border-t border-[var(--border)] pt-4">
        <SectionHeader icon={null} title={tSearch("timeline")} />
        <TimelineView user={user} isDark={isDark} />
      </div>

      {/* Account Snapshot Section */}
      <div className="mb-5 border-t border-[var(--border)] pt-4">
        <SectionHeader icon={<Banknote className="h-3 w-3" />} title={tSearch("accountSnapshot")} />
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
          <Field label={tSearch("accountStatus")} value={user.account_status} />
          <Field label={tSearch("cycleDate")} value={formatDate(user.cycle_date)} />
          <Field label="Next Due Date" value={formatDate(user.next_due_date)} />
          <Field label="Current Min Due" value={formatCurrency(user.current_min_due)} />
          <Field label={tSearch("currentDpd")} value={user.current_dpd !== null ? String(user.current_dpd) : null} highlight={dpdHighlight} />
          <Field label={tSearch("collectionsStatus")} value={user.collections_status} highlight={user.collections_status !== null && user.collections_status !== "Current" && user.collections_status !== "No collections"} />
          <Field label={tSearch("creditRiskCategory")} value={user.credit_risk_category} />
          <Field label={tSearch("cmaVersion")} value={user.cma_app_version} mono />
          <Field label={tSearch("savingsAccount")} value={user.savings_account_number ?? tSearch("notEnrolled")} mono={!!user.savings_account_number} />
        </div>
      </div>

      {/* Delivery Section */}
      {(user.awb_number || user.awb_status) && (
        <div className="mb-5 border-t border-[var(--border)] pt-4">
          <SectionHeader icon={<Truck className="h-3 w-3" />} title={tSearch("cardDelivery")} />
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
            <Field label={tSearch("awbNumber")} value={user.awb_number} mono />
            <Field label="Delivery Status" value={user.awb_status?.replace(/_/g, " ")} />
            <Field label={tSearch("deliveryDate")} value={formatDate(user.delivery_date)} />
          </div>
        </div>
      )}

      {/* Repayment History Section */}
      <div className="mb-5 border-t border-[var(--border)] pt-4">
        <SectionHeader icon={<Receipt className="h-3 w-3" />} title={tSearch("paymentHistory")} count={user.repayment_history?.length ?? 0} />
        {user.repayment_history && user.repayment_history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="pb-2 text-left font-medium">Date</th>
                  <th className="pb-2 text-left font-medium">Vendor</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                  <th className="pb-2 text-left font-medium pl-4">Payment Code / VA</th>
                </tr>
              </thead>
              <tbody>
                {user.repayment_history.map((entry, i) => (
                  <tr key={i} className="border-b border-[var(--border)]/50">
                    <td className="py-2 text-[var(--text-secondary)]">{formatDate(entry.date)}</td>
                    <td className="py-2">
                      <span className={cn(
                        "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
                        entry.vendor === "DUR" ? "bg-emerald-500/10 text-emerald-600" :
                        entry.vendor === "BSM" ? "bg-blue-500/10 text-blue-600" :
                        "bg-[var(--surface-elevated)] text-[var(--text-secondary)]"
                      )}>
                        {entry.vendor === "DUR" ? "Durianpay" : entry.vendor === "BSM" ? "BSI" : entry.vendor ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono text-[var(--text-primary)]">
                      {entry.amount ? `Rp ${Number(entry.amount).toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 pl-4">
                      {entry.repayment_code && entry.repayment_code.trim() ? (
                        <span className="group inline-flex items-center gap-1 font-mono text-[var(--text-secondary)]">
                          {entry.repayment_code.trim()}
                          <CopyButton value={entry.repayment_code.trim()} />
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] italic text-[11px]">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)] italic mt-2">{tSearch("noPaymentHistory")}</p>
        )}
      </div>

      {/* Freshworks Tickets Section */}
      <div className="border-t border-[var(--border)] pt-4">
        <SectionHeader icon={<Headphones className="h-3 w-3" />} title={tSearch("openTickets")} count={user.open_tickets.length} />
        <TicketTable tickets={user.open_tickets} emptyMessage={tSearch("noOpenTickets")} />

        {/* Ticket history (collapsible) */}
        {user.ticket_history.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowTicketHistory(!showTicketHistory)}
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {tSearch("pastTickets")} ({user.ticket_history.length})
              {showTicketHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showTicketHistory && (
              <div className="mt-2">
                <TicketTable tickets={user.ticket_history} emptyMessage={tSearch("noTicketHistory")} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
