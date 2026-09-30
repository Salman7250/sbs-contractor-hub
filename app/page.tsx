"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  DollarSign,
  FileBarChart,
  FileText,
  Layers3,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  ShoppingCart,
  Target,
  Truck,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AppShell from "@/app/components/app-shell";
import { useRegionalSettings } from "@/app/components/regional-settings-provider";
import {
  formatMoney,
  getCurrencySymbol,
  type RegionalSettings,
} from "@/lib/regional-settings";
import { createClient } from "@/lib/supabase/client";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type PeriodKey =
  | "7d"
  | "30d"
  | "90d"
  | "12m"
  | "ytd";

type Company = {
  id: string;
  name: string | null;
  slug: string | null;
  logo_url: string | null;
  currency: string | null;
};

type Profile = {
  full_name: string | null;
  first_name: string | null;
  email: string | null;
};

type Entitlement = {
  module_slug: string | null;
  module_name: string | null;
  is_effectively_enabled: boolean | null;
};

type Customer = {
  id: string;
  name: string | null;
  created_at: string;
};

type Lead = {
  id: string;
  name: string | null;
  status: string | null;
  estimated_value: number | null;
  created_at: string;
};

type Estimate = {
  id: string;
  estimate_number: string | null;
  total: number | null;
  status: string | null;
  created_at: string;
};

type Invoice = {
  id: string;
  invoice_number: string | null;
  total: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  status: string | null;
  due_date: string | null;
  created_at: string;
};

type InvoicePayment = {
  id: string;
  amount: number | null;
  paid_at: string | null;
  created_at: string;
};

type Order = {
  id: string;
  order_number: string | null;
  total_amount: number | null;
  status: string | null;
  payment_status: string | null;
  created_at: string;
};

type Job = {
  id: string;
  title: string | null;
  status: string | null;
  estimated_value: number | null;
  actual_value: number | null;
  scheduled_date: string | null;
  created_at: string;
};

type InventoryRow = {
  id: string;
  quantity: number | null;
  reserved_quantity: number | null;
  reorder_level: number | null;
};

type Product = {
  id: string;
  name: string | null;
  status: string | null;
  created_at: string;
};

type Employee = {
  id: string;
  display_name: string | null;
  status: string | null;
};

type Expense = {
  id: string;
  amount: number | null;
  expense_date: string;
  status: string | null;
};

type PurchaseOrder = {
  id: string;
  total_amount: number | null;
  status: string | null;
  order_date: string | null;
  created_at: string;
};

type Repair = {
  id: string;
  status: string | null;
  priority: string | null;
  customer_charge: number | null;
  created_at: string;
};

type Rma = {
  id: string;
  status: string | null;
  created_at: string;
};

type Warranty = {
  id: string;
  status: string | null;
  end_date: string | null;
  created_at: string;
};

type ServiceJob = {
  id: string;
  status: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
};

type ServiceProvider = {
  id: string;
  status: string | null;
};

type Warehouse = {
  id: string;
  name: string | null;
};

type SerializedUnit = {
  id: string;
  status: string | null;
};

type ModuleMetric = {
  slug: string;
  name: string;
  value: string | number;
  detail: string;
  href: string;
  icon: React.ReactNode;
};

type ChartPoint = {
  label: string;
  revenue: number;
  collected: number;
};

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const PERIODS: {
  key: PeriodKey;
  label: string;
}[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "12m", label: "12 months" },
  { key: "ytd", label: "Year to date" },
];

const MODULE_HREFS: Record<string, string> = {
  crm: "/crm",
  leads: "/leads",
  customers: "/customers",
  jobs: "/jobs",
  estimates: "/estimates",
  invoices: "/invoices",
  products: "/products",
  inventory: "/inventory",
  employees: "/employees",
  warehouses: "/inventory/warehouses",
  "serial-assets": "/inventory/serial-numbers",
  payments: "/payments",
  "purchase-orders": "/purchase-orders",
  "sales-orders": "/sales-orders",
  expenses: "/expenses",
  repairs: "/repairs",
  rma: "/rma",
  "service-jobs": "/service-jobs",
  "service-providers": "/service-providers",
  warranty: "/warranty",
  reports: "/reports",
  analytics: "/analytics",
  "advanced-analytics": "/analytics",
  "b2b-client-portal": "/b2b-portal",
};

const PERIOD_DAYS: Record<PeriodKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "12m": 365,
  ytd: 366,
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function money(
  value: number,
  settings: RegionalSettings,
) {
  return formatMoney(value, settings);
}

function compactMoney(
  value: number,
  settings: RegionalSettings,
) {
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1_000_000) {
    const number = `${(value / 1_000_000).toFixed(1)}M`;
    const symbol = getCurrencySymbol(settings);

    return settings.currency_symbol_position === "after"
      ? `${number} ${symbol}`
      : `${symbol}${number}`;
  }

  if (absoluteValue >= 1_000) {
    const number = `${(value / 1_000).toFixed(1)}K`;
    const symbol = getCurrencySymbol(settings);

    return settings.currency_symbol_position === "after"
      ? `${number} ${symbol}`
      : `${symbol}${number}`;
  }

  return money(value, settings);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(value);
}

