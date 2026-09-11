"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string | null;
  email?: string | null;
  created_at: string;
};

type Estimate = {
  id: string;
  estimate_number?: string | null;
  customer_id?: string | null;
  total?: number | null;
  status?: string | null;
  created_at: string;
};

type Invoice = {
  id: string;
  invoice_number: string | null;
  customer_id: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total: number | null;
  amount_paid?: number | null;
  status: string | null;
  due_date?: string | null;
  created_at: string;
};

type Order = {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  total_amount: number | null;
  status: string | null;
  created_at: string;
};

type InvoicePayment = {
  id: string;
  invoice_id: string | null;
  amount: number | null;
  paid_at: string | null;
  created_at: string;
};

type Company = {
  id: string;
  name: string | null;
  slug: string | null;
  logo_url?: string | null;
  currency?: string | null;
};

type Profile = {
  full_name?: string | null;
  first_name?: string | null;
  email?: string | null;
};

type ActivityItem = {
  id: string;
  type: "sale" | "invoice" | "customer";
  title: string;
  subtitle: string;
  amount?: number;
  date: string;
};

type MonthlyData = {
  label: string;
  sales: number;
  collected: number;
};

function money(value: number, currency = "AED") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getInitials(name: string | null | undefined) {
  if (!name) return "CU";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function normalizeStatus(status: string | null | undefined) {
  return (status || "").toLowerCase().replace(/[\s-]+/g, "_");
}

function Icon({
  name,
  size = 18,
}: {
  name: string;
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
    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8.1 8.1 0 0 0-15.5-2" />
          <path d="M4 5v4h4" />
          <path d="M4 13a8.1 8.1 0 0 0 15.5 2" />
          <path d="M20 19v-4h-4" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );

    case "sale":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="m7 15 3-4 3 2 5-6" />
          <path d="M15 7h3v3" />
        </svg>
      );

    case "invoice":
      return (
        <svg {...common}>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
          <path d="M9 16h3" />
        </svg>
      );

    case "customer":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20a6 6 0 0 1 12 0" />
          <path d="M16 11a3 3 0 1 0 0-6" />
          <path d="M18 14a5 5 0 0 1 3 4" />
        </svg>
      );

    case "purchase":
      return (
        <svg {...common}>
          <path d="M4 5h16v14H4z" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
          <path d="M8 17h3" />
        </svg>
      );

    case "expense":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 9h10" />
          <path d="M8 14h.01" />
          <path d="M12 14h4" />
        </svg>
      );

    case "inventory":
      return (
        <svg {...common}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
          <path d="m4 7.5 8 4.5 8-4.5" />
          <path d="M12 12v9" />
        </svg>
      );

    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 20a6 6 0 0 1 12 0" />
          <path d="M15 15a5 5 0 0 1 6 5" />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "warning":
      return (
        <svg {...common}>
          <path d="m12 4 9 16H3z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );

    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M7 15v-3" />
          <path d="M11 15V8" />
          <path d="M15 15v-5" />
          <path d="M19 15V6" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function DonutChart({
  paid,
  partial,
  outstanding,
  overdue,
}: {
  paid: number;
  partial: number;
  outstanding: number;
  overdue: number;
}) {
  const total = paid + partial + outstanding + overdue;

  const paidPct = total ? (paid / total) * 100 : 0;
  const partialPct = total ? (partial / total) * 100 : 0;
  const outstandingPct = total ? (outstanding / total) * 100 : 0;
  const overduePct = total ? (overdue / total) * 100 : 0;

  const circumference = 100;

  const paidOffset = 0;
  const partialOffset = paidPct;
  const outstandingOffset = paidPct + partialPct;
  const overdueOffset =
    paidPct + partialPct + outstandingPct;

  return (
    <div className="sbs-donut-wrap">
      <svg
        className="sbs-donut"
        viewBox="0 0 42 42"
        aria-label="Invoice health"
      >
        <circle
          cx="21"
          cy="21"
          r="15.9155"
          fill="none"
          stroke="currentColor"
          strokeWidth="4.5"
          opacity=".08"
        />

        {total > 0 && (
          <>
            <circle
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke="currentColor"
              strokeWidth="4.5"
              strokeDasharray={`${paidPct} ${
                circumference - paidPct
              }`}
              strokeDashoffset={-paidOffset}
              pathLength="100"
              className="donut-paid"
            />

            <circle
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke="currentColor"
              strokeWidth="4.5"
              strokeDasharray={`${partialPct} ${
                circumference - partialPct
              }`}
              strokeDashoffset={-partialOffset}
              pathLength="100"
              className="donut-partial"
            />

            <circle
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke="currentColor"
              strokeWidth="4.5"
              strokeDasharray={`${outstandingPct} ${
                circumference - outstandingPct
              }`}
              strokeDashoffset={-outstandingOffset}
              pathLength="100"
              className="donut-outstanding"
            />

            <circle
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke="currentColor"
              strokeWidth="4.5"
              strokeDasharray={`${overduePct} ${
                circumference - overduePct
              }`}
              strokeDashoffset={-overdueOffset}
              pathLength="100"
              className="donut-overdue"
            />
          </>
        )}
      </svg>

      <div className="sbs-donut-center">
        <strong>{total}</strong>
        <span>Invoices</span>
      </div>
    </div>
  );
}

function MiniTrend({
  values,
}: {
  values: number[];
}) {
  if (!values.length) return null;

  const max = Math.max(...values, 1);
  const min = Math.min(...values);

  const points = values
    .map((value, index) => {
      const x =
        values.length === 1
          ? 50
          : (index / (values.length - 1)) * 100;

      const y =
        36 -
        ((value - min) / Math.max(max - min, 1)) * 30;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className="sbs-mini-trend"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [company, setCompany] = useState<Company | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoicePayments, setInvoicePayments] = useState<
    InvoicePayment[]
  >([]);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
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
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        setProfile({
          full_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            null,
          first_name:
            user.user_metadata?.first_name || null,
          email: user.email || null,
        });

        const { data: membership, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company workspace is associated with this account."
          );
        }

        const companyId = membership.company_id;

        const [
          companyResult,
          customersResult,
          estimatesResult,
          invoicesResult,
          ordersResult,
          paymentsResult,
        ] = await Promise.all([
          supabase
            .from("companies")
            .select("id,name,slug,logo_url,currency")
            .eq("id", companyId)
            .single(),

          supabase
            .from("customers")
            .select("id,name,email,created_at")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false }),

          supabase
            .from("estimates")
            .select(
              "id,estimate_number,customer_id,total,status,created_at"
            )
            .eq("company_id", companyId)
            .order("created_at", { ascending: false }),

          supabase
            .from("invoices")
            .select(
              "id,invoice_number,customer_id,subtotal,tax,total,amount_paid,status,due_date,created_at"
            )
            .eq("company_id", companyId)
            .order("created_at", { ascending: false }),

          supabase
            .from("orders")
            .select(
              "id,order_number,customer_id,total_amount,status,created_at"
            )
            .eq("company_id", companyId)
            .order("created_at", { ascending: false }),

          supabase
            .from("invoice_payments")
            .select(
              "id,invoice_id,amount,paid_at,created_at"
            )
            .eq("company_id", companyId)
            .order("created_at", { ascending: false }),
        ]);

        const firstError = [
          companyResult.error,
          customersResult.error,
          estimatesResult.error,
          invoicesResult.error,
          ordersResult.error,
          paymentsResult.error,
        ].find(Boolean);

        if (firstError) {
          throw firstError;
        }

        setCompany(companyResult.data);
        setCustomers(customersResult.data || []);
        setEstimates(estimatesResult.data || []);
        setInvoices(invoicesResult.data || []);
        setOrders(ordersResult.data || []);
        setInvoicePayments(paymentsResult.data || []);
      } catch (error) {
        console.error("Dashboard load error:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load dashboard data."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const currency = company?.currency || "AED";

  const displayName =
    profile?.first_name ||
    profile?.full_name?.split(" ")[0] ||
    "there";

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const totalSales = useMemo(() => {
    return orders.reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0
    );
  }, [orders]);

  const totalCollected = useMemo(() => {
    return invoicePayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );
  }, [invoicePayments]);

  const invoiceReceivables = useMemo(() => {
    return invoices.reduce((sum, invoice) => {
      const total = Number(invoice.total || 0);
      const paid = Number(invoice.amount_paid || 0);

      return sum + Math.max(total - paid, 0);
    }, 0);
  }, [invoices]);

  const overdueReceivables = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return invoices.reduce((sum, invoice) => {
      const status = normalizeStatus(invoice.status);
      const total = Number(invoice.total || 0);
      const paid = Number(invoice.amount_paid || 0);
      const remaining = Math.max(total - paid, 0);

      if (
        remaining <= 0 ||
        ["paid", "cancelled", "canceled", "void"].includes(status)
      ) {
        return sum;
      }

      if (invoice.due_date) {
        const due = new Date(invoice.due_date);
        due.setHours(0, 0, 0, 0);

        if (due < today) {
          return sum + remaining;
        }
      }

      return sum;
    }, 0);
  }, [invoices]);

  const monthlyData = useMemo<MonthlyData[]>(() => {
    const result: MonthlyData[] = [];

    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1
      );

      const year = date.getFullYear();
      const month = date.getMonth();

      const sales = orders.reduce((sum, order) => {
        const orderDate = new Date(order.created_at);

        if (
          orderDate.getFullYear() === year &&
          orderDate.getMonth() === month
        ) {
          return sum + Number(order.total_amount || 0);
        }

        return sum;
      }, 0);

      const collected = invoicePayments.reduce((sum, payment) => {
        const paymentDate = new Date(
          payment.paid_at || payment.created_at
        );

        if (
          paymentDate.getFullYear() === year &&
          paymentDate.getMonth() === month
        ) {
          return sum + Number(payment.amount || 0);
        }

        return sum;
      }, 0);

      result.push({
        label: new Intl.DateTimeFormat("en-US", {
          month: "short",
        }).format(date),
        sales,
        collected,
      });
    }

    return result;
  }, [orders, invoicePayments]);

  const chartMax = useMemo(() => {
    const values = monthlyData.flatMap((item) => [
      item.sales,
      item.collected,
    ]);

    return Math.max(...values, 1);
  }, [monthlyData]);

  const invoiceHealth = useMemo(() => {
    let paid = 0;
    let partial = 0;
    let outstanding = 0;
    let overdue = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    invoices.forEach((invoice) => {
      const status = normalizeStatus(invoice.status);
      const total = Number(invoice.total || 0);
      const paidAmount = Number(invoice.amount_paid || 0);
      const remaining = Math.max(total - paidAmount, 0);

      if (
        ["cancelled", "canceled", "void"].includes(status)
      ) {
        return;
      }

      if (total > 0 && paidAmount >= total) {
        paid += 1;
        return;
      }

      if (invoice.due_date) {
        const due = new Date(invoice.due_date);
        due.setHours(0, 0, 0, 0);

        if (remaining > 0 && due < today) {
          overdue += 1;
          return;
        }
      }

      if (paidAmount > 0 && remaining > 0) {
        partial += 1;
        return;
      }

      outstanding += 1;
    });

    return {
      paid,
      partial,
      outstanding,
      overdue,
    };
  }, [invoices]);

  const salesTrend = monthlyData.map((item) => item.sales);

  const funnel = useMemo(() => {
    const estimatesCount = estimates.length;
    const ordersCount = orders.length;
    const invoicesCount = invoices.length;

    return {
      estimates: estimatesCount,
      orders: ordersCount,
      invoices: invoicesCount,
      collected: totalCollected,
    };
  }, [
    estimates.length,
    orders.length,
    invoices.length,
    totalCollected,
  ]);

  const recentCustomers = useMemo(() => {
    return customers.slice(0, 5);
  }, [customers]);

  const recentInvoices = useMemo(() => {
    return invoices.slice(0, 5);
  }, [invoices]);

  const activities = useMemo<ActivityItem[]>(() => {
    const orderActivities: ActivityItem[] = orders
      .slice(0, 6)
      .map((order) => ({
        id: `order-${order.id}`,
        type: "sale",
        title: `Sale ${order.order_number || "Order"}`,
        subtitle:
          normalizeStatus(order.status)
            .replace(/_/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase()) ||
          "Sales order",
        amount: Number(order.total_amount || 0),
        date: order.created_at,
      }));

    const invoiceActivities: ActivityItem[] = invoices
      .slice(0, 6)
      .map((invoice) => ({
        id: `invoice-${invoice.id}`,
        type: "invoice",
        title: `Invoice ${
          invoice.invoice_number || "Invoice"
        }`,
        subtitle:
          normalizeStatus(invoice.status)
            .replace(/_/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase()) ||
          "Invoice created",
        amount: Number(invoice.total || 0),
        date: invoice.created_at,
      }));

    const customerActivities: ActivityItem[] = customers
      .slice(0, 6)
      .map((customer) => ({
        id: `customer-${customer.id}`,
        type: "customer",
        title: customer.name || "New customer",
        subtitle: "Customer added",
        date: customer.created_at,
      }));

    return [
      ...orderActivities,
      ...invoiceActivities,
      ...customerActivities,
    ]
      .sort(
        (a, b) =>
          new Date(b.date).getTime() -
          new Date(a.date).getTime()
      )
      .slice(0, 8);
  }, [orders, invoices, customers]);

  const statCards = [
    {
      label: "Total Sales",
      value: money(totalSales, currency),
      helper: `${orders.length} sales orders`,
      icon: "sale",
      className: "sales",
      trend: salesTrend,
    },
    {
      label: "Collected",
      value: money(totalCollected, currency),
      helper: `${invoicePayments.length} payments`,
      icon: "check",
      className: "collected",
      trend: monthlyData.map((item) => item.collected),
    },
    {
      label: "Receivables",
      value: money(invoiceReceivables, currency),
      helper: `${money(overdueReceivables, currency)} overdue`,
      icon: "invoice",
      className: "receivables",
      trend: [],
    },
    {
      label: "Customers",
      value: customers.length.toLocaleString(),
      helper: "Active customer records",
      icon: "customer",
      className: "customers",
      trend: [],
    },
  ];

  if (loading) {
    return (
      <AppShell>
        <main className="sbs-dashboard-page">
          <div className="sbs-dashboard-loading">
            <div className="sbs-dashboard-spinner" />
            <h2>Loading your business dashboard</h2>
            <p>
              Preparing your sales, invoices, customers and
              financial overview.
            </p>
          </div>

          <style jsx>{`
            .sbs-dashboard-page {
              min-height: 100vh;
              padding: 28px;
              background: #f7f8fa;
            }

            .sbs-dashboard-loading {
              min-height: 70vh;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
            }

            .sbs-dashboard-spinner {
              width: 38px;
              height: 38px;
              border: 3px solid #e5e7eb;
              border-top-color: #111827;
              border-radius: 50%;
              animation: dashboardSpin 0.8s linear infinite;
              margin-bottom: 20px;
            }

            h2 {
              margin: 0 0 8px;
              color: #111827;
              font-size: 21px;
              font-weight: 700;
            }

            p {
              margin: 0;
              color: #6b7280;
              font-size: 14px;
            }

            @keyframes dashboardSpin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="sbs-dashboard-page">
        <div className="sbs-dashboard-container">
          {errorMessage && (
            <div className="sbs-dashboard-error">
              <div className="sbs-dashboard-error-icon">
                <Icon name="warning" size={19} />
              </div>

              <div>
                <strong>Dashboard data could not be loaded</strong>
                <span>{errorMessage}</span>
              </div>

              <button
                type="button"
                onClick={() => loadDashboard(true)}
              >
                Try again
              </button>
            </div>
          )}

          <header className="sbs-dashboard-header">
            <div>
              <div className="sbs-dashboard-eyebrow">
                BUSINESS COMMAND CENTER
              </div>

              <h1>
                {greeting}, {displayName}.
              </h1>

              <p>
                Here&apos;s what&apos;s happening across{" "}
                <strong>
                  {company?.name || "your business"}
                </strong>{" "}
                today.
              </p>
            </div>

            <div className="sbs-dashboard-header-actions">
              <button
                type="button"
                className="sbs-dashboard-refresh"
                onClick={() => loadDashboard(true)}
                disabled={refreshing}
              >
                <Icon name="refresh" size={16} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <button
                type="button"
                className="sbs-dashboard-primary-action"
                onClick={() => router.push("/sales-orders/new")}
              >
                <Icon name="plus" size={17} />
                New Sale
              </button>
            </div>
          </header>

          <section className="sbs-dashboard-kpis">
            {statCards.map((card) => (
              <article
                key={card.label}
                className={`sbs-dashboard-kpi ${card.className}`}
              >
                <div className="sbs-dashboard-kpi-top">
                  <div className="sbs-dashboard-kpi-icon">
                    <Icon name={card.icon} size={18} />
                  </div>

                  {card.trend.length > 1 && (
                    <div className="sbs-dashboard-kpi-trend">
                      <MiniTrend values={card.trend} />
                    </div>
                  )}
                </div>

                <div className="sbs-dashboard-kpi-label">
                  {card.label}
                </div>

                <div className="sbs-dashboard-kpi-value">
                  {card.value}
                </div>

                <div className="sbs-dashboard-kpi-helper">
                  {card.helper}
                </div>
              </article>
            ))}
          </section>

          <section className="sbs-dashboard-main-grid">
            <article className="sbs-dashboard-card sbs-dashboard-sales-card">
              <div className="sbs-dashboard-card-header">
                <div>
                  <div className="sbs-dashboard-card-kicker">
                    PERFORMANCE
                  </div>
                  <h2>Sales & Collections</h2>
                  <p>
                    Six-month view of sales generated and money
                    collected.
                  </p>
                </div>

                <div className="sbs-dashboard-chart-legend">
                  <span>
                    <i className="legend-sales" />
                    Sales
                  </span>
                  <span>
                    <i className="legend-collected" />
                    Collected
                  </span>
                </div>
              </div>

              <div className="sbs-dashboard-bar-chart">
                <div className="sbs-dashboard-y-axis">
                  <span>{money(chartMax, currency)}</span>
                  <span>{money(chartMax * 0.75, currency)}</span>
                  <span>{money(chartMax * 0.5, currency)}</span>
                  <span>{money(chartMax * 0.25, currency)}</span>
                  <span>0</span>
                </div>

                <div className="sbs-dashboard-chart-area">
                  <div className="sbs-dashboard-grid-lines">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>

                  <div className="sbs-dashboard-bars">
                    {monthlyData.map((month) => {
                      const salesHeight =
                        chartMax > 0
                          ? Math.max(
                              (month.sales / chartMax) * 100,
                              month.sales > 0 ? 3 : 0
                            )
                          : 0;

                      const collectedHeight =
                        chartMax > 0
                          ? Math.max(
                              (month.collected / chartMax) *
                                100,
                              month.collected > 0 ? 3 : 0
                            )
                          : 0;

                      return (
                        <div
                          className="sbs-dashboard-month"
                          key={month.label}
                        >
                          <div className="sbs-dashboard-bar-group">
                            <div
                              className="sbs-dashboard-bar sales-bar"
                              style={{
                                height: `${salesHeight}%`,
                              }}
                              title={`Sales: ${money(
                                month.sales,
                                currency
                              )}`}
                            />

                            <div
                              className="sbs-dashboard-bar collected-bar"
                              style={{
                                height: `${collectedHeight}%`,
                              }}
                              title={`Collected: ${money(
                                month.collected,
                                currency
                              )}`}
                            />
                          </div>

                          <span>{month.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>

            <article className="sbs-dashboard-card sbs-dashboard-health-card">
              <div className="sbs-dashboard-card-header">
                <div>
                  <div className="sbs-dashboard-card-kicker">
                    RECEIVABLES
                  </div>
                  <h2>Invoice Health</h2>
                  <p>
                    Current payment position across invoices.
                  </p>
                </div>
              </div>

              <div className="sbs-dashboard-health-content">
                <DonutChart
                  paid={invoiceHealth.paid}
                  partial={invoiceHealth.partial}
                  outstanding={invoiceHealth.outstanding}
                  overdue={invoiceHealth.overdue}
                />

                <div className="sbs-dashboard-health-list">
                  <div>
                    <span>
                      <i className="health-dot paid-dot" />
                      Paid
                    </span>
                    <strong>{invoiceHealth.paid}</strong>
                  </div>

                  <div>
                    <span>
                      <i className="health-dot partial-dot" />
                      Partial
                    </span>
                    <strong>{invoiceHealth.partial}</strong>
                  </div>

                  <div>
                    <span>
                      <i className="health-dot outstanding-dot" />
                      Outstanding
                    </span>
                    <strong>
                      {invoiceHealth.outstanding}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <i className="health-dot overdue-dot" />
                      Overdue
                    </span>
                    <strong>{invoiceHealth.overdue}</strong>
                  </div>
                </div>
              </div>

              <div className="sbs-dashboard-health-footer">
                <span>Outstanding balance</span>
                <strong>
                  {money(invoiceReceivables, currency)}
                </strong>
              </div>
            </article>
          </section>

          <section className="sbs-dashboard-lower-grid">
            <article className="sbs-dashboard-card sbs-dashboard-funnel-card">
              <div className="sbs-dashboard-card-header">
                <div>
                  <div className="sbs-dashboard-card-kicker">
                    BUSINESS FLOW
                  </div>
                  <h2>Sales Funnel</h2>
                  <p>
                    Track how opportunities move through your
                    business.
                  </p>
                </div>

                <button
                  type="button"
                  className="sbs-dashboard-view-button"
                  onClick={() => router.push("/reports-analytics")}
                >
                  View reports
                  <Icon name="arrow" size={15} />
                </button>
              </div>

              <div className="sbs-dashboard-funnel">
                <div className="sbs-funnel-stage">
                  <div className="sbs-funnel-number">
                    {funnel.estimates}
                  </div>
                  <div>
                    <strong>Estimates</strong>
                    <span>Opportunities quoted</span>
                  </div>
                </div>

                <div className="sbs-funnel-arrow">
                  <Icon name="arrow" size={16} />
                </div>

                <div className="sbs-funnel-stage">
                  <div className="sbs-funnel-number">
                    {funnel.orders}
                  </div>
                  <div>
                    <strong>Sales Orders</strong>
                    <span>Orders generated</span>
                  </div>
                </div>

                <div className="sbs-funnel-arrow">
                  <Icon name="arrow" size={16} />
                </div>

                <div className="sbs-funnel-stage">
                  <div className="sbs-funnel-number">
                    {funnel.invoices}
                  </div>
                  <div>
                    <strong>Invoices</strong>
                    <span>Billing created</span>
                  </div>
                </div>

                <div className="sbs-funnel-arrow">
                  <Icon name="arrow" size={16} />
                </div>

                <div className="sbs-funnel-stage funnel-money">
                  <div className="sbs-funnel-money">
                    {money(funnel.collected, currency)}
                  </div>
                  <div>
                    <strong>Collected</strong>
                    <span>Actual cash received</span>
                  </div>
                </div>
              </div>
            </article>

            <article className="sbs-dashboard-card sbs-dashboard-snapshot-card">
              <div className="sbs-dashboard-card-header">
                <div>
                  <div className="sbs-dashboard-card-kicker">
                    AT A GLANCE
                  </div>
                  <h2>Business Snapshot</h2>
                  <p>Important numbers from your workspace.</p>
                </div>
              </div>

              <div className="sbs-dashboard-snapshot-list">
                <div>
                  <span>
                    <Icon name="customer" size={16} />
                    Customers
                  </span>
                  <strong>{customers.length}</strong>
                </div>

                <div>
                  <span>
                    <Icon name="sale" size={16} />
                    Sales Orders
                  </span>
                  <strong>{orders.length}</strong>
                </div>

                <div>
                  <span>
                    <Icon name="invoice" size={16} />
                    Invoices
                  </span>
                  <strong>{invoices.length}</strong>
                </div>

                <div>
                  <span>
                    <Icon name="clock" size={16} />
                    Overdue
                  </span>
                  <strong>
                    {money(overdueReceivables, currency)}
                  </strong>
                </div>
              </div>
            </article>
          </section>

          <section className="sbs-dashboard-quick-section">
            <div className="sbs-dashboard-section-heading">
              <div>
                <div className="sbs-dashboard-card-kicker">
                  SHORTCUTS
                </div>
                <h2>Quick Actions</h2>
                <p>
                  Jump directly into the most common business
                  tasks.
                </p>
              </div>
            </div>

            <div className="sbs-dashboard-quick-grid">
              <button
                type="button"
                onClick={() => router.push("/sales-orders/new")}
              >
                <span className="quick-icon">
                  <Icon name="sale" size={18} />
                </span>
                <span>
                  <strong>New Sale</strong>
                  <small>Create a sales order</small>
                </span>
                <Icon name="arrow" size={16} />
              </button>

              <button
                type="button"
                onClick={() => router.push("/invoices/new")}
              >
                <span className="quick-icon">
                  <Icon name="invoice" size={18} />
                </span>
                <span>
                  <strong>New Invoice</strong>
                  <small>Bill a customer</small>
                </span>
                <Icon name="arrow" size={16} />
              </button>

              <button
                type="button"
                onClick={() => router.push("/customers/new")}
              >
                <span className="quick-icon">
                  <Icon name="customer" size={18} />
                </span>
                <span>
                  <strong>New Customer</strong>
                  <small>Add a customer record</small>
                </span>
                <Icon name="arrow" size={16} />
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push("/purchase-orders/new")
                }
              >
                <span className="quick-icon">
                  <Icon name="purchase" size={18} />
                </span>
                <span>
                  <strong>Purchase Order</strong>
                  <small>Order from a supplier</small>
                </span>
                <Icon name="arrow" size={16} />
              </button>

              <button
                type="button"
                onClick={() => router.push("/expenses/new")}
              >
                <span className="quick-icon">
                  <Icon name="expense" size={18} />
                </span>
                <span>
                  <strong>Add Expense</strong>
                  <small>Record business spending</small>
                </span>
                <Icon name="arrow" size={16} />
              </button>

              <button
                type="button"
                onClick={() => router.push("/inventory")}
              >
                <span className="quick-icon">
                  <Icon name="inventory" size={18} />
                </span>
                <span>
                  <strong>Inventory</strong>
                  <small>Manage stock & assets</small>
                </span>
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </section>

          <section className="sbs-dashboard-bottom-grid">
            <article className="sbs-dashboard-card sbs-dashboard-activity-card">
              <div className="sbs-dashboard-card-header">
                <div>
                  <div className="sbs-dashboard-card-kicker">
                    LIVE ACTIVITY
                  </div>
                  <h2>Recent Business Activity</h2>
                  <p>
                    The latest records created in your workspace.
                  </p>
                </div>
              </div>

              {activities.length === 0 ? (
                <div className="sbs-dashboard-empty">
                  <div>
                    <Icon name="chart" size={22} />
                  </div>
                  <strong>No business activity yet</strong>
                  <span>
                    New sales, invoices and customers will appear
                    here.
                  </span>
                </div>
              ) : (
                <div className="sbs-dashboard-activity-list">
                  {activities.map((activity) => (
                    <div
                      className="sbs-dashboard-activity"
                      key={activity.id}
                    >
                      <div
                        className={`activity-icon ${activity.type}`}
                      >
                        <Icon
                          name={
                            activity.type === "sale"
                              ? "sale"
                              : activity.type === "invoice"
                              ? "invoice"
                              : "customer"
                          }
                          size={16}
                        />
                      </div>

                      <div className="activity-content">
                        <strong>{activity.title}</strong>
                        <span>{activity.subtitle}</span>
                      </div>

                      <div className="activity-right">
                        {activity.amount !== undefined && (
                          <strong>
                            {money(
                              activity.amount,
                              currency
                            )}
                          </strong>
                        )}
                        <span>{shortDate(activity.date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="sbs-dashboard-card sbs-dashboard-customers-card">
              <div className="sbs-dashboard-card-header">
                <div>
                  <div className="sbs-dashboard-card-kicker">
                    CUSTOMER BASE
                  </div>
                  <h2>Recent Customers</h2>
                  <p>Your newest customer records.</p>
                </div>

                <button
                  type="button"
                  className="sbs-dashboard-view-button"
                  onClick={() => router.push("/customers")}
                >
                  View all
                  <Icon name="arrow" size={15} />
                </button>
              </div>

              {recentCustomers.length === 0 ? (
                <div className="sbs-dashboard-empty">
                  <div>
                    <Icon name="customer" size={22} />
                  </div>
                  <strong>No customers yet</strong>
                  <span>
                    Add your first customer to get started.
                  </span>
                </div>
              ) : (
                <div className="sbs-dashboard-customer-list">
                  {recentCustomers.map((customer) => (
                    <button
                      type="button"
                      key={customer.id}
                      onClick={() =>
                        router.push(
                          `/customers/${customer.id}`
                        )
                      }
                    >
                      <span className="customer-avatar">
                        {getInitials(customer.name)}
                      </span>

                      <span className="customer-info">
                        <strong>
                          {customer.name || "Unnamed customer"}
                        </strong>
                        <small>
                          {customer.email || "No email address"}
                        </small>
                      </span>

                      <span className="customer-date">
                        {shortDate(customer.created_at)}
                      </span>

                      <Icon name="arrow" size={15} />
                    </button>
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className="sbs-dashboard-invoices-card sbs-dashboard-card">
            <div className="sbs-dashboard-card-header">
              <div>
                <div className="sbs-dashboard-card-kicker">
                  BILLING
                </div>
                <h2>Recent Invoices</h2>
                <p>
                  Keep an eye on your latest billing activity.
                </p>
              </div>

              <button
                type="button"
                className="sbs-dashboard-view-button"
                onClick={() => router.push("/invoices")}
              >
                View invoices
                <Icon name="arrow" size={15} />
              </button>
            </div>

            {recentInvoices.length === 0 ? (
              <div className="sbs-dashboard-empty">
                <div>
                  <Icon name="invoice" size={22} />
                </div>
                <strong>No invoices yet</strong>
                <span>
                  Your latest invoices will appear here.
                </span>
              </div>
            ) : (
              <div className="sbs-dashboard-invoice-table-wrap">
                <table className="sbs-dashboard-invoice-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th className="align-right">Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentInvoices.map((invoice) => {
                      const customer = customers.find(
                        (item) =>
                          item.id === invoice.customer_id
                      );

                      const status = normalizeStatus(
                        invoice.status
                      );

                      const total = Number(
                        invoice.total || 0
                      );

                      const paid = Number(
                        invoice.amount_paid || 0
                      );

                      const remaining = Math.max(
                        total - paid,
                        0
                      );

                      let displayStatus = "Outstanding";

                      if (
                        total > 0 &&
                        paid >= total
                      ) {
                        displayStatus = "Paid";
                      } else if (paid > 0) {
                        displayStatus = "Partial";
                      } else if (
                        invoice.due_date &&
                        remaining > 0
                      ) {
                        const due = new Date(
                          invoice.due_date
                        );
                        const today = new Date();

                        due.setHours(0, 0, 0, 0);
                        today.setHours(0, 0, 0, 0);

                        if (due < today) {
                          displayStatus = "Overdue";
                        }
                      }

                      if (
                        ["cancelled", "canceled", "void"].includes(
                          status
                        )
                      ) {
                        displayStatus = "Cancelled";
                      }

                      const statusClass = displayStatus
                        .toLowerCase()
                        .replace(/\s+/g, "-");

                      return (
                        <tr key={invoice.id}>
                          <td>
                            <button
                              type="button"
                              className="invoice-link"
                              onClick={() =>
                                router.push(
                                  `/invoices/${invoice.id}`
                                )
                              }
                            >
                              {invoice.invoice_number ||
                                "Invoice"}
                            </button>
                          </td>

                          <td>
                            {customer?.name ||
                              "Unknown customer"}
                          </td>

                          <td>
                            {formatDate(invoice.created_at)}
                          </td>

                          <td>
                            <span
                              className={`invoice-status ${statusClass}`}
                            >
                              <i />
                              {displayStatus}
                            </span>
                          </td>

                          <td className="align-right">
                            <strong>
                              {money(total, currency)}
                            </strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="sbs-dashboard-footer">
            <span>
              Sharif Business Management Platform
            </span>

            <span>
              by Sharif Business Solutions
            </span>
          </footer>
        </div>

        <style jsx>{`
          .sbs-dashboard-page {
            min-height: 100vh;
            padding: 28px;
            background: #f7f8fa;
          }

          .sbs-dashboard-container {
            max-width: 1600px;
            margin: 0 auto;
          }

          .sbs-dashboard-error {
            display: flex;
            align-items: center;
            gap: 13px;
            padding: 14px 16px;
            margin-bottom: 20px;
            background: #fff;
            border: 1px solid #fecaca;
            border-radius: 12px;
            color: #991b1b;
          }

          .sbs-dashboard-error-icon {
            width: 34px;
            height: 34px;
            flex: 0 0 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 9px;
            background: #fef2f2;
          }

          .sbs-dashboard-error > div:nth-child(2) {
            min-width: 0;
            flex: 1;
          }

          .sbs-dashboard-error strong,
          .sbs-dashboard-error span {
            display: block;
          }

          .sbs-dashboard-error strong {
            font-size: 13px;
            margin-bottom: 2px;
          }

          .sbs-dashboard-error span {
            font-size: 12px;
            color: #7f1d1d;
          }

          .sbs-dashboard-error button {
            border: 0;
            background: #111827;
            color: white;
            padding: 9px 13px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          }

          .sbs-dashboard-header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 24px;
          }

          .sbs-dashboard-eyebrow,
          .sbs-dashboard-card-kicker {
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.13em;
            color: #8b93a1;
          }

          .sbs-dashboard-eyebrow {
            margin-bottom: 8px;
          }

          .sbs-dashboard-header h1 {
            margin: 0;
            color: #111827;
            font-size: 30px;
            line-height: 1.15;
            letter-spacing: -0.035em;
            font-weight: 750;
          }

          .sbs-dashboard-header p {
            margin: 8px 0 0;
            color: #6b7280;
            font-size: 14px;
          }

          .sbs-dashboard-header p strong {
            color: #374151;
            font-weight: 650;
          }

          .sbs-dashboard-header-actions {
            display: flex;
            gap: 9px;
            flex-shrink: 0;
          }

          .sbs-dashboard-refresh,
          .sbs-dashboard-primary-action {
            height: 40px;
            padding: 0 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-radius: 9px;
            font-size: 12px;
            font-weight: 650;
            cursor: pointer;
            transition: 0.18s ease;
          }

          .sbs-dashboard-refresh {
            color: #374151;
            background: white;
            border: 1px solid #e5e7eb;
          }

          .sbs-dashboard-refresh:hover {
            border-color: #d1d5db;
            background: #fafafa;
          }

          .sbs-dashboard-refresh:disabled {
            opacity: 0.6;
            cursor: wait;
          }

          .sbs-dashboard-primary-action {
            color: white;
            background: #111827;
            border: 1px solid #111827;
            box-shadow: 0 2px 5px rgba(17, 24, 39, 0.12);
          }

          .sbs-dashboard-primary-action:hover {
            background: #1f2937;
          }

          .sbs-dashboard-kpis {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 16px;
          }

          .sbs-dashboard-kpi {
            position: relative;
            min-height: 166px;
            padding: 20px;
            overflow: hidden;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            box-shadow: 0 2px 7px rgba(17, 24, 39, 0.025);
          }

          .sbs-dashboard-kpi-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            height: 34px;
          }

          .sbs-dashboard-kpi-icon {
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 9px;
            background: #f3f4f6;
            color: #374151;
          }

          .sbs-dashboard-kpi-trend {
            width: 74px;
            height: 30px;
            opacity: 0.55;
          }

          .sbs-mini-trend {
            width: 100%;
            height: 100%;
            color: #6b7280;
          }

          .sbs-dashboard-kpi-label {
            margin-top: 17px;
            color: #6b7280;
            font-size: 12px;
            font-weight: 600;
          }

          .sbs-dashboard-kpi-value {
            margin-top: 4px;
            color: #111827;
            font-size: 25px;
            line-height: 1.2;
            font-weight: 750;
            letter-spacing: -0.025em;
          }

          .sbs-dashboard-kpi-helper {
            margin-top: 7px;
            color: #9ca3af;
            font-size: 11px;
          }

          .sbs-dashboard-kpi.sales {
            border-top: 2px solid #111827;
          }

          .sbs-dashboard-kpi.collected {
            border-top: 2px solid #475569;
          }

          .sbs-dashboard-kpi.receivables {
            border-top: 2px solid #64748b;
          }

          .sbs-dashboard-kpi.customers {
            border-top: 2px solid #94a3b8;
          }

          .sbs-dashboard-main-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.75fr) minmax(340px, 0.9fr);
            gap: 16px;
            margin-bottom: 16px;
          }

          .sbs-dashboard-lower-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.65fr) minmax(320px, 0.8fr);
            gap: 16px;
            margin-bottom: 16px;
          }

          .sbs-dashboard-bottom-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.25fr) minmax(360px, 0.75fr);
            gap: 16px;
            margin-bottom: 16px;
          }

          .sbs-dashboard-card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            box-shadow: 0 2px 7px rgba(17, 24, 39, 0.025);
            overflow: hidden;
          }

          .sbs-dashboard-sales-card,
          .sbs-dashboard-health-card,
          .sbs-dashboard-funnel-card,
          .sbs-dashboard-snapshot-card,
          .sbs-dashboard-activity-card,
          .sbs-dashboard-customers-card,
          .sbs-dashboard-invoices-card {
            padding: 21px;
          }

          .sbs-dashboard-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .sbs-dashboard-card-kicker {
            margin-bottom: 6px;
          }

          .sbs-dashboard-card-header h2 {
            margin: 0;
            color: #111827;
            font-size: 16px;
            line-height: 1.3;
            font-weight: 720;
            letter-spacing: -0.015em;
          }

          .sbs-dashboard-card-header p {
            margin: 5px 0 0;
            color: #8a929f;
            font-size: 11px;
            line-height: 1.45;
          }

          .sbs-dashboard-chart-legend {
            display: flex;
            align-items: center;
            gap: 14px;
            padding-top: 5px;
          }

          .sbs-dashboard-chart-legend span {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #6b7280;
            font-size: 11px;
            font-weight: 550;
          }

          .sbs-dashboard-chart-legend i {
            width: 7px;
            height: 7px;
            border-radius: 50%;
          }

          .legend-sales {
            background: #111827;
          }

          .legend-collected {
            background: #94a3b8;
          }

          .sbs-dashboard-bar-chart {
            height: 285px;
            display: grid;
            grid-template-columns: 70px minmax(0, 1fr);
            margin-top: 24px;
          }

          .sbs-dashboard-y-axis {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 0 12px 25px 0;
            color: #a1a8b2;
            font-size: 9px;
            text-align: right;
          }

          .sbs-dashboard-chart-area {
            position: relative;
            min-width: 0;
            padding-bottom: 25px;
          }

          .sbs-dashboard-grid-lines {
            position: absolute;
            inset: 0 0 25px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          .sbs-dashboard-grid-lines span {
            width: 100%;
            border-top: 1px dashed #edf0f3;
          }

          .sbs-dashboard-bars {
            position: relative;
            height: 100%;
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            align-items: end;
            gap: 13px;
          }

          .sbs-dashboard-month {
            position: relative;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            align-items: center;
            z-index: 2;
          }

          .sbs-dashboard-month > span {
            position: absolute;
            bottom: 0;
            color: #8d95a1;
            font-size: 10px;
          }

          .sbs-dashboard-bar-group {
            width: 62%;
            height: calc(100% - 25px);
            display: flex;
            align-items: flex-end;
            justify-content: center;
            gap: 4px;
          }

          .sbs-dashboard-bar {
            width: 15px;
            min-height: 0;
            border-radius: 4px 4px 2px 2px;
            transition: height 0.35s ease;
          }

          .sales-bar {
            background: #111827;
          }

          .collected-bar {
            background: #a8b1bd;
          }

          .sbs-donut-wrap {
            position: relative;
            width: 175px;
            height: 175px;
            flex: 0 0 175px;
          }

          .sbs-donut {
            width: 100%;
            height: 100%;
            transform: rotate(-90deg);
          }

          .donut-paid {
            color: #111827;
          }

          .donut-partial {
            color: #64748b;
          }

          .donut-outstanding {
            color: #a8b1bd;
          }

          .donut-overdue {
            color: #d1d5db;
          }

          .sbs-donut-center {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            pointer-events: none;
          }

          .sbs-donut-center strong {
            color: #111827;
            font-size: 26px;
            line-height: 1;
            font-weight: 750;
          }

          .sbs-donut-center span {
            margin-top: 5px;
            color: #9ca3af;
            font-size: 10px;
          }

          .sbs-dashboard-health-content {
            min-height: 220px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 22px;
            padding: 15px 0 10px;
          }

          .sbs-dashboard-health-list {
            flex: 1;
            min-width: 130px;
          }

          .sbs-dashboard-health-list > div {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 9px 0;
            border-bottom: 1px solid #f0f1f3;
          }

          .sbs-dashboard-health-list > div:last-child {
            border-bottom: 0;
          }

          .sbs-dashboard-health-list span {
            display: flex;
            align-items: center;
            gap: 7px;
            color: #6b7280;
            font-size: 11px;
          }

          .sbs-dashboard-health-list strong {
            color: #111827;
            font-size: 12px;
          }

          .health-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
          }

          .paid-dot {
            background: #111827;
          }

          .partial-dot {
            background: #64748b;
          }

          .outstanding-dot {
            background: #a8b1bd;
          }

          .overdue-dot {
            background: #d1d5db;
          }

          .sbs-dashboard-health-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 13px 14px;
            background: #f8f9fa;
            border-radius: 10px;
          }

          .sbs-dashboard-health-footer span {
            color: #7b8490;
            font-size: 11px;
          }

          .sbs-dashboard-health-footer strong {
            color: #111827;
            font-size: 14px;
          }

          .sbs-dashboard-view-button {
            border: 0;
            padding: 0;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            color: #4b5563;
            background: transparent;
            font-size: 11px;
            font-weight: 650;
            cursor: pointer;
            white-space: nowrap;
          }

          .sbs-dashboard-view-button:hover {
            color: #111827;
          }

          .sbs-dashboard-funnel {
            display: grid;
            grid-template-columns: 1fr auto 1fr auto 1fr auto 1.1fr;
            align-items: center;
            gap: 10px;
            margin-top: 25px;
          }

          .sbs-funnel-stage {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 11px;
            padding: 13px;
            border: 1px solid #eef0f2;
            border-radius: 11px;
            background: #fafbfc;
          }

          .sbs-funnel-number {
            min-width: 39px;
            height: 39px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 9px;
            background: #111827;
            color: white;
            font-size: 14px;
            font-weight: 700;
          }

          .sbs-funnel-stage strong,
          .sbs-funnel-stage span {
            display: block;
          }

          .sbs-funnel-stage strong {
            color: #1f2937;
            font-size: 11px;
            font-weight: 700;
          }

          .sbs-funnel-stage span {
            margin-top: 3px;
            color: #9ca3af;
            font-size: 9px;
          }

          .sbs-funnel-arrow {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #b4bac2;
          }

          .sbs-funnel-money {
            color: #111827;
            font-size: 16px;
            font-weight: 750;
          }

          .sbs-dashboard-snapshot-list {
            margin-top: 18px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .sbs-dashboard-snapshot-list > div {
            padding: 12px;
            border: 1px solid #eef0f2;
            border-radius: 10px;
            background: #fafbfc;
          }

          .sbs-dashboard-snapshot-list span {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #7b8490;
            font-size: 10px;
          }

          .sbs-dashboard-snapshot-list strong {
            display: block;
            margin-top: 7px;
            color: #111827;
            font-size: 15px;
            font-weight: 730;
          }

          .sbs-dashboard-quick-section {
            margin-bottom: 16px;
          }

          .sbs-dashboard-section-heading {
            margin-bottom: 12px;
          }

          .sbs-dashboard-section-heading h2 {
            margin: 5px 0 0;
            color: #111827;
            font-size: 16px;
            font-weight: 720;
          }

          .sbs-dashboard-section-heading p {
            margin: 4px 0 0;
            color: #8a929f;
            font-size: 11px;
          }

          .sbs-dashboard-quick-grid {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 10px;
          }

          .sbs-dashboard-quick-grid button {
            min-width: 0;
            min-height: 82px;
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            align-items: center;
            gap: 10px;
            padding: 13px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: white;
            text-align: left;
            cursor: pointer;
            transition: 0.18s ease;
          }

          .sbs-dashboard-quick-grid button:hover {
            border-color: #d1d5db;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(17, 24, 39, 0.05);
          }

          .quick-icon {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #374151;
            background: #f3f4f6;
            border-radius: 8px;
          }

          .sbs-dashboard-quick-grid button > span:nth-child(2) {
            min-width: 0;
          }

          .sbs-dashboard-quick-grid strong,
          .sbs-dashboard-quick-grid small {
            display: block;
          }

          .sbs-dashboard-quick-grid strong {
            overflow: hidden;
            color: #1f2937;
            font-size: 11px;
            font-weight: 700;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .sbs-dashboard-quick-grid small {
            margin-top: 3px;
            overflow: hidden;
            color: #9ca3af;
            font-size: 9px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .sbs-dashboard-quick-grid button > svg {
            color: #b1b7c0;
          }

          .sbs-dashboard-activity-list,
          .sbs-dashboard-customer-list {
            margin-top: 17px;
          }

          .sbs-dashboard-activity {
            min-height: 57px;
            display: flex;
            align-items: center;
            gap: 11px;
            border-bottom: 1px solid #f0f1f3;
          }

          .sbs-dashboard-activity:last-child {
            border-bottom: 0;
          }

          .activity-icon {
            width: 31px;
            height: 31px;
            flex: 0 0 31px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            background: #f3f4f6;
            color: #4b5563;
          }

          .activity-content {
            min-width: 0;
            flex: 1;
          }

          .activity-content strong,
          .activity-content span {
            display: block;
          }

          .activity-content strong {
            overflow: hidden;
            color: #1f2937;
            font-size: 11px;
            font-weight: 680;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .activity-content span {
            margin-top: 3px;
            color: #9ca3af;
            font-size: 9px;
          }

          .activity-right {
            text-align: right;
          }

          .activity-right strong,
          .activity-right span {
            display: block;
          }

          .activity-right strong {
            color: #374151;
            font-size: 10px;
            font-weight: 700;
          }

          .activity-right span {
            margin-top: 3px;
            color: #a0a6af;
            font-size: 9px;
          }

          .sbs-dashboard-customer-list button {
            width: 100%;
            min-height: 57px;
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto auto;
            align-items: center;
            gap: 10px;
            padding: 0;
            border: 0;
            border-bottom: 1px solid #f0f1f3;
            background: transparent;
            text-align: left;
            cursor: pointer;
          }

          .sbs-dashboard-customer-list button:last-child {
            border-bottom: 0;
          }

          .sbs-dashboard-customer-list button:hover .customer-info strong {
            color: #111827;
          }

          .customer-avatar {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 9px;
            background: #eef0f2;
            color: #4b5563;
            font-size: 10px;
            font-weight: 750;
          }

          .customer-info {
            min-width: 0;
          }

          .customer-info strong,
          .customer-info small {
            display: block;
          }

          .customer-info strong {
            overflow: hidden;
            color: #374151;
            font-size: 11px;
            font-weight: 680;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .customer-info small {
            margin-top: 3px;
            overflow: hidden;
            color: #9ca3af;
            font-size: 9px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .customer-date {
            color: #a0a6af;
            font-size: 9px;
            white-space: nowrap;
          }

          .sbs-dashboard-customer-list button > svg {
            color: #c0c5cc;
          }

          .sbs-dashboard-empty {
            min-height: 190px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .sbs-dashboard-empty > div {
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
            border-radius: 11px;
            background: #f3f4f6;
            color: #6b7280;
          }

          .sbs-dashboard-empty strong {
            color: #374151;
            font-size: 12px;
          }

          .sbs-dashboard-empty span {
            max-width: 260px;
            margin-top: 5px;
            color: #9ca3af;
            font-size: 10px;
            line-height: 1.5;
          }

          .sbs-dashboard-invoice-table-wrap {
            overflow-x: auto;
            margin-top: 16px;
          }

          .sbs-dashboard-invoice-table {
            width: 100%;
            min-width: 650px;
            border-collapse: collapse;
          }

          .sbs-dashboard-invoice-table th {
            padding: 10px 8px;
            border-bottom: 1px solid #e5e7eb;
            color: #9ca3af;
            font-size: 9px;
            font-weight: 750;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            text-align: left;
          }

          .sbs-dashboard-invoice-table td {
            padding: 13px 8px;
            border-bottom: 1px solid #f0f1f3;
            color: #6b7280;
            font-size: 11px;
          }

          .sbs-dashboard-invoice-table tbody tr:last-child td {
            border-bottom: 0;
          }

          .sbs-dashboard-invoice-table td strong {
            color: #374151;
            font-size: 11px;
            font-weight: 700;
          }

          .invoice-link {
            padding: 0;
            border: 0;
            background: transparent;
            color: #111827;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
          }

          .invoice-link:hover {
            text-decoration: underline;
          }

          .align-right {
            text-align: right !important;
          }

          .invoice-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 8px;
            border-radius: 999px;
            background: #f3f4f6;
            color: #6b7280;
            font-size: 9px;
            font-weight: 650;
          }

          .invoice-status i {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: #9ca3af;
          }

          .invoice-status.paid {
            background: #f0fdf4;
            color: #166534;
          }

          .invoice-status.paid i {
            background: #22c55e;
          }

          .invoice-status.partial {
            background: #f8fafc;
            color: #475569;
          }

          .invoice-status.partial i {
            background: #64748b;
          }

          .invoice-status.overdue {
            background: #fff7ed;
            color: #9a3412;
          }

          .invoice-status.overdue i {
            background: #f97316;
          }

          .invoice-status.outstanding {
            background: #f9fafb;
            color: #4b5563;
          }

          .invoice-status.outstanding i {
            background: #9ca3af;
          }

          .invoice-status.cancelled {
            background: #fef2f2;
            color: #991b1b;
          }

          .invoice-status.cancelled i {
            background: #ef4444;
          }

          .sbs-dashboard-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 7px 2px 20px;
            color: #a0a6af;
            font-size: 9px;
          }

          @media (max-width: 1250px) {
            .sbs-dashboard-quick-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .sbs-dashboard-funnel {
              grid-template-columns: 1fr auto 1fr;
            }

            .sbs-funnel-stage:nth-of-type(4),
            .sbs-funnel-arrow:nth-of-type(4) {
              display: none;
            }
          }

          @media (max-width: 1050px) {
            .sbs-dashboard-main-grid,
            .sbs-dashboard-lower-grid,
            .sbs-dashboard-bottom-grid {
              grid-template-columns: 1fr;
            }

            .sbs-dashboard-kpis {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .sbs-dashboard-funnel {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .sbs-funnel-arrow {
              display: none;
            }
          }

          @media (max-width: 700px) {
            .sbs-dashboard-page {
              padding: 18px 14px;
            }

            .sbs-dashboard-header {
              align-items: flex-start;
              flex-direction: column;
            }

            .sbs-dashboard-header h1 {
              font-size: 25px;
            }

            .sbs-dashboard-header-actions {
              width: 100%;
            }

            .sbs-dashboard-refresh,
            .sbs-dashboard-primary-action {
              flex: 1;
            }

            .sbs-dashboard-kpis {
              grid-template-columns: 1fr;
            }

            .sbs-dashboard-bar-chart {
              height: 240px;
              grid-template-columns: 55px minmax(0, 1fr);
            }

            .sbs-dashboard-chart-legend {
              display: none;
            }

            .sbs-dashboard-health-content {
              flex-direction: column;
              padding-top: 22px;
            }

            .sbs-dashboard-health-list {
              width: 100%;
            }

            .sbs-dashboard-funnel {
              grid-template-columns: 1fr;
            }

            .sbs-dashboard-quick-grid {
              grid-template-columns: 1fr;
            }

            .sbs-dashboard-footer {
              flex-direction: column;
              align-items: flex-start;
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}