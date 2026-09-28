"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { useRegionalSettings } from "@/app/components/regional-settings-provider";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { formatMoney } from "@/lib/regional-settings";

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

type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "credit_card"
  | "debit_card"
  | "company_card"
  | "petty_cash"
  | "other";

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
  user_id: string | null;
  name: string;
};

type Person = {
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

const PAYMENT_METHODS: {
  value: PaymentMethod;
  label: string;
}[] = [
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

function formatDateTime(value: string | null) {
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

function getExpenseTypeLabel(type: ExpenseType) {
  return (
    EXPENSE_TYPES.find(
      (item) => item.value === type
    )?.label || type
  );
}

function getPaymentMethodLabel(
  value: PaymentMethod
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
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";

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

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name:
    | "wallet"
    | "calendar"
    | "clock"
    | "check"
    | "user"
    | "alert"
    | "search"
    | "filter"
    | "refresh"
    | "download"
    | "plus"
    | "close"
    | "arrow";
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
  };

  switch (name) {
    case "calendar":
      return (
        <svg {...common}>
          <rect
            x="3"
            y="4"
            width="18"
            height="17"
            rx="2"
          />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );

    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 21c0-4 3-7 7-7s7 3 7 7" />
        </svg>
      );

    case "alert":
      return (
        <svg {...common}>
          <path d="M12 3 2.5 20h19L12 3Z" />
          <path d="M12 9v5" />
          <circle
            cx="12"
            cy="17"
            r=".7"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );

    case "filter":
      return (
        <svg {...common}>
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.9-3" />
          <path d="M4 5v4h4" />
          <path d="M4 13a8 8 0 0 0 14.9 3" />
          <path d="M20 19v-4h-4" />
        </svg>
      );

    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );

    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="2"
          />
          <path d="M7 9h10M7 13h6" />
        </svg>
      );
  }
}