function getInitials(
  name: string | null | undefined,
) {
  if (!name) return "SB";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function normalize(
  value: string | null | undefined,
) {
  return (
    value
      ?.toLowerCase()
      .replace(/[\s-]+/g, "_") ?? ""
  );
}

function startDateForPeriod(
  period: PeriodKey,
) {
  const now = new Date();

  if (period === "ytd") {
    return new Date(
      now.getFullYear(),
      0,
      1,
    );
  }

  const date = new Date(now);
  date.setDate(
    date.getDate() -
      PERIOD_DAYS[period],
  );

  return date;
}

function isWithinPeriod(
  value: string | null | undefined,
  period: PeriodKey,
) {
  if (!value) return false;

  const date = new Date(value);
  return date >= startDateForPeriod(period);
}

function getEnabledModules(
  entitlements: Entitlement[],
) {
  return new Set(
    entitlements
      .filter(
        (item) =>
          item.is_effectively_enabled ===
          true,
      )
      .map(
        (item) =>
          item.module_slug,
      )
      .filter(
        (
          slug,
        ): slug is string =>
          Boolean(slug),
      ),
  );
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

export default function DashboardPage() {
  const router = useRouter();
  const { settings: regionalSettings } =
    useRegionalSettings();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [period, setPeriod] =
    useState<PeriodKey>("30d");

  const [periodOpen, setPeriodOpen] =
    useState(false);

  const [company, setCompany] =
    useState<Company | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [entitlements, setEntitlements] =
    useState<Entitlement[]>([]);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [leads, setLeads] =
    useState<Lead[]>([]);

  const [estimates, setEstimates] =
    useState<Estimate[]>([]);

  const [invoices, setInvoices] =
    useState<Invoice[]>([]);

  const [invoicePayments, setInvoicePayments] =
    useState<InvoicePayment[]>([]);

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [jobs, setJobs] =
    useState<Job[]>([]);

  const [inventory, setInventory] =
    useState<InventoryRow[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [purchaseOrders, setPurchaseOrders] =
    useState<PurchaseOrder[]>([]);

  const [repairs, setRepairs] =
    useState<Repair[]>([]);

  const [rmas, setRmas] =
    useState<Rma[]>([]);

  const [warranties, setWarranties] =
    useState<Warranty[]>([]);

  const [serviceJobs, setServiceJobs] =
    useState<ServiceJob[]>([]);

  const [serviceProviders, setServiceProviders] =
    useState<ServiceProvider[]>([]);

  const [warehouses, setWarehouses] =
    useState<Warehouse[]>([]);

  const [serializedUnits, setSerializedUnits] =
    useState<SerializedUnit[]>([]);

  const loadDashboard = useCallback(
    async (
      isRefresh = false,
    ) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        setProfile({
          full_name:
            user.user_metadata
              ?.full_name ||
            user.user_metadata?.name ||
            null,
          first_name:
            user.user_metadata
              ?.first_name || null,
          email: user.email || null,
        });

        const {
          data: membership,
          error: membershipError,
        } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company workspace is associated with this account.",
          );
        }

        const companyId =
          membership.company_id;

        const {
          data: companyData,
          error: companyError,
        } = await supabase
          .from("companies")
          .select(
            "id,name,slug,logo_url,currency",
          )
          .eq("id", companyId)
          .single();

        if (companyError) {
          throw companyError;
        }

        setCompany(
          companyData as Company,
        );

        /*
         * ----------------------------------------------------------
         * ENTITLEMENTS
         * ----------------------------------------------------------
         */

        const {
          data: entitlementData,
          error: entitlementError,
        } = await supabase
          .from(
            "company_effective_entitlements",
          )
          .select(
            "module_slug,module_name,is_effectively_enabled",
          )
          .eq(
            "company_id",
            companyId,
          );

        if (entitlementError) {
          throw entitlementError;
        }

        const currentEntitlements =
          (entitlementData ??
            []) as Entitlement[];

        setEntitlements(
          currentEntitlements,
        );

        const enabled =
          getEnabledModules(
            currentEntitlements,
          );

        /*
         * ----------------------------------------------------------
         * BASE QUERIES
         * ----------------------------------------------------------
         */

        const requests: PromiseLike<void>[] =
          [];

        if (
          enabled.has("customers") ||
          enabled.has("crm")
        ) {
          requests.push(
            supabase
              .from("customers")
              .select(
                "id,name,created_at",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setCustomers(
                    (data ??
                      []) as Customer[],
                  );
                },
              ),
          );
        }

        if (enabled.has("leads")) {
          requests.push(
            supabase
              .from("leads")
              .select(
                "id,name,status,estimated_value,created_at",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setLeads(
                    (data ??
                      []) as Lead[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has("estimates")
        ) {
          requests.push(
            supabase
              .from("estimates")
              .select(
                "id,estimate_number,total,status,created_at",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setEstimates(
                    (data ??
                      []) as Estimate[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has("invoices")
        ) {
          requests.push(
            supabase
              .from("invoices")
              .select(
                "id,invoice_number,total,amount_paid,balance_due,status,due_date,created_at",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setInvoices(
                    (data ??
                      []) as Invoice[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has("payments") ||
          enabled.has("invoices")
        ) {
          requests.push(
            supabase
              .from("invoice_payments")
              .select(
                "id,amount,paid_at,created_at",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setInvoicePayments(
                    (data ??
                      []) as InvoicePayment[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has("sales-orders")
        ) {
          requests.push(
            supabase
              .from("orders")
              .select(
                "id,order_number,total_amount,status,payment_status,created_at",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setOrders(
                    (data ??
                      []) as Order[],
                  );
                },
              ),
          );
        }

        if (enabled.has("jobs")) {
          requests.push(
            supabase
              .from("jobs")
              .select(
                "id,title,status,estimated_value,actual_value,scheduled_date,created_at",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setJobs(
                    (data ??
                      []) as Job[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has("inventory")
        ) {
          requests.push(
            supabase
              .from("inventory")
              .select(
                "id,quantity,reserved_quantity,reorder_level",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setInventory(
                    (data ??
                      []) as InventoryRow[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has("products")
        ) {
          requests.push(
            supabase
              .from("products")
              .select(
                "id,name,status,created_at",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setProducts(
                    (data ??
                      []) as Product[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has("employees")
        ) {
          requests.push(
            supabase
              .from("employees")
              .select(
                "id,display_name,status",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setEmployees(
                    (data ??
                      []) as Employee[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has("expenses")
        ) {
          requests.push(
            supabase
              .from("expenses")
              .select(
                "id,amount,expense_date,status",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setExpenses(
                    (data ??
                      []) as Expense[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has(
            "purchase-orders",
          )
        ) {
          requests.push(
            supabase
              .from("purchase_orders")
              .select(
                "id,total_amount,status,order_date,created_at",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setPurchaseOrders(
                    (data ??
                      []) as PurchaseOrder[],
                  );
                },
              ),
          );
        }

        if (enabled.has("repairs")) {
          requests.push(
            supabase
              .from("repairs")
              .select(
                "id,status,priority,customer_charge,created_at",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setRepairs(
                    (data ??
                      []) as Repair[],
                  );
                },
              ),
          );
        }

        if (enabled.has("rma")) {
          requests.push(
            supabase
              .from("rmas")
              .select(
                "id,status,created_at",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setRmas(
                    (data ??
                      []) as Rma[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has("warranty")
        ) {
          requests.push(
            supabase
              .from("warranties")
              .select(
                "id,status,end_date,created_at",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setWarranties(
                    (data ??
                      []) as Warranty[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has("service-jobs")
        ) {
          requests.push(
            supabase
              .from("service_jobs")
              .select(
                "id,status,estimated_cost,actual_cost,created_at",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setServiceJobs(
                    (data ??
                      []) as ServiceJob[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has(
            "service-providers",
          )
        ) {
          requests.push(
            supabase
              .from("service_providers")
              .select(
                "id,status",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setServiceProviders(
                    (data ??
                      []) as ServiceProvider[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has("warehouses")
        ) {
          requests.push(
            supabase
              .from("warehouses")
              .select(
                "id,name",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setWarehouses(
                    (data ??
                      []) as Warehouse[],
                  );
                },
              ),
          );
        }

        if (
          enabled.has(
            "serial-assets",
          )
        ) {
          requests.push(
            supabase
              .from("serialized_units")
              .select(
                "id,status",
              )
              .eq(
                "company_id",
                companyId,
              )
              .then(
                ({
                  data,
                  error,
                }) => {
                  if (error)
                    throw error;

                  setSerializedUnits(
                    (data ??
                      []) as SerializedUnit[],
                  );
                },
              ),
          );
        }

        await Promise.all(
          requests,
        );
      } catch (error) {
        console.error(
          "Dashboard load error:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load dashboard.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const enabledModules =
    useMemo(
      () =>
        getEnabledModules(
          entitlements,
        ),
      [entitlements],
    );

  /*
   * ------------------------------------------------------------------------
   * PERIOD DATA
   * ------------------------------------------------------------------------
   */

  const periodOrders = useMemo(
    () =>
      orders.filter((item) =>
        isWithinPeriod(
          item.created_at,
          period,
        ),
      ),
    [orders, period],
  );

  const periodInvoices = useMemo(
    () =>
      invoices.filter((item) =>
        isWithinPeriod(
          item.created_at,
          period,
        ),
      ),
    [invoices, period],
  );

  const periodPayments =
    useMemo(
      () =>
        invoicePayments.filter(
          (item) =>
            isWithinPeriod(
              item.paid_at ||
                item.created_at,
              period,
            ),
        ),
      [
        invoicePayments,
        period,
      ],
    );

  const periodExpenses =
    useMemo(
      () =>
        expenses.filter((item) =>
          isWithinPeriod(
            item.expense_date,
            period,
          ),
        ),
      [expenses, period],
    );

  const periodCustomers =
    useMemo(
      () =>
        customers.filter((item) =>
          isWithinPeriod(
            item.created_at,
            period,
          ),
        ),
      [customers, period],
    );

  const periodLeads = useMemo(
    () =>
      leads.filter((item) =>
        isWithinPeriod(
          item.created_at,
          period,
        ),
      ),
    [leads, period],
  );

  const revenue = useMemo(
    () =>
      periodOrders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.total_amount ?? 0,
          ),
        0,
      ),
    [periodOrders],
  );

  const invoiced = useMemo(
    () =>
      periodInvoices.reduce(
        (sum, invoice) =>
          sum +
          Number(invoice.total ?? 0),
        0,
      ),
    [periodInvoices],
  );

  const collected = useMemo(
    () =>
      periodPayments.reduce(
        (sum, payment) =>
          sum +
          Number(payment.amount ?? 0),
        0,
      ),
    [periodPayments],
  );

  const expensesTotal = useMemo(
    () =>
      periodExpenses.reduce(
        (sum, expense) =>
          sum +
          Number(expense.amount ?? 0),
        0,
      ),
    [periodExpenses],
  );

  const outstanding = useMemo(
    () =>
      periodInvoices.reduce(
        (sum, invoice) =>
          sum +
          Number(
            invoice.balance_due ??
              Math.max(
                Number(
                  invoice.total ??
                    0,
                ) -
                  Number(
                    invoice.amount_paid ??
                      0,
                  ),
                0,
              ),
          ),
        0,
      ),
    [periodInvoices],
  );

  const overdue = useMemo(
    () => {
      const today =
        new Date();

      return periodInvoices
        .filter(
          (invoice) => {
            const balance =
              Number(
                invoice.balance_due ??
                  Math.max(
                    Number(
                      invoice.total ??
                        0,
                    ) -
                      Number(
                        invoice.amount_paid ??
                          0,
                      ),
                    0,
                  ),
              );

            return (
              balance > 0 &&
              Boolean(
                invoice.due_date,
              ) &&
              new Date(
                invoice.due_date!,
              ) < today
            );
          },
        )
        .reduce(
          (sum, invoice) =>
            sum +
            Number(
              invoice.balance_due ??
                0,
            ),
          0,
        );
    },
    [periodInvoices],
  );

  const inventoryUnits =
    useMemo(
      () =>
        inventory.reduce(
          (sum, item) =>
            sum +
            Math.max(
              0,
              Number(
                item.quantity ??
                  0,
              ) -
                Number(
                  item.reserved_quantity ??
                    0,
                ),
            ),
          0,
        ),
      [inventory],
    );

  const lowStockCount =
    useMemo(
      () =>
        inventory.filter(
          (item) =>
            Number(
              item.quantity ??
                0,
            ) <=
            Number(
              item.reorder_level ??
                0,
            ),
        ).length,
      [inventory],
    );

  const openJobs = jobs.filter(
    (job) =>
      ![
        "completed",
        "cancelled",
        "canceled",
      ].includes(
        normalize(job.status),
      ),
  ).length;

  const activeLeads =
    leads.filter(
      (lead) =>
        ![
          "won",
          "lost",
          "converted",
        ].includes(
          normalize(lead.status),
        ),
    ).length;

  const estimatePipeline =
    periodLeads.reduce(
      (sum, lead) =>
        sum +
        Number(
          lead.estimated_value ??
            0,
        ),
      0,
    ) +
    estimates
      .filter((item) =>
        isWithinPeriod(
          item.created_at,
          period,
        ),
      )
      .filter(
        (item) =>
          ![
            "accepted",
            "rejected",
            "expired",
          ].includes(
            normalize(
              item.status,
            ),
          ),
      )
      .reduce(
        (sum, item) =>
          sum +
          Number(
            item.total ?? 0,
          ),
        0,
      );

  const activeRepairs =
    repairs.filter(
      (item) =>
        ![
          "completed",
          "cancelled",
          "canceled",
        ].includes(
          normalize(item.status),
        ),
    ).length;

  const openRmas = rmas.filter(
    (item) =>
      ![
        "completed",
        "closed",
        "cancelled",
        "canceled",
      ].includes(
        normalize(item.status),
      ),
  ).length;

  const activeWarranties =
    warranties.filter(
      (item) => {
        if (
          normalize(
            item.status,
          ) === "expired"
        ) {
          return false;
        }

        if (!item.end_date) {
          return true;
        }

        return (
          new Date(
            item.end_date,
          ) >= new Date()
        );
      },
    ).length;

  const activeServiceJobs =
    serviceJobs.filter(
      (item) =>
        ![
          "completed",
          "cancelled",
          "canceled",
        ].includes(
          normalize(item.status),
        ),
    ).length;

  /*
   * ------------------------------------------------------------------------
   * CHART
   * ------------------------------------------------------------------------
   */

  const chartPoints =
    useMemo<ChartPoint[]>(
      () => {
        const now =
          new Date();

        const pointCount =
          period === "7d"
            ? 7
            : period === "30d"
              ? 10
              : period === "90d"
                ? 12
                : 12;

        const points: ChartPoint[] =
          [];

        for (
          let index = 0;
          index < pointCount;
          index++
        ) {
          let start: Date;
          let end: Date;

          if (
            period === "7d"
          ) {
            start =
              new Date(now);

            start.setDate(
              now.getDate() -
                (pointCount -
                  index),
            );

            end =
              new Date(start);

            end.setDate(
              start.getDate() +
                1,
            );
          } else if (
            period === "30d" ||
            period === "90d"
          ) {
            const days =
              period ===
              "30d"
                ? 3
                : 8;

            start =
              new Date(
                now,
              );

            start.setDate(
              now.getDate() -
                (pointCount -
                  index) *
                  days,
            );

            end =
              new Date(start);

            end.setDate(
              start.getDate() +
                days,
            );
          } else {
            start =
              new Date(
                now.getFullYear(),
                now.getMonth() -
                  (pointCount -
                    index),
                1,
              );

            end =
              new Date(
                start.getFullYear(),
                start.getMonth() +
                  1,
                1,
              );
          }

          const revenueValue =
            periodOrders
              .filter(
                (item) => {
                  const date =
                    new Date(
                      item.created_at,
                    );

                  return (
                    date >= start &&
                    date < end
                  );
                },
              )
              .reduce(
                (
                  sum,
                  item,
                ) =>
                  sum +
                  Number(
                    item.total_amount ??
                      0,
                  ),
                0,
              );

          const collectedValue =
            periodPayments
              .filter(
                (item) => {
                  const date =
                    new Date(
                      item.paid_at ||
                        item.created_at,
                    );

                  return (
                    date >= start &&
                    date < end
                  );
                },
              )
              .reduce(
                (
                  sum,
                  item,
                ) =>
                  sum +
                  Number(
                    item.amount ??
                      0,
                  ),
                0,
              );

          points.push({
            label:
              period ===
                "12m" ||
              period === "ytd"
                ? new Intl.DateTimeFormat(
                    "en-US",
                    {
                      month:
                        "short",
                    },
                  ).format(
                    start,
                  )
                : formatShortDate(
                    start,
                  ),
            revenue:
              revenueValue,
            collected:
              collectedValue,
          });
        }

        return points;
      },
      [
        period,
        periodOrders,
        periodPayments,
      ],
    );

  const maxChart =
    Math.max(
      ...chartPoints.flatMap(
        (item) => [
          item.revenue,
          item.collected,
        ],
      ),
      1,
    );

  const greeting =
    profile?.first_name ||
    profile?.full_name?.split(
      " ",
    )[0] ||
    "there";

  const recentActivity =
    useMemo(() => {
      const activities: {
        id: string;
        type: string;
        title: string;
        detail: string;
        date: string;
        amount?: number;
      }[] = [];

      periodOrders
        .slice()
        .sort(
          (a, b) =>
            new Date(
              b.created_at,
            ).getTime() -
            new Date(
              a.created_at,
            ).getTime(),
        )
        .slice(0, 4)
        .forEach((order) => {
          activities.push({
            id: `order-${order.id}`,
            type: "sale",
            title:
              order.order_number ||
              "Sales order",
            detail:
              order.status ||
              "Order created",
            date: order.created_at,
            amount:
              Number(
                order.total_amount ??
                  0,
              ),
          });
        });

      periodCustomers
        .slice()
        .sort(
          (a, b) =>
            new Date(
              b.created_at,
            ).getTime() -
            new Date(
              a.created_at,
            ).getTime(),
        )
        .slice(0, 3)
        .forEach((customer) => {
          activities.push({
            id: `customer-${customer.id}`,
            type: "customer",
            title:
              customer.name ||
              "New customer",
            detail:
              "Customer added",
            date:
              customer.created_at,
          });
        });

      periodInvoices
        .slice()
        .sort(
          (a, b) =>
            new Date(
              b.created_at,
            ).getTime() -
            new Date(
              a.created_at,
            ).getTime(),
        )
        .slice(0, 3)
        .forEach((invoice) => {
          activities.push({
            id: `invoice-${invoice.id}`,
            type: "invoice",
            title:
              invoice.invoice_number ||
              "Invoice",
            detail:
              invoice.status ||
              "Invoice created",
            date:
              invoice.created_at,
            amount:
              Number(
                invoice.total ??
                  0,
              ),
          });
        });

      return activities
        .sort(
          (a, b) =>
            new Date(
              b.date,
            ).getTime() -
            new Date(
              a.date,
            ).getTime(),
        )
        .slice(0, 7);
    }, [
      periodOrders,
      periodCustomers,
      periodInvoices,
    ]);

  const moduleMetrics =
    useMemo<ModuleMetric[]>(
      () => {
        const metrics: ModuleMetric[] =
          [];

        const add = (
          slug: string,
          name: string,
          value: string | number,
          detail: string,
          icon: React.ReactNode,
        ) => {
          if (
            !enabledModules.has(
              slug,
            )
          ) {
            return;
          }

          metrics.push({
            slug,
            name,
            value,
            detail,
            href:
              MODULE_HREFS[
                slug
              ] || "#",
            icon,
          });
        };

        add(
          "customers",
          "Customers",
          customers.length,
          `${periodCustomers.length} added in period`,
          <Users className="h-5 w-5" />,
        );

        add(
          "leads",
          "Open Leads",
          activeLeads,
          `${periodLeads.length} created in period`,
          <Target className="h-5 w-5" />,
        );

        add(
          "estimates",
          "Estimate Pipeline",
          compactMoney(
            estimatePipeline,
            regionalSettings,
          ),
          "Open opportunity value",
          <FileText className="h-5 w-5" />,
        );

        add(
          "jobs",
          "Open Jobs",
          openJobs,
          "Active operational jobs",
          <BriefcaseBusiness className="h-5 w-5" />,
        );

        add(
          "products",
          "Products",
          products.length,
          "Products in catalogue",
          <Package className="h-5 w-5" />,
        );

        add(
          "inventory",
          "Available Stock",
          inventoryUnits,
          `${lowStockCount} low-stock items`,
          <Boxes className="h-5 w-5" />,
        );

        add(
          "employees",
          "Employees",
          employees.filter(
            (item) =>
              ![
                "inactive",
                "terminated",
              ].includes(
                normalize(
                  item.status,
                ),
              ),
          ).length,
          "Active team members",
          <Users className="h-5 w-5" />,
        );

        add(
          "expenses",
          "Expenses",
          compactMoney(
            expensesTotal,
            regionalSettings,
          ),
          "Recorded in period",
          <CreditCard className="h-5 w-5" />,
        );

        add(
          "purchase-orders",
          "Purchase Orders",
          purchaseOrders.filter(
            (item) =>
              isWithinPeriod(
                item.created_at,
                period,
              ),
          ).length,
          "Created in period",
          <ShoppingCart className="h-5 w-5" />,
        );

        add(
          "repairs",
          "Active Repairs",
          activeRepairs,
          "Repair workflow",
          <Wrench className="h-5 w-5" />,
        );

        add(
          "rma",
          "Open RMA",
          openRmas,
          "Returns requiring action",
          <PackageCheck className="h-5 w-5" />,
        );

        add(
          "warranty",
          "Active Warranties",
          activeWarranties,
          "Currently covered",
          <CheckCircle2 className="h-5 w-5" />,
        );

        add(
          "service-jobs",
          "Service Jobs",
          activeServiceJobs,
          "Active outsourced jobs",
          <Truck className="h-5 w-5" />,
        );

        add(
          "service-providers",
          "Service Providers",
          serviceProviders.filter(
            (item) =>
              normalize(
                item.status,
              ) === "active",
          ).length,
          "Active providers",
          <BriefcaseBusiness className="h-5 w-5" />,
        );

        add(
          "warehouses",
          "Warehouses",
          warehouses.length,
          "Configured locations",
          <Layers3 className="h-5 w-5" />,
        );

        add(
          "serial-assets",
          "Serialized Assets",
          serializedUnits.length,
          "Tracked units",
          <PackageCheck className="h-5 w-5" />,
        );

        return metrics;
      },
      [
        enabledModules,
        customers.length,
        periodCustomers.length,
        activeLeads,
        periodLeads.length,
        estimatePipeline,
        regionalSettings,
        openJobs,
        products.length,
        inventoryUnits,
        lowStockCount,
        employees,
        expensesTotal,
        purchaseOrders,
        period,
        activeRepairs,
        openRmas,
        activeWarranties,
        activeServiceJobs,
        serviceProviders,
        warehouses.length,
        serializedUnits.length,
      ],
    );

 /*
 * ============================================================================
 * RESTYLE ONLY — classNames changed, no logic/markup/data changes.
 *
 * HOW TO APPLY:
 * In your original file, keep EVERYTHING above `if (loading) {` exactly as is.
 * Delete from `if (loading) {` to the end of the file and paste this whole file
 * in its place. Background stays bg-[#f5f7fa].
 * ============================================================================
 */

  if (loading) {
    return (
      <AppShell>
        <DashboardSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-full bg-[#f5f7fa]">
        <div className="mx-auto max-w-[1800px] space-y-8 p-4 sm:p-6 lg:p-10">
          {/* HEADER */}
          <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-inset ring-emerald-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Business overview
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.6rem] sm:leading-[1.1]">
                Good morning,{" "}
                <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                  {greeting}.
                </span>
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Here is what is happening across{" "}
                <span className="font-medium text-slate-800">
                  {company?.name || "your business"}
                </span>{" "}
                right now.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Period selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPeriodOpen((value) => !value)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 text-xs font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur transition hover:border-slate-300 hover:bg-white"
                >
                  <Clock3 className="h-4 w-4 text-slate-400" />

                  {PERIODS.find((item) => item.key === period)?.label}

                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {periodOpen ? (
                  <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 p-1.5 shadow-[0_20px_40px_-12px_rgba(15,23,42,0.18)] backdrop-blur">
                    {PERIODS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setPeriod(item.key);
                          setPeriodOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition ${
                          period === item.key
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {item.label}

                        {period === item.key ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => void loadDashboard(true)}
                disabled={refreshing}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 text-xs font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />

                Refresh
              </button>

              {enabledModules.has("invoices") ? (
                <a
                  href="/invoices/new"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-b from-slate-800 to-slate-950 px-5 text-xs font-semibold text-white shadow-[0_8px_20px_-8px_rgba(15,23,42,0.6)] ring-1 ring-slate-900 transition hover:from-slate-700 hover:to-slate-900"
                >
                  <Plus className="h-4 w-4" />
                  New Invoice
                </a>
              ) : null}
            </div>
          </header>

          {errorMessage ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200/70 bg-red-50/80 p-4 text-sm text-red-700">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" />

              <div>
                <div className="font-semibold">
                  Dashboard data could not be fully loaded.
                </div>

                <div className="mt-1 text-xs leading-5 text-red-600">
                  {errorMessage}
                </div>
              </div>
            </div>
          ) : null}

          {/* TOP FINANCIAL CARDS */}
          <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardMetric
              label="Revenue"
              value={money(revenue, regionalSettings)}
              detail={`${periodOrders.length} sales orders`}
              icon={
                <span className="text-lg font-medium">
                  {regionalSettings.currency_symbol}
                </span>
              }
              accent="green"
            />

            <DashboardMetric
              label="Collected"
              value={money(collected, regionalSettings)}
              detail={`${periodPayments.length} payments`}
              icon={<CreditCard className="h-5 w-5" />}
              accent="blue"
            />

            <DashboardMetric
              label="Outstanding"
              value={money(outstanding, regionalSettings)}
              detail={`${periodInvoices.length} invoices`}
              icon={<Clock3 className="h-5 w-5" />}
              accent="amber"
            />

            <DashboardMetric
              label="Expenses"
              value={money(expensesTotal, regionalSettings)}
              detail={`Net ${money(revenue - expensesTotal, regionalSettings)}`}
              icon={<ArrowDownRight className="h-5 w-5" />}
              accent="slate"
            />
          </section>

          {/* CHART + INVOICE HEALTH */}
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.8fr)]">
            <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.10)] sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 text-emerald-600 ring-1 ring-inset ring-emerald-200/60">
                      <BarChart3 className="h-4.5 w-4.5" />
                    </div>

                    <div>
                      <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                        Revenue performance
                      </h2>

                      <p className="mt-0.5 text-xs text-slate-400">
                        Sales revenue vs collected cash
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-full bg-slate-50 px-3.5 py-1.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200/60">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Revenue
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Collected
                  </div>
                </div>
              </div>

              <div className="mt-8 h-[280px]">
                <RevenueChart points={chartPoints} max={maxChart} />
              </div>
            </div>

            <InvoiceHealth
              invoices={periodInvoices}
              paid={
                periodInvoices.filter(
                  (invoice) => normalize(invoice.status) === "paid",
                ).length
              }
              overdueAmount={overdue}
            />
          </section>

          {/* PERFORMANCE STRIP */}
          <section className="grid gap-5 md:grid-cols-3">
            <PerformanceCard
              title="Sales"
              value={money(revenue, regionalSettings)}
              subtitle={`${periodOrders.length} orders`}
              icon={<ShoppingCart className="h-5 w-5" />}
              href={
                enabledModules.has("sales-orders") ? "/sales-orders" : undefined
              }
            />

            <PerformanceCard
              title="Pipeline"
              value={money(estimatePipeline, regionalSettings)}
              subtitle={`${activeLeads} open leads`}
              icon={<Target className="h-5 w-5" />}
              href={enabledModules.has("leads") ? "/leads" : undefined}
            />

            <PerformanceCard
              title="Net operating"
              value={money(revenue - expensesTotal, regionalSettings)}
              subtitle="Revenue less recorded expenses"
              icon={<Activity className="h-5 w-5" />}
            />
          </section>

          {/* MODULES */}
          {moduleMetrics.length > 0 ? (
            <section>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-slate-900">
                    Your business
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Metrics from the modules included in your current plan.
                  </p>
                </div>

                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 ring-1 ring-inset ring-slate-200/70">
                  {moduleMetrics.length} active modules
                </span>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {moduleMetrics.map((metric) => (
                  <ModuleCard key={metric.slug} metric={metric} />
                ))}
              </div>
            </section>
          ) : null}

          {/* ACTIVITY + ALERTS */}
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
            <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.10)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 sm:px-7">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                    Recent activity
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Latest activity for the selected period.
                  </p>
                </div>

                <Activity className="h-4 w-4 text-slate-300" />
              </div>

              {recentActivity.length > 0 ? (
                <div className="divide-y divide-slate-100/80">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="group flex items-center gap-4 px-6 py-4 transition hover:bg-slate-50/70 sm:px-7"
                    >
                      <ActivityIcon type={activity.type} />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-800">
                          {activity.title}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          {activity.detail} · {formatDate(activity.date)}
                        </div>
                      </div>

                      {activity.amount != null ? (
                        <div className="text-sm font-semibold tabular-nums text-slate-800">
                          {money(activity.amount, regionalSettings)}
                        </div>
                      ) : null}

                      <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500">
                        →
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel
                  icon={<Activity className="h-6 w-6" />}
                  title="No activity yet"
                  description="New sales, invoices and customers will appear here."
                />
              )}
            </div>

            <div className="space-y-6">
              <AlertsCard
                lowStockCount={
                  enabledModules.has("inventory") ? lowStockCount : 0
                }
                overdueAmount={enabledModules.has("invoices") ? overdue : 0}
                activeRepairs={
                  enabledModules.has("repairs") ? activeRepairs : 0
                }
                openRmas={enabledModules.has("rma") ? openRmas : 0}
              />

              <QuickActions enabledModules={enabledModules} />
            </div>
          </section>

          {/* PLAN / WORKSPACE FOOTER */}
          <section className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 text-emerald-600 ring-1 ring-inset ring-emerald-200/60">
                  <Layers3 className="h-5 w-5" />
                </div>

                <div>
                  <div className="text-sm font-semibold tracking-tight text-slate-900">
                    {company?.name || "Your workspace"}
                  </div>

                  <div className="mt-1 text-xs text-slate-400">
                    Dashboard automatically reflects the modules available to this workspace.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200/60">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />

                {enabledModules.size} modules enabled
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard Metric                                                           */
/* -------------------------------------------------------------------------- */

function DashboardMetric({
  label,
  value,
  detail,
  icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  accent: "green" | "blue" | "amber" | "slate";
}) {
  const styles = {
    green:
      "bg-gradient-to-br from-emerald-50 to-emerald-100/60 text-emerald-600 ring-emerald-200/60",
    blue: "bg-gradient-to-br from-blue-50 to-blue-100/60 text-blue-600 ring-blue-200/60",
    amber:
      "bg-gradient-to-br from-amber-50 to-amber-100/60 text-amber-600 ring-amber-200/60",
    slate:
      "bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600 ring-slate-200/70",
  };

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.10)] transition duration-300 hover:-translate-y-1 hover:border-slate-300/80 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_40px_-16px_rgba(15,23,42,0.18)]">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset ${styles[accent]}`}
        >
          {icon}
        </div>

        <ArrowUpRight className="h-4 w-4 text-slate-200 transition group-hover:text-emerald-500" />
      </div>

      <div className="mt-6">
        <div className="text-[1.65rem] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
          {value}
        </div>

        <div className="mt-2.5 text-xs font-medium text-slate-500">{label}</div>

        <div className="mt-1 text-[11px] text-slate-400">{detail}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Revenue Chart                                                              */
/* -------------------------------------------------------------------------- */

function RevenueChart({
  points,
  max,
}: {
  points: ChartPoint[];
  max: number;
}) {
  const { settings: regionalSettings } = useRegionalSettings();
  const width = 1000;
  const height = 260;
  const paddingX = 36;
  const paddingY = 20;

  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;

  const getX = (index: number) => {
    if (points.length <= 1) {
      return width / 2;
    }

    return paddingX + (index / (points.length - 1)) * usableWidth;
  };

  const getY = (value: number) =>
    height - paddingY - (value / max) * usableHeight;

  const revenuePoints = points
    .map((point, index) => `${getX(index)},${getY(point.revenue)}`)
    .join(" ");

  const collectedPoints = points
    .map((point, index) => `${getX(index)},${getY(point.collected)}`)
    .join(" ");

  const revenueArea = [
    `${getX(0)},${height - paddingY}`,
    ...points.map((point, index) => `${getX(index)},${getY(point.revenue)}`),
    `${getX(points.length - 1)},${height - paddingY}`,
  ].join(" ");

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full overflow-visible"
        preserveAspectRatio="none"
      >
        {[0, 1, 2, 3, 4].map((line) => {
          const y = paddingY + (line / 4) * usableHeight;

          return (
            <line
              key={line}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="currentColor"
              className="text-slate-100"
              strokeWidth="1"
              strokeDasharray="3 6"
            />
          );
        })}

        <polygon points={revenueArea} className="fill-emerald-500/[0.08]" />

        <polyline
          points={revenuePoints}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-500"
        />

        <polyline
          points={collectedPoints}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 5"
          className="text-blue-500"
        />

        {points.map((point, index) => (
          <g key={index}>
            <circle
              cx={getX(index)}
              cy={getY(point.revenue)}
              r="4.5"
              className="fill-white stroke-emerald-500"
              strokeWidth="2.5"
            />

            <title>
              {point.label}: {money(point.revenue, regionalSettings)}
            </title>
          </g>
        ))}
      </svg>

      <div className="absolute inset-x-0 bottom-0 flex justify-between px-1 text-[10px] font-medium tracking-wide text-slate-400">
        {points.map((point, index) => (
          <span
            key={`${point.label}-${index}`}
            className={
              points.length > 8 && index % 2 !== 0 ? "hidden sm:inline" : ""
            }
          >
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Invoice Health                                                             */
/* -------------------------------------------------------------------------- */

function InvoiceHealth({
  invoices,
  paid,
  overdueAmount,
}: {
  invoices: Invoice[];
  paid: number;
  overdueAmount: number;
}) {
  const { settings: regionalSettings } = useRegionalSettings();
  const total = invoices.length;

  const partial = invoices.filter((invoice) => {
    const totalValue = Number(invoice.total ?? 0);
    const paidValue = Number(invoice.amount_paid ?? 0);

    return paidValue > 0 && paidValue < totalValue;
  }).length;

  const outstanding = invoices.filter((invoice) => {
    const totalValue = Number(invoice.total ?? 0);
    const paidValue = Number(invoice.amount_paid ?? 0);

    return paidValue === 0 && totalValue > 0;
  }).length;

  const paidPct = total ? (paid / total) * 100 : 0;
  const partialPct = total ? (partial / total) * 100 : 0;
  const outstandingPct = total ? (outstanding / total) * 100 : 0;

  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { value: paidPct, className: "text-emerald-500", offset: 0 },
    { value: partialPct, className: "text-blue-500", offset: paidPct },
    {
      value: outstandingPct,
      className: "text-slate-300",
      offset: paidPct + partialPct,
    },
  ];

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.10)] sm:p-7">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">
          Invoice health
        </h2>

        <p className="mt-1 text-xs text-slate-400">
          Collection status across invoices.
        </p>
      </div>

      <div className="mt-7 flex items-center gap-6">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              className="text-slate-100"
            />

            {segments.map((segment, index) => (
              <circle
                key={index}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeDasharray={`${(segment.value / 100) * circumference} ${circumference}`}
                strokeDashoffset={-(segment.offset / 100) * circumference}
                strokeLinecap="round"
                pathLength={circumference}
                className={segment.className}
              />
            ))}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-semibold tabular-nums text-slate-900">
              {total}
            </div>

            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
              Invoices
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <HealthRow label="Paid" value={paid} color="bg-emerald-500" />

          <HealthRow label="Partial" value={partial} color="bg-blue-500" />

          <HealthRow
            label="Outstanding"
            value={outstanding}
            color="bg-slate-300"
          />

          <div className="border-t border-slate-100 pt-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400">
                Overdue value
              </span>

              <span className="text-sm font-semibold tabular-nums text-red-600">
                {money(overdueAmount, regionalSettings)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className={`h-2 w-2 rounded-full ${color}`} />

        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>

      <span className="text-xs font-semibold tabular-nums text-slate-800">
        {value}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Performance                                                                */
/* -------------------------------------------------------------------------- */

function PerformanceCard({
  title,
  value,
  subtitle,
  icon,
  href,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div className="group h-full rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.10)] transition duration-300 hover:-translate-y-1 hover:border-slate-300/80 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_40px_-16px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200/70 transition group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:ring-emerald-200/60">
          {icon}
        </div>

        {href ? (
          <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-emerald-500" />
        ) : null}
      </div>

      <div className="mt-6 text-xl font-semibold tracking-tight tabular-nums text-slate-900">
        {value}
      </div>

      <div className="mt-1.5 text-xs font-medium text-slate-600">{title}</div>

      <div className="mt-1 text-[11px] text-slate-400">{subtitle}</div>
    </div>
  );

  if (!href) {
    return content;
  }

  return <a href={href}>{content}</a>;
}

/* -------------------------------------------------------------------------- */
/* Module Card                                                                */
/* -------------------------------------------------------------------------- */

function ModuleCard({ metric }: { metric: ModuleMetric }) {
  return (
    <a
      href={metric.href}
      className="group rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_20px_40px_-16px_rgba(16,185,129,0.22)]"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200/70 transition group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:ring-emerald-200/60">
          {metric.icon}
        </div>

        <ArrowUpRight className="h-4 w-4 text-slate-200 transition group-hover:text-emerald-500" />
      </div>

      <div className="mt-6">
        <div className="text-xl font-semibold tracking-tight tabular-nums text-slate-900">
          {metric.value}
        </div>

        <div className="mt-1.5 text-xs font-medium text-slate-700">
          {metric.name}
        </div>

        <div className="mt-1 text-[11px] leading-5 text-slate-400">
          {metric.detail}
        </div>
      </div>
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* Alerts                                                                     */
/* -------------------------------------------------------------------------- */

function AlertsCard({
  lowStockCount,
  overdueAmount,
  activeRepairs,
  openRmas,
}: {
  lowStockCount: number;
  overdueAmount: number;
  activeRepairs: number;
  openRmas: number;
}) {
  const { settings: regionalSettings } = useRegionalSettings();
  const alerts = [
    ...(lowStockCount > 0
      ? [
          {
            icon: <Boxes className="h-4 w-4" />,
            title: `${lowStockCount} low-stock item${
              lowStockCount === 1 ? "" : "s"
            }`,
            detail: "Inventory needs attention.",
            tone: "amber",
          },
        ]
      : []),

    ...(overdueAmount > 0
      ? [
          {
            icon: <AlertTriangle className="h-4 w-4" />,
            title: `${money(overdueAmount, regionalSettings)} overdue`,
            detail: "Invoices require collection.",
            tone: "red",
          },
        ]
      : []),

    ...(activeRepairs > 0
      ? [
          {
            icon: <Wrench className="h-4 w-4" />,
            title: `${activeRepairs} active repair${
              activeRepairs === 1 ? "" : "s"
            }`,
            detail: "Repair workflow has open work.",
            tone: "blue",
          },
        ]
      : []),

    ...(openRmas > 0
      ? [
          {
            icon: <PackageCheck className="h-4 w-4" />,
            title: `${openRmas} open RMA${openRmas === 1 ? "" : "s"}`,
            detail: "Returns require action.",
            tone: "violet",
          },
        ]
      : []),
  ];

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.10)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            Needs attention
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            Items that may need action.
          </p>
        </div>

        <Bell className="h-4 w-4 text-slate-300" />
      </div>

      {alerts.length > 0 ? (
        <div className="divide-y divide-slate-100/80">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className="flex items-center gap-3.5 px-6 py-4 transition hover:bg-slate-50/70"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
                  alert.tone === "red"
                    ? "bg-red-50 text-red-600 ring-red-200/60"
                    : alert.tone === "amber"
                      ? "bg-amber-50 text-amber-600 ring-amber-200/60"
                      : alert.tone === "blue"
                        ? "bg-blue-50 text-blue-600 ring-blue-200/60"
                        : "bg-violet-50 text-violet-600 ring-violet-200/60"
                }`}
              >
                {alert.icon}
              </div>

              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800">
                  {alert.title}
                </div>

                <div className="mt-0.5 text-[11px] text-slate-400">
                  {alert.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center px-6 py-9 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200/60">
            <CheckCircle2 className="h-5 w-5" />
          </div>

          <div className="mt-3 text-xs font-semibold text-slate-700">
            Everything looks good
          </div>

          <div className="mt-1 text-[11px] text-slate-400">
            No major attention items right now.
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Quick Actions                                                              */
/* -------------------------------------------------------------------------- */

function QuickActions({ enabledModules }: { enabledModules: Set<string> }) {
  const actions = [
    {
      slug: "customers",
      label: "Add customer",
      href: "/customers/new",
      icon: <Users className="h-4 w-4" />,
    },
    {
      slug: "estimates",
      label: "Create estimate",
      href: "/estimates/new",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      slug: "invoices",
      label: "Create invoice",
      href: "/invoices/new",
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      slug: "sales-orders",
      label: "New sales order",
      href: "/sales-orders/new",
      icon: <ShoppingCart className="h-4 w-4" />,
    },
  ].filter((action) => enabledModules.has(action.slug));

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.10)]">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">
          Quick actions
        </h2>

        <p className="mt-1 text-xs text-slate-400">
          Jump straight into your daily work.
        </p>
      </div>

      <div className="mt-5 grid gap-2">
        {actions.map((action) => (
          <a
            key={action.label}
            href={action.href}
            className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/40 px-3.5 py-3 transition hover:border-emerald-200/70 hover:bg-emerald-50/50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-inset ring-slate-200/70 transition group-hover:bg-emerald-100 group-hover:text-emerald-600 group-hover:ring-emerald-200/60">
              {action.icon}
            </div>

            <span className="flex-1 text-xs font-medium text-slate-700">
              {action.label}
            </span>

            <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-emerald-500" />
          </a>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Activity Icon                                                              */
/* -------------------------------------------------------------------------- */

function ActivityIcon({ type }: { type: string }) {
  if (type === "sale") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200/60">
        <ShoppingCart className="h-4 w-4" />
      </div>
    );
  }

  if (type === "invoice") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200/60">
        <FileText className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-200/60">
      <Users className="h-4 w-4" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty                                                                      */
/* -------------------------------------------------------------------------- */

function EmptyPanel({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200/70">
        {icon}
      </div>

      <div className="mt-4 text-sm font-semibold text-slate-700">{title}</div>

      <div className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
        {description}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                   */
/* -------------------------------------------------------------------------- */

function DashboardSkeleton() {
  return (
    <div className="min-h-full bg-[#f5f7fa] p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-[1800px] space-y-8">
        <div className="h-20 animate-pulse rounded-3xl bg-white/80" />

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-3xl bg-white/80"
            />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.65fr_0.8fr]">
          <div className="h-[370px] animate-pulse rounded-3xl bg-white/80" />
          <div className="h-[370px] animate-pulse rounded-3xl bg-white/80" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-3xl bg-white/80"
            />
          ))}
        </div>
      </div>
    </div>
  );
}