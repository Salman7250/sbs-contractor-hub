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

type Order = {
  id: string;
  company_id: string;
  order_number: string;
  status: string;
  fulfillment_status: string;
  currency: string;
};

type OrderItem = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
};

type Fulfillment = {
  id: string;
  order_item_id: string;
  warehouse_id: string;
  location_id: string | null;
  quantity: number;
  batch_id: string | null;
  batch_quantity: number | null;
  serialized_unit_id: string | null;
};

type Product = {
  id: string;
  name: string;
  tracking_mode: string;
};

type Warehouse = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  is_default: boolean;
};

type WarehouseLocation = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string | null;
  location_type: string;
  is_active: boolean;
};

type BatchStock = {
  id: string;
  batch_id: string;
  product_id: string;
  variant_id: string;
  warehouse_id: string;
  location_id: string | null;
  quantity: number;
  reserved_quantity: number;
};

type Batch = {
  id: string;
  product_id: string;
  variant_id: string;
  lot_number: string | null;
  received_at: string | null;
  quantity_received: number;
  status: string | null;
  unit_cost: number;
};

type SerializedUnit = {
  id: string;
  product_id: string;
  variant_id: string;
  batch_id: string | null;
  warehouse_id: string;
  location_id: string | null;
  serial_number: string;
  barcode: string | null;
  status: string;
  cost_price: number;
};

