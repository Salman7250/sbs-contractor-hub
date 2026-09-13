"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

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

type Product = {
  id: string;
  name: string;
  brand: string | null;
};

type Variant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
};

type StockTransfer = {
  id: string;
  company_id: string;
  transfer_number: string;
  source_warehouse_id: string;
  source_location_id: string;
  destination_warehouse_id: string;
  destination_location_id: string;
  status: string | null;
  notes: string | null;
  created_by: string | null;
  completed_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
};

type TransferItem = {
  id: string;
  company_id: string;
  transfer_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  notes: string | null;
};

const STATUS_OPTIONS = [
  "all",
  "draft",
  "in_transit",
  "completed",
  "cancelled",
];

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function titleCase(value: string | null) {
  if (!value) return "Unknown";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClass(status: string | null) {
  switch (normalize(status)) {
    case "draft":
      return "status status-draft";

    case "in_transit":
      return "status status-transit";

    case "completed":
      return "status status-completed";

    case "cancelled":
      return "status status-cancelled";

    default:
      return "status status-neutral";
  }
}

function statusDescription(status: string | null) {
  switch (normalize(status)) {
    case "draft":
      return "Not dispatched";

    case "in_transit":
      return "Currently moving";

    case "completed":
      return "Received at destination";

    case "cancelled":
      return "Transfer cancelled";

    default:
      return "Unknown state";
  }
}

export default function InventoryTransfersPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [transfers, setTransfers] = useState<
    StockTransfer[]
  >([]);

  const [items, setItems] = useState<TransferItem[]>([]);
  const [warehouses, setWarehouses] = useState<
    Warehouse[]
  >([]);
  const [locations, setLocations] = useState<Location[]>(
    [],
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [warehouseFilter, setWarehouseFilter] =
    useState("all");
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 20;

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
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
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
          throw new Error(
            membershipError.message,
          );
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company membership found.",
          );
        }

        const companyId = membership.company_id;

        const [
          transfersResult,
          itemsResult,
          warehousesResult,
          locationsResult,
          productsResult,
          variantsResult,
        ] = await Promise.all([
          supabase
            .from("stock_transfers")
            .select(
              [
                "id",
                "company_id",
                "transfer_number",
                "source_warehouse_id",
                "source_location_id",
                "destination_warehouse_id",
                "destination_location_id",
                "status",
                "notes",
                "created_by",
                "completed_by",
                "created_at",
                "updated_at",
                "completed_at",
              ].join(","),
            )
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("stock_transfer_items")
            .select(
              [
                "id",
                "company_id",
                "transfer_id",
                "product_id",
                "variant_id",
                "quantity",
                "notes",
              ].join(","),
            )
            .eq("company_id", companyId),

          supabase
            .from("warehouses")
            .select("id,name,code")
            .eq("company_id", companyId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("warehouse_locations")
            .select(
              "id,warehouse_id,name,code",
            )
            .eq("company_id", companyId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("products")
            .select("id,name,brand")
            .eq("company_id", companyId)
            .order("name"),

          supabase
            .from("product_variants")
            .select(
              "id,product_id,name,sku",
            )
            .eq("company_id", companyId)
            .order("name"),
        ]);

        if (transfersResult.error) {
          throw new Error(
            transfersResult.error.message,
          );
        }

        if (itemsResult.error) {
          throw new Error(
            itemsResult.error.message,
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

        setTransfers(
          (transfersResult.data ??
            []) as unknown as StockTransfer[],
        );

        setItems(
          (itemsResult.data ??
            []) as unknown as TransferItem[],
        );

        setWarehouses(
          (warehousesResult.data ??
            []) as unknown as Warehouse[],
        );

        setLocations(
          (locationsResult.data ??
            []) as unknown as Location[],
        );

        setProducts(
          (productsResult.data ??
            []) as unknown as Product[],
        );

        setVariants(
          (variantsResult.data ??
            []) as unknown as Variant[],
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load transfers.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    warehouseFilter,
  ]);

  const warehouseMap = useMemo(() => {
    return new Map(
      warehouses.map((warehouse) => [
        warehouse.id,
        warehouse,
      ]),
    );
  }, [warehouses]);

  const locationMap = useMemo(() => {
    return new Map(
      locations.map((location) => [
        location.id,
        location,
      ]),
    );
  }, [locations]);

  const productMap = useMemo(() => {
    return new Map(
      products.map((product) => [
        product.id,
        product,
      ]),
    );
  }, [products]);

  const variantMap = useMemo(() => {
    return new Map(
      variants.map((variant) => [
        variant.id,
        variant,
      ]),
    );
  }, [variants]);

  const itemCountMap = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of items) {
      map.set(
        item.transfer_id,
        (map.get(item.transfer_id) ?? 0) + 1,
      );
    }

    return map;
  }, [items]);

  const quantityMap = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of items) {
      map.set(
        item.transfer_id,
        (map.get(item.transfer_id) ?? 0) +
          Number(item.quantity || 0),
      );
    }

    return map;
  }, [items]);

  const filteredTransfers = useMemo(() => {
    const q = normalize(search);

    return transfers.filter((transfer) => {
      const sourceWarehouse = warehouseMap.get(
        transfer.source_warehouse_id,
      );

      const destinationWarehouse =
        warehouseMap.get(
          transfer.destination_warehouse_id,
        );

      const sourceLocation = locationMap.get(
        transfer.source_location_id,
      );

      const destinationLocation =
        locationMap.get(
          transfer.destination_location_id,
        );

      const transferItems = items.filter(
        (item) =>
          item.transfer_id === transfer.id,
      );

      const itemSearchMatch = transferItems.some(
        (item) => {
          const product = productMap.get(
            item.product_id,
          );

          const variant = item.variant_id
            ? variantMap.get(item.variant_id)
            : null;

          return (
            normalize(product?.name).includes(q) ||
            normalize(product?.brand).includes(q) ||
            normalize(variant?.name).includes(q) ||
            normalize(variant?.sku).includes(q)
          );
        },
      );

      const matchesSearch =
        !q ||
        normalize(
          transfer.transfer_number,
        ).includes(q) ||
        normalize(
          sourceWarehouse?.name,
        ).includes(q) ||
        normalize(
          destinationWarehouse?.name,
        ).includes(q) ||
        normalize(
          sourceLocation?.name,
        ).includes(q) ||
        normalize(
          destinationLocation?.name,
        ).includes(q) ||
        itemSearchMatch;

      const matchesStatus =
        statusFilter === "all" ||
        normalize(transfer.status) ===
          normalize(statusFilter);

      const matchesWarehouse =
        warehouseFilter === "all" ||
        transfer.source_warehouse_id ===
          warehouseFilter ||
        transfer.destination_warehouse_id ===
          warehouseFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesWarehouse
      );
    });
  }, [
    transfers,
    items,
    search,
    statusFilter,
    warehouseFilter,
    warehouseMap,
    locationMap,
    productMap,
    variantMap,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredTransfers.length / PAGE_SIZE,
    ),
  );

  const paginatedTransfers = useMemo(() => {
    const start =
      (page - 1) * PAGE_SIZE;

    return filteredTransfers.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [filteredTransfers, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const stats = useMemo(() => {
    const total = transfers.length;

    const draft = transfers.filter(
      (transfer) =>
        normalize(transfer.status) === "draft",
    ).length;

    const inTransit = transfers.filter(
      (transfer) =>
        normalize(transfer.status) ===
        "in_transit",
    ).length;

    const completed = transfers.filter(
      (transfer) =>
        normalize(transfer.status) ===
        "completed",
    ).length;

    const cancelled = transfers.filter(
      (transfer) =>
        normalize(transfer.status) ===
        "cancelled",
    ).length;

    const units = items.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0),
      0,
    );

    return {
      total,
      draft,
      inTransit,
      completed,
      cancelled,
      units,
    };
  }, [transfers, items]);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (warehouseFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setWarehouseFilter("all");
  };

  return (
    <AppShell>
      <div className="page-content transfers-page">
        <div className="page-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Inventory Operations
            </div>

            <h1 className="page-title">
              Transfers
            </h1>

            <p className="page-subtitle">
              Move inventory between warehouses and
              locations while maintaining a complete
              transfer lifecycle.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                router.push(
                  "/inventory/transfers/new",
                )
              }
            >
              + New Transfer
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="error-card">
            <div>
              <strong>
                Unable to load transfers
              </strong>

              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              onClick={() => loadData()}
            >
              Retry
            </button>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Transfers
            </div>

            <div className="stat-value">
              {stats.total.toLocaleString()}
            </div>

            <div className="stat-meta">
              All transfer records
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Draft
            </div>

            <div className="stat-value">
              {stats.draft.toLocaleString()}
            </div>

            <div className="stat-meta">
              Awaiting dispatch
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              In Transit
            </div>

            <div className="stat-value">
              {stats.inTransit.toLocaleString()}
            </div>

            <div className="stat-meta transit-text">
              Currently moving
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Completed
            </div>

            <div className="stat-value">
              {stats.completed.toLocaleString()}
            </div>

            <div className="stat-meta positive">
              Received at destination
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Cancelled
            </div>

            <div className="stat-value">
              {stats.cancelled.toLocaleString()}
            </div>

            <div className="stat-meta danger-text">
              Cancelled transfers
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Units Transferred
            </div>

            <div className="stat-value">
              {stats.units.toLocaleString()}
            </div>

            <div className="stat-meta">
              Across all transfer items
            </div>
          </div>
        </div>

        <div className="toolbar-card">
          <div className="toolbar-main">
            <div className="search-wrap">
              <span className="search-icon">
                ⌕
              </span>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search transfer, warehouse, location, product or SKU..."
              />

              {search && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() =>
                    setSearch("")
                  }
                >
                  ×
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
            >
              {STATUS_OPTIONS.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status === "all"
                      ? "All statuses"
                      : titleCase(status)}
                  </option>
                ),
              )}
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
                All warehouses
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
          </div>

          <div className="toolbar-footer">
            <div className="result-summary">
              <strong>
                {filteredTransfers.length.toLocaleString()}
              </strong>{" "}
              transfers
              {activeFilterCount > 0 && (
                <>
                  {" "}
                  · {activeFilterCount} filter
                  {activeFilterCount === 1
                    ? ""
                    : "s"}{" "}
                  active
                </>
              )}
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                className="clear-filters"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="content-card">
          <div className="content-card-header">
            <div>
              <h2>
                Inventory Transfers
              </h2>

              <p>
                Warehouse-to-warehouse and
                location-to-location inventory
                movements.
              </p>
            </div>

            <div className="header-count">
              {filteredTransfers.length.toLocaleString()}
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner" />

              <span>
                Loading transfers...
              </span>
            </div>
          ) : filteredTransfers.length ===
            0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                ⇄
              </div>

              <h3>
                {transfers.length === 0
                  ? "No transfers yet"
                  : "No matching transfers"}
              </h3>

              <p>
                {transfers.length === 0
                  ? "Create a transfer when inventory needs to move between warehouse locations."
                  : "Try changing your search or filters."}
              </p>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Transfer
                      </th>

                      <th>
                        From
                      </th>

                      <th>
                        To
                      </th>

                      <th>
                        Items
                      </th>

                      <th>
                        Units
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Created
                      </th>

                      <th>
                        Completed
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedTransfers.map(
                      (transfer) => {
                        const sourceWarehouse =
                          warehouseMap.get(
                            transfer.source_warehouse_id,
                          );

                        const destinationWarehouse =
                          warehouseMap.get(
                            transfer.destination_warehouse_id,
                          );

                        const sourceLocation =
                          locationMap.get(
                            transfer.source_location_id,
                          );

                        const destinationLocation =
                          locationMap.get(
                            transfer.destination_location_id,
                          );

                        return (
                          <tr
                            key={
                              transfer.id
                            }
                          >
                            <td>
                              <button
                                type="button"
                                className="transfer-link"
                                onClick={() =>
                                  router.push(
                                    `/inventory/transfers/${transfer.id}`,
                                  )
                                }
                              >
                                <span>
                                  {
                                    transfer.transfer_number
                                  }
                                </span>

                                <small>
                                  {transfer.id.slice(
                                    0,
                                    8,
                                  )}
                                </small>
                              </button>
                            </td>

                            <td>
                              <div className="route-cell">
                                <strong>
                                  {sourceWarehouse?.name ??
                                    "Unknown"}
                                </strong>

                                <span>
                                  {sourceLocation?.name ??
                                    "Unknown location"}
                                </span>

                                {sourceWarehouse?.code && (
                                  <small>
                                    {
                                      sourceWarehouse.code
                                    }
                                  </small>
                                )}
                              </div>
                            </td>

                            <td>
                              <div className="route-cell">
                                <strong>
                                  {destinationWarehouse?.name ??
                                    "Unknown"}
                                </strong>

                                <span>
                                  {destinationLocation?.name ??
                                    "Unknown location"}
                                </span>

                                {destinationWarehouse?.code && (
                                  <small>
                                    {
                                      destinationWarehouse.code
                                    }
                                  </small>
                                )}
                              </div>
                            </td>

                            <td className="number-cell">
                              {(
                                itemCountMap.get(
                                  transfer.id,
                                ) ?? 0
                              ).toLocaleString()}
                            </td>

                            <td className="number-cell">
                              {(
                                quantityMap.get(
                                  transfer.id,
                                ) ?? 0
                              ).toLocaleString()}
                            </td>

                            <td>
                              <div className="status-cell">
                                <span
                                  className={statusClass(
                                    transfer.status,
                                  )}
                                >
                                  <span className="status-dot" />

                                  {titleCase(
                                    transfer.status,
                                  )}
                                </span>

                                <small>
                                  {statusDescription(
                                    transfer.status,
                                  )}
                                </small>
                              </div>
                            </td>

                            <td className="date-cell">
                              {formatDateTime(
                                transfer.created_at,
                              )}
                            </td>

                            <td className="date-cell">
                              {formatDateTime(
                                transfer.completed_at,
                              )}
                            </td>

                            <td>
                              <button
                                type="button"
                                className="view-button"
                                onClick={() =>
                                  router.push(
                                    `/inventory/transfers/${transfer.id}`,
                                  )
                                }
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Showing{" "}
                  <strong>
                    {Math.min(
                      (page - 1) *
                        PAGE_SIZE +
                        1,
                      filteredTransfers.length,
                    )}
                  </strong>{" "}
                  –{" "}
                  <strong>
                    {Math.min(
                      page * PAGE_SIZE,
                      filteredTransfers.length,
                    )}
                  </strong>{" "}
                  of{" "}
                  <strong>
                    {filteredTransfers.length}
                  </strong>
                </div>

                <div className="pagination-actions">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1,
                          ),
                      )
                    }
                  >
                    Previous
                  </button>

                  <span>
                    Page {page} of{" "}
                    {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={
                      page >=
                      totalPages
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.min(
                            totalPages,
                            current + 1,
                          ),
                      )
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .transfers-page {
          padding-bottom: 40px;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 7px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
        }

        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #16a34a;
          box-shadow: 0 0 0 3px #dcfce7;
        }

        .page-title {
          margin: 0;
          font-size: 30px;
          line-height: 1.15;
          font-weight: 750;
          letter-spacing: -0.025em;
          color: #0f172a;
        }

        .page-subtitle {
          margin: 7px 0 0;
          font-size: 14px;
          line-height: 1.5;
          color: #64748b;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .primary-button,
        .secondary-button {
          height: 40px;
          padding: 0 15px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
        }

        .primary-button {
          border: 1px solid #166534;
          background: #166534;
          color: white;
          box-shadow: 0 1px 2px
            rgba(15, 23, 42, 0.08);
        }

        .primary-button:hover {
          background: #14532d;
        }

        .secondary-button {
          border: 1px solid #d1d5db;
          background: white;
          color: #334155;
        }

        .secondary-button:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .secondary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
          padding: 14px 16px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: #fef2f2;
          color: #991b1b;
        }

        .error-card strong {
          display: block;
          font-size: 13px;
        }

        .error-card p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #b91c1c;
        }

        .error-card button {
          border: 1px solid #fecaca;
          background: white;
          color: #991b1b;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(
            6,
            minmax(0, 1fr)
          );
          gap: 14px;
          margin-bottom: 18px;
        }

        .stat-card {
          min-width: 0;
          padding: 17px 18px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: white;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.035);
        }

        .stat-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 650;
          color: #64748b;
        }

        .stat-value {
          margin-top: 8px;
          font-size: 25px;
          line-height: 1;
          font-weight: 750;
          letter-spacing: -0.02em;
          color: #0f172a;
        }

        .stat-meta {
          margin-top: 9px;
          font-size: 11px;
          color: #94a3b8;
        }

        .stat-meta.positive {
          color: #15803d;
        }

        .stat-meta.transit-text {
          color: #2563eb;
        }

        .stat-meta.danger-text {
          color: #dc2626;
        }

        .toolbar-card {
          margin-bottom: 18px;
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: white;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.035);
        }

        .toolbar-main {
          display: grid;
          grid-template-columns:
            minmax(300px, 1fr)
            180px
            200px;
          gap: 9px;
        }

        .search-wrap {
          position: relative;
          min-width: 0;
        }

        .search-wrap input,
        .toolbar-main select {
          width: 100%;
          height: 40px;
          border: 1px solid #dbe1e8;
          border-radius: 9px;
          background: white;
          color: #334155;
          font-size: 13px;
          outline: none;
        }

        .search-wrap input {
          padding: 0 38px 0 37px;
        }

        .toolbar-main select {
          padding: 0 30px 0 11px;
        }

        .search-wrap input:focus,
        .toolbar-main select:focus {
          border-color: #86a98f;
          box-shadow: 0 0 0 3px
            rgba(22, 101, 52, 0.08);
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-52%);
          font-size: 18px;
          color: #94a3b8;
          pointer-events: none;
        }

        .clear-search {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 25px;
          height: 25px;
          border: 0;
          border-radius: 6px;
          background: #f1f5f9;
          color: #64748b;
          cursor: pointer;
          font-size: 17px;
          line-height: 1;
        }

        .toolbar-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 11px;
          padding: 0 2px;
        }

        .result-summary {
          font-size: 12px;
          color: #94a3b8;
        }

        .result-summary strong {
          color: #475569;
        }

        .clear-filters {
          border: 0;
          background: transparent;
          color: #166534;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
        }

        .content-card {
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: white;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.035);
        }

        .content-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 17px 18px;
          border-bottom: 1px solid #e5e7eb;
        }

        .content-card-header h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #1e293b;
        }

        .content-card-header p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #94a3b8;
        }

        .header-count {
          min-width: 36px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 10px;
          border-radius: 8px;
          background: #f1f5f9;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1380px;
          border-collapse: collapse;
          table-layout: fixed;
        }

        th {
          height: 42px;
          padding: 0 13px;
          border-bottom: 1px solid #e5e7eb;
          background: #f8fafc;
          color: #64748b;
          font-size: 10.5px;
          font-weight: 750;
          letter-spacing: 0.045em;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }

        td {
          height: 76px;
          padding: 10px 13px;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          font-size: 12px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #fafcfb;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        th:nth-child(1) {
          width: 145px;
        }

        th:nth-child(2) {
          width: 190px;
        }

        th:nth-child(3) {
          width: 190px;
        }

        th:nth-child(4) {
          width: 70px;
        }

        th:nth-child(5) {
          width: 80px;
        }

        th:nth-child(6) {
          width: 150px;
        }

        th:nth-child(7) {
          width: 155px;
        }

        th:nth-child(8) {
          width: 155px;
        }

        th:nth-child(9) {
          width: 75px;
        }

        .transfer-link {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
          text-align: left;
        }

        .transfer-link span {
          color: #166534;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }

        .transfer-link:hover span {
          text-decoration: underline;
        }

        .transfer-link small {
          margin-top: 4px;
          color: #94a3b8;
          font-size: 10px;
        }

        .route-cell {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .route-cell strong {
          overflow: hidden;
          color: #334155;
          font-size: 12px;
          font-weight: 650;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .route-cell span {
          margin-top: 3px;
          overflow: hidden;
          color: #64748b;
          font-size: 10.5px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .route-cell small {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 10px;
        }

        .number-cell {
          color: #334155;
          font-weight: 650;
          white-space: nowrap;
        }

        .status-cell {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .status-cell small {
          color: #94a3b8;
          font-size: 9.5px;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 26px;
          padding: 0 8px;
          border: 1px solid transparent;
          border-radius: 7px;
          font-size: 10.5px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: currentColor;
        }

        .status-draft {
          border-color: #e2e8f0;
          background: #f8fafc;
          color: #64748b;
        }

        .status-transit {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #2563eb;
        }

        .status-completed {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #15803d;
        }

        .status-cancelled {
          border-color: #fecaca;
          background: #fef2f2;
          color: #dc2626;
        }

        .status-neutral {
          border-color: #e2e8f0;
          background: #f8fafc;
          color: #64748b;
        }

        .date-cell {
          color: #64748b;
          font-size: 11px;
          white-space: nowrap;
        }

        .view-button {
          height: 31px;
          padding: 0 10px;
          border: 1px solid #dbe1e8;
          border-radius: 7px;
          background: white;
          color: #475569;
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
        }

        .view-button:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .loading-state {
          min-height: 330px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #94a3b8;
          font-size: 13px;
        }

        .spinner {
          width: 25px;
          height: 25px;
          border: 2px solid #e2e8f0;
          border-top-color: #166534;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .empty-state {
          min-height: 330px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
          border-radius: 12px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 21px;
          font-weight: 700;
        }

        .empty-state h3 {
          margin: 0;
          color: #334155;
          font-size: 15px;
          font-weight: 700;
        }

        .empty-state p {
          max-width: 460px;
          margin: 7px 0 16px;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.55;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 13px 16px;
          border-top: 1px solid #e5e7eb;
        }

        .pagination-info {
          color: #94a3b8;
          font-size: 11.5px;
        }

        .pagination-info strong {
          color: #475569;
        }

        .pagination-actions {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .pagination-actions button {
          height: 32px;
          padding: 0 11px;
          border: 1px solid #dbe1e8;
          border-radius: 7px;
          background: white;
          color: #475569;
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
        }

        .pagination-actions button:hover:not(
            :disabled
          ) {
          background: #f8fafc;
        }

        .pagination-actions button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .pagination-actions span {
          min-width: 85px;
          color: #64748b;
          font-size: 11px;
          text-align: center;
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
        }

        @media (max-width: 900px) {
          .page-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .toolbar-main {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .header-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .header-actions button {
            width: 100%;
          }

          .pagination {
            align-items: flex-start;
            flex-direction: column;
          }

          .pagination-actions {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </AppShell>
  );
}