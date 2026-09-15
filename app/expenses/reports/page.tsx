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

type Expense = {
  id: string;
  company_id: string;
  expense_date: string;
  expense_type: string;
  category_id: string | null;
  description: string;
  vendor_name: string | null;
  employee_id: string | null;
  amount: number;
  currency: string;
  payment_method: string;
  reference: string | null;
  status: string;
  settlement_status: string;
  created_at: string;
};

type ExpenseCategory = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
};

type Company = {
  id: string;
  name: string;
  currency: string | null;
};

const EXPENSE_TYPES = [
  "operating_expense",
  "inventory_expense",
  "employee_advance",
  "reimbursement",
  "petty_cash",
  "other",
];

const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "credit_card",
  "debit_card",
  "company_card",
  "petty_cash",
  "other",
];

const REPORT_PERIODS = [
  "this_month",
  "last_month",
  "this_year",
  "all_time",
  "custom",
];

function getDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthStart(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function getMonthEnd(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  );
}

function getYearStart(date: Date) {
  return new Date(
    date.getFullYear(),
    0,
    1
  );
}

function getPreviousMonthStart(
  date: Date
) {
  return new Date(
    date.getFullYear(),
    date.getMonth() - 1,
    1
  );
}

function getPreviousMonthEnd(
  date: Date
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    0
  );
}

