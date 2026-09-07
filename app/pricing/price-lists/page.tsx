"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Check,
  ChevronRight,
  CircleDollarSign,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type PriceList = {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  description: string | null;
  currency: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PriceListItem = {
  id: string;
  price_list_id: string;
  variant_id: string;
};

type ModalMode = "create" | "edit" | null;

const currencies = [
  "USD",
  "EUR",
  "GBP",
  "AED",
  "CAD",
  "AUD",
  "SAR",
  "QAR",
  "KWD",
  "BHD",
  "OMR",
];

function formatDate(value: string) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getSupabaseErrorMessage(
  error: unknown,
  fallback: string
) {
  const supabaseError = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };

  if (supabaseError?.code === "23505") {
    return "A price list with this code already exists for your company. Please choose a different code.";
  }

  return (
    supabaseError?.message ||
    supabaseError?.details ||
    fallback
  );
}

export default function PriceListsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");

  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedPriceList, setSelectedPriceList] =
    useState<PriceList | null>(null);

  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formDefault, setFormDefault] = useState(false);
  const [formActive, setFormActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(
    null
  );

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadPriceLists = useCallback(
    async (showRefresh = false) => {
      try {
        setErrorMessage("");

        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error("You are not signed in.");
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
            "No company membership was found for your account."
          );
        }

        const currentCompanyId = membership.company_id;

        setCompanyId(currentCompanyId);

        const [companyResult, priceListsResult] = await Promise.all([
          supabase
            .from("companies")
            .select("name")
            .eq("id", currentCompanyId)
            .maybeSingle(),

          supabase
            .from("price_lists")
            .select(
              `
                id,
                company_id,
                name,
                code,
                description,
                currency,
                is_default,
                is_active,
                created_at,
                updated_at
              `
            )
            .eq("company_id", currentCompanyId)
            .order("is_default", {
              ascending: false,
            })
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (companyResult.error) {
          throw companyResult.error;
        }

        if (priceListsResult.error) {
          throw priceListsResult.error;
        }

        const lists = (priceListsResult.data ?? []) as PriceList[];

        setCompanyName(companyResult.data?.name ?? "");
        setPriceLists(lists);

        if (lists.length > 0) {
          const priceListIds = lists.map((list) => list.id);

          const {
            data: items,
            error: itemsError,
          } = await supabase
            .from("price_list_items")
            .select("id, price_list_id, variant_id")
            .eq("company_id", currentCompanyId)
            .in("price_list_id", priceListIds);

          if (itemsError) {
            throw itemsError;
          }

          const counts: Record<string, number> = {};

          for (const item of (items ?? []) as PriceListItem[]) {
            counts[item.price_list_id] =
              (counts[item.price_list_id] ?? 0) + 1;
          }

          setItemCounts(counts);
        } else {
          setItemCounts({});
        }
      } catch (error) {
        console.error("Price lists load error:", error);

        setErrorMessage(
          getSupabaseErrorMessage(
            error,
            "Unable to load price lists."
          )
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void loadPriceLists();
  }, [loadPriceLists]);

  const filteredPriceLists = useMemo(() => {
    const query = search.trim().toLowerCase();

    return priceLists.filter((priceList) => {
      if (!showInactive && !priceList.is_active) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        priceList.name.toLowerCase().includes(query) ||
        (priceList.code ?? "").toLowerCase().includes(query) ||
        (priceList.description ?? "").toLowerCase().includes(query) ||
        priceList.currency.toLowerCase().includes(query)
      );
    });
  }, [priceLists, search, showInactive]);

  const stats = useMemo(() => {
    const active = priceLists.filter(
      (priceList) => priceList.is_active
    );

    const inactive = priceLists.filter(
      (priceList) => !priceList.is_active
    );

    const defaultList = priceLists.find(
      (priceList) => priceList.is_default
    );

    return {
      total: priceLists.length,
      active: active.length,
      inactive: inactive.length,
      defaultName: defaultList?.name ?? "Not set",
    };
  }, [priceLists]);

  function resetForm() {
    setFormName("");
    setFormCode("");
    setFormDescription("");
    setFormCurrency("USD");
    setFormDefault(false);
    setFormActive(true);
    setSelectedPriceList(null);
  }

  function openCreateModal() {
    resetForm();
    setModalMode("create");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function openEditModal(priceList: PriceList) {
    setSelectedPriceList(priceList);

    setFormName(priceList.name);
    setFormCode(priceList.code ?? "");
    setFormDescription(priceList.description ?? "");
    setFormCurrency(priceList.currency);
    setFormDefault(priceList.is_default);
    setFormActive(priceList.is_active);

    setModalMode("edit");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeModal() {
    if (saving) return;

    setModalMode(null);
    resetForm();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!companyId) {
      setErrorMessage("Company could not be identified.");
      return;
    }

    const name = formName.trim();
    const code = formCode.trim().toUpperCase();
    const description = formDescription.trim();

    if (!name) {
      setErrorMessage("Price list name is required.");
      return;
    }

    if (code.length > 50) {
      setErrorMessage(
        "Price list code cannot exceed 50 characters."
      );
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (modalMode === "create") {
        if (code) {
          const {
            data: existingCode,
            error: codeCheckError,
          } = await supabase
            .from("price_lists")
            .select("id, name")
            .eq("company_id", companyId)
            .eq("code", code)
            .maybeSingle();

          if (codeCheckError) {
            throw codeCheckError;
          }

          if (existingCode) {
            throw new Error(
              `The price list code "${code}" is already being used by "${existingCode.name}". Please choose a different code.`
            );
          }
        }

        const {
          data: created,
          error,
        } = await supabase
          .from("price_lists")
          .insert({
            company_id: companyId,
            name,
            code: code || null,
            description: description || null,
            currency: formCurrency,
            is_default: false,
            is_active: formActive,
          })
          .select(
            `
              id,
              company_id,
              name,
              code,
              description,
              currency,
              is_default,
              is_active,
              created_at,
              updated_at
            `
          )
          .single();

        if (error) {
          if (error.code === "23505") {
            throw new Error(
              `The price list code "${code}" is already being used. Please choose a different code.`
            );
          }

          throw error;
        }

        if (formDefault && created) {
          const {
            error: clearDefaultError,
          } = await supabase
            .from("price_lists")
            .update({
              is_default: false,
              updated_at: new Date().toISOString(),
            })
            .eq("company_id", companyId)
            .neq("id", created.id);

          if (clearDefaultError) {
            throw clearDefaultError;
          }

          const {
            error: restoreDefaultError,
          } = await supabase
            .from("price_lists")
            .update({
              is_default: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", created.id)
            .eq("company_id", companyId);

          if (restoreDefaultError) {
            throw restoreDefaultError;
          }
        }

        setSuccessMessage(
          `"${name}" price list was created successfully.`
        );
      }

      if (modalMode === "edit" && selectedPriceList) {
        if (code) {
          const {
            data: existingCode,
            error: codeCheckError,
          } = await supabase
            .from("price_lists")
            .select("id, name")
            .eq("company_id", companyId)
            .eq("code", code)
            .neq("id", selectedPriceList.id)
            .maybeSingle();

          if (codeCheckError) {
            throw codeCheckError;
          }

          if (existingCode) {
            throw new Error(
              `The price list code "${code}" is already being used by "${existingCode.name}". Please choose a different code.`
            );
          }
        }

        const { error } = await supabase
          .from("price_lists")
          .update({
            name,
            code: code || null,
            description: description || null,
            currency: formCurrency,
            is_default: false,
            is_active: formActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedPriceList.id)
          .eq("company_id", companyId);

        if (error) {
          if (error.code === "23505") {
            throw new Error(
              `The price list code "${code}" is already being used. Please choose a different code.`
            );
          }

          throw error;
        }

        if (formDefault) {
          const {
            error: clearDefaultError,
          } = await supabase
            .from("price_lists")
            .update({
              is_default: false,
              updated_at: new Date().toISOString(),
            })
            .eq("company_id", companyId)
            .neq("id", selectedPriceList.id);

          if (clearDefaultError) {
            throw clearDefaultError;
          }

          const {
            error: restoreDefaultError,
          } = await supabase
            .from("price_lists")
            .update({
              is_default: true,
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", selectedPriceList.id)
            .eq("company_id", companyId);

          if (restoreDefaultError) {
            throw restoreDefaultError;
          }
        }

        setSuccessMessage(
          `"${name}" price list was updated successfully.`
        );
      }

      setModalMode(null);
      resetForm();

      await loadPriceLists(true);
    } catch (error) {
      console.error("Price list save error:", error);

      setErrorMessage(
        getSupabaseErrorMessage(
          error,
          "Unable to save price list."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(priceList: PriceList) {
    if (!companyId) return;

    try {
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("price_lists")
        .update({
          is_active: !priceList.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", priceList.id)
        .eq("company_id", companyId);

      if (error) {
        throw error;
      }

      setSuccessMessage(
        `"${priceList.name}" is now ${
          !priceList.is_active ? "active" : "inactive"
        }.`
      );

      await loadPriceLists(true);
    } catch (error) {
      console.error("Price list status error:", error);

      setErrorMessage(
        getSupabaseErrorMessage(
          error,
          "Unable to update price list status."
        )
      );
    }
  }

  async function makeDefault(priceList: PriceList) {
    if (!companyId) return;

    if (priceList.is_default) {
      return;
    }

    try {
      setSettingDefaultId(priceList.id);
      setErrorMessage("");
      setSuccessMessage("");

      const { error: clearError } = await supabase
        .from("price_lists")
        .update({
          is_default: false,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", companyId);

      if (clearError) {
        throw clearError;
      }

      const { error: setError } = await supabase
        .from("price_lists")
        .update({
          is_default: true,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", priceList.id)
        .eq("company_id", companyId);

      if (setError) {
        throw setError;
      }

      setSuccessMessage(
        `"${priceList.name}" is now the default price list.`
      );

      await loadPriceLists(true);
    } catch (error) {
      console.error("Default price list error:", error);

      setErrorMessage(
        getSupabaseErrorMessage(
          error,
          "Unable to change default price list."
        )
      );
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function deletePriceList(priceList: PriceList) {
    if (!companyId) return;

    if (priceList.is_default) {
      setErrorMessage(
        "The default price list cannot be deleted. Set another price list as default first."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${priceList.name}"?\n\nThis will also remove all pricing entries belonging to this price list.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(priceList.id);
      setErrorMessage("");
      setSuccessMessage("");

      const { error: itemsError } = await supabase
        .from("price_list_items")
        .delete()
        .eq("price_list_id", priceList.id)
        .eq("company_id", companyId);

      if (itemsError) {
        throw itemsError;
      }

      const { error } = await supabase
        .from("price_lists")
        .delete()
        .eq("id", priceList.id)
        .eq("company_id", companyId);

      if (error) {
        throw error;
      }

      setSuccessMessage(
        `"${priceList.name}" was deleted successfully.`
      );

      await loadPriceLists(true);
    } catch (error) {
      console.error("Price list delete error:", error);

      setErrorMessage(
        getSupabaseErrorMessage(
          error,
          "Unable to delete price list."
        )
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell>
      <div className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <Link
                  href="/pricing/products"
                  className="hover:text-slate-900"
                >
                  Pricing
                </Link>

                <ChevronRight className="h-4 w-4" />

                <span>Price Lists</span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Price Lists
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Create and manage retail, wholesale, B2B, and
                custom pricing structures.
              </p>

              {companyName && (
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {companyName}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadPriceLists(true)}
                disabled={refreshing}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                New Price List
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                  <CircleDollarSign className="h-5 w-5" />
                </div>

                <span className="text-xs text-slate-400">
                  Total
                </span>
              </div>

              <p className="text-2xl font-bold text-slate-950">
                {stats.total}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Price lists
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                  <Check className="h-5 w-5" />
                </div>

                <span className="text-xs text-slate-400">
                  Available
                </span>
              </div>

              <p className="text-2xl font-bold text-slate-950">
                {stats.active}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Active lists
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                  <Archive className="h-5 w-5" />
                </div>

                <span className="text-xs text-slate-400">
                  Archived
                </span>
              </div>

              <p className="text-2xl font-bold text-slate-950">
                {stats.inactive}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Inactive lists
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                  <Star className="h-5 w-5" />
                </div>

                <span className="text-xs text-slate-400">
                  Default
                </span>
              </div>

              <p className="truncate text-lg font-bold text-slate-950">
                {stats.defaultName}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Company default
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="font-semibold text-slate-950">
                    Pricing Structures
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Each price list can contain different prices
                    for the same products.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="text"
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search price lists..."
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={showInactive}
                      onChange={(event) =>
                        setShowInactive(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />

                    Show inactive
                  </label>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading price lists...
                </div>
              </div>
            ) : filteredPriceLists.length === 0 ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-500">
                  <CircleDollarSign className="h-7 w-7" />
                </div>

                <h3 className="font-semibold text-slate-950">
                  No price lists found
                </h3>

                <p className="mt-1 max-w-md text-sm text-slate-500">
                  {search
                    ? "Try a different search term."
                    : "Create your first price list to start managing different pricing structures."}
                </p>

                {!search && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Create Price List
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Price List
                        </th>

                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Currency
                        </th>

                        <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Products
                        </th>

                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Status
                        </th>

                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Created
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredPriceLists.map((priceList) => {
                        const isDeleting =
                          deletingId === priceList.id;

                        const isSettingDefault =
                          settingDefaultId === priceList.id;

                        return (
                          <tr
                            key={priceList.id}
                            className="transition hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-4">
                              <Link
                                href={`/pricing/price-lists/${priceList.id}`}
                                className="group block"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600 transition group-hover:bg-blue-50 group-hover:text-blue-600">
                                    <CircleDollarSign className="h-5 w-5" />
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-950 group-hover:text-blue-600">
                                        {priceList.name}
                                      </span>

                                      {priceList.is_default && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                                          <Star className="h-3 w-3" />
                                          Default
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-1 flex items-center gap-2">
                                      {priceList.code && (
                                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                                          {priceList.code}
                                        </span>
                                      )}

                                      {priceList.description && (
                                        <span className="max-w-[360px] truncate text-xs text-slate-400">
                                          {priceList.description}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            </td>

                            <td className="px-5 py-4">
                              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                {priceList.currency}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-center">
                              <span className="text-sm font-semibold text-slate-700">
                                {itemCounts[priceList.id] ?? 0}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              {priceList.is_active ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                  Inactive
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-500">
                              {formatDate(priceList.created_at)}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center justify-end gap-1">
                                <Link
                                  href={`/pricing/price-lists/${priceList.id}`}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  Manage
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </Link>

                                {!priceList.is_default && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void makeDefault(priceList)
                                    }
                                    disabled={
                                      isSettingDefault ||
                                      isDeleting
                                    }
                                    title="Make default"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                                  >
                                    {isSettingDefault ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Star className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditModal(priceList)
                                  }
                                  disabled={isDeleting}
                                  title="Edit"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void toggleActive(priceList)
                                  }
                                  disabled={isDeleting}
                                  title={
                                    priceList.is_active
                                      ? "Deactivate"
                                      : "Activate"
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {priceList.is_active ? (
                                    <Archive className="h-3.5 w-3.5" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                </button>

                                {!priceList.is_default && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void deletePriceList(priceList)
                                    }
                                    disabled={isDeleting}
                                    title="Delete"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-slate-100 lg:hidden">
                  {filteredPriceLists.map((priceList) => {
                    const isDeleting =
                      deletingId === priceList.id;

                    const isSettingDefault =
                      settingDefaultId === priceList.id;

                    return (
                      <div
                        key={priceList.id}
                        className="p-4 sm:p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <Link
                            href={`/pricing/price-lists/${priceList.id}`}
                            className="min-w-0"
                          >
                            <div className="flex items-center gap-3">
                              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                                <CircleDollarSign className="h-5 w-5" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-semibold text-slate-950">
                                    {priceList.name}
                                  </h3>

                                  {priceList.is_default && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                                      <Star className="h-3 w-3" />
                                      Default
                                    </span>
                                  )}
                                </div>

                                {priceList.code && (
                                  <p className="mt-1 font-mono text-[11px] text-slate-400">
                                    {priceList.code}
                                  </p>
                                )}
                              </div>
                            </div>
                          </Link>

                          {priceList.is_active ? (
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                              Inactive
                            </span>
                          )}
                        </div>

                        {priceList.description && (
                          <p className="mt-4 text-sm text-slate-500">
                            {priceList.description}
                          </p>
                        )}

                        <div className="mt-4 grid grid-cols-3 gap-3">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Currency
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {priceList.currency}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Products
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {itemCounts[priceList.id] ?? 0}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Created
                            </p>

                            <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                              {formatDate(priceList.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={`/pricing/price-lists/${priceList.id}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Manage
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>

                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(priceList)
                            }
                            disabled={isDeleting}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </button>

                          {!priceList.is_default && (
                            <button
                              type="button"
                              onClick={() =>
                                void makeDefault(priceList)
                              }
                              disabled={
                                isSettingDefault ||
                                isDeleting
                              }
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                            >
                              {isSettingDefault ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Star className="h-3.5 w-3.5" />
                              )}
                              Default
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              void toggleActive(priceList)
                            }
                            disabled={isDeleting}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {priceList.is_active ? (
                              <Archive className="h-3.5 w-3.5" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}

                            {priceList.is_active
                              ? "Deactivate"
                              : "Activate"}
                          </button>

                          {!priceList.is_default && (
                            <button
                              type="button"
                              onClick={() =>
                                void deletePriceList(priceList)
                              }
                              disabled={isDeleting}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
                  <p className="text-xs text-slate-500">
                    Showing{" "}
                    <span className="font-semibold text-slate-700">
                      {filteredPriceLists.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-700">
                      {priceLists.length}
                    </span>{" "}
                    price lists
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {modalMode === "create"
                    ? "Create Price List"
                    : "Edit Price List"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Configure the basic settings for this price list.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-5 px-5 py-5">
                {errorMessage && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    {errorMessage}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Price List Name
                    <span className="ml-1 text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    value={formName}
                    onChange={(event) =>
                      setFormName(event.target.value)
                    }
                    placeholder="e.g. Wholesale"
                    autoFocus
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Code
                  </label>

                  <input
                    type="text"
                    value={formCode}
                    onChange={(event) =>
                      setFormCode(event.target.value.toUpperCase())
                    }
                    placeholder="e.g. WHOLESALE"
                    maxLength={50}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />

                  <p className="mt-1 text-xs text-slate-400">
                    Optional internal code used to identify the
                    price list. Codes must be unique within your
                    company.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Description
                  </label>

                  <textarea
                    value={formDescription}
                    onChange={(event) =>
                      setFormDescription(event.target.value)
                    }
                    placeholder="Describe who this price list is for..."
                    rows={3}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Currency
                  </label>

                  <select
                    value={formCurrency}
                    onChange={(event) =>
                      setFormCurrency(event.target.value)
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    {currencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={formDefault}
                      onChange={(event) =>
                        setFormDefault(event.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />

                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        Make this the default price list
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        The default list will be used when no
                        specific price list is selected.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(event) =>
                        setFormActive(event.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />

                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        Active price list
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Inactive lists remain available for
                        historical records but should not be used
                        for new pricing.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}

                  {modalMode === "create"
                    ? "Create Price List"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}