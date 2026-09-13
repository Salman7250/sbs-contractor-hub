"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ClipboardList,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

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
  cost_price: number | null;
  selling_price: number | null;
  is_active: boolean | null;
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

type AdjustmentLine = {
  id: string;
  productId: string;
  variantId: string;
  batchId: string;
  quantity: string;
  direction: "in" | "out";
  warehouseId: string;
  locationId: string;
  reason: string;
};

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

    if (value) {
      return value;
    }
  }

  return null;
}

function isUuid(
  value: string | null | undefined,
): value is string {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

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

export default function NewInventoryAdjustmentPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [companyId, setCompanyId] =
    useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchStock, setBatchStock] =
    useState<BatchStock[]>([]);
  const [warehouses, setWarehouses] =
    useState<Warehouse[]>([]);
  const [locations, setLocations] =
    useState<Location[]>([]);

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<AdjustmentLine[]>([
    {
      id: crypto.randomUUID(),
      productId: "",
      variantId: "",
      batchId: "",
      quantity: "",
      direction: "in",
      warehouseId: "",
      locationId: "",
      reason: "",
    },
  ]);

  const resolveCompany = useCallback(async () => {
    const storedCompanyId = getCurrentCompanyId();

    if (isUuid(storedCompanyId)) {
      setCompanyId(storedCompanyId);
      return storedCompanyId;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error(
        "You must be signed in to create an inventory adjustment.",
      );
    }

    const { data, error } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data?.company_id) {
      throw new Error(
        "No company is associated with your account.",
      );
    }

    setCompanyId(data.company_id);

    return data.company_id;
  }, [supabase]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const currentCompanyId =
        await resolveCompany();

      const [
        productsResult,
        variantsResult,
        batchesResult,
        batchStockResult,
        warehousesResult,
        locationsResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id,name,brand,category,tracking_mode,status",
          )
          .eq("company_id", currentCompanyId)
          .neq("tracking_mode", "none")
          .order("name"),

        supabase
          .from("product_variants")
          .select(
            "id,product_id,name,sku,cost_price,selling_price,is_active",
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
          .neq("status", "closed")
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
      ]);

      if (productsResult.error) {
        throw productsResult.error;
      }

      if (variantsResult.error) {
        throw variantsResult.error;
      }

      if (batchesResult.error) {
        throw batchesResult.error;
      }

      if (batchStockResult.error) {
        throw batchStockResult.error;
      }

      if (warehousesResult.error) {
        throw warehousesResult.error;
      }

      if (locationsResult.error) {
        throw locationsResult.error;
      }

      setProducts(
        (productsResult.data ?? []) as Product[],
      );

      setVariants(
        (variantsResult.data ?? []) as Variant[],
      );

      setBatches(
        (batchesResult.data ?? []) as Batch[],
      );

      setBatchStock(
        (batchStockResult.data ?? []) as BatchStock[],
      );

      setWarehouses(
        (warehousesResult.data ?? []) as Warehouse[],
      );

      setLocations(
        (locationsResult.data ?? []) as Location[],
      );
    } catch (error) {
      console.error(
        "Failed to load adjustment data:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load adjustment data.",
      );
    } finally {
      setLoading(false);
    }
  }, [resolveCompany, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const productMap = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          product,
        ]),
      ),
    [products],
  );

  const variantMap = useMemo(
    () =>
      new Map(
        variants.map((variant) => [
          variant.id,
          variant,
        ]),
      ),
    [variants],
  );

  const batchMap = useMemo(
    () =>
      new Map(
        batches.map((batch) => [
          batch.id,
          batch,
        ]),
      ),
    [batches],
  );

  const warehouseMap = useMemo(
    () =>
      new Map(
        warehouses.map((warehouse) => [
          warehouse.id,
          warehouse,
        ]),
      ),
    [warehouses],
  );

  const variantsByProduct = useMemo(() => {
    const map = new Map<string, Variant[]>();

    for (const variant of variants) {
      const existing =
        map.get(variant.product_id) ?? [];

      existing.push(variant);

      map.set(
        variant.product_id,
        existing,
      );
    }

    return map;
  }, [variants]);

  const batchesByVariant = useMemo(() => {
    const map = new Map<string, Batch[]>();

    for (const batch of batches) {
      if (!batch.variant_id) {
        continue;
      }

      const existing =
        map.get(batch.variant_id) ?? [];

      existing.push(batch);

      map.set(
        batch.variant_id,
        existing,
      );
    }

    return map;
  }, [batches]);

  const locationsByWarehouse = useMemo(() => {
    const map = new Map<string, Location[]>();

    for (const location of locations) {
      const existing =
        map.get(location.warehouse_id) ?? [];

      existing.push(location);

      map.set(
        location.warehouse_id,
        existing,
      );
    }

    return map;
  }, [locations]);

  const getBatchStockAtLocation = (
    batchId: string,
    warehouseId: string,
    locationId: string,
  ) => {
    return batchStock.find(
      (stock) =>
        stock.batch_id === batchId &&
        stock.warehouse_id === warehouseId &&
        stock.location_id === locationId,
    );
  };

  const getBatchAvailableStock = (
    batchId: string,
    warehouseId: string,
    locationId: string,
  ) => {
    const stock =
      getBatchStockAtLocation(
        batchId,
        warehouseId,
        locationId,
      );

    if (!stock) {
      return 0;
    }

    return Math.max(
      0,
      stock.quantity -
        stock.reserved_quantity,
    );
  };

  const totalUnits = useMemo(() => {
    return lines.reduce(
      (sum, line) => {
        const quantity =
          Number.parseInt(
            line.quantity || "0",
            10,
          );

        return (
          sum +
          (Number.isInteger(quantity)
            ? quantity
            : 0)
        );
      },
      0,
    );
  }, [lines]);

  const unitsIn = useMemo(() => {
    return lines
      .filter(
        (line) =>
          line.direction === "in",
      )
      .reduce(
        (sum, line) =>
          sum +
          Number.parseInt(
            line.quantity || "0",
            10,
          ),
        0,
      );
  }, [lines]);

  const unitsOut = useMemo(() => {
    return lines
      .filter(
        (line) =>
          line.direction === "out",
      )
      .reduce(
        (sum, line) =>
          sum +
          Number.parseInt(
            line.quantity || "0",
            10,
          ),
        0,
      );
  }, [lines]);

  const updateLine = (
    lineId: string,
    updates: Partial<AdjustmentLine>,
  ) => {
    setLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              ...updates,
            }
          : line,
      ),
    );
  };

  const addLine = () => {
    setLines((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        productId: "",
        variantId: "",
        batchId: "",
        quantity: "",
        direction: "in",
        warehouseId: "",
        locationId: "",
        reason: "",
      },
    ]);
  };

  const removeLine = (lineId: string) => {
    setLines((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter(
        (line) =>
          line.id !== lineId,
      );
    });
  };

  const handleProductChange = (
    lineId: string,
    productId: string,
  ) => {
    const productVariants =
      variantsByProduct.get(
        productId,
      ) ?? [];

    updateLine(lineId, {
      productId,
      variantId:
        productVariants.length === 1
          ? productVariants[0].id
          : "",
      batchId: "",
    });
  };

  const handleVariantChange = (
    lineId: string,
    variantId: string,
  ) => {
    const variant =
      variantMap.get(variantId);

    const variantBatches =
      batchesByVariant.get(
        variantId,
      ) ?? [];

    updateLine(lineId, {
      productId:
        variant?.product_id ?? "",
      variantId,
      batchId:
        variantBatches.length === 1
          ? variantBatches[0].id
          : "",
    });
  };

  const handleWarehouseChange = (
    lineId: string,
    warehouseId: string,
  ) => {
    const warehouseLocations =
      locationsByWarehouse.get(
        warehouseId,
      ) ?? [];

    updateLine(lineId, {
      warehouseId,
      locationId:
        warehouseLocations.length === 1
          ? warehouseLocations[0].id
          : "",
    });
  };

  const validateForm = () => {
    if (!companyId) {
      return "Company could not be resolved.";
    }

    if (lines.length === 0) {
      return "Add at least one adjustment line.";
    }

    for (
      let index = 0;
      index < lines.length;
      index += 1
    ) {
      const line = lines[index];
      const lineNumber = index + 1;

      if (!line.productId) {
        return `Line ${lineNumber}: select a product.`;
      }

      if (!line.variantId) {
        return `Line ${lineNumber}: select a variant.`;
      }

      const variant =
        variantMap.get(
          line.variantId,
        );

      if (
        !variant ||
        variant.product_id !==
          line.productId
      ) {
        return `Line ${lineNumber}: selected variant does not belong to the selected product.`;
      }

      if (!line.batchId) {
        return `Line ${lineNumber}: select a batch / lot.`;
      }

      const batch =
        batchMap.get(line.batchId);

      if (
        !batch ||
        batch.product_id !==
          line.productId ||
        (batch.variant_id &&
          batch.variant_id !==
            line.variantId)
      ) {
        return `Line ${lineNumber}: selected batch does not belong to the selected product variant.`;
      }

      const quantity =
        Number.parseInt(
          line.quantity || "0",
          10,
        );

      if (
        !Number.isInteger(
          quantity,
        ) ||
        quantity <= 0
      ) {
        return `Line ${lineNumber}: enter a quantity greater than zero.`;
      }

      if (!line.warehouseId) {
        return `Line ${lineNumber}: select a warehouse.`;
      }

      if (
        !warehouseMap.has(
          line.warehouseId,
        )
      ) {
        return `Line ${lineNumber}: selected warehouse is invalid.`;
      }

      if (!line.locationId) {
        return `Line ${lineNumber}: select a location.`;
      }

      const location =
        locations.find(
          (item) =>
            item.id ===
            line.locationId,
        );

      if (
        !location ||
        location.warehouse_id !==
          line.warehouseId
      ) {
        return `Line ${lineNumber}: selected location does not belong to the selected warehouse.`;
      }

      if (
        line.direction === "out"
      ) {
        const available =
          getBatchAvailableStock(
            line.batchId,
            line.warehouseId,
            line.locationId,
          );

        if (quantity > available) {
          return `Line ${lineNumber}: only ${available.toLocaleString()} units are available in this batch at the selected location.`;
        }
      }
    }

    return null;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMessage(null);

      const validationError =
        validateForm();

      if (validationError) {
        setErrorMessage(
          validationError,
        );
        return;
      }

      if (!companyId) {
        throw new Error(
          "Company could not be resolved.",
        );
      }

      const payload = lines.map(
        (line) => ({
          product_id:
            line.productId,
          variant_id:
            line.variantId,
          batch_id:
            line.batchId,
          quantity:
            Number.parseInt(
              line.quantity,
              10,
            ),
          direction:
            line.direction,
          warehouse_id:
            line.warehouseId,
          location_id:
            line.locationId,
          reason:
            line.reason.trim() ||
            null,
        }),
      );

      const { data, error } =
        await supabase.rpc(
          "create_stock_adjustment",
          {
            p_company_id:
              companyId,
            p_reason:
              reason.trim() ||
              null,
            p_notes:
              notes.trim() ||
              null,
            p_items: payload,
          },
        );

      if (error) {
        throw error;
      }

      if (
        !data ||
        !isUuid(data)
      ) {
        throw new Error(
          "Adjustment was created, but no adjustment ID was returned.",
        );
      }

      router.push(
        `/inventory/adjustments/${data}`,
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Failed to create stock adjustment:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to create stock adjustment.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="loading-state">
            <div className="loading-spinner" />
            <div>
              Loading adjustment
              workspace...
            </div>
          </div>

          <style jsx>{`
            .inventory-page {
              padding-bottom: 40px;
            }

            .loading-state {
              min-height: 520px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 10px;
              color: #64748b;
              font-size: 13px;
            }

            .loading-spinner {
              width: 25px;
              height: 25px;
              border: 2px solid #e2e8f0;
              border-top-color: #166534;
              border-radius: 999px;
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
          `}</style>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <div className="page-header">
          <div>
            <button
  type="button"
  className="back-button"
  onClick={() =>
    router.push("/inventory/adjustments")
  }
  disabled={saving}
>
  <ArrowLeft size={15} />
  Back to Adjustments
</button>

            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Inventory Adjustments
            </div>

            <h1 className="page-title">
              New Stock Adjustment
            </h1>

            <p className="page-subtitle">
              Correct inventory against a
              specific batch or lot without
              inventing serial numbers.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                router.push(
                  "/inventory/adjustments",
                )
              }
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                void handleSave()
              }
              disabled={saving}
            >
              {saving ? (
                <Loader2
                  size={15}
                  className="spin"
                />
              ) : (
                <ClipboardList
                  size={15}
                />
              )}

              {saving
                ? "Creating..."
                : "Create Draft"}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="error-card">
            <div>
              <div className="error-title">
                Unable to create
                adjustment
              </div>

              <div className="error-message">
                {errorMessage}
              </div>
            </div>
          </div>
        ) : null}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Adjustment Lines
            </div>

            <div className="stat-value">
              {lines.length}
            </div>

            <div className="stat-meta">
              Products / batches
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Total Units
            </div>

            <div className="stat-value">
              {totalUnits.toLocaleString()}
            </div>

            <div className="stat-meta">
              Across all lines
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Units Increased
            </div>

            <div className="stat-value stat-positive">
              +
              {unitsIn.toLocaleString()}
            </div>

            <div className="stat-meta">
              Inventory additions
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Units Decreased
            </div>

            <div className="stat-value stat-negative">
              -
              {unitsOut.toLocaleString()}
            </div>

            <div className="stat-meta">
              Inventory reductions
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Net Change
            </div>

            <div
              className={`stat-value ${
                unitsIn - unitsOut > 0
                  ? "stat-positive"
                  : unitsIn - unitsOut < 0
                    ? "stat-negative"
                    : ""
              }`}
            >
              {unitsIn - unitsOut > 0
                ? "+"
                : ""}
              {(
                unitsIn -
                unitsOut
              ).toLocaleString()}
            </div>

            <div className="stat-meta">
              Expected inventory delta
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Status
            </div>

            <div className="stat-value status-text">
              Draft
            </div>

            <div className="stat-meta">
              Changes apply on completion
            </div>
          </div>
        </div>

        <div className="form-grid">
          <div className="main-column">
            <section className="content-card">
              <div className="content-card-header">
                <div>
                  <div className="section-title">
                    Adjustment Details
                  </div>

                  <div className="section-subtitle">
                    Describe the reason for
                    this inventory correction.
                  </div>
                </div>
              </div>

              <div className="form-body">
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="reason">
                      Reason
                    </label>

                    <input
                      id="reason"
                      type="text"
                      value={reason}
                      onChange={(event) =>
                        setReason(
                          event.target.value,
                        )
                      }
                      placeholder="e.g. Physical stock count correction"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="notes">
                      Notes
                    </label>

                    <textarea
                      id="notes"
                      value={notes}
                      onChange={(event) =>
                        setNotes(
                          event.target.value,
                        )
                      }
                      rows={3}
                      placeholder="Additional information about this adjustment..."
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="content-card">
              <div className="content-card-header">
                <div>
                  <div className="section-title">
                    Adjustment Lines
                  </div>

                  <div className="section-subtitle">
                    Every adjustment is tied
                    to a specific batch / lot.
                  </div>
                </div>

                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={addLine}
                >
                  <Plus size={15} />
                  Add Line
                </button>
              </div>

              <div className="lines-container">
                {lines.map(
                  (line, index) => {
                    const productVariants =
                      variantsByProduct.get(
                        line.productId,
                      ) ?? [];

                    const variantBatches =
                      batchesByVariant.get(
                        line.variantId,
                      ) ?? [];

                    const warehouseLocations =
                      locationsByWarehouse.get(
                        line.warehouseId,
                      ) ?? [];

                    const selectedProduct =
                      productMap.get(
                        line.productId,
                      );

                    const selectedVariant =
                      variantMap.get(
                        line.variantId,
                      );

                    const selectedBatch =
                      batchMap.get(
                        line.batchId,
                      );

                    const selectedStock =
                      line.batchId &&
                      line.warehouseId &&
                      line.locationId
                        ? getBatchStockAtLocation(
                            line.batchId,
                            line.warehouseId,
                            line.locationId,
                          )
                        : null;

                    const availableStock =
                      selectedStock
                        ? Math.max(
                            0,
                            selectedStock.quantity -
                              selectedStock.reserved_quantity,
                          )
                        : 0;

                    return (
                      <div
                        className="adjustment-line"
                        key={line.id}
                      >
                        <div className="line-header">
                          <div className="line-number">
                            Line{" "}
                            {index + 1}
                          </div>

                          {lines.length >
                          1 ? (
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={() =>
                                removeLine(
                                  line.id,
                                )
                              }
                              title="Remove line"
                            >
                              <Trash2
                                size={15}
                              />
                            </button>
                          ) : null}
                        </div>

                        <div className="line-grid">
                          <div className="field">
                            <label>
                              Product
                            </label>

                            <select
                              value={
                                line.productId
                              }
                              onChange={(
                                event,
                              ) =>
                                handleProductChange(
                                  line.id,
                                  event.target
                                    .value,
                                )
                              }
                            >
                              <option value="">
                                Select product
                              </option>

                              {products.map(
                                (
                                  product,
                                ) => (
                                  <option
                                    key={
                                      product.id
                                    }
                                    value={
                                      product.id
                                    }
                                  >
                                    {
                                      product.name
                                    }
                                    {product.brand
                                      ? ` · ${product.brand}`
                                      : ""}
                                  </option>
                                ),
                              )}
                            </select>
                          </div>

                          <div className="field">
                            <label>
                              Variant
                            </label>

                            <select
                              value={
                                line.variantId
                              }
                              onChange={(
                                event,
                              ) =>
                                handleVariantChange(
                                  line.id,
                                  event.target
                                    .value,
                                )
                              }
                              disabled={
                                !line.productId
                              }
                            >
                              <option value="">
                                Select variant
                              </option>

                              {productVariants.map(
                                (
                                  variant,
                                ) => (
                                  <option
                                    key={
                                      variant.id
                                    }
                                    value={
                                      variant.id
                                    }
                                  >
                                    {variant.name ||
                                      "Default Variant"}
                                    {variant.sku
                                      ? ` · ${variant.sku}`
                                      : ""}
                                  </option>
                                ),
                              )}
                            </select>
                          </div>

                          <div className="field">
                            <label>
                              Batch / Lot
                            </label>

                            <select
                              value={
                                line.batchId
                              }
                              onChange={(
                                event,
                              ) =>
                                updateLine(
                                  line.id,
                                  {
                                    batchId:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                              disabled={
                                !line.variantId
                              }
                            >
                              <option value="">
                                Select batch / lot
                              </option>

                              {variantBatches.map(
                                (
                                  batch,
                                ) => (
                                  <option
                                    key={
                                      batch.id
                                    }
                                    value={
                                      batch.id
                                    }
                                  >
                                    {
                                      batch.lot_number
                                    }
                                    {" · "}
                                    {formatDate(
                                      batch.received_at,
                                    )}
                                  </option>
                                ),
                              )}
                            </select>

                            {selectedBatch ? (
                              <div className="batch-hint">
                                Received{" "}
                                {selectedBatch.quantity_received.toLocaleString()}
                                {selectedBatch.unit_cost !==
                                null
                                  ? ` · ${selectedBatch.unit_cost.toLocaleString()} / unit`
                                  : ""}
                              </div>
                            ) : null}
                          </div>

                          <div className="field">
                            <label>
                              Direction
                            </label>

                            <div className="direction-selector">
                              <button
                                type="button"
                                className={`direction-option ${
                                  line.direction ===
                                  "in"
                                    ? "selected-in"
                                    : ""
                                }`}
                                onClick={() =>
                                  updateLine(
                                    line.id,
                                    {
                                      direction:
                                        "in",
                                    },
                                  )
                                }
                              >
                                <ArrowUp
                                  size={
                                    15
                                  }
                                />

                                <span>
                                  Increase
                                </span>
                              </button>

                              <button
                                type="button"
                                className={`direction-option ${
                                  line.direction ===
                                  "out"
                                    ? "selected-out"
                                    : ""
                                }`}
                                onClick={() =>
                                  updateLine(
                                    line.id,
                                    {
                                      direction:
                                        "out",
                                    },
                                  )
                                }
                              >
                                <ArrowDown
                                  size={
                                    15
                                  }
                                />

                                <span>
                                  Decrease
                                </span>
                              </button>
                            </div>
                          </div>

                          <div className="field">
                            <label>
                              Quantity
                            </label>

                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={
                                line.quantity
                              }
                              onChange={(
                                event,
                              ) =>
                                updateLine(
                                  line.id,
                                  {
                                    quantity:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                              placeholder="0"
                            />

                            {line.direction ===
                              "out" &&
                            line.batchId &&
                            line.warehouseId &&
                            line.locationId ? (
                              <div className="field-hint">
                                Available:{" "}
                                {availableStock.toLocaleString()}
                              </div>
                            ) : null}
                          </div>

                          <div className="field">
                            <label>
                              Warehouse
                            </label>

                            <select
                              value={
                                line.warehouseId
                              }
                              onChange={(
                                event,
                              ) =>
                                handleWarehouseChange(
                                  line.id,
                                  event.target
                                    .value,
                                )
                              }
                            >
                              <option value="">
                                Select warehouse
                              </option>

                              {warehouses.map(
                                (
                                  warehouse,
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
                                    }
                                    {warehouse.code
                                      ? ` (${warehouse.code})`
                                      : ""}
                                  </option>
                                ),
                              )}
                            </select>
                          </div>

                          <div className="field">
                            <label>
                              Location
                            </label>

                            <select
                              value={
                                line.locationId
                              }
                              onChange={(
                                event,
                              ) =>
                                updateLine(
                                  line.id,
                                  {
                                    locationId:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                              disabled={
                                !line.warehouseId
                              }
                            >
                              <option value="">
                                Select location
                              </option>

                              {warehouseLocations.map(
                                (
                                  location,
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
                                    }
                                    {location.code
                                      ? ` (${location.code})`
                                      : ""}
                                  </option>
                                ),
                              )}
                            </select>
                          </div>

                          <div className="field">
                            <label>
                              Line Reason
                            </label>

                            <input
                              type="text"
                              value={
                                line.reason
                              }
                              onChange={(
                                event,
                              ) =>
                                updateLine(
                                  line.id,
                                  {
                                    reason:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                              placeholder="Optional line reason"
                            />
                          </div>
                        </div>

                        <div className="line-summary">
                          <div>
                            <span className="summary-label">
                              Product
                            </span>

                            <span>
                              {selectedProduct
                                ?.name ||
                                "Not selected"}
                            </span>
                          </div>

                          <div>
                            <span className="summary-label">
                              Variant
                            </span>

                            <span>
                              {selectedVariant
                                ?.name ||
                                "Not selected"}
                            </span>
                          </div>

                          <div>
                            <span className="summary-label">
                              Batch / Lot
                            </span>

                            <span>
                              {selectedBatch
                                ?.lot_number ||
                                "Not selected"}
                            </span>
                          </div>

                          <div>
                            <span className="summary-label">
                              Location
                            </span>

                            <span>
                              {line.warehouseId
                                ? warehouseMap.get(
                                    line.warehouseId,
                                  )
                                    ?.name ||
                                  "Warehouse"
                                : "No warehouse"}
                              {line.locationId
                                ? ` / ${
                                    locations.find(
                                      (
                                        location,
                                      ) =>
                                        location.id ===
                                        line.locationId,
                                    )
                                      ?.name ||
                                    "Location"
                                  }`
                                : ""}
                            </span>
                          </div>

                          <div>
                            <span className="summary-label">
                              Change
                            </span>

                            <span
                              className={
                                line.direction ===
                                "in"
                                  ? "change-in"
                                  : "change-out"
                              }
                            >
                              {line.direction ===
                              "in"
                                ? "+"
                                : "-"}
                              {Number.parseInt(
                                line.quantity ||
                                  "0",
                                10,
                              ).toLocaleString()}
                              {" units"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>

              <div className="add-line-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={addLine}
                >
                  <Plus size={15} />
                  Add Another Line
                </button>
              </div>
            </section>
          </div>

          <aside className="side-column">
            <section className="content-card sticky-card">
              <div className="content-card-header">
                <div>
                  <div className="section-title">
                    Adjustment Summary
                  </div>

                  <div className="section-subtitle">
                    Review before creating
                    the draft.
                  </div>
                </div>
              </div>

              <div className="summary-card-body">
                <div className="summary-row">
                  <span>Lines</span>

                  <strong>
                    {lines.length}
                  </strong>
                </div>

                <div className="summary-row">
                  <span>Total units</span>

                  <strong>
                    {totalUnits.toLocaleString()}
                  </strong>
                </div>

                <div className="summary-row">
                  <span className="summary-green">
                    Increase
                  </span>

                  <strong className="summary-green">
                    +
                    {unitsIn.toLocaleString()}
                  </strong>
                </div>

                <div className="summary-row">
                  <span className="summary-red">
                    Decrease
                  </span>

                  <strong className="summary-red">
                    -
                    {unitsOut.toLocaleString()}
                  </strong>
                </div>

                <div className="summary-divider" />

                <div className="summary-row total-row">
                  <span>
                    Net inventory change
                  </span>

                  <strong
                    className={
                      unitsIn -
                        unitsOut >
                      0
                        ? "summary-green"
                        : unitsIn -
                              unitsOut <
                            0
                          ? "summary-red"
                          : ""
                    }
                  >
                    {unitsIn -
                      unitsOut >
                    0
                      ? "+"
                      : ""}
                    {(
                      unitsIn -
                      unitsOut
                    ).toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="info-box">
                <div className="info-title">
                  Batch-first inventory
                </div>

                <div className="info-text">
                  Every adjustment is
                  attached to a real
                  inventory batch / lot.
                  The adjustment changes
                  batch stock at the
                  selected warehouse and
                  location.
                </div>
              </div>

              <div className="info-box">
                <div className="info-title">
                  Serial-safe
                </div>

                <div className="info-text">
                  This workflow never
                  creates fake serial
                  numbers. Real serialized
                  assets remain separate
                  child identities under
                  their batch.
                </div>
              </div>

              <div className="info-box">
                <div className="info-title">
                  Draft behavior
                </div>

                <div className="info-text">
                  Creating the draft does
                  not change inventory.
                  Inventory changes only
                  when the adjustment is
                  completed.
                </div>
              </div>
            </section>
          </aside>
        </div>

        <div className="bottom-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push(
                "/inventory/adjustments",
              )
            }
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              void handleSave()
            }
            disabled={saving}
          >
            {saving ? (
              <Loader2
                size={15}
                className="spin"
              />
            ) : (
              <ClipboardList
                size={15}
              />
            )}

            {saving
              ? "Creating Draft..."
              : "Create Draft Adjustment"}
          </button>
        </div>

        <style jsx>{`
          .inventory-page {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            padding-bottom: 40px;
            box-sizing: border-box;
          }

          .page-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            margin-bottom: 24px;
          }

          .back-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 11px;
  margin-bottom: 15px;
  border: 1px solid #d1d5db;
  border-radius: 9px;
  background: #ffffff;
  color: #475569;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.back-button:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #166534;
}

.back-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
            max-width: 760px;
            color: #64748b;
            font-size: 14px;
            line-height: 1.5;
          }

          .header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
          }

          .primary-button,
          .secondary-button {
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

          .primary-button:disabled,
          .secondary-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .compact-button {
            min-height: 34px;
          }

          .error-card {
            display: flex;
            padding: 15px 17px;
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
            margin-top: 4px;
            color: #7f1d1d;
            font-size: 12px;
            line-height: 1.45;
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
            padding: 17px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 1px 2px
              rgba(15, 23, 42, 0.03);
          }

          .stat-label {
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
          }

          .stat-value {
            margin-top: 7px;
            color: #0f172a;
            font-size: 24px;
            line-height: 1.1;
            font-weight: 700;
          }

          .stat-meta {
            margin-top: 6px;
            color: #94a3b8;
            font-size: 11px;
            line-height: 1.4;
          }

          .stat-positive {
            color: #166534;
          }

          .stat-negative {
            color: #991b1b;
          }

          .status-text {
            color: #475569;
          }

          .form-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              340px;
            gap: 18px;
            align-items: start;
            min-width: 0;
          }

          .main-column {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 18px;
          }

          .side-column {
            min-width: 0;
          }

          .content-card {
            width: 100%;
            min-width: 0;
            overflow: hidden;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 1px 2px
              rgba(15, 23, 42, 0.03);
          }

          .sticky-card {
            position: sticky;
            top: 20px;
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
            line-height: 1.4;
          }

          .form-body {
            padding: 18px;
          }

          .field-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 1fr);
            gap: 16px;
          }

          .field {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 7px;
          }

          .field label {
            color: #475569;
            font-size: 11px;
            font-weight: 700;
          }

          .field input,
          .field select,
          .field textarea {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
            border: 1px solid #dbe1e8;
            border-radius: 9px;
            outline: none;
            background: #ffffff;
            color: #0f172a;
            font-family: inherit;
            font-size: 13px;
            transition:
              border-color 0.15s ease,
              box-shadow 0.15s ease;
          }

          .field input,
          .field select {
            height: 40px;
            padding: 0 11px;
          }

          .field textarea {
            min-height: 82px;
            padding: 10px 11px;
            resize: vertical;
            line-height: 1.45;
          }

          .field input:focus,
          .field select:focus,
          .field textarea:focus {
            border-color: #86a98f;
            box-shadow: 0 0 0 3px
              rgba(22, 101, 52, 0.08);
          }

          .field select:disabled {
            background: #f8fafc;
            color: #94a3b8;
            cursor: not-allowed;
          }

          .batch-hint,
          .field-hint {
            color: #64748b;
            font-size: 10px;
            line-height: 1.4;
          }

          .lines-container {
            width: 100%;
            min-width: 0;
          }

          .adjustment-line {
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
            padding: 18px;
            border-bottom: 1px solid #e5e7eb;
          }

          .adjustment-line:last-child {
            border-bottom: 0;
          }

          .line-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 15px;
          }

          .line-number {
            color: #334155;
            font-size: 12px;
            font-weight: 700;
          }

          .icon-button {
            width: 30px;
            height: 30px;
            flex: 0 0 30px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #dbe1e8;
            border-radius: 8px;
            background: #ffffff;
            color: #64748b;
            cursor: pointer;
          }

          .icon-button:hover {
            background: #f8fafc;
          }

          .icon-button.danger {
            color: #991b1b;
          }

          .icon-button.danger:hover {
            border-color: #fecaca;
            background: #fffafa;
          }

          /*
           * IMPORTANT:
           * Four columns instead of seven.
           * This prevents horizontal overflow and
           * gives Direction enough room.
           */
          .line-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1.35fr)
              minmax(0, 1.2fr)
              minmax(0, 1.3fr)
              minmax(230px, 1.15fr);
            gap: 14px;
            width: 100%;
            min-width: 0;
          }

          .direction-selector {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 1fr);
            gap: 7px;
            width: 100%;
          }

          .direction-option {
            width: 100%;
            min-width: 0;
            height: 40px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 0 9px;
            box-sizing: border-box;
            border: 1px solid #dbe1e8;
            border-radius: 9px;
            background: #ffffff;
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            cursor: pointer;
          }

          .direction-option:hover {
            background: #f8fafc;
          }

          .direction-option.selected-in {
            border-color: #86efac;
            background: #f0fdf4;
            color: #166534;
          }

          .direction-option.selected-out {
            border-color: #fecaca;
            background: #fef2f2;
            color: #991b1b;
          }

          .line-summary {
            display: grid;
            grid-template-columns:
              1.2fr
              1.2fr
              1.1fr
              1.5fr
              0.8fr;
            gap: 14px;
            margin-top: 16px;
            padding: 11px 12px;
            border: 1px solid #eef2f7;
            border-radius: 9px;
            background: #f8fafc;
            width: 100%;
            box-sizing: border-box;
          }

          .line-summary > div {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .summary-label {
            color: #94a3b8;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .line-summary span:not(.summary-label) {
            overflow: hidden;
            color: #475569;
            font-size: 11px;
            font-weight: 600;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .change-in {
            color: #166534 !important;
          }

          .change-out {
            color: #991b1b !important;
          }

          .add-line-footer {
            display: flex;
            justify-content: center;
            padding: 15px 18px;
            border-top: 1px solid #e5e7eb;
            background: #fafafa;
          }

          .summary-card-body {
            padding: 17px 18px;
          }

          .summary-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 8px 0;
            color: #64748b;
            font-size: 12px;
          }

          .summary-row strong {
            color: #334155;
            font-size: 13px;
          }

          .summary-green {
            color: #166534 !important;
          }

          .summary-red {
            color: #991b1b !important;
          }

          .summary-divider {
            height: 1px;
            margin: 7px 0;
            background: #e5e7eb;
          }

          .total-row {
            padding-top: 11px;
          }

          .total-row span {
            color: #334155;
            font-weight: 700;
          }

          .total-row strong {
            font-size: 16px;
          }

          .info-box {
            margin: 0 17px 14px;
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            background: #f8fafc;
          }

          .info-title {
            color: #334155;
            font-size: 11px;
            font-weight: 700;
          }

          .info-text {
            margin-top: 5px;
            color: #64748b;
            font-size: 11px;
            line-height: 1.5;
          }

          .bottom-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 18px;
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
              grid-template-columns:
                repeat(3, minmax(0, 1fr));
            }

            .form-grid {
              grid-template-columns:
                minmax(0, 1fr)
                320px;
            }

            .line-grid {
              grid-template-columns:
                minmax(0, 1.25fr)
                minmax(0, 1.1fr)
                minmax(0, 1.2fr)
                minmax(220px, 1.1fr);
            }

            .line-summary {
              grid-template-columns:
                repeat(3, minmax(0, 1fr));
            }
          }

          @media (max-width: 1150px) {
            .form-grid {
              grid-template-columns: 1fr;
            }

            .sticky-card {
              position: static;
            }

            .line-grid {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .line-summary {
              grid-template-columns:
                repeat(3, minmax(0, 1fr));
            }
          }

          @media (max-width: 800px) {
            .page-header {
              flex-direction: column;
            }

            .field-grid {
              grid-template-columns: 1fr;
            }

            .line-grid {
              grid-template-columns: 1fr;
            }

            .line-summary {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .header-actions {
              width: 100%;
            }

            .header-actions button {
              flex: 1;
            }
          }

          @media (max-width: 560px) {
            .stats-grid {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .line-summary {
              grid-template-columns: 1fr;
            }

            .direction-selector {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .bottom-actions {
              flex-direction: column-reverse;
            }

            .bottom-actions button {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </AppShell>
  );
}