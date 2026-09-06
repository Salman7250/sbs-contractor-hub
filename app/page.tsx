"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
};

type Estimate = {
  id: string;
  estimate_number: string;
  customer_id: string | null;
  total: number | null;
  status: string | null;
  created_at: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  total: number | null;
  status: string | null;
  created_at: string;
};

type Order = {
  id: string;
  order_number: string;
  customer_id: string | null;
  total: number | null;
  status: string | null;
  created_at: string;
};

type InvoicePayment = {
  id: string;
  invoice_id: string;
  amount: number | null;
  payment_date: string | null;
  created_at: string;
};

type Company = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Module = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
};

type IconName =
  | "crm"
  | "leads"
  | "customers"
  | "jobs"
  | "estimates"
  | "invoices"
  | "inventory"
  | "employees"
  | "reports"
  | "payments"
  | "documents"
  | "settings";

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
  };

  switch (name) {
    case "crm":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );

    case "leads":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21a7 7 0 0 1 14 0" />
          <path d="M19 8h3" />
          <path d="M20.5 6.5 22 8l-1.5 1.5" />
        </svg>
      );

    case "customers":
      return (
        <svg {...common}>
          <circle cx="9" cy="7" r="4" />
          <path d="M2 21a7 7 0 0 1 14 0" />
          <path d="M19 8v6" />
          <path d="M22 11h-6" />
        </svg>
      );

    case "jobs":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M8 6V4h8v2" />
          <path d="M3 11h18" />
          <path d="M10 11v2h4v-2" />
        </svg>
      );

    case "estimates":
      return (
        <svg {...common}>
          <path d="M6 2h9l3 3v17H6z" />
          <path d="M14 2v4h4" />
          <path d="M9 12h6" />
          <path d="M9 16h6" />
          <path d="M9 8h2" />
        </svg>
      );

    case "invoices":
      return (
        <svg {...common}>
          <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" />
          <path d="M9 7h6" />
          <path d="M9 11h6" />
          <path d="M9 15h3" />
        </svg>
      );

    case "inventory":
      return (
        <svg {...common}>
          <path d="m3 7 9-4 9 4-9 4z" />
          <path d="m3 7 9 4 9-4" />
          <path d="M3 7v10l9 4 9-4V7" />
          <path d="M12 11v10" />
        </svg>
      );

    case "employees":
      return (
        <svg {...common}>
          <circle cx="12" cy="7" r="4" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
      );

    case "reports":
      return (
        <svg {...common}>
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M22 20V7" />
        </svg>
      );

    case "payments":
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h4" />
        </svg>
      );

    case "documents":
      return (
        <svg {...common}>
          <path d="M6 2h9l3 3v17H6z" />
          <path d="M14 2v4h4" />
          <path d="M9 12h6" />
          <path d="M9 16h6" />
        </svg>
      );

    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.41 1.41-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-2v-.49a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.41-1.41.06-.06A1.7 1.7 0 0 0 9.4 15a1.7 1.7 0 0 0-1.56-1.03H7v-2h.84A1.7 1.7 0 0 0 9.4 10a1.7 1.7 0 0 0-.34-1.88L9 8.06l1.41-1.41.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 13.38 5.5V5h2v.5A1.7 1.7 0 0 0 16.4 7a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.41 1.41-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H21v2h-.49A1.7 1.7 0 0 0 19.4 15z" />
        </svg>
      );

    default:
      return null;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [company, setCompany] = useState<Company | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [modules, setModules] = useState<Module[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setProfile({
        id: user.id,
        full_name:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : null,
        email: user.email ?? null,
      });

      const { data: membership, error: membershipError } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership?.company_id) {
        throw new Error("No company is associated with your account.");
      }

      const companyId = membership.company_id;

      const [
        companyResult,
        customersResult,
        estimatesResult,
        invoicesResult,
        ordersResult,
        paymentsResult,
        modulesResult,
      ] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, slug, logo_url")
          .eq("id", companyId)
          .single(),

        supabase
          .from("customers")
          .select("id, name, email, phone, status, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),

        supabase
          .from("estimates")
          .select(
            "id, estimate_number, customer_id, total, status, created_at",
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),

        supabase
          .from("invoices")
          .select(
            "id, invoice_number, customer_id, total, status, created_at",
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),

        supabase
          .from("orders")
          .select("id, order_number, customer_id, total, status, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),

        supabase
          .from("invoice_payments")
          .select("id, invoice_id, amount, payment_date, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),

        supabase
          .from("modules")
          .select("id, name, slug, description, icon")
          .eq("is_active", true)
          .order("name"),
      ]);

      if (companyResult.error) {
        throw companyResult.error;
      }

      if (customersResult.error) {
        throw customersResult.error;
      }

      if (estimatesResult.error) {
        throw estimatesResult.error;
      }

      if (invoicesResult.error) {
        throw invoicesResult.error;
      }

      if (ordersResult.error) {
        throw ordersResult.error;
      }

      if (paymentsResult.error) {
        throw paymentsResult.error;
      }

      if (modulesResult.error) {
        throw modulesResult.error;
      }

      setCompany(companyResult.data);
      setCustomers(customersResult.data ?? []);
      setEstimates(estimatesResult.data ?? []);
      setInvoices(invoicesResult.data ?? []);
      setOrders(ordersResult.data ?? []);
      setPayments(paymentsResult.data ?? []);
      setModules(modulesResult.data ?? []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    // This effect intentionally starts the asynchronous dashboard synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  const totalCustomers = customers.length;

  const totalEstimates = estimates.reduce(
    (sum, estimate) => sum + Number(estimate.total ?? 0),
    0,
  );

  const totalInvoices = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.total ?? 0),
    0,
  );

  const totalOrders = orders.reduce(
    (sum, order) => sum + Number(order.total ?? 0),
    0,
  );

  const totalPayments = payments.reduce(
    (sum, payment) => sum + Number(payment.amount ?? 0),
    0,
  );

  const outstandingInvoices = invoices
    .filter(
      (invoice) =>
        invoice.status !== "paid" &&
        invoice.status !== "cancelled" &&
        invoice.status !== "void",
    )
    .reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);

  const recentCustomers = customers.slice(0, 5);
  const recentInvoices = invoices.slice(0, 5);

  const greeting = useMemo(() => {
    const hour = new Date(currentTime).getHours();

    if (hour < 12) {
      return "Good morning";
    }

    if (hour < 18) {
      return "Good afternoon";
    }

    return "Good evening";
  }, [currentTime]);

  const enabledModuleSlugs = useMemo(
    () => new Set(modules.map((module) => module.slug)),
    [modules],
  );

  const dashboardModules = useMemo(
    () =>
      [
        {
          slug: "crm",
          name: "CRM",
          description: "Manage relationships and customer activity.",
          href: "/crm",
          icon: "crm" as IconName,
        },
        {
          slug: "leads",
          name: "Leads",
          description: "Track prospects and convert opportunities.",
          href: "/leads",
          icon: "leads" as IconName,
        },
        {
          slug: "customers",
          name: "Customers",
          description: "Manage your customers and their information.",
          href: "/customers",
          icon: "customers" as IconName,
        },
        {
          slug: "jobs",
          name: "Jobs",
          description: "Track jobs, schedules, and service work.",
          href: "/jobs",
          icon: "jobs" as IconName,
        },
        {
          slug: "estimates",
          name: "Estimates",
          description: "Create and manage estimates for customers.",
          href: "/estimates",
          icon: "estimates" as IconName,
        },
        {
          slug: "invoices",
          name: "Invoices",
          description: "Create invoices and track receivables.",
          href: "/invoices",
          icon: "invoices" as IconName,
        },
        {
          slug: "inventory",
          name: "Inventory",
          description: "Manage products, stock, SKUs, and inventory.",
          href: "/products",
          icon: "inventory" as IconName,
        },
        {
          slug: "employees",
          name: "Employees",
          description: "Manage employees and team information.",
          href: "/employees",
          icon: "employees" as IconName,
        },
        {
          slug: "reports",
          name: "Reports",
          description: "Review business performance and reporting.",
          href: "/reports",
          icon: "reports" as IconName,
        },
        {
          slug: "payments",
          name: "Payments",
          description: "Track payments and financial transactions.",
          href: "/payments",
          icon: "payments" as IconName,
        },
        {
          slug: "documents",
          name: "Documents",
          description: "Store and manage important documents.",
          href: "/documents",
          icon: "documents" as IconName,
        },
        {
          slug: "settings",
          name: "Settings",
          description: "Configure your company and workspace.",
          href: "/settings",
          icon: "settings" as IconName,
        },
      ].filter((module) => enabledModuleSlugs.has(module.slug)),
    [enabledModuleSlugs],
  );

  if (loading) {
    return (
      <AppShell>
        <div className="sbs-dashboard-loading">
          <div className="sbs-dashboard-spinner" />
          <p>Loading dashboard...</p>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="sbs-dashboard-error">
          <h1>Unable to load dashboard</h1>
          <p>{error}</p>
          <button type="button" onClick={() => void loadDashboard()}>
            Try Again
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="sbs-dashboard">
        <section className="sbs-dashboard-header">
          <div>
            <p className="sbs-dashboard-eyebrow">
              {company?.name ?? "Your Company"}
            </p>

            <h1>
              {greeting}
              {profile?.full_name
                ? `, ${profile.full_name.split(" ")[0]}`
                : ""}
              .
            </h1>

            <p className="sbs-dashboard-subtitle">
              Here&apos;s what&apos;s happening across your business.
            </p>
          </div>

          <div className="sbs-dashboard-header-actions">
            <button
              type="button"
              className="sbs-dashboard-primary-button"
              onClick={() => router.push("/sales/new")}
            >
              + New Sale
            </button>
          </div>
        </section>

        <section className="sbs-dashboard-stats">
          <button
            type="button"
            className="sbs-dashboard-stat-card"
            onClick={() => router.push("/customers")}
          >
            <div className="sbs-dashboard-stat-icon">
              <Icon name="customers" size={22} />
            </div>
            <div>
              <span>Customers</span>
              <strong>{totalCustomers}</strong>
            </div>
          </button>

          <button
            type="button"
            className="sbs-dashboard-stat-card"
            onClick={() => router.push("/estimates")}
          >
            <div className="sbs-dashboard-stat-icon">
              <Icon name="estimates" size={22} />
            </div>
            <div>
              <span>Estimates</span>
              <strong>
                {totalEstimates.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
          </button>

          <button
            type="button"
            className="sbs-dashboard-stat-card"
            onClick={() => router.push("/invoices")}
          >
            <div className="sbs-dashboard-stat-icon">
              <Icon name="invoices" size={22} />
            </div>
            <div>
              <span>Invoices</span>
              <strong>
                {totalInvoices.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
          </button>

          <button
            type="button"
            className="sbs-dashboard-stat-card"
            onClick={() => router.push("/payments")}
          >
            <div className="sbs-dashboard-stat-icon">
              <Icon name="payments" size={22} />
            </div>
            <div>
              <span>Payments</span>
              <strong>
                {totalPayments.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
          </button>
        </section>

        <section className="sbs-dashboard-financial-grid">
          <div className="sbs-dashboard-panel">
            <div className="sbs-dashboard-panel-header">
              <div>
                <p className="sbs-dashboard-panel-eyebrow">
                  Financial overview
                </p>
                <h2>Outstanding invoices</h2>
              </div>

              <button
                type="button"
                className="sbs-dashboard-link-button"
                onClick={() => router.push("/invoices")}
              >
                View invoices →
              </button>
            </div>

            <div className="sbs-dashboard-outstanding">
              <strong>
                {outstandingInvoices.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
              <span>Outstanding balance</span>
            </div>

            <div className="sbs-dashboard-mini-stats">
              <div>
                <span>Orders</span>
                <strong>
                  {totalOrders.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
              </div>

              <div>
                <span>Payments received</span>
                <strong>
                  {totalPayments.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
              </div>
            </div>
          </div>

          <div className="sbs-dashboard-panel">
            <div className="sbs-dashboard-panel-header">
              <div>
                <p className="sbs-dashboard-panel-eyebrow">Quick actions</p>
                <h2>Get things done</h2>
              </div>
            </div>

            <div className="sbs-dashboard-quick-actions">
              <button
                type="button"
                onClick={() => router.push("/sales/new")}
              >
                <span className="sbs-dashboard-quick-icon">+</span>
                <span>
                  <strong>New Sale</strong>
                  <small>Create a new sales order</small>
                </span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/invoices/new")}
              >
                <span className="sbs-dashboard-quick-icon">
                  <Icon name="invoices" size={18} />
                </span>
                <span>
                  <strong>New Invoice</strong>
                  <small>Create an invoice</small>
                </span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/customers/new")}
              >
                <span className="sbs-dashboard-quick-icon">
                  <Icon name="customers" size={18} />
                </span>
                <span>
                  <strong>New Customer</strong>
                  <small>Add a customer</small>
                </span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/products")}
              >
                <span className="sbs-dashboard-quick-icon">
                  <Icon name="inventory" size={18} />
                </span>
                <span>
                  <strong>Inventory</strong>
                  <small>Manage products and stock</small>
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className="sbs-dashboard-content-grid">
          <div className="sbs-dashboard-panel">
            <div className="sbs-dashboard-panel-header">
              <div>
                <p className="sbs-dashboard-panel-eyebrow">Customers</p>
                <h2>Recent customers</h2>
              </div>

              <button
                type="button"
                className="sbs-dashboard-link-button"
                onClick={() => router.push("/customers")}
              >
                View all →
              </button>
            </div>

            {recentCustomers.length === 0 ? (
              <div className="sbs-dashboard-empty">
                <Icon name="customers" size={28} />
                <p>No customers yet.</p>
                <button
                  type="button"
                  onClick={() => router.push("/customers/new")}
                >
                  Add your first customer
                </button>
              </div>
            ) : (
              <div className="sbs-dashboard-list">
                {recentCustomers.map((customer) => (
                  <button
                    type="button"
                    key={customer.id}
                    className="sbs-dashboard-list-item"
                    onClick={() =>
                      router.push(`/customers/${customer.id}`)
                    }
                  >
                    <div className="sbs-dashboard-avatar">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="sbs-dashboard-list-main">
                      <strong>{customer.name}</strong>
                      <span>{customer.email ?? customer.phone ?? "—"}</span>
                    </div>

                    <span className="sbs-dashboard-list-date">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="sbs-dashboard-panel">
            <div className="sbs-dashboard-panel-header">
              <div>
                <p className="sbs-dashboard-panel-eyebrow">Invoices</p>
                <h2>Recent invoices</h2>
              </div>

              <button
                type="button"
                className="sbs-dashboard-link-button"
                onClick={() => router.push("/invoices")}
              >
                View all →
              </button>
            </div>

            {recentInvoices.length === 0 ? (
              <div className="sbs-dashboard-empty">
                <Icon name="invoices" size={28} />
                <p>No invoices yet.</p>
                <button
                  type="button"
                  onClick={() => router.push("/invoices/new")}
                >
                  Create your first invoice
                </button>
              </div>
            ) : (
              <div className="sbs-dashboard-list">
                {recentInvoices.map((invoice) => (
                  <button
                    type="button"
                    key={invoice.id}
                    className="sbs-dashboard-list-item"
                    onClick={() =>
                      router.push(`/invoices/${invoice.id}`)
                    }
                  >
                    <div className="sbs-dashboard-list-icon">
                      <Icon name="invoices" size={19} />
                    </div>

                    <div className="sbs-dashboard-list-main">
                      <strong>{invoice.invoice_number}</strong>
                      <span>
                        {invoice.status
                          ? invoice.status.charAt(0).toUpperCase() +
                            invoice.status.slice(1)
                          : "Draft"}
                      </span>
                    </div>

                    <strong className="sbs-dashboard-list-amount">
                      {Number(invoice.total ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="sbs-dashboard-modules-section">
          <div className="sbs-dashboard-section-header">
            <div>
              <p className="sbs-dashboard-panel-eyebrow">Workspace</p>
              <h2>Your modules</h2>
            </div>
          </div>

          <div className="sbs-dashboard-module-grid">
            {dashboardModules.map((module) => (
              <button
                type="button"
                key={module.slug}
                className="sbs-dashboard-module-card"
                onClick={() => router.push(module.href)}
              >
                <div className="sbs-dashboard-module-icon">
                  <Icon name={module.icon} size={23} />
                </div>

                <div>
                  <strong>{module.name}</strong>
                  <p>{module.description}</p>
                </div>

                <span className="sbs-dashboard-module-arrow">→</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}