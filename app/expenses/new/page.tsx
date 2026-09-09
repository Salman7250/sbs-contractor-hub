"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type Category = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type Employee = {
  id: string;
  name: string;
};

type Company = {
  id: string;
  name: string;
  currency: string | null;
};

const EXPENSE_TYPES: {
  value: ExpenseType;
  label: string;
  description: string;
}[] = [
  {
    value: "operating_expense",
    label: "Operating Expense",
    description: "Normal day-to-day business costs",
  },
  {
    value: "inventory_expense",
    label: "Inventory Expense",
    description: "Costs directly related to inventory",
  },
  {
    value: "employee_advance",
    label: "Employee Advance",
    description: "Money advanced to an employee",
  },
  {
    value: "reimbursement",
    label: "Reimbursement",
    description: "Business expense reimbursed to an employee",
  },
  {
    value: "petty_cash",
    label: "Petty Cash",
    description: "Small cash business expenses",
  },
  {
    value: "other",
    label: "Other",
    description: "Any other money-out transaction",
  },
];

const PAYMENT_METHODS: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "company_card", label: "Company Card" },
  { value: "petty_cash", label: "Petty Cash" },
  { value: "other", label: "Other" },
];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(
  amount: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "AED"} ${amount.toFixed(2)}`;
  }
}

export default function NewExpensePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [company, setCompany] = useState<Company | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [expenseType, setExpenseType] =
    useState<ExpenseType>("operating_expense");

  const [expenseDate, setExpenseDate] =
    useState(todayString());

  const [categoryId, setCategoryId] = useState("");

  const [description, setDescription] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");

  const [reference, setReference] =
    useState("");

  const [vendorName, setVendorName] =
    useState("");

  const [employeeId, setEmployeeId] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [status, setStatus] =
    useState<ExpenseStatus>("pending");

  const [settlementStatus, setSettlementStatus] =
    useState<SettlementStatus>("not_applicable");

  const [receiptFile, setReceiptFile] =
    useState<File | null>(null);

  const [receiptPath, setReceiptPath] =
    useState<string | null>(null);

  const [receiptPreviewUrl, setReceiptPreviewUrl] =
    useState<string | null>(null);

  const isEmployeeExpense =
    expenseType === "employee_advance" ||
    expenseType === "reimbursement";

  const currency =
    company?.currency || "AED";

  const selectedType = EXPENSE_TYPES.find(
    (item) => item.value === expenseType
  );

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

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
          "No company membership was found for this account."
        );
      }

      const companyId = membership.company_id;

      const [
        companyResult,
        categoryResult,
        employeeResult,
      ] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, currency")
          .eq("id", companyId)
          .maybeSingle(),

        supabase
          .from("expense_categories")
          .select(
            "id, name, description, is_active"
          )
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("employees")
          .select(
            "id, first_name, last_name, full_name"
          )
          .eq("company_id", companyId)
          .order("first_name"),
      ]);

      if (companyResult.error) {
        throw companyResult.error;
      }

      if (categoryResult.error) {
        throw categoryResult.error;
      }

      setCompany(
        (companyResult.data as Company | null) || null
      );

      setCategories(
        (categoryResult.data || []) as Category[]
      );

      /*
       * Employees are intentionally future-compatible.
       *
       * The Expenses table already has employee_id.
       * If the Employees module/table is not ready yet,
       * this query can fail without breaking Expenses.
       */
      if (!employeeResult.error && employeeResult.data) {
        setEmployees(
          employeeResult.data.map((employee) => ({
            id: employee.id,
            name:
              employee.full_name ||
              [employee.first_name, employee.last_name]
                .filter(Boolean)
                .join(" ") ||
              "Unnamed Employee",
          }))
        );
      } else {
        setEmployees([]);
      }

      const companyCurrency =
        companyResult.data?.currency || "AED";

      if (!amount) {
        setAmount("");
      }

      if (!companyCurrency) {
        setCompany((current) =>
          current
            ? { ...current, currency: "AED" }
            : current
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the expense form."
      );
    } finally {
      setLoading(false);
    }
  }, [amount, router, supabase]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (expenseType === "employee_advance") {
      setSettlementStatus("outstanding");
      setStatus("paid");
    } else if (expenseType === "reimbursement") {
      setSettlementStatus("outstanding");
    } else {
      setSettlementStatus("not_applicable");
    }

    if (!isEmployeeExpense) {
      setEmployeeId("");
    }
  }, [expenseType, isEmployeeExpense]);

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) {
        URL.revokeObjectURL(receiptPreviewUrl);
      }
    };
  }, [receiptPreviewUrl]);

  const handleReceiptChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      return;
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      setErrorMessage(
        "Receipt file must be 10 MB or smaller."
      );
      event.target.value = "";
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage(
        "Receipt must be a JPG, PNG, WEBP, or PDF file."
      );
      event.target.value = "";
      return;
    }

    setErrorMessage("");
    setReceiptFile(file);

    if (receiptPreviewUrl) {
      URL.revokeObjectURL(receiptPreviewUrl);
    }

    if (file.type.startsWith("image/")) {
      setReceiptPreviewUrl(
        URL.createObjectURL(file)
      );
    } else {
      setReceiptPreviewUrl(null);
    }
  };

  const uploadReceipt = async (
    companyId: string,
    expenseId: string
  ) => {
    if (!receiptFile) {
      return null;
    }

    setUploadingReceipt(true);

    try {
      const extension =
        receiptFile.name.split(".").pop()?.toLowerCase() ||
        "bin";

      const safeExtension =
        extension.replace(/[^a-z0-9]/g, "") || "bin";

      const path =
        `${companyId}/${expenseId}/` +
        `${crypto.randomUUID()}.${safeExtension}`;

      const { error } = await supabase.storage
        .from("expense-receipts")
        .upload(path, receiptFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: receiptFile.type,
        });

      if (error) {
        throw error;
      }

      return path;
    } finally {
      setUploadingReceipt(false);
    }
  };

  const validateForm = () => {
    if (!expenseDate) {
      return "Please select the expense date.";
    }

    if (!categoryId) {
      return "Please select an expense category.";
    }

    if (!description.trim()) {
      return "Please enter a description.";
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return "Please enter a valid expense amount greater than zero.";
    }

    if (numericAmount > 999999999999) {
      return "Expense amount is too large.";
    }

    if (isEmployeeExpense && !employeeId) {
      if (employees.length > 0) {
        return "Please select the employee associated with this expense.";
      }
    }

    if (expenseType === "employee_advance") {
      if (
        settlementStatus !== "outstanding" &&
        settlementStatus !== "partially_settled" &&
        settlementStatus !== "settled"
      ) {
        return "Employee advances must have a settlement status.";
      }
    }

    return null;
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      setSaving(true);

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
          "No company membership was found for this account."
        );
      }

      const companyId = membership.company_id;

      const numericAmount = Number(amount);

      const { data: expense, error: insertError } =
        await supabase
          .from("expenses")
          .insert({
            company_id: companyId,
            expense_date: expenseDate,
            expense_type: expenseType,
            category_id: categoryId,
            description: description.trim(),
            vendor_name:
              vendorName.trim() || null,
            employee_id:
              employeeId || null,
            amount: numericAmount,
            currency,
            payment_method: paymentMethod,
            reference:
              reference.trim() || null,
            notes:
              notes.trim() || null,
            receipt_path: null,
            status,
            settlement_status: isEmployeeExpense
              ? settlementStatus
              : "not_applicable",
            created_by: user.id,
          })
          .select("id")
          .single();

      if (insertError) {
        throw insertError;
      }

      if (!expense?.id) {
        throw new Error(
          "Expense was created but no expense ID was returned."
        );
      }

      let uploadedReceiptPath: string | null = null;

      if (receiptFile) {
        try {
          uploadedReceiptPath =
            await uploadReceipt(
              companyId,
              expense.id
            );
        } catch (receiptError) {
          /*
           * The expense itself remains safely recorded.
           * If receipt upload fails, the user is taken to
           * the expense record with a clear warning.
           */
          setSuccessMessage(
            "Expense recorded, but the receipt could not be uploaded."
          );

          console.error(
            "Expense receipt upload failed:",
            receiptError
          );
        }
      }

      if (uploadedReceiptPath) {
        const { error: receiptUpdateError } =
          await supabase
            .from("expenses")
            .update({
              receipt_path: uploadedReceiptPath,
            })
            .eq("id", expense.id)
            .eq("company_id", companyId);

        if (receiptUpdateError) {
          console.error(
            "Expense receipt path update failed:",
            receiptUpdateError
          );
        }
      }

      /*
       * The database INSERT trigger automatically creates:
       * 1. expense activity record
       * 2. immediate notification job
       *
       * We do not create duplicate notification jobs here.
       */

      router.push(`/expenses/${expense.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the expense."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-4 w-96 animate-pulse rounded bg-slate-100" />
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <Link
                  href="/expenses"
                  className="transition hover:text-slate-900"
                >
                  Expenses
                </Link>
                <span>/</span>
                <span className="text-slate-700">
                  New Expense
                </span>
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                New Expense
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Record a company money-out transaction.
              </p>
            </div>

            <Link
              href="/expenses"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Back to Expenses
            </Link>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="font-semibold">
                Unable to save expense
              </div>
              <div className="mt-1">
                {errorMessage}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-6">
                {/* Expense Type */}
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h2 className="text-base font-semibold text-slate-900">
                      Expense Type
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Select what kind of money-out transaction this is.
                    </p>
                  </div>

                  <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-3">
                    {EXPENSE_TYPES.map((type) => {
                      const selected =
                        expenseType === type.value;

                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() =>
                            setExpenseType(type.value)
                          }
                          className={`rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">
                                {type.label}
                              </div>

                              <div
                                className={`mt-1 text-xs ${
                                  selected
                                    ? "text-slate-300"
                                    : "text-slate-500"
                                }`}
                              >
                                {type.description}
                              </div>
                            </div>

                            <div
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                selected
                                  ? "border-white bg-white"
                                  : "border-slate-300"
                              }`}
                            >
                              {selected && (
                                <div className="h-2.5 w-2.5 rounded-full bg-slate-900" />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Basic Information */}
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h2 className="text-base font-semibold text-slate-900">
                      Basic Information
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Core details used for the expense ledger and reporting.
                    </p>
                  </div>

                  <div className="grid gap-5 p-6 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="expense-date"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Expense Date
                      </label>

                      <input
                        id="expense-date"
                        type="date"
                        value={expenseDate}
                        onChange={(event) =>
                          setExpenseDate(event.target.value)
                        }
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="category"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Category
                      </label>

                      <select
                        id="category"
                        value={categoryId}
                        onChange={(event) =>
                          setCategoryId(event.target.value)
                        }
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                      >
                        <option value="">
                          Select category
                        </option>

                        {categories.map((category) => (
                          <option
                            key={category.id}
                            value={category.id}
                          >
                            {category.name}
                          </option>
                        ))}
                      </select>

                      {categories.length === 0 && (
                        <p className="mt-2 text-xs text-amber-600">
                          No active expense categories exist yet.
                          Create categories before recording expenses.
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor="description"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Description
                      </label>

                      <input
                        id="description"
                        type="text"
                        value={description}
                        onChange={(event) =>
                          setDescription(event.target.value)
                        }
                        placeholder="e.g. DHL shipping charges for customer orders"
                        maxLength={500}
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="amount"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Amount
                      </label>

                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-slate-200 px-3 text-xs font-semibold text-slate-500">
                          {currency}
                        </div>

                        <input
                          id="amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          inputMode="decimal"
                          value={amount}
                          onChange={(event) =>
                            setAmount(event.target.value)
                          }
                          placeholder="0.00"
                          className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-20 pr-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                        />
                      </div>

                      {Number(amount) > 0 && (
                        <p className="mt-2 text-xs text-slate-500">
                          {formatCurrency(
                            Number(amount),
                            currency
                          )}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="status"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Initial Status
                      </label>

                      <select
                        id="status"
                        value={status}
                        onChange={(event) =>
                          setStatus(
                            event.target.value as ExpenseStatus
                          )
                        }
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                      >
                        <option value="pending">
                          Pending Approval
                        </option>
                        <option value="approved">
                          Approved
                        </option>
                        <option value="paid">
                          Paid
                        </option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* Payment */}
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h2 className="text-base font-semibold text-slate-900">
                      Payment
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Record how the money was paid or will be paid.
                    </p>
                  </div>

                  <div className="grid gap-5 p-6 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="payment-method"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Payment Method
                      </label>

                      <select
                        id="payment-method"
                        value={paymentMethod}
                        onChange={(event) =>
                          setPaymentMethod(
                            event.target.value as PaymentMethod
                          )
                        }
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                      >
                        {PAYMENT_METHODS.map((method) => (
                          <option
                            key={method.value}
                            value={method.value}
                          >
                            {method.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="reference"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Payment / Transaction Reference
                      </label>

                      <input
                        id="reference"
                        type="text"
                        value={reference}
                        onChange={(event) =>
                          setReference(event.target.value)
                        }
                        placeholder="Receipt no., transaction ID, cheque no., etc."
                        maxLength={200}
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                      />
                    </div>
                  </div>
                </section>

                {/* People / Vendor */}
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h2 className="text-base font-semibold text-slate-900">
                      People / Vendor
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Connect the transaction to an employee or supplier/merchant.
                    </p>
                  </div>

                  <div className="grid gap-5 p-6 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="vendor"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Vendor / Merchant
                      </label>

                      <input
                        id="vendor"
                        type="text"
                        value={vendorName}
                        onChange={(event) =>
                          setVendorName(event.target.value)
                        }
                        placeholder="e.g. DHL, DEWA, Amazon, local supplier"
                        maxLength={200}
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="employee"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Employee
                        {isEmployeeExpense && (
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        )}
                      </label>

                      {employees.length > 0 ? (
                        <select
                          id="employee"
                          value={employeeId}
                          onChange={(event) =>
                            setEmployeeId(event.target.value)
                          }
                          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                        >
                          <option value="">
                            {isEmployeeExpense
                              ? "Select employee"
                              : "No employee"}
                          </option>

                          {employees.map((employee) => (
                            <option
                              key={employee.id}
                              value={employee.id}
                            >
                              {employee.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
                          <div className="text-sm font-medium text-slate-700">
                            Employees module not connected yet
                          </div>

                          <div className="mt-1 text-xs leading-5 text-slate-500">
                            The expense database already supports
                            employee_id. Once the Employees module is
                            available, employee selection will connect
                            automatically without changing existing expense
                            records.
                          </div>
                        </div>
                      )}

                      {isEmployeeExpense &&
                        employees.length === 0 && (
                          <p className="mt-2 text-xs text-amber-600">
                            This expense will be recorded now. Employee
                            linking can be completed once the Employees
                            module is connected.
                          </p>
                        )}
                    </div>
                  </div>
                </section>

                {/* Settlement */}
                {isEmployeeExpense && (
                  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-6 py-5">
                      <h2 className="text-base font-semibold text-slate-900">
                        Settlement Tracking
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Track money owed back to the company for advances,
                        or amounts owed to employees for reimbursements.
                      </p>
                    </div>

                    <div className="p-6">
                      <label
                        htmlFor="settlement-status"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Settlement Status
                      </label>

                      <select
                        id="settlement-status"
                        value={settlementStatus}
                        onChange={(event) =>
                          setSettlementStatus(
                            event.target
                              .value as SettlementStatus
                          )
                        }
                        className="h-11 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                      >
                        <option value="outstanding">
                          Outstanding
                        </option>
                        <option value="partially_settled">
                          Partially Settled
                        </option>
                        <option value="settled">
                          Settled
                        </option>
                      </select>

                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-800">
                          {expenseType ===
                          "employee_advance"
                            ? "Employee Advance"
                            : "Employee Reimbursement"}
                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {expenseType ===
                          "employee_advance"
                            ? "The payment is recorded as money advanced to the employee. The outstanding balance can be settled later from the expense record."
                            : "The transaction remains connected to the employee so the reimbursement can be tracked through its payment and settlement lifecycle."}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* Supporting Information */}
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h2 className="text-base font-semibold text-slate-900">
                      Supporting Information
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Keep receipts and additional notes attached to the permanent expense record.
                    </p>
                  </div>

                  <div className="space-y-5 p-6">
                    <div>
                      <label
                        htmlFor="receipt"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Receipt / Supporting Document
                      </label>

                      <input
                        id="receipt"
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleReceiptChange}
                        className="block w-full rounded-lg border border-slate-300 bg-white text-sm text-slate-700 file:mr-4 file:border-0 file:border-r file:border-slate-200 file:bg-slate-50 file:px-4 file:py-3 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-100"
                      />

                      <p className="mt-2 text-xs text-slate-500">
                        JPG, PNG, WEBP or PDF · Maximum 10 MB
                      </p>

                      {receiptFile && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center gap-3">
                            {receiptPreviewUrl ? (
                              <img
                                src={receiptPreviewUrl}
                                alt="Receipt preview"
                                className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-500">
                                PDF
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-800">
                                {receiptFile.name}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {(
                                  receiptFile.size /
                                  1024 /
                                  1024
                                ).toFixed(2)}{" "}
                                MB
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="notes"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Notes
                      </label>

                      <textarea
                        id="notes"
                        value={notes}
                        onChange={(event) =>
                          setNotes(event.target.value)
                        }
                        placeholder="Additional details, internal notes, reason for expense, etc."
                        rows={5}
                        maxLength={2000}
                        className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                      />

                      <div className="mt-1 text-right text-xs text-slate-400">
                        {notes.length}/2000
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Right Summary */}
              <aside className="lg:sticky lg:top-6 lg:self-start">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h2 className="text-base font-semibold text-slate-900">
                      Expense Summary
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Review before saving.
                    </p>
                  </div>

                  <div className="space-y-5 p-6">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Type
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedType?.label}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Category
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {categories.find(
                          (category) =>
                            category.id === categoryId
                        )?.name || "Not selected"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Payment
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {
                          PAYMENT_METHODS.find(
                            (method) =>
                              method.value === paymentMethod
                          )?.label
                        }
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-5">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Amount
                      </div>

                      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                        {formatCurrency(
                          Number(amount) || 0,
                          currency
                        )}
                      </div>
                    </div>

                    {isEmployeeExpense && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Settlement
                        </div>

                        <div className="mt-1 text-sm font-semibold text-slate-800">
                          {settlementStatus ===
                          "outstanding"
                            ? "Outstanding"
                            : settlementStatus ===
                              "partially_settled"
                            ? "Partially Settled"
                            : "Settled"}
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Automatic processing
                      </div>

                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        Saving this expense creates its permanent ledger
                        record and activity entry. The notification queue
                        will also be created automatically by the database.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={
                        saving ||
                        uploadingReceipt ||
                        categories.length === 0
                      }
                      className="flex h-11 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving
                        ? uploadingReceipt
                          ? "Uploading receipt..."
                          : "Saving expense..."
                        : "Save Expense"}
                    </button>

                    <Link
                      href="/expenses"
                      className="flex h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}