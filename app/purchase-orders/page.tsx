"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type PurchaseOrder = {
  id: string;
  company_id: string;
  supplier_id: string;
  po_number: string;
  status:
    | "draft"
    | "sent"
    | "confirmed"
    | "partially_received"
    | "received"
    | "cancelled";
  currency: string;
  order_date: string;
  expected_date: string | null;
  warehouse_id: string | null;
  supplier_reference: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  notes: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
};

type Supplier = {
  id: string;
  legal_name: string;
  display_name: string;
  supplier_number: string;
};

type Warehouse = {
  id: string;
  name: string;
  code: string | null;
};

type PurchaseOrderItem = {
  purchase_order_id: string;
  quantity: number;
  received_quantity: number;
};

type StatusFilter =
  | "all"
  | "draft"
  | "sent"
  | "confirmed"
  | "partially_received"
  | "received"
  | "cancelled";

function Icon({
  name,
  size = 18,
}: {
  name:
    | "search"
    | "plus"
    | "refresh"
    | "chevron"
    | "more"
    | "eye"
    | "trash"
    | "receive"
    | "calendar"
    | "box"
    | "truck"
    | "check"
    | "clock"
    | "warning";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8.1 8.1 0 0 0-14.8-4.5L3 9" />
          <path d="M3 4v5h5" />
          <path d="M4 13a8.1 8.1 0 0 0 14.8 4.5L21 15" />
          <path d="M21 20v-5h-5" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );

    case "more":
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
        </svg>
      );

    case "eye":
      return (
        <svg {...common}>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );

    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="m6 7 1 14h10l1-14" />
          <path d="M9 7V4h6v3" />
        </svg>
      );

    case "receive":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
          <path d="M5 17v4" />
          <path d="M19 17v4" />
        </svg>
      );

    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </svg>
      );

    case "box":
      return (
        <svg {...common}>
          <path d="m21 8-9 5-9-5 9-5 9 5Z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </svg>
      );

    case "truck":
      return (
        <svg {...common}>
          <path d="M3 6h11v10H3z" />
          <path d="M14 9h4l3 3v4h-7z" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "warning":
      return (
        <svg {...common}>
          <path d="M12 3 2.5 20h19L12 3Z" />
          <path d="M12 9v5" />
          <path d="M12 17h.01" />
        </svg>
      );

    default:
      return null;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "partially_received":
      return "Partially Received";
    case "cancelled":
      return "Cancelled";
    case "confirmed":
      return "Confirmed";
    case "received":
      return "Received";
    case "sent":
      return "Sent";
    case "draft":
      return "Draft";
    default:
      return status;
  }
}

function statusClass(status: string) {
  switch (status) {
    case "draft":
      return "status draft";

    case "sent":
      return "status sent";

    case "confirmed":
      return "status confirmed";

    case "partially_received":
      return "status partial";

    case "received":
      return "status received";

    case "cancelled":
      return "status cancelled";

    default:
      return "status draft";
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(
  value: number,
  currency = "USD"
) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `${currency} ${(value || 0).toFixed(2)}`;
  }
}

