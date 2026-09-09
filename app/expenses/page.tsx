"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  payment_method:
    | "cash"
    | "bank_transfer"
    | "credit_card"
    | "debit_card"
    | "company_card"
    | "petty_cash"
    | "other";
  reference: string | null;
  notes: string | null;
  receipt_path: string | null;
  status: ExpenseStatus;
  settlement_status: SettlementStatus;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

type ExpenseCategory = {
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
}[] = [
  {
    value: "operating_expense",
    label: "Operating Expense",
  },
  {
    value: "inventory_expense",
    label: "Inventory Expense",
  },
  {
    value: "employee_advance",
    label: "Employee Advance",
  },
  {
    value: "reimbursement",
    label: "Reimbursement",
  },
  {
    value: "petty_cash",
    label: "Petty Cash",
  },
  {
    value: "other",
    label: "Other",
  },
];

const PAYMENT_METHODS = [
  {
    value: "cash",
    label: "Cash",
  },
  {
    value: "bank_transfer",
    label: "Bank Transfer",
  },
  {
    value: "credit_card",
    label: "Credit Card",
  },
  {
    value: "debit_card",
    label: "Debit Card",
  },
  {
    value: "company_card",
    label: "Company Card",
  },
  {
    value: "petty_cash",
    label: "Petty Cash",
  },
  {
    value: "other",
    label: "Other",
  },
];

const STATUS_OPTIONS: {
  value: ExpenseStatus;
  label: string;
}[] = [
  {
    value: "pending",
    label: "Pending",
  },
  {
    value: "approved",
    label: "Approved",
  },
  {
    value: "rejected",
    label: "Rejected",
  },
  {
    value: "paid",
    label: "Paid",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];

function money(
  value: number,
  currency = "AED"
) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `${currency} ${(value || 0).toFixed(2)}`;
  }
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getExpenseTypeLabel(
  type: ExpenseType
) {
  return (
    EXPENSE_TYPES.find(
      (item) => item.value === type
    )?.label || type
  );
}

function getPaymentMethodLabel(
  value: string
) {
  return (
    PAYMENT_METHODS.find(
      (item) => item.value === value
    )?.label || value
  );
}

function getStatusClass(
  status: ExpenseStatus
) {
  switch (status) {
    case "approved":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";

    case "paid":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";

    case "rejected":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";

    case "cancelled":
      return "bg-gray-100 text-gray-600 ring-1 ring-gray-200";

    default:
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }
}

function getSettlementClass(
  status: SettlementStatus
) {
  switch (status) {
    case "settled":
      return "text-emerald-700";

    case "partially_settled":
      return "text-amber-700";

    case "outstanding":
      return "text-red-600";

    default:
      return "text-gray-500";
  }
}

function getSettlementLabel(
  status: SettlementStatus
) {
  switch (status) {
    case "settled":
      return "Settled";

    case "partially_settled":
      return "Partially Settled";

    case "outstanding":
      return "Outstanding";

    default:
      return "—";
  }
}

