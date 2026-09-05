"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
};

type Estimate = {
  id: string;
  estimate_number: string | null;
  customer_id: string | null;
  status: string | null;
  total: number | null;
  created_at: string;
};

type Invoice = {
  id: string;
  invoice_number: string | null;
  customer_id: string | null;
  status: string | null;
  total: number | null;
  amount_paid: number | null;
  due_date: string | null;
  created_at: string;
};

type Order = {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  status: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  total_amount: number | null;
  created_at: string;
};

type InvoicePayment = {
  id: string;
  invoice_id: string;
  customer_id: string | null;
  amount: number | null;
  currency: string | null;
  payment_method: string | null;
  reference: string | null;
  paid_at: string;
};

type Company = {
  id: string;
  name: string;
  currency: string | null;
};

type Profile = {
  full_name?: string | null;
  name?: string | null;
};

type Module = {
  name: string;
  description: string;
  href: string;
  icon: string;
  count?: number | null;
  status?: string;
};

function Icon({
  name,
  size = 20,
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
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );

    case "crm":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <path d="M16 5.5a3 3 0 0 1 0 5.8" />
          <path d="M18 14.5c1.8.8 3 2.7 3 5" />
        </svg>
      );

    case "leads":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 21a7 7 0 0 1 14 0" />
          <path d="M19 8h3" />
          <path d="M20.5 6.5 22 8l-1.5 1.5" />
        </svg>
      );

    case "customers":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <path d="M16 11h5" />
          <path d="M18.5 8.5v5" />
        </svg>
      );

    case "jobs":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <path d="M8 6V4h8v2" />
          <path d="M3 11h18" />
          <path d="M10 15h4" />
        </svg>
      );

    case "estimates":
      return (
        <svg {...common}>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h6" />
        </svg>
      );

    case "invoices":
      return (
        <svg {...common}>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
          <path d="M9 16h3" />
        </svg>
      );

    case "inventory":
      return (
        <svg {...common}>
          <path d="m12 3 8 4-8 4-8-4z" />
          <path d="m4 12 8 4 8-4" />
          <path d="m4 17 8 4 8-4" />
        </svg>
      );

    case "employees":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 21a7 7 0 0 1 14 0" />
          <path d="M4 4h4" />
          <path d="M6 2v4" />
        </svg>
      );

    case "reports":
      return (
        <svg {...common}>
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M22 20H2" />
        </svg>
      );

    case "payments":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h4" />
        </svg>
      );

    case "documents":
      return (
        <svg {...common}>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      );

    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20h-3v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1A1.7 1.7 0 0 0 7.2 15a1.7 1.7 0 0 0-1.5-1H5v-3h.7a1.7 1.7 0 0 0 1.5-1A1.7 1.7 0 0 0 6.9 8l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V5h3v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v3h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.9-4" />
          <path d="M4 4v4h4" />
          <path d="M4 13a8 8 0 0 0 14.9 4" />
          <path d="M20 20v-4h-4" />
        </svg>
      );

    case "money":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M7 9h.01" />
          <path d="M17 15h.01" />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "trend":
      return (
        <svg {...common}>
          <path d="m4 16 5-5 4 3 7-8" />
          <path d="M15 6h5v5" />
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

function formatMoney(
  value: number,
  currency: string | null | undefined
) {
  const safeCurrency = currency || "USD";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${safeCurrency} ${value.toFixed(2)}`;
  }
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function getStatusClass(status: string | null | undefined) {
  const value = (status || "").toLowerCase();

  if (
    value === "paid" ||
    value === "completed" ||
    value === "accepted"
  ) {
    return "status status-paid";
  }

  if (
    value === "partially_paid" ||
    value === "partial" ||
    value === "pending"
  ) {
    return "status status-partial";
  }

  if (
    value === "overdue" ||
    value === "cancelled" ||
    value === "void"
  ) {
    return "status status-danger";
  }

  if (
    value === "sent" ||
    value === "confirmed" ||
    value === "processing"
  ) {
    return "status status-info";
  }

  return "status status-neutral";
}

function readableStatus(status: string | null | undefined) {
  if (!status) return "Pending";

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DashboardPage() {
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [company, setCompany] = useState<Company | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoicePayments, setInvoicePayments] = useState<
    InvoicePayment[]
  >([]);

  const [currentTime, setCurrentTime] = useState(Date.now());

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      try {
        setError("");

        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        /*
         * ----------------------------------------------------------
         * AUTHENTICATION
         * ----------------------------------------------------------
         */

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw new Error(authError.message);
        }

        if (!user) {
          router.push("/login");
          return;
        }

        /*
         * ----------------------------------------------------------
         * COMPANY MEMBERSHIP
         * ----------------------------------------------------------
         */

        const {
          data: membership,
          error: membershipError,
        } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw new Error(
            `Membership error: ${membershipError.message}`
          );
        }

        if (!membership?.company_id) {
          throw new Error(
            "Your account is not assigned to a company yet."
          );
        }

        const companyId = membership.company_id;

        /*
         * ----------------------------------------------------------
         * COMPANY
         * ----------------------------------------------------------
         */

        const {
          data: companyData,
          error: companyError,
        } = await supabase
          .from("companies")
          .select("id, name, currency")
          .eq("id", companyId)
          .maybeSingle();

        if (companyError) {
          throw new Error(
            `Company error: ${companyError.message}`
          );
        }

        /*
         * ----------------------------------------------------------
         * PROFILE
         *
         * We deliberately don't depend on a specific profile schema.
         * If no profile table/data is available, dashboard still works.
         * ----------------------------------------------------------
         */

        let profileData: Profile | null = null;

        try {
          const result = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          if (!result.error) {
            profileData = result.data as Profile | null;
          }
        } catch {
          profileData = null;
        }

        /*
         * ----------------------------------------------------------
         * CUSTOMERS
         * ----------------------------------------------------------
         */

        const {
          data: customerData,
          error: customersError,
        } = await supabase
          .from("customers")
          .select("id, name, email, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });

        if (customersError) {
          throw new Error(
            `Customers error: ${customersError.message}`
          );
        }

        /*
         * ----------------------------------------------------------
         * ESTIMATES
         * ----------------------------------------------------------
         *
         * We use the known columns from the existing dashboard.
         * ----------------------------------------------------------
         */

        const {
          data: estimateData,
          error: estimatesError,
        } = await supabase
          .from("estimates")
          .select(
            "id, estimate_number, customer_id, status, total, created_at"
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });

        if (estimatesError) {
          throw new Error(
            `Estimates error: ${estimatesError.message}`
          );
        }

        /*
         * ----------------------------------------------------------
         * INVOICES
         * ----------------------------------------------------------
         */

        const {
          data: invoiceData,
          error: invoicesError,
        } = await supabase
          .from("invoices")
          .select(
            "id, invoice_number, customer_id, status, total, amount_paid, due_date, created_at"
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });

        if (invoicesError) {
          throw new Error(
            `Invoices error: ${invoicesError.message}`
          );
        }

        /*
         * ----------------------------------------------------------
         * SALES ORDERS
         * ----------------------------------------------------------
         */

        const {
          data: orderData,
          error: ordersError,
        } = await supabase
          .from("orders")
          .select(
            "id, order_number, customer_id, status, payment_status, fulfillment_status, total_amount, created_at"
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });

        if (ordersError) {
          throw new Error(
            `Sales error: ${ordersError.message}`
          );
        }

        /*
         * ----------------------------------------------------------
         * INVOICE PAYMENTS
         * ----------------------------------------------------------
         *
         * This is the actual customer payment ledger.
         * NOT the platform/subscription "payments" table.
         * ----------------------------------------------------------
         */

        const {
          data: paymentData,
          error: paymentsError,
        } = await supabase
          .from("invoice_payments")
          .select(
            "id, invoice_id, customer_id, amount, currency, payment_method, reference, paid_at"
          )
          .eq("company_id", companyId)
          .order("paid_at", { ascending: false });

        if (paymentsError) {
          throw new Error(
            `Payments error: ${paymentsError.message}`
          );
        }

        setCompany(companyData as Company | null);
        setProfile(profileData);

        setCustomers((customerData || []) as Customer[]);
        setEstimates((estimateData || []) as Estimate[]);
        setInvoices((invoiceData || []) as Invoice[]);
        setOrders((orderData || []) as Order[]);
        setInvoicePayments(
          (paymentData || []) as InvoicePayment[]
        );

        setCurrentTime(Date.now());
      } catch (err: unknown) {
        console.error("========== DASHBOARD LOAD ERROR ==========");
        console.error("Raw error:", err);

        if (err instanceof Error) {
          console.error("Error name:", err.name);
          console.error("Error message:", err.message);
          console.error("Error stack:", err.stack);

          setError(err.message);
        } else if (typeof err === "string") {
          console.error("Error string:", err);
          setError(err);
        } else {
          try {
            console.error(
              "Error JSON:",
              JSON.stringify(
                err,
                Object.getOwnPropertyNames(err),
                2
              )
            );
          } catch {
            console.error("Could not serialize error:", err);
          }

          setError(
            "Dashboard failed to load. Check the browser console for the full error."
          );
        }

        console.error("==========================================");
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

  /*
   * ----------------------------------------------------------
   * DERIVED DATA
   * ----------------------------------------------------------
   */

  const currency = company?.currency || "USD";

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();

    customers.forEach((customer) => {
      map.set(
        customer.id,
        customer.name?.trim() || "Unnamed customer"
      );
    });

    return map;
  }, [customers]);

  const getCustomerName = useCallback(
    (customerId: string | null) => {
      if (!customerId) return "Walk-in / No customer";

      return (
        customerMap.get(customerId) ||
        "Unknown customer"
      );
    },
    [customerMap]
  );

  const totalRevenueCollected = useMemo(() => {
    return invoicePayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );
  }, [invoicePayments]);

  const totalInvoiced = useMemo(() => {
    return invoices.reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0
    );
  }, [invoices]);

  const totalOutstanding = useMemo(() => {
    return invoices.reduce((sum, invoice) => {
      const total = Number(invoice.total || 0);
      const paid = Number(invoice.amount_paid || 0);

      return sum + Math.max(total - paid, 0);
    }, 0);
  }, [invoices]);

  const overdueAmount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return invoices.reduce((sum, invoice) => {
      const total = Number(invoice.total || 0);
      const paid = Number(invoice.amount_paid || 0);
      const outstanding = Math.max(total - paid, 0);

      if (!invoice.due_date || outstanding <= 0) {
        return sum;
      }

      const due = new Date(invoice.due_date);
      due.setHours(0, 0, 0, 0);

      if (due < today) {
        return sum + outstanding;
      }

      return sum;
    }, 0);
  }, [invoices]);

  const estimatePipeline = useMemo(() => {
    return estimates.reduce((sum, estimate) => {
      const status = (estimate.status || "").toLowerCase();

      if (
        status === "rejected" ||
        status === "declined" ||
        status === "cancelled" ||
        status === "void"
      ) {
        return sum;
      }

      return sum + Number(estimate.total || 0);
    }, 0);
  }, [estimates]);

  const paidInvoices = useMemo(() => {
    return invoices.filter(
      (invoice) => invoice.status === "paid"
    ).length;
  }, [invoices]);

  const collectionRate = useMemo(() => {
    if (totalInvoiced <= 0) return 0;

    return Math.min(
      Math.round(
        (totalRevenueCollected / totalInvoiced) * 100
      ),
      100
    );
  }, [totalInvoiced, totalRevenueCollected]);

  const recentInvoices = useMemo(() => {
    return invoices.slice(0, 6);
  }, [invoices]);

  const recentEstimates = useMemo(() => {
    return estimates.slice(0, 5);
  }, [estimates]);

  const recentCustomers = useMemo(() => {
    return customers.slice(0, 5);
  }, [customers]);

  const recentPayments = useMemo(() => {
    return invoicePayments.slice(0, 5);
  }, [invoicePayments]);

  const moduleCards: Module[] = useMemo(
    () => [
      {
        name: "CRM",
        description: "Manage relationships and business contacts.",
        href: "/customers",
        icon: "crm",
        count: customers.length,
      },
      {
        name: "Leads",
        description: "Capture, qualify and convert prospects.",
        href: "/leads",
        icon: "leads",
        count: null,
        status: "Open",
      },
      {
        name: "Customers",
        description: "Manage your complete customer database.",
        href: "/customers",
        icon: "customers",
        count: customers.length,
      },
      {
        name: "Jobs",
        description: "Track jobs, assignments and work progress.",
        href: "/jobs",
        icon: "jobs",
        count: null,
        status: "Open",
      },
      {
        name: "Estimates",
        description: "Create and manage quotes and estimates.",
        href: "/estimates",
        icon: "estimates",
        count: estimates.length,
      },
      {
        name: "Invoices",
        description: "Create invoices and track receivables.",
        href: "/invoices",
        icon: "invoices",
        count: invoices.length,
      },
      {
        name: "Inventory",
        description: "Manage products, stock and inventory.",
        href: "/inventory",
        icon: "inventory",
        count: null,
        status: "Open",
      },
      {
        name: "Employees",
        description: "Manage staff, roles and team information.",
        href: "/employees",
        icon: "employees",
        count: null,
        status: "Open",
      },
      {
        name: "Reports",
        description: "Analyze business performance and activity.",
        href: "/reports",
        icon: "reports",
        count: null,
        status: "Open",
      },
      {
        name: "Payments",
        description: "Track customer payments and collections.",
        href: "/payments",
        icon: "payments",
        count: invoicePayments.length,
      },
      {
        name: "Documents",
        description: "Store and manage business documents.",
        href: "/documents",
        icon: "documents",
        count: null,
        status: "Open",
      },
      {
        name: "Settings",
        description: "Configure your company workspace.",
        href: "/settings",
        icon: "settings",
        count: null,
        status: "Open",
      },
    ],
    [
      customers.length,
      estimates.length,
      invoices.length,
      invoicePayments.length,
    ]
  );

  const userName =
    profile?.full_name ||
    profile?.name ||
    "there";

  const greeting = useMemo(() => {
    const hour = new Date(currentTime).getHours();

    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";

    return "Good evening";
  }, [currentTime]);

  /*
   * ----------------------------------------------------------
   * LOADING
   * ----------------------------------------------------------
   */

  if (loading) {
    return (
      <AppShell>
        <div className="dashboard-loading">
          <div className="spinner" />
          <p>Loading your dashboard...</p>
        </div>

        <style jsx>{`
          .dashboard-loading {
            min-height: 70vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 14px;
            color: #64748b;
            font-size: 14px;
          }

          .spinner {
            width: 30px;
            height: 30px;
            border: 3px solid #e2e8f0;
            border-top-color: #0f172a;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </AppShell>
    );
  }

  /*
   * ----------------------------------------------------------
   * ERROR
   * ----------------------------------------------------------
   */

  if (error) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="error-card">
            <div className="error-icon">!</div>

            <div>
              <h2>Dashboard could not load</h2>
              <p>{error}</p>

              <button
                type="button"
                className="primary-button"
                onClick={() => loadDashboard()}
              >
                <Icon name="refresh" size={16} />
                Try Again
              </button>
            </div>
          </div>
        </main>

        <style jsx>{`
          .page-content {
            padding: 28px;
          }

          .error-card {
            background: #fff;
            border: 1px solid #fecaca;
            border-radius: 14px;
            padding: 28px;
            display: flex;
            gap: 18px;
            align-items: flex-start;
          }

          .error-icon {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: #fef2f2;
            color: #dc2626;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            flex-shrink: 0;
          }

          h2 {
            margin: 0 0 7px;
            color: #0f172a;
            font-size: 18px;
          }

          p {
            margin: 0 0 18px;
            color: #64748b;
            font-size: 14px;
          }

          .primary-button {
            height: 40px;
            padding: 0 15px;
            border: 0;
            border-radius: 9px;
            background: #0f172a;
            color: #fff;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 700;
          }
        `}</style>
      </AppShell>
    );
  }

  /*
   * ----------------------------------------------------------
   * DASHBOARD
   * ----------------------------------------------------------
   */

  return (
    <AppShell>
      <main className="page-content">
        {/* HEADER */}
        <section className="dashboard-header">
          <div>
            <div className="eyebrow">
              {company?.name || "SBS Workspace"}
            </div>

            <h1>
              {greeting}, {userName}
            </h1>

            <p>
              Here&apos;s what&apos;s happening across your business.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
            >
              <Icon name="refresh" size={16} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() => router.push("/invoices/new")}
            >
              <Icon name="plus" size={17} />
              New Invoice
            </button>
          </div>
        </section>

        {/* KPI CARDS */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Collected Revenue
              </span>

              <div className="stat-icon">
                <Icon name="money" size={18} />
              </div>
            </div>

            <div className="stat-value">
              {formatMoney(
                totalRevenueCollected,
                currency
              )}
            </div>

            <div className="stat-description">
              From recorded customer payments
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Outstanding
              </span>

              <div className="stat-icon">
                <Icon name="clock" size={18} />
              </div>
            </div>

            <div className="stat-value">
              {formatMoney(totalOutstanding, currency)}
            </div>

            <div className="stat-description">
              Unpaid invoice balance
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Sales Orders
              </span>

              <div className="stat-icon">
                <Icon name="trend" size={18} />
              </div>
            </div>

            <div className="stat-value">
              {orders.length}
            </div>

            <div className="stat-description">
              Total sales orders
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Customers
              </span>

              <div className="stat-icon">
                <Icon name="customers" size={18} />
              </div>
            </div>

            <div className="stat-value">
              {customers.length}
            </div>

            <div className="stat-description">
              Customers in your workspace
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Invoices
              </span>

              <div className="stat-icon">
                <Icon name="invoices" size={18} />
              </div>
            </div>

            <div className="stat-value">
              {invoices.length}
            </div>

            <div className="stat-description">
              {paidInvoices} fully paid
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Estimate Pipeline
              </span>

              <div className="stat-icon">
                <Icon name="estimates" size={18} />
              </div>
            </div>

            <div className="stat-value">
              {formatMoney(
                estimatePipeline,
                currency
              )}
            </div>

            <div className="stat-description">
              Active estimate value
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Overdue
              </span>

              <div className="stat-icon">
                <Icon name="clock" size={18} />
              </div>
            </div>

            <div className="stat-value">
              {formatMoney(overdueAmount, currency)}
            </div>

            <div className="stat-description">
              Past-due receivables
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Collection Rate
              </span>

              <div className="stat-icon">
                <Icon name="trend" size={18} />
              </div>
            </div>

            <div className="stat-value">
              {collectionRate}%
            </div>

            <div className="stat-description">
              Collected vs invoiced
            </div>
          </div>
        </section>

        {/* MODULES */}
        <section className="section">
          <div className="section-heading">
            <div>
              <h2>All Modules</h2>
              <p>
                Everything you need to run your business from one
                workspace.
              </p>
            </div>
          </div>

          <div className="module-grid">
            {moduleCards.map((module) => (
              <button
                type="button"
                key={module.name}
                className="module-card"
                onClick={() => router.push(module.href)}
              >
                <div className="module-icon">
                  <Icon name={module.icon} size={20} />
                </div>

                <div className="module-content">
                  <div className="module-title-row">
                    <h3>{module.name}</h3>

                    {module.count !== null &&
                    module.count !== undefined ? (
                      <span className="module-count">
                        {module.count}
                      </span>
                    ) : (
                      <span className="module-open">
                        {module.status || "Open"}
                      </span>
                    )}
                  </div>

                  <p>{module.description}</p>
                </div>

                <div className="module-arrow">
                  <Icon name="arrow" size={16} />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* MAIN CONTENT */}
        <section className="main-grid">
          {/* RECENT INVOICES */}
          <div className="content-card large-card">
            <div className="content-card-header">
              <div>
                <h2>Recent Invoices</h2>
                <p>
                  Latest invoices created in your workspace.
                </p>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={() => router.push("/invoices")}
              >
                View all
                <Icon name="arrow" size={14} />
              </button>
            </div>

            {recentInvoices.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Icon name="invoices" size={22} />
                </div>

                <h3>No invoices yet</h3>

                <p>
                  Create your first invoice to start tracking
                  receivables.
                </p>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    router.push("/invoices/new")
                  }
                >
                  <Icon name="plus" size={16} />
                  Create Invoice
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>
                          <button
                            type="button"
                            className="link-button"
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
                          {getCustomerName(
                            invoice.customer_id
                          )}
                        </td>

                        <td>
                          {formatDate(invoice.created_at)}
                        </td>

                        <td>
                          <span
                            className={getStatusClass(
                              invoice.status
                            )}
                          >
                            {readableStatus(
                              invoice.status
                            )}
                          </span>
                        </td>

                        <td className="money-cell">
                          {formatMoney(
                            Number(invoice.total || 0),
                            currency
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* COLLECTION */}
          <div className="content-card collection-card">
            <div className="content-card-header">
              <div>
                <h2>Receivables</h2>
                <p>Collection performance.</p>
              </div>
            </div>

            <div className="collection-body">
              <div className="collection-percent">
                {collectionRate}%
              </div>

              <div className="collection-label">
                Collection rate
              </div>

              <div className="progress-track">
                <div
                  className="progress-bar"
                  style={{
                    width: `${collectionRate}%`,
                  }}
                />
              </div>

              <div className="collection-stats">
                <div>
                  <span>Collected</span>
                  <strong>
                    {formatMoney(
                      totalRevenueCollected,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>Outstanding</span>
                  <strong>
                    {formatMoney(
                      totalOutstanding,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>Overdue</span>
                  <strong>
                    {formatMoney(
                      overdueAmount,
                      currency
                    )}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECONDARY GRID */}
        <section className="secondary-grid">
          {/* RECENT ESTIMATES */}
          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>Recent Estimates</h2>
                <p>Latest quote activity.</p>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={() => router.push("/estimates")}
              >
                View all
                <Icon name="arrow" size={14} />
              </button>
            </div>

            {recentEstimates.length === 0 ? (
              <div className="small-empty">
                No estimates yet.
              </div>
            ) : (
              <div className="activity-list">
                {recentEstimates.map((estimate) => (
                  <button
                    type="button"
                    className="activity-row"
                    key={estimate.id}
                    onClick={() =>
                      router.push(
                        `/estimates/${estimate.id}`
                      )
                    }
                  >
                    <div className="activity-icon">
                      <Icon
                        name="estimates"
                        size={17}
                      />
                    </div>

                    <div className="activity-main">
                      <strong>
                        {estimate.estimate_number ||
                          "Estimate"}
                      </strong>

                      <span>
                        {getCustomerName(
                          estimate.customer_id
                        )}
                      </span>
                    </div>

                    <div className="activity-right">
                      <strong>
                        {formatMoney(
                          Number(
                            estimate.total || 0
                          ),
                          currency
                        )}
                      </strong>

                      <span
                        className={getStatusClass(
                          estimate.status
                        )}
                      >
                        {readableStatus(
                          estimate.status
                        )}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RECENT CUSTOMERS */}
          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>New Customers</h2>
                <p>Recently added customers.</p>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={() => router.push("/customers")}
              >
                View all
                <Icon name="arrow" size={14} />
              </button>
            </div>

            {recentCustomers.length === 0 ? (
              <div className="small-empty">
                No customers yet.
              </div>
            ) : (
              <div className="activity-list">
                {recentCustomers.map((customer) => (
                  <button
                    type="button"
                    className="activity-row"
                    key={customer.id}
                    onClick={() =>
                      router.push(
                        `/customers/${customer.id}`
                      )
                    }
                  >
                    <div className="avatar">
                      {(customer.name ||
                        "C")
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="activity-main">
                      <strong>
                        {customer.name ||
                          "Unnamed customer"}
                      </strong>

                      <span>
                        {customer.email ||
                          "No email address"}
                      </span>
                    </div>

                    <div className="activity-right">
                      <span>
                        {formatDate(
                          customer.created_at
                        )}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RECENT PAYMENTS */}
          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>Recent Payments</h2>
                <p>Latest customer collections.</p>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={() => router.push("/payments")}
              >
                View all
                <Icon name="arrow" size={14} />
              </button>
            </div>

            {recentPayments.length === 0 ? (
              <div className="small-empty">
                No payments recorded yet.
              </div>
            ) : (
              <div className="activity-list">
                {recentPayments.map((payment) => (
                  <button
                    type="button"
                    className="activity-row"
                    key={payment.id}
                    onClick={() =>
                      router.push(
                        `/invoices/${payment.invoice_id}`
                      )
                    }
                  >
                    <div className="activity-icon payment-icon">
                      <Icon name="payments" size={17} />
                    </div>

                    <div className="activity-main">
                      <strong>
                        {getCustomerName(
                          payment.customer_id
                        )}
                      </strong>

                      <span>
                        {payment.payment_method ||
                          "Payment"}
                      </span>
                    </div>

                    <div className="activity-right">
                      <strong className="payment-amount">
                        +
                        {formatMoney(
                          Number(
                            payment.amount || 0
                          ),
                          payment.currency ||
                            currency
                        )}
                      </strong>

                      <span>
                        {formatDate(
                          payment.paid_at
                        )}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* QUICK ACTIONS */}
        <section className="content-card quick-card">
          <div className="content-card-header">
            <div>
              <h2>Quick Actions</h2>
              <p>
                Jump directly into the most common workflows.
              </p>
            </div>
          </div>

          <div className="quick-grid">
            <button
              type="button"
              className="quick-action"
              onClick={() =>
                router.push("/customers/new")
              }
            >
              <div className="quick-icon">
                <Icon name="customers" size={19} />
              </div>

              <div>
                <strong>Add Customer</strong>
                <span>Create a new customer</span>
              </div>

              <Icon name="arrow" size={15} />
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() =>
                router.push("/leads")
              }
            >
              <div className="quick-icon">
                <Icon name="leads" size={19} />
              </div>

              <div>
                <strong>Manage Leads</strong>
                <span>View your sales pipeline</span>
              </div>

              <Icon name="arrow" size={15} />
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() =>
                router.push("/sales/new")
              }
            >
              <div className="quick-icon">
                <Icon name="trend" size={19} />
              </div>

              <div>
                <strong>New Sale</strong>
                <span>Create a sales order</span>
              </div>

              <Icon name="arrow" size={15} />
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() =>
                router.push("/estimates/new")
              }
            >
              <div className="quick-icon">
                <Icon name="estimates" size={19} />
              </div>

              <div>
                <strong>New Estimate</strong>
                <span>Create a new quote</span>
              </div>

              <Icon name="arrow" size={15} />
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() =>
                router.push("/invoices/new")
              }
            >
              <div className="quick-icon">
                <Icon name="invoices" size={19} />
              </div>

              <div>
                <strong>New Invoice</strong>
                <span>Bill a customer</span>
              </div>

              <Icon name="arrow" size={15} />
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() =>
                router.push("/payments")
              }
            >
              <div className="quick-icon">
                <Icon name="payments" size={19} />
              </div>

              <div>
                <strong>Record Payment</strong>
                <span>Open payment ledger</span>
              </div>

              <Icon name="arrow" size={15} />
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() =>
                router.push("/reports")
              }
            >
              <div className="quick-icon">
                <Icon name="reports" size={19} />
              </div>

              <div>
                <strong>View Reports</strong>
                <span>Analyze your business</span>
              </div>

              <Icon name="arrow" size={15} />
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() =>
                router.push("/settings")
              }
            >
              <div className="quick-icon">
                <Icon name="settings" size={19} />
              </div>

              <div>
                <strong>Workspace Settings</strong>
                <span>Configure your company</span>
              </div>

              <Icon name="arrow" size={15} />
            </button>
          </div>
        </section>
      </main>

      <style jsx>{`
        .page-content {
          padding: 28px;
          max-width: 1700px;
          margin: 0 auto;
        }

        /* HEADER */

        .dashboard-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 26px;
        }

        .eyebrow {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 7px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .dashboard-header h1 {
          margin: 0;
          color: #0f172a;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: -0.025em;
        }

        .dashboard-header p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .primary-button,
        .secondary-button {
          height: 40px;
          padding: 0 15px;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.15s ease;
        }

        .primary-button {
          border: 0;
          background: #0f172a;
          color: #fff;
        }

        .primary-button:hover {
          background: #1e293b;
        }

        .secondary-button {
          border: 1px solid #dbe1e8;
          background: #fff;
          color: #334155;
        }

        .secondary-button:hover {
          background: #f8fafc;
        }

        .secondary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* STATS */

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 30px;
        }

        .stat-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 2px 7px rgba(15, 23, 42, 0.025);
        }

        .stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .stat-label {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .stat-icon {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: #f8fafc;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-value {
          margin-top: 14px;
          color: #0f172a;
          font-size: 23px;
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .stat-description {
          margin-top: 7px;
          color: #94a3b8;
          font-size: 11px;
        }

        /* SECTIONS */

        .section {
          margin-bottom: 30px;
        }

        .section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .section-heading h2 {
          margin: 0;
          color: #0f172a;
          font-size: 18px;
          font-weight: 800;
        }

        .section-heading p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 13px;
        }

        /* MODULES */

        .module-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .module-card {
          min-width: 0;
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 13px;
          padding: 16px;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 13px;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .module-card:hover {
          transform: translateY(-1px);
          border-color: #cbd5e1;
          box-shadow: 0 5px 16px rgba(15, 23, 42, 0.06);
        }

        .module-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #f8fafc;
          color: #334155;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .module-content {
          min-width: 0;
          flex: 1;
        }

        .module-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .module-title-row h3 {
          margin: 0;
          color: #0f172a;
          font-size: 13px;
          font-weight: 800;
        }

        .module-count,
        .module-open {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 21px;
          height: 21px;
          padding: 0 6px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
        }

        .module-open {
          font-weight: 700;
        }

        .module-content p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.4;
        }

        .module-arrow {
          color: #94a3b8;
          flex-shrink: 0;
        }

        /* CONTENT CARDS */

        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.65fr) minmax(300px, 0.75fr);
          gap: 16px;
          margin-bottom: 16px;
        }

        .secondary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .content-card {
          min-width: 0;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 7px rgba(15, 23, 42, 0.025);
        }

        .content-card-header {
          min-height: 76px;
          padding: 18px 20px;
          border-bottom: 1px solid #eef2f7;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .content-card-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 15px;
          font-weight: 800;
        }

        .content-card-header p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 12px;
        }

        .text-button {
          border: 0;
          background: transparent;
          color: #475569;
          padding: 5px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .text-button:hover {
          color: #0f172a;
        }

        /* TABLE */

        .table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          min-width: 650px;
          border-collapse: collapse;
        }

        .data-table th {
          padding: 11px 18px;
          background: #f8fafc;
          color: #64748b;
          text-align: left;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .data-table td {
          padding: 15px 18px;
          border-top: 1px solid #eef2f7;
          color: #475569;
          font-size: 12px;
        }

        .data-table td:last-child {
          text-align: right;
        }

        .data-table th:last-child {
          text-align: right;
        }

        .link-button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #0f172a;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .link-button:hover {
          text-decoration: underline;
        }

        .money-cell {
          color: #0f172a !important;
          font-weight: 800;
        }

        .status {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status-paid {
          background: #ecfdf5;
          color: #059669;
        }

        .status-partial {
          background: #fffbeb;
          color: #d97706;
        }

        .status-danger {
          background: #fef2f2;
          color: #dc2626;
        }

        .status-info {
          background: #eff6ff;
          color: #2563eb;
        }

        .status-neutral {
          background: #f1f5f9;
          color: #64748b;
        }

        /* COLLECTION */

        .collection-body {
          padding: 25px 22px;
        }

        .collection-percent {
          color: #0f172a;
          font-size: 42px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .collection-label {
          margin-top: 7px;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
        }

        .progress-track {
          width: 100%;
          height: 8px;
          margin: 22px 0;
          background: #eef2f7;
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: #0f172a;
          border-radius: inherit;
          transition: width 0.4s ease;
        }

        .collection-stats {
          display: flex;
          flex-direction: column;
          gap: 13px;
        }

        .collection-stats > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .collection-stats span {
          color: #94a3b8;
          font-size: 11px;
        }

        .collection-stats strong {
          color: #334155;
          font-size: 12px;
        }

        /* ACTIVITY */

        .activity-list {
          padding: 3px 0;
        }

        .activity-row {
          width: 100%;
          min-width: 0;
          border: 0;
          border-bottom: 1px solid #eef2f7;
          background: #fff;
          padding: 13px 18px;
          display: flex;
          align-items: center;
          gap: 11px;
          text-align: left;
          cursor: pointer;
        }

        .activity-row:last-child {
          border-bottom: 0;
        }

        .activity-row:hover {
          background: #f8fafc;
        }

        .activity-icon,
        .avatar {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: #f8fafc;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .avatar {
          border-radius: 50%;
          font-size: 12px;
          font-weight: 800;
        }

        .payment-icon {
          background: #ecfdf5;
          color: #059669;
        }

        .activity-main {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .activity-main strong {
          overflow: hidden;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .activity-main span {
          overflow: hidden;
          color: #94a3b8;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .activity-right {
          flex-shrink: 0;
          display: flex;
          align-items: flex-end;
          flex-direction: column;
          gap: 4px;
        }

        .activity-right strong {
          color: #0f172a;
          font-size: 11px;
        }

        .activity-right > span:not(.status) {
          color: #94a3b8;
          font-size: 10px;
        }

        .payment-amount {
          color: #059669 !important;
        }

        .small-empty {
          min-height: 190px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 12px;
        }

        /* EMPTY */

        .empty-state {
          min-height: 350px;
          padding: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #f8fafc;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 13px;
        }

        .empty-state h3 {
          margin: 0;
          color: #334155;
          font-size: 14px;
          font-weight: 800;
        }

        .empty-state p {
          max-width: 330px;
          margin: 6px 0 17px;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.5;
        }

        /* QUICK ACTIONS */

        .quick-card {
          margin-bottom: 20px;
        }

        .quick-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          padding: 16px;
        }

        .quick-action {
          min-width: 0;
          border: 1px solid #eef2f7;
          background: #fff;
          border-radius: 10px;
          padding: 13px;
          display: flex;
          align-items: center;
          gap: 10px;
          text-align: left;
          cursor: pointer;
          transition: 0.15s ease;
        }

        .quick-action:hover {
          border-color: #dbe1e8;
          background: #f8fafc;
        }

        .quick-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: #f8fafc;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .quick-action > div:nth-child(2) {
          min-width: 0;
          flex: 1;
        }

        .quick-action strong {
          display: block;
          overflow: hidden;
          color: #334155;
          font-size: 11px;
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .quick-action span {
          display: block;
          margin-top: 3px;
          overflow: hidden;
          color: #94a3b8;
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .quick-action > svg {
          color: #94a3b8;
          flex-shrink: 0;
        }

        @media (max-width: 1250px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .module-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .quick-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .secondary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 1000px) {
          .main-grid {
            grid-template-columns: 1fr;
          }

          .collection-card {
            min-height: auto;
          }

          .secondary-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 18px;
          }

          .dashboard-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }

          .module-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .module-grid {
            grid-template-columns: 1fr;
          }

          .quick-grid {
            grid-template-columns: 1fr;
          }

          .dashboard-header h1 {
            font-size: 24px;
          }

          .content-card-header {
            padding: 16px;
          }

          .collection-body {
            padding: 20px;
          }
        }
      `}</style>
    </AppShell>
  );
}