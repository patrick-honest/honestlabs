"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, FileText, BarChart3, UserPlus, Briefcase, CreditCard,
  ShieldAlert, Zap, Landmark, Layers, Building, Search, Newspaper,
  ChevronDown, ChevronRight, LogOut, QrCode, Headphones,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { navigation, type NavItem } from "@/config/navigation";

const iconMap: Record<string, LucideIcon> = {
  Home, FileText, BarChart3, UserPlus, Briefcase, CreditCard,
  ShieldAlert, Zap, Landmark, Layers, Building, Search, Newspaper,
  QrCode, Headphones,
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
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#9B94C4] transition-colors hover:bg-[#1E1B3A] hover:text-[#F0EEFF]"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {expanded && (
          <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-[#2D2955] pl-3">
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
                      ? "bg-[#5B22FF]/20 text-[#7C4DFF] font-medium"
                      : "text-[#6B6394] hover:bg-[#1E1B3A] hover:text-[#F0EEFF]"
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
          ? "bg-[#5B22FF] text-white"
          : "text-[#9B94C4] hover:bg-[#1E1B3A] hover:text-[#F0EEFF]"
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
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-[#0B0A1A] border-r border-[#2D2955]">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-[#2D2955]">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#5B22FF] flex items-center justify-center">
            <span className="text-xs font-bold text-white">H</span>
          </div>
          <span className="text-xl font-bold tracking-widest text-[#F0EEFF]">
            HONEST
          </span>
        </div>
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
      <div className="border-t border-[#2D2955] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5B22FF] text-xs font-bold text-white">
            H
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-[#F0EEFF]">User</p>
            <p className="truncate text-xs text-[#6B6394]">user@honest.co.id</p>
          </div>
        </div>
        <button className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-[#6B6394] transition-colors hover:bg-[#1E1B3A] hover:text-[#F0EEFF]">
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
