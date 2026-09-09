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

  const downloadClosingCsv = (closing: Closing) => {
    const rows = [
      [
        "Closing Type",
        "Period Start",
        "Period End",
        "Status",
        "Total Expenses",
        "Transaction Count",
        "Currency",
        "Closed At",
      ],
      [
        closingTypeLabels[closing.closing_type],
        closing.period_start,
        closing.period_end,
        closingStatusLabels[closing.status],
        String(closing.total_expenses ?? 0),
        String(closing.transaction_count ?? 0),
        closing.currency ?? "AED",
        closing.closed_at ?? "",
      ],
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const escaped = value.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `expense-${closing.closing_type}-closing-${closing.period_start}-${closing.period_end}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
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
          padding: 28px;
          background: #f6f7fb;
          color: #111827;
        }

        .sbs-page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .sbs-eyebrow {
          margin: 0 0 6px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #6b7280;
          text-transform: uppercase;
        }

        .sbs-title {
          margin: 0;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .sbs-subtitle {
          margin: 8px 0 0;
          color: #6b7280;
          font-size: 14px;
          line-height: 1.6;
          max-width: 760px;
        }

        .sbs-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .sbs-button {
          min-height: 40px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #fff;
          color: #111827;
          padding: 0 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            transform 0.15s ease;
        }

        .sbs-button:hover {
          border-color: #9ca3af;
          box-shadow: 0 3px 10px rgba(15, 23, 42, 0.06);
        }

        .sbs-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }

        .sbs-button-primary {
          background: #111827;
          border-color: #111827;
          color: #fff;
        }

        .sbs-button-primary:hover {
          border-color: #111827;
          background: #1f2937;
        }

        .sbs-button-danger {
          color: #b91c1c;
          border-color: #fecaca;
        }

        .sbs-button-small {
          min-height: 34px;
          padding: 0 11px;
          font-size: 12px;
        }

        .sbs-stats-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .sbs-stat-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 17px;
          min-width: 0;
        }

        .sbs-stat-label {
          color: #6b7280;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .sbs-stat-value {
          font-size: 23px;
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .sbs-toolbar {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 16px;
        }

        .sbs-toolbar-top {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .sbs-search {
          flex: 1;
          min-width: 220px;
          height: 40px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          padding: 0 13px;
          outline: none;
          font-size: 13px;
          color: #111827;
          background: #fff;
        }

        .sbs-search:focus,
        .sbs-select:focus,
        .sbs-input:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.06);
        }

        .sbs-select,
        .sbs-input {
          width: 100%;
          height: 40px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          padding: 0 11px;
          outline: none;
          font-size: 13px;
          color: #111827;
          background: #fff;
        }

        .sbs-filter-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sbs-filter-button {
          height: 34px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
          color: #6b7280;
          padding: 0 11px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .sbs-filter-button.active {
          color: #111827;
          border-color: #111827;
          background: #f9fafb;
        }

        .sbs-table-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }

        .sbs-table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 17px 18px;
          border-bottom: 1px solid #e5e7eb;
        }

        .sbs-table-title {
          margin: 0;
          font-size: 14px;
          font-weight: 800;
        }

        .sbs-table-count {
          color: #6b7280;
          font-size: 12px;
        }

        .sbs-table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .sbs-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 980px;
        }

        .sbs-table th {
          text-align: left;
          padding: 12px 16px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }

        .sbs-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #f0f1f3;
          font-size: 13px;
          vertical-align: middle;
        }

        .sbs-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .sbs-table tbody tr:hover {
          background: #fafafa;
        }

        .sbs-type-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sbs-type-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          font-size: 11px;
          font-weight: 900;
          color: #374151;
        }

        .sbs-primary-text {
          color: #111827;
          font-weight: 750;
        }

        .sbs-secondary-text {
          margin-top: 3px;
          color: #9ca3af;
          font-size: 11px;
        }

        .sbs-status {
          display: inline-flex;
          align-items: center;
          min-height: 25px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
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
        }

        .sbs-delivery-dot {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
        }

        .sbs-delivery-dot::before {
          content: "";
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

        .sbs-empty {
          padding: 60px 20px;
          text-align: center;
        }

        .sbs-empty-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          margin: 0 auto 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 900;
          color: #6b7280;
        }

        .sbs-empty-title {
          margin: 0;
          font-size: 14px;
          font-weight: 800;
        }

        .sbs-empty-text {
          margin: 7px auto 0;
          max-width: 480px;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.6;
        }

        .sbs-message {
          border-radius: 10px;
          padding: 11px 13px;
          margin-bottom: 15px;
          font-size: 13px;
          font-weight: 650;
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

        .sbs-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.42);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .sbs-modal {
          width: min(720px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
        }

        .sbs-modal-header {
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
        }

        .sbs-modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
        }

        .sbs-modal-subtitle {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .sbs-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          font-size: 16px;
          color: #6b7280;
        }

        .sbs-modal-body {
          padding: 20px;
        }

        .sbs-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
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
          font-size: 12px;
          font-weight: 800;
          color: #374151;
        }

        .sbs-help {
          margin: 7px 0 0;
          color: #9ca3af;
          font-size: 11px;
          line-height: 1.5;
        }

        .sbs-modal-footer {
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: flex-end;
          gap: 9px;
        }

        .sbs-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .sbs-detail-card {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 14px;
          background: #fafafa;
        }

        .sbs-detail-label {
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .sbs-detail-value {
          color: #111827;
          font-size: 14px;
          font-weight: 800;
        }

        .sbs-section {
          margin-top: 20px;
        }

        .sbs-section-heading {
          margin: 0 0 10px;
          font-size: 13px;
          font-weight: 800;
        }

        .sbs-notification-row {
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          padding: 11px 12px;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .sbs-notification-left {
          min-width: 0;
        }

        .sbs-notification-channel {
          font-size: 12px;
          font-weight: 800;
          text-transform: capitalize;
        }

        .sbs-notification-recipient {
          margin-top: 3px;
          color: #6b7280;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .sbs-loading {
          padding: 60px 20px;
          text-align: center;
          color: #6b7280;
          font-size: 13px;
        }

        @media (max-width: 1200px) {
          .sbs-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .sbs-page {
            padding: 18px;
          }

          .sbs-page-header {
            flex-direction: column;
          }

          .sbs-header-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .sbs-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sbs-toolbar-top {
            flex-direction: column;
            align-items: stretch;
          }

          .sbs-form-grid,
          .sbs-detail-grid {
            grid-template-columns: 1fr;
          }

          .sbs-field-full {
            grid-column: auto;
          }
        }

        @media (max-width: 520px) {
          .sbs-stats-grid {
            grid-template-columns: 1fr;
          }

          .sbs-header-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .sbs-header-actions .sbs-button {
            width: 100%;
          }
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
            <h2 className="sbs-table-title">
              Closing History
            </h2>

            <span className="sbs-table-count">
              {filteredClosings.length}{" "}
              {filteredClosings.length === 1
                ? "closing"
                : "closings"}
            </span>
          </div>

          {loading ? (
            <div className="sbs-loading">
              Loading expense closings...
            </div>
          ) : filteredClosings.length === 0 ? (
            <div className="sbs-empty">
              <div className="sbs-empty-icon">
                C
              </div>

              <h3 className="sbs-empty-title">
                No closings found
              </h3>

              <p className="sbs-empty-text">
                No expense closing periods match your
                current filters. Create a closing manually
                or wait for your configured automated
                closing schedule.
              </p>
            </div>
          ) : (
            <div className="sbs-table-wrap">
              <table className="sbs-table">
                <thead>
                  <tr>
                    <th>Closing</th>
                    <th>Period</th>
                    <th>Total Expenses</th>
                    <th>Transactions</th>
                    <th>Status</th>
                    <th>Notifications</th>
                    <th>Closed At</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredClosings.map((closing) => {
                    const closingJobs = jobs.filter(
                      (job) =>
                        job.closing_id === closing.id,
                    );

                    const closingJobIds = new Set(
                      closingJobs.map((job) => job.id),
                    );

                    const closingDeliveries =
                      deliveries.filter((delivery) =>
                        closingJobIds.has(
                          delivery.job_id,
                        ),
                      );

                    const emailDelivery =
                      closingDeliveries.find(
                        (delivery) =>
                          delivery.channel === "email",
                      );

                    const whatsappDelivery =
                      closingDeliveries.find(
                        (delivery) =>
                          delivery.channel ===
                          "whatsapp",
                      );

                    return (
                      <tr key={closing.id}>
                        <td>
                          <div className="sbs-type-cell">
                            <div className="sbs-type-icon">
                              {getClosingTypeIcon(
                                closing.closing_type,
                              )}
                            </div>

                            <div>
                              <div className="sbs-primary-text">
                                {
                                  closingTypeLabels[
                                    closing
                                      .closing_type
                                  ]
                                }{" "}
                                Closing
                              </div>

                              <div className="sbs-secondary-text">
                                ID:{" "}
                                {closing.id.slice(
                                  0,
                                  8,
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="sbs-primary-text">
                            {formatPeriod(closing)}
                          </div>
                        </td>

                        <td>
                          <div className="sbs-primary-text">
                            {formatMoney(
                              closing.total_expenses,
                              closing.currency ??
                                "AED",
                            )}
                          </div>

                          <div className="sbs-secondary-text">
                            {closing.currency ?? "AED"}
                          </div>
                        </td>

                        <td>
                          <div className="sbs-primary-text">
                            {Number(
                              closing.transaction_count ??
                                0,
                            ).toLocaleString()}
                          </div>
                        </td>

                        <td>
                          <span
                            className={getStatusClass(
                              closing.status,
                            )}
                          >
                            {
                              closingStatusLabels[
                                closing.status
                              ]
                            }
                          </span>
                        </td>

                        <td>
                          <div className="sbs-delivery-list">
                            {emailDelivery ? (
                              <span
                                className={getDeliveryClass(
                                  emailDelivery.status,
                                )}
                              >
                                Email
                              </span>
                            ) : (
                              <span className="sbs-delivery-dot neutral">
                                Email
                              </span>
                            )}

                            {whatsappDelivery ? (
                              <span
                                className={getDeliveryClass(
                                  whatsappDelivery.status,
                                )}
                              >
                                WhatsApp
                              </span>
                            ) : (
                              <span className="sbs-delivery-dot neutral">
                                WhatsApp
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="sbs-primary-text">
                            {formatDateTime(
                              closing.closed_at,
                            )}
                          </div>
                        </td>

                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: 7,
                              alignItems:
                                "center",
                            }}
                          >
                            <button
                              type="button"
                              className="sbs-button sbs-button-small"
                              onClick={() =>
                                setSelectedClosing(
                                  closing,
                                )
                              }
                            >
                              View
                            </button>

                            <button
                              type="button"
                              className="sbs-button sbs-button-small"
                              onClick={() =>
                                downloadClosingCsv(
                                  closing,
                                )
                              }
                            >
                              CSV
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