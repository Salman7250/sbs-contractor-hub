"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarProps = {
  companyName?: string;
  userName?: string;
  userRole?: string;
  companyInitials?: string;
  userInitials?: string;
  leadCount?: number;
  loading?: boolean;
};

export default function Sidebar({
  companyName = "Your Company",
  userName = "User",
  userRole = "Member",
  companyInitials = "YC",
  userInitials = "U",
  leadCount = 0,
  loading = false,
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }

    return pathname === path;
  };

  return (
    <aside className="sidebar">

      {/* BRAND */}

      <div className="sidebar-brand">

        <div className="brand-mark">
          {companyInitials}
        </div>

        <div>
          <div className="brand-name">
            {loading
              ? "Loading..."
              : companyName}
          </div>

          <div className="brand-subtitle">
            Contractor Hub
          </div>
        </div>

      </div>

      {/* NAVIGATION */}

      <nav className="sidebar-nav">

        <Link
          href="/"
          className={
            isActive("/")
              ? "nav-item active"
              : "nav-item"
          }
        >
          <span>▦</span>
          Dashboard
        </Link>

        <Link
          href="/leads"
          className={
            isActive("/leads")
              ? "nav-item active"
              : "nav-item"
          }
        >
          <span>♧</span>
          Leads

          <span className="nav-badge">
            {leadCount}
          </span>
        </Link>

        <Link
          href="/customers"
          className={
            isActive("/customers")
              ? "nav-item active"
              : "nav-item"
          }
        >
          <span>♙</span>
          Customers
        </Link>

        <Link
          href="/jobs"
          className={
            isActive("/jobs")
              ? "nav-item active"
              : "nav-item"
          }
        >
          <span>▣</span>
          Jobs
        </Link>

        <Link
          href="/estimates"
          className={
            isActive("/estimates")
              ? "nav-item active"
              : "nav-item"
          }
        >
          <span>▤</span>
          Estimates
        </Link>

        <Link
          href="/invoices"
          className={
            isActive("/invoices")
              ? "nav-item active"
              : "nav-item"
          }
        >
          <span>▥</span>
          Invoices
        </Link>

      </nav>

      {/* BOTTOM */}

      <div className="sidebar-bottom">

        <Link
          href="/settings"
          className={
            isActive("/settings")
              ? "nav-item active"
              : "nav-item"
          }
        >
          <span>⚙</span>
          Settings
        </Link>

        <div className="sidebar-user">

          <div className="user-avatar">
            {userInitials}
          </div>

          <div className="user-info">

            <div className="user-name">
              {userName}
            </div>

            <div className="user-role">
              {userRole}
            </div>

          </div>

        </div>

      </div>

    </aside>
  );
}