"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  Package,
  RefreshCw,
  Truck,
  XCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  company_id: string;
  customer_id: string | null;
  order_number: string | null;
  status: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  currency: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  shipping_amount: number | null;
  total_amount: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type OrderItem = {
  id: string;
  company_id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string | null;
  variant_name: string | null;
  sku: string | null;
  quantity: number | null;
  unit_price: number | null;
  unit_cost: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  line_total: number | null;
};

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

type Company = {
  id: string;
  name: string | null;
  currency: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
) {
  const amount = Number(value || 0);

  let safeCurrency = String(currency || "USD").toUpperCase();

  /*
   * Intl.NumberFormat can throw when a bad currency value
   * exists in the database. Fall back to USD instead of
   * breaking the entire portal page.
   */
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    safeCurrency = "USD";

    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}

function labelize(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClass(value: string | null | undefined) {
  const status = String(value || "").toLowerCase();

  if (
    [
      "paid",
      "completed",
      "complete",
      "fulfilled",
      "delivered",
      "approved",
      "active",
    ].includes(status)
  ) {
    return "status-success";
  }

  if (
    [
      "cancelled",
      "canceled",
      "failed",
      "rejected",
      "refunded",
      "void",
    ].includes(status)
  ) {
    return "status-danger";
  }

  if (
    [
      "pending",
      "processing",
      "partial",
      "partially_paid",
      "partially_fulfilled",
      "in_progress",
    ].includes(status)
  ) {
    return "status-warning";
  }

  return "status-neutral";
}

function StatusBadge({
  value,
  fallback = "Unknown",
}: {
  value: string | null | undefined;
  fallback?: string;
}) {
  return (
    <span className={`status-badge ${getStatusClass(value)}`}>
      <span className="status-dot" />
      {value ? labelize(value) : fallback}
    </span>
  );
}

/*
 * Resolve the order ID from every common Next.js dynamic route
 * parameter shape.
 */
function resolveOrderId(
  params: Record<string, string | string[] | undefined>,
  pathname: string,
) {
  const possibleKeys = ["id", "orderId", "order_id"];

  for (const key of possibleKeys) {
    const value = params[key];

    if (Array.isArray(value) && value[0]) {
      return value[0];
    }

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  /*
   * Final fallback:
   *
   * /portal/orders/UUID
   * /portal/order/UUID
   *
   * If Next.js did not expose the dynamic parameter for some
   * reason, use the final URL segment.
   */
  const segments = pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const lastSegment = segments[segments.length - 1];

  if (
    lastSegment &&
    lastSegment !== "portal" &&
    lastSegment !== "orders" &&
    lastSegment !== "order"
  ) {
    try {
      return decodeURIComponent(lastSegment);
    } catch {
      return lastSegment;
    }
  }

  return "";
}

export default function PortalOrderDetailsPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const normalizedParams = useMemo(() => {
    const source = params || {};

    return Object.entries(source).reduce<
      Record<string, string | string[] | undefined>
    >((result, [key, value]) => {
      result[key] = value;
      return result;
    }, {});
  }, [params]);

  const orderId = useMemo(
    () => resolveOrderId(normalizedParams, pathname || ""),
    [normalizedParams, pathname],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  const loadOrder = useCallback(
    async (isRefresh = false) => {
      /*
       * Do not attempt a Supabase query without an ID.
       */
      if (!orderId) {
        console.error("Portal order details: no order ID resolved.", {
          pathname,
          params: normalizedParams,
        });

        setErrorMessage(
          "No order was specified. Please open the order from the Customer Portal.",
        );

        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        console.log("Loading customer portal order:", orderId);

        /*
         * ---------------------------------------------------------
         * 1. Current authenticated user
         * ---------------------------------------------------------
         */
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          router.replace("/portal/login");
          return;
        }

        /*
         * ---------------------------------------------------------
         * 2. Customer portal user
         * ---------------------------------------------------------
         *
         * IMPORTANT:
         * We deliberately do NOT request created_by_user_id.
         * That column does not exist in your customer_portal_users
         * table.
         */
        const {
          data: portalUser,
          error: portalUserError,
        } = await supabase
          .from("customer_portal_users")
          .select(
            `
              id,
              company_id,
              customer_id,
              role,
              status
            `,
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (portalUserError) {
          throw portalUserError;
        }

        if (!portalUser) {
          router.replace("/portal/login");
          return;
        }

        const portalStatus = String(
          portalUser.status || "active",
        ).toLowerCase();

        if (["suspended", "revoked"].includes(portalStatus)) {
          router.replace("/portal/login");
          return;
        }

        if (!portalUser.company_id || !portalUser.customer_id) {
          throw new Error(
            "Your customer portal account is missing its company or customer assignment.",
          );
        }

        const companyId = String(portalUser.company_id);
        const customerId = String(portalUser.customer_id);

        /*
         * ---------------------------------------------------------
         * 3. Load order
         * ---------------------------------------------------------
         */
        const {
          data: orderData,
          error: orderError,
        } = await supabase
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
              updated_at
            `,
          )
          .eq("id", orderId)
          .eq("company_id", companyId)
          .eq("customer_id", customerId)
          .maybeSingle();

        if (orderError) {
          throw orderError;
        }

        if (!orderData) {
          throw new Error(
            "This order could not be found or is not available in your customer portal.",
          );
        }

        /*
         * ---------------------------------------------------------
         * 4. Load order items
         * ---------------------------------------------------------
         */
        const {
          data: itemData,
          error: itemError,
        } = await supabase
          .from("order_items")
          .select(
            `
              id,
              company_id,
              order_id,
              product_id,
              variant_id,
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
          .eq("order_id", orderId)
          .eq("company_id", companyId)
          .order("id", { ascending: true });

        if (itemError) {
          throw itemError;
        }

        /*
         * ---------------------------------------------------------
         * 5. Load customer
         * ---------------------------------------------------------
         */
        const {
          data: customerData,
          error: customerError,
        } = await supabase
          .from("customers")
          .select(
            `
              id,
              name,
              email,
              phone,
              address_line1,
              address_line2,
              city,
              state,
              country
            `,
          )
          .eq("id", customerId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (customerError) {
          throw customerError;
        }

        /*
         * ---------------------------------------------------------
         * 6. Load company
         * ---------------------------------------------------------
         */
        const {
          data: companyData,
          error: companyError,
        } = await supabase
          .from("companies")
          .select("id,name,currency")
          .eq("id", companyId)
          .maybeSingle();

        if (companyError) {
          throw companyError;
        }

        setOrder(orderData as Order);
        setItems((itemData || []) as OrderItem[]);
        setCustomer(customerData as Customer | null);
        setCompany(companyData as Company | null);
      } catch (error) {
        console.error("Portal order details error:", error);

        const message =
          error instanceof Error
            ? error.message
            : typeof error === "object" &&
                error !== null &&
                "message" in error
              ? String(
                  (error as { message?: unknown }).message ||
                    "Unable to load the order.",
                )
              : "Unable to load the order.";

        setErrorMessage(message);
        setOrder(null);
        setItems([]);
        setCustomer(null);
        setCompany(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      orderId,
      pathname,
      normalizedParams,
      router,
      supabase,
    ],
  );

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const currency =
    order?.currency ||
    company?.currency ||
    "USD";

  const itemSubtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(item.line_total || 0),
        0,
      ),
    [items],
  );

  const orderSubtotal = Number(
    order?.subtotal ?? itemSubtotal,
  );

  const discountAmount = Number(
    order?.discount_amount || 0,
  );

  const taxAmount = Number(
    order?.tax_amount || 0,
  );

  const shippingAmount = Number(
    order?.shipping_amount || 0,
  );

  const totalAmount = Number(
    order?.total_amount || 0,
  );

  /*
   * ---------------------------------------------------------
   * Loading
   * ---------------------------------------------------------
   */
  if (loading) {
    return (
      <>
        <div className="loading-page">
          <div className="loading-card">
            <div className="spinner" />

            <div>
              <strong>Loading order</strong>

              <span>
                Please wait while we load your order details.
              </span>
            </div>
          </div>
        </div>

        <style jsx>{`
          .loading-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5f7fb;
          }

          .loading-card {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 24px 28px;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
          }

          .loading-card strong {
            display: block;
            font-size: 15px;
            color: #111827;
          }

          .loading-card span {
            display: block;
            margin-top: 4px;
            font-size: 13px;
            color: #6b7280;
          }

          .spinner {
            width: 27px;
            height: 27px;
            border: 3px solid #e5e7eb;
            border-top-color: #111827;
            border-radius: 999px;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </>
    );
  }

  /*
   * ---------------------------------------------------------
   * Error
   * ---------------------------------------------------------
   */
  if (!order || errorMessage) {
    return (
      <>
        <div className="error-page">
          <div className="error-card">
            <div className="error-icon">
              <XCircle size={24} />
            </div>

            <h1>Unable to load order</h1>

            <p>
              {errorMessage ||
                "The order could not be found."}
            </p>

            <div className="error-actions">
              <button
                type="button"
                onClick={() => void loadOrder()}
                className="primary-button"
              >
                <RefreshCw size={16} />
                Try again
              </button>

              <Link
                href="/portal"
                className="secondary-button"
              >
                Back to Portal
              </Link>
            </div>
          </div>
        </div>

        <style jsx>{`
          .error-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 32px;
            background: #f5f7fb;
          }

          .error-card {
            width: min(520px, 100%);
            padding: 34px;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          }

          .error-icon {
            width: 52px;
            height: 52px;
            margin: 0 auto 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 14px;
            background: #fef2f2;
            color: #dc2626;
          }

          h1 {
            margin: 0;
            color: #111827;
            font-size: 22px;
          }

          p {
            margin: 10px 0 0;
            color: #6b7280;
            line-height: 1.6;
            font-size: 14px;
          }

          .error-actions {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: 24px;
            flex-wrap: wrap;
          }

          .primary-button,
          .secondary-button {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-height: 42px;
            padding: 0 16px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
          }

          .primary-button {
            border: 0;
            background: #111827;
            color: #fff;
          }

          .secondary-button {
            border: 1px solid #d1d5db;
            background: #fff;
            color: #374151;
          }
        `}</style>
      </>
    );
  }

  /*
   * ---------------------------------------------------------
   * Page
   * ---------------------------------------------------------
   */
  return (
    <>
      <main className="page">
        <div className="container">
          {/* Header */}
          <div className="topbar">
            <div>
              <Link
                href="/portal"
                className="back-link"
              >
                <ArrowLeft size={17} />
                Back to Portal
              </Link>

              <div className="breadcrumb">
                <span>Portal</span>
                <ChevronRight size={14} />
                <span>Orders</span>
                <ChevronRight size={14} />
                <span>
                  {order.order_number ||
                    order.id.slice(0, 8)}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="refresh-button"
              onClick={() => void loadOrder(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "refreshing"
                    : ""
                }
              />

              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>

          {/* Order heading */}
          <section className="hero-card">
            <div className="hero-main">
              <div className="order-icon">
                <Package size={25} />
              </div>

              <div>
                <div className="eyebrow">
                  Sales Order
                </div>

                <h1>
                  {order.order_number ||
                    `Order ${order.id.slice(0, 8)}`}
                </h1>

                <div className="meta-row">
                  <span>
                    <CalendarDays size={15} />
                    {formatDate(order.created_at)}
                  </span>

                  <span>
                    <Package size={15} />
                    {items.length}{" "}
                    {items.length === 1
                      ? "item"
                      : "items"}
                  </span>
                </div>
              </div>
            </div>

            <div className="hero-status">
              <StatusBadge value={order.status} />

              <strong>
                {formatMoney(
                  totalAmount,
                  currency,
                )}
              </strong>
            </div>
          </section>

          {/* Status cards */}
          <section className="status-grid">
            <div className="info-card">
              <div className="info-icon blue">
                <CreditCard size={19} />
              </div>

              <div>
                <span className="info-label">
                  Payment
                </span>

                <StatusBadge
                  value={order.payment_status}
                  fallback="Unpaid"
                />
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon purple">
                <Truck size={19} />
              </div>

              <div>
                <span className="info-label">
                  Fulfillment
                </span>

                <StatusBadge
                  value={
                    order.fulfillment_status
                  }
                  fallback="Unfulfilled"
                />
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon green">
                <CalendarDays size={19} />
              </div>

              <div>
                <span className="info-label">
                  Order Date
                </span>

                <strong className="info-value">
                  {formatDate(
                    order.created_at,
                  )}
                </strong>
              </div>
            </div>
          </section>

          <div className="content-grid">
            {/* Main column */}
            <div className="main-column">
              {/* Items */}
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Order Items</h2>

                    <p>
                      Products included in this
                      order.
                    </p>
                  </div>

                  <span className="item-count">
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="empty-state">
                    <Package size={25} />

                    <span>
                      No order items were found.
                    </span>
                  </div>
                ) : (
                  <div className="items-list">
                    {items.map((item) => (
                      <div
                        className="item-row"
                        key={item.id}
                      >
                        <div className="product-icon">
                          <Package size={20} />
                        </div>

                        <div className="item-details">
                          <strong>
                            {item.product_name ||
                              "Product"}
                          </strong>

                          {item.variant_name && (
                            <span>
                              {item.variant_name}
                            </span>
                          )}

                          {item.sku && (
                            <small>
                              SKU: {item.sku}
                            </small>
                          )}
                        </div>

                        <div className="item-quantity">
                          <span>Qty</span>

                          <strong>
                            {Number(
                              item.quantity || 0,
                            )}
                          </strong>
                        </div>

                        <div className="item-price">
                          <span>
                            {formatMoney(
                              item.unit_price,
                              currency,
                            )}{" "}
                            each
                          </span>

                          <strong>
                            {formatMoney(
                              item.line_total,
                              currency,
                            )}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Notes */}
              {order.notes && (
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Order Notes</h2>

                      <p>
                        Additional information
                        attached to this order.
                      </p>
                    </div>
                  </div>

                  <div className="notes-box">
                    <FileText size={18} />

                    <p>{order.notes}</p>
                  </div>
                </section>
              )}

              {/* Timeline */}
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Order Information</h2>

                    <p>
                      Important timestamps for
                      this order.
                    </p>
                  </div>
                </div>

                <div className="timeline">
                  <div className="timeline-item">
                    <div className="timeline-icon">
                      <CheckCircle2 size={17} />
                    </div>

                    <div>
                      <strong>
                        Order created
                      </strong>

                      <span>
                        {formatDateTime(
                          order.created_at,
                        )}
                      </span>
                    </div>
                  </div>

                  {order.updated_at &&
                    order.updated_at !==
                      order.created_at && (
                      <div className="timeline-item">
                        <div className="timeline-icon muted">
                          <Clock3 size={17} />
                        </div>

                        <div>
                          <strong>
                            Last updated
                          </strong>

                          <span>
                            {formatDateTime(
                              order.updated_at,
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                </div>
              </section>
            </div>

            {/* Sidebar */}
            <aside className="side-column">
              {/* Summary */}
              <section className="panel summary-panel">
                <div className="panel-header">
                  <div>
                    <h2>Order Summary</h2>

                    <p>
                      Financial breakdown.
                    </p>
                  </div>
                </div>

                <div className="summary-lines">
                  <div>
                    <span>Subtotal</span>

                    <strong>
                      {formatMoney(
                        orderSubtotal,
                        currency,
                      )}
                    </strong>
                  </div>

                  {discountAmount > 0 && (
                    <div>
                      <span>Discount</span>

                      <strong className="discount">
                        -
                        {formatMoney(
                          discountAmount,
                          currency,
                        )}
                      </strong>
                    </div>
                  )}

                  {taxAmount > 0 && (
                    <div>
                      <span>Tax</span>

                      <strong>
                        {formatMoney(
                          taxAmount,
                          currency,
                        )}
                      </strong>
                    </div>
                  )}

                  {shippingAmount > 0 && (
                    <div>
                      <span>Shipping</span>

                      <strong>
                        {formatMoney(
                          shippingAmount,
                          currency,
                        )}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="summary-total">
                  <span>Total</span>

                  <strong>
                    {formatMoney(
                      totalAmount,
                      currency,
                    )}
                  </strong>
                </div>
              </section>

              {/* Customer */}
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Customer</h2>

                    <p>
                      Customer associated with
                      this order.
                    </p>
                  </div>
                </div>

                <div className="customer-box">
                  <div className="customer-avatar">
                    {(
                      customer?.name ||
                      "C"
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="customer-details">
                    <strong>
                      {customer?.name ||
                        "Customer"}
                    </strong>

                    {customer?.email && (
                      <span>
                        {customer.email}
                      </span>
                    )}

                    {customer?.phone && (
                      <span>
                        {customer.phone}
                      </span>
                    )}
                  </div>
                </div>

                {customer && (
                  <div className="address-box">
                    <span className="address-label">
                      Address
                    </span>

                    <p>
                      {customer.address_line1 ||
                        null}

                      {customer.address_line2 && (
                        <>
                          <br />
                          {
                            customer.address_line2
                          }
                        </>
                      )}

                      {(customer.city ||
                        customer.state) && (
                        <>
                          <br />
                          {[
                            customer.city,
                            customer.state,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </>
                      )}

                      {customer.country && (
                        <>
                          <br />
                          {customer.country}
                        </>
                      )}
                    </p>
                  </div>
                )}
              </section>

              {/* Company */}
              {company?.name && (
                <section className="panel company-panel">
                  <div className="company-mark">
                    {company.name
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <span className="info-label">
                      Order from
                    </span>

                    <strong>
                      {company.name}
                    </strong>
                  </div>
                </section>
              )}

              <Link
                href="/portal"
                className="portal-button"
              >
                <ArrowLeft size={17} />
                Back to Customer Portal
              </Link>
            </aside>
          </div>
        </div>
      </main>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: #f5f7fb;
          color: #111827;
          padding: 28px 22px 60px;
        }

        .container {
          width: min(1240px, 100%);
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #374151;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
        }

        .back-link:hover {
          color: #111827;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          color: #9ca3af;
          font-size: 12px;
        }

        .refresh-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 40px;
          padding: 0 14px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          background: #fff;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .refresh-button:disabled {
          opacity: 0.65;
          cursor: default;
        }

        .refreshing {
          animation: spin 0.8s linear infinite;
        }

        .hero-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 25px;
          padding: 25px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          box-shadow: 0 8px 25px rgba(15, 23, 42, 0.04);
        }

        .hero-main {
          display: flex;
          align-items: center;
          gap: 15px;
          min-width: 0;
        }

        .order-icon {
          flex: 0 0 auto;
          width: 54px;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: #f3f4f6;
          color: #111827;
        }

        .eyebrow {
          margin-bottom: 4px;
          color: #6b7280;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        h1 {
          margin: 0;
          font-size: 25px;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }

        .meta-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
          margin-top: 9px;
          color: #6b7280;
          font-size: 13px;
        }

        .meta-row span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .hero-status {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        .hero-status strong {
          font-size: 22px;
          letter-spacing: -0.02em;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          width: fit-content;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .status-success {
          background: #ecfdf3;
          color: #15803d;
        }

        .status-warning {
          background: #fffbeb;
          color: #b45309;
        }

        .status-danger {
          background: #fef2f2;
          color: #dc2626;
        }

        .status-neutral {
          background: #f3f4f6;
          color: #4b5563;
        }

        .status-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 15px;
        }

        .info-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 17px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 15px;
        }

        .info-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
        }

        .info-icon.blue {
          background: #eff6ff;
          color: #2563eb;
        }

        .info-icon.purple {
          background: #f5f3ff;
          color: #7c3aed;
        }

        .info-icon.green {
          background: #ecfdf5;
          color: #059669;
        }

        .info-label {
          display: block;
          margin-bottom: 5px;
          color: #9ca3af;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .info-value {
          font-size: 14px;
          color: #111827;
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 350px;
          gap: 18px;
          margin-top: 18px;
          align-items: start;
        }

        .main-column,
        .side-column {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .panel {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 17px;
          overflow: hidden;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 19px 20px;
          border-bottom: 1px solid #f0f1f3;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 15px;
          color: #111827;
        }

        .panel-header p {
          margin: 4px 0 0;
          color: #9ca3af;
          font-size: 12px;
        }

        .item-count {
          min-width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #f3f4f6;
          color: #374151;
          font-size: 12px;
          font-weight: 700;
        }

        .items-list {
          padding: 0 20px;
        }

        .item-row {
          display: grid;
          grid-template-columns: 45px minmax(0, 1fr) 75px 130px;
          align-items: center;
          gap: 13px;
          min-height: 82px;
          border-bottom: 1px solid #f0f1f3;
        }

        .item-row:last-child {
          border-bottom: 0;
        }

        .product-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          color: #64748b;
        }

        .item-details {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .item-details strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 14px;
          color: #111827;
        }

        .item-details span {
          color: #6b7280;
          font-size: 12px;
        }

        .item-details small {
          color: #9ca3af;
          font-size: 11px;
        }

        .item-quantity {
          text-align: center;
        }

        .item-quantity span,
        .item-price span {
          display: block;
          color: #9ca3af;
          font-size: 11px;
        }

        .item-quantity strong {
          display: block;
          margin-top: 3px;
          font-size: 13px;
        }

        .item-price {
          text-align: right;
        }

        .item-price strong {
          display: block;
          margin-top: 3px;
          color: #111827;
          font-size: 14px;
        }

        .empty-state {
          min-height: 150px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #9ca3af;
          font-size: 13px;
        }

        .summary-lines {
          padding: 17px 20px 5px;
        }

        .summary-lines > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 7px 0;
          color: #6b7280;
          font-size: 13px;
        }

        .summary-lines strong {
          color: #374151;
          font-weight: 600;
        }

        .summary-lines .discount {
          color: #059669;
        }

        .summary-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-top: 8px;
          padding: 17px 20px;
          background: #f8fafc;
          border-top: 1px solid #e5e7eb;
        }

        .summary-total span {
          color: #374151;
          font-size: 14px;
          font-weight: 700;
        }

        .summary-total strong {
          color: #111827;
          font-size: 19px;
        }

        .notes-box {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 17px 20px;
          color: #6b7280;
          background: #fafafa;
        }

        .notes-box svg {
          flex: 0 0 auto;
          margin-top: 2px;
        }

        .notes-box p {
          margin: 0;
          font-size: 13px;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        .timeline {
          padding: 20px;
        }

        .timeline-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .timeline-item + .timeline-item {
          margin-top: 19px;
        }

        .timeline-icon {
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #ecfdf5;
          color: #059669;
        }

        .timeline-icon.muted {
          background: #f3f4f6;
          color: #6b7280;
        }

        .timeline-item strong {
          display: block;
          color: #111827;
          font-size: 13px;
        }

        .timeline-item span {
          display: block;
          margin-top: 4px;
          color: #9ca3af;
          font-size: 12px;
        }

        .customer-box {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px 20px;
        }

        .customer-avatar {
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #111827;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
        }

        .customer-details {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .customer-details strong {
          color: #111827;
          font-size: 14px;
        }

        .customer-details span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #6b7280;
          font-size: 12px;
        }

        .address-box {
          padding: 16px 20px;
          border-top: 1px solid #f0f1f3;
        }

        .address-label {
          display: block;
          margin-bottom: 6px;
          color: #9ca3af;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .address-box p {
          margin: 0;
          color: #4b5563;
          font-size: 12px;
          line-height: 1.7;
        }

        .company-panel {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px 20px;
        }

        .company-mark {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #f3f4f6;
          color: #111827;
          font-size: 14px;
          font-weight: 800;
        }

        .company-panel strong {
          display: block;
          color: #111827;
          font-size: 14px;
        }

        .portal-button {
          min-height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid #d1d5db;
          border-radius: 11px;
          background: #fff;
          color: #374151;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
        }

        .portal-button:hover {
          background: #f9fafb;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 950px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .side-column {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-items: start;
          }

          .portal-button {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 18px 12px 40px;
          }

          .topbar,
          .hero-card {
            flex-direction: column;
            align-items: stretch;
          }

          .hero-status {
            align-items: flex-start;
          }

          .status-grid {
            grid-template-columns: 1fr;
          }

          .side-column {
            display: flex;
          }

          .item-row {
            grid-template-columns: 40px minmax(0, 1fr);
            padding: 14px 0;
          }

          .item-quantity,
          .item-price {
            grid-column: 2;
            text-align: left;
          }

          .item-price {
            margin-top: -5px;
          }

          .item-quantity {
            display: none;
          }

          .refresh-button {
            width: fit-content;
          }
        }
      `}</style>
    </>
  );
}