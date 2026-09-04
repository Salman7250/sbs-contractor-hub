import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import Link from "next/link";
import { ReactNode } from "react";

export default async function SBSAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, admin } = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-900 lg:block">
          <div className="flex h-full flex-col">
            {/* Brand */}
            <div className="border-b border-white/10 px-6 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-black text-slate-950">
                  SBS
                </div>

                <div>
                  <div className="text-base font-bold tracking-tight">
                    Sharif Business
                  </div>

                  <div className="mt-0.5 text-xs text-slate-500">
                    Platform Administration
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-6">
              {/* Overview */}
              <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Overview
              </div>

              <div className="space-y-1">
                <Link
                  href="/sbs-admin"
                  className="flex items-center gap-3 rounded-xl bg-white/[0.07] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-sm">
                    ▦
                  </span>

                  Dashboard
                </Link>

                <Link
                  href="/sbs-admin/companies"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm">
                    ◫
                  </span>

                  Companies
                </Link>

                <Link
                  href="/sbs-admin/users"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm">
                    ♙
                  </span>

                  Users
                </Link>
              </div>

              {/* Platform Management */}
              <div className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Platform Management
              </div>

              <div className="space-y-1">
                <Link
                  href="/sbs-admin/plans"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm">
                    $
                  </span>

                  Plans & Pricing
                </Link>

                <Link
                  href="/sbs-admin/modules"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm">
                    ◈
                  </span>

                  Modules
                </Link>

                <Link
                  href="/sbs-admin/subscriptions"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm">
                    ◫
                  </span>

                  Subscriptions
                </Link>

                <Link
                  href="/sbs-admin/payments"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm">
                    $
                  </span>

                  Payments
                </Link>

                <Link
                  href="/sbs-admin/entitlements"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm">
                    ✓
                  </span>

                  Access & Entitlements
                </Link>

                <Link
                  href="/sbs-admin/discounts"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm">
                    %
                  </span>

                  Discounts
                </Link>
              </div>

              {/* System */}
              <div className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                System
              </div>

              <div className="space-y-1">
                <Link
                  href="/sbs-admin/activity"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm">
                    ◷
                  </span>

                  Activity & Logs
                </Link>

                <Link
                  href="/sbs-admin/settings"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm">
                    ⚙
                  </span>

                  Platform Settings
                </Link>
              </div>
            </nav>

            {/* Bottom account area */}
            <div className="border-t border-white/10 p-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-950">
                    {user.email?.charAt(0).toUpperCase() ?? "A"}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      {user.email}
                    </div>

                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      {admin.role}
                    </div>
                  </div>
                </div>
              </div>

              <Link
                href="/dashboard"
                className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                ←
                <span>Customer Dashboard</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          {/* Top bar */}
          <header className="border-b border-white/10 bg-slate-950/80 px-6 py-5 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                  SBS Platform
                </div>

                <div className="mt-1 text-lg font-semibold text-white">
                  Super Admin
                </div>
              </div>

              <div className="hidden text-right sm:block">
                <div className="text-sm text-slate-300">
                  {user.email}
                </div>

                <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">
                  {admin.role}
                </div>
              </div>
            </div>
          </header>

          {/* Page */}
          <div className="mx-auto max-w-7xl p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}