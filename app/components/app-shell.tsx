"use client";

import {
  useCallback,
  useEffect,
  useMemo,
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
        },
        {
          label: "Quotes",
          href: "/estimates",
          icon: "quotes",
          available: true,
        },
        {
          label: "Sales & Orders",
          href: "/sales",
          icon: "orders",
          available: true,
        },
        {
          label: "Invoices",
          href: "/invoices",
          icon: "invoices",
          available: true,
        },
        {
          label: "Payments",
          href: "/payments",
          icon: "payments",
          available: true,
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
        },
        {
          label: "Serial Numbers",
          href: "/serial-numbers",
          icon: "serials",
          available: true,
        },
        {
          label: "Inventory",
          href: "/inventory",
          icon: "inventory",
          available: true,
        },
        {
          label: "Warehouses",
          href: "/warehouses",
          icon: "warehouses",
          available: true,
        },
        {
          label: "Pricing",
          href: "/pricing/products",
          icon: "pricing",
          available: true,
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
        },
        {
          label: "Purchase Orders",
          href: "/purchase-orders",
          icon: "purchases",
          available: true,
        },
        {
          label: "Expenses",
          href: "/expenses",
          icon: "expenses",
          available: true,
          children: [
            {
              label: "Categories",
              href: "/expenses/categories",
              icon: "chevron",
              available: true,
            },
            {
              label: "Closings",
              href: "/expenses/closings",
              icon: "chevron",
              available: true,
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
          available: false,
        },
        {
          label: "Repairs",
          href: "/repairs",
          icon: "repairs",
          available: false,
        },
        {
          label: "RMA",
          href: "/rma",
          icon: "rma",
          available: false,
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
        },
        {
          label: "Reports & Analytics",
          href: "/reports",
          icon: "reports",
          available: false,
        },
        {
          label: "Employees",
          href: "/employees",
          icon: "employees",
          available: true,
        },
        {
          label: "Documents",
          href: "/documents",
          icon: "documents",
          available: false,
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
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );

    case "customers":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );

    case "quotes":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
          <line x1="8" y1="9" x2="10" y2="9" />
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
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="8" y1="16" x2="16" y2="16" />
        </svg>
      );

    case "payments":
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <line x1="6" y1="15" x2="10" y2="15" />
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
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="7" y1="8" x2="7" y2="16" />
          <line x1="10" y1="8" x2="10" y2="16" />
          <line x1="14" y1="8" x2="14" y2="16" />
          <line x1="17" y1="8" x2="17" y2="16" />
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
          <line x1="8" y1="7" x2="10" y2="7" />
          <line x1="8" y1="11" x2="10" y2="11" />
          <line x1="8" y1="15" x2="10" y2="15" />
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
          <circle cx="12" cy="12" r="9" />
          <path d="M15 8.5c-.7-.6-1.7-1-3-1-1.7 0-3 1-3 2.2 0 1.4 1.4 2 3 2.3 1.6.3 3 1 3 2.4 0 1.3-1.3 2.3-3 2.3-1.2 0-2.3-.4-3-1" />
          <line x1="12" y1="6" x2="12" y2="18" />
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
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <circle cx="7" cy="6.5" r=".5" />
          <circle cx="10" cy="6.5" r=".5" />
        </svg>
      );

    case "reports":
      return (
        <svg {...common}>
          <line x1="4" y1="20" x2="4" y2="10" />
          <line x1="10" y1="20" x2="10" y2="4" />
          <line x1="16" y1="20" x2="16" y2="13" />
          <line x1="22" y1="20" x2="22" y2="7" />
        </svg>
      );

    case "employees":
      return (
        <svg {...common}>
          <circle cx="9" cy="7" r="4" />
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
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="14" y2="17" />
        </svg>
      );

    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V22h-2.6v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.6-1H6v-2.6h.4A1.7 1.7 0 0 0 8 10.4a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h2.6v.4a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.4V13h-.4a1.7 1.7 0 0 0-1.6 1Z" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
      );

    case "menu":
      return (
        <svg {...common}>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
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
  return value.trim().toLowerCase();
}