type Allocation = {
  id: string;
  order_item_id: string;
  batch_id: string | null;
  quantity: number;
  serialized_unit_ids: string[];
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

function formatDate(
  value: string | null | undefined,
) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function humanize(
  value: string | null | undefined,
) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function createId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export default function FulfillSalesOrderPage() {
  const params = useParams();
  const router = useRouter();

  const orderId = String(params.orderId);

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [fulfilling, setFulfilling] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [companyId, setCompanyId] = useState<
    string | null
  >(null);

  const [order, setOrder] =
    useState<Order | null>(null);

  const [items, setItems] = useState<OrderItem[]>(
    [],
  );

  const [fulfillments, setFulfillments] =
    useState<Fulfillment[]>([]);

  const [products, setProducts] = useState<Product[]>(
    [],
  );

  const [warehouses, setWarehouses] = useState<
    Warehouse[]
  >([]);

  const [locations, setLocations] = useState<
    WarehouseLocation[]
  >([]);

  const [batchStocks, setBatchStocks] = useState<
    BatchStock[]
  >([]);

  const [batches, setBatches] = useState<Batch[]>([]);

  const [serializedUnits, setSerializedUnits] =
    useState<SerializedUnit[]>([]);

  const [regionalSettings, setRegionalSettings] =
    useState<RegionalSettings | null>(null);

  const [warehouseId, setWarehouseId] =
    useState("");

  const [locationId, setLocationId] =
    useState("");

  const [allocations, setAllocations] =
    useState<Allocation[]>([]);

  const [openSerialBatch, setOpenSerialBatch] =
    useState<string | null>(null);

  const loadData = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");
        setSuccessMessage("");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error(
            "You must be signed in to fulfill a sales order.",
          );
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
          productsResult,
          warehousesResult,
          locationsResult,
          batchStockResult,
          batchesResult,
          serialResult,
          regionalResult,
        ] = await Promise.all([
          supabase
            .from("orders")
            .select(
              `
                id,
                company_id,
                order_number,
                status,
                fulfillment_status,
                currency
              `,
            )
            .eq("id", orderId)
            .eq(
              "company_id",
              currentCompanyId,
            )
            .maybeSingle(),

          supabase
            .from("order_items")
            .select(
              `
                id,
                product_id,
                variant_id,
                product_name,
                variant_name,
                sku,
                quantity,
                unit_price,
                unit_cost
              `,
            )
            .eq("order_id", orderId)
            .eq(
              "company_id",
              currentCompanyId,
            )
            .order("created_at", {
              ascending: true,
            }),

          supabase
            .from("order_item_fulfillments")
            .select(
              `
                id,
                order_item_id,
                warehouse_id,
                location_id,
                quantity,
                batch_id,
                batch_quantity,
                serialized_unit_id
              `,
            )
            .eq("order_id", orderId)
            .eq(
              "company_id",
              currentCompanyId,
            ),

          supabase
            .from("products")
            .select(
              `
                id,
                name,
                tracking_mode
              `,
            )
            .eq(
              "company_id",
              currentCompanyId,
            ),

          supabase
            .from("warehouses")
            .select(
              `
                id,
                name,
                code,
                is_active,
                is_default
              `,
            )
            .eq(
              "company_id",
              currentCompanyId,
            )
            .eq("is_active", true)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("warehouse_locations")
            .select(
              `
                id,
                warehouse_id,
                name,
                code,
                location_type,
                is_active
              `,
            )
            .eq(
              "company_id",
              currentCompanyId,
            )
            .eq("is_active", true)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("inventory_batch_stock")
            .select(
              `
                id,
                batch_id,
                product_id,
                variant_id,
                warehouse_id,
                location_id,
                quantity,
                reserved_quantity
              `,
            )
            .eq(
              "company_id",
              currentCompanyId,
            ),

          supabase
            .from("inventory_batches")
            .select(
              `
                id,
                product_id,
                variant_id,
                lot_number,
                received_at,
                quantity_received,
                status,
                unit_cost
              `,
            )
            .eq(
              "company_id",
              currentCompanyId,
            ),

          supabase
            .from("serialized_units")
            .select(
              `
                id,
                product_id,
                variant_id,
                batch_id,
                warehouse_id,
                location_id,
                serial_number,
                barcode,
                status,
                cost_price
              `,
            )
            .eq(
              "company_id",
              currentCompanyId,
            )
            .eq("status", "available"),

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
            .eq(
              "company_id",
              currentCompanyId,
            )
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

        if (productsResult.error) {
          throw productsResult.error;
        }

        if (warehousesResult.error) {
          throw warehousesResult.error;
        }

        if (locationsResult.error) {
          throw locationsResult.error;
        }

        if (batchStockResult.error) {
          throw batchStockResult.error;
        }

        if (batchesResult.error) {
          throw batchesResult.error;
        }

        if (serialResult.error) {
          throw serialResult.error;
        }

        if (regionalResult.error) {
          throw regionalResult.error;
        }

        const loadedOrder =
          orderResult.data as Order;

        setOrder(loadedOrder);

        setItems(
          (itemsResult.data ||
            []) as OrderItem[],
        );

        setFulfillments(
          (fulfillmentResult.data ||
            []) as Fulfillment[],
        );

        setProducts(
          (productsResult.data ||
            []) as Product[],
        );

        const loadedWarehouses =
          (warehousesResult.data ||
            []) as Warehouse[];

        setWarehouses(
          loadedWarehouses,
        );

        setLocations(
          (locationsResult.data ||
            []) as WarehouseLocation[],
        );

        setBatchStocks(
          (batchStockResult.data ||
            []) as BatchStock[],
        );

        setBatches(
          (batchesResult.data ||
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

        if (!warehouseId) {
          const defaultWarehouse =
            loadedWarehouses.find(
              (warehouse) =>
                warehouse.is_default,
            ) ||
            loadedWarehouses[0];

          if (defaultWarehouse) {
            setWarehouseId(
              defaultWarehouse.id,
            );
          }
        }
      } catch (error: any) {
        console.error(
          "Fulfillment load error:",
          error,
        );

        setErrorMessage(
          error?.message ||
            "Unable to load fulfillment.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      orderId,
      supabase,
      warehouseId,
    ],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedWarehouse = useMemo(
    () =>
      warehouses.find(
        (warehouse) =>
          warehouse.id === warehouseId,
      ) || null,
    [warehouses, warehouseId],
  );

  const warehouseLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          location.warehouse_id ===
          warehouseId,
      ),
    [locations, warehouseId],
  );

  const remainingByItem = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of items) {
      const fulfilled = fulfillments
        .filter(
          (fulfillment) =>
            fulfillment.order_item_id ===
            item.id,
        )
        .reduce(
          (sum, fulfillment) =>
            sum +
            Number(
              fulfillment.quantity || 0,
            ),
          0,
        );

      map.set(
        item.id,
        Math.max(
          0,
          Number(item.quantity || 0) -
            fulfilled,
        ),
      );
    }

    return map;
  }, [items, fulfillments]);

  const getProduct = (
    productId: string | null,
  ) => {
    if (!productId) return null;

    return (
      products.find(
        (product) =>
          product.id === productId,
      ) || null
    );
  };

  const getAvailableStock = (
    item: OrderItem,
  ) => {
    if (!warehouseId) {
      return [];
    }

    return batchStocks
      .filter(
        (stock) =>
          stock.product_id ===
            item.product_id &&
          stock.variant_id ===
            item.variant_id &&
          stock.warehouse_id ===
            warehouseId &&
          (!locationId ||
            stock.location_id ===
              locationId),
      )
      .map((stock) => {
        const batch = batches.find(
          (itemBatch) =>
            itemBatch.id ===
            stock.batch_id,
        );

        const available =
          Math.max(
            0,
            Number(stock.quantity || 0) -
              Number(
                stock.reserved_quantity ||
                  0,
              ),
          );

        return {
          ...stock,
          batch,
          available,
        };
      })
      .filter(
        (stock) =>
          stock.available > 0,
      )
      .sort((a, b) => {
        const aDate = a.batch
          ?.received_at
          ? new Date(
              a.batch.received_at,
            ).getTime()
          : Number.MAX_SAFE_INTEGER;

        const bDate = b.batch
          ?.received_at
          ? new Date(
              b.batch.received_at,
            ).getTime()
          : Number.MAX_SAFE_INTEGER;

        return aDate - bDate;
      });
  };

  const getSerialsForBatch = (
    item: OrderItem,
    batchId: string,
  ) => {
    return serializedUnits.filter(
      (unit) =>
        unit.product_id ===
          item.product_id &&
        unit.variant_id ===
          item.variant_id &&
        unit.batch_id ===
          batchId &&
        unit.warehouse_id ===
          warehouseId &&
        (!locationId ||
          unit.location_id ===
            locationId) &&
        unit.status === "available",
    );
  };

  const getItemAllocations = (
    itemId: string,
  ) => {
    return allocations.filter(
      (allocation) =>
        allocation.order_item_id ===
        itemId,
    );
  };

  const getAllocatedQuantity = (
    itemId: string,
  ) => {
    return allocations
      .filter(
        (allocation) =>
          allocation.order_item_id ===
          itemId,
      )
      .reduce((sum, allocation) => {
        if (
          allocation.serialized_unit_ids
            .length > 0
        ) {
          return (
            sum +
            allocation.serialized_unit_ids
              .length
          );
        }

        return (
          sum +
          Number(
            allocation.quantity || 0,
          )
        );
      }, 0);
  };

  const getRemainingToAllocate = (
    itemId: string,
  ) => {
    const orderedRemaining =
      remainingByItem.get(itemId) || 0;

    return Math.max(
      0,
      orderedRemaining -
        getAllocatedQuantity(itemId),
    );
  };

  const updateAllocationQuantity = (
    allocationId: string,
    quantity: number,
  ) => {
    setAllocations((current) =>
      current.map((allocation) =>
        allocation.id === allocationId
          ? {
              ...allocation,
              quantity: Math.max(
                0,
                quantity,
              ),
            }
          : allocation,
      ),
    );
  };

  const removeAllocation = (
    allocationId: string,
  ) => {
    setAllocations((current) =>
      current.filter(
        (allocation) =>
          allocation.id !==
          allocationId,
      ),
    );

    if (
      openSerialBatch ===
      allocationId
    ) {
      setOpenSerialBatch(null);
    }
  };

  const addBatchAllocation = (
    item: OrderItem,
    batchId: string,
  ) => {
    setErrorMessage("");

    const stock = getAvailableStock(
      item,
    ).find(
      (entry) =>
        entry.batch_id ===
        batchId,
    );

    if (!stock) {
      setErrorMessage(
        "This batch is no longer available in the selected warehouse/location.",
      );
      return;
    }

    const currentAllocated =
      getAllocatedQuantity(item.id);

    const remaining =
      Math.max(
        0,
        Number(
          remainingByItem.get(
            item.id,
          ) || 0,
        ) -
          currentAllocated,
      );

    if (remaining <= 0) {
      setErrorMessage(
        `All remaining quantity for ${item.product_name} has already been allocated.`,
      );
      return;
    }

    const existing =
      allocations.find(
        (allocation) =>
          allocation.order_item_id ===
            item.id &&
          allocation.batch_id ===
            batchId &&
          allocation
            .serialized_unit_ids
            .length === 0,
      );

    if (existing) {
      const nextQuantity =
        Math.min(
          Number(
            existing.quantity || 0,
          ) + remaining,
          stock.available,
        );

      updateAllocationQuantity(
        existing.id,
        nextQuantity,
      );

      return;
    }

    const allocationQuantity =
      Math.min(
        remaining,
        stock.available,
      );

    setAllocations((current) => [
      ...current,
      {
        id: createId(),
        order_item_id: item.id,
        batch_id: batchId,
        quantity:
          allocationQuantity,
        serialized_unit_ids: [],
      },
    ]);
  };

  const addUntrackedAllocation = (
    item: OrderItem,
  ) => {
    setErrorMessage("");

    const remaining =
      getRemainingToAllocate(
        item.id,
      );

    if (remaining <= 0) {
      setErrorMessage(
        `All remaining quantity for ${item.product_name} has already been allocated.`,
      );
      return;
    }

    const existing =
      allocations.find(
        (allocation) =>
          allocation.order_item_id ===
            item.id &&
          allocation.batch_id ===
            null &&
          allocation
            .serialized_unit_ids
            .length === 0,
      );

    if (existing) {
      updateAllocationQuantity(
        existing.id,
        Number(
          existing.quantity || 0,
        ) + remaining,
      );

      return;
    }

    setAllocations((current) => [
      ...current,
      {
        id: createId(),
        order_item_id: item.id,
        batch_id: null,
        quantity: remaining,
        serialized_unit_ids: [],
      },
    ]);
  };

  const toggleSerial = (
    item: OrderItem,
    allocationId: string,
    serialId: string,
  ) => {
    setErrorMessage("");

    const allocation =
      allocations.find(
        (entry) =>
          entry.id ===
          allocationId,
      );

    if (!allocation) return;

    const alreadySelected =
      allocation.serialized_unit_ids.includes(
        serialId,
      );

    if (alreadySelected) {
      setAllocations((current) =>
        current.map((entry) =>
          entry.id === allocationId
            ? {
                ...entry,
                serialized_unit_ids:
                  entry.serialized_unit_ids.filter(
                    (id) =>
                      id !== serialId,
                  ),
              }
            : entry,
        ),
      );

      return;
    }

    const serials =
      allocation.batch_id
        ? getSerialsForBatch(
            item,
            allocation.batch_id,
          )
        : [];

    const selectedCount =
      allocation.serialized_unit_ids
        .length;

    const availableSerialCount =
      serials.length;

    const currentRemaining =
      getRemainingToAllocate(
        item.id,
      );

    if (
      selectedCount >=
      availableSerialCount
    ) {
      setErrorMessage(
        "No more available serial numbers exist in this batch.",
      );
      return;
    }

    if (
      selectedCount >=
      currentRemaining +
        selectedCount
    ) {
      setErrorMessage(
        "You cannot allocate more than the remaining order quantity.",
      );
      return;
    }

    setAllocations((current) =>
      current.map((entry) =>
        entry.id === allocationId
          ? {
              ...entry,
              serialized_unit_ids: [
                ...entry.serialized_unit_ids,
                serialId,
              ],
              quantity: 0,
            }
          : entry,
      ),
    );
  };

  const convertSerialAllocationToQuantity =
    (
      allocation: Allocation,
      item: OrderItem,
    ) => {
      if (!allocation.batch_id) {
        return;
      }

      const serialCount =
        allocation.serialized_unit_ids
          .length;

      if (serialCount === 0) {
        return;
      }

      const stock = getAvailableStock(
        item,
      ).find(
        (entry) =>
          entry.batch_id ===
          allocation.batch_id,
      );

      if (!stock) {
        return;
      }

      const maxQuantity =
        Math.min(
          Number(
            stock.available || 0,
          ),
          getRemainingToAllocate(
            item.id,
          ) + serialCount,
        );

      setAllocations((current) =>
        current.map((entry) =>
          entry.id === allocation.id
            ? {
                ...entry,
                serialized_unit_ids: [],
                quantity: Math.min(
                  maxQuantity,
                  serialCount,
                ),
              }
            : entry,
        ),
      );
    };

  const validateAllocations = () => {
    if (!order) {
      return "Sales order is missing.";
    }

    if (
      order.status === "cancelled" ||
      order.status === "refunded"
    ) {
      return "This order cannot be fulfilled because it is cancelled or refunded.";
    }

    if (!warehouseId) {
      return "Please select a warehouse.";
    }

    if (!locationId) {
      return "Please select a location.";
    }

    for (const item of items) {
      const product =
        getProduct(
          item.product_id,
        );

      const trackingMode =
        product?.tracking_mode ||
        "none";

      const remaining =
        remainingByItem.get(
          item.id,
        ) || 0;

      if (remaining <= 0) {
        continue;
      }

      const allocated =
        getAllocatedQuantity(
          item.id,
        );

      if (
        allocated !==
        remaining
      ) {
        return `${item.product_name}: allocate exactly ${remaining} remaining unit${remaining === 1 ? "" : "s"}. Currently allocated ${allocated}.`;
      }

      const itemAllocations =
        getItemAllocations(
          item.id,
        );

      if (
        trackingMode === "none"
      ) {
        const invalid =
          itemAllocations.some(
            (allocation) =>
              allocation.batch_id !==
                null ||
              allocation
                .serialized_unit_ids
                .length > 0,
          );

        if (invalid) {
          return `${item.product_name}: non-tracked products cannot have batch or serial allocations.`;
        }
      } else {
        for (const allocation of itemAllocations) {
          if (!allocation.batch_id) {
            return `${item.product_name}: every tracked allocation must have a batch/lot selected.`;
          }

          if (
            allocation.serialized_unit_ids
              .length > 0
          ) {
            if (
              allocation.quantity !==
              0
            ) {
              return `${item.product_name}: serialized allocations must use serial count as their quantity.`;
            }
          } else if (
            Number(
              allocation.quantity || 0,
            ) <= 0
          ) {
            return `${item.product_name}: every batch allocation must have a quantity greater than zero.`;
          }
        }
      }
    }

    return null;
  };

  const fulfillOrder = async () => {
    try {
      setFulfilling(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!companyId) {
        throw new Error(
          "Company context is missing.",
        );
      }

      const validation =
        validateAllocations();

      if (validation) {
        throw new Error(
          validation,
        );
      }

      const rpcAllocations =
        items.map((item) => {
          const itemAllocations =
            allocations.filter(
              (allocation) =>
                allocation.order_item_id ===
                item.id,
            );

          return {
            order_item_id: item.id,
            allocations:
              itemAllocations.map(
                (allocation) => ({
                  batch_id:
                    allocation.batch_id,
                  quantity:
                    allocation
                      .serialized_unit_ids
                      .length > 0
                      ? allocation
                          .serialized_unit_ids
                          .length
                      : Number(
                          allocation.quantity ||
                            0,
                        ),
                  serialized_unit_ids:
                    allocation.serialized_unit_ids,
                }),
              ),
          };
        });

      const { data, error } =
        await supabase.rpc(
          "fulfill_sales_order_allocated",
          {
            p_company_id:
              companyId,
            p_order_id:
              orderId,
            p_warehouse_id:
              warehouseId,
            p_location_id:
              locationId,
            p_allocations:
              rpcAllocations,
          },
        );

      if (error) {
        throw error;
      }

      const result =
        Array.isArray(data)
          ? data[0]
          : data;

      setSuccessMessage(
        `Order ${order.order_number} fulfilled successfully.`,
      );

      setAllocations([]);

      await loadData(true);

      if (
        result?.fulfillment_status ===
        "fulfilled"
      ) {
        setTimeout(() => {
          router.push(
            `/sales/${orderId}`,
          );
        }, 500);
      }
    } catch (error: any) {
      console.error(
        "Fulfill order error:",
        error,
      );

      setErrorMessage(
        error?.message ||
          "Unable to fulfill the sales order.",
      );
    } finally {
      setFulfilling(false);
    }
  };

  const totalRemaining = useMemo(
    () =>
      Array.from(
        remainingByItem.values(),
      ).reduce(
        (sum, value) =>
          sum + Number(value || 0),
        0,
      ),
    [remainingByItem],
  );

  const totalAllocated = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          getAllocatedQuantity(
            item.id,
          ),
        0,
      ),
    [items, allocations],
  );

  const allocationComplete =
    totalRemaining > 0 &&
    totalAllocated ===
      totalRemaining;

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-8">
            <div className="animate-pulse">
              <div className="h-4 w-52 rounded bg-slate-200" />

              <div className="mt-5 h-9 w-80 rounded bg-slate-200" />

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
                Unable to load fulfillment
              </h1>

              <p className="mt-2 text-sm text-red-700">
                {errorMessage ||
                  "Sales order not found."}
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

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1600px] px-6 py-6 lg:px-8">

          {/* Header */}
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>

              {/* Breadcrumb */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <button
                  type="button"
                  onClick={() =>
                    router.push("/sales")
                  }
                  className="transition hover:text-slate-900"
                >
                  Sales
                </button>

                <span>/</span>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/sales/${orderId}`,
                    )
                  }
                  className="transition hover:text-slate-900"
                >
                  {order.order_number}
                </button>

                <span>/</span>

                <span className="text-slate-900">
                  Fulfillment
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                Fulfill {order.order_number}
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Select the warehouse, location,
                batches/lots, and optional serial
                numbers to fulfill this order.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/sales/${orderId}`,
                  )
                }
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Back to Order
              </button>

              <button
                type="button"
                onClick={() =>
                  loadData(true)
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
                    Unable to fulfill order
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

          {isCancelled && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-sm font-semibold text-red-800">
                This order cannot be fulfilled.
              </p>

              <p className="mt-1 text-sm text-red-700">
                The order is{" "}
                {humanize(order.status)}.
              </p>
            </div>
          )}

          {/* Warehouse Selection */}
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-base font-semibold text-slate-950">
                Fulfillment Location
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select where the inventory will be
                taken from.
              </p>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Warehouse
                </label>

                <select
                  value={warehouseId}
                  onChange={(event) => {
                    setWarehouseId(
                      event.target.value,
                    );

                    setLocationId("");
                    setAllocations([]);
                    setOpenSerialBatch(null);
                  }}
                  disabled={isCancelled}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                >
                  <option value="">
                    Select warehouse
                  </option>

                  {warehouses.map(
                    (warehouse) => (
                      <option
                        key={warehouse.id}
                        value={warehouse.id}
                      >
                        {warehouse.name}
                        {warehouse.code
                          ? ` — ${warehouse.code}`
                          : ""}
                        {warehouse.is_default
                          ? " (Default)"
                          : ""}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Location
                </label>

                <select
                  value={locationId}
                  onChange={(event) => {
                    setLocationId(
                      event.target.value,
                    );

                    setAllocations([]);
                    setOpenSerialBatch(null);
                  }}
                  disabled={
                    isCancelled ||
                    !warehouseId
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                >
                  <option value="">
                    Select location
                  </option>

                  {warehouseLocations.map(
                    (location) => (
                      <option
                        key={location.id}
                        value={location.id}
                      >
                        {location.name}
                        {location.code
                          ? ` — ${location.code}`
                          : ""}
                        {location.location_type
                          ? ` · ${humanize(
                              location.location_type,
                            )}`
                          : ""}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            {selectedWarehouse && (
              <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
                  <span>
                    Warehouse:{" "}
                    <strong className="font-semibold text-slate-700">
                      {selectedWarehouse.name}
                    </strong>
                  </span>

                  {locationId && (
                    <span>
                      Location:{" "}
                      <strong className="font-semibold text-slate-700">
                        {
                          warehouseLocations.find(
                            (location) =>
                              location.id ===
                              locationId,
                          )?.name
                        }
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Progress */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Remaining
              </p>

              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {totalRemaining}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Units still to fulfill
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Allocated
              </p>

              <p className="mt-3 text-2xl font-semibold tracking-tight text-blue-700">
                {totalAllocated}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Units selected for fulfillment
              </p>
            </div>

            <div
              className={`rounded-2xl border p-5 shadow-sm ${
                allocationComplete
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  allocationComplete
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                Allocation Status
              </p>

              <p
                className={`mt-3 text-lg font-semibold ${
                  allocationComplete
                    ? "text-emerald-800"
                    : "text-amber-800"
                }`}
              >
                {allocationComplete
                  ? "Ready to Fulfill"
                  : "Allocation Required"}
              </p>

              <p
                className={`mt-1 text-xs ${
                  allocationComplete
                    ? "text-emerald-700/70"
                    : "text-amber-700/70"
                }`}
              >
                {totalRemaining > 0
                  ? `${totalAllocated} of ${totalRemaining} allocated`
                  : "No remaining quantity"}
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="mt-6 space-y-6">
            {items.map((item) => {
              const product =
                getProduct(
                  item.product_id,
                );

              const trackingMode =
                product?.tracking_mode ||
                "none";

              const remaining =
                remainingByItem.get(
                  item.id,
                ) || 0;

              const allocated =
                getAllocatedQuantity(
                  item.id,
                );

              const itemAllocations =
                getItemAllocations(
                  item.id,
                );

              const stockEntries =
                getAvailableStock(item);

              const isTracked =
                trackingMode !== "none";

              return (
                <section
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  {/* Item Header */}
                  <div className="border-b border-slate-200 px-6 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="whitespace-normal break-words text-base font-semibold text-slate-950">
                            {item.product_name}
                          </h2>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                              isTracked
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                            }`}
                          >
                            {isTracked
                              ? "Tracked"
                              : "Not Tracked"}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {item.variant_name && (
                            <span>
                              {item.variant_name}
                            </span>
                          )}

                          {item.sku && (
                            <>
                              <span className="text-slate-300">
                                ·
                              </span>

                              <span>
                                SKU {item.sku}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Remaining
                          </p>

                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {remaining}
                          </p>
                        </div>

                        <div
                          className={`rounded-xl px-4 py-3 text-right ${
                            allocated === remaining
                              ? "bg-emerald-50"
                              : "bg-amber-50"
                          }`}
                        >
                          <p
                            className={`text-[11px] font-medium uppercase tracking-wide ${
                              allocated === remaining
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }`}
                          >
                            Allocated
                          </p>

                          <p
                            className={`mt-1 text-lg font-semibold ${
                              allocated === remaining
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }`}
                          >
                            {allocated}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Not Tracked */}
                  {!isTracked && (
                    <div className="p-6">
                      {remaining <= 0 ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                          <p className="text-sm font-semibold text-emerald-800">
                            This item is fully
                            fulfilled.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                Inventory is not
                                tracked
                              </p>

                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                No batch or serial
                                selection is required
                                for this product.
                              </p>
                            </div>

                            {itemAllocations.length ===
                              0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  addUntrackedAllocation(
                                    item,
                                  )
                                }
                                disabled={
                                  isCancelled ||
                                  !warehouseId ||
                                  !locationId
                                }
                                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Allocate{" "}
                                {remaining}
                              </button>
                            )}
                          </div>

                          {itemAllocations.map(
                            (allocation) => (
                              <div
                                key={
                                  allocation.id
                                }
                                className="mt-4 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">
                                    Quantity
                                    allocation
                                  </p>

                                  <p className="mt-1 text-xs text-slate-400">
                                    No inventory
                                    source required
                                  </p>
                                </div>

                                <div className="flex items-center gap-3">
                                  <input
                                    type="number"
                                    min="0"
                                    max={remaining}
                                    value={
                                      allocation.quantity
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateAllocationQuantity(
                                        allocation.id,
                                        Number(
                                          event
                                            .target
                                            .value,
                                        ),
                                      )
                                    }
                                    className="h-10 w-28 rounded-lg border border-slate-200 px-3 text-right text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                  />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeAllocation(
                                        allocation.id,
                                      )
                                    }
                                    className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tracked */}
                  {isTracked && (
                    <div className="p-6">
                      {remaining <= 0 ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                          <p className="text-sm font-semibold text-emerald-800">
                            This item is fully
                            fulfilled.
                          </p>
                        </div>
                      ) : !warehouseId ||
                        !locationId ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-5">
                          <p className="text-sm font-semibold text-amber-800">
                            Select a warehouse and
                            location first.
                          </p>

                          <p className="mt-1 text-xs leading-5 text-amber-700/80">
                            Available batches and
                            serial numbers will
                            appear after the
                            fulfillment location is
                            selected.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Available Batches */}
                          <div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <h3 className="text-sm font-semibold text-slate-900">
                                  Available Batches /
                                  Lots
                                </h3>

                                <p className="mt-1 text-xs text-slate-500">
                                  Select one or more
                                  inventory lots. You
                                  can split this item
                                  across multiple
                                  batches.
                                </p>
                              </div>

                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                {stockEntries.length}{" "}
                                available
                              </span>
                            </div>

                            {stockEntries.length ===
                            0 ? (
                              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-5">
                                <p className="text-sm font-semibold text-red-800">
                                  No available batch
                                  stock found.
                                </p>

                                <p className="mt-1 text-xs leading-5 text-red-700/80">
                                  This variant has no
                                  available quantity
                                  in the selected
                                  warehouse/location.
                                </p>
                              </div>
                            ) : (
                              <div className="mt-4 grid gap-3">
                                {stockEntries.map(
                                  (stock) => {
                                    const batch =
                                      stock.batch;

                                    const existingQuantityAllocation =
                                      itemAllocations.find(
                                        (
                                          allocation,
                                        ) =>
                                          allocation.batch_id ===
                                            stock.batch_id &&
                                          allocation
                                            .serialized_unit_ids
                                            .length ===
                                            0,
                                      );

                                    const serialAllocations =
                                      itemAllocations.filter(
                                        (
                                          allocation,
                                        ) =>
                                          allocation.batch_id ===
                                            stock.batch_id &&
                                          allocation
                                            .serialized_unit_ids
                                            .length >
                                            0,
                                      );

                                    const selectedSerialCount =
                                      serialAllocations.reduce(
                                        (
                                          sum,
                                          allocation,
                                        ) =>
                                          sum +
                                          allocation
                                            .serialized_unit_ids
                                            .length,
                                        0,
                                      );

                                    const serials =
                                      getSerialsForBatch(
                                        item,
                                        stock.batch_id,
                                      );

                                    const isAllocated =
                                      Boolean(
                                        existingQuantityAllocation ||
                                          serialAllocations.length >
                                            0,
                                      );

                                    return (
                                      <div
                                        key={
                                          stock.id
                                        }
                                        className={`rounded-2xl border p-4 transition ${
                                          isAllocated
                                            ? "border-blue-200 bg-blue-50/40"
                                            : "border-slate-200 bg-white"
                                        }`}
                                      >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                          <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <p className="whitespace-nowrap text-sm font-semibold text-slate-900">
                                                {batch?.lot_number ||
                                                  "Unnamed Lot"}
                                              </p>

                                              {batch?.status && (
                                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                                  {humanize(
                                                    batch.status,
                                                  )}
                                                </span>
                                              )}

                                              {selectedSerialCount >
                                                0 && (
                                                <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                                                  {
                                                    selectedSerialCount
                                                  }{" "}
                                                  serial
                                                  {selectedSerialCount ===
                                                  1
                                                    ? ""
                                                    : "s"}{" "}
                                                  selected
                                                </span>
                                              )}
                                            </div>

                                            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
                                              <span>
                                                Available:{" "}
                                                <strong className="font-semibold text-slate-700">
                                                  {
                                                    stock.available
                                                  }
                                                </strong>
                                              </span>

                                              <span>
                                                Received:{" "}
                                                {batch?.received_at
                                                  ? formatDate(
                                                      batch.received_at,
                                                    )
                                                  : "—"}
                                              </span>

                                              <span>
                                                Unit Cost:{" "}
                                                {formatMoney(
                                                  Number(
                                                    batch?.unit_cost ||
                                                      0,
                                                  ),
                                                  order.currency,
                                                  regionalSettings,
                                                )}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex flex-wrap items-center gap-2">
                                            {!existingQuantityAllocation &&
                                              serialAllocations.length ===
                                                0 && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    addBatchAllocation(
                                                      item,
                                                      stock.batch_id,
                                                    )
                                                  }
                                                  disabled={
                                                    getRemainingToAllocate(
                                                      item.id,
                                                    ) <=
                                                      0 ||
                                                    isCancelled
                                                  }
                                                  className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                  Allocate Batch
                                                </button>
                                              )}

                                            {serials.length >
                                              0 && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setOpenSerialBatch(
                                                    openSerialBatch ===
                                                      stock.batch_id
                                                      ? null
                                                      : stock.batch_id,
                                                  )
                                                }
                                                className="inline-flex h-9 items-center justify-center rounded-lg border border-purple-200 bg-white px-4 text-xs font-semibold text-purple-700 transition hover:bg-purple-50"
                                              >
                                                {openSerialBatch ===
                                                stock.batch_id
                                                  ? "Hide Serials"
                                                  : "Select Serials"}
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {/* Quantity Allocation */}
                                        {existingQuantityAllocation && (
                                          <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                              <div>
                                                <p className="text-xs font-semibold text-blue-800">
                                                  Batch Quantity
                                                  Allocation
                                                </p>

                                                <p className="mt-1 text-[11px] text-slate-400">
                                                  Available:{" "}
                                                  {
                                                    stock.available
                                                  }
                                                </p>
                                              </div>

                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  max={
                                                    stock.available
                                                  }
                                                  step="1"
                                                  value={
                                                    existingQuantityAllocation.quantity
                                                  }
                                                  onChange={(
                                                    event,
                                                  ) =>
                                                    updateAllocationQuantity(
                                                      existingQuantityAllocation.id,
                                                      Math.min(
                                                        stock.available,
                                                        Math.max(
                                                          0,
                                                          Number(
                                                            event
                                                              .target
                                                              .value,
                                                          ),
                                                        ),
                                                      ),
                                                    )
                                                  }
                                                  className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                                />

                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    removeAllocation(
                                                      existingQuantityAllocation.id,
                                                    )
                                                  }
                                                  className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 px-3 text-xs font-medium text-red-600 transition hover:bg-red-50"
                                                >
                                                  Remove
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Serial Selection */}
                                        {openSerialBatch ===
                                          stock.batch_id &&
                                          serials.length >
                                            0 && (
                                            <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50/40 p-4">
                                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                  <p className="text-sm font-semibold text-purple-900">
                                                    Select Serial
                                                    Numbers
                                                  </p>

                                                  <p className="mt-1 text-xs text-purple-700/70">
                                                    Serialization
                                                    is optional.
                                                    Select only
                                                    the units
                                                    you want to
                                                    allocate from
                                                    this lot.
                                                  </p>
                                                </div>

                                                <span className="rounded-full border border-purple-200 bg-white px-3 py-1 text-xs font-semibold text-purple-700">
                                                  {
                                                    serials.length
                                                  }{" "}
                                                  available
                                                </span>
                                              </div>

                                              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                {serials.map(
                                                  (
                                                    serial,
                                                  ) => {
                                                    const selectedAllocation =
                                                      serialAllocations.find(
                                                        (
                                                          allocation,
                                                        ) =>
                                                          allocation.serialized_unit_ids.includes(
                                                            serial.id,
                                                          ),
                                                      );

                                                    const isSelected =
                                                      Boolean(
                                                        selectedAllocation,
                                                      );

                                                    return (
                                                      <button
                                                        key={
                                                          serial.id
                                                        }
                                                        type="button"
                                                        onClick={() => {
                                                          if (
                                                            selectedAllocation
                                                          ) {
                                                            toggleSerial(
                                                              item,
                                                              selectedAllocation.id,
                                                              serial.id,
                                                            );
                                                            return;
                                                          }

                                                          let targetAllocation =
                                                            serialAllocations[0];

                                                          if (
                                                            !targetAllocation
                                                          ) {
                                                            const newAllocation: Allocation =
                                                              {
                                                                id: createId(),
                                                                order_item_id:
                                                                  item.id,
                                                                batch_id:
                                                                  stock.batch_id,
                                                                quantity: 0,
                                                                serialized_unit_ids:
                                                                  [],
                                                              };

                                                            setAllocations(
                                                              (
                                                                current,
                                                              ) => [
                                                                ...current,
                                                                newAllocation,
                                                              ],
                                                            );

                                                            targetAllocation =
                                                              newAllocation;
                                                          }

                                                          toggleSerial(
                                                            item,
                                                            targetAllocation.id,
                                                            serial.id,
                                                          );
                                                        }}
                                                        className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left transition ${
                                                          isSelected
                                                            ? "border-purple-300 bg-purple-100"
                                                            : "border-slate-200 bg-white hover:border-purple-200 hover:bg-white"
                                                        }`}
                                                      >
                                                        <div className="min-w-0">
                                                          <p className="truncate text-xs font-semibold text-slate-900">
                                                            {
                                                              serial.serial_number
                                                            }
                                                          </p>

                                                          {serial.barcode && (
                                                            <p className="mt-1 truncate text-[10px] text-slate-400">
                                                              {
                                                                serial.barcode
                                                              }
                                                            </p>
                                                          )}
                                                        </div>

                                                        <div
                                                          className={`ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                                            isSelected
                                                              ? "border-purple-600 bg-purple-600 text-white"
                                                              : "border-slate-300 bg-white"
                                                          }`}
                                                        >
                                                          {isSelected && (
                                                            <svg
                                                              className="h-3 w-3"
                                                              viewBox="0 0 24 24"
                                                              fill="none"
                                                              stroke="currentColor"
                                                              strokeWidth="3"
                                                            >
                                                              <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="m5 12 4 4L19 6"
                                                              />
                                                            </svg>
                                                          )}
                                                        </div>
                                                      </button>
                                                    );
                                                  },
                                                )}
                                              </div>

                                              {serialAllocations.map(
                                                (
                                                  allocation,
                                                ) => (
                                                  <div
                                                    key={
                                                      allocation.id
                                                    }
                                                    className="mt-4 flex flex-col gap-3 rounded-lg border border-purple-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                                                  >
                                                    <div>
                                                      <p className="text-xs font-semibold text-purple-900">
                                                        {
                                                          allocation
                                                            .serialized_unit_ids
                                                            .length
                                                        }{" "}
                                                        serial
                                                        {allocation
                                                          .serialized_unit_ids
                                                          .length ===
                                                        1
                                                          ? ""
                                                          : "s"}{" "}
                                                        allocated
                                                      </p>

                                                      <p className="mt-1 text-[11px] text-slate-400">
                                                        This
                                                        allocation
                                                        will
                                                        consume
                                                        one unit
                                                        of batch
                                                        stock per
                                                        selected
                                                        serial.
                                                      </p>
                                                    </div>

                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        convertSerialAllocationToQuantity(
                                                          allocation,
                                                          item,
                                                        )
                                                      }
                                                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                                                    >
                                                      Use Quantity
                                                      Instead
                                                    </button>
                                                  </div>
                                                ),
                                              )}
                                            </div>
                                          )}
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            )}
                          </div>

                          {/* Item Allocation Summary */}
                          {itemAllocations.length >
                            0 && (
                            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <h3 className="text-sm font-semibold text-slate-900">
                                    Allocation Summary
                                  </h3>

                                  <p className="mt-1 text-xs text-slate-500">
                                    This item is split
                                    across the following
                                    inventory sources.
                                  </p>
                                </div>

                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    allocated ===
                                    remaining
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {allocated} /{" "}
                                  {remaining}
                                </span>
                              </div>

                              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                                <div className="overflow-x-auto">
                                  <table className="min-w-[700px] w-full">
                                    <thead>
                                      <tr className="border-b border-slate-100 bg-slate-50">
                                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                          Source
                                        </th>

                                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                          Quantity
                                        </th>

                                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                          Serialization
                                        </th>

                                        <th className="w-20 px-4 py-3" />
                                      </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100">
                                      {itemAllocations.map(
                                        (
                                          allocation,
                                        ) => {
                                          const batch =
                                            allocation.batch_id
                                              ? batches.find(
                                                  (
                                                    entry,
                                                  ) =>
                                                    entry.id ===
                                                    allocation.batch_id,
                                                )
                                              : null;

                                          const quantity =
                                            allocation
                                              .serialized_unit_ids
                                              .length >
                                            0
                                              ? allocation
                                                  .serialized_unit_ids
                                                  .length
                                              : Number(
                                                  allocation.quantity ||
                                                    0,
                                                );

                                          return (
                                            <tr
                                              key={
                                                allocation.id
                                              }
                                            >
                                              <td className="px-4 py-3">
                                                <p className="text-xs font-semibold text-slate-800">
                                                  {batch
                                                    ?.lot_number ||
                                                    "No batch"}
                                                </p>

                                                {batch?.received_at && (
                                                  <p className="mt-1 text-[10px] text-slate-400">
                                                    Received{" "}
                                                    {formatDate(
                                                      batch.received_at,
                                                    )}
                                                  </p>
                                                )}
                                              </td>

                                              <td className="px-4 py-3 text-right">
                                                <span className="text-xs font-semibold text-slate-800">
                                                  {
                                                    quantity
                                                  }
                                                </span>
                                              </td>

                                              <td className="px-4 py-3">
                                                {allocation
                                                  .serialized_unit_ids
                                                  .length >
                                                0 ? (
                                                  <div className="flex flex-wrap gap-1">
                                                    {allocation.serialized_unit_ids.map(
                                                      (
                                                        serialId,
                                                      ) => {
                                                        const serial =
                                                          serializedUnits.find(
                                                            (
                                                              unit,
                                                            ) =>
                                                              unit.id ===
                                                              serialId,
                                                          );

                                                        return (
                                                          <span
                                                            key={
                                                              serialId
                                                            }
                                                            className="rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-medium text-purple-700"
                                                          >
                                                            {serial
                                                              ?.serial_number ||
                                                              "Serial"}
                                                          </span>
                                                        );
                                                      },
                                                    )}
                                                  </div>
                                                ) : (
                                                  <span className="text-xs text-slate-400">
                                                    Quantity
                                                    allocation
                                                  </span>
                                                )}
                                              </td>

                                              <td className="px-4 py-3 text-right">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    removeAllocation(
                                                      allocation.id,
                                                    )
                                                  }
                                                  className="text-xs font-medium text-red-600 transition hover:text-red-700"
                                                >
                                                  Remove
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        },
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* Bottom Action Area */}
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
            <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 7h16M4 12h10M4 17h7"
                    />

                    <circle
                      cx="18"
                      cy="15"
                      r="3"
                    />
                  </svg>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-blue-900">
                    V2 Fulfillment Workflow
                  </h3>

                  <p className="mt-1 max-w-3xl text-xs leading-5 text-blue-800/80">
                    Tracked inventory is allocated
                    from specific batches/lots. Serial
                    numbers are optional child identities
                    within those batches, so a single
                    order item can contain both serialized
                    and quantity-only allocations.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-blue-100 bg-white/70 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">
                        01
                      </p>

                      <p className="mt-1 text-xs font-semibold text-slate-800">
                        Warehouse
                      </p>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-white/70 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">
                        02
                      </p>

                      <p className="mt-1 text-xs font-semibold text-slate-800">
                        Batch / Lot
                      </p>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-white/70 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">
                        03
                      </p>

                      <p className="mt-1 text-xs font-semibold text-slate-800">
                        Optional Serials
                      </p>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-white/70 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">
                        04
                      </p>

                      <p className="mt-1 text-xs font-semibold text-slate-800">
                        Inventory Movement
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Fulfillment Total
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {totalAllocated} of{" "}
                    {totalRemaining} units
                    allocated
                  </p>
                </div>

                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    allocationComplete
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {allocationComplete ? (
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
                  ) : (
                    <svg
                      className="h-5 w-5"
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
                  )}
                </div>
              </div>

              <div className="mt-5">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      allocationComplete
                        ? "bg-emerald-500"
                        : "bg-blue-500"
                    }`}
                    style={{
                      width: `${
                        totalRemaining > 0
                          ? Math.min(
                              100,
                              (totalAllocated /
                                totalRemaining) *
                                100,
                            )
                          : 100
                      }%`,
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={fulfillOrder}
                disabled={
                  fulfilling ||
                  isCancelled ||
                  !allocationComplete ||
                  !warehouseId ||
                  !locationId
                }
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {fulfilling && (
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      className="opacity-25"
                    />

                    <path
                      d="M21 12a9 9 0 0 1-9 9"
                      className="opacity-90"
                    />
                  </svg>
                )}

                {fulfilling
                  ? "Processing Fulfillment..."
                  : "Fulfill Order"}
              </button>

              {!allocationComplete &&
                !isCancelled && (
                  <p className="mt-3 text-center text-xs leading-5 text-slate-400">
                    Allocate the exact remaining
                    quantity across batches or
                    non-tracked quantities before
                    fulfilling the order.
                  </p>
                )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}