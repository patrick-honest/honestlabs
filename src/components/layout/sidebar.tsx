"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  BarChart3,
  UserPlus,
  Briefcase,
  CreditCard,
  ShieldAlert,
  Zap,
  Landmark,
  Layers,
  Building,
  Search,
  Newspaper,
  ChevronDown,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { navigation, type NavItem } from "@/config/navigation";

const iconMap: Record<string, LucideIcon> = {
  Home,
  FileText,
  BarChart3,
  UserPlus,
  Briefcase,
  CreditCard,
  ShieldAlert,
  Zap,
  Landmark,
  Layers,
  Building,
  Search,
  Newspaper,
};

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const [expanded, setExpanded] = useState(
    item.children?.some((c) => pathname.startsWith(c.href)) ?? false
  );
  const Icon = iconMap[item.icon] ?? Home;
  const isActive = pathname === item.href;
  const hasChildren = !!item.children?.length;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setExpanded((p) => !p)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        {expanded && (
          <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-slate-700 pl-3">
            {item.children!.map((child) => {
              const ChildIcon = iconMap[child.icon] ?? Home;
              const childActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                    childActive
                      ? "bg-blue-500/20 text-blue-400 font-medium"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>{child.label}</span>
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
          ? "bg-blue-500 text-white"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-slate-950 border-r border-slate-800">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-slate-800">
        <span className="text-xl font-bold tracking-widest text-white">
          HONEST
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-1">
          {navigation.map((item) => (
            <NavLink key={item.label} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>

      {/* User section */}
      <div className="border-t border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
            H
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-white">User</p>
            <p className="truncate text-xs text-slate-400">user@honest.co.id</p>
          </div>
        </div>
        <button className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
