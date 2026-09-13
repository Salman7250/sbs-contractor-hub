"use client";

import {
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  PackageCheck,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Receipt = {
  id: string;
  company_id: string;
  receipt_number: string;
  supplier_name: string | null;
  reference_number: string | null;
  notes: string | null;
  status: string;
  received_by: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
  purchase_order_id: string | null;
};

type ReceiptItem = {
  id: string;
  receipt_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_cost: number;
  warehouse_id: string | null;
  location_id: string | null;
  purchase_order_item_id: string | null;
  batch_id: string | null;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  tracking_mode: string | null;
  status: string | null;
};

type Variant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
  cost_price: number | null;
  selling_price: number | null;
  is_active: boolean | null;
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

type Batch = {
  id: string;
  product_id: string;
  variant_id: string | null;
  lot_number: string;
  status: string | null;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string | null;
  status: string | null;
  currency: string | null;
  order_date: string | null;
  expected_date: string | null;
};

type ReceiptRow = Receipt & {
  items: ReceiptItem[];
  itemCount: number;
  unitCount: number;
  batchCount: number;
  productSummary: string;
  warehouseSummary: string;
  poNumber: string | null;
  currency: string | null;
};

const PAGE_SIZE = 15;

const COMPANY_STORAGE_KEYS = [
  "sbs_current_company_id",
  "current_company_id",
  "currentCompanyId",
  "selected_company_id",
  "selectedCompanyId",
];

function isUuid(value: string | null): value is string {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getStoredCompanyId() {
  if (typeof window === "undefined") return null;

  for (const key of COMPANY_STORAGE_KEYS) {
    const value = window.localStorage.getItem(key);

    if (isUuid(value)) {
      return value;
    }
  }

  return null;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeStatus(status: string | null | undefined) {
  return (status || "draft").toLowerCase();
}

function statusLabel(status: string | null | undefined) {
  const normalized = normalizeStatus(status);

  switch (normalized) {
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "draft":
      return "Draft";
    default:
      return normalized.replace(/_/g, " ");
  }
}

export default function InventoryReceiptsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<
    PurchaseOrder[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [page, setPage] = useState(1);

  const loadData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage(null);

        let companyId = getStoredCompanyId();

        if (!companyId) {
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError) {
            throw userError;
          }

          if (!user) {
            throw new Error(
              "You must be signed in to view stock receipts.",
            );
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

          companyId = membership?.company_id ?? null;
        }

        if (!companyId) {
          throw new Error(
            "No active company could be resolved.",
          );
        }

        const [
          receiptsResult,
          itemsResult,
          productsResult,
          variantsResult,
          warehousesResult,
          locationsResult,
          batchesResult,
          purchaseOrdersResult,
        ] = await Promise.all([
          supabase
            .from("stock_receipts")
            .select(
              "id,company_id,receipt_number,supplier_name,reference_number,notes,status,received_by,received_at,created_at,updated_at,purchase_order_id",
            )
            .eq("company_id", companyId)
            .order("received_at", { ascending: false }),

          supabase
            .from("stock_receipt_items")
            .select(
              "id,receipt_id,product_id,variant_id,quantity,unit_cost,warehouse_id,location_id,purchase_order_item_id,batch_id,created_at",
            )
            .eq("company_id", companyId),

          supabase
            .from("products")
            .select(
              "id,name,brand,category,tracking_mode,status",
            )
            .eq("company_id", companyId),

          supabase
            .from("product_variants")
            .select(
              "id,product_id,name,sku,cost_price,selling_price,is_active",
            )
            .eq("company_id", companyId)
            .eq("is_active", true),

          supabase
            .from("warehouses")
            .select("id,name,code")
            .eq("company_id", companyId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("warehouse_locations")
            .select("id,warehouse_id,name,code")
            .eq("company_id", companyId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("inventory_batches")
            .select(
              "id,product_id,variant_id,lot_number,status",
            )
            .eq("company_id", companyId)
            .neq("status", "cancelled"),

          supabase
            .from("purchase_orders")
            .select(
              "id,po_number,supplier_id,status,currency,order_date,expected_date",
            )
            .eq("company_id", companyId),
        ]);

        if (receiptsResult.error) throw receiptsResult.error;
        if (itemsResult.error) throw itemsResult.error;
        if (productsResult.error) throw productsResult.error;
        if (variantsResult.error) throw variantsResult.error;
        if (warehousesResult.error) throw warehousesResult.error;
        if (locationsResult.error) throw locationsResult.error;
        if (batchesResult.error) throw batchesResult.error;

        if (purchaseOrdersResult.error) {
          throw purchaseOrdersResult.error;
        }

        setReceipts(
          (receiptsResult.data ?? []) as Receipt[],
        );

        setReceiptItems(
          (itemsResult.data ?? []) as ReceiptItem[],
        );

        setProducts(
          (productsResult.data ?? []) as Product[],
        );

        setVariants(
          (variantsResult.data ?? []) as Variant[],
        );

        setWarehouses(
          (warehousesResult.data ?? []) as Warehouse[],
        );

        setLocations(
          (locationsResult.data ?? []) as Location[],
        );

        setBatches(
          (batchesResult.data ?? []) as Batch[],
        );

        setPurchaseOrders(
          (purchaseOrdersResult.data ??
            []) as PurchaseOrder[],
        );

        setPage(1);
      } catch (error) {
        console.error(
          "Inventory receipts load error:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load stock receipts.",
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

  const batchMap = useMemo(() => {
    return new Map(
      batches.map((batch) => [
        batch.id,
        batch,
      ]),
    );
  }, [batches]);

  const purchaseOrderMap = useMemo(() => {
    return new Map(
      purchaseOrders.map((purchaseOrder) => [
        purchaseOrder.id,
        purchaseOrder,
      ]),
    );
  }, [purchaseOrders]);

  const itemsByReceipt = useMemo(() => {
    const map = new Map<string, ReceiptItem[]>();

    for (const item of receiptItems) {
      const existing =
        map.get(item.receipt_id) ?? [];

      existing.push(item);

      map.set(item.receipt_id, existing);
    }

    return map;
  }, [receiptItems]);

  const rows = useMemo<ReceiptRow[]>(() => {
    return receipts.map((receipt) => {
      const items =
        itemsByReceipt.get(receipt.id) ?? [];

      const productNames = Array.from(
        new Set(
          items
            .map((item) => {
              const product = productMap.get(
                item.product_id,
              );

              const variant = variantMap.get(
                item.variant_id,
              );

              if (!product) return null;

              if (variant?.name) {
                return `${product.name} · ${variant.name}`;
              }

              return product.name;
            })
            .filter(Boolean),
        ),
      ) as string[];

      const warehouseNames = Array.from(
        new Set(
          items
            .map((item) => {
              if (!item.warehouse_id) {
                return null;
              }

              const warehouse = warehouseMap.get(
                item.warehouse_id,
              );

              if (!warehouse) return null;

              const location = item.location_id
                ? locationMap.get(
                    item.location_id,
                  )
                : null;

              if (location) {
                return `${warehouse.name} · ${location.name}`;
              }

              return warehouse.name;
            })
            .filter(Boolean),
        ),
      ) as string[];

      const unitCount = items.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0),
        0,
      );

      const batchCount = new Set(
        items
          .map((item) => item.batch_id)
          .filter(Boolean),
      ).size;

      const purchaseOrder =
        receipt.purchase_order_id
          ? purchaseOrderMap.get(
              receipt.purchase_order_id,
            )
          : null;

      return {
        ...receipt,
        items,
        itemCount: items.length,
        unitCount,
        batchCount,
        productSummary:
          productNames.length > 0
            ? productNames
                .slice(0, 2)
                .join(", ") +
              (productNames.length > 2
                ? ` +${productNames.length - 2}`
                : "")
            : "—",
        warehouseSummary:
          warehouseNames.length > 0
            ? warehouseNames
                .slice(0, 2)
                .join(", ") +
              (warehouseNames.length > 2
                ? ` +${warehouseNames.length - 2}`
                : "")
            : "—",
        poNumber:
          purchaseOrder?.po_number ?? null,
        currency:
          purchaseOrder?.currency ?? null,
      };
    });
  }, [
    receipts,
    itemsByReceipt,
    productMap,
    variantMap,
    warehouseMap,
    locationMap,
    purchaseOrderMap,
  ]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesStatus =
        statusFilter === "all" ||
        normalizeStatus(row.status) ===
          statusFilter;

      const matchesWarehouse =
        warehouseFilter === "all" ||
        row.items.some(
          (item) =>
            item.warehouse_id ===
            warehouseFilter,
        );

      if (
        !matchesStatus ||
        !matchesWarehouse
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        row.receipt_number,
        row.supplier_name ?? "",
        row.reference_number ?? "",
        row.poNumber ?? "",
        row.productSummary,
        row.warehouseSummary,
        row.notes ?? "",
        ...row.items.flatMap((item) => {
          const product = productMap.get(
            item.product_id,
          );

          const variant = variantMap.get(
            item.variant_id,
          );

          const batch = item.batch_id
            ? batchMap.get(item.batch_id)
            : null;

          return [
            product?.name ?? "",
            product?.brand ?? "",
            product?.category ?? "",
            variant?.name ?? "",
            variant?.sku ?? "",
            batch?.lot_number ?? "",
          ];
        }),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    rows,
    search,
    statusFilter,
    warehouseFilter,
    productMap,
    variantMap,
    batchMap,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredRows.length / PAGE_SIZE,
    ),
  );

  const paginatedRows = useMemo(() => {
    const start =
      (page - 1) * PAGE_SIZE;

    return filteredRows.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [filteredRows, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const stats = useMemo(() => {
    const total = receipts.length;

    const draft = receipts.filter(
      (receipt) =>
        normalizeStatus(receipt.status) ===
        "draft",
    ).length;

    const completed = receipts.filter(
      (receipt) =>
        normalizeStatus(receipt.status) ===
        "completed",
    ).length;

    const cancelled = receipts.filter(
      (receipt) =>
        normalizeStatus(receipt.status) ===
        "cancelled",
    ).length;

    const unitsReceived =
      receiptItems.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0),
        0,
      );

    const batchesCreated = new Set(
      receiptItems
        .map((item) => item.batch_id)
        .filter(Boolean),
    ).size;

    return {
      total,
      draft,
      completed,
      cancelled,
      unitsReceived,
      batchesCreated,
    };
  }, [receipts, receiptItems]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setWarehouseFilter("all");
    setPage(1);
  };

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <div className="page-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              INVENTORY · RECEIVING
            </div>

            <h1 className="page-title">
              Stock Receipts
            </h1>

            <p className="page-subtitle">
              Track incoming inventory, received
              quantities, batches, and warehouse
              placement.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => loadData(true)}
            disabled={
              loading || refreshing
            }
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "spin"
                  : undefined
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <PackageCheck size={19} />
            </div>

            <div>
              <div className="stat-label">
                Total Receipts
              </div>

              <div className="stat-value">
                {formatNumber(
                  stats.total,
                )}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Clock3 size={19} />
            </div>

            <div>
              <div className="stat-label">
                Draft
              </div>

              <div className="stat-value">
                {formatNumber(
                  stats.draft,
                )}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <CheckCircle2 size={19} />
            </div>

            <div>
              <div className="stat-label">
                Completed
              </div>

              <div className="stat-value">
                {formatNumber(
                  stats.completed,
                )}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <XCircle size={19} />
            </div>

            <div>
              <div className="stat-label">
                Cancelled
              </div>

              <div className="stat-value">
                {formatNumber(
                  stats.cancelled,
                )}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Boxes size={19} />
            </div>

            <div>
              <div className="stat-label">
                Units Received
              </div>

              <div className="stat-value">
                {formatNumber(
                  stats.unitsReceived,
                )}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <PackageCheck size={19} />
            </div>

            <div>
              <div className="stat-label">
                Batches Created
              </div>

              <div className="stat-value">
                {formatNumber(
                  stats.batchesCreated,
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="toolbar-card">
          <div className="search-wrapper">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search receipt, supplier, PO, product, SKU, batch..."
              value={search}
              onChange={(event) => {
                setSearch(
                  event.target.value,
                );
                setPage(1);
              }}
            />
          </div>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(
                event.target.value,
              );
              setPage(1);
            }}
          >
            <option value="all">
              All Statuses
            </option>

            <option value="draft">
              Draft
            </option>

            <option value="completed">
              Completed
            </option>

            <option value="cancelled">
              Cancelled
            </option>
          </select>

          <select
            className="filter-select"
            value={warehouseFilter}
            onChange={(event) => {
              setWarehouseFilter(
                event.target.value,
              );
              setPage(1);
            }}
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
                  {warehouse.code
                    ? ` (${warehouse.code})`
                    : ""}
                </option>
              ),
            )}
          </select>

          {(search ||
            statusFilter !== "all" ||
            warehouseFilter !== "all") && (
            <button
              type="button"
              className="clear-button"
              onClick={resetFilters}
            >
              Clear
            </button>
          )}
        </div>

        <div className="content-card">
          {loading ? (
            <div className="state-box">
              <div className="spinner" />
              <div>
                Loading stock receipts...
              </div>
            </div>
          ) : errorMessage ? (
            <div className="state-box error-state">
              <div className="error-title">
                Unable to load receipts
              </div>

              <div className="error-message">
                {errorMessage}
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  loadData()
                }
              >
                Try Again
              </button>
            </div>
          ) : filteredRows.length ===
            0 ? (
            <div className="state-box empty-state">
              <div className="empty-icon">
                <PackageCheck
                  size={24}
                />
              </div>

              <div className="empty-title">
                {rows.length === 0
                  ? "No stock receipts yet"
                  : "No receipts match your filters"}
              </div>

              <div className="empty-message">
                {rows.length === 0
                  ? "Stock receipts will appear here when inventory is received."
                  : "Try changing your search or filters."}
              </div>

              {rows.length > 0 && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    resetFilters
                  }
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Supplier</th>
                      <th>
                        Purchase Order
                      </th>
                      <th>Items</th>
                      <th>Units</th>
                      <th>
                        Warehouse / Location
                      </th>
                      <th>Batches</th>
                      <th>Received</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedRows.map(
                      (row) => {
                        const status =
                          normalizeStatus(
                            row.status,
                          );

                        return (
                          <tr
                            key={row.id}
                          >
                            <td>
                              <Link
                                href={`/inventory/receipts/${row.id}`}
                                className="receipt-link"
                              >
                                {
                                  row.receipt_number
                                }
                              </Link>

                              {row.reference_number && (
                                <div className="secondary-cell">
                                  Ref:{" "}
                                  {
                                    row.reference_number
                                  }
                                </div>
                              )}
                            </td>

                            <td>
                              <div className="primary-cell">
                                {row.supplier_name ||
                                  "Direct Receipt"}
                              </div>

                              <div className="secondary-cell">
                                {
                                  row.productSummary
                                }
                              </div>
                            </td>

                            <td>
                              {row.poNumber ? (
                                <div className="po-cell">
                                  <span className="po-badge">
                                    PO
                                  </span>

                                  <span>
                                    {
                                      row.poNumber
                                    }
                                  </span>
                                </div>
                              ) : (
                                <span className="muted">
                                  Direct Receipt
                                </span>
                              )}
                            </td>

                            <td>
                              <span className="number-cell">
                                {formatNumber(
                                  row.itemCount,
                                )}
                              </span>
                            </td>

                            <td>
                              <span className="number-cell strong">
                                {formatNumber(
                                  row.unitCount,
                                )}
                              </span>
                            </td>

                            <td>
                              <div className="location-cell">
                                {
                                  row.warehouseSummary
                                }
                              </div>
                            </td>

                            <td>
                              {row.batchCount >
                              0 ? (
                                <Link
                                  href="/inventory/batches"
                                  className="batch-link"
                                >
                                  {
                                    row.batchCount
                                  }
                                </Link>
                              ) : (
                                <span className="muted">
                                  —
                                </span>
                              )}
                            </td>

                            <td>
                              <span className="date-cell">
                                {formatDate(
                                  row.received_at,
                                )}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`status-badge status-${status}`}
                              >
                                <span className="status-dot" />
                                {statusLabel(
                                  row.status,
                                )}
                              </span>
                            </td>

                            <td>
                              <Link
                                href={`/inventory/receipts/${row.id}`}
                                className="view-button"
                              >
                                <Eye
                                  size={15}
                                />
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-footer">
                <div className="results-count">
                  Showing{" "}
                  <strong>
                    {(page - 1) *
                      PAGE_SIZE +
                      1}
                  </strong>{" "}
                  –{" "}
                  <strong>
                    {Math.min(
                      page *
                        PAGE_SIZE,
                      filteredRows.length,
                    )}
                  </strong>{" "}
                  of{" "}
                  <strong>
                    {
                      filteredRows.length
                    }
                  </strong>{" "}
                  receipts
                </div>

                <div className="pagination">
                  <button
                    type="button"
                    className="pagination-button"
                    disabled={
                      page <= 1
                    }
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
                    <ChevronLeft
                      size={16}
                    />
                  </button>

                  <span className="page-number">
                    Page {page} of{" "}
                    {totalPages}
                  </span>

                  <button
                    type="button"
                    className="pagination-button"
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
                    <ChevronRight
                      size={16}
                    />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="receiving-note">
          <div className="note-icon">
            <PackageCheck size={17} />
          </div>

          <div>
            <div className="note-title">
              Receiving workflow
            </div>

            <div className="note-text">
              Purchase Orders are received
              through the receiving workflow.
              Completed receipts create batch
              inventory and optionally register
              the real serial numbers supplied
              during receiving.
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .inventory-page {
          width: 100%;
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
          display: inline-block;
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
          line-height: 1.6;
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
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.04);
        }

        .stat-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #f0fdf4;
          color: #166534;
        }

        .stat-label {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 3px;
          white-space: nowrap;
        }

        .stat-value {
          color: #0f172a;
          font-size: 21px;
          line-height: 1.2;
          font-weight: 700;
        }

        .toolbar-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          margin-bottom: 16px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.04);
        }

        .search-wrapper {
          min-width: 280px;
          flex: 1;
          height: 40px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 12px;
          color: #94a3b8;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #ffffff;
        }

        .search-wrapper:focus-within {
          border-color: #166534;
          box-shadow: 0 0 0 3px
            rgba(22, 101, 52, 0.08);
        }

        .search-wrapper input {
          width: 100%;
          height: 100%;
          border: 0;
          outline: none;
          background: transparent;
          color: #0f172a;
          font-size: 13px;
        }

        .search-wrapper input::placeholder {
          color: #94a3b8;
        }

        .filter-select {
          height: 40px;
          min-width: 145px;
          padding: 0 34px 0 11px;
          color: #334155;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          font-size: 13px;
          outline: none;
          cursor: pointer;
        }

        .filter-select:focus {
          border-color: #166534;
          box-shadow: 0 0 0 3px
            rgba(22, 101, 52, 0.08);
        }

        .secondary-button,
        .primary-button,
        .clear-button,
        .view-button {
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 9px;
          padding: 0 13px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease,
            opacity 0.15s ease;
        }

        .secondary-button {
          color: #334155;
          background: #ffffff;
          border: 1px solid #d1d5db;
        }

        .secondary-button:hover:not(
            :disabled
          ) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .primary-button {
          color: #ffffff;
          background: #166534;
          border: 1px solid #166534;
        }

        .primary-button:hover {
          background: #14532d;
        }

        .clear-button {
          color: #475569;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .clear-button:hover {
          background: #f1f5f9;
        }

        .view-button {
          height: 34px;
          padding: 0 10px;
          color: #166534;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .view-button:hover {
          color: #14532d;
          background: #dcfce7;
          border-color: #86efac;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .content-card {
          overflow: hidden;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.04);
        }

        .table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          min-width: 1280px;
          border-collapse: collapse;
        }

        .data-table th {
          padding: 12px 15px;
          color: #64748b;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.045em;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .data-table td {
          padding: 13px 15px;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          font-size: 13px;
          vertical-align: middle;
        }

        .data-table tbody tr:hover {
          background: #fafafa;
        }

        .data-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .receipt-link {
          color: #166534;
          font-weight: 700;
          text-decoration: none;
        }

        .receipt-link:hover {
          text-decoration: underline;
        }

        .primary-cell {
          color: #0f172a;
          font-weight: 650;
          line-height: 1.35;
        }

        .secondary-cell {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 11px;
        }

        .number-cell {
          color: #334155;
          font-variant-numeric: tabular-nums;
        }

        .number-cell.strong {
          color: #0f172a;
          font-weight: 650;
        }

        .location-cell {
          max-width: 235px;
          color: #475569;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .po-cell {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #334155;
          font-weight: 600;
        }

        .po-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 20px;
          padding: 0 6px;
          border-radius: 5px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .batch-link {
          color: #166534;
          font-weight: 700;
          text-decoration: none;
        }

        .batch-link:hover {
          text-decoration: underline;
        }

        .date-cell {
          color: #475569;
          white-space: nowrap;
        }

        .muted {
          color: #94a3b8;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 25px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          display: inline-block;
        }

        .status-completed {
          color: #166534;
          background: #f0fdf4;
        }

        .status-completed
          .status-dot {
          background: #16a34a;
        }

        .status-draft {
          color: #92400e;
          background: #fffbeb;
        }

        .status-draft .status-dot {
          background: #f59e0b;
        }

        .status-cancelled {
          color: #991b1b;
          background: #fef2f2;
        }

        .status-cancelled
          .status-dot {
          background: #ef4444;
        }

        .table-footer {
          min-height: 58px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 10px 15px;
          border-top: 1px solid #e5e7eb;
        }

        .results-count {
          color: #64748b;
          font-size: 12px;
        }

        .results-count strong {
          color: #334155;
        }

        .pagination {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pagination-button {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #475569;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
        }

        .pagination-button:hover:not(
            :disabled
          ) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .page-number {
          min-width: 86px;
          color: #64748b;
          font-size: 12px;
          text-align: center;
        }

        .state-box {
          min-height: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 40px;
          color: #64748b;
          font-size: 13px;
          text-align: center;
        }

        .spinner {
          width: 28px;
          height: 28px;
          border: 3px solid #e2e8f0;
          border-top-color: #166534;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .spin {
          animation: spin 0.8s linear infinite;
        }

        .empty-icon {
          width: 54px;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 3px;
          border-radius: 14px;
          color: #166534;
          background: #f0fdf4;
        }

        .empty-title {
          color: #0f172a;
          font-size: 15px;
          font-weight: 700;
        }

        .empty-message {
          max-width: 460px;
          color: #64748b;
          line-height: 1.55;
        }

        .error-state {
          color: #991b1b;
        }

        .error-title {
          color: #991b1b;
          font-size: 15px;
          font-weight: 700;
        }

        .error-message {
          max-width: 600px;
          color: #64748b;
          line-height: 1.55;
        }

        .receiving-note {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-top: 16px;
          padding: 14px 16px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }

        .note-icon {
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: #166534;
          background: #f0fdf4;
        }

        .note-title {
          margin-bottom: 3px;
          color: #334155;
          font-size: 12px;
          font-weight: 700;
        }

        .note-text {
          color: #64748b;
          font-size: 12px;
          line-height: 1.55;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1350px) {
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

          .toolbar-card {
            flex-wrap: wrap;
          }

          .search-wrapper {
            flex-basis: 100%;
          }

          .filter-select {
            flex: 1;
          }
        }

        @media (max-width: 640px) {
          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .page-title {
            font-size: 25px;
          }

          .toolbar-card {
            align-items: stretch;
          }

          .filter-select {
            width: 100%;
          }

          .clear-button {
            width: 100%;
          }

          .table-footer {
            flex-direction: column;
            align-items: stretch;
          }

          .pagination {
            justify-content: center;
          }
        }
      `}</style>
    </AppShell>
  );
}