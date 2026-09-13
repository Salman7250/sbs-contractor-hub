"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type InventoryMovement = {
  id: string;
  company_id: string;
  inventory_id: string | null;
  product_id: string;
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
  brand: string | null;
  category: string | null;
  tracking_mode: string | null;
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
};

type Warehouse = {
  id: string;
  name: string;
  code: string | null;
};

type WarehouseLocation = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string | null;
};

type InventoryBatch = {
  id: string;
  product_id: string;
  variant_id: string | null;
  lot_number: string;
};

type SerializedUnit = {
  id: string;
  product_id: string;
  variant_id: string | null;
  serial_number: string;
  barcode: string | null;
};

type MovementFilter =
  | "all"
  | "stock_in"
  | "stock_out"
  | "sale"
  | "purchase"
  | "return"
  | "transfer_in"
  | "transfer_out"
  | "adjustment_in"
  | "adjustment_out";

const MOVEMENT_TYPES: {
  value: MovementFilter;
  label: string;
}[] = [
  { value: "all", label: "All Movement Types" },
  { value: "stock_in", label: "Stock In" },
  { value: "stock_out", label: "Stock Out" },
  { value: "sale", label: "Sale" },
  { value: "purchase", label: "Purchase" },
  { value: "return", label: "Return" },
  { value: "transfer_in", label: "Transfer In" },
  { value: "transfer_out", label: "Transfer Out" },
  { value: "adjustment_in", label: "Adjustment In" },
  { value: "adjustment_out", label: "Adjustment Out" },
];

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(Number(value ?? 0));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function titleCase(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getMovementClasses(movementType: string) {
  switch (movementType) {
    case "stock_in":
    case "purchase":
    case "transfer_in":
    case "adjustment_in":
      return {
        background: "#dcfce7",
        color: "#166534",
        border: "#bbf7d0",
      };

    case "stock_out":
    case "sale":
    case "transfer_out":
    case "adjustment_out":
      return {
        background: "#fee2e2",
        color: "#991b1b",
        border: "#fecaca",
      };

    case "return":
      return {
        background: "#dbeafe",
        color: "#1d4ed8",
        border: "#bfdbfe",
      };

    default:
      return {
        background: "#f3f4f6",
        color: "#374151",
        border: "#e5e7eb",
      };
  }
}

function getReferenceHref(
  referenceType: string | null,
  referenceId: string | null,
) {
  if (!referenceId) return null;

  switch ((referenceType ?? "").toLowerCase()) {
    case "purchase_order":
    case "purchase-order":
      return `/purchase-orders/${referenceId}`;

    case "sales_order":
    case "sales-order":
    case "order":
      return `/sales-orders/${referenceId}`;

    case "invoice":
      return `/invoices/${referenceId}`;

    case "receipt":
    case "stock_receipt":
    case "stock-receipt":
      return `/inventory/receipts/${referenceId}`;

    default:
      return null;
  }
}

export default function InventoryMovementsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [movements, setMovements] = useState<
    InventoryMovement[]
  >([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<
    WarehouseLocation[]
  >([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [serializedUnits, setSerializedUnits] = useState<
    SerializedUnit[]
  >([]);

  const [search, setSearch] = useState("");
  const [movementType, setMovementType] =
    useState<MovementFilter>("all");
  const [productFilter, setProductFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] =
    useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadPage = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("Your session has expired.");
        }

        const { data: memberships, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id);

        if (membershipError) {
          throw new Error(membershipError.message);
        }

        if (!memberships?.length) {
          throw new Error(
            "No company workspace is available for your account.",
          );
        }

        const companyId = memberships[0].company_id;

        const [
          movementsResult,
          productsResult,
          variantsResult,
          warehousesResult,
          locationsResult,
          batchesResult,
          serializedUnitsResult,
        ] = await Promise.all([
          supabase
            .from("inventory_movements")
            .select(`
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
            `)
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("products")
            .select(`
              id,
              name,
              brand,
              category,
              tracking_mode
            `)
            .eq("company_id", companyId)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("product_variants")
            .select(`
              id,
              product_id,
              name,
              sku
            `)
            .eq("company_id", companyId)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("warehouses")
            .select(`
              id,
              name,
              code
            `)
            .eq("company_id", companyId)
            .eq("is_active", true)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("warehouse_locations")
            .select(`
              id,
              warehouse_id,
              name,
              code
            `)
            .eq("company_id", companyId)
            .eq("is_active", true)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("inventory_batches")
            .select(`
              id,
              product_id,
              variant_id,
              lot_number
            `)
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("serialized_units")
            .select(`
              id,
              product_id,
              variant_id,
              serial_number,
              barcode
            `)
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (movementsResult.error) {
          throw new Error(
            movementsResult.error.message,
          );
        }

        if (productsResult.error) {
          throw new Error(
            productsResult.error.message,
          );
        }

        if (variantsResult.error) {
          throw new Error(
            variantsResult.error.message,
          );
        }

        if (warehousesResult.error) {
          throw new Error(
            warehousesResult.error.message,
          );
        }

        if (locationsResult.error) {
          throw new Error(
            locationsResult.error.message,
          );
        }

        if (batchesResult.error) {
          throw new Error(
            batchesResult.error.message,
          );
        }

        if (serializedUnitsResult.error) {
          throw new Error(
            serializedUnitsResult.error.message,
          );
        }

        setMovements(
          (movementsResult.data as InventoryMovement[]) ?? [],
        );

        setProducts(
          (productsResult.data as Product[]) ?? [],
        );

        setVariants(
          (variantsResult.data as ProductVariant[]) ?? [],
        );

        setWarehouses(
          (warehousesResult.data as Warehouse[]) ?? [],
        );

        setLocations(
          (locationsResult.data as WarehouseLocation[]) ?? [],
        );

        setBatches(
          (batchesResult.data as InventoryBatch[]) ?? [],
        );

        setSerializedUnits(
          (serializedUnitsResult.data as SerializedUnit[]) ?? [],
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
    void loadPage();
  }, [loadPage]);

  const productMap = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          product,
        ]),
      ),
    [products],
  );

  const variantMap = useMemo(
    () =>
      new Map(
        variants.map((variant) => [
          variant.id,
          variant,
        ]),
      ),
    [variants],
  );

  const warehouseMap = useMemo(
    () =>
      new Map(
        warehouses.map((warehouse) => [
          warehouse.id,
          warehouse,
        ]),
      ),
    [warehouses],
  );

  const locationMap = useMemo(
    () =>
      new Map(
        locations.map((location) => [
          location.id,
          location,
        ]),
      ),
    [locations],
  );

  const batchMap = useMemo(
    () =>
      new Map(
        batches.map((batch) => [
          batch.id,
          batch,
        ]),
      ),
    [batches],
  );

  const unitMap = useMemo(
    () =>
      new Map(
        serializedUnits.map((unit) => [
          unit.id,
          unit,
        ]),
      ),
    [serializedUnits],
  );

  const stats = useMemo(() => {
    const total = movements.length;

    const stockIn = movements.filter(
      (movement) =>
        movement.movement_type === "stock_in" ||
        movement.movement_type === "purchase" ||
        movement.movement_type === "transfer_in" ||
        movement.movement_type === "adjustment_in",
    ).length;

    const stockOut = movements.filter(
      (movement) =>
        movement.movement_type === "stock_out" ||
        movement.movement_type === "sale" ||
        movement.movement_type === "transfer_out" ||
        movement.movement_type === "adjustment_out",
    ).length;

    const sales = movements.filter(
      (movement) =>
        movement.movement_type === "sale",
    ).length;

    const returns = movements.filter(
      (movement) =>
        movement.movement_type === "return",
    ).length;

    return {
      total,
      stockIn,
      stockOut,
      sales,
      returns,
    };
  }, [movements]);

  const filteredMovements = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    const fromTime = dateFrom
      ? new Date(`${dateFrom}T00:00:00`).getTime()
      : null;

    const toTime = dateTo
      ? new Date(`${dateTo}T23:59:59.999`).getTime()
      : null;

    return movements.filter((movement) => {
      if (
        movementType !== "all" &&
        movement.movement_type !== movementType
      ) {
        return false;
      }

      if (
        productFilter !== "all" &&
        movement.product_id !== productFilter
      ) {
        return false;
      }

      if (
        warehouseFilter !== "all" &&
        movement.warehouse_id !== warehouseFilter
      ) {
        return false;
      }

      const movementTime = new Date(
        movement.created_at,
      ).getTime();

      if (
        fromTime !== null &&
        movementTime < fromTime
      ) {
        return false;
      }

      if (
        toTime !== null &&
        movementTime > toTime
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const product = productMap.get(
        movement.product_id,
      );

      const variant = movement.variant_id
        ? variantMap.get(movement.variant_id)
        : null;

      const batch = movement.batch_id
        ? batchMap.get(movement.batch_id)
        : null;

      const unit = movement.unit_id
        ? unitMap.get(movement.unit_id)
        : null;

      const warehouse = movement.warehouse_id
        ? warehouseMap.get(movement.warehouse_id)
        : null;

      const location = movement.location_id
        ? locationMap.get(movement.location_id)
        : null;

      const searchable = [
        movement.movement_type,
        movement.reason,
        movement.reference_type,
        movement.reference_id,
        movement.notes,
        movement.transaction_id,
        product?.name,
        product?.brand,
        product?.category,
        variant?.name,
        variant?.sku,
        batch?.lot_number,
        unit?.serial_number,
        unit?.barcode,
        warehouse?.name,
        warehouse?.code,
        location?.name,
        location?.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [
    movements,
    search,
    movementType,
    productFilter,
    warehouseFilter,
    dateFrom,
    dateTo,
    productMap,
    variantMap,
    batchMap,
    unitMap,
    warehouseMap,
    locationMap,
  ]);

  const clearFilters = () => {
    setSearch("");
    setMovementType("all");
    setProductFilter("all");
    setWarehouseFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <AppShell>
      <main className="page-content">
        <div className="page-shell">
          <div className="page-header">
            <div>
              <div className="eyebrow">
                PRODUCTS & INVENTORY
              </div>

              <h1>Inventory Movements</h1>

              <p>
                Complete audit ledger for stock movements,
                batches, warehouses, and serialized units.
              </p>
            </div>

            <div className="page-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void loadPage(true)}
                disabled={loading || refreshing}
              >
                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>
            </div>
          </div>

          {errorMessage ? (
            <div className="error-card">
              <div>
                <strong>
                  Unable to load inventory movements
                </strong>

                <span>{errorMessage}</span>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => void loadPage()}
              >
                Try Again
              </button>
            </div>
          ) : null}

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">
                Total Events
              </div>

              <div className="stat-value">
                {stats.total}
              </div>

              <div className="stat-description">
                Inventory movement records
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                Stock In
              </div>

              <div className="stat-value">
                {stats.stockIn}
              </div>

              <div className="stat-description">
                Receipts and inbound adjustments
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                Stock Out
              </div>

              <div className="stat-value">
                {stats.stockOut}
              </div>

              <div className="stat-description">
                Sales, transfers and outbound adjustments
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                Returns
              </div>

              <div className="stat-value">
                {stats.returns}
              </div>

              <div className="stat-description">
                Inventory returned into stock
              </div>
            </div>
          </section>

          <section className="secondary-stats">
            <div>
              <span>Sales Events</span>
              <strong>{stats.sales}</strong>
            </div>

            <div>
              <span>Products</span>
              <strong>{products.length}</strong>
            </div>

            <div>
              <span>Batches / Lots</span>
              <strong>{batches.length}</strong>
            </div>

            <div>
              <span>Serialized Units</span>
              <strong>
                {serializedUnits.length}
              </strong>
            </div>
          </section>

          <section className="content-card">
            <div className="filters-header">
              <div>
                <h2>Movement Ledger</h2>

                <p>
                  Search product, batch, serial, reference,
                  warehouse, reason, or transaction.
                </p>
              </div>

              <div className="result-count">
                {filteredMovements.length} of{" "}
                {movements.length}
              </div>
            </div>

            <div className="filters">
              <div className="search-wrapper">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search movement, product, batch, serial..."
                />
              </div>

              <select
                value={movementType}
                onChange={(event) =>
                  setMovementType(
                    event.target.value as MovementFilter,
                  )
                }
              >
                {MOVEMENT_TYPES.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={productFilter}
                onChange={(event) =>
                  setProductFilter(event.target.value)
                }
              >
                <option value="all">
                  All Products
                </option>

                {products.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.name}
                  </option>
                ))}
              </select>

              <select
                value={warehouseFilter}
                onChange={(event) =>
                  setWarehouseFilter(event.target.value)
                }
              >
                <option value="all">
                  All Warehouses
                </option>

                {warehouses.map((warehouse) => (
                  <option
                    key={warehouse.id}
                    value={warehouse.id}
                  >
                    {warehouse.name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={dateFrom}
                onChange={(event) =>
                  setDateFrom(event.target.value)
                }
              />

              <input
                type="date"
                value={dateTo}
                onChange={(event) =>
                  setDateTo(event.target.value)
                }
              />

              {(search ||
                movementType !== "all" ||
                productFilter !== "all" ||
                warehouseFilter !== "all" ||
                dateFrom ||
                dateTo) && (
                <button
                  type="button"
                  className="clear-button"
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="table-wrapper">
              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner" />

                  <span>
                    Loading inventory movements...
                  </span>
                </div>
              ) : filteredMovements.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    MOV
                  </div>

                  <h3>
                    {movements.length === 0
                      ? "No inventory movements yet"
                      : "No matching movements"}
                  </h3>

                  <p>
                    {movements.length === 0
                      ? "Inventory movement events will appear here as stock is received, sold, transferred, returned, or adjusted."
                      : "Try changing your search or filters."}
                  </p>

                  {movements.length > 0 ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={clearFilters}
                    >
                      Clear Filters
                    </button>
                  ) : null}
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Movement</th>
                      <th>Product</th>
                      <th>Batch / Lot</th>
                      <th>Serial Unit</th>
                      <th>Warehouse / Location</th>
                      <th>Qty</th>
                      <th>Before</th>
                      <th>After</th>
                      <th>Reference</th>
                      <th>Transaction</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMovements.map(
                      (movement) => {
                        const product =
                          productMap.get(
                            movement.product_id,
                          );

                        const variant =
                          movement.variant_id
                            ? variantMap.get(
                                movement.variant_id,
                              )
                            : null;

                        const batch =
                          movement.batch_id
                            ? batchMap.get(
                                movement.batch_id,
                              )
                            : null;

                        const unit =
                          movement.unit_id
                            ? unitMap.get(
                                movement.unit_id,
                              )
                            : null;

                        const warehouse =
                          movement.warehouse_id
                            ? warehouseMap.get(
                                movement.warehouse_id,
                              )
                            : null;

                        const location =
                          movement.location_id
                            ? locationMap.get(
                                movement.location_id,
                              )
                            : null;

                        const referenceHref =
                          getReferenceHref(
                            movement.reference_type,
                            movement.reference_id,
                          );

                        const movementClasses =
                          getMovementClasses(
                            movement.movement_type,
                          );

                        return (
                          <tr key={movement.id}>
                            <td>
                              <div className="cell-primary">
                                {formatDateTime(
                                  movement.created_at,
                                )}
                              </div>

                              {movement.created_by ? (
                                <div className="cell-secondary">
                                  User:{" "}
                                  {movement.created_by.slice(
                                    0,
                                    8,
                                  )}
                                  ...
                                </div>
                              ) : null}
                            </td>

                            <td>
                              <span
                                className="movement-badge"
                                style={{
                                  background:
                                    movementClasses.background,
                                  color:
                                    movementClasses.color,
                                  borderColor:
                                    movementClasses.border,
                                }}
                              >
                                {titleCase(
                                  movement.movement_type,
                                )}
                              </span>

                              {movement.reason ? (
                                <div className="cell-secondary">
                                  {movement.reason}
                                </div>
                              ) : null}
                            </td>

                            <td>
                              <div className="cell-primary">
                                {product?.name ||
                                  "Unknown Product"}
                              </div>

                              <div className="cell-secondary">
                                {variant?.sku ||
                                  variant?.name ||
                                  "Default Variant"}
                              </div>
                            </td>

                            <td>
                              {batch ? (
                                <Link
                                  href={`/inventory/batches/${batch.id}`}
                                  className="inline-link"
                                >
                                  {batch.lot_number}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td>
                              {unit ? (
                                <Link
                                  href={`/inventory/serial-numbers/${unit.id}`}
                                  className="inline-link"
                                >
                                  {unit.serial_number}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td>
                              <div className="cell-primary">
                                {warehouse?.name ||
                                  "—"}
                              </div>

                              {location?.name ? (
                                <div className="cell-secondary">
                                  {location.name}
                                </div>
                              ) : null}
                            </td>

                            <td className="numeric-cell">
                              {formatNumber(
                                movement.quantity,
                              )}
                            </td>

                            <td className="numeric-cell">
                              {formatNumber(
                                movement.quantity_before,
                              )}
                            </td>

                            <td className="numeric-cell">
                              {formatNumber(
                                movement.quantity_after,
                              )}
                            </td>

                            <td>
                              {movement.reference_id ? (
                                referenceHref ? (
                                  <Link
                                    href={
                                      referenceHref
                                    }
                                    className="inline-link"
                                  >
                                    {titleCase(
                                      movement.reference_type,
                                    )}
                                  </Link>
                                ) : (
                                  <div className="cell-primary">
                                    {titleCase(
                                      movement.reference_type,
                                    )}
                                  </div>
                                )
                              ) : (
                                <span className="muted">
                                  —
                                </span>
                              )}

                              {movement.reference_id ? (
                                <div className="cell-secondary">
                                  {movement.reference_id.slice(
                                    0,
                                    8,
                                  )}
                                  ...
                                </div>
                              ) : null}
                            </td>

                            <td>
                              {movement.transaction_id ? (
                                <div>
                                  <div className="cell-primary transaction-id">
                                    {movement.transaction_id.slice(
                                      0,
                                      8,
                                    )}
                                    ...
                                  </div>

                                  <div className="cell-secondary">
                                    Transaction
                                  </div>
                                </div>
                              ) : (
                                <span className="muted">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="content-card audit-info">
            <div className="audit-row">
              <div>
                <strong>
                  Inventory audit trail
                </strong>

                <span>
                  Movement records are displayed from the
                  authoritative inventory_movements ledger.
                </span>
              </div>

              <Link
                href="/inventory"
                className="secondary-button"
              >
                Back to Inventory
              </Link>
            </div>
          </section>
        </div>
      </main>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .page-shell {
          max-width: 1750px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin-bottom: 6px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        h1 {
          margin: 0;
          color: #111827;
          font-size: 28px;
          line-height: 1.15;
          font-weight: 700;
        }

        .page-header p {
          margin: 8px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .page-actions {
          display: flex;
          gap: 10px;
        }

        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 14px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #111827;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
        }

        .secondary-button:hover {
          background: #f9fafb;
        }

        .secondary-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .error-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
          margin-bottom: 20px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-radius: 12px;
        }

        .error-card > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .error-card strong {
          color: #9a3412;
          font-size: 13px;
        }

        .error-card span {
          color: #c2410c;
          font-size: 12px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .stat-card {
          padding: 20px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .stat-label {
          margin-bottom: 8px;
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
        }

        .stat-value {
          color: #111827;
          font-size: 25px;
          line-height: 1.15;
          font-weight: 700;
        }

        .stat-description {
          margin-top: 7px;
          color: #9ca3af;
          font-size: 12px;
        }

        .secondary-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1px;
          margin-bottom: 20px;
          background: #e5e7eb;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }

        .secondary-stats > div {
          padding: 14px 18px;
          background: #ffffff;
        }

        .secondary-stats span {
          display: block;
          margin-bottom: 4px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 600;
        }

        .secondary-stats strong {
          color: #111827;
          font-size: 15px;
          font-weight: 700;
        }

        .content-card {
          margin-bottom: 20px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          overflow: hidden;
        }

        .filters-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 20px 22px 16px;
        }

        .filters-header h2 {
          margin: 0;
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .filters-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .result-count {
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .filters {
          display: grid;
          grid-template-columns:
            minmax(280px, 1.7fr)
            minmax(170px, 1fr)
            minmax(180px, 1fr)
            minmax(180px, 1fr)
            150px
            150px
            auto;
          gap: 10px;
          padding: 0 22px 18px;
          border-bottom: 1px solid #f0f0f0;
        }

        .search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-wrapper svg {
          position: absolute;
          left: 12px;
          color: #9ca3af;
          pointer-events: none;
        }

        .search-wrapper input,
        .filters select,
        .filters > input {
          width: 100%;
          height: 38px;
          padding: 0 12px;
          box-sizing: border-box;
          color: #111827;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          outline: none;
          font-size: 13px;
        }

        .search-wrapper input {
          padding-left: 36px;
        }

        .search-wrapper input:focus,
        .filters select:focus,
        .filters > input:focus {
          border-color: #9ca3af;
          box-shadow:
            0 0 0 2px rgba(156, 163, 175, 0.15);
        }

        .clear-button {
          height: 38px;
          padding: 0 12px;
          border: 0;
          background: transparent;
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .clear-button:hover {
          color: #111827;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          min-width: 1550px;
          border-collapse: collapse;
        }

        .data-table th {
          padding: 12px 16px;
          background: #fafafa;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-align: left;
          white-space: nowrap;
        }

        .data-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #f0f0f0;
          color: #374151;
          font-size: 13px;
          vertical-align: middle;
        }

        .data-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .data-table tbody tr:hover {
          background: #fafafa;
        }

        .cell-primary {
          color: #111827;
          font-weight: 600;
        }

        .cell-secondary {
          margin-top: 4px;
          color: #9ca3af;
          font-size: 11px;
        }

        .movement-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 25px;
          padding: 0 9px;
          border: 1px solid transparent;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .inline-link {
          color: #2563eb;
          text-decoration: none;
          font-weight: 600;
        }

        .inline-link:hover {
          text-decoration: underline;
        }

        .muted {
          color: #9ca3af;
          font-size: 12px;
        }

        .numeric-cell {
          text-align: right;
          white-space: nowrap;
        }

        .transaction-id {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            "Liberation Mono",
            monospace;
          font-size: 12px;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 340px;
          gap: 12px;
          color: #6b7280;
          font-size: 13px;
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #e5e7eb;
          border-top-color: #6b7280;
          border-radius: 50%;
          animation: inventory-movements-spin 0.8s linear infinite;
        }

        @keyframes inventory-movements-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 340px;
          padding: 40px 24px;
          text-align: center;
        }

        .empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          margin-bottom: 14px;
          border-radius: 12px;
          background: #f3f4f6;
          color: #6b7280;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .empty-state h3 {
          margin: 0;
          color: #111827;
          font-size: 15px;
          font-weight: 700;
        }

        .empty-state p {
          max-width: 520px;
          margin: 7px 0 18px;
          color: #6b7280;
          font-size: 12px;
          line-height: 1.6;
        }

        .audit-info {
          padding: 0;
        }

        .audit-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 18px 22px;
        }

        .audit-row > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .audit-row strong {
          color: #111827;
          font-size: 13px;
        }

        .audit-row span {
          color: #6b7280;
          font-size: 12px;
        }

        @media (max-width: 1400px) {
          .filters {
            grid-template-columns:
              minmax(260px, 1.7fr)
              repeat(3, minmax(150px, 1fr))
              140px
              140px
              auto;
          }
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .secondary-stats {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .filters {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .search-wrapper {
            grid-column: 1 / -1;
          }

          .clear-button {
            justify-self: start;
          }
        }

        @media (max-width: 700px) {
          .page-content {
            padding: 18px;
          }

          .page-header {
            flex-direction: column;
          }

          .page-actions {
            width: 100%;
          }

          .page-actions > * {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .secondary-stats {
            grid-template-columns: 1fr;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .search-wrapper {
            grid-column: auto;
          }

          .filters-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .error-card,
          .audit-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .audit-row .secondary-button {
            width: 100%;
          }
        }

        @media print {
          .page-actions,
          .filters,
          .audit-info {
            display: none !important;
          }

          .page-content {
            padding: 0;
          }

          .content-card,
          .stat-card {
            box-shadow: none;
          }
        }
      `}</style>
    </AppShell>
  );
}