export interface NavItem {
  label: string;
  href: string;
  icon: string;
  children?: NavItem[];
  /** Visual group divider label shown above this item in the sidebar */
  divider?: string;
}

export const navigation: NavItem[] = [
  { label: "User Search", href: "/search", icon: "Fingerprint" },
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Reports", href: "/reports", icon: "FileBarChart" },

  // ── Deep Dive: Growth ──
  {
    label: "Growth",
    href: "#",
    icon: "Sprout",
    divider: "Deep Dive",
    children: [
      { label: "Acquisition", href: "/deep-dive/acquisition", icon: "UserPlus" },
      { label: "Activation", href: "/deep-dive/activation", icon: "Zap" },
      { label: "Referrals", href: "/deep-dive/referral", icon: "Users" },
      { label: "Channel Quality", href: "/channel-quality", icon: "Target" },
    ],
  },

  // ── Deep Dive: Revenue ──
  {
    label: "Revenue",
    href: "#",
    icon: "Wallet",
    children: [
      { label: "Spend", href: "/deep-dive/spend", icon: "Wallet" },
      { label: "Txn Auth", href: "/deep-dive/transaction-auth", icon: "ShieldCheck" },
      { label: "Points", href: "/deep-dive/points-program", icon: "Star" },
      { label: "Credit Line", href: "/deep-dive/credit-line", icon: "TrendingUp" },
    ],
  },

  // ── Deep Dive: Risk & Collections ──
  {
    label: "Risk & Collections",
    href: "#",
    icon: "ShieldAlert",
    children: [
      { label: "Portfolio", href: "/deep-dive/portfolio", icon: "PieChart" },
      { label: "Risk", href: "/deep-dive/risk", icon: "ShieldAlert" },
      { label: "Collections", href: "/deep-dive/collections", icon: "Scale" },
      { label: "Repayments", href: "/deep-dive/repayments", icon: "ArrowDownCircle" },
    ],
  },

  // ── Deep Dive: Operations ──
  {
    label: "Operations",
    href: "#",
    icon: "Activity",
    children: [
      { label: "App Health", href: "/deep-dive/app-health", icon: "Activity" },
      { label: "Customer Service", href: "/deep-dive/customer-service", icon: "MessageCircle" },
    ],
  },

  // ── Other sections ──
  { label: "Vintage Analysis", href: "/vintage", icon: "Layers", divider: "Analytics" },
  { label: "Orico Reports", href: "/orico", icon: "Building2" },
  { label: "Quick Analysis", href: "/quick-analysis", icon: "ArrowLeftRight" },
  { label: "QRIS Experiment", href: "/qris-experiment", icon: "QrCode" },
  { label: "Market News", href: "/news", icon: "Newspaper" },
  { label: "Definitions", href: "/metrics", icon: "BookOpen", divider: "Reference" },
  { label: "Admin", href: "/admin", icon: "Settings" },
];
