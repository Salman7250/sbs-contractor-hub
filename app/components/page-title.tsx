"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function getTitle(pathname: string) {
  const path = pathname.replace(/\/$/, "");

  if (path === "" || path === "/") {
    return "Dashboard";
  }

  const segments = path
    .split("/")
    .filter(Boolean);

  const last = segments[segments.length - 1];

  const specialTitles: Record<string, string> = {
    "sales-orders": "Sales & Orders",
    "purchase-orders": "Purchase Orders",
    "serial-numbers": "Serial Numbers",
    "b2b-client-portal": "B2B Client Portal",
    "reports-analytics": "Reports & Analytics",
    "roles": "Roles & Permissions",
    "categories": "Expense Categories",
    "closings": "Expense Closings",
  };

  if (specialTitles[last]) {
    return specialTitles[last];
  }

  const title = last
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );

  return title;
}

export default function PageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    document.title = `${getTitle(pathname)} | SBS`;
  }, [pathname]);

  return null;
}