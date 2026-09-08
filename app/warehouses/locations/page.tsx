"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import { Link } from "lucide-react";

type Warehouse = {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  is_default: boolean;
};

type WarehouseLocation = {
  id: string;
  company_id: string;
  warehouse_id: string;
  parent_location_id: string | null;
  name: string;
  code: string | null;
  location_type: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type LocationForm = {
  warehouse_id: string;
  parent_location_id: string;
  name: string;
  code: string;
  location_type: string;
  notes: string;
  is_active: boolean;
};

const emptyForm = (): LocationForm => ({
  warehouse_id: "",
  parent_location_id: "",
  name: "",
  code: "",
  location_type: "bin",
  notes: "",
  is_active: true,
});

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function Icon({
  name,
  size = 18,
}: {
  name:
    | "location"
    | "plus"
    | "search"
    | "edit"
    | "check"
    | "close"
    | "refresh"
    | "warehouse"
    | "chevron"
    | "trash"
    | "layers";
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
  };

  switch (name) {
    case "location":
      return (
        <svg {...common}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );

    case "warehouse":
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M4 21V9l8-5 8 5v12" />
          <path d="M8 21v-7h8v7" />
          <path d="M8 10h.01M12 10h.01M16 10h.01" />
        </svg>
      );

    case "layers":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 16 9 5 9-5" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
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
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 4 1-4Z" />
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
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.9-4" />
          <path d="M4 4v5h5" />
          <path d="M4 13a8 8 0 0 0 14.9 4" />
          <path d="M20 20v-5h-5" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );

    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M6 7l1 14h10l1-14" />
          <path d="M9 7V4h6v3" />
        </svg>
      );

    default:
      return null;
  }
}

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
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}

