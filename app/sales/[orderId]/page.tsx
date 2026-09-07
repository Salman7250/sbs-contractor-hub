"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string | null;
  email?: string | null;
  phone?: string | null;
};

type Company = {
  id: string;
  name: string;
  currency?: string | null;
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
  customers: Customer | null;
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
  updated_at: string;
};

type ProductTracking = {
  id: string;
  tracking_mode: string | null;
};

type SerializedUnit = {
  id: string;
  serial_number: string;
  barcode: string | null;
  status: string;
  product_id: string;
  variant_id: string | null;
  warehouse_id: string | null;
  location_id: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  due_date: string | null;
  order_id: string | null;
  created_at?: string;
};

type InvoicePayment = {
  id: string;
  company_id: string;
  invoice_id: string;
  customer_id: string | null;
  amount: number;
  currency: string;
  payment_method: string | null;
  reference: string | null;
  paid_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
  is_default: boolean;
};

type WarehouseLocation = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string;
};

function formatCurrency(
  amount: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function getStatusClass(status: string) {
  switch (status) {
    case "completed":
    case "paid":
    case "fulfilled":
      return "success";

    case "processing":
    case "shipped":
    case "partially_paid":
    case "partially_fulfilled":
    case "confirmed":
    case "sent":
      return "warning";

    case "cancelled":
    case "refunded":
    case "partially_refunded":
    case "void":
      return "danger";

    default:
      return "neutral";
  }
}

export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const orderId = String(
    params.orderId || ""
  );

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [order, setOrder] =
    useState<Order | null>(null);

  const [items, setItems] =
    useState<OrderItem[]>([]);

  const [company, setCompany] =
    useState<Company | null>(null);

  const [invoice, setInvoice] =
    useState<Invoice | null>(null);

  const [payments, setPayments] =
    useState<InvoicePayment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [printing, setPrinting] =
    useState(false);

  const [isCancelling, setIsCancelling] =
    useState(false);

  const [cancellationError, setCancellationError] =
    useState<string | null>(null);

  const [cancellationSuccess, setCancellationSuccess] =
    useState<string | null>(null);

  const [invoiceLoading, setInvoiceLoading] =
    useState(false);

  const [paymentsLoading, setPaymentsLoading] =
    useState(false);

  const [warehouses, setWarehouses] =
    useState<Warehouse[]>([]);

  const [locations, setLocations] =
    useState<WarehouseLocation[]>([]);

  const [selectedWarehouseId, setSelectedWarehouseId] =
    useState("");

  const [selectedLocationId, setSelectedLocationId] =
    useState("");

  const [fulfillmentOptionsLoading, setFulfillmentOptionsLoading] =
    useState(false);

  const [isFulfilling, setIsFulfilling] =
    useState(false);

  const [fulfillmentError, setFulfillmentError] =
    useState<string | null>(null);

  const [fulfillmentSuccess, setFulfillmentSuccess] =
    useState<string | null>(null);

  const [productTrackingModes, setProductTrackingModes] =
    useState<Record<string, string>>({});

  const [availableSerials, setAvailableSerials] =
    useState<Record<string, SerializedUnit[]>>({});

  const [selectedSerials, setSelectedSerials] =
    useState<Record<string, string[]>>({});

  const [serialsLoading, setSerialsLoading] =
    useState(false);

  const loadFinancialConnections = useCallback(
    async (
      companyId: string,
      currentOrderId: string
    ) => {
      setInvoiceLoading(true);
      setPaymentsLoading(true);

      try {
        const {
          data: invoiceData,
          error: invoiceError,
        } = await supabase
          .from("invoices")
          .select(
            `
              id,
              invoice_number,
              status,
              subtotal,
              tax,
              total,
              amount_paid,
              due_date,
              order_id,
              created_at
            `
          )
          .eq("order_id", currentOrderId)
          .eq("company_id", companyId)
          .order("created_at", {
            ascending: false,
          })
          .limit(1);

        if (invoiceError) {
          console.error(
            "Invoice loading error:",
            invoiceError
          );

          setInvoice(null);
          setPayments([]);
          return;
        }

        const latestInvoice =
          invoiceData?.[0] || null;

        setInvoice(
          latestInvoice as Invoice | null
        );

        if (!latestInvoice) {
          setPayments([]);
          return;
        }

        const {
          data: paymentData,
          error: paymentError,
        } = await supabase
          .from("invoice_payments")
          .select(
            `
              id,
              company_id,
              invoice_id,
              customer_id,
              amount,
              currency,
              payment_method,
              reference,
              paid_at,
              notes,
              created_at,
              updated_at
            `
          )
          .eq(
            "invoice_id",
            latestInvoice.id
          )
          .eq("company_id", companyId)
          .order("paid_at", {
            ascending: false,
          });

        if (paymentError) {
          console.error(
            "Invoice payments loading error:",
            paymentError
          );

          setPayments([]);
          return;
        }

        setPayments(
          (paymentData || []) as InvoicePayment[]
        );
      } finally {
        setInvoiceLoading(false);
        setPaymentsLoading(false);
      }
    },
    [supabase]
  );

  const loadFulfillmentOptions = useCallback(
    async (companyId: string) => {
      setFulfillmentOptionsLoading(true);
      setFulfillmentError(null);

      try {
        const [
          warehousesResult,
          locationsResult,
        ] = await Promise.all([
          supabase
            .from("warehouses")
            .select(
              "id, name, code, is_default"
            )
            .eq(
              "company_id",
              companyId
            )
            .eq("is_active", true)
            .order("is_default", {
              ascending: false,
            })
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("warehouse_locations")
            .select(
              "id, warehouse_id, name, code"
            )
            .eq(
              "company_id",
              companyId
            )
            .eq("is_active", true)
            .order("name", {
              ascending: true,
            }),
        ]);

        if (warehousesResult.error) {
          throw warehousesResult.error;
        }

        if (locationsResult.error) {
          throw locationsResult.error;
        }

        const loadedWarehouses =
          (warehousesResult.data ||
            []) as Warehouse[];

        const loadedLocations =
          (locationsResult.data ||
            []) as WarehouseLocation[];

        const defaultWarehouse =
          loadedWarehouses.find(
            (warehouse) =>
              warehouse.is_default
          ) ||
          loadedWarehouses[0];

        const defaultLocation =
          defaultWarehouse
            ? loadedLocations.find(
                (location) =>
                  location.warehouse_id ===
                  defaultWarehouse.id
              )
            : null;

        setWarehouses(
          loadedWarehouses
        );

        setLocations(
          loadedLocations
        );

        setSelectedWarehouseId(
          defaultWarehouse?.id ||
            ""
        );

        setSelectedLocationId(
          defaultLocation?.id ||
            ""
        );
      } catch (caughtError) {
        console.error(
          "Fulfillment options loading error:",
          caughtError
        );

        setWarehouses([]);
        setLocations([]);
        setSelectedWarehouseId("");
        setSelectedLocationId("");

        setFulfillmentError(
          "Unable to load active warehouses and locations."
        );
      } finally {
        setFulfillmentOptionsLoading(
          false
        );
      }
    },
    [supabase]
  );

  const loadOrder = useCallback(
    async () => {
      if (!orderId) {
        setError("Invalid order.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !user) {
        setError(
          "Your session could not be verified."
        );
        setLoading(false);
        return;
      }

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from("company_members")
        .select("company_id")
        .eq(
          "user_id",
          user.id
        )
        .limit(1)
        .maybeSingle();

      if (
        membershipError ||
        !membership?.company_id
      ) {
        setError(
          "Your company workspace could not be found."
        );
        setLoading(false);
        return;
      }

      const companyId =
        membership.company_id;

      const {
        data: companyData,
        error: companyError,
      } = await supabase
        .from("companies")
        .select(
          "id, name, currency"
        )
        .eq("id", companyId)
        .maybeSingle();

      if (companyError) {
        console.error(
          "Company loading error:",
          companyError
        );
      }

      if (companyData) {
        setCompany(
          companyData as Company
        );
      }

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
            updated_at,
            customers (
              id,
              name,
              email,
              phone
            )
          `
        )
        .eq("id", orderId)
        .eq(
          "company_id",
          companyId
        )
        .maybeSingle();

      if (orderError) {
        console.error(
          "Order loading error:",
          orderError
        );

        setError(
          "We couldn't load this order."
        );

        setLoading(false);
        return;
      }

      if (!orderData) {
        setError(
          "This order could not be found."
        );

        setLoading(false);
        return;
      }

      const {
        data: itemsData,
        error: itemsError,
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
            line_total,
            created_at,
            updated_at
          `
        )
        .eq(
          "order_id",
          orderId
        )
        .eq(
          "company_id",
          companyId
        )
        .order("created_at", {
          ascending: true,
        });

      if (itemsError) {
        console.error(
          "Order items loading error:",
          itemsError
        );

        setError(
          "The order loaded, but its items could not be loaded."
        );

        setLoading(false);
        return;
      }

      const loadedItems =
        (itemsData ||
          []) as OrderItem[];

      setOrder(
        orderData as unknown as Order
      );

      setItems(loadedItems);

      const productIds =
        Array.from(
          new Set(
            loadedItems
              .map(
                (item) =>
                  item.product_id
              )
              .filter(
                (
                  productId
                ): productId is string =>
                  Boolean(productId)
              )
          )
        );

      if (productIds.length > 0) {
        const {
          data: trackingData,
          error: trackingError,
        } = await supabase
          .from("products")
          .select(
            "id, tracking_mode"
          )
          .eq(
            "company_id",
            companyId
          )
          .in(
            "id",
            productIds
          );

        if (trackingError) {
          console.error(
            "Product tracking mode loading error:",
            trackingError
          );
        }

        const trackingMap:
          Record<string, string> =
          {};

        for (
          const product of
            (trackingData ||
              []) as ProductTracking[]
        ) {
          trackingMap[
            product.id
          ] =
            product.tracking_mode ||
            "none";
        }

        setProductTrackingModes(
          trackingMap
        );
      } else {
        setProductTrackingModes({});
      }

      await Promise.all([
        loadFinancialConnections(
          companyId,
          orderId
        ),
        loadFulfillmentOptions(
          companyId
        ),
      ]);

      setLoading(false);
    },
    [
      orderId,
      supabase,
      loadFinancialConnections,
      loadFulfillmentOptions,
    ]
  );

  useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadOrder();
  }, 0);

  return () => {
    window.clearTimeout(timer);
  };
}, [loadOrder]);

  function printOrder() {
    setPrinting(true);

    window.setTimeout(() => {
      window.print();

      window.setTimeout(() => {
        setPrinting(false);
      }, 500);
    }, 100);
  }

  function createInvoice() {
    router.push(
      `/invoices/new?orderId=${encodeURIComponent(
        orderId
      )}`
    );
  }

  function viewInvoice() {
    if (!invoice?.id) {
      return;
    }

    router.push(
      `/invoices/${invoice.id}`
    );
  }

  function recordPayment() {
    if (!invoice?.id) {
      return;
    }

    router.push(
      `/payments?invoiceId=${encodeURIComponent(
        invoice.id
      )}`
    );
  }

  const availableLocations =
    useMemo(
      () =>
        locations.filter(
          (location) =>
            location.warehouse_id ===
            selectedWarehouseId
        ),
      [
        locations,
        selectedWarehouseId,
      ]
    );

  const serialItems =
    useMemo(
      () =>
        items.filter(
          (item) =>
            Boolean(
              item.product_id
            ) &&
            productTrackingModes[
              item.product_id ||
                ""
            ] === "serial"
        ),
      [
        items,
        productTrackingModes,
      ]
    );

  const hasSerialItems =
    serialItems.length > 0;

  const loadAvailableSerials =
    useCallback(
      async () => {
        if (
          !order ||
          !selectedWarehouseId ||
          !selectedLocationId ||
          serialItems.length === 0
        ) {
          setAvailableSerials(
            {}
          );
          setSelectedSerials({});
          return;
        }

        setSerialsLoading(true);

        try {
          const productIds =
            Array.from(
              new Set(
                serialItems
                  .map(
                    (item) =>
                      item.product_id
                  )
                  .filter(
                    (
                      id
                    ): id is string =>
                      Boolean(id)
                  )
              )
            );

          const {
            data,
            error: serialError,
          } =
            await supabase
              .from(
                "serialized_units"
              )
              .select(
                `
                  id,
                  serial_number,
                  barcode,
                  status,
                  product_id,
                  variant_id,
                  warehouse_id,
                  location_id
                `
              )
              .eq(
                "company_id",
                order.company_id
              )
              .eq(
                "status",
                "available"
              )
              .eq(
                "warehouse_id",
                selectedWarehouseId
              )
              .eq(
                "location_id",
                selectedLocationId
              )
              .in(
                "product_id",
                productIds
              )
              .order(
                "serial_number",
                {
                  ascending: true,
                }
              );

          if (serialError) {
            throw serialError;
          }

          const loadedSerials =
            (data ||
              []) as SerializedUnit[];

          const serialMap:
            Record<
              string,
              SerializedUnit[]
            > = {};

          for (
            const item of serialItems
          ) {
            serialMap[item.id] =
              loadedSerials.filter(
                (serial) =>
                  serial.product_id ===
                    item.product_id &&
                  serial.variant_id ===
                    item.variant_id
              );
          }

          setAvailableSerials(
            serialMap
          );

          setSelectedSerials(
            (current) => {
              const next:
                Record<
                  string,
                  string[]
                > = {};

              for (
                const item of serialItems
              ) {
                const validIds =
                  new Set(
                    (
                      serialMap[
                        item.id
                      ] || []
                    ).map(
                      (serial) =>
                        serial.id
                    )
                  );

                next[item.id] =
                  (
                    current[
                      item.id
                    ] || []
                  ).filter(
                    (id) =>
                      validIds.has(
                        id
                      )
                  );
              }

              return next;
            }
          );
        } catch (caughtError) {
          console.error(
            "Available serial loading error:",
            caughtError
          );

          setAvailableSerials({});
          setSelectedSerials({});

          setFulfillmentError(
            "Unable to load available serial numbers for the selected warehouse location."
          );
        } finally {
          setSerialsLoading(false);
        }
      },
      [
        order,
        selectedWarehouseId,
        selectedLocationId,
        serialItems,
        supabase,
      ]
    );

  useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadAvailableSerials();
  }, 0);

  return () => {
    window.clearTimeout(timer);
  };
}, [
  order,
  selectedWarehouseId,
  selectedLocationId,
  loadAvailableSerials,
]);


  /*
   * CANCEL ORDER
   *
   * IMPORTANT:
   * This function is intentionally outside fulfillOrder().
   *
   * The frontend does NOT directly change inventory.
   * The API route calls the atomic cancel_sales_order RPC.
   */
  async function cancelOrder() {
    if (!order) {
      return;
    }

    if (isCancelling) {
      return;
    }

    const confirmed = window.confirm(
      `Cancel order ${order.order_number}?\n\n` +
        `If this order has already been fulfilled, its inventory ` +
        `will be reversed automatically.\n\n` +
        `This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setIsCancelling(true);
    setCancellationError(null);
    setCancellationSuccess(null);

    setFulfillmentError(null);
    setFulfillmentSuccess(null);

    try {
      const response =
        await fetch(
          `/api/sales/orders/${encodeURIComponent(
            order.id
          )}/cancel`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              reason:
                "Sales order cancellation",
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to cancel this order."
        );
      }

      setCancellationSuccess(
        "Order cancelled successfully. Any fulfilled inventory was reversed."
      );

      await loadOrder();
      router.refresh();
    } catch (error) {
      console.error(
        "Cancel order error:",
        error
      );

      setCancellationError(
        error instanceof Error
          ? error.message
          : "Unable to cancel this order."
      );
    } finally {
      setIsCancelling(false);
    }
  }

  /*
   * QUANTITY FULFILLMENT
   */
  async function fulfillOrder() {
    if (!order) {
      return;
    }

    if (
      !selectedWarehouseId ||
      !selectedLocationId
    ) {
      setFulfillmentError(
        "Select an active warehouse and location before fulfilling this order."
      );
      return;
    }

    setIsFulfilling(true);
    setFulfillmentError(null);
    setFulfillmentSuccess(null);

    try {
      const response =
        await fetch(
          `/api/sales/orders/${encodeURIComponent(
            order.id
          )}/fulfill`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              warehouse_id:
                selectedWarehouseId,
              location_id:
                selectedLocationId,
            }),
          }
        );

      const result =
        (await response.json()) as {
          error?: string;
          fulfilled_inventory_lines?: number;
          fulfilled_non_inventory_lines?: number;
        };

      if (!response.ok) {
        throw new Error(
          result.error ||
            "The sales order could not be fulfilled."
        );
      }

      const inventoryLineLabel =
        result.fulfilled_inventory_lines ===
        1
          ? "inventory line"
          : "inventory lines";

      setFulfillmentSuccess(
        `Order fulfilled. ${
          result.fulfilled_inventory_lines ||
          0
        } ${inventoryLineLabel} were issued from inventory.`
      );

      await loadOrder();
      router.refresh();
    } catch (caughtError) {
      console.error(
        "Order fulfillment error:",
        caughtError
      );

      setFulfillmentError(
        caughtError instanceof Error
          ? caughtError.message
          : "The sales order could not be fulfilled."
      );
    } finally {
      setIsFulfilling(false);
    }
  }

  /*
   * SERIAL FULFILLMENT
   */
  async function fulfillSerialOrder() {
    if (!order) {
      return;
    }

    if (
      !selectedWarehouseId ||
      !selectedLocationId
    ) {
      setFulfillmentError(
        "Select an active warehouse and location before fulfilling this order."
      );
      return;
    }

    if (serialItems.length === 0) {
      return;
    }

    const allocations: {
      order_item_id: string;
      serialized_unit_ids: string[];
    }[] = [];

    for (
      const item of serialItems
    ) {
      const selected =
        selectedSerials[
          item.id
        ] || [];

      const requiredQuantity =
        Number(
          item.quantity || 0
        );

      if (
        !Number.isInteger(
          requiredQuantity
        ) ||
        requiredQuantity <= 0
      ) {
        setFulfillmentError(
          `${item.product_name} has an invalid serialized quantity.`
        );
        return;
      }

      if (
        selected.length !==
        requiredQuantity
      ) {
        setFulfillmentError(
          `${item.product_name} requires ${requiredQuantity} serial number${
            requiredQuantity === 1
              ? ""
              : "s"
          }, but ${selected.length} ${
            selected.length === 1
              ? "was"
              : "were"
          } selected.`
        );
        return;
      }

      allocations.push({
        order_item_id:
          item.id,
        serialized_unit_ids:
          selected,
      });
    }

    setIsFulfilling(true);
    setFulfillmentError(null);
    setFulfillmentSuccess(null);

    try {
      const response =
        await fetch(
          `/api/sales/orders/${encodeURIComponent(
            order.id
          )}/serial-fulfill`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              warehouse_id:
                selectedWarehouseId,
              location_id:
                selectedLocationId,
              allocations,
            }),
          }
        );

      const result =
        (await response.json()) as {
          error?: string;
          total_quantity_fulfilled?: number;
        };

      if (!response.ok) {
        throw new Error(
          result.error ||
            "The serialized sales order could not be fulfilled."
        );
      }

      const quantity =
        Number(
          result.total_quantity_fulfilled ||
            0
        );

      setFulfillmentSuccess(
        `Order fulfilled. ${quantity} serialized unit${
          quantity === 1
            ? ""
            : "s"
        } allocated successfully.`
      );

      setSelectedSerials({});

      await loadOrder();
      router.refresh();
    } catch (caughtError) {
      console.error(
        "Serial order fulfillment error:",
        caughtError
      );

      setFulfillmentError(
        caughtError instanceof Error
          ? caughtError.message
          : "The serialized sales order could not be fulfilled."
      );
    } finally {
      setIsFulfilling(false);
    }
  }

  function toggleSerial(
    itemId: string,
    serialId: string,
    requiredQuantity: number
  ) {
    setSelectedSerials(
      (current) => {
        const existing =
          current[itemId] || [];

        if (
          existing.includes(
            serialId
          )
        ) {
          return {
            ...current,
            [itemId]:
              existing.filter(
                (id) =>
                  id !==
                  serialId
              ),
          };
        }

        if (
          existing.length >=
          requiredQuantity
        ) {
          return current;
        }

        return {
          ...current,
          [itemId]: [
            ...existing,
            serialId,
          ],
        };
      }
    );

    setFulfillmentError(null);
    setFulfillmentSuccess(null);
  }

  if (loading) {
    return (
      <AppShell
        title="Order Details"
        description="View sale and order information."
      >
        <div className="order-state">
          <div className="order-spinner" />

          <strong>
            Loading order...
          </strong>

          <span>
            Getting order details, invoice and payment information.
          </span>
        </div>

        <style jsx>{`
          .order-state {
            min-height: 420px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .order-spinner {
            width: 30px;
            height: 30px;
            margin-bottom: 14px;
            border: 2px solid #e4e8ee;
            border-top-color: #697386;
            border-radius: 50%;
            animation: spin 0.75s linear infinite;
          }

          .order-state strong {
            color: #465163;
            font-size: 14px;
          }

          .order-state span {
            margin-top: 6px;
            color: #9aa2af;
            font-size: 11px;
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

  if (error || !order) {
    return (
      <AppShell
        title="Order Details"
        description="View sale and order information."
      >
        <div className="order-state">
          <div className="order-error-icon">
            !
          </div>

          <strong>
            {error ||
              "Order not found"}
          </strong>

          <span>
            The requested order could not be loaded.
          </span>

          <div className="error-actions">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/sales"
                )
              }
            >
              Back to Sales
            </button>

            <button
              type="button"
              onClick={() =>
                void loadOrder()
              }
            >
              Try Again
            </button>
          </div>
        </div>

        <style jsx>{`
          .order-state {
            min-height: 420px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .order-error-icon {
            width: 48px;
            height: 48px;
            display: grid;
            place-items: center;
            margin-bottom: 14px;
            border: 1px solid #ead6d6;
            border-radius: 50%;
            background: #fff8f8;
            color: #915858;
            font-size: 17px;
            font-weight: 800;
          }

          .order-state strong {
            color: #465163;
            font-size: 14px;
          }

          .order-state span {
            margin-top: 6px;
            color: #9aa2af;
            font-size: 10px;
          }

          .error-actions {
            display: flex;
            gap: 8px;
            margin-top: 17px;
          }

          .error-actions button {
            height: 37px;
            padding: 0 13px;
            border: 1px solid #dfe4eb;
            border-radius: 8px;
            background: #ffffff;
            color: #596476;
            cursor: pointer;
            font-family: inherit;
            font-size: 10px;
            font-weight: 700;
          }

          .error-actions button:hover {
            background: #f6f8fa;
            color: #263043;
          }
        `}</style>
      </AppShell>
    );
  }

  const currency =
    order.currency ||
    company?.currency ||
    "USD";

  const customerName =
    order.customers?.name ||
    "Walk-in Customer";

  const companyName =
    company?.name ||
    "Company";

  const totalQuantity =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.quantity || 0
        ),
      0
    );

  const hasDiscount =
    Number(
      order.discount_amount || 0
    ) > 0;

  const hasTax =
    Number(
      order.tax_amount || 0
    ) > 0;

  const hasShipping =
    Number(
      order.shipping_amount || 0
    ) > 0;

  const recordedPaymentsTotal =
    payments.reduce(
      (sum, payment) =>
        sum +
        Number(
          payment.amount || 0
        ),
      0
    );

  const paidAmount = invoice
    ? Math.max(
        Number(
          invoice.amount_paid ||
            0
        ),
        recordedPaymentsTotal
      )
    : 0;

  const invoiceTotal =
    Number(
      invoice?.total || 0
    );

  const balanceDue =
    Math.max(
      invoiceTotal -
        paidAmount,
      0
    );

  const invoicePaymentStatus =
    invoice
      ? paidAmount >=
          invoiceTotal &&
        invoiceTotal > 0
        ? "paid"
        : paidAmount > 0
          ? "partially_paid"
          : invoice.status ===
              "overdue"
            ? "overdue"
            : "unpaid"
      : "unpaid";

  const allSerialSelectionsComplete =
    serialItems.every(
      (item) =>
        (
          selectedSerials[
            item.id
          ] || []
        ).length ===
        Number(
          item.quantity || 0
        )
    );

  return (
    <AppShell
      title={
        order.order_number
      }
      description={`Created ${formatDateTime(
        order.created_at
      )}`}
      actions={
        <div className="order-header-actions">

          <button
            type="button"
            className="order-back-button"
            onClick={() =>
              router.push(
                "/sales"
              )
            }
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>

            Back
          </button>

          {!invoice && (
            <button
              type="button"
              className="order-invoice-button"
              onClick={
                createInvoice
              }
              disabled={
                invoiceLoading
              }
            >
              Create Invoice
            </button>
          )}

          {invoice && (
            <button
              type="button"
              className="order-invoice-button"
              onClick={
                viewInvoice
              }
            >
              View Invoice
            </button>
          )}

          <button
            type="button"
            className="order-print-button"
            onClick={
              printOrder
            }
          >
            {printing
              ? "Printing..."
              : "Print / PDF"}
          </button>

          {order.status !== "cancelled" &&
            order.status !== "refunded" && (
              <button
                type="button"
                className="order-cancel-button"
                onClick={() =>
                  void cancelOrder()
                }
                disabled={
                  isCancelling ||
                  isFulfilling
                }
              >
                {isCancelling
                  ? "Cancelling..."
                  : "Cancel Order"}
              </button>
          )}

        </div>
      }
    >
      <div className="order-page">

        <section className="invoice-document">

          <header className="invoice-header">

            <div className="invoice-company-block">
              <h1>
                {companyName}
              </h1>

              <span>
                Sales & Order Management
              </span>
            </div>

            <div className="invoice-title-block">

              <div className="invoice-title">
                SALES ORDER
              </div>

              <div className="invoice-number">
                {
                  order.order_number
                }
              </div>

            </div>

          </header>

          <div className="invoice-meta-row">

            <div className="invoice-meta-group">
              <span>
                Order Date
              </span>

              <strong>
                {formatDate(
                  order.created_at
                )}
              </strong>
            </div>

            <div className="invoice-meta-group">
              <span>
                Payment Status
              </span>

              <strong
                className={`invoice-status ${getStatusClass(
                  invoice
                    ? invoicePaymentStatus
                    : order.payment_status
                )}`}
              >
                {formatStatus(
                  invoice
                    ? invoicePaymentStatus
                    : order.payment_status
                )}
              </strong>
            </div>

            <div className="invoice-meta-group">
              <span>
                Order Status
              </span>

              <strong
                className={`invoice-status ${getStatusClass(
                  order.status
                )}`}
              >
                {formatStatus(
                  order.status
                )}
              </strong>
            </div>

            <div className="invoice-meta-group">
              <span>
                Fulfillment
              </span>

              <strong
                className={`invoice-status ${getStatusClass(
                  order.fulfillment_status
                )}`}
              >
                {formatStatus(
                  order.fulfillment_status
                )}
              </strong>
            </div>

          </div>

          <div className="invoice-parties">

            <div className="invoice-party">

              <div className="invoice-section-label">
                BILL TO
              </div>

              <strong className="invoice-party-name">
                {
                  customerName
                }
              </strong>

              {order.customers
                ?.email && (
                <span>
                  {
                    order
                      .customers
                      .email
                  }
                </span>
              )}

              {order.customers
                ?.phone && (
                <span>
                  {
                    order
                      .customers
                      .phone
                  }
                </span>
              )}

              {!order
                .customers
                ?.email &&
                !order
                  .customers
                  ?.phone && (
                  <span>
                    Walk-in customer
                  </span>
                )}

            </div>

            <div className="invoice-party invoice-party-right">

              <div className="invoice-section-label">
                FROM
              </div>

              <strong className="invoice-party-name">
                {
                  companyName
                }
              </strong>

              <span>
                Sales Order
              </span>

              <span>
                Order #
                {
                  order.order_number
                }
              </span>

            </div>

          </div>

          <div className="invoice-items-section">

            <div className="invoice-section-label">
              ITEMS
            </div>

            {items.length ===
            0 ? (
              <div className="invoice-empty">
                No items were found for this order.
              </div>
            ) : (
              <table className="invoice-items-table">

                <thead>
                  <tr>

                    <th className="item-description">
                      DESCRIPTION
                    </th>

                    <th>
                      SKU
                    </th>

                    <th className="item-qty">
                      QTY
                    </th>

                    <th className="item-price">
                      UNIT PRICE
                    </th>

                    <th className="item-total">
                      AMOUNT
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {items.map(
                    (
                      item
                    ) => (
                      <tr
                        key={
                          item.id
                        }
                      >

                        <td className="item-description">

                          <strong>
                            {
                              item.product_name
                            }
                          </strong>

                          {item.variant_name && (
                            <span>
                              {
                                item.variant_name
                              }
                            </span>
                          )}

                        </td>

                        <td className="item-sku">
                          {
                            item.sku ||
                            "—"
                          }
                        </td>

                        <td className="item-qty">
                          {
                            item.quantity
                          }
                        </td>

                        <td className="item-price">
                          {formatCurrency(
                            Number(
                              item.unit_price ||
                                0
                            ),
                            currency
                          )}
                        </td>

                        <td className="item-total">

                          <strong>
                            {formatCurrency(
                              Number(
                                item.line_total ||
                                  0
                              ),
                              currency
                            )}
                          </strong>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>
            )}

          </div>

          <div className="invoice-bottom">

            <div className="invoice-notes-block">

              {order.notes ? (
                <>
                  <div className="invoice-section-label">
                    NOTES
                  </div>

                  <p>
                    {
                      order.notes
                    }
                  </p>
                </>
              ) : (
                <div className="invoice-thank-you">
                  Thank you for your business.
                </div>
              )}

            </div>

            <div className="invoice-total-block">

              <div className="invoice-total-row">

                <span>
                  Subtotal
                </span>

                <strong>
                  {formatCurrency(
                    Number(
                      order.subtotal ||
                        0
                    ),
                    currency
                  )}
                </strong>

              </div>

              {hasDiscount && (
                <div className="invoice-total-row">

                  <span>
                    Discount
                  </span>

                  <strong>
                    −
                    {formatCurrency(
                      Number(
                        order.discount_amount ||
                          0
                      ),
                      currency
                    )}
                  </strong>

                </div>
              )}

              {hasTax && (
                <div className="invoice-total-row">

                  <span>
                    Tax
                  </span>

                  <strong>
                    {formatCurrency(
                      Number(
                        order.tax_amount ||
                          0
                      ),
                      currency
                    )}
                  </strong>

                </div>
              )}

              {hasShipping && (
                <div className="invoice-total-row">

                  <span>
                    Shipping
                  </span>

                  <strong>
                    {formatCurrency(
                      Number(
                        order.shipping_amount ||
                          0
                      ),
                      currency
                    )}
                  </strong>

                </div>
              )}

              <div className="invoice-total-divider" />

              <div className="invoice-grand-total">

                <span>
                  TOTAL
                </span>

                <strong>
                  {formatCurrency(
                    Number(
                      order.total_amount ||
                        0
                    ),
                    currency
                  )}
                </strong>

              </div>

            </div>

          </div>

          <footer className="invoice-footer">

            <div>

              <strong>
                {
                  companyName
                }
              </strong>

              <span>
                Sales Order ·{" "}
                {
                  order.order_number
                }
              </span>

            </div>

            <div className="invoice-footer-right">

              <span>
                Currency
              </span>

              <strong>
                {
                  currency
                }
              </strong>

            </div>

          </footer>

        </section>

        {cancellationError && (
          <div className="cancellation-feedback error">
            {cancellationError}
          </div>
        )}

        {cancellationSuccess && (
          <div className="cancellation-feedback success">
            {cancellationSuccess}
          </div>
        )}

        <section className="screen-information">

          <div className="screen-card">

            <div className="screen-card-header">

              <div>
                <h2>
                  Order Information
                </h2>

                <p>
                  Internal order details
                </p>
              </div>

            </div>

            <div className="screen-info-grid">

              <div>
                <span>
                  Order Number
                </span>

                <strong>
                  {
                    order.order_number
                  }
                </strong>
              </div>

              <div>
                <span>
                  Created
                </span>

                <strong>
                  {formatDateTime(
                    order.created_at
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Last Updated
                </span>

                <strong>
                  {formatDateTime(
                    order.updated_at
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Total Units
                </span>

                <strong>
                  {
                    totalQuantity
                  }
                </strong>
              </div>

            </div>

          </div>

          <div className="screen-card fulfillment-card">

            <div className="screen-card-header">

              <div>
                <h2>
                  Inventory Fulfillment
                </h2>

                <p>
                  Issue inventory-tracked items from one warehouse location.
                </p>
              </div>

            </div>

            <div className="fulfillment-body">

              {order.fulfillment_status ===
              "fulfilled" ? (
                <div className="fulfillment-complete">

                  <strong>
                    Order fulfilled
                  </strong>

                  <span>
                    Inventory was issued for this order. Further stock-out actions are blocked.
                  </span>

                </div>
              ) : [
                  "cancelled",
                  "refunded",
                ].includes(
                  order.status
                ) ? (
                <div className="fulfillment-complete fulfillment-blocked">

                  <strong>
                    Fulfillment unavailable
                  </strong>

                  <span>
                    Cancelled and refunded orders cannot issue inventory.
                  </span>

                </div>
              ) : (
                <>
                  <div className="fulfillment-fields">

                    <label>
                      <span>
                        Warehouse
                      </span>

                      <select
                        value={
                          selectedWarehouseId
                        }
                        onChange={(
                          event
                        ) => {
                          const warehouseId =
                            event
                              .target
                              .value;

                          const firstLocation =
                            locations.find(
                              (
                                location
                              ) =>
                                location.warehouse_id ===
                                warehouseId
                            );

                          setSelectedWarehouseId(
                            warehouseId
                          );

                          setSelectedLocationId(
                            firstLocation?.id ||
                              ""
                          );

                          setFulfillmentError(
                            null
                          );

                          setFulfillmentSuccess(
                            null
                          );
                        }}
                        disabled={
                          fulfillmentOptionsLoading ||
                          isFulfilling
                        }
                      >
                        <option value="">
                          Select warehouse
                        </option>

                        {warehouses.map(
                          (
                            warehouse
                          ) => (
                            <option
                              key={
                                warehouse.id
                              }
                              value={
                                warehouse.id
                              }
                            >
                              {
                                warehouse.name
                              }{" "}
                              (
                              {
                                warehouse.code
                              }
                              )
                            </option>
                          )
                        )}
                      </select>

                    </label>

                    <label>
                      <span>
                        Location
                      </span>

                      <select
                        value={
                          selectedLocationId
                        }
                        onChange={(
                          event
                        ) => {
                          setSelectedLocationId(
                            event
                              .target
                              .value
                          );

                          setFulfillmentError(
                            null
                          );

                          setFulfillmentSuccess(
                            null
                          );
                        }}
                        disabled={
                          fulfillmentOptionsLoading ||
                          isFulfilling ||
                          !selectedWarehouseId
                        }
                      >
                        <option value="">
                          {
                            selectedWarehouseId
                              ? "Select location"
                              : "Select warehouse first"
                          }
                        </option>

                        {availableLocations.map(
                          (
                            location
                          ) => (
                            <option
                              key={
                                location.id
                              }
                              value={
                                location.id
                              }
                            >
                              {
                                location.name
                              }{" "}
                              (
                              {
                                location.code
                              }
                              )
                            </option>
                          )
                        )}
                      </select>

                    </label>

                  </div>

                  {hasSerialItems && (
                    <div className="serial-allocation-section">

                      <div className="serial-allocation-header">

                        <div>
                          <strong>
                            Serial Number Allocation
                          </strong>

                          <span>
                            Select the exact serial number for each serialized item.
                          </span>
                        </div>

                        {serialsLoading && (
                          <span className="serial-loading">
                            Loading serials...
                          </span>
                        )}

                      </div>

                      {serialItems.map(
                        (
                          item
                        ) => {
                          const serials =
                            availableSerials[
                              item.id
                            ] || [];

                          const selected =
                            selectedSerials[
                              item.id
                            ] || [];

                          const requiredQuantity =
                            Number(
                              item.quantity ||
                                0
                            );

                          return (
                            <div
                              key={
                                item.id
                              }
                              className="serial-item"
                            >

                              <div className="serial-item-header">

                                <div>
                                  <strong>
                                    {
                                      item.product_name
                                    }
                                  </strong>

                                  {item.variant_name && (
                                    <span>
                                      {
                                        item.variant_name
                                      }
                                    </span>
                                  )}
                                </div>

                                <div
                                  className={`serial-count ${
                                    selected.length ===
                                    requiredQuantity
                                      ? "complete"
                                      : ""
                                  }`}
                                >
                                  {
                                    selected.length
                                  }{" "}
                                  /{" "}
                                  {
                                    requiredQuantity
                                  }{" "}
                                  selected
                                </div>

                              </div>

                              {serials.length ===
                              0 ? (
                                <div className="serial-empty">

                                  {serialsLoading
                                    ? "Loading available serial numbers..."
                                    : "No available serial numbers were found in the selected warehouse and location."}

                                </div>
                              ) : (
                                <div className="serial-list">

                                  {serials.map(
                                    (
                                      serial
                                    ) => {
                                      const isSelected =
                                        selected.includes(
                                          serial.id
                                        );

                                      const maxReached =
                                        selected.length >=
                                          requiredQuantity &&
                                        !isSelected;

                                      return (
                                        <label
                                          key={
                                            serial.id
                                          }
                                          className={`serial-row ${
                                            isSelected
                                              ? "selected"
                                              : ""
                                          } ${
                                            maxReached
                                              ? "disabled"
                                              : ""
                                          }`}
                                        >

                                          <input
                                            type="checkbox"
                                            checked={
                                              isSelected
                                            }
                                            disabled={
                                              maxReached ||
                                              isFulfilling
                                            }
                                            onChange={() =>
                                              toggleSerial(
                                                item.id,
                                                serial.id,
                                                requiredQuantity
                                              )
                                            }
                                          />

                                          <div className="serial-row-main">

                                            <strong>
                                              {
                                                serial.serial_number
                                              }
                                            </strong>

                                            <span>
                                              {serial.barcode
                                                ? `Barcode: ${serial.barcode}`
                                                : "No barcode"}
                                            </span>

                                          </div>

                                          <span className="serial-status">
                                            Available
                                          </span>

                                        </label>
                                      );
                                    }
                                  )}

                                </div>
                              )}

                            </div>
                          );
                        }
                      )}

                    </div>
                  )}

                  {fulfillmentError && (
                    <div className="fulfillment-feedback error">
                      {
                        fulfillmentError
                      }
                    </div>
                  )}

                  {fulfillmentSuccess && (
                    <div className="fulfillment-feedback success">
                      {
                        fulfillmentSuccess
                      }
                    </div>
                  )}

                  <div className="fulfillment-actions">

                    <span>
                      {hasSerialItems
                        ? "Quantity-tracked lines are deducted from inventory. Serial-tracked lines require exact serial allocation."
                        : "Quantity-tracked lines are deducted when this action completes."}
                    </span>

                    {hasSerialItems ? (
                      <button
                        type="button"
                        onClick={() =>
                          void fulfillSerialOrder()
                        }
                        disabled={
                          fulfillmentOptionsLoading ||
                          serialsLoading ||
                          isFulfilling ||
                          items.length ===
                            0 ||
                          !selectedWarehouseId ||
                          !selectedLocationId ||
                          !allSerialSelectionsComplete
                        }
                      >
                        {isFulfilling
                          ? "Fulfilling..."
                          : "Fulfill Serial Order"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          void fulfillOrder()
                        }
                        disabled={
                          fulfillmentOptionsLoading ||
                          isFulfilling ||
                          items.length ===
                            0 ||
                          !selectedWarehouseId ||
                          !selectedLocationId
                        }
                      >
                        {isFulfilling
                          ? "Fulfilling..."
                          : "Fulfill Order"}
                      </button>
                    )}

                  </div>
                </>
              )}

            </div>

          </div>

          <div className="screen-card">

            <div className="screen-card-header">

              <div>
                <h2>
                  Customer
                </h2>

                <p>
                  Customer contact information
                </p>
              </div>

            </div>

            <div className="screen-customer">

              <div className="screen-customer-avatar">
                {
                  customerName
                    .slice(
                      0,
                      1
                    )
                    .toUpperCase()
                }
              </div>

              <div>

                <strong>
                  {
                    customerName
                  }
                </strong>

                {order
                  .customers
                  ?.email && (
                  <a
                    href={`mailto:${order.customers.email}`}
                  >
                    {
                      order
                        .customers
                        .email
                    }
                  </a>
                )}

                {order
                  .customers
                  ?.phone && (
                  <a
                    href={`tel:${order.customers.phone}`}
                  >
                    {
                      order
                        .customers
                        .phone
                    }
                  </a>
                )}

              </div>

            </div>

          </div>

          <div className="screen-card">

            <div className="screen-card-header">

              <div>
                <h2>
                  Invoice
                </h2>

                <p>
                  Billing document connected to this order
                </p>
              </div>

            </div>

            <div className="invoice-connection">

              {invoiceLoading ? (
                <div className="connection-loading">
                  Loading invoice...
                </div>
              ) : invoice ? (
                <>
                  <div className="connection-main">

                    <strong>
                      {
                        invoice.invoice_number
                      }
                    </strong>

                    <span>
                      Status:{" "}
                      {
                        formatStatus(
                          invoice.status
                        )
                      }
                    </span>

                  </div>

                  <div className="connection-actions">

                    <button
                      type="button"
                      onClick={
                        viewInvoice
                      }
                    >
                      View Invoice
                    </button>

                    <button
                      type="button"
                      onClick={
                        recordPayment
                      }
                    >
                      Record Payment
                    </button>

                  </div>
                </>
              ) : (
                <>
                  <div className="connection-main">

                    <strong>
                      No invoice linked
                    </strong>

                    <span>
                      Create an invoice for this sales order.
                    </span>

                  </div>

                  <div className="connection-actions">

                    <button
                      type="button"
                      onClick={
                        createInvoice
                      }
                    >
                      Create Invoice
                    </button>

                  </div>
                </>
              )}

            </div>

          </div>

          <div className="screen-card">

            <div className="screen-card-header">

              <div>
                <h2>
                  Payments
                </h2>

                <p>
                  Payments recorded against the linked invoice
                </p>
              </div>

            </div>

            <div className="payments-summary">

              <div>
                <span>
                  Invoice Total
                </span>

                <strong>
                  {invoice
                    ? formatCurrency(
                        invoiceTotal,
                        currency
                      )
                    : "—"}
                </strong>
              </div>

              <div>
                <span>
                  Paid
                </span>

                <strong>
                  {invoice
                    ? formatCurrency(
                        paidAmount,
                        currency
                      )
                    : "—"}
                </strong>
              </div>

              <div>
                <span>
                  Balance Due
                </span>

                <strong
                  className={
                    balanceDue >
                    0
                      ? "payment-due"
                      : "payment-clear"
                  }
                >
                  {invoice
                    ? formatCurrency(
                        balanceDue,
                        currency
                      )
                    : "—"}
                </strong>
              </div>

            </div>

            {paymentsLoading ? (
              <div className="connection-loading">
                Loading payments...
              </div>
            ) : payments.length >
              0 ? (
              <div className="payment-list">

                {payments.map(
                  (
                    payment
                  ) => (
                    <div
                      key={
                        payment.id
                      }
                      className="payment-row"
                    >

                      <div>
                        <strong>
                          {formatCurrency(
                            Number(
                              payment.amount ||
                                0
                            ),
                            payment.currency ||
                              currency
                          )}
                        </strong>

                        <span>
                          {
                            payment.payment_method ||
                            "Payment"
                          }
                        </span>
                      </div>

                      <div>
                        <span>
                          {
                            payment.reference ||
                            "No reference"
                          }
                        </span>

                        <span>
                          {formatDateTime(
                            payment.paid_at
                          )}
                        </span>
                      </div>

                    </div>
                  )
                )}

              </div>
            ) : (
              <div className="connection-empty">
                No payments have been recorded.
              </div>
            )}

          </div>

        </section>

      </div>

      <style jsx>{`
        .order-page {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
          padding: 10px 0 50px;
        }

        .order-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .order-header-actions button {
          height: 36px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid #dfe4eb;
          background: #ffffff;
          color: #586274;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-family: inherit;
          font-size: 10px;
          font-weight: 700;
        }

        .order-header-actions button:hover {
          background: #f7f9fb;
          color: #263043;
        }

        .order-header-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .order-invoice-button {
          background: #f7f9fb !important;
        }

        .order-print-button {
          background: #ffffff;
        }

        .order-cancel-button {
          border-color: #ead6d6 !important;
          background: #fff8f8 !important;
          color: #925d5d !important;
        }

        .order-cancel-button:hover:not(:disabled) {
          border-color: #dfc1c1 !important;
          background: #fff1f1 !important;
          color: #7e4e4e !important;
        }

        .cancellation-feedback {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 7px;
          font-size: 9px;
          line-height: 1.5;
        }

        .cancellation-feedback.error {
          border: 1px solid #eddada;
          background: #fff8f8;
          color: #8d5c5c;
        }

        .cancellation-feedback.success {
          border: 1px solid #d8e9dc;
          background: #f5fbf6;
          color: #55775e;
        }

        .invoice-document {
          background: #ffffff;
          border: 1px solid #e4e8ee;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 3px 14px rgba(31, 41, 55, 0.035);
        }

        .invoice-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 30px;
          padding: 30px 32px 25px;
          border-bottom: 1px solid #edf0f3;
        }

        .invoice-company-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .invoice-company-block h1 {
          margin: 0;
          color: #263043;
          font-size: 19px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .invoice-company-block span {
          color: #969fac;
          font-size: 9px;
          font-weight: 600;
        }

        .invoice-title-block {
          text-align: right;
        }

        .invoice-title {
          color: #6d7685;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .invoice-number {
          margin-top: 5px;
          color: #263043;
          font-size: 14px;
          font-weight: 800;
        }

        .invoice-meta-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-bottom: 1px solid #edf0f3;
        }

        .invoice-meta-group {
          min-height: 67px;
          padding: 14px 18px;
          border-right: 1px solid #edf0f3;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
        }

        .invoice-meta-group:last-child {
          border-right: 0;
        }

        .invoice-meta-group span {
          color: #a0a7b2;
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .invoice-meta-group strong {
          color: #4d586a;
          font-size: 10px;
          font-weight: 700;
        }

        .invoice-status {
          display: inline-flex;
          width: fit-content;
          padding: 4px 7px;
          border-radius: 5px;
        }

        .invoice-status.success {
          background: #f0f8f2;
          color: #4d7a5b !important;
        }

        .invoice-status.warning {
          background: #fbf7eb;
          color: #8b7542 !important;
        }

        .invoice-status.danger {
          background: #fff4f4;
          color: #925d5d !important;
        }

        .invoice-status.neutral {
          background: #f4f6f8;
          color: #697386 !important;
        }

        .invoice-parties {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          padding: 24px 32px;
          border-bottom: 1px solid #edf0f3;
        }

        .invoice-party {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .invoice-party-right {
          text-align: right;
          align-items: flex-end;
        }

        .invoice-section-label {
          margin-bottom: 7px;
          color: #9ba3af;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .invoice-party-name {
          color: #3f4a5c;
          font-size: 11px;
        }

        .invoice-party span {
          color: #8992a0;
          font-size: 9px;
        }

        .invoice-items-section {
          padding: 23px 32px 8px;
        }

        .invoice-items-table {
          width: 100%;
          border-collapse: collapse;
        }

        .invoice-items-table th {
          padding: 8px 7px;
          border-bottom: 1px solid #e9edf1;
          color: #9aa2ad;
          font-size: 8px;
          font-weight: 800;
          text-align: left;
          letter-spacing: 0.07em;
        }

        .invoice-items-table td {
          padding: 13px 7px;
          border-bottom: 1px solid #f0f2f5;
          color: #657082;
          font-size: 9px;
          vertical-align: middle;
        }

        .invoice-items-table th:first-child,
        .invoice-items-table td:first-child {
          padding-left: 0;
        }

        .invoice-items-table th:last-child,
        .invoice-items-table td:last-child {
          padding-right: 0;
        }

        .invoice-items-table .item-description {
          width: 42%;
        }

        .invoice-items-table .item-description strong {
          display: block;
          color: #465163;
          font-size: 10px;
          font-weight: 700;
        }

        .invoice-items-table .item-description span {
          display: block;
          margin-top: 3px;
          color: #9aa2ad;
          font-size: 8px;
        }

        .invoice-items-table .item-sku {
          color: #8c95a3;
          font-size: 8px;
        }

        .invoice-items-table .item-qty {
          width: 9%;
          text-align: center;
        }

        .invoice-items-table .item-price,
        .invoice-items-table .item-total {
          text-align: right;
          white-space: nowrap;
        }

        .invoice-items-table .item-price {
          width: 17%;
        }

        .invoice-items-table .item-total {
          width: 17%;
        }

        .invoice-items-table .item-total strong {
          color: #465163;
          font-weight: 800;
        }

        .invoice-empty {
          padding: 30px 0;
          color: #9aa2ad;
          font-size: 10px;
          text-align: center;
        }

        .invoice-bottom {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 35px;
          padding: 25px 32px 28px;
        }

        .invoice-notes-block {
          min-width: 0;
        }

        .invoice-notes-block p {
          max-width: 520px;
          margin: 0;
          color: #6f7887;
          font-size: 9px;
          line-height: 1.6;
        }

        .invoice-thank-you {
          color: #9aa2ad;
          font-size: 9px;
        }

        .invoice-total-block {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .invoice-total-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          color: #7d8796;
          font-size: 9px;
        }

        .invoice-total-row strong {
          color: #4c5768;
          font-size: 9px;
        }

        .invoice-total-divider {
          height: 1px;
          margin: 3px 0;
          background: #e8ebef;
        }

        .invoice-grand-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .invoice-grand-total span {
          color: #5c6675;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .invoice-grand-total strong {
          color: #263043;
          font-size: 15px;
          font-weight: 800;
        }

        .invoice-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 17px 32px;
          border-top: 1px solid #edf0f3;
          background: #fbfcfd;
        }

        .invoice-footer > div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .invoice-footer strong {
          color: #5b6574;
          font-size: 8px;
        }

        .invoice-footer span {
          color: #a0a7b2;
          font-size: 8px;
        }

        .invoice-footer-right {
          text-align: right;
          align-items: flex-end;
        }

        .screen-information {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 15px;
        }

        .screen-card {
          background: #ffffff;
          border: 1px solid #e4e8ee;
          border-radius: 11px;
          overflow: hidden;
        }

        .screen-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 17px 19px;
          border-bottom: 1px solid #edf0f3;
        }

        .screen-card-header h2 {
          margin: 0;
          color: #3f4a5c;
          font-size: 11px;
          font-weight: 800;
        }

        .screen-card-header p {
          margin: 4px 0 0;
          color: #9aa2ad;
          font-size: 8px;
        }

        .screen-info-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }

        .screen-info-grid > div {
          min-height: 72px;
          padding: 15px 19px;
          border-right: 1px solid #edf0f3;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
        }

        .screen-info-grid > div:last-child {
          border-right: 0;
        }

        .screen-info-grid span {
          color: #9aa2ad;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }

        .screen-info-grid strong {
          color: #596476;
          font-size: 10px;
        }

        .fulfillment-body {
          padding: 18px 19px 19px;
        }

        .fulfillment-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .fulfillment-fields label {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .fulfillment-fields label > span {
          color: #8e97a5;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .fulfillment-fields select {
          width: 100%;
          height: 38px;
          padding: 0 11px;
          border: 1px solid #dfe4eb;
          border-radius: 7px;
          background: #ffffff;
          color: #586274;
          outline: none;
          font-family: inherit;
          font-size: 10px;
        }

        .fulfillment-fields select:focus {
          border-color: #b8c0cb;
        }

        .fulfillment-feedback {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 7px;
          font-size: 9px;
          line-height: 1.5;
        }

        .fulfillment-feedback.error {
          border: 1px solid #eddada;
          background: #fff8f8;
          color: #8d5c5c;
        }

        .fulfillment-feedback.success {
          border: 1px solid #d8e9dc;
          background: #f5fbf6;
          color: #55775e;
        }

        .fulfillment-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 15px;
          padding-top: 14px;
          border-top: 1px solid #edf0f3;
        }

        .fulfillment-actions > span {
          max-width: 650px;
          color: #929aa7;
          font-size: 8px;
          line-height: 1.5;
        }

        .fulfillment-actions button {
          flex: 0 0 auto;
          height: 37px;
          padding: 0 15px;
          border: 0;
          border-radius: 7px;
          background: #3f4b5c;
          color: #ffffff;
          cursor: pointer;
          font-family: inherit;
          font-size: 9px;
          font-weight: 800;
        }

        .fulfillment-actions button:hover:not(:disabled) {
          background: #303b4b;
        }

        .fulfillment-actions button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .fulfillment-complete {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 13px 14px;
          border: 1px solid #d8e9dc;
          border-radius: 8px;
          background: #f6fbf7;
        }

        .fulfillment-complete strong {
          color: #52715b;
          font-size: 10px;
        }

        .fulfillment-complete span {
          color: #7d9182;
          font-size: 8px;
          line-height: 1.5;
        }

        .fulfillment-blocked {
          border-color: #eadada;
          background: #fff8f8;
        }

        .fulfillment-blocked strong {
          color: #8b5d5d;
        }

        .fulfillment-blocked span {
          color: #a27d7d;
        }

        .serial-allocation-section {
          margin-top: 16px;
          border: 1px solid #e3e7ed;
          border-radius: 9px;
          background: #fbfcfd;
          overflow: hidden;
        }

        .serial-allocation-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 15px;
          border-bottom: 1px solid #e3e7ed;
        }

        .serial-allocation-header > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .serial-allocation-header strong {
          color: #344054;
          font-size: 10px;
        }

        .serial-allocation-header span {
          color: #8b95a5;
          font-size: 8px;
        }

        .serial-loading {
          color: #697386 !important;
          font-weight: 700;
        }

        .serial-item {
          padding: 14px 15px;
          border-bottom: 1px solid #e8ebf0;
        }

        .serial-item:last-child {
          border-bottom: 0;
        }

        .serial-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .serial-item-header > div:first-child {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .serial-item-header strong {
          color: #3d4758;
          font-size: 10px;
        }

        .serial-item-header span {
          color: #8b95a5;
          font-size: 8px;
        }

        .serial-count {
          padding: 5px 8px;
          border: 1px solid #e1e5eb;
          border-radius: 6px;
          background: #ffffff;
          color: #7b8492;
          font-size: 8px;
          font-weight: 800;
          white-space: nowrap;
        }

        .serial-count.complete {
          border-color: #cfe5d6;
          background: #f3fbf5;
          color: #4b8060;
        }

        .serial-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .serial-row {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 50px;
          padding: 9px 10px;
          border: 1px solid #e1e5eb;
          border-radius: 7px;
          background: #ffffff;
          cursor: pointer;
          transition:
            border-color 0.15s ease,
            background 0.15s ease;
        }

        .serial-row:hover {
          border-color: #cbd2dc;
          background: #fafbfc;
        }

        .serial-row.selected {
          border-color: #a9c4b2;
          background: #f5faf6;
        }

        .serial-row.disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .serial-row input {
          width: 15px;
          height: 15px;
          margin: 0;
          accent-color: #536b5d;
          cursor: pointer;
        }

        .serial-row input:disabled {
          cursor: not-allowed;
        }

        .serial-row-main {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .serial-row-main strong {
          color: #344054;
          font-size: 10px;
          font-weight: 800;
          word-break: break-all;
        }

        .serial-row-main span {
          color: #929baa;
          font-size: 8px;
        }

        .serial-status {
          padding: 4px 7px;
          border-radius: 5px;
          background: #f2f7f3;
          color: #5f7b69;
          font-size: 7px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .serial-empty {
          padding: 12px;
          border: 1px dashed #d9dee6;
          border-radius: 7px;
          background: #ffffff;
          color: #8d96a4;
          font-size: 9px;
          line-height: 1.5;
        }

        .screen-customer {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 17px 19px;
        }

        .screen-customer-avatar {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #f1f3f6;
          color: #657082;
          font-size: 11px;
          font-weight: 800;
        }

        .screen-customer > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .screen-customer strong {
          color: #4d586a;
          font-size: 10px;
        }

        .screen-customer a {
          color: #8b94a2;
          font-size: 8px;
          text-decoration: none;
        }

        .screen-customer a:hover {
          color: #4f596a;
        }

        .invoice-connection {
          min-height: 68px;
          padding: 15px 19px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .connection-main {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .connection-main strong {
          color: #4d586a;
          font-size: 10px;
        }

        .connection-main span {
          color: #969fac;
          font-size: 8px;
        }

        .connection-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .connection-actions button {
          height: 32px;
          padding: 0 10px;
          border: 1px solid #dfe4eb;
          border-radius: 6px;
          background: #ffffff;
          color: #647083;
          cursor: pointer;
          font-family: inherit;
          font-size: 8px;
          font-weight: 700;
        }

        .connection-actions button:hover {
          background: #f7f9fb;
          color: #303b4b;
        }

        .connection-loading,
        .connection-empty {
          padding: 17px 19px;
          color: #9aa2ad;
          font-size: 9px;
        }

        .payments-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-bottom: 1px solid #edf0f3;
        }

        .payments-summary > div {
          min-height: 72px;
          padding: 15px 19px;
          border-right: 1px solid #edf0f3;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
        }

        .payments-summary > div:last-child {
          border-right: 0;
        }

        .payments-summary span {
          color: #9aa2ad;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
        }

        .payments-summary strong {
          color: #596476;
          font-size: 11px;
        }

        .payments-summary .payment-due {
          color: #8b6464;
        }

        .payments-summary .payment-clear {
          color: #557760;
        }

        .payment-list {
          display: flex;
          flex-direction: column;
        }

        .payment-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 13px 19px;
          border-bottom: 1px solid #f0f2f5;
        }

        .payment-row:last-child {
          border-bottom: 0;
        }

        .payment-row > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .payment-row > div:last-child {
          align-items: flex-end;
        }

        .payment-row strong {
          color: #4d586a;
          font-size: 10px;
        }

        .payment-row span {
          color: #969fac;
          font-size: 8px;
        }

        @media (max-width: 800px) {
          .order-page {
            padding: 8px 0 35px;
          }

          .invoice-header {
            padding: 23px 20px 20px;
          }

          .invoice-parties {
            padding: 20px;
          }

          .invoice-items-section {
            padding-left: 20px;
            padding-right: 20px;
          }

          .invoice-bottom {
            grid-template-columns: 1fr;
            gap: 22px;
            padding: 22px 20px;
          }

          .invoice-footer {
            padding: 15px 20px;
          }

          .screen-info-grid {
            grid-template-columns: 1fr 1fr;
          }

          .screen-info-grid > div:nth-child(2) {
            border-right: 0;
          }

          .screen-info-grid > div:nth-child(-n + 2) {
            border-bottom: 1px solid #edf0f3;
          }

          .fulfillment-actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .fulfillment-actions button {
            width: 100%;
          }
        }

        @media (max-width: 600px) {
          .order-header-actions {
            flex-wrap: wrap;
          }

          .invoice-meta-row {
            grid-template-columns: 1fr 1fr;
          }

          .invoice-meta-group:nth-child(2) {
            border-right: 0;
          }

          .invoice-meta-group:nth-child(-n + 2) {
            border-bottom: 1px solid #edf0f3;
          }

          .invoice-parties {
            grid-template-columns: 1fr;
          }

          .invoice-party-right {
            text-align: left;
            align-items: flex-start;
          }

          .invoice-items-table {
            min-width: 650px;
          }

          .invoice-items-section {
            overflow-x: auto;
          }

          .payments-summary {
            grid-template-columns: 1fr;
          }

          .payments-summary > div {
            border-right: 0;
            border-bottom: 1px solid #edf0f3;
          }

          .payments-summary > div:last-child {
            border-bottom: 0;
          }

          .invoice-connection {
            align-items: flex-start;
            flex-direction: column;
          }

          .connection-actions {
            width: 100%;
          }

          .connection-actions button {
            flex: 1;
          }

          .serial-allocation-header,
          .serial-item-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .serial-count {
            align-self: flex-start;
          }

          .serial-row {
            align-items: flex-start;
          }

          .serial-status {
            display: none;
          }
        }

        @media print {
          .order-header-actions,
          .screen-information,
          .cancellation-feedback {
            display: none !important;
          }

          .order-page {
            max-width: none;
            padding: 0;
          }

          .invoice-document {
            border: 0;
            box-shadow: none;
          }
        }
      `}</style>
    </AppShell>
  );
}