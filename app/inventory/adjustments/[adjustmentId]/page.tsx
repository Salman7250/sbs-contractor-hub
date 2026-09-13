"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  Package,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Adjustment = {
  id: string;
  company_id: string;
  adjustment_number: string;
  reason: string | null;
  notes: string | null;
  status: "draft" | "completed" | "cancelled" | string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type AdjustmentItem = {
  id: string;
  company_id: string;
  adjustment_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  direction: "in" | "out" | string;
  reason: string | null;
  created_at: string;
  warehouse_id: string;
  location_id: string;
  batch_id: string;
};

type Product = {
  id: string;
  name: string;
  tracking_mode: string | null;
};

type Variant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
};

type Batch = {
  id: string;
  product_id: string;
  variant_id: string;
  lot_number: string | null;
  quantity_received: number;
  unit_cost: number | null;
  total_cost: number | null;
  status: string | null;
};

type Warehouse = {
  id: string;
  name: string;
  code: string | null;
};

type Location = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string | null;
};

type BatchStock = {
  id: string;
  batch_id: string;
  warehouse_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
};

type Movement = {
  id: string;
  batch_id: string | null;
  batch_stock_id: string | null;
  unit_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  movement_type: string;
  quantity: number;
  quantity_before: number | null;
  quantity_after: number | null;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
};

type LineView = {
  item: AdjustmentItem;
  product?: Product;
  variant?: Variant;
  batch?: Batch;
  warehouse?: Warehouse;
  location?: Location;
  stock?: BatchStock;
  movement?: Movement;
};

