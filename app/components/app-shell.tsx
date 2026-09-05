"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  | "close"
  | "logout"
  | "chevron"
  | "bell";

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  available: boolean;
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
  avatar_url: string | null;
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
          available: false,
        },
        {
          label: "Warehouses",
          href: "/warehouses",
          icon: "warehouses",
          available: false,
        },
        {
          label: "Pricing",
          href: "/pricing",
          icon: "pricing",
          available: false,
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
          available: false,
        },
        {
          label: "Purchase Orders",
          href: "/purchases",
          icon: "purchases",
          available: false,
        },
        {
          label: "Expenses",
          href: "/expenses",
          icon: "expenses",
          available: false,
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
          available: false,
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
  size = 20,
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
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
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

    case "close":
      return (
        <svg {...common}>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
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

    case "bell":
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
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
  const [company, setCompany] = useState<WorkspaceCompany | null>(null);
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const sections = useMemo(() => getWorkspaceSections(), []);

  const allNavItems = useMemo(() => {
    return sections.flatMap((section) => section.items);
  }, [sections]);

  const activeItem = useMemo(() => {
    if (pathname === "/") {
      return allNavItems.find((item) => item.href === "/") ?? null;
    }

    return (
      allNavItems
        .filter((item) => item.href !== "/")
        .sort((a, b) => b.href.length - a.href.length)
        .find((item) => pathname.startsWith(item.href)) ?? null
    );
  }, [allNavItems, pathname]);

  const activeTitle =
    title || activeItem?.label || "Sharif Business Solutions";

  const activeDescription =
    description ||
    (activeItem?.label === "Sales & Orders"
      ? "Manage your sales, orders and customer transactions."
      : undefined);

  async function loadWorkspace() {
    try {
      setLoadingWorkspace(true);

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
          setCompany(companyData as WorkspaceCompany);
        }
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as WorkspaceProfile);
      }
    } catch (error) {
      console.error("Failed to load workspace:", error);
    } finally {
      setLoadingWorkspace(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();

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
  }, [supabase]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  function isActive(item: NavItem) {
    if (item.href === "/") {
      return pathname === "/";
    }

    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  function handleNavigation(item: NavItem) {
    if (!item.available) {
      return;
    }

    setMobileSidebarOpen(false);
    setSearchValue("");
    router.push(item.href);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = normalizeSearchText(searchValue);

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
        normalizeSearchText(item.label).includes(query)
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
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [profile?.full_name, company?.name]);

  return (
    <div className="sbs-app-shell">
      <style jsx global>{`
        .sbs-app-shell {
          min-height: 100vh;
          background: #f6f7f9;
          color: #111827;
        }

        .sbs-sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: 285px;
          height: 100vh;
          background: #ffffff;
          border-right: 1px solid #e5e7eb;
          z-index: 100;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: transform 0.25s ease;
        }

        .sbs-sidebar-header {
          height: 76px;
          padding: 0 22px;
          display: flex;
          align-items: center;
          border-bottom: 1px solid #f0f1f3;
          flex-shrink: 0;
        }

        .sbs-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          text-decoration: none;
          color: inherit;
        }

        .sbs-brand-mark {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #111827;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.04em;
          flex-shrink: 0;
        }

        .sbs-brand-text {
          min-width: 0;
        }

        .sbs-brand-name {
          font-size: 14px;
          line-height: 18px;
          font-weight: 750;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-brand-subtitle {
          margin-top: 2px;
          font-size: 11px;
          line-height: 15px;
          color: #9ca3af;
        }

        .sbs-sidebar-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 16px 12px 20px;
        }

        .sbs-sidebar-scroll::-webkit-scrollbar {
          width: 5px;
        }

        .sbs-sidebar-scroll::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 99px;
        }

        .sbs-nav-section {
          margin-bottom: 20px;
        }

        .sbs-nav-section-label {
          padding: 0 12px;
          margin-bottom: 7px;
          font-size: 10px;
          line-height: 15px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #9ca3af;
        }

        .sbs-nav-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sbs-nav-button {
          width: 100%;
          min-height: 42px;
          border: 0;
          border-radius: 9px;
          padding: 0 12px;
          display: flex;
          align-items: center;
          gap: 11px;
          background: transparent;
          color: #4b5563;
          font: inherit;
          font-size: 13px;
          font-weight: 550;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.15s ease,
            color 0.15s ease;
        }

        .sbs-nav-button:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .sbs-nav-button.active {
          background: #111827;
          color: #ffffff;
        }

        .sbs-nav-button.disabled {
          color: #b8bdc5;
          cursor: default;
        }

        .sbs-nav-button.disabled:hover {
          background: transparent;
          color: #b8bdc5;
        }

        .sbs-nav-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
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
          line-height: 15px;
          font-weight: 700;
          color: #9ca3af;
          background: #f3f4f6;
          padding: 1px 5px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .sbs-sidebar-footer {
          padding: 12px;
          border-top: 1px solid #f0f1f3;
          flex-shrink: 0;
        }

        .sbs-company-card {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .sbs-company-avatar {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: #f3f4f6;
          color: #374151;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .sbs-company-info {
          flex: 1;
          min-width: 0;
        }

        .sbs-company-name {
          font-size: 12px;
          font-weight: 700;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-company-type {
          margin-top: 2px;
          font-size: 10px;
          color: #9ca3af;
          text-transform: capitalize;
        }

        .sbs-main-area {
          min-height: 100vh;
          margin-left: 285px;
          min-width: 0;
        }

        .sbs-topbar {
          height: 76px;
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          padding: 0 28px;
          gap: 18px;
        }

        .sbs-mobile-menu {
          display: none;
          width: 38px;
          height: 38px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          border-radius: 9px;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #374151;
          flex-shrink: 0;
        }

        .sbs-topbar-search {
          width: min(430px, 100%);
          position: relative;
        }

        .sbs-search-form {
          position: relative;
        }

        .sbs-search-icon {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
        }

        .sbs-search-input {
          width: 100%;
          height: 40px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          border-radius: 9px;
          outline: none;
          padding: 0 14px 0 40px;
          font: inherit;
          font-size: 13px;
          color: #111827;
          transition:
            border-color 0.15s ease,
            background 0.15s ease,
            box-shadow 0.15s ease;
        }

        .sbs-search-input::placeholder {
          color: #9ca3af;
        }

        .sbs-search-input:focus {
          background: #ffffff;
          border-color: #cbd5e1;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.05);
        }

        .sbs-topbar-spacer {
          flex: 1;
        }

        .sbs-topbar-company {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          max-width: 230px;
        }

        .sbs-topbar-company-name {
          font-size: 12px;
          font-weight: 650;
          color: #4b5563;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-notification-button {
          width: 38px;
          height: 38px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #4b5563;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
        }

        .sbs-notification-dot {
          position: absolute;
          top: 7px;
          right: 7px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #111827;
          border: 1px solid #ffffff;
        }

        .sbs-profile {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }

        .sbs-profile-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #111827;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .sbs-profile-name {
          max-width: 130px;
          font-size: 12px;
          font-weight: 700;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-content {
          padding: 30px 32px 48px;
          max-width: 1600px;
          margin: 0 auto;
        }

        .sbs-page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
        }

        .sbs-page-header-copy {
          min-width: 0;
        }

        .sbs-page-title {
          margin: 0;
          font-size: 28px;
          line-height: 36px;
          font-weight: 750;
          letter-spacing: -0.025em;
          color: #111827;
        }

        .sbs-page-description {
          margin: 6px 0 0;
          font-size: 13px;
          line-height: 20px;
          color: #6b7280;
        }

        .sbs-page-actions {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sbs-mobile-overlay {
          display: none;
        }

        .sbs-logout-button {
          width: 100%;
          margin-top: 10px;
          min-height: 38px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #ffffff;
          color: #4b5563;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font: inherit;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
        }

        .sbs-logout-button:hover {
          background: #f9fafb;
          color: #111827;
        }

        .sbs-logout-button:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        @media (max-width: 1100px) {
          .sbs-sidebar {
            width: 260px;
          }

          .sbs-main-area {
            margin-left: 260px;
          }

          .sbs-topbar {
            padding: 0 20px;
          }

          .sbs-content {
            padding: 24px 22px 40px;
          }
        }

        @media (max-width: 900px) {
          .sbs-sidebar {
            width: 285px;
            transform: translateX(-100%);
            box-shadow: none;
          }

          .sbs-sidebar.mobile-open {
            transform: translateX(0);
            box-shadow: 18px 0 50px rgba(15, 23, 42, 0.12);
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
            background: rgba(15, 23, 42, 0.28);
            z-index: 90;
          }

          .sbs-topbar {
            padding: 0 16px;
            gap: 10px;
          }

          .sbs-topbar-search {
            flex: 1;
            width: auto;
          }

          .sbs-topbar-company {
            display: none;
          }

          .sbs-profile-name {
            display: none;
          }

          .sbs-content {
            padding: 22px 16px 36px;
          }
        }

        @media (max-width: 640px) {
          .sbs-topbar {
            height: 64px;
          }

          .sbs-sidebar-header {
            height: 64px;
          }

          .sbs-notification-button {
            display: none;
          }

          .sbs-profile-avatar {
            width: 34px;
            height: 34px;
          }

          .sbs-search-input {
            height: 38px;
          }

          .sbs-page-header {
            flex-direction: column;
            margin-bottom: 22px;
          }

          .sbs-page-title {
            font-size: 24px;
            line-height: 31px;
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
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`sbs-sidebar ${
          mobileSidebarOpen ? "mobile-open" : ""
        }`}
      >
        <div className="sbs-sidebar-header">
          <button
            type="button"
            className="sbs-brand"
            onClick={() => router.push("/")}
            aria-label="Go to dashboard"
          >
            <span className="sbs-brand-mark">SBS</span>

            <span className="sbs-brand-text">
              <span className="sbs-brand-name">
                Sharif Business Solutions
              </span>

              <span className="sbs-brand-subtitle">
                Business Management Platform
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
                  const active = isActive(item);

                  return (
                    <button
                      key={item.href}
                      type="button"
                      className={`sbs-nav-button ${
                        active ? "active" : ""
                      } ${!item.available ? "disabled" : ""}`}
                      onClick={() => handleNavigation(item)}
                      disabled={!item.available}
                      title={
                        item.available
                          ? item.label
                          : `${item.label} — Coming soon`
                      }
                    >
                      <span className="sbs-nav-icon">
                        <Icon name={item.icon} size={18} />
                      </span>

                      <span className="sbs-nav-label">
                        {item.label}
                      </span>

                      {!item.available && (
                        <span className="sbs-coming-soon">
                          SOON
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="sbs-sidebar-footer">
          <div className="sbs-company-card">
            <div className="sbs-company-avatar">
              {initials}
            </div>

            <div className="sbs-company-info">
              <div className="sbs-company-name">
                {loadingWorkspace
                  ? "Loading workspace..."
                  : company?.name || "My Company"}
              </div>

              <div className="sbs-company-type">
                {company?.business_type === "product"
                  ? "Product Business"
                  : company?.business_type === "service"
                    ? "Service Business"
                    : "Business Workspace"}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="sbs-logout-button"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <Icon name="logout" size={16} />
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="sbs-main-area">
        <header className="sbs-topbar">
          <button
            type="button"
            className="sbs-mobile-menu"
            onClick={() =>
              setMobileSidebarOpen((current) => !current)
            }
            aria-label={
              mobileSidebarOpen
                ? "Close navigation"
                : "Open navigation"
            }
          >
            <Icon
              name={mobileSidebarOpen ? "close" : "menu"}
              size={19}
            />
          </button>

          <div className="sbs-topbar-search">
            <form
              className="sbs-search-form"
              onSubmit={handleSearchSubmit}
            >
              <span className="sbs-search-icon">
                <Icon name="search" size={17} />
              </span>

              <input
                type="search"
                value={searchValue}
                onChange={(event) =>
                  setSearchValue(event.target.value)
                }
                className="sbs-search-input"
                placeholder="Search pages..."
                aria-label="Search pages"
              />
            </form>
          </div>

          <div className="sbs-topbar-spacer" />

          <div className="sbs-topbar-company">
            <span className="sbs-topbar-company-name">
              {company?.name || ""}
            </span>
          </div>

          <button
            type="button"
            className="sbs-notification-button"
            aria-label="Notifications"
          >
            <Icon name="bell" size={18} />
            <span className="sbs-notification-dot" />
          </button>

          <div className="sbs-profile">
            <div className="sbs-profile-avatar">
              {initials}
            </div>

            <div className="sbs-profile-name">
              {profile?.full_name ||
                company?.name ||
                "Workspace User"}
            </div>
          </div>
        </header>

        <main className="sbs-content">
          {(title || description || actions) && (
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