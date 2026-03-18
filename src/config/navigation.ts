export interface NavItem {
  label: string;
  href: string;
  icon: string;
  children?: NavItem[];
}

export const navigation: NavItem[] = [
  { label: "User Search", href: "/search", icon: "Search" },
  { label: "Dashboard", href: "/dashboard", icon: "Home" },
  { label: "Reports", href: "/reports", icon: "FileText" },
  {
    label: "Deep Dive",
    href: "#",
    icon: "BarChart3",
    children: [
      { label: "Acquisition", href: "/deep-dive/acquisition", icon: "UserPlus" },
      { label: "Portfolio", href: "/deep-dive/portfolio", icon: "Briefcase" },
      { label: "Spend", href: "/deep-dive/spend", icon: "CreditCard" },
      { label: "Risk", href: "/deep-dive/risk", icon: "ShieldAlert" },
      { label: "Activation", href: "/deep-dive/activation", icon: "Zap" },
      { label: "Collections", href: "/deep-dive/collections", icon: "Landmark" },
      { label: "Repayments", href: "/deep-dive/repayments", icon: "ArrowDownCircle" },
      { label: "Customer Service", href: "/deep-dive/customer-service", icon: "Headphones" },
      { label: "Transaction Auth", href: "/deep-dive/transaction-auth", icon: "ShieldCheck" },
      { label: "App Health", href: "/deep-dive/app-health", icon: "Activity" },
      { label: "Referral Program", href: "/deep-dive/referral", icon: "Share2" },
      { label: "Credit Line Mgmt", href: "/deep-dive/credit-line", icon: "TrendingUp" },
    ],
  },
  { label: "Vintage Analysis", href: "/vintage", icon: "Layers" },
  { label: "Orico Reports", href: "/orico", icon: "Building" },
  { label: "A/B Tests", href: "/ab-tests", icon: "FlaskConical" },
  { label: "Channel Quality", href: "/channel-quality", icon: "Target" },
  { label: "Quick Analysis", href: "/quick-analysis", icon: "GitCompareArrows" },
  { label: "QRIS Experiment", href: "/qris-experiment", icon: "QrCode" },
  { label: "Market News", href: "/news", icon: "Newspaper" },
  { label: "Definitions", href: "/metrics", icon: "BookOpen" },
  { label: "Admin", href: "/admin", icon: "Settings" },
];
