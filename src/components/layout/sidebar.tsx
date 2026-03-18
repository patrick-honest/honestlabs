"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileBarChart, BarChart3, UserPlus, PieChart, Wallet,
  ShieldAlert, Zap, Scale, Layers, Building2, Search, Newspaper,
  ChevronDown, ChevronRight, LogOut, QrCode, MessageCircle,
  PanelLeftClose, PanelLeftOpen, ArrowLeftRight, ArrowDownCircle, Settings,
  ShieldCheck, Activity, Users, TrendingUp, Star, Target, BookOpen,
  Fingerprint, Sprout, CreditCard,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { navigation, type NavItem } from "@/config/navigation";
import { useTheme } from "@/hooks/use-theme";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage, type Locale } from "@/hooks/use-language";
import { useSession, signOut } from "next-auth/react";
import { IS_STATIC_EXPORT } from "@/lib/static-mode";
import { useTranslations } from "next-intl";
import { Sun, Moon, Globe } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  // Top-level
  LayoutDashboard, FileBarChart, BarChart3, Search, Newspaper, Settings,
  Layers, Building2, Target, ArrowLeftRight, QrCode, BookOpen, Sprout,
  // Deep dive children
  UserPlus, PieChart, Wallet, ShieldAlert, Zap, Scale, ArrowDownCircle,
  MessageCircle, ShieldCheck, Activity, Users, TrendingUp, Star,
  Fingerprint, CreditCard,
};

const MIN_WIDTH = 56;   // collapsed
const MAX_WIDTH = 360;
const DEFAULT_WIDTH = 256;
const COLLAPSE_THRESHOLD = 100;

// ── Expanded NavLink (full sidebar) ─────────────────────────────────

function NavLinkExpanded({
  item,
  pathname,
  isDark,
  tNav,
}: {
  item: NavItem;
  pathname: string;
  isDark: boolean;
  tNav: (key: string) => string;
}) {
  const [expanded, setExpanded] = useState(
    item.children?.some((c) => pathname.startsWith(c.href)) ?? false
  );
  const Icon = iconMap[item.icon] ?? BarChart3;
  const isActive = pathname === item.href;
  const hasChildren = !!item.children?.length;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setExpanded((p) => !p)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left truncate">{item.tKey ? tNav(item.tKey) : item.label}</span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
        </button>
        {expanded && (
          <div
            className={cn(
              "ml-4 mt-1 flex flex-col gap-0.5 border-l pl-3",
              "border-[var(--border)]"
            )}
          >
            {item.children!.map((child) => {
              const ChildIcon = iconMap[child.icon] ?? BarChart3;
              const childActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                    childActive
                      ? isDark
                        ? "bg-[#5B22FF]/20 text-[#7C4DFF] font-medium"
                        : "bg-[#D00083]/15 text-[#D00083] font-medium"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{child.tKey ? tNav(child.tKey) : child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? isDark
            ? "bg-[#5B22FF] text-white"
            : "bg-[#D00083] text-white"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.tKey ? tNav(item.tKey) : item.label}</span>
    </Link>
  );
}

// ── Collapsed NavLink (icon only + hover flyout) ────────────────────

function NavLinkCollapsed({
  item,
  pathname,
  tNav,
  isDark,
}: {
  item: NavItem;
  pathname: string;
  tNav: (key: string) => string;
  isDark: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Icon = iconMap[item.icon] ?? BarChart3;
  const isActive =
    pathname === item.href ||
    item.children?.some((c) => pathname.startsWith(c.href));
  const hasChildren = !!item.children?.length;

  const handleEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHovered(true);
  }, []);

  const handleLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setHovered(false), 150);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const iconButton = (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors cursor-pointer",
        isActive
          ? isDark
            ? "bg-[#5B22FF] text-white"
            : "bg-[#D00083] text-white"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
      )}
    >
      <Icon className="h-4 w-4" />
    </div>
  );

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {hasChildren ? (
        iconButton
      ) : (
        <Link href={item.href}>{iconButton}</Link>
      )}

      {/* Hover flyout — uses fixed positioning to escape stacking context */}
      {hovered && (
        <FlyoutPortal item={item} isDark={isDark} isActive={!!isActive} pathname={pathname} onEnter={handleEnter} onLeave={handleLeave} tNav={tNav} />
      )}
    </div>
  );
}

