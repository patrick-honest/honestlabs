export interface NavItem {
  label: string;
  /** Translation key in nav namespace (e.g. "userSearch" → t('nav.userSearch')) */
  tKey?: string;
  href: string;
  icon: string;
  children?: NavItem[];
  /** Visual group divider label shown above this item in the sidebar */
  divider?: string;
  /** Translation key for divider */
  dividerTKey?: string;
}

export const navigation: NavItem[] = [
  { label: "User Search", tKey: "userSearch", href: "/search", icon: "Fingerprint" },
  { label: "Dashboard", tKey: "dashboard", href: "/dashboard", icon: "LayoutDashboard" },

  // ── Reports ──
  {
    label: "Reports", tKey: "reports",
    href: "#",
    icon: "FileBarChart",
    children: [
      { label: "Orico Reports", tKey: "oricoReports", href: "/orico", icon: "Building2" },
      { label: "QRIS Experiment", tKey: "qrisExperiment", href: "/qris-experiment", icon: "QrCode" },
      { label: "Report Archive", tKey: "reportArchive", href: "/reports", icon: "Archive" },
    ],
  },

  // ── Deep Dive: Growth ──
  {
    label: "Growth", tKey: "growth",
    href: "#",
    icon: "Sprout",
    divider: "Deep Dive", dividerTKey: "deepDive",
    children: [
      { label: "Acquisition", tKey: "acquisition", href: "/deep-dive/acquisition", icon: "UserPlus" },
      { label: "Activation", tKey: "activation", href: "/deep-dive/activation", icon: "Zap" },
      { label: "Referrals", tKey: "referrals", href: "/deep-dive/referral", icon: "Users" },
      { label: "Channel Quality", tKey: "channelQuality", href: "/channel-quality", icon: "Target" },
    ],
  },

  // ── Deep Dive: Revenue ──
  {
    label: "Revenue", tKey: "revenue",
    href: "#",
    icon: "Wallet",
    children: [
      { label: "Spend", tKey: "spend", href: "/deep-dive/spend", icon: "Wallet" },
      { label: "Txn Auth", tKey: "txnAuth", href: "/deep-dive/transaction-auth", icon: "ShieldCheck" },
      { label: "Points", tKey: "points", href: "/deep-dive/points-program", icon: "Star" },
      { label: "Credit Line", tKey: "creditLine", href: "/deep-dive/credit-line", icon: "TrendingUp" },
      { label: "Billing Cycle", tKey: "billingCycle", href: "/deep-dive/billing-cycle", icon: "CalendarClock" },
    ],
  },

  // ── Deep Dive: Risk & Collections ──
  {
    label: "Risk & Collections", tKey: "riskCollections",
    href: "#",
    icon: "ShieldAlert",
    children: [
      { label: "Portfolio", tKey: "portfolio", href: "/deep-dive/portfolio", icon: "PieChart" },
      { label: "Risk", tKey: "risk", href: "/deep-dive/risk", icon: "ShieldAlert" },
      { label: "Collections", tKey: "collections", href: "/deep-dive/collections", icon: "Scale" },
      { label: "Repayments", tKey: "repayments", href: "/deep-dive/repayments", icon: "ArrowDownCircle" },
    ],
  },

  // ── Deep Dive: Operations ──
  {
    label: "Operations", tKey: "operations",
    href: "#",
    icon: "Activity",
    children: [
      { label: "App Health", tKey: "appHealth", href: "/deep-dive/app-health", icon: "Activity" },
      { label: "Customer Service", tKey: "customerService", href: "/deep-dive/customer-service", icon: "MessageCircle" },
      { label: "Users", tKey: "users", href: "/deep-dive/users", icon: "Users" },
      { label: "Cards", tKey: "cards", href: "/deep-dive/cards", icon: "CreditCard" },
    ],
  },

  // ── Analytics ──
  { label: "Vintage Analysis", tKey: "vintageAnalysis", href: "/vintage", icon: "Layers", divider: "Analytics", dividerTKey: "analytics" },
  { label: "Quick Analysis", tKey: "quickAnalysis", href: "/quick-analysis", icon: "ArrowLeftRight" },
  { label: "Market News", tKey: "marketNews", href: "/news", icon: "Newspaper" },
  { label: "Definitions", tKey: "definitions", href: "/metrics", icon: "BookOpen", divider: "Reference", dividerTKey: "reference" },
  { label: "Admin", tKey: "admin", href: "/admin", icon: "Settings" },
];
