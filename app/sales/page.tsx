"use client";

import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Eye,
  Filter,
  PackageCheck,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
  Warehouse,
  X,
} from "lucide-react";

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
};

type SalesOrder = {
  id: string;
  company_id: string;
  customer_id: string | null;
  order_number: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
};

type Fulfillment = {
  id: string;
  order_id: string;
  order_item_id: string;
  warehouse_id: string;
  location_id: string | null;
  quantity: number;
  batch_id: string | null;
  batch_quantity: number | null;
  unit_cost: number | null;
  serialized_unit_id: string | null;
  inventory_movement_id: string | null;
  created_at: string;
};

type WarehouseRow = {
  id: string;
  name: string;
  code: string;
};

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

const PAYMENT_OPTIONS = [
  { value: "all", label: "All payments" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "partially_refunded", label: "Partially refunded" },
  { value: "refunded", label: "Refunded" },
];

const FULFILLMENT_OPTIONS = [
  { value: "all", label: "All fulfillment" },
  { value: "unfulfilled", label: "Unfulfilled" },
  { value: "partially_fulfilled", label: "Partially fulfilled" },
  { value: "fulfilled", label: "Fulfilled" },
];

function StatCard({
  label,
  value,
  helper,
  icon,
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div className="stat-copy">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        <div className="stat-helper">{helper}</div>
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatMoney(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${currency} ${Number(value || 0).toFixed(2)}`;
  }
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getCustomerName(customer?: Customer | null) {
  if (!customer) return "Walk-in customer";

  return customer.name || customer.email || "Unnamed customer";
}

function getStatusClass(status: string) {
  switch (status) {
    case "completed":
    case "paid":
    case "fulfilled":
      return "status status-success";

    case "confirmed":
    case "processing":
    case "partially_fulfilled":
    case "partially_paid":
      return "status status-info";

    case "pending":
      return "status status-warning";

    case "cancelled":
    case "refunded":
      return "status status-danger";

    default:
      return "status status-neutral";
  }
}

function getStatusLabel(status: string) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getFulfillmentLabel(status: string) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function SalesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] =
    useState("all");

  const [expandedOrderId, setExpandedOrderId] = useState<
    string | null
  >(null);

  const [showFilters, setShowFilters] = useState(false);

  const loadSales = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");
      setSuccessMessage("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const {
          data: membershipData,
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

        if (!membershipData?.company_id) {
          throw new Error(
            "No company workspace is available for this account.",
          );
        }

        const currentCompanyId =
          membershipData.company_id;

        setCompanyId(currentCompanyId);

        const [
          ordersResult,
          orderItemsResult,
          fulfillmentsResult,
          warehousesResult,
        ] = await Promise.all([
          supabase
            .from("orders")
            .select(
              `
                id,
                company_id,
                customer_id,
                order_number,
                status,
                payment_status,
                fulfillment_status,
                currency,
                subtotal,
                discount_amount,
                tax_amount,
                shipping_amount,
                total_amount,
                notes,
                created_at,
                updated_at,
                customers (
                  id,
                  name,
                  email
                )
              `,
            )
            .eq("company_id", currentCompanyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("order_items")
            .select(
              `
                id,
                order_id,
                product_name,
                variant_name,
                sku,
                quantity,
                unit_price,
                unit_cost,
                discount_amount,
                tax_amount,
                line_total
              `,
            )
            .eq("company_id", currentCompanyId)
            .order("created_at", {
              ascending: true,
            }),

          supabase
            .from("order_item_fulfillments")
            .select(
              `
                id,
                order_id,
                order_item_id,
                warehouse_id,
                location_id,
                quantity,
                batch_id,
                batch_quantity,
                unit_cost,
                serialized_unit_id,
                inventory_movement_id,
                created_at
              `,
            )
            .eq("company_id", currentCompanyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("warehouses")
            .select("id, name, code")
            .eq("company_id", currentCompanyId)
            .order("name", {
              ascending: true,
            }),
        ]);

        if (ordersResult.error) {
          throw ordersResult.error;
        }

        if (orderItemsResult.error) {
          throw orderItemsResult.error;
        }

        if (fulfillmentsResult.error) {
          throw fulfillmentsResult.error;
        }

        if (warehousesResult.error) {
          throw warehousesResult.error;
        }

        const normalizedOrders: SalesOrder[] = (
          ordersResult.data || []
        ).map((order: any) => ({
          ...order,
          customer: Array.isArray(order.customers)
            ? order.customers[0] || null
            : order.customers || null,
        }));

        setOrders(normalizedOrders);
        setOrderItems(
          (orderItemsResult.data || []) as OrderItem[],
        );
        setFulfillments(
          (fulfillmentsResult.data || []) as Fulfillment[],
        );
        setWarehouses(
          (warehousesResult.data ||
            []) as WarehouseRow[],
        );
      } catch (error) {
        console.error("Sales load error:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load sales orders.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase],
  );

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const orderItemsByOrder = useMemo(() => {
    const map = new Map<string, OrderItem[]>();

    for (const item of orderItems) {
      const current =
        map.get(item.order_id) || [];

      current.push(item);

      map.set(item.order_id, current);
    }

    return map;
  }, [orderItems]);

  const fulfillmentsByOrderItem = useMemo(() => {
    const map = new Map<string, Fulfillment[]>();

    for (const fulfillment of fulfillments) {
      const current =
        map.get(fulfillment.order_item_id) || [];

      current.push(fulfillment);

      map.set(
        fulfillment.order_item_id,
        current,
      );
    }

    return map;
  }, [fulfillments]);

  const warehouseMap = useMemo(() => {
    return new Map(
      warehouses.map((warehouse) => [
        warehouse.id,
        warehouse,
      ]),
    );
  }, [warehouses]);

  const getFulfilledQuantity = useCallback(
    (orderId: string) => {
      return fulfillments
        .filter(
          (fulfillment) =>
            fulfillment.order_id === orderId,
        )
        .reduce(
          (sum, fulfillment) =>
            sum +
            Number(fulfillment.quantity || 0),
          0,
        );
    },
    [fulfillments],
  );

  const getOrderedQuantity = useCallback(
    (orderId: string) => {
      return orderItems
        .filter(
          (item) => item.order_id === orderId,
        )
        .reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0),
          0,
        );
    },
    [orderItems],
  );

  const filteredOrders = useMemo(() => {
    const query = normalize(search);

    return orders.filter((order) => {
      const customerName =
        getCustomerName(order.customer);

      const searchable = [
        order.order_number,
        customerName,
        order.customer?.email,
        order.status,
        order.payment_status,
        order.fulfillment_status,
      ]
        .filter(Boolean)
        .map((value) => normalize(value))
        .join(" ");

      const matchesSearch =
        !query || searchable.includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        order.status === statusFilter;

      const matchesPayment =
        paymentFilter === "all" ||
        order.payment_status === paymentFilter;

      const matchesFulfillment =
        fulfillmentFilter === "all" ||
        order.fulfillment_status ===
          fulfillmentFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment &&
        matchesFulfillment
      );
    });
  }, [
    orders,
    search,
    statusFilter,
    paymentFilter,
    fulfillmentFilter,
  ]);

  const metrics = useMemo(() => {
    const activeOrders = orders.filter(
      (order) =>
        order.status !== "cancelled" &&
        order.status !== "refunded",
    );

    const salesValue = activeOrders.reduce(
      (sum, order) =>
        sum + Number(order.total_amount || 0),
      0,
    );

    const unpaidOrders = activeOrders.filter(
      (order) =>
        order.payment_status === "unpaid" ||
        order.payment_status === "partially_paid",
    );

    const unpaidValue = unpaidOrders.reduce(
      (sum, order) =>
        sum + Number(order.total_amount || 0),
      0,
    );

    const unfulfilled = orders.filter(
      (order) =>
        order.fulfillment_status ===
        "unfulfilled",
    ).length;

    const partial = orders.filter(
      (order) =>
        order.fulfillment_status ===
        "partially_fulfilled",
    ).length;

    const fulfilled = orders.filter(
      (order) =>
        order.fulfillment_status === "fulfilled",
    ).length;

    const paid = orders.filter(
      (order) =>
        order.payment_status === "paid",
    ).length;

    return {
      totalOrders: orders.length,
      activeOrders: activeOrders.length,
      salesValue,
      unpaidValue,
      unpaidOrders: unpaidOrders.length,
      unfulfilled,
      partial,
      fulfilled,
      paid,
    };
  }, [orders]);

  const hasFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    paymentFilter !== "all" ||
    fulfillmentFilter !== "all";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setFulfillmentFilter("all");
  }

  function toggleExpanded(orderId: string) {
    setExpandedOrderId((current) =>
      current === orderId ? null : orderId,
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div className="sales-page">
          <div className="loading-card">
            <div className="spinner" />
            <span>Loading sales...</span>
          </div>

          <style jsx>{styles}</style>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="sales-page">
        {/* Header */}
        <div className="page-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              SALES MANAGEMENT
            </div>

            <h1 className="page-title">
              Sales
            </h1>

            <p className="page-subtitle">
              Manage sales orders, payments,
              fulfillment, batch allocation and
              serialized inventory.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadSales(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={
                  refreshing ? "spin" : ""
                }
              />
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                router.push("/sales/new")
              }
            >
              <ClipboardList size={17} />
              New Sale
            </button>
          </div>
        </div>

        {/* Error */}
        {errorMessage ? (
          <div className="alert alert-error">
            <AlertCircle size={18} />

            <div>
              <strong>
                Unable to load sales
              </strong>

              <span>{errorMessage}</span>
            </div>

            <button
              type="button"
              className="alert-close"
              onClick={() =>
                setErrorMessage("")
              }
              aria-label="Close error"
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        {/* Success */}
        {successMessage ? (
          <div className="alert alert-success">
            <CheckCircle2 size={18} />

            <span>{successMessage}</span>

            <button
              type="button"
              className="alert-close"
              onClick={() =>
                setSuccessMessage("")
              }
              aria-label="Close message"
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        {/* Stats */}
        <div className="stats-grid">
          <StatCard
            label="Total Orders"
            value={formatNumber(
              metrics.totalOrders,
            )}
            helper={`${formatNumber(
              metrics.activeOrders,
            )} active orders`}
            icon={
              <ClipboardList size={19} />
            }
          />

          <StatCard
            label="Sales Value"
            value={
              orders.length
                ? formatMoney(
                    metrics.salesValue,
                    orders[0]?.currency ||
                      "USD",
                  )
                : formatMoney(0, "USD")
            }
            helper="Active order value"
            icon={
              <CircleDollarSign size={19} />
            }
          />

          <StatCard
            label="Awaiting Payment"
            value={
              orders.length
                ? formatMoney(
                    metrics.unpaidValue,
                    orders[0]?.currency ||
                      "USD",
                  )
                : formatMoney(0, "USD")
            }
            helper={`${formatNumber(
              metrics.unpaidOrders,
            )} unpaid / partial`}
            icon={
              <CircleDollarSign size={19} />
            }
          />

          <StatCard
            label="Fulfillment Queue"
            value={formatNumber(
              metrics.unfulfilled +
                metrics.partial,
            )}
            helper={`${formatNumber(
              metrics.unfulfilled,
            )} unfulfilled · ${formatNumber(
              metrics.partial,
            )} partial`}
            icon={
              <PackageCheck size={19} />
            }
          />

          <StatCard
            label="Paid Orders"
            value={formatNumber(
              metrics.paid,
            )}
            helper="Payment completed"
            icon={
              <CheckCircle2 size={19} />
            }
          />

          <StatCard
            label="Warehouses"
            value={formatNumber(
              warehouses.length,
            )}
            helper="Fulfillment locations"
            icon={
              <Warehouse size={19} />
            }
          />
        </div>

        {/* Toolbar */}
        <div className="toolbar-card">
          <div className="search-wrap">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search orders, customers, email..."
            />

            {search ? (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className={`filter-toggle ${
              showFilters ? "active" : ""
            }`}
            onClick={() =>
              setShowFilters(
                (value) => !value,
              )
            }
          >
            <SlidersHorizontal size={16} />

            Filters

            {hasFilters ? (
              <span className="filter-count">
                {
                  [
                    search.trim() !== "",
                    statusFilter !== "all",
                    paymentFilter !== "all",
                    fulfillmentFilter !==
                      "all",
                  ].filter(Boolean).length
                }
              </span>
            ) : null}
          </button>

          {hasFilters ? (
            <button
              type="button"
              className="clear-filters"
              onClick={clearFilters}
            >
              Clear all
            </button>
          ) : null}
        </div>

        {/* Filters */}
        {showFilters ? (
          <div className="filters-card">
            <div className="filter-group">
              <label>Status</label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value,
                  )
                }
              >
                {STATUS_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="filter-group">
              <label>Payment</label>

              <select
                value={paymentFilter}
                onChange={(event) =>
                  setPaymentFilter(
                    event.target.value,
                  )
                }
              >
                {PAYMENT_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="filter-group">
              <label>Fulfillment</label>

              <select
                value={fulfillmentFilter}
                onChange={(event) =>
                  setFulfillmentFilter(
                    event.target.value,
                  )
                }
              >
                {FULFILLMENT_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="filter-summary">
              <Filter size={15} />

              <span>
                {hasFilters
                  ? "Filtered results"
                  : "All sales orders"}
              </span>
            </div>
          </div>
        ) : null}

        {/* Orders */}
        <div className="content-card">
          <div className="content-card-header">
            <div>
              <div className="section-title">
                Sales Orders
              </div>

              <div className="section-helper">
                {filteredOrders.length ===
                orders.length
                  ? `${formatNumber(
                      orders.length,
                    )} orders`
                  : `${formatNumber(
                      filteredOrders.length,
                    )} of ${formatNumber(
                      orders.length,
                    )} orders`}
              </div>
            </div>

            <div className="table-meta">
              <Activity size={15} />

              {hasFilters
                ? "Filtered results"
                : "All orders"}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <ClipboardList size={25} />
              </div>

              <h3>
                {orders.length === 0
                  ? "No sales orders yet"
                  : "No matching orders"}
              </h3>

              <p>
                {orders.length === 0
                  ? "Create your first sales order to start managing sales and fulfillment."
                  : "Try changing your search or filters."}
              </p>

              <div className="empty-actions">
                {orders.length === 0 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      router.push(
                        "/sales/new",
                      )
                    }
                  >
                    <ClipboardList
                      size={16}
                    />
                    New Sale
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={clearFilters}
                  >
                    <Filter size={16} />
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th className="expand-column" />

                    <th className="order-column">
                      Order
                    </th>

                    <th>Customer</th>

                    <th>Status</th>

                    <th>Payment</th>

                    <th>Fulfillment</th>

                    <th className="numeric-column">
                      Total
                    </th>

                    <th>Created</th>

                    <th className="actions-column">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map(
                    (order) => {
                      const items =
                        orderItemsByOrder.get(
                          order.id,
                        ) || [];

                      const fulfilledQty =
                        getFulfilledQuantity(
                          order.id,
                        );

                      const orderedQty =
                        getOrderedQuantity(
                          order.id,
                        );

                      const expanded =
                        expandedOrderId ===
                        order.id;

                      return (
                        <Fragment
                          key={order.id}
                        >
                          <tr
                            className={
                              expanded
                                ? "order-row expanded"
                                : "order-row"
                            }
                          >
                            <td>
                              <button
                                type="button"
                                className="expand-button"
                                onClick={() =>
                                  toggleExpanded(
                                    order.id,
                                  )
                                }
                                aria-label={
                                  expanded
                                    ? "Collapse order"
                                    : "Expand order"
                                }
                              >
                                {expanded ? (
                                  <ChevronDown
                                    size={16}
                                  />
                                ) : (
                                  <ChevronRight
                                    size={16}
                                  />
                                )}
                              </button>
                            </td>

                            <td>
                              <div className="order-cell">
                                <div className="order-avatar">
                                  <ClipboardList
                                    size={17}
                                  />
                                </div>

                                <div className="order-copy">
                                  <button
                                    type="button"
                                    className="order-number"
                                    onClick={() =>
                                      router.push(
                                        `/sales/${order.id}`,
                                      )
                                    }
                                  >
                                    {
                                      order.order_number
                                    }
                                  </button>

                                  <div className="order-sub">
                                    {
                                      items.length
                                    }{" "}
                                    {items.length ===
                                    1
                                      ? "line"
                                      : "lines"}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="customer-cell">
                                <div className="customer-name">
                                  {
                                    getCustomerName(
                                      order.customer,
                                    )
                                  }
                                </div>

                                {order.customer
                                  ?.email ? (
                                  <div className="customer-email">
                                    {
                                      order
                                        .customer
                                        .email
                                    }
                                  </div>
                                ) : null}
                              </div>
                            </td>

                            <td>
                              <span
                                className={getStatusClass(
                                  order.status,
                                )}
                              >
                                <span className="status-dot" />

                                {getStatusLabel(
                                  order.status,
                                )}
                              </span>
                            </td>

                            <td>
                              <span
                                className={getStatusClass(
                                  order.payment_status,
                                )}
                              >
                                <span className="status-dot" />

                                {getStatusLabel(
                                  order.payment_status,
                                )}
                              </span>
                            </td>

                            <td>
                              <div className="fulfillment-cell">
                                <span
                                  className={getStatusClass(
                                    order.fulfillment_status,
                                  )}
                                >
                                  <span className="status-dot" />

                                  {getFulfillmentLabel(
                                    order.fulfillment_status,
                                  )}
                                </span>

                                <span className="quantity-sub">
                                  {formatNumber(
                                    fulfilledQty,
                                  )}{" "}
                                  /{" "}
                                  {formatNumber(
                                    orderedQty,
                                  )}{" "}
                                  units
                                </span>
                              </div>
                            </td>

                            <td className="numeric-column">
                              <div className="money-cell">
                                <strong>
                                  {formatMoney(
                                    Number(
                                      order.total_amount ||
                                        0,
                                    ),
                                    order.currency,
                                  )}
                                </strong>

                                <span>
                                  {
                                    order.currency
                                  }
                                </span>
                              </div>
                            </td>

                            <td>
                              <div className="date-cell">
                                <strong>
                                  {formatDate(
                                    order.created_at,
                                  )}
                                </strong>

                                <span>
                                  {formatDateTime(
                                    order.created_at,
                                  )}
                                </span>
                              </div>
                            </td>

                            <td>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="icon-action"
                                  title="View order"
                                  aria-label="View order"
                                  onClick={() =>
                                    router.push(
                                      `/sales/${order.id}`,
                                    )
                                  }
                                >
                                  <Eye
                                    size={16}
                                  />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {expanded ? (
                            <tr className="detail-row">
                              <td
                                colSpan={9}
                              >
                                <div className="detail-panel">
                                  <div className="detail-panel-header">
                                    <div>
                                      <div className="detail-panel-title">
                                        Order Items &
                                        Inventory
                                        Fulfillment
                                      </div>

                                      <div className="detail-panel-helper">
                                        Batch and
                                        serialized
                                        fulfillment
                                        records
                                        linked to
                                        this order.
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      className="btn btn-small"
                                      onClick={() =>
                                        router.push(
                                          `/sales/${order.id}`,
                                        )
                                      }
                                    >
                                      <Eye
                                        size={14}
                                      />
                                      Open Order
                                    </button>
                                  </div>

                                  {items.length ===
                                  0 ? (
                                    <div className="detail-empty">
                                      No order items
                                      found.
                                    </div>
                                  ) : (
                                    <div className="detail-table-scroll">
                                      <table className="detail-table">
                                        <thead>
                                          <tr>
                                            <th>
                                              Item
                                            </th>

                                            <th>
                                              SKU
                                            </th>

                                            <th className="numeric-column">
                                              Ordered
                                            </th>

                                            <th className="numeric-column">
                                              Fulfilled
                                            </th>

                                            <th>
                                              Inventory
                                              Source
                                            </th>

                                            <th className="numeric-column">
                                              Line Total
                                            </th>
                                          </tr>
                                        </thead>

                                        <tbody>
                                          {items.map(
                                            (
                                              item,
                                            ) => {
                                              const itemFulfillments =
                                                fulfillmentsByOrderItem.get(
                                                  item.id,
                                                ) || [];

                                              const itemFulfilled =
                                                itemFulfillments.reduce(
                                                  (
                                                    sum,
                                                    fulfillment,
                                                  ) =>
                                                    sum +
                                                    Number(
                                                      fulfillment.quantity ||
                                                        0,
                                                    ),
                                                  0,
                                                );

                                              return (
                                                <tr
                                                  key={
                                                    item.id
                                                  }
                                                >
                                                  <td>
                                                    <div className="item-cell">
                                                      <div className="item-avatar">
                                                        <PackageCheck
                                                          size={
                                                            15
                                                          }
                                                        />
                                                      </div>

                                                      <div>
                                                        <div className="item-name">
                                                          {
                                                            item.product_name
                                                          }
                                                        </div>

                                                        {item.variant_name ? (
                                                          <div className="item-sub">
                                                            {
                                                              item.variant_name
                                                            }
                                                          </div>
                                                        ) : null}
                                                      </div>
                                                    </div>
                                                  </td>

                                                  <td>
                                                    <span className="muted-cell">
                                                      {item.sku ||
                                                        "—"}
                                                    </span>
                                                  </td>

                                                  <td className="numeric-column">
                                                    <span className="number-cell">
                                                      {formatNumber(
                                                        item.quantity,
                                                      )}
                                                    </span>
                                                  </td>

                                                  <td className="numeric-column">
                                                    <span
                                                      className={
                                                        itemFulfilled >=
                                                        Number(
                                                          item.quantity,
                                                        )
                                                          ? "fulfilled-number"
                                                          : "partial-number"
                                                      }
                                                    >
                                                      {formatNumber(
                                                        itemFulfilled,
                                                      )}
                                                    </span>
                                                  </td>

                                                  <td>
                                                    {itemFulfillments.length ===
                                                    0 ? (
                                                      <span className="muted-cell">
                                                        Not
                                                        fulfilled
                                                      </span>
                                                    ) : (
                                                      <div className="source-list">
                                                        {itemFulfillments.map(
                                                          (
                                                            fulfillment,
                                                          ) => {
                                                            const warehouse =
                                                              warehouseMap.get(
                                                                fulfillment.warehouse_id,
                                                              );

                                                            return (
                                                              <div
                                                                key={
                                                                  fulfillment.id
                                                                }
                                                                className="source-card"
                                                              >
                                                                <div className="source-top">
                                                                  <span className="source-quantity">
                                                                    {formatNumber(
                                                                      fulfillment.quantity,
                                                                    )}{" "}
                                                                    unit
                                                                    {fulfillment.quantity !==
                                                                    1
                                                                      ? "s"
                                                                      : ""}
                                                                  </span>

                                                                  <div className="source-badges">
                                                                    {fulfillment.batch_id ? (
                                                                      <span className="source-badge batch">
                                                                        Batch/Lot
                                                                      </span>
                                                                    ) : null}

                                                                    {fulfillment.serialized_unit_id ? (
                                                                      <span className="source-badge serial">
                                                                        Serialized
                                                                      </span>
                                                                    ) : null}
                                                                  </div>
                                                                </div>

                                                                <div className="source-warehouse">
                                                                  <Warehouse
                                                                    size={
                                                                      12
                                                                    }
                                                                  />

                                                                  {warehouse
                                                                    ? `${warehouse.name} (${warehouse.code})`
                                                                    : "Warehouse unavailable"}
                                                                </div>
                                                              </div>
                                                            );
                                                          },
                                                        )}
                                                      </div>
                                                    )}
                                                  </td>

                                                  <td className="numeric-column">
                                                    <strong className="line-total">
                                                      {formatMoney(
                                                        Number(
                                                          item.line_total ||
                                                            0,
                                                        ),
                                                        order.currency,
                                                      )}
                                                    </strong>
                                                  </td>
                                                </tr>
                                              );
                                            },
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="module-footer">
          <div>
            Sales is connected to the V2 inventory
            engine:
            <strong>
              {" "}
              Product → Variant → Batch/Lot →
              optional Serialized Unit.
            </strong>
          </div>

          <div className="footer-context">
            Company-scoped data
            {companyId
              ? " · secure company context"
              : ""}
          </div>
        </div>

        <style jsx>{styles}</style>
      </div>
    </AppShell>
  );
}

const styles = `
  .sales-page {
    min-height: 100%;
    padding: 28px;
  }

  .page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 22px;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    margin-bottom: 7px;
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
    font-weight: 750;
    letter-spacing: -0.025em;
  }

  .page-subtitle {
    margin: 7px 0 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.5;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn {
    min-height: 40px;
    border-radius: 10px;
    border: 1px solid #d1d5db;
    background: #fff;
    color: #334155;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: 0.15s ease;
  }

  .btn:hover {
    border-color: #94a3b8;
    background: #f8fafc;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    color: #fff;
    background: #166534;
    border-color: #166534;
  }

  .btn-primary:hover {
    background: #14532d;
    border-color: #14532d;
  }

  .btn-secondary {
    background: #fff;
  }

  .btn-small {
    min-height: 34px;
    padding: 0 11px;
    font-size: 12px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .stat-card {
    min-height: 112px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 17px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    box-shadow: 0 2px 7px rgba(15, 23, 42, 0.035);
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #f0fdf4;
    color: #166534;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }

  .stat-copy {
    min-width: 0;
  }

  .stat-label {
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .stat-value {
    color: #0f172a;
    font-size: 23px;
    font-weight: 750;
    line-height: 1.15;
    margin-top: 5px;
    white-space: nowrap;
  }

  .stat-helper {
    color: #94a3b8;
    font-size: 11px;
    margin-top: 5px;
    white-space: nowrap;
  }

  .toolbar-card {
    min-height: 64px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 11px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    box-shadow: 0 2px 7px rgba(15, 23, 42, 0.035);
  }

  .search-wrap {
    height: 40px;
    flex: 1;
    min-width: 260px;
    border: 1px solid #dbe1e8;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 11px;
    color: #94a3b8;
    background: #fff;
  }

  .search-wrap:focus-within {
    border-color: #86a98f;
    box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
  }

  .search-wrap input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    color: #0f172a;
    font-size: 13px;
    background: transparent;
  }

  .search-wrap input::placeholder {
    color: #94a3b8;
  }

  .clear-search,
  .alert-close {
    border: 0;
    background: transparent;
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 3px;
  }

  .clear-search:hover,
  .alert-close:hover {
    color: #475569;
  }

  .filter-toggle {
    height: 40px;
    border: 1px solid #dbe1e8;
    background: #fff;
    color: #475569;
    border-radius: 10px;
    padding: 0 12px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
    white-space: nowrap;
  }

  .filter-toggle:hover,
  .filter-toggle.active {
    border-color: #a7c2ad;
    color: #166534;
    background: #f7fbf8;
  }

  .filter-count {
    min-width: 19px;
    height: 19px;
    padding: 0 5px;
    border-radius: 999px;
    background: #166534;
    color: #fff;
    font-size: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .clear-filters {
    border: 0;
    background: transparent;
    color: #166534;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    padding: 8px;
  }

  .filters-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 15px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 10px;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .filter-group label {
    color: #475569;
    font-size: 11px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.035em;
  }

  .filter-group select {
    height: 38px;
    border: 1px solid #dbe1e8;
    border-radius: 9px;
    padding: 0 10px;
    color: #334155;
    background: #fff;
    outline: none;
    font-size: 13px;
  }

  .filter-group select:focus {
    border-color: #86a98f;
    box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
  }

  .filter-summary {
    min-height: 38px;
    align-self: end;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 11px;
    border: 1px solid #e2e8f0;
    border-radius: 9px;
    color: #64748b;
    background: #f8fafc;
    font-size: 12px;
    font-weight: 650;
  }

  .content-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 2px 7px rgba(15, 23, 42, 0.035);
  }

  .content-card-header {
    min-height: 70px;
    padding: 16px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 1px solid #e5e7eb;
  }

  .section-title {
    color: #0f172a;
    font-size: 15px;
    font-weight: 750;
  }

  .section-helper {
    color: #94a3b8;
    font-size: 12px;
    margin-top: 3px;
  }

  .table-meta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #64748b;
    font-size: 12px;
    font-weight: 650;
  }

  .table-scroll,
  .detail-table-scroll {
    overflow-x: auto;
  }

  .sales-table {
    width: 100%;
    min-width: 1220px;
    border-collapse: separate;
    border-spacing: 0;
  }

  .sales-table th {
    height: 43px;
    padding: 0 14px;
    text-align: left;
    background: #f8fafc;
    color: #64748b;
    border-bottom: 1px solid #e5e7eb;
    font-size: 10px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.055em;
    white-space: nowrap;
  }

  .sales-table td {
    padding: 13px 14px;
    border-bottom: 1px solid #eef2f5;
    color: #334155;
    font-size: 13px;
    vertical-align: middle;
  }

  .order-row:hover td {
    background: #fcfdfd;
  }

  .order-row.expanded td {
    background: #fbfdfb;
    border-bottom-color: #e2e8e4;
  }

  .expand-column {
    width: 48px;
  }

  .order-column {
    width: 285px;
  }

  .numeric-column {
    text-align: right !important;
  }

  .actions-column {
    width: 80px;
    text-align: right !important;
  }

  .expand-button {
    width: 27px;
    height: 27px;
    flex: 0 0 auto;
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #64748b;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .expand-button:hover {
    color: #166534;
    border-color: #b8ccb9;
    background: #f7fbf8;
  }

  .order-cell {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .order-avatar {
    width: 36px;
    height: 36px;
    flex: 0 0 auto;
    border-radius: 9px;
    background: #f1f5f9;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .order-copy {
    min-width: 0;
  }

  .order-number {
    display: block;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border: 0;
    background: transparent;
    padding: 0;
    color: #0f172a;
    font-size: 13px;
    font-weight: 750;
    cursor: pointer;
    text-align: left;
  }

  .order-number:hover {
    color: #166534;
  }

  .order-sub {
    color: #94a3b8;
    font-size: 11px;
    margin-top: 3px;
  }

  .customer-cell {
    min-width: 150px;
  }

  .customer-name {
    color: #334155;
    font-size: 13px;
    font-weight: 650;
  }

  .customer-email {
    color: #94a3b8;
    font-size: 11px;
    margin-top: 3px;
    max-width: 190px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 750;
    white-space: nowrap;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: currentColor;
  }

  .status-success {
    color: #166534;
    background: #f0fdf4;
  }

  .status-info {
    color: #1d4ed8;
    background: #eff6ff;
  }

  .status-warning {
    color: #92400e;
    background: #fffbeb;
  }

  .status-danger {
    color: #991b1b;
    background: #fef2f2;
  }

  .status-neutral {
    color: #64748b;
    background: #f1f5f9;
  }

  .fulfillment-cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .quantity-sub {
    color: #94a3b8;
    font-size: 10px;
  }

  .money-cell {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
  }

  .money-cell strong {
    color: #0f172a;
    font-size: 13px;
    font-weight: 750;
  }

  .money-cell span {
    color: #94a3b8;
    font-size: 10px;
  }

  .date-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
    white-space: nowrap;
  }

  .date-cell strong {
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
  }

  .date-cell span {
    color: #94a3b8;
    font-size: 10px;
  }

  .row-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 5px;
  }

  .icon-action {
    width: 32px;
    height: 32px;
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #64748b;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .icon-action:hover {
    color: #166534;
    border-color: #b8ccb9;
    background: #f7fbf8;
  }

  .detail-row td {
    padding: 0;
    background: #fbfdfb;
  }

  .detail-panel {
    padding: 16px 20px 18px 72px;
    border-bottom: 1px solid #e5e7eb;
  }

  .detail-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 13px;
  }

  .detail-panel-title {
    color: #334155;
    font-size: 12px;
    font-weight: 750;
  }

  .detail-panel-helper {
    color: #94a3b8;
    font-size: 11px;
    margin-top: 2px;
  }

  .detail-empty {
    min-height: 65px;
    border: 1px dashed #cbd5e1;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 12px;
  }

  .detail-table {
    width: 100%;
    min-width: 900px;
    border-collapse: separate;
    border-spacing: 0;
  }

  .detail-table th {
    height: 38px;
    padding: 0 12px;
    text-align: left;
    background: #f8fafc;
    color: #94a3b8;
    border-bottom: 1px solid #e5e7eb;
    font-size: 9px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .detail-table td {
    padding: 11px 12px;
    border-bottom: 1px solid #eef2f5;
    color: #334155;
    font-size: 12px;
    vertical-align: middle;
  }

  .detail-table tr:last-child td {
    border-bottom: 0;
  }

  .item-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .item-avatar {
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    border-radius: 8px;
    background: #f1f5f9;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .item-name {
    color: #334155;
    font-size: 12px;
    font-weight: 700;
  }

  .item-sub {
    color: #94a3b8;
    font-size: 10px;
    margin-top: 2px;
  }

  .muted-cell {
    color: #64748b;
  }

  .number-cell {
    color: #475569;
    font-weight: 650;
  }

  .fulfilled-number {
    color: #166534;
    font-weight: 750;
  }

  .partial-number {
    color: #92400e;
    font-weight: 750;
  }

  .source-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 230px;
  }

  .source-card {
    border: 1px solid #e2e8f0;
    border-radius: 9px;
    background: #fff;
    padding: 8px 9px;
  }

  .source-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .source-quantity {
    color: #334155;
    font-size: 10px;
    font-weight: 750;
    white-space: nowrap;
  }

  .source-badges {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .source-badge {
    padding: 3px 6px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 750;
  }

  .source-badge.batch {
    color: #1d4ed8;
    background: #eff6ff;
  }

  .source-badge.serial {
    color: #7e22ce;
    background: #faf5ff;
  }

  .source-warehouse {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #94a3b8;
    font-size: 10px;
    margin-top: 5px;
  }

  .line-total {
    color: #334155;
    font-size: 12px;
    font-weight: 750;
    white-space: nowrap;
  }

  .empty-state {
    padding: 68px 24px;
    text-align: center;
  }

  .empty-icon {
    width: 52px;
    height: 52px;
    margin: 0 auto 14px;
    border-radius: 14px;
    background: #f1f5f9;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-state h3 {
    margin: 0;
    color: #0f172a;
    font-size: 16px;
    font-weight: 750;
  }

  .empty-state p {
    margin: 7px auto 0;
    max-width: 420px;
    color: #94a3b8;
    font-size: 13px;
    line-height: 1.5;
  }

  .empty-actions {
    margin-top: 17px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .loading-card {
    min-height: 280px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #64748b;
    font-size: 13px;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #dbe5de;
    border-top-color: #166534;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spin {
    animation: spin 0.8s linear infinite;
  }

  .alert {
    min-height: 52px;
    border-radius: 12px;
    padding: 11px 13px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    font-size: 13px;
  }

  .alert > div {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .alert strong {
    font-size: 12px;
  }

  .alert span {
    font-size: 12px;
  }

  .alert-error {
    border: 1px solid #fecaca;
    background: #fff7f7;
    color: #991b1b;
  }

  .alert-success {
    border: 1px solid #bbf7d0;
    background: #f0fdf4;
    color: #166534;
  }

  .alert-close {
    margin-left: auto;
  }

  .module-footer {
    margin-top: 12px;
    min-height: 48px;
    padding: 11px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    color: #94a3b8;
    font-size: 11px;
  }

  .module-footer strong {
    color: #64748b;
    font-weight: 650;
  }

  .footer-context {
    color: #94a3b8;
    white-space: nowrap;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1500px) {
    .stats-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .sales-page {
      padding: 20px;
    }

    .page-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions .btn {
      flex: 1;
    }

    .filters-card {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .detail-panel {
      padding-left: 20px;
    }

    .module-footer {
      align-items: flex-start;
      flex-direction: column;
    }

    .footer-context {
      white-space: normal;
    }
  }

  @media (max-width: 620px) {
    .sales-page {
      padding: 15px;
    }

    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .toolbar-card {
      flex-wrap: wrap;
    }

    .search-wrap {
      min-width: 100%;
      order: 1;
    }

    .filter-toggle,
    .clear-filters {
      order: 2;
    }

    .filters-card {
      grid-template-columns: 1fr;
    }

    .content-card-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .detail-panel-header {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;