// Flyout rendered with fixed positioning to escape parent z-index context
function FlyoutPortal({
  item,
  isDark,
  isActive,
  pathname,
  onEnter,
  onLeave,
  tNav,
}: {
  item: NavItem;
  isDark: boolean;
  isActive: boolean;
  pathname: string;
  onEnter: () => void;
  tNav: (key: string) => string;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const hasChildren = !!item.children?.length;

  // Measure parent position on mount
  useEffect(() => {
    const parentEl = ref.current?.parentElement?.parentElement;
    if (parentEl) {
      const rect = parentEl.getBoundingClientRect();
      setPos({ top: rect.top, left: rect.right + 8 });
    }
  }, []);

  if (!pos) {
    // Hidden mount to get parent ref
    return <div ref={ref} className="hidden" />;
  }

  return (
    <>
      <div ref={ref} className="hidden" />
      <div
        ref={parentRef}
        className={cn(
          "fixed min-w-[180px] rounded-xl border py-1.5 shadow-2xl",
          isDark
            ? "border-[var(--border)] bg-[#141226] shadow-black/50"
            : "border-[var(--border)] bg-white shadow-black/10"
        )}
        style={{ top: pos.top, left: pos.left, zIndex: 9999 }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {!hasChildren ? (
          <Link
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? isDark
                  ? "text-[#7C4DFF]"
                  : "text-[#D00083]"
                : "text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]"
            )}
          >
            {item.tKey ? tNav(item.tKey) : item.label}
          </Link>
        ) : (
          <>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {item.tKey ? tNav(item.tKey) : item.label}
            </div>
            {item.children!.map((child) => {
              const ChildIcon = iconMap[child.icon] ?? BarChart3;
              const childActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors",
                    childActive
                      ? isDark
                        ? "text-[#7C4DFF] font-medium bg-[#5B22FF]/10"
                        : "text-[#D00083] font-medium bg-[#D00083]/10"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>{child.tKey ? tNav(child.tKey) : child.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const { isDark, toggleTheme } = useTheme();
  const { currency, toggleCurrency } = useCurrency();
  const { locale, setLocale, localeLabels } = useLanguage();
  const tNav = useTranslations("nav");
  const { data: session } = useSession();
  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const userInitial = (userName?.[0] || userEmail?.[0] || "U").toUpperCase();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const collapsed = width <= COLLAPSE_THRESHOLD;

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStartRef.current = { startX: e.clientX, startWidth: width };
      setIsDragging(true);
    },
    [width]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const delta = e.clientX - dragStartRef.current.startX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartRef.current.startWidth + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    // Prevent text selection while dragging
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging]);

  const toggleCollapse = useCallback(() => {
    setWidth((w) => (w <= COLLAPSE_THRESHOLD ? DEFAULT_WIDTH : MIN_WIDTH));
  }, []);

  return (
    <aside
      className={cn(
        "relative flex h-screen shrink-0 flex-col border-r z-40",
        isDark
          ? "bg-[var(--background)] border-[var(--border)]"
          : "bg-[#FAF7F2] border-[var(--border)]",
        !isDragging && "transition-[width] duration-200"
      )}
      style={{ width }}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center border-b",
          isDark ? "border-[var(--border)]" : "border-[var(--border)]",
          collapsed ? "h-16 justify-center px-2" : "h-[80px] px-6"
        )}
      >
        {collapsed ? (
          <div className="h-8 w-8 overflow-hidden rounded-lg">
            <Image
              src="/honest-logo.png"
              alt="Honest"
              width={120}
              height={40}
              className={cn(
                "h-8 w-auto max-w-none object-cover object-left",
                isDark && "brightness-150"
              )}
            />
          </div>
        ) : (
          <div className="flex flex-col items-start min-w-0">
            <Image
              src="/honest-logo.png"
              alt="Honest"
              width={140}
              height={40}
              className={cn(
                "h-8 w-auto object-contain",
                isDark && "brightness-150"
              )}
            />
            <span className={cn(
              "-mt-0.5 text-[11px] font-semibold tracking-wide",
              isDark ? "text-[var(--text-secondary)]" : "text-[var(--text-secondary)]"
            )}>
              {tNav("businessReviews")}
            </span>
            <p className="text-[8px] font-medium tracking-wider text-[var(--text-muted)] opacity-50">
              {tNav("byClaudetrick")}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 py-4", collapsed ? "px-2 overflow-visible" : "px-3 overflow-y-auto")}>
        <div className={cn("flex flex-col", collapsed ? "items-center gap-1" : "gap-0.5")}>
          {navigation.map((item) => (
            <div key={item.label}>
              {/* Section divider */}
              {!collapsed && item.divider && (
                <div className="mt-4 mb-1.5 px-3">
                  <span className={cn(
                    "text-[9px] font-bold uppercase tracking-[0.15em]",
                    isDark ? "text-[var(--text-muted)]/50" : "text-[var(--text-muted)]/60"
                  )}>
                    {item.dividerTKey ? tNav(item.dividerTKey) : item.divider}
                  </span>
                </div>
              )}
              {collapsed ? (
                <NavLinkCollapsed
                  item={item}
                  pathname={pathname}
                  tNav={tNav}
                  isDark={isDark}
                />
              ) : (
                <NavLinkExpanded
                  item={item}
                  pathname={pathname}
                  isDark={isDark}
                  tNav={tNav}
                />
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Collapse toggle + user section */}
      <div
        className={cn(
          "border-t",
          isDark ? "border-[var(--border)]" : "border-[var(--border)]"
        )}
      >
        {/* Collapse + Settings toggles — all on one row, uniform h-7 */}
        <div className={cn(
          "flex items-center gap-1 px-3 py-2",
          collapsed && "flex-col px-2"
        )}>
          {/* Collapse */}
          <button
            onClick={toggleCollapse}
            className={cn(
              "flex h-7 items-center justify-center rounded-md transition-colors shrink-0",
              "text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]",
              collapsed ? "w-7" : "w-7"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>

          {/* Currency */}
          <button
            onClick={toggleCurrency}
            className={cn(
              "flex h-7 items-center gap-0.5 rounded-md px-2 text-[11px] font-medium transition-colors",
              "bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              collapsed && "w-7 justify-center px-0"
            )}
            title="Toggle currency"
          >
            <span className={cn(currency === "IDR" && (isDark ? "text-[#7C4DFF] font-bold" : "text-[#D00083] font-bold"))}>
              {collapsed ? "$" : "IDR"}
            </span>
            {!collapsed && <span className="text-[var(--border)]">/</span>}
            {!collapsed && (
              <span className={cn(currency === "USD" && (isDark ? "text-[#7C4DFF] font-bold" : "text-[#D00083] font-bold"))}>USD</span>
            )}
          </button>

          {/* Theme */}
          <button
            onClick={toggleTheme}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors shrink-0",
              isDark
                ? "bg-[var(--surface-elevated)] text-[#FFD166] hover:bg-[#2D2955]"
                : "bg-[#F0D9F7]/50 text-[#D00083] hover:bg-[#F0D9F7]"
            )}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          {/* Language */}
          {!collapsed ? (
            <div className="relative">
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className={cn(
                  "appearance-none h-7 rounded-md border px-1.5 pr-5 text-[10px] font-medium cursor-pointer outline-none transition-colors",
                  "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
                )}
              >
                {(Object.entries(localeLabels) as [Locale, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <Globe className="pointer-events-none absolute right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-[var(--text-muted)]" />
            </div>
          ) : (
            <button
              onClick={() => {
                const locales: Locale[] = ["en", "id", "ja"];
                const next = locales[(locales.indexOf(locale) + 1) % locales.length];
                setLocale(next);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors text-[9px] font-bold bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              title={`Language: ${localeLabels[locale]}`}
            >
              {localeLabels[locale]}
            </button>
          )}
        </div>

        {/* User section */}
        <div className={cn("px-4 py-3", collapsed && "px-2 flex justify-center")}>
          {collapsed ? (
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white cursor-default",
                isDark ? "bg-[#5B22FF]" : "bg-[#D00083]"
              )}
              title={userEmail}
            >
              {userInitial}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shrink-0",
                    isDark ? "bg-[#5B22FF]" : "bg-[#D00083]"
                  )}
                >
                  {userInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {userName}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {userEmail}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { if (!IS_STATIC_EXPORT) signOut({ callbackUrl: "/login" }); }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
              >
                <LogOut className="h-4 w-4" />
                <span>{tNav("signOut")}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Resize handle — positioned on the right edge, midway down */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute right-0 top-0 h-full w-1 cursor-col-resize group",
          "hover:bg-[var(--accent,#5B22FF)]/30 active:bg-[var(--accent,#5B22FF)]/50",
          isDragging && "bg-[var(--accent,#5B22FF)]/50"
        )}
      >
        {/* Visible grip indicator at midpoint */}
        <div
          className={cn(
            "absolute right-[-3px] top-1/2 -translate-y-1/2 flex flex-col gap-[3px] items-center rounded-full px-[3px] py-2 transition-opacity",
            "opacity-0 group-hover:opacity-100",
            isDragging && "opacity-100"
          )}
        >
          <div className="w-[3px] h-[3px] rounded-full bg-[var(--text-muted)]" />
          <div className="w-[3px] h-[3px] rounded-full bg-[var(--text-muted)]" />
          <div className="w-[3px] h-[3px] rounded-full bg-[var(--text-muted)]" />
        </div>
      </div>
    </aside>
  );
}
