"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Warehouse = {
  id: string;
  company_id: string;
  name: string;
  code: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  is_default: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type WarehouseForm = {
  name: string;
  code: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  is_active: boolean;
  is_default: boolean;
  notes: string;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function emptyForm(): WarehouseForm {
  return {
    name: "",
    code: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    phone: "",
    email: "",
    is_active: true,
    is_default: false,
    notes: "",
  };
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* -------------------------------------------------------------------------- */
/* Icon                                                                       */
/* -------------------------------------------------------------------------- */

type IconName =
  | "warehouse"
  | "plus"
  | "search"
  | "edit"
  | "check"
  | "close"
  | "refresh"
  | "location"
  | "phone"
  | "mail"
  | "trash";

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "shrink-0",
  };

  switch (name) {
    case "warehouse":
      return (
        <svg {...common}>
          <path d="M3 10 12 4l9 6" />
          <path d="M5 9v10h14V9" />
          <path d="M9 19v-5h6v5" />
          <path d="M8 11h.01M12 11h.01M16 11h.01" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );

    case "edit":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.7-4L4 9" />
          <path d="M4 4v5h5" />
          <path d="M4 13a8 8 0 0 0 14.7 4L20 15" />
          <path d="M20 20v-5h-5" />
        </svg>
      );

    case "location":
      return (
        <svg {...common}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );

    case "phone":
      return (
        <svg {...common}>
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2Z" />
        </svg>
      );

    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );

    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="m6 7 1 14h10l1-14" />
          <path d="M9 7V4h6v3" />
        </svg>
      );

    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Input                                                                      */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required ? (
          <span className="ml-1 text-red-500">*</span>
        ) : null}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-slate-200"
        style={{
          border: "1px solid #e2e8f0",
        }}
      />
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function WarehousesPage() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [companyId, setCompanyId] =
    useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<
    Warehouse[]
  >([]);

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] =
    useState(false);

  const [modalOpen, setModalOpen] =
    useState(false);
  const [editingWarehouse, setEditingWarehouse] =
    useState<Warehouse | null>(null);
  const [form, setForm] =
    useState<WarehouseForm>(emptyForm());

  /* ------------------------------------------------------------------------ */
  /* Load                                                                     */
  /* ------------------------------------------------------------------------ */

  const loadWarehouses = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            "You must be signed in to manage warehouses."
          );
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
            "No company membership was found for this account."
          );
        }

        const currentCompanyId =
          membership.company_id;

        setCompanyId(currentCompanyId);

        const { data, error } = await supabase
          .from("warehouses")
          .select(
            `
              id,
              company_id,
              name,
              code,
              address_line1,
              address_line2,
              city,
              state,
              postal_code,
              country,
              phone,
              email,
              is_active,
              is_default,
              notes,
              created_at,
              updated_at
            `
          )
          .eq(
            "company_id",
            currentCompanyId
          )
          .order("is_default", {
            ascending: false,
          })
          .order("name", {
            ascending: true,
          });

        if (error) {
          throw error;
        }

        setWarehouses(
          (data ?? []) as Warehouse[]
        );
      } catch (error) {
        console.error(
          "Warehouse load error:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load warehouses."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    // Initial warehouse data load.
    // The function performs async Supabase requests and updates local state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWarehouses();
  }, [loadWarehouses]);

  /* ------------------------------------------------------------------------ */
  /* Derived                                                                  */
  /* ------------------------------------------------------------------------ */

  const filteredWarehouses = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return warehouses.filter((warehouse) => {
      const matchesSearch =
        !normalizedSearch ||
        warehouse.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        warehouse.code
          .toLowerCase()
          .includes(normalizedSearch) ||
        warehouse.city
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        warehouse.country
          ?.toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        showInactive || warehouse.is_active;

      return (
        matchesSearch && matchesStatus
      );
    });
  }, [
    warehouses,
    search,
    showInactive,
  ]);

  const activeCount = useMemo(
    () =>
      warehouses.filter(
        (warehouse) => warehouse.is_active
      ).length,
    [warehouses]
  );

  const inactiveCount =
    warehouses.length - activeCount;

  /* ------------------------------------------------------------------------ */
  /* Modal                                                                    */
  /* ------------------------------------------------------------------------ */

  function openCreateModal() {
    setEditingWarehouse(null);
    setForm(emptyForm());
    setErrorMessage("");
    setSuccessMessage("");
    setModalOpen(true);
  }

  function openEditModal(
    warehouse: Warehouse
  ) {
    setEditingWarehouse(warehouse);

    setForm({
      name: warehouse.name,
      code: warehouse.code,
      address_line1:
        warehouse.address_line1 ?? "",
      address_line2:
        warehouse.address_line2 ?? "",
      city: warehouse.city ?? "",
      state: warehouse.state ?? "",
      postal_code:
        warehouse.postal_code ?? "",
      country: warehouse.country ?? "",
      phone: warehouse.phone ?? "",
      email: warehouse.email ?? "",
      is_active: warehouse.is_active,
      is_default: warehouse.is_default,
      notes: warehouse.notes ?? "",
    });

    setErrorMessage("");
    setSuccessMessage("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingWarehouse(null);
    setForm(emptyForm());
  }

  /* ------------------------------------------------------------------------ */
  /* Save                                                                     */
  /* ------------------------------------------------------------------------ */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!companyId) {
      setErrorMessage(
        "Company information is unavailable."
      );
      return;
    }

    if (!form.name.trim()) {
      setErrorMessage(
        "Warehouse name is required."
      );
      return;
    }

    if (!form.code.trim()) {
      setErrorMessage(
        "Warehouse code is required."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const normalizedCode =
        form.code.trim().toUpperCase();

      const payload = {
        company_id: companyId,
        name: form.name.trim(),
        code: normalizedCode,
        address_line1:
          form.address_line1.trim() || null,
        address_line2:
          form.address_line2.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postal_code:
          form.postal_code.trim() || null,
        country:
          form.country.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        is_active: form.is_active,
        is_default: form.is_default,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingWarehouse) {
        const { error } = await supabase
          .from("warehouses")
          .update(payload)
          .eq("id", editingWarehouse.id)
          .eq("company_id", companyId);

        if (error) {
          throw error;
        }

        setSuccessMessage(
          "Warehouse updated successfully."
        );
      } else {
        const { error } = await supabase
          .from("warehouses")
          .insert(payload);

        if (error) {
          throw error;
        }

        setSuccessMessage(
          "Warehouse created successfully."
        );
      }

      setModalOpen(false);
      setEditingWarehouse(null);
      setForm(emptyForm());

      await loadWarehouses(true);
    } catch (error) {
      console.error(
        "Warehouse save error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save warehouse."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Toggle active                                                            */
  /* ------------------------------------------------------------------------ */

  async function toggleWarehouse(
    warehouse: Warehouse
  ) {
    if (!companyId) return;

    const nextActive =
      !warehouse.is_active;

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("warehouses")
        .update({
          is_active: nextActive,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", warehouse.id)
        .eq("company_id", companyId);

      if (error) {
        throw error;
      }

      setWarehouses((current) =>
        current.map((item) =>
          item.id === warehouse.id
            ? {
                ...item,
                is_active: nextActive,
              }
            : item
        )
      );

      setSuccessMessage(
        nextActive
          ? `${warehouse.name} is now active.`
          : `${warehouse.name} has been deactivated.`
      );
    } catch (error) {
      console.error(
        "Warehouse status update error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update warehouse status."
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Delete                                                                    */
  /* ------------------------------------------------------------------------ */

  async function deleteWarehouse(
    warehouse: Warehouse
  ) {
    if (!companyId) return;

    const confirmed = window.confirm(
      `Delete "${warehouse.name}"? This should only be used if the warehouse has no inventory or transaction records.`
    );

    if (!confirmed) return;

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("warehouses")
        .delete()
        .eq("id", warehouse.id)
        .eq("company_id", companyId);

      if (error) {
        throw error;
      }

      setWarehouses((current) =>
        current.filter(
          (item) => item.id !== warehouse.id
        )
      );

      setSuccessMessage(
        "Warehouse deleted successfully."
      );
    } catch (error) {
      console.error(
        "Warehouse delete error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete warehouse. If it contains inventory or transaction history, deactivate it instead."
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Loading                                                                  */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-[1500px] px-6 py-8">
            <div className="animate-pulse">
              <div className="h-8 w-56 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-96 rounded bg-slate-200" />

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {Array.from({
                  length: 3,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="h-28 rounded-xl bg-white"
                    style={{
                      border:
                        "1px solid #e2e8f0",
                    }}
                  />
                ))}
              </div>

              <div
                className="mt-6 h-96 rounded-xl bg-white"
                style={{
                  border:
                    "1px solid #e2e8f0",
                }}
              />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1500px] px-6 py-8">
          {/* Header --------------------------------------------------------- */}

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-900 p-2.5 text-white">
                <Icon
                  name="warehouse"
                  size={22}
                />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Warehouses
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Manage warehouses and the physical
                  locations where your inventory is stored.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  void loadWarehouses(true)
                }
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  border:
                    "1px solid #e2e8f0",
                }}
              >
                <Icon
                  name="refresh"
                  size={16}
                />

                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Icon
                  name="plus"
                  size={16}
                />

                Add Warehouse
              </button>
            </div>
          </div>

          {/* Messages ------------------------------------------------------- */}

          {errorMessage ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          {/* Stats ---------------------------------------------------------- */}

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div
              className="rounded-xl bg-white p-5"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="text-sm font-medium text-slate-500">
                Total Warehouses
              </div>

              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {warehouses.length}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                All warehouse records
              </div>
            </div>

            <div
              className="rounded-xl bg-white p-5"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="text-sm font-medium text-slate-500">
                Active
              </div>

              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {activeCount}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                Available for inventory operations
              </div>
            </div>

            <div
              className="rounded-xl bg-white p-5"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="text-sm font-medium text-slate-500">
                Inactive
              </div>

              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {inactiveCount}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                Retained for historical records
              </div>
            </div>
          </div>

          {/* Toolbar -------------------------------------------------------- */}

          <div
            className="mt-6 rounded-xl bg-white p-5"
            style={{
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Warehouse Directory
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredWarehouses.length}{" "}
                  {filteredWarehouses.length === 1
                    ? "warehouse"
                    : "warehouses"}{" "}
                  shown
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative min-w-[280px]">
                  <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                    <Icon
                      name="search"
                      size={17}
                    />
                  </div>

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search warehouses..."
                    className="w-full rounded-lg bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-200"
                    style={{
                      border:
                        "1px solid #e2e8f0",
                    }}
                  />
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3.5 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(event) =>
                      setShowInactive(
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />

                  Show inactive
                </label>
              </div>
            </div>
          </div>

          {/* Empty ---------------------------------------------------------- */}

          {filteredWarehouses.length === 0 ? (
            <div
              className="mt-6 rounded-xl bg-white p-12 text-center"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Icon
                  name="warehouse"
                  size={25}
                />
              </div>

              <h3 className="mt-4 text-sm font-semibold text-slate-900">
                {warehouses.length === 0
                  ? "No warehouses yet"
                  : "No warehouses found"}
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                {warehouses.length === 0
                  ? "Create your first warehouse to start organizing inventory across physical locations."
                  : "Try changing your search or status filter."}
              </p>

              {warehouses.length === 0 ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <Icon
                    name="plus"
                    size={16}
                  />

                  Add Warehouse
                </button>
              ) : null}
            </div>
          ) : (
            /* Warehouse cards ---------------------------------------------- */
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredWarehouses.map(
                (warehouse) => (
                  <div
                    key={warehouse.id}
                    className="rounded-xl bg-white p-5"
                    style={{
                      border:
                        "1px solid #e2e8f0",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="rounded-lg bg-slate-100 p-2.5 text-slate-600">
                          <Icon
                            name="warehouse"
                            size={19}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold text-slate-950">
                              {warehouse.name}
                            </h3>

                            {warehouse.is_default ? (
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">
                                Default
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                            {warehouse.code}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                          warehouse.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {warehouse.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>

                    {/* Address ------------------------------------------------ */}

                    {(warehouse.address_line1 ||
                      warehouse.city ||
                      warehouse.state ||
                      warehouse.country) && (
                      <div className="mt-5 flex items-start gap-2 text-sm text-slate-500">
                        <Icon
                          name="location"
                          size={16}
                        />

                        <div>
                          {warehouse.address_line1 ? (
                            <div>
                              {
                                warehouse.address_line1
                              }
                            </div>
                          ) : null}

                          {warehouse.address_line2 ? (
                            <div>
                              {
                                warehouse.address_line2
                              }
                            </div>
                          ) : null}

                          <div>
                            {[
                              warehouse.city,
                              warehouse.state,
                              warehouse.postal_code,
                            ]
                              .filter(Boolean)
                              .join(
                                ", "
                              )}
                          </div>

                          {warehouse.country ? (
                            <div>
                              {
                                warehouse.country
                              }
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {/* Contact ------------------------------------------------ */}

                    {(warehouse.phone ||
                      warehouse.email) && (
                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                        {warehouse.phone ? (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Icon
                              name="phone"
                              size={14}
                            />

                            {
                              warehouse.phone
                            }
                          </div>
                        ) : null}

                        {warehouse.email ? (
                          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
                            <Icon
                              name="mail"
                              size={14}
                            />

                            <span className="truncate">
                              {
                                warehouse.email
                              }
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Footer ------------------------------------------------- */}

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                      <div className="text-xs text-slate-400">
                        Created{" "}
                        {formatDate(
                          warehouse.created_at
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openEditModal(
                              warehouse
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          style={{
                            border:
                              "1px solid #e2e8f0",
                          }}
                        >
                          <Icon
                            name="edit"
                            size={14}
                          />

                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void toggleWarehouse(
                              warehouse
                            )
                          }
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                            warehouse.is_active
                              ? "bg-slate-50 text-slate-600 hover:bg-slate-100"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          <Icon
                            name="check"
                            size={14}
                          />

                          {warehouse.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void deleteWarehouse(
                              warehouse
                            )
                          }
                          className="inline-flex items-center justify-center rounded-lg px-2.5 py-2 text-red-500 transition hover:bg-red-50"
                          title="Delete warehouse"
                        >
                          <Icon
                            name="trash"
                            size={14}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* Modal ---------------------------------------------------------- */}

          {modalOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
              <div
                className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="warehouse-modal-title"
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                  <div>
                    <h2
                      id="warehouse-modal-title"
                      className="text-lg font-semibold text-slate-950"
                    >
                      {editingWarehouse
                        ? "Edit Warehouse"
                        : "Add Warehouse"}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Configure the warehouse used for
                      physical inventory operations.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  >
                    <Icon
                      name="close"
                      size={19}
                    />
                  </button>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="max-h-[75vh] overflow-y-auto"
                >
                  <div className="space-y-6 px-6 py-6">
                    {/* Basic ----------------------------------------------- */}

                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Basic Information
                      </h3>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Field
                          label="Warehouse Name"
                          value={form.name}
                          onChange={(value) =>
                            setForm(
                              (current) => ({
                                ...current,
                                name: value,
                              })
                            )
                          }
                          placeholder="Main Warehouse"
                          required
                        />

                        <Field
                          label="Warehouse Code"
                          value={form.code}
                          onChange={(value) =>
                            setForm(
                              (current) => ({
                                ...current,
                                code: value,
                              })
                            )
                          }
                          placeholder="MAIN"
                          required
                        />
                      </div>
                    </div>

                    {/* Address ---------------------------------------------- */}

                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Address
                      </h3>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field
                            label="Address Line 1"
                            value={
                              form.address_line1
                            }
                            onChange={(value) =>
                              setForm(
                                (current) => ({
                                  ...current,
                                  address_line1:
                                    value,
                                })
                              )
                            }
                            placeholder="Street address"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Field
                            label="Address Line 2"
                            value={
                              form.address_line2
                            }
                            onChange={(value) =>
                              setForm(
                                (current) => ({
                                  ...current,
                                  address_line2:
                                    value,
                                })
                              )
                            }
                            placeholder="Suite, building, floor..."
                          />
                        </div>

                        <Field
                          label="City"
                          value={form.city}
                          onChange={(value) =>
                            setForm(
                              (current) => ({
                                ...current,
                                city: value,
                              })
                            )
                          }
                          placeholder="Dubai"
                        />

                        <Field
                          label="State / Province"
                          value={form.state}
                          onChange={(value) =>
                            setForm(
                              (current) => ({
                                ...current,
                                state: value,
                              })
                            )
                          }
                          placeholder="State or province"
                        />

                        <Field
                          label="Postal Code"
                          value={
                            form.postal_code
                          }
                          onChange={(value) =>
                            setForm(
                              (current) => ({
                                ...current,
                                postal_code:
                                  value,
                              })
                            )
                          }
                          placeholder="00000"
                        />

                        <Field
                          label="Country"
                          value={form.country}
                          onChange={(value) =>
                            setForm(
                              (current) => ({
                                ...current,
                                country: value,
                              })
                            )
                          }
                          placeholder="United Arab Emirates"
                        />
                      </div>
                    </div>

                    {/* Contact ---------------------------------------------- */}

                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Contact
                      </h3>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Field
                          label="Phone"
                          value={form.phone}
                          onChange={(value) =>
                            setForm(
                              (current) => ({
                                ...current,
                                phone: value,
                              })
                            )
                          }
                          placeholder="+971..."
                          type="tel"
                        />

                        <Field
                          label="Email"
                          value={form.email}
                          onChange={(value) =>
                            setForm(
                              (current) => ({
                                ...current,
                                email: value,
                              })
                            )
                          }
                          placeholder="warehouse@example.com"
                          type="email"
                        />
                      </div>
                    </div>

                    {/* Settings --------------------------------------------- */}

                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Warehouse Settings
                      </h3>

                      <div className="mt-4 space-y-3">
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4">
                          <input
                            type="checkbox"
                            checked={
                              form.is_active
                            }
                            onChange={(event) =>
                              setForm(
                                (current) => ({
                                  ...current,
                                  is_active:
                                    event.target
                                      .checked,
                                })
                              )
                            }
                            className="mt-0.5 h-4 w-4 rounded border-slate-300"
                          />

                          <span>
                            <span className="block text-sm font-medium text-slate-800">
                              Active warehouse
                            </span>

                            <span className="mt-1 block text-xs leading-5 text-slate-500">
                              Active warehouses can be
                              selected for receiving,
                              stock adjustments, and
                              transfers.
                            </span>
                          </span>
                        </label>

                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4">
                          <input
                            type="checkbox"
                            checked={
                              form.is_default
                            }
                            onChange={(event) =>
                              setForm(
                                (current) => ({
                                  ...current,
                                  is_default:
                                    event.target
                                      .checked,
                                })
                              )
                            }
                            className="mt-0.5 h-4 w-4 rounded border-slate-300"
                          />

                          <span>
                            <span className="block text-sm font-medium text-slate-800">
                              Default warehouse
                            </span>

                            <span className="mt-1 block text-xs leading-5 text-slate-500">
                              Mark this warehouse as the
                              preferred default for
                              inventory workflows.
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Notes ------------------------------------------------ */}

                    <div>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">
                          Notes
                        </span>

                        <textarea
                          value={form.notes}
                          onChange={(event) =>
                            setForm(
                              (current) => ({
                                ...current,
                                notes:
                                  event.target
                                    .value,
                              })
                            )
                          }
                          rows={4}
                          placeholder="Internal notes about this warehouse..."
                          className="w-full resize-none rounded-lg bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-200"
                          style={{
                            border:
                              "1px solid #e2e8f0",
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Modal footer ------------------------------------------ */}

                  <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={saving}
                      className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      style={{
                        border:
                          "1px solid #e2e8f0",
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? (
                        "Saving..."
                      ) : (
                        <>
                          <Icon
                            name="check"
                            size={16}
                          />

                          {editingWarehouse
                            ? "Save Changes"
                            : "Create Warehouse"}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}