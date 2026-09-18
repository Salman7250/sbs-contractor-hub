export type ModuleRouteRule = {
  prefix: string;
  permissionModule: string;
  entitlementModule: string | null;
};

/**
 * Maps application routes to the two independent authorization systems:
 * employee permission modules and subscription entitlement slugs.
 */
export const MODULE_ROUTE_RULES: ModuleRouteRule[] = [
  {
    prefix: "/",
    permissionModule: "dashboard",
    entitlementModule: null,
  },
  {
    prefix: "/customers",
    permissionModule: "customers",
    entitlementModule: "customers",
  },
  {
    prefix: "/leads",
    permissionModule: "leads",
    entitlementModule: "leads",
  },
  {
    prefix: "/jobs",
    permissionModule: "jobs",
    entitlementModule: "jobs",
  },
  {
    prefix: "/estimates",
    permissionModule: "quotes",
    entitlementModule: "estimates",
  },
  {
    prefix: "/sales",
    permissionModule: "sales_orders",
    entitlementModule: "sales-orders",
  },
  {
    prefix: "/invoices",
    permissionModule: "invoices",
    entitlementModule: "invoices",
  },
  {
    prefix: "/payments",
    permissionModule: "payments",
    entitlementModule: "payments",
  },
  {
    prefix: "/products",
    permissionModule: "products",
    entitlementModule: "products",
  },
  {
    prefix: "/serial-numbers",
    permissionModule: "serial_numbers",
    entitlementModule: "serial-assets",
  },
  {
    prefix: "/inventory",
    permissionModule: "inventory",
    entitlementModule: "inventory",
  },
  {
    prefix: "/warehouses",
    permissionModule: "warehouses",
    entitlementModule: "warehouses",
  },
  {
    prefix: "/pricing",
    permissionModule: "pricing",
    entitlementModule: "pricing",
  },
  {
    prefix: "/suppliers",
    permissionModule: "suppliers",
    entitlementModule: "suppliers",
  },
  {
    prefix: "/purchase-orders",
    permissionModule: "purchase_orders",
    entitlementModule: "purchase-orders",
  },
  {
    prefix: "/expenses",
    permissionModule: "expenses",
    entitlementModule: "expenses",
  },
  {
    prefix: "/warranty",
    permissionModule: "warranty",
    entitlementModule: "warranty",
  },
  {
    prefix: "/repairs",
    permissionModule: "repairs",
    entitlementModule: "repairs",
  },
  {
    prefix: "/rma",
    permissionModule: "rma",
    entitlementModule: "rma",
  },
  {
    prefix: "/service-providers",
    permissionModule: "service_jobs",
    entitlementModule: "service-providers",
  },
  {
    prefix: "/service-jobs",
    permissionModule: "service_jobs",
    entitlementModule: "service-jobs",
  },
  {
    prefix: "/b2b-portal",
    permissionModule: "b2b_portal",
    entitlementModule: "b2b-client-portal",
  },
  {
    prefix: "/analytics",
    permissionModule: "analytics",
    entitlementModule: "analytics",
  },
  {
    prefix: "/reports",
    permissionModule: "reports",
    entitlementModule: "reports",
  },
  {
    prefix: "/employees",
    permissionModule: "employees",
    entitlementModule: "employees",
  },
  {
    prefix: "/documents",
    permissionModule: "documents",
    entitlementModule: "documents",
  },
  {
    prefix: "/settings",
    permissionModule: "settings",
    entitlementModule: "settings",
  },
];

export function getModuleRouteRule(pathname: string) {
  return (
    MODULE_ROUTE_RULES
      .slice()
      .sort((a, b) => b.prefix.length - a.prefix.length)
      .find(
        (rule) =>
          pathname === rule.prefix ||
          pathname.startsWith(`${rule.prefix}/`),
      ) ?? null
  );
}
