"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getModuleRouteRule } from "@/lib/navigation/module-routes";
import NotificationCenter from "@/app/components/notification-center";
import styles from "./app-shell.module.css";
import UserAvatar from "@/app/components/user-avatar";
import { useWorkspaceAccess } from "./workspace-access-provider";
import SbsAiAssistant from "./sbs-ai-assistant";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
};

type IconName =
  | "dashboard"
  | "customers"
  | "quotes"
  | "orders"
  | "invoices"
  | "payments"
  | "accounting"
  | "products"
  | "serials"
  | "inventory"
  | "warehouses"
  | "pricing"
  | "suppliers"
  | "purchases"
  | "expenses"
  | "warranty"
  | "repairs"
  | "rma"
  | "portal"
  | "reports"
  | "employees"
  | "documents"
  | "settings"
  | "search"
  | "menu"
  | "logout"
  | "chevron";

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  available: boolean;
  children?: NavItem[];
  keywords?: string[];
};

type PermissionKey = `${string}:${string}`;

function permissionKey(
  module: string,
  action: string,
): PermissionKey {
  return `${module}:${action}`;
}

type NavSection = {
  label: string;
  items: NavItem[];
};

type WorkspaceCompany = {
  id: string;
  name: string;
  currency: string | null;
  timezone: string | null;
  business_type: "product" | "service" | null;
};

type WorkspaceProfile = {
  full_name: string | null;
  avatar_url: string | null;
};

type SearchResult = {
  item: NavItem;
  section: string;
  score: number;
};

