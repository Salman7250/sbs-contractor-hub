"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Send,
  Truck,
  XCircle,
} from "lucide-react";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

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

type Product = {
  id: string;
  name: string;
  tracking_mode: string | null;
};

type Variant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
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

type TransferItem = {
  id: string;
  company_id: string;
  transfer_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  notes: string | null;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getStatusLabel(status: TransferStatus) {
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

function getStatusClasses(status: TransferStatus) {
  switch (status) {
    case "draft":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "in_transit":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function StatusIcon({
  status,
}: {
  status: TransferStatus | null;
}) {
  switch (status) {
    case "draft":
      return <Clock3 className="h-3.5 w-3.5" />;

    case "in_transit":
      return <Truck className="h-3.5 w-3.5" />;

    case "completed":
      return (
        <CheckCircle2 className="h-3.5 w-3.5" />
      );

    case "cancelled":
      return <XCircle className="h-3.5 w-3.5" />;

    default:
      return <Clock3 className="h-3.5 w-3.5" />;
  }
}

function getTrackingLabel(trackingMode: string | null) {
  switch (trackingMode) {
    case "quantity":
      return "Quantity tracked";
    case "batch":
      return "Batch tracked";
    case "serial":
      return "Serial tracked";
    case "none":
      return "Not tracked";
    default:
      return "Tracking unavailable";
  }
}

export default function TransferDetailsPage() {
  const params = useParams();

  const transferId = useMemo(() => {
    const value = params?.transferId;

    if (Array.isArray(value)) {
      return value[0] ?? "";
    }

    return value ?? "";
  }, [params]);

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<
    "dispatch" | "receive" | "cancel" | null
  >(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [items, setItems] = useState<TransferItem[]>([]);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  const loadData = useCallback(
    async (showRefreshState = false) => {
      if (!transferId) {
        setErrorMessage("Transfer ID is missing.");
        setLoading(false);
        return;
      }

      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");
      setSuccessMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error("You must be signed in.");
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
            "No company membership was found for your account."
          );
        }

        const currentCompanyId = membership.company_id;

        setCompanyId(currentCompanyId);

        const [
          transferResult,
          itemsResult,
          warehousesResult,
          locationsResult,
          productsResult,
          variantsResult,
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
            .eq("id", transferId)
            .eq("company_id", currentCompanyId)
            .maybeSingle(),

          supabase
            .from("stock_transfer_items")
            .select(
              `
                id,
                company_id,
                transfer_id,
                product_id,
                variant_id,
                quantity,
                notes,
                created_at
              `
            )
            .eq("transfer_id", transferId)
            .eq("company_id", currentCompanyId)
            .order("created_at", {
              ascending: true,
            }),

          supabase
            .from("warehouses")
            .select("id,name,code")
            .eq("company_id", currentCompanyId)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("warehouse_locations")
            .select("id,warehouse_id,name,code")
            .eq("company_id", currentCompanyId)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("products")
            .select("id,name,tracking_mode")
            .eq("company_id", currentCompanyId)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("product_variants")
            .select("id,product_id,name,sku")
            .eq("company_id", currentCompanyId)
            .order("name", {
              ascending: true,
            }),
        ]);

        if (transferResult.error) {
          throw transferResult.error;
        }

        if (itemsResult.error) {
          throw itemsResult.error;
        }

        if (warehousesResult.error) {
          throw warehousesResult.error;
        }

        if (locationsResult.error) {
          throw locationsResult.error;
        }

        if (productsResult.error) {
          throw productsResult.error;
        }

        if (variantsResult.error) {
          throw variantsResult.error;
        }

        if (!transferResult.data) {
          throw new Error("Transfer not found.");
        }

        setTransfer(transferResult.data as Transfer);

        setItems(
          (itemsResult.data ?? []) as TransferItem[]
        );

        setWarehouses(
          (warehousesResult.data ?? []) as Warehouse[]
        );

        setLocations(
          (locationsResult.data ?? []) as Location[]
        );

        setProducts(
          (productsResult.data ?? []) as Product[]
        );

        setVariants(
          (variantsResult.data ?? []) as Variant[]
        );
      } catch (error) {
        console.error(
          "Transfer details load error:",
          error
        );

        setTransfer(null);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load transfer details."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase, transferId]
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

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

  const productMap = useMemo(() => {
    return new Map(
      products.map((product) => [
        product.id,
        product,
      ])
    );
  }, [products]);

  const variantMap = useMemo(() => {
    return new Map(
      variants.map((variant) => [
        variant.id,
        variant,
      ])
    );
  }, [variants]);

  const sourceWarehouse = transfer
    ? warehouseMap.get(transfer.source_warehouse_id)
    : undefined;

  const destinationWarehouse = transfer
    ? warehouseMap.get(
        transfer.destination_warehouse_id
      )
    : undefined;

  const sourceLocation = transfer
    ? locationMap.get(transfer.source_location_id)
    : undefined;

  const destinationLocation = transfer
    ? locationMap.get(
        transfer.destination_location_id
      )
    : undefined;

  const totalUnits = useMemo(() => {
    return items.reduce(
      (total, item) =>
        total + Number(item.quantity || 0),
      0
    );
  }, [items]);

  const runAction = useCallback(
    async (
      action: "dispatch" | "receive" | "cancel"
    ) => {
      if (!companyId || !transfer) {
        setErrorMessage(
          "Transfer information is not available."
        );
        return;
      }

      if (action === "cancel") {
        const reason = window.prompt(
          "Enter a cancellation reason (optional):"
        );

        if (reason === null) {
          return;
        }

        setActionLoading("cancel");
        setErrorMessage("");
        setSuccessMessage("");

        try {
          const { error } = await supabase.rpc(
            "cancel_stock_transfer",
            {
              p_company_id: companyId,
              p_transfer_id: transfer.id,
              p_reason: reason.trim() || null,
            }
          );

          if (error) {
            throw error;
          }

          setSuccessMessage(
            "Transfer cancelled successfully."
          );

          await loadData(true);
        } catch (error) {
          console.error(
            "Cancel transfer error:",
            error
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to cancel this transfer."
          );
        } finally {
          setActionLoading(null);
        }

        return;
      }

      if (action === "dispatch") {
        const confirmed = window.confirm(
          "Dispatch this transfer?\n\nInventory will be removed from the source location and the transfer will move to In Transit."
        );

        if (!confirmed) {
          return;
        }

        setActionLoading("dispatch");
        setErrorMessage("");
        setSuccessMessage("");

        try {
          const { error } = await supabase.rpc(
            "dispatch_stock_transfer",
            {
              p_company_id: companyId,
              p_transfer_id: transfer.id,
            }
          );

          if (error) {
            throw error;
          }

          setSuccessMessage(
            "Transfer dispatched successfully. Inventory has been moved out of the source location."
          );

          await loadData(true);
        } catch (error) {
          console.error(
            "Dispatch transfer error:",
            error
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to dispatch this transfer."
          );
        } finally {
          setActionLoading(null);
        }

        return;
      }

      const confirmed = window.confirm(
        "Receive this transfer?\n\nInventory will be added to the destination location and the transfer will be marked Completed."
      );

      if (!confirmed) {
        return;
      }

      setActionLoading("receive");
      setErrorMessage("");
      setSuccessMessage("");

      try {
        const { error } = await supabase.rpc(
          "receive_stock_transfer",
          {
            p_company_id: companyId,
            p_transfer_id: transfer.id,
          }
        );

        if (error) {
          throw error;
        }

        setSuccessMessage(
          "Transfer received successfully. Destination inventory has been updated."
        );

        await loadData(true);
      } catch (error) {
        console.error(
          "Receive transfer error:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to receive this transfer."
        );
      } finally {
        setActionLoading(null);
      }
    },
    [
      companyId,
      loadData,
      supabase,
      transfer,
    ]
  );

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-[1500px] px-6 py-8">
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading transfer...
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!transfer) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-[1500px] px-6 py-8">
            <div className="mb-6">
              <Link
                href="/warehouses/transfers"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Transfers
              </Link>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-5 w-5 text-red-600" />

                <div>
                  <h1 className="text-lg font-semibold text-red-900">
                    Unable to load transfer
                  </h1>

                  <p className="mt-1 text-sm text-red-700">
                    {errorMessage ||
                      "The transfer could not be found."}
                  </p>
                </div>
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
        <div className="mx-auto max-w-[1500px] px-6 py-8">
          {/* Header */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/warehouses/transfers"
                className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"
                aria-label="Back to transfers"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>

              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-slate-900 p-2.5 text-white">
                  <Truck className="h-5 w-5" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                      {transfer.transfer_number}
                    </h1>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                        transfer.status
                      )}`}
                    >
                      <StatusIcon
                        status={transfer.status}
                      />
                      {getStatusLabel(
                        transfer.status
                      )}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    Warehouse transfer created{" "}
                    {formatShortDate(
                      transfer.created_at
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  void loadData(true)
                }
                disabled={
                  refreshing ||
                  actionLoading !== null
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />
                Refresh
              </button>

              {transfer.status === "draft" && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      void runAction("cancel")
                    }
                    disabled={
                      actionLoading !== null
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading ===
                    "cancel" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void runAction(
                        "dispatch"
                      )
                    }
                    disabled={
                      actionLoading !== null
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading ===
                    "dispatch" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Dispatch Transfer
                  </button>
                </>
              )}

              {transfer.status ===
                "in_transit" && (
                <button
                  type="button"
                  onClick={() =>
                    void runAction("receive")
                  }
                  disabled={
                    actionLoading !== null
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionLoading ===
                  "receive" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Receive Transfer
                </button>
              )}
            </div>
          </div>

          {/* Module navigation */}
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-1">
            <div className="grid grid-cols-1 gap-1 md:grid-cols-3">
              <Link
                href="/warehouses"
                className="rounded-lg px-4 py-2.5 text-center text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
              >
                Warehouses
              </Link>

              <Link
                href="/warehouses/locations"
                className="rounded-lg px-4 py-2.5 text-center text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
              >
                Locations
              </Link>

              <Link
                href="/warehouses/transfers"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Transfers
              </Link>
            </div>
          </div>

          {/* Messages */}
          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

                <div>
                  <p className="text-sm font-semibold text-red-900">
                    Action failed
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    Success
                  </p>

                  <p className="mt-1 text-sm text-emerald-700">
                    {successMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                  <Package className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Items
                  </p>

                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    {items.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                  <Package className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Total Quantity
                  </p>

                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    {totalUnits.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                  <Clock3 className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Last Updated
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {formatDate(
                      transfer.updated_at
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Transfer route */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-950">
                Transfer Route
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Inventory moves from the source location to the
                destination location when the transfer is dispatched
                and received.
              </p>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
              {/* Source */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-slate-900 p-2 text-white">
                    <MapPin className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Source
                    </p>

                    <p className="text-sm font-semibold text-slate-950">
                      {sourceWarehouse?.name ??
                        "Unknown warehouse"}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-base font-semibold text-slate-950">
                    {sourceLocation?.name ??
                      "Unknown location"}
                  </p>

                  {sourceLocation?.code && (
                    <p className="mt-1 text-sm text-slate-500">
                      {sourceLocation.code}
                    </p>
                  )}

                  {sourceWarehouse?.code && (
                    <p className="mt-3 text-xs font-medium text-slate-400">
                      Warehouse:{" "}
                      {sourceWarehouse.code}
                    </p>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden items-center justify-center lg:flex">
                <div className="rounded-full border border-slate-200 bg-white p-3 text-slate-500 shadow-sm">
                  <ArrowRight className="h-5 w-5" />
                </div>
              </div>

              <div className="flex items-center justify-center lg:hidden">
                <div className="rounded-full border border-slate-200 bg-white p-3 text-slate-500 shadow-sm">
                  <ChevronRight className="h-5 w-5 rotate-90" />
                </div>
              </div>

              {/* Destination */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-emerald-600 p-2 text-white">
                    <MapPin className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Destination
                    </p>

                    <p className="text-sm font-semibold text-slate-950">
                      {destinationWarehouse?.name ??
                        "Unknown warehouse"}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-base font-semibold text-slate-950">
                    {destinationLocation?.name ??
                      "Unknown location"}
                  </p>

                  {destinationLocation?.code && (
                    <p className="mt-1 text-sm text-slate-500">
                      {destinationLocation.code}
                    </p>
                  )}

                  {destinationWarehouse?.code && (
                    <p className="mt-3 text-xs font-medium text-slate-400">
                      Warehouse:{" "}
                      {destinationWarehouse.code}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Transfer Items
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Products included in this warehouse transfer.
                  </p>
                </div>

                <div className="text-sm font-medium text-slate-500">
                  {items.length}{" "}
                  {items.length === 1
                    ? "item"
                    : "items"}{" "}
                  ·{" "}
                  {totalUnits.toLocaleString()}{" "}
                  units
                </div>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <Package className="h-6 w-6 text-slate-400" />
                </div>

                <h3 className="mt-4 text-sm font-semibold text-slate-950">
                  No items found
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  This transfer does not contain any transfer items.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Product
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Variant
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          SKU
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Tracking
                        </th>

                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Quantity
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200 bg-white">
                      {items.map((item) => {
                        const product =
                          productMap.get(
                            item.product_id
                          );

                        const variant =
                          variantMap.get(
                            item.variant_id
                          );

                        return (
                          <tr key={item.id}>
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-950">
                                {product?.name ??
                                  "Unknown product"}
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-700">
                                {variant?.name ??
                                  "Unknown variant"}
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-500">
                                {variant?.sku ||
                                  "—"}
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                {getTrackingLabel(
                                  product?.tracking_mode ??
                                    null
                                )}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <span className="text-sm font-semibold text-slate-950">
                                {Number(
                                  item.quantity
                                ).toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="divide-y divide-slate-200 md:hidden">
                  {items.map((item) => {
                    const product =
                      productMap.get(
                        item.product_id
                      );

                    const variant =
                      variantMap.get(
                        item.variant_id
                      );

                    return (
                      <div
                        key={item.id}
                        className="p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-950">
                              {product?.name ??
                                "Unknown product"}
                            </p>

                            <p className="mt-1 text-sm text-slate-600">
                              {variant?.name ??
                                "Unknown variant"}
                            </p>

                            {variant?.sku && (
                              <p className="mt-1 text-xs text-slate-400">
                                SKU:{" "}
                                {variant.sku}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-lg font-semibold text-slate-950">
                              {Number(
                                item.quantity
                              ).toLocaleString()}
                            </p>

                            <p className="text-xs text-slate-400">
                              qty
                            </p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {getTrackingLabel(
                              product?.tracking_mode ??
                                null
                            )}
                          </span>
                        </div>

                        {item.notes && (
                          <div className="mt-4 rounded-lg bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Item note
                            </p>

                            <p className="mt-1 text-sm text-slate-600">
                              {item.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Notes and timeline */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Notes */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-950">
                Notes
              </h2>

              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                {transfer.notes ? (
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {transfer.notes}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">
                    No notes were added to this transfer.
                  </p>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-950">
                Transfer Timeline
              </h2>

              <div className="mt-5 space-y-5">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <Clock3 className="h-4 w-4 text-slate-600" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Transfer created
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(
                        transfer.created_at
                      )}
                    </p>
                  </div>
                </div>

                {transfer.status !==
                  "draft" &&
                  transfer.status !==
                    "cancelled" && (
                    <div className="flex gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50">
                        <Send className="h-4 w-4 text-blue-600" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          Transfer dispatched
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Source inventory was removed and the
                          transfer entered transit.
                        </p>
                      </div>
                    </div>
                  )}

                {transfer.status ===
                  "completed" && (
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Transfer received
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Destination inventory was updated.
                        {transfer.completed_at
                          ? ` ${formatDate(
                              transfer.completed_at
                            )}`
                          : ""}
                      </p>
                    </div>
                  </div>
                )}

                {transfer.status ===
                  "cancelled" && (
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50">
                      <XCircle className="h-4 w-4 text-red-600" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Transfer cancelled
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        This transfer did not move inventory.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Workflow explanation */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <Truck className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-slate-950">
                  Transfer workflow
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Draft transfers do not change inventory. Dispatching
                  removes quantity from the source location and moves
                  the transfer to In Transit. Receiving adds quantity to
                  the destination location and marks the transfer
                  Completed.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom navigation */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/warehouses/transfers"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Transfers
            </Link>

            <Link
              href="/warehouses/transfers/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create Another Transfer
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}