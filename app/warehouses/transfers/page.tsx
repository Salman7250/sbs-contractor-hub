"use client";

import {
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

type TransferStatus =
  | "draft"
  | "in_transit"
  | "completed"
  | "cancelled";

type Warehouse = {
  id: string;
  name: string;
  code: string;
};

type Location = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string;
};

type Transfer = {
  id: string;
  company_id: string;
  transfer_number: string;
  source_warehouse_id: string;
  source_location_id: string;
  destination_warehouse_id: string;
  destination_location_id: string;
  status: TransferStatus;
  notes: string | null;
  created_by: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

type IconName =
  | "warehouse"
  | "plus"
  | "search"
  | "refresh"
  | "layers"
  | "location"
  | "arrow"
  | "clock"
  | "check"
  | "close";

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

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.7-4L4 9" />
          <path d="M4 4v5h5" />
          <path d="M4 13a8 8 0 0 0 14.7 4L20 15" />
          <path d="M20 20v-5h-5" />
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

    case "location":
      return (
        <svg {...common}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
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

    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDate(value: string | null) {
  if (!value) return "—";

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

function statusLabel(status: TransferStatus) {
  switch (status) {
    case "draft":
      return "Draft";

    case "in_transit":
      return "In Transit";

    case "completed":
      return "Completed";

    case "cancelled":
      return "Cancelled";

    default:
      return status;
  }
}

function statusClasses(status: TransferStatus) {
  switch (status) {
    case "draft":
      return "bg-slate-100 text-slate-700";

    case "in_transit":
      return "bg-amber-100 text-amber-700";

    case "completed":
      return "bg-emerald-100 text-emerald-700";

    case "cancelled":
      return "bg-red-100 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function TransfersPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | TransferStatus>("all");

  /* ------------------------------------------------------------------------ */
  /* Load                                                                     */
  /* ------------------------------------------------------------------------ */

  const loadTransfers = useCallback(
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
            "You must be signed in to manage stock transfers."
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

        const companyId = membership.company_id;

        const [
          transfersResult,
          warehousesResult,
          locationsResult,
        ] = await Promise.all([
          supabase
            .from("stock_transfers")
            .select(
              `
                id,
                company_id,
                transfer_number,
                source_warehouse_id,
                source_location_id,
                destination_warehouse_id,
                destination_location_id,
                status,
                notes,
                created_by,
                completed_by,
                created_at,
                updated_at,
                completed_at
              `
            )
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("warehouses")
            .select(
              "id, name, code"
            )
            .eq("company_id", companyId)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("warehouse_locations")
            .select(
              "id, warehouse_id, name, code"
            )
            .eq("company_id", companyId)
            .order("name", {
              ascending: true,
            }),
        ]);

        if (transfersResult.error) {
          throw transfersResult.error;
        }

        if (warehousesResult.error) {
          throw warehousesResult.error;
        }

        if (locationsResult.error) {
          throw locationsResult.error;
        }

        setTransfers(
          (transfersResult.data ?? []) as Transfer[]
        );

        setWarehouses(
          (warehousesResult.data ?? []) as Warehouse[]
        );

        setLocations(
          (locationsResult.data ?? []) as Location[]
        );
      } catch (error) {
        console.error(
          "Transfer load error:",
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : "Unable to load transfers.";

        setErrorMessage(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    // Initial transfer data load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTransfers();
  }, [loadTransfers]);

  /* ------------------------------------------------------------------------ */
  /* Lookup maps                                                              */
  /* ------------------------------------------------------------------------ */

  const warehouseMap = useMemo(() => {
    return new Map(
      warehouses.map((warehouse) => [
        warehouse.id,
        warehouse,
      ])
    );
  }, [warehouses]);

  const locationMap = useMemo(() => {
    return new Map(
      locations.map((location) => [
        location.id,
        location,
      ])
    );
  }, [locations]);

  /* ------------------------------------------------------------------------ */
  /* Derived                                                                  */
  /* ------------------------------------------------------------------------ */

  const filteredTransfers = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return transfers.filter((transfer) => {
      const sourceWarehouse =
        warehouseMap.get(
          transfer.source_warehouse_id
        );

      const destinationWarehouse =
        warehouseMap.get(
          transfer.destination_warehouse_id
        );

      const sourceLocation =
        locationMap.get(
          transfer.source_location_id
        );

      const destinationLocation =
        locationMap.get(
          transfer.destination_location_id
        );

      const searchableText = [
        transfer.transfer_number,
        sourceWarehouse?.name,
        sourceWarehouse?.code,
        destinationWarehouse?.name,
        destinationWarehouse?.code,
        sourceLocation?.name,
        sourceLocation?.code,
        destinationLocation?.name,
        destinationLocation?.code,
        transfer.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        searchableText.includes(
          normalizedSearch
        );

      const matchesStatus =
        statusFilter === "all" ||
        transfer.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    transfers,
    search,
    statusFilter,
    warehouseMap,
    locationMap,
  ]);

  const draftCount = transfers.filter(
    (transfer) =>
      transfer.status === "draft"
  ).length;

  const inTransitCount = transfers.filter(
    (transfer) =>
      transfer.status === "in_transit"
  ).length;

  const completedCount = transfers.filter(
    (transfer) =>
      transfer.status === "completed"
  ).length;

  const cancelledCount = transfers.filter(
    (transfer) =>
      transfer.status === "cancelled"
  ).length;

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

              <div className="mt-6 h-20 rounded-xl bg-white" />

              <div className="mt-8 grid gap-4 md:grid-cols-4">
                {Array.from({
                  length: 4,
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
                  name="layers"
                  size={22}
                />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Transfers
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Move inventory between warehouses
                  and physical locations.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  void loadTransfers(true)
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

              <a
                href="/warehouses/transfers/new"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Icon
                  name="plus"
                  size={16}
                />

                New Transfer
              </a>
            </div>
          </div>

          {/* Module Navigation --------------------------------------------- */}

          <div
            className="mt-6 rounded-xl bg-white p-2"
            style={{
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">

              <a
                href="/warehouses"
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-slate-700 transition hover:bg-slate-50"
              >
                <Icon
                  name="warehouse"
                  size={18}
                />

                <div>
                  <div className="text-sm font-medium">
                    Warehouses
                  </div>

                  <div className="mt-0.5 text-xs text-slate-400">
                    Manage warehouses
                  </div>
                </div>
              </a>

              <a
                href="/warehouses/locations"
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-slate-700 transition hover:bg-slate-50"
              >
                <Icon
                  name="location"
                  size={18}
                />

                <div>
                  <div className="text-sm font-medium">
                    Locations
                  </div>

                  <div className="mt-0.5 text-xs text-slate-400">
                    Zones, racks & bins
                  </div>
                </div>
              </a>

              <a
                href="/warehouses/transfers"
                className="flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-white"
              >
                <Icon
                  name="layers"
                  size={18}
                />

                <div>
                  <div className="text-sm font-medium">
                    Transfers
                  </div>

                  <div className="mt-0.5 text-xs text-slate-300">
                    Move stock between locations
                  </div>
                </div>
              </a>

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

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

            <button
              type="button"
              onClick={() =>
                setStatusFilter(
                  statusFilter === "draft"
                    ? "all"
                    : "draft"
                )
              }
              className="rounded-xl bg-white p-5 text-left transition hover:border-slate-300"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-500">
                  Draft
                </div>

                <Icon
                  name="clock"
                  size={18}
                />
              </div>

              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {draftCount}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                Not yet dispatched
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setStatusFilter(
                  statusFilter === "in_transit"
                    ? "all"
                    : "in_transit"
                )
              }
              className="rounded-xl bg-white p-5 text-left transition hover:border-slate-300"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-500">
                  In Transit
                </div>

                <Icon
                  name="arrow"
                  size={18}
                />
              </div>

              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {inTransitCount}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                Dispatched and awaiting receipt
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setStatusFilter(
                  statusFilter === "completed"
                    ? "all"
                    : "completed"
                )
              }
              className="rounded-xl bg-white p-5 text-left transition hover:border-slate-300"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-500">
                  Completed
                </div>

                <Icon
                  name="check"
                  size={18}
                />
              </div>

              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {completedCount}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                Successfully received
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setStatusFilter(
                  statusFilter === "cancelled"
                    ? "all"
                    : "cancelled"
                )
              }
              className="rounded-xl bg-white p-5 text-left transition hover:border-slate-300"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-500">
                  Cancelled
                </div>

                <Icon
                  name="close"
                  size={18}
                />
              </div>

              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {cancelledCount}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                Cancelled transfers
              </div>
            </button>

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
                  Transfer History
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredTransfers.length}{" "}
                  {filteredTransfers.length === 1
                    ? "transfer"
                    : "transfers"}{" "}
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
                    placeholder="Search transfers..."
                    className="w-full rounded-lg bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-200"
                    style={{
                      border:
                        "1px solid #e2e8f0",
                    }}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target
                        .value as
                        | "all"
                        | TransferStatus
                    )
                  }
                  className="rounded-lg bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                  style={{
                    border:
                      "1px solid #e2e8f0",
                  }}
                >
                  <option value="all">
                    All statuses
                  </option>

                  <option value="draft">
                    Draft
                  </option>

                  <option value="in_transit">
                    In Transit
                  </option>

                  <option value="completed">
                    Completed
                  </option>

                  <option value="cancelled">
                    Cancelled
                  </option>
                </select>

              </div>
            </div>
          </div>

          {/* Empty ---------------------------------------------------------- */}

          {filteredTransfers.length === 0 ? (
            <div
              className="mt-6 rounded-xl bg-white p-12 text-center"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Icon
                  name="layers"
                  size={25}
                />
              </div>

              <h3 className="mt-4 text-sm font-semibold text-slate-900">
                {transfers.length === 0
                  ? "No transfers yet"
                  : "No transfers found"}
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                {transfers.length === 0
                  ? "Create your first stock transfer to move inventory between warehouse locations."
                  : "Try changing your search or status filter."}
              </p>

              {transfers.length === 0 ? (
                <a
                  href="/warehouses/transfers/new"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <Icon
                    name="plus"
                    size={16}
                  />

                  New Transfer
                </a>
              ) : null}
            </div>
          ) : (
            <div
              className="mt-6 overflow-hidden rounded-xl bg-white"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full">

                  <thead>
                    <tr
                      className="bg-slate-50"
                      style={{
                        borderBottom:
                          "1px solid #e2e8f0",
                      }}
                    >
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Transfer
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        From
                      </th>

                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                        &nbsp;
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        To
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Created
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredTransfers.map(
                      (transfer) => {
                        const sourceWarehouse =
                          warehouseMap.get(
                            transfer.source_warehouse_id
                          );

                        const destinationWarehouse =
                          warehouseMap.get(
                            transfer.destination_warehouse_id
                          );

                        const sourceLocation =
                          locationMap.get(
                            transfer.source_location_id
                          );

                        const destinationLocation =
                          locationMap.get(
                            transfer.destination_location_id
                          );

                        return (
                          <tr
                            key={transfer.id}
                            className="transition hover:bg-slate-50"
                            style={{
                              borderBottom:
                                "1px solid #f1f5f9",
                            }}
                          >
                            <td className="px-5 py-4">
                              <a
                                href={`/warehouses/transfers/${transfer.id}`}
                                className="font-semibold text-slate-950 hover:underline"
                              >
                                {
                                  transfer.transfer_number
                                }
                              </a>

                              <div className="mt-1 text-xs text-slate-400">
                                {formatDate(
                                  transfer.created_at
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-medium text-slate-800">
                                {sourceWarehouse?.name ??
                                  "Unknown warehouse"}
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                {sourceLocation
                                  ? `${sourceLocation.name} (${sourceLocation.code})`
                                  : "Unknown location"}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-center text-slate-400">
                              <Icon
                                name="arrow"
                                size={17}
                              />
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-medium text-slate-800">
                                {destinationWarehouse?.name ??
                                  "Unknown warehouse"}
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                {destinationLocation
                                  ? `${destinationLocation.name} (${destinationLocation.code})`
                                  : "Unknown location"}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(
                                  transfer.status
                                )}`}
                              >
                                {statusLabel(
                                  transfer.status
                                )}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-500">
                              {formatDate(
                                transfer.created_at
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>

                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </AppShell>
  );
}