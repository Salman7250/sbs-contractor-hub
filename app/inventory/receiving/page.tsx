"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type PurchaseOrder = {
  id: string;
  company_id: string;
  supplier_id: string | null;
  po_number: string;
  status: string;
  currency: string | null;
  order_date: string | null;
  expected_date: string | null;
  warehouse_id: string | null;
  supplier_reference: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  shipping_amount: number | null;
  total_amount: number | null;
  notes: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
};

type PurchaseOrderItem = {
  id: string;
  company_id: string;
  purchase_order_id: string;
  product_id: string | null;
  variant_id: string | null;
  supplier_product_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  supplier_sku: string | null;
  description: string | null;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  created_at: string;
  updated_at: string;
};

type Supplier = {
  id: string;
  display_name: string | null;
  legal_name: string | null;
  supplier_number: string | null;
};

type Product = {
  id: string;
  name: string;
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
  code: string;
  is_active: boolean;
  is_default: boolean;
};

type Location = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string;
  is_active: boolean;
};

type ReceivingLine = {
  quantity: number;
  lot_number: string;
  serial_numbers: string[];
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

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

function getTrackingLabel(
  trackingMode: string | null | undefined,
): string {
  switch (trackingMode) {
    case "serial":
      return "Serial";

    case "batch":
      return "Batch / Lot";

    case "quantity":
      return "Quantity";

    case "none":
      return "Non-stock";

    default:
      return "Unknown";
  }
}

export default function InventoryReceivingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseOrderIdParam =
    searchParams.get("purchaseOrderId") || "";

  const supabase = useMemo(() => createClient(), []);

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [purchaseOrders, setPurchaseOrders] = useState<
    PurchaseOrder[]
  >([]);

  const [purchaseOrderItems, setPurchaseOrderItems] =
    useState<Record<string, PurchaseOrderItem[]>>({});

  const [suppliers, setSuppliers] = useState<
    Record<string, Supplier>
  >({});

  const [products, setProducts] = useState<
    Record<string, Product>
  >({});

  const [variants, setVariants] = useState<
    Record<string, Variant>
  >({});

  const [warehouses, setWarehouses] = useState<Warehouse[]>(
    [],
  );

  const [locations, setLocations] = useState<Location[]>(
    [],
  );

  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] =
    useState("");

  const [selectedWarehouseId, setSelectedWarehouseId] =
    useState("");

  const [selectedLocationId, setSelectedLocationId] =
    useState("");

  const [receivingLines, setReceivingLines] = useState<
    Record<string, ReceivingLine>
  >({});

  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receiving, setReceiving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedPurchaseOrder = useMemo<
    PurchaseOrder | null
  >(
    () =>
      purchaseOrders.find(
        (po) => po.id === selectedPurchaseOrderId,
      ) || null,
    [purchaseOrders, selectedPurchaseOrderId],
  );

  const selectedItems = useMemo(
    () =>
      selectedPurchaseOrder
        ? purchaseOrderItems[selectedPurchaseOrder.id] || []
        : [],
    [purchaseOrderItems, selectedPurchaseOrder],
  );

  const selectedWarehouse = useMemo(
    () =>
      warehouses.find(
        (warehouse) => warehouse.id === selectedWarehouseId,
      ) || null,
    [warehouses, selectedWarehouseId],
  );

  const selectedSupplier = useMemo<Supplier | null>(() => {
    if (!selectedPurchaseOrder?.supplier_id) {
      return null;
    }

    return (
      suppliers[selectedPurchaseOrder.supplier_id] ||
      null
    );
  }, [selectedPurchaseOrder, suppliers]);

  const availableLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          location.warehouse_id === selectedWarehouseId &&
          location.is_active,
      ),
    [locations, selectedWarehouseId],
  );

  const filteredPurchaseOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return purchaseOrders.filter((po) => {
      const supplier = po.supplier_id
        ? suppliers[po.supplier_id]
        : null;

      const supplierName =
        supplier?.display_name ||
        supplier?.legal_name ||
        "";

      return (
        !query ||
        po.po_number.toLowerCase().includes(query) ||
        supplierName.toLowerCase().includes(query) ||
        (po.supplier_reference || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [purchaseOrders, search, suppliers]);

  const totalOutstanding = useMemo(() => {
    return purchaseOrders.reduce((sum, po) => {
      const items = purchaseOrderItems[po.id] || [];

      return (
        sum +
        items.reduce((itemSum, item) => {
          const remaining =
            toNumber(item.quantity) -
            toNumber(item.received_quantity);

          return itemSum + Math.max(remaining, 0);
        }, 0)
      );
    }, 0);
  }, [purchaseOrders, purchaseOrderItems]);

  const outstandingLines = useMemo(() => {
    return selectedItems.filter(
      (item) =>
        toNumber(item.quantity) -
          toNumber(item.received_quantity) >
        0,
    ).length;
  }, [selectedItems]);

  const selectedRemainingUnits = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      return (
        sum +
        Math.max(
          toNumber(item.quantity) -
            toNumber(item.received_quantity),
          0,
        )
      );
    }, 0);
  }, [selectedItems]);

  const hasSerialItems = useMemo(() => {
    return selectedItems.some((item) => {
      const trackingMode = item.product_id
        ? products[item.product_id]?.tracking_mode
        : null;

      return trackingMode === "serial";
    });
  }, [selectedItems, products]);

  const initializeReceivingLines = useCallback(
    (items: PurchaseOrderItem[]) => {
      const next: Record<string, ReceivingLine> = {};

      for (const item of items) {
        next[item.id] = {
          quantity: 0,
          lot_number: "",
          serial_numbers: [],
        };
      }

      setReceivingLines(next);
    },
    [],
  );

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");
      setSuccessMessage("");

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
            "No company membership was found.",
          );
        }

        const currentCompanyId =
          membership.company_id;

        setCompanyId(currentCompanyId);

        const [
          purchaseOrdersResult,
          purchaseOrderItemsResult,
          suppliersResult,
          productsResult,
          variantsResult,
          warehousesResult,
          locationsResult,
        ] = await Promise.all([
          supabase
            .from("purchase_orders")
            .select(
              `
                id,
                company_id,
                supplier_id,
                po_number,
                status,
                currency,
                order_date,
                expected_date,
                warehouse_id,
                supplier_reference,
                subtotal,
                discount_amount,
                tax_amount,
                shipping_amount,
                total_amount,
                notes,
                terms,
                created_at,
                updated_at
              `,
            )
            .eq("company_id", currentCompanyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("purchase_order_items")
            .select(
              `
                id,
                company_id,
                purchase_order_id,
                product_id,
                variant_id,
                supplier_product_id,
                product_name,
                variant_name,
                sku,
                supplier_sku,
                description,
                quantity,
                received_quantity,
                unit_cost,
                discount_amount,
                tax_amount,
                line_total,
                created_at,
                updated_at
              `,
            )
            .eq("company_id", currentCompanyId),

          supabase
            .from("suppliers")
            .select(
              `
                id,
                display_name,
                legal_name,
                supplier_number
              `,
            )
            .eq("company_id", currentCompanyId),

          supabase
            .from("products")
            .select(
              `
                id,
                name,
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
            .select(
              `
                id,
                name,
                code,
                is_active,
                is_default
              `,
            )
            .eq("company_id", currentCompanyId)
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
              `
                id,
                warehouse_id,
                name,
                code,
                is_active
              `,
            )
            .eq("company_id", currentCompanyId)
            .eq("is_active", true)
            .order("name", {
              ascending: true,
            }),
        ]);

        if (purchaseOrdersResult.error) {
          throw purchaseOrdersResult.error;
        }

        if (purchaseOrderItemsResult.error) {
          throw purchaseOrderItemsResult.error;
        }

        if (suppliersResult.error) {
          throw suppliersResult.error;
        }

        if (productsResult.error) {
          throw productsResult.error;
        }

        if (variantsResult.error) {
          throw variantsResult.error;
        }

        if (warehousesResult.error) {
          throw warehousesResult.error;
        }

        if (locationsResult.error) {
          throw locationsResult.error;
        }

        const allPurchaseOrders =
          (purchaseOrdersResult.data ||
            []) as PurchaseOrder[];

        const allItems =
          (purchaseOrderItemsResult.data ||
            []) as PurchaseOrderItem[];

        const itemsByPo: Record<
          string,
          PurchaseOrderItem[]
        > = {};

        for (const item of allItems) {
          if (!itemsByPo[item.purchase_order_id]) {
            itemsByPo[item.purchase_order_id] = [];
          }

          itemsByPo[item.purchase_order_id].push(item);
        }

        /*
         * IMPORTANT:
         *
         * A PO stays in the receiving queue whenever it has
         * any remaining quantity.
         *
         * We intentionally do NOT rely only on status.
         *
         * This handles:
         * confirmed
         * partially_received
         * partial
         * and any future status where stock is still outstanding.
         *
         * Cancelled POs are excluded.
         */
        const receivablePurchaseOrders =
          allPurchaseOrders.filter((po) => {
            if (
              po.status === "cancelled" ||
              po.status === "closed"
            ) {
              return false;
            }

            const items = itemsByPo[po.id] || [];

            return items.some(
              (item) =>
                toNumber(item.quantity) -
                  toNumber(item.received_quantity) >
                0,
            );
          });

        const supplierMap: Record<string, Supplier> =
          {};

        for (const supplier of (suppliersResult.data ||
          []) as Supplier[]) {
          supplierMap[supplier.id] = supplier;
        }

        const productMap: Record<string, Product> =
          {};

        for (const product of (productsResult.data ||
          []) as Product[]) {
          productMap[product.id] = product;
        }

        const variantMap: Record<string, Variant> =
          {};

        for (const variant of (variantsResult.data ||
          []) as Variant[]) {
          variantMap[variant.id] = variant;
        }

        setPurchaseOrders(
          receivablePurchaseOrders,
        );

        setPurchaseOrderItems(itemsByPo);
        setSuppliers(supplierMap);
        setProducts(productMap);
        setVariants(variantMap);

        const loadedWarehouses =
          (warehousesResult.data ||
            []) as Warehouse[];

        const loadedLocations =
          (locationsResult.data ||
            []) as Location[];

        setWarehouses(loadedWarehouses);
        setLocations(loadedLocations);

        const explicitPurchaseOrder =
          purchaseOrderIdParam
            ? receivablePurchaseOrders.find(
                (po) =>
                  po.id ===
                  purchaseOrderIdParam,
              ) || null
            : null;

        const currentlySelected =
          selectedPurchaseOrderId
            ? receivablePurchaseOrders.find(
                (po) =>
                  po.id ===
                  selectedPurchaseOrderId,
              ) || null
            : null;

        const nextPurchaseOrder =
          explicitPurchaseOrder ||
          currentlySelected ||
          receivablePurchaseOrders[0] ||
          null;

        const nextPurchaseOrderId =
          nextPurchaseOrder?.id || "";

        setSelectedPurchaseOrderId(
          nextPurchaseOrderId,
        );

        if (nextPurchaseOrder) {
          const preferredWarehouse =
            nextPurchaseOrder.warehouse_id &&
            loadedWarehouses.some(
              (warehouse) =>
                warehouse.id ===
                nextPurchaseOrder.warehouse_id,
            )
              ? nextPurchaseOrder.warehouse_id
              : loadedWarehouses.find(
                    (warehouse) =>
                      warehouse.is_default,
                  )?.id ||
                loadedWarehouses[0]?.id ||
                "";

          setSelectedWarehouseId(
            preferredWarehouse,
          );

          const firstLocation =
            loadedLocations.find(
              (location) =>
                location.warehouse_id ===
                  preferredWarehouse &&
                location.is_active,
            );

          setSelectedLocationId(
            firstLocation?.id || "",
          );

          initializeReceivingLines(
            itemsByPo[
              nextPurchaseOrder.id
            ] || [],
          );
        } else {
          setSelectedPurchaseOrderId("");
          setSelectedWarehouseId("");
          setSelectedLocationId("");
          setReceivingLines({});
        }
      } catch (error) {
        console.error(
          "Receiving page load error:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load purchase orders for receiving.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      initializeReceivingLines,
      purchaseOrderIdParam,
      router,
      selectedPurchaseOrderId,
      supabase,
    ],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadData]);

  useEffect(() => {
    if (!selectedPurchaseOrder) {
      return;
    }

    if (
      selectedWarehouseId &&
      !warehouses.some(
        (warehouse) =>
          warehouse.id ===
          selectedWarehouseId,
      )
    ) {
      setSelectedWarehouseId("");
      setSelectedLocationId("");
      return;
    }

    if (
      selectedWarehouseId &&
      !availableLocations.some(
        (location) =>
          location.id === selectedLocationId,
      )
    ) {
      setSelectedLocationId(
        availableLocations[0]?.id || "",
      );
    }
  }, [
    availableLocations,
    selectedLocationId,
    selectedPurchaseOrder,
    selectedWarehouseId,
    warehouses,
  ]);

  function selectPurchaseOrder(
    purchaseOrderId: string,
  ) {
    const purchaseOrder =
      purchaseOrders.find(
        (po) => po.id === purchaseOrderId,
      );

    if (!purchaseOrder) {
      return;
    }

    setSelectedPurchaseOrderId(
      purchaseOrderId,
    );

    const preferredWarehouse =
      purchaseOrder.warehouse_id &&
      warehouses.some(
        (warehouse) =>
          warehouse.id ===
          purchaseOrder.warehouse_id,
      )
        ? purchaseOrder.warehouse_id
        : warehouses.find(
              (warehouse) =>
                warehouse.is_default,
            )?.id ||
          warehouses[0]?.id ||
          "";

    setSelectedWarehouseId(
      preferredWarehouse,
    );

    const firstLocation =
      locations.find(
        (location) =>
          location.warehouse_id ===
            preferredWarehouse &&
          location.is_active,
      );

    setSelectedLocationId(
      firstLocation?.id || "",
    );

    initializeReceivingLines(
      purchaseOrderItems[
        purchaseOrderId
      ] || [],
    );

    setNotes("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function updateReceiveQuantity(
    itemId: string,
    quantity: number,
  ) {
    const item = selectedItems.find(
      (row) => row.id === itemId,
    );

    if (!item) {
      return;
    }

    const remaining = Math.max(
      toNumber(item.quantity) -
        toNumber(item.received_quantity),
      0,
    );

    const safeQuantity = Math.min(
      Math.max(
        Number.isFinite(quantity)
          ? quantity
          : 0,
        0,
      ),
      remaining,
    );

    setReceivingLines(
      (current) => ({
        ...current,
        [itemId]: {
          quantity: safeQuantity,
          lot_number:
            current[itemId]?.lot_number ||
            "",
          serial_numbers:
            current[itemId]?.serial_numbers ||
            [],
        },
      }),
    );
  }

  function updateReceiveQuantityAndSerials(
    itemId: string,
    quantity: number,
  ) {
    const item = selectedItems.find(
      (row) => row.id === itemId,
    );

    if (!item) {
      return;
    }

    const remaining = Math.max(
      toNumber(item.quantity) -
        toNumber(item.received_quantity),
      0,
    );

    const safeQuantity = Math.min(
      Math.max(
        Number.isFinite(quantity)
          ? quantity
          : 0,
        0,
      ),
      remaining,
    );

    setReceivingLines(
      (current) => {
        const currentLine =
          current[itemId] || {
            quantity: 0,
            lot_number: "",
            serial_numbers: [],
          };

        const serialNumbers = [
          ...currentLine.serial_numbers,
        ];

        while (
          serialNumbers.length <
          safeQuantity
        ) {
          serialNumbers.push("");
        }

        if (
          serialNumbers.length >
          safeQuantity
        ) {
          serialNumbers.splice(
            safeQuantity,
          );
        }

        return {
          ...current,
          [itemId]: {
            quantity: safeQuantity,
            lot_number:
              currentLine.lot_number,
            serial_numbers:
              serialNumbers,
          },
        };
      },
    );
  }

  function updateLotNumber(
    itemId: string,
    value: string,
  ) {
    setReceivingLines(
      (current) => ({
        ...current,
        [itemId]: {
          quantity:
            current[itemId]?.quantity || 0,
          lot_number: value,
          serial_numbers:
            current[itemId]?.serial_numbers ||
            [],
        },
      }),
    );
  }

  function updateSerial(
    itemId: string,
    index: number,
    value: string,
  ) {
    setReceivingLines(
      (current) => {
        const serialNumbers = [
          ...(current[itemId]?.serial_numbers ||
            []),
        ];

        serialNumbers[index] = value;

        return {
          ...current,
          [itemId]: {
            quantity:
              current[itemId]?.quantity ||
              0,
            lot_number:
              current[itemId]?.lot_number ||
              "",
            serial_numbers:
              serialNumbers,
          },
        };
      },
    );
  }

  function validateReceiving(): string | null {
    if (!companyId) {
      return "Company information is not ready yet.";
    }

    if (!selectedPurchaseOrder) {
      return "Select a purchase order first.";
    }

    if (!selectedWarehouseId) {
      return "Select the receiving warehouse.";
    }

    if (!selectedLocationId) {
      return "Select the receiving location.";
    }

    if (selectedItems.length === 0) {
      return "This purchase order has no items.";
    }

    const linesToReceive =
      selectedItems.filter(
        (item) =>
          toNumber(
            receivingLines[item.id]?.quantity,
          ) > 0,
      );

    if (linesToReceive.length === 0) {
      return "Enter a receiving quantity for at least one item.";
    }

    for (const item of linesToReceive) {
      const remaining = Math.max(
        toNumber(item.quantity) -
          toNumber(item.received_quantity),
        0,
      );

      const line =
        receivingLines[item.id] || {
          quantity: 0,
          lot_number: "",
          serial_numbers: [],
        };

      const quantity =
        toNumber(line.quantity);

      if (quantity <= 0) {
        continue;
      }

      if (quantity > remaining) {
        return `${item.product_name}: receiving quantity cannot exceed the remaining quantity of ${formatNumber(
          remaining,
        )}.`;
      }

      const trackingMode =
        item.product_id
          ? products[item.product_id]
              ?.tracking_mode
          : null;

      if (trackingMode === "serial") {
        const serials =
          line.serial_numbers
            .map((serial) =>
              serial.trim(),
            )
            .filter(Boolean);

        if (
          serials.length !==
          quantity
        ) {
          return `${item.product_name}: enter exactly ${formatNumber(
            quantity,
          )} manufacturer serial number${
            quantity === 1
              ? ""
              : "s"
          }.`;
        }

        const seen =
          new Set<string>();

        for (const serial of serials) {
          const normalized =
            serial.toLowerCase();

          if (seen.has(normalized)) {
            return `${item.product_name}: duplicate serial number "${serial}" was entered.`;
          }

          seen.add(normalized);
        }
      } else {
        const suppliedSerials =
          line.serial_numbers.filter(
            (serial) =>
              serial.trim().length >
              0,
          );

        if (
          suppliedSerials.length > 0
        ) {
          return `${item.product_name}: this product is not serial-tracked, so do not enter serial numbers.`;
        }
      }
    }

    return null;
  }

  async function completeReceipt() {
    const validationError =
      validateReceiving();

    if (validationError) {
      setErrorMessage(validationError);
      setSuccessMessage("");
      return;
    }

    if (!selectedPurchaseOrder) {
      return;
    }

    if (!companyId) {
      return;
    }

    setReceiving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const items = selectedItems
        .map((item) => {
          const line =
            receivingLines[item.id] || {
              quantity: 0,
              lot_number: "",
              serial_numbers: [],
            };

          const trackingMode =
            item.product_id
              ? products[item.product_id]
                  ?.tracking_mode
              : null;

          const quantity =
            toNumber(line.quantity);

          return {
            purchase_order_item_id:
              item.id,
            quantity,
            lot_number:
              line.lot_number.trim() ||
              null,
            serial_numbers:
              trackingMode === "serial"
                ? line.serial_numbers
                    .map((serial) =>
                      serial.trim(),
                    )
                    .filter(Boolean)
                : [],
          };
        })
        .filter(
          (item) =>
            item.quantity > 0,
        );

      const { data, error } =
        await supabase.rpc(
          "receive_purchase_order",
          {
            p_company_id: companyId,
            p_purchase_order_id:
              selectedPurchaseOrder.id,
            p_warehouse_id:
              selectedWarehouseId,
            p_location_id:
              selectedLocationId,
            p_items: items,
            p_notes:
              notes.trim() || null,
          },
        );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        data
          ? `Receipt ${data} was completed successfully.`
          : "Receipt was completed successfully.",
      );

      setNotes("");

      await loadData(true);
    } catch (error) {
      console.error(
        "Purchase order receiving error:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to complete the receipt.",
      );
    } finally {
      setReceiving(false);
    }
  }

  function getSupplierName(
    purchaseOrder: PurchaseOrder,
  ): string {
    if (!purchaseOrder.supplier_id) {
      return "No supplier";
    }

    const supplier =
      suppliers[purchaseOrder.supplier_id];

    return (
      supplier?.display_name ||
      supplier?.legal_name ||
      "Unknown supplier"
    );
  }

  function getRemainingQuantity(
    item: PurchaseOrderItem,
  ): number {
    return Math.max(
      toNumber(item.quantity) -
        toNumber(item.received_quantity),
      0,
    );
  }

  if (loading) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="loading-state">
            <strong>
              Loading Inventory Receiving
            </strong>

            <span>
              Preparing purchase orders and receiving data...
            </span>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .loading-state {
              min-height: 360px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 7px;
              text-align: center;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              background: #ffffff;
              box-shadow:
                0 2px 8px
                  rgba(15, 23, 42, 0.04);
            }

            .loading-state strong {
              color: #111827;
              font-size: 15px;
            }

            .loading-state span {
              color: #6b7280;
              font-size: 13px;
            }
          `}</style>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="page-content receiving-page">
        <div className="page-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Products & Inventory
            </div>

            <h1>Inventory Receiving</h1>

            <p className="page-description">
              Receive stock from purchase orders into a
              warehouse and location.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void loadData(true)
              }
              disabled={
                refreshing ||
                receiving
              }
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                router.push(
                  "/purchase-orders",
                )
              }
              disabled={receiving}
            >
              Purchase Orders
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="alert error">
            <strong>
              Receiving error
            </strong>

            <span>
              {errorMessage}
            </span>
          </div>
        )}

        {successMessage && (
          <div className="alert success">
            <strong>
              Receipt completed
            </strong>

            <span>
              {successMessage}
            </span>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Open Purchase Orders
            </div>

            <div className="stat-value">
              {purchaseOrders.length}
            </div>

            <div className="stat-meta">
              Orders with stock remaining
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Outstanding Units
            </div>

            <div className="stat-value">
              {formatNumber(
                totalOutstanding,
              )}
            </div>

            <div className="stat-meta">
              Remaining to receive
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Selected PO
            </div>

            <div className="stat-value">
              {selectedPurchaseOrder
                ? selectedPurchaseOrder.po_number
                : "—"}
            </div>

            <div className="stat-meta">
              Current receiving order
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Selected Lines
            </div>

            <div className="stat-value">
              {outstandingLines}
            </div>

            <div className="stat-meta">
              Lines with stock remaining
            </div>
          </div>
        </div>

        <div className="workspace">
          <aside className="orders-panel">
            <div className="panel-header">
              <div>
                <h2>
                  Purchase Orders
                </h2>

                <p>
                  Open and partially received
                  orders
                </p>
              </div>

              <span className="count-badge">
                {
                  filteredPurchaseOrders.length
                }
              </span>
            </div>

            <div className="search-box">
              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search PO or supplier..."
              />
            </div>

            <div className="order-list">
              {filteredPurchaseOrders.length ===
              0 ? (
                <div className="empty-orders">
                  <div className="empty-icon">
                    ✓
                  </div>

                  <strong>
                    Nothing to receive
                  </strong>

                  <span>
                    There are no purchase orders
                    with outstanding quantities.
                  </span>
                </div>
              ) : (
                filteredPurchaseOrders.map(
                  (purchaseOrder) => {
                    const items =
                      purchaseOrderItems[
                        purchaseOrder.id
                      ] || [];

                    const remaining =
                      items.reduce(
                        (sum, item) =>
                          sum +
                          getRemainingQuantity(
                            item,
                          ),
                        0,
                      );

                    const received =
                      items.reduce(
                        (sum, item) =>
                          sum +
                          toNumber(
                            item.received_quantity,
                          ),
                        0,
                      );

                    const ordered =
                      items.reduce(
                        (sum, item) =>
                          sum +
                          toNumber(
                            item.quantity,
                          ),
                        0,
                      );

                    const isSelected =
                      purchaseOrder.id ===
                      selectedPurchaseOrderId;

                    const isPartial =
                      received > 0 &&
                      remaining > 0;

                    return (
                      <button
                        type="button"
                        key={
                          purchaseOrder.id
                        }
                        className={`order-card ${
                          isSelected
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          selectPurchaseOrder(
                            purchaseOrder.id,
                          )
                        }
                      >
                        <div className="order-card-top">
                          <strong>
                            {
                              purchaseOrder.po_number
                            }
                          </strong>

                          <span
                            className={`status-badge ${
                              isPartial
                                ? "partial"
                                : "open"
                            }`}
                          >
                            {isPartial
                              ? "Partially Received"
                              : "Open"}
                          </span>
                        </div>

                        <div className="order-supplier">
                          {
                            getSupplierName(
                              purchaseOrder,
                            )
                          }
                        </div>

                        <div className="order-meta">
                          <span>
                            {formatDate(
                              purchaseOrder.order_date,
                            )}
                          </span>

                          <span>
                            {
                              formatNumber(
                                ordered,
                              )
                            }{" "}
                            ordered
                          </span>
                        </div>

                        <div className="order-progress">
                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${
                                  ordered > 0
                                    ? Math.min(
                                        100,
                                        (received /
                                          ordered) *
                                          100,
                                      )
                                    : 0
                                }%`,
                              }}
                            />
                          </div>

                          <div className="progress-label">
                            <span>
                              {
                                formatNumber(
                                  received,
                                )
                              }{" "}
                              received
                            </span>

                            <strong>
                              {
                                formatNumber(
                                  remaining,
                                )
                              }{" "}
                              remaining
                            </strong>
                          </div>
                        </div>
                      </button>
                    );
                  },
                )
              )}
            </div>
          </aside>

          <section className="receiving-panel">
            {!selectedPurchaseOrder ? (
              <div className="selection-empty">
                <div className="selection-empty-icon">
                  PO
                </div>

                <h2>
                  Select a purchase order
                </h2>

                <p>
                  Choose an open or partially
                  received purchase order to
                  continue receiving stock.
                </p>
              </div>
            ) : (
              <>
                <div className="receiving-header">
                  <div>
                    <div className="receiving-title-row">
                      <h2>
                        {
                          selectedPurchaseOrder.po_number
                        }
                      </h2>

                      <span className="status-badge partial">
                        {selectedPurchaseOrder.status ===
                        "partially_received"
                          ? "Partially Received"
                          : selectedRemainingUnits <
                              selectedItems.reduce(
                                (sum, item) =>
                                  sum +
                                  toNumber(
                                    item.quantity,
                                  ),
                                0,
                              )
                            ? "Partially Received"
                            : "Open"}
                      </span>
                    </div>

                    <p>
                      {selectedSupplier
                        ? selectedSupplier.display_name ||
                          selectedSupplier.legal_name ||
                          "Supplier"
                        : "No supplier"}
                    </p>
                  </div>

                  <div className="header-summary">
                    <span>
                      Remaining
                    </span>

                    <strong>
                      {
                        formatNumber(
                          selectedRemainingUnits,
                        )
                      }
                    </strong>
                  </div>
                </div>

                <div className="receiving-card">
                  <div className="card-header">
                    <div>
                      <h3>
                        Receiving Location
                      </h3>

                      <p>
                        Choose where the received
                        stock will be stored.
                      </p>
                    </div>
                  </div>

                  <div className="field-grid">
                    <label className="field">
                      <span>
                        Warehouse
                      </span>

                      <select
                        value={
                          selectedWarehouseId
                        }
                        onChange={(event) => {
                          const warehouseId =
                            event.target.value;

                          setSelectedWarehouseId(
                            warehouseId,
                          );

                          const firstLocation =
                            locations.find(
                              (location) =>
                                location.warehouse_id ===
                                  warehouseId &&
                                location.is_active,
                            );

                          setSelectedLocationId(
                            firstLocation?.id ||
                              "",
                          );
                        }}
                        disabled={receiving}
                      >
                        <option value="">
                          Select warehouse
                        </option>

                        {warehouses.map(
                          (warehouse) => (
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
                          ),
                        )}
                      </select>
                    </label>

                    <label className="field">
                      <span>
                        Location
                      </span>

                      <select
                        value={
                          selectedLocationId
                        }
                        onChange={(event) =>
                          setSelectedLocationId(
                            event.target.value,
                          )
                        }
                        disabled={
                          receiving ||
                          !selectedWarehouseId
                        }
                      >
                        <option value="">
                          {selectedWarehouse
                            ? "Select location"
                            : "Select warehouse first"}
                        </option>

                        {availableLocations.map(
                          (location) => (
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
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="receiving-card">
                  <div className="card-header">
                    <div>
                      <h3>
                        Purchase Order Items
                      </h3>

                      <p>
                        Enter the quantities being
                        received now.
                      </p>
                    </div>

                    <span className="section-count">
                      {
                        selectedItems.length
                      }{" "}
                      items
                    </span>
                  </div>

                  <div className="items-table-wrap">
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th>
                            Product
                          </th>

                          <th>
                            Tracking
                          </th>

                          <th className="numeric">
                            Ordered
                          </th>

                          <th className="numeric">
                            Received
                          </th>

                          <th className="numeric">
                            Remaining
                          </th>

                          <th className="receive-column">
                            Receive Now
                          </th>

                          <th>
                            Batch / Lot
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedItems.map(
                          (item) => {
                            const remaining =
                              getRemainingQuantity(
                                item,
                              );

                            const product =
                              item.product_id
                                ? products[
                                    item.product_id
                                  ]
                                : null;

                            const variant =
                              item.variant_id
                                ? variants[
                                    item.variant_id
                                  ]
                                : null;

                            const trackingMode =
                              product?.tracking_mode ||
                              "none";

                            const line =
                              receivingLines[
                                item.id
                              ] || {
                                quantity: 0,
                                lot_number: "",
                                serial_numbers:
                                  [],
                              };

                            const isComplete =
                              remaining <= 0;

                            return (
                              <tr
                                key={
                                  item.id
                                }
                                className={
                                  isComplete
                                    ? "completed-line"
                                    : ""
                                }
                              >
                                <td>
                                  <div className="product-cell">
                                    <strong>
                                      {
                                        item.product_name
                                      }
                                    </strong>

                                    {(item.variant_name ||
                                      variant?.name) && (
                                      <span>
                                        {
                                          item.variant_name ||
                                          variant?.name
                                        }
                                      </span>
                                    )}

                                    {(item.sku ||
                                      variant?.sku) && (
                                      <small>
                                        SKU:{" "}
                                        {
                                          item.sku ||
                                          variant?.sku
                                        }
                                      </small>
                                    )}
                                  </div>
                                </td>

                                <td>
                                  <span className="tracking-badge">
                                    {getTrackingLabel(
                                      trackingMode,
                                    )}
                                  </span>
                                </td>

                                <td className="numeric">
                                  {
                                    formatNumber(
                                      toNumber(
                                        item.quantity,
                                      ),
                                    )
                                  }
                                </td>

                                <td className="numeric">
                                  {
                                    formatNumber(
                                      toNumber(
                                        item.received_quantity,
                                      ),
                                    )
                                  }
                                </td>

                                <td className="numeric">
                                  <strong
                                    className={
                                      remaining >
                                      0
                                        ? "remaining-number"
                                        : "complete-number"
                                    }
                                  >
                                    {
                                      formatNumber(
                                        remaining,
                                      )
                                    }
                                  </strong>
                                </td>

                                <td className="receive-column">
                                  {isComplete ? (
                                    <span className="received-label">
                                      Fully received
                                    </span>
                                  ) : (
                                    <input
                                      className="quantity-input"
                                      type="number"
                                      min="0"
                                      max={remaining}
                                      step="1"
                                      value={
                                        line.quantity ||
                                        ""
                                      }
                                      disabled={
                                        receiving
                                      }
                                      onChange={(
                                        event,
                                      ) => {
                                        const quantity =
                                          Number(
                                            event
                                              .target
                                              .value,
                                          );

                                        if (
                                          trackingMode ===
                                          "serial"
                                        ) {
                                          updateReceiveQuantityAndSerials(
                                            item.id,
                                            quantity,
                                          );
                                        } else {
                                          updateReceiveQuantity(
                                            item.id,
                                            quantity,
                                          );
                                        }
                                      }}
                                    />
                                  )}
                                </td>

                                <td>
                                  <input
                                    className="lot-input"
                                    type="text"
                                    value={
                                      line.lot_number
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateLotNumber(
                                        item.id,
                                        event
                                          .target
                                          .value,
                                      )
                                    }
                                    placeholder={
                                      trackingMode ===
                                      "serial"
                                        ? "Optional lot"
                                        : "Enter lot"
                                    }
                                    disabled={
                                      receiving ||
                                      isComplete
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>

                  {hasSerialItems && (
                    <div className="serial-section">
                      <div className="serial-header">
                        <div>
                          <h4>
                            Manufacturer Serial Numbers
                          </h4>

                          <p>
                            Enter actual manufacturer
                            serial numbers only. SBS
                            will never generate fake
                            serial numbers.
                          </p>
                        </div>
                      </div>

                      {selectedItems
                        .filter(
                          (item) =>
                            item.product_id &&
                            products[
                              item.product_id
                            ]?.tracking_mode ===
                              "serial",
                        )
                        .map((item) => {
                          const remaining =
                            getRemainingQuantity(
                              item,
                            );

                          const line =
                            receivingLines[
                              item.id
                            ] || {
                              quantity: 0,
                              lot_number: "",
                              serial_numbers:
                                [],
                            };

                          const receiveQty =
                            Number(
                              line.quantity || 0,
                            );

                          const serials =
                            line.serial_numbers ||
                            [];

                          if (
                            remaining <=
                            0
                          ) {
                            return null;
                          }

                          return (
                            <div
                              key={
                                item.id
                              }
                              className="serial-item"
                            >
                              <div className="serial-item-heading">
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

                                <span
                                  className={
                                    receiveQty >
                                      0 &&
                                    serials.filter(
                                      (
                                        serial,
                                      ) =>
                                        serial.trim(),
                                    ).length ===
                                      receiveQty
                                      ? "serial-count complete"
                                      : "serial-count"
                                  }
                                >
                                  {
                                    serials.filter(
                                      (
                                        serial,
                                      ) =>
                                        serial.trim(),
                                    ).length
                                  }{" "}
                                  /{" "}
                                  {receiveQty}
                                </span>
                              </div>

                              {receiveQty <=
                              0 ? (
                                <div className="serial-help">
                                  Enter a receiving
                                  quantity above to
                                  enter serial numbers.
                                </div>
                              ) : (
                                <div className="serial-grid">
                                  {Array.from({
                                    length:
                                      receiveQty,
                                  }).map(
                                    (
                                      _,
                                      index,
                                    ) => (
                                      <div
                                        className="serial-input-row"
                                        key={`${item.id}-${index}`}
                                      >
                                        <span>
                                          {index +
                                            1}
                                        </span>

                                        <input
                                          type="text"
                                          value={
                                            serials[
                                              index
                                            ] ||
                                            ""
                                          }
                                          onChange={(
                                            event,
                                          ) =>
                                            updateSerial(
                                              item.id,
                                              index,
                                              event
                                                .target
                                                .value,
                                            )
                                          }
                                          placeholder={`Manufacturer serial ${index + 1}`}
                                          disabled={
                                            receiving
                                          }
                                        />
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}

                  <div className="receipt-notes">
                    <label className="field">
                      <span>
                        Receiving Notes
                      </span>

                      <textarea
                        value={notes}
                        onChange={(event) =>
                          setNotes(
                            event.target.value,
                          )
                        }
                        placeholder="Add notes about the receipt, shipment, condition, or supplier delivery..."
                        rows={4}
                        disabled={receiving}
                      />
                    </label>
                  </div>

                  <div className="receipt-footer">
                    <div className="footer-summary">
                      <span>
                        Receiving into
                      </span>

                      <strong>
                        {selectedWarehouse
                          ? `${selectedWarehouse.name}${
                              selectedLocationId
                                ? ` / ${
                                    locations.find(
                                      (location) =>
                                        location.id ===
                                        selectedLocationId,
                                    )?.name || ""
                                  }`
                                : ""
                            }`
                          : "Select warehouse and location"}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        void completeReceipt()
                      }
                      disabled={
                        receiving ||
                        selectedRemainingUnits <=
                          0
                      }
                    >
                      {receiving
                        ? "Completing Receipt..."
                        : "Complete Receipt"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .receiving-page {
          min-width: 0;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 7px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #166534;
          box-shadow:
            0 0 0 4px
              #dcfce7;
        }

        h1 {
          margin: 0;
          color: #0f172a;
          font-size: 30px;
          line-height: 1.15;
          font-weight: 750;
          letter-spacing: -0.03em;
        }

        .page-description {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .secondary-button,
        .primary-button {
          min-height: 40px;
          padding: 0 15px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .secondary-button {
          border: 1px solid #dbe2ea;
          background: #ffffff;
          color: #334155;
        }

        .secondary-button:hover:not(
            :disabled
          ) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .primary-button {
          border: 1px solid #166534;
          background: #166534;
          color: #ffffff;
        }

        .primary-button:hover:not(
            :disabled
          ) {
          background: #14532d;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .alert {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-bottom: 18px;
          padding: 13px 15px;
          border-radius: 10px;
          font-size: 13px;
        }

        .alert strong {
          font-size: 13px;
        }

        .alert span {
          line-height: 1.5;
        }

        .alert.error {
          border: 1px solid #fecaca;
          background: #fff7f7;
          color: #991b1b;
        }

        .alert.success {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 14px;
          margin-bottom: 20px;
        }

        .stat-card {
          padding: 17px 18px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 2px 8px
              rgba(
                15,
                23,
                42,
                0.035
              );
        }

        .stat-label {
          margin-bottom: 7px;
          color: #64748b;
          font-size: 12px;
          font-weight: 650;
        }

        .stat-value {
          color: #0f172a;
          font-size: 23px;
          line-height: 1.1;
          font-weight: 750;
        }

        .stat-meta {
          margin-top: 6px;
          color: #94a3b8;
          font-size: 12px;
        }

        .workspace {
          display: grid;
          grid-template-columns:
            minmax(290px, 330px)
            minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .orders-panel,
        .receiving-panel {
          min-width: 0;
        }

        .orders-panel {
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 2px 8px
              rgba(
                15,
                23,
                42,
                0.035
              );
        }

        .panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 18px;
          border-bottom: 1px solid #eef2f7;
        }

        .panel-header h2,
        .receiving-card h3 {
          margin: 0;
          color: #111827;
          font-size: 15px;
          font-weight: 750;
        }

        .panel-header p,
        .receiving-card .card-header p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.45;
        }

        .count-badge,
        .section-count {
          min-width: 28px;
          height: 26px;
          padding: 0 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #f1f5f9;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        .search-box {
          padding: 14px;
          border-bottom: 1px solid #eef2f7;
        }

        .search-box input {
          width: 100%;
          height: 40px;
          box-sizing: border-box;
          padding: 0 12px;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
          background: #ffffff;
          color: #111827;
          font: inherit;
          font-size: 13px;
          outline: none;
        }

        .search-box input:focus,
        .field input:focus,
        .field select:focus,
        .field textarea:focus,
        .quantity-input:focus,
        .lot-input:focus,
        .serial-input-row input:focus {
          border-color: #94a3b8;
          box-shadow:
            0 0 0 3px
              rgba(
                148,
                163,
                184,
                0.12
              );
          outline: none;
        }

        .order-list {
          max-height: 760px;
          overflow-y: auto;
        }

        .order-card {
          width: 100%;
          display: block;
          padding: 16px;
          border: 0;
          border-bottom: 1px solid #f1f5f9;
          background: #ffffff;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .order-card:hover {
          background: #f8fafc;
        }

        .order-card.selected {
          background: #f0fdf4;
          box-shadow:
            inset 3px 0 0
              #166534;
        }

        .order-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .order-card-top strong {
          color: #111827;
          font-size: 14px;
        }

        .status-badge {
          min-height: 24px;
          padding: 0 8px;
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 750;
          white-space: nowrap;
        }

        .status-badge.open {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status-badge.partial {
          background: #fff7ed;
          color: #c2410c;
        }

        .order-supplier {
          margin-top: 7px;
          color: #475569;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .order-meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 7px;
          color: #94a3b8;
          font-size: 11px;
        }

        .order-progress {
          margin-top: 12px;
        }

        .progress-track {
          width: 100%;
          height: 5px;
          overflow: hidden;
          border-radius: 999px;
          background: #e2e8f0;
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: #166534;
          transition: width 0.2s ease;
        }

        .progress-label {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-top: 6px;
          color: #94a3b8;
          font-size: 10px;
        }

        .progress-label strong {
          color: #166534;
          font-weight: 700;
        }

        .empty-orders {
          min-height: 300px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 25px;
          text-align: center;
        }

        .empty-icon,
        .selection-empty-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #f1f5f9;
          color: #475569;
          font-size: 13px;
          font-weight: 800;
        }

        .empty-orders strong {
          color: #111827;
          font-size: 14px;
        }

        .empty-orders span {
          max-width: 220px;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.5;
        }

        .selection-empty {
          min-height: 560px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 2px 8px
              rgba(
                15,
                23,
                42,
                0.035
              );
          text-align: center;
        }

        .selection-empty h2 {
          margin: 16px 0 7px;
          color: #111827;
          font-size: 17px;
        }

        .selection-empty p {
          max-width: 430px;
          margin: 0;
          color: #94a3b8;
          font-size: 13px;
          line-height: 1.6;
        }

        .receiving-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
          padding: 20px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 2px 8px
              rgba(
                15,
                23,
                42,
                0.035
              );
        }

        .receiving-title-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .receiving-header h2 {
          margin: 0;
          color: #111827;
          font-size: 20px;
        }

        .receiving-header p {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .header-summary {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .header-summary span {
          color: #94a3b8;
          font-size: 11px;
        }

        .header-summary strong {
          margin-top: 4px;
          color: #166534;
          font-size: 22px;
        }

        .receiving-card {
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 2px 8px
              rgba(
                15,
                23,
                42,
                0.035
              );
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 18px;
          border-bottom: 1px solid #eef2f7;
        }

        .field-grid {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 14px;
          padding: 18px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field > span {
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        .field input,
        .field select,
        .field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
          background: #ffffff;
          color: #111827;
          font: inherit;
          font-size: 13px;
        }

        .field input,
        .field select {
          height: 40px;
          padding: 0 11px;
        }

        .field textarea {
          padding: 11px;
          resize: vertical;
          line-height: 1.5;
        }

        .items-table-wrap {
          overflow-x: auto;
        }

        .items-table {
          width: 100%;
          min-width: 1020px;
          border-collapse: collapse;
        }

        .items-table th {
          padding: 11px 12px;
          border-bottom: 1px solid #e5e7eb;
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          font-weight: 750;
          text-align: left;
          white-space: nowrap;
        }

        .items-table th.numeric,
        .items-table td.numeric {
          text-align: right;
        }

        .items-table td {
          padding: 13px 12px;
          border-bottom: 1px solid #eef2f7;
          color: #475569;
          font-size: 12px;
          vertical-align: middle;
        }

        .items-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .items-table tr.completed-line {
          background: #f8fafc;
        }

        .product-cell {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 240px;
        }

        .product-cell strong {
          color: #111827;
          font-size: 12px;
        }

        .product-cell span {
          color: #64748b;
          font-size: 11px;
        }

        .product-cell small {
          color: #94a3b8;
          font-size: 10px;
        }

        .tracking-badge {
          min-height: 24px;
          padding: 0 8px;
          display: inline-flex;
          align-items: center;
          border-radius: 7px;
          background: #f1f5f9;
          color: #475569;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .remaining-number {
          color: #b45309;
        }

        .complete-number {
          color: #166534;
        }

        .receive-column {
          width: 125px;
        }

        .quantity-input,
        .lot-input {
          width: 100%;
          height: 36px;
          box-sizing: border-box;
          border: 1px solid #dfe4eb;
          border-radius: 8px;
          background: #ffffff;
          color: #111827;
          font: inherit;
          font-size: 12px;
          outline: none;
        }

        .quantity-input {
          padding: 0 9px;
          text-align: right;
        }

        .lot-input {
          min-width: 145px;
          padding: 0 9px;
        }

        .received-label {
          color: #166534;
          font-size: 11px;
          font-weight: 700;
        }

        .serial-section {
          margin: 18px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #fbfcfd;
        }

        .serial-header {
          padding: 15px 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .serial-header h4 {
          margin: 0;
          color: #111827;
          font-size: 13px;
        }

        .serial-header p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.5;
        }

        .serial-item {
          padding: 15px 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .serial-item:last-child {
          border-bottom: 0;
        }

        .serial-item-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 11px;
        }

        .serial-item-heading strong {
          display: block;
          color: #111827;
          font-size: 12px;
        }

        .serial-item-heading span {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 10px;
        }

        .serial-count {
          min-height: 24px;
          padding: 0 9px;
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 10px;
          font-weight: 750;
        }

        .serial-count.complete {
          background: #dcfce7;
          color: #166534;
        }

        .serial-help {
          padding: 11px;
          border-radius: 8px;
          background: #ffffff;
          color: #94a3b8;
          font-size: 11px;
        }

        .serial-grid {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 10px;
        }

        .serial-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .serial-input-row > span {
          width: 22px;
          flex: 0 0 22px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 700;
          text-align: center;
        }

        .serial-input-row input {
          width: 100%;
          height: 38px;
          box-sizing: border-box;
          padding: 0 10px;
          border: 1px solid #dfe4eb;
          border-radius: 8px;
          background: #ffffff;
          color: #111827;
          font: inherit;
          font-size: 12px;
          outline: none;
        }

        .receipt-notes {
          padding: 0 18px 18px;
        }

        .receipt-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 17px 18px;
          border-top: 1px solid #eef2f7;
          background: #fcfcfd;
        }

        .footer-summary {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .footer-summary span {
          color: #94a3b8;
          font-size: 11px;
        }

        .footer-summary strong {
          color: #334155;
          font-size: 12px;
        }

        @media (max-width: 1250px) {
          .workspace {
            grid-template-columns:
              minmax(260px, 300px)
              minmax(0, 1fr);
          }

          .stats-grid {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }
        }

        @media (max-width: 900px) {
          .page-content {
            padding: 20px;
          }

          .page-header,
          .receiving-header,
          .receipt-footer {
            flex-direction: column;
            align-items: stretch;
          }

          .header-summary {
            align-items: flex-start;
          }

          .workspace {
            grid-template-columns: 1fr;
          }

          .order-list {
            max-height: 380px;
          }
        }

        @media (max-width: 640px) {
          .stats-grid,
          .field-grid,
          .serial-grid {
            grid-template-columns: 1fr;
          }

          .header-actions {
            width: 100%;
          }

          .secondary-button,
          .primary-button {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}