export default function ExpenseReportsPage() {
  const supabase = createClient();
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

  const [search, setSearch] =
    useState("");

  const [period, setPeriod] =
    useState("this_month");

  const [typeFilter, setTypeFilter] =
    useState("all");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [paymentFilter, setPaymentFilter] =
    useState("all");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const loadData = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } =
          await supabase.auth.getUser();

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
        } =
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
            "No company membership found."
          );
        }

        const companyId =
          membership.company_id;

        const [
          companyResult,
          expensesResult,
          categoriesResult,
          employeesResult,
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
                status,
                settlement_status,
                created_at
              `
            )
            .eq(
              "company_id",
              companyId
            )
            .neq(
              "status",
              "cancelled"
            )
            .order(
              "expense_date",
              {
                ascending: false,
              }
            )
            .order(
              "created_at",
              {
                ascending: false,
              }
            ),

          supabase
            .from("expense_categories")
            .select(
              "id, name"
            )
            .eq(
              "company_id",
              companyId
            )
            .order("name", {
              ascending: true,
            }),

          supabase
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
          expensesResult.data || []
        );

        setCategories(
          categoriesResult.data || []
        );

        setEmployees(
          employeesResult.data || []
        );
      } catch (err: unknown) {
        console.error(
          "Expense reports load error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Could not load expense reports."
        );
      } finally {
        setLoading(false);
      }
    },
    [router, supabase]
  );

  useEffect(() => {
    // Intentionally starts the asynchronous Supabase synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const activeDateRange =
    useMemo(() => {
      const today = new Date();

      if (period === "this_month") {
        return {
          start: getDateString(
            getMonthStart(today)
          ),
          end: getDateString(
            getMonthEnd(today)
          ),
        };
      }

      if (period === "last_month") {
        return {
          start: getDateString(
            getPreviousMonthStart(
              today
            )
          ),
          end: getDateString(
            getPreviousMonthEnd(
              today
            )
          ),
        };
      }

      if (period === "this_year") {
        return {
          start: getDateString(
            getYearStart(today)
          ),
          end: getDateString(
            today
          ),
        };
      }

      if (period === "custom") {
        return {
          start: startDate,
          end: endDate,
        };
      }

      return {
        start: "",
        end: "",
      };
    }, [
      period,
      startDate,
      endDate,
    ]);

  const filteredExpenses =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return expenses.filter(
        (expense) => {
          const matchesSearch =
            !query ||
            expense.description
              .toLowerCase()
              .includes(query) ||
            (
              expense.vendor_name ||
              ""
            )
              .toLowerCase()
              .includes(query) ||
            (
              expense.reference ||
              ""
            )
              .toLowerCase()
              .includes(query);

          const matchesType =
            typeFilter === "all" ||
            expense.expense_type ===
              typeFilter;

          const matchesCategory =
            categoryFilter === "all" ||
            expense.category_id ===
              categoryFilter;

          const matchesPayment =
            paymentFilter === "all" ||
            expense.payment_method ===
              paymentFilter;

          const matchesStart =
            !activeDateRange.start ||
            expense.expense_date >=
              activeDateRange.start;

          const matchesEnd =
            !activeDateRange.end ||
            expense.expense_date <=
              activeDateRange.end;

          return (
            matchesSearch &&
            matchesType &&
            matchesCategory &&
            matchesPayment &&
            matchesStart &&
            matchesEnd
          );
        }
      );
    }, [
      expenses,
      search,
      typeFilter,
      categoryFilter,
      paymentFilter,
      activeDateRange,
    ]);

  const stats = useMemo(() => {
    const total = filteredExpenses.reduce(
      (sum, expense) =>
        sum + Number(expense.amount || 0),
      0
    );

    const inventory = filteredExpenses
      .filter(
        (expense) =>
          expense.expense_type ===
          "inventory_expense"
      )
      .reduce(
        (sum, expense) =>
          sum + Number(expense.amount || 0),
        0
      );

    const operating = filteredExpenses
      .filter(
        (expense) =>
          expense.expense_type ===
          "operating_expense"
      )
      .reduce(
        (sum, expense) =>
          sum + Number(expense.amount || 0),
        0
      );

    const advances = filteredExpenses
      .filter(
        (expense) =>
          expense.expense_type ===
          "employee_advance"
      )
      .reduce(
        (sum, expense) =>
          sum + Number(expense.amount || 0),
        0
      );

    const outstandingAdvances =
      filteredExpenses
        .filter(
          (expense) =>
            expense.expense_type ===
              "employee_advance" &&
            expense.settlement_status !==
              "settled"
        )
        .reduce(
          (sum, expense) =>
            sum + Number(expense.amount || 0),
          0
        );

    const reimbursements =
      filteredExpenses
        .filter(
          (expense) =>
            expense.expense_type ===
            "reimbursement"
        )
        .reduce(
          (sum, expense) =>
            sum + Number(expense.amount || 0),
          0
        );

    const pettyCash =
      filteredExpenses
        .filter(
          (expense) =>
            expense.expense_type ===
            "petty_cash"
        )
        .reduce(
          (sum, expense) =>
            sum + Number(expense.amount || 0),
          0
        );

    return {
      total,
      inventory,
      operating,
      advances,
      outstandingAdvances,
      reimbursements,
      pettyCash,
    };
  }, [filteredExpenses]);

  const categoryBreakdown =
    useMemo(() => {
      const map = new Map<
        string,
        {
          name: string;
          amount: number;
          count: number;
        }
      >();

      filteredExpenses.forEach(
        (expense) => {
          const category =
            categories.find(
              (item) =>
                item.id ===
                expense.category_id
            );

          const key =
            expense.category_id ||
            "uncategorized";

          const current =
            map.get(key) || {
              name:
                category?.name ||
                "Uncategorized",
              amount: 0,
              count: 0,
            };

          current.amount +=
            Number(
              expense.amount || 0
            );

          current.count += 1;

          map.set(
            key,
            current
          );
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.amount - a.amount
      );
    }, [
      filteredExpenses,
      categories,
    ]);

  const typeBreakdown =
    useMemo(() => {
      const map = new Map<
        string,
        {
          type: string;
          amount: number;
          count: number;
        }
      >();

      filteredExpenses.forEach(
        (expense) => {
          const current =
            map.get(
              expense.expense_type
            ) || {
              type:
                expense.expense_type,
              amount: 0,
              count: 0,
            };

          current.amount +=
            Number(
              expense.amount || 0
            );

          current.count += 1;

          map.set(
            expense.expense_type,
            current
          );
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.amount - a.amount
      );
    }, [filteredExpenses]);

  const paymentBreakdown =
    useMemo(() => {
      const map = new Map<
        string,
        {
          method: string;
          amount: number;
          count: number;
        }
      >();

      filteredExpenses.forEach(
        (expense) => {
          const current =
            map.get(
              expense.payment_method
            ) || {
              method:
                expense.payment_method,
              amount: 0,
              count: 0,
            };

          current.amount +=
            Number(
              expense.amount || 0
            );

          current.count += 1;

          map.set(
            expense.payment_method,
            current
          );
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.amount - a.amount
      );
    }, [filteredExpenses]);

  const vendorBreakdown =
    useMemo(() => {
      const map = new Map<
        string,
        {
          vendor: string;
          amount: number;
          count: number;
        }
      >();

      filteredExpenses.forEach(
        (expense) => {
          const vendor =
            expense.vendor_name?.trim() ||
            "No vendor";

          const current =
            map.get(vendor) || {
              vendor,
              amount: 0,
              count: 0,
            };

          current.amount +=
            Number(
              expense.amount || 0
            );

          current.count += 1;

          map.set(
            vendor,
            current
          );
        }
      );

      return Array.from(
        map.values()
      )
        .sort(
          (a, b) =>
            b.amount - a.amount
        )
        .slice(0, 10);
    }, [filteredExpenses]);

  const employeeBreakdown =
    useMemo(() => {
      const map = new Map<
        string,
        {
          employee: string;
          amount: number;
          count: number;
          outstanding: number;
        }
      >();

      filteredExpenses
        .filter(
          (expense) =>
            expense.expense_type ===
              "employee_advance" ||
            expense.expense_type ===
              "reimbursement"
        )
        .forEach((expense) => {
          const employee =
            employees.find(
              (item) =>
                item.id ===
                expense.employee_id
            );

          const employeeName =
            employee?.full_name ||
            [
              employee?.first_name,
              employee?.last_name,
            ]
              .filter(Boolean)
              .join(" ") ||
            "Unknown employee";

          const key =
            expense.employee_id ||
            "unknown";

          const current =
            map.get(key) || {
              employee:
                employeeName,
              amount: 0,
              count: 0,
              outstanding: 0,
            };

          current.amount +=
            Number(
              expense.amount || 0
            );

          current.count += 1;

          if (
            expense.expense_type ===
              "employee_advance" &&
            expense.settlement_status !==
              "settled"
          ) {
            current.outstanding +=
              Number(
                expense.amount || 0
              );
          }

          map.set(
            key,
            current
          );
        });

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.amount - a.amount
      );
    }, [
      filteredExpenses,
      employees,
    ]);

  const monthlyBreakdown =
    useMemo(() => {
      const map = new Map<
        string,
        {
          month: string;
          amount: number;
          count: number;
        }
      >();

      filteredExpenses.forEach(
        (expense) => {
          const month =
            expense.expense_date.slice(
              0,
              7
            );

          const current =
            map.get(month) || {
              month,
              amount: 0,
              count: 0,
            };

          current.amount +=
            Number(
              expense.amount || 0
            );

          current.count += 1;

          map.set(
            month,
            current
          );
        }
      );

      return Array.from(
        map.values()
      ).sort((a, b) =>
        a.month.localeCompare(
          b.month
        )
      );
    }, [filteredExpenses]);

  function formatCurrency(
    value: number
  ) {
    const currency =
      company?.currency ||
      "AED";

    try {
      return new Intl.NumberFormat(
        "en-US",
        {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }
      ).format(value);
    } catch {
      return `${currency} ${value.toFixed(
        2
      )}`;
    }
  }

  function formatDate(
    date: string | null
  ) {
    if (!date) {
      return "—";
    }

    const parsed = new Date(
      `${date}T00:00:00`
    );

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return date;
    }

    return parsed.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );
  }

  function formatType(
    type: string
  ) {
    const labels: Record<
      string,
      string
    > = {
      operating_expense:
        "Operating Expense",
      inventory_expense:
        "Inventory Expense",
      employee_advance:
        "Employee Advance",
      reimbursement:
        "Reimbursement",
      petty_cash:
        "Petty Cash",
      other: "Other",
    };

    return (
      labels[type] ||
      type
        .replaceAll("_", " ")
        .replace(
          /\b\w/g,
          (letter) =>
            letter.toUpperCase()
        )
    );
  }

  function formatPaymentMethod(
    method: string
  ) {
    const labels: Record<
      string,
      string
    > = {
      cash: "Cash",
      bank_transfer:
        "Bank Transfer",
      credit_card:
        "Credit Card",
      debit_card:
        "Debit Card",
      company_card:
        "Company Card",
      petty_cash:
        "Petty Cash",
      other: "Other",
    };

    return (
      labels[method] ||
      method
        .replaceAll("_", " ")
        .replace(
          /\b\w/g,
          (letter) =>
            letter.toUpperCase()
        )
    );
  }

  function getCategoryName(
    categoryId: string | null
  ) {
    if (!categoryId) {
      return "Uncategorized";
    }

    return (
      categories.find(
        (category) =>
          category.id ===
          categoryId
      )?.name ||
      "Uncategorized"
    );
  }

  function getPercentage(
    amount: number
  ) {
    if (!stats.total) {
      return 0;
    }

    return Math.round(
      (amount / stats.total) *
        100
    );
  }

  function exportCsv() {
    const rows = [
      [
        "Date",
        "Type",
        "Category",
        "Description",
        "Vendor",
        "Payment Method",
        "Amount",
        "Currency",
        "Status",
        "Settlement Status",
        "Reference",
      ],
      ...filteredExpenses.map(
        (expense) => [
          expense.expense_date,
          formatType(
            expense.expense_type
          ),
          getCategoryName(
            expense.category_id
          ),
          expense.description,
          expense.vendor_name ||
            "",
          formatPaymentMethod(
            expense.payment_method
          ),
          Number(
            expense.amount || 0
          ).toFixed(2),
          expense.currency,
          expense.status,
          expense.settlement_status,
          expense.reference || "",
        ]
      ),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const text =
              String(value);

            return `"${text.replaceAll(
              '"',
              '""'
            )}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob =
      new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;
    link.download = `expense-report-${getDateString(
      new Date()
    )}.csv`;

    document.body.appendChild(
      link
    );

    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setSuccess(
      "Expense report exported successfully."
    );

    setTimeout(() => {
      setSuccess("");
    }, 2500);
  }

  function clearFilters() {
    setSearch("");
    setPeriod("this_month");
    setTypeFilter("all");
    setCategoryFilter("all");
    setPaymentFilter("all");
    setStartDate("");
    setEndDate("");
  }

  const maxMonthlyAmount =
    Math.max(
      ...monthlyBreakdown.map(
        (item) => item.amount
      ),
      1
    );

  return (
    <AppShell
      title="Expense Reports"
      description="Analyze company spending, expenses and employee advances."
      actions={
        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={exportCsv}
          >
            Export CSV
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              router.push(
                "/expenses/new"
              )
            }
          >
            + New Expense
          </button>
        </div>
      }
    >
      <section className="page-content">
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Expenses
            </div>

            <div className="stat-value">
              {formatCurrency(
                stats.total
              )}
            </div>

            <div className="stat-description">
              {
                filteredExpenses.length
              }{" "}
              transactions in period
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Inventory Expenses
            </div>

            <div className="stat-value">
              {formatCurrency(
                stats.inventory
              )}
            </div>

            <div className="stat-description">
              Inventory and purchasing costs
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Operating Expenses
            </div>

            <div className="stat-value">
              {formatCurrency(
                stats.operating
              )}
            </div>

            <div className="stat-description">
              Day-to-day business expenses
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Outstanding Advances
            </div>

            <div className="stat-value">
              {formatCurrency(
                stats.outstandingAdvances
              )}
            </div>

            <div className="stat-description">
              Employee advances not settled
            </div>
          </div>
        </div>

        <section className="content-card filters-card">
          <div className="content-card-header">
            <div>
              <h2>
                Report Filters
              </h2>

              <p>
                Adjust the reporting period and expense breakdown.
              </p>
            </div>

            <button
              type="button"
              className="table-action"
              onClick={
                clearFilters
              }
            >
              Clear Filters
            </button>
          </div>

          <div className="filter-grid">
            <div className="filter-field search-field">
              <label>
                Search
              </label>

              <div className="search-box">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search expenses..."
                  value={search}
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event.target
                        .value
                    )
                  }
                />
              </div>
            </div>

            <div className="filter-field">
              <label>
                Period
              </label>

              <select
                value={period}
                onChange={(
                  event
                ) =>
                  setPeriod(
                    event.target
                      .value
                  )
                }
              >
                <option value="this_month">
                  This month
                </option>

                <option value="last_month">
                  Last month
                </option>

                <option value="this_year">
                  This year
                </option>

                <option value="all_time">
                  All time
                </option>

                <option value="custom">
                  Custom range
                </option>
              </select>
            </div>

            <div className="filter-field">
              <label>
                Expense Type
              </label>

              <select
                value={
                  typeFilter
                }
                onChange={(
                  event
                ) =>
                  setTypeFilter(
                    event.target
                      .value
                  )
                }
              >
                <option value="all">
                  All types
                </option>

                {EXPENSE_TYPES.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {formatType(
                        type
                      )}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="filter-field">
              <label>
                Category
              </label>

              <select
                value={
                  categoryFilter
                }
                onChange={(
                  event
                ) =>
                  setCategoryFilter(
                    event.target
                      .value
                  )
                }
              >
                <option value="all">
                  All categories
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
                      {
                        category.name
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="filter-field">
              <label>
                Payment Method
              </label>

              <select
                value={
                  paymentFilter
                }
                onChange={(
                  event
                ) =>
                  setPaymentFilter(
                    event.target
                      .value
                  )
                }
              >
                <option value="all">
                  All payment methods
                </option>

                {PAYMENT_METHODS.map(
                  (method) => (
                    <option
                      key={method}
                      value={method}
                    >
                      {formatPaymentMethod(
                        method
                      )}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {period === "custom" && (
            <div className="custom-date-row">
              <div className="filter-field">
                <label>
                  Start Date
                </label>

                <input
                  type="date"
                  value={
                    startDate
                  }
                  onChange={(
                    event
                  ) =>
                    setStartDate(
                      event.target
                        .value
                    )
                  }
                />
              </div>

              <div className="filter-field">
                <label>
                  End Date
                </label>

                <input
                  type="date"
                  value={
                    endDate
                  }
                  onChange={(
                    event
                  ) =>
                    setEndDate(
                      event.target
                        .value
                    )
                  }
                />
              </div>
            </div>
          )}
        </section>

        {loading ? (
          <section className="content-card">
            <div className="empty-state">
              <div className="loading-spinner" />

              <p>
                Loading expense reports...
              </p>
            </div>
          </section>
        ) : (
          <>
            <div className="report-grid">
              <section className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>
                      Expenses by Category
                    </h2>

                    <p>
                      Spending distribution across categories.
                    </p>
                  </div>
                </div>

                {categoryBreakdown.length ===
                0 ? (
                  <div className="mini-empty">
                    No category data for this period.
                  </div>
                ) : (
                  <div className="breakdown-list">
                    {categoryBreakdown
                      .slice(
                        0,
                        8
                      )
                      .map(
                        (
                          item
                        ) => (
                          <div
                            className="breakdown-item"
                            key={
                              item.name
                            }
                          >
                            <div className="breakdown-top">
                              <div>
                                <div className="breakdown-name">
                                  {
                                    item.name
                                  }
                                </div>

                                <div className="breakdown-count">
                                  {
                                    item.count
                                  }{" "}
                                  transaction
                                  {item.count ===
                                  1
                                    ? ""
                                    : "s"}
                                </div>
                              </div>

                              <strong>
                                {formatCurrency(
                                  item.amount
                                )}
                              </strong>
                            </div>

                            <div className="progress-track">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${getPercentage(
                                    item.amount
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )
                      )}
                  </div>
                )}
              </section>

              <section className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>
                      Expenses by Type
                    </h2>

                    <p>
                      Compare major expense classifications.
                    </p>
                  </div>
                </div>

                {typeBreakdown.length ===
                0 ? (
                  <div className="mini-empty">
                    No type data for this period.
                  </div>
                ) : (
                  <div className="breakdown-list">
                    {typeBreakdown.map(
                      (
                        item
                      ) => (
                        <div
                          className="breakdown-item"
                          key={
                            item.type
                          }
                        >
                          <div className="breakdown-top">
                            <div>
                              <div className="breakdown-name">
                                {formatType(
                                  item.type
                                )}
                              </div>

                              <div className="breakdown-count">
                                {
                                  item.count
                                }{" "}
                                transaction
                                {item.count ===
                                1
                                  ? ""
                                  : "s"}
                              </div>
                            </div>

                            <strong>
                              {formatCurrency(
                                item.amount
                              )}
                            </strong>
                          </div>

                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${getPercentage(
                                  item.amount
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>
            </div>

            <div className="report-grid">
              <section className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>
                      Monthly Spending
                    </h2>

                    <p>
                      Expense activity over time.
                    </p>
                  </div>
                </div>

                {monthlyBreakdown.length ===
                0 ? (
                  <div className="mini-empty">
                    No monthly data available.
                  </div>
                ) : (
                  <div className="monthly-chart">
                    {monthlyBreakdown.map(
                      (
                        item
                      ) => {
                        const height =
                          Math.max(
                            (item.amount /
                              maxMonthlyAmount) *
                              100,
                            4
                          );

                        return (
                          <div
                            className="month-column"
                            key={
                              item.month
                            }
                          >
                            <div className="month-value">
                              {formatCurrency(
                                item.amount
                              )}
                            </div>

                            <div className="chart-area">
                              <div
                                className="chart-bar"
                                style={{
                                  height: `${height}%`,
                                }}
                              />
                            </div>

                            <div className="month-label">
                              {new Date(
                                `${item.month}-01T00:00:00`
                              ).toLocaleDateString(
                                "en-US",
                                {
                                  month:
                                    "short",
                                  year:
                                    "numeric",
                                }
                              )}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </section>

              <section className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>
                      Payment Methods
                    </h2>

                    <p>
                      Where expense payments were made.
                    </p>
                  </div>
                </div>

                {paymentBreakdown.length ===
                0 ? (
                  <div className="mini-empty">
                    No payment data for this period.
                  </div>
                ) : (
                  <div className="breakdown-list">
                    {paymentBreakdown.map(
                      (
                        item
                      ) => (
                        <div
                          className="breakdown-item"
                          key={
                            item.method
                          }
                        >
                          <div className="breakdown-top">
                            <div>
                              <div className="breakdown-name">
                                {formatPaymentMethod(
                                  item.method
                                )}
                              </div>

                              <div className="breakdown-count">
                                {
                                  item.count
                                }{" "}
                                transaction
                                {item.count ===
                                1
                                  ? ""
                                  : "s"}
                              </div>
                            </div>

                            <strong>
                              {formatCurrency(
                                item.amount
                              )}
                            </strong>
                          </div>

                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${getPercentage(
                                  item.amount
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>
            </div>

            <div className="report-grid">
              <section className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>
                      Top Vendors
                    </h2>

                    <p>
                      Highest spending vendors in the selected period.
                    </p>
                  </div>
                </div>

                {vendorBreakdown.length ===
                0 ? (
                  <div className="mini-empty">
                    No vendor data available.
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="data-table compact-table">
                      <thead>
                        <tr>
                          <th>
                            Vendor
                          </th>

                          <th>
                            Transactions
                          </th>

                          <th>
                            Total
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {vendorBreakdown.map(
                          (
                            item
                          ) => (
                            <tr
                              key={
                                item.vendor
                              }
                            >
                              <td>
                                <div className="primary-cell">
                                  {
                                    item.vendor
                                  }
                                </div>
                              </td>

                              <td>
                                {
                                  item.count
                                }
                              </td>

                              <td>
                                <strong>
                                  {formatCurrency(
                                    item.amount
                                  )}
                                </strong>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>
                      Employee Advances & Reimbursements
                    </h2>

                    <p>
                      Employee-related money outflows and outstanding balances.
                    </p>
                  </div>
                </div>

                <div className="employee-summary">
                  <div className="summary-box">
                    <span>
                      Advances
                    </span>

                    <strong>
                      {formatCurrency(
                        stats.advances
                      )}
                    </strong>
                  </div>

                  <div className="summary-box">
                    <span>
                      Outstanding
                    </span>

                    <strong className="danger-text">
                      {formatCurrency(
                        stats.outstandingAdvances
                      )}
                    </strong>
                  </div>

                  <div className="summary-box">
                    <span>
                      Reimbursements
                    </span>

                    <strong>
                      {formatCurrency(
                        stats.reimbursements
                      )}
                    </strong>
                  </div>

                  <div className="summary-box">
                    <span>
                      Petty Cash
                    </span>

                    <strong>
                      {formatCurrency(
                        stats.pettyCash
                      )}
                    </strong>
                  </div>
                </div>

                {employeeBreakdown.length >
                0 && (
                  <div className="table-wrapper">
                    <table className="data-table compact-table">
                      <thead>
                        <tr>
                          <th>
                            Employee
                          </th>

                          <th>
                            Transactions
                          </th>

                          <th>
                            Total
                          </th>

                          <th>
                            Outstanding
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {employeeBreakdown
                          .slice(
                            0,
                            8
                          )
                          .map(
                            (
                              item
                            ) => (
                              <tr
                                key={
                                  item.employee
                                }
                              >
                                <td>
                                  <div className="primary-cell">
                                    {
                                      item.employee
                                    }
                                  </div>
                                </td>

                                <td>
                                  {
                                    item.count
                                  }
                                </td>

                                <td>
                                  <strong>
                                    {formatCurrency(
                                      item.amount
                                    )}
                                  </strong>
                                </td>

                                <td>
                                  <strong
                                    className={
                                      item.outstanding >
                                      0
                                        ? "balance-due"
                                        : "balance-paid"
                                    }
                                  >
                                    {formatCurrency(
                                      item.outstanding
                                    )}
                                  </strong>
                                </td>
                              </tr>
                            )
                          )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <section className="content-card">
              <div className="content-card-header">
                <div>
                  <h2>
                    Expense Transactions
                  </h2>

                  <p>
                    {
                      filteredExpenses.length
                    }{" "}
                    expense
                    {filteredExpenses.length ===
                    1
                      ? ""
                      : "s"}{" "}
                    included in this report
                  </p>
                </div>
              </div>

              {filteredExpenses.length ===
              0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    ▥
                  </div>

                  <h3>
                    No expenses found
                  </h3>

                  <p>
                    Try changing your report filters.
                  </p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>
                          Date
                        </th>

                        <th>
                          Description
                        </th>

                        <th>
                          Type
                        </th>

                        <th>
                          Category
                        </th>

                        <th>
                          Vendor
                        </th>

                        <th>
                          Payment
                        </th>

                        <th>
                          Amount
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredExpenses.map(
                        (
                          expense
                        ) => (
                          <tr
                            key={
                              expense.id
                            }
                          >
                            <td>
                              {formatDate(
                                expense.expense_date
                              )}
                            </td>

                            <td>
                              <div className="primary-cell">
                                {
                                  expense.description
                                }
                              </div>

                              {expense.reference && (
                                <div className="secondary-cell">
                                  Ref:{" "}
                                  {
                                    expense.reference
                                  }
                                </div>
                              )}
                            </td>

                            <td>
                              <span className="status-badge status-sent">
                                {formatType(
                                  expense.expense_type
                                )}
                              </span>
                            </td>

                            <td>
                              {
                                getCategoryName(
                                  expense.category_id
                                )
                              }
                            </td>

                            <td>
                              {
                                expense.vendor_name ||
                                "—"
                              }
                            </td>

                            <td>
                              {formatPaymentMethod(
                                expense.payment_method
                              )}
                            </td>

                            <td>
                              <strong>
                                {formatCurrency(
                                  Number(
                                    expense.amount ||
                                      0
                                  )
                                )}
                              </strong>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </section>

      <style jsx>{`
  .page-content {
    padding: 28px;
    background: #f8fafc;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .stat-card {
    position: relative;
    overflow: hidden;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.035);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;
  }

  .stat-card:hover {
    border-color: #d1d5db;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    transform: translateY(-1px);
  }

  .stat-card::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: #10b981;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .stat-card:hover::after {
    opacity: 1;
  }

  .stat-label {
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 9px;
    letter-spacing: 0.15px;
  }

  .stat-value {
    color: #111827;
    font-size: 25px;
    font-weight: 800;
    letter-spacing: -0.6px;
    line-height: 1.2;
  }

  .stat-description {
    color: #94a3b8;
    font-size: 12px;
    margin-top: 7px;
    line-height: 1.45;
  }

  .content-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.035);
    margin-bottom: 24px;
  }

  .content-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 21px 22px;
    border-bottom: 1px solid #edf0f2;
  }

  .content-card-header h2 {
    margin: 0;
    color: #111827;
    font-size: 16px;
    font-weight: 750;
    letter-spacing: -0.15px;
  }

  .content-card-header p {
    margin: 5px 0 0;
    color: #94a3b8;
    font-size: 12px;
    line-height: 1.45;
  }

  .filter-grid {
    display: grid;
    grid-template-columns: 2fr repeat(4, minmax(130px, 1fr));
    gap: 12px;
    padding: 20px 22px;
  }

  .custom-date-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 18px 22px 21px;
    border-top: 1px solid #f1f5f9;
  }

  .filter-field {
    min-width: 0;
  }

  .filter-field label {
    display: block;
    margin-bottom: 7px;
    color: #64748b;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.55px;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 9px;
    height: 42px;
    padding: 0 12px;
    border: 1px solid #dfe5ea;
    border-radius: 10px;
    background: #ffffff;
    box-sizing: border-box;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .search-box:focus-within {
    border-color: #6ee7b7;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.09);
  }

  .search-box span {
    color: #94a3b8;
    font-size: 17px;
    line-height: 1;
  }

  .search-box input {
    width: 100%;
    height: 100%;
    border: 0;
    outline: 0;
    color: #111827;
    background: transparent;
    font-size: 13px;
  }

  .search-box input::placeholder {
    color: #a1aab5;
  }

  .filter-field select,
  .filter-field > input {
    width: 100%;
    height: 42px;
    padding: 0 12px;
    border: 1px solid #dfe5ea;
    border-radius: 10px;
    background: #ffffff;
    color: #334155;
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .filter-field select:focus,
  .filter-field > input:focus {
    border-color: #6ee7b7;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.09);
  }

  .report-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
  }

  .report-grid .content-card {
    margin-bottom: 0;
  }

  .breakdown-list {
    padding: 3px 22px 18px;
  }

  .breakdown-item {
    padding: 15px 0;
    border-bottom: 1px solid #f1f5f9;
  }

  .breakdown-item:last-child {
    border-bottom: 0;
  }

  .breakdown-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
  }

  .breakdown-name {
    color: #1f2937;
    font-size: 13px;
    font-weight: 700;
  }

  .breakdown-count {
    margin-top: 4px;
    color: #94a3b8;
    font-size: 11px;
  }

  .breakdown-top strong {
    color: #111827;
    font-size: 13px;
    font-weight: 750;
    white-space: nowrap;
  }

  .progress-track {
    width: 100%;
    height: 7px;
    margin-top: 10px;
    overflow: hidden;
    border-radius: 999px;
    background: #ecfdf5;
  }

  .progress-fill {
    height: 100%;
    min-width: 2px;
    border-radius: 999px;
    background: #10b981;
    transition: width 0.25s ease;
  }

  .monthly-chart {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    min-height: 290px;
    padding: 22px;
    overflow-x: auto;
  }

  .month-column {
    min-width: 72px;
    height: 245px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
  }

  .month-value {
    min-height: 18px;
    margin-bottom: 8px;
    color: #64748b;
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
  }

  .chart-area {
    width: 48px;
    height: 175px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0 8px;
    border-bottom: 1px solid #e5e7eb;
  }

  .chart-bar {
    width: 30px;
    min-height: 5px;
    border-radius: 8px 8px 2px 2px;
    background: #10b981;
    box-shadow: 0 3px 8px rgba(16, 185, 129, 0.16);
    transition:
      height 0.25s ease,
      opacity 0.2s ease;
  }

  .chart-bar:hover {
    opacity: 0.8;
  }

  .month-label {
    margin-top: 9px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 800px;
  }

  .compact-table {
    min-width: 0;
  }

  .data-table th {
    padding: 12px 18px;
    background: #f8fafc;
    border-bottom: 1px solid #edf0f2;
    color: #64748b;
    font-size: 10px;
    font-weight: 800;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.55px;
    white-space: nowrap;
  }

  .data-table td {
    padding: 14px 18px;
    border-top: 1px solid #f1f5f9;
    color: #475569;
    font-size: 13px;
    vertical-align: middle;
  }

  .data-table tbody tr {
    transition: background 0.15s ease;
  }

  .data-table tbody tr:hover {
    background: #f8fffc;
  }

  .primary-cell {
    color: #111827;
    font-weight: 700;
  }

  .secondary-cell {
    margin-top: 4px;
    color: #94a3b8;
    font-size: 11px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 5px 9px;
    border: 1px solid #a7f3d0;
    border-radius: 999px;
    background: #ecfdf5;
    color: #047857;
    font-size: 10px;
    font-weight: 750;
    white-space: nowrap;
  }

  .balance-due {
    color: #dc2626;
  }

  .balance-paid {
    color: #059669;
  }

  .employee-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    padding: 20px 22px;
    border-bottom: 1px solid #f1f5f9;
  }

  .summary-box {
    padding: 14px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #f8fafc;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .summary-box:hover {
    border-color: #d1fae5;
    background: #f0fdf4;
  }

  .summary-box span {
    display: block;
    margin-bottom: 6px;
    color: #64748b;
    font-size: 10px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .summary-box strong {
    color: #111827;
    font-size: 15px;
    font-weight: 800;
  }

  .danger-text {
    color: #dc2626 !important;
  }

  .mini-empty {
    padding: 38px 22px;
    color: #94a3b8;
    font-size: 12px;
    text-align: center;
  }

  .empty-state {
    min-height: 300px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-icon {
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 15px;
    border: 1px solid #d1fae5;
    border-radius: 14px;
    background: #ecfdf5;
    color: #059669;
    font-size: 22px;
  }

  .empty-state h3 {
    margin: 0;
    color: #111827;
    font-size: 17px;
    font-weight: 750;
  }

  .empty-state p {
    margin: 7px 0 18px;
    color: #94a3b8;
    font-size: 13px;
  }

  .loading-spinner {
    width: 28px;
    height: 28px;
    margin-bottom: 12px;
    border: 3px solid #d1fae5;
    border-top-color: #10b981;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .alert {
    display: flex;
    align-items: center;
    min-height: 42px;
    padding: 10px 14px;
    margin-bottom: 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
  }

  .alert-error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }

  .alert-success {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }

  .primary-button,
  .secondary-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    padding: 0 15px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.15s ease;
  }

  .primary-button {
    border: 1px solid #059669;
    background: #059669;
    color: #ffffff;
    box-shadow: 0 2px 5px rgba(5, 150, 105, 0.14);
  }

  .primary-button:hover {
    background: #047857;
    border-color: #047857;
    box-shadow: 0 5px 12px rgba(5, 150, 105, 0.18);
    transform: translateY(-1px);
  }

  .secondary-button {
    border: 1px solid #dfe5ea;
    background: #ffffff;
    color: #475569;
  }

  .secondary-button:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  .table-action {
    border: 1px solid #d1fae5;
    background: #ecfdf5;
    color: #047857;
    padding: 7px 11px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .table-action:hover {
    background: #d1fae5;
    border-color: #a7f3d0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1200px) {
    .filter-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .search-field {
      grid-column: span 3;
    }

    .employee-summary {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 1100px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .report-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 800px) {
    .page-content {
      padding: 18px;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions button {
      flex: 1;
    }

    .filter-grid {
      grid-template-columns: 1fr 1fr;
    }

    .search-field {
      grid-column: span 2;
    }

    .content-card-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .employee-summary {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 600px) {
    .page-content {
      padding: 14px;
    }

    .stats-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .stat-card {
      padding: 17px;
    }

    .filter-grid {
      grid-template-columns: 1fr;
      padding: 17px;
    }

    .search-field {
      grid-column: span 1;
    }

    .custom-date-row {
      grid-template-columns: 1fr;
      padding: 17px;
    }

    .header-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .header-actions button {
      width: 100%;
    }

    .employee-summary {
      grid-template-columns: 1fr;
      padding: 17px;
    }

    .content-card-header {
      padding: 18px;
    }

    .breakdown-list {
      padding-left: 18px;
      padding-right: 18px;
    }

    .monthly-chart {
      padding-left: 18px;
      padding-right: 18px;
    }
  }
`}</style>
    </AppShell>
  );
}