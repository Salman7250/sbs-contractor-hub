"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  MapPin,
  Package,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Movement = {
  id: string;
  company_id: string;
  inventory_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  movement_type: string;
  quantity: number;
  quantity_before: number | null;
  quantity_after: number | null;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  warehouse_id: string | null;
  location_id: string | null;
  batch_id: string | null;
  batch_stock_id: string | null;
  unit_id: string | null;
  transaction_id: string | null;
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

type SerializedUnit = {
  id: string;
  serial_number: string;
  barcode: string | null;
};

type MovementView = {
  movement: Movement;
  product?: Product;
  variant?: Variant;
  batch?: Batch;
  warehouse?: Warehouse;
  location?: Location;
  unit?: SerializedUnit;
};

const PAGE_SIZE = 25;

function formatNumber(
  value: number | null | undefined,
) {
  return new Intl.NumberFormat("en-US").format(
    Number(value ?? 0),
  );
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

function movementLabel(type: string) {
  switch (type) {
    case "stock_in":
      return "Stock In";

    case "stock_out":
      return "Stock Out";

    case "adjustment_in":
      return "Adjustment In";

    case "adjustment_out":
      return "Adjustment Out";

    case "transfer_in":
      return "Transfer In";

    case "transfer_out":
      return "Transfer Out";

    case "return":
      return "Return";

    case "sale":
      return "Sale";

    case "purchase":
      return "Purchase";

    default:
      return type
        .replace(/_/g, " ")
        .replace(/^./, (char) =>
          char.toUpperCase(),
        );
  }
}

function movementDirection(
  type: string,
): "in" | "out" | "neutral" {
  switch (type) {
    case "stock_in":
    case "adjustment_in":
    case "transfer_in":
    case "return":
    case "purchase":
      return "in";

    case "stock_out":
    case "adjustment_out":
    case "transfer_out":
    case "sale":
      return "out";

    default:
      return "neutral";
  }
}

function referenceLabel(
  type: string | null,
) {
  if (!type) return "—";

  switch (type) {
    case "stock_adjustment":
      return "Stock Adjustment";

    case "stock_receipt":
      return "Stock Receipt";

    case "stock_transfer":
      return "Stock Transfer";

    case "purchase_order":
      return "Purchase Order";

    case "sales_order":
      return "Sales Order";

    case "invoice":
      return "Invoice";

    default:
      return type
        .replace(/_/g, " ")
        .replace(/^./, (char) =>
          char.toUpperCase(),
        );
  }
}

function isUuid(
  value: string | null | undefined,
): value is string {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default function InventoryMovementsPage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [movements, setMovements] =
    useState<Movement[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [variants, setVariants] =
    useState<Variant[]>([]);

  const [batches, setBatches] =
    useState<Batch[]>([]);

  const [warehouses, setWarehouses] =
    useState<Warehouse[]>([]);

  const [locations, setLocations] =
    useState<Location[]>([]);

  const [serializedUnits, setSerializedUnits] =
    useState<SerializedUnit[]>([]);

  const [search, setSearch] =
    useState("");

  const [movementFilter, setMovementFilter] =
    useState("all");

  const [warehouseFilter, setWarehouseFilter] =
    useState("all");

  const [dateFilter, setDateFilter] =
    useState("all");

  const [page, setPage] =
    useState(1);

  const loadMovements = useCallback(
    async (showRefresh = false) => {
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

        const companyId =
          membership.company_id;

        const {
          data: movementData,
          error: movementError,
        } = await supabase
          .from("inventory_movements")
          .select(
            `
              id,
              company_id,
              inventory_id,
              product_id,
              variant_id,
              movement_type,
              quantity,
              quantity_before,
              quantity_after,
              reason,
              reference_type,
              reference_id,
              notes,
              created_by,
              created_at,
              warehouse_id,
              location_id,
              batch_id,
              batch_stock_id,
              unit_id,
              transaction_id
            `,
          )
          .eq(
            "company_id",
            companyId,
          )
          .order("created_at", {
            ascending: false,
          });

        if (movementError) {
          throw movementError;
        }

        const movementRows =
          (movementData ??
            []) as Movement[];

        setMovements(movementRows);

        const productIds =
          Array.from(
            new Set(
              movementRows
                .map(
                  (row) =>
                    row.product_id,
                )
                .filter(isUuid),
            ),
          );

        const variantIds =
          Array.from(
            new Set(
              movementRows
                .map(
                  (row) =>
                    row.variant_id,
                )
                .filter(isUuid),
            ),
          );

        const batchIds =
          Array.from(
            new Set(
              movementRows
                .map(
                  (row) =>
                    row.batch_id,
                )
                .filter(isUuid),
            ),
          );

        const warehouseIds =
          Array.from(
            new Set(
              movementRows
                .map(
                  (row) =>
                    row.warehouse_id,
                )
                .filter(isUuid),
            ),
          );

        const locationIds =
          Array.from(
            new Set(
              movementRows
                .map(
                  (row) =>
                    row.location_id,
                )
                .filter(isUuid),
            ),
          );

        const unitIds =
          Array.from(
            new Set(
              movementRows
                .map(
                  (row) =>
                    row.unit_id,
                )
                .filter(isUuid),
            ),
          );

        const [
          productsResult,
          variantsResult,
          batchesResult,
          warehousesResult,
          locationsResult,
          unitsResult,
        ] = await Promise.all([
          productIds.length
            ? supabase
                .from("products")
                .select(
                  "id, name, tracking_mode",
                )
                .eq(
                  "company_id",
                  companyId,
                )
                .in(
                  "id",
                  productIds,
                )
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
                .eq(
                  "company_id",
                  companyId,
                )
                .in(
                  "id",
                  variantIds,
                )
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
                    status
                  `,
                )
                .eq(
                  "company_id",
                  companyId,
                )
                .in(
                  "id",
                  batchIds,
                )
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
                .eq(
                  "company_id",
                  companyId,
                )
                .in(
                  "id",
                  warehouseIds,
                )
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
                .eq(
                  "company_id",
                  companyId,
                )
                .in(
                  "id",
                  locationIds,
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),

          unitIds.length
            ? supabase
                .from("serialized_units")
                .select(
                  "id, serial_number, barcode",
                )
                .eq(
                  "company_id",
                  companyId,
                )
                .in(
                  "id",
                  unitIds,
                )
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

        if (unitsResult.error) {
          throw unitsResult.error;
        }

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

        setSerializedUnits(
          (unitsResult.data ??
            []) as SerializedUnit[],
        );
      } catch (error) {
        console.error(
          "Failed to load inventory movements:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load inventory movements.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

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

  const unitsById = useMemo(
    () =>
      new Map(
        serializedUnits.map((unit) => [
          unit.id,
          unit,
        ]),
      ),
    [serializedUnits],
  );

  const movementViews =
    useMemo<MovementView[]>(
      () =>
        movements.map((movement) => ({
          movement,
          product:
            movement.product_id
              ? productsById.get(
                  movement.product_id,
                )
              : undefined,
          variant:
            movement.variant_id
              ? variantsById.get(
                  movement.variant_id,
                )
              : undefined,
          batch:
            movement.batch_id
              ? batchesById.get(
                  movement.batch_id,
                )
              : undefined,
          warehouse:
            movement.warehouse_id
              ? warehousesById.get(
                  movement.warehouse_id,
                )
              : undefined,
          location:
            movement.location_id
              ? locationsById.get(
                  movement.location_id,
                )
              : undefined,
          unit:
            movement.unit_id
              ? unitsById.get(
                  movement.unit_id,
                )
              : undefined,
        })),
      [
        movements,
        productsById,
        variantsById,
        batchesById,
        warehousesById,
        locationsById,
        unitsById,
      ],
    );

  const filteredMovements =
    useMemo(() => {
      const normalizedSearch =
        search.trim().toLowerCase();

      const now = new Date();

      return movementViews.filter(
        ({
          movement,
          product,
          variant,
          batch,
          warehouse,
          location,
          unit,
        }) => {
          const direction =
            movementDirection(
              movement.movement_type,
            );

          const searchable = [
            product?.name,
            variant?.name,
            variant?.sku,
            batch?.lot_number,
            warehouse?.name,
            warehouse?.code,
            location?.name,
            location?.code,
            unit?.serial_number,
            unit?.barcode,
            movement.reason,
            movement.notes,
            movement.reference_id,
            movement.reference_type,
            movement.movement_type,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !normalizedSearch ||
            searchable.includes(
              normalizedSearch,
            );

          const matchesMovement =
            movementFilter === "all" ||
            movement.movement_type ===
              movementFilter ||
            (movementFilter ===
              "in" &&
              direction === "in") ||
            (movementFilter ===
              "out" &&
              direction === "out");

          const matchesWarehouse =
            warehouseFilter === "all" ||
            movement.warehouse_id ===
              warehouseFilter;

          let matchesDate = true;

          if (
            dateFilter !== "all"
          ) {
            const created =
              new Date(
                movement.created_at,
              );

            if (
              dateFilter === "today"
            ) {
              matchesDate =
                created.toDateString() ===
                now.toDateString();
            }

            if (
              dateFilter === "7days"
            ) {
              const sevenDaysAgo =
                new Date(now);

              sevenDaysAgo.setDate(
                now.getDate() - 7,
              );

              matchesDate =
                created >=
                sevenDaysAgo;
            }

            if (
              dateFilter === "30days"
            ) {
              const thirtyDaysAgo =
                new Date(now);

              thirtyDaysAgo.setDate(
                now.getDate() - 30,
              );

              matchesDate =
                created >=
                thirtyDaysAgo;
            }
          }

          return (
            matchesSearch &&
            matchesMovement &&
            matchesWarehouse &&
            matchesDate
          );
        },
      );
    }, [
      movementViews,
      search,
      movementFilter,
      warehouseFilter,
      dateFilter,
    ]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    movementFilter,
    warehouseFilter,
    dateFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredMovements.length /
        PAGE_SIZE,
    ),
  );

  const currentPage =
    Math.min(page, totalPages);

  const paginatedMovements =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        PAGE_SIZE;

      return filteredMovements.slice(
        start,
        start + PAGE_SIZE,
      );
    }, [
      filteredMovements,
      currentPage,
    ]);

  const totalMovementCount =
    movements.length;

  const inboundCount =
    movements.filter(
      (movement) =>
        movementDirection(
          movement.movement_type,
        ) === "in",
    ).length;

  const outboundCount =
    movements.filter(
      (movement) =>
        movementDirection(
          movement.movement_type,
        ) === "out",
    ).length;

  const adjustmentCount =
    movements.filter(
      (movement) =>
        movement.movement_type ===
          "adjustment_in" ||
        movement.movement_type ===
          "adjustment_out",
    ).length;

  const transferCount =
    movements.filter(
      (movement) =>
        movement.movement_type ===
          "transfer_in" ||
        movement.movement_type ===
          "transfer_out",
    ).length;

  const totalUnitsMoved =
    movements.reduce(
      (sum, movement) =>
        sum + Math.abs(
          Number(
            movement.quantity ?? 0,
          ),
        ),
      0,
    );

  function clearFilters() {
    setSearch("");
    setMovementFilter("all");
    setWarehouseFilter("all");
    setDateFilter("all");
  }

  const hasFilters =
    search.trim() !== "" ||
    movementFilter !== "all" ||
    warehouseFilter !== "all" ||
    dateFilter !== "all";

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
              Loading inventory movements…
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

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <div className="top-actions">
          <button
            type="button"
            className="back-button"
            onClick={() =>
              router.push(
                "/inventory",
              )
            }
          >
            <ArrowLeft size={15} />
            Back to Inventory
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              loadMovements(true)
            }
            disabled={refreshing}
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
        </div>

        {errorMessage && (
          <div className="alert-card">
            <div>
              <strong>
                Failed to load movements
              </strong>

              <p>
                {errorMessage}
              </p>
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
              Inventory Ledger
            </div>

            <h1 className="page-title">
              Inventory Movements
            </h1>

            <p className="page-subtitle">
              Complete audit trail of every
              inventory movement across products,
              batches, warehouses, and locations.
            </p>
          </div>

          <div className="ledger-badge">
            <FileText size={15} />
            {formatNumber(
              totalMovementCount,
            )}{" "}
            total movements
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <FileText size={18} />
            </div>

            <div>
              <span className="stat-label">
                Total Movements
              </span>

              <strong className="stat-value">
                {formatNumber(
                  totalMovementCount,
                )}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-positive">
              <ArrowUp size={18} />
            </div>

            <div>
              <span className="stat-label">
                Inbound
              </span>

              <strong className="stat-value">
                {formatNumber(
                  inboundCount,
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
                Outbound
              </span>

              <strong className="stat-value">
                {formatNumber(
                  outboundCount,
                )}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <RefreshCw size={18} />
            </div>

            <div>
              <span className="stat-label">
                Adjustments
              </span>

              <strong className="stat-value">
                {formatNumber(
                  adjustmentCount,
                )}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <ArrowRight size={18} />
            </div>

            <div>
              <span className="stat-label">
                Transfers
              </span>

              <strong className="stat-value">
                {formatNumber(
                  transferCount,
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
                Units Moved
              </span>

              <strong className="stat-value">
                {formatNumber(
                  totalUnitsMoved,
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="toolbar-card">
          <div className="toolbar-main">
            <div className="search-box">
              <Search size={16} />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search product, SKU, batch, serial, warehouse, reference…"
              />

              {search && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() =>
                    setSearch("")
                  }
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="filter-group">
              <div className="filter-label">
                <Filter size={13} />
                Filters
              </div>

              <select
                value={movementFilter}
                onChange={(event) =>
                  setMovementFilter(
                    event.target.value,
                  )
                }
              >
                <option value="all">
                  All Movement Types
                </option>

                <option value="in">
                  All Inbound
                </option>

                <option value="out">
                  All Outbound
                </option>

                <option value="stock_in">
                  Stock In
                </option>

                <option value="stock_out">
                  Stock Out
                </option>

                <option value="adjustment_in">
                  Adjustment In
                </option>

                <option value="adjustment_out">
                  Adjustment Out
                </option>

                <option value="transfer_in">
                  Transfer In
                </option>

                <option value="transfer_out">
                  Transfer Out
                </option>

                <option value="return">
                  Return
                </option>

                <option value="sale">
                  Sale
                </option>

                <option value="purchase">
                  Purchase
                </option>
              </select>

              <select
                value={warehouseFilter}
                onChange={(event) =>
                  setWarehouseFilter(
                    event.target.value,
                  )
                }
              >
                <option value="all">
                  All Warehouses
                </option>

                {warehouses.map(
                  (warehouse) => (
                    <option
                      key={warehouse.id}
                      value={warehouse.id}
                    >
                      {warehouse.name}
                    </option>
                  ),
                )}
              </select>

              <select
                value={dateFilter}
                onChange={(event) =>
                  setDateFilter(
                    event.target.value,
                  )
                }
              >
                <option value="all">
                  All Dates
                </option>

                <option value="today">
                  Today
                </option>

                <option value="7days">
                  Last 7 Days
                </option>

                <option value="30days">
                  Last 30 Days
                </option>
              </select>

              {hasFilters && (
                <button
                  type="button"
                  className="clear-filters"
                  onClick={
                    clearFilters
                  }
                >
                  <X size={13} />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="toolbar-footer">
            <span>
              Showing{" "}
              <strong>
                {filteredMovements.length ===
                0
                  ? 0
                  : (currentPage - 1) *
                      PAGE_SIZE +
                    1}
              </strong>{" "}
              –{" "}
              <strong>
                {Math.min(
                  currentPage *
                    PAGE_SIZE,
                  filteredMovements.length,
                )}
              </strong>{" "}
              of{" "}
              <strong>
                {formatNumber(
                  filteredMovements.length,
                )}
              </strong>{" "}
              movements
            </span>

            {hasFilters && (
              <span className="filtered-indicator">
                Filtered results
              </span>
            )}
          </div>
        </section>

        <section className="content-card">
          <div className="section-header">
            <div>
              <h2>
                Movement Ledger
              </h2>

              <p>
                Inventory movements are immutable
                audit records generated by inventory
                operations.
              </p>
            </div>
          </div>

          {paginatedMovements.length ===
          0 ? (
            <div className="empty-state">
              <FileText size={30} />

              <strong>
                No inventory movements found
              </strong>

              <p>
                {hasFilters
                  ? "Try changing your search or filters."
                  : "Inventory movements will appear here as stock is received, adjusted, transferred, sold, or returned."}
              </p>

              {hasFilters && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    clearFilters
                  }
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Movement</th>
                      <th>Product</th>
                      <th>Batch / Lot</th>
                      <th>Warehouse</th>
                      <th>Location</th>
                      <th>Serial</th>
                      <th>Quantity</th>
                      <th>Balance</th>
                      <th>Reference</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedMovements.map(
                      ({
                        movement,
                        product,
                        variant,
                        batch,
                        warehouse,
                        location,
                        unit,
                      }) => {
                        const direction =
                          movementDirection(
                            movement.movement_type,
                          );

                        return (
                          <tr
                            key={
                              movement.id
                            }
                          >
                            <td>
                              <div className="date-cell">
                                <strong>
                                  {formatDateTime(
                                    movement.created_at,
                                  )}
                                </strong>

                                {movement.created_by && (
                                  <span>
                                    User activity
                                  </span>
                                )}
                              </div>
                            </td>

                            <td>
                              <span
                                className={
                                  direction ===
                                  "in"
                                    ? "movement-badge movement-in"
                                    : direction ===
                                        "out"
                                      ? "movement-badge movement-out"
                                      : "movement-badge movement-neutral"
                                }
                              >
                                {direction ===
                                "in" ? (
                                  <ArrowUp
                                    size={13}
                                  />
                                ) : direction ===
                                  "out" ? (
                                  <ArrowDown
                                    size={13}
                                  />
                                ) : (
                                  <RefreshCw
                                    size={13}
                                  />
                                )}

                                {movementLabel(
                                  movement.movement_type,
                                )}
                              </span>
                            </td>

                            <td>
                              <div className="product-cell">
                                <strong>
                                  {product?.name ||
                                    "Unknown Product"}
                                </strong>

                                <span>
                                  {variant?.sku ||
                                    variant?.name ||
                                    "—"}
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
                                    {batch.status}
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
                              {unit ? (
                                <button
                                  type="button"
                                  className="serial-link"
                                  onClick={() =>
                                    router.push(
                                      `/serial-numbers/${unit.id}`,
                                    )
                                  }
                                >
                                  {unit.serial_number}
                                </button>
                              ) : (
                                <span className="muted">
                                  —
                                </span>
                              )}
                            </td>

                            <td>
                              <strong
                                className={
                                  direction ===
                                  "in"
                                    ? "quantity-positive"
                                    : direction ===
                                        "out"
                                      ? "quantity-negative"
                                      : "quantity-neutral"
                                }
                              >
                                {direction ===
                                "in"
                                  ? "+"
                                  : direction ===
                                      "out"
                                    ? "-"
                                    : ""}
                                {formatNumber(
                                  Math.abs(
                                    Number(
                                      movement.quantity ??
                                        0,
                                    ),
                                  ),
                                )}
                              </strong>
                            </td>

                            <td>
                              <div className="balance-cell">
                                <strong>
                                  {movement.quantity_after ??
                                    "—"}
                                </strong>

                                {movement.quantity_before !==
                                  null &&
                                  movement.quantity_after !==
                                    null && (
                                    <span>
                                      {
                                        movement.quantity_before
                                      }{" "}
                                      →{" "}
                                      {
                                        movement.quantity_after
                                      }
                                    </span>
                                  )}
                              </div>
                            </td>

                            <td>
                              <div className="reference-cell">
                                <strong>
                                  {referenceLabel(
                                    movement.reference_type,
                                  )}
                                </strong>

                                {movement.reference_id ? (
                                  <span
                                    title={
                                      movement.reference_id
                                    }
                                  >
                                    {movement.reference_id.slice(
                                      0,
                                      8,
                                    )}
                                    …
                                  </span>
                                ) : (
                                  <span>
                                    No reference
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span>
                  Page{" "}
                  <strong>
                    {currentPage}
                  </strong>{" "}
                  of{" "}
                  <strong>
                    {totalPages}
                  </strong>
                </span>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1,
                          ),
                      )
                    }
                    disabled={
                      currentPage <= 1
                    }
                  >
                    <ChevronLeft
                      size={15}
                    />
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.min(
                            totalPages,
                            current + 1,
                          ),
                      )
                    }
                    disabled={
                      currentPage >=
                      totalPages
                    }
                  >
                    Next
                    <ChevronRight
                      size={15}
                    />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="ledger-note">
          <div className="note-icon">
            <FileText size={18} />
          </div>

          <div>
            <strong>
              Inventory audit ledger
            </strong>

            <p>
              Every completed inventory operation
              creates an auditable movement record.
              Batch and batch-stock references identify
              the physical inventory affected, while an
              optional serialized-unit reference
              identifies a specific asset when one
              exists.
            </p>
          </div>
        </section>
      </div>

      <style jsx>{`
        .page-content {
          padding: 28px;
          max-width: 1800px;
          margin: 0 auto;
        }

        .top-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 22px;
        }

        button {
          font-family: inherit;
        }

        .back-button,
        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 38px;
          padding: 9px 13px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #fff;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .back-button:hover,
        .secondary-button:hover {
          background: #f8fafc;
          border-color: #bfc5ce;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .alert-card {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
          padding: 14px 16px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: #fff;
          color: #991b1b;
        }

        .alert-card strong {
          font-size: 13px;
        }

        .alert-card p {
          margin: 4px 0 0;
          color: #7f1d1d;
          font-size: 12px;
        }

        .alert-card button {
          border: 0;
          background: transparent;
          color: #991b1b;
          cursor: pointer;
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

        .ledger-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 11px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #fff;
          color: #475569;
          font-size: 12px;
          font-weight: 650;
          white-space: nowrap;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(
            6,
            minmax(0, 1fr)
          );
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
            0 1px 2px
              rgba(15, 23, 42, 0.03);
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

        .toolbar-card {
          margin-bottom: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #fff;
          box-shadow:
            0 1px 2px
              rgba(15, 23, 42, 0.03);
          overflow: hidden;
        }

        .toolbar-main {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px;
        }

        .search-box {
          min-width: 280px;
          flex: 1;
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 40px;
          padding: 0 11px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          color: #94a3b8;
        }

        .search-box:focus-within {
          border-color: #166534;
          box-shadow:
            0 0 0 3px
              rgba(
                22,
                101,
                52,
                0.07
              );
        }

        .search-box input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #1e293b;
          font-family: inherit;
          font-size: 13px;
        }

        .search-box input::placeholder {
          color: #94a3b8;
        }

        .clear-search {
          display: grid;
          place-items: center;
          padding: 3px;
          border: 0;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-label {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .filter-group select {
          min-height: 40px;
          padding: 0 29px 0 10px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #fff;
          color: #334155;
          font-family: inherit;
          font-size: 12px;
          outline: 0;
        }

        .filter-group select:focus {
          border-color: #166534;
        }

        .clear-filters {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 38px;
          padding: 7px 10px;
          border: 0;
          border-radius: 8px;
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
        }

        .toolbar-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          border-top: 1px solid #eef2f7;
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
        }

        .filtered-indicator {
          color: #166534;
          font-weight: 700;
        }

        .content-card {
          margin-bottom: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #fff;
          box-shadow:
            0 1px 2px
              rgba(15, 23, 42, 0.03);
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

        .table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1550px;
          border-collapse: collapse;
        }

        th {
          padding: 11px 13px;
          border-bottom: 1px solid #e5e7eb;
          background: #f8fafc;
          color: #64748b;
          font-size: 10px;
          font-weight: 750;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.045em;
          white-space: nowrap;
        }

        td {
          padding: 12px 13px;
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

        .date-cell strong {
          display: block;
          color: #334155;
          font-size: 11px;
          white-space: nowrap;
        }

        .date-cell span {
          display: block;
          margin-top: 3px;
          color: #94a3b8;
          font-size: 10px;
        }

        .movement-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 8px;
          border-radius: 7px;
          font-size: 10px;
          font-weight: 750;
          white-space: nowrap;
        }

        .movement-in {
          background: #f0fdf4;
          color: #166534;
        }

        .movement-out {
          background: #fef2f2;
          color: #b91c1c;
        }

        .movement-neutral {
          background: #f1f5f9;
          color: #475569;
        }

        .product-cell strong,
        .batch-cell strong,
        .location-cell strong,
        .balance-cell strong,
        .reference-cell strong {
          display: block;
          color: #1e293b;
          font-size: 11px;
          font-weight: 700;
        }

        .product-cell span,
        .batch-cell span,
        .location-cell span,
        .balance-cell span,
        .reference-cell span {
          display: block;
          margin-top: 3px;
          color: #94a3b8;
          font-size: 10px;
        }

        .batch-cell strong {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
        }

        .serial-link {
          padding: 0;
          border: 0;
          background: transparent;
          color: #166534;
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .serial-link:hover {
          text-decoration: underline;
        }

        .quantity-positive {
          color: #166534;
          font-size: 13px;
        }

        .quantity-negative {
          color: #b91c1c;
          font-size: 13px;
        }

        .quantity-neutral {
          color: #334155;
          font-size: 13px;
        }

        .muted {
          color: #94a3b8;
        }

        .empty-state {
          min-height: 280px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0;
          padding: 35px;
          color: #94a3b8;
          text-align: center;
        }

        .empty-state strong {
          margin-top: 10px;
          color: #334155;
          font-size: 14px;
        }

        .empty-state p {
          max-width: 500px;
          margin: 5px 0 15px;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.5;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 13px 16px;
          border-top: 1px solid #e5e7eb;
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
        }

        .pagination-buttons {
          display: flex;
          gap: 7px;
        }

        .pagination-buttons button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 34px;
          padding: 7px 10px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #fff;
          color: #334155;
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
        }

        .pagination-buttons button:hover:not(
            :disabled
          ) {
          background: #f8fafc;
        }

        .ledger-note {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px 17px;
          border: 1px solid #dbeafe;
          border-radius: 12px;
          background: #f8fbff;
        }

        .note-icon {
          width: 36px;
          height: 36px;
          flex: 0 0 36px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #eff6ff;
          color: #2563eb;
        }

        .ledger-note strong {
          display: block;
          color: #1e3a8a;
          font-size: 13px;
        }

        .ledger-note p {
          margin: 4px 0 0;
          color: #475569;
          font-size: 12px;
          line-height: 1.55;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1450px) {
          .stats-grid {
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
          }

          .toolbar-main {
            align-items: stretch;
            flex-direction: column;
          }

          .search-box {
            width: 100%;
            box-sizing: border-box;
          }

          .filter-group {
            width: 100%;
          }
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 20px 14px;
          }

          .page-header {
            flex-direction: column;
          }

          .ledger-badge {
            align-self: flex-start;
          }

          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .filter-group {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .filter-label {
            grid-column: span 2;
          }

          .filter-group select,
          .clear-filters {
            width: 100%;
            box-sizing: border-box;
          }
        }

        @media (max-width: 520px) {
          .top-actions {
            align-items: stretch;
          }

          .back-button,
          .secondary-button {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .toolbar-footer,
          .pagination {
            align-items: flex-start;
            flex-direction: column;
          }

          .filter-group {
            grid-template-columns: 1fr;
          }

          .filter-label {
            grid-column: auto;
          }

          .filter-group select,
          .clear-filters {
            grid-column: auto;
          }
        }
      `}</style>
    </AppShell>
  );
}