function isUuid(
  value: string | null | undefined,
): value is string {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatDate(
  value: string | null | undefined,
) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(
  value: string | null | undefined,
) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(
  value: number | null | undefined,
) {
  return new Intl.NumberFormat("en-US").format(
    Number(value ?? 0),
  );
}

function formatCurrency(
  value: number | null | undefined,
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function statusLabel(status: string) {
  switch (status) {
    case "draft":
      return "Draft";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status.replace(/_/g, " ");
  }
}

function movementLabel(type: string) {
  switch (type) {
    case "adjustment_in":
      return "Adjustment In";
    case "adjustment_out":
      return "Adjustment Out";
    default:
      return type.replace(/_/g, " ");
  }
}

export default function StockAdjustmentDetailPage() {
  const params = useParams();
  const router = useRouter();

  const adjustmentId =
    typeof params?.adjustmentId === "string"
      ? params.adjustmentId
      : Array.isArray(params?.adjustmentId)
        ? params.adjustmentId[0]
        : null;

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [adjustment, setAdjustment] =
    useState<Adjustment | null>(null);

  const [items, setItems] = useState<AdjustmentItem[]>(
    [],
  );

  const [products, setProducts] = useState<Product[]>(
    [],
  );

  const [variants, setVariants] = useState<Variant[]>(
    [],
  );

  const [batches, setBatches] = useState<Batch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(
    [],
  );
  const [locations, setLocations] = useState<Location[]>(
    [],
  );
  const [batchStocks, setBatchStocks] = useState<
    BatchStock[]
  >([]);
  const [movements, setMovements] = useState<Movement[]>(
    [],
  );

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [showCancelModal, setShowCancelModal] =
    useState(false);

  const [cancelReason, setCancelReason] =
    useState("");

  const loadAdjustment = useCallback(
    async (showRefresh = false) => {
      if (!isUuid(adjustmentId)) {
        setErrorMessage(
          "Invalid stock adjustment ID.",
        );
        setLoading(false);
        return;
      }

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage(null);

      try {
        const {
          data: {
            user,
          },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            "Your session has expired. Please sign in again.",
          );
        }

        const { data: membership, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (
          membershipError ||
          !membership?.company_id
        ) {
          throw new Error(
            "No active company membership was found.",
          );
        }

        const companyId = membership.company_id;

        const {
          data: adjustmentData,
          error: adjustmentError,
        } = await supabase
          .from("stock_adjustments")
          .select(
            `
              id,
              company_id,
              adjustment_number,
              reason,
              notes,
              status,
              created_by,
              created_at,
              updated_at
            `,
          )
          .eq("company_id", companyId)
          .eq("id", adjustmentId)
          .maybeSingle();

        if (adjustmentError) {
          throw adjustmentError;
        }

        if (!adjustmentData) {
          throw new Error(
            "Stock adjustment not found.",
          );
        }

        const {
          data: itemData,
          error: itemError,
        } = await supabase
          .from("stock_adjustment_items")
          .select(
            `
              id,
              company_id,
              adjustment_id,
              product_id,
              variant_id,
              quantity,
              direction,
              reason,
              created_at,
              warehouse_id,
              location_id,
              batch_id
            `,
          )
          .eq("company_id", companyId)
          .eq("adjustment_id", adjustmentId)
          .order("created_at", {
            ascending: true,
          });

        if (itemError) {
          throw itemError;
        }

        const adjustmentItems =
          (itemData ?? []) as AdjustmentItem[];

        const productIds = Array.from(
          new Set(
            adjustmentItems
              .map((item) => item.product_id)
              .filter(isUuid),
          ),
        );

        const variantIds = Array.from(
          new Set(
            adjustmentItems
              .map((item) => item.variant_id)
              .filter(isUuid),
          ),
        );

        const batchIds = Array.from(
          new Set(
            adjustmentItems
              .map((item) => item.batch_id)
              .filter(isUuid),
          ),
        );

        const warehouseIds = Array.from(
          new Set(
            adjustmentItems
              .map((item) => item.warehouse_id)
              .filter(isUuid),
          ),
        );

        const locationIds = Array.from(
          new Set(
            adjustmentItems
              .map((item) => item.location_id)
              .filter(isUuid),
          ),
        );

        const [
          productsResult,
          variantsResult,
          batchesResult,
          warehousesResult,
          locationsResult,
        ] = await Promise.all([
          productIds.length
            ? supabase
                .from("products")
                .select(
                  "id, name, tracking_mode",
                )
                .eq("company_id", companyId)
                .in("id", productIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),

          variantIds.length
            ? supabase
                .from("product_variants")
                .select(
                  "id, product_id, name, sku",
                )
                .eq("company_id", companyId)
                .in("id", variantIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),

          batchIds.length
            ? supabase
                .from("inventory_batches")
                .select(
                  `
                    id,
                    product_id,
                    variant_id,
                    lot_number,
                    quantity_received,
                    unit_cost,
                    total_cost,
                    status
                  `,
                )
                .eq("company_id", companyId)
                .in("id", batchIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),

          warehouseIds.length
            ? supabase
                .from("warehouses")
                .select(
                  "id, name, code",
                )
                .eq("company_id", companyId)
                .in("id", warehouseIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),

          locationIds.length
            ? supabase
                .from("warehouse_locations")
                .select(
                  "id, warehouse_id, name, code",
                )
                .eq("company_id", companyId)
                .in("id", locationIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),
        ]);

        if (productsResult.error) {
          throw productsResult.error;
        }

        if (variantsResult.error) {
          throw variantsResult.error;
        }

        if (batchesResult.error) {
          throw batchesResult.error;
        }

        if (warehousesResult.error) {
          throw warehousesResult.error;
        }

        if (locationsResult.error) {
          throw locationsResult.error;
        }

        const [
          batchStockResult,
          movementResult,
        ] = await Promise.all([
          batchIds.length
            ? supabase
                .from("inventory_batch_stock")
                .select(
                  `
                    id,
                    batch_id,
                    warehouse_id,
                    location_id,
                    quantity,
                    reserved_quantity
                  `,
                )
                .eq("company_id", companyId)
                .in("batch_id", batchIds)
                .in(
                  "warehouse_id",
                  warehouseIds,
                )
                .in(
                  "location_id",
                  locationIds,
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),

          supabase
            .from("inventory_movements")
            .select(
              `
                id,
                batch_id,
                batch_stock_id,
                unit_id,
                product_id,
                variant_id,
                warehouse_id,
                location_id,
                movement_type,
                quantity,
                quantity_before,
                quantity_after,
                reference_type,
                reference_id,
                reason,
                notes,
                created_at
              `,
            )
            .eq("company_id", companyId)
            .eq(
              "reference_type",
              "stock_adjustment",
            )
            .eq(
              "reference_id",
              adjustmentId,
            )
            .order("created_at", {
              ascending: true,
            }),
        ]);

        if (batchStockResult.error) {
          throw batchStockResult.error;
        }

        if (movementResult.error) {
          throw movementResult.error;
        }

        setAdjustment(
          adjustmentData as Adjustment,
        );

        setItems(adjustmentItems);

        setProducts(
          (productsResult.data ??
            []) as Product[],
        );

        setVariants(
          (variantsResult.data ??
            []) as Variant[],
        );

        setBatches(
          (batchesResult.data ??
            []) as Batch[],
        );

        setWarehouses(
          (warehousesResult.data ??
            []) as Warehouse[],
        );

        setLocations(
          (locationsResult.data ??
            []) as Location[],
        );

        setBatchStocks(
          (batchStockResult.data ??
            []) as BatchStock[],
        );

        setMovements(
          (movementResult.data ??
            []) as Movement[],
        );
      } catch (error) {
        console.error(
          "Failed to load stock adjustment:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load stock adjustment.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [adjustmentId, supabase],
  );

  useEffect(() => {
    loadAdjustment();
  }, [loadAdjustment]);

  const productsById = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          product,
        ]),
      ),
    [products],
  );

  const variantsById = useMemo(
    () =>
      new Map(
        variants.map((variant) => [
          variant.id,
          variant,
        ]),
      ),
    [variants],
  );

  const batchesById = useMemo(
    () =>
      new Map(
        batches.map((batch) => [
          batch.id,
          batch,
        ]),
      ),
    [batches],
  );

  const warehousesById = useMemo(
    () =>
      new Map(
        warehouses.map((warehouse) => [
          warehouse.id,
          warehouse,
        ]),
      ),
    [warehouses],
  );

  const locationsById = useMemo(
    () =>
      new Map(
        locations.map((location) => [
          location.id,
          location,
        ]),
      ),
    [locations],
  );

  const lineViews = useMemo<LineView[]>(
    () =>
      items.map((item) => {
        const stock = batchStocks.find(
          (row) =>
            row.batch_id === item.batch_id &&
            row.warehouse_id ===
              item.warehouse_id &&
            row.location_id ===
              item.location_id,
        );

        const movement = movements.find(
          (row) =>
            row.batch_id === item.batch_id &&
            row.product_id ===
              item.product_id &&
            row.variant_id ===
              item.variant_id &&
            row.warehouse_id ===
              item.warehouse_id &&
            row.location_id ===
              item.location_id,
        );

        return {
          item,
          product: productsById.get(
            item.product_id,
          ),
          variant: variantsById.get(
            item.variant_id,
          ),
          batch: batchesById.get(
            item.batch_id,
          ),
          warehouse: warehousesById.get(
            item.warehouse_id,
          ),
          location: locationsById.get(
            item.location_id,
          ),
          stock,
          movement,
        };
      }),
    [
      items,
      batchStocks,
      movements,
      productsById,
      variantsById,
      batchesById,
      warehousesById,
      locationsById,
    ],
  );

  const totalLines = items.length;

  const unitsIncreased = useMemo(
    () =>
      items
        .filter(
          (item) => item.direction === "in",
        )
        .reduce(
          (sum, item) =>
            sum + Number(item.quantity),
          0,
        ),
    [items],
  );

  const unitsDecreased = useMemo(
    () =>
      items
        .filter(
          (item) => item.direction === "out",
        )
        .reduce(
          (sum, item) =>
            sum + Number(item.quantity),
          0,
        ),
    [items],
  );

  const totalUnits = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(item.quantity),
        0,
      ),
    [items],
  );

  const batchCount = useMemo(
    () =>
      new Set(
        items
          .map((item) => item.batch_id)
          .filter(Boolean),
      ).size,
    [items],
  );

  const locationCount = useMemo(
    () =>
      new Set(
        items
          .map(
            (item) =>
              `${item.warehouse_id}:${item.location_id}`,
          )
          .filter(Boolean),
      ).size,
    [items],
  );

  const statusClass =
    adjustment?.status === "completed"
      ? "status-badge status-completed"
      : adjustment?.status === "cancelled"
        ? "status-badge status-cancelled"
        : "status-badge status-draft";

  async function completeAdjustment() {
    if (!adjustment) return;

    if (adjustment.status !== "draft") {
      return;
    }

    if (!window.confirm(
      "Complete this stock adjustment? Inventory quantities will be changed.",
    )) {
      return;
    }

    setProcessing(true);
    setErrorMessage(null);

    try {
      const {
        data: {
          user,
        },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Your session has expired.",
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

      if (
        membershipError ||
        !membership?.company_id
      ) {
        throw new Error(
          "No active company membership was found.",
        );
      }

      const { error } = await supabase.rpc(
        "complete_stock_adjustment",
        {
          p_company_id:
            membership.company_id,
          p_adjustment_id:
            adjustment.id,
        },
      );

      if (error) {
        throw error;
      }

      await loadAdjustment(true);
    } catch (error) {
      console.error(
        "Failed to complete stock adjustment:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to complete stock adjustment.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function cancelAdjustment() {
    if (!adjustment) return;

    if (adjustment.status !== "draft") {
      return;
    }

    setProcessing(true);
    setErrorMessage(null);

    try {
      const {
        data: {
          user,
        },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Your session has expired.",
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

      if (
        membershipError ||
        !membership?.company_id
      ) {
        throw new Error(
          "No active company membership was found.",
        );
      }

      const { error } = await supabase.rpc(
        "cancel_stock_adjustment",
        {
          p_company_id:
            membership.company_id,
          p_adjustment_id:
            adjustment.id,
          p_reason:
            cancelReason.trim() || null,
        },
      );

      if (error) {
        throw error;
      }

      setShowCancelModal(false);
      setCancelReason("");

      await loadAdjustment(true);
    } catch (error) {
      console.error(
        "Failed to cancel stock adjustment:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to cancel stock adjustment.",
      );
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="loading-card">
            <RefreshCw
              size={20}
              className="spin"
            />
            <span>
              Loading stock adjustment…
            </span>
          </div>
        </div>

        <style jsx>{`
          .page-content {
            padding: 28px;
          }

          .loading-card {
            min-height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            color: #64748b;
            font-size: 14px;
          }

          .spin {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </AppShell>
    );
  }

  if (!adjustment) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <button
            type="button"
            className="back-button"
            onClick={() =>
              router.push(
                "/inventory/adjustments",
              )
            }
          >
            <ArrowLeft size={15} />
            Back to Adjustments
          </button>

          <div className="error-card">
            <XCircle size={22} />
            <div>
              <strong>
                Unable to load adjustment
              </strong>
              <p>
                {errorMessage ??
                  "The stock adjustment could not be found."}
              </p>
            </div>
          </div>
        </div>

        <style jsx>{`
          .page-content {
            padding: 28px;
          }

          .back-button {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 9px 13px;
            border: 1px solid #d1d5db;
            border-radius: 9px;
            background: #fff;
            color: #334155;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
          }

          .error-card {
            margin-top: 20px;
            display: flex;
            gap: 12px;
            padding: 18px;
            border: 1px solid #fecaca;
            border-radius: 14px;
            background: #fff;
            color: #991b1b;
          }

          .error-card p {
            margin: 5px 0 0;
            color: #7f1d1d;
            font-size: 13px;
          }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <div className="top-actions">
          <button
            type="button"
            className="back-button"
            onClick={() =>
              router.push(
                "/inventory/adjustments",
              )
            }
            disabled={processing}
          >
            <ArrowLeft size={15} />
            Back to Adjustments
          </button>

          <div className="action-group">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                loadAdjustment(true)
              }
              disabled={
                processing || refreshing
              }
            >
              <RefreshCw
                size={15}
                className={
                  refreshing
                    ? "spin"
                    : undefined
                }
              />
              Refresh
            </button>

            {adjustment.status ===
              "draft" && (
              <>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() =>
                    setShowCancelModal(
                      true,
                    )
                  }
                  disabled={processing}
                >
                  <X size={15} />
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    completeAdjustment
                  }
                  disabled={processing}
                >
                  <CheckCircle2
                    size={15}
                  />
                  {processing
                    ? "Processing…"
                    : "Complete Adjustment"}
                </button>
              </>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="alert-card">
            <XCircle size={18} />
            <div>
              <strong>
                Something went wrong
              </strong>
              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              onClick={() =>
                setErrorMessage(null)
              }
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="page-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Inventory Adjustment
            </div>

            <h1 className="page-title">
              {adjustment.adjustment_number}
            </h1>

            <p className="page-subtitle">
              Review the adjustment lines,
              batch allocation, inventory effect,
              and processing history.
            </p>
          </div>

          <div className="header-status">
            <span className={statusClass}>
              {adjustment.status ===
                "completed" && (
                <CheckCircle2 size={14} />
              )}

              {adjustment.status ===
                "cancelled" && (
                <XCircle size={14} />
              )}

              {adjustment.status ===
                "draft" && (
                <Clock3 size={14} />
              )}

              {statusLabel(
                adjustment.status,
              )}
            </span>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <FileText size={18} />
            </div>
            <div>
              <span className="stat-label">
                Total Lines
              </span>
              <strong className="stat-value">
                {formatNumber(totalLines)}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-positive">
              <ArrowUp size={18} />
            </div>
            <div>
              <span className="stat-label">
                Units Increased
              </span>
              <strong className="stat-value">
                {formatNumber(
                  unitsIncreased,
                )}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-negative">
              <ArrowDown size={18} />
            </div>
            <div>
              <span className="stat-label">
                Units Decreased
              </span>
              <strong className="stat-value">
                {formatNumber(
                  unitsDecreased,
                )}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Package size={18} />
            </div>
            <div>
              <span className="stat-label">
                Total Units
              </span>
              <strong className="stat-value">
                {formatNumber(totalUnits)}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Package size={18} />
            </div>
            <div>
              <span className="stat-label">
                Batches / Lots
              </span>
              <strong className="stat-value">
                {formatNumber(batchCount)}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <MapPin size={18} />
            </div>
            <div>
              <span className="stat-label">
                Locations
              </span>
              <strong className="stat-value">
                {formatNumber(
                  locationCount,
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="content-grid">
          <div className="content-card">
            <div className="section-header">
              <div>
                <h2>
                  Adjustment Information
                </h2>
                <p>
                  General details and processing
                  state.
                </p>
              </div>
            </div>

            <div className="info-grid">
              <div className="info-item">
                <span>
                  Adjustment Number
                </span>
                <strong>
                  {
                    adjustment.adjustment_number
                  }
                </strong>
              </div>

              <div className="info-item">
                <span>Status</span>
                <strong>
                  {statusLabel(
                    adjustment.status,
                  )}
                </strong>
              </div>

              <div className="info-item">
                <span>Reason</span>
                <strong>
                  {adjustment.reason ||
                    "—"}
                </strong>
              </div>

              <div className="info-item">
                <span>Created</span>
                <strong>
                  {formatDateTime(
                    adjustment.created_at,
                  )}
                </strong>
              </div>

              <div className="info-item">
                <span>Last Updated</span>
                <strong>
                  {formatDateTime(
                    adjustment.updated_at,
                  )}
                </strong>
              </div>

              <div className="info-item">
                <span>Adjustment ID</span>
                <strong className="mono">
                  {adjustment.id}
                </strong>
              </div>
            </div>

            {adjustment.notes && (
              <div className="notes-box">
                <span>Notes</span>
                <p>
                  {adjustment.notes}
                </p>
              </div>
            )}
          </div>

          <div className="content-card">
            <div className="section-header">
              <div>
                <h2>
                  Processing Summary
                </h2>
                <p>
                  Inventory effect represented by
                  this adjustment.
                </p>
              </div>
            </div>

            <div className="summary-list">
              <div className="summary-row">
                <span>
                  Increase
                </span>
                <strong className="positive">
                  +{formatNumber(
                    unitsIncreased,
                  )}
                </strong>
              </div>

              <div className="summary-row">
                <span>
                  Decrease
                </span>
                <strong className="negative">
                  -{formatNumber(
                    unitsDecreased,
                  )}
                </strong>
              </div>

              <div className="summary-row total-row">
                <span>
                  Net Inventory Effect
                </span>
                <strong>
                  {unitsIncreased -
                    unitsDecreased >=
                  0
                    ? "+"
                    : ""}
                  {formatNumber(
                    unitsIncreased -
                      unitsDecreased,
                  )}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section className="content-card table-card">
          <div className="section-header">
            <div>
              <h2>
                Adjustment Lines
              </h2>
              <p>
                Every adjustment is tied to a
                specific batch, warehouse, and
                location.
              </p>
            </div>

            <span className="line-count">
              {formatNumber(totalLines)}{" "}
              {totalLines === 1
                ? "line"
                : "lines"}
            </span>
          </div>

          {lineViews.length === 0 ? (
            <div className="empty-state">
              <Package size={28} />
              <strong>
                No adjustment lines
              </strong>
              <p>
                This adjustment does not contain
                any inventory lines.
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Variant / SKU</th>
                    <th>Batch / Lot</th>
                    <th>Warehouse</th>
                    <th>Location</th>
                    <th>Direction</th>
                    <th>Quantity</th>
                    <th>Stock Effect</th>
                    <th>Reason</th>
                  </tr>
                </thead>

                <tbody>
                  {lineViews.map(
                    ({
                      item,
                      product,
                      variant,
                      batch,
                      warehouse,
                      location,
                      movement,
                    }) => (
                      <tr
                        key={item.id}
                      >
                        <td>
                          <div className="product-cell">
                            <strong>
                              {product?.name ||
                                "Unknown Product"}
                            </strong>

                            {product
                              ?.tracking_mode && (
                              <span>
                                {product.tracking_mode
                                  .replace(
                                    /_/g,
                                    " ",
                                  )
                                  .replace(
                                    /^./,
                                    (
                                      char,
                                    ) =>
                                      char.toUpperCase(),
                                  )}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="variant-cell">
                            <strong>
                              {variant?.name ||
                                "—"}
                            </strong>

                            <span className="sku">
                              {variant?.sku ||
                                "No SKU"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="batch-cell">
                            <strong>
                              {batch?.lot_number ||
                                "—"}
                            </strong>

                            {batch?.status && (
                              <span>
                                {statusLabel(
                                  batch.status,
                                )}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="location-cell">
                            <strong>
                              {warehouse?.name ||
                                "—"}
                            </strong>

                            {warehouse?.code && (
                              <span>
                                {
                                  warehouse.code
                                }
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="location-cell">
                            <strong>
                              {location?.name ||
                                "—"}
                            </strong>

                            {location?.code && (
                              <span>
                                {
                                  location.code
                                }
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <span
                            className={
                              item.direction ===
                              "in"
                                ? "direction-badge direction-in"
                                : "direction-badge direction-out"
                            }
                          >
                            {item.direction ===
                            "in" ? (
                              <ArrowUp
                                size={13}
                              />
                            ) : (
                              <ArrowDown
                                size={13}
                              />
                            )}

                            {item.direction ===
                            "in"
                              ? "Increase"
                              : "Decrease"}
                          </span>
                        </td>

                        <td>
                          <strong className="quantity">
                            {formatNumber(
                              item.quantity,
                            )}
                          </strong>
                        </td>

                        <td>
                          {movement ? (
                            <div className="movement-cell">
                              <strong>
                                {movementLabel(
                                  movement.movement_type,
                                )}
                              </strong>

                              <span>
                                {movement.quantity_before ??
                                  "—"}{" "}
                                →{" "}
                                {movement.quantity_after ??
                                  "—"}
                              </span>
                            </div>
                          ) : (
                            <span className="muted">
                              {adjustment.status ===
                              "draft"
                                ? "Pending"
                                : "No movement"}
                            </span>
                          )}
                        </td>

                        <td>
                          <span className="reason-text">
                            {item.reason ||
                              adjustment.reason ||
                              "—"}
                          </span>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="content-card table-card">
          <div className="section-header">
            <div>
              <h2>
                Inventory Movement Audit
              </h2>
              <p>
                Movement records generated when
                this adjustment is completed.
              </p>
            </div>

            <span className="line-count">
              {formatNumber(
                movements.length,
              )}{" "}
              {movements.length === 1
                ? "movement"
                : "movements"}
            </span>
          </div>

          {movements.length === 0 ? (
            <div className="empty-state compact">
              <Clock3 size={26} />

              <strong>
                No inventory movement yet
              </strong>

              <p>
                {adjustment.status ===
                "draft"
                  ? "This draft has not changed inventory."
                  : adjustment.status ===
                      "cancelled"
                    ? "This adjustment was cancelled without changing inventory."
                    : "No movement records were found for this adjustment."}
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Movement</th>
                    <th>Batch / Lot</th>
                    <th>Quantity</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Reason</th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map(
                    (movement) => {
                      const batch =
                        movement.batch_id
                          ? batchesById.get(
                              movement.batch_id,
                            )
                          : undefined;

                      return (
                        <tr
                          key={
                            movement.id
                          }
                        >
                          <td>
                            {formatDateTime(
                              movement.created_at,
                            )}
                          </td>

                          <td>
                            <span
                              className={
                                movement.movement_type ===
                                "adjustment_in"
                                  ? "movement-badge movement-positive"
                                  : "movement-badge movement-negative"
                              }
                            >
                              {movement.movement_type ===
                              "adjustment_in" ? (
                                <ArrowUp
                                  size={13}
                                />
                              ) : (
                                <ArrowDown
                                  size={13}
                                />
                              )}

                              {movementLabel(
                                movement.movement_type,
                              )}
                            </span>
                          </td>

                          <td>
                            {batch?.lot_number ||
                              "—"}
                          </td>

                          <td>
                            <strong>
                              {formatNumber(
                                movement.quantity,
                              )}
                            </strong>
                          </td>

                          <td>
                            {movement.quantity_before ??
                              "—"}
                          </td>

                          <td>
                            {movement.quantity_after ??
                              "—"}
                          </td>

                          <td>
                            {movement.reason ||
                              movement.notes ||
                              "—"}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="architecture-note">
          <div className="architecture-icon">
            <Package size={19} />
          </div>

          <div>
            <strong>
              Batch-first inventory architecture
            </strong>

            <p>
              This adjustment operates against
              physical batch stock at a specific
              warehouse and location. Serial numbers
              remain optional child identities inside
              a batch and are never fabricated by an
              adjustment.
            </p>
          </div>
        </section>

        <div className="footer-meta">
          <span>
            Created{" "}
            {formatDateTime(
              adjustment.created_at,
            )}
          </span>

          <span>•</span>

          <span>
            Updated{" "}
            {formatDateTime(
              adjustment.updated_at,
            )}
          </span>
        </div>
      </div>

      {showCancelModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowCancelModal(false);
            }
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
          >
            <div className="modal-header">
              <div>
                <span className="modal-icon">
                  <XCircle size={19} />
                </span>

                <div>
                  <h3 id="cancel-title">
                    Cancel Adjustment
                  </h3>

                  <p>
                    This draft will be marked as
                    cancelled and will not change
                    inventory.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setShowCancelModal(
                    false,
                  )
                }
                disabled={processing}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <label htmlFor="cancel-reason">
                Cancellation Reason
              </label>

              <textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(event) =>
                  setCancelReason(
                    event.target.value,
                  )
                }
                placeholder="Optional reason for cancelling this adjustment…"
                rows={4}
                disabled={processing}
              />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setShowCancelModal(
                    false,
                  )
                }
                disabled={processing}
              >
                Keep Draft
              </button>

              <button
                type="button"
                className="danger-button"
                onClick={
                  cancelAdjustment
                }
                disabled={processing}
              >
                <XCircle size={15} />

                {processing
                  ? "Cancelling…"
                  : "Cancel Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-content {
          padding: 28px;
          max-width: 1700px;
          margin: 0 auto;
        }

        .top-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 24px;
        }

        .action-group {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        button {
          font-family: inherit;
        }

        .back-button,
        .secondary-button,
        .primary-button,
        .danger-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 38px;
          padding: 9px 13px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            opacity 0.15s ease;
        }

        .back-button,
        .secondary-button {
          background: #fff;
          color: #334155;
          border: 1px solid #d1d5db;
        }

        .back-button:hover,
        .secondary-button:hover {
          background: #f8fafc;
          border-color: #bfc5ce;
        }

        .primary-button {
          border: 1px solid #166534;
          background: #166534;
          color: #fff;
        }

        .primary-button:hover {
          background: #14532d;
        }

        .danger-button {
          border: 1px solid #fecaca;
          background: #fff;
          color: #b91c1c;
        }

        .danger-button:hover {
          background: #fef2f2;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .alert-card {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-bottom: 20px;
          padding: 14px 15px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: #fff;
          color: #991b1b;
        }

        .alert-card div {
          flex: 1;
        }

        .alert-card p {
          margin: 4px 0 0;
          color: #7f1d1d;
          font-size: 13px;
        }

        .alert-card button {
          border: 0;
          background: transparent;
          color: #991b1b;
          cursor: pointer;
          padding: 2px;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 7px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #166534;
        }

        .page-title {
          margin: 0;
          color: #0f172a;
          font-size: 30px;
          line-height: 1.15;
          font-weight: 750;
          letter-spacing: -0.025em;
        }

        .page-subtitle {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.55;
        }

        .header-status {
          padding-top: 4px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 30px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .status-draft {
          background: #fff7ed;
          color: #9a3412;
          border: 1px solid #fed7aa;
        }

        .status-completed {
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .status-cancelled {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .stat-card {
          min-width: 0;
          min-height: 92px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #fff;
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .stat-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #f1f5f9;
          color: #475569;
        }

        .stat-positive {
          background: #f0fdf4;
          color: #166534;
        }

        .stat-negative {
          background: #fef2f2;
          color: #b91c1c;
        }

        .stat-label {
          display: block;
          margin-bottom: 4px;
          color: #64748b;
          font-size: 11px;
          font-weight: 650;
          text-transform: uppercase;
          letter-spacing: 0.045em;
        }

        .stat-value {
          display: block;
          color: #0f172a;
          font-size: 21px;
          line-height: 1.1;
          font-weight: 750;
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.65fr);
          gap: 16px;
          margin-bottom: 16px;
        }

        .content-card {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #fff;
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.03);
          overflow: hidden;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 18px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .section-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 16px;
          font-weight: 750;
        }

        .section-header p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.45;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
        }

        .info-item {
          min-width: 0;
          padding: 16px 20px;
          border-bottom: 1px solid #f1f5f9;
        }

        .info-item:nth-child(3n + 2),
        .info-item:nth-child(3n + 3) {
          border-left: 1px solid #f1f5f9;
        }

        .info-item span {
          display: block;
          margin-bottom: 6px;
          color: #64748b;
          font-size: 11px;
          font-weight: 650;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .info-item strong {
          display: block;
          color: #1e293b;
          font-size: 13px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .mono {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
          font-size: 11px !important;
        }

        .notes-box {
          margin: 16px 20px 20px;
          padding: 13px 14px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f8fafc;
        }

        .notes-box span {
          display: block;
          margin-bottom: 5px;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .notes-box p {
          margin: 0;
          color: #475569;
          font-size: 13px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .summary-list {
          padding: 6px 20px 12px;
        }

        .summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 15px 0;
          border-bottom: 1px solid #f1f5f9;
          color: #64748b;
          font-size: 13px;
        }

        .summary-row strong {
          color: #1e293b;
          font-size: 15px;
        }

        .summary-row .positive {
          color: #166534;
        }

        .summary-row .negative {
          color: #b91c1c;
        }

        .summary-row.total-row {
          padding-bottom: 17px;
          border-bottom: 0;
          color: #334155;
          font-weight: 700;
        }

        .table-card {
          margin-bottom: 16px;
        }

        .line-count {
          flex: 0 0 auto;
          color: #64748b;
          font-size: 12px;
          font-weight: 650;
        }

        .table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1250px;
          border-collapse: collapse;
        }

        th {
          padding: 11px 14px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          color: #64748b;
          font-size: 10px;
          font-weight: 750;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.045em;
          white-space: nowrap;
        }

        td {
          padding: 13px 14px;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          font-size: 12px;
          vertical-align: middle;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        tbody tr:hover {
          background: #fafafa;
        }

        .product-cell strong,
        .variant-cell strong,
        .batch-cell strong,
        .location-cell strong {
          display: block;
          color: #1e293b;
          font-size: 12px;
          font-weight: 700;
        }

        .product-cell span,
        .batch-cell span,
        .location-cell span {
          display: block;
          margin-top: 3px;
          color: #94a3b8;
          font-size: 10px;
        }

        .variant-cell .sku {
          display: inline-block;
          margin-top: 4px;
          padding: 3px 6px;
          border-radius: 5px;
          background: #f1f5f9;
          color: #475569;
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
          font-size: 10px;
        }

        .direction-badge,
        .movement-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          padding: 5px 7px;
          border-radius: 7px;
          font-size: 10px;
          font-weight: 750;
        }

        .direction-in,
        .movement-positive {
          background: #f0fdf4;
          color: #166534;
        }

        .direction-out,
        .movement-negative {
          background: #fef2f2;
          color: #b91c1c;
        }

        .quantity {
          color: #0f172a;
          font-size: 13px;
        }

        .movement-cell strong {
          display: block;
          color: #334155;
          font-size: 11px;
        }

        .movement-cell span {
          display: block;
          margin-top: 3px;
          color: #94a3b8;
          font-size: 10px;
        }

        .muted {
          color: #94a3b8;
          font-size: 11px;
        }

        .reason-text {
          color: #64748b;
          font-size: 11px;
        }

        .empty-state {
          min-height: 210px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          color: #94a3b8;
          text-align: center;
        }

        .empty-state strong {
          margin-top: 9px;
          color: #334155;
          font-size: 14px;
        }

        .empty-state p {
          max-width: 440px;
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.5;
        }

        .empty-state.compact {
          min-height: 160px;
        }

        .architecture-note {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px 17px;
          border: 1px solid #dbeafe;
          border-radius: 12px;
          background: #f8fbff;
        }

        .architecture-icon {
          width: 36px;
          height: 36px;
          flex: 0 0 36px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #eff6ff;
          color: #2563eb;
        }

        .architecture-note strong {
          display: block;
          color: #1e3a8a;
          font-size: 13px;
        }

        .architecture-note p {
          margin: 4px 0 0;
          color: #475569;
          font-size: 12px;
          line-height: 1.55;
        }

        .footer-meta {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 16px;
          color: #94a3b8;
          font-size: 11px;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.42);
        }

        .modal-card {
          width: min(500px, 100%);
          border-radius: 15px;
          background: #fff;
          box-shadow:
            0 25px 60px rgba(15, 23, 42, 0.2);
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 19px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header > div:first-child {
          display: flex;
          gap: 11px;
        }

        .modal-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #fef2f2;
          color: #b91c1c;
        }

        .modal-header h3 {
          margin: 0;
          color: #0f172a;
          font-size: 16px;
        }

        .modal-header p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        .modal-close {
          display: grid;
          place-items: center;
          padding: 4px;
          border: 0;
          background: transparent;
          color: #64748b;
          cursor: pointer;
        }

        .modal-body {
          padding: 18px 20px;
        }

        .modal-body label {
          display: block;
          margin-bottom: 7px;
          color: #334155;
          font-size: 12px;
          font-weight: 700;
        }

        .modal-body textarea {
          width: 100%;
          resize: vertical;
          box-sizing: border-box;
          padding: 10px 11px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          outline: none;
          color: #1e293b;
          font-family: inherit;
          font-size: 13px;
        }

        .modal-body textarea:focus {
          border-color: #166534;
          box-shadow:
            0 0 0 3px rgba(
              22,
              101,
              52,
              0.08
            );
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding: 15px 20px;
          border-top: 1px solid #e5e7eb;
          background: #f8fafc;
        }

        @media (max-width: 1300px) {
          .stats-grid {
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 1000px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .info-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .info-item:nth-child(3n + 2),
          .info-item:nth-child(3n + 3) {
            border-left: 0;
          }

          .info-item:nth-child(even) {
            border-left: 1px solid #f1f5f9;
          }
        }

        @media (max-width: 720px) {
          .page-content {
            padding: 20px 14px;
          }

          .top-actions,
          .page-header {
            flex-direction: column;
            align-items: stretch;
          }

          .action-group {
            flex-wrap: wrap;
          }

          .action-group button {
            flex: 1;
          }

          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .info-item:nth-child(even) {
            border-left: 0;
          }

          .section-header {
            align-items: flex-start;
          }

          .footer-meta {
            flex-wrap: wrap;
          }
        }

        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .action-group {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .primary-button {
            grid-column: span 2;
          }
        }
      `}</style>
    </AppShell>
  );
}