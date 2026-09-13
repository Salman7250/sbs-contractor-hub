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
  received_at: string | null;
  quantity_received: number;
  unit_cost: number | null;
  total_cost: number | null;
  status: string | null;
};

type BatchStock = {
  id: string;
  batch_id: string;
  product_id: string;
  variant_id: string | null;
  warehouse_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
};

type SerializedUnit = {
  id: string;
  product_id: string;
  variant_id: string | null;
  serial_number: string;
  barcode: string | null;
  status: string;
  warehouse_id: string | null;
  location_id: string | null;
  batch_id: string | null;
  cost_price: number;
};

type TransferItem = {
  id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  batch_id: string;
  serial_unit_ids: string[];
  notes: string;
};

function formatMoney(value: number | null | undefined) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
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

function trackingLabel(mode: string | null | undefined) {
  switch (mode) {
    case "none":
      return "Not Tracked";
    case "quantity":
      return "Quantity";
    case "batch":
      return "Batch / Lot";
    case "serial":
      return "Serial";
    default:
      return "Unknown";
  }
}

function trackingClass(mode: string | null | undefined) {
  switch (mode) {
    case "serial":
      return "tracking serial";
    case "batch":
      return "tracking batch";
    case "quantity":
      return "tracking quantity";
    case "none":
      return "tracking none";
    default:
      return "tracking";
  }
}

