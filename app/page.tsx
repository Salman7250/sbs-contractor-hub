"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/app/components/app-shell";

type Company = {
  id: string;
  name: string;
  currency: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
};

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  service: string | null;
  location: string | null;
  status: string;
  estimated_value: number | null;
  source: string | null;
  created_at: string;
};

type Customer = {
  id: string;
  name: string;
};

type Job = {
  id: string;
  customer_id: string | null;
  title: string;
  description: string | null;
  status: string;
  scheduled_date: string | null;
  estimated_value: number | null;
  actual_value: number | null;
  created_at: string;
};

type Estimate = {
  id: string;
  customer_id: string | null;
  estimate_number: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  valid_until: string | null;
  created_at: string;
};

type Invoice = {
  id: string;
  customer_id: string | null;
  job_id: string | null;
  invoice_number: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  due_date: string | null;
  created_at: string;
};

function getInitials(name: string) {
  const cleaned = name.trim();

  if (!cleaned) {
    return "U";
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatCurrency(
  value: number | null | undefined,
  currency: string
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatStatus(status: string) {
  return status
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [company, setCompany] = useState<Company | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [refreshing, setRefreshing] = useState(false);

  async function loadDashboard(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: membership, error: membershipError } =
        await supabase
          .from("company_members")
          .select("company_id, role")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        throw new Error(membershipError.message);
      }

      if (!membership?.company_id) {
        throw new Error(
          "Your account is not connected to a company."
        );
      }

      const companyId = membership.company_id;

      const [
        companyResult,
        profileResult,
        leadsResult,
        customersResult,
        jobsResult,
        estimatesResult,
        invoicesResult,
      ] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, currency")
          .eq("id", companyId)
          .maybeSingle(),

        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("leads")
          .select(
            "id, name, email, phone, service, location, status, estimated_value, source, created_at"
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),

        supabase
          .from("customers")
          .select("id, name")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),

        supabase
          .from("jobs")
          .select(
            "id, customer_id, title, description, status, scheduled_date, estimated_value, actual_value, created_at"
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),

        supabase
          .from("estimates")
          .select(
            "id, customer_id, estimate_number, status, subtotal, tax, total, valid_until, created_at"
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),

        supabase
          .from("invoices")
          .select(
            "id, customer_id, job_id, invoice_number, status, subtotal, tax, total, amount_paid, due_date, created_at"
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
      ]);

      const firstError =
        companyResult.error ||
        profileResult.error ||
        leadsResult.error ||
        customersResult.error ||
        jobsResult.error ||
        estimatesResult.error ||
        invoicesResult.error;

      if (firstError) {
        throw new Error(firstError.message);
      }

      setCompany(companyResult.data || null);
      setProfile(profileResult.data || null);
      setLeads(leadsResult.data || []);
      setCustomers(customersResult.data || []);
      setJobs(jobsResult.data || []);
      setEstimates(estimatesResult.data || []);
      setInvoices(invoicesResult.data || []);
    } catch (err) {
      console.error("Dashboard loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const currency = company?.currency || "USD";

  const stats = useMemo(() => {
    const paidInvoices = invoices.filter(
      (invoice) => invoice.status === "paid"
    );

    const revenue = paidInvoices.reduce(
      (sum, invoice) =>
        sum + Number(invoice.amount_paid || invoice.total || 0),
      0
    );

    const outstanding = invoices.reduce((sum, invoice) => {
      if (invoice.status === "void") {
        return sum;
      }

      const balance =
        Number(invoice.total || 0) -
        Number(invoice.amount_paid || 0);

      return sum + Math.max(balance, 0);
    }, 0);

    const activeJobs = jobs.filter(
      (job) =>
        job.status === "scheduled" ||
        job.status === "in-progress"
    ).length;

    const newLeads = leads.filter(
      (lead) => lead.status === "new"
    ).length;

    const pipelineValue = leads.reduce(
      (sum, lead) =>
        sum + Number(lead.estimated_value || 0),
      0
    );

    return {
      revenue,
      outstanding,
      activeJobs,
      newLeads,
      pipelineValue,
      customers: customers.length,
    };
  }, [customers, invoices, jobs, leads]);

  const recentLeads = useMemo(
    () => leads.slice(0, 6),
    [leads]
  );

  const upcomingJobs = useMemo(() => {
    return jobs
      .filter(
        (job) =>
          job.scheduled_date &&
          job.status !== "completed" &&
          job.status !== "cancelled"
      )
      .sort((a, b) => {
        const dateA = new Date(
          `${a.scheduled_date}T00:00:00`
        ).getTime();

        const dateB = new Date(
          `${b.scheduled_date}T00:00:00`
        ).getTime();

        return dateA - dateB;
      })
      .slice(0, 5);
  }, [jobs]);

  const recentEstimates = useMemo(
    () => estimates.slice(0, 5),
    [estimates]
  );

  const recentInvoices = useMemo(
    () => invoices.slice(0, 5),
    [invoices]
  );

  const customerMap = useMemo(() => {
    return new Map(
      customers.map((customer) => [
        customer.id,
        customer.name,
      ])
    );
  }, [customers]);

  return (
    <AppShell
      title="Dashboard"
      description="Overview of your contractor business."
    >
      <div className="dashboard-page">
        {/* ===================================================
            PAGE HEADER
            =================================================== */}

        <div className="dashboard-page-header">
          <div>
            <div className="dashboard-eyebrow">
              OVERVIEW
            </div>

            <h1>Dashboard</h1>

            <p>
              Welcome back
              {profile?.full_name
                ? `, ${profile.full_name.split(" ")[0]}`
                : ""}
              . Here&apos;s what&apos;s happening with your
              business.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button dashboard-refresh-button"
            onClick={() => loadDashboard(true)}
            disabled={loading || refreshing}
          >
            <span className={refreshing ? "dashboard-refresh-spinning" : ""}>
              ↻
            </span>

            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* ===================================================
            ERROR
            =================================================== */}

        {error && (
          <div className="dashboard-error">
            {error}
          </div>
        )}

        {/* ===================================================
            LOADING
            =================================================== */}

        {loading ? (
          <div className="dashboard-loading-card">
            <div className="loading-spinner" />
            <strong>Loading your dashboard</strong>
            <span>
              Fetching your company data...
            </span>
          </div>
        ) : (
          <>
            {/* =================================================
                PRIMARY STATS
                ================================================= */}

            <section className="dashboard-stats-grid">
              <div className="dashboard-stat-card">
                <div className="dashboard-stat-top">
                  <span>Revenue</span>
                  <span className="dashboard-stat-icon">
                    $
                  </span>
                </div>

                <strong>
                  {formatCurrency(stats.revenue, currency)}
                </strong>

                <small>
                  From paid invoices
                </small>
              </div>

              <div className="dashboard-stat-card">
                <div className="dashboard-stat-top">
                  <span>Outstanding</span>
                  <span className="dashboard-stat-icon">
                    ◌
                  </span>
                </div>

                <strong>
                  {formatCurrency(
                    stats.outstanding,
                    currency
                  )}
                </strong>

                <small>
                  Unpaid invoice balance
                </small>
              </div>

              <div className="dashboard-stat-card">
                <div className="dashboard-stat-top">
                  <span>Active Jobs</span>
                  <span className="dashboard-stat-icon">
                    ▣
                  </span>
                </div>

                <strong>
                  {stats.activeJobs}
                </strong>

                <small>
                  Scheduled or in progress
                </small>
              </div>

              <div className="dashboard-stat-card">
                <div className="dashboard-stat-top">
                  <span>New Leads</span>
                  <span className="dashboard-stat-icon">
                    ◉
                  </span>
                </div>

                <strong>
                  {stats.newLeads}
                </strong>

                <small>
                  {formatCurrency(
                    stats.pipelineValue,
                    currency
                  )}{" "}
                  pipeline
                </small>
              </div>
            </section>

            {/* =================================================
                QUICK ACTIONS
                ================================================= */}

            <section className="dashboard-quick-actions">
              <div className="dashboard-section-heading">
                <div>
                  <h2>Quick actions</h2>
                  <p>
                    Create and manage your business records.
                  </p>
                </div>
              </div>

              <div className="dashboard-action-grid">
                <Link
                  href="/leads"
                  className="dashboard-action-card"
                >
                  <span className="dashboard-action-icon">
                    ◉
                  </span>

                  <span>
                    <strong>New Lead</strong>
                    <small>
                      Add a potential customer
                    </small>
                  </span>

                  <span className="dashboard-action-arrow">
                    →
                  </span>
                </Link>

                <Link
                  href="/customers"
                  className="dashboard-action-card"
                >
                  <span className="dashboard-action-icon">
                    ♙
                  </span>

                  <span>
                    <strong>New Customer</strong>
                    <small>
                      Add a customer
                    </small>
                  </span>

                  <span className="dashboard-action-arrow">
                    →
                  </span>
                </Link>

                <Link
                  href="/jobs"
                  className="dashboard-action-card"
                >
                  <span className="dashboard-action-icon">
                    ▣
                  </span>

                  <span>
                    <strong>New Job</strong>
                    <small>
                      Schedule a job
                    </small>
                  </span>

                  <span className="dashboard-action-arrow">
                    →
                  </span>
                </Link>

                <Link
                  href="/estimates"
                  className="dashboard-action-card"
                >
                  <span className="dashboard-action-icon">
                    ▤
                  </span>

                  <span>
                    <strong>New Estimate</strong>
                    <small>
                      Prepare an estimate
                    </small>
                  </span>

                  <span className="dashboard-action-arrow">
                    →
                  </span>
                </Link>

                <Link
                  href="/invoices"
                  className="dashboard-action-card"
                >
                  <span className="dashboard-action-icon">
                    ▥
                  </span>

                  <span>
                    <strong>New Invoice</strong>
                    <small>
                      Create an invoice
                    </small>
                  </span>

                  <span className="dashboard-action-arrow">
                    →
                  </span>
                </Link>
              </div>
            </section>

            {/* =================================================
                MAIN GRID
                ================================================= */}

            <div className="dashboard-content-grid">
              {/* RECENT LEADS */}

              <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                  <div>
                    <h2>Recent leads</h2>
                    <p>
                      Your latest incoming opportunities.
                    </p>
                  </div>

                  <Link
                    href="/leads"
                    className="dashboard-panel-link"
                  >
                    View all →
                  </Link>
                </div>

                {recentLeads.length === 0 ? (
                  <div className="dashboard-empty">
                    <div className="dashboard-empty-icon">
                      ◉
                    </div>

                    <strong>
                      No leads yet
                    </strong>

                    <p>
                      Your newest leads will appear here.
                    </p>

                    <Link
                      href="/leads"
                      className="primary-button"
                    >
                      Add your first lead
                    </Link>
                  </div>
                ) : (
                  <div className="dashboard-table-scroll">
                    <table className="dashboard-data-table">
                      <thead>
                        <tr>
                          <th>Lead</th>
                          <th>Service</th>
                          <th>Status</th>
                          <th>Value</th>
                          <th>Added</th>
                        </tr>
                      </thead>

                      <tbody>
                        {recentLeads.map((lead) => (
                          <tr key={lead.id}>
                            <td>
                              <div className="dashboard-person">
                                <div className="dashboard-person-avatar">
                                  {getInitials(
                                    lead.name
                                  )}
                                </div>

                                <div>
                                  <strong>
                                    {lead.name}
                                  </strong>

                                  <span>
                                    {lead.location ||
                                      lead.email ||
                                      "No details"}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td>
                              {lead.service || "—"}
                            </td>

                            <td>
                              <span
                                className={`dashboard-status status-${lead.status}`}
                              >
                                {formatStatus(
                                  lead.status
                                )}
                              </span>
                            </td>

                            <td className="dashboard-money">
                              {formatCurrency(
                                lead.estimated_value,
                                currency
                              )}
                            </td>

                            <td className="dashboard-muted">
                              {formatDate(
                                lead.created_at
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* UPCOMING JOBS */}

              <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                  <div>
                    <h2>Upcoming jobs</h2>
                    <p>
                      What&apos;s coming next.
                    </p>
                  </div>

                  <Link
                    href="/jobs"
                    className="dashboard-panel-link"
                  >
                    View all →
                  </Link>
                </div>

                {upcomingJobs.length === 0 ? (
                  <div className="dashboard-empty dashboard-empty-small">
                    <div className="dashboard-empty-icon">
                      ▣
                    </div>

                    <strong>
                      No upcoming jobs
                    </strong>

                    <p>
                      Scheduled jobs will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="dashboard-upcoming-list">
                    {upcomingJobs.map((job) => (
                      <div
                        key={job.id}
                        className="dashboard-upcoming-item"
                      >
                        <div className="dashboard-date-box">
                          <strong>
                            {job.scheduled_date
                              ? new Date(
                                  `${job.scheduled_date}T00:00:00`
                                ).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                  }
                                )
                              : ""}
                          </strong>

                          <span>
                            {job.scheduled_date
                              ? new Date(
                                  `${job.scheduled_date}T00:00:00`
                                ).getDate()
                              : ""}
                          </span>
                        </div>

                        <div className="dashboard-upcoming-main">
                          <strong>
                            {job.title}
                          </strong>

                          <span>
                            {job.customer_id
                              ? customerMap.get(
                                  job.customer_id
                                ) ||
                                "Customer"
                              : "Unassigned"}
                          </span>
                        </div>

                        <div className="dashboard-upcoming-value">
                          {formatCurrency(
                            job.estimated_value,
                            currency
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* =================================================
                LOWER GRID
                ================================================= */}

            <div className="dashboard-lower-grid">
              {/* ESTIMATES */}

              <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                  <div>
                    <h2>Recent estimates</h2>
                    <p>
                      Latest quotes sent or prepared.
                    </p>
                  </div>

                  <Link
                    href="/estimates"
                    className="dashboard-panel-link"
                  >
                    View all →
                  </Link>
                </div>

                {recentEstimates.length === 0 ? (
                  <div className="dashboard-mini-empty">
                    No estimates yet.
                  </div>
                ) : (
                  <div className="dashboard-list">
                    {recentEstimates.map(
                      (estimate) => (
                        <div
                          key={estimate.id}
                          className="dashboard-list-row"
                        >
                          <div>
                            <strong>
                              {estimate.estimate_number}
                            </strong>

                            <span>
                              {estimate.customer_id
                                ? customerMap.get(
                                    estimate.customer_id
                                  ) ||
                                  "Customer"
                                : "No customer"}
                            </span>
                          </div>

                          <div className="dashboard-list-right">
                            <strong>
                              {formatCurrency(
                                estimate.total,
                                currency
                              )}
                            </strong>

                            <span
                              className={`dashboard-status status-${estimate.status}`}
                            >
                              {formatStatus(
                                estimate.status
                              )}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>

              {/* INVOICES */}

              <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                  <div>
                    <h2>Recent invoices</h2>
                    <p>
                      Your latest billing activity.
                    </p>
                  </div>

                  <Link
                    href="/invoices"
                    className="dashboard-panel-link"
                  >
                    View all →
                  </Link>
                </div>

                {recentInvoices.length === 0 ? (
                  <div className="dashboard-mini-empty">
                    No invoices yet.
                  </div>
                ) : (
                  <div className="dashboard-list">
                    {recentInvoices.map(
                      (invoice) => {
                        const balance = Math.max(
                          Number(invoice.total || 0) -
                            Number(
                              invoice.amount_paid ||
                                0
                            ),
                          0
                        );

                        return (
                          <div
                            key={invoice.id}
                            className="dashboard-list-row"
                          >
                            <div>
                              <strong>
                                {invoice.invoice_number}
                              </strong>

                              <span>
                                {invoice.customer_id
                                  ? customerMap.get(
                                      invoice.customer_id
                                    ) ||
                                    "Customer"
                                  : "No customer"}
                              </span>
                            </div>

                            <div className="dashboard-list-right">
                              <strong>
                                {formatCurrency(
                                  invoice.total,
                                  currency
                                )}
                              </strong>

                              <span
                                className={`dashboard-status status-${invoice.status}`}
                              >
                                {invoice.status ===
                                "partially_paid"
                                  ? `${formatCurrency(
                                      balance,
                                      currency
                                    )} due`
                                  : formatStatus(
                                      invoice.status
                                    )}
                              </span>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* =================================================
                BUSINESS SUMMARY
                ================================================= */}

            <section className="dashboard-summary">
              <div>
                <span>Customers</span>
                <strong>{stats.customers}</strong>
              </div>

              <div>
                <span>Total Jobs</span>
                <strong>{jobs.length}</strong>
              </div>

              <div>
                <span>Estimates</span>
                <strong>{estimates.length}</strong>
              </div>

              <div>
                <span>Invoices</span>
                <strong>{invoices.length}</strong>
              </div>

              <div>
                <span>Lead Pipeline</span>
                <strong>
                  {formatCurrency(
                    stats.pipelineValue,
                    currency
                  )}
                </strong>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}