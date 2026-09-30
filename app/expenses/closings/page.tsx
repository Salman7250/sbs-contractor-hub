"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type ClosingType = "daily" | "weekly" | "monthly" | "custom";
type ClosingStatus = "pending" | "processing" | "closed" | "failed";

type Closing = {
  id: string;
  company_id: string;
  closing_type: ClosingType;
  period_start: string;
  period_end: string;
  closed_at: string | null;
  status: ClosingStatus;
  total_expenses: number | string | null;
  transaction_count: number | null;
  currency: string | null;
  csv_storage_path: string | null;
  created_at: string;
  updated_at: string;
};

type NotificationJob = {
  id: string;
  closing_id: string | null;
  job_type: string;
  status: string;
  scheduled_for: string | null;
  attempts: number | null;
  last_error: string | null;
  completed_at: string | null;
};

type NotificationDelivery = {
  id: string;
  job_id: string;
  channel: "email" | "whatsapp";
  recipient: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
};

const closingTypeLabels: Record<ClosingType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

const closingStatusLabels: Record<ClosingStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  closed: "Closed",
  failed: "Failed",
};

function formatMoney(
  amount: number | string | null | undefined,
  currency = "AED",
) {
  const value = Number(amount ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "AED",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatDateTime(date: string | null | undefined) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatPeriod(closing: Closing) {
  if (closing.period_start === closing.period_end) {
    return formatDate(closing.period_start);
  }

  return `${formatDate(closing.period_start)} – ${formatDate(
    closing.period_end,
  )}`;
}

function getStatusClass(status: ClosingStatus) {
  switch (status) {
    case "closed":
      return "sbs-status sbs-status-success";
    case "processing":
      return "sbs-status sbs-status-warning";
    case "failed":
      return "sbs-status sbs-status-danger";
    default:
      return "sbs-status sbs-status-neutral";
  }
}

function getDeliveryClass(status: string) {
  switch (status) {
    case "sent":
      return "sbs-delivery-dot success";
    case "failed":
      return "sbs-delivery-dot danger";
    case "sending":
      return "sbs-delivery-dot warning";
    default:
      return "sbs-delivery-dot neutral";
  }
}

function getClosingTypeIcon(type: ClosingType) {
  switch (type) {
    case "daily":
      return "D";
    case "weekly":
      return "W";
    case "monthly":
      return "M";
    default:
      return "C";
  }
}

export default function ExpenseClosingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [closings, setClosings] = useState<Closing[]>([]);
  const [jobs, setJobs] = useState<NotificationJob[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);

  const [activeType, setActiveType] = useState<
    "all" | ClosingType
  >("all");

  const [statusFilter, setStatusFilter] = useState<
    "all" | ClosingStatus
  >("all");

  const [search, setSearch] = useState("");

  const [selectedClosing, setSelectedClosing] =
    useState<Closing | null>(null);

  const [showNewClosing, setShowNewClosing] = useState(false);

  const [newClosingType, setNewClosingType] =
    useState<ClosingType>("daily");

  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");

  const [companyId, setCompanyId] = useState<string | null>(null);

  const loadData = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
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
            "No company membership was found for this account.",
          );
        }

        const currentCompanyId = membership.company_id;
        setCompanyId(currentCompanyId);

        const [
          closingsResult,
          jobsResult,
          deliveriesResult,
        ] = await Promise.all([
          supabase
            .from("expense_closings")
            .select(
              `
                id,
                company_id,
                closing_type,
                period_start,
                period_end,
                closed_at,
                status,
                total_expenses,
                transaction_count,
                currency,
                csv_storage_path,
                created_at,
                updated_at
              `,
            )
            .eq("company_id", currentCompanyId)
            .order("period_start", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(500),

          supabase
            .from("expense_notification_jobs")
            .select(
              `
                id,
                closing_id,
                job_type,
                status,
                scheduled_for,
                attempts,
                last_error,
                completed_at
              `,
            )
            .eq("company_id", currentCompanyId)
            .not("closing_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1000),

          supabase
            .from("expense_notification_deliveries")
            .select(
              `
                id,
                job_id,
                channel,
                recipient,
                status,
                error_message,
                sent_at
              `,
            )
            .eq("company_id", currentCompanyId)
            .order("created_at", { ascending: false })
            .limit(2000),
        ]);

        if (closingsResult.error) {
          throw closingsResult.error;
        }

        if (jobsResult.error) {
          throw jobsResult.error;
        }

        if (deliveriesResult.error) {
          throw deliveriesResult.error;
        }

        setClosings(
          (closingsResult.data ?? []) as Closing[],
        );

        setJobs(
          (jobsResult.data ?? []) as NotificationJob[],
        );

        setDeliveries(
          (deliveriesResult.data ?? []) as NotificationDelivery[],
        );
      } catch (error) {
        console.error("Expense closings load error:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load expense closings.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!showNewClosing) return;

    const today = new Date().toISOString().slice(0, 10);

    if (!newPeriodStart) {
      setNewPeriodStart(today);
    }

    if (!newPeriodEnd) {
      setNewPeriodEnd(today);
    }
  }, [
    showNewClosing,
    newPeriodStart,
    newPeriodEnd,
  ]);

  const filteredClosings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return closings.filter((closing) => {
      const matchesType =
        activeType === "all" ||
        closing.closing_type === activeType;

      const matchesStatus =
        statusFilter === "all" ||
        closing.status === statusFilter;

      const matchesSearch =
        !query ||
        closingTypeLabels[closing.closing_type]
          .toLowerCase()
          .includes(query) ||
        closing.period_start.toLowerCase().includes(query) ||
        closing.period_end.toLowerCase().includes(query) ||
        (closing.currency ?? "")
          .toLowerCase()
          .includes(query);

      return matchesType && matchesStatus && matchesSearch;
    });
  }, [
    closings,
    activeType,
    statusFilter,
    search,
  ]);

  const stats = useMemo(() => {
    const total = closings.length;

    const closed = closings.filter(
      (item) => item.status === "closed",
    ).length;

    const processing = closings.filter(
      (item) => item.status === "processing",
    ).length;

    const failed = closings.filter(
      (item) => item.status === "failed",
    ).length;

    const totalTransactions = closings.reduce(
      (sum, item) =>
        sum + Number(item.transaction_count ?? 0),
      0,
    );

    return {
      total,
      closed,
      processing,
      failed,
      totalTransactions,
    };
  }, [closings]);

  const selectedJobs = useMemo(() => {
    if (!selectedClosing) return [];

    return jobs.filter(
      (job) => job.closing_id === selectedClosing.id,
    );
  }, [jobs, selectedClosing]);

  const selectedDeliveries = useMemo(() => {
    const jobIds = new Set(
      selectedJobs.map((job) => job.id),
    );

    return deliveries.filter((delivery) =>
      jobIds.has(delivery.job_id),
    );
  }, [deliveries, selectedJobs]);

  const createClosing = async () => {
    if (!companyId) return;

    if (!newPeriodStart || !newPeriodEnd) {
      setErrorMessage(
        "Please select both the start and end dates.",
      );
      return;
    }

    if (newPeriodEnd < newPeriodStart) {
      setErrorMessage(
        "The closing end date cannot be before the start date.",
      );
      return;
    }

    try {
      setCreating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: existingClosing, error: existingError } =
        await supabase
          .from("expense_closings")
          .select("id")
          .eq("company_id", companyId)
          .eq("closing_type", newClosingType)
          .eq("period_start", newPeriodStart)
          .eq("period_end", newPeriodEnd)
          .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingClosing) {
        setErrorMessage(
          "A closing already exists for this type and period.",
        );
        return;
      }

      const { data: expenses, error: expensesError } =
        await supabase
          .from("expenses")
          .select(
            `
              id,
              amount,
              currency,
              expense_date
            `,
          )
          .eq("company_id", companyId)
          .gte("expense_date", newPeriodStart)
          .lte("expense_date", newPeriodEnd)
          .neq("status", "cancelled");

      if (expensesError) {
        throw expensesError;
      }

      const expenseRows = expenses ?? [];

      const totalExpenses = expenseRows.reduce(
        (sum, expense) =>
          sum + Number(expense.amount ?? 0),
        0,
      );

      const currencies = Array.from(
        new Set(
          expenseRows
            .map((expense) => expense.currency)
            .filter(Boolean),
        ),
      );

      const currency =
        currencies.length === 1
          ? currencies[0]
          : "AED";

      const { data: closing, error: closingError } =
        await supabase
          .from("expense_closings")
          .insert({
            company_id: companyId,
            closing_type: newClosingType,
            period_start: newPeriodStart,
            period_end: newPeriodEnd,
            status: "closed",
            total_expenses: totalExpenses,
            transaction_count: expenseRows.length,
            currency,
            closed_at: new Date().toISOString(),
          })
          .select(
            `
              id,
              company_id,
              closing_type,
              period_start,
              period_end,
              closed_at,
              status,
              total_expenses,
              transaction_count,
              currency,
              csv_storage_path,
              created_at,
              updated_at
            `,
          )
          .single();

      if (closingError) {
        throw closingError;
      }

      setSuccessMessage(
        `${closingTypeLabels[newClosingType]} closing created successfully.`,
      );

      setShowNewClosing(false);

      setNewClosingType("daily");
      setNewPeriodStart("");
      setNewPeriodEnd("");

      setClosings((current) => [
        closing as Closing,
        ...current,
      ]);
    } catch (error) {
      console.error("Create expense closing error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to create closing.",
      );
    } finally {
      setCreating(false);
    }
  };

  const downloadClosingCsv = async (closing: Closing) => {
  try {
    setErrorMessage("");

    const { data: expenses, error } = await supabase
      .from("expenses")
      .select(
        `
          expense_date,
          description,
          vendor_name,
          amount,
          currency,
          payment_method,
          status,
          reference,
          notes,
          employee_id,
          category_id
        `,
      )
      .eq("company_id", closing.company_id)
      .gte("expense_date", closing.period_start)
      .lte("expense_date", closing.period_end)
      .neq("status", "cancelled")
      .order("expense_date", { ascending: true });

    if (error) {
      throw error;
    }

    const expenseRows = expenses ?? [];

    // Load employee names
    const employeeIds = Array.from(
      new Set(
        expenseRows
          .map((expense) => expense.employee_id)
          .filter(Boolean),
      ),
    );

    const categoryIds = Array.from(
      new Set(
        expenseRows
          .map((expense) => expense.category_id)
          .filter(Boolean),
      ),
    );

    const [{ data: employees }, { data: categories }] =
      await Promise.all([
        employeeIds.length
          ? supabase
              .from("employees")
              .select(
                "id, first_name, last_name, display_name",
              )
              .in("id", employeeIds)
          : Promise.resolve({ data: [] }),

        categoryIds.length
          ? supabase
              .from("expense_categories")
              .select("id, name")
              .in("id", categoryIds)
          : Promise.resolve({ data: [] }),
      ]);

    const employeeMap = new Map(
      (employees ?? []).map((employee) => [
        employee.id,
        employee.display_name ||
          [employee.first_name, employee.last_name]
            .filter(Boolean)
            .join(" ") ||
          "—",
      ]),
    );

    const categoryMap = new Map(
      (categories ?? []).map((category) => [
        category.id,
        category.name,
      ]),
    );

    const currency =
      closing.currency ||
      expenseRows[0]?.currency ||
      "AED";

    const totalAmount = expenseRows.reduce(
      (sum, expense) =>
        sum + Number(expense.amount ?? 0),
      0,
    );

    const rows: string[][] = [
      [
        "EXPENSE CLOSING REPORT",
      ],
      [
        "Closing Type",
        closingTypeLabels[closing.closing_type],
      ],
      [
        "Period",
        formatPeriod(closing),
      ],
      [
        "Status",
        closingStatusLabels[closing.status],
      ],
      [
        "Closed At",
        formatDateTime(closing.closed_at),
      ],
      [
        "Total Transactions",
        String(expenseRows.length),
      ],
      [
        "Total Amount",
        formatMoney(totalAmount, currency),
      ],
      [],
      [
        "Date",
        "Description",
        "Employee",
        "Category",
        "Vendor",
        "Payment Method",
        "Status",
        "Reference",
        "Notes",
        "Amount",
        "Currency",
      ],
    ];

    expenseRows.forEach((expense) => {
      rows.push([
        formatDate(expense.expense_date),
        expense.description || "—",
        employeeMap.get(expense.employee_id) || "—",
        categoryMap.get(expense.category_id) || "—",
        expense.vendor_name || "—",
        expense.payment_method || "—",
        expense.status
          ? expense.status.charAt(0).toUpperCase() +
            expense.status.slice(1)
          : "—",
        expense.reference || "—",
        expense.notes || "—",
        Number(expense.amount ?? 0).toFixed(2),
        expense.currency || currency,
      ]);
    });

    rows.push([]);

    rows.push([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "TOTAL",
      totalAmount.toFixed(2),
      currency,
    ]);

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const safeValue = String(value ?? "");
            const escaped = safeValue.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(","),
      )
      .join("\n");

    // UTF-8 BOM helps Excel display the CSV correctly.
    const blob = new Blob(
      ["\uFEFF", csv],
      {
        type: "text/csv;charset=utf-8;",
      },
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download =
      `expense-${closing.closing_type}-closing-` +
      `${closing.period_start}-${closing.period_end}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    setSuccessMessage(
      "Expense closing report exported successfully.",
    );
  } catch (error) {
    console.error(
      "Download expense closing CSV error:",
      error,
    );

    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Failed to export expense closing report.",
    );
  }
};
  const clearMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  return (
    <AppShell>
      <style jsx global>{`
  .sbs-page {
    min-height: 100%;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 28px;
    background: #f6f8f7;
    color: #111827;
    overflow-x: hidden;
  }

  .sbs-page *,
  .sbs-page *::before,
  .sbs-page *::after {
    box-sizing: border-box;
  }

  .sbs-page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 24px;
    min-width: 0;
  }

  .sbs-page-header > div:first-child {
    min-width: 0;
    flex: 1 1 auto;
  }

  .sbs-eyebrow {
    margin: 0 0 6px;
    font-size: 11px;
    line-height: 1.4;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #059669;
    text-transform: uppercase;
  }

  .sbs-title {
    margin: 0;
    max-width: 100%;
    font-size: clamp(24px, 2.2vw, 29px);
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: -0.025em;
    overflow-wrap: anywhere;
  }

  .sbs-subtitle {
    margin: 8px 0 0;
    max-width: 760px;
    color: #6b7280;
    font-size: 13px;
    line-height: 1.65;
    overflow-wrap: anywhere;
  }

  .sbs-header-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 9px;
    flex-wrap: wrap;
    min-width: 0;
    flex: 0 1 auto;
  }

  .sbs-button {
    min-height: 40px;
    max-width: 100%;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    background: #fff;
    color: #374151;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 750;
    line-height: 1.2;
    cursor: pointer;
    white-space: nowrap;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.15s ease;
  }

  .sbs-button:hover {
    border-color: #a7f3d0;
    background: #f0fdf9;
    color: #047857;
    box-shadow: 0 3px 12px rgba(5, 150, 105, 0.08);
  }

  .sbs-button:active {
    transform: translateY(1px);
  }

  .sbs-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  .sbs-button-primary {
    background: #059669;
    border-color: #059669;
    color: #fff;
  }

  .sbs-button-primary:hover {
    background: #047857;
    border-color: #047857;
    color: #fff;
    box-shadow: 0 5px 16px rgba(5, 150, 105, 0.18);
  }

  .sbs-button-danger {
    color: #b91c1c;
    border-color: #fecaca;
    background: #fff;
  }

  .sbs-button-danger:hover {
    color: #991b1b;
    border-color: #fca5a5;
    background: #fef2f2;
  }

  .sbs-button-small {
    min-height: 34px;
    padding: 0 11px;
    font-size: 11px;
    border-radius: 8px;
  }

  /* =========================
     KPI / STAT CARDS
     ========================= */

  .sbs-stats-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 20px;
    min-width: 0;
  }

  .sbs-stat-card {
    min-width: 0;
    overflow: hidden;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 17px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.025);
  }

  .sbs-stat-label {
    min-width: 0;
    color: #6b7280;
    font-size: 11px;
    line-height: 1.45;
    font-weight: 750;
    margin-bottom: 8px;
    overflow-wrap: anywhere;
  }

  .sbs-stat-value {
    min-width: 0;
    color: #111827;
    font-size: 23px;
    line-height: 1.15;
    font-weight: 800;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }

  /* =========================
     TOOLBAR
     ========================= */

  .sbs-toolbar {
    min-width: 0;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 14px;
    margin-bottom: 16px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.025);
  }

  .sbs-toolbar-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    min-width: 0;
  }

  .sbs-toolbar-top > * {
    min-width: 0;
  }

  .sbs-search {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
    height: 40px;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    padding: 0 13px;
    outline: none;
    font-size: 12px;
    color: #111827;
    background: #fff;
  }

  .sbs-search::placeholder {
    color: #9ca3af;
  }

  .sbs-search:focus,
  .sbs-select:focus,
  .sbs-input:focus {
    border-color: #34d399;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
  }

  .sbs-select,
  .sbs-input {
    width: 100%;
    max-width: 100%;
    height: 40px;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    padding: 0 11px;
    outline: none;
    font-size: 12px;
    color: #111827;
    background: #fff;
  }

  .sbs-filter-row {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .sbs-filter-button {
    height: 34px;
    border: 1px solid #e5e7eb;
    border-radius: 9px;
    background: #fff;
    color: #6b7280;
    padding: 0 11px;
    font-size: 11px;
    font-weight: 750;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      color 0.15s ease;
  }

  .sbs-filter-button:hover {
    border-color: #a7f3d0;
    color: #047857;
    background: #f0fdf9;
  }

  .sbs-filter-button.active {
    color: #047857;
    border-color: #6ee7b7;
    background: #ecfdf5;
  }

  /* =========================
     ELEGANT CLOSING CARDS
     ========================= */

  .sbs-closing-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    background: #f8faf9;
  }

  .sbs-closing-card {
    position: relative;
    display: grid;
    grid-template-columns: minmax(190px, 1.35fr) minmax(150px, 1fr) minmax(170px, 1fr) minmax(150px, 0.9fr) auto;
    align-items: stretch;
    min-width: 0;
    overflow: hidden;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 13px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.025);
    transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
  }

  .sbs-closing-card:hover {
    border-color: #cbd5e1;
    box-shadow: 0 7px 22px rgba(15, 23, 42, 0.07);
    transform: translateY(-1px);
  }

  .sbs-closing-card::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: #10b981;
  }

  .sbs-closing-card.failed::before { background: #ef4444; }
  .sbs-closing-card.processing::before { background: #f59e0b; }
  .sbs-closing-card.pending::before { background: #94a3b8; }

  .sbs-closing-main,
  .sbs-closing-metric,
  .sbs-closing-status,
  .sbs-closing-actions {
    min-width: 0;
    padding: 15px 16px;
  }

  .sbs-closing-main {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .sbs-closing-icon {
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #d1fae5;
    border-radius: 10px;
    background: linear-gradient(145deg, #ecfdf5, #f0fdf4);
    color: #047857;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.04em;
  }

  .sbs-closing-title {
    color: #0f172a;
    font-size: 13px;
    line-height: 1.35;
    font-weight: 800;
  }

  .sbs-closing-period {
    margin-top: 4px;
    color: #64748b;
    font-size: 11px;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sbs-closing-id {
    margin-top: 3px;
    color: #a1a1aa;
    font-size: 9px;
    line-height: 1.3;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .sbs-closing-metric {
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-left: 1px solid #f0f1f3;
  }

  .sbs-closing-metric-label {
    color: #94a3b8;
    font-size: 9px;
    line-height: 1.4;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .sbs-closing-amount {
    margin-top: 4px;
    color: #0f172a;
    font-size: 17px;
    line-height: 1.2;
    font-weight: 850;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }

  .sbs-closing-subvalue {
    margin-top: 4px;
    color: #64748b;
    font-size: 10px;
    line-height: 1.35;
  }

  .sbs-closing-status {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 7px;
    border-left: 1px solid #f0f1f3;
  }

  .sbs-closing-status-line {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .sbs-closing-status-dot {
    width: 8px;
    height: 8px;
    flex: 0 0 8px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 0 3px #ecfdf5;
  }

  .sbs-closing-status-dot.failed { background: #ef4444; box-shadow: 0 0 0 3px #fef2f2; }
  .sbs-closing-status-dot.processing { background: #f59e0b; box-shadow: 0 0 0 3px #fffbeb; }
  .sbs-closing-status-dot.pending { background: #94a3b8; box-shadow: 0 0 0 3px #f1f5f9; }

  .sbs-closing-status-name {
    color: #334155;
    font-size: 11px;
    line-height: 1.3;
    font-weight: 800;
  }

  .sbs-closing-notifications {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
  }

  .sbs-channel-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 22px;
    padding: 3px 7px;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    background: #f8fafc;
    color: #64748b;
    font-size: 9px;
    line-height: 1;
    font-weight: 800;
  }

  .sbs-channel-pill::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #94a3b8;
  }

  .sbs-channel-pill.sent {
    color: #047857;
    border-color: #d1fae5;
    background: #ecfdf5;
  }

  .sbs-channel-pill.sent::before { background: #10b981; }
  .sbs-channel-pill.sending { color: #b45309; border-color: #fef3c7; background: #fffbeb; }
  .sbs-channel-pill.sending::before { background: #f59e0b; }
  .sbs-channel-pill.failed { color: #b91c1c; border-color: #fee2e2; background: #fef2f2; }
  .sbs-channel-pill.failed::before { background: #ef4444; }

  .sbs-closing-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 7px;
    border-left: 1px solid #f0f1f3;
  }

  .sbs-closing-action {
    height: 32px;
    padding: 0 10px;
    border: 1px solid #dbe3ea;
    border-radius: 8px;
    background: #fff;
    color: #475569;
    font-family: inherit;
    font-size: 10px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .sbs-closing-action:hover {
    border-color: #a7f3d0;
    background: #ecfdf5;
    color: #047857;
  }

  .sbs-closing-action.primary {
    background: #0f172a;
    border-color: #0f172a;
    color: #fff;
  }

  .sbs-closing-action.primary:hover {
    background: #1e293b;
    border-color: #1e293b;
  }

  /* =========================
     TABLE
     ========================= */

  .sbs-table-card {
    min-width: 0;
    width: 100%;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.025);
  }

  .sbs-table-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
    padding: 16px 18px;
    border-bottom: 1px solid #e5e7eb;
  }

  .sbs-table-title {
    min-width: 0;
    margin: 0;
    font-size: 14px;
    line-height: 1.4;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .sbs-table-subtitle {
    margin-top: 4px;
    color: #94a3b8;
    font-size: 10px;
    line-height: 1.45;
  }

  .sbs-table-count {
    flex: 0 0 auto;
    color: #6b7280;
    font-size: 11px;
    white-space: nowrap;
  }

  .sbs-table-wrap {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .sbs-table {
    width: 100%;
    min-width: 980px;
    border-collapse: collapse;
  }

  .sbs-table th {
    text-align: left;
    padding: 11px 15px;
    background: #f8faf9;
    border-bottom: 1px solid #e5e7eb;
    color: #6b7280;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.055em;
    white-space: nowrap;
  }

  .sbs-table td {
    padding: 13px 15px;
    border-bottom: 1px solid #f0f1f3;
    font-size: 12px;
    line-height: 1.45;
    vertical-align: middle;
  }

  .sbs-table tbody tr:last-child td {
    border-bottom: 0;
  }

  .sbs-table tbody tr {
    transition: background 0.12s ease;
  }

  .sbs-table tbody tr:hover {
    background: #f8fffc;
  }

  .sbs-type-cell {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .sbs-type-icon {
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    font-size: 10px;
    font-weight: 900;
    color: #047857;
  }

  .sbs-primary-text {
    min-width: 0;
    color: #111827;
    font-weight: 750;
    overflow-wrap: anywhere;
  }

  .sbs-secondary-text {
    min-width: 0;
    margin-top: 3px;
    color: #9ca3af;
    font-size: 10px;
    line-height: 1.45;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  /* =========================
     STATUS / DELIVERY
     ========================= */

  .sbs-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 25px;
    max-width: 100%;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 10px;
    line-height: 1.2;
    font-weight: 800;
    white-space: nowrap;
  }

  .sbs-status-success {
    color: #166534;
    background: #dcfce7;
  }

  .sbs-status-warning {
    color: #92400e;
    background: #fef3c7;
  }

  .sbs-status-danger {
    color: #991b1b;
    background: #fee2e2;
  }

  .sbs-status-neutral {
    color: #4b5563;
    background: #f3f4f6;
  }

  .sbs-delivery-list {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .sbs-delivery-dot {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    font-size: 10px;
    line-height: 1.4;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .sbs-delivery-dot::before {
    content: "";
    flex: 0 0 auto;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #9ca3af;
  }

  .sbs-delivery-dot.success::before {
    background: #16a34a;
  }

  .sbs-delivery-dot.warning::before {
    background: #d97706;
  }

  .sbs-delivery-dot.danger::before {
    background: #dc2626;
  }

  /* =========================
     EMPTY / MESSAGES
     ========================= */

  .sbs-empty {
    padding: 60px 20px;
    text-align: center;
  }

  .sbs-empty-icon {
    width: 48px;
    height: 48px;
    border-radius: 13px;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    margin: 0 auto 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 900;
    color: #059669;
  }

  .sbs-empty-title {
    margin: 0;
    font-size: 14px;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .sbs-empty-text {
    margin: 7px auto 0;
    max-width: 480px;
    color: #6b7280;
    font-size: 12px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .sbs-message {
    min-width: 0;
    border-radius: 10px;
    padding: 11px 13px;
    margin-bottom: 15px;
    font-size: 12px;
    line-height: 1.5;
    font-weight: 650;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .sbs-message-error {
    color: #991b1b;
    background: #fef2f2;
    border: 1px solid #fecaca;
  }

  .sbs-message-success {
    color: #166534;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
  }

  /* =========================
     MODALS
     ========================= */

  .sbs-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    background: rgba(15, 23, 42, 0.45);
    overflow-y: auto;
  }

  .sbs-modal {
    width: min(720px, 100%);
    max-width: 100%;
    max-height: calc(100vh - 36px);
    overflow-x: hidden;
    overflow-y: auto;
    background: #fff;
    border-radius: 15px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.2);
  }

  .sbs-modal-header {
    min-width: 0;
    padding: 18px 20px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .sbs-modal-header > div:first-child {
    min-width: 0;
    flex: 1 1 auto;
  }

  .sbs-modal-title {
    margin: 0;
    font-size: 17px;
    line-height: 1.3;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .sbs-modal-subtitle {
    margin: 5px 0 0;
    color: #6b7280;
    font-size: 11px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .sbs-close {
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    border: 1px solid #e5e7eb;
    background: #fff;
    cursor: pointer;
    font-size: 16px;
    color: #6b7280;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      color 0.15s ease;
  }

  .sbs-close:hover {
    border-color: #a7f3d0;
    background: #ecfdf5;
    color: #047857;
  }

  .sbs-modal-body {
    min-width: 0;
    padding: 20px;
  }

  .sbs-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 15px;
    min-width: 0;
  }

  .sbs-field {
    min-width: 0;
  }

  .sbs-field-full {
    grid-column: 1 / -1;
  }

  .sbs-label {
    display: block;
    margin-bottom: 7px;
    font-size: 11px;
    line-height: 1.4;
    font-weight: 800;
    color: #374151;
    overflow-wrap: anywhere;
  }

  .sbs-help {
    margin: 7px 0 0;
    color: #9ca3af;
    font-size: 10px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .sbs-modal-footer {
    min-width: 0;
    padding: 14px 20px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    flex-wrap: wrap;
  }

  /* =========================
     DETAIL VIEW
     ========================= */

  .sbs-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 11px;
    margin-bottom: 20px;
    min-width: 0;
  }

  .sbs-detail-card {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    border-radius: 11px;
    padding: 13px;
    background: #f9fafb;
  }

  .sbs-detail-label {
    color: #6b7280;
    font-size: 10px;
    line-height: 1.4;
    font-weight: 750;
    margin-bottom: 5px;
    overflow-wrap: anywhere;
  }

  .sbs-detail-value {
    min-width: 0;
    color: #111827;
    font-size: 13px;
    line-height: 1.45;
    font-weight: 800;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .sbs-section {
    min-width: 0;
    margin-top: 20px;
  }

  .sbs-section-heading {
    margin: 0 0 10px;
    font-size: 13px;
    line-height: 1.4;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .sbs-notification-row {
    min-width: 0;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 11px 12px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: #fff;
  }

  .sbs-notification-left {
    min-width: 0;
    flex: 1 1 auto;
  }

  .sbs-notification-channel {
    min-width: 0;
    color: #111827;
    font-size: 11px;
    line-height: 1.4;
    font-weight: 800;
    text-transform: capitalize;
    overflow-wrap: anywhere;
  }

  .sbs-notification-recipient {
    min-width: 0;
    margin-top: 3px;
    color: #6b7280;
    font-size: 10px;
    line-height: 1.45;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .sbs-notification-row > div:last-child {
    flex: 0 0 auto;
    min-width: 0;
  }

  .sbs-loading {
    padding: 60px 20px;
    text-align: center;
    color: #6b7280;
    font-size: 12px;
  }

  /* =========================
     LAPTOP / TABLET
     ========================= */

  @media (max-width: 1280px) {
    .sbs-page {
      padding: 22px;
    }

    .sbs-page-header {
      gap: 18px;
    }

    .sbs-stats-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .sbs-stat-card {
      padding: 15px;
    }

    .sbs-header-actions {
      max-width: 430px;
    }
  }

  /* Important for 14-inch laptops:
     the app content area can be much narrower than
     the physical screen because of the sidebar. */

  @media (max-width: 1100px) {
    .sbs-page {
      padding: 20px;
    }

    .sbs-page-header {
      flex-direction: column;
      align-items: stretch;
    }

    .sbs-header-actions {
      width: 100%;
      max-width: none;
      justify-content: flex-start;
    }

    .sbs-toolbar-top {
      flex-wrap: wrap;
    }

    .sbs-search {
      flex: 1 1 300px;
    }

    .sbs-toolbar-top > div {
      width: 180px !important;
      flex: 0 0 180px;
    }
  }

  @media (max-width: 1180px) {
    .sbs-closing-card {
      grid-template-columns: minmax(190px, 1.4fr) minmax(150px, 1fr) minmax(160px, 1fr);
    }

    .sbs-closing-status:nth-child(4),
    .sbs-closing-actions {
      border-left: 1px solid #f0f1f3;
    }

    .sbs-closing-actions {
      grid-column: 1 / -1;
      justify-content: flex-end;
      border-top: 1px solid #f0f1f3;
      border-left: 0;
    }
  }

  @media (max-width: 900px) {
    .sbs-stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .sbs-form-grid,
    .sbs-detail-grid {
      grid-template-columns: 1fr;
    }

    .sbs-field-full {
      grid-column: auto;
    }
  }

  /* =========================
     MOBILE
     ========================= */

  @media (max-width: 640px) {
    .sbs-closing-list {
      padding: 10px;
    }

    .sbs-closing-card {
      display: flex;
      flex-direction: column;
    }

    .sbs-closing-main,
    .sbs-closing-metric,
    .sbs-closing-status,
    .sbs-closing-actions {
      width: 100%;
      border-left: 0 !important;
      border-top: 1px solid #f0f1f3;
    }

    .sbs-closing-main {
      border-top: 0;
    }

    .sbs-closing-actions {
      justify-content: stretch;
    }

    .sbs-closing-action {
      flex: 1 1 0;
    }


    .sbs-page {
      padding: 16px;
    }

    .sbs-page-header {
      gap: 15px;
      margin-bottom: 18px;
    }

    .sbs-title {
      font-size: 23px;
    }

    .sbs-subtitle {
      font-size: 12px;
      line-height: 1.6;
    }

    .sbs-header-actions {
      display: grid;
      grid-template-columns: 1fr;
      width: 100%;
    }

    .sbs-header-actions .sbs-button,
    .sbs-header-actions a.sbs-button {
      width: 100%;
      justify-content: center;
    }

    .sbs-stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }

    .sbs-stat-card {
      padding: 13px;
      border-radius: 12px;
    }

    .sbs-stat-label {
      font-size: 10px;
      margin-bottom: 6px;
    }

    .sbs-stat-value {
      font-size: 20px;
    }

    .sbs-toolbar {
      padding: 11px;
      border-radius: 12px;
    }

    .sbs-toolbar-top {
      flex-direction: column;
      align-items: stretch;
      gap: 9px;
    }

    .sbs-search {
      flex: none;
      min-width: 0;
      width: 100%;
    }

    .sbs-toolbar-top > div {
      width: 100% !important;
      flex: none;
    }

    .sbs-filter-row {
      gap: 6px;
    }

    .sbs-filter-button {
      flex: 1 1 auto;
      min-width: 70px;
    }

    .sbs-table-header {
      padding: 14px;
      align-items: flex-start;
      flex-direction: column;
    }

    .sbs-modal-backdrop {
      align-items: flex-start;
      padding: 10px;
    }

    .sbs-modal {
      width: 100%;
      max-height: calc(100vh - 20px);
      border-radius: 13px;
    }

    .sbs-modal-header {
      padding: 15px;
    }

    .sbs-modal-body {
      padding: 15px;
    }

    .sbs-modal-footer {
      padding: 13px 15px;
    }

    .sbs-modal-footer .sbs-button {
      flex: 1 1 130px;
    }

    .sbs-notification-row {
      align-items: flex-start;
      flex-direction: column;
    }

    .sbs-notification-row > div:last-child {
      width: 100%;
      text-align: left !important;
    }
  }

  @media (max-width: 420px) {
    .sbs-page {
      padding: 12px;
    }

    .sbs-stats-grid {
      grid-template-columns: 1fr;
    }

    .sbs-stat-card {
      padding: 12px;
    }

    .sbs-filter-button {
      flex: 1 1 calc(50% - 6px);
    }

    .sbs-form-grid {
      gap: 12px;
    }
  }

  /* Prevent accidental horizontal page overflow from
     long database values, errors, emails, phone numbers,
     notification recipients, etc. */

  .sbs-page,
  .sbs-page-header,
  .sbs-toolbar,
  .sbs-table-card,
  .sbs-modal,
  .sbs-modal-body,
  .sbs-detail-card,
  .sbs-notification-row {
    overflow-wrap: anywhere;
  }
`}</style>

      <div className="sbs-page">
        <div className="sbs-page-header">
          <div>
            <p className="sbs-eyebrow">
              Expenses / Closings
            </p>

            <h1 className="sbs-title">
              Expense Closings
            </h1>

            <p className="sbs-subtitle">
              Review daily, weekly, monthly, and custom
              expense closing periods, including totals,
              transaction counts, and notification delivery
              status.
            </p>
          </div>

          <div className="sbs-header-actions">
            <Link
              href="/expenses"
              className="sbs-button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              Back to Expenses
            </Link>

            <button
              type="button"
              className="sbs-button"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              className="sbs-button sbs-button-primary"
              onClick={() => {
                clearMessages();
                setShowNewClosing(true);
              }}
            >
              + Create Closing
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="sbs-message sbs-message-error">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="sbs-message sbs-message-success">
            {successMessage}
          </div>
        ) : null}

        <div className="sbs-stats-grid">
          <div className="sbs-stat-card">
            <div className="sbs-stat-label">
              Total Closings
            </div>
            <div className="sbs-stat-value">
              {stats.total}
            </div>
          </div>

          <div className="sbs-stat-card">
            <div className="sbs-stat-label">
              Closed
            </div>
            <div className="sbs-stat-value">
              {stats.closed}
            </div>
          </div>

          <div className="sbs-stat-card">
            <div className="sbs-stat-label">
              Processing
            </div>
            <div className="sbs-stat-value">
              {stats.processing}
            </div>
          </div>

          <div className="sbs-stat-card">
            <div className="sbs-stat-label">
              Failed
            </div>
            <div className="sbs-stat-value">
              {stats.failed}
            </div>
          </div>

          <div className="sbs-stat-card">
            <div className="sbs-stat-label">
              Transactions Covered
            </div>
            <div className="sbs-stat-value">
              {stats.totalTransactions.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="sbs-toolbar">
          <div className="sbs-toolbar-top">
            <input
              className="sbs-search"
              type="search"
              placeholder="Search closings..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            <div style={{ width: 180 }}>
              <select
                className="sbs-select"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | "all"
                      | ClosingStatus,
                  )
                }
              >
                <option value="all">
                  All statuses
                </option>
                <option value="pending">
                  Pending
                </option>
                <option value="processing">
                  Processing
                </option>
                <option value="closed">
                  Closed
                </option>
                <option value="failed">
                  Failed
                </option>
              </select>
            </div>
          </div>

          <div className="sbs-filter-row">
            {(
              [
                ["all", "All"],
                ["daily", "Daily"],
                ["weekly", "Weekly"],
                ["monthly", "Monthly"],
                ["custom", "Custom"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`sbs-filter-button ${
                  activeType === value
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setActiveType(
                    value as "all" | ClosingType,
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="sbs-table-card">
          <div className="sbs-table-header">
            <div>
              <h2 className="sbs-table-title">Closing History</h2>
              <div className="sbs-table-subtitle">A clear view of every completed and scheduled expense period.</div>
            </div>

            <span className="sbs-table-count">
              {filteredClosings.length} {filteredClosings.length === 1 ? "closing" : "closings"}
            </span>
          </div>

          {loading ? (
            <div className="sbs-loading">Loading expense closings...</div>
          ) : filteredClosings.length === 0 ? (
            <div className="sbs-empty">
              <div className="sbs-empty-icon">C</div>
              <h3 className="sbs-empty-title">No closings found</h3>
              <p className="sbs-empty-text">
                No expense closing periods match your current filters. Create a closing manually or wait for your configured automated closing schedule.
              </p>
            </div>
          ) : (
            <div className="sbs-closing-list">
              {filteredClosings.map((closing) => {
                const closingJobs = jobs.filter((job) => job.closing_id === closing.id);
                const closingJobIds = new Set(closingJobs.map((job) => job.id));
                const closingDeliveries = deliveries.filter((delivery) => closingJobIds.has(delivery.job_id));
                const emailDelivery = closingDeliveries.find((delivery) => delivery.channel === "email");
                const whatsappDelivery = closingDeliveries.find((delivery) => delivery.channel === "whatsapp");

                return (
                  <div key={closing.id} className={`sbs-closing-card ${closing.status}`}>
                    <div className="sbs-closing-main">
                      <div className="sbs-closing-icon">
                        {getClosingTypeIcon(closing.closing_type)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="sbs-closing-title">
                          {closingTypeLabels[closing.closing_type]} Closing
                        </div>
                        <div className="sbs-closing-period">
                          {formatPeriod(closing)}
                        </div>
                        <div className="sbs-closing-id">
                          #{closing.id.slice(0, 8)}
                        </div>
                      </div>
                    </div>

                    <div className="sbs-closing-metric">
                      <div className="sbs-closing-metric-label">Total Expenses</div>
                      <div className="sbs-closing-amount">
                        {formatMoney(closing.total_expenses, closing.currency ?? "AED")}
                      </div>
                      <div className="sbs-closing-subvalue">
                        {Number(closing.transaction_count ?? 0).toLocaleString()} transactions · {closing.currency ?? "AED"}
                      </div>
                    </div>

                    <div className="sbs-closing-status">
                      <div className="sbs-closing-status-line">
                        <span className={`sbs-closing-status-dot ${closing.status}`} />
                        <span className="sbs-closing-status-name">
                          {closingStatusLabels[closing.status]}
                        </span>
                      </div>
                      <div className="sbs-closing-notifications">
                        <span className={`sbs-channel-pill ${emailDelivery?.status ?? ""}`}>Email</span>
                        <span className={`sbs-channel-pill ${whatsappDelivery?.status ?? ""}`}>WhatsApp</span>
                      </div>
                    </div>

                    <div className="sbs-closing-status">
                      <div className="sbs-closing-metric-label">Closed At</div>
                      <div className="sbs-closing-subvalue" style={{ marginTop: 5, color: "#334155", fontWeight: 700 }}>
                        {formatDateTime(closing.closed_at)}
                      </div>
                    </div>

                    <div className="sbs-closing-actions">
                      <button
                        type="button"
                        className="sbs-closing-action primary"
                        onClick={() => setSelectedClosing(closing)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="sbs-closing-action"
                        onClick={() => downloadClosingCsv(closing)}
                      >
                        CSV
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showNewClosing ? (
        <div
          className="sbs-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setShowNewClosing(false);
            }
          }}
        >
          <div className="sbs-modal">
            <div className="sbs-modal-header">
              <div>
                <h2 className="sbs-modal-title">
                  Create Expense Closing
                </h2>

                <p className="sbs-modal-subtitle">
                  Create a closing record for a specific
                  expense period.
                </p>
              </div>

              <button
                type="button"
                className="sbs-close"
                onClick={() =>
                  setShowNewClosing(false)
                }
              >
                ×
              </button>
            </div>

            <div className="sbs-modal-body">
              <div className="sbs-form-grid">
                <div className="sbs-field">
                  <label className="sbs-label">
                    Closing Type
                  </label>

                  <select
                    className="sbs-select"
                    value={newClosingType}
                    onChange={(event) =>
                      setNewClosingType(
                        event.target
                          .value as ClosingType,
                      )
                    }
                  >
                    <option value="daily">
                      Daily
                    </option>
                    <option value="weekly">
                      Weekly
                    </option>
                    <option value="monthly">
                      Monthly
                    </option>
                    <option value="custom">
                      Custom
                    </option>
                  </select>
                </div>

                <div className="sbs-field">
                  <label className="sbs-label">
                    Period Start
                  </label>

                  <input
                    className="sbs-input"
                    type="date"
                    value={newPeriodStart}
                    onChange={(event) =>
                      setNewPeriodStart(
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="sbs-field">
                  <label className="sbs-label">
                    Period End
                  </label>

                  <input
                    className="sbs-input"
                    type="date"
                    value={newPeriodEnd}
                    onChange={(event) =>
                      setNewPeriodEnd(
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="sbs-field">
                  <label className="sbs-label">
                    Closing Behavior
                  </label>

                  <div
                    style={{
                      minHeight: 40,
                      border: "1px solid #e5e7eb",
                      borderRadius: 9,
                      background: "#f9fafb",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 11px",
                      fontSize: 12,
                      color: "#6b7280",
                    }}
                  >
                    Records the period without deleting
                    expenses.
                  </div>
                </div>

                <div className="sbs-field sbs-field-full">
                  <p className="sbs-help">
                    The closing will include all non-cancelled
                    expenses for the selected date range.
                    Notification delivery is handled separately
                    by the server-side notification system.
                  </p>
                </div>
              </div>
            </div>

            <div className="sbs-modal-footer">
              <button
                type="button"
                className="sbs-button"
                onClick={() =>
                  setShowNewClosing(false)
                }
                disabled={creating}
              >
                Cancel
              </button>

              <button
                type="button"
                className="sbs-button sbs-button-primary"
                onClick={createClosing}
                disabled={creating}
              >
                {creating
                  ? "Creating..."
                  : "Create Closing"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedClosing ? (
        <div
          className="sbs-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSelectedClosing(null);
            }
          }}
        >
          <div className="sbs-modal">
            <div className="sbs-modal-header">
              <div>
                <h2 className="sbs-modal-title">
                  {
                    closingTypeLabels[
                      selectedClosing.closing_type
                    ]
                  }{" "}
                  Closing
                </h2>

                <p className="sbs-modal-subtitle">
                  {formatPeriod(selectedClosing)}
                </p>
              </div>

              <button
                type="button"
                className="sbs-close"
                onClick={() =>
                  setSelectedClosing(null)
                }
              >
                ×
              </button>
            </div>

            <div className="sbs-modal-body">
              <div className="sbs-detail-grid">
                <div className="sbs-detail-card">
                  <div className="sbs-detail-label">
                    Status
                  </div>

                  <div className="sbs-detail-value">
                    <span
                      className={getStatusClass(
                        selectedClosing.status,
                      )}
                    >
                      {
                        closingStatusLabels[
                          selectedClosing.status
                        ]
                      }
                    </span>
                  </div>
                </div>

                <div className="sbs-detail-card">
                  <div className="sbs-detail-label">
                    Total Expenses
                  </div>

                  <div className="sbs-detail-value">
                    {formatMoney(
                      selectedClosing.total_expenses,
                      selectedClosing.currency ??
                        "AED",
                    )}
                  </div>
                </div>

                <div className="sbs-detail-card">
                  <div className="sbs-detail-label">
                    Transactions
                  </div>

                  <div className="sbs-detail-value">
                    {Number(
                      selectedClosing.transaction_count ??
                        0,
                    ).toLocaleString()}
                  </div>
                </div>

                <div className="sbs-detail-card">
                  <div className="sbs-detail-label">
                    Currency
                  </div>

                  <div className="sbs-detail-value">
                    {selectedClosing.currency ??
                      "AED"}
                  </div>
                </div>

                <div className="sbs-detail-card">
                  <div className="sbs-detail-label">
                    Period
                  </div>

                  <div className="sbs-detail-value">
                    {formatPeriod(selectedClosing)}
                  </div>
                </div>

                <div className="sbs-detail-card">
                  <div className="sbs-detail-label">
                    Closed At
                  </div>

                  <div className="sbs-detail-value">
                    {formatDateTime(
                      selectedClosing.closed_at,
                    )}
                  </div>
                </div>
              </div>

              <div className="sbs-section">
                <h3 className="sbs-section-heading">
                  Notification Jobs
                </h3>

                {selectedJobs.length === 0 ? (
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 9,
                      padding: 13,
                      color: "#6b7280",
                      fontSize: 12,
                    }}
                  >
                    No notification jobs have been
                    created for this closing yet.
                  </div>
                ) : (
                  selectedJobs.map((job) => (
                    <div
                      key={job.id}
                      style={{
                        border:
                          "1px solid #e5e7eb",
                        borderRadius: 9,
                        padding: 12,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: 12,
                          alignItems:
                            "center",
                        }}
                      >
                        <div>
                          <div className="sbs-primary-text">
                            {job.job_type
                              .replace(
                                /_/g,
                                " ",
                              )
                              .replace(
                                /\b\w/g,
                                (letter) =>
                                  letter.toUpperCase(),
                              )}
                          </div>

                          <div className="sbs-secondary-text">
                            Scheduled:{" "}
                            {formatDateTime(
                              job.scheduled_for,
                            )}
                          </div>
                        </div>

                        <span
                          className={
                            job.status ===
                            "completed"
                              ? "sbs-status sbs-status-success"
                              : job.status ===
                                  "failed"
                                ? "sbs-status sbs-status-danger"
                                : "sbs-status sbs-status-neutral"
                          }
                        >
                          {job.status}
                        </span>
                      </div>

                      {job.last_error ? (
                        <div
                          style={{
                            marginTop: 9,
                            color: "#b91c1c",
                            background:
                              "#fef2f2",
                            border:
                              "1px solid #fecaca",
                            borderRadius: 7,
                            padding: 9,
                            fontSize: 11,
                          }}
                        >
                          {job.last_error}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              <div className="sbs-section">
                <h3 className="sbs-section-heading">
                  Notification Deliveries
                </h3>

                {selectedDeliveries.length === 0 ? (
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 9,
                      padding: 13,
                      color: "#6b7280",
                      fontSize: 12,
                    }}
                  >
                    No email or WhatsApp delivery
                    records are available for this
                    closing yet.
                  </div>
                ) : (
                  selectedDeliveries.map(
                    (delivery) => (
                      <div
                        className="sbs-notification-row"
                        key={delivery.id}
                      >
                        <div className="sbs-notification-left">
                          <div className="sbs-notification-channel">
                            {delivery.channel}
                          </div>

                          <div className="sbs-notification-recipient">
                            {delivery.recipient}
                          </div>

                          {delivery.error_message ? (
                            <div
                              style={{
                                marginTop: 5,
                                color: "#b91c1c",
                                fontSize: 11,
                              }}
                            >
                              {
                                delivery.error_message
                              }
                            </div>
                          ) : null}
                        </div>

                        <div
                          style={{
                            textAlign: "right",
                          }}
                        >
                          <span
                            className={
                              delivery.status ===
                              "sent"
                                ? "sbs-status sbs-status-success"
                                : delivery.status ===
                                    "failed"
                                  ? "sbs-status sbs-status-danger"
                                  : "sbs-status sbs-status-neutral"
                            }
                          >
                            {delivery.status}
                          </span>

                          <div className="sbs-secondary-text">
                            {formatDateTime(
                              delivery.sent_at,
                            )}
                          </div>
                        </div>
                      </div>
                    ),
                  )
                )}
              </div>
            </div>

            <div className="sbs-modal-footer">
              <button
                type="button"
                className="sbs-button"
                onClick={() =>
                  downloadClosingCsv(
                    selectedClosing,
                  )
                }
              >
                Export CSV
              </button>

              <button
                type="button"
                className="sbs-button sbs-button-primary"
                onClick={() =>
                  setSelectedClosing(null)
                }
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}