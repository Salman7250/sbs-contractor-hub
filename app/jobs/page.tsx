"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type DatabaseRow = Record<string, unknown>;

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Job = {
  id: string;
  company_id: string;
  customer_id: string | null;
  title: string;
  description: string | null;
  status: string;
  scheduled_date: string | null;
  estimated_value: number;
  actual_value: number;
  created_at: string;
  updated_at: string;
};

type JobForm = {
  customer_id: string;
  title: string;
  description: string;
  status: string;
  scheduled_date: string;
  estimated_value: string;
  actual_value: string;
};

const STATUS_OPTIONS = [
  "scheduled",
  "in-progress",
  "completed",
  "cancelled",
];

function getString(row: DatabaseRow, key: string): string {
  const value = row[key];

  return typeof value === "string" ? value : "";
}

function getNumber(row: DatabaseRow, key: string): number {
  const value = row[key];

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(date: string | null) {
  if (!date) {
    return "Not scheduled";
  }

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(date: string | null) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatStatus(status: string) {
  return status
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}

function getTodayString() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStatusClass(status: string) {
  const normalized = status
    .toLowerCase()
    .trim()
    .replace(/_/g, "-");

  switch (normalized) {
    case "scheduled":
      return "status-scheduled";

    case "in-progress":
      return "status-in-progress";

    case "completed":
      return "status-completed";

    case "cancelled":
    case "canceled":
      return "status-cancelled";

    default:
      return "status-scheduled";
  }
}

export default function JobsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [modalError, setModalError] = useState("");

  const [form, setForm] = useState<JobForm>({
    customer_id: "",
    title: "",
    description: "",
    status: "scheduled",
    scheduled_date: "",
    estimated_value: "",
    actual_value: "",
  });

  useEffect(() => {
    loadPage();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getCompanyId() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw authError;
    }

    if (!user) {
      window.location.href = "/login";
      return null;
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
        "No company membership found for this account."
      );
    }

    return membership.company_id;
  }

  async function loadPage() {
    setLoading(true);
    setPageError("");

    try {
      const membershipCompanyId = await getCompanyId();

      if (!membershipCompanyId) {
        return;
      }

      setCompanyId(membershipCompanyId);

      const [jobsResult, customersResult] = await Promise.all([
        supabase
          .from("jobs")
          .select(
            `
              id,
              company_id,
              customer_id,
              title,
              description,
              status,
              scheduled_date,
              estimated_value,
              actual_value,
              created_at,
              updated_at
            `
          )
          .eq("company_id", membershipCompanyId)
          .order("scheduled_date", {
            ascending: true,
            nullsFirst: false,
          })
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("customers")
          .select("id, name, email, phone")
          .eq("company_id", membershipCompanyId)
          .order("name", {
            ascending: true,
          }),
      ]);

      if (jobsResult.error) {
        throw jobsResult.error;
      }

      if (customersResult.error) {
        throw customersResult.error;
      }

      const normalizedJobs: Job[] = (
        (jobsResult.data ?? []) as DatabaseRow[]
      ).map((row) => ({
        id: getString(row, "id"),
        company_id: getString(row, "company_id"),
        customer_id: getString(row, "customer_id") || null,
        title: getString(row, "title"),
        description: getString(row, "description") || null,
        status: getString(row, "status") || "scheduled",
        scheduled_date:
          getString(row, "scheduled_date") || null,
        estimated_value: getNumber(row, "estimated_value"),
        actual_value: getNumber(row, "actual_value"),
        created_at: getString(row, "created_at"),
        updated_at: getString(row, "updated_at"),
      }));

      const normalizedCustomers: Customer[] = (
        (customersResult.data ?? []) as DatabaseRow[]
      ).map((row) => ({
        id: getString(row, "id"),
        name: getString(row, "name"),
        email: getString(row, "email") || null,
        phone: getString(row, "phone") || null,
      }));

      setJobs(normalizedJobs);
      setCustomers(normalizedCustomers);
    } catch (error) {
      console.error("LOAD JOBS ERROR:", error);

      const supabaseError = error as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };

      setPageError(
        [
          supabaseError.code
            ? `Code: ${supabaseError.code}`
            : "",
          supabaseError.message
            ? `Message: ${supabaseError.message}`
            : "",
          supabaseError.details
            ? `Details: ${supabaseError.details}`
            : "",
          supabaseError.hint
            ? `Hint: ${supabaseError.hint}`
            : "",
        ]
          .filter(Boolean)
          .join(" | ") || "Failed to load jobs."
      );
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingJob(null);
    setModalError("");

    setForm({
      customer_id: "",
      title: "",
      description: "",
      status: "scheduled",
      scheduled_date: getTodayString(),
      estimated_value: "",
      actual_value: "",
    });

    setModalOpen(true);
  }

  function openEditModal(job: Job) {
    setEditingJob(job);
    setModalError("");

    setForm({
      customer_id: job.customer_id ?? "",
      title: job.title,
      description: job.description ?? "",
      status: job.status,
      scheduled_date: job.scheduled_date ?? "",
      estimated_value: String(job.estimated_value ?? ""),
      actual_value: String(job.actual_value ?? ""),
    });

    setModalOpen(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setModalOpen(false);
    setEditingJob(null);
    setModalError("");
  }

  function updateForm<K extends keyof JobForm>(
    field: K,
    value: JobForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function normalizeJob(row: DatabaseRow): Job {
    return {
      id: getString(row, "id"),
      company_id: getString(row, "company_id"),
      customer_id: getString(row, "customer_id") || null,
      title: getString(row, "title"),
      description: getString(row, "description") || null,
      status: getString(row, "status") || "scheduled",
      scheduled_date:
        getString(row, "scheduled_date") || null,
      estimated_value: getNumber(row, "estimated_value"),
      actual_value: getNumber(row, "actual_value"),
      created_at: getString(row, "created_at"),
      updated_at: getString(row, "updated_at"),
    };
  }

  async function saveJob() {
    if (!companyId) {
      setModalError(
        "Company information is not available."
      );
      return;
    }

    const title = form.title.trim();

    if (!title) {
      setModalError("Job title is required.");
      return;
    }

    const estimatedValue =
      form.estimated_value.trim() === ""
        ? 0
        : Number(form.estimated_value);

    const actualValue =
      form.actual_value.trim() === ""
        ? 0
        : Number(form.actual_value);

    if (
      !Number.isFinite(estimatedValue) ||
      estimatedValue < 0
    ) {
      setModalError(
        "Estimated value must be a valid non-negative number."
      );
      return;
    }

    if (
      !Number.isFinite(actualValue) ||
      actualValue < 0
    ) {
      setModalError(
        "Actual value must be a valid non-negative number."
      );
      return;
    }

    setSaving(true);
    setModalError("");

    try {
      const payload = {
        customer_id: form.customer_id || null,
        title,
        description: form.description.trim() || null,
        status: form.status,
        scheduled_date: form.scheduled_date || null,
        estimated_value: estimatedValue,
        actual_value: actualValue,
      };

      if (editingJob) {
        const { data, error } = await supabase
          .from("jobs")
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingJob.id)
          .eq("company_id", companyId)
          .select(
            `
              id,
              company_id,
              customer_id,
              title,
              description,
              status,
              scheduled_date,
              estimated_value,
              actual_value,
              created_at,
              updated_at
            `
          )
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const updatedJob = normalizeJob(
            data as DatabaseRow
          );

          setJobs((current) =>
            current.map((job) =>
              job.id === updatedJob.id
                ? updatedJob
                : job
            )
          );
        }
      } else {
        const { data, error } = await supabase
          .from("jobs")
          .insert({
            company_id: companyId,
            ...payload,
          })
          .select(
            `
              id,
              company_id,
              customer_id,
              title,
              description,
              status,
              scheduled_date,
              estimated_value,
              actual_value,
              created_at,
              updated_at
            `
          )
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const newJob = normalizeJob(
            data as DatabaseRow
          );

          setJobs((current) => [newJob, ...current]);
        }
      }

      closeModal();
    } catch (error) {
      console.error("SAVE JOB ERROR:", error);

      const supabaseError = error as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };

      setModalError(
        [
          supabaseError.code
            ? `Code: ${supabaseError.code}`
            : "",
          supabaseError.message
            ? `Message: ${supabaseError.message}`
            : "",
          supabaseError.details
            ? `Details: ${supabaseError.details}`
            : "",
          supabaseError.hint
            ? `Hint: ${supabaseError.hint}`
            : "",
        ]
          .filter(Boolean)
          .join(" | ") || "Failed to save job."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteJob() {
    if (!deleteTarget || !companyId) {
      return;
    }

    setDeleting(true);
    setPageError("");

    try {
      const { error } = await supabase
        .from("jobs")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("company_id", companyId);

      if (error) {
        throw error;
      }

      setJobs((current) =>
        current.filter(
          (job) => job.id !== deleteTarget.id
        )
      );

      setDeleteTarget(null);
    } catch (error) {
      console.error("DELETE JOB ERROR:", error);

      const supabaseError = error as {
        message?: string;
      };

      setPageError(
        supabaseError.message ||
          "Failed to delete job."
      );
    } finally {
      setDeleting(false);
    }
  }

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();

    customers.forEach((customer) => {
      map.set(customer.id, customer);
    });

    return map;
  }, [customers]);

  const filteredJobs = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return jobs.filter((job) => {
      const customer = job.customer_id
        ? customerMap.get(job.customer_id)
        : null;

      const matchesSearch =
        !searchTerm ||
        job.title.toLowerCase().includes(searchTerm) ||
        (job.description ?? "")
          .toLowerCase()
          .includes(searchTerm) ||
        (customer?.name ?? "")
          .toLowerCase()
          .includes(searchTerm);

      const matchesStatus =
        statusFilter === "all" ||
        job.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [jobs, search, statusFilter, customerMap]);

  const stats = useMemo(() => {
    const activeJobs = jobs.filter(
      (job) =>
        job.status !== "completed" &&
        job.status !== "cancelled" &&
        job.status !== "canceled"
    );

    const completedJobs = jobs.filter(
      (job) => job.status === "completed"
    );

    const estimatedPipeline = activeJobs.reduce(
      (total, job) =>
        total + (job.estimated_value || 0),
      0
    );

    return {
      total: jobs.length,
      active: activeJobs.length,
      completed: completedJobs.length,
      estimatedPipeline,
    };
  }, [jobs]);

  const upcomingJobs = useMemo(() => {
    return jobs
      .filter(
        (job) =>
          job.status === "scheduled" &&
          !!job.scheduled_date
      )
      .sort((a, b) =>
        (a.scheduled_date ?? "").localeCompare(
          b.scheduled_date ?? ""
        )
      )
      .slice(0, 5);
  }, [jobs]);

  return (
    <AppShell
      title="Jobs"
      description="Manage scheduled work, job values, and customer projects."
      actions={
        <button
          type="button"
          className="sbs-primary-button"
          onClick={openAddModal}
        >
          <span className="sbs-button-plus">+</span>
          New Job
        </button>
      }
    >
      <div className="jobs-page">
        {pageError && (
          <div className="sbs-error-banner">
            {pageError}
          </div>
        )}

        <section className="jobs-stats-grid">
          <div className="jobs-stat-card">
            <div className="jobs-stat-label">
              Total Jobs
            </div>

            <div className="jobs-stat-value">
              {loading ? "—" : stats.total}
            </div>

            <div className="jobs-stat-note">
              All jobs in workspace
            </div>
          </div>

          <div className="jobs-stat-card">
            <div className="jobs-stat-label">
              Active Jobs
            </div>

            <div className="jobs-stat-value">
              {loading ? "—" : stats.active}
            </div>

            <div className="jobs-stat-note">
              Scheduled or in progress
            </div>
          </div>

          <div className="jobs-stat-card">
            <div className="jobs-stat-label">
              Completed
            </div>

            <div className="jobs-stat-value">
              {loading ? "—" : stats.completed}
            </div>

            <div className="jobs-stat-note">
              Successfully completed
            </div>
          </div>

          <div className="jobs-stat-card">
            <div className="jobs-stat-label">
              Estimated Pipeline
            </div>

            <div className="jobs-stat-value">
              {loading
                ? "—"
                : formatCurrency(
                    stats.estimatedPipeline
                  )}
            </div>

            <div className="jobs-stat-note">
              Active estimated value
            </div>
          </div>
        </section>

        <section className="sbs-card jobs-card">
          <div className="jobs-toolbar">
            <div>
              <h2>All Jobs</h2>

              <p>
                {loading
                  ? "Loading jobs..."
                  : `${filteredJobs.length} ${
                      filteredJobs.length === 1
                        ? "job"
                        : "jobs"
                    }`}
              </p>
            </div>

            <div className="jobs-toolbar-controls">
              <div className="jobs-search">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                </svg>

                <input
                  type="text"
                  placeholder="Search jobs or customers..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              <select
                className="jobs-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">
                  All statuses
                </option>

                {STATUS_OPTIONS.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="sbs-empty-state jobs-loading-state">
              <div className="sbs-spinner" />

              <h3>Loading jobs...</h3>

              <p>
                Getting your job data from the database.
              </p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="sbs-empty-state">
              <div className="sbs-empty-icon">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4h16v16H4z" />
                  <path d="M8 8h8M8 12h6M8 16h4" />
                </svg>
              </div>

              <h3>
                {jobs.length === 0
                  ? "No jobs yet"
                  : "No jobs found"}
              </h3>

              <p>
                {jobs.length === 0
                  ? "Create your first job to start tracking work."
                  : "Try changing your search or status filter."}
              </p>

              {jobs.length === 0 && (
                <button
                  type="button"
                  className="sbs-primary-button"
                  onClick={openAddModal}
                >
                  <span className="sbs-button-plus">+</span>
                  Create First Job
                </button>
              )}
            </div>
          ) : (
            <div className="jobs-table-wrapper">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>JOB</th>
                    <th>CUSTOMER</th>
                    <th>STATUS</th>
                    <th>SCHEDULED</th>
                    <th>ESTIMATED</th>
                    <th>ACTUAL</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredJobs.map((job) => {
                    const customer = job.customer_id
                      ? customerMap.get(
                          job.customer_id
                        )
                      : null;

                    return (
                      <tr key={job.id}>
                        <td>
                          <div className="jobs-job-cell">
                            <div className="jobs-job-icon">
                              <svg
                                width="17"
                                height="17"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M4 4h16v16H4z" />
                                <path d="M8 8h8M8 12h6M8 16h4" />
                              </svg>
                            </div>

                            <div className="jobs-job-details">
                              <strong>{job.title}</strong>

                              <span>
                                {job.description ||
                                  "No description"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {customer ? (
                            <div className="jobs-customer-cell">
                              <div className="jobs-customer-avatar">
                                {getInitials(
                                  customer.name
                                )}
                              </div>

                              <div>
                                <strong>
                                  {customer.name}
                                </strong>

                                {customer.phone && (
                                  <span>
                                    {customer.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="jobs-unassigned">
                              No customer
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            className={`jobs-status ${getStatusClass(
                              job.status
                            )}`}
                          >
                            {formatStatus(
                              job.status
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="jobs-date">
                            {formatDate(
                              job.scheduled_date
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="jobs-money">
                            {formatCurrency(
                              job.estimated_value
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="jobs-money">
                            {formatCurrency(
                              job.actual_value
                            )}
                          </span>
                        </td>

                        <td>
                          <div className="jobs-row-actions">
                            <button
                              type="button"
                              className="sbs-action-button"
                              onClick={() =>
                                openEditModal(job)
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="sbs-action-button sbs-action-danger"
                              onClick={() =>
                                setDeleteTarget(job)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="sbs-card upcoming-card">
          <div className="jobs-card-header">
            <div>
              <h2>Upcoming Jobs</h2>
              <p>Your next scheduled work</p>
            </div>
          </div>

          {loading ? (
            <div className="sbs-empty-state jobs-loading-state">
              <div className="sbs-spinner" />
              <h3>Loading...</h3>
            </div>
          ) : upcomingJobs.length === 0 ? (
            <div className="sbs-empty-state">
              <div className="sbs-empty-icon">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="17"
                    rx="2"
                  />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>

              <h3>No upcoming jobs</h3>

              <p>
                Scheduled jobs will appear here.
              </p>
            </div>
          ) : (
            <div className="jobs-list">
              {upcomingJobs.map((job) => {
                const customer = job.customer_id
                  ? customerMap.get(
                      job.customer_id
                    )
                  : null;

                return (
                  <div
                    className="job-row"
                    key={job.id}
                  >
                    <div className="job-date">
                      <strong>
                        {formatShortDate(
                          job.scheduled_date
                        )}
                      </strong>
                    </div>

                    <div className="job-info">
                      <strong>{job.title}</strong>

                      <span>
                        {customer
                          ? customer.name
                          : "No customer assigned"}
                      </span>
                    </div>

                    <div className="job-right">
                      <span
                        className={`jobs-status ${getStatusClass(
                          job.status
                        )}`}
                      >
                        {formatStatus(
                          job.status
                        )}
                      </span>

                      <strong>
                        {formatCurrency(
                          job.estimated_value
                        )}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {modalOpen && (
          <div
            className="sbs-modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeModal();
              }
            }}
          >
            <div className="sbs-modal jobs-modal">
              <div className="sbs-modal-header">
                <div>
                  <div className="sbs-eyebrow">
                    {editingJob
                      ? "JOB"
                      : "NEW JOB"}
                  </div>

                  <h2>
                    {editingJob
                      ? "Edit Job"
                      : "Create New Job"}
                  </h2>

                  <p>
                    {editingJob
                      ? "Update the job details below."
                      : "Add a new job to your workspace."}
                  </p>
                </div>

                <button
                  type="button"
                  className="sbs-modal-close"
                  onClick={closeModal}
                  disabled={saving}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {modalError && (
                <div className="sbs-error-banner jobs-modal-error">
                  {modalError}
                </div>
              )}

              <div className="jobs-form">
                <div className="jobs-form-group jobs-form-full">
                  <label htmlFor="job-title">
                    Job Title *
                  </label>

                  <input
                    id="job-title"
                    type="text"
                    placeholder="e.g. Roof replacement"
                    value={form.title}
                    onChange={(event) =>
                      updateForm(
                        "title",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="jobs-form-group">
                  <label htmlFor="job-customer">
                    Customer
                  </label>

                  <select
                    id="job-customer"
                    value={form.customer_id}
                    onChange={(event) =>
                      updateForm(
                        "customer_id",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      No customer assigned
                    </option>

                    {customers.map((customer) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="jobs-form-group">
                  <label htmlFor="job-status">
                    Status
                  </label>

                  <select
                    id="job-status"
                    value={form.status}
                    onChange={(event) =>
                      updateForm(
                        "status",
                        event.target.value
                      )
                    }
                  >
                    {STATUS_OPTIONS.map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {formatStatus(
                            status
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="jobs-form-group">
                  <label htmlFor="job-date">
                    Scheduled Date
                  </label>

                  <input
                    id="job-date"
                    type="date"
                    value={
                      form.scheduled_date
                    }
                    onChange={(event) =>
                      updateForm(
                        "scheduled_date",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="jobs-form-group">
                  <label htmlFor="job-estimated">
                    Estimated Value
                  </label>

                  <input
                    id="job-estimated"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={
                      form.estimated_value
                    }
                    onChange={(event) =>
                      updateForm(
                        "estimated_value",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="jobs-form-group">
                  <label htmlFor="job-actual">
                    Actual Value
                  </label>

                  <input
                    id="job-actual"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.actual_value}
                    onChange={(event) =>
                      updateForm(
                        "actual_value",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="jobs-form-group jobs-form-full">
                  <label htmlFor="job-description">
                    Description
                  </label>

                  <textarea
                    id="job-description"
                    rows={4}
                    placeholder="Add job details, scope of work, notes..."
                    value={form.description}
                    onChange={(event) =>
                      updateForm(
                        "description",
                        event.target.value
                      )
                    }
                  />
                </div>
              </div>

              <div className="sbs-modal-actions">
                <button
                  type="button"
                  className="sbs-secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="sbs-primary-button"
                  onClick={saveJob}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingJob
                      ? "Save Changes"
                      : "Create Job"}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div
            className="sbs-modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target ===
                  event.currentTarget &&
                !deleting
              ) {
                setDeleteTarget(null);
              }
            }}
          >
            <div className="sbs-delete-modal">
              <div className="sbs-delete-icon">
                !
              </div>

              <h2>Delete Job?</h2>

              <p>
                Are you sure you want to delete{" "}
                <strong>
                  {deleteTarget.title}
                </strong>
                ? This action cannot be undone.
              </p>

              <div className="sbs-modal-actions">
                <button
                  type="button"
                  className="sbs-secondary-button"
                  onClick={() =>
                    setDeleteTarget(null)
                  }
                  disabled={deleting}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="sbs-delete-confirm"
                  onClick={deleteJob}
                  disabled={deleting}
                >
                  {deleting
                    ? "Deleting..."
                    : "Delete Job"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .jobs-page {
          width: 100%;
        }

        .sbs-card {
          background: #fff;
          border: 1px solid var(--sbs-border);
          border-radius: var(--sbs-radius);
          box-shadow: var(--sbs-shadow-sm);
        }

        .jobs-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .jobs-stat-card {
          min-width: 0;
          padding: 17px 18px;
          background: #fff;
          border: 1px solid var(--sbs-border);
          border-radius: var(--sbs-radius);
          box-shadow: var(--sbs-shadow-sm);
        }

        .jobs-stat-label {
          color: var(--sbs-text-muted);
          font-size: 9px;
          line-height: 14px;
          font-weight: 750;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .jobs-stat-value {
          margin-top: 5px;
          color: var(--sbs-text);
          font-size: 22px;
          line-height: 28px;
          font-weight: 750;
          letter-spacing: -0.025em;
        }

        .jobs-stat-note {
          margin-top: 3px;
          color: var(--sbs-text-muted);
          font-size: 10px;
          line-height: 15px;
        }

        .jobs-card {
          overflow: hidden;
          margin-bottom: 16px;
        }

        .jobs-toolbar {
          min-height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--sbs-border);
        }

        .jobs-toolbar h2,
        .jobs-card-header h2 {
          margin: 0;
          color: var(--sbs-text);
          font-size: 13px;
          line-height: 19px;
          font-weight: 700;
        }

        .jobs-toolbar p,
        .jobs-card-header p {
          margin: 2px 0 0;
          color: var(--sbs-text-muted);
          font-size: 10px;
          line-height: 15px;
        }

        .jobs-toolbar-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .jobs-search {
          width: 245px;
          height: 38px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          border: 1px solid var(--sbs-border);
          border-radius: 8px;
          background: var(--sbs-surface-soft);
          color: var(--sbs-text-muted);
        }

        .jobs-search:focus-within {
          border-color: var(--sbs-border-strong);
          background: #fff;
          box-shadow: 0 0 0 3px rgba(23, 32, 51, 0.045);
        }

        .jobs-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--sbs-text);
          font: inherit;
          font-size: 11px;
        }

        .jobs-search input::placeholder {
          color: var(--sbs-text-muted);
        }

        .jobs-filter {
          height: 38px;
          min-width: 132px;
          padding: 0 10px;
          border: 1px solid var(--sbs-border);
          border-radius: 8px;
          outline: 0;
          background: #fff;
          color: var(--sbs-text-soft);
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .jobs-filter:focus {
          border-color: var(--sbs-border-strong);
          box-shadow: 0 0 0 3px rgba(23, 32, 51, 0.045);
        }

        .jobs-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .jobs-table {
          width: 100%;
          min-width: 1020px;
          border-collapse: collapse;
        }

        .jobs-table th {
          height: 43px;
          padding: 0 14px;
          border-bottom: 1px solid var(--sbs-border);
          background: var(--sbs-surface-soft);
          color: var(--sbs-text-muted);
          font-size: 9px;
          line-height: 13px;
          font-weight: 750;
          letter-spacing: 0.06em;
          text-align: left;
          white-space: nowrap;
        }

        .jobs-table td {
          height: 72px;
          padding: 10px 14px;
          border-bottom: 1px solid var(--sbs-border);
          color: var(--sbs-text-soft);
          font-size: 11px;
          vertical-align: middle;
        }

        .jobs-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .jobs-table tbody tr:hover {
          background: #fbfcfd;
        }

        .jobs-job-cell,
        .jobs-customer-cell {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }

        .jobs-job-icon {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: var(--sbs-primary-soft);
          color: var(--sbs-primary);
        }

        .jobs-job-details {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .jobs-job-details strong,
        .jobs-customer-cell strong {
          color: var(--sbs-text);
          font-size: 11px;
          line-height: 16px;
          font-weight: 650;
        }

        .jobs-job-details span,
        .jobs-customer-cell span {
          max-width: 210px;
          overflow: hidden;
          color: var(--sbs-text-muted);
          font-size: 9px;
          line-height: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .jobs-customer-avatar {
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: var(--sbs-primary);
          color: #fff;
          font-size: 9px;
          font-weight: 750;
        }

        .jobs-unassigned {
          color: var(--sbs-text-muted);
          font-size: 10px;
        }

        .jobs-status {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 9px;
          line-height: 13px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-scheduled {
          background: #eef4ff;
          color: #365f9d;
        }

        .status-in-progress {
          background: #fff6e5;
          color: #9a6a16;
        }

        .status-completed {
          background: #edf8f1;
          color: #32724b;
        }

        .status-cancelled {
          background: #fff0ef;
          color: #a24740;
        }

        .jobs-date {
          color: var(--sbs-text-soft);
          white-space: nowrap;
        }

        .jobs-money {
          color: var(--sbs-text);
          font-weight: 650;
          white-space: nowrap;
        }

        .jobs-row-actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .sbs-action-button {
          height: 29px;
          padding: 0 8px;
          border: 1px solid var(--sbs-border);
          border-radius: 7px;
          background: #fff;
          color: var(--sbs-text-soft);
          font: inherit;
          font-size: 9px;
          font-weight: 650;
          cursor: pointer;
          white-space: nowrap;
          transition:
            background 150ms ease,
            border-color 150ms ease,
            color 150ms ease;
        }

        .sbs-action-button:hover {
          background: var(--sbs-surface-soft);
          border-color: var(--sbs-border-strong);
          color: var(--sbs-text);
        }

        .sbs-action-danger:hover {
          background: #fff5f4;
          border-color: #f2c6c2;
          color: var(--sbs-danger);
        }

        .jobs-loading-state {
          min-height: 250px;
        }

        .sbs-empty-state {
          min-height: 270px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 36px 20px;
          text-align: center;
        }

        .sbs-empty-state h3 {
          margin: 13px 0 0;
          color: var(--sbs-text);
          font-size: 14px;
          line-height: 20px;
          font-weight: 700;
        }

        .sbs-empty-state p {
          max-width: 390px;
          margin: 5px 0 18px;
          color: var(--sbs-text-muted);
          font-size: 11px;
          line-height: 17px;
        }

        .sbs-empty-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: var(--sbs-primary-soft);
          color: var(--sbs-primary);
        }

        .sbs-spinner {
          width: 26px;
          height: 26px;
          border: 2px solid #e3e8ee;
          border-top-color: var(--sbs-primary);
          border-radius: 50%;
          animation: jobs-spin 0.75s linear infinite;
        }

        @keyframes jobs-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .jobs-card-header {
          padding: 17px 18px;
          border-bottom: 1px solid var(--sbs-border);
        }

        .upcoming-card {
          overflow: hidden;
        }

        .jobs-list {
          width: 100%;
        }

        .job-row {
          min-height: 65px;
          display: grid;
          grid-template-columns: 80px minmax(0, 1fr) auto;
          align-items: center;
          gap: 15px;
          padding: 10px 18px;
          border-bottom: 1px solid var(--sbs-border);
        }

        .job-row:last-child {
          border-bottom: 0;
        }

        .job-date strong {
          color: var(--sbs-text);
          font-size: 11px;
          font-weight: 700;
        }

        .job-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .job-info strong {
          overflow: hidden;
          color: var(--sbs-text);
          font-size: 11px;
          line-height: 16px;
          font-weight: 650;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .job-info span {
          overflow: hidden;
          color: var(--sbs-text-muted);
          font-size: 9px;
          line-height: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .job-right {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .job-right > strong {
          min-width: 70px;
          color: var(--sbs-text);
          font-size: 10px;
          text-align: right;
        }

        .sbs-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 300;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.42);
          backdrop-filter: blur(3px);
        }

        .sbs-modal {
          width: min(100%, 720px);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          background: #fff;
          border: 1px solid var(--sbs-border);
          border-radius: 16px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.2);
        }

        .sbs-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 21px 22px 18px;
          border-bottom: 1px solid var(--sbs-border);
        }

        .sbs-eyebrow {
          color: var(--sbs-text-muted);
          font-size: 9px;
          line-height: 13px;
          font-weight: 750;
          letter-spacing: 0.08em;
        }

        .sbs-modal-header h2 {
          margin: 3px 0 0;
          color: var(--sbs-text);
          font-size: 19px;
          line-height: 25px;
          font-weight: 750;
        }

        .sbs-modal-header p {
          margin: 4px 0 0;
          color: var(--sbs-text-muted);
          font-size: 10px;
          line-height: 15px;
        }

        .sbs-modal-close {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--sbs-text-muted);
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
        }

        .sbs-modal-close:hover {
          background: var(--sbs-surface-soft);
          color: var(--sbs-text);
        }

        .jobs-modal-error {
          margin: 18px 22px 0;
        }

        .jobs-form {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          padding: 22px;
        }

        .jobs-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .jobs-form-full {
          grid-column: 1 / -1;
        }

        .jobs-form-group label {
          color: var(--sbs-text);
          font-size: 11px;
          line-height: 16px;
          font-weight: 650;
        }

        .jobs-form-group input,
        .jobs-form-group select,
        .jobs-form-group textarea {
          width: 100%;
          border: 1px solid var(--sbs-border);
          border-radius: 8px;
          outline: 0;
          background: #fff;
          color: var(--sbs-text);
          font: inherit;
          font-size: 12px;
          transition:
            border-color 150ms ease,
            box-shadow 150ms ease;
        }

        .jobs-form-group input,
        .jobs-form-group select {
          height: 40px;
          padding: 0 11px;
        }

        .jobs-form-group textarea {
          min-height: 96px;
          padding: 10px 11px;
          resize: vertical;
          line-height: 18px;
        }

        .jobs-form-group input:focus,
        .jobs-form-group select:focus,
        .jobs-form-group textarea:focus {
          border-color: var(--sbs-border-strong);
          box-shadow: 0 0 0 3px rgba(23, 32, 51, 0.045);
        }

        .jobs-form-group input::placeholder,
        .jobs-form-group textarea::placeholder {
          color: #a0a9b4;
        }

        .sbs-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 16px 22px 20px;
          border-top: 1px solid var(--sbs-border);
        }

        .sbs-primary-button,
        .sbs-secondary-button,
        .sbs-delete-confirm {
          height: 39px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 9px;
          padding: 0 14px;
          font: inherit;
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
          transition:
            background 150ms ease,
            border-color 150ms ease,
            color 150ms ease,
            transform 100ms ease;
        }

        .sbs-primary-button {
          border: 1px solid var(--sbs-primary);
          background: var(--sbs-primary);
          color: #fff;
        }

        .sbs-primary-button:hover {
          background: var(--sbs-primary-hover);
          border-color: var(--sbs-primary-hover);
        }

        .sbs-primary-button:active {
          transform: translateY(1px);
        }

        .sbs-secondary-button {
          border: 1px solid var(--sbs-border);
          background: #fff;
          color: var(--sbs-text-soft);
        }

        .sbs-secondary-button:hover {
          background: var(--sbs-surface-soft);
          border-color: var(--sbs-border-strong);
          color: var(--sbs-text);
        }

        .sbs-primary-button:disabled,
        .sbs-secondary-button:disabled,
        .sbs-delete-confirm:disabled,
        .sbs-action-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .sbs-button-plus {
          font-size: 16px;
          line-height: 1;
          font-weight: 400;
          margin-top: -1px;
        }

        .sbs-delete-modal {
          width: min(100%, 420px);
          padding: 26px;
          background: #fff;
          border: 1px solid var(--sbs-border);
          border-radius: 16px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.2);
          text-align: center;
        }

        .sbs-delete-icon {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          margin: 0 auto 14px;
          border-radius: 50%;
          background: #fff0ef;
          color: var(--sbs-danger);
          font-size: 18px;
          font-weight: 800;
        }

        .sbs-delete-modal h2 {
          margin: 0;
          color: var(--sbs-text);
          font-size: 18px;
          line-height: 24px;
        }

        .sbs-delete-modal p {
          margin: 8px 0 0;
          color: var(--sbs-text-soft);
          font-size: 11px;
          line-height: 18px;
        }

        .sbs-delete-modal .sbs-modal-actions {
          margin-top: 22px;
          padding: 16px 0 0;
        }

        .sbs-delete-confirm {
          border: 1px solid var(--sbs-danger);
          background: var(--sbs-danger);
          color: #fff;
        }

        .sbs-delete-confirm:hover {
          filter: brightness(0.94);
        }

        @media (max-width: 1100px) {
          .jobs-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .jobs-toolbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .jobs-toolbar-controls {
            width: 100%;
          }

          .jobs-search {
            flex: 1;
            width: auto;
          }
        }

        @media (max-width: 700px) {
          .jobs-stats-grid {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .jobs-stat-card {
            padding: 14px;
          }

          .jobs-stat-value {
            font-size: 19px;
            line-height: 25px;
          }

          .jobs-toolbar {
            padding: 13px;
          }

          .jobs-toolbar-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .jobs-search,
          .jobs-filter {
            width: 100%;
          }

          .jobs-form {
            grid-template-columns: 1fr;
            padding: 18px;
          }

          .jobs-form-full {
            grid-column: auto;
          }

          .sbs-modal-overlay {
            align-items: flex-end;
            padding: 0;
          }

          .sbs-modal {
            width: 100%;
            max-height: 94vh;
            border-radius: 16px 16px 0 0;
          }

          .sbs-modal-header {
            padding: 18px;
          }

          .jobs-modal-error {
            margin: 16px 18px 0;
          }

          .sbs-modal-actions {
            position: sticky;
            bottom: 0;
            background: #fff;
            padding: 14px 18px;
          }

          .sbs-modal-actions button {
            flex: 1;
          }

          .job-row {
            grid-template-columns: 60px minmax(0, 1fr);
            gap: 10px;
            padding: 12px 14px;
          }

          .job-right {
            grid-column: 2;
            justify-content: space-between;
          }

          .job-right > strong {
            text-align: left;
          }
        }

        @media (max-width: 430px) {
          .jobs-stats-grid {
            grid-template-columns: 1fr;
          }

          .jobs-stat-card {
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            column-gap: 12px;
          }

          .jobs-stat-label {
            grid-column: 1;
          }

          .jobs-stat-value {
            grid-column: 2;
            grid-row: 1 / span 2;
          }

          .jobs-stat-note {
            grid-column: 1;
          }
        }
      `}</style>
    </AppShell>
  );
}