export default function ExpensesPage() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const router = useRouter();

  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [categories, setCategories] =
    useState<ExpenseCategory[]>([]);

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [company, setCompany] =
    useState<Company | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [typeFilter, setTypeFilter] =
    useState("all");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [paymentFilter, setPaymentFilter] =
    useState("all");

  const [employeeFilter, setEmployeeFilter] =
    useState("all");

  const [dateFrom, setDateFrom] =
    useState("");

  const [dateTo, setDateTo] =
    useState("");

  const [showFilters, setShowFilters] =
    useState(false);

  const [selectedExpenseId, setSelectedExpenseId] =
    useState<string | null>(null);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          router.replace("/login");
          return;
        }

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
          throw membershipError;
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company membership found."
          );
        }

        const companyId =
          membership.company_id;

        const [
          companyResult,
          expensesResult,
          categoriesResult,
        ] = await Promise.all([
          supabase
            .from("companies")
            .select(
              "id, name, currency"
            )
            .eq("id", companyId)
            .single(),

          supabase
            .from("expenses")
            .select("*")
            .eq(
              "company_id",
              companyId
            )
            .order("expense_date", {
              ascending: false,
            })
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("expense_categories")
            .select(
              "id, name, description, is_active"
            )
            .eq(
              "company_id",
              companyId
            )
            .eq("is_active", true)
            .order("name", {
              ascending: true,
            }),
        ]);

        if (companyResult.error) {
          throw companyResult.error;
        }

        if (expensesResult.error) {
          throw expensesResult.error;
        }

        if (categoriesResult.error) {
          throw categoriesResult.error;
        }

        setCompany(
          companyResult.data
        );

        setExpenses(
          (expensesResult.data ||
            []) as Expense[]
        );

        setCategories(
          (categoriesResult.data ||
            []) as ExpenseCategory[]
        );

        /*
         * Employee records are intentionally loaded
         * separately because SBS may use different
         * employee schemas depending on the current
         * employee module implementation.
         *
         * If the employees table exists, load the
         * available names. Failure here should not
         * prevent the expense ledger itself from loading.
         */
        const {
          data: employeeData,
        } = await supabase
          .from("employees")
          .select(
            "id, first_name, last_name, full_name"
          )
          .eq(
            "company_id",
            companyId
          )
          .order("first_name", {
            ascending: true,
          });

        if (employeeData) {
          const normalizedEmployees =
            employeeData.map(
              (employee: any) => ({
                id: employee.id,
                name:
                  employee.full_name ||
                  [
                    employee.first_name,
                    employee.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ") ||
                  "Employee",
              })
            );

          setEmployees(
            normalizedEmployees
          );
        } else {
          setEmployees([]);
        }
      } catch (err: unknown) {
        console.error(
          "Expenses page load error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Could not load expenses."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const employeeMap = useMemo(() => {
    return new Map(
      employees.map((employee) => [
        employee.id,
        employee.name,
      ])
    );
  }, [employees]);

  const categoryMap = useMemo(() => {
    return new Map(
      categories.map((category) => [
        category.id,
        category.name,
      ])
    );
  }, [categories]);

  const filteredExpenses = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const categoryName =
        expense.category_id
          ? categoryMap.get(
              expense.category_id
            ) || ""
          : "";

      const employeeName =
        expense.employee_id
          ? employeeMap.get(
              expense.employee_id
            ) || ""
          : "";

      const searchableText = [
        expense.description,
        expense.vendor_name || "",
        expense.reference || "",
        expense.notes || "",
        expense.id,
        categoryName,
        employeeName,
        getExpenseTypeLabel(
          expense.expense_type
        ),
        getPaymentMethodLabel(
          expense.payment_method
        ),
        expense.status,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query ||
        searchableText.includes(query);

      const matchesType =
        typeFilter === "all" ||
        expense.expense_type ===
          typeFilter;

      const matchesCategory =
        categoryFilter === "all" ||
        expense.category_id ===
          categoryFilter;

      const matchesStatus =
        statusFilter === "all" ||
        expense.status ===
          statusFilter;

      const matchesPayment =
        paymentFilter === "all" ||
        expense.payment_method ===
          paymentFilter;

      const matchesEmployee =
        employeeFilter === "all" ||
        expense.employee_id ===
          employeeFilter;

      const matchesFrom =
        !dateFrom ||
        expense.expense_date >=
          dateFrom;

      const matchesTo =
        !dateTo ||
        expense.expense_date <=
          dateTo;

      return (
        matchesSearch &&
        matchesType &&
        matchesCategory &&
        matchesStatus &&
        matchesPayment &&
        matchesEmployee &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    expenses,
    search,
    typeFilter,
    categoryFilter,
    statusFilter,
    paymentFilter,
    employeeFilter,
    dateFrom,
    dateTo,
    categoryMap,
    employeeMap,
  ]);

  const stats = useMemo(() => {
    const now = new Date();

    const currentYear =
      now.getFullYear();

    const currentMonth =
      now.getMonth();

    const monthExpenses =
      expenses.filter((expense) => {
        const date = new Date(
          `${expense.expense_date}T00:00:00`
        );

        return (
          date.getFullYear() ===
            currentYear &&
          date.getMonth() ===
            currentMonth
        );
      });

    const totalExpenses =
      expenses.reduce(
        (sum, expense) =>
          sum + Number(expense.amount || 0),
        0
      );

    const thisMonth =
      monthExpenses.reduce(
        (sum, expense) =>
          sum + Number(expense.amount || 0),
        0
      );

    const pending =
      expenses.filter(
        (expense) =>
          expense.status === "pending"
      );

    const approved =
      expenses.filter(
        (expense) =>
          expense.status === "approved" ||
          expense.status === "paid"
      );

    const employeeAdvances =
      expenses.filter(
        (expense) =>
          expense.expense_type ===
          "employee_advance"
      );

    const outstanding =
      expenses.filter(
        (expense) =>
          expense.settlement_status ===
            "outstanding" ||
          expense.settlement_status ===
            "partially_settled"
      );

    return {
      totalExpenses,
      totalCount: expenses.length,

      thisMonth,
      thisMonthCount:
        monthExpenses.length,

      pendingAmount:
        pending.reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount || 0
            ),
          0
        ),
      pendingCount:
        pending.length,

      approvedAmount:
        approved.reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount || 0
            ),
          0
        ),
      approvedCount:
        approved.length,

      employeeAdvanceAmount:
        employeeAdvances.reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount || 0
            ),
          0
        ),
      employeeAdvanceCount:
        employeeAdvances.length,

      outstandingAmount:
        outstanding.reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount || 0
            ),
          0
        ),
      outstandingCount:
        outstanding.length,
    };
  }, [expenses]);

  const hasActiveFilters =
    Boolean(
      search ||
        typeFilter !== "all" ||
        categoryFilter !== "all" ||
        statusFilter !== "all" ||
        paymentFilter !== "all" ||
        employeeFilter !== "all" ||
        dateFrom ||
        dateTo
    );

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setPaymentFilter("all");
    setEmployeeFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  function exportCSV() {
    if (!filteredExpenses.length) {
      return;
    }

    const headers = [
      "Expense ID",
      "Date",
      "Type",
      "Category",
      "Description",
      "Vendor / Merchant",
      "Employee",
      "Amount",
      "Currency",
      "Payment Method",
      "Status",
      "Settlement Status",
      "Reference",
      "Notes",
      "Created At",
    ];

    const rows =
      filteredExpenses.map(
        (expense) => [
          expense.id,
          expense.expense_date,
          getExpenseTypeLabel(
            expense.expense_type
          ),
          expense.category_id
            ? categoryMap.get(
                expense.category_id
              ) || ""
            : "",
          expense.description,
          expense.vendor_name || "",
          expense.employee_id
            ? employeeMap.get(
                expense.employee_id
              ) || ""
            : "",
          Number(
            expense.amount || 0
          ).toFixed(2),
          expense.currency,
          getPaymentMethodLabel(
            expense.payment_method
          ),
          expense.status,
          getSettlementLabel(
            expense.settlement_status
          ),
          expense.reference || "",
          expense.notes || "",
          formatDateTime(
            expense.created_at
          ),
        ]
      );

    const escapeCSV = (
      value: unknown
    ) => {
      const stringValue =
        String(value ?? "");

      return `"${stringValue.replace(
        /"/g,
        '""'
      )}"`;
    };

    const csv = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) =>
        row.map(escapeCSV).join(",")
      ),
    ].join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    const date =
      new Date()
        .toISOString()
        .slice(0, 10);

    link.download = `sbs-expenses-${date}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function getCardCurrency() {
    return company?.currency || "AED";
  }

  return (
    <AppShell
      title="Expenses"
      description="Track every company expense, employee advance, reimbursement, and day-to-day money-out transaction."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/expenses/closings"
              )
            }
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <svg
              className="mr-2 h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect
                x="3"
                y="4"
                width="18"
                height="18"
                rx="2"
              />
              <line
                x1="16"
                y1="2"
                x2="16"
                y2="6"
              />
              <line
                x1="8"
                y1="2"
                x2="8"
                y2="6"
              />
              <line
                x1="3"
                y1="10"
                x2="21"
                y2="10"
              />
            </svg>
            Closings
          </button>

          <button
            type="button"
            onClick={exportCSV}
            disabled={
              filteredExpenses.length === 0
            }
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className="mr-2 h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Export CSV
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/expenses/new"
              )
            }
            className="inline-flex h-10 items-center justify-center rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
          >
            <svg
              className="mr-2 h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line
                x1="12"
                y1="5"
                x2="12"
                y2="19"
              />
              <line
                x1="5"
                y1="12"
                x2="19"
                y2="12"
              />
            </svg>
            New Expense
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">
                  Could not load expenses
                </p>
                <p className="mt-1">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadData(true)
                }
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Total Expenses
                </p>

                <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                  {loading
                    ? "—"
                    : money(
                        stats.totalExpenses,
                        getCardCurrency()
                      )}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {stats.totalCount}{" "}
                  transaction
                  {stats.totalCount === 1
                    ? ""
                    : "s"}
                </p>
              </div>

              <div className="rounded-lg bg-gray-100 p-2 text-gray-700">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="2"
                  />
                  <path d="M7 9h10" />
                  <path d="M7 13h6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  This Month
                </p>

                <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                  {loading
                    ? "—"
                    : money(
                        stats.thisMonth,
                        getCardCurrency()
                      )}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {stats.thisMonthCount}{" "}
                  transaction
                  {stats.thisMonthCount ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>

              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="18"
                    rx="2"
                  />
                  <line
                    x1="16"
                    y1="2"
                    x2="16"
                    y2="6"
                  />
                  <line
                    x1="8"
                    y1="2"
                    x2="8"
                    y2="6"
                  />
                  <line
                    x1="3"
                    y1="10"
                    x2="21"
                    y2="10"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Pending Approval
                </p>

                <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                  {loading
                    ? "—"
                    : money(
                        stats.pendingAmount,
                        getCardCurrency()
                      )}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {stats.pendingCount}{" "}
                  awaiting review
                </p>
              </div>

              <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                  />
                  <path d="M12 7v5l3 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Approved
                </p>

                <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                  {loading
                    ? "—"
                    : money(
                        stats.approvedAmount,
                        getCardCurrency()
                      )}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {stats.approvedCount}{" "}
                  approved / paid
                </p>
              </div>

              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                  />
                  <path d="m8 12 2.5 2.5L16 9" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Employee Advances
                </p>

                <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                  {loading
                    ? "—"
                    : money(
                        stats.employeeAdvanceAmount,
                        getCardCurrency()
                      )}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {stats.employeeAdvanceCount}{" "}
                  advance
                  {stats.employeeAdvanceCount ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>

              <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle
                    cx="12"
                    cy="8"
                    r="3"
                  />
                  <path d="M5 21c0-4 3-7 7-7s7 3 7 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Outstanding
                </p>

                <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                  {loading
                    ? "—"
                    : money(
                        stats.outstandingAmount,
                        getCardCurrency()
                      )}
                </p>

                <p className="mt-1 text-xs text-red-600">
                  {stats.outstandingCount}{" "}
                  unsettled
                </p>
              </div>

              <div className="rounded-lg bg-red-50 p-2 text-red-600">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 3 2.5 20h19L12 3Z" />
                  <path d="M12 9v5" />
                  <circle
                    cx="12"
                    cy="17"
                    r=".75"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                />
                <path d="m20 20-4-4" />
              </svg>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search expenses, vendors, employees, references..."
                className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            >
              <option value="all">
                All Statuses
              </option>

              {STATUS_OPTIONS.map(
                (status) => (
                  <option
                    key={status.value}
                    value={status.value}
                  >
                    {status.label}
                  </option>
                )
              )}
            </select>

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value
                )
              }
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            >
              <option value="all">
                All Types
              </option>

              {EXPENSE_TYPES.map(
                (type) => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </option>
                )
              )}
            </select>

            <button
              type="button"
              onClick={() =>
                setShowFilters(
                  (current) =>
                    !current
                )
              }
              className={`inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition ${
                showFilters ||
                hasActiveFilters
                  ? "border-gray-300 bg-gray-100 text-gray-900"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 6h16" />
                <path d="M7 12h10" />
                <path d="M10 18h4" />
              </svg>
              Filters
              {hasActiveFilters && (
                <span className="ml-2 rounded-full bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  •
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                void loadData(true)
              }
              disabled={refreshing}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <svg
                className={`mr-2 h-4 w-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 11a8 8 0 0 0-14.9-3" />
                <path d="M4 5v4h4" />
                <path d="M4 13a8 8 0 0 0 14.9 3" />
                <path d="M20 19v-4h-4" />
              </svg>
              Refresh
            </button>
          </div>

          {showFilters && (
            <div className="border-t border-gray-100 bg-gray-50/60 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Category
                  </label>

                  <select
                    value={
                      categoryFilter
                    }
                    onChange={(event) =>
                      setCategoryFilter(
                        event.target.value
                      )
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  >
                    <option value="all">
                      All Categories
                    </option>

                    {categories.map(
                      (category) => (
                        <option
                          key={
                            category.id
                          }
                          value={
                            category.id
                          }
                        >
                          {category.name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Payment Method
                  </label>

                  <select
                    value={
                      paymentFilter
                    }
                    onChange={(event) =>
                      setPaymentFilter(
                        event.target.value
                      )
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  >
                    <option value="all">
                      All Payment Methods
                    </option>

                    {PAYMENT_METHODS.map(
                      (method) => (
                        <option
                          key={
                            method.value
                          }
                          value={
                            method.value
                          }
                        >
                          {method.label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Employee
                  </label>

                  <select
                    value={
                      employeeFilter
                    }
                    onChange={(event) =>
                      setEmployeeFilter(
                        event.target.value
                      )
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  >
                    <option value="all">
                      All Employees
                    </option>

                    {employees.map(
                      (employee) => (
                        <option
                          key={employee.id}
                          value={
                            employee.id
                          }
                        >
                          {employee.name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    From Date
                  </label>

                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) =>
                      setDateFrom(
                        event.target.value
                      )
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    To Date
                  </label>

                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) =>
                      setDateTo(
                        event.target.value
                      )
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Filters are active.
                  </p>

                  <button
                    type="button"
                    onClick={
                      clearFilters
                    }
                    className="text-xs font-semibold text-gray-700 hover:text-gray-900"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expense Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Expense Ledger
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                {loading
                  ? "Loading expenses..."
                  : `${filteredExpenses.length} of ${expenses.length} expenses`}
              </p>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="self-start text-xs font-semibold text-gray-600 hover:text-gray-900 sm:self-auto"
              >
                Clear filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-10 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-800" />

              <p className="mt-3 text-sm text-gray-500">
                Loading expenses...
              </p>
            </div>
          ) : filteredExpenses.length ===
            0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="2"
                  />
                  <path d="M7 9h10" />
                  <path d="M7 13h6" />
                </svg>
              </div>

              <h3 className="mt-4 text-sm font-semibold text-gray-900">
                {expenses.length ===
                0
                  ? "No expenses recorded yet"
                  : "No expenses match your filters"}
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                {expenses.length ===
                0
                  ? "Start recording company expenses such as inventory costs, tea and coffee, employee advances, fuel, transport, and other day-to-day spending."
                  : "Try changing your search or filters to find the expense you're looking for."}
              </p>

              {expenses.length ===
                0 && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/expenses/new"
                    )
                  }
                  className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white transition hover:bg-gray-800"
                >
                  <svg
                    className="mr-2 h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line
                      x1="12"
                      y1="5"
                      x2="12"
                      y2="19"
                    />
                    <line
                      x1="5"
                      y1="12"
                      x2="19"
                      y2="12"
                    />
                  </svg>
                  Add First Expense
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/70">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Expense
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Date
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Category / Type
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Employee / Vendor
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Payment
                      </th>

                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Amount
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Status
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Settlement
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {filteredExpenses.map(
                      (expense) => {
                        const categoryName =
                          expense.category_id
                            ? categoryMap.get(
                                expense.category_id
                              ) ||
                              "Uncategorized"
                            : "Uncategorized";

                        const employeeName =
                          expense.employee_id
                            ? employeeMap.get(
                                expense.employee_id
                              ) || "Employee"
                            : null;

                        return (
                          <tr
                            key={
                              expense.id
                            }
                            className="group transition hover:bg-gray-50/70"
                          >
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/expenses/${expense.id}`
                                  )
                                }
                                className="text-left"
                              >
                                <p className="max-w-[270px] truncate text-sm font-semibold text-gray-900 group-hover:text-gray-700">
                                  {
                                    expense.description
                                  }
                                </p>

                                <div className="mt-1 flex items-center gap-2">
                                  <span className="font-mono text-[11px] text-gray-400">
                                    {expense.id.slice(
                                      0,
                                      8
                                    )}
                                  </span>

                                  {expense.reference && (
                                    <>
                                      <span className="text-gray-300">
                                        •
                                      </span>

                                      <span className="max-w-[120px] truncate text-xs text-gray-500">
                                        {
                                          expense.reference
                                        }
                                      </span>
                                    </>
                                  )}

                                  {expense.receipt_path && (
                                    <>
                                      <span className="text-gray-300">
                                        •
                                      </span>

                                      <span className="text-xs font-medium text-blue-600">
                                        Receipt
                                      </span>
                                    </>
                                  )}
                                </div>
                              </button>
                            </td>

                            <td className="whitespace-nowrap px-4 py-4">
                              <p className="text-sm font-medium text-gray-700">
                                {formatDate(
                                  expense.expense_date
                                )}
                              </p>

                              <p className="mt-0.5 text-xs text-gray-400">
                                Added{" "}
                                {formatDateTime(
                                  expense.created_at
                                )}
                              </p>
                            </td>

                            <td className="px-4 py-4">
                              <p className="text-sm font-medium text-gray-800">
                                {
                                  categoryName
                                }
                              </p>

                              <p className="mt-1 text-xs text-gray-500">
                                {getExpenseTypeLabel(
                                  expense.expense_type
                                )}
                              </p>
                            </td>

                            <td className="px-4 py-4">
                              {employeeName ? (
                                <>
                                  <p className="text-sm font-medium text-gray-800">
                                    {
                                      employeeName
                                    }
                                  </p>

                                  <p className="mt-1 text-xs text-gray-500">
                                    Employee
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="max-w-[170px] truncate text-sm font-medium text-gray-800">
                                    {expense.vendor_name ||
                                      "—"}
                                  </p>

                                  <p className="mt-1 text-xs text-gray-500">
                                    {expense.vendor_name
                                      ? "Vendor / Merchant"
                                      : "No vendor"}
                                  </p>
                                </>
                              )}
                            </td>

                            <td className="px-4 py-4">
                              <p className="text-sm text-gray-700">
                                {getPaymentMethodLabel(
                                  expense.payment_method
                                )}
                              </p>
                            </td>

                            <td className="whitespace-nowrap px-4 py-4 text-right">
                              <p className="text-sm font-bold text-gray-900">
                                {money(
                                  Number(
                                    expense.amount ||
                                      0
                                  ),
                                  expense.currency ||
                                    getCardCurrency()
                                )}
                              </p>
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClass(
                                  expense.status
                                )}`}
                              >
                                {
                                  expense.status
                                }
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`text-xs font-semibold ${getSettlementClass(
                                  expense.settlement_status
                                )}`}
                              >
                                {getSettlementLabel(
                                  expense.settlement_status
                                )}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedExpenseId(
                                    expense.id
                                  )
                                }
                                className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-3">
                <div className="flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Showing{" "}
                    <span className="font-semibold text-gray-700">
                      {
                        filteredExpenses.length
                      }
                    </span>{" "}
                    expense
                    {filteredExpenses.length ===
                    1
                      ? ""
                      : "s"}
                  </span>

                  <span>
                    Filtered total:{" "}
                    <span className="font-semibold text-gray-800">
                      {money(
                        filteredExpenses.reduce(
                          (
                            sum,
                            expense
                          ) =>
                            sum +
                            Number(
                              expense.amount ||
                                0
                            ),
                          0
                        ),
                        getCardCurrency()
                      )}
                    </span>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick View Modal */}
      {selectedExpenseId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedExpenseId(null);
            }
          }}
        >
          {(() => {
            const expense =
              expenses.find(
                (item) =>
                  item.id ===
                  selectedExpenseId
              );

            if (!expense) {
              return null;
            }

            const categoryName =
              expense.category_id
                ? categoryMap.get(
                    expense.category_id
                  ) ||
                  "Uncategorized"
                : "Uncategorized";

            const employeeName =
              expense.employee_id
                ? employeeMap.get(
                    expense.employee_id
                  ) || "Employee"
                : null;

            return (
              <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
                  <div>
                    <p className="font-mono text-xs text-gray-400">
                      EXPENSE{" "}
                      {expense.id.slice(
                        0,
                        8
                      )}
                    </p>

                    <h3 className="mt-1 text-lg font-bold text-gray-900">
                      {
                        expense.description
                      }
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedExpenseId(
                        null
                      )
                    }
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line
                        x1="6"
                        y1="6"
                        x2="18"
                        y2="18"
                      />
                      <line
                        x1="18"
                        y1="6"
                        x2="6"
                        y2="18"
                      />
                    </svg>
                  </button>
                </div>

                <div className="space-y-5 px-6 py-6">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        Amount
                      </span>

                      <span className="text-xl font-bold text-gray-900">
                        {money(
                          Number(
                            expense.amount ||
                              0
                          ),
                          expense.currency ||
                            getCardCurrency()
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Date
                      </p>

                      <p className="mt-1 text-sm font-medium text-gray-800">
                        {formatDate(
                          expense.expense_date
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Type
                      </p>

                      <p className="mt-1 text-sm font-medium text-gray-800">
                        {getExpenseTypeLabel(
                          expense.expense_type
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Category
                      </p>

                      <p className="mt-1 text-sm font-medium text-gray-800">
                        {categoryName}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Payment Method
                      </p>

                      <p className="mt-1 text-sm font-medium text-gray-800">
                        {getPaymentMethodLabel(
                          expense.payment_method
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Employee
                      </p>

                      <p className="mt-1 text-sm font-medium text-gray-800">
                        {employeeName ||
                          "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Vendor / Merchant
                      </p>

                      <p className="mt-1 text-sm font-medium text-gray-800">
                        {expense.vendor_name ||
                          "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Status
                      </p>

                      <span
                        className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClass(
                          expense.status
                        )}`}
                      >
                        {
                          expense.status
                        }
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Settlement
                      </p>

                      <p
                        className={`mt-1 text-sm font-semibold ${getSettlementClass(
                          expense.settlement_status
                        )}`}
                      >
                        {getSettlementLabel(
                          expense.settlement_status
                        )}
                      </p>
                    </div>
                  </div>

                  {expense.reference && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Reference
                      </p>

                      <p className="mt-1 text-sm text-gray-800">
                        {
                          expense.reference
                        }
                      </p>
                    </div>
                  )}

                  {expense.notes && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Notes
                      </p>

                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                        {expense.notes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedExpenseId(
                        null
                      )
                    }
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExpenseId(
                          null
                        );

                        router.push(
                          `/expenses/${expense.id}/edit`
                        );
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Edit Expense
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExpenseId(
                          null
                        );

                        router.push(
                          `/expenses/${expense.id}`
                        );
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-800"
                    >
                      Open Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </AppShell>
  );
}