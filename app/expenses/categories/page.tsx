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
    description: "Purchases of products, stock, parts, and inventory.",
  },
  {
    name: "Shipping & Delivery",
    description: "Courier, freight, delivery, customs, and shipping costs.",
  },
  {
    name: "Fuel & Transportation",
    description: "Fuel, parking, taxis, tolls, and transportation.",
  },
  {
    name: "Office Supplies",
    description: "Stationery, office supplies, and general consumables.",
  },
  {
    name: "Employee Advance",
    description: "Money advanced to employees.",
  },
  {
    name: "Repairs & Maintenance",
    description: "Equipment, laptop, vehicle, and facility repairs.",
  },
  {
    name: "Rent",
    description: "Office, warehouse, shop, and other rental expenses.",
  },
  {
    name: "Utilities",
    description: "Electricity, water, internet, telephone, and utilities.",
  },
  {
    name: "Software & Subscriptions",
    description: "Software licenses, SaaS, hosting, domains, and subscriptions.",
  },
  {
    name: "Marketing & Advertising",
    description: "Advertising, promotions, SEO, and marketing costs.",
  },
  {
    name: "Bank & Payment Fees",
    description: "Bank charges, payment processor fees, and transaction costs.",
  },
  {
    name: "Petty Cash",
    description: "Small cash expenses and miscellaneous cash purchases.",
  },
  {
    name: "Tea & Refreshments",
    description: "Tea, coffee, water, meals, and office refreshments.",
  },
  {
    name: "Other",
    description: "Expenses that do not fit another category.",
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

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
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

        const { data: membership, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (membershipError) {
          throw new Error(membershipError.message);
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company membership was found for your account."
          );
        }

        setCompanyId(membership.company_id);

        const { data: categoryData, error: categoryError } =
          await supabase
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
            .eq("company_id", membership.company_id)
            .order("name", { ascending: true });

        if (categoryError) {
          throw new Error(categoryError.message);
        }

        const loadedCategories = (categoryData ??
          []) as Category[];

        setCategories(loadedCategories);

        const counts: Record<string, number> = {};

        if (loadedCategories.length > 0) {
          const { data: expenseData, error: expenseError } =
            await supabase
              .from("expenses")
              .select("category_id")
              .eq("company_id", membership.company_id)
              .not("category_id", "is", null);

          if (!expenseError) {
            for (const expense of expenseData ?? []) {
              if (!expense.category_id) continue;

              counts[expense.category_id] =
                (counts[expense.category_id] ?? 0) + 1;
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
    const query = search.trim().toLowerCase();

    if (!query) {
      return categories;
    }

    return categories.filter((category) => {
      return (
        category.name.toLowerCase().includes(query) ||
        (category.description ?? "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [categories, search]);

  const totalExpensesAssigned = useMemo(() => {
    return Object.values(expenseCounts).reduce(
      (total, count) => total + count,
      0
    );
  }, [expenseCounts]);

  const openCreateForm = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setErrorMessage("");
    setSuccessMessage("");
    setShowForm(true);
  };

  const openEditForm = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description ?? "");
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!companyId) {
      setErrorMessage("Company information is unavailable.");
      return;
    }

    const trimmedName = categoryName.trim();
    const trimmedDescription = categoryDescription.trim();

    if (!trimmedName) {
      setErrorMessage("Category name is required.");
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
        const { error } = await supabase
          .from("expense_categories")
          .update({
            name: trimmedName,
            description: trimmedDescription || null,
          })
          .eq("id", editingCategory.id)
          .eq("company_id", companyId);

        if (error) {
          if (
            error.code === "23505" ||
            error.message.toLowerCase().includes("duplicate")
          ) {
            throw new Error(
              "A category with this name already exists."
            );
          }

          throw new Error(error.message);
        }

        setSuccessMessage("Category updated successfully.");
      } else {
        const { error } = await supabase
          .from("expense_categories")
          .insert({
            company_id: companyId,
            name: trimmedName,
            description: trimmedDescription || null,
          });

        if (error) {
          if (
            error.code === "23505" ||
            error.message.toLowerCase().includes("duplicate")
          ) {
            throw new Error(
              "A category with this name already exists."
            );
          }

          throw new Error(error.message);
        }

        setSuccessMessage("Category created successfully.");
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

  const handleDelete = async (category: Category) => {
    const assignedCount = expenseCounts[category.id] ?? 0;

    if (assignedCount > 0) {
      setErrorMessage(
        `"${category.name}" cannot be deleted because ${assignedCount} expense${
          assignedCount === 1 ? "" : "s"
        } use this category.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${category.name}"?\n\nThis category has no expenses assigned to it.`
    );

    if (!confirmed || !companyId) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("expense_categories")
      .delete()
      .eq("id", category.id)
      .eq("company_id", companyId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage("Category deleted successfully.");
    await loadData(true);
  };

  const seedDefaultCategories = async () => {
    if (!companyId) {
      setErrorMessage("Company information is unavailable.");
      return;
    }

    const existingNames = new Set(
      categories.map((category) => category.name.toLowerCase())
    );

    const missingCategories = DEFAULT_CATEGORIES.filter(
      (category) =>
        !existingNames.has(category.name.toLowerCase())
    );

    if (missingCategories.length === 0) {
      setSuccessMessage(
        "All recommended categories already exist."
      );
      return;
    }

    const confirmed = window.confirm(
      `Create ${missingCategories.length} recommended expense categories?`
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("expense_categories")
        .insert(
          missingCategories.map((category) => ({
            company_id: companyId,
            name: category.name,
            description: category.description,
          }))
        );

      if (error) {
        throw new Error(error.message);
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
      <div className="min-h-screen bg-[#f8fafc]">
        <div className="mx-auto max-w-[1600px] px-6 py-6">
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
                  Categories
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Expense Categories
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage the categories used to organize company
                expenses.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/expenses"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Back to Expenses
              </Link>

              <button
                type="button"
                onClick={() => void seedDefaultCategories()}
                disabled={saving || loading}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add Recommended
              </button>

              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                + Add Category
              </button>
            </div>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
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
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-slate-500">
                Total Categories
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                {loading ? "—" : categories.length}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Company expense categories
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-slate-500">
                Categories In Use
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                {loading
                  ? "—"
                  : Object.values(expenseCounts).filter(
                      (count) => count > 0
                    ).length}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Categories currently assigned to expenses
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-slate-500">
                Categorized Expenses
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                {loading ? "—" : totalExpensesAssigned}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Expense records assigned to categories
              </div>
            </div>
          </div>

          {/* Main Card */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Categories
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Create and maintain your company expense
                    classification structure.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search categories..."
                      className="h-10 w-full min-w-[240px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void loadData(true)}
                    disabled={refreshing}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="px-6 py-16 text-center">
                <div className="text-sm font-medium text-slate-500">
                  Loading expense categories...
                </div>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500">
                  $
                </div>

                <h3 className="text-base font-bold text-slate-900">
                  {search
                    ? "No categories found"
                    : "No expense categories yet"}
                </h3>

                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  {search
                    ? "Try a different search term."
                    : "Create your first category or add the recommended categories to get started."}
                </p>

                {!search && (
                  <div className="mt-5 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => void seedDefaultCategories()}
                      disabled={saving}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Add Recommended
                    </button>

                    <button
                      type="button"
                      onClick={openCreateForm}
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                      + Add Category
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Category
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Description
                      </th>

                      <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                        Expenses
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Created
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredCategories.map((category) => {
                      const assignedCount =
                        expenseCounts[category.id] ?? 0;

                      return (
                        <tr
                          key={category.id}
                          className="transition hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900">
                              {category.name}
                            </div>
                          </td>

                          <td className="max-w-[500px] px-5 py-4">
                            <div className="truncate text-sm text-slate-500">
                              {category.description ||
                                "No description"}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-flex min-w-[36px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ${
                                assignedCount > 0
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-slate-50 text-slate-400"
                              }`}
                            >
                              {assignedCount}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-500">
                            {new Date(
                              category.created_at
                            ).toLocaleDateString()}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditForm(category)
                                }
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void handleDelete(category)
                                }
                                disabled={assignedCount > 0}
                                title={
                                  assignedCount > 0
                                    ? "This category is being used by expenses."
                                    : "Delete category"
                                }
                                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
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

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
              <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {filteredCategories.length} of{" "}
                  {categories.length} categories
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {editingCategory
                        ? "Edit Category"
                        : "Add Expense Category"}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {editingCategory
                        ? "Update the category information."
                        : "Create a category for organizing company expenses."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    className="text-xl leading-none text-slate-400 transition hover:text-slate-700 disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="space-y-5 px-6 py-6">
                  {errorMessage && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                      {errorMessage}
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Category Name
                    </label>

                    <input
                      type="text"
                      value={categoryName}
                      onChange={(event) =>
                        setCategoryName(event.target.value)
                      }
                      placeholder="e.g. Shipping & Delivery"
                      maxLength={100}
                      autoFocus
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />

                    <div className="mt-1 text-right text-xs text-slate-400">
                      {categoryName.length}/100
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Description
                      <span className="ml-1 font-normal text-slate-400">
                        Optional
                      </span>
                    </label>

                    <textarea
                      value={categoryDescription}
                      onChange={(event) =>
                        setCategoryDescription(
                          event.target.value
                        )
                      }
                      placeholder="Describe what expenses belong in this category..."
                      rows={4}
                      className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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