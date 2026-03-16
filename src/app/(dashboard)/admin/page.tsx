"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout/header";
import { APP_OWNER } from "@/lib/access-control";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Mail, Shield, Eye, RefreshCw, Check, X, Lock } from "lucide-react";

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
  pages: string;
  invitedBy: string;
  invitedAt: string;
  acceptedAt: string | null;
  status: string;
}

const AVAILABLE_PAGES = [
  { value: "/orico", label: "Orico Reports" },
  { value: "/deep-dive", label: "Deep Dive (All)" },
  { value: "/vintage", label: "Vintage Analysis" },
  { value: "/qris-experiment", label: "QRIS Experiment" },
  { value: "/quick-analysis", label: "Quick Analysis" },
  { value: "/reports", label: "Reports" },
];

export default function AdminPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePages, setInvitePages] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isAdmin = session?.user?.email?.toLowerCase() === APP_OWNER.toLowerCase();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setSending(true);
    setMessage(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          pages: invitePages,
          sendEmail: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: data.emailSent
            ? `Invited ${inviteEmail} — invite email sent`
            : `Invited ${inviteEmail} — email not sent (no RESEND_API_KEY configured). User can log in manually.`,
        });
        setInviteEmail("");
        setInviteName("");
        setInvitePages([]);
        fetchUsers();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to send invite" });
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (email: string) => {
    if (!confirm(`Revoke access for ${email}?`)) return;

    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: `Revoked access for ${email}` });
        fetchUsers();
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to revoke access" });
    }
  };

  const handleReactivate = async (email: string) => {
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, status: "active" }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: `Reactivated ${email}` });
        fetchUsers();
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to reactivate user" });
    }
  };

  const togglePage = (page: string) => {
    setInvitePages((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]
    );
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col">
        <Header title="Admin" />
        <div className="flex items-center justify-center min-h-[60vh] p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Admin Only</h2>
            <p className="text-sm text-[var(--text-muted)]">
              This page is restricted to the app administrator ({APP_OWNER}).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header title="User Management" />

      <div className="flex-1 space-y-6 p-6 max-w-4xl">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">User Management</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Invite users, manage access, and control which pages they can see.
          </p>
        </div>

        {/* Status message */}
        {message && (
          <div
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium",
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800"
            )}
          >
            {message.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-auto opacity-60 hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Invite form */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Invite New User
          </h3>

          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@honestbank.com"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Page access */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                Page Access (leave empty for full access)
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_PAGES.map((page) => (
                  <button
                    key={page.value}
                    type="button"
                    onClick={() => togglePage(page.value)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                      invitePages.includes(page.value)
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-[var(--background)] text-[var(--text-muted)] border-[var(--border)] hover:border-blue-400 hover:text-[var(--text-primary)]"
                    )}
                  >
                    {page.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={sending || !inviteEmail}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors",
                sending || !inviteEmail
                  ? "bg-[var(--border)] text-[var(--text-muted)] cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              <Mail className="w-4 h-4" />
              {sending ? "Sending..." : "Send Invite"}
            </button>
          </form>
        </div>

        {/* User list */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Users ({users.length})
            </h3>
            <button
              onClick={fetchUsers}
              className="p-1.5 rounded-md hover:bg-[var(--border)] text-[var(--text-muted)] transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
          </div>

          {/* App owner row (always shown) */}
          <div className="px-6 py-3 border-b border-[var(--border)] bg-blue-50/50 dark:bg-blue-900/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                  P
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{APP_OWNER}</p>
                  <p className="text-xs text-[var(--text-muted)]">App Owner & Administrator</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase">
                  Admin
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase">
                  Full Access
                </span>
              </div>
            </div>
          </div>

          {/* Invited users */}
          {loading && users.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-[var(--text-muted)]">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-[var(--text-muted)]">
              No users invited yet. Use the form above to invite team members.
            </div>
          ) : (
            users.map((user) => {
              const pages: string[] = JSON.parse(user.pages || "[]");
              return (
                <div key={user.id} className="px-6 py-3 border-b border-[var(--border)] last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--border)] flex items-center justify-center text-[var(--text-muted)] text-xs font-bold">
                        {(user.name || user.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {user.email}
                          {user.name && <span className="text-[var(--text-muted)] font-normal ml-2">({user.name})</span>}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          Invited {new Date(user.invitedAt).toLocaleDateString()} by {user.invitedBy}
                          {pages.length > 0 && (
                            <span className="ml-2">
                              • Access: {pages.map((p) => AVAILABLE_PAGES.find((ap) => ap.value === p)?.label || p).join(", ")}
                            </span>
                          )}
                          {pages.length === 0 && <span className="ml-2">• Full access</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          user.status === "active"
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                            : user.status === "pending"
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                              : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        )}
                      >
                        {user.status}
                      </span>
                      {user.status === "revoked" ? (
                        <button
                          onClick={() => handleReactivate(user.email)}
                          className="p-1.5 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 transition-colors"
                          title="Reactivate"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRevoke(user.email)}
                          className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                          title="Revoke access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