export default function WarehouseLocationsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] =
    useState<WarehouseLocation | null>(null);

  const [form, setForm] = useState<LocationForm>(emptyForm());

  const loadData = useCallback(
    async (showRefreshState = false) => {
      if (showRefreshState) {
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

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error("You must be signed in to manage locations.");
        }

        const { data: membership, error: membershipError } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (!membership?.company_id) {
          throw new Error("No company membership was found for this user.");
        }

        setCompanyId(membership.company_id);

        const [warehouseResult, locationResult] = await Promise.all([
          supabase
            .from("warehouses")
            .select(
              "id, company_id, name, code, is_active, is_default"
            )
            .eq("company_id", membership.company_id)
            .order("is_default", { ascending: false })
            .order("name", { ascending: true }),

          supabase
            .from("warehouse_locations")
            .select(
              `
                id,
                company_id,
                warehouse_id,
                parent_location_id,
                name,
                code,
                location_type,
                is_active,
                notes,
                created_at,
                updated_at
              `
            )
            .eq("company_id", membership.company_id)
            .order("name", { ascending: true }),
        ]);

        if (warehouseResult.error) {
          throw warehouseResult.error;
        }

        if (locationResult.error) {
          throw locationResult.error;
        }

        setWarehouses(warehouseResult.data ?? []);
        setLocations(locationResult.data ?? []);
     } catch (error: unknown) {
  setErrorMessage(
    error instanceof Error
      ? error.message
      : "Unable to load warehouse locations."
  );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
  queueMicrotask(() => {
    void loadData();
  });
}, [loadData]);

  const warehouseMap = useMemo(() => {
    const map = new Map<string, Warehouse>();

    for (const warehouse of warehouses) {
      map.set(warehouse.id, warehouse);
    }

    return map;
  }, [warehouses]);

  const locationMap = useMemo(() => {
    const map = new Map<string, WarehouseLocation>();

    for (const location of locations) {
      map.set(location.id, location);
    }

    return map;
  }, [locations]);

  const filteredLocations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return locations.filter((location) => {
      if (!showInactive && !location.is_active) {
        return false;
      }

      if (
        warehouseFilter !== "all" &&
        location.warehouse_id !== warehouseFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const warehouse = warehouseMap.get(location.warehouse_id);

      const searchable = [
        location.name,
        location.code,
        location.location_type,
        location.notes,
        warehouse?.name,
        warehouse?.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    locations,
    search,
    showInactive,
    warehouseFilter,
    warehouseMap,
  ]);

  const stats = useMemo(() => {
    const total = locations.length;
    const active = locations.filter((location) => location.is_active).length;
    const inactive = locations.filter(
      (location) => !location.is_active
    ).length;

    return {
      total,
      active,
      inactive,
    };
  }, [locations]);

  const openCreateModal = () => {
    setEditingLocation(null);

    const defaultWarehouse =
      warehouseFilter !== "all"
        ? warehouseFilter
        : warehouses.find((warehouse) => warehouse.is_default)?.id ??
          warehouses.find((warehouse) => warehouse.is_active)?.id ??
          warehouses[0]?.id ??
          "";

    setForm({
      ...emptyForm(),
      warehouse_id: defaultWarehouse,
    });

    setErrorMessage("");
    setSuccessMessage("");
    setModalOpen(true);
  };

  const openEditModal = (location: WarehouseLocation) => {
    setEditingLocation(location);

    setForm({
      warehouse_id: location.warehouse_id,
      parent_location_id: location.parent_location_id ?? "",
      name: location.name,
      code: location.code ?? "",
      location_type: location.location_type ?? "bin",
      notes: location.notes ?? "",
      is_active: location.is_active,
    });

    setErrorMessage("");
    setSuccessMessage("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingLocation(null);
    setForm(emptyForm());
  };

  const saveLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!companyId) {
      setErrorMessage("Company information is not available.");
      return;
    }

    if (!form.warehouse_id) {
      setErrorMessage("Please select a warehouse.");
      return;
    }

    if (!form.name.trim()) {
      setErrorMessage("Location name is required.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const normalizedName = form.name.trim();
      const normalizedCode = form.code.trim().toUpperCase();
      const normalizedType =
        form.location_type.trim().toLowerCase() || "bin";
      const normalizedNotes = form.notes.trim();

      const parentId =
        form.parent_location_id &&
        form.parent_location_id !== editingLocation?.id
          ? form.parent_location_id
          : null;

      if (parentId) {
        const parentLocation = locationMap.get(parentId);

        if (!parentLocation) {
          throw new Error("Selected parent location could not be found.");
        }

        if (parentLocation.warehouse_id !== form.warehouse_id) {
          throw new Error(
            "The parent location must belong to the selected warehouse."
          );
        }
      }

      const payload = {
        company_id: companyId,
        warehouse_id: form.warehouse_id,
        parent_location_id: parentId,
        name: normalizedName,
        code: normalizedCode || null,
        location_type: normalizedType,
        is_active: form.is_active,
        notes: normalizedNotes || null,
      };

      if (editingLocation) {
        const { error } = await supabase
          .from("warehouse_locations")
          .update(payload)
          .eq("id", editingLocation.id)
          .eq("company_id", companyId);

        if (error) {
          throw error;
        }

        setSuccessMessage("Location updated successfully.");
      } else {
        const { error } = await supabase
          .from("warehouse_locations")
          .insert(payload);

        if (error) {
          throw error;
        }

        setSuccessMessage("Location created successfully.");
      }

      setModalOpen(false);
      setEditingLocation(null);
      setForm(emptyForm());

      await loadData(true);
    } catch (error: unknown) {
  setErrorMessage(
    error instanceof Error
      ? error.message
      : "Unable to save this location."
     );
   } finally {
      setSaving(false);
    }
  };

  const toggleLocationStatus = async (
    location: WarehouseLocation
  ) => {
    if (!companyId) return;

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("warehouse_locations")
        .update({
          is_active: !location.is_active,
        })
        .eq("id", location.id)
        .eq("company_id", companyId);

      if (error) {
        throw error;
      }

      setSuccessMessage(
        location.is_active
          ? `${location.name} was deactivated.`
          : `${location.name} was reactivated.`
      );

      await loadData(true);
    } catch (error: unknown) {
  setErrorMessage(
    error instanceof Error
      ? error.message
      : "Unable to update location status."
  );
}
  };

  const deleteLocation = async (location: WarehouseLocation) => {
    if (!companyId) return;

    const confirmed = window.confirm(
      `Delete "${location.name}"?\n\nThis will only succeed if the location is not being referenced by other records. If it is in use, deactivate it instead.`
    );

    if (!confirmed) return;

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("warehouse_locations")
        .delete()
        .eq("id", location.id)
        .eq("company_id", companyId);

      if (error) {
        throw error;
      }

      setSuccessMessage(`${location.name} was deleted.`);

      await loadData(true);
    } catch (error: unknown) {
  setErrorMessage(
    error instanceof Error
      ? error.message
      : "This location could not be deleted. It may already be referenced by inventory or other records."
  );
}
  };

  const getParentName = (location: WarehouseLocation) => {
    if (!location.parent_location_id) {
      return "Root location";
    }

    return (
      locationMap.get(location.parent_location_id)?.name ??
      "Parent location"
    );
  };

  const activeWarehouses = warehouses.filter(
    (warehouse) => warehouse.is_active
  );

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1500px] px-6 py-8">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-slate-900 p-2.5 text-white">
                <Icon name="location" size={20} />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Locations
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Manage the physical locations, zones, racks, shelves, and
                  bins inside your warehouses.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon name="refresh" size={17} />
                Refresh
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                disabled={activeWarehouses.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="plus" size={17} />
                New Location
              </button>
            </div>
          </div>

          {/* Module Navigation */}
          <div className="mb-6 grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-2">
            <a
              href="/warehouses"
              className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <Icon name="warehouse" size={16} />
              Warehouses
            </a>

            <a
              href="/warehouses/locations"
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              <Icon name="location" size={16} />
              Locations
            </a>

           <Link
  href="/warehouses/transfers"
  className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
>
  <Icon name="layers" size={16} />
  Transfers
</Link>
          </div>

          {/* Messages */}
          {errorMessage && (
            <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div>{errorMessage}</div>

              <button
                type="button"
                onClick={() => setErrorMessage("")}
                className="shrink-0 text-red-500 hover:text-red-700"
              >
                <Icon name="close" size={17} />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <div>{successMessage}</div>

              <button
                type="button"
                onClick={() => setSuccessMessage("")}
                className="shrink-0 text-emerald-500 hover:text-emerald-700"
              >
                <Icon name="close" size={17} />
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Total Locations
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {stats.total}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                  <Icon name="layers" size={20} />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                All warehouse locations
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Active
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {stats.active}
                  </p>
                </div>

                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                  <Icon name="check" size={20} />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Available for operations
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Inactive
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {stats.inactive}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-3 text-slate-500">
                  <Icon name="location" size={20} />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Retained for historical records
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">
                  Warehouse Locations
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {filteredLocations.length} location
                  {filteredLocations.length === 1 ? "" : "s"} shown
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon name="search" size={18} />
                  </div>

                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search locations..."
                    className="w-full min-w-[260px] rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <select
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="all">All Warehouses</option>

                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                      {warehouse.code ? ` (${warehouse.code})` : ""}
                    </option>
                  ))}
                </select>

                <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />

                  Show inactive
                </label>
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />

              <p className="text-sm text-slate-500">
                Loading locations...
              </p>
            </div>
          ) : activeWarehouses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Icon name="warehouse" size={24} />
              </div>

              <h2 className="text-base font-semibold text-slate-950">
                No active warehouses
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Create an active warehouse first before adding physical
                locations.
              </p>
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Icon name="location" size={24} />
              </div>

              <h2 className="text-base font-semibold text-slate-950">
                No locations found
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {search || warehouseFilter !== "all"
                  ? "Try changing your search or warehouse filter."
                  : "Create your first location to start organizing physical warehouse space."}
              </p>

              {!search && warehouseFilter === "all" && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <Icon name="plus" size={17} />
                  New Location
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* Desktop */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Location
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Warehouse
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Parent
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Type
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLocations.map((location) => {
                      const warehouse = warehouseMap.get(
                        location.warehouse_id
                      );

                      return (
                        <tr
                          key={location.id}
                          className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                <Icon name="location" size={19} />
                              </div>

                              <div className="min-w-0">
                                <div className="font-medium text-slate-900">
                                  {location.name}
                                </div>

                                <div className="mt-0.5 text-xs text-slate-500">
                                  {location.code || "No code"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <Icon name="warehouse" size={16} />

                              <span>
                                {warehouse?.name || "Unknown warehouse"}
                              </span>
                            </div>

                            {warehouse?.code && (
                              <div className="mt-0.5 pl-6 text-xs text-slate-400">
                                {warehouse.code}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span className="text-sm text-slate-600">
                              {getParentName(location)}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                              {location.location_type || "bin"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            {location.is_active ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                Inactive
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(location)}
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                                title="Edit"
                              >
                                <Icon name="edit" size={17} />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  toggleLocationStatus(location)
                                }
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                                title={
                                  location.is_active
                                    ? "Deactivate"
                                    : "Reactivate"
                                }
                              >
                                <Icon
                                  name={
                                    location.is_active
                                      ? "close"
                                      : "check"
                                  }
                                  size={17}
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteLocation(location)}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                title="Delete"
                              >
                                <Icon name="trash" size={17} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredLocations.map((location) => {
                  const warehouse = warehouseMap.get(
                    location.warehouse_id
                  );

                  return (
                    <div key={location.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                            <Icon name="location" size={19} />
                          </div>

                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-900">
                              {location.name}
                            </div>

                            <div className="mt-0.5 text-xs text-slate-500">
                              {location.code || "No code"}
                            </div>
                          </div>
                        </div>

                        {location.is_active ? (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                            Inactive
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Warehouse
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {warehouse?.name || "Unknown"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Type
                          </p>

                          <p className="mt-1 text-sm capitalize text-slate-700">
                            {location.location_type || "bin"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Parent
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {getParentName(location)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Created
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {formatDate(location.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(location)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          <Icon name="edit" size={15} />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleLocationStatus(location)
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          <Icon
                            name={
                              location.is_active
                                ? "close"
                                : "check"
                            }
                            size={15}
                          />

                          {location.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteLocation(location)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        >
                          <Icon name="trash" size={15} />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && filteredLocations.length > 0 && (
            <div className="mt-4 text-xs text-slate-400">
              Showing {filteredLocations.length} of {locations.length}{" "}
              locations
            </div>
          )}
        </div>

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    {editingLocation
                      ? "Edit Location"
                      : "New Location"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Define a physical location inside a warehouse.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                >
                  <Icon name="close" size={19} />
                </button>
              </div>

              <form onSubmit={saveLocation}>
                <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Warehouse
                        <span className="ml-1 text-red-500">*</span>
                      </span>

                      <select
                        value={form.warehouse_id}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            warehouse_id: e.target.value,
                            parent_location_id: "",
                          }))
                        }
                        required
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      >
                        <option value="">Select warehouse</option>

                        {activeWarehouses.map((warehouse) => (
                          <option
                            key={warehouse.id}
                            value={warehouse.id}
                          >
                            {warehouse.name}
                            {warehouse.code
                              ? ` (${warehouse.code})`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    <Field
                      label="Location Name"
                      value={form.name}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          name: value,
                        }))
                      }
                      placeholder="e.g. Rack A01"
                      required
                    />

                    <Field
                      label="Location Code"
                      value={form.code}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          code: value,
                        }))
                      }
                      placeholder="e.g. A01-R01"
                    />

                    <Field
                      label="Location Type"
                      value={form.location_type}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          location_type: value,
                        }))
                      }
                      placeholder="e.g. bin"
                    />

                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Parent Location
                      </span>

                      <select
                        value={form.parent_location_id}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            parent_location_id: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      >
                        <option value="">
                          No parent — root location
                        </option>

                        {locations
                          .filter(
                            (location) =>
                              location.warehouse_id ===
                                form.warehouse_id &&
                              location.id !== editingLocation?.id
                          )
                          .sort((a, b) =>
                            a.name.localeCompare(b.name)
                          )
                          .map((location) => (
                            <option
                              key={location.id}
                              value={location.id}
                            >
                              {location.name}
                              {location.code
                                ? ` (${location.code})`
                                : ""}
                              {!location.is_active
                                ? " — inactive"
                                : ""}
                            </option>
                          ))}
                      </select>

                      <p className="mt-1.5 text-xs text-slate-400">
                        Use this to build a location hierarchy such as
                        Zone → Rack → Shelf → Bin.
                      </p>
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Notes
                      </span>

                      <textarea
                        value={form.notes}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            notes: e.target.value,
                          }))
                        }
                        rows={4}
                        placeholder="Optional notes about this location..."
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      />
                    </label>

                    <label className="flex items-center gap-3 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            is_active: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />

                      <span>
                        <span className="block text-sm font-medium text-slate-700">
                          Active location
                        </span>

                        <span className="block text-xs text-slate-400">
                          Active locations can be used for warehouse
                          operations.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    )}

                    {editingLocation
                      ? "Save Changes"
                      : "Create Location"}
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