function getWorkspaceSections(): NavSection[] {
  return [
    {
      label: "MAIN",
      items: [
        {
          label: "Dashboard",
          href: "/",
          icon: "dashboard",
          available: true,
          keywords: [
            "home",
            "overview",
            "main",
            "workspace",
          ],
        },
      ],
    },
    {
      label: "SALES",
      items: [
        {
          label: "Customers",
          href: "/customers",
          icon: "customers",
          available: true,
          keywords: [
            "clients",
            "customer",
            "contacts",
            "people",
            "accounts",
          ],
        },
        {
          label: "Quotes",
          href: "/estimates",
          icon: "quotes",
          available: true,
          keywords: [
            "quote",
            "quotation",
            "estimate",
            "estimates",
            "proposal",
          ],
        },
        {
          label: "Sales & Orders",
          href: "/sales",
          icon: "orders",
          available: true,
          keywords: [
            "sales",
            "sale",
            "orders",
            "order",
            "transactions",
            "selling",
          ],
        },
        {
          label: "Invoices",
          href: "/invoices",
          icon: "invoices",
          available: true,
          keywords: [
            "invoice",
            "invoices",
            "billing",
            "bill",
            "receivable",
            "accounts receivable",
          ],
        },
        {
          label: "Accounting",
          href: "/accounting",
          icon: "accounting",
          available: true,
          keywords: [
            "accounting",
            "finance",
            "financial",
            "accounts",
            "ledger",
            "journal",
            "transactions",
            "cash",
            "bank",
            "payments",
          ],
        },
      ],
    },
    {
      label: "PRODUCTS & INVENTORY",
      items: [
        {
          label: "Products",
          href: "/products",
          icon: "products",
          available: true,
          keywords: [
            "product",
            "products",
            "items",
            "catalog",
            "sku",
            "stock item",
          ],
        },
        {
          label: "Serial Numbers",
          href: "/serial-numbers",
          icon: "serials",
          available: true,
          keywords: [
            "serial",
            "serial number",
            "serials",
            "asset",
            "imei",
            "tracking",
          ],
        },
        {
          label: "Inventory",
          href: "/inventory",
          icon: "inventory",
          available: true,
          keywords: [
            "inventory",
            "stock",
            "warehouse stock",
            "quantity",
            "stock levels",
            "adjustment",
          ],
        },
        {
          label: "Warehouses",
          href: "/warehouses",
          icon: "warehouses",
          available: true,
          keywords: [
            "warehouse",
            "warehouses",
            "location",
            "locations",
            "storage",
          ],
        },
        {
          label: "Pricing",
          href: "/pricing/products",
          icon: "pricing",
          available: true,
          keywords: [
            "price",
            "pricing",
            "prices",
            "margin",
            "selling price",
            "cost",
          ],
        },
      ],
    },
    {
      label: "PROCUREMENT",
      items: [
        {
          label: "Suppliers",
          href: "/suppliers",
          icon: "suppliers",
          available: true,
          keywords: [
            "supplier",
            "suppliers",
            "vendor",
            "vendors",
            "supplier management",
          ],
        },
        {
          label: "Purchase Orders",
          href: "/purchase-orders",
          icon: "purchases",
          available: true,
          keywords: [
            "purchase",
            "purchases",
            "purchase order",
            "po",
            "buying",
            "procurement",
          ],
        },
        {
          label: "Expenses",
          href: "/expenses",
          icon: "expenses",
          available: true,
          keywords: [
            "expense",
            "expenses",
            "costs",
            "spending",
            "payments out",
            "money out",
          ],
          children: [
            {
              label: "Categories",
              href: "/expenses/categories",
              icon: "chevron",
              available: true,
              keywords: [
                "expense categories",
                "categories",
                "expense types",
              ],
            },
            {
              label: "Closings",
              href: "/expenses/closings",
              icon: "chevron",
              available: true,
              keywords: [
                "closing",
                "closings",
                "business closing",
                "daily closing",
                "reports",
                "financial closing",
              ],
            },
            {
              label: "Reports",
              href: "/expenses/reports",
              icon: "chevron",
              available: true,
              keywords: [
                "expense reports",
                "expense report",
                "expense analytics",
                "expense analysis",
                "spending report",
              ],
            },
          ],
        },
      ],
    },
    {
      label: "SERVICE",
      items: [
        {
          label: "Warranty",
          href: "/warranty",
          icon: "warranty",
          available: true,
          keywords: [
            "warranty",
            "warranties",
            "guarantee",
          ],
        },
        {
          label: "Repairs",
          href: "/repairs",
          icon: "repairs",
          available: true,
          keywords: [
            "repair",
            "repairs",
            "service",
            "fix",
            "maintenance",
          ],
        },
        {
          label: "RMA",
          href: "/rma",
          icon: "rma",
          available: true,
          keywords: [
            "rma",
            "return",
            "returns",
            "replacement",
            "refund",
          ],
        },
        {
          label: "Service Providers",
          href: "/service-providers",
          icon: "suppliers",
          available: true,
          keywords: [
            "service provider",
            "service providers",
            "subcontractor",
            "subcontractors",
            "repair provider",
            "refurbisher",
            "external service",
          ],
        },
        {
          label: "Service Jobs",
          href: "/service-jobs",
          icon: "repairs",
          available: true,
          keywords: [
            "service job",
            "service jobs",
            "subcontracting",
            "outsourced service",
            "provider jobs",
            "job dispatch",
            "job returns",
          ],
        },
      ],
    },
    {
      label: "BUSINESS",
      items: [
        {
          label: "B2B Client Portal",
          href: "/b2b-portal",
          icon: "portal",
          available: true,
          keywords: [
            "b2b",
            "client portal",
            "customer portal",
            "portal",
            "business clients",
          ],
        },
        {
          label: "Analytics",
          href: "/analytics",
          icon: "reports",
          available: true,
          keywords: [
            "reports",
            "report",
            "analytics",
            "analysis",
            "statistics",
            "business intelligence",
          ],
        },
        {
          label: "Employees",
          href: "/employees",
          icon: "employees",
          available: true,
          keywords: [
            "employee",
            "employees",
            "staff",
            "team",
            "workers",
            "users",
            "hr",
          ],
        },
        {
          label: "Documents",
          href: "/documents",
          icon: "documents",
          available: true,
          keywords: [
            "document",
            "documents",
            "files",
            "file",
          ],
        },
      ],
    },
    {
      label: "SYSTEM", 
      items: [
        {
          label: "Settings",
          href: "/settings",
          icon: "settings",
          available: true,
          keywords: [
            "settings",
            "configuration",
            "preferences",
            "setup",
            "system",
          ],
        },
      ],
    },
  ];
}

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect
            x="3"
            y="3"
            width="7"
            height="7"
            rx="1.5"
          />
          <rect
            x="14"
            y="3"
            width="7"
            height="7"
            rx="1.5"
          />
          <rect
            x="3"
            y="14"
            width="7"
            height="7"
            rx="1.5"
          />
          <rect
            x="14"
            y="14"
            width="7"
            height="7"
            rx="1.5"
          />
        </svg>
      );

    case "customers":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle
            cx="9"
            cy="7"
            r="4"
          />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );

    case "quotes":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line
            x1="8"
            y1="13"
            x2="16"
            y2="13"
          />
          <line
            x1="8"
            y1="17"
            x2="16"
            y2="17"
          />
          <line
            x1="8"
            y1="9"
            x2="10"
            y2="9"
          />
        </svg>
      );

    case "orders":
      return (
        <svg {...common}>
          <path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h6" />
          <path d="M8 9h2" />
        </svg>
      );

    case "invoices":
      return (
        <svg {...common}>
          <path d="M6 2h9l5 5v15l-3-2-3 2-3-2-3 2-3-2V4a2 2 0 0 1 2-2Z" />
          <path d="M14 2v6h6" />
          <line
            x1="8"
            y1="12"
            x2="16"
            y2="12"
          />
          <line
            x1="8"
            y1="16"
            x2="16"
            y2="16"
          />
        </svg>
      );

    case "payments":
      return (
        <svg {...common}>
          <rect
            x="2"
            y="5"
            width="20"
            height="14"
            rx="2"
          />
          <line
            x1="2"
            y1="10"
            x2="22"
            y2="10"
          />
          <line
            x1="6"
            y1="15"
            x2="10"
            y2="15"
          />
        </svg>
      );

    case "accounting":
      return (
        <svg {...common}>
          <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
          <path d="M8 15h5" />
          <path d="M8 19h3" />
        </svg>
      );

    case "products":
      return (
        <svg {...common}>
          <path d="m21 8-9 5-9-5 9-5 9 5Z" />
          <path d="m3 8 9 5 9-5" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </svg>
      );

    case "serials":
      return (
        <svg {...common}>
          <rect
            x="3"
            y="4"
            width="18"
            height="16"
            rx="2"
          />
          <line
            x1="7"
            y1="8"
            x2="7"
            y2="16"
          />
          <line
            x1="10"
            y1="8"
            x2="10"
            y2="16"
          />
          <line
            x1="14"
            y1="8"
            x2="14"
            y2="16"
          />
          <line
            x1="17"
            y1="8"
            x2="17"
            y2="16"
          />
        </svg>
      );

    case "inventory":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
          <path d="M7 4v16" />
          <path d="M17 4v16" />
        </svg>
      );

    case "warehouses":
      return (
        <svg {...common}>
          <path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z" />
          <path d="M8 21v-6h8v6" />
        </svg>
      );

    case "pricing":
      return (
        <svg {...common}>
          <path d="M12 1v22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H7" />
        </svg>
      );

    case "suppliers":
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M5 21V5a2 2 0 0 1 2-2h6v18" />
          <path d="M13 8h4a2 2 0 0 1 2 2v11" />
          <line
            x1="8"
            y1="7"
            x2="10"
            y2="7"
          />
          <line
            x1="8"
            y1="11"
            x2="10"
            y2="11"
          />
          <line
            x1="8"
            y1="15"
            x2="10"
            y2="15"
          />
        </svg>
      );

    case "purchases":
      return (
        <svg {...common}>
          <path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      );

    case "expenses":
      return (
        <svg {...common}>
          <circle
            cx="12"
            cy="12"
            r="9"
          />
          <path d="M15 8.5c-.7-.6-1.7-1-3-1-1.7 0-3 1-3 2.2 0 1.4 1.4 2 3 2.3 1.6.3 3 1 3 2.4 0 1.3-1.3 2.3-3 2.3-1.2 0-2.3-.4-3-1" />
          <line
            x1="12"
            y1="6"
            x2="12"
            y2="18"
          />
        </svg>
      );

    case "warranty":
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );

    case "repairs":
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0-5.7 5.7l-6 6a2 2 0 0 0 2.8 2.8l6-6a4 4 0 0 0 5.7-5.7l-2.2 2.2-2.8-2.8 2.2-2.2Z" />
        </svg>
      );

    case "rma":
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      );

    case "portal":
      return (
        <svg {...common}>
          <rect
            x="3"
            y="4"
            width="18"
            height="16"
            rx="2"
          />
          <line
            x1="3"
            y1="9"
            x2="21"
            y2="9"
          />
          <circle
            cx="7"
            cy="6.5"
            r=".5"
          />
          <circle
            cx="10"
            cy="6.5"
            r=".5"
          />
        </svg>
      );

    case "reports":
      return (
        <svg {...common}>
          <line
            x1="4"
            y1="20"
            x2="4"
            y2="10"
          />
          <line
            x1="10"
            y1="20"
            x2="10"
            y2="4"
          />
          <line
            x1="16"
            y1="20"
            x2="16"
            y2="13"
          />
          <line
            x1="22"
            y1="20"
            x2="22"
            y2="7"
          />
        </svg>
      );

    case "employees":
      return (
        <svg {...common}>
          <circle
            cx="9"
            cy="7"
            r="4"
          />
          <path d="M2 21a7 7 0 0 1 14 0" />
          <path d="M19 8v6" />
          <path d="M16 11h6" />
        </svg>
      );

    case "documents":
      return (
        <svg {...common}>
          <path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
          <path d="M14 2v6h6" />
          <line
            x1="8"
            y1="13"
            x2="16"
            y2="13"
          />
          <line
            x1="8"
            y1="17"
            x2="14"
            y2="17"
          />
        </svg>
      );

    case "settings":
      return (
        <svg {...common}>
          <circle
            cx="12"
            cy="12"
            r="3"
          />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V22h-2.6v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.6-1H6v-2.6h.4A1.7 1.7 0 0 0 8 10.4a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h2.6v.4a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.4V13h-.4a1.7 1.7 0 0 0-1.6 1Z" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle
            cx="11"
            cy="11"
            r="7"
          />
          <line
            x1="16.5"
            y1="16.5"
            x2="21"
            y2="21"
          />
        </svg>
      );

    case "menu":
      return (
        <svg {...common}>
          <line
            x1="4"
            y1="6"
            x2="20"
            y2="6"
          />
          <line
            x1="4"
            y1="12"
            x2="20"
            y2="12"
          />
          <line
            x1="4"
            y1="18"
            x2="20"
            y2="18"
          />
        </svg>
      );

    case "logout":
      return (
        <svg {...common}>
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );

    default:
      return null;
  }
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function calculateSearchScore(
  item: NavItem,
  query: string
) {
  const normalizedQuery =
    normalizeSearchText(query);

  if (!normalizedQuery) {
    return 0;
  }

  const label =
    normalizeSearchText(item.label);

  const keywords =
    item.keywords?.map(normalizeSearchText) || [];

  const words = normalizedQuery.split(" ");

  let score = 0;

  if (label === normalizedQuery) {
    score += 1000;
  }

  if (label.startsWith(normalizedQuery)) {
    score += 700;
  }

  if (label.includes(normalizedQuery)) {
    score += 500;
  }

  for (const keyword of keywords) {
    if (keyword === normalizedQuery) {
      score += 900;
    }

    if (keyword.startsWith(normalizedQuery)) {
      score += 600;
    }

    if (keyword.includes(normalizedQuery)) {
      score += 350;
    }

    const keywordWords = keyword.split(" ");

    for (const word of words) {
      if (keywordWords.includes(word)) {
        score += 150;
      } else if (keyword.includes(word)) {
        score += 80;
      }
    }
  }

  for (const word of words) {
    if (label.split(" ").includes(word)) {
      score += 180;
    } else if (label.includes(word)) {
      score += 90;
    }
  }

  return score;
}

