"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Eye,
  RefreshCw,
  Search,
} from "lucide-react";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Adjustment = {
  id: string;
  company_id: string;
  adjustment_number: string;
  reason: string | null;
  notes: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type AdjustmentItem = {
  id: string;
  adjustment_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  direction: "in" | "out";
  reason: string | null;
  warehouse_id: string | null;
  location_id: string | null;
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  tracking_mode: string | null;
};

type Variant = {
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

type Location = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string | null;
};

type AdjustmentRow = {
  adjustment: Adjustment;
  items: AdjustmentItem[];
  itemCount: number;
  totalUnits: number;
  unitsIn: number;
  unitsOut: number;
  products: Product[];
  warehouses: Warehouse[];
};

const PAGE_SIZE = 20;

function getCurrentCompanyId(): string | null {
  if (typeof window === "undefined") return null;

  const keys = [
    "sbs_current_company_id",
    "current_company_id",
    "currentCompanyId",
    "selected_company_id",
    "selectedCompanyId",
  ];

  for (const key of keys) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }

  return null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
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

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function statusLabel(status: string | null | undefined) {
  if (!status) return "Unknown";

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function trackingLabel(value: string | null | undefined) {
  if (!value) return "—";

  if (value === "quantity") return "Quantity";
  if (value === "batch") return "Batch";
  if (value === "serial") return "Serial";
  if (value === "none") return "Not Tracked";

  return value;
}

export default function InventoryAdjustmentsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [items, setItems] = useState<AdjustmentItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);

  const resolveCompany = useCallback(async () => {
    const storedCompanyId = getCurrentCompanyId();

    if (storedCompanyId) {
      setCompanyId(storedCompanyId);
      return storedCompanyId;
    }

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be signed in to view inventory adjustments.");
    }

    const { data, error } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data?.company_id) {
      throw new Error("No company is associated with your account.");
    }

    setCompanyId(data.company_id);

    return data.company_id;
  }, [supabase]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage(null);

        const currentCompanyId = await resolveCompany();

        const [
          adjustmentsResult,
          itemsResult,
          productsResult,
          variantsResult,
          warehousesResult,
          locationsResult,
        ] = await Promise.all([
          supabase
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
            .eq("company_id", currentCompanyId)
            .order("created_at", { ascending: false }),

          supabase
            .from("stock_adjustment_items")
            .select(
              `
                id,
                adjustment_id,
                product_id,
                variant_id,
                quantity,
                direction,
                reason,
                warehouse_id,
                location_id
              `,
            )
            .eq("company_id", currentCompanyId),

          supabase
            .from("products")
            .select(
              `
                id,
                name,
                brand,
                category,
                tracking_mode
              `,
            )
            .eq("company_id", currentCompanyId),

          supabase
            .from("product_variants")
            .select(
              `
                id,
                product_id,
                name,
                sku
              `,
            )
            .eq("company_id", currentCompanyId),

          supabase
            .from("warehouses")
            .select("id,name,code")
            .eq("company_id", currentCompanyId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("warehouse_locations")
            .select("id,warehouse_id,name,code")
            .eq("company_id", currentCompanyId)
            .eq("is_active", true)
            .order("name"),
        ]);

        if (adjustmentsResult.error) throw adjustmentsResult.error;
        if (itemsResult.error) throw itemsResult.error;
        if (productsResult.error) throw productsResult.error;
        if (variantsResult.error) throw variantsResult.error;
        if (warehousesResult.error) throw warehousesResult.error;
        if (locationsResult.error) throw locationsResult.error;

        setAdjustments(
          (adjustmentsResult.data ?? []) as Adjustment[],
        );

        setItems((itemsResult.data ?? []) as AdjustmentItem[]);
        setProducts((productsResult.data ?? []) as Product[]);
        setVariants((variantsResult.data ?? []) as Variant[]);
        setWarehouses((warehousesResult.data ?? []) as Warehouse[]);
        setLocations((locationsResult.data ?? []) as Location[]);
      } catch (error) {
        console.error("Failed to load inventory adjustments:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load inventory adjustments.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [resolveCompany, supabase],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const variantMap = useMemo(
    () => new Map(variants.map((variant) => [variant.id, variant])),
    [variants],
  );

  const warehouseMap = useMemo(
    () =>
      new Map(
        warehouses.map((warehouse) => [warehouse.id, warehouse]),
      ),
    [warehouses],
  );

  const locationMap = useMemo(
    () =>
      new Map(
        locations.map((location) => [location.id, location]),
      ),
    [locations],
  );

  const itemsByAdjustment = useMemo(() => {
    const map = new Map<string, AdjustmentItem[]>();

    for (const item of items) {
      const existing = map.get(item.adjustment_id) ?? [];
      existing.push(item);
      map.set(item.adjustment_id, existing);
    }

    return map;
  }, [items]);

  const rows = useMemo<AdjustmentRow[]>(() => {
    return adjustments.map((adjustment) => {
      const adjustmentItems =
        itemsByAdjustment.get(adjustment.id) ?? [];

      const adjustmentProducts = adjustmentItems
        .map((item) => productMap.get(item.product_id))
        .filter(Boolean) as Product[];

      const adjustmentWarehouses = adjustmentItems
        .map((item) =>
          item.warehouse_id
            ? warehouseMap.get(item.warehouse_id)
            : undefined,
        )
        .filter(Boolean) as Warehouse[];

      const unitsIn = adjustmentItems
        .filter((item) => item.direction === "in")
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

      const unitsOut = adjustmentItems
        .filter((item) => item.direction === "out")
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

      return {
        adjustment,
        items: adjustmentItems,
        itemCount: adjustmentItems.length,
        totalUnits: unitsIn + unitsOut,
        unitsIn,
        unitsOut,
        products: adjustmentProducts,
        warehouses: adjustmentWarehouses,
      };
    });
  }, [
    adjustments,
    itemsByAdjustment,
    productMap,
    warehouseMap,
  ]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      const adjustment = row.adjustment;

      if (
        statusFilter !== "all" &&
        adjustment.status !== statusFilter
      ) {
        return false;
      }

      if (warehouseFilter !== "all") {
        const hasWarehouse = row.items.some(
          (item) => item.warehouse_id === warehouseFilter,
        );

        if (!hasWarehouse) return false;
      }

      if (!normalizedSearch) return true;

      const productText = row.products
        .map((product) =>
          [
            product.name,
            product.brand,
            product.category,
            trackingLabel(product.tracking_mode),
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join(" ");

      const variantText = row.items
        .map((item) => {
          const variant = variantMap.get(item.variant_id);

          return [
            variant?.name,
            variant?.sku,
          ]
            .filter(Boolean)
            .join(" ");
        })
        .join(" ");

      const warehouseText = row.items
        .map((item) => {
          const warehouse = item.warehouse_id
            ? warehouseMap.get(item.warehouse_id)
            : undefined;

          const location = item.location_id
            ? locationMap.get(item.location_id)
            : undefined;

          return [
            warehouse?.name,
            warehouse?.code,
            location?.name,
            location?.code,
          ]
            .filter(Boolean)
            .join(" ");
        })
        .join(" ");

      const searchableText = [
        adjustment.adjustment_number,
        adjustment.reason,
        adjustment.notes,
        productText,
        variantText,
        warehouseText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [
    rows,
    searchTerm,
    statusFilter,
    warehouseFilter,
    variantMap,
    warehouseMap,
    locationMap,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, warehouseFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / PAGE_SIZE),
  );

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const stats = useMemo(() => {
    const total = adjustments.length;

    const draft = adjustments.filter(
      (adjustment) => adjustment.status === "draft",
    ).length;

    const completed = adjustments.filter(
      (adjustment) => adjustment.status === "completed",
    ).length;

    const cancelled = adjustments.filter(
      (adjustment) => adjustment.status === "cancelled",
    ).length;

    const unitsIn = items
      .filter((item) => item.direction === "in")
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    const unitsOut = items
      .filter((item) => item.direction === "out")
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    return {
      total,
      draft,
      completed,
      cancelled,
      unitsIn,
      unitsOut,
    };
  }, [adjustments, items]);

  const visibleStart =
    filteredRows.length === 0
      ? 0
      : (currentPage - 1) * PAGE_SIZE + 1;

  const visibleEnd = Math.min(
    currentPage * PAGE_SIZE,
    filteredRows.length,
  );

  const renderStatus = (status: string | null) => {
    const normalized = status ?? "unknown";

    return (
      <span
        className={`status-badge status-${normalized.replace(
          /_/g,
          "-",
        )}`}
      >
        <span className="status-dot" />
        {statusLabel(status)}
      </span>
    );
  };

  const getPrimaryLocation = (row: AdjustmentRow) => {
    const first = row.items[0];

    if (!first) return "—";

    const warehouse = first.warehouse_id
      ? warehouseMap.get(first.warehouse_id)
      : undefined;

    const location = first.location_id
      ? locationMap.get(first.location_id)
      : undefined;

    if (!warehouse && !location) return "—";

    if (warehouse && location) {
      return `${warehouse.name} / ${location.name}`;
    }

    return warehouse?.name ?? location?.name ?? "—";
  };

  const getProductSummary = (row: AdjustmentRow) => {
    if (row.products.length === 0) return "—";

    const uniqueProducts = Array.from(
      new Map(
        row.products.map((product) => [product.id, product]),
      ).values(),
    );

    if (uniqueProducts.length === 1) {
      return uniqueProducts[0].name;
    }

    return `${uniqueProducts[0].name} + ${
      uniqueProducts.length - 1
    } more`;
  };

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <div className="page-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Inventory Adjustments
            </div>

            <h1 className="page-title">
              Stock Adjustments
            </h1>

            <p className="page-subtitle">
              Record controlled inventory corrections, increases,
              and decreases across your warehouses.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadData(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={15}
                className={refreshing ? "spin" : ""}
              />
              Refresh
            </button>

            <Link
              href="/inventory/adjustments/new"
              className="primary-button"
            >
              <ClipboardList size={15} />
              New Adjustment
            </Link>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Adjustments
            </div>
            <div className="stat-value">
              {formatNumber(stats.total)}
            </div>
            <div className="stat-meta">
              All adjustment documents
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Draft</div>
            <div className="stat-value">
              {formatNumber(stats.draft)}
            </div>
            <div className="stat-meta">
              Awaiting completion
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Completed</div>
            <div className="stat-value">
              {formatNumber(stats.completed)}
            </div>
            <div className="stat-meta">
              Applied to inventory
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Cancelled</div>
            <div className="stat-value">
              {formatNumber(stats.cancelled)}
            </div>
            <div className="stat-meta">
              Not applied
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Units Increased</div>
            <div className="stat-value stat-positive">
              +{formatNumber(stats.unitsIn)}
            </div>
            <div className="stat-meta">
              Adjustment-in quantity
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Units Decreased</div>
            <div className="stat-value stat-negative">
              -{formatNumber(stats.unitsOut)}
            </div>
            <div className="stat-meta">
              Adjustment-out quantity
            </div>
          </div>
        </div>

        <div className="toolbar-card">
          <div className="search-wrap">
            <Search size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Search adjustment, product, SKU, warehouse..."
            />
          </div>

          <div className="filter-wrap">
            <label htmlFor="adjustment-status">
              Status
            </label>

            <select
              id="adjustment-status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="filter-wrap">
            <label htmlFor="adjustment-warehouse">
              Warehouse
            </label>

            <select
              id="adjustment-warehouse"
              value={warehouseFilter}
              onChange={(event) =>
                setWarehouseFilter(event.target.value)
              }
            >
              <option value="all">All Warehouses</option>

              {warehouses.map((warehouse) => (
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
          </div>
        </div>

        {errorMessage ? (
          <div className="error-card">
            <div className="error-title">
              Unable to load adjustments
            </div>
            <div className="error-message">
              {errorMessage}
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadData(true)}
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="content-card">
            <div className="content-card-header">
              <div>
                <div className="section-title">
                  Adjustment Register
                </div>

                <div className="section-subtitle">
                  {filteredRows.length === 0
                    ? "No adjustments match the current filters."
                    : `Showing ${formatNumber(
                        visibleStart,
                      )}–${formatNumber(
                        visibleEnd,
                      )} of ${formatNumber(
                        filteredRows.length,
                      )}`}
                </div>
              </div>

              <div className="result-count">
                {formatNumber(filteredRows.length)} results
              </div>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner" />
                <div>Loading adjustments...</div>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <ClipboardList size={22} />
                </div>

                <div className="empty-title">
                  No adjustments found
                </div>

                <div className="empty-text">
                  Create an adjustment when physical inventory
                  needs a controlled quantity correction.
                </div>

                <Link
                  href="/inventory/adjustments/new"
                  className="primary-button"
                >
                  <ClipboardList size={15} />
                  Create Adjustment
                </Link>
              </div>
            ) : (
              <>
                <div className="table-scroll">
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th>Adjustment</th>
                        <th>Reason</th>
                        <th>Product</th>
                        <th>Items</th>
                        <th>Units</th>
                        <th>Warehouse / Location</th>
                        <th>Direction</th>
                        <th>Created</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedRows.map((row) => {
                        const adjustment =
                          row.adjustment;

                        const directions = Array.from(
                          new Set(
                            row.items.map(
                              (item) => item.direction,
                            ),
                          ),
                        );

                        return (
                          <tr key={adjustment.id}>
                            <td>
                              <Link
                                href={`/inventory/adjustments/${adjustment.id}`}
                                className="adjustment-link"
                              >
                                {adjustment.adjustment_number}
                              </Link>

                              <div className="cell-muted">
                                {formatDateTime(
                                  adjustment.created_at,
                                )}
                              </div>
                            </td>

                            <td>
                              <div className="cell-primary">
                                {adjustment.reason ||
                                  "Inventory correction"}
                              </div>

                              {adjustment.notes ? (
                                <div className="cell-muted">
                                  {adjustment.notes.length > 70
                                    ? `${adjustment.notes.slice(
                                        0,
                                        70,
                                      )}…`
                                    : adjustment.notes}
                                </div>
                              ) : null}
                            </td>

                            <td>
                              <div className="cell-primary">
                                {getProductSummary(row)}
                              </div>

                              {row.products.length > 0 ? (
                                <div className="cell-muted">
                                  {trackingLabel(
                                    row.products[0]
                                      .tracking_mode,
                                  )}
                                </div>
                              ) : null}
                            </td>

                            <td>
                              <span className="number-cell">
                                {formatNumber(row.itemCount)}
                              </span>
                            </td>

                            <td>
                              <div className="units-cell">
                                <span className="units-total">
                                  {formatNumber(row.totalUnits)}
                                </span>

                                <span className="units-breakdown">
                                  +{formatNumber(row.unitsIn)}
                                  {" / "}
                                  -{formatNumber(row.unitsOut)}
                                </span>
                              </div>
                            </td>

                            <td>
                              <div className="cell-primary">
                                {getPrimaryLocation(row)}
                              </div>
                            </td>

                            <td>
                              <div className="direction-list">
                                {directions.includes("in") ? (
                                  <span className="direction-badge direction-in">
                                    <ArrowUp size={13} />
                                    In
                                  </span>
                                ) : null}

                                {directions.includes("out") ? (
                                  <span className="direction-badge direction-out">
                                    <ArrowDown size={13} />
                                    Out
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td>
                              {formatDate(
                                adjustment.created_at,
                              )}
                            </td>

                            <td>
                              {renderStatus(
                                adjustment.status,
                              )}
                            </td>

                            <td>
                              <Link
                                href={`/inventory/adjustments/${adjustment.id}`}
                                className="view-button"
                              >
                                <Eye size={15} />
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pagination">
                  <div className="pagination-info">
                    Showing {formatNumber(visibleStart)}–
                    {formatNumber(visibleEnd)} of{" "}
                    {formatNumber(filteredRows.length)}
                  </div>

                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="pagination-button"
                      disabled={currentPage <= 1}
                      onClick={() =>
                        setCurrentPage((page) =>
                          Math.max(1, page - 1),
                        )
                      }
                    >
                      Previous
                    </button>

                    <span className="page-number">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      type="button"
                      className="pagination-button"
                      disabled={currentPage >= totalPages}
                      onClick={() =>
                        setCurrentPage((page) =>
                          Math.min(totalPages, page + 1),
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
        )}

        <style jsx>{`
          .inventory-page {
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
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 8px;
          }

          .eyebrow-dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: #166534;
            flex: 0 0 auto;
          }

          .page-title {
            margin: 0;
            color: #0f172a;
            font-size: 30px;
            line-height: 1.15;
            font-weight: 700;
            letter-spacing: -0.02em;
          }

          .page-subtitle {
            margin: 8px 0 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.5;
            max-width: 760px;
          }

          .header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
          }

          .primary-button,
          .secondary-button,
          .view-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            min-height: 38px;
            padding: 0 13px;
            border-radius: 9px;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            transition:
              background 0.15s ease,
              border-color 0.15s ease,
              opacity 0.15s ease;
          }

          .primary-button {
            border: 1px solid #166534;
            background: #166534;
            color: #ffffff;
          }

          .primary-button:hover {
            background: #14532d;
            border-color: #14532d;
          }

          .secondary-button {
            border: 1px solid #d1d5db;
            background: #ffffff;
            color: #334155;
          }

          .secondary-button:hover {
            background: #f8fafc;
          }

          .secondary-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .view-button {
            min-height: 32px;
            padding: 0 10px;
            border: 1px solid #d1d5db;
            background: #ffffff;
            color: #334155;
          }

          .view-button:hover {
            background: #f8fafc;
            border-color: #94a3b8;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 18px;
          }

          .stat-card {
            min-width: 0;
            padding: 17px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          }

          .stat-label {
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
          }

          .stat-value {
            margin-top: 7px;
            color: #0f172a;
            font-size: 25px;
            line-height: 1.1;
            font-weight: 700;
          }

          .stat-positive {
            color: #166534;
          }

          .stat-negative {
            color: #991b1b;
          }

          .stat-meta {
            margin-top: 6px;
            color: #94a3b8;
            font-size: 11px;
            line-height: 1.4;
          }

          .toolbar-card {
            display: flex;
            align-items: flex-end;
            gap: 12px;
            padding: 14px;
            margin-bottom: 18px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          }

          .search-wrap {
            flex: 1 1 auto;
            min-width: 280px;
            height: 40px;
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 0 12px;
            border: 1px solid #dbe1e8;
            border-radius: 9px;
            background: #ffffff;
            color: #94a3b8;
          }

          .search-wrap input {
            width: 100%;
            border: 0;
            outline: 0;
            background: transparent;
            color: #0f172a;
            font-size: 13px;
          }

          .search-wrap input::placeholder {
            color: #94a3b8;
          }

          .filter-wrap {
            width: 190px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .filter-wrap label {
            color: #64748b;
            font-size: 11px;
            font-weight: 600;
          }

          .filter-wrap select {
            width: 100%;
            height: 40px;
            padding: 0 11px;
            border: 1px solid #dbe1e8;
            border-radius: 9px;
            outline: 0;
            background: #ffffff;
            color: #334155;
            font-size: 13px;
          }

          .content-card {
            overflow: hidden;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          }

          .content-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 17px 18px;
            border-bottom: 1px solid #e5e7eb;
          }

          .section-title {
            color: #0f172a;
            font-size: 14px;
            font-weight: 700;
          }

          .section-subtitle {
            margin-top: 4px;
            color: #64748b;
            font-size: 12px;
          }

          .result-count {
            color: #64748b;
            font-size: 12px;
            white-space: nowrap;
          }

          .table-scroll {
            overflow-x: auto;
          }

          .inventory-table {
            width: 100%;
            min-width: 1320px;
            border-collapse: collapse;
          }

          .inventory-table th {
            padding: 11px 13px;
            border-bottom: 1px solid #e5e7eb;
            background: #f8fafc;
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.02em;
            text-align: left;
            white-space: nowrap;
          }

          .inventory-table td {
            padding: 13px;
            border-bottom: 1px solid #eef2f7;
            color: #334155;
            font-size: 12px;
            vertical-align: middle;
          }

          .inventory-table tbody tr:hover {
            background: #fafafa;
          }

          .inventory-table tbody tr:last-child td {
            border-bottom: 0;
          }

          .adjustment-link {
            color: #166534;
            font-weight: 700;
            text-decoration: none;
          }

          .adjustment-link:hover {
            text-decoration: underline;
          }

          .cell-primary {
            color: #334155;
            font-weight: 600;
          }

          .cell-muted {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 11px;
            line-height: 1.35;
          }

          .number-cell {
            color: #334155;
            font-weight: 600;
          }

          .units-cell {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .units-total {
            color: #0f172a;
            font-weight: 700;
          }

          .units-breakdown {
            color: #94a3b8;
            font-size: 10px;
          }

          .direction-list {
            display: flex;
            align-items: center;
            gap: 5px;
            flex-wrap: wrap;
          }

          .direction-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            min-height: 24px;
            padding: 0 7px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 700;
          }

          .direction-in {
            background: #ecfdf3;
            color: #166534;
          }

          .direction-out {
            background: #fef2f2;
            color: #991b1b;
          }

          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-height: 25px;
            padding: 0 8px;
            border-radius: 999px;
            font-size: 10px;
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
            background: #f1f5f9;
            color: #475569;
          }

          .status-completed {
            background: #ecfdf3;
            color: #166534;
          }

          .status-cancelled {
            background: #fef2f2;
            color: #991b1b;
          }

          .status-unknown {
            background: #f1f5f9;
            color: #64748b;
          }

          .loading-state {
            min-height: 300px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            color: #64748b;
            font-size: 13px;
          }

          .loading-spinner {
            width: 24px;
            height: 24px;
            border: 2px solid #e2e8f0;
            border-top-color: #166534;
            border-radius: 999px;
            animation: spin 0.8s linear infinite;
          }

          .empty-state {
            min-height: 340px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            text-align: center;
          }

          .empty-icon {
            width: 46px;
            height: 46px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #f8fafc;
            color: #64748b;
          }

          .empty-title {
            color: #334155;
            font-size: 14px;
            font-weight: 700;
          }

          .empty-text {
            max-width: 470px;
            margin: 6px 0 16px;
            color: #94a3b8;
            font-size: 12px;
            line-height: 1.5;
          }

          .error-card {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 18px;
            margin-bottom: 18px;
            border: 1px solid #fecaca;
            border-radius: 14px;
            background: #fffafa;
          }

          .error-title {
            color: #991b1b;
            font-size: 13px;
            font-weight: 700;
          }

          .error-message {
            flex: 1;
            color: #7f1d1d;
            font-size: 12px;
          }

          .pagination {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 13px 18px;
            border-top: 1px solid #e5e7eb;
          }

          .pagination-info {
            color: #64748b;
            font-size: 11px;
          }

          .pagination-controls {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .pagination-button {
            height: 32px;
            padding: 0 10px;
            border: 1px solid #dbe1e8;
            border-radius: 8px;
            background: #ffffff;
            color: #475569;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          }

          .pagination-button:hover:not(:disabled) {
            background: #f8fafc;
          }

          .pagination-button:disabled {
            opacity: 0.45;
            cursor: not-allowed;
          }

          .page-number {
            color: #64748b;
            font-size: 11px;
            min-width: 90px;
            text-align: center;
          }

          .spin {
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 1400px) {
            .stats-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }

          @media (max-width: 900px) {
            .page-header {
              flex-direction: column;
            }

            .toolbar-card {
              flex-direction: column;
              align-items: stretch;
            }

            .search-wrap,
            .filter-wrap {
              width: 100%;
              min-width: 0;
            }
          }

          @media (max-width: 640px) {
            .stats-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .pagination {
              flex-direction: column;
              align-items: flex-start;
            }

            .error-card {
              align-items: flex-start;
              flex-direction: column;
            }
          }
        `}</style>
      </div>
    </AppShell>
  );
}