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

type Company = {
  id: string;
  name: string;
  currency: string | null;
  timezone: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
};

type Membership = {
  company_id: string;
  role: string;
};

type CompanyUpdatedDetail = {
  id: string;
  name: string;
  currency?: string | null;
  timezone?: string | null;
};

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

function getInitials(name: string) {
  const cleanName = name.trim();

  if (!cleanName) return "U";

  const parts = cleanName.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function Icon({
  name,
  size = 19,
}: {
  name:
    | "dashboard"
    | "leads"
    | "customers"
    | "jobs"
    | "estimates"
    | "invoices"
    | "settings"
    | "search"
    | "menu"
    | "close"
    | "logout"
    | "chevron"
    | "bell";
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
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );

    case "leads":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6" />
          <path d="M22 11h-6" />
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

    case "jobs":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
          <path d="M10 12v2h4v-2" />
        </svg>
      );

    case "estimates":
      return (
        <svg {...common}>
          <path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      );

    case "invoices":
      return (
        <svg {...common}>
          <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
          <path d="M8 15h5" />
        </svg>
      );

    case "settings":
      return (
        <svg {...common}>
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4V19a2 2 0 0 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 3.6 11H3.5a2 2 0 0 1 0-4h.2a2 2 0 0 0 1.4-3.4L5 3.5a2 2 0 1 1 2.8-2.8l.1.1A2 2 0 0 0 11.3 2V1.9a2 2 0 0 1 4 0V2a2 2 0 0 0 3.4 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 20.9 9h.1a2 2 0 0 1 0 4h-.1a2 2 0 0 0-1.5 2Z" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );

    case "menu":
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </svg>
      );

    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </svg>
      );

    case "logout":
      return (
        <svg {...common}>
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M21 19V5a2 2 0 0 0-2-2h-5" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
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

export default function AppShell({
  children,
  title,
  description,
  actions,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [company, setCompany] = useState<Company | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: "/",
      icon: <Icon name="dashboard" />,
    },
    {
      label: "Leads",
      href: "/leads",
      icon: <Icon name="leads" />,
    },
    {
      label: "Customers",
      href: "/customers",
      icon: <Icon name="customers" />,
    },
    {
      label: "Jobs",
      href: "/jobs",
      icon: <Icon name="jobs" />,
    },
    {
      label: "Estimates",
      href: "/estimates",
      icon: <Icon name="estimates" />,
    },
    {
      label: "Invoices",
      href: "/invoices",
      icon: <Icon name="invoices" />,
    },
  ];

  const settingsItem: NavItem = {
    label: "Settings",
    href: "/settings",
    icon: <Icon name="settings" />,
  };

  useEffect(() => {
    let mounted = true;

    async function loadAppContext() {
      setLoading(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const { data: membershipData, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id, role")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (membershipError || !membershipData) {
          console.error(
            "Unable to load company membership.",
            membershipError
          );
          return;
        }

        const { data: companyData, error: companyError } =
          await supabase
            .from("companies")
            .select("id, name, currency, timezone")
            .eq("id", membershipData.company_id)
            .maybeSingle();

        if (companyError || !companyData) {
          console.error(
            "Unable to load company.",
            companyError
          );
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) return;

        setMembership(membershipData);
        setCompany(companyData);
        setProfile(profileData ?? null);
      } catch (error) {
        console.error(
          "App shell initialization failed:",
          error
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadAppContext();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  /*
   * Company synchronization.
   *
   * Settings sends a CustomEvent containing the already-updated
   * company. We use that immediately so the sidebar/topbar never
   * depends on a second database request.
   *
   * If an older plain Event is dispatched, we fall back to
   * fetching the company from Supabase.
   */
  useEffect(() => {
    async function refreshCompany() {
      if (!membership?.company_id) return;

      const { data, error } = await supabase
        .from("companies")
        .select("id, name, currency, timezone")
        .eq("id", membership.company_id)
        .maybeSingle();

      if (error) {
        console.error(
          "Unable to refresh company:",
          error
        );
        return;
      }

      if (data) {
        setCompany(data);
      }
    }

    function handleCompanyUpdated(event: Event) {
      const customEvent =
        event as CustomEvent<CompanyUpdatedDetail>;

      const detail = customEvent.detail;

      if (
        detail &&
        detail.id &&
        detail.id === membership?.company_id
      ) {
        setCompany((previous) => ({
          id: detail.id,
          name: detail.name,
          currency:
            detail.currency ??
            previous?.currency ??
            null,
          timezone:
            detail.timezone ??
            previous?.timezone ??
            null,
        }));

        return;
      }

      void refreshCompany();
    }

    window.addEventListener(
      "sbs-company-updated",
      handleCompanyUpdated
    );

    return () => {
      window.removeEventListener(
        "sbs-company-updated",
        handleCompanyUpdated
      );
    };
  }, [membership?.company_id, supabase]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setProfileOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  const companyName = company?.name || "Your Company";
  const userName = profile?.full_name || "User";

  const role = membership?.role
    ? membership.role.charAt(0).toUpperCase() +
      membership.role.slice(1)
    : "Member";

  const companyInitials = getInitials(companyName);
  const userInitials = getInitials(userName);

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }

  async function handleLogout() {
    setProfileOpen(false);

    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  function navigateTo(href: string) {
    router.push(href);
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-card">
          <div className="app-loading-logo">SBS</div>
          <div className="app-loading-line app-loading-line-lg" />
          <div className="app-loading-line" />
          <div className="app-loading-line app-loading-line-sm" />
        </div>

        <style jsx>{`
          .app-loading {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f3f6fa;
            padding: 24px;
          }

          .app-loading-card {
            width: 280px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
          }

          .app-loading-logo {
            width: 52px;
            height: 52px;
            border-radius: 14px;
            display: grid;
            place-items: center;
            background: #172033;
            color: white;
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 0.04em;
            margin-bottom: 10px;
          }

          .app-loading-line {
            width: 100%;
            height: 12px;
            border-radius: 999px;
            background: linear-gradient(
              90deg,
              #e6ebf1 25%,
              #f5f7fa 50%,
              #e6ebf1 75%
            );
            background-size: 200% 100%;
            animation: loading 1.4s infinite;
          }

          .app-loading-line-lg {
            width: 80%;
          }

          .app-loading-line-sm {
            width: 55%;
          }

          @keyframes loading {
            from {
              background-position: 200% 0;
            }

            to {
              background-position: -200% 0;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="sbs-app">
      <aside
        className={`sbs-sidebar ${
          mobileOpen ? "is-open" : ""
        }`}
      >
        <div className="sbs-sidebar-inner">
          <div className="sbs-brand">
            <button
              type="button"
              className="sbs-brand-button"
              onClick={() => navigateTo("/")}
              aria-label="Go to dashboard"
            >
              <div className="sbs-brand-mark">SBS</div>

              <div className="sbs-brand-text">
                <span className="sbs-brand-name">
                  Sharif Business
                </span>

                <span className="sbs-brand-subtitle">
                  Contractor Hub
                </span>
              </div>
            </button>

            <button
              type="button"
              className="sbs-mobile-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <div className="sbs-company">
            <div className="sbs-company-avatar">
              {companyInitials}
            </div>

            <div className="sbs-company-info">
              <span className="sbs-company-label">
                Company
              </span>

              <span
                className="sbs-company-name"
                title={companyName}
              >
                {companyName}
              </span>
            </div>
          </div>

          <nav
            className="sbs-nav"
            aria-label="Main navigation"
          >
            <div className="sbs-nav-section">
              <span className="sbs-nav-label">
                Workspace
              </span>

              <div className="sbs-nav-list">
                {navItems.map((item) => {
                  const active = isActive(item.href);

                  return (
                    <button
                      key={item.href}
                      type="button"
                      className={`sbs-nav-item ${
                        active ? "is-active" : ""
                      }`}
                      onClick={() =>
                        navigateTo(item.href)
                      }
                    >
                      <span className="sbs-nav-icon">
                        {item.icon}
                      </span>

                      <span className="sbs-nav-text">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sbs-nav-section sbs-settings-section">
              <span className="sbs-nav-label">
                Administration
              </span>

              <button
                type="button"
                className={`sbs-nav-item ${
                  isActive(settingsItem.href)
                    ? "is-active"
                    : ""
                }`}
                onClick={() =>
                  navigateTo(settingsItem.href)
                }
              >
                <span className="sbs-nav-icon">
                  {settingsItem.icon}
                </span>

                <span className="sbs-nav-text">
                  {settingsItem.label}
                </span>
              </button>
            </div>
          </nav>

          <div className="sbs-sidebar-bottom">
            <div className="sbs-user-card">
              <div className="sbs-user-avatar">
                {userInitials}
              </div>

              <div className="sbs-user-info">
                <span
                  className="sbs-user-name"
                  title={userName}
                >
                  {userName}
                </span>

                <span className="sbs-user-role">
                  {role}
                </span>
              </div>

              <button
                type="button"
                className="sbs-user-menu-button"
                onClick={() =>
                  setProfileOpen(
                    (current) => !current
                  )
                }
                aria-label="Open user menu"
                aria-expanded={profileOpen}
              >
                <Icon
                  name="chevron"
                  size={17}
                />
              </button>
            </div>

            {profileOpen && (
              <div className="sbs-user-menu">
                <button
                  type="button"
                  className="sbs-user-menu-item"
                  onClick={() =>
                    navigateTo("/settings")
                  }
                >
                  <Icon
                    name="settings"
                    size={17}
                  />
                  <span>Account Settings</span>
                </button>

                <button
                  type="button"
                  className="sbs-user-menu-item sbs-user-menu-danger"
                  onClick={handleLogout}
                >
                  <Icon
                    name="logout"
                    size={17}
                  />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="sbs-sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <div className="sbs-main">
        <header className="sbs-topbar">
          <div className="sbs-topbar-left">
            <button
              type="button"
              className="sbs-mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" size={21} />
            </button>

            <div className="sbs-page-heading">
              <div className="sbs-breadcrumb">
                <span>Contractor Hub</span>

                <span className="sbs-breadcrumb-separator">
                  /
                </span>

                <span className="sbs-breadcrumb-current">
                  {title ||
                    getPageTitle(pathname)}
                </span>
              </div>

              {title && (
                <h1 className="sbs-topbar-title">
                  {title}
                </h1>
              )}
            </div>
          </div>

          <div className="sbs-topbar-center">
            <div className="sbs-global-search">
              <span className="sbs-search-icon">
                <Icon
                  name="search"
                  size={18}
                />
              </span>

              <input
                type="search"
                placeholder="Search anything..."
                aria-label="Search"
              />

              <span className="sbs-search-shortcut">
                ⌘ K
              </span>
            </div>
          </div>

          <div className="sbs-topbar-right">
            <button
              type="button"
              className="sbs-company-topbar"
              onClick={() =>
                navigateTo("/settings")
              }
              title="Open company settings"
            >
              <span className="sbs-company-topbar-avatar">
                {companyInitials}
              </span>

              <span className="sbs-company-topbar-name">
                {companyName}
              </span>
            </button>

            <button
              type="button"
              className="sbs-notification-button"
              aria-label="Notifications"
            >
              <Icon
                name="bell"
                size={19}
              />

              <span className="sbs-notification-dot" />
            </button>

            <button
              type="button"
              className="sbs-profile-button"
              onClick={() =>
                setProfileOpen(
                  (current) => !current
                )
              }
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
            >
              <span className="sbs-profile-avatar">
                {userInitials}
              </span>

              <span className="sbs-profile-details">
                <span className="sbs-profile-name">
                  {userName}
                </span>

                <span className="sbs-profile-role">
                  {role}
                </span>
              </span>

              <Icon
                name="chevron"
                size={16}
              />
            </button>
          </div>
        </header>

        <main className="sbs-content">
          <div className="sbs-content-inner">
            {(title ||
              description ||
              actions) && (
              <div className="sbs-page-header">
                <div className="sbs-page-header-copy">
                  {title && (
                    <h2 className="sbs-page-title">
                      {title}
                    </h2>
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
          </div>
        </main>
      </div>

      <style jsx global>{`
        :root {
          --sbs-bg: #f3f6fa;
          --sbs-surface: #ffffff;
          --sbs-surface-soft: #f8fafc;
          --sbs-border: #e1e7ee;
          --sbs-border-strong: #d3dbe5;
          --sbs-text: #17202b;
          --sbs-text-soft: #5f6b7a;
          --sbs-text-muted: #8a95a3;
          --sbs-primary: #172033;
          --sbs-primary-hover: #273249;
          --sbs-primary-soft: #eef1f6;
          --sbs-success: #15803d;
          --sbs-danger: #b42318;
          --sbs-sidebar-width: 258px;
          --sbs-topbar-height: 74px;
          --sbs-radius: 14px;
          --sbs-shadow-sm: 0 2px 8px rgba(16, 24, 40, 0.04);
          --sbs-shadow-md: 0 10px 30px rgba(16, 24, 40, 0.08);
        }

        * {
          box-sizing: border-box;
        }

        .sbs-app {
          min-height: 100vh;
          background: var(--sbs-bg);
          color: var(--sbs-text);
        }

        .sbs-sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: var(--sbs-sidebar-width);
          z-index: 100;
          background: var(--sbs-surface);
          border-right: 1px solid var(--sbs-border);
        }

        .sbs-sidebar-inner {
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 18px 14px 14px;
        }

        .sbs-brand {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 58px;
          padding: 0 6px 16px;
        }

        .sbs-brand-button {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
          text-align: left;
        }

        .sbs-brand-mark {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: var(--sbs-primary);
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          box-shadow: 0 5px 14px rgba(23, 32, 51, 0.16);
        }

        .sbs-brand-text {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .sbs-brand-name {
          color: var(--sbs-text);
          font-size: 14px;
          line-height: 18px;
          font-weight: 750;
          white-space: nowrap;
        }

        .sbs-brand-subtitle {
          margin-top: 1px;
          color: var(--sbs-text-muted);
          font-size: 11px;
          line-height: 16px;
          font-weight: 500;
        }

        .sbs-mobile-close {
          display: none;
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: var(--sbs-text-soft);
          cursor: pointer;
        }

        .sbs-mobile-close:hover {
          background: var(--sbs-surface-soft);
          color: var(--sbs-text);
        }

        .sbs-company {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 2px 2px 20px;
          padding: 10px;
          border: 1px solid var(--sbs-border);
          border-radius: 11px;
          background: var(--sbs-surface-soft);
        }

        .sbs-company-avatar {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #e6ebf2;
          color: var(--sbs-primary);
          font-size: 10px;
          font-weight: 800;
        }

        .sbs-company-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .sbs-company-label {
          color: var(--sbs-text-muted);
          font-size: 9px;
          line-height: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }

        .sbs-company-name {
          margin-top: 1px;
          color: var(--sbs-text);
          font-size: 12px;
          line-height: 17px;
          font-weight: 650;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-nav {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 0 2px;
        }

        .sbs-nav-section {
          margin-bottom: 20px;
        }

        .sbs-nav-label {
          display: block;
          padding: 0 10px 8px;
          color: var(--sbs-text-muted);
          font-size: 9px;
          line-height: 14px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.09em;
        }

        .sbs-nav-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .sbs-nav-item {
          width: 100%;
          height: 42px;
          display: flex;
          align-items: center;
          gap: 11px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          color: var(--sbs-text-soft);
          padding: 0 11px;
          cursor: pointer;
          text-align: left;
          font: inherit;
          transition:
            background 150ms ease,
            color 150ms ease,
            border-color 150ms ease;
        }

        .sbs-nav-item:hover {
          background: var(--sbs-surface-soft);
          color: var(--sbs-text);
        }

        .sbs-nav-item.is-active {
          background: var(--sbs-primary-soft);
          border-color: #e1e6ee;
          color: var(--sbs-primary);
          font-weight: 650;
        }

        .sbs-nav-icon {
          width: 20px;
          height: 20px;
          display: grid;
          place-items: center;
          flex: 0 0 20px;
        }

        .sbs-nav-text {
          font-size: 13px;
          line-height: 18px;
        }

        .sbs-settings-section {
          padding-top: 16px;
          border-top: 1px solid var(--sbs-border);
        }

        .sbs-sidebar-bottom {
          position: relative;
          padding-top: 12px;
          border-top: 1px solid var(--sbs-border);
        }

        .sbs-user-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border-radius: 11px;
        }

        .sbs-user-avatar,
        .sbs-profile-avatar {
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: var(--sbs-primary);
          color: #fff;
          font-weight: 750;
          flex: 0 0 auto;
        }

        .sbs-user-avatar {
          width: 34px;
          height: 34px;
          font-size: 10px;
        }

        .sbs-user-info {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .sbs-user-name {
          color: var(--sbs-text);
          font-size: 12px;
          line-height: 17px;
          font-weight: 650;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbs-user-role {
          color: var(--sbs-text-muted);
          font-size: 10px;
          line-height: 15px;
        }

        .sbs-user-menu-button {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--sbs-text-muted);
          cursor: pointer;
        }

        .sbs-user-menu-button:hover {
          background: var(--sbs-surface-soft);
          color: var(--sbs-text);
        }

        .sbs-user-menu {
          position: absolute;
          left: 8px;
          right: 8px;
          bottom: calc(100% + 8px);
          padding: 6px;
          background: var(--sbs-surface);
          border: 1px solid var(--sbs-border);
          border-radius: 12px;
          box-shadow: var(--sbs-shadow-md);
          z-index: 150;
        }

        .sbs-user-menu-item {
          width: 100%;
          height: 38px;
          display: flex;
          align-items: center;
          gap: 9px;
          border: 0;
          border-radius: 8px;
          padding: 0 10px;
          background: transparent;
          color: var(--sbs-text-soft);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          text-align: left;
        }

        .sbs-user-menu-item:hover {
          background: var(--sbs-surface-soft);
          color: var(--sbs-text);
        }

        .sbs-user-menu-danger:hover {
          color: var(--sbs-danger);
          background: #fff5f4;
        }

        .sbs-main {
          min-height: 100vh;
          margin-left: var(--sbs-sidebar-width);
        }

        .sbs-topbar {
          position: sticky;
          top: 0;
          z-index: 80;
          min-height: var(--sbs-topbar-height);
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 12px 28px;
          background: rgba(255, 255, 255, 0.94);
          border-bottom: 1px solid var(--sbs-border);
          backdrop-filter: blur(12px);
        }

        .sbs-topbar-left {
          min-width: 190px;
          display: flex;
          align-items: center;
        }

        .sbs-page-heading {
          min-width: 0;
        }

        .sbs-breadcrumb {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--sbs-text-muted);
          font-size: 10px;
          line-height: 14px;
          font-weight: 550;
        }

        .sbs-breadcrumb-current {
          color: var(--sbs-text-soft);
          font-weight: 650;
        }

        .sbs-breadcrumb-separator {
          color: #b5bec9;
        }

        .sbs-topbar-title {
          margin: 2px 0 0;
          color: var(--sbs-text);
          font-size: 15px;
          line-height: 20px;
          font-weight: 750;
        }

        .sbs-topbar-center {
          flex: 1;
          display: flex;
          justify-content: center;
          min-width: 180px;
        }

        .sbs-global-search {
          width: min(100%, 430px);
          height: 40px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 11px;
          background: var(--sbs-surface-soft);
          border: 1px solid var(--sbs-border);
          border-radius: 10px;
          color: var(--sbs-text-soft);
          transition:
            border-color 150ms ease,
            box-shadow 150ms ease,
            background 150ms ease;
        }

        .sbs-global-search:focus-within {
          background: #fff;
          border-color: var(--sbs-border-strong);
          box-shadow: 0 0 0 3px rgba(23, 32, 51, 0.05);
        }

        .sbs-search-icon {
          display: grid;
          place-items: center;
          color: var(--sbs-text-muted);
        }

        .sbs-global-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--sbs-text);
          font: inherit;
          font-size: 12px;
        }

        .sbs-global-search input::placeholder {
          color: var(--sbs-text-muted);
        }

        .sbs-search-shortcut {
          flex: 0 0 auto;
          padding: 3px 6px;
          border: 1px solid var(--sbs-border);
          border-radius: 5px;
          color: var(--sbs-text-muted);
          background: #fff;
          font-size: 9px;
          line-height: 12px;
          white-space: nowrap;
        }

        .sbs-topbar-right {
          min-width: 250px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .sbs-company-topbar {
          min-width: 0;
          max-width: 190px;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 0;
          background: transparent;
          color: var(--sbs-text);
          padding: 5px;
          cursor: pointer;
          font: inherit;
        }

        .sbs-company-topbar-avatar {
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          flex: 0 0 29px;
          border-radius: 8px;
          background: #e6ebf2;
          color: var(--sbs-primary);
          font-size: 9px;
          font-weight: 800;
        }

        .sbs-company-topbar-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 11px;
          font-weight: 650;
        }

        .sbs-notification-button {
          position: relative;
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 1px solid transparent;
          border-radius: 9px;
          background: transparent;
          color: var(--sbs-text-soft);
          cursor: pointer;
        }

        .sbs-notification-button:hover {
          background: var(--sbs-surface-soft);
          border-color: var(--sbs-border);
          color: var(--sbs-text);
        }

        .sbs-notification-dot {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #c2410c;
          border: 1px solid #fff;
        }

        .sbs-profile-button {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          border: 0;
          background: transparent;
          padding: 4px 2px;
          color: var(--sbs-text-soft);
          cursor: pointer;
          font: inherit;
          text-align: left;
        }

        .sbs-profile-avatar {
          width: 34px;
          height: 34px;
          font-size: 10px;
        }

        .sbs-profile-details {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .sbs-profile-name {
          max-width: 90px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--sbs-text);
          font-size: 11px;
          line-height: 15px;
          font-weight: 650;
        }

        .sbs-profile-role {
          color: var(--sbs-text-muted);
          font-size: 9px;
          line-height: 13px;
        }

        .sbs-profile-button > :last-child {
          color: var(--sbs-text-muted);
        }

        .sbs-content {
          width: 100%;
        }

        .sbs-content-inner {
          width: min(100%, 1600px);
          margin: 0 auto;
          padding: 28px;
        }

        .sbs-page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .sbs-page-header-copy {
          min-width: 0;
        }

        .sbs-page-title {
          margin: 0;
          color: var(--sbs-text);
          font-size: 25px;
          line-height: 32px;
          font-weight: 760;
          letter-spacing: -0.025em;
        }

        .sbs-page-description {
          margin: 5px 0 0;
          color: var(--sbs-text-soft);
          font-size: 13px;
          line-height: 20px;
        }

        .sbs-page-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sbs-mobile-menu {
          display: none;
          width: 38px;
          height: 38px;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--sbs-border);
          border-radius: 9px;
          background: #fff;
          color: var(--sbs-text);
          cursor: pointer;
          margin-right: 10px;
        }

        .sbs-sidebar-overlay {
          display: none;
        }

        @media (max-width: 1200px) {
          .sbs-company-topbar {
            max-width: 140px;
          }

          .sbs-topbar-left {
            min-width: 160px;
          }

          .sbs-topbar-right {
            min-width: 220px;
          }
        }

        @media (max-width: 1024px) {
          :root {
            --sbs-sidebar-width: 232px;
          }

          .sbs-content-inner {
            padding: 22px;
          }

          .sbs-company-topbar-name {
            display: none;
          }

          .sbs-topbar-right {
            min-width: auto;
          }
        }

        @media (max-width: 820px) {
          .sbs-sidebar {
            transform: translateX(-105%);
            transition: transform 200ms ease;
            box-shadow: none;
          }

          .sbs-sidebar.is-open {
            transform: translateX(0);
            box-shadow: 15px 0 40px rgba(16, 24, 40, 0.12);
          }

          .sbs-mobile-close {
            display: grid;
            place-items: center;
          }

          .sbs-sidebar-overlay {
            position: fixed;
            inset: 0;
            display: block;
            z-index: 90;
            border: 0;
            background: rgba(15, 23, 42, 0.28);
            backdrop-filter: blur(2px);
            cursor: pointer;
          }

          .sbs-main {
            margin-left: 0;
          }

          .sbs-mobile-menu {
            display: flex;
          }

          .sbs-topbar {
            padding: 10px 16px;
          }

          .sbs-topbar-left {
            min-width: auto;
          }

          .sbs-topbar-center {
            display: none;
          }

          .sbs-company-topbar {
            display: none;
          }

          .sbs-topbar-right {
            margin-left: auto;
          }

          .sbs-profile-details {
            display: none;
          }

          .sbs-profile-button > :last-child {
            display: none;
          }

          .sbs-page-heading {
            display: none;
          }

          .sbs-content-inner {
            padding: 20px 16px;
          }

          .sbs-page-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 14px;
          }

          .sbs-page-actions {
            width: 100%;
          }
        }

        @media (max-width: 520px) {
          .sbs-topbar {
            min-height: 64px;
            gap: 8px;
          }

          .sbs-notification-button {
            display: none;
          }

          .sbs-content-inner {
            padding: 18px 13px 28px;
          }

          .sbs-page-title {
            font-size: 22px;
            line-height: 29px;
          }

          .sbs-page-description {
            font-size: 12px;
            line-height: 18px;
          }
        }
      `}</style>
    </div>
  );
}

function getPageTitle(pathname: string) {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/leads")) return "Leads";
  if (pathname.startsWith("/customers")) return "Customers";
  if (pathname.startsWith("/jobs")) return "Jobs";
  if (pathname.startsWith("/estimates")) return "Estimates";
  if (pathname.startsWith("/invoices")) return "Invoices";
  if (pathname.startsWith("/settings")) return "Settings";

  return "Dashboard";
}