export default function NewTransferPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [companyId, setCompanyId] = useState<string | null>(
    null,
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(
    [],
  );
  const [locations, setLocations] = useState<Location[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchStock, setBatchStock] = useState<BatchStock[]>(
    [],
  );
  const [serializedUnits, setSerializedUnits] = useState<
    SerializedUnit[]
  >([]);

  const [sourceWarehouseId, setSourceWarehouseId] =
    useState("");
  const [sourceLocationId, setSourceLocationId] =
    useState("");

  const [destinationWarehouseId, setDestinationWarehouseId] =
    useState("");
  const [destinationLocationId, setDestinationLocationId] =
    useState("");

  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<TransferItem[]>([]);

  const [selectedProductId, setSelectedProductId] =
    useState("");
  const [selectedVariantId, setSelectedVariantId] =
    useState("");
  const [selectedBatchId, setSelectedBatchId] =
    useState("");

  const [quantity, setQuantity] = useState("1");

  const [itemNotes, setItemNotes] = useState("");

  const [selectedSerialIds, setSelectedSerialIds] =
    useState<string[]>([]);

  const sourceLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          location.warehouse_id === sourceWarehouseId,
      ),
    [locations, sourceWarehouseId],
  );

  const destinationLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          location.warehouse_id === destinationWarehouseId,
      ),
    [locations, destinationWarehouseId],
  );

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) => product.id === selectedProductId,
      ) ?? null,
    [products, selectedProductId],
  );

  const selectedVariant = useMemo(
    () =>
      variants.find(
        (variant) => variant.id === selectedVariantId,
      ) ?? null,
    [variants, selectedVariantId],
  );

  const productVariants = useMemo(
    () =>
      variants.filter(
        (variant) =>
          variant.product_id === selectedProductId &&
          variant.is_active !== false,
      ),
    [variants, selectedProductId],
  );

  const productBatches = useMemo(
    () =>
      batches.filter(
        (batch) =>
          batch.product_id === selectedProductId &&
          batch.variant_id === selectedVariantId &&
          batch.status !== "cancelled" &&
          batch.status !== "closed",
      ),
    [batches, selectedProductId, selectedVariantId],
  );

  const selectedBatch = useMemo(
    () =>
      productBatches.find(
        (batch) => batch.id === selectedBatchId,
      ) ?? null,
    [productBatches, selectedBatchId],
  );

  const selectedBatchStock = useMemo(() => {
    if (
      !selectedBatchId ||
      !sourceWarehouseId ||
      !sourceLocationId
    ) {
      return null;
    }

    return (
      batchStock.find(
        (stock) =>
          stock.batch_id === selectedBatchId &&
          stock.warehouse_id === sourceWarehouseId &&
          stock.location_id === sourceLocationId,
      ) ?? null
    );
  }, [
    batchStock,
    selectedBatchId,
    sourceWarehouseId,
    sourceLocationId,
  ]);

  const availableBatchQuantity = useMemo(() => {
    if (!selectedBatchStock) return 0;

    return Math.max(
      0,
      selectedBatchStock.quantity -
        selectedBatchStock.reserved_quantity,
    );
  }, [selectedBatchStock]);

  /*
   * IMPORTANT:
   *
   * These are ONLY the real serialized units that exist.
   *
   * A batch may contain:
   *   100 total units
   *   0 serialized units
   *   25 serialized units
   *   100 serialized units
   *
   * The transfer workflow does not require this list to exist.
   */
  const availableSerials = useMemo(() => {
    return serializedUnits.filter((unit) => {
      if (!selectedProductId) return false;
      if (!selectedVariantId) return false;

      if (unit.product_id !== selectedProductId) {
        return false;
      }

      if (unit.variant_id !== selectedVariantId) {
        return false;
      }

      if (unit.status !== "available") {
        return false;
      }

      if (unit.warehouse_id !== sourceWarehouseId) {
        return false;
      }

      if (unit.location_id !== sourceLocationId) {
        return false;
      }

      if (selectedBatchId) {
        if (unit.batch_id !== selectedBatchId) {
          return false;
        }
      }

      return true;
    });
  }, [
    serializedUnits,
    selectedProductId,
    selectedVariantId,
    sourceWarehouseId,
    sourceLocationId,
    selectedBatchId,
  ]);

  const selectedSerialUnits = useMemo(
    () =>
      availableSerials.filter((unit) =>
        selectedSerialIds.includes(unit.id),
      ),
    [availableSerials, selectedSerialIds],
  );

  const selectedSerialCount = selectedSerialIds.length;

  const totalUnits = useMemo(
    () =>
      items.reduce(
        (total, item) =>
          total + Number(item.quantity || 0),
        0,
      ),
    [items],
  );

  const totalSerialAssets = useMemo(
    () =>
      items.reduce(
        (total, item) =>
          total + item.serial_unit_ids.length,
        0,
      ),
    [items],
  );

  const sourceWarehouse = useMemo(
    () =>
      warehouses.find(
        (warehouse) =>
          warehouse.id === sourceWarehouseId,
      ) ?? null,
    [warehouses, sourceWarehouseId],
  );

  const destinationWarehouse = useMemo(
    () =>
      warehouses.find(
        (warehouse) =>
          warehouse.id === destinationWarehouseId,
      ) ?? null,
    [warehouses, destinationWarehouseId],
  );

  const sourceLocation = useMemo(
    () =>
      locations.find(
        (location) => location.id === sourceLocationId,
      ) ?? null,
    [locations, sourceLocationId],
  );

  const destinationLocation = useMemo(
    () =>
      locations.find(
        (location) =>
          location.id === destinationLocationId,
      ) ?? null,
    [locations, destinationLocationId],
  );

  const getProduct = useCallback(
    (productId: string) =>
      products.find(
        (product) => product.id === productId,
      ) ?? null,
    [products],
  );

  const getVariant = useCallback(
    (variantId: string) =>
      variants.find(
        (variant) => variant.id === variantId,
      ) ?? null,
    [variants],
  );

  const getBatch = useCallback(
    (batchId: string | null) =>
      batches.find(
        (batch) => batch.id === batchId,
      ) ?? null,
    [batches],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membership, error: membershipError } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        throw new Error(membershipError.message);
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
        productsResult,
        variantsResult,
        warehousesResult,
        locationsResult,
        batchesResult,
        batchStockResult,
        serializedResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id,name,brand,category,tracking_mode,status",
          )
          .eq("company_id", currentCompanyId)
          .order("name"),

        supabase
          .from("product_variants")
          .select(
            "id,product_id,name,sku,is_active",
          )
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("warehouses")
          .select("id,name,code")
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("warehouse_locations")
          .select(
            "id,warehouse_id,name,code",
          )
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("inventory_batches")
          .select(
            "id,product_id,variant_id,lot_number,received_at,quantity_received,unit_cost,total_cost,status",
          )
          .eq("company_id", currentCompanyId)
          .neq("status", "cancelled")
          .order("received_at", {
            ascending: false,
          }),

        supabase
          .from("inventory_batch_stock")
          .select(
            "id,batch_id,product_id,variant_id,warehouse_id,location_id,quantity,reserved_quantity",
          )
          .eq("company_id", currentCompanyId),

        supabase
          .from("serialized_units")
          .select(
            "id,product_id,variant_id,serial_number,barcode,status,warehouse_id,location_id,batch_id,cost_price",
          )
          .eq("company_id", currentCompanyId)
          .eq("status", "available"),
      ]);

      if (productsResult.error) {
        throw new Error(productsResult.error.message);
      }

      if (variantsResult.error) {
        throw new Error(variantsResult.error.message);
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

      if (batchesResult.error) {
        throw new Error(
          batchesResult.error.message,
        );
      }

      if (batchStockResult.error) {
        throw new Error(
          batchStockResult.error.message,
        );
      }

      if (serializedResult.error) {
        throw new Error(
          serializedResult.error.message,
        );
      }

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

      setBatchStock(
        (batchStockResult.data ?? []) as BatchStock[],
      );

      setSerializedUnits(
        (serializedResult.data ??
          []) as unknown as SerializedUnit[],
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load transfer data.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setSourceLocationId("");
  }, [sourceWarehouseId]);

  useEffect(() => {
    setDestinationLocationId("");
  }, [destinationWarehouseId]);

  useEffect(() => {
    setSelectedVariantId("");
    setSelectedBatchId("");
    setSelectedSerialIds([]);
  }, [selectedProductId]);

  useEffect(() => {
    setSelectedBatchId("");
    setSelectedSerialIds([]);
  }, [selectedVariantId]);

  useEffect(() => {
    setSelectedSerialIds([]);
  }, [selectedBatchId]);

  const resetItemForm = () => {
    setSelectedProductId("");
    setSelectedVariantId("");
    setSelectedBatchId("");
    setQuantity("1");
    setItemNotes("");
    setSelectedSerialIds([]);
  };

  const addItem = () => {
    setErrorMessage("");

    if (!selectedProduct) {
      setErrorMessage("Select a product.");
      return;
    }

    if (!selectedVariantId) {
      setErrorMessage("Select a variant.");
      return;
    }

    if (
      items.some(
        (item) =>
          item.variant_id === selectedVariantId,
      )
    ) {
      setErrorMessage(
        "This variant is already on the transfer.",
      );
      return;
    }

    const parsedQuantity = Number(quantity);

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity <= 0
    ) {
      setErrorMessage(
        "Quantity must be a positive whole number.",
      );
      return;
    }

    /*
     * Batch is the physical inventory provenance layer.
     *
     * Every inventory transfer therefore identifies the
     * exact batch that is moving.
     */
    if (!selectedBatchId) {
      setErrorMessage(
        "Select the batch / lot that will be transferred.",
      );
      return;
    }

    if (!selectedBatchStock) {
      setErrorMessage(
        "The selected batch has no stock at the source location.",
      );
      return;
    }

    if (parsedQuantity > availableBatchQuantity) {
      setErrorMessage(
        `Only ${availableBatchQuantity} available units remain in this batch at the selected source location.`,
      );
      return;
    }

    /*
     * SERIAL NUMBERS ARE OPTIONAL.
     *
     * Zero is valid.
     * Some are valid.
     * All are valid.
     */
    if (
      selectedSerialCount > parsedQuantity
    ) {
      setErrorMessage(
        "The number of selected serial assets cannot exceed the transfer quantity.",
      );
      return;
    }

    if (
      selectedSerialCount > 0 &&
      selectedSerialCount !==
        selectedSerialUnits.length
    ) {
      setErrorMessage(
        "One or more selected serial assets are no longer available.",
      );
      return;
    }

    const newItem: TransferItem = {
      id: crypto.randomUUID(),
      product_id: selectedProduct.id,
      variant_id: selectedVariantId,
      quantity: parsedQuantity,
      batch_id: selectedBatchId,
      serial_unit_ids: [...selectedSerialIds],
      notes: itemNotes.trim(),
    };

    setItems((current) => [
      ...current,
      newItem,
    ]);

    resetItemForm();
  };

  const removeItem = (itemId: string) => {
    setItems((current) =>
      current.filter(
        (item) => item.id !== itemId,
      ),
    );
  };

  const toggleSerial = (serialId: string) => {
    setSelectedSerialIds((current) => {
      if (current.includes(serialId)) {
        return current.filter(
          (id) => id !== serialId,
        );
      }

      const parsedQuantity = Number(quantity);

      if (
        Number.isInteger(parsedQuantity) &&
        parsedQuantity > 0 &&
        current.length >= parsedQuantity
      ) {
        return current;
      }

      return [...current, serialId];
    });
  };

  const selectFirstSerials = () => {
    const parsedQuantity = Number(quantity);

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity <= 0
    ) {
      setErrorMessage(
        "Enter a valid quantity first.",
      );
      return;
    }

    setSelectedSerialIds(
      availableSerials
        .slice(0, parsedQuantity)
        .map((unit) => unit.id),
    );
  };

  const selectAllSerials = () => {
    const parsedQuantity = Number(quantity);

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity <= 0
    ) {
      setErrorMessage(
        "Enter a valid quantity first.",
      );
      return;
    }

    const count = Math.min(
      parsedQuantity,
      availableSerials.length,
    );

    setSelectedSerialIds(
      availableSerials
        .slice(0, count)
        .map((unit) => unit.id),
    );
  };

  const clearSelectedSerials = () => {
    setSelectedSerialIds([]);
  };

  const createTransfer = async () => {
    setErrorMessage("");

    if (!companyId) {
      setErrorMessage(
        "Company could not be resolved.",
      );
      return;
    }

    if (
      !sourceWarehouseId ||
      !sourceLocationId
    ) {
      setErrorMessage(
        "Select the source warehouse and location.",
      );
      return;
    }

    if (
      !destinationWarehouseId ||
      !destinationLocationId
    ) {
      setErrorMessage(
        "Select the destination warehouse and location.",
      );
      return;
    }

    if (
      sourceWarehouseId ===
        destinationWarehouseId &&
      sourceLocationId ===
        destinationLocationId
    ) {
      setErrorMessage(
        "Source and destination cannot be the same location.",
      );
      return;
    }

    if (items.length === 0) {
      setErrorMessage(
        "Add at least one product to the transfer.",
      );
      return;
    }

    setSaving(true);

    try {
      const payload = items.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        batch_id: item.batch_id,
        serial_unit_ids:
          item.serial_unit_ids.length > 0
            ? item.serial_unit_ids
            : [],
        notes: item.notes || undefined,
      }));

      const { data: transferId, error } =
        await supabase.rpc(
          "create_stock_transfer",
          {
            p_company_id: companyId,
            p_source_warehouse_id:
              sourceWarehouseId,
            p_source_location_id:
              sourceLocationId,
            p_destination_warehouse_id:
              destinationWarehouseId,
            p_destination_location_id:
              destinationLocationId,
            p_items: payload,
            p_notes: notes.trim() || null,
          },
        );

      if (error) {
        throw new Error(error.message);
      }

      if (!transferId) {
        throw new Error(
          "Transfer was created but no transfer ID was returned.",
        );
      }

      router.push(
        `/inventory/transfers/${transferId}`,
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to create transfer.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="state-card">
            <div className="spinner" />

            <h2>
              Loading transfer workspace
            </h2>

            <p>
              Loading products, warehouses,
              batches, and serial assets.
            </p>
          </div>

          <style jsx>{styles}</style>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <div className="page-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Inventory · Transfers
            </div>

            <h1 className="page-title">
              New Stock Transfer
            </h1>

            <p className="page-subtitle">
              Move inventory between warehouse
              locations while preserving batch
              provenance and optional serial
              identities.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                router.push(
                  "/inventory/transfers",
                )
              }
            >
              Cancel
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={createTransfer}
              disabled={
                saving ||
                items.length === 0
              }
            >
              {saving
                ? "Creating…"
                : "Create Draft"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="error-banner">
            <div className="error-icon">
              !
            </div>

            <div>
              <strong>
                Transfer could not be completed
              </strong>

              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              onClick={() =>
                setErrorMessage("")
              }
            >
              ×
            </button>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Transfer Lines
            </div>

            <div className="stat-value">
              {items.length}
            </div>

            <div className="stat-meta">
              Products / variants
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Units
            </div>

            <div className="stat-value">
              {totalUnits}
            </div>

            <div className="stat-meta">
              Total physical quantity
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Source
            </div>

            <div className="stat-value compact">
              {sourceWarehouse?.name ||
                "—"}
            </div>

            <div className="stat-meta">
              {sourceLocation?.name ||
                "Select location"}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Destination
            </div>

            <div className="stat-value compact">
              {destinationWarehouse?.name ||
                "—"}
            </div>

            <div className="stat-meta">
              {destinationLocation?.name ||
                "Select location"}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Batch Lines
            </div>

            <div className="stat-value">
              {
                items.filter(
                  (item) =>
                    item.batch_id !== null,
                ).length
              }
            </div>

            <div className="stat-meta">
              Provenance preserved
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Serial Assets
            </div>

            <div className="stat-value">
              {totalSerialAssets}
            </div>

            <div className="stat-meta">
              Optional identities
            </div>
          </div>
        </div>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>
                Transfer Route
              </h2>

              <p>
                Choose the exact warehouse and
                location on each side.
              </p>
            </div>
          </div>

          <div className="route-grid">
            <div className="route-box">
              <div className="route-heading">
                <span className="route-number source">
                  01
                </span>

                <div>
                  <div className="route-title">
                    Source
                  </div>

                  <div className="route-subtitle">
                    Current inventory location
                  </div>
                </div>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span>
                    Warehouse
                  </span>

                  <select
                    value={
                      sourceWarehouseId
                    }
                    onChange={(event) =>
                      setSourceWarehouseId(
                        event.target.value,
                      )
                    }
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
                          {warehouse.name}
                          {warehouse.code
                            ? ` · ${warehouse.code}`
                            : ""}
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
                      sourceLocationId
                    }
                    onChange={(event) =>
                      setSourceLocationId(
                        event.target.value,
                      )
                    }
                    disabled={
                      !sourceWarehouseId
                    }
                  >
                    <option value="">
                      Select location
                    </option>

                    {sourceLocations.map(
                      (location) => (
                        <option
                          key={
                            location.id
                          }
                          value={
                            location.id
                          }
                        >
                          {location.name}
                          {location.code
                            ? ` · ${location.code}`
                            : ""}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            </div>

            <div className="route-arrow">
              →
            </div>

            <div className="route-box">
              <div className="route-heading">
                <span className="route-number destination">
                  02
                </span>

                <div>
                  <div className="route-title">
                    Destination
                  </div>

                  <div className="route-subtitle">
                    New inventory location
                  </div>
                </div>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span>
                    Warehouse
                  </span>

                  <select
                    value={
                      destinationWarehouseId
                    }
                    onChange={(event) =>
                      setDestinationWarehouseId(
                        event.target.value,
                      )
                    }
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
                          {warehouse.name}
                          {warehouse.code
                            ? ` · ${warehouse.code}`
                            : ""}
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
                      destinationLocationId
                    }
                    onChange={(event) =>
                      setDestinationLocationId(
                        event.target.value,
                      )
                    }
                    disabled={
                      !destinationWarehouseId
                    }
                  >
                    <option value="">
                      Select location
                    </option>

                    {destinationLocations.map(
                      (location) => (
                        <option
                          key={
                            location.id
                          }
                          value={
                            location.id
                          }
                        >
                          {location.name}
                          {location.code
                            ? ` · ${location.code}`
                            : ""}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>
                Add Inventory
              </h2>

              <p>
                Select the product, exact batch,
                quantity, and optionally the
                serial identities.
              </p>
            </div>

            {selectedProduct && (
              <span
                className={trackingClass(
                  selectedProduct.tracking_mode,
                )}
              >
                {trackingLabel(
                  selectedProduct.tracking_mode,
                )}
              </span>
            )}
          </div>

          <div className="item-form">
            <label className="field">
              <span>
                Product
              </span>

              <select
                value={
                  selectedProductId
                }
                onChange={(event) =>
                  setSelectedProductId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select product
                </option>

                {products.map(
                  (product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.name}
                      {product.brand
                        ? ` · ${product.brand}`
                        : ""}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="field">
              <span>
                Variant
              </span>

              <select
                value={
                  selectedVariantId
                }
                onChange={(event) =>
                  setSelectedVariantId(
                    event.target.value,
                  )
                }
                disabled={
                  !selectedProductId
                }
              >
                <option value="">
                  Select variant
                </option>

                {productVariants.map(
                  (variant) => (
                    <option
                      key={variant.id}
                      value={variant.id}
                    >
                      {variant.name ||
                        "Default variant"}
                      {variant.sku
                        ? ` · ${variant.sku}`
                        : ""}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="field">
              <span>
                Quantity
              </span>

              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="field">
              <span>
                Batch / Lot
              </span>

              <select
                value={
                  selectedBatchId
                }
                onChange={(event) =>
                  setSelectedBatchId(
                    event.target.value,
                  )
                }
                disabled={
                  !selectedVariantId ||
                  productBatches.length ===
                    0
                }
              >
                <option value="">
                  {productBatches.length ===
                  0
                    ? "No batches available"
                    : "Select batch / lot"}
                </option>

                {productBatches.map(
                  (batch) => {
                    const stock =
                      batchStock.find(
                        (row) =>
                          row.batch_id ===
                            batch.id &&
                          row.warehouse_id ===
                            sourceWarehouseId &&
                          row.location_id ===
                            sourceLocationId,
                      );

                    const available =
                      stock
                        ? Math.max(
                            0,
                            stock.quantity -
                              stock.reserved_quantity,
                          )
                        : 0;

                    return (
                      <option
                        key={batch.id}
                        value={batch.id}
                      >
                        {batch.lot_number} ·{" "}
                        {available} available
                      </option>
                    );
                  },
                )}
              </select>
            </label>
          </div>

          {selectedProduct &&
            selectedVariantId &&
            selectedBatchId && (
              <div className="inventory-selection-panel">
                <div className="selection-summary">
                  <div className="selection-main">
                    <div className="selection-title">
                      {selectedProduct.name}
                    </div>

                    <div className="selection-subtitle">
                      {selectedVariant?.sku ||
                        "No SKU"}
                      {" · "}
                      Batch{" "}
                      {selectedBatch
                        ?.lot_number ||
                        "—"}
                    </div>
                  </div>

                  <div className="selection-stat">
                    <span>
                      Available at source
                    </span>

                    <strong>
                      {availableBatchQuantity}
                    </strong>
                  </div>

                  <div className="selection-stat">
                    <span>
                      Batch received
                    </span>

                    <strong>
                      {selectedBatch
                        ?.quantity_received ||
                        0}
                    </strong>
                  </div>

                  <div className="selection-stat">
                    <span>
                      Unit cost
                    </span>

                    <strong>
                      {formatMoney(
                        selectedBatch
                          ?.unit_cost,
                      )}
                    </strong>
                  </div>
                </div>

                <div className="serial-section">
                  <div className="serial-section-header">
                    <div>
                      <div className="serial-title">
                        Serial Numbers
                        <span className="optional-badge">
                          Optional
                        </span>
                      </div>

                      <div className="serial-description">
                        This batch can contain
                        serialized and
                        non-serialized units.
                        Select only the real
                        serial numbers you want
                        to identify on this
                        transfer.
                      </div>
                    </div>

                    <div className="serial-counter">
                      <strong>
                        {selectedSerialCount}
                      </strong>

                      <span>
                        selected
                      </span>

                      <em>
                        / {Number(quantity) || 0}
                      </em>
                    </div>
                  </div>

                  <div className="serial-toolbar">
                    <div className="serial-availability">
                      {availableSerials.length >
                      0
                        ? `${availableSerials.length} real serial assets available in this batch at the source`
                        : "No serial assets exist for this batch at the source"}
                    </div>

                    <div className="serial-actions">
                      <button
                        type="button"
                        onClick={
                          selectFirstSerials
                        }
                        disabled={
                          availableSerials.length ===
                            0 ||
                          Number(quantity) <= 0
                        }
                      >
                        Select First
                      </button>

                      <button
                        type="button"
                        onClick={
                          selectAllSerials
                        }
                        disabled={
                          availableSerials.length ===
                            0 ||
                          Number(quantity) <= 0
                        }
                      >
                        Select All
                      </button>

                      <button
                        type="button"
                        onClick={
                          clearSelectedSerials
                        }
                        disabled={
                          selectedSerialCount ===
                          0
                        }
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {availableSerials.length >
                  0 ? (
                    <div className="serial-list">
                      {availableSerials.map(
                        (unit) => {
                          const selected =
                            selectedSerialIds.includes(
                              unit.id,
                            );

                          const disabled =
                            !selected &&
                            selectedSerialCount >=
                              Number(
                                quantity,
                              );

                          return (
                            <button
                              type="button"
                              key={
                                unit.id
                              }
                              className={`serial-row ${
                                selected
                                  ? "selected"
                                  : ""
                              } ${
                                disabled
                                  ? "disabled"
                                  : ""
                              }`}
                              onClick={() => {
                                if (
                                  disabled
                                ) {
                                  return;
                                }

                                toggleSerial(
                                  unit.id,
                                );
                              }}
                            >
                              <span
                                className={`checkbox ${
                                  selected
                                    ? "checked"
                                    : ""
                                }`}
                              >
                                {selected
                                  ? "✓"
                                  : ""}
                              </span>

                              <span className="serial-main">
                                <strong>
                                  {
                                    unit.serial_number
                                  }
                                </strong>

                                <small>
                                  {unit.barcode ||
                                    "No barcode"}
                                </small>
                              </span>

                              <span className="serial-batch">
                                {selectedBatch
                                  ?.lot_number ||
                                  "—"}
                              </span>

                              <span className="serial-cost">
                                {formatMoney(
                                  unit.cost_price,
                                )}
                              </span>
                            </button>
                          );
                        },
                      )}
                    </div>
                  ) : (
                    <div className="no-serial-state">
                      <div className="no-serial-icon">
                        #
                      </div>

                      <div>
                        <strong>
                          No serial numbers
                          recorded
                        </strong>

                        <p>
                          That's completely
                          valid. You can transfer
                          the batch quantity
                          without assigning any
                          serial identities.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="serial-rule">
                    <span>
                      ✓
                    </span>

                    <p>
                      Serial numbers are optional.
                      A batch may contain 0%,
                      partially, or 100%
                      serialized units.
                    </p>
                  </div>
                </div>
              </div>
            )}

          <div className="item-bottom">
            <label className="field item-notes">
              <span>
                Line Notes
              </span>

              <input
                type="text"
                value={itemNotes}
                onChange={(event) =>
                  setItemNotes(
                    event.target.value,
                  )
                }
                placeholder="Optional note for this transfer line"
              />
            </label>

            <button
              type="button"
              className="add-button"
              onClick={addItem}
              disabled={
                !selectedProductId ||
                !selectedVariantId ||
                !selectedBatchId
              }
            >
              + Add to Transfer
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>
                Transfer Items
              </h2>

              <p>
                Review the exact batches and
                optional serial identities before
                creating the draft.
              </p>
            </div>

            <div className="item-count">
              {items.length}{" "}
              {items.length === 1
                ? "line"
                : "lines"}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="empty-items">
              <div className="empty-icon">
                +
              </div>

              <h3>
                No inventory added yet
              </h3>

              <p>
                Select a product, variant, batch,
                and quantity above.
              </p>
            </div>
          ) : (
            <div className="items-table-wrap">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>
                      Product
                    </th>

                    <th>
                      SKU
                    </th>

                    <th>
                      Tracking
                    </th>

                    <th>
                      Batch / Lot
                    </th>

                    <th>
                      Quantity
                    </th>

                    <th>
                      Serial Assets
                    </th>

                    <th>
                      Coverage
                    </th>

                    <th>
                      Notes
                    </th>

                    <th />
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => {
                    const product =
                      getProduct(
                        item.product_id,
                      );

                    const variant =
                      getVariant(
                        item.variant_id,
                      );

                    const batch =
                      getBatch(
                        item.batch_id,
                      );

                    const serialCount =
                      item.serial_unit_ids
                        .length;

                    const coverage =
                      item.quantity > 0
                        ? Math.round(
                            (serialCount /
                              item.quantity) *
                              100,
                          )
                        : 0;

                    return (
                      <tr
                        key={item.id}
                      >
                        <td>
                          <div className="product-cell">
                            <strong>
                              {product?.name ||
                                "Unknown product"}
                            </strong>

                            <span>
                              {product?.brand ||
                                "—"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className="sku">
                            {variant?.sku ||
                              "—"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={trackingClass(
                              product?.tracking_mode,
                            )}
                          >
                            {trackingLabel(
                              product?.tracking_mode,
                            )}
                          </span>
                        </td>

                        <td>
                          <div className="batch-cell">
                            <strong>
                              {batch?.lot_number ||
                                "—"}
                            </strong>

                            <span>
                              {formatMoney(
                                batch?.unit_cost,
                              )}{" "}
                              unit cost
                            </span>
                          </div>
                        </td>

                        <td>
                          <strong>
                            {item.quantity}
                          </strong>
                        </td>

                        <td>
                          {serialCount > 0 ? (
                            <div className="serial-count">
                              <strong>
                                {
                                  serialCount
                                }
                              </strong>

                              <span>
                                selected
                              </span>
                            </div>
                          ) : (
                            <span className="none-value">
                              None
                            </span>
                          )}
                        </td>

                        <td>
                          <div className="coverage">
                            <strong>
                              {coverage}%
                            </strong>

                            <span>
                              serialized
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className="notes-cell">
                            {item.notes ||
                              "—"}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="remove-button"
                            onClick={() =>
                              removeItem(
                                item.id,
                              )
                            }
                            aria-label="Remove item"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel notes-panel">
          <div className="panel-header">
            <div>
              <h2>
                Transfer Notes
              </h2>

              <p>
                Add an optional document-level
                note.
              </p>
            </div>
          </div>

          <textarea
            value={notes}
            onChange={(event) =>
              setNotes(
                event.target.value,
              )
            }
            placeholder="Example: Move refurbished laptops from receiving to the showroom..."
            rows={4}
          />
        </section>

        <div className="architecture-note">
          <div className="architecture-note-icon">
            ✓
          </div>

          <div>
            <strong>
              Batch provenance preserved
            </strong>

            <p>
              The transfer moves the selected
              batch quantity. Serial numbers are
              only the optional individually
              identified subset of that batch.
            </p>
          </div>
        </div>

        <div className="bottom-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push(
                "/inventory/transfers",
              )
            }
            disabled={saving}
          >
            Cancel
          </button>

          <div className="bottom-summary">
            <span>
              {items.length}{" "}
              {items.length === 1
                ? "line"
                : "lines"}
            </span>

            <strong>
              {totalUnits} units
            </strong>

            <span>
              · {totalSerialAssets} serialized
            </span>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={createTransfer}
            disabled={
              saving ||
              items.length === 0
            }
          >
            {saving
              ? "Creating Transfer…"
              : "Create Draft Transfer"}
          </button>
        </div>
      </div>

      <style jsx>{styles}</style>
    </AppShell>
  );
}

const styles = `
  .inventory-page {
    padding-bottom: 48px;
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
    background: #16a34a;
  }

  .page-title {
    margin: 0;
    color: #0f172a;
    font-size: 30px;
    line-height: 1.15;
    font-weight: 700;
    letter-spacing: -0.025em;
  }

  .page-subtitle {
    margin: 8px 0 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  button {
    font-family: inherit;
  }

  .primary-button,
  .secondary-button,
  .add-button {
    height: 40px;
    padding: 0 16px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      opacity 0.15s ease;
  }

  .primary-button {
    border: 1px solid #166534;
    background: #166534;
    color: white;
  }

  .primary-button:hover:not(:disabled) {
    background: #14532d;
  }

  .secondary-button {
    border: 1px solid #d1d5db;
    background: white;
    color: #334155;
  }

  .secondary-button:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #94a3b8;
  }

  .primary-button:disabled,
  .secondary-button:disabled,
  .add-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .error-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 20px;
    padding: 14px 16px;
    border: 1px solid #fecaca;
    border-radius: 12px;
    background: #fef2f2;
    color: #991b1b;
  }

  .error-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: #fee2e2;
    color: #b91c1c;
    font-weight: 800;
    flex-shrink: 0;
  }

  .error-banner strong {
    display: block;
    font-size: 13px;
  }

  .error-banner p {
    margin: 3px 0 0;
    font-size: 13px;
    line-height: 1.5;
  }

  .error-banner button {
    margin-left: auto;
    border: 0;
    background: transparent;
    color: #991b1b;
    font-size: 20px;
    cursor: pointer;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 20px;
  }

  .stat-card {
    min-width: 0;
    padding: 17px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: white;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  }

  .stat-label {
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .stat-value {
    margin-top: 8px;
    color: #0f172a;
    font-size: 23px;
    line-height: 1.1;
    font-weight: 700;
  }

  .stat-value.compact {
    overflow: hidden;
    font-size: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stat-meta {
    margin-top: 6px;
    color: #94a3b8;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .panel {
    margin-bottom: 20px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: white;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 20px 20px 18px;
    border-bottom: 1px solid #e5e7eb;
  }

  .panel-header h2 {
    margin: 0;
    color: #0f172a;
    font-size: 16px;
    font-weight: 700;
  }

  .panel-header p {
    margin: 5px 0 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.5;
  }

  .route-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 38px minmax(0, 1fr);
    align-items: center;
    gap: 14px;
    padding: 20px;
  }

  .route-box {
    padding: 18px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #f8fafc;
  }

  .route-heading {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 18px;
  }

  .route-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 9px;
    font-size: 12px;
    font-weight: 800;
  }

  .route-number.source {
    background: #dcfce7;
    color: #166534;
  }

  .route-number.destination {
    background: #e0f2fe;
    color: #0369a1;
  }

  .route-title {
    color: #0f172a;
    font-size: 14px;
    font-weight: 700;
  }

  .route-subtitle {
    margin-top: 2px;
    color: #64748b;
    font-size: 11px;
  }

  .route-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 24px;
    font-weight: 600;
  }

  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
  }

  .field > span {
    color: #475569;
    font-size: 11px;
    font-weight: 700;
  }

  .field select,
  .field input,
  .notes-panel textarea {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid #d1d5db;
    border-radius: 9px;
    background: white;
    color: #0f172a;
    font-family: inherit;
    font-size: 13px;
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .field select,
  .field input {
    height: 40px;
    padding: 0 11px;
  }

  .field select:focus,
  .field input:focus,
  .notes-panel textarea:focus {
    border-color: #86efac;
    box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
  }

  .field select:disabled,
  .field input:disabled {
    background: #f1f5f9;
    color: #94a3b8;
    cursor: not-allowed;
  }

  .item-form {
    display: grid;
    grid-template-columns: minmax(200px, 1.5fr) minmax(180px, 1fr) 120px minmax(220px, 1fr);
    gap: 12px;
    padding: 20px;
  }

  .tracking {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    padding: 4px 8px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    font-size: 10px;
    font-weight: 700;
    white-space: nowrap;
  }

  .tracking.serial {
    background: #ede9fe;
    color: #6d28d9;
  }

  .tracking.batch {
    background: #fef3c7;
    color: #92400e;
  }

  .tracking.quantity {
    background: #dcfce7;
    color: #166534;
  }

  .tracking.none {
    background: #f1f5f9;
    color: #475569;
  }

  .inventory-selection-panel {
    margin: 0 20px 20px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
    overflow: hidden;
  }

  .selection-summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) repeat(3, minmax(120px, 160px));
    align-items: center;
    border-bottom: 1px solid #e2e8f0;
  }

  .selection-main {
    min-width: 0;
    padding: 15px 16px;
  }

  .selection-title {
    overflow: hidden;
    color: #0f172a;
    font-size: 13px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selection-subtitle {
    margin-top: 4px;
    color: #64748b;
    font-size: 11px;
  }

  .selection-stat {
    min-height: 56px;
    padding: 12px 15px;
    border-left: 1px solid #e2e8f0;
  }

  .selection-stat span {
    display: block;
    color: #64748b;
    font-size: 10px;
    font-weight: 600;
  }

  .selection-stat strong {
    display: block;
    margin-top: 4px;
    color: #0f172a;
    font-size: 14px;
  }

  .serial-section {
    padding: 17px;
  }

  .serial-section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
  }

  .serial-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #0f172a;
    font-size: 13px;
    font-weight: 700;
  }

  .optional-badge {
    padding: 3px 7px;
    border-radius: 999px;
    background: #dcfce7;
    color: #166534;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .serial-description {
    max-width: 700px;
    margin-top: 5px;
    color: #64748b;
    font-size: 11px;
    line-height: 1.5;
  }

  .serial-counter {
    display: flex;
    align-items: baseline;
    gap: 5px;
    flex-shrink: 0;
    padding: 7px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: white;
  }

  .serial-counter strong {
    color: #166534;
    font-size: 15px;
  }

  .serial-counter span,
  .serial-counter em {
    color: #64748b;
    font-size: 10px;
    font-style: normal;
  }

  .serial-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-top: 15px;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 9px;
    background: white;
  }

  .serial-availability {
    color: #64748b;
    font-size: 11px;
  }

  .serial-actions {
    display: flex;
    gap: 7px;
  }

  .serial-actions button {
    height: 31px;
    padding: 0 10px;
    border: 1px solid #d1d5db;
    border-radius: 7px;
    background: white;
    color: #475569;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }

  .serial-actions button:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #94a3b8;
  }

  .serial-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .serial-list {
    max-height: 280px;
    margin-top: 10px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 9px;
    background: white;
  }

  .serial-row {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 140px 90px;
    align-items: center;
    width: 100%;
    padding: 10px 12px;
    border: 0;
    border-bottom: 1px solid #f1f5f9;
    background: white;
    text-align: left;
    cursor: pointer;
  }

  .serial-row:last-child {
    border-bottom: 0;
  }

  .serial-row:hover {
    background: #f8fafc;
  }

  .serial-row.selected {
    background: #f0fdf4;
  }

  .serial-row.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 17px;
    height: 17px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    color: white;
    font-size: 10px;
    font-weight: 800;
  }

  .checkbox.checked {
    border-color: #166534;
    background: #166534;
  }

  .serial-main {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .serial-main strong {
    color: #0f172a;
    font-size: 12px;
  }

  .serial-main small {
    margin-top: 2px;
    color: #94a3b8;
    font-size: 10px;
  }

  .serial-batch,
  .serial-cost {
    color: #64748b;
    font-size: 11px;
  }

  .serial-cost {
    text-align: right;
  }

  .no-serial-state {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
    padding: 17px;
    border: 1px dashed #cbd5e1;
    border-radius: 9px;
    background: white;
  }

  .no-serial-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: #f1f5f9;
    color: #64748b;
    font-size: 16px;
    font-weight: 700;
  }

  .no-serial-state strong {
    color: #334155;
    font-size: 12px;
  }

  .no-serial-state p {
    margin: 3px 0 0;
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.45;
  }

  .serial-rule {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 11px;
    color: #166534;
  }

  .serial-rule > span {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 17px;
    height: 17px;
    border-radius: 999px;
    background: #dcfce7;
    font-size: 10px;
    font-weight: 800;
  }

  .serial-rule p {
    margin: 0;
    color: #64748b;
    font-size: 10px;
  }

  .item-bottom {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    padding: 0 20px 20px;
  }

  .item-notes {
    flex: 1;
  }

  .add-button {
    flex-shrink: 0;
    border: 1px solid #166534;
    background: #166534;
    color: white;
  }

  .add-button:hover:not(:disabled) {
    background: #14532d;
  }

  .empty-items {
    padding: 52px 20px;
    text-align: center;
  }

  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    margin: 0 auto 12px;
    border: 1px solid #dbeafe;
    border-radius: 10px;
    background: #f8fafc;
    color: #64748b;
    font-size: 20px;
  }

  .empty-items h3 {
    margin: 0;
    color: #334155;
    font-size: 14px;
  }

  .empty-items p {
    margin: 6px 0 0;
    color: #94a3b8;
    font-size: 12px;
  }

  .item-count {
    padding: 5px 9px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    font-size: 11px;
    font-weight: 700;
  }

  .items-table-wrap {
    overflow-x: auto;
  }

  .items-table {
    width: 100%;
    min-width: 1180px;
    border-collapse: collapse;
  }

  .items-table th {
    padding: 11px 14px;
    border-bottom: 1px solid #e5e7eb;
    background: #f8fafc;
    color: #64748b;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-align: left;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .items-table td {
    padding: 13px 14px;
    border-bottom: 1px solid #f1f5f9;
    color: #475569;
    font-size: 12px;
    vertical-align: middle;
  }

  .items-table tbody tr:last-child td {
    border-bottom: 0;
  }

  .items-table tbody tr:hover {
    background: #fafafa;
  }

  .product-cell {
    display: flex;
    flex-direction: column;
    min-width: 190px;
  }

  .product-cell strong {
    color: #0f172a;
    font-size: 12px;
  }

  .product-cell span {
    margin-top: 3px;
    color: #94a3b8;
    font-size: 10px;
  }

  .sku {
    color: #475569;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
  }

  .batch-cell {
    display: flex;
    flex-direction: column;
  }

  .batch-cell strong {
    color: #0f172a;
    font-size: 11px;
  }

  .batch-cell span {
    margin-top: 3px;
    color: #94a3b8;
    font-size: 10px;
  }

  .serial-count {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .serial-count strong {
    color: #0f172a;
  }

  .serial-count span {
    color: #94a3b8;
    font-size: 10px;
  }

  .none-value {
    color: #cbd5e1;
    font-size: 11px;
  }

  .coverage {
    display: flex;
    flex-direction: column;
  }

  .coverage strong {
    color: #0f172a;
    font-size: 11px;
  }

  .coverage span {
    margin-top: 2px;
    color: #94a3b8;
    font-size: 9px;
  }

  .notes-cell {
    display: block;
    max-width: 150px;
    overflow: hidden;
    color: #64748b;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove-button {
    width: 30px;
    height: 30px;
    border: 1px solid #e5e7eb;
    border-radius: 7px;
    background: white;
    color: #94a3b8;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  .remove-button:hover {
    border-color: #fecaca;
    background: #fef2f2;
    color: #dc2626;
  }

  .notes-panel {
    padding-bottom: 20px;
  }

  .notes-panel textarea {
    display: block;
    width: calc(100% - 40px);
    margin: 20px;
    padding: 11px;
    resize: vertical;
    line-height: 1.5;
  }

  .architecture-note {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 20px;
    padding: 14px 16px;
    border: 1px solid #bbf7d0;
    border-radius: 12px;
    background: #f0fdf4;
  }

  .architecture-note-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 25px;
    height: 25px;
    border-radius: 999px;
    background: #dcfce7;
    color: #166534;
    font-size: 12px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .architecture-note strong {
    display: block;
    color: #166534;
    font-size: 12px;
  }

  .architecture-note p {
    margin: 3px 0 0;
    color: #64748b;
    font-size: 11px;
    line-height: 1.5;
  }

  .bottom-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  }

  .bottom-summary {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-right: 4px;
    padding-right: 12px;
    border-right: 1px solid #e5e7eb;
    color: #64748b;
    font-size: 11px;
  }

  .bottom-summary strong {
    color: #0f172a;
    font-size: 14px;
  }

  .state-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 420px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: white;
    text-align: center;
  }

  .state-card h2 {
    margin: 14px 0 0;
    color: #334155;
    font-size: 15px;
  }

  .state-card p {
    margin: 6px 0 0;
    color: #94a3b8;
    font-size: 12px;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid #e2e8f0;
    border-top-color: #166534;
    border-radius: 999px;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1400px) {
    .stats-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .item-form {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .selection-summary {
      grid-template-columns: minmax(0, 1fr) repeat(3, 130px);
    }
  }

  @media (max-width: 1000px) {
    .selection-summary {
      grid-template-columns: repeat(3, 1fr);
    }

    .selection-main {
      grid-column: 1 / -1;
      border-bottom: 1px solid #e2e8f0;
    }

    .selection-stat {
      border-left: 0;
      border-right: 1px solid #e2e8f0;
    }

    .selection-stat:last-child {
      border-right: 0;
    }
  }

  @media (max-width: 900px) {
    .page-header {
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions button {
      flex: 1;
    }

    .route-grid {
      grid-template-columns: 1fr;
    }

    .route-arrow {
      transform: rotate(90deg);
    }

    .serial-section-header,
    .serial-toolbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .serial-actions {
      width: 100%;
    }

    .serial-actions button {
      flex: 1;
    }
  }

  @media (max-width: 640px) {
    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .field-grid,
    .item-form {
      grid-template-columns: 1fr;
    }

    .selection-summary {
      grid-template-columns: 1fr;
    }

    .selection-main {
      grid-column: auto;
      border-bottom: 1px solid #e2e8f0;
    }

    .selection-stat {
      border-right: 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .selection-stat:last-child {
      border-bottom: 0;
    }

    .item-bottom {
      flex-direction: column;
      align-items: stretch;
    }

    .add-button {
      width: 100%;
    }

    .bottom-actions {
      flex-wrap: wrap;
    }

    .bottom-summary {
      width: 100%;
      margin: 0;
      padding: 0 0 10px;
      border-right: 0;
      justify-content: center;
    }

    .architecture-note {
      margin-bottom: 16px;
    }
  }
`;