export default function AppShell({
  children,
  title,
  description,
  actions,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { allowedModuleSlugs, permissionKeys: accessPermissionKeys } =
    useWorkspaceAccess();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [mobileSidebarOpen, setMobileSidebarOpen] =
    useState(false);

  const [searchValue, setSearchValue] =
    useState("");

  const [searchFocused, setSearchFocused] =
    useState(false);

  const [selectedSearchIndex, setSelectedSearchIndex] =
    useState(0);

  const [company, setCompany] =
    useState<WorkspaceCompany | null>(null);

  const [profile, setProfile] =
    useState<WorkspaceProfile | null>(null);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [profileMenuOpen, setProfileMenuOpen] =
    useState(false);

  const searchRef =
    useRef<HTMLDivElement | null>(null);

  const profileMenuRef =
    useRef<HTMLDivElement | null>(null);

  const rawSections = useMemo(
    () => getWorkspaceSections(),
    []
  );

  const allowedModuleSlugSet = useMemo(
    () => new Set(allowedModuleSlugs),
    [allowedModuleSlugs],
  );

  const permissionKeys = useMemo(
    () =>
      new Set<PermissionKey>(
        accessPermissionKeys as PermissionKey[],
      ),
    [accessPermissionKeys],
  );

  const sections = useMemo<NavSection[]>(() => {
    function filterItem(
      item: NavItem,
    ): NavItem | null {
      const routeRule = getModuleRouteRule(item.href);

      if (!routeRule) {
        return null;
      }

      const isModuleEntitled =
        routeRule.entitlementModule === null ||
        allowedModuleSlugSet.has(
          routeRule.entitlementModule,
        );

      const hasPermission = permissionKeys.has(
        permissionKey(
          routeRule.permissionModule,
          "view",
        ),
      );

      if (!isModuleEntitled || !hasPermission) {
        return null;
      }

      const children = item.children
        ?.map(filterItem)
        .filter(
          (child): child is NavItem =>
            child !== null,
        );

      // Preserve existing availability flags, including
      // Reports & Analytics → Coming Soon.
      return {
        ...item,
        children:
          children && children.length > 0
            ? children
            : undefined,
      };
    }

    return rawSections
      .map((section) => ({
        ...section,
        items: section.items
          .map(filterItem)
          .filter(
            (item): item is NavItem =>
              item !== null,
          ),
      }))
      .filter(
        (section) => section.items.length > 0,
      );
  }, [
    rawSections,
    allowedModuleSlugSet,
    permissionKeys,
  ]);

  const allNavItems = useMemo(() => {
    return sections.flatMap((section) =>
      section.items.flatMap((item) => [
        item,
        ...(item.children || []),
      ])
    );
  }, [sections]);

  const searchResults = useMemo<SearchResult[]>(() => {
    const query =
      normalizeSearchText(searchValue);

    if (!query) {
      return [];
    }

    return sections
      .flatMap((section) =>
        section.items.flatMap((item) => {
          const parentResult: SearchResult = {
            item,
            section: section.label,
            score: calculateSearchScore(
              item,
              query
            ),
          };

          const childResults =
            item.children?.map((child) => ({
              item: child,
              section: section.label,
              score:
                calculateSearchScore(
                  child,
                  query
                ) + 10,
            })) || [];

          return [
            parentResult,
            ...childResults,
          ];
        })
      )
      .filter((result) => result.score > 0)
      .sort((a, b) => {
        if (
          a.item.available !==
          b.item.available
        ) {
          return a.item.available ? -1 : 1;
        }

        return b.score - a.score;
      })
      .slice(0, 8);
  }, [searchValue, sections]);

  const showSearchSuggestions =
    searchFocused &&
    normalizeSearchText(searchValue).length > 0;

  const loadWorkspace = useCallback(async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const {
      data: membershipData,
      error: membershipError,
    } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (membershipData?.company_id) {
      const companyId = membershipData.company_id;
      // Navigation access is supplied by the server on the initial render.
      // This client request only fills workspace/profile display details.
      const [companyResult, profileResult] =
        await Promise.all([
          supabase
            .from("companies")
            .select(
              "id, name, currency, timezone, business_type"
            )
            .eq("id", companyId)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

      const {
        data: companyData,
        error: companyError,
      } = companyResult;

      if (companyError) {
        throw companyError;
      }

      if (companyData) {
        setCompany(
          companyData as WorkspaceCompany
        );
      }

      const {
        data: profileData,
        error: profileError,
      } = profileResult;

      if (profileError) {
        console.error(
          "Failed to load profile:",
          profileError,
        );
      }

      const metadata = user.user_metadata ?? {};
      const metadataFullName =
        typeof metadata.full_name === "string"
          ? metadata.full_name
          : typeof metadata.name === "string"
            ? metadata.name
            : null;

      setProfile({
        full_name:
          profileData?.full_name ?? metadataFullName,
        avatar_url: profileData?.avatar_url ?? null,
      });

    }
  } catch (error) {
    console.error(
      "Failed to load workspace:",
      error
    );

  }
}, [supabase]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const currentRouteRule =
      getModuleRouteRule(pathname);

    const lacksViewPermission = currentRouteRule
      ? !permissionKeys.has(
          permissionKey(
            currentRouteRule.permissionModule,
            "view",
          ),
        )
      : false;

    if (
      currentRouteRule &&
      ((currentRouteRule.entitlementModule !== null &&
        !allowedModuleSlugSet.has(
          currentRouteRule.entitlementModule,
        )) ||
        lacksViewPermission)
    ) {
      const firstAllowedItem =
        allNavItems.find(
          (item) => item.available,
        );

      if (firstAllowedItem) {
        router.replace(
          firstAllowedItem.href,
        );
      }
    }
  }, [
    pathname,
    allowedModuleSlugSet,
    permissionKeys,
    allNavItems,
    router,
  ]);

  useEffect(() => {
    queueMicrotask(() => {
      setMobileSidebarOpen(false);
    });
  }, [pathname]);

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    function handlePointerDown(
      event: MouseEvent
    ) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(
          event.target as Node
        )
      ) {
        setProfileMenuOpen(false);
      }
    }

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!showSearchSuggestions) {
      return;
    }

    function handlePointerDown(
      event: MouseEvent
    ) {
      if (
        searchRef.current &&
        !searchRef.current.contains(
          event.target as Node
        )
      ) {
        setSearchFocused(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
    };
  }, [showSearchSuggestions]);

  useEffect(() => {
    setSelectedSearchIndex(0);
  }, [searchValue]);

  function isActive(item: NavItem) {
    if (item.href === "/") {
      return pathname === "/";
    }

    return (
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`)
    );
  }

  function hasActiveChild(item: NavItem) {
    return (
      item.children?.some((child) =>
        isActive(child)
      ) ?? false
    );
  }

  function handleNavigation(
    item: NavItem
  ) {
    if (!item.available) {
      return;
    }

    setMobileSidebarOpen(false);
    setSearchValue("");
    setSearchFocused(false);
    setSelectedSearchIndex(0);

    router.push(item.href);
  }

  function handleSearchResult(
    result: SearchResult
  ) {
    handleNavigation(result.item);
  }

  function handleSearchSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const query =
      normalizeSearchText(searchValue);

    if (!query) {
      return;
    }

    if (searchResults.length > 0) {
      const availableResults =
        searchResults.filter(
          (result) => result.item.available
        );

      const result =
        availableResults[
          Math.min(
            selectedSearchIndex,
            Math.max(
              availableResults.length - 1,
              0
            )
          )
        ];

      if (result) {
        handleSearchResult(result);
        return;
      }
    }

    const exactMatch =
      allNavItems.find(
        (item) =>
          item.available &&
          normalizeSearchText(item.label) ===
            query
      );

    if (exactMatch) {
      handleNavigation(exactMatch);
      return;
    }

    const partialMatch =
      allNavItems.find(
        (item) =>
          item.available &&
          (normalizeSearchText(
            item.label
          ).includes(query) ||
            item.keywords?.some((keyword) =>
              normalizeSearchText(
                keyword
              ).includes(query)
            ))
      );

    if (partialMatch) {
      handleNavigation(partialMatch);
    }
  }

  function handleSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (!showSearchSuggestions) {
      return;
    }

    if (
      event.key === "ArrowDown"
    ) {
      event.preventDefault();

      setSelectedSearchIndex(
        (current) =>
          Math.min(
            current + 1,
            Math.max(
              searchResults.length - 1,
              0
            )
          )
      );

      return;
    }

    if (
      event.key === "ArrowUp"
    ) {
      event.preventDefault();

      setSelectedSearchIndex(
        (current) =>
          Math.max(current - 1, 0)
      );

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setSearchFocused(false);
      return;
    }

    if (
      event.key === "Enter" &&
      searchResults.length > 0
    ) {
      event.preventDefault();

      const availableResults =
        searchResults.filter(
          (result) =>
            result.item.available
        );

      const result =
        availableResults[
          Math.min(
            selectedSearchIndex,
            Math.max(
              availableResults.length - 1,
              0
            )
          )
        ];

      if (result) {
        handleSearchResult(result);
      }
    }
  }

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await supabase.auth.signOut();
    } finally {
      window.location.replace("/login");
    }
  }

  const initials = useMemo(() => {
    const name =
      profile?.full_name ||
      company?.name ||
      "SBS";

    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return `${parts[0][0]}${
      parts[parts.length - 1][0]
    }`.toUpperCase();
  }, [
    profile?.full_name,
    company?.name,
  ]);

  return (
    <div className={`${styles.shellRoot} sbs-app-shell`}>
      

      {mobileSidebarOpen && (
        <button
          type="button"
          className="sbs-mobile-overlay"
          aria-label="Close navigation"
          onClick={() =>
            setMobileSidebarOpen(false)
          }
        />
      )}

      {/* ================================
          SIDEBAR
      ================================= */}

      <aside
        className={`sbs-sidebar ${
          mobileSidebarOpen
            ? "mobile-open"
            : ""
        }`}
      >
        <div className="sbs-sidebar-header">
          <button
            type="button"
            className="sbs-brand"
            onClick={() =>
              router.push("/")
            }
            aria-label="Go to dashboard"
          >
            <Image
              src="/sbs-logo.png"
              alt="Sharif Business Solutions"
              width={205}
              height={50}
              className="sbs-brand-logo"
              priority
            />
          </button>
        </div>

        <div className="sbs-sidebar-scroll">
          {sections.map((section) => (
            <div
              className="sbs-nav-section"
              key={section.label}
            >
              <div className="sbs-nav-section-label">
                {section.label}
              </div>

              <div className="sbs-nav-list">
                {section.items.map((item) => {
                  const active =
                    isActive(item);

                  const childActive =
                    hasActiveChild(item);

                  const hasChildren =
                    Boolean(
                      item.children?.length
                    );

                  const showChildren =
                    hasChildren &&
                    (active ||
                      childActive);

                  return (
                    <div
                      key={item.href}
                    >
                      <button
                        type="button"
                        className={`sbs-nav-button ${
                          active
                            ? "active"
                            : ""
                        } ${
                          !item.available
                            ? "disabled"
                            : ""
                        }`}
                        onClick={() =>
                          handleNavigation(
                            item
                          )
                        }
                        disabled={
                          !item.available
                        }
                        title={
                          item.available
                            ? item.label
                            : `${item.label} — Coming soon`
                        }
                      >
                        <span className="sbs-nav-icon">
                          <Icon
                            name={
                              item.icon
                            }
                            size={18}
                          />
                        </span>

                        <span className="sbs-nav-label">
                          {item.label}
                        </span>

                        {!item.available && (
                          <span className="sbs-coming-soon">
                            Soon
                          </span>
                        )}
                      </button>

                      {showChildren && (
                        <div className="sbs-nav-sub-list">
                          {item.children?.map(
                            (child) => {
                              const childIsActive =
                                isActive(
                                  child
                                );

                              return (
                                <button
                                  key={
                                    child.href
                                  }
                                  type="button"
                                  className={`sbs-nav-sub-button ${
                                    childIsActive
                                      ? "active"
                                      : ""
                                  } ${
                                    !child.available
                                      ? "disabled"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    handleNavigation(
                                      child
                                    )
                                  }
                                  disabled={
                                    !child.available
                                  }
                                  title={
                                    child.available
                                      ? child.label
                                      : `${child.label} — Coming soon`
                                  }
                                >
                                  <span className="sbs-nav-sub-icon">
                                    <Icon
                                      name={
                                        child.icon
                                      }
                                      size={13}
                                    />
                                  </span>

                                  <span className="sbs-nav-sub-label">
                                    {
                                      child.label
                                    }
                                  </span>
                                </button>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ================================
            SIDEBAR FOOTER
        ================================= */}

        <div className="sbs-sidebar-footer">
          {company && (
            <div className="sbs-company-card">
              <div className="sbs-company-avatar">
                {company.name
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div className="sbs-company-info">
                <div className="sbs-company-name">
                  {company.name}
                </div>

                {company.business_type && (
                  <div className="sbs-company-type">
                    {
                      company.business_type
                    }
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            className="sbs-logout-button"
            onClick={
              handleLogout
            }
            disabled={loggingOut}
          >
            <Icon
              name="logout"
              size={14}
            />

            <span>
              {loggingOut
                ? "Signing out..."
                : "Sign out"}
            </span>
          </button>
        </div>
      </aside>

      {/* ================================
          MAIN AREA
      ================================= */}

      <div className="sbs-main-area">
        <header className="sbs-topbar">
          <button
            type="button"
            className="sbs-mobile-menu"
            onClick={() =>
              setMobileSidebarOpen(
                true
              )
            }
            aria-label="Open navigation menu"
          >
            <Icon
              name="menu"
              size={20}
            />
          </button>

          {/* ================================
              SMART GLOBAL SEARCH
          ================================= */}

          <div
            className="sbs-topbar-search"
            ref={searchRef}
          >
            <form
              onSubmit={
                handleSearchSubmit
              }
              className="sbs-search-form"
            >
              <span className="sbs-search-icon">
                <Icon
                  name="search"
                  size={16}
                />
              </span>

              <input
                type="text"
                className="sbs-search-input"
                placeholder="Search modules..."
                value={searchValue}
                onFocus={() =>
                  setSearchFocused(
                    true
                  )
                }
                onChange={(event) =>
                  setSearchValue(
                    event.target.value
                  )
                }
                onKeyDown={
                  handleSearchKeyDown
                }
                aria-label="Search SBS modules"
                aria-autocomplete="list"
                aria-expanded={
                  showSearchSuggestions
                }
              />
            </form>

            {showSearchSuggestions && (
              <div className="sbs-search-results">
                <div className="sbs-search-results-header">
                  {searchResults.length >
                  0
                    ? "Suggested modules"
                    : "Search"}
                </div>

                {searchResults.length >
                0 ? (
                  <>
                    {searchResults.map(
                      (
                        result,
                        index
                      ) => (
                        <button
                          key={`${result.item.href}-${result.section}`}
                          type="button"
                          className={`sbs-search-result ${
                            index ===
                            selectedSearchIndex
                              ? "selected"
                              : ""
                          }`}
                          onMouseEnter={() =>
                            setSelectedSearchIndex(
                              index
                            )
                          }
                          onClick={() =>
                            handleSearchResult(
                              result
                            )
                          }
                          disabled={
                            !result.item
                              .available
                          }
                        >
                          <span className="sbs-search-result-icon">
                            <Icon
                              name={
                                result
                                  .item
                                  .icon
                              }
                              size={17}
                            />
                          </span>

                          <span className="sbs-search-result-copy">
                            <span className="sbs-search-result-label">
                              {
                                result
                                  .item
                                  .label
                              }
                            </span>

                            <span className="sbs-search-result-section">
                              {
                                result.section
                              }
                            </span>
                          </span>

                          {!result.item
                            .available && (
                            <span className="sbs-search-result-soon">
                              Soon
                            </span>
                          )}
                        </button>
                      )
                    )}

                    <div className="sbs-search-footer">
                      <span className="sbs-search-key">
                        ↑
                      </span>

                      <span className="sbs-search-key">
                        ↓
                      </span>

                      <span>
                        Navigate
                      </span>

                      <span className="sbs-search-key">
                        Enter
                      </span>

                      <span>
                        Open
                      </span>

                      <span className="sbs-search-key">
                        Esc
                      </span>

                      <span>
                        Close
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="sbs-search-empty">
                    No matching SBS module found.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="sbs-topbar-spacer" />

          {/* ================================
              COMPANY
          ================================= */}

          {company && (
            <div className="sbs-topbar-company">
              <span className="sbs-topbar-company-name">
                {company.name}
              </span>
            </div>
          )}

          {/* ================================
              NOTIFICATIONS
          ================================= */}

          <div className="sbs-notification-wrapper">
            <NotificationCenter />
          </div>

          {/* ================================
              PROFILE
          ================================= */}

          <div
            className="sbs-profile-wrapper"
            ref={profileMenuRef}
          >
            <div className="sbs-profile">
              <button
                type="button"
                className={`sbs-profile-trigger ${
                  profileMenuOpen
                    ? "open"
                    : ""
                }`}
                onClick={() =>
                  setProfileMenuOpen(
                    (current) =>
                      !current
                  )
                }
                aria-haspopup="menu"
                aria-expanded={
                  profileMenuOpen
                }
                aria-label="Open account menu"
              >
                <UserAvatar
                  name={profile?.full_name || company?.name || "SBS"}
                  avatarUrl={profile?.avatar_url}
                  size={34}
                  className="sbs-profile-avatar"
                />

                <span className="sbs-profile-name">
                  {profile?.full_name ||
                    "Account"}
                </span>

                <span className="sbs-profile-chevron">
                  <Icon
                    name="chevron"
                    size={14}
                  />
                </span>
              </button>
            </div>

            {profileMenuOpen && (
              <div
                className="sbs-profile-dropdown"
                role="menu"
              >
                <div className="sbs-profile-dropdown-header">
                  <div className="sbs-profile-dropdown-user">
                    <UserAvatar
                      name={profile?.full_name || company?.name || "SBS"}
                      avatarUrl={profile?.avatar_url}
                      size={38}
                      className="sbs-profile-dropdown-avatar"
                    />

                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <div className="sbs-profile-dropdown-name">
                        {profile?.full_name ||
                          "Account"}
                      </div>

                      <div className="sbs-profile-dropdown-company">
                        {company?.name ||
                          "SBS Workspace"}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="sbs-profile-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(
                      false
                    );
                    router.push(
                      "/profile"
                    );
                  }}
                >
                  <span className="sbs-profile-menu-icon">
                    <Icon
                      name="customers"
                      size={17}
                    />
                  </span>

                  <span>
                    My Profile
                  </span>
                </button>

                <button
                  type="button"
                  className="sbs-profile-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(
                      false
                    );
                    router.push(
                      "/notifications"
                    );
                  }}
                >
                  <span className="sbs-profile-menu-icon">
                    <Icon
                      name="payments"
                      size={17}
                    />
                  </span>

                  <span>
                    Notifications
                  </span>
                </button>

                <div className="sbs-profile-menu-divider" />

                <button
                  type="button"
                  className="sbs-profile-menu-item logout"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(
                      false
                    );
                    void handleLogout();
                  }}
                  disabled={loggingOut}
                >
                  <span className="sbs-profile-menu-icon">
                    <Icon
                      name="logout"
                      size={17}
                    />
                  </span>

                  <span>
                    {loggingOut
                      ? "Signing out..."
                      : "Sign out"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ================================
            PAGE CONTENT
        ================================= */}

        <main className="sbs-content">
          {(title ||
            description ||
            actions) && (
            <div className="sbs-page-header">
              <div className="sbs-page-header-copy">
                {title && (
                  <h1 className="sbs-page-title">
                    {title}
                  </h1>
                )}

                {description && (
                  <p className="sbs-page-description">
                    {description}
                  </p>
                )}
              </div>

              {actions && (
                <div className="sbs-page-actions">
                  {actions}
                </div>
              )}
            </div>
          )}

          {children}
        </main>
        <SbsAiAssistant pathname={pathname} />
      </div>
    </div>
    
  );
  
}
