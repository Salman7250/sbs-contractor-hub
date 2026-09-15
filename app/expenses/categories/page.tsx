"use client";

import {
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

type Category = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type ExpenseCount = {
  category_id: string;
  count: number;
};

const DEFAULT_CATEGORIES = [
  {
    name: "Inventory Purchase",
    description:
      "Purchases of products, stock, parts, and inventory.",
  },
  {
    name: "Shipping & Delivery",
    description:
      "Courier, freight, delivery, customs, and shipping costs.",
  },
  {
    name: "Fuel & Transportation",
    description:
      "Fuel, parking, taxis, tolls, and transportation.",
  },
  {
    name: "Office Supplies",
    description:
      "Stationery, office supplies, and general consumables.",
  },
  {
    name: "Employee Advance",
    description:
      "Money advanced to employees.",
  },
  {
    name: "Repairs & Maintenance",
    description:
      "Equipment, laptop, vehicle, and facility repairs.",
  },
  {
    name: "Rent",
    description:
      "Office, warehouse, shop, and other rental expenses.",
  },
  {
    name: "Utilities",
    description:
      "Electricity, water, internet, telephone, and utilities.",
  },
  {
    name: "Software & Subscriptions",
    description:
      "Software licenses, SaaS, hosting, domains, and subscriptions.",
  },
  {
    name: "Marketing & Advertising",
    description:
      "Advertising, promotions, SEO, and marketing costs.",
  },
  {
    name: "Bank & Payment Fees",
    description:
      "Bank charges, payment processor fees, and transaction costs.",
  },
  {
    name: "Petty Cash",
    description:
      "Small cash expenses and miscellaneous cash purchases.",
  },
  {
    name: "Tea & Refreshments",
    description:
      "Tea, coffee, water, meals, and office refreshments.",
  },
  {
    name: "Other",
    description:
      "Expenses that do not fit another category.",
  },
];

export default function ExpenseCategoriesPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [companyId, setCompanyId] =
    useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>(
    []
  );

  const [expenseCounts, setExpenseCounts] = useState<
    Record<string, number>
  >({});

  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<Category | null>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] =
    useState("");

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
        } = await supabase.auth.getUser();

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
          throw new Error(
            membershipError.message
          );
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company membership was found for your account."
          );
        }

        setCompanyId(
          membership.company_id
        );

        const {
          data: categoryData,
          error: categoryError,
        } = await supabase
          .from("expense_categories")
          .select(
            `
              id,
              company_id,
              name,
              description,
              created_at,
              updated_at
            `
          )
          .eq(
            "company_id",
            membership.company_id
          )
          .order("name", {
            ascending: true,
          });

        if (categoryError) {
          throw new Error(
            categoryError.message
          );
        }

        const loadedCategories =
          (categoryData ??
            []) as Category[];

        setCategories(
          loadedCategories
        );

        const counts: Record<
          string,
          number
        > = {};

        if (
          loadedCategories.length >
          0
        ) {
          const {
            data: expenseData,
            error: expenseError,
          } = await supabase
            .from("expenses")
            .select("category_id")
            .eq(
              "company_id",
              membership.company_id
            )
            .not(
              "category_id",
              "is",
              null
            );

          if (!expenseError) {
            for (const expense of
              expenseData ?? []) {
              if (
                !expense.category_id
              ) {
                continue;
              }

              counts[
                expense.category_id
              ] =
                (counts[
                  expense.category_id
                ] ?? 0) + 1;
            }
          }
        }

        setExpenseCounts(counts);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load expense categories."
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

  const filteredCategories = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) {
      return categories;
    }

    return categories.filter(
      (category) => {
        return (
          category.name
            .toLowerCase()
            .includes(query) ||
          (
            category.description ??
            ""
          )
            .toLowerCase()
            .includes(query)
        );
      }
    );
  }, [categories, search]);

  const totalExpensesAssigned =
    useMemo(() => {
      return Object.values(
        expenseCounts
      ).reduce(
        (total, count) =>
          total + count,
        0
      );
    }, [expenseCounts]);

  const categoriesInUse =
    useMemo(() => {
      return Object.values(
        expenseCounts
      ).filter(
        (count) => count > 0
      ).length;
    }, [expenseCounts]);

  const openCreateForm = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setErrorMessage("");
    setSuccessMessage("");
    setShowForm(true);
  };

  const openEditForm = (
    category: Category
  ) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(
      category.description ?? ""
    );
    setErrorMessage("");
    setSuccessMessage("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!companyId) {
      setErrorMessage(
        "Company information is unavailable."
      );
      return;
    }

    const trimmedName =
      categoryName.trim();

    const trimmedDescription =
      categoryDescription.trim();

    if (!trimmedName) {
      setErrorMessage(
        "Category name is required."
      );
      return;
    }

    if (trimmedName.length > 100) {
      setErrorMessage(
        "Category name cannot be longer than 100 characters."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (editingCategory) {
        const { error } =
          await supabase
            .from(
              "expense_categories"
            )
            .update({
              name: trimmedName,
              description:
                trimmedDescription ||
                null,
            })
            .eq(
              "id",
              editingCategory.id
            )
            .eq(
              "company_id",
              companyId
            );

        if (error) {
          if (
            error.code ===
              "23505" ||
            error.message
              .toLowerCase()
              .includes("duplicate")
          ) {
            throw new Error(
              "A category with this name already exists."
            );
          }

          throw new Error(
            error.message
          );
        }

        setSuccessMessage(
          "Category updated successfully."
        );
      } else {
        const { error } =
          await supabase
            .from(
              "expense_categories"
            )
            .insert({
              company_id:
                companyId,
              name: trimmedName,
              description:
                trimmedDescription ||
                null,
            });

        if (error) {
          if (
            error.code ===
              "23505" ||
            error.message
              .toLowerCase()
              .includes("duplicate")
          ) {
            throw new Error(
              "A category with this name already exists."
            );
          }

          throw new Error(
            error.message
          );
        }

        setSuccessMessage(
          "Category created successfully."
        );
      }

      setShowForm(false);
      setEditingCategory(null);
      setCategoryName("");
      setCategoryDescription("");

      await loadData(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save category."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (
    category: Category
  ) => {
    const assignedCount =
      expenseCounts[category.id] ??
      0;

    if (assignedCount > 0) {
      setErrorMessage(
        `"${category.name}" cannot be deleted because ${assignedCount} expense${
          assignedCount === 1
            ? ""
            : "s"
        } use this category.`
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${category.name}"?\n\nThis category has no expenses assigned to it.`
      );

    if (!confirmed || !companyId) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const { error } =
      await supabase
        .from("expense_categories")
        .delete()
        .eq("id", category.id)
        .eq(
          "company_id",
          companyId
        );

    if (error) {
      setErrorMessage(
        error.message
      );
      return;
    }

    setSuccessMessage(
      "Category deleted successfully."
    );

    await loadData(true);
  };

  const seedDefaultCategories =
    async () => {
      if (!companyId) {
        setErrorMessage(
          "Company information is unavailable."
        );
        return;
      }

      const existingNames =
        new Set(
          categories.map(
            (category) =>
              category.name.toLowerCase()
          )
        );

      const missingCategories =
        DEFAULT_CATEGORIES.filter(
          (category) =>
            !existingNames.has(
              category.name.toLowerCase()
            )
        );

      if (
        missingCategories.length ===
        0
      ) {
        setSuccessMessage(
          "All recommended categories already exist."
        );
        return;
      }

      const confirmed =
        window.confirm(
          `Create ${missingCategories.length} recommended expense categories?`
        );

      if (!confirmed) {
        return;
      }

      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      try {
        const { error } =
          await supabase
            .from(
              "expense_categories"
            )
            .insert(
              missingCategories.map(
                (category) => ({
                  company_id:
                    companyId,
                  name: category.name,
                  description:
                    category.description,
                })
              )
            );

        if (error) {
          throw new Error(
            error.message
          );
        }

        setSuccessMessage(
          `${missingCategories.length} recommended categories created.`
        );

        await loadData(true);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to create recommended categories."
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <Link
                  href="/expenses"
                  className="transition hover:text-emerald-700"
                >
                  Expenses
                </Link>

                <span>/</span>

                <span className="font-medium text-gray-700">
                  Categories
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Expense Categories
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Manage the categories used
                to organize company expenses.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/expenses"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                Back to Expenses
              </Link>

              <button
                type="button"
                onClick={() =>
                  void seedDefaultCategories()
                }
                disabled={
                  saving || loading
                }
                className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add Recommended
              </button>

              <button
                type="button"
                onClick={
                  openCreateForm
                }
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                + Add Category
              </button>
            </div>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {successMessage}
            </div>
          )}

          {/* Summary Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">
                    Total Categories
                  </div>

                  <div className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                    {loading
                      ? "—"
                      : categories.length}
                  </div>

                  <div className="mt-1 text-xs text-gray-400">
                    Company expense categories
                  </div>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h10" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">
                    Categories In Use
                  </div>

                  <div className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                    {loading
                      ? "—"
                      : categoriesInUse}
                  </div>

                  <div className="mt-1 text-xs text-gray-400">
                    Categories assigned to expenses
                  </div>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">
                    Categorized Expenses
                  </div>

                  <div className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                    {loading
                      ? "—"
                      : totalExpensesAssigned}
                  </div>

                  <div className="mt-1 text-xs text-gray-400">
                    Expense records assigned to categories
                  </div>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 3h12v18H6z" />
                    <path d="M9 7h6" />
                    <path d="M9 11h6" />
                    <path d="M9 15h4" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Main Card */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Categories
                  </h2>

                  <p className="mt-1 text-xs text-gray-500">
                    Create and maintain your company
                    expense classification structure.
                  </p>
                </div>

                <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(event) =>
                        setSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search categories..."
                      className="h-10 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:min-w-[260px]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void loadData(true)
                    }
                    disabled={refreshing}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg
                      className={`h-4 w-4 ${
                        refreshing
                          ? "animate-spin"
                          : ""
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20 11a8.1 8.1 0 0 0-15.5-3" />
                      <path d="M4 4v4h4" />
                      <path d="M4 13a8.1 8.1 0 0 0 15.5 3" />
                      <path d="M20 20v-4h-4" />
                    </svg>

                    {refreshing
                      ? "Refreshing..."
                      : "Refresh"}
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />

                <div className="text-sm font-medium text-gray-500">
                  Loading expense categories...
                </div>
              </div>
            ) : filteredCategories.length ===
              0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <svg
                    className="h-7 w-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h10" />
                  </svg>
                </div>

                <h3 className="text-base font-bold text-gray-900">
                  {search
                    ? "No categories found"
                    : "No expense categories yet"}
                </h3>

                <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                  {search
                    ? "Try a different search term."
                    : "Create your first category or add the recommended categories to get started."}
                </p>

                {!search && (
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        void seedDefaultCategories()
                      }
                      disabled={saving}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Add Recommended
                    </button>

                    <button
                      type="button"
                      onClick={
                        openCreateForm
                      }
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      + Add Category
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                        Category
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                        Description
                      </th>

                      <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500">
                        Expenses
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                        Created
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredCategories.map(
                      (category) => {
                        const assignedCount =
                          expenseCounts[
                            category.id
                          ] ?? 0;

                        return (
                          <tr
                            key={category.id}
                            className="transition hover:bg-emerald-50/30"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                  <svg
                                    className="h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                  >
                                    <path d="M4 6h16" />
                                    <path d="M4 12h16" />
                                    <path d="M4 18h10" />
                                  </svg>
                                </div>

                                <div className="font-semibold text-gray-900">
                                  {category.name}
                                </div>
                              </div>
                            </td>

                            <td className="max-w-[500px] px-5 py-4">
                              <div className="truncate text-sm text-gray-500">
                                {category.description ||
                                  "No description"}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-center">
                              <span
                                className={`inline-flex min-w-[38px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ${
                                  assignedCount >
                                  0
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-gray-100 text-gray-400"
                                }`}
                              >
                                {
                                  assignedCount
                                }
                              </span>
                            </td>

                            <td className="px-5 py-4 text-sm text-gray-500">
                              {new Date(
                                category.created_at
                              ).toLocaleDateString()}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditForm(
                                      category
                                    )
                                  }
                                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleDelete(
                                      category
                                    )
                                  }
                                  disabled={
                                    assignedCount >
                                    0
                                  }
                                  title={
                                    assignedCount >
                                    0
                                      ? "This category is being used by expenses."
                                      : "Delete category"
                                  }
                                  className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Delete
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
            )}

            <div className="border-t border-gray-200 bg-gray-50 px-5 py-3">
              <div className="flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing{" "}
                  {
                    filteredCategories.length
                  }{" "}
                  of{" "}
                  {categories.length}{" "}
                  categories
                </span>

                <span>
                  Categories are isolated to your company.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Create / Edit Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4 py-6 backdrop-blur-[2px]">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
              {/* Modal Header */}
              <div className="border-b border-gray-200 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M4 6h16" />
                        <path d="M4 12h16" />
                        <path d="M4 18h10" />
                      </svg>
                    </div>

                    <h2 className="text-lg font-bold text-gray-900">
                      {editingCategory
                        ? "Edit Category"
                        : "Add Expense Category"}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      {editingCategory
                        ? "Update the category information."
                        : "Create a category for organizing company expenses."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      closeForm
                    }
                    disabled={saving}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                    aria-label="Close"
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="m6 6 12 12" />
                      <path d="m18 6-12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form
                onSubmit={
                  handleSubmit
                }
              >
                <div className="space-y-5 px-6 py-6">
                  {errorMessage && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                      {errorMessage}
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Category Name
                    </label>

                    <input
                      type="text"
                      value={
                        categoryName
                      }
                      onChange={(event) =>
                        setCategoryName(
                          event.target
                            .value
                        )
                      }
                      placeholder="e.g. Shipping & Delivery"
                      maxLength={100}
                      autoFocus
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />

                    <div className="mt-1.5 text-right text-xs text-gray-400">
                      {
                        categoryName.length
                      }
                      /100
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Description
                      <span className="ml-1 font-normal text-gray-400">
                        Optional
                      </span>
                    </label>

                    <textarea
                      value={
                        categoryDescription
                      }
                      onChange={(event) =>
                        setCategoryDescription(
                          event.target
                            .value
                        )
                      }
                      placeholder="Describe what expenses belong in this category..."
                      rows={4}
                      className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm leading-6 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={
                      closeForm
                    }
                    disabled={saving}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : editingCategory
                        ? "Save Changes"
                        : "Create Category"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}