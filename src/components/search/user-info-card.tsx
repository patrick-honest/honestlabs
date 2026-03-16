"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserSearchResult } from "@/types/search";

interface UserInfoCardProps {
  user: UserSearchResult;
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
  isLink?: boolean;
  href?: string;
}

function Field({ label, value, highlight, isLink, href }: FieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {isLink && href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 hover:underline"
        >
          {value ?? "--"}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span
          className={cn(
            "text-sm font-medium",
            highlight ? "text-red-400" : "text-slate-100"
          )}
        >
          {value ?? "--"}
        </span>
      )}
    </div>
  );
}

export function UserInfoCard({ user }: UserInfoCardProps) {
  const dormantHighlight = user.days_dormant !== null && user.days_dormant > 30;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          User Details
        </h3>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            user.account_status === "ACTIVE"
              ? "bg-emerald-500/20 text-emerald-400"
              : user.account_status === "CLOSED"
                ? "bg-red-500/20 text-red-400"
                : "bg-slate-700 text-slate-300"
          )}
        >
          {user.account_status ?? "Unknown"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
        <Field label="User ID" value={user.user_id} />
        <Field label="LOC Account" value={user.loc_acct} />
        <Field label="Principal CRN" value={user.prin_crn} />
        <Field label="Current URN" value={user.current_urn} />
        <Field
          label="CMA Version"
          value={user.cma_version}
          isLink
          href={user.cma_contract_id ? `#cma-${user.cma_contract_id}` : undefined}
        />
        <Field label="CMA Contract ID" value={user.cma_contract_id} />
        <Field label="Decision Date" value={formatDate(user.decision_date)} />
        <Field label="Videocall Verified" value={formatDate(user.videocall_verified_date)} />
        <Field label="Card Activation" value={formatDate(user.card_activation_date)} />
        <Field label="Card Active Date" value={formatDate(user.card_active_date)} />
        <Field label="First Transaction" value={formatDate(user.first_transaction_date)} />
        <Field
          label="Days Dormant"
          value={user.days_dormant !== null ? String(user.days_dormant) : null}
          highlight={dormantHighlight}
        />
        <Field label="Cycle Date" value={formatDate(user.cycle_date)} />
        <Field label="Next Due Date" value={formatDate(user.next_due_date)} />
        <Field label="Current Min Due" value={formatCurrency(user.current_minimum_due)} />
        <Field label="Credit Limit" value={formatCurrency(user.credit_limit)} />
      </div>

      {user.historical_urns.length > 0 && (
        <div className="mt-4 border-t border-slate-800 pt-4">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Historical URNs
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {user.historical_urns.map((urn, i) => (
              <span
                key={i}
                className="rounded-md bg-slate-800 px-2 py-1 text-xs font-mono text-slate-300"
              >
                {urn}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