export default function AppShell({
  children,
  title,
  description,
  actions,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const supabase = useMemo(() => createClient(), []);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [company, setCompany] =
    useState<WorkspaceCompany | null>(null);
  const [profile, setProfile] =
    useState<WorkspaceProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const sections = useMemo(
    () => getWorkspaceSections(),
    []
  );

  const allNavItems = useMemo(() => {
    return sections.flatMap((section) => section.items);
  }, [sections]);

  const loadWorkspace = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data: membership } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membership?.company_id) {
        const { data: companyData } = await supabase
          .from("companies")
          .select(
            "id, name, currency, timezone, business_type"
          )
          .eq("id", membership.company_id)
          .maybeSingle();

        if (companyData) {
          setCompany(
            companyData as WorkspaceCompany
          );
        }
      }

      const { data: profileData } = await supabase
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

  function handleNavigation(item: NavItem) {
    if (!item.available) {
      return;
    }

    setMobileSidebarOpen(false);
    setSearchValue("");
    router.push(item.href);
  }

  function handleSearchSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const query = normalizeSearchText(
      searchValue
    );

    if (!query) {
      return;
    }

    const exactMatch = allNavItems.find(
      (item) =>
        item.available &&
        normalizeSearchText(item.label) === query
    );

    if (exactMatch) {
      handleNavigation(exactMatch);
      return;
    }

    const partialMatch = allNavItems.find(
      (item) =>
        item.available &&
        normalizeSearchText(item.label).includes(
          query
        )
    );

    if (partialMatch) {
      handleNavigation(partialMatch);
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
  }, [profile?.full_name, company?.name]);

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
          background: #ffffff;
          border-right: 1px solid #e2e8f0;
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
          border-bottom: 1px solid #f1f5f9;
          flex-shrink: 0;
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
          border-radius: 8px;
          background: linear-gradient(
            135deg,
            #0f172a 0%,
            #1e293b 100%
          );
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.03em;
          flex-shrink: 0;
          box-shadow:
            0 2px 4px
            rgba(15, 23, 42, 0.08);
          overflow: hidden;
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
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-brand-subtitle {
          margin-top: 3px;
          font-size: 11px;
          line-height: 1;
          color: #64748b;
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

        .sbs-sidebar-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
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
          letter-spacing: 0.08em;
          color: #94a3b8;
          text-transform: uppercase;
        }

        .sbs-nav-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .sbs-nav-button {
          width: 100%;
          height: 38px;
          border: 0;
          border-radius: 7px;
          padding: 0 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: transparent;
          color: #475569;
          font: inherit;
          font-size: 13px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .sbs-nav-button:hover:not(.disabled) {
          background: #f1f5f9;
          color: #0f172a;
        }

        .sbs-nav-button.active {
          background: #eff6ff;
          color: #2563eb;
          font-weight: 600;
        }

        .sbs-nav-button.disabled {
          color: #cbd5e1;
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

        .sbs-nav-button.active .sbs-nav-icon {
          color: #2563eb;
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
          color: #94a3b8;
          background: #f1f5f9;
          padding: 3px 6px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        /* ================================
           NESTED NAVIGATION
        ================================= */

        .sbs-nav-sub-list {
          margin: 2px 0 6px;
          padding-left: 34px;
        }

        .sbs-nav-sub-button {
          position: relative;
          width: 100%;
          min-height: 36px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 7px 10px 7px 12px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #64748b;
          font: inherit;
          font-size: 13px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.15s ease,
            color 0.15s ease;
        }

        .sbs-nav-sub-button:hover:not(.disabled) {
          background: #f8fafc;
          color: #0f172a;
        }

        .sbs-nav-sub-button.active {
          background: #f1f5f9;
          color: #0f172a;
          font-weight: 600;
        }

        .sbs-nav-sub-button.disabled {
          cursor: not-allowed;
          opacity: 0.5;
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
          color: #2563eb;
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
          border-top: 1px solid #f1f5f9;
          flex-shrink: 0;
          background: #ffffff;
        }

        .sbs-company-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          background: #f8fafc;
        }

        .sbs-company-avatar {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          background: #e2e8f0;
          color: #334155;
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
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-company-type {
          margin-top: 2px;
          font-size: 10px;
          color: #64748b;
          text-transform: capitalize;
        }

        .sbs-logout-button {
          width: 100%;
          margin-top: 8px;
          height: 34px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #ffffff;
          color: #64748b;
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
          background: #fef2f2;
          border-color: #fecaca;
          color: #ef4444;
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
            0.85
          );
          backdrop-filter: blur(12px);
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

        .sbs-topbar-search {
          width: min(380px, 100%);
        }

        .sbs-search-form {
          position: relative;
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
          border-radius: 7px;
          outline: none;
          padding: 0 12px 0 36px;
          font: inherit;
          font-size: 13px;
          color: #0f172a;
          transition: all 0.15s ease;
          box-sizing: border-box;
        }

        .sbs-search-input::placeholder {
          color: #94a3b8;
        }

        .sbs-search-input:focus {
          background: #ffffff;
          border-color: #2563eb;
          box-shadow:
            0 0 0 3px
            rgba(37, 99, 235, 0.1);
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
          padding: 4px 10px;
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 6px;
        }

        .sbs-topbar-company-name {
          font-size: 12px;
          font-weight: 500;
          color: #475569;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /*
         * Notification Center styling intentionally does NOT live here.
         *
         * NotificationCenter owns:
         * - bell
         * - unread badge
         * - dropdown
         * - read/unread state
         * - realtime updates
         *
         * This prevents AppShell CSS from fighting
         * with NotificationCenter CSS.
         */

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

        .sbs-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          padding-left: 8px;
          border-left: 1px solid #f1f5f9;
        }

        .sbs-profile-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #0f172a;
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
              rgba(15, 23, 42, 0.15);
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
          }

          .sbs-topbar-company,
          .sbs-profile-name {
            display: none;
          }

          .sbs-profile {
            padding-left: 0;
            border-left: none;
          }

          .sbs-content {
            padding: 20px 16px 32px;
          }

          /*
           * The notification component handles
           * its own mobile dropdown positioning.
           */
          .sbs-notification-wrapper {
            z-index: 300;
          }
        }

        /* ================================
           SMALL MOBILE
        ================================= */

        @media (max-width: 640px) {
          .sbs-topbar {
            height: 64px;
          }

          .sbs-sidebar-header {
            height: 64px;
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
            onClick={() => router.push("/")}
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
                    (active || childActive);

                  return (
                    <div key={item.href}>
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
                          handleNavigation(item)
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
                            name={item.icon}
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
                                isActive(child);

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
            onClick={handleLogout}
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
              setMobileSidebarOpen(true)
            }
            aria-label="Open navigation menu"
          >
            <Icon
              name="menu"
              size={20}
            />
          </button>

          {/* ================================
              GLOBAL SEARCH
          ================================= */}

          <div className="sbs-topbar-search">
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
                placeholder="Search module..."
                value={searchValue}
                onChange={(event) =>
                  setSearchValue(
                    event.target.value
                  )
                }
              />
            </form>
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
              UNIVERSAL NOTIFICATION CENTER
          ================================= */}

          <div className="sbs-notification-wrapper">
            <NotificationCenter
            />
          </div>

          {/* ================================
              PROFILE
          ================================= */}

          <div className="sbs-profile">
            <div className="sbs-profile-avatar">
              {initials}
            </div>

            <span className="sbs-profile-name">
              {profile?.full_name ||
                "Account"}
            </span>
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