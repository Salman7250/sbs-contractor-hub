"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["Stock", "/inventory/stock"],
  ["Batches / Lots", "/inventory/batches"],
  ["Serial Assets", "/inventory/serial-numbers"],
  ["Movements", "/inventory/movements"],
  ["Transfers", "/inventory/transfers"],
  ["Receipts", "/inventory/receipts"],
  ["Adjustments", "/inventory/adjustments"],
] as const;

export default function InventoryNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 overflow-x-auto border-b border-slate-200">
      <nav className="flex min-w-max gap-1" aria-label="Inventory navigation">
        {items.map(([label, href]) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-slate-900 text-slate-950"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
