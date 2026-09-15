"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type ExpenseType =
  | "operating_expense"
  | "inventory_expense"
  | "employee_advance"
  | "reimbursement"
  | "petty_cash"
  | "other";

type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "credit_card"
  | "debit_card"
  | "company_card"
  | "petty_cash"
  | "other";

type ExpenseStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "paid"
  | "cancelled";

type SettlementStatus =
  | "not_applicable"
  | "outstanding"
  | "partially_settled"
  | "settled";

type Expense = {
  id: string;
  company_id: string;
  expense_date: string;
  expense_type: ExpenseType;
  category_id: string | null;
  description: string;
  vendor_name: string | null;
  employee_id: string | null;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  receipt_path: string | null;
  status: ExpenseStatus;
  settlement_status: SettlementStatus;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

type Category = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
};

type Settlement = {
  id: string;
  settlement_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

type Activity = {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  actor_id: string | null;
};

type NotificationJob = {
  id: string;
  job_type: string;
  status: string;
  scheduled_for: string | null;
  attempts: number;
  last_error: string | null;
  completed_at: string | null;
  created_at: string;
};

type NotificationDelivery = {
  id: string;
  channel: "email" | "whatsapp";
  recipient: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
};

type Company = {
  id: string;
  name: string;
  currency?: string | null;
};

const expenseTypeLabels: Record<ExpenseType, string> = {
  operating_expense: "Operating Expense",
  inventory_expense: "Inventory Expense",
  employee_advance: "Employee Advance",
  reimbursement: "Reimbursement",
  petty_cash: "Petty Cash",
  other: "Other",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  company_card: "Company Card",
  petty_cash: "Petty Cash",
  other: "Other",
};

const statusLabels: Record<ExpenseStatus, string> = {
  pending: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  cancelled: "Cancelled",
};

const settlementLabels: Record<SettlementStatus, string> = {
  not_applicable: "Not Applicable",
  outstanding: "Outstanding",
  partially_settled: "Partially Settled",
  settled: "Settled",
};

function formatCurrency(amount: number, currency = "AED") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function employeeName(employee?: Employee | null) {
  if (!employee) return "—";

  if (employee.display_name?.trim()) {
    return employee.display_name.trim();
  }

  return [employee.first_name, employee.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || "Employee";
}

function statusClass(status: ExpenseStatus) {
  switch (status) {
    case "paid":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "approved":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "rejected":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "cancelled":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function settlementClass(status: SettlementStatus) {
  switch (status) {
    case "settled":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "partially_settled":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "outstanding":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function actionLabel(action: string) {
  return action
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();

  const expenseId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [company, setCompany] = useState<Company | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [notificationJobs, setNotificationJobs] = useState<
    NotificationJob[]
  >([]);
  const [notificationDeliveries, setNotificationDeliveries] = useState<
    NotificationDelivery[]
  >([]);

  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementDate, setSettlementDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [settlementPaymentMethod, setSettlementPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [settlementReference, setSettlementReference] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [receiptUrl, setReceiptUrl] = useState("");

  const loadData = useCallback(
    async (showRefreshState = false) => {
      if (!expenseId) {
        setErrorMessage("Expense ID is missing.");
        setLoading(false);
        return;
      }

      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          router.push("/login");
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

        const [
          companyResult,
          expenseResult,
          settlementsResult,
          activityResult,
          jobsResult,
        ] = await Promise.all([
          supabase
            .from("companies")
            .select("id, name")
            .eq("id", companyId)
            .maybeSingle(),

          supabase
            .from("expenses")
            .select(
              `
                id,
                company_id,
                expense_date,
                expense_type,
                category_id,
                description,
                vendor_name,
                employee_id,
                amount,
                currency,
                payment_method,
                reference,
                notes,
                receipt_path,
                status,
                settlement_status,
                created_by,
                approved_by,
                approved_at,
                created_at,
                updated_at
              `
            )
            .eq("id", expenseId)
            .eq("company_id", companyId)
            .maybeSingle(),

          supabase
            .from("expense_settlements")
            .select(
              `
                id,
                settlement_date,
                amount,
                payment_method,
                reference,
                notes,
                created_by,
                created_at
              `
            )
            .eq("expense_id", expenseId)
            .eq("company_id", companyId)
            .order("settlement_date", { ascending: false })
            .order("created_at", { ascending: false }),

          supabase
            .from("expense_activity")
            .select(
              `
                id,
                action,
                details,
                created_at,
                actor_id
              `
            )
            .eq("expense_id", expenseId)
            .eq("company_id", companyId)
            .order("created_at", { ascending: false }),

          supabase
            .from("expense_notification_jobs")
            .select(
              `
                id,
                job_type,
                status,
                scheduled_for,
                attempts,
                last_error,
                completed_at,
                created_at
              `
            )
            .eq("expense_id", expenseId)
            .eq("company_id", companyId)
            .order("created_at", { ascending: false }),
        ]);

        if (companyResult.error) {
          throw companyResult.error;
        }

        if (expenseResult.error) {
          throw expenseResult.error;
        }

        if (!expenseResult.data) {
          throw new Error("Expense not found.");
        }

        if (settlementsResult.error) {
          throw settlementsResult.error;
        }

        if (activityResult.error) {
          throw activityResult.error;
        }

        if (jobsResult.error) {
          throw jobsResult.error;
        }

        const loadedExpense = expenseResult.data as Expense;

        setCompany(companyResult.data as Company | null);
        setExpense(loadedExpense);
        setSettlements(
          (settlementsResult.data || []) as Settlement[]
        );
        setActivity((activityResult.data || []) as Activity[]);
        setNotificationJobs(
          (jobsResult.data || []) as NotificationJob[]
        );

        if (loadedExpense.category_id) {
          const { data: categoryData } = await supabase
            .from("expense_categories")
            .select("id, name")
            .eq("id", loadedExpense.category_id)
            .eq("company_id", companyId)
            .maybeSingle();

          setCategory(categoryData as Category | null);
        } else {
          setCategory(null);
        }

        if (loadedExpense.employee_id) {
          const { data: employeeData } = await supabase
            .from("employees")
            .select("id, first_name, last_name, display_name")
            .eq("id", loadedExpense.employee_id)
            .eq("company_id", companyId)
            .maybeSingle();

          setEmployee(employeeData as Employee | null);
        } else {
          setEmployee(null);
        }

        const jobIds = (jobsResult.data || []).map(
          (job) => job.id
        );

        if (jobIds.length > 0) {
          const { data: deliveryData, error: deliveryError } =
            await supabase
              .from("expense_notification_deliveries")
              .select(
                `
                  id,
                  channel,
                  recipient,
                  status,
                  provider_message_id,
                  error_message,
                  sent_at
                `
              )
              .eq("company_id", companyId)
              .in("job_id", jobIds)
              .order("created_at", { ascending: false });

          if (!deliveryError) {
            setNotificationDeliveries(
              (deliveryData || []) as NotificationDelivery[]
            );
          }
        } else {
          setNotificationDeliveries([]);
        }

        if (loadedExpense.receipt_path) {
          const { data: signedUrlData } = await supabase.storage
            .from("expense-receipts")
            .createSignedUrl(loadedExpense.receipt_path, 60 * 60);

          setReceiptUrl(signedUrlData?.signedUrl || "");
        } else {
          setReceiptUrl("");
        }
      } catch (error) {
        console.error(error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load expense."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [expenseId, router, supabase]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const settledAmount = useMemo(
    () =>
      settlements.reduce(
        (total, settlement) => total + Number(settlement.amount || 0),
        0
      ),
    [settlements]
  );

  const outstandingAmount = useMemo(() => {
    if (!expense) return 0;

    return Math.max(
      Number(expense.amount || 0) - settledAmount,
      0
    );
  }, [expense, settledAmount]);

  const settlementProgress = useMemo(() => {
    if (!expense || Number(expense.amount) <= 0) return 0;

    return Math.min(
      100,
      Math.round(
        (settledAmount / Number(expense.amount)) * 100
      )
    );
  }, [expense, settledAmount]);

  const canApprove =
    expense?.status === "pending";

  const canReject =
    expense?.status === "pending" ||
    expense?.status === "approved";

  const canMarkPaid =
    expense?.status === "approved";

  const canCancel =
    expense?.status !== "cancelled" &&
    expense?.status !== "paid";

  const canSettle =
    expense &&
    expense.expense_type === "employee_advance" &&
    outstandingAmount > 0 &&
    expense.status !== "cancelled";

  async function updateExpenseStatus(
    newStatus: ExpenseStatus,
    activityAction: string,
    details: Record<string, unknown> = {}
  ) {
    if (!expense) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const updateData: Record<string, unknown> = {
        status: newStatus,
      };

      if (newStatus === "approved") {
        updateData.approved_by = user.id;
        updateData.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("expenses")
        .update(updateData)
        .eq("id", expense.id)
        .eq("company_id", expense.company_id);

      if (error) {
        throw error;
      }

      await supabase.from("expense_activity").insert({
        company_id: expense.company_id,
        expense_id: expense.id,
        actor_id: user.id,
        action: activityAction,
        details,
      });

      setSuccessMessage(
        `Expense ${statusLabels[newStatus].toLowerCase()}.`
      );

      await loadData(true);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to update expense."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSettlementSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!expense) return;

    const amount = Number(settlementAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Enter a valid settlement amount.");
      return;
    }

    if (amount > outstandingAmount) {
      setErrorMessage(
        `Settlement cannot exceed the outstanding amount of ${formatCurrency(
          outstandingAmount,
          expense.currency
        )}.`
      );
      return;
    }

    if (!settlementDate) {
      setErrorMessage("Settlement date is required.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { error: settlementError } = await supabase
        .from("expense_settlements")
        .insert({
          company_id: expense.company_id,
          expense_id: expense.id,
          settlement_date: settlementDate,
          amount,
          payment_method: settlementPaymentMethod,
          reference: settlementReference.trim() || null,
          notes: settlementNotes.trim() || null,
          created_by: user.id,
        });

      if (settlementError) {
        throw settlementError;
      }

      const newSettledAmount = settledAmount + amount;

      let newSettlementStatus: SettlementStatus =
        "partially_settled";

      if (newSettledAmount >= Number(expense.amount)) {
        newSettlementStatus = "settled";
      }

      const { error: expenseUpdateError } = await supabase
        .from("expenses")
        .update({
          settlement_status: newSettlementStatus,
        })
        .eq("id", expense.id)
        .eq("company_id", expense.company_id);

      if (expenseUpdateError) {
        throw expenseUpdateError;
      }

      await supabase.from("expense_activity").insert({
        company_id: expense.company_id,
        expense_id: expense.id,
        actor_id: user.id,
        action: "settlement_added",
        details: {
          amount,
          settlement_status: newSettlementStatus,
          payment_method: settlementPaymentMethod,
          reference: settlementReference.trim() || null,
        },
      });

      setSettlementAmount("");
      setSettlementReference("");
      setSettlementNotes("");
      setShowSettlementModal(false);

      setSuccessMessage("Settlement recorded successfully.");

      await loadData(true);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to record settlement."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelExpense(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!expense) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase
        .from("expenses")
        .update({
          status: "cancelled",
        })
        .eq("id", expense.id)
        .eq("company_id", expense.company_id);

      if (error) {
        throw error;
      }

      await supabase.from("expense_activity").insert({
        company_id: expense.company_id,
        expense_id: expense.id,
        actor_id: user.id,
        action: "cancelled",
        details: {
          reason: cancelReason.trim() || null,
        },
      });

      setCancelReason("");
      setShowCancelModal(false);

      setSuccessMessage("Expense cancelled.");

      await loadData(true);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to cancel expense."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="text-sm text-slate-500">
            Loading expense...
          </div>
        </div>
      </AppShell>
    );
  }

  if (!expense) {
    return (
      <AppShell>
        <div className="p-4 sm:p-6">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
            <h2 className="text-lg font-semibold text-rose-800">
              Expense not found
            </h2>

            <p className="mt-1 text-sm text-rose-700">
              {errorMessage ||
                "The expense could not be found or you do not have access to it."}
            </p>

            <Link
              href="/expenses"
              className="mt-5 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Back to Expenses
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50">
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                  <Link
                    href="/expenses"
                    className="hover:text-slate-900"
                  >
                    Expenses
                  </Link>

                  <span>/</span>

                  <span className="text-slate-700">
                    Expense Detail
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    {expense.description}
                  </h1>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                      expense.status
                    )}`}
                  >
                    {statusLabels[expense.status]}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Expense #{expense.id.slice(0, 8).toUpperCase()} ·{" "}
                  {formatDate(expense.expense_date)}
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => loadData(true)}
                  disabled={refreshing || saving}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>

                <Link
                  href={`/expenses/${expense.id}/edit`}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Edit
                </Link>

                {canApprove && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      updateExpenseStatus(
                        "approved",
                        "approved"
                      )
                    }
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}

                {canMarkPaid && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      updateExpenseStatus(
                        "paid",
                        "marked_paid"
                      )
                    }
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Mark Paid
                  </button>
                )}

                {canReject && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      updateExpenseStatus(
                        "rejected",
                        "rejected"
                      )
                    }
                    className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}

                {canCancel && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowCancelModal(true)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Expense Amount
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(expense.amount, expense.currency)}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Original transaction
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Settled
              </p>

              <p className="mt-2 text-2xl font-bold text-emerald-600">
                {formatCurrency(
                  settledAmount,
                  expense.currency
                )}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {settlementProgress}% settled
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Outstanding
              </p>

              <p className="mt-2 text-2xl font-bold text-amber-600">
                {formatCurrency(
                  outstandingAmount,
                  expense.currency
                )}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Remaining balance
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Category
              </p>

              <p className="mt-2 truncate text-lg font-bold text-slate-900">
                {category?.name || "Uncategorized"}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {expenseTypeLabels[expense.expense_type]}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payment Method
              </p>

              <p className="mt-2 text-lg font-bold text-slate-900">
                {paymentMethodLabels[expense.payment_method]}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Transaction method
              </p>
            </div>
          </div>

          {/* Main content */}
          <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)] xl:gap-6">
            <div className="min-w-0 space-y-5 sm:space-y-6 xl:sticky xl:top-6 xl:self-start">
              {/* Expense information */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                  <h2 className="text-base font-bold text-slate-900">
                    Expense Information
                  </h2>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Complete transaction details
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-x-8 gap-y-6 p-6 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Expense Type
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {expenseTypeLabels[expense.expense_type]}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {category?.name || "Uncategorized"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Expense Date
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatDate(expense.expense_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Amount
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {formatCurrency(
                        expense.amount,
                        expense.currency
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Vendor / Merchant
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {expense.vendor_name || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reference
                    </p>
                    <p className="mt-1 break-all text-sm font-medium text-slate-900">
                      {expense.reference || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Employee
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {employeeName(employee)}
                    </p>

                    {!employee &&
                      expense.employee_id && (
                        <p className="mt-1 text-xs text-amber-600">
                          Employee record not currently available.
                        </p>
                      )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Company
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {company?.name || "—"}
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Description
                    </p>

                    <div className="mt-2 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                      {expense.description}
                    </div>
                  </div>

                  {expense.notes && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Notes
                      </p>

                      <div className="mt-2 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                        {expense.notes}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Settlement */}
              {expense.expense_type === "employee_advance" && (
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Employee Advance Settlement
                      </h2>

                      <p className="mt-0.5 text-sm text-slate-500">
                        Track money returned against this advance
                      </p>
                    </div>

                    {canSettle && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowSettlementModal(true)
                        }
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        Add Settlement
                      </button>
                    )}
                  </div>

                  <div className="p-4 sm:p-6">
                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Advance
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {formatCurrency(
                            expense.amount,
                            expense.currency
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Returned
                        </p>
                        <p className="mt-1 text-lg font-bold text-emerald-700">
                          {formatCurrency(
                            settledAmount,
                            expense.currency
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                          Outstanding
                        </p>
                        <p className="mt-1 text-lg font-bold text-amber-700">
                          {formatCurrency(
                            outstandingAmount,
                            expense.currency
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-500">
                          Settlement Progress
                        </span>

                        <span className="text-slate-700">
                          {settlementProgress}%
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{
                            width: `${settlementProgress}%`,
                          }}
                        />
                      </div>
                    </div>

                    {settlements.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                        <p className="text-sm font-medium text-slate-700">
                          No settlements recorded
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Returned money will appear here once
                          recorded.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Date
                                </th>

                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Amount
                                </th>

                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Method
                                </th>

                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Reference
                                </th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-200 bg-white">
                              {settlements.map(
                                (settlement) => (
                                  <tr key={settlement.id}>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                                      {formatDate(
                                        settlement.settlement_date
                                      )}
                                    </td>

                                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-emerald-700">
                                      {formatCurrency(
                                        settlement.amount,
                                        expense.currency
                                      )}
                                    </td>

                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                                      {
                                        paymentMethodLabels[
                                          settlement.payment_method
                                        ]
                                      }
                                    </td>

                                    <td className="px-4 py-3 text-sm text-slate-600">
                                      {settlement.reference ||
                                        "—"}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Receipt */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                  <h2 className="text-base font-bold text-slate-900">
                    Supporting Document
                  </h2>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Receipt or expense attachment
                  </p>
                </div>

                <div className="p-4 sm:p-6">
                  {!expense.receipt_path ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        No receipt attached
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        You can attach a receipt from the Edit
                        Expense page.
                      </p>
                    </div>
                  ) : receiptUrl ? (
                    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          Receipt attached
                        </p>

                        <p className="mt-1 truncate text-xs text-slate-500">
                          {expense.receipt_path.split("/").pop()}
                        </p>
                      </div>

                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        Open Receipt
                      </a>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
                      The receipt exists, but a secure preview URL
                      could not be generated.
                    </div>
                  )}
                </div>
              </section>

              {/* Activity */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                  <h2 className="text-base font-bold text-slate-900">
                    Activity History
                  </h2>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Permanent audit trail for this expense
                  </p>
                </div>

                <div className="p-4 sm:p-6">
                  {activity.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                      <p className="text-sm text-slate-500">
                        No activity recorded yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {activity.map((item, index) => (
                        <div
                          key={item.id}
                          className="relative flex gap-4"
                        >
                          {index <
                            activity.length - 1 && (
                            <div className="absolute left-[7px] top-7 h-[calc(100%+12px)] w-px bg-slate-200" />
                          )}

                          <div className="relative mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-white bg-slate-400 ring-1 ring-slate-200" />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-semibold text-slate-900">
                                {actionLabel(item.action)}
                              </p>

                              <p className="text-xs text-slate-400">
                                {formatDateTime(
                                  item.created_at
                                )}
                              </p>
                            </div>

                            {item.details &&
                              Object.keys(item.details).length >
                                0 && (
                                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                  {Object.entries(
                                    item.details
                                  )
                                    .filter(
                                      ([, value]) =>
                                        value !== null &&
                                        value !== undefined &&
                                        value !== ""
                                    )
                                    .map(
                                      ([key, value]) => (
                                        <div
                                          key={key}
                                          className="flex gap-2"
                                        >
                                          <span className="font-medium text-slate-700">
                                            {actionLabel(
                                              key
                                            )}
                                            :
                                          </span>

                                          <span className="break-all">
                                            {typeof value ===
                                            "object"
                                              ? JSON.stringify(
                                                  value
                                                )
                                              : String(
                                                  value
                                                )}
                                          </span>
                                        </div>
                                      )
                                    )}
                                </div>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Right sidebar */}
            <div className="min-w-0 space-y-5 sm:space-y-6 xl:sticky xl:top-6 xl:self-start">
              {/* Status */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                  <h2 className="text-base font-bold text-slate-900">
                    Status
                  </h2>
                </div>

                <div className="space-y-5 p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Expense Status
                    </p>

                    <span
                      className={`mt-2 inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass(
                        expense.status
                      )}`}
                    >
                      {statusLabels[expense.status]}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Settlement Status
                    </p>

                    <span
                      className={`mt-2 inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${settlementClass(
                        expense.settlement_status
                      )}`}
                    >
                      {
                        settlementLabels[
                          expense.settlement_status
                        ]
                      }
                    </span>
                  </div>

                  {expense.approved_at && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Approved At
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {formatDateTime(
                          expense.approved_at
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Notification */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                  <h2 className="text-base font-bold text-slate-900">
                    Notifications
                  </h2>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Expense notification delivery
                  </p>
                </div>

                <div className="p-4 sm:p-6">
                  {notificationJobs.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                      <p className="text-sm text-slate-600">
                        No notification job found.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {notificationJobs.map((job) => (
                        <div
                          key={job.id}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {actionLabel(job.job_type)}
                            </p>

                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                              {actionLabel(job.status)}
                            </span>
                          </div>

                          <div className="mt-3 space-y-1 text-xs text-slate-500">
                            <p>
                              Created:{" "}
                              {formatDateTime(
                                job.created_at
                              )}
                            </p>

                            {job.completed_at && (
                              <p>
                                Completed:{" "}
                                {formatDateTime(
                                  job.completed_at
                                )}
                              </p>
                            )}

                            <p>
                              Attempts: {job.attempts}
                            </p>
                          </div>

                          {job.last_error && (
                            <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                              {job.last_error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {notificationDeliveries.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Delivery Attempts
                      </p>

                      <div className="space-y-2">
                        {notificationDeliveries.map(
                          (delivery) => (
                            <div
                              key={delivery.id}
                              className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800">
                                  {delivery.channel ===
                                  "whatsapp"
                                    ? "WhatsApp"
                                    : "Email"}
                                </p>

                                <p className="truncate text-[11px] text-slate-500">
                                  {delivery.recipient}
                                </p>
                              </div>

                              <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">
                                {actionLabel(
                                  delivery.status
                                )}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Record information */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                  <h2 className="text-base font-bold text-slate-900">
                    Record Information
                  </h2>
                </div>

                <div className="space-y-4 p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Expense ID
                    </p>

                    <p className="mt-1 break-all font-mono text-xs text-slate-700">
                      {expense.id}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Created
                    </p>

                    <p className="mt-1 text-sm text-slate-700">
                      {formatDateTime(expense.created_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Last Updated
                    </p>

                    <p className="mt-1 text-sm text-slate-700">
                      {formatDateTime(expense.updated_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Currency
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {expense.currency}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Settlement Modal */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Add Settlement
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Record money returned against this employee
                    advance.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowSettlementModal(false)
                  }
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSettlementSubmit}
              className="space-y-5 p-6"
            >
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-amber-800">
                    Outstanding
                  </span>

                  <span className="font-bold text-amber-800">
                    {formatCurrency(
                      outstandingAmount,
                      expense.currency
                    )}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Settlement Amount
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={outstandingAmount}
                  value={settlementAmount}
                  onChange={(event) =>
                    setSettlementAmount(
                      event.target.value
                    )
                  }
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Settlement Date
                  </label>

                  <input
                    type="date"
                    value={settlementDate}
                    onChange={(event) =>
                      setSettlementDate(
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Payment Method
                  </label>

                  <select
                    value={settlementPaymentMethod}
                    onChange={(event) =>
                      setSettlementPaymentMethod(
                        event.target.value as PaymentMethod
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  >
                    {Object.entries(
                      paymentMethodLabels
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Reference
                </label>

                <input
                  type="text"
                  value={settlementReference}
                  onChange={(event) =>
                    setSettlementReference(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  placeholder="Receipt, transaction ID, etc."
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Notes
                </label>

                <textarea
                  rows={3}
                  value={settlementNotes}
                  onChange={(event) =>
                    setSettlementNotes(
                      event.target.value
                    )
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  placeholder="Optional settlement notes..."
                />
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setShowSettlementModal(false)
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : "Record Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Cancel Expense
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    This keeps the expense permanently recorded
                    but marks it as cancelled.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowCancelModal(false)
                  }
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <form
              onSubmit={handleCancelExpense}
              className="space-y-5 p-6"
            >
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Cancelling an expense does not delete it. The
                record and audit history will remain available.
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Cancellation Reason
                </label>

                <textarea
                  rows={4}
                  value={cancelReason}
                  onChange={(event) =>
                    setCancelReason(event.target.value)
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  placeholder="Why is this expense being cancelled?"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setShowCancelModal(false)
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Keep Expense
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Cancelling..." : "Cancel Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}