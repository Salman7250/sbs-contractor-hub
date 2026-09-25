import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import PageTitle from "@/app/components/page-title";
import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

const navigation = [
  {
    label: "Overview",
    items: [
      { href: "/sbs-admin", label: "Dashboard", icon: "⌂" },
      { href: "/sbs-admin/companies", label: "Companies", icon: "▣" },
      { href: "/sbs-admin/users", label: "Users", icon: "♙" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/sbs-admin/plans", label: "Plans & Pricing", icon: "$" },
      { href: "/sbs-admin/modules", label: "Modules", icon: "◈" },
      {
        href: "/sbs-admin/entitlements",
        label: "Access & Entitlements",
        icon: "✓",
      },
      {
        href: "/sbs-admin/subscriptions",
        label: "Subscriptions",
        icon: "◫",
      },
      { href: "/sbs-admin/payments", label: "Payments", icon: "₿" },
      { href: "/sbs-admin/discounts", label: "Discounts", icon: "%" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/sbs-admin/activity", label: "Activity & Logs", icon: "◷" },
      {
        href: "/sbs-admin/settings",
        label: "Platform Settings",
        icon: "⚙",
      },
    ],
  },
];

export default async function SBSAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, admin } = await requirePlatformAdmin();

  return (
    <>
      <PageTitle />

      <div className="min-h-screen bg-[#f3f5f8] text-slate-900">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden w-[280px] shrink-0 border-r border-slate-800 bg-[#0b1220] lg:block">
            <div className="sticky top-0 flex h-screen flex-col">
              {/* Brand */}
              <div className="flex h-[82px] items-center justify-center border-b border-white/[0.08] px-6">
                <Link
                  href="/sbs-admin"
                  className="relative flex h-12 w-32 items-center justify-center"
                >
                  <Image
                    src="/sbs-logo.png"
                    alt="SBS"
                    fill
                    sizes="128px"
                    className="object-contain"
                    priority
                  />
                </Link>
              </div>

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto px-4 py-6">
                {navigation.map((section) => (
                  <div key={section.label} className="mb-8">
                    <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      {section.label}
                    </div>

                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.045] text-[13px] text-slate-400 transition group-hover:bg-emerald-500/10 group-hover:text-emerald-400">
                            {item.icon}
                          </span>

                          <span className="flex-1">
                            {item.label}
                          </span>

                          <span className="text-[12px] text-slate-600 opacity-0 transition group-hover:opacity-100">
                            →
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>

              {/* Account */}
              <div className="border-t border-white/[0.08] p-4">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-bold text-emerald-400">
                      {user.email?.charAt(0).toUpperCase() ?? "A"}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-slate-200">
                        {user.email}
                      </div>

                      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-400">
                        {admin.role}
                      </div>
                    </div>
                  </div>
                </div>

                <Link
                  href="/dashboard"
                  className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <span>←</span>
                  Customer Dashboard
                </Link>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="min-w-0 flex-1">
            {/* Topbar */}
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
              <div className="flex min-h-[82px] items-center justify-between gap-4 px-5 sm:px-7 lg:px-10">
                <div className="flex items-center gap-3">
                  {/* Mobile logo */}
                  <Link
                    href="/sbs-admin"
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white lg:hidden"
                  >
                    <Image
                      src="/sbs-logo.png"
                      alt="SBS"
                      fill
                      sizes="40px"
                      className="object-contain p-1"
                    />
                  </Link>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                      SBS Platform
                    </div>

                    <div className="mt-1 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                      Super Admin
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden text-right sm:block">
                    <div className="text-xs font-medium text-slate-700">
                      {user.email}
                    </div>

                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      {admin.role}
                    </div>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-600 sm:hidden">
                    {user.email?.charAt(0).toUpperCase() ?? "A"}
                  </div>
                </div>
              </div>

              {/* Mobile Navigation */}
              <details className="border-t border-slate-200 lg:hidden">
                <summary className="cursor-pointer list-none px-5 py-3 text-xs font-semibold text-slate-600">
                  <span className="flex items-center justify-between">
                    <span>Platform Navigation</span>
                    <span className="text-slate-400">☰</span>
                  </span>
                </summary>

                <div className="border-t border-slate-200 bg-[#0b1220] px-4 py-4">
                  {navigation.map((section) => (
                    <div
                      key={section.label}
                      className="mb-5 last:mb-0"
                    >
                      <div className="mb-2 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        {section.label}
                      </div>

                      <div className="grid gap-1 sm:grid-cols-2">
                        {section.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                          >
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.045] text-slate-400">
                              {item.icon}
                            </span>

                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </header>

            {/* Page Content */}
            <div className="mx-auto max-w-[1500px] p-5 sm:p-7 lg:p-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}