export default function ExpensesPage() {
  const { settings } = useRegionalSettings();

  const money = (value: number, _currency?: string) =>
    formatMoney(value, settings);

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const router = useRouter();

  const {
    hasPermission,
    loading: permissionsLoading,
  } = usePermissions();

  const canView = hasPermission(
    "expenses",
    "view"
  );

  const canCreate = hasPermission(
    "expenses",
    "create"
  );

  const canEdit = hasPermission(
    "expenses",
    "edit"
  );

  const canApprove = hasPermission(
    "expenses",
    "approve"
  );

  const canPay = hasPermission(
    "expenses",
    "pay"
  );

  const canClose = hasPermission(
    "expenses",
    "close"
  );

  /*
   * Employee role has view/create only.
   *
   * This is deliberately based on permissions rather than
   * checking the role name so custom roles continue to work.
   */
  const restrictedEmployee =
    canView &&
    !canEdit &&
    !canApprove &&
    !canPay &&
    !canClose;

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [categories, setCategories] =
    useState<ExpenseCategory[]>([]);

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [people, setPeople] =
    useState<Person[]>([]);

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

        setCurrentUserId(user.id);

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

        /*
         * IMPORTANT:
         * Employee users are restricted at query level.
         * We do NOT load the whole company ledger and then
         * hide records in the browser.
         */
        let expensesQuery = supabase
          .from("expenses")
          .select("*")
          .eq("company_id", companyId)
          .order("expense_date", {
            ascending: false,
          })
          .order("created_at", {
            ascending: false,
          });

        if (restrictedEmployee) {
          expensesQuery =
            expensesQuery.eq(
              "created_by",
              user.id
            );
        }

        const [
  companyResult,
  expensesResult,
  categoriesResult,
  employeesResult,
  membersResult,
] = await Promise.all([
          supabase
            .from("companies")
            .select(
              "id, name, currency"
            )
            .eq("id", companyId)
            .single(),

          expensesQuery,

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
            .order("name"),

          supabase
            .from("employees")
            .select(
              "id, user_id, first_name, last_name, display_name"
            )
            .eq(
              "company_id",
              companyId
            )
            .order("first_name"),

          supabase
  .from("company_members")
  .select("user_id")
  .eq("company_id", companyId),
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

        if (employeesResult.error) {
          console.warn(
            "Could not load employees:",
            employeesResult.error
          );
        }
    if (membersResult.error) {
  console.warn(
    "Could not load company members:",
    membersResult.error
  );
}

const memberUserIds =
  (membersResult.data || [])
    .map((member) => member.user_id)
    .filter(Boolean);

let profilesData: Array<{
  id: string;
  full_name: string | null;
}> = [];

if (memberUserIds.length > 0) {
  const {
    data,
    error,
  } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", memberUserIds);

  if (error) {
    console.warn(
      "Could not load member profiles:",
      error
    );
  } else {
    profilesData = data || [];
  }
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

        const normalizedEmployees: Employee[] =
          (employeesResult.data || []).map(
            (employee: any) => ({
              id: employee.id,
              user_id:
                employee.user_id || null,
              name:
  employee.display_name ||
  [employee.first_name, employee.last_name]
    .filter(Boolean)
    .join(" ") ||
  "Employee",
            })
          );

        setEmployees(
          normalizedEmployees
        );

        const normalizedPeople: Person[] = [];

profilesData.forEach(          (profile: any) => {
            const name =
              profile.full_name?.trim() ||
              "User";

            if (!profile.id) return;

            normalizedPeople.push({
              id: profile.id,
              name,
            });
          }
        );

        /*
         * Add employee identities as fallback.
         * This is useful if a profile does not have a
         * display name yet.
         */
        const peopleMap = new Map<
          string,
          Person
        >();

        normalizedPeople.forEach((person) => {
          peopleMap.set(
            person.id,
            person
          );
        });

        normalizedEmployees.forEach(
          (employee) => {
            if (
              employee.user_id &&
              !peopleMap.has(
                employee.user_id
              )
            ) {
              peopleMap.set(
                employee.user_id,
                {
                  id: employee.user_id,
                  name: employee.name,
                }
              );
            }
          }
        );

        setPeople(
          Array.from(
            peopleMap.values()
          )
        );
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
    [
      router,
      supabase,
      restrictedEmployee,
    ]
  );

  useEffect(() => {
    if (!permissionsLoading) {
      void loadData();
    }
  }, [
    permissionsLoading,
    loadData,
  ]);

  const employeeMap = useMemo(() => {
    return new Map(
      employees.map((employee) => [
        employee.id,
        employee.name,
      ])
    );
  }, [employees]);

  const personMap = useMemo(() => {
    return new Map(
      people.map((person) => [
        person.id,
        person.name,
      ])
    );
  }, [people]);

  const categoryMap = useMemo(() => {
    return new Map(
      categories.map((category) => [
        category.id,
        category.name,
      ])
    );
  }, [categories]);

  function getCreatedByName(expense: Expense) {
    if (!expense.created_by) {
      return "Unknown";
    }

    const name = personMap.get(
      expense.created_by
    );

    if (name) {
      return name;
    }

    if (expense.created_by === currentUserId) {
      return "You";
    }

    const employee = employees.find(
      (item) =>
        item.id === expense.created_by ||
        item.user_id === expense.created_by
    );

    if (employee) {
      return employee.name;
    }

    return "Unknown";
  }

  function getApprovedByName(expense: Expense) {
    if (!expense.approved_by) {
      return null;
    }

    const name = personMap.get(
      expense.approved_by
    );

    if (name) {
      return name;
    }

    const employee = employees.find(
      (item) =>
        item.id === expense.approved_by ||
        item.user_id === expense.approved_by
    );

    if (employee) {
      return employee.name;
    }

    return "Unknown";
  }

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

      const createdByName =
        getCreatedByName(expense);

      const approvedByName =
        getApprovedByName(expense) ||
        "";

      const searchableText = [
        expense.description,
        expense.vendor_name || "",
        expense.reference || "",
        expense.notes || "",
        expense.id,
        categoryName,
        employeeName,
        createdByName,
        approvedByName,
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
        restrictedEmployee ||
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
    personMap,
    currentUserId,
    restrictedEmployee,
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
          sum +
          Number(
            expense.amount || 0
          ),
        0
      );

    const thisMonth =
      monthExpenses.reduce(
        (sum, expense) =>
          sum +
          Number(
            expense.amount || 0
          ),
        0
      );

    const pending =
      expenses.filter(
        (expense) =>
          expense.status ===
          "pending"
      );

    const approved =
      expenses.filter(
        (expense) =>
          expense.status ===
            "approved" ||
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
        (!restrictedEmployee &&
          employeeFilter !== "all") ||
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
    if (
      restrictedEmployee ||
      !filteredExpenses.length
    ) {
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
      "Created By",
      "Approved By",
      "Approved At",
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
          getCreatedByName(expense),
          getApprovedByName(
            expense
          ) || "",
          formatDateTime(
            expense.approved_at
          ),
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
    ) =>
      `"${String(
        value ?? ""
      ).replace(/"/g, '""')}"`;

    const csv = [
      headers
        .map(escapeCSV)
        .join(","),
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

    link.download = `sbs-expenses-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function getCardCurrency() {
    return company?.currency || "AED";
  }

  if (
    !permissionsLoading &&
    !canView
  ) {
    return (
      <AppShell
        title="Expenses"
        description="Manage company expenses and employee submissions."
      >
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Icon name="alert" />
          </div>

          <h2 className="mt-4 text-base font-semibold text-gray-900">
            Access restricted
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            You do not have permission to view expenses.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Expenses"
      description={
        restrictedEmployee
          ? "View and track your submitted expenses, approval status, and settlement."
          : "Track every company expense, employee advance, reimbursement, and day-to-day money-out transaction."
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {canClose && (
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/expenses/closings"
                )
              }
              className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Icon
                name="calendar"
                className="mr-2 h-4 w-4"
              />
              Closings
            </button>
          )}

          {!restrictedEmployee && (
            <button
              type="button"
              onClick={exportCSV}
              disabled={
                filteredExpenses.length ===
                0
              }
              className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon
                name="download"
                className="mr-2 h-4 w-4"
              />
              Export CSV
            </button>
          )}

          {canCreate && (
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/expenses/new"
                )
              }
              className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Icon
                name="plus"
                className="mr-2 h-4 w-4"
              />
              New Expense
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {restrictedEmployee && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <Icon name="user" />
              </div>

              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  My Expenses
                </p>

                <p className="mt-1 text-sm text-emerald-700">
                  You are viewing expenses submitted by your account. Company-wide expense records are restricted to authorized finance and management users.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-red-800">
                  Could not load expenses
                </p>

                <p className="mt-1 text-sm text-red-700">
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

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {[
            {
              title: "Total Expenses",
              amount: stats.totalExpenses,
              count: stats.totalCount,
              suffix: "transactions",
              icon: "wallet" as const,
              iconClass:
                "bg-emerald-50 text-emerald-600",
            },
            {
              title: "This Month",
              amount: stats.thisMonth,
              count: stats.thisMonthCount,
              suffix: "transactions",
              icon: "calendar" as const,
              iconClass:
                "bg-emerald-50 text-emerald-600",
            },
            {
              title: "Pending Approval",
              amount: stats.pendingAmount,
              count: stats.pendingCount,
              suffix: "awaiting review",
              icon: "clock" as const,
              iconClass:
                "bg-amber-50 text-amber-600",
            },
            {
              title: "Approved",
              amount: stats.approvedAmount,
              count: stats.approvedCount,
              suffix: "approved / paid",
              icon: "check" as const,
              iconClass:
                "bg-emerald-50 text-emerald-600",
            },
            {
              title: "Employee Advances",
              amount:
                stats.employeeAdvanceAmount,
              count:
                stats.employeeAdvanceCount,
              suffix: "advances",
              icon: "user" as const,
              iconClass:
                "bg-violet-50 text-violet-600",
            },
            {
              title: "Outstanding",
              amount:
                stats.outstandingAmount,
              count:
                stats.outstandingCount,
              suffix: "unsettled",
              icon: "alert" as const,
              iconClass:
                "bg-red-50 text-red-600",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {card.title}
                  </p>

                  <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                    {loading
                      ? "—"
                      : money(
                          card.amount,
                          getCardCurrency()
                        )}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {card.count}{" "}
                    {card.suffix}
                  </p>
                </div>

                <div
                  className={`rounded-xl p-2.5 ${card.iconClass}`}
                >
                  <Icon name={card.icon} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FILTER BAR */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder={
                  restrictedEmployee
                    ? "Search your expenses..."
                    : "Search expenses, vendors, employees, references..."
                }
                className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
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
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
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
                  (value) => !value
                )
              }
              className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition ${
                showFilters ||
                hasActiveFilters
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon
                name="filter"
                className="mr-2 h-4 w-4"
              />
              Filters

              {hasActiveFilters && (
                <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">
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
              className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <Icon
                name="refresh"
                className={`mr-2 h-4 w-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />
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
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="all">
                      All Categories
                    </option>

                    {categories.map(
                      (category) => (
                        <option
                          key={category.id}
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
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="all">
                      All Payment Methods
                    </option>

                    {PAYMENT_METHODS.map(
                      (method) => (
                        <option
                          key={method.value}
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

                {!restrictedEmployee && (
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
                      className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="all">
                        All Employees
                      </option>

                      {employees.map(
                        (employee) => (
                          <option
                            key={
                              employee.id
                            }
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
                )}

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
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
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
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
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
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* LEDGER */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {restrictedEmployee
                  ? "My Expense Ledger"
                  : "Expense Ledger"}
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
                onClick={
                  clearFilters
                }
                className="self-start text-xs font-semibold text-emerald-700 hover:text-emerald-800 sm:self-auto"
              >
                Clear filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-600" />

              <p className="mt-3 text-sm text-gray-500">
                Loading expenses...
              </p>
            </div>
          ) : filteredExpenses.length ===
            0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Icon name="wallet" />
              </div>

              <h3 className="mt-4 text-sm font-semibold text-gray-900">
                {expenses.length ===
                0
                  ? restrictedEmployee
                    ? "You have no expenses yet"
                    : "No expenses recorded yet"
                  : "No expenses match your filters"}
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                {expenses.length ===
                0
                  ? "Record an expense to start tracking company spending and approval activity."
                  : "Try changing your search or filters."}
              </p>

              {expenses.length ===
                0 &&
                canCreate && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        "/expenses/new"
                      )
                    }
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <Icon
                      name="plus"
                      className="mr-2 h-4 w-4"
                    />
                    Add First Expense
                  </button>
                )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[1500px] w-full">
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
                        Created By
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Approved By
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
                              ) ||
                              "Employee"
                            : null;

                        const createdBy =
                          getCreatedByName(
                            expense
                          );

                        const approvedBy =
                          getApprovedByName(
                            expense
                          );

                        return (
                          <tr
                            key={
                              expense.id
                            }
                            className="group transition hover:bg-emerald-50/30"
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
                                <p className="max-w-[240px] truncate text-sm font-semibold text-gray-900 group-hover:text-emerald-700">
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

                                      <span className="max-w-[100px] truncate text-xs text-gray-500">
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

                                      <span className="text-xs font-medium text-emerald-600">
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
                                  <p className="max-w-[150px] truncate text-sm font-medium text-gray-800">
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

                            {/* CREATED BY */}
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                                  <Icon
                                    name="user"
                                    className="h-4 w-4"
                                  />
                                </div>

                                <div>
                                  <p className="max-w-[140px] truncate text-sm font-semibold text-gray-800">
                                    {
                                      createdBy
                                    }
                                  </p>

                                  <p className="mt-0.5 text-xs text-gray-400">
                                    Submitted
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* APPROVED BY */}
                            <td className="px-4 py-4">
                              {approvedBy ? (
                                <div>
                                  <p className="max-w-[140px] truncate text-sm font-semibold text-emerald-700">
                                    {
                                      approvedBy
                                    }
                                  </p>

                                  <p className="mt-0.5 text-xs text-gray-400">
                                    {formatDateTime(
                                      expense.approved_at
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-sm font-medium text-gray-400">
                                    —
                                  </p>

                                  <p className="mt-0.5 text-xs text-gray-400">
                                    {expense.status ===
                                    "pending"
                                      ? "Awaiting approval"
                                      : "Not approved"}
                                  </p>
                                </div>
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
                                className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
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

      {/* QUICK VIEW */}
      {selectedExpenseId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedExpenseId(
                null
              );
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

            const createdBy =
              getCreatedByName(
                expense
              );

            const approvedBy =
              getApprovedByName(
                expense
              );

            return (
              <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
                  <div>
                    <p className="font-mono text-xs text-emerald-600">
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
                    <Icon
                      name="close"
                    />
                  </button>
                </div>

                <div className="space-y-6 px-6 py-6">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Expense Amount
                        </p>

                        <p className="mt-1 text-2xl font-bold text-gray-900">
                          {money(
                            Number(
                              expense.amount ||
                                0
                            ),
                            expense.currency ||
                              getCardCurrency()
                          )}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${getStatusClass(
                          expense.status
                        )}`}
                      >
                        {
                          expense.status
                        }
                      </span>
                    </div>
                  </div>

                  {/* AUDIT PEOPLE */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                          <Icon
                            name="user"
                            className="h-4 w-4"
                          />
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Created By
                          </p>

                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {
                              createdBy
                            }
                          </p>

                          <p className="mt-0.5 text-xs text-gray-400">
                            {formatDateTime(
                              expense.created_at
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                          <Icon
                            name="check"
                            className="h-4 w-4"
                          />
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Approved By
                          </p>

                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {approvedBy ||
                              "Not approved yet"}
                          </p>

                          <p className="mt-0.5 text-xs text-gray-400">
                            {expense.approved_at
                              ? formatDateTime(
                                  expense.approved_at
                                )
                              : expense.status ===
                                "pending"
                              ? "Awaiting approval"
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Expense Date
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
                        {
                          categoryName
                        }
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

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Reference
                      </p>

                      <p className="mt-1 text-sm font-medium text-gray-800">
                        {expense.reference ||
                          "—"}
                      </p>
                    </div>
                  </div>

                  {expense.notes && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Notes
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                        {
                          expense.notes
                        }
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
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    {canEdit && (
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
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        Edit Expense
                      </button>
                    )}

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
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Open Details
                      <Icon
                        name="arrow"
                        className="ml-2 h-4 w-4"
                      />
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