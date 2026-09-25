"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

function getTitle(pathname: string) {
  const path = pathname.replace(/\/$/, "");

  if (path === "" || path === "/") {
    return "Dashboard";
  }

  const segments = path
    .split("/")
    .filter(Boolean);

  const specialTitles: Record<string, string> = {
    dashboard: "Dashboard",

    companies: "Companies",
    users: "Users",

    plans: "Plans & Pricing",
    modules: "Modules",
    entitlements: "Access & Entitlements",
    subscriptions: "Subscriptions",
    payments: "Payments",
    discounts: "Discounts",

    activity: "Activity & Logs",
    settings: "Platform Settings",

    customers: "Customers",
    estimates: "Estimates",
    "sales-orders": "Sales & Orders",
    invoices: "Invoices",

    products: "Products",
    "serial-assets": "Serial Assets",
    inventory: "Inventory",
    warehouses: "Warehouses",
    pricing: "Pricing",

    suppliers: "Suppliers",
    "purchase-orders": "Purchase Orders",
    expenses: "Expenses",

    warranty: "Warranty",
    repairs: "Repairs",
    rma: "RMA",
    "service-providers": "Service Providers",
    "service-jobs": "Service Jobs",

    "b2b-client-portal": "B2B Client Portal",

    analytics: "Analytics",
    "reports-analytics": "Reports & Analytics",
    employees: "Employees",
    documents: "Documents",

    roles: "Roles & Permissions",
    categories: "Expense Categories",
    closings: "Expense Closings",

    leads: "Leads",
    jobs: "Jobs",
    reports: "Reports",
    crm: "CRM",
  };

  /*
   * Use the first known module/page segment instead of
   * the final URL segment.
   *
   * This prevents detail-page IDs such as:
   *
   * /invoices/8f72c9a1-....
   *
   * from becoming the browser tab title.
   */
  for (const segment of segments) {
    if (specialTitles[segment]) {
      return specialTitles[segment];
    }
  }

  /*
   * Fallback for pages that are not explicitly listed above.
   */
  const last = segments[segments.length - 1] ?? "";

  return last
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

export default function PageTitle() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    document.title = `${getTitle(pathname)} | SBS`;
  }, [pathname]);

  return null;
}