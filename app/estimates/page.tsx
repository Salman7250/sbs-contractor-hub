"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { useRegionalSettings } from "@/app/components/regional-settings-provider";
import { createClient } from "@/lib/supabase/client";
import { formatMoney as formatRegionalMoney } from "@/lib/regional-settings";

type DatabaseRow = Record<string, unknown>;

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Estimate = {
  id: string;
  company_id: string;
  customer_id: string | null;
  lead_id: string | null;
  estimate_number: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type EstimateForm = {
  customer_id: string;
  lead_id: string;
  estimate_number: string;
  status: string;
  subtotal: string;
  tax: string;
  valid_until: string;
  notes: string;
};

const ESTIMATE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
];

const ESTIMATE_SELECT =
  "id, company_id, customer_id, lead_id, estimate_number, status, subtotal, tax, total, valid_until, notes, created_at, updated_at";

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatDate(value: string | null): string {
  if (!value) return "—";

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

function formatStatus(status: string): string {
  if (!status) return "Unknown";

  return status
    .split("-")
    .map(
      (word) => word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

function getStatusClass(status: string): string {
  switch (status) {
    case "draft":
      return "estimate-status estimate-status-draft";

    case "sent":
      return "estimate-status estimate-status-sent";

    case "accepted":
      return "estimate-status estimate-status-accepted";

    case "declined":
      return "estimate-status estimate-status-declined";

    case "expired":
      return "estimate-status estimate-status-expired";

    default:
      return "estimate-status";
  }
}

function getInitials(name: string): string {
  if (!name.trim()) return "—";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getTodayString(): string {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultValidUntil(): string {
  const date = new Date();

  date.setDate(date.getDate() + 30);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function mapEstimate(row: DatabaseRow): Estimate {
  return {
    id: getString(row.id),
    company_id: getString(row.company_id),
    customer_id: getString(row.customer_id) || null,
    lead_id: getString(row.lead_id) || null,
    estimate_number: getString(row.estimate_number),
    status: getString(row.status),
    subtotal: getNumber(row.subtotal),
    tax: getNumber(row.tax),
    total: getNumber(row.total),
    valid_until: getString(row.valid_until) || null,
    notes: getString(row.notes) || null,
    created_at: getString(row.created_at),
    updated_at: getString(row.updated_at),
  };
}

function mapCustomer(row: DatabaseRow): Customer {
  return {
    id: getString(row.id),
    name: getString(row.name),
    email: getString(row.email) || null,
    phone: getString(row.phone) || null,
  };
}

function mapLead(row: DatabaseRow): Lead {
  return {
    id: getString(row.id),
    name: getString(row.name),
    email: getString(row.email) || null,
    phone: getString(row.phone) || null,
  };
}

function Icon({
  name,
  size = 18,
}: {
  name:
    | "plus"
    | "search"
    | "filter"
    | "document"
    | "clock"
    | "check"
    | "send"
    | "money"
    | "edit"
    | "eye"
    | "copy"
    | "trash"
    | "close"
    | "chevron";
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
    "aria-hidden": true,
  };

  switch (name) {
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      );

    case "filter":
      return (
        <svg {...common}>
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
      );

    case "document":
      return (
        <svg {...common}>
          <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
          <path d="M14 3.5V8h4M9 12h6M9 16h6" />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m6.5 12.5 3.5 3.5 7.5-8" />
        </svg>
      );

    case "send":
      return (
        <svg {...common}>
          <path d="m4 4 16 8-16 8 3-8-3-8Z" />
          <path d="M7 12h13" />
        </svg>
      );

    case "money":
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M7 9h.01M17 15h.01" />
        </svg>
      );

    case "edit":
      return (
        <svg {...common}>
          <path d="m4 16.5-.8 3.3 3.3-.8L17.8 7.7a1.8 1.8 0 0 0-2.5-2.5L4 16.5Z" />
          <path d="m13.8 6.2 4 4" />
        </svg>
      );

    case "eye":
      return (
        <svg {...common}>
          <path d="M2.8 12s3.2-5 9.2-5 9.2 5 9.2 5-3.2 5-9.2 5-9.2-5-9.2-5Z" />
          <circle cx="12" cy="12" r="2.2" />
        </svg>
      );

    case "copy":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="11" height="11" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
      );

    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16M9 7V4h6v3M7 7l.7 13h8.6L17 7M10 11v5M14 11v5" />
        </svg>
      );

    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );

    default:
      return null;
  }
}

export default function EstimatesPage() {
  const { settings } = useRegionalSettings();
  const formatCurrency = (value: number) =>
    formatRegionalMoney(value, settings);

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  const [editingEstimate, setEditingEstimate] =
    useState<Estimate | null>(null);

  const [viewingEstimate, setViewingEstimate] =
    useState<Estimate | null>(null);

  const [form, setForm] = useState<EstimateForm>({
    customer_id: "",
    lead_id: "",
    estimate_number: "",
    status: "draft",
    subtotal: "",
    tax: "",
    valid_until: getDefaultValidUntil(),
    notes: "",
  });

  const getCompanyMembership = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw new Error(authError.message);
    }

    if (!user) {
      router.replace("/login");
      return null;
    }

    const { data, error } = await supabase
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const membership = data as DatabaseRow | null;
    const currentCompanyId = getString(membership?.company_id);

    if (!currentCompanyId) {
      throw new Error(
        "No company membership was found for this account."
      );
    }

    return currentCompanyId;
  }, [router, supabase]);

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setPageError("");

      const currentCompanyId = await getCompanyMembership();

      if (!currentCompanyId) {
        return;
      }

      setCompanyId(currentCompanyId);

      const [
        { data: estimateData, error: estimateError },
        { data: customerData, error: customerError },
        { data: leadData, error: leadError },
      ] = await Promise.all([
        supabase
          .from("estimates")
          .select(ESTIMATE_SELECT)
          .eq("company_id", currentCompanyId)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("customers")
          .select("id, name, email, phone")
          .eq("company_id", currentCompanyId)
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("leads")
          .select("id, name, email, phone")
          .eq("company_id", currentCompanyId)
          .order("name", {
            ascending: true,
          }),
      ]);

      if (estimateError) {
        throw new Error(estimateError.message);
      }

      if (customerError) {
        console.error(
          "Customers could not be loaded:",
          customerError
        );
      }

      if (leadError) {
        console.error(
          "Leads could not be loaded:",
          leadError
        );
      }

      const mappedEstimates = (
        (estimateData ?? []) as DatabaseRow[]
      ).map(mapEstimate);

      const mappedCustomers = (
        (customerData ?? []) as DatabaseRow[]
      ).map(mapCustomer);

      const mappedLeads = (
        (leadData ?? []) as DatabaseRow[]
      ).map(mapLead);

      setEstimates(mappedEstimates);
      setCustomers(mappedCustomers);
      setLeads(mappedLeads);
    } catch (error) {
      console.error("Estimates page error:", error);

      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to load estimates."
      );
    } finally {
      setLoading(false);
    }
  }, [getCompanyMembership, supabase]);

  useEffect(() => {
    // This effect synchronizes the page with asynchronously loaded
    // Supabase data. The state updates occur inside the async operation.
     
    void loadPage();
  }, [loadPage]);

  const generateEstimateNumber = useCallback((): string => {
    const year = new Date().getFullYear();

    const highestExistingNumber = estimates.reduce(
      (highest, estimate) => {
        const match = estimate.estimate_number.match(
          /^EST-\d{4}-(\d+)$/
        );

        if (!match) {
          return highest;
        }

        const number = Number(match[1]);

        return Number.isFinite(number)
          ? Math.max(highest, number)
          : highest;
      },
      0
    );

    return `EST-${year}-${String(
      highestExistingNumber + 1
    ).padStart(4, "0")}`;
  }, [estimates]);

  function openAddModal() {
    setEditingEstimate(null);

    setForm({
      customer_id: "",
      lead_id: "",
      estimate_number: generateEstimateNumber(),
      status: "draft",
      subtotal: "",
      tax: "",
      valid_until: getDefaultValidUntil(),
      notes: "",
    });

    setShowModal(true);
  }

  function openEditModal(estimate: Estimate) {
    setEditingEstimate(estimate);

    setForm({
      customer_id: estimate.customer_id ?? "",
      lead_id: estimate.lead_id ?? "",
      estimate_number: estimate.estimate_number,
      status: estimate.status,
      subtotal: String(estimate.subtotal),
      tax: String(estimate.tax),
      valid_until: estimate.valid_until ?? "",
      notes: estimate.notes ?? "",
    });

    setShowModal(true);
  }

  function openViewModal(estimate: Estimate) {
    setViewingEstimate(estimate);
    setShowViewModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingEstimate(null);
  }

  function closeViewModal() {
    setShowViewModal(false);
    setViewingEstimate(null);
  }

  async function handleSaveEstimate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!companyId) {
      alert("Company information is not available.");
      return;
    }

    if (!form.estimate_number.trim()) {
      alert("Please enter an estimate number.");
      return;
    }

    if (!form.customer_id && !form.lead_id) {
      alert("Please select a customer or lead.");
      return;
    }

    setSaving(true);

    try {
      const subtotal = Math.max(
        0,
        Number(form.subtotal) || 0
      );

      const tax = Math.max(0, Number(form.tax) || 0);

      const total = subtotal + tax;

      const payload = {
        company_id: companyId,
        customer_id: form.customer_id || null,
        lead_id: form.lead_id || null,
        estimate_number: form.estimate_number.trim(),
        status: form.status,
        subtotal,
        tax,
        total,
        valid_until: form.valid_until || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingEstimate) {
        const { data, error } = await supabase
          .from("estimates")
          .update(payload)
          .eq("id", editingEstimate.id)
          .eq("company_id", companyId)
          .select(ESTIMATE_SELECT)
          .single();

        if (error) {
          throw new Error(error.message);
        }

        const updatedEstimate = mapEstimate(
          data as DatabaseRow
        );

        setEstimates((current) =>
          current.map((estimate) =>
            estimate.id === updatedEstimate.id
              ? updatedEstimate
              : estimate
          )
        );
      } else {
        const { data, error } = await supabase
          .from("estimates")
          .insert(payload)
          .select(ESTIMATE_SELECT)
          .single();

        if (error) {
          throw new Error(error.message);
        }

        const newEstimate = mapEstimate(
          data as DatabaseRow
        );

        setEstimates((current) => [
          newEstimate,
          ...current,
        ]);
      }

      closeModal();
    } catch (error) {
      console.error("Save estimate error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving the estimate."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEstimate(
    estimate: Estimate
  ) {
    if (!companyId) return;

    const confirmed = window.confirm(
      `Delete ${estimate.estimate_number}? This action cannot be undone.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("estimates")
      .delete()
      .eq("id", estimate.id)
      .eq("company_id", companyId);

    if (error) {
      console.error(
        "Delete estimate error:",
        error
      );

      alert(
        `Could not delete estimate: ${error.message}`
      );

      return;
    }

    setEstimates((current) =>
      current.filter(
        (item) => item.id !== estimate.id
      )
    );

    if (viewingEstimate?.id === estimate.id) {
      closeViewModal();
    }
  }

  async function handleStatusChange(
    estimate: Estimate,
    status: string
  ) {
    if (!companyId || estimate.status === status) {
      return;
    }

    const { data, error } = await supabase
      .from("estimates")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", estimate.id)
      .eq("company_id", companyId)
      .select(ESTIMATE_SELECT)
      .single();

    if (error) {
      console.error(
        "Update estimate status error:",
        error
      );

      alert(
        `Could not update status: ${error.message}`
      );

      return;
    }

    const updatedEstimate = mapEstimate(
      data as DatabaseRow
    );

    setEstimates((current) =>
      current.map((item) =>
        item.id === updatedEstimate.id
          ? updatedEstimate
          : item
      )
    );

    if (viewingEstimate?.id === updatedEstimate.id) {
      setViewingEstimate(updatedEstimate);
    }
  }

  async function handleDuplicateEstimate(
    estimate: Estimate
  ) {
    if (!companyId) return;

    setSaving(true);

    try {
      const payload = {
        company_id: companyId,
        customer_id: estimate.customer_id,
        lead_id: estimate.lead_id,
        estimate_number: generateEstimateNumber(),
        status: "draft",
        subtotal: estimate.subtotal,
        tax: estimate.tax,
        total: estimate.total,
        valid_until: getDefaultValidUntil(),
        notes: estimate.notes,
      };

      const { data, error } = await supabase
        .from("estimates")
        .insert(payload)
        .select(ESTIMATE_SELECT)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const duplicated = mapEstimate(
        data as DatabaseRow
      );

      setEstimates((current) => [
        duplicated,
        ...current,
      ]);

      closeViewModal();
      openEditModal(duplicated);
    } catch (error) {
      console.error(
        "Duplicate estimate error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Could not duplicate estimate."
      );
    } finally {
      setSaving(false);
    }
  }

  const customerMap = useMemo(
    () =>
      new Map(
        customers.map((customer) => [
          customer.id,
          customer,
        ])
      ),
    [customers]
  );

  const leadMap = useMemo(
    () =>
      new Map(
        leads.map((lead) => [lead.id, lead])
      ),
    [leads]
  );

  const filteredEstimates = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return estimates.filter((estimate) => {
      const customer = estimate.customer_id
        ? customerMap.get(estimate.customer_id)
        : undefined;

      const lead = estimate.lead_id
        ? leadMap.get(estimate.lead_id)
        : undefined;

      const customerName =
        customer?.name ?? "";

      const leadName = lead?.name ?? "";

      const searchableText = [
        estimate.estimate_number,
        estimate.status,
        customerName,
        customer?.email ?? "",
        customer?.phone ?? "",
        leadName,
        lead?.email ?? "",
        lead?.phone ?? "",
        estimate.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        searchableText.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        estimate.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [
    customerMap,
    estimates,
    leadMap,
    search,
    statusFilter,
  ]);

  const stats = useMemo(() => {
    const total = estimates.length;

    const draft = estimates.filter(
      (estimate) => estimate.status === "draft"
    ).length;

    const sent = estimates.filter(
      (estimate) => estimate.status === "sent"
    ).length;

    const accepted = estimates.filter(
      (estimate) => estimate.status === "accepted"
    ).length;

    const pipelineValue = estimates
      .filter(
        (estimate) =>
          estimate.status !== "declined" &&
          estimate.status !== "expired"
      )
      .reduce(
        (sum, estimate) => sum + estimate.total,
        0
      );

    return {
      total,
      draft,
      sent,
      accepted,
      pipelineValue,
    };
  }, [estimates]);

  const selectedCustomer = form.customer_id
    ? customerMap.get(form.customer_id)
    : undefined;

  const selectedLead = form.lead_id
    ? leadMap.get(form.lead_id)
    : undefined;

  const previewSubtotal =
    Math.max(0, Number(form.subtotal) || 0);

  const previewTax =
    Math.max(0, Number(form.tax) || 0);

  const previewTotal =
    previewSubtotal + previewTax;

  const viewingCustomer =
    viewingEstimate?.customer_id
      ? customerMap.get(
          viewingEstimate.customer_id
        )
      : undefined;

  const viewingLead =
    viewingEstimate?.lead_id
      ? leadMap.get(
          viewingEstimate.lead_id
        )
      : undefined;

  return (
    <AppShell>
      <main className="estimates-page">
        <header className="estimates-header">
          <div>
            <div className="eyebrow">
              SALES
            </div>

            <h1>Quotes & Estimates</h1>

            <p>
              Build professional estimates, track
              customer responses, and move deals
              toward sales.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openAddModal}
          >
            <Icon name="plus" size={17} />
            New Estimate
          </button>
        </header>

        {pageError && (
          <div className="error-banner">
            <div>
              <strong>
                Could not load estimates
              </strong>

              <span>{pageError}</span>
            </div>

            <button
              type="button"
              onClick={() => void loadPage()}
            >
              Try again
            </button>
          </div>
        )}

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-top">
              <span>Total estimates</span>

              <div className="stat-icon">
                <Icon
                  name="document"
                  size={17}
                />
              </div>
            </div>

            <strong>{stats.total}</strong>

            <small>
              All estimates in your workspace
            </small>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span>Awaiting response</span>

              <div className="stat-icon">
                <Icon name="clock" size={17} />
              </div>
            </div>

            <strong>{stats.sent}</strong>

            <small>
              Estimates currently sent
            </small>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span>Accepted</span>

              <div className="stat-icon">
                <Icon name="check" size={17} />
              </div>
            </div>

            <strong>{stats.accepted}</strong>

            <small>
              Estimates won
            </small>
          </article>

          <article className="stat-card stat-card-value">
            <div className="stat-top">
              <span>Pipeline value</span>

              <div className="stat-icon">
                <Icon name="money" size={17} />
              </div>
            </div>

            <strong>
              {formatCurrency(
                stats.pipelineValue
              )}
            </strong>

            <small>
              Active draft and sent pipeline
            </small>
          </article>
        </section>

        <section className="workspace-card">
          <div className="workspace-toolbar">
            <div className="toolbar-title">
              <div>
                <h2>All estimates</h2>

                <p>
                  {filteredEstimates.length} of{" "}
                  {estimates.length}{" "}
                  {estimates.length === 1
                    ? "estimate"
                    : "estimates"}
                </p>
              </div>
            </div>

            <div className="toolbar-controls">
              <div className="search-control">
                <Icon
                  name="search"
                  size={17}
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search estimates..."
                  aria-label="Search estimates"
                />

                {search && (
                  <button
                    type="button"
                    className="clear-search"
                    onClick={() =>
                      setSearch("")
                    }
                    aria-label="Clear search"
                  >
                    <Icon
                      name="close"
                      size={14}
                    />
                  </button>
                )}
              </div>

              <div className="filter-control">
                <Icon
                  name="filter"
                  size={16}
                />

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  aria-label="Filter by status"
                >
                  <option value="all">
                    All statuses
                  </option>

                  {ESTIMATE_STATUSES.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {formatStatus(status)}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner" />

              <strong>
                Loading estimates
              </strong>

              <span>
                Getting your sales workspace ready...
              </span>
            </div>
          ) : filteredEstimates.length ===
            0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Icon
                  name="document"
                  size={25}
                />
              </div>

              <h3>
                {search ||
                statusFilter !== "all"
                  ? "No matching estimates"
                  : "No estimates yet"}
              </h3>

              <p>
                {search ||
                statusFilter !== "all"
                  ? "Try changing your search or status filter."
                  : "Create your first estimate and start building your sales pipeline."}
              </p>

              {!search &&
                statusFilter === "all" && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={openAddModal}
                  >
                    <Icon
                      name="plus"
                      size={16}
                    />
                    Create your first estimate
                  </button>
                )}
            </div>
          ) : (
            <>
              <div className="desktop-table">
                <table>
                  <thead>
                    <tr>
                      <th>ESTIMATE</th>
                      <th>CUSTOMER</th>
                      <th>STATUS</th>
                      <th>VALID UNTIL</th>
                      <th>AMOUNT</th>
                      <th>CREATED</th>
                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {filteredEstimates.map(
                      (estimate) => {
                        const customer =
                          estimate.customer_id
                            ? customerMap.get(
                                estimate.customer_id
                              )
                            : undefined;

                        const lead =
                          estimate.lead_id
                            ? leadMap.get(
                                estimate.lead_id
                              )
                            : undefined;

                        const contact =
                          customer?.name ||
                          lead?.name ||
                          "No contact";

                        const contactType =
                          customer
                            ? "Customer"
                            : lead
                              ? "Lead"
                              : "No contact";

                        return (
                          <tr
                            key={estimate.id}
                          >
                            <td>
                              <button
                                type="button"
                                className="estimate-link"
                                onClick={() =>
                                  openViewModal(
                                    estimate
                                  )
                                }
                              >
                                {
                                  estimate.estimate_number
                                }
                              </button>
                            </td>

                            <td>
                              <div className="customer-cell">
                                <div className="avatar">
                                  {getInitials(
                                    contact
                                  )}
                                </div>

                                <div>
                                  <strong>
                                    {contact}
                                  </strong>

                                  <span>
                                    {
                                      contactType
                                    }
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span
                                className={getStatusClass(
                                  estimate.status
                                )}
                              >
                                <span className="status-dot" />
                                {formatStatus(
                                  estimate.status
                                )}
                              </span>
                            </td>

                            <td>
                              <span className="date-cell">
                                {formatDate(
                                  estimate.valid_until
                                )}
                              </span>
                            </td>

                            <td>
                              <strong className="amount-cell">
                                {formatCurrency(
                                  estimate.total
                                )}
                              </strong>
                            </td>

                            <td>
                              <span className="date-cell">
                                {formatDate(
                                  estimate.created_at
                                )}
                              </span>
                            </td>

                            <td>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={() =>
                                    openViewModal(
                                      estimate
                                    )
                                  }
                                  title="View estimate"
                                  aria-label="View estimate"
                                >
                                  <Icon
                                    name="eye"
                                    size={16}
                                  />
                                </button>

                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={() =>
                                    openEditModal(
                                      estimate
                                    )
                                  }
                                  title="Edit estimate"
                                  aria-label="Edit estimate"
                                >
                                  <Icon
                                    name="edit"
                                    size={16}
                                  />
                                </button>

                                <button
                                  type="button"
                                  className="icon-button danger"
                                  onClick={() =>
                                    void handleDeleteEstimate(
                                      estimate
                                    )
                                  }
                                  title="Delete estimate"
                                  aria-label="Delete estimate"
                                >
                                  <Icon
                                    name="trash"
                                    size={16}
                                  />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mobile-estimates">
                {filteredEstimates.map(
                  (estimate) => {
                    const customer =
                      estimate.customer_id
                        ? customerMap.get(
                            estimate.customer_id
                          )
                        : undefined;

                    const lead =
                      estimate.lead_id
                        ? leadMap.get(
                            estimate.lead_id
                          )
                        : undefined;

                    const contact =
                      customer?.name ||
                      lead?.name ||
                      "No contact";

                    return (
                      <article
                        className="mobile-estimate-card"
                        key={estimate.id}
                      >
                        <div className="mobile-estimate-top">
                          <div>
                            <button
                              type="button"
                              className="estimate-link"
                              onClick={() =>
                                openViewModal(
                                  estimate
                                )
                              }
                            >
                              {
                                estimate.estimate_number
                              }
                            </button>

                            <span>
                              {contact}
                            </span>
                          </div>

                          <span
                            className={getStatusClass(
                              estimate.status
                            )}
                          >
                            <span className="status-dot" />
                            {formatStatus(
                              estimate.status
                            )}
                          </span>
                        </div>

                        <div className="mobile-estimate-details">
                          <div>
                            <span>
                              Amount
                            </span>

                            <strong>
                              {formatCurrency(
                                estimate.total
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Valid until
                            </span>

                            <strong>
                              {formatDate(
                                estimate.valid_until
                              )}
                            </strong>
                          </div>
                        </div>

                        <div className="mobile-estimate-actions">
                          <button
                            type="button"
                            onClick={() =>
                              openViewModal(
                                estimate
                              )
                            }
                          >
                            <Icon
                              name="eye"
                              size={15}
                            />
                            View
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(
                                estimate
                              )
                            }
                          >
                            <Icon
                              name="edit"
                              size={15}
                            />
                            Edit
                          </button>

                          <button
                            type="button"
                            className="danger"
                            onClick={() =>
                              void handleDeleteEstimate(
                                estimate
                              )
                            }
                          >
                            <Icon
                              name="trash"
                              size={15}
                            />
                            Delete
                          </button>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            </>
          )}
        </section>
      </main>

      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={closeModal}
        >
          <section
            className="estimate-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="estimate-modal-title"
          >
            <header className="modal-header">
              <div>
                <span className="modal-kicker">
                  {editingEstimate
                    ? "UPDATE ESTIMATE"
                    : "NEW ESTIMATE"}
                </span>

                <h2 id="estimate-modal-title">
                  {editingEstimate
                    ? "Edit estimate"
                    : "Create estimate"}
                </h2>

                <p>
                  Add the customer, pricing and
                  commercial details for this
                  estimate.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                <Icon
                  name="close"
                  size={18}
                />
              </button>
            </header>

            <form
              onSubmit={handleSaveEstimate}
            >
              <div className="modal-content">
                <section className="form-section">
                  <div className="section-heading">
                    <div>
                      <h3>Estimate details</h3>

                      <p>
                        Identify and configure
                        this estimate.
                      </p>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="estimate-number">
                        Estimate number
                      </label>

                      <input
                        id="estimate-number"
                        type="text"
                        value={
                          form.estimate_number
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            estimate_number:
                              event.target.value,
                          }))
                        }
                        required
                      />

                      <small>
                        Use your company&apos;s
                        preferred numbering format.
                      </small>
                    </div>

                    <div className="field">
                      <label htmlFor="estimate-status">
                        Status
                      </label>

                      <select
                        id="estimate-status"
                        value={form.status}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            status:
                              event.target.value,
                          }))
                        }
                      >
                        {ESTIMATE_STATUSES.map(
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

                    <div className="field">
                      <label htmlFor="estimate-customer">
                        Customer
                      </label>

                      <select
                        id="estimate-customer"
                        value={
                          form.customer_id
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            customer_id:
                              event.target.value,
                            lead_id:
                              event.target.value
                                ? ""
                                : current.lead_id,
                          }))
                        }
                      >
                        <option value="">
                          Select a customer
                        </option>

                        {customers.map(
                          (customer) => (
                            <option
                              key={customer.id}
                              value={customer.id}
                            >
                              {customer.name}
                            </option>
                          )
                        )}
                      </select>

                      {selectedCustomer && (
                        <small>
                          {selectedCustomer.email ||
                            selectedCustomer.phone ||
                            "Customer selected"}
                        </small>
                      )}
                    </div>

                    <div className="field">
                      <label htmlFor="estimate-lead">
                        Lead
                      </label>

                      <select
                        id="estimate-lead"
                        value={form.lead_id}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            lead_id:
                              event.target.value,
                            customer_id:
                              event.target.value
                                ? ""
                                : current.customer_id,
                          }))
                        }
                      >
                        <option value="">
                          Select a lead
                        </option>

                        {leads.map((lead) => (
                          <option
                            key={lead.id}
                            value={lead.id}
                          >
                            {lead.name}
                          </option>
                        ))}
                      </select>

                      {selectedLead && (
                        <small>
                          {selectedLead.email ||
                            selectedLead.phone ||
                            "Lead selected"}
                        </small>
                      )}
                    </div>

                    <div className="field">
                      <label htmlFor="estimate-valid-until">
                        Valid until
                      </label>

                      <input
                        id="estimate-valid-until"
                        type="date"
                        min={getTodayString()}
                        value={
                          form.valid_until
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            valid_until:
                              event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </section>

                <section className="form-section">
                  <div className="section-heading">
                    <div>
                      <h3>Pricing</h3>

                      <p>
                        Enter the commercial
                        totals for this estimate.
                      </p>
                    </div>
                  </div>

                  <div className="pricing-grid">
                    <div className="field">
                      <label htmlFor="estimate-subtotal">
                        Subtotal
                      </label>

                      <div className="money-input">
                        <span>$</span>

                        <input
                          id="estimate-subtotal"
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            form.subtotal
                          }
                          onChange={(event) =>
                            setForm(
                              (current) => ({
                                ...current,
                                subtotal:
                                  event.target
                                    .value,
                              })
                            )
                          }
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="estimate-tax">
                        Tax
                      </label>

                      <div className="money-input">
                        <span>$</span>

                        <input
                          id="estimate-tax"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.tax}
                          onChange={(event) =>
                            setForm(
                              (current) => ({
                                ...current,
                                tax: event.target
                                  .value,
                              })
                            )
                          }
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="total-preview">
                      <span>Estimate total</span>

                      <strong>
                        {formatCurrency(
                          previewTotal
                        )}
                      </strong>

                      <small>
                        Subtotal{" "}
                        {formatCurrency(
                          previewSubtotal
                        )}{" "}
                        + tax{" "}
                        {formatCurrency(
                          previewTax
                        )}
                      </small>
                    </div>
                  </div>
                </section>

                <section className="form-section">
                  <div className="section-heading">
                    <div>
                      <h3>Notes</h3>

                      <p>
                        Add customer-facing or
                        commercial information.
                      </p>
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="estimate-notes">
                      Estimate notes
                    </label>

                    <textarea
                      id="estimate-notes"
                      rows={5}
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes:
                            event.target.value,
                        }))
                      }
                      placeholder="Add payment terms, product details, warranty information, delivery notes, or other relevant information..."
                    />
                  </div>
                </section>
              </div>

              <footer className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingEstimate
                      ? "Save changes"
                      : "Create estimate"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {showViewModal &&
        viewingEstimate && (
          <div
            className="modal-overlay"
            onMouseDown={closeViewModal}
          >
            <section
              className="view-modal"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
              role="dialog"
              aria-modal="true"
              aria-labelledby="view-estimate-title"
            >
              <header className="view-header">
                <div>
                  <span className="modal-kicker">
                    ESTIMATE
                  </span>

                  <h2 id="view-estimate-title">
                    {
                      viewingEstimate.estimate_number
                    }
                  </h2>

                  <p>
                    Created{" "}
                    {formatDate(
                      viewingEstimate.created_at
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={closeViewModal}
                  aria-label="Close"
                >
                  <Icon
                    name="close"
                    size={18}
                  />
                </button>
              </header>

              <div className="view-content">
                <div className="view-summary">
                  <div>
                    <span>Customer</span>

                    <strong>
                      {viewingCustomer?.name ||
                        viewingLead?.name ||
                        "No contact"}
                    </strong>

                    <small>
                      {viewingCustomer?.email ||
                        viewingCustomer?.phone ||
                        viewingLead?.email ||
                        viewingLead?.phone ||
                        "No contact information"}
                    </small>
                  </div>

                  <div>
                    <span>Status</span>

                    <strong>
                      <span
                        className={getStatusClass(
                          viewingEstimate.status
                        )}
                      >
                        <span className="status-dot" />
                        {formatStatus(
                          viewingEstimate.status
                        )}
                      </span>
                    </strong>
                  </div>

                  <div>
                    <span>Valid until</span>

                    <strong>
                      {formatDate(
                        viewingEstimate.valid_until
                      )}
                    </strong>
                  </div>
                </div>

                <div className="status-workflow">
                  <div className="workflow-heading">
                    <div>
                      <h3>Estimate status</h3>

                      <p>
                        Update the estimate
                        directly from its
                        current stage.
                      </p>
                    </div>
                  </div>

                  <div className="workflow-options">
                    {ESTIMATE_STATUSES.map(
                      (status) => (
                        <button
                          key={status}
                          type="button"
                          className={
                            viewingEstimate.status ===
                            status
                              ? "workflow-option active"
                              : "workflow-option"
                          }
                          onClick={() =>
                            void handleStatusChange(
                              viewingEstimate,
                              status
                            )
                          }
                        >
                          <span className="workflow-dot" />

                          {formatStatus(
                            status
                          )}

                          {viewingEstimate.status ===
                            status && (
                            <Icon
                              name="check"
                              size={14}
                            />
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="amount-breakdown">
                  <div>
                    <span>Subtotal</span>

                    <strong>
                      {formatCurrency(
                        viewingEstimate.subtotal
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Tax</span>

                    <strong>
                      {formatCurrency(
                        viewingEstimate.tax
                      )}
                    </strong>
                  </div>

                  <div className="grand-total">
                    <span>Total</span>

                    <strong>
                      {formatCurrency(
                        viewingEstimate.total
                      )}
                    </strong>
                  </div>
                </div>

                {viewingEstimate.notes && (
                  <div className="notes-panel">
                    <span>Notes</span>

                    <p>
                      {viewingEstimate.notes}
                    </p>
                  </div>
                )}
              </div>

              <footer className="view-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    void handleDuplicateEstimate(
                      viewingEstimate
                    )
                  }
                  disabled={saving}
                >
                  <Icon
                    name="copy"
                    size={16}
                  />
                  Duplicate
                </button>

                <div className="view-footer-right">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      openEditModal(
                        viewingEstimate
                      )
                    }
                  >
                    <Icon
                      name="edit"
                      size={16}
                    />
                    Edit
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      void handleStatusChange(
                        viewingEstimate,
                        viewingEstimate.status ===
                          "draft"
                          ? "sent"
                          : viewingEstimate.status
                      )
                    }
                    disabled={
                      viewingEstimate.status ===
                      "sent"
                    }
                  >
                    <Icon
                      name="send"
                      size={16}
                    />
                    {viewingEstimate.status ===
                    "draft"
                      ? "Mark as sent"
                      : "Current status"}
                  </button>
                </div>
              </footer>
            </section>
          </div>
        )}

      <style jsx global>{`
        .estimates-page {
          width: 100%;
          max-width: 1480px;
          margin: 0 auto;
          padding: 28px 30px 42px;
          box-sizing: border-box;
          color: var(--sbs-text, #111827);
        }

        .estimates-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          margin-bottom: 7px;
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .estimates-header h1 {
          margin: 0;
          color: var(--sbs-text, #111827);
          font-size: 27px;
          line-height: 1.15;
          font-weight: 760;
          letter-spacing: -0.035em;
        }

        .estimates-header p {
          max-width: 640px;
          margin: 7px 0 0;
          color: var(
            --sbs-text-muted,
            #64748b
          );
          font-size: 13px;
          line-height: 1.6;
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          padding: 0 15px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 720;
          cursor: pointer;
          transition:
            background 0.18s ease,
            border-color 0.18s ease,
            transform 0.18s ease,
            box-shadow 0.18s ease;
          white-space: nowrap;
        }

        .primary-button {
          border: 1px solid #111827;
          background: #111827;
          color: #ffffff;
          box-shadow: 0 1px 2px
            rgba(15, 23, 42, 0.08);
        }

        .primary-button:hover {
          background: #1f2937;
          transform: translateY(-1px);
          box-shadow: 0 5px 14px
            rgba(15, 23, 42, 0.12);
        }

        .secondary-button {
          border: 1px solid #dbe1e8;
          background: #ffffff;
          color: #334155;
        }

        .secondary-button:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }

        .primary-button:disabled,
        .secondary-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .error-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 20px;
          padding: 13px 15px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fff7f7;
          color: #991b1b;
        }

        .error-banner > div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .error-banner strong {
          font-size: 12px;
        }

        .error-banner span {
          color: #b91c1c;
          font-size: 11px;
        }

        .error-banner button {
          border: 0;
          background: transparent;
          color: #991b1b;
          font-family: inherit;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 14px;
          margin-bottom: 20px;
        }

        .stat-card {
          min-width: 0;
          padding: 17px 18px 16px;
          border: 1px solid #e5e9ef;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 2px 10px
            rgba(15, 23, 42, 0.025);
        }

        .stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .stat-top > span {
          color: #64748b;
          font-size: 10px;
          font-weight: 780;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .stat-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border: 1px solid #e8edf2;
          border-radius: 8px;
          background: #f8fafc;
          color: #475569;
        }

        .stat-card > strong {
          display: block;
          margin-top: 13px;
          color: #111827;
          font-size: 24px;
          line-height: 1.1;
          font-weight: 760;
          letter-spacing: -0.03em;
        }

        .stat-card small {
          display: block;
          margin-top: 7px;
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.4;
        }

        .workspace-card {
          overflow: hidden;
          border: 1px solid #e3e8ee;
          border-radius: 13px;
          background: #ffffff;
          box-shadow: 0 3px 14px
            rgba(15, 23, 42, 0.025);
        }

        .workspace-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          min-height: 73px;
          padding: 15px 18px;
          border-bottom: 1px solid #e9edf2;
        }

        .toolbar-title h2 {
          margin: 0;
          color: #111827;
          font-size: 14px;
          font-weight: 750;
        }

        .toolbar-title p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 11px;
        }

        .toolbar-controls {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .search-control,
        .filter-control {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 37px;
          box-sizing: border-box;
          border: 1px solid #dfe5eb;
          border-radius: 8px;
          background: #ffffff;
          color: #94a3b8;
        }

        .search-control {
          width: 260px;
          padding: 0 10px;
        }

        .search-control input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #111827;
          font-family: inherit;
          font-size: 12px;
        }

        .search-control input::placeholder {
          color: #a1aab5;
        }

        .clear-search {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          padding: 0;
          border: 0;
          border-radius: 5px;
          background: #f1f5f9;
          color: #64748b;
          cursor: pointer;
        }

        .filter-control {
          padding: 0 9px;
        }

        .filter-control select {
          min-width: 130px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #475569;
          font-family: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        .desktop-table {
          overflow-x: auto;
        }

        .desktop-table table {
          width: 100%;
          min-width: 940px;
          border-collapse: collapse;
        }

        .desktop-table th {
          padding: 11px 18px;
          border-bottom: 1px solid #edf0f3;
          background: #fafbfc;
          color: #7b8794;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-align: left;
          white-space: nowrap;
        }

        .desktop-table td {
          padding: 14px 18px;
          border-bottom: 1px solid #f0f2f5;
          color: #475569;
          font-size: 12px;
          vertical-align: middle;
        }

        .desktop-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .desktop-table tbody tr {
          transition: background 0.15s ease;
        }

        .desktop-table tbody tr:hover {
          background: #fbfcfd;
        }

        .estimate-link {
          padding: 0;
          border: 0;
          background: transparent;
          color: #111827;
          font-family: inherit;
          font-size: 12px;
          font-weight: 760;
          cursor: pointer;
        }

        .estimate-link:hover {
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .customer-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 180px;
        }

        .avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          border: 1px solid #e5e9ee;
          border-radius: 8px;
          background: #f8fafc;
          color: #475569;
          font-size: 10px;
          font-weight: 800;
        }

        .customer-cell strong {
          display: block;
          max-width: 210px;
          overflow: hidden;
          color: #1f2937;
          font-size: 12px;
          font-weight: 680;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .customer-cell span {
          display: block;
          margin-top: 2px;
          color: #9aa4af;
          font-size: 10px;
        }

        .estimate-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 8px;
          border: 1px solid transparent;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 720;
          line-height: 1;
          white-space: nowrap;
        }

        .status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
        }

        .estimate-status-draft {
          border-color: #e5e7eb;
          background: #f8fafc;
          color: #64748b;
        }

        .estimate-status-sent {
          border-color: #dbeafe;
          background: #eff6ff;
          color: #2563eb;
        }

        .estimate-status-accepted {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #15803d;
        }

        .estimate-status-declined {
          border-color: #fecaca;
          background: #fef2f2;
          color: #dc2626;
        }

        .estimate-status-expired {
          border-color: #fed7aa;
          background: #fff7ed;
          color: #c2410c;
        }

        .date-cell {
          color: #64748b;
          font-size: 11px;
        }

        .amount-cell {
          color: #111827;
          font-size: 12px;
          font-weight: 740;
        }

        .row-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 5px;
        }

        .icon-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          padding: 0;
          border: 1px solid #e4e8ed;
          border-radius: 7px;
          background: #ffffff;
          color: #64748b;
          cursor: pointer;
          transition:
            background 0.15s ease,
            color 0.15s ease,
            border-color 0.15s ease;
        }

        .icon-button:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
          color: #1f2937;
        }

        .icon-button.danger:hover {
          border-color: #fecaca;
          background: #fef2f2;
          color: #dc2626;
        }

        .loading-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 360px;
          padding: 40px 20px;
          text-align: center;
        }

        .loading-spinner {
          width: 28px;
          height: 28px;
          margin-bottom: 14px;
          border: 2px solid #e5e7eb;
          border-top-color: #334155;
          border-radius: 50%;
          animation: estimates-spin 0.8s
            linear infinite;
        }

        @keyframes estimates-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .loading-state strong,
        .empty-state h3 {
          margin: 0;
          color: #1f2937;
          font-size: 14px;
          font-weight: 750;
        }

        .loading-state span,
        .empty-state p {
          max-width: 430px;
          margin: 6px 0 0;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.55;
        }

        .empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          margin-bottom: 15px;
          border: 1px solid #e7ebef;
          border-radius: 15px;
          background: #f8fafc;
          color: #64748b;
        }

        .empty-state .secondary-button {
          margin-top: 18px;
        }

        .mobile-estimates {
          display: none;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
          background: rgba(
            15,
            23,
            42,
            0.48
          );
          backdrop-filter: blur(2px);
        }

        .estimate-modal,
        .view-modal {
          width: min(760px, 100%);
          max-height: calc(100vh - 40px);
          overflow: hidden;
          border: 1px solid rgba(
            255,
            255,
            255,
            0.5
          );
          border-radius: 15px;
          background: #ffffff;
          box-shadow: 0 24px 70px
            rgba(15, 23, 42, 0.24);
        }

        .estimate-modal {
          overflow-y: auto;
        }

        .modal-header,
        .view-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 21px 23px;
          border-bottom: 1px solid #e8ecf0;
        }

        .modal-kicker {
          display: block;
          margin-bottom: 5px;
          color: #7b8794;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .modal-header h2,
        .view-header h2 {
          margin: 0;
          color: #111827;
          font-size: 20px;
          line-height: 1.2;
          font-weight: 760;
          letter-spacing: -0.025em;
        }

        .modal-header p,
        .view-header p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.5;
        }

        .modal-close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          border: 1px solid #e5e9ee;
          border-radius: 8px;
          background: #ffffff;
          color: #64748b;
          cursor: pointer;
        }

        .modal-close:hover {
          background: #f8fafc;
          color: #1f2937;
        }

        .modal-content,
        .view-content {
          padding: 22px 23px;
        }

        .form-section + .form-section {
          margin-top: 24px;
          padding-top: 23px;
          border-top: 1px solid #edf0f3;
        }

        .section-heading {
          margin-bottom: 15px;
        }

        .section-heading h3,
        .workflow-heading h3 {
          margin: 0;
          color: #1f2937;
          font-size: 13px;
          font-weight: 750;
        }

        .section-heading p,
        .workflow-heading p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.5;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 16px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }

        .field label {
          color: #475569;
          font-size: 11px;
          font-weight: 720;
        }

        .field small {
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.4;
        }

        .field input,
        .field select,
        .field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dce2e8;
          border-radius: 8px;
          outline: 0;
          background: #ffffff;
          color: #111827;
          font-family: inherit;
          font-size: 12px;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .field input,
        .field select {
          height: 40px;
          padding: 0 11px;
        }

        .field textarea {
          min-height: 115px;
          padding: 10px 11px;
          resize: vertical;
          line-height: 1.5;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px
            rgba(148, 163, 184, 0.12);
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 16px;
          align-items: end;
        }

        .money-input {
          position: relative;
        }

        .money-input > span {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          font-size: 12px;
          pointer-events: none;
        }

        .money-input input {
          padding-left: 26px;
        }

        .total-preview {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 4px 18px;
          padding: 15px;
          border: 1px solid #e2e8ee;
          border-radius: 10px;
          background: #f8fafc;
        }

        .total-preview > span {
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
        }

        .total-preview > strong {
          color: #111827;
          font-size: 20px;
          font-weight: 780;
          letter-spacing: -0.025em;
          text-align: right;
        }

        .total-preview small {
          grid-column: 1 / -1;
          color: #94a3b8;
          font-size: 10px;
        }

        .modal-footer,
        .view-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 15px 23px;
          border-top: 1px solid #e8ecf0;
          background: #fbfcfd;
        }

        .view-footer-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .view-summary {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 1px;
          overflow: hidden;
          border: 1px solid #e6eaee;
          border-radius: 10px;
          background: #e6eaee;
        }

        .view-summary > div {
          min-width: 0;
          padding: 14px;
          background: #ffffff;
        }

        .view-summary span:not(.estimate-status) {
          display: block;
          margin-bottom: 5px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 650;
        }

        .view-summary strong {
          display: block;
          overflow: hidden;
          color: #1f2937;
          font-size: 12px;
          font-weight: 720;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .view-summary small {
          display: block;
          margin-top: 3px;
          overflow: hidden;
          color: #94a3b8;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .status-workflow {
          margin-top: 19px;
        }

        .workflow-heading {
          margin-bottom: 11px;
        }

        .workflow-options {
          display: grid;
          grid-template-columns: repeat(
            5,
            minmax(0, 1fr)
          );
          gap: 7px;
        }

        .workflow-option {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-height: 36px;
          padding: 0 8px;
          border: 1px solid #e3e7eb;
          border-radius: 8px;
          background: #ffffff;
          color: #64748b;
          font-family: inherit;
          font-size: 10px;
          font-weight: 680;
          cursor: pointer;
        }

        .workflow-option:hover {
          background: #f8fafc;
        }

        .workflow-option.active {
          border-color: #cbd5e1;
          background: #f1f5f9;
          color: #1f2937;
        }

        .workflow-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .amount-breakdown {
          margin-top: 19px;
          padding: 15px;
          border: 1px solid #e6eaee;
          border-radius: 10px;
          background: #fafbfc;
        }

        .amount-breakdown > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 5px 0;
          color: #64748b;
          font-size: 11px;
        }

        .amount-breakdown > div strong {
          color: #334155;
          font-weight: 720;
        }

        .amount-breakdown .grand-total {
          margin-top: 7px;
          padding-top: 12px;
          border-top: 1px solid #e1e6eb;
          color: #1f2937;
          font-size: 13px;
          font-weight: 750;
        }

        .amount-breakdown .grand-total strong {
          color: #111827;
          font-size: 17px;
          font-weight: 780;
        }

        .notes-panel {
          margin-top: 19px;
          padding: 15px;
          border: 1px solid #e6eaee;
          border-radius: 10px;
          background: #ffffff;
        }

        .notes-panel > span {
          display: block;
          margin-bottom: 7px;
          color: #64748b;
          font-size: 10px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .notes-panel p {
          margin: 0;
          color: #475569;
          font-size: 11px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .view-summary {
            grid-template-columns: 1fr 1fr;
          }

          .view-summary > div:first-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 820px) {
          .estimates-page {
            padding: 22px 18px 32px;
          }

          .estimates-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .estimates-header
            .primary-button {
            width: 100%;
          }

          .workspace-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .toolbar-controls {
            width: 100%;
          }

          .search-control {
            flex: 1;
            width: auto;
          }

          .filter-control {
            flex: 0 0 auto;
          }

          .form-grid,
          .pricing-grid {
            grid-template-columns: 1fr;
          }

          .total-preview {
            grid-column: auto;
          }

          .workflow-options {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 650px) {
          .estimates-page {
            padding: 18px 12px 28px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .desktop-table {
            display: none;
          }

          .mobile-estimates {
            display: flex;
            flex-direction: column;
          }

          .mobile-estimate-card {
            padding: 15px;
            border-bottom: 1px solid #edf0f3;
          }

          .mobile-estimate-card:last-child {
            border-bottom: 0;
          }

          .mobile-estimate-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
          }

          .mobile-estimate-top > div {
            min-width: 0;
          }

          .mobile-estimate-top .estimate-link {
            display: block;
            max-width: 190px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-estimate-top > div > span {
            display: block;
            margin-top: 4px;
            overflow: hidden;
            color: #94a3b8;
            font-size: 10px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-estimate-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 14px;
            padding: 12px;
            border: 1px solid #edf0f3;
            border-radius: 8px;
            background: #fafbfc;
          }

          .mobile-estimate-details span {
            display: block;
            margin-bottom: 4px;
            color: #94a3b8;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .mobile-estimate-details strong {
            color: #1f2937;
            font-size: 12px;
          }

          .mobile-estimate-actions {
            display: grid;
            grid-template-columns: repeat(
              3,
              1fr
            );
            gap: 6px;
            margin-top: 12px;
          }

          .mobile-estimate-actions button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            min-height: 32px;
            border: 1px solid #e2e7ec;
            border-radius: 7px;
            background: #ffffff;
            color: #64748b;
            font-family: inherit;
            font-size: 10px;
            font-weight: 680;
            cursor: pointer;
          }

          .mobile-estimate-actions button.danger {
            color: #b91c1c;
          }

          .toolbar-controls {
            flex-direction: column;
          }

          .filter-control,
          .filter-control select {
            width: 100%;
          }

          .modal-overlay {
            align-items: flex-end;
            padding: 0;
          }

          .estimate-modal,
          .view-modal {
            width: 100%;
            max-height: 94vh;
            border-radius: 16px 16px 0 0;
          }

          .modal-header,
          .view-header,
          .modal-content,
          .view-content,
          .modal-footer,
          .view-footer {
            padding-left: 16px;
            padding-right: 16px;
          }

          .view-summary {
            grid-template-columns: 1fr;
          }

          .view-summary > div:first-child {
            grid-column: auto;
          }

          .workflow-options {
            grid-template-columns: 1fr 1fr;
          }

          .view-footer,
          .view-footer-right {
            flex-direction: column;
            align-items: stretch;
          }

          .view-footer-right {
            display: flex;
          }

          .view-footer .secondary-button,xa
          .view-footer .primary-button {
            width: 100%;
          }

          .modal-footer {
            flex-direction: column-reverse;
          }

          .modal-footer button {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}