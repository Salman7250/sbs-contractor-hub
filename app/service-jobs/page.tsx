"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type ServiceJob = {
  id: string;
  company_id: string;
  job_number: string;
  provider_id: string;
  customer_id: string | null;
  source: string;
  service_type: string;
  status:
    | "draft"
    | "open"
    | "in_progress"
    | "awaiting_return"
    | "partially_returned"
    | "completed"
    | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  dispatched_date: string | null;
  expected_return_date: string | null;
  completed_date: string | null;
  notes: string | null;
  internal_notes: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
  updated_at: string;
};

type Provider = {
  id: string;
  name: string;
  company_name: string | null;
  provider_number: string;
};

type Customer = {
  id: string;
  name: string;
};

type JobItem = {
  id: string;
  service_job_id: string;
  quantity: number;
  quantity_completed: number;
  quantity_failed: number;
  quantity_damaged: number;
};

const statusLabel = (status: string) =>
  status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDate = (value: string | null) => {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const money = (value: number | null) =>
  `AED ${Number(value || 0).toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const statusClass = (status: string) => {
  switch (status) {
    case "completed":
      return "status status-success";

    case "open":
    case "in_progress":
    case "awaiting_return":
    case "partially_returned":
      return "status status-warning";

    case "cancelled":
      return "status status-danger";

    case "draft":
      return "status status-neutral";

    default:
      return "status status-info";
  }
};

const priorityClass = (priority: string) => {
  switch (priority) {
    case "urgent":
      return "priority priority-danger";

    case "high":
      return "priority priority-warning";

    case "normal":
      return "priority priority-normal";

    case "low":
      return "priority priority-low";

    default:
      return "priority priority-normal";
  }
};

export default function ServiceJobsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [providers, setProviders] = useState<
    Record<string, Provider>
  >({});
  const [customers, setCustomers] = useState<
    Record<string, Customer>
  >({});
  const [jobItems, setJobItems] = useState<JobItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [serviceTypeFilter, setServiceTypeFilter] =
    useState("all");

  const [errorMessage, setErrorMessage] = useState("");

  const loadJobs = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/login";
          return;
        }

        const { data: membership, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company membership was found for your account."
          );
        }

        const companyId = membership.company_id;

        /*
         * ---------------------------------------------------------
         * SERVICE JOBS
         * ---------------------------------------------------------
         */

        const { data: jobsData, error: jobsError } =
          await supabase
            .from("service_jobs")
            .select(
              `
                id,
                company_id,
                job_number,
                provider_id,
                customer_id,
                source,
                service_type,
                status,
                priority,
                dispatched_date,
                expected_return_date,
                completed_date,
                notes,
                internal_notes,
                estimated_cost,
                actual_cost,
                created_at,
                updated_at
              `
            )
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            });

        if (jobsError) {
          throw jobsError;
        }

        const loadedJobs = (jobsData || []) as ServiceJob[];

        setJobs(loadedJobs);

        /*
         * ---------------------------------------------------------
         * PROVIDERS
         * ---------------------------------------------------------
         */

        const providerIds = Array.from(
          new Set(
            loadedJobs
              .map((job) => job.provider_id)
              .filter(Boolean)
          )
        );

        const customerIds = Array.from(
          new Set(
            loadedJobs
              .map((job) => job.customer_id)
              .filter(Boolean) as string[]
          )
        );

        const jobIds = loadedJobs.map((job) => job.id);

        const [
          providersResult,
          customersResult,
          itemsResult,
        ] = await Promise.all([
          providerIds.length
            ? supabase
                .from("service_providers")
                .select(
                  "id,name,company_name,provider_number"
                )
                .eq("company_id", companyId)
                .in("id", providerIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),

          customerIds.length
            ? supabase
                .from("customers")
                .select("id,name")
                .eq("company_id", companyId)
                .in("id", customerIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),

          jobIds.length
            ? supabase
                .from("service_job_items")
                .select(
                  `
                    id,
                    service_job_id,
                    quantity,
                    quantity_completed,
                    quantity_failed,
                    quantity_damaged
                  `
                )
                .eq("company_id", companyId)
                .in("service_job_id", jobIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),
        ]);

        if (providersResult.error) {
          throw providersResult.error;
        }

        if (customersResult.error) {
          throw customersResult.error;
        }

        if (itemsResult.error) {
          throw itemsResult.error;
        }

        const providerMap: Record<string, Provider> = {};

        for (const provider of providersResult.data || []) {
          providerMap[provider.id] =
            provider as Provider;
        }

        const customerMap: Record<string, Customer> = {};

        for (const customer of customersResult.data || []) {
          customerMap[customer.id] =
            customer as Customer;
        }

        setProviders(providerMap);
        setCustomers(customerMap);
        setJobItems(
          (itemsResult.data || []) as JobItem[]
        );
      } catch (error) {
        console.error("SERVICE JOBS LOAD ERROR:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load service jobs."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const stats = useMemo(() => {
    return {
      total: jobs.length,

      draft: jobs.filter(
        (job) => job.status === "draft"
      ).length,

      open: jobs.filter(
        (job) => job.status === "open"
      ).length,

      inProgress: jobs.filter(
        (job) => job.status === "in_progress"
      ).length,

      awaitingReturn: jobs.filter(
        (job) => job.status === "awaiting_return"
      ).length,

      partiallyReturned: jobs.filter(
        (job) => job.status === "partially_returned"
      ).length,

      completed: jobs.filter(
        (job) => job.status === "completed"
      ).length,

      cancelled: jobs.filter(
        (job) => job.status === "cancelled"
      ).length,
    };
  }, [jobs]);

  const serviceTypes = useMemo(() => {
    return Array.from(
      new Set(
        jobs
          .map((job) => job.service_type?.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return jobs.filter((job) => {
      const provider = providers[job.provider_id];
      const customer = job.customer_id
        ? customers[job.customer_id]
        : null;

      const matchesSearch =
        !normalizedSearch ||
        job.job_number
          .toLowerCase()
          .includes(normalizedSearch) ||
        job.service_type
          .toLowerCase()
          .includes(normalizedSearch) ||
        provider?.name
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        provider?.company_name
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        customer?.name
          ?.toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        job.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" ||
        job.priority === priorityFilter;

      const matchesProvider =
        providerFilter === "all" ||
        job.provider_id === providerFilter;

      const matchesServiceType =
        serviceTypeFilter === "all" ||
        job.service_type === serviceTypeFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesProvider &&
        matchesServiceType
      );
    });
  }, [
    jobs,
    providers,
    customers,
    search,
    statusFilter,
    priorityFilter,
    providerFilter,
    serviceTypeFilter,
  ]);

  const getJobItemTotals = (jobId: string) => {
    const items = jobItems.filter(
      (item) => item.service_job_id === jobId
    );

    return items.reduce(
      (totals, item) => {
        totals.quantity += Number(item.quantity || 0);
        totals.completed += Number(
          item.quantity_completed || 0
        );
        totals.failed += Number(
          item.quantity_failed || 0
        );
        totals.damaged += Number(
          item.quantity_damaged || 0
        );

        return totals;
      },
      {
        quantity: 0,
        completed: 0,
        failed: 0,
        damaged: 0,
      }
    );
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setProviderFilter("all");
    setServiceTypeFilter("all");
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading service jobs...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content">
        {/* Header */}
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              Service Providers
            </div>

            <h1>Service Jobs</h1>

            <p className="page-description">
              Manage work assigned to external service
              providers and track company-owned stock
              throughout the service lifecycle.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => loadJobs(true)}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <Link
              href="/service-jobs/new"
              className="primary-button"
            >
              + New Service Job
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-error">
            {errorMessage}
          </div>
        )}

        {/* KPI Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Jobs
            </div>

            <div className="stat-value">
              {stats.total}
            </div>

            <div className="stat-meta">
              All service jobs
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Open
            </div>

            <div className="stat-value">
              {stats.open}
            </div>

            <div className="stat-meta">
              Ready for work
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              In Progress
            </div>

            <div className="stat-value">
              {stats.inProgress}
            </div>

            <div className="stat-meta">
              Currently being worked
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Awaiting Return
            </div>

            <div className="stat-value">
              {stats.awaitingReturn}
            </div>

            <div className="stat-meta">
              Waiting for provider
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Partially Returned
            </div>

            <div className="stat-value">
              {stats.partiallyReturned}
            </div>

            <div className="stat-meta">
              More stock outstanding
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Completed
            </div>

            <div className="stat-value">
              {stats.completed}
            </div>

            <div className="stat-meta">
              Finished jobs
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="content-card">
          <div className="filters">
            <div className="search-field">
              <span className="search-icon">
                ⌕
              </span>

              <input
                type="text"
                placeholder="Search jobs, providers, customers..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">
                All Statuses
              </option>

              <option value="draft">
                Draft
              </option>

              <option value="open">
                Open
              </option>

              <option value="in_progress">
                In Progress
              </option>

              <option value="awaiting_return">
                Awaiting Return
              </option>

              <option value="partially_returned">
                Partially Returned
              </option>

              <option value="completed">
                Completed
              </option>

              <option value="cancelled">
                Cancelled
              </option>
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                All Priorities
              </option>

              <option value="urgent">
                Urgent
              </option>

              <option value="high">
                High
              </option>

              <option value="normal">
                Normal
              </option>

              <option value="low">
                Low
              </option>
            </select>

            <select
              value={providerFilter}
              onChange={(event) =>
                setProviderFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                All Providers
              </option>

              {Object.values(providers)
                .sort((a, b) =>
                  a.name.localeCompare(b.name)
                )
                .map((provider) => (
                  <option
                    key={provider.id}
                    value={provider.id}
                  >
                    {provider.name}
                  </option>
                ))}
            </select>

            <select
              value={serviceTypeFilter}
              onChange={(event) =>
                setServiceTypeFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                All Service Types
              </option>

              {serviceTypes.map((serviceType) => (
                <option
                  key={serviceType}
                  value={serviceType}
                >
                  {serviceType}
                </option>
              ))}
            </select>

            {(search ||
              statusFilter !== "all" ||
              priorityFilter !== "all" ||
              providerFilter !== "all" ||
              serviceTypeFilter !== "all") && (
              <button
                type="button"
                className="clear-button"
                onClick={clearFilters}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="content-card">
          <div className="content-card-header">
            <div>
              <h2>Service Jobs</h2>

              <p>
                Showing {filteredJobs.length} of{" "}
                {jobs.length} jobs
              </p>
            </div>

            <div className="header-summary">
              {stats.cancelled > 0 && (
                <span>
                  {stats.cancelled} cancelled
                </span>
              )}

              {stats.draft > 0 && (
                <span>
                  {stats.draft} draft
                </span>
              )}
            </div>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                SJ
              </div>

              <h3>
                {jobs.length === 0
                  ? "No service jobs yet"
                  : "No jobs match your filters"}
              </h3>

              <p>
                {jobs.length === 0
                  ? "Create your first service job to start assigning company stock to an external provider."
                  : "Try changing your search or filters."}
              </p>

              {jobs.length === 0 ? (
                <Link
                  href="/service-jobs/new"
                  className="primary-button"
                >
                  + New Service Job
                </Link>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Provider</th>
                    <th>Service</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Priority</th>
                    <th>Expected Return</th>
                    <th>Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredJobs.map((job) => {
                    const provider =
                      providers[job.provider_id];

                    const customer = job.customer_id
                      ? customers[job.customer_id]
                      : null;

                    const totals =
                      getJobItemTotals(job.id);

                    return (
                      <tr key={job.id}>
                        <td>
                          <Link
                            href={`/service-jobs/${job.id}`}
                            className="job-link"
                          >
                            {job.job_number}
                          </Link>

                          <div className="table-secondary">
                            {formatDate(
                              job.created_at
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="table-primary">
                            {provider?.name ||
                              "Unknown Provider"}
                          </div>

                          {provider?.provider_number && (
                            <div className="table-secondary">
                              {
                                provider.provider_number
                              }
                            </div>
                          )}
                        </td>

                        <td>
                          <div className="table-primary">
                            {job.service_type}
                          </div>

                          <div className="table-secondary">
                            {statusLabel(job.source)}
                          </div>
                        </td>

                        <td>
                          {customer?.name || (
                            <span className="muted">
                              Internal
                            </span>
                          )}
                        </td>

                        <td>
                          <div className="items-value">
                            {totals.quantity}
                          </div>

                          {totals.quantity > 0 && (
                            <div className="items-meta">
                              {totals.completed} completed
                            </div>
                          )}
                        </td>

                        <td>
                          <span
                            className={priorityClass(
                              job.priority
                            )}
                          >
                            {statusLabel(
                              job.priority
                            )}
                          </span>
                        </td>

                        <td>
                          {formatDate(
                            job.expected_return_date
                          )}
                        </td>

                        <td>
                          {job.actual_cost !== null
                            ? money(job.actual_cost)
                            : job.estimated_cost !==
                              null
                            ? (
                                <span className="estimated-cost">
                                  {money(
                                    job.estimated_cost
                                  )}
                                  <small>
                                    est.
                                  </small>
                                </span>
                              )
                            : "—"}
                        </td>

                        <td>
                          <span
                            className={statusClass(
                              job.status
                            )}
                          >
                            {statusLabel(
                              job.status
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .page-content {
          padding: 28px;
          max-width: 1600px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .breadcrumb {
          color: #9ca3af;
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 7px;
        }

        h1 {
          margin: 0;
          color: #111827;
          font-size: 27px;
          line-height: 1.2;
          font-weight: 700;
        }

        .page-description {
          max-width: 760px;
          margin: 6px 0 0;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.5;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 8px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
        }

        .primary-button {
          border: 1px solid #111827;
          background: #111827;
          color: white;
        }

        .primary-button:hover {
          background: #1f2937;
        }

        .secondary-button {
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
        }

        .secondary-button:hover {
          background: #f9fafb;
        }

        .secondary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(
            6,
            minmax(0, 1fr)
          );
          gap: 14px;
          margin-bottom: 18px;
        }

        .stat-card {
          min-width: 0;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 1px 2px
            rgba(0, 0, 0, 0.03);
        }

        .stat-label {
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .stat-value {
          color: #111827;
          font-size: 25px;
          line-height: 1.1;
          font-weight: 700;
        }

        .stat-meta {
          color: #9ca3af;
          font-size: 11px;
          margin-top: 7px;
        }

        .content-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px
            rgba(0, 0, 0, 0.03);
          margin-bottom: 18px;
          overflow: hidden;
        }

        .filters {
          display: grid;
          grid-template-columns:
            minmax(260px, 1.7fr)
            repeat(4, minmax(145px, 1fr))
            auto;
          gap: 10px;
          padding: 16px 18px;
        }

        .search-field {
          position: relative;
          min-width: 0;
        }

        .search-field input,
        .filters select {
          width: 100%;
          height: 40px;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
          color: #111827;
          font-family: inherit;
          font-size: 12px;
          outline: none;
        }

        .search-field input {
          padding: 0 12px 0 35px;
        }

        .search-field input:focus,
        .filters select:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px
            rgba(17, 24, 39, 0.05);
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          font-size: 18px;
          line-height: 1;
          pointer-events: none;
        }

        .clear-button {
          height: 40px;
          padding: 0 10px;
          border: none;
          background: transparent;
          color: #2563eb;
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .content-card-header {
          min-height: 70px;
          padding: 18px 20px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .content-card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .content-card-header p {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .header-summary {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #9ca3af;
          font-size: 11px;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1250px;
          border-collapse: collapse;
        }

        th {
          padding: 12px 20px;
          text-align: left;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        td {
          padding: 14px 20px;
          border-bottom: 1px solid #f0f1f3;
          color: #374151;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        tbody tr:hover {
          background: #fafafa;
        }

        .job-link {
          color: #2563eb;
          font-weight: 700;
          text-decoration: none;
        }

        .job-link:hover {
          text-decoration: underline;
        }

        .table-primary {
          color: #111827;
          font-weight: 600;
        }

        .table-secondary {
          margin-top: 3px;
          color: #9ca3af;
          font-size: 10px;
        }

        .muted {
          color: #9ca3af;
        }

        .items-value {
          color: #111827;
          font-weight: 700;
        }

        .items-meta {
          margin-top: 3px;
          color: #9ca3af;
          font-size: 10px;
        }

        .estimated-cost {
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
        }

        .estimated-cost small {
          color: #9ca3af;
          font-size: 9px;
        }

        .status,
        .priority {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 24px;
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-success {
          background: #dcfce7;
          color: #166534;
        }

        .status-warning {
          background: #fef3c7;
          color: #92400e;
        }

        .status-danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .status-neutral {
          background: #f3f4f6;
          color: #4b5563;
        }

        .status-info {
          background: #dbeafe;
          color: #1e40af;
        }

        .priority-danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .priority-warning {
          background: #fef3c7;
          color: #92400e;
        }

        .priority-normal {
          background: #f3f4f6;
          color: #4b5563;
        }

        .priority-low {
          background: #f3f4f6;
          color: #6b7280;
        }

        .empty-state {
          min-height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
          padding: 40px;
        }

        .empty-icon {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
          border-radius: 12px;
          background: #f3f4f6;
          color: #6b7280;
          font-size: 12px;
          font-weight: 800;
        }

        .empty-state h3 {
          margin: 0 0 7px;
          color: #111827;
          font-size: 17px;
        }

        .empty-state p {
          max-width: 470px;
          margin: 0 0 18px;
          color: #9ca3af;
          font-size: 12px;
          line-height: 1.5;
        }

        .alert {
          padding: 12px 14px;
          margin-bottom: 18px;
          border-radius: 9px;
          font-size: 13px;
        }

        .alert-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .loading-state {
          min-height: 420px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 12px;
          color: #6b7280;
          font-size: 13px;
        }

        .loading-spinner {
          width: 26px;
          height: 26px;
          border: 3px solid #e5e7eb;
          border-top-color: #111827;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1350px) {
          .stats-grid {
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
          }

          .filters {
            grid-template-columns:
              minmax(240px, 2fr)
              repeat(2, minmax(150px, 1fr));
          }
        }

        @media (max-width: 900px) {
          .page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .filters {
            grid-template-columns: 1fr 1fr;
          }

          .search-field {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 600px) {
          .page-content {
            padding: 18px;
          }

          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .search-field {
            grid-column: auto;
          }

          .header-actions {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr;
          }

          .header-actions a,
          .header-actions button {
            width: 100%;
          }

          .content-card-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-summary {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}