function isOverdue(po: PurchaseOrder) {
  if (!po.expected_date) {
    return false;
  }

  if (
    po.status === "received" ||
    po.status === "cancelled"
  ) {
    return false;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const expected = new Date(
    `${po.expected_date}T00:00:00`
  );

  return expected < today;
}

export default function PurchaseOrdersPage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [purchaseOrders, setPurchaseOrders] =
    useState<PurchaseOrder[]>([]);

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [warehouses, setWarehouses] =
    useState<Warehouse[]>([]);

  const [items, setItems] =
    useState<PurchaseOrderItem[]>([]);

  const [companyCurrency, setCompanyCurrency] =
    useState("USD");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [supplierFilter, setSupplierFilter] =
    useState("all");

  const [warehouseFilter, setWarehouseFilter] =
    useState("all");

  const [openMenu, setOpenMenu] =
    useState<string | null>(null);

  const loadData = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          router.replace("/login");
          return;
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
            "No company membership found."
          );
        }

        const companyId =
          membership.company_id;

        const [
          companyResult,
          purchaseOrdersResult,
          suppliersResult,
          warehousesResult,
        ] = await Promise.all([
          supabase
            .from("companies")
            .select("currency")
            .eq("id", companyId)
            .single(),

          supabase
            .from("purchase_orders")
            .select("*")
            .eq(
              "company_id",
              companyId
            )
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("suppliers")
            .select(
              `
                id,
                legal_name,
                display_name,
                supplier_number
              `
            )
            .eq(
              "company_id",
              companyId
            )
            .order("display_name"),

          supabase
            .from("warehouses")
            .select(
              `
                id,
                name,
                code
              `
            )
            .eq(
              "company_id",
              companyId
            )
            .order("name"),
        ]);

        if (companyResult.error) {
          throw companyResult.error;
        }

        if (purchaseOrdersResult.error) {
          throw purchaseOrdersResult.error;
        }

        if (suppliersResult.error) {
          throw suppliersResult.error;
        }

        if (warehousesResult.error) {
          throw warehousesResult.error;
        }

        const loadedPOs =
          (purchaseOrdersResult.data ||
            []) as PurchaseOrder[];

        setCompanyCurrency(
          companyResult.data?.currency ||
            "USD"
        );

        setPurchaseOrders(loadedPOs);

        setSuppliers(
          (suppliersResult.data ||
            []) as Supplier[]
        );

        setWarehouses(
          (warehousesResult.data ||
            []) as Warehouse[]
        );

        if (loadedPOs.length) {
          const ids =
            loadedPOs.map(
              (po) => po.id
            );

          const {
            data: itemData,
            error: itemError,
          } = await supabase
            .from("purchase_order_items")
            .select(
              `
                purchase_order_id,
                quantity,
                received_quantity
              `
            )
            .eq(
              "company_id",
              companyId
            )
            .in(
              "purchase_order_id",
              ids
            );

          if (itemError) {
            throw itemError;
          }

          setItems(
            (itemData ||
              []) as PurchaseOrderItem[]
          );
        } else {
          setItems([]);
        }
      } catch (err: unknown) {
        console.error(
          "Purchase orders load error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Could not load purchase orders."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const supplierMap =
    useMemo(() => {
      return new Map(
        suppliers.map(
          (supplier) => [
            supplier.id,
            supplier,
          ]
        )
      );
    }, [suppliers]);

  const warehouseMap =
    useMemo(() => {
      return new Map(
        warehouses.map(
          (warehouse) => [
            warehouse.id,
            warehouse,
          ]
        )
      );
    }, [warehouses]);

  const itemStats =
    useMemo(() => {
      const map = new Map<
        string,
        {
          lines: number;
          quantity: number;
          received: number;
        }
      >();

      for (const item of items) {
        const current =
          map.get(
            item.purchase_order_id
          ) || {
            lines: 0,
            quantity: 0,
            received: 0,
          };

        current.lines += 1;
        current.quantity += Number(
          item.quantity || 0
        );
        current.received += Number(
          item.received_quantity || 0
        );

        map.set(
          item.purchase_order_id,
          current
        );
      }

      return map;
    }, [items]);

  const filteredPurchaseOrders =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return purchaseOrders.filter(
        (po) => {
          const supplier =
            supplierMap.get(
              po.supplier_id
            );

          const warehouse =
            po.warehouse_id
              ? warehouseMap.get(
                  po.warehouse_id
                )
              : null;

          const supplierName =
            supplier?.display_name ||
            supplier?.legal_name ||
            "";

          const supplierNumber =
            supplier?.supplier_number ||
            "";

          const warehouseName =
            warehouse?.name || "";

          const matchesSearch =
            !query ||
            po.po_number
              .toLowerCase()
              .includes(query) ||
            supplierName
              .toLowerCase()
              .includes(query) ||
            supplierNumber
              .toLowerCase()
              .includes(query) ||
            warehouseName
              .toLowerCase()
              .includes(query) ||
            (
              po.supplier_reference ||
              ""
            )
              .toLowerCase()
              .includes(query);

          const matchesStatus =
            statusFilter === "all" ||
            po.status ===
              statusFilter;

          const matchesSupplier =
            supplierFilter === "all" ||
            po.supplier_id ===
              supplierFilter;

          const matchesWarehouse =
            warehouseFilter === "all" ||
            po.warehouse_id ===
              warehouseFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesSupplier &&
            matchesWarehouse
          );
        }
      );
    }, [
      purchaseOrders,
      supplierMap,
      warehouseMap,
      search,
      statusFilter,
      supplierFilter,
      warehouseFilter,
    ]);

  const stats = useMemo(() => {
    const total =
      purchaseOrders.length;

    const draft =
      purchaseOrders.filter(
        (po) =>
          po.status === "draft"
      ).length;

    const open =
      purchaseOrders.filter(
        (po) =>
          po.status === "sent" ||
          po.status === "confirmed" ||
          po.status ===
            "partially_received"
      ).length;

    const received =
      purchaseOrders.filter(
        (po) =>
          po.status === "received"
      ).length;

    const overdue =
      purchaseOrders.filter(
        (po) => isOverdue(po)
      ).length;

    const outstandingValue =
      purchaseOrders
        .filter(
          (po) =>
            po.status !==
              "received" &&
            po.status !==
              "cancelled"
        )
        .reduce(
          (sum, po) =>
            sum +
            Number(
              po.total_amount || 0
            ),
          0
        );

    return {
      total,
      draft,
      open,
      received,
      overdue,
      outstandingValue,
    };
  }, [purchaseOrders]);

  function supplierName(
    supplierId: string
  ) {
    const supplier =
      supplierMap.get(
        supplierId
      );

    return (
      supplier?.display_name ||
      supplier?.legal_name ||
      "Unknown Supplier"
    );
  }

  function supplierNumber(
    supplierId: string
  ) {
    return (
      supplierMap.get(
        supplierId
      )?.supplier_number || ""
    );
  }

  function warehouseName(
    warehouseId: string | null
  ) {
    if (!warehouseId) {
      return "—";
    }

    const warehouse =
      warehouseMap.get(
        warehouseId
      );

    return (
      warehouse?.name ||
      "Unknown Warehouse"
    );
  }

  function getProgress(
    po: PurchaseOrder
  ) {
    const data =
      itemStats.get(po.id);

    if (!data || !data.quantity) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (data.received /
          data.quantity) *
          100
      )
    );
  }

  async function deletePurchaseOrder(
    po: PurchaseOrder
  ) {
    if (
      po.status !== "draft" &&
      po.status !== "cancelled"
    ) {
      setError(
        "Only Draft or Cancelled purchase orders can be deleted."
      );

      setOpenMenu(null);

      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${po.po_number}? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setOpenMenu(null);
      setError("");

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
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
          "No company membership found."
        );
      }

      const {
        error: deleteError,
      } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", po.id)
        .eq(
          "company_id",
          membership.company_id
        );

      if (deleteError) {
        throw deleteError;
      }

      setPurchaseOrders(
        (current) =>
          current.filter(
            (item) =>
              item.id !== po.id
          )
      );

      setItems(
        (current) =>
          current.filter(
            (item) =>
              item.purchase_order_id !==
              po.id
          )
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete purchase order."
      );
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setSupplierFilter("all");
    setWarehouseFilter("all");
  }

  const hasFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    supplierFilter !== "all" ||
    warehouseFilter !== "all";

  if (loading) {
    return (
      <AppShell
        title="Purchase Orders"
        description="Manage procurement, supplier orders and incoming stock."
      >
        <div className="page-content">
          <div className="loading-card">
            <div className="loading-spinner" />
            <p>
              Loading purchase orders...
            </p>
          </div>
        </div>

        <style jsx>{styles}</style>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Purchase Orders"
      description="Manage procurement, supplier orders and incoming stock."
    >
      <div className="page-content">
        <div className="page-header">
          <div>
            <div className="eyebrow">
              <span />
              PROCUREMENT
            </div>

            <h1 className="page-title">
              Purchase Orders
            </h1>

            <p className="page-subtitle">
              Create, track and receive
              supplier purchase orders.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void loadData(true)
              }
              disabled={refreshing}
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
              className="primary-button"
              onClick={() =>
                router.push(
                  "/purchase-orders/new"
                )
              }
            >
              <Icon
                name="plus"
                size={17}
              />
              New Purchase Order
            </button>
          </div>
        </div>

        {error && (
          <div className="alert error-alert">
            <Icon
              name="warning"
              size={17}
            />
            <span>{error}</span>
            <button
              type="button"
              onClick={() =>
                setError("")
              }
            >
              ×
            </button>
          </div>
        )}

        <div className="stats-grid">
          <StatCard
            icon="box"
            label="Total Orders"
            value={stats.total}
            detail="All purchase orders"
          />

          <StatCard
            icon="clock"
            label="Draft"
            value={stats.draft}
            detail="Awaiting submission"
          />

          <StatCard
            icon="truck"
            label="Open Orders"
            value={stats.open}
            detail="Sent, confirmed or partial"
          />

          <StatCard
            icon="check"
            label="Received"
            value={stats.received}
            detail="Fully received"
          />

          <StatCard
            icon="warning"
            label="Overdue"
            value={stats.overdue}
            detail="Past expected date"
            warning={stats.overdue > 0}
          />

          <StatCard
            icon="box"
            label="Outstanding Value"
            value={formatCurrency(
              stats.outstandingValue,
              companyCurrency
            )}
            detail="Open order value"
            moneyValue
          />
        </div>

        <div className="toolbar-card">
          <div className="search-box">
            <Icon
              name="search"
              size={17}
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search PO number, supplier, reference..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target
                  .value as StatusFilter
              )
            }
          >
            <option value="all">
              All Statuses
            </option>
            <option value="draft">
              Draft
            </option>
            <option value="sent">
              Sent
            </option>
            <option value="confirmed">
              Confirmed
            </option>
            <option value="partially_received">
              Partially Received
            </option>
            <option value="received">
              Received
            </option>
            <option value="cancelled">
              Cancelled
            </option>
          </select>

          <select
            value={supplierFilter}
            onChange={(event) =>
              setSupplierFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Suppliers
            </option>

            {suppliers.map(
              (supplier) => (
                <option
                  key={supplier.id}
                  value={supplier.id}
                >
                  {supplier.display_name ||
                    supplier.legal_name}
                </option>
              )
            )}
          </select>

          <select
            value={warehouseFilter}
            onChange={(event) =>
              setWarehouseFilter(
                event.target.value
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
              )
            )}
          </select>

          {hasFilters && (
            <button
              type="button"
              className="clear-button"
              onClick={clearFilters}
            >
              Clear
            </button>
          )}
        </div>

        <div className="results-row">
          <div>
            <strong>
              {filteredPurchaseOrders.length}
            </strong>{" "}
            purchase order
            {filteredPurchaseOrders.length ===
            1
              ? ""
              : "s"}
          </div>

          {hasFilters && (
            <span>
              Filters applied
            </span>
          )}
        </div>

        <div className="content-card">
          {filteredPurchaseOrders.length ===
          0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Icon
                  name="box"
                  size={25}
                />
              </div>

              <h2>
                {purchaseOrders.length ===
                0
                  ? "No purchase orders yet"
                  : "No purchase orders found"}
              </h2>

              <p>
                {purchaseOrders.length ===
                0
                  ? "Create your first purchase order to start managing supplier procurement."
                  : "Try changing your search or filters."}
              </p>

              {purchaseOrders.length ===
                0 && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    router.push(
                      "/purchase-orders/new"
                    )
                  }
                >
                  <Icon
                    name="plus"
                    size={16}
                  />
                  Create Purchase Order
                </button>
              )}

              {purchaseOrders.length >
                0 &&
                hasFilters && (
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
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Purchase Order</th>
                    <th>Supplier</th>
                    <th>Warehouse</th>
                    <th>Order Date</th>
                    <th>Expected</th>
                    <th>Receiving</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {filteredPurchaseOrders.map(
                    (po) => {
                      const itemData =
                        itemStats.get(
                          po.id
                        ) || {
                          lines: 0,
                          quantity: 0,
                          received: 0,
                        };

                      const progress =
                        getProgress(po);

                      const overdue =
                        isOverdue(po);

                      return (
                        <tr
                          key={po.id}
                          className="table-row"
                          onClick={() =>
                            router.push(
                              `/purchase-orders/${po.id}`
                            )
                          }
                        >
                          <td>
                            <div className="po-cell">
                              <div className="po-number">
                                {po.po_number}
                              </div>

                              {po.supplier_reference && (
                                <div className="po-reference">
                                  Ref:{" "}
                                  {
                                    po.supplier_reference
                                  }
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="supplier-cell">
                              <strong>
                                {supplierName(
                                  po.supplier_id
                                )}
                              </strong>

                              {supplierNumber(
                                po.supplier_id
                              ) && (
                                <span>
                                  {
                                    supplierNumber(
                                      po.supplier_id
                                    )
                                  }
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="warehouse-cell">
                              <Icon
                                name="box"
                                size={15}
                              />

                              <span>
                                {warehouseName(
                                  po.warehouse_id
                                )}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="date-cell">
                              <Icon
                                name="calendar"
                                size={14}
                              />
                              {formatDate(
                                po.order_date
                              )}
                            </div>
                          </td>

                          <td>
                            <div
                              className={
                                overdue
                                  ? "date-cell overdue"
                                  : "date-cell"
                              }
                            >
                              <Icon
                                name={
                                  overdue
                                    ? "warning"
                                    : "calendar"
                                }
                                size={14}
                              />

                              {formatDate(
                                po.expected_date
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="receiving-cell">
                              <div className="receiving-numbers">
                                <strong>
                                  {
                                    itemData.received
                                  }
                                </strong>

                                <span>
                                  /
                                </span>

                                <span>
                                  {
                                    itemData.quantity
                                  }
                                </span>
                              </div>

                              <div className="progress-track">
                                <div
                                  className="progress-bar"
                                  style={{
                                    width: `${progress}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          <td>
                            <strong className="amount">
                              {formatCurrency(
                                Number(
                                  po.total_amount ||
                                    0
                                ),
                                po.currency ||
                                  companyCurrency
                              )}
                            </strong>
                          </td>

                          <td>
                            <span
                              className={statusClass(
                                po.status
                              )}
                            >
                              <span className="status-dot" />
                              {statusLabel(
                                po.status
                              )}
                            </span>
                          </td>

                          <td
                            className="actions-cell"
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                          >
                            <button
                              type="button"
                              className="icon-button"
                              title="Open"
                              onClick={() =>
                                router.push(
                                  `/purchase-orders/${po.id}`
                                )
                              }
                            >
                              <Icon
                                name="chevron"
                                size={17}
                              />
                            </button>

                            <div className="menu-wrap">
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() =>
                                  setOpenMenu(
                                    openMenu ===
                                      po.id
                                      ? null
                                      : po.id
                                  )
                                }
                              >
                                <Icon
                                  name="more"
                                  size={18}
                                />
                              </button>

                              {openMenu ===
                                po.id && (
                                <div className="action-menu">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenu(
                                        null
                                      );

                                      router.push(
                                        `/purchase-orders/${po.id}`
                                      );
                                    }}
                                  >
                                    <Icon
                                      name="eye"
                                      size={15}
                                    />
                                    View Purchase Order
                                  </button>

                                  {itemData.quantity >
                                    itemData.received &&
                                    po.status !==
                                      "cancelled" && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenu(
                                            null
                                          );

                                          router.push(
                                            `/purchase-orders/${po.id}/receive`
                                          );
                                        }}
                                      >
                                        <Icon
                                          name="receive"
                                          size={15}
                                        />
                                        Receive Stock
                                      </button>
                                    )}

                                  {(po.status ===
                                    "draft" ||
                                    po.status ===
                                      "cancelled") && (
                                    <button
                                      type="button"
                                      className="danger-menu-item"
                                      onClick={() =>
                                        void deletePurchaseOrder(
                                          po
                                        )
                                      }
                                    >
                                      <Icon
                                        name="trash"
                                        size={15}
                                      />
                                      Delete
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style jsx>{styles}</style>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  warning = false,
  moneyValue = false,
}: {
  icon:
    | "box"
    | "truck"
    | "check"
    | "clock"
    | "warning";
  label: string;
  value: number | string;
  detail: string;
  warning?: boolean;
  moneyValue?: boolean;
}) {
  return (
    <div
      className={
        warning
          ? "stat-card warning-card"
          : "stat-card"
      }
    >
      <div className="stat-top">
        <div className="stat-icon">
          <Icon
            name={icon}
            size={18}
          />
        </div>

        {warning && (
          <span className="warning-label">
            Attention
          </span>
        )}
      </div>

      <div
        className={
          moneyValue
            ? "stat-value money-value"
            : "stat-value"
        }
      >
        {value}
      </div>

      <div className="stat-label">
        {label}
      </div>

      <div className="stat-detail">
        {detail}
      </div>
    </div>
  );
}

const styles = `
  .page-content {
    padding: 28px;
    max-width: 1700px;
    margin: 0 auto;
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
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .1em;
  }

  .eyebrow span {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #16a34a;
  }

  .page-title {
    margin: 6px 0 4px;
    color: #0f172a;
    font-size: 30px;
    line-height: 1.15;
    font-weight: 750;
    letter-spacing: -.025em;
  }

  .page-subtitle {
    margin: 0;
    color: #64748b;
    font-size: 14px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .primary-button,
  .secondary-button {
    min-height: 40px;
    padding: 0 15px;
    border-radius: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: .15s ease;
  }

  .primary-button {
    border: 1px solid #166534;
    background: #166534;
    color: white;
  }

  .primary-button:hover {
    background: #14532d;
  }

  .secondary-button {
    border: 1px solid #d7dee7;
    background: white;
    color: #334155;
  }

  .secondary-button:hover {
    background: #f8fafc;
  }

  .primary-button:disabled,
  .secondary-button:disabled {
    opacity: .6;
    cursor: not-allowed;
  }

  .alert {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 12px 14px;
    border-radius: 10px;
    margin-bottom: 18px;
    font-size: 13px;
  }

  .error-alert {
    color: #991b1b;
    background: #fef2f2;
    border: 1px solid #fecaca;
  }

  .error-alert button {
    margin-left: auto;
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .stat-card {
    min-width: 0;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 17px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, .03);
  }

  .warning-card {
    border-color: #fed7aa;
  }

  .stat-top {
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-icon {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #166534;
    background: #f0fdf4;
  }

  .warning-card .stat-icon {
    color: #c2410c;
    background: #fff7ed;
  }

  .warning-label {
    color: #c2410c;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .06em;
  }

  .stat-value {
    margin-top: 14px;
    color: #0f172a;
    font-size: 23px;
    line-height: 1;
    font-weight: 750;
  }

  .money-value {
    font-size: 20px;
  }

  .stat-label {
    margin-top: 8px;
    color: #334155;
    font-size: 12px;
    font-weight: 700;
  }

  .stat-detail {
    margin-top: 3px;
    color: #94a3b8;
    font-size: 11px;
  }

  .toolbar-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px;
    margin-bottom: 12px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, .03);
  }

  .search-box {
    min-width: 300px;
    flex: 1;
    height: 40px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 12px;
    border: 1px solid #dbe1e7;
    border-radius: 9px;
    background: #ffffff;
    color: #94a3b8;
  }

  .search-box:focus-within {
    border-color: #94a3b8;
    box-shadow: 0 0 0 3px rgba(22, 101, 52, .06);
  }

  .search-box input {
    width: 100%;
    height: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    color: #0f172a;
    font-size: 13px;
  }

  .search-box input::placeholder {
    color: #94a3b8;
  }

  .toolbar-card select {
    height: 40px;
    min-width: 155px;
    padding: 0 34px 0 11px;
    border: 1px solid #dbe1e7;
    border-radius: 9px;
    outline: 0;
    background: #ffffff;
    color: #334155;
    font-size: 12px;
    cursor: pointer;
  }

  .clear-button {
    height: 40px;
    padding: 0 12px;
    border: 0;
    background: transparent;
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .clear-button:hover {
    color: #166534;
  }

  .results-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 3px 10px;
    color: #64748b;
    font-size: 12px;
  }

  .results-row strong {
    color: #0f172a;
  }

  .results-row span {
    color: #94a3b8;
  }

  .content-card {
    overflow: hidden;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, .03);
  }

  .table-scroll {
    width: 100%;
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 1260px;
    border-collapse: collapse;
  }

  th {
    height: 44px;
    padding: 0 15px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
    color: #64748b;
    text-align: left;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .07em;
    white-space: nowrap;
  }

  td {
    padding: 14px 15px;
    border-bottom: 1px solid #eef2f7;
    color: #475569;
    font-size: 13px;
    vertical-align: middle;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  .table-row {
    cursor: pointer;
    transition: background .12s ease;
  }

  .table-row:hover {
    background: #fafdfb;
  }

  .po-number {
    color: #0f172a;
    font-size: 13px;
    font-weight: 750;
  }

  .po-reference {
    margin-top: 4px;
    color: #94a3b8;
    font-size: 11px;
  }

  .supplier-cell strong {
    display: block;
    color: #334155;
    font-size: 13px;
    font-weight: 700;
  }

  .supplier-cell span {
    display: block;
    margin-top: 3px;
    color: #94a3b8;
    font-size: 11px;
  }

  .warehouse-cell,
  .date-cell {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #64748b;
    white-space: nowrap;
  }

  .warehouse-cell svg {
    color: #94a3b8;
  }

  .overdue {
    color: #b91c1c;
  }

  .receiving-cell {
    width: 105px;
  }

  .receiving-numbers {
    display: flex;
    align-items: baseline;
    gap: 4px;
    color: #94a3b8;
    font-size: 11px;
  }

  .receiving-numbers strong {
    color: #166534;
    font-size: 13px;
  }

  .progress-track {
    width: 100%;
    height: 5px;
    margin-top: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: #e2e8f0;
  }

  .progress-bar {
    height: 100%;
    border-radius: inherit;
    background: #16a34a;
  }

  .amount {
    color: #0f172a;
    font-size: 13px;
    white-space: nowrap;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 9px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: currentColor;
  }

  .status.draft {
    color: #64748b;
    background: #f1f5f9;
  }

  .status.sent {
    color: #2563eb;
    background: #eff6ff;
  }

  .status.confirmed {
    color: #7c3aed;
    background: #f5f3ff;
  }

  .status.partial {
    color: #b45309;
    background: #fffbeb;
  }

  .status.received {
    color: #15803d;
    background: #f0fdf4;
  }

  .status.cancelled {
    color: #b91c1c;
    background: #fef2f2;
  }

  .actions-cell {
    width: 86px;
    text-align: right;
    white-space: nowrap;
  }

  .icon-button {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 3px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: #64748b;
    cursor: pointer;
  }

  .icon-button:hover {
    border-color: #e2e8f0;
    background: #f8fafc;
    color: #0f172a;
  }

  .menu-wrap {
    position: relative;
    display: inline-block;
  }

  .action-menu {
    position: absolute;
    z-index: 30;
    top: 38px;
    right: 0;
    width: 205px;
    padding: 6px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: white;
    box-shadow: 0 12px 30px rgba(15, 23, 42, .12);
  }

  .action-menu button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 10px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #334155;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .action-menu button:hover {
    background: #f8fafc;
  }

  .action-menu .danger-menu-item {
    color: #b91c1c;
  }

  .empty-state {
    min-height: 430px;
    padding: 70px 25px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .empty-icon {
    width: 58px;
    height: 58px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 15px;
    background: #f0fdf4;
    color: #166534;
    margin-bottom: 16px;
  }

  .empty-state h2 {
    margin: 0;
    color: #0f172a;
    font-size: 17px;
  }

  .empty-state p {
    max-width: 480px;
    margin: 7px 0 18px;
    color: #64748b;
    font-size: 13px;
    line-height: 1.6;
  }

  .loading-card {
    min-height: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: white;
    color: #64748b;
  }

  .loading-card p {
    margin: 14px 0 0;
    font-size: 13px;
  }

  .loading-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid #e2e8f0;
    border-top-color: #166534;
    border-radius: 999px;
    animation: spin .8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1250px) {
    .stats-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .toolbar-card {
      flex-wrap: wrap;
    }

    .search-box {
      min-width: 100%;
    }
  }

  @media (max-width: 760px) {
    .page-content {
      padding: 18px;
    }

    .page-header {
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions button {
      flex: 1;
    }

    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .toolbar-card select {
      flex: 1;
      min-width: 140px;
    }
  }

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }

    .header-actions {
      flex-direction: column;
    }

    .header-actions button {
      width: 100%;
    }
  }
`;