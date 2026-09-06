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
  total_amount: number | null;
  status: string | null;
  created_at: string;
};

type InvoicePayment = {
  id: string;
  invoice_id: string;
  amount: number | null;
  paid_at: string | null;
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
      ] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, slug, logo_url")
          .eq("id", companyId)
          .single(),

        supabase
          .from("customers")
          .select("id, name, email, phone, created_at")
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
          .select(
            "id, order_number, customer_id, total_amount, status, created_at",
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),

        supabase
          .from("invoice_payments")
          .select("id, invoice_id, amount, paid_at, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
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

      setCompany(companyResult.data);
      setCustomers(customersResult.data ?? []);
      setEstimates(estimatesResult.data ?? []);
      setInvoices(invoicesResult.data ?? []);
      setOrders(ordersResult.data ?? []);
      setPayments(paymentsResult.data ?? []);
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
    (sum, order) => sum + Number(order.total_amount ?? 0),
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

  if (loading) {
    return (
      <AppShell>
        <style jsx>{`
          .sbs-dashboard-loading {
            min-height: 60vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 14px;
            color: #64748b;
          }

          .sbs-dashboard-spinner {
            width: 36px;
            height: 36px;
            border: 3px solid #e2e8f0;
            border-top-color: #0f172a;
            border-radius: 50%;
            animation: sbs-spin 0.8s linear infinite;
          }

          @keyframes sbs-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>

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
        <style jsx>{`
          .sbs-dashboard-error {
            min-height: 60vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 32px;
          }

          .sbs-dashboard-error h1 {
            margin: 0 0 10px;
            color: #0f172a;
            font-size: 28px;
            font-weight: 700;
          }

          .sbs-dashboard-error p {
            margin: 0 0 22px;
            color: #64748b;
            max-width: 560px;
          }

          .sbs-dashboard-error button {
            border: 0;
            border-radius: 10px;
            background: #0f172a;
            color: #fff;
            padding: 11px 18px;
            font-weight: 600;
            cursor: pointer;
          }

          .sbs-dashboard-error button:hover {
            background: #1e293b;
          }
        `}</style>

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
      <style jsx>{`
        .sbs-dashboard {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
          padding: 32px;
          box-sizing: border-box;
          color: #0f172a;
        }

        .sbs-dashboard-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
        }

        .sbs-dashboard-eyebrow,
        .sbs-dashboard-panel-eyebrow {
          margin: 0 0 7px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .sbs-dashboard-header h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 40px);
          line-height: 1.1;
          letter-spacing: -0.03em;
          font-weight: 750;
        }

        .sbs-dashboard-subtitle {
          margin: 10px 0 0;
          color: #64748b;
          font-size: 15px;
        }

        .sbs-dashboard-header-actions {
          flex-shrink: 0;
        }

        .sbs-dashboard-primary-button {
          border: 0;
          border-radius: 10px;
          padding: 12px 18px;
          background: #0f172a;
          color: #fff;
          font-size: 14px;
          font-weight: 650;
          cursor: pointer;
          transition:
            background 0.15s ease,
            transform 0.15s ease;
        }

        .sbs-dashboard-primary-button:hover {
          background: #1e293b;
          transform: translateY(-1px);
        }

        .sbs-dashboard-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .sbs-dashboard-stat-card {
          display: flex;
          align-items: center;
          gap: 15px;
          min-width: 0;
          padding: 20px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #fff;
          color: #0f172a;
          text-align: left;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            transform 0.15s ease;
        }

        .sbs-dashboard-stat-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.07);
          transform: translateY(-1px);
        }

        .sbs-dashboard-stat-card > div:last-child {
          min-width: 0;
        }

        .sbs-dashboard-stat-icon,
        .sbs-dashboard-list-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 11px;
          background: #f1f5f9;
          color: #334155;
        }

        .sbs-dashboard-stat-card span {
          display: block;
          margin-bottom: 5px;
          color: #64748b;
          font-size: 13px;
          font-weight: 550;
        }

        .sbs-dashboard-stat-card strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 22px;
          line-height: 1.1;
          font-weight: 750;
        }

        .sbs-dashboard-financial-grid,
        .sbs-dashboard-content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 18px;
          margin-bottom: 18px;
        }

        .sbs-dashboard-panel {
          min-width: 0;
          padding: 22px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .sbs-dashboard-panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 20px;
        }

        .sbs-dashboard-panel-header h2 {
          margin: 0;
          font-size: 19px;
          line-height: 1.25;
          letter-spacing: -0.015em;
          font-weight: 700;
        }

        .sbs-dashboard-link-button {
          flex-shrink: 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: #475569;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
        }

        .sbs-dashboard-link-button:hover {
          color: #0f172a;
        }

        .sbs-dashboard-outstanding {
          display: flex;
          flex-direction: column;
          padding: 4px 0 20px;
        }

        .sbs-dashboard-outstanding strong {
          font-size: clamp(28px, 4vw, 38px);
          line-height: 1;
          letter-spacing: -0.03em;
          font-weight: 750;
        }

        .sbs-dashboard-outstanding span {
          margin-top: 9px;
          color: #64748b;
          font-size: 13px;
        }

        .sbs-dashboard-mini-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          padding-top: 18px;
          border-top: 1px solid #e2e8f0;
        }

        .sbs-dashboard-mini-stats > div {
          min-width: 0;
        }

        .sbs-dashboard-mini-stats span {
          display: block;
          margin-bottom: 6px;
          color: #64748b;
          font-size: 12px;
          font-weight: 550;
        }

        .sbs-dashboard-mini-stats strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 17px;
          font-weight: 700;
        }

        .sbs-dashboard-quick-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .sbs-dashboard-quick-actions button {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          background: #fff;
          color: #0f172a;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease;
        }

        .sbs-dashboard-quick-actions button:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .sbs-dashboard-quick-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: #f1f5f9;
          color: #334155;
        }

        .sbs-dashboard-quick-actions button > span:last-child {
          min-width: 0;
        }

        .sbs-dashboard-quick-actions strong {
          display: block;
          font-size: 13px;
          font-weight: 700;
        }

        .sbs-dashboard-quick-actions small {
          display: block;
          margin-top: 3px;
          overflow: hidden;
          color: #64748b;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sbs-dashboard-list {
          display: flex;
          flex-direction: column;
        }

        .sbs-dashboard-list-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 13px 0;
          border: 0;
          border-top: 1px solid #e2e8f0;
          background: transparent;
          color: #0f172a;
          text-align: left;
          cursor: pointer;
        }

        .sbs-dashboard-list-item:first-child {
          border-top: 0;
          padding-top: 0;
        }

        .sbs-dashboard-list-item:last-child {
          padding-bottom: 0;
        }

        .sbs-dashboard-list-item:hover .sbs-dashboard-list-main strong {
          color: #475569;
        }

        .sbs-dashboard-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #f1f5f9;
          color: #334155;
          font-size: 14px;
          font-weight: 700;
        }

        .sbs-dashboard-list-main {
          min-width: 0;
          flex: 1;
        }

        .sbs-dashboard-list-main strong {
          display: block;
          overflow: hidden;
          font-size: 13px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sbs-dashboard-list-main span {
          display: block;
          margin-top: 3px;
          overflow: hidden;
          color: #64748b;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sbs-dashboard-list-date {
          flex-shrink: 0;
          color: #94a3b8;
          font-size: 11px;
        }

        .sbs-dashboard-list-amount {
          flex-shrink: 0;
          font-size: 13px;
          font-weight: 700;
        }

        .sbs-dashboard-empty {
          display: flex;
          min-height: 180px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 9px;
          color: #94a3b8;
          text-align: center;
        }

        .sbs-dashboard-empty p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
        }

        .sbs-dashboard-empty button {
          margin-top: 3px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #334155;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
        }

        .sbs-dashboard-empty button:hover {
          text-decoration: underline;
        }

        @media (max-width: 1100px) {
          .sbs-dashboard-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sbs-dashboard-financial-grid,
          .sbs-dashboard-content-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .sbs-dashboard {
            padding: 20px 16px 28px;
          }

          .sbs-dashboard-header {
            align-items: flex-start;
            flex-direction: column;
            margin-bottom: 22px;
          }

          .sbs-dashboard-header-actions,
          .sbs-dashboard-primary-button {
            width: 100%;
          }

          .sbs-dashboard-primary-button {
            padding: 13px 16px;
          }

          .sbs-dashboard-stats {
            grid-template-columns: 1fr;
          }

          .sbs-dashboard-panel {
            padding: 18px;
          }

          .sbs-dashboard-panel-header {
            gap: 10px;
          }

          .sbs-dashboard-panel-header h2 {
            font-size: 17px;
          }

          .sbs-dashboard-quick-actions {
            grid-template-columns: 1fr;
          }

          .sbs-dashboard-list-date {
            display: none;
          }

          .sbs-dashboard-list-amount {
            font-size: 12px;
          }
        }

        @media (max-width: 420px) {
          .sbs-dashboard-mini-stats {
            grid-template-columns: 1fr;
          }

          .sbs-dashboard-stat-card {
            padding: 17px;
          }

          .sbs-dashboard-stat-icon {
            width: 40px;
            height: 40px;
          }
        }
      `}</style>

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
      </main>
    </AppShell>
  );
}