"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
};

type Order = {
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
  customers?: Customer[] | null;
};

type OrderItem = {
  id: string;
  company_id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  created_at: string;
};

type Fulfillment = {
  id: string;
  company_id: string;
  order_id: string;
  order_item_id: string;
  warehouse_id: string;
  location_id: string | null;
  quantity: number;
  inventory_movement_id: string | null;
  created_by: string | null;
  created_at: string;
  batch_id: string | null;
  batch_quantity: number | null;
  unit_cost: number | null;
  serialized_unit_id: string | null;
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

type Batch = {
  id: string;
  lot_number: string | null;
  received_at: string | null;
  status: string | null;
};

type SerializedUnit = {
  id: string;
  serial_number: string;
  status: string;
};

type RegionalSettings = {
  base_currency: string;
  currency_symbol: string;
  currency_symbol_position: string;
  decimal_places: number;
  thousands_separator: string;
  decimal_separator: string;
};

function formatMoney(
  value: number,
  currency: string,
  settings?: RegionalSettings | null,
) {
  const amount = Number(value || 0);

  try {
    if (
      settings &&
      currency === settings.base_currency
    ) {
      const decimalPlaces = Number(
        settings.decimal_places ?? 2,
      );

      const fixed = amount.toFixed(decimalPlaces);

      const [integerPart, decimalPart] =
        fixed.split(".");

      const formattedInteger = integerPart.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        settings.thousands_separator || ",",
      );

      const numberPart =
        decimalPlaces > 0
          ? `${formattedInteger}${
              settings.decimal_separator || "."
            }${decimalPart}`
          : formattedInteger;

      return settings.currency_symbol_position ===
        "after"
        ? `${numberPart} ${settings.currency_symbol}`
        : `${settings.currency_symbol}${numberPart}`;
    }

    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getCustomerName(
  customers?: Customer[] | null,
) {
  const customer = customers?.[0];

  if (!customer) {
    return "Walk-in customer";
  }

  return (
    customer.name ||
    customer.email ||
    "Unnamed customer"
  );
}

function getStatusClasses(status: string) {
  switch (status) {
    case "confirmed":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

    case "refunded":
      return "border-purple-200 bg-purple-50 text-purple-700";

    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getPaymentClasses(status: string) {
  switch (status) {
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "refunded":
      return "border-purple-200 bg-purple-50 text-purple-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getFulfillmentClasses(status: string) {
  switch (status) {
    case "fulfilled":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "partially_fulfilled":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function humanize(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
}

export default function SalesOrderDetailPage() {
  const params = useParams();
  const router = useRouter();

  const orderId = String(params.orderId);

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [companyId, setCompanyId] = useState<
    string | null
  >(null);

  const [order, setOrder] = useState<Order | null>(
    null,
  );

  const [items, setItems] = useState<OrderItem[]>([]);
  const [fulfillments, setFulfillments] = useState<
    Fulfillment[]
  >([]);

  const [warehouses, setWarehouses] = useState<
    Warehouse[]
  >([]);

  const [locations, setLocations] = useState<
    WarehouseLocation[]
  >([]);

  const [batches, setBatches] = useState<Batch[]>([]);

  const [serializedUnits, setSerializedUnits] =
    useState<SerializedUnit[]>([]);

  const [regionalSettings, setRegionalSettings] =
    useState<RegionalSettings | null>(null);

  const loadOrder = useCallback(
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
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error(
            "You must be signed in to view this sales order.",
          );
        }

        const { data: membershipData, error: membershipError } =
          await supabase
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
            "No company membership was found.",
          );
        }

        const currentCompanyId =
          membershipData.company_id;

        setCompanyId(currentCompanyId);

        const [
          orderResult,
          itemsResult,
          fulfillmentResult,
          warehouseResult,
          locationResult,
          batchResult,
          serialResult,
          regionalResult,
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
            .eq("id", orderId)
            .eq("company_id", currentCompanyId)
            .maybeSingle(),

          supabase
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
                line_total,
                created_at
              `,
            )
            .eq("order_id", orderId)
            .eq("company_id", currentCompanyId)
            .order("created_at", {
              ascending: true,
            }),

          supabase
            .from("order_item_fulfillments")
            .select(
              `
                id,
                company_id,
                order_id,
                order_item_id,
                warehouse_id,
                location_id,
                quantity,
                inventory_movement_id,
                created_by,
                created_at,
                batch_id,
                batch_quantity,
                unit_cost,
                serialized_unit_id
              `,
            )
            .eq("order_id", orderId)
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

          supabase
            .from("warehouse_locations")
            .select(
              "id, warehouse_id, name, code",
            )
            .eq("company_id", currentCompanyId)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("inventory_batches")
            .select(
              `
                id,
                lot_number,
                received_at,
                status
              `,
            )
            .eq("company_id", currentCompanyId),

          supabase
            .from("serialized_units")
            .select(
              `
                id,
                serial_number,
                status
              `,
            )
            .eq("company_id", currentCompanyId),

          supabase
            .from("company_regional_settings")
            .select(
              `
                base_currency,
                currency_symbol,
                currency_symbol_position,
                decimal_places,
                thousands_separator,
                decimal_separator
              `,
            )
            .eq("company_id", currentCompanyId)
            .maybeSingle(),
        ]);

        if (orderResult.error) {
          throw orderResult.error;
        }

        if (!orderResult.data) {
          throw new Error(
            "Sales order not found.",
          );
        }

        if (itemsResult.error) {
          throw itemsResult.error;
        }

        if (fulfillmentResult.error) {
          throw fulfillmentResult.error;
        }

        if (warehouseResult.error) {
          throw warehouseResult.error;
        }

        if (locationResult.error) {
          throw locationResult.error;
        }

        if (batchResult.error) {
          throw batchResult.error;
        }

        if (serialResult.error) {
          throw serialResult.error;
        }

        if (regionalResult.error) {
          throw regionalResult.error;
        }

        setOrder(
          orderResult.data as Order,
        );

        setItems(
          (itemsResult.data ||
            []) as OrderItem[],
        );

        setFulfillments(
          (fulfillmentResult.data ||
            []) as Fulfillment[],
        );

        setWarehouses(
          (warehouseResult.data ||
            []) as Warehouse[],
        );

        setLocations(
          (locationResult.data ||
            []) as WarehouseLocation[],
        );

        setBatches(
          (batchResult.data ||
            []) as Batch[],
        );

        setSerializedUnits(
          (serialResult.data ||
            []) as SerializedUnit[],
        );

        setRegionalSettings(
          regionalResult.data
            ? (regionalResult.data as RegionalSettings)
            : null,
        );
      } catch (error: any) {
        console.error(
          "Sales order detail error:",
          error,
        );

        setErrorMessage(
          error?.message ||
            "Unable to load the sales order.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId, supabase],
  );

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const fulfillmentByItem = useMemo(() => {
    const map = new Map<
      string,
      Fulfillment[]
    >();

    for (const fulfillment of fulfillments) {
      const current =
        map.get(
          fulfillment.order_item_id,
        ) || [];

      current.push(fulfillment);

      map.set(
        fulfillment.order_item_id,
        current,
      );
    }

    return map;
  }, [fulfillments]);

  const totalOrderedQuantity = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0),
        0,
      ),
    [items],
  );

  const totalFulfilledQuantity = useMemo(
    () =>
      fulfillments.reduce(
        (sum, fulfillment) =>
          sum +
          Number(
            fulfillment.quantity || 0,
          ),
        0,
      ),
    [fulfillments],
  );

  const totalRemainingQuantity = Math.max(
    0,
    totalOrderedQuantity -
      totalFulfilledQuantity,
  );

  const totalCost = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          Number(item.quantity || 0) *
            Number(item.unit_cost || 0),
        0,
      ),
    [items],
  );

  const grossProfit =
    Number(order?.total_amount || 0) -
    totalCost;

  const getWarehouseName = (
    warehouseId: string,
  ) => {
    const warehouse = warehouses.find(
      (item) =>
        item.id === warehouseId,
    );

    if (!warehouse) {
      return "Unknown warehouse";
    }

    return warehouse.code
      ? `${warehouse.name} (${warehouse.code})`
      : warehouse.name;
  };

  const getLocationName = (
    locationId: string | null,
  ) => {
    if (!locationId) {
      return "Default location";
    }

    const location = locations.find(
      (item) =>
        item.id === locationId,
    );

    if (!location) {
      return "Unknown location";
    }

    return location.code
      ? `${location.name} (${location.code})`
      : location.name;
  };

  const getBatch = (
    batchId: string | null,
  ) => {
    if (!batchId) {
      return null;
    }

    return (
      batches.find(
        (batch) =>
          batch.id === batchId,
      ) || null
    );
  };

  const getSerial = (
    serialId: string | null,
  ) => {
    if (!serialId) {
      return null;
    }

    return (
      serializedUnits.find(
        (serial) =>
          serial.id === serialId,
      ) || null
    );
  };

  const cancelOrder = async () => {
    if (!companyId || !order) {
      return;
    }

    const confirmed =
      window.confirm(
        `Cancel sales order ${order.order_number}? Any existing fulfillment will be reversed according to the inventory reversal rules.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setCancelling(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } =
        await supabase.rpc(
          "cancel_sales_order",
          {
            p_company_id:
              companyId,
            p_order_id:
              order.id,
          },
        );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        `Sales order ${order.order_number} has been cancelled.`,
      );

      await loadOrder(true);
    } catch (error: any) {
      console.error(
        "Cancel sales order error:",
        error,
      );

      setErrorMessage(
        error?.message ||
          "Unable to cancel the sales order.",
      );
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-8">
            <div className="animate-pulse">
              <div className="h-4 w-48 rounded bg-slate-200" />

              <div className="mt-5 h-9 w-72 rounded bg-slate-200" />

              <div className="mt-2 h-4 w-96 rounded bg-slate-200" />

              <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="h-[700px] rounded-2xl bg-white" />

                <div className="h-[500px] rounded-2xl bg-white" />
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-8">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
              <h1 className="text-lg font-semibold text-red-900">
                Unable to load sales order
              </h1>

              <p className="mt-2 text-sm text-red-700">
                {errorMessage ||
                  "The requested sales order could not be found."}
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push("/sales")
                }
                className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Back to Sales
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const isCancelled =
    order.status === "cancelled" ||
    order.status === "refunded";

  const canFulfill =
    !isCancelled &&
    order.fulfillment_status !==
      "fulfilled" &&
    totalRemainingQuantity > 0;

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1600px] px-6 py-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Link
                  href="/dashboard"
                  className="transition hover:text-slate-900"
                >
                  Dashboard
                </Link>

                <span>/</span>

                <Link
                  href="/sales"
                  className="transition hover:text-slate-900"
                >
                  Sales
                </Link>

                <span>/</span>

                <span className="text-slate-900">
                  {order.order_number}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                  {order.order_number}
                </h1>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                      order.status,
                    )}`}
                  >
                    {humanize(
                      order.status,
                    )}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getPaymentClasses(
                      order.payment_status,
                    )}`}
                  >
                    Payment:{" "}
                    {humanize(
                      order.payment_status,
                    )}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getFulfillmentClasses(
                      order.fulfillment_status,
                    )}`}
                  >
                    {humanize(
                      order.fulfillment_status,
                    )}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-sm text-slate-500">
                Created{" "}
                {formatDate(
                  order.created_at,
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  router.push("/sales")
                }
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Back to Sales
              </button>

              <button
                type="button"
                onClick={() =>
                  loadOrder(true)
                }
                disabled={refreshing}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  className={`h-4 w-4 ${
                    refreshing
                      ? "animate-spin"
                      : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 11a8.1 8.1 0 0 0-14.9-4M4 5v4h4M4 13a8.1 8.1 0 0 0 14.9 4M20 19v-4h-4"
                  />
                </svg>

                Refresh
              </button>

              {canFulfill && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/sales/${order.id}/fulfill`,
                    )
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"
                    />

                    <circle
                      cx="7"
                      cy="19"
                      r="1.5"
                    />

                    <circle
                      cx="18"
                      cy="19"
                      r="1.5"
                    />
                  </svg>

                  Fulfill Order
                </button>
              )}

              {!isCancelled && (
                <button
                  type="button"
                  onClick={cancelOrder}
                  disabled={cancelling}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cancelling
                    ? "Cancelling..."
                    : "Cancel Order"}
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                  />

                  <path
                    strokeLinecap="round"
                    d="M12 8v4M12 16h.01"
                  />
                </svg>

                <div>
                  <p className="text-sm font-semibold text-red-800">
                    Something went wrong
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <p className="text-sm font-medium text-emerald-700">
                {successMessage}
              </p>
            </div>
          )}

          {/* KPI Cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Order Total
                </p>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 3h12v18H6z"
                    />

                    <path
                      strokeLinecap="round"
                      d="M9 7h6M9 11h6M9 15h3"
                    />
                  </svg>
                </div>
              </div>

              <p className="mt-4 whitespace-nowrap text-2xl font-semibold tracking-tight text-slate-950">
                {formatMoney(
                  order.total_amount,
                  order.currency,
                  regionalSettings,
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Items
                </p>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </div>
              </div>

              <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
                {totalOrderedQuantity}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {items.length} line{" "}
                {items.length === 1
                  ? "item"
                  : "items"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Fulfilled
                </p>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m5 12 4 4L19 6"
                    />
                  </svg>
                </div>
              </div>

              <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
                {totalFulfilledQuantity}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {totalRemainingQuantity}{" "}
                remaining
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Gross Profit
                </p>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3v18M17 7h-6.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H7"
                    />
                  </svg>
                </div>
              </div>

              <p
                className={`mt-4 whitespace-nowrap text-2xl font-semibold tracking-tight ${
                  grossProfit >= 0
                    ? "text-emerald-700"
                    : "text-red-600"
                }`}
              >
                {formatMoney(
                  grossProfit,
                  order.currency,
                  regionalSettings,
                )}
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="space-y-6">
              {/* Order Items */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-slate-950">
                        Order Items
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Products and quantities
                        included in this sales
                        order.
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {items.length}{" "}
                      {items.length === 1
                        ? "item"
                        : "items"}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[1000px] w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <th className="min-w-[330px] px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Product
                        </th>

                        <th className="w-[110px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Qty
                        </th>

                        <th className="w-[150px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Unit Price
                        </th>

                        <th className="w-[150px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Discount
                        </th>

                        <th className="w-[170px] px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Line Total
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {items.map((item) => {
                        const itemFulfillments =
                          fulfillmentByItem.get(
                            item.id,
                          ) || [];

                        const fulfilledQty =
                          itemFulfillments.reduce(
                            (sum, fulfillment) =>
                              sum +
                              Number(
                                fulfillment.quantity ||
                                  0,
                              ),
                            0,
                          );

                        const remainingQty =
                          Math.max(
                            0,
                            Number(
                              item.quantity ||
                                0,
                            ) -
                              fulfilledQty,
                          );

                        return (
                          <tr
                            key={item.id}
                            className="transition hover:bg-slate-50/50"
                          >
                            <td className="min-w-[330px] px-6 py-5 align-middle">
                              <div className="min-w-0">
                                <p className="whitespace-nowrap text-sm font-semibold text-slate-900">
                                  {
                                    item.product_name
                                  }
                                </p>

                                <div className="mt-1 flex flex-nowrap items-center gap-2 overflow-hidden">
                                  {item.variant_name && (
                                    <span className="whitespace-nowrap text-xs text-slate-500">
                                      {
                                        item.variant_name
                                      }
                                    </span>
                                  )}

                                  {item.sku && (
                                    <>
                                      <span className="shrink-0 text-slate-300">
                                        ·
                                      </span>

                                      <span className="whitespace-nowrap text-xs text-slate-400">
                                        SKU{" "}
                                        {
                                          item.sku
                                        }
                                      </span>
                                    </>
                                  )}
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {fulfilledQty >
                                    0 && (
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                      Fulfilled{" "}
                                      {
                                        fulfilledQty
                                      }
                                    </span>
                                  )}

                                  {remainingQty >
                                    0 && (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                      Remaining{" "}
                                      {
                                        remainingQty
                                      }
                                    </span>
                                  )}

                                  {remainingQty ===
                                    0 &&
                                    fulfilledQty >
                                      0 && (
                                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                        Complete
                                      </span>
                                    )}
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-5 text-right align-middle">
                              <span className="text-sm font-semibold text-slate-800">
                                {
                                  item.quantity
                                }
                              </span>
                            </td>

                            <td className="px-4 py-5 text-right align-middle">
                              <span className="whitespace-nowrap text-sm text-slate-700">
                                {formatMoney(
                                  item.unit_price,
                                  order.currency,
                                  regionalSettings,
                                )}
                              </span>
                            </td>

                            <td className="px-4 py-5 text-right align-middle">
                              <span className="whitespace-nowrap text-sm text-slate-600">
                                {formatMoney(
                                  item.discount_amount,
                                  order.currency,
                                  regionalSettings,
                                )}
                              </span>
                            </td>

                            <td className="px-5 py-5 text-right align-middle">
                              <span className="whitespace-nowrap text-sm font-semibold text-slate-900">
                                {formatMoney(
                                  item.line_total,
                                  order.currency,
                                  regionalSettings,
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Fulfillment History */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-slate-950">
                        Fulfillment History
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Inventory allocations
                        recorded against this
                        order.
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {fulfillments.length}{" "}
                      {fulfillments.length ===
                      1
                        ? "record"
                        : "records"}
                    </span>
                  </div>
                </div>

                {fulfillments.length ===
                0 ? (
                  <div className="px-6 py-14 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <svg
                        className="h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"
                        />

                        <circle
                          cx="7"
                          cy="19"
                          r="1.5"
                        />

                        <circle
                          cx="18"
                          cy="19"
                          r="1.5"
                        />
                      </svg>
                    </div>

                    <h3 className="mt-4 text-sm font-semibold text-slate-900">
                      No fulfillment recorded
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Batch, warehouse, and
                      optional serial allocation
                      will appear here after
                      fulfillment.
                    </p>

                    {canFulfill && (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/sales/${order.id}/fulfill`,
                          )
                        }
                        className="mt-5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      >
                        Start Fulfillment
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {fulfillments.map(
                      (fulfillment) => {
                        const item =
                          items.find(
                            (item) =>
                              item.id ===
                              fulfillment.order_item_id,
                          );

                        const batch =
                          getBatch(
                            fulfillment.batch_id,
                          );

                        const serial =
                          getSerial(
                            fulfillment.serialized_unit_id,
                          );

                        return (
                          <div
                            key={
                              fulfillment.id
                            }
                            className="px-6 py-5"
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <p className="whitespace-nowrap text-sm font-semibold text-slate-900">
                                  {item?.product_name ||
                                    "Order item"}
                                </p>

                                {item?.variant_name && (
                                  <p className="mt-1 whitespace-nowrap text-xs text-slate-500">
                                    {
                                      item.variant_name
                                    }

                                    {item.sku
                                      ? ` · SKU ${item.sku}`
                                      : ""}
                                  </p>
                                )}
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  Qty{" "}
                                  {
                                    fulfillment.quantity
                                  }
                                </span>

                                {fulfillment.serialized_unit_id && (
                                  <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                                    Serialized
                                  </span>
                                )}

                                {fulfillment.batch_id && (
                                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                    Batch
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                  Warehouse
                                </p>

                                <p className="mt-1 text-sm font-medium text-slate-800">
                                  {getWarehouseName(
                                    fulfillment.warehouse_id,
                                  )}
                                </p>
                              </div>

                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                  Location
                                </p>

                                <p className="mt-1 text-sm font-medium text-slate-800">
                                  {getLocationName(
                                    fulfillment.location_id,
                                  )}
                                </p>
                              </div>

                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                  Batch / Lot
                                </p>

                                <p className="mt-1 text-sm font-medium text-slate-800">
                                  {batch?.lot_number ||
                                    (fulfillment.batch_id
                                      ? "Batch recorded"
                                      : "Not applicable")}
                                </p>
                              </div>

                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                  Serial Number
                                </p>

                                <p className="mt-1 text-sm font-medium text-slate-800">
                                  {serial?.serial_number ||
                                    "Not serialized"}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
                              <span>
                                Fulfilled{" "}
                                {formatDate(
                                  fulfillment.created_at,
                                )}
                              </span>

                              {fulfillment.unit_cost !==
                                null && (
                                <span>
                                  Unit cost{" "}
                                  {formatMoney(
                                    fulfillment.unit_cost,
                                    order.currency,
                                    regionalSettings,
                                  )}
                                </span>
                              )}

                              {fulfillment.inventory_movement_id && (
                                <span>
                                  Inventory
                                  movement
                                  recorded
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
              {/* Customer */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-base font-semibold text-slate-950">
                    Customer
                  </h2>
                </div>

                <div className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <circle
                          cx="12"
                          cy="8"
                          r="3"
                        />

                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 20a7 7 0 0 1 14 0"
                        />
                      </svg>
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {getCustomerName(
                          order.customers,
                        )}
                      </p>

                      {order.customers?.[0]?.email && (
  <p className="mt-1 break-all text-xs text-slate-500">
    {order.customers[0].email}
  </p>
)}
                    </div>
                  </div>
                </div>
              </section>

              {/* Financial Summary */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-base font-semibold text-slate-950">
                    Financial Summary
                  </h2>
                </div>

                <div className="space-y-4 px-6 py-5">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-slate-500">
                      Subtotal
                    </span>

                    <span className="whitespace-nowrap font-medium text-slate-800">
                      {formatMoney(
                        order.subtotal,
                        order.currency,
                        regionalSettings,
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-slate-500">
                      Discount
                    </span>

                    <span className="whitespace-nowrap font-medium text-red-600">
                      -
                      {formatMoney(
                        order.discount_amount,
                        order.currency,
                        regionalSettings,
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-slate-500">
                      Tax
                    </span>

                    <span className="whitespace-nowrap font-medium text-slate-800">
                      {formatMoney(
                        order.tax_amount,
                        order.currency,
                        regionalSettings,
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-slate-500">
                      Shipping
                    </span>

                    <span className="whitespace-nowrap font-medium text-slate-800">
                      {formatMoney(
                        order.shipping_amount,
                        order.currency,
                        regionalSettings,
                      )}
                    </span>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-end justify-between gap-4">
                      <span className="text-sm font-semibold text-slate-700">
                        Total
                      </span>

                      <span className="whitespace-nowrap text-2xl font-semibold tracking-tight text-slate-950">
                        {formatMoney(
                          order.total_amount,
                          order.currency,
                          regionalSettings,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Fulfillment Progress */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-base font-semibold text-slate-950">
                    Fulfillment Progress
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Quantity-level fulfillment
                    status.
                  </p>
                </div>

                <div className="px-6 py-5">
                  <div className="flex items-end justify-between">
                    <span className="text-sm text-slate-500">
                      Fulfilled
                    </span>

                    <span className="text-sm font-semibold text-slate-900">
                      {
                        totalFulfilledQuantity
                      }{" "}
                      /{" "}
                      {
                        totalOrderedQuantity
                      }
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{
                        width: `${
                          totalOrderedQuantity >
                          0
                            ? Math.min(
                                100,
                                (totalFulfilledQuantity /
                                  totalOrderedQuantity) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Fulfilled
                      </p>

                      <p className="mt-1 text-lg font-semibold text-emerald-700">
                        {
                          totalFulfilledQuantity
                        }
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Remaining
                      </p>

                      <p className="mt-1 text-lg font-semibold text-amber-700">
                        {
                          totalRemainingQuantity
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Notes */}
              {order.notes && (
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h2 className="text-base font-semibold text-slate-950">
                      Order Notes
                    </h2>
                  </div>

                  <div className="px-6 py-5">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {order.notes}
                    </p>
                  </div>
                </section>
              )}

              {/* V2 Allocation Model */}
              <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <rect
                        x="4"
                        y="4"
                        width="16"
                        height="16"
                        rx="2"
                      />

                      <path
                        strokeLinecap="round"
                        d="M8 9h8M8 13h5M8 17h3"
                      />
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-blue-900">
                      V2 Inventory Allocation
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-blue-800/80">
                      Fulfillment is handled
                      separately so each order
                      item can be allocated across
                      multiple batches or lots, with
                      optional serialized units.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-xs text-blue-900/80">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />

                    Warehouse + Location
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />

                    Batch / Lot allocation
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />

                    Optional serial selection
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />

                    Inventory movement ledger
                  </div>
                </div>
              </section>

              {/* Primary Action */}
              {canFulfill && (
                <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/sales/${order.id}/fulfill`,
                      )
                    }
                    className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Fulfill Order
                  </button>

                  <p className="mt-2 text-center text-xs text-slate-400">
                    {totalRemainingQuantity}{" "}
                    unit
                    {totalRemainingQuantity ===
                    1
                      ? ""
                      : "s"}{" "}
                    remaining to fulfill
                  </p>
                </div>
              )}

              {order.fulfillment_status ===
                "fulfilled" && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m5 12 4 4L19 6"
                        />
                      </svg>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-emerald-900">
                        Order fully fulfilled
                      </p>

                      <p className="mt-1 text-xs text-emerald-700">
                        All ordered quantities
                        have been allocated to
                        inventory fulfillment.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}