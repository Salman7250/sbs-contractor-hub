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
import NotificationCenter from "@/app/components/notification-center";

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
          label: "Payments",
          href: "/payments",
          icon: "payments",
          available: true,
          keywords: [
            "payment",
            "payments",
            "money",
            "received",
            "incoming",
            "paid",
            "cash",
            "receipts",
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
          available: false,
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
          available: false,
          keywords: [
            "rma",
            "return",
            "returns",
            "replacement",
            "refund",
          ],
        },
      ],
    },
    {
      label: "BUSINESS",
      items: [
        {
          label: "B2B Client Portal",
          href: "/portal",
          icon: "portal",
          available: false,
          keywords: [
            "b2b",
            "client portal",
            "customer portal",
            "portal",
            "business clients",
          ],
        },
        {
          label: "Reports & Analytics",
          href: "/reports",
          icon: "reports",
          available: false,
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
          available: false,
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

  const sections = useMemo(
    () => getWorkspaceSections(),
    []
  );

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

      const { data: membership } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (membership?.company_id) {
        const { data: companyData } =
          await supabase
            .from("companies")
            .select(
              "id, name, currency, timezone, business_type"
            )
            .eq(
              "id",
              membership.company_id
            )
            .maybeSingle();

        if (companyData) {
          setCompany(
            companyData as WorkspaceCompany
          );
        }
      }

      const { data: profileData } =
        await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();

      if (profileData) {
        setProfile(
          profileData as WorkspaceProfile
        );
      }
    } catch (error) {
      console.error(
        "Failed to load workspace:",
        error
      );
    }
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadWorkspace();
    });

    const channel = supabase
      .channel("sbs-company-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "companies",
        },
        () => {
          void loadWorkspace();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadWorkspace, supabase]);

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
    <div className="sbs-app-shell">
      <style jsx global>{`
        .sbs-app-shell {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            Helvetica,
            Arial,
            sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        /* ================================
           SIDEBAR
        ================================= */

        .sbs-sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: 270px;
          height: 100vh;
          background: #090d0b;
          border-right: 1px solid #1d2821;
          z-index: 100;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition:
            transform 0.25s
            cubic-bezier(0.16, 1, 0.3, 1);
        }

        .sbs-sidebar-header {
          height: 70px;
          padding: 0 20px;
          display: flex;
          align-items: center;
          border-bottom: 1px solid #1d2821;
          flex-shrink: 0;
          background: #090d0b;
        }

        .sbs-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          text-decoration: none;
          color: inherit;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          text-align: left;
        }

        .sbs-brand-mark {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: #ffffff;
          color: #090d0b;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.03em;
          flex-shrink: 0;
          overflow: hidden;
          box-shadow:
            0 5px 16px
            rgba(0, 0, 0, 0.3);
        }

        .sbs-brand-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .sbs-brand-text {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .sbs-brand-name {
          font-size: 13.5px;
          line-height: 1.2;
          font-weight: 700;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-brand-subtitle {
          margin-top: 3px;
          font-size: 11px;
          line-height: 1;
          color: #78857d;
          font-weight: 500;
        }

        .sbs-sidebar-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 20px 12px;
        }

        .sbs-sidebar-scroll::-webkit-scrollbar {
          width: 4px;
        }

        .sbs-sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .sbs-sidebar-scroll::-webkit-scrollbar-thumb {
          background: #2a382f;
          border-radius: 99px;
        }

        .sbs-nav-section {
          margin-bottom: 22px;
        }

        .sbs-nav-section-label {
          padding: 0 10px;
          margin-bottom: 8px;
          font-size: 10px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #637068;
          text-transform: uppercase;
        }

        .sbs-nav-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .sbs-nav-button {
          position: relative;
          width: 100%;
          height: 40px;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 0 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: transparent;
          color: #c4cec7;
          font: inherit;
          font-size: 13px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.15s ease,
            color 0.15s ease,
            border-color 0.15s ease;
        }

        .sbs-nav-button:hover:not(.disabled) {
          background: #152019;
          color: #6ee7a0;
          border-color: #203229;
        }

        .sbs-nav-button.active {
          background: #173d27;
          color: #6ee7a0;
          border-color: #285c3b;
          font-weight: 650;
          box-shadow:
            inset 3px 0 0 #35c46f,
            0 4px 12px
              rgba(0, 0, 0, 0.14);
        }

        .sbs-nav-button.active:hover {
          background: #1b472d;
          color: #7ee7aa;
        }

        .sbs-nav-button.disabled {
          color: #4c5851;
          cursor: not-allowed;
        }

        .sbs-nav-icon {
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: inherit;
        }

        .sbs-nav-button.active
          .sbs-nav-icon {
          color: #6ee7a0;
        }

        .sbs-nav-label {
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-coming-soon {
          font-size: 9px;
          line-height: 1;
          font-weight: 600;
          color: #68756d;
          background: #151b17;
          border: 1px solid #263129;
          padding: 3px 6px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        /* ================================
           NESTED NAVIGATION
        ================================= */

        .sbs-nav-sub-list {
          margin: 3px 0 6px 18px;
          padding-left: 15px;
          border-left: 1px solid #26352c;
        }

        .sbs-nav-sub-button {
          position: relative;
          width: 100%;
          min-height: 36px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 7px 10px 7px 12px;
          border: 1px solid transparent;
          border-radius: 7px;
          background: transparent;
          color: #89958e;
          font: inherit;
          font-size: 12.5px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.15s ease,
            color 0.15s ease,
            border-color 0.15s ease;
        }

        .sbs-nav-sub-button:hover:not(.disabled) {
          background: #152019;
          color: #6ee7a0;
        }

        .sbs-nav-sub-button.active {
          background: #173d27;
          color: #6ee7a0;
          border-color: #285c3b;
          font-weight: 600;
          box-shadow:
            inset 2px 0 0 #35c46f;
        }

        .sbs-nav-sub-button.disabled {
          cursor: not-allowed;
          opacity: 0.35;
        }

        .sbs-nav-sub-icon {
          width: 14px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: inherit;
        }

        .sbs-nav-sub-button.active
          .sbs-nav-sub-icon {
          color: #6ee7a0;
        }

        .sbs-nav-sub-label {
          min-width: 0;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ================================
           SIDEBAR FOOTER
        ================================= */

        .sbs-sidebar-footer {
          padding: 14px 12px;
          border-top: 1px solid #1d2821;
          flex-shrink: 0;
          background: #090d0b;
        }

        .sbs-company-card {
          border: 1px solid #26342c;
          border-radius: 9px;
          padding: 9px 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          background: #111813;
        }

        .sbs-company-avatar {
          width: 32px;
          height: 32px;
          border-radius: 7px;
          background: #1d2b23;
          color: #7ee7aa;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .sbs-company-info {
          flex: 1;
          min-width: 0;
        }

        .sbs-company-name {
          font-size: 12px;
          font-weight: 600;
          color: #edf4ef;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-company-type {
          margin-top: 2px;
          font-size: 10px;
          color: #78857d;
          text-transform: capitalize;
        }

        .sbs-logout-button {
          width: 100%;
          margin-top: 8px;
          height: 34px;
          border: 1px solid #26342c;
          border-radius: 7px;
          background: #111813;
          color: #89958e;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font: inherit;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .sbs-logout-button:hover:not(:disabled) {
          background: #261517;
          border-color: #542326;
          color: #f87171;
        }

        .sbs-logout-button:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        /* ================================
           MAIN AREA
        ================================= */

        .sbs-main-area {
          min-height: 100vh;
          margin-left: 270px;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        /* ================================
           TOPBAR
        ================================= */

        .sbs-topbar {
          height: 70px;
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(
            255,
            255,
            255,
            0.88
          );
          backdrop-filter: blur(14px);
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          padding: 0 32px;
          gap: 16px;
        }

        .sbs-mobile-menu {
          display: none;
          width: 36px;
          height: 36px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          border-radius: 7px;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #334155;
          flex-shrink: 0;
        }

        .sbs-mobile-menu:hover {
          background: #f8fafc;
        }

        /* ================================
           SMART SEARCH
        ================================= */

        .sbs-topbar-search {
          position: relative;
          width: min(420px, 100%);
        }

        .sbs-search-form {
          position: relative;
          z-index: 2;
        }

        .sbs-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
          display: flex;
          align-items: center;
        }

        .sbs-search-input {
          width: 100%;
          height: 38px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 8px;
          outline: none;
          padding: 0 38px 0 36px;
          font: inherit;
          font-size: 13px;
          color: #0f172a;
          transition:
            border-color 0.15s ease,
            background 0.15s ease,
            box-shadow 0.15s ease;
          box-sizing: border-box;
        }

        .sbs-search-input::placeholder {
          color: #94a3b8;
        }

        .sbs-search-input:focus {
          background: #ffffff;
          border-color: #35a866;
          box-shadow:
            0 0 0 3px
              rgba(53, 168, 102, 0.1);
        }

        .sbs-search-results {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          width: 100%;
          min-width: 330px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          box-shadow:
            0 20px 45px
              rgba(15, 23, 42, 0.14),
            0 5px 14px
              rgba(15, 23, 42, 0.06);
          padding: 6px;
          z-index: 600;
          overflow: hidden;
        }

        .sbs-search-results-header {
          padding: 7px 9px 6px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #94a3b8;
          text-transform: uppercase;
        }

        .sbs-search-result {
          width: 100%;
          min-height: 48px;
          border: 0;
          border-radius: 8px;
          padding: 7px 9px;
          display: flex;
          align-items: center;
          gap: 11px;
          background: transparent;
          color: #334155;
          font: inherit;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.12s ease,
            color 0.12s ease;
        }

        .sbs-search-result:hover,
        .sbs-search-result.selected {
          background: #f0fdf4;
          color: #15803d;
        }

        .sbs-search-result-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: #f1f5f9;
          color: #64748b;
        }

        .sbs-search-result:hover
          .sbs-search-result-icon,
        .sbs-search-result.selected
          .sbs-search-result-icon {
          background: #dcfce7;
          color: #16a34a;
        }

        .sbs-search-result-copy {
          flex: 1;
          min-width: 0;
        }

        .sbs-search-result-label {
          font-size: 12.5px;
          font-weight: 600;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-search-result:hover
          .sbs-search-result-label,
        .sbs-search-result.selected
          .sbs-search-result-label {
          color: #15803d;
        }

        .sbs-search-result-section {
          margin-top: 2px;
          font-size: 10.5px;
          color: #94a3b8;
        }

        .sbs-search-result-soon {
          flex-shrink: 0;
          font-size: 9px;
          font-weight: 600;
          color: #94a3b8;
          background: #f1f5f9;
          border-radius: 5px;
          padding: 4px 6px;
        }

        .sbs-search-empty {
          padding: 18px 12px;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
        }

        .sbs-search-footer {
          margin-top: 4px;
          padding: 7px 9px 5px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          color: #94a3b8;
        }

        .sbs-search-key {
          padding: 2px 5px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          background: #f8fafc;
          color: #64748b;
          font-size: 9px;
          font-weight: 600;
        }

        .sbs-topbar-spacer {
          flex: 1;
        }

        .sbs-topbar-company {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          max-width: 220px;
          padding: 5px 10px;
          background: #f8fafc;
          border: 1px solid #e9eef2;
          border-radius: 7px;
        }

        .sbs-topbar-company-name {
          font-size: 12px;
          font-weight: 500;
          color: #475569;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-notification-wrapper {
          position: relative;
          flex-shrink: 0;
          z-index: 200;
          display: flex;
          align-items: center;
        }

        /* ================================
           PROFILE
        ================================= */

        .sbs-profile-wrapper {
          position: relative;
          flex-shrink: 0;
          z-index: 500;
        }

        .sbs-profile {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
          padding-left: 12px;
          border-left: 1px solid #e2e8f0;
        }

        .sbs-profile-trigger {
          border: 1px solid transparent;
          background: transparent;
          border-radius: 9px;
          padding: 4px 7px 4px 5px;
          display: flex;
          align-items: center;
          gap: 9px;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease;
        }

        .sbs-profile-trigger:hover,
        .sbs-profile-trigger.open {
          background: #f8fafc;
          border-color: #e2e8f0;
        }

        .sbs-profile-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #111827;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .sbs-profile-name {
          max-width: 140px;
          font-size: 12.5px;
          font-weight: 600;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-profile-chevron {
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          transition:
            transform 0.15s ease;
        }

        .sbs-profile-trigger.open
          .sbs-profile-chevron {
          transform: rotate(90deg);
        }

        /* ================================
           PROFILE DROPDOWN
        ================================= */

        .sbs-profile-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 255px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow:
            0 20px 45px
              rgba(15, 23, 42, 0.14),
            0 5px 14px
              rgba(15, 23, 42, 0.06);
          padding: 7px;
          z-index: 700;
          animation:
            sbs-profile-menu-in
            0.14s ease-out;
        }

        @keyframes sbs-profile-menu-in {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .sbs-profile-dropdown-header {
          padding: 10px 10px 12px;
          border-bottom: 1px solid #f1f5f9;
          margin-bottom: 5px;
        }

        .sbs-profile-dropdown-user {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sbs-profile-dropdown-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #111827;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .sbs-profile-dropdown-name {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-profile-dropdown-company {
          margin-top: 3px;
          font-size: 11px;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-profile-menu-item {
          width: 100%;
          height: 39px;
          border: 0;
          border-radius: 8px;
          padding: 0 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: transparent;
          color: #475569;
          font: inherit;
          font-size: 12.5px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.15s ease,
            color 0.15s ease;
        }

        .sbs-profile-menu-item:hover {
          background: #f0fdf4;
          color: #16a34a;
        }

        .sbs-profile-menu-icon {
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: inherit;
          flex-shrink: 0;
        }

        .sbs-profile-menu-divider {
          height: 1px;
          background: #f1f5f9;
          margin: 6px 4px;
        }

        .sbs-profile-menu-item.logout {
          color: #64748b;
        }

        .sbs-profile-menu-item.logout:hover {
          background: #fef2f2;
          color: #dc2626;
        }

        /* ================================
           CONTENT
        ================================= */

        .sbs-content {
          padding: 32px 32px 48px;
          max-width: 1600px;
          width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
        }

        .sbs-page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 28px;
        }

        .sbs-page-header-copy {
          min-width: 0;
        }

        .sbs-page-title {
          margin: 0;
          font-size: 24px;
          line-height: 1.25;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #0f172a;
        }

        .sbs-page-description {
          margin: 4px 0 0;
          font-size: 13px;
          line-height: 1.5;
          color: #64748b;
        }

        .sbs-page-actions {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* ================================
           MOBILE OVERLAY
        ================================= */

        .sbs-mobile-overlay {
          display: none;
        }

        /* ================================
           TABLET
        ================================= */

        @media (max-width: 1024px) {
          .sbs-sidebar {
            width: 250px;
          }

          .sbs-main-area {
            margin-left: 250px;
          }

          .sbs-topbar {
            padding: 0 24px;
          }

          .sbs-content {
            padding: 24px 24px 40px;
          }

          .sbs-topbar-search {
            width: min(360px, 100%);
          }
        }

        /* ================================
           MOBILE
        ================================= */

        @media (max-width: 868px) {
          .sbs-sidebar {
            width: 270px;
            transform: translateX(-100%);
            box-shadow: none;
          }

          .sbs-sidebar.mobile-open {
            transform: translateX(0);
            box-shadow:
              12px 0 30px
              rgba(15, 23, 42, 0.25);
          }

          .sbs-main-area {
            margin-left: 0;
          }

          .sbs-mobile-menu {
            display: flex;
          }

          .sbs-mobile-overlay {
            position: fixed;
            inset: 0;
            display: block;
            background: rgba(
              15,
              23,
              42,
              0.4
            );
            backdrop-filter: blur(2px);
            z-index: 90;
            border: none;
            padding: 0;
            margin: 0;
            cursor: pointer;
          }

          .sbs-topbar {
            padding: 0 16px;
          }

          .sbs-topbar-search {
            flex: 1;
            min-width: 0;
            width: auto;
          }

          .sbs-topbar-company,
          .sbs-profile-name {
            display: none;
          }

          .sbs-profile {
            padding-left: 0;
            border-left: none;
          }

          .sbs-profile-trigger {
            padding-right: 3px;
          }

          .sbs-profile-chevron {
            display: none;
          }

          .sbs-profile-dropdown {
            position: fixed;
            top: 60px;
            right: 12px;
            width: min(
              255px,
              calc(100vw - 24px)
            );
          }

          .sbs-notification-wrapper {
            z-index: 300;
          }

          .sbs-search-results {
            min-width: 0;
            width: min(
              100vw - 32px,
              420px
            );
          }

          .sbs-content {
            padding: 20px 16px 32px;
          }
        }

        /* ================================
           SMALL MOBILE
        ================================= */

        @media (max-width: 640px) {
          .sbs-topbar {
            height: 64px;
            gap: 9px;
          }

          .sbs-sidebar-header {
            height: 64px;
          }

          .sbs-topbar-search {
            min-width: 0;
          }

          .sbs-search-input {
            font-size: 12px;
          }

          .sbs-page-header {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
            margin-bottom: 20px;
          }

          .sbs-page-title {
            font-size: 20px;
          }

          .sbs-page-actions {
            width: 100%;
          }

          .sbs-search-results {
            position: fixed;
            top: 60px;
            left: 12px;
            width: calc(100vw - 24px);
          }
        }
      `}</style>

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
            <span className="sbs-brand-mark">
              <Image
                src="/sbs-logo.png"
                alt="Sharif Business Solutions"
                width={36}
                height={36}
                className="sbs-brand-logo"
                priority
              />
            </span>

            <span className="sbs-brand-text">
              <span className="sbs-brand-name">
                Sharif Business
              </span>

              <span className="sbs-brand-subtitle">
                Management Platform
              </span>
            </span>
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
                <div className="sbs-profile-avatar">
                  {initials}
                </div>

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
                    <div className="sbs-profile-dropdown-avatar">
                      {initials}
                    </div>

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
                      "/settings"
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
                    Account Settings
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
      </div>
    </div>
  );
}