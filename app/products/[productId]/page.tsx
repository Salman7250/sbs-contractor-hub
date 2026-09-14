"use client";

import {
  ArrowLeft,
  Barcode,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  DollarSign,
  Edit3,
  ExternalLink,
  Hash,
  Layers3,
  MapPin,
  Package,
  PackageCheck,
  PackageX,
  RefreshCw,
  ScanLine,
  Tag,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  company_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  category: string | null;
  brand: string | null;
  product_type: string;
  status: string;
  track_inventory: boolean;
  tax_rate: number;
  tracking_mode: string;
  created_at: string;
  updated_at: string;
};

type Variant = {
  id: string;
  company_id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  cost_price: number;
  selling_price: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type BatchStock = {
  id: string;
  company_id: string;
  batch_id: string;
  product_id: string;
  variant_id: string;
  warehouse_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
  created_at: string;
  updated_at: string;
};

type Batch = {
  id: string;
  company_id: string;
  product_id: string;
  variant_id: string;
  lot_number: string;
  supplier_id: string | null;
  purchase_order_id: string | null;
  purchase_order_item_id: string | null;
  stock_receipt_id: string | null;
  stock_receipt_item_id: string | null;
  received_at: string | null;
  quantity_received: number;
  notes: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  unit_cost: number;
  landed_cost_total: number;
  refurbishment_cost_total: number;
  other_cost_total: number;
  total_cost: number;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
};

type Location = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string;
};

type SerialUnit = {
  id: string;
  variant_id: string | null;
  batch_id: string | null;
  serial_number: string;
  status: string;
  warehouse_id: string | null;
  location_id: string | null;
  cost_price: number | null;
  received_at: string | null;
};

type VariantStats = {
  quantity: number;
  reserved: number;
  available: number;
  batchCount: number;
  serialCount: number;
};

const money = (value: number) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const number = (value: number) =>
  Number(value || 0).toLocaleString();

const formatDate = (value: string | null) => {
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
};

const formatDateTime = (value: string | null) => {
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
};

const trackingLabel = (trackingMode: string) =>
  trackingMode === "none" ? "Not Tracked" : "Tracked";

const batchStatusLabel = (status: string) =>
  status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();

  const productId =
    typeof params?.productId === "string"
      ? params.productId
      : "";

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [product, setProduct] =
    useState<Product | null>(null);

  const [variants, setVariants] = useState<Variant[]>(
    [],
  );

  const [batchStock, setBatchStock] = useState<
    BatchStock[]
  >([]);

  const [batches, setBatches] = useState<Batch[]>([]);

  const [warehouses, setWarehouses] = useState<
    Warehouse[]
  >([]);

  const [locations, setLocations] = useState<
    Location[]
  >([]);

  const [serialUnits, setSerialUnits] = useState<
    SerialUnit[]
  >([]);

  const [expandedVariants, setExpandedVariants] =
    useState<Set<string>>(new Set());

  const [errorMessage, setErrorMessage] = useState("");

  const loadProduct = useCallback(
    async (isRefresh = false) => {
      if (!productId) {
        setErrorMessage("Product ID is missing.");
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!user) {
          router.replace("/login");
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
          throw new Error(
            membershipError.message,
          );
        }

        const companyId =
          membershipData?.company_id;

        if (!companyId) {
          throw new Error(
            "No company workspace is available for your account.",
          );
        }

        const [
          productResult,
          variantsResult,
          stockResult,
          batchesResult,
          warehousesResult,
          locationsResult,
          serialsResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              `
                id,
                company_id,
                name,
                slug,
                description,
                category,
                brand,
                product_type,
                status,
                track_inventory,
                tax_rate,
                tracking_mode,
                created_at,
                updated_at
              `,
            )
            .eq("id", productId)
            .eq("company_id", companyId)
            .maybeSingle(),

          supabase
            .from("product_variants")
            .select(
              `
                id,
                company_id,
                product_id,
                name,
                sku,
                barcode,
                cost_price,
                selling_price,
                is_default,
                is_active,
                created_at,
                updated_at
              `,
            )
            .eq("product_id", productId)
            .eq("company_id", companyId)
            .order("is_default", {
              ascending: false,
            })
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("inventory_batch_stock")
            .select(
              `
                id,
                company_id,
                batch_id,
                product_id,
                variant_id,
                warehouse_id,
                location_id,
                quantity,
                reserved_quantity,
                created_at,
                updated_at
              `,
            )
            .eq("product_id", productId)
            .eq("company_id", companyId),

          supabase
            .from("inventory_batches")
            .select(
              `
                id,
                company_id,
                product_id,
                variant_id,
                lot_number,
                supplier_id,
                purchase_order_id,
                purchase_order_item_id,
                stock_receipt_id,
                stock_receipt_item_id,
                received_at,
                quantity_received,
                notes,
                status,
                created_by,
                created_at,
                updated_at,
                unit_cost,
                landed_cost_total,
                refurbishment_cost_total,
                other_cost_total,
                total_cost
              `,
            )
            .eq("product_id", productId)
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("warehouses")
            .select("id, name, code")
            .eq("company_id", companyId)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("warehouse_locations")
            .select(
              "id, warehouse_id, name, code",
            )
            .eq("company_id", companyId)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("serialized_units")
            .select(
              `
                id,
                variant_id,
                batch_id,
                serial_number,
                status,
                warehouse_id,
                location_id,
                cost_price,
                received_at
              `,
            )
            .eq("product_id", productId)
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (productResult.error) {
          throw new Error(
            productResult.error.message,
          );
        }

        if (!productResult.data) {
          throw new Error(
            "Product not found or you do not have access to it.",
          );
        }

        if (variantsResult.error) {
          throw new Error(
            variantsResult.error.message,
          );
        }

        if (stockResult.error) {
          throw new Error(
            stockResult.error.message,
          );
        }

        if (batchesResult.error) {
          throw new Error(
            batchesResult.error.message,
          );
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

        if (serialsResult.error) {
          throw new Error(
            serialsResult.error.message,
          );
        }

        setProduct(productResult.data as Product);
        setVariants(
          (variantsResult.data ??
            []) as Variant[],
        );
        setBatchStock(
          (stockResult.data ??
            []) as BatchStock[],
        );
        setBatches(
          (batchesResult.data ??
            []) as Batch[],
        );
        setWarehouses(
          (warehousesResult.data ??
            []) as Warehouse[],
        );
        setLocations(
          (locationsResult.data ??
            []) as Location[],
        );
        setSerialUnits(
          (serialsResult.data ??
            []) as SerialUnit[],
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load the product.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [productId, router, supabase],
  );

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

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

  const variantMap = useMemo(() => {
    return new Map(
      variants.map((variant) => [
        variant.id,
        variant,
      ]),
    );
  }, [variants]);

  const batchMap = useMemo(() => {
    return new Map(
      batches.map((batch) => [
        batch.id,
        batch,
      ]),
    );
  }, [batches]);

  const statsByVariant = useMemo(() => {
    const stats = new Map<
      string,
      VariantStats
    >();

    variants.forEach((variant) => {
      stats.set(variant.id, {
        quantity: 0,
        reserved: 0,
        available: 0,
        batchCount: 0,
        serialCount: 0,
      });
    });

    batchStock.forEach((stock) => {
      const current = stats.get(
        stock.variant_id,
      );

      if (!current) return;

      current.quantity += Number(
        stock.quantity || 0,
      );

      current.reserved += Number(
        stock.reserved_quantity || 0,
      );

      current.available += Math.max(
        0,
        Number(stock.quantity || 0) -
          Number(
            stock.reserved_quantity || 0,
          ),
      );
    });

    variants.forEach((variant) => {
      const current = stats.get(variant.id);

      if (!current) return;

      current.batchCount = batches.filter(
        (batch) =>
          batch.variant_id === variant.id,
      ).length;

      current.serialCount =
        serialUnits.filter(
          (serial) =>
            serial.variant_id ===
            variant.id,
        ).length;
    });

    return stats;
  }, [
    batchStock,
    batches,
    serialUnits,
    variants,
  ]);

  const totalQuantity = useMemo(
    () =>
      batchStock.reduce(
        (sum, stock) =>
          sum + Number(stock.quantity || 0),
        0,
      ),
    [batchStock],
  );

  const totalReserved = useMemo(
    () =>
      batchStock.reduce(
        (sum, stock) =>
          sum +
          Number(stock.reserved_quantity || 0),
        0,
      ),
    [batchStock],
  );

  const totalAvailable = Math.max(
    0,
    totalQuantity - totalReserved,
  );

  const totalBatchCount = batches.length;

  const totalSerialCount = serialUnits.length;

  const activeVariantCount =
    variants.filter(
      (variant) => variant.is_active,
    ).length;

  const averageCost = useMemo(() => {
    if (!variants.length) return 0;

    return (
      variants.reduce(
        (sum, variant) =>
          sum +
          Number(variant.cost_price || 0),
        0,
      ) / variants.length
    );
  }, [variants]);

  const averageSellingPrice = useMemo(() => {
    if (!variants.length) return 0;

    return (
      variants.reduce(
        (sum, variant) =>
          sum +
          Number(
            variant.selling_price || 0,
          ),
        0,
      ) / variants.length
    );
  }, [variants]);

  const estimatedInventoryValue =
    useMemo(() => {
      return batchStock.reduce(
        (sum, stock) => {
          const batch =
            batchMap.get(stock.batch_id);

          const quantity = Number(
            stock.quantity || 0,
          );

          const unitCost = Number(
            batch?.unit_cost || 0,
          );

          return sum + quantity * unitCost;
        },
        0,
      );
    }, [batchMap, batchStock]);

  const toggleVariant = (variantId: string) => {
    setExpandedVariants((current) => {
      const next = new Set(current);

      if (next.has(variantId)) {
        next.delete(variantId);
      } else {
        next.add(variantId);
      }

      return next;
    });
  };

  const getVariantStock = (
    variantId: string,
  ) => {
    return batchStock.filter(
      (stock) =>
        stock.variant_id === variantId,
    );
  };

  const getVariantBatches = (
    variantId: string,
  ) => {
    return batches.filter(
      (batch) =>
        batch.variant_id === variantId,
    );
  };

  const getVariantSerials = (
    variantId: string,
  ) => {
    return serialUnits.filter(
      (serial) =>
        serial.variant_id === variantId,
    );
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="loading-card">
            <div className="loading-spinner" />
            <span>
              Loading product details...
            </span>
          </div>

          <style jsx>{`
            .page-content {
              min-height: calc(100vh - 64px);
              padding: 28px;
              background: #f6f8f7;
            }

            .loading-card {
              min-height: 360px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              color: #64748b;
              font-size: 14px;
            }

            .loading-spinner {
              width: 20px;
              height: 20px;
              border: 2px solid #dbe4df;
              border-top-color: #166534;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
            }

            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      </AppShell>
    );
  }

  if (!product) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="error-card">
            <PackageX size={34} />

            <h2>
              Product could not be loaded
            </h2>

            <p>
              {errorMessage ||
                "The requested product does not exist or is unavailable."}
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                router.push("/products")
              }
            >
              <ArrowLeft size={16} />
              Back to Products
            </button>
          </div>

          <style jsx>{`
            .page-content {
              min-height: calc(100vh - 64px);
              padding: 28px;
              background: #f6f8f7;
            }

            .error-card {
              min-height: 400px;
              background: white;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              color: #64748b;
              padding: 30px;
            }

            .error-card svg {
              color: #94a3b8;
            }

            .error-card h2 {
              margin: 14px 0 5px;
              color: #1e293b;
              font-size: 17px;
            }

            .error-card p {
              max-width: 460px;
              margin: 0 0 20px;
              font-size: 13px;
              line-height: 1.5;
            }

            .primary-button {
              min-height: 40px;
              padding: 0 14px;
              display: inline-flex;
              align-items: center;
              gap: 8px;
              border: 1px solid #166534;
              border-radius: 8px;
              background: #166534;
              color: white;
              font-size: 12px;
              font-weight: 700;
              cursor: pointer;
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
          <div className="header-left">
            <button
              type="button"
              className="back-button"
              onClick={() =>
                router.push("/products")
              }
            >
              <ArrowLeft size={17} />
              Back to Products
            </button>

            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Product Details
            </div>

            <div className="title-row">
              <div className="product-icon">
                <Package size={26} />
              </div>

              <div>
                <div className="title-line">
                  <h1 className="page-title">
                    {product.name}
                  </h1>

                  <span
                    className={`status-badge ${
                      product.status ===
                      "active"
                        ? "active"
                        : "inactive"
                    }`}
                  >
                    <span />
                    {product.status}
                  </span>
                </div>

                <p className="page-subtitle">
                  {product.brand ||
                    "No brand"}
                  {product.category
                    ? ` • ${product.category}`
                    : ""}
                  {product.product_type
                    ? ` • ${
                        product.product_type ===
                        "physical"
                          ? "Physical Product"
                          : product.product_type
                      }`
                    : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                loadProduct(true)
              }
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "spinning"
                    : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                router.push(
                  `/products/${product.id}/edit`,
                )
              }
            >
              <Edit3 size={16} />
              Edit Product
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-error">
            <PackageX size={17} />

            <div>
              <strong>
                Some product data could not be loaded
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
            <div className="stat-icon green">
              <Boxes size={19} />
            </div>

            <div>
              <span>Total Stock</span>
              <strong>
                {product.track_inventory
                  ? number(totalQuantity)
                  : "—"}
              </strong>
              <small>
                {product.track_inventory
                  ? "Physical units"
                  : "Inventory disabled"}
              </small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue">
              <PackageCheck size={19} />
            </div>

            <div>
              <span>Available</span>
              <strong>
                {product.track_inventory
                  ? number(totalAvailable)
                  : "—"}
              </strong>
              <small>
                {totalReserved > 0
                  ? `${number(
                      totalReserved,
                    )} reserved`
                  : "Nothing reserved"}
              </small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon purple">
              <Layers3 size={19} />
            </div>

            <div>
              <span>Batches / Lots</span>
              <strong>
                {product.track_inventory
                  ? number(totalBatchCount)
                  : "—"}
              </strong>
              <small>
                Inventory batches
              </small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              <ScanLine size={19} />
            </div>

            <div>
              <span>Serial Numbers</span>
              <strong>
                {product.track_inventory
                  ? number(totalSerialCount)
                  : "—"}
              </strong>
              <small>
                Optional identities
              </small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon slate">
              <Layers3 size={19} />
            </div>

            <div>
              <span>Variants</span>
              <strong>
                {number(variants.length)}
              </strong>
              <small>
                {number(
                  activeVariantCount,
                )}{" "}
                active
              </small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              <DollarSign size={19} />
            </div>

            <div>
              <span>Inventory Value</span>
              <strong>
                {product.track_inventory
                  ? `$${money(
                      estimatedInventoryValue,
                    )}`
                  : "—"}
              </strong>
              <small>
                Based on batch cost
              </small>
            </div>
          </div>
        </div>

        <div className="main-grid">
          <main className="main-column">
            <section className="content-card">
              <div className="card-header">
                <div className="card-heading">
                  <div className="card-icon">
                    <Package size={18} />
                  </div>

                  <div>
                    <h2>
                      Product Information
                    </h2>
                    <p>
                      Core product identity and
                      configuration.
                    </p>
                  </div>
                </div>
              </div>

              <div className="info-grid">
                <div className="info-item">
                  <span>Product Name</span>
                  <strong>
                    {product.name}
                  </strong>
                </div>

                <div className="info-item">
                  <span>Brand</span>
                  <strong>
                    {product.brand || "—"}
                  </strong>
                </div>

                <div className="info-item">
                  <span>Category</span>
                  <strong>
                    {product.category ||
                      "—"}
                  </strong>
                </div>

                <div className="info-item">
                  <span>Product Type</span>
                  <strong>
                    {product.product_type ===
                    "physical"
                      ? "Physical Product"
                      : product.product_type}
                  </strong>
                </div>

                <div className="info-item">
                  <span>Tracking</span>
                  <strong className="inline-status">
                    <span
                      className={`status-dot ${
                        product.track_inventory
                          ? "green-dot"
                          : "gray-dot"
                      }`}
                    />
                    {trackingLabel(
                      product.tracking_mode,
                    )}
                  </strong>
                </div>

                <div className="info-item">
                  <span>Tax Rate</span>
                  <strong>
                    {Number(
                      product.tax_rate || 0,
                    ).toFixed(2)}
                    %
                  </strong>
                </div>

                <div className="info-item">
                  <span>Created</span>
                  <strong>
                    {formatDate(
                      product.created_at,
                    )}
                  </strong>
                </div>

                <div className="info-item">
                  <span>Last Updated</span>
                  <strong>
                    {formatDate(
                      product.updated_at,
                    )}
                  </strong>
                </div>
              </div>

              {product.description && (
                <div className="description-box">
                  <span>Description</span>
                  <p>
                    {product.description}
                  </p>
                </div>
              )}
            </section>

            <section className="content-card">
              <div className="card-header">
                <div className="card-heading">
                  <div className="card-icon">
                    <Layers3 size={18} />
                  </div>

                  <div>
                    <h2>
                      Variants
                    </h2>
                    <p>
                      SKU, barcode, pricing and
                      inventory are managed at
                      variant level.
                    </p>
                  </div>
                </div>

                <span className="count-badge">
                  {variants.length}
                </span>
              </div>

              <div className="variant-table">
                <div className="variant-table-header">
                  <div>Variant</div>
                  <div>SKU / Barcode</div>
                  <div>Pricing</div>
                  <div>Stock</div>
                  <div>Status</div>
                  <div />
                </div>

                {variants.length === 0 ? (
                  <div className="empty-state">
                    <Layers3 size={28} />
                    <strong>
                      No variants found
                    </strong>
                    <p>
                      This product does not have
                      any variants yet.
                    </p>
                  </div>
                ) : (
                  variants.map((variant) => {
                    const stats =
                      statsByVariant.get(
                        variant.id,
                      ) ?? {
                        quantity: 0,
                        reserved: 0,
                        available: 0,
                        batchCount: 0,
                        serialCount: 0,
                      };

                    const expanded =
                      expandedVariants.has(
                        variant.id,
                      );

                    return (
                      <Fragment
                        key={variant.id}
                      >
                        <div
                          className={`variant-row ${
                            expanded
                              ? "expanded"
                              : ""
                          }`}
                        >
                          <div className="variant-name-cell">
                            <button
                              type="button"
                              className="expand-button"
                              onClick={() =>
                                toggleVariant(
                                  variant.id,
                                )
                              }
                            >
                              {expanded ? (
                                <ChevronDown
                                  size={15}
                                />
                              ) : (
                                <ChevronRight
                                  size={15}
                                />
                              )}
                            </button>

                            <div>
                              <strong>
                                {
                                  variant.name
                                }
                              </strong>

                              {variant.is_default && (
                                <span className="default-label">
                                  Default
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="sku-cell">
                            <span>
                              {variant.sku ||
                                "No SKU"}
                            </span>

                            <small>
                              {variant.barcode ||
                                "No barcode"}
                            </small>
                          </div>

                          <div className="price-cell">
                            <strong>
                              $
                              {money(
                                variant.selling_price,
                              )}
                            </strong>

                            <small>
                              Cost $
                              {money(
                                variant.cost_price,
                              )}
                            </small>
                          </div>

                          <div className="stock-cell">
                            {product.track_inventory ? (
                              <>
                                <strong>
                                  {number(
                                    stats.available,
                                  )}
                                </strong>

                                <small>
                                  {number(
                                    stats.quantity,
                                  )}{" "}
                                  total
                                </small>
                              </>
                            ) : (
                              <span className="muted">
                                —
                              </span>
                            )}
                          </div>

                          <div>
                            <span
                              className={`variant-status ${
                                variant.is_active
                                  ? "active"
                                  : "inactive"
                              }`}
                            >
                              <span />
                              {variant.is_active
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </div>

                          <div className="row-action">
                            <button
                              type="button"
                              className="row-expand"
                              onClick={() =>
                                toggleVariant(
                                  variant.id,
                                )
                              }
                            >
                              {expanded
                                ? "Hide"
                                : "View"}
                            </button>
                          </div>
                        </div>

                        {expanded && (
                          <div className="variant-detail">
                            <div className="variant-detail-grid">
                              <div>
                                <span>
                                  Variant SKU
                                </span>

                                <strong>
                                  {variant.sku ||
                                    "—"}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Barcode
                                </span>

                                <strong>
                                  {variant.barcode ||
                                    "—"}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Cost Price
                                </span>

                                <strong>
                                  $
                                  {money(
                                    variant.cost_price,
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Selling Price
                                </span>

                                <strong>
                                  $
                                  {money(
                                    variant.selling_price,
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Batches
                                </span>

                                <strong>
                                  {number(
                                    stats.batchCount,
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Serial Units
                                </span>

                                <strong>
                                  {number(
                                    stats.serialCount,
                                  )}
                                </strong>
                              </div>
                            </div>

                            {product.track_inventory && (
                              <div className="variant-inventory-preview">
                                <div className="mini-section-title">
                                  <WarehouseIcon
                                    size={15}
                                  />
                                  Current Stock
                                  by Location
                                </div>

                                {getVariantStock(
                                  variant.id,
                                ).length ===
                                0 ? (
                                  <div className="mini-empty">
                                    No stock currently
                                    recorded for this
                                    variant.
                                  </div>
                                ) : (
                                  <div className="location-list">
                                    {getVariantStock(
                                      variant.id,
                                    ).map(
                                      (stock) => {
                                        const warehouse =
                                          warehouseMap.get(
                                            stock.warehouse_id,
                                          );

                                        const location =
                                          locationMap.get(
                                            stock.location_id,
                                          );

                                        return (
                                          <div
                                            className="location-row"
                                            key={
                                              stock.id
                                            }
                                          >
                                            <div className="location-name">
                                              <WarehouseIcon
                                                size={
                                                  15
                                                }
                                              />

                                              <div>
                                                <strong>
                                                  {warehouse?.name ||
                                                    "Unknown warehouse"}
                                                </strong>

                                                <small>
                                                  {location?.name ||
                                                    "Unknown location"}
                                                </small>
                                              </div>
                                            </div>

                                            <div className="location-quantity">
                                              <strong>
                                                {number(
                                                  stock.quantity,
                                                )}
                                              </strong>

                                              {Number(
                                                stock.reserved_quantity ||
                                                  0,
                                              ) >
                                                0 && (
                                                <small>
                                                  {number(
                                                    stock.reserved_quantity,
                                                  )}{" "}
                                                  reserved
                                                </small>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      },
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="variant-footer-actions">
                              <button
                                type="button"
                                className="text-button"
                                onClick={() =>
                                  router.push(
                                    `/products/${product.id}/edit`,
                                  )
                                }
                              >
                                <Edit3
                                  size={14}
                                />
                                Edit Product
                              </button>

                              {product.track_inventory && (
                                <>
                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={() =>
                                      router.push(
                                        `/inventory/batches?product=${product.id}&variant=${variant.id}`,
                                      )
                                    }
                                  >
                                    <Layers3
                                      size={14}
                                    />
                                    View Batches
                                  </button>

                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={() =>
                                      router.push(
                                        `/serial-numbers?product=${product.id}&variant=${variant.id}`,
                                      )
                                    }
                                  >
                                    <ScanLine
                                      size={14}
                                    />
                                    View Serials
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </div>
            </section>

            {product.track_inventory && (
              <section className="content-card">
                <div className="card-header">
                  <div className="card-heading">
                    <div className="card-icon">
                      <Layers3 size={18} />
                    </div>

                    <div>
                      <h2>
                        Recent Batches / Lots
                      </h2>

                      <p>
                        Inventory provenance for
                        this product.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="view-all-button"
                    onClick={() =>
                      router.push(
                        `/inventory/batches?product=${product.id}`,
                      )
                    }
                  >
                    View All
                    <ExternalLink
                      size={13}
                    />
                  </button>
                </div>

                {batches.length === 0 ? (
                  <div className="empty-state compact">
                    <Layers3 size={26} />
                    <strong>
                      No batches yet
                    </strong>
                    <p>
                      Batches will appear here
                      when tracked inventory is
                      received.
                    </p>
                  </div>
                ) : (
                  <div className="batch-table">
                    <div className="batch-table-header">
                      <div>Lot / Batch</div>
                      <div>Variant</div>
                      <div>Received</div>
                      <div>Unit Cost</div>
                      <div>Status</div>
                      <div />
                    </div>

                    {batches
                      .slice(0, 8)
                      .map((batch) => {
                        const variant =
                          variantMap.get(
                            batch.variant_id,
                          );

                        return (
                          <div
                            className="batch-row"
                            key={batch.id}
                          >
                            <div className="batch-number">
                              <Layers3
                                size={15}
                              />

                              <div>
                                <strong>
                                  {
                                    batch.lot_number
                                  }
                                </strong>

                                <small>
                                  {formatDate(
                                    batch.received_at,
                                  )}
                                </small>
                              </div>
                            </div>

                            <div>
                              {variant?.name ||
                                "—"}
                            </div>

                            <div>
                              {number(
                                batch.quantity_received,
                              )}
                            </div>

                            <div>
                              $
                              {money(
                                batch.unit_cost,
                              )}
                            </div>

                            <div>
                              <span
                                className={`batch-status ${batch.status}`}
                              >
                                {batchStatusLabel(
                                  batch.status,
                                )}
                              </span>
                            </div>

                            <div>
                              <button
                                type="button"
                                className="small-link"
                                onClick={() =>
                                  router.push(
                                    `/inventory/batches/${batch.id}`,
                                  )
                                }
                              >
                                View
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </section>
            )}
          </main>

          <aside className="side-column">
            <section className="side-card">
              <div className="side-card-header">
                <div className="side-card-icon">
                  <Tag size={17} />
                </div>

                <div>
                  <h3>
                    Product Identity
                  </h3>
                  <p>
                    Primary product information
                  </p>
                </div>
              </div>

              <div className="identity-list">
                <div>
                  <span>Product ID</span>
                  <strong className="id-value">
                    {product.id}
                  </strong>
                </div>

                <div>
                  <span>Slug</span>
                  <strong>
                    {product.slug || "—"}
                  </strong>
                </div>

                <div>
                  <span>Variants</span>
                  <strong>
                    {number(
                      variants.length,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Default Variant</span>
                  <strong>
                    {variants.find(
                      (variant) =>
                        variant.is_default,
                    )?.name || "—"}
                  </strong>
                </div>
              </div>
            </section>

            <section className="side-card">
              <div className="side-card-header">
                <div className="side-card-icon">
                  <Boxes size={17} />
                </div>

                <div>
                  <h3>
                    Inventory Configuration
                  </h3>
                  <p>
                    V2 tracking architecture
                  </p>
                </div>
              </div>

              {product.track_inventory ? (
                <>
                  <div className="tracking-state tracked">
                    <CheckCircle2
                      size={18}
                    />

                    <div>
                      <strong>
                        Inventory Tracked
                      </strong>

                      <span>
                        Batch / lot tracking enabled
                      </span>
                    </div>
                  </div>

                  <div className="hierarchy">
                    <div className="hierarchy-item">
                      <span>1</span>
                      <div>
                        <strong>
                          Product
                        </strong>
                        <small>
                          {product.name}
                        </small>
                      </div>
                    </div>

                    <div className="hierarchy-line" />

                    <div className="hierarchy-item">
                      <span>2</span>
                      <div>
                        <strong>
                          Variant
                        </strong>
                        <small>
                          {number(
                            variants.length,
                          )}{" "}
                          variants
                        </small>
                      </div>
                    </div>

                    <div className="hierarchy-line" />

                    <div className="hierarchy-item">
                      <span>3</span>
                      <div>
                        <strong>
                          Batch / Lot
                        </strong>
                        <small>
                          {number(
                            totalBatchCount,
                          )}{" "}
                          batches
                        </small>
                      </div>
                    </div>

                    <div className="hierarchy-line" />

                    <div className="hierarchy-item">
                      <span>4</span>
                      <div>
                        <strong>
                          Serialized Units
                        </strong>
                        <small>
                          Optional child identities
                        </small>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="tracking-state not-tracked">
                  <PackageX size={18} />

                  <div>
                    <strong>
                      Inventory Not Tracked
                    </strong>

                    <span>
                      No batch or stock balance is
                      maintained.
                    </span>
                  </div>
                </div>
              )}
            </section>

            <section className="side-card">
              <div className="side-card-header">
                <div className="side-card-icon">
                  <DollarSign size={17} />
                </div>

                <div>
                  <h3>
                    Pricing Overview
                  </h3>
                  <p>
                    Across all variants
                  </p>
                </div>
              </div>

              <div className="pricing-overview">
                <div>
                  <span>
                    Average Cost
                  </span>
                  <strong>
                    ${money(averageCost)}
                  </strong>
                </div>

                <div>
                  <span>
                    Average Selling
                  </span>
                  <strong>
                    $
                    {money(
                      averageSellingPrice,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Tax Rate
                  </span>
                  <strong>
                    {Number(
                      product.tax_rate || 0,
                    ).toFixed(2)}
                    %
                  </strong>
                </div>
              </div>
            </section>

            <section className="side-card">
              <div className="side-card-header">
                <div className="side-card-icon">
                  <WarehouseIcon
                    size={17}
                  />
                </div>

                <div>
                  <h3>
                    Warehouse Distribution
                  </h3>
                  <p>
                    Current physical stock
                  </p>
                </div>
              </div>

              {!product.track_inventory ||
              batchStock.length === 0 ? (
                <div className="side-empty">
                  <MapPin size={20} />
                  <span>
                    No warehouse stock
                    available.
                  </span>
                </div>
              ) : (
                <div className="warehouse-list">
                  {Array.from(
                    batchStock.reduce(
                      (map, stock) => {
                        const key =
                          stock.warehouse_id;

                        const current =
                          map.get(key) ?? {
                            quantity: 0,
                            reserved: 0,
                          };

                        current.quantity +=
                          Number(
                            stock.quantity ||
                              0,
                          );

                        current.reserved +=
                          Number(
                            stock.reserved_quantity ||
                              0,
                          );

                        map.set(
                          key,
                          current,
                        );

                        return map;
                      },
                      new Map<
                        string,
                        {
                          quantity: number;
                          reserved: number;
                        }
                      >(),
                    ),
                  ).map(
                    ([
                      warehouseId,
                      stock,
                    ]) => {
                      const warehouse =
                        warehouseMap.get(
                          warehouseId,
                        );

                      return (
                        <div
                          className="warehouse-row"
                          key={warehouseId}
                        >
                          <div className="warehouse-name">
                            <WarehouseIcon
                              size={15}
                            />

                            <div>
                              <strong>
                                {warehouse?.name ||
                                  "Unknown warehouse"}
                              </strong>

                              <small>
                                {warehouse?.code ||
                                  "—"}
                              </small>
                            </div>
                          </div>

                          <div className="warehouse-qty">
                            <strong>
                              {number(
                                Math.max(
                                  0,
                                  stock.quantity -
                                    stock.reserved,
                                ),
                              )}
                            </strong>

                            <small>
                              available
                            </small>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </section>

            <section className="side-card">
              <div className="side-card-header">
                <div className="side-card-icon">
                  <Clock3 size={17} />
                </div>

                <div>
                  <h3>
                    Product Timeline
                  </h3>
                  <p>
                    Record timestamps
                  </p>
                </div>
              </div>

              <div className="timeline">
                <div className="timeline-item">
                  <span className="timeline-dot" />

                  <div>
                    <strong>
                      Product Created
                    </strong>

                    <small>
                      {formatDateTime(
                        product.created_at,
                      )}
                    </small>
                  </div>
                </div>

                <div className="timeline-item">
                  <span className="timeline-dot" />

                  <div>
                    <strong>
                      Last Updated
                    </strong>

                    <small>
                      {formatDateTime(
                        product.updated_at,
                      )}
                    </small>
                  </div>
                </div>
              </div>
            </section>

            <section className="quick-actions-card">
              <div className="quick-actions-title">
                Quick Actions
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/products/${product.id}/edit`,
                  )
                }
              >
                <Edit3 size={15} />
                Edit Product
                <ChevronRight
                  size={14}
                />
              </button>

              {product.track_inventory && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/inventory/batches?product=${product.id}`,
                      )
                    }
                  >
                    <Layers3 size={15} />
                    View Batches
                    <ChevronRight
                      size={14}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/serial-numbers?product=${product.id}`,
                      )
                    }
                  >
                    <ScanLine size={15} />
                    View Serial Numbers
                    <ChevronRight
                      size={14}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/inventory?product=${product.id}`,
                      )
                    }
                  >
                    <Boxes size={15} />
                    View Inventory
                    <ChevronRight
                      size={14}
                    />
                  </button>
                </>
              )}
            </section>
          </aside>
        </div>

        <div className="bottom-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push("/products")
            }
          >
            <ArrowLeft size={16} />
            Back to Products
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              router.push(
                `/products/${product.id}/edit`,
              )
            }
          >
            <Edit3 size={16} />
            Edit Product
          </button>
        </div>
      </div>

      <style jsx>{`
        .page-content {
          min-height: calc(100vh - 64px);
          padding: 28px;
          background: #f6f8f7;
        }

        .page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 22px;
        }

        .header-left {
          min-width: 0;
        }

        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 0;
          background: transparent;
          color: #64748b;
          font-size: 13px;
          font-weight: 650;
          padding: 0;
          margin-bottom: 14px;
          cursor: pointer;
        }

        .back-button:hover {
          color: #166534;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-size: 11px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 9px;
        }

        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #16a34a;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .product-icon {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid #dcfce7;
          background: #f0fdf4;
          color: #166534;
          border-radius: 13px;
        }

        .title-line {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .page-title {
          margin: 0;
          color: #172033;
          font-size: 29px;
          line-height: 1.15;
          font-weight: 750;
          letter-spacing: -0.02em;
        }

        .page-subtitle {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .status-badge,
        .variant-status,
        .batch-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 750;
          text-transform: capitalize;
        }

        .status-badge span,
        .variant-status span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .status-badge.active,
        .variant-status.active {
          background: #f0fdf4;
          color: #166534;
        }

        .status-badge.active span,
        .variant-status.active span {
          background: #16a34a;
        }

        .status-badge.inactive,
        .variant-status.inactive {
          background: #f1f5f9;
          color: #64748b;
        }

        .status-badge.inactive span,
        .variant-status.inactive span {
          background: #94a3b8;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-shrink: 0;
        }

        .primary-button,
        .secondary-button {
          min-height: 40px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
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
          border: 1px solid #d6dce2;
          background: white;
          color: #334155;
        }

        .secondary-button:hover {
          background: #f8fafc;
          border-color: #bdc6cf;
        }

        .spinning {
          animation: spin 0.8s linear infinite;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          margin-bottom: 18px;
          border-radius: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .alert > div {
          flex: 1;
        }

        .alert strong {
          display: block;
          font-size: 12px;
          margin-bottom: 2px;
        }

        .alert p {
          margin: 0;
          font-size: 11px;
          line-height: 1.45;
        }

        .alert button {
          border: 0;
          background: transparent;
          color: inherit;
          font-size: 20px;
          cursor: pointer;
          line-height: 1;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .stat-card {
          min-width: 0;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 15px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.025);
        }

        .stat-icon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 9px;
        }

        .stat-icon.green {
          background: #f0fdf4;
          color: #166534;
        }

        .stat-icon.blue {
          background: #eff6ff;
          color: #2563eb;
        }

        .stat-icon.purple {
          background: #faf5ff;
          color: #7e22ce;
        }

        .stat-icon.orange {
          background: #fff7ed;
          color: #c2410c;
        }

        .stat-icon.slate {
          background: #f1f5f9;
          color: #475569;
        }

        .stat-card span {
          display: block;
          color: #64748b;
          font-size: 10px;
          font-weight: 650;
          margin-bottom: 3px;
          white-space: nowrap;
        }

        .stat-card strong {
          display: block;
          color: #172033;
          font-size: 17px;
          line-height: 1.2;
        }

        .stat-card small {
          display: block;
          margin-top: 3px;
          color: #94a3b8;
          font-size: 9px;
          white-space: nowrap;
        }

        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 310px;
          gap: 20px;
          align-items: start;
        }

        .main-column,
        .side-column {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .content-card,
        .side-card,
        .quick-actions-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 13px;
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.025);
          overflow: hidden;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 18px 19px;
          border-bottom: 1px solid #e5e7eb;
        }

        .card-heading {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .card-icon,
        .side-card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #166534;
          background: #f0fdf4;
          border: 1px solid #dcfce7;
          border-radius: 8px;
        }

        .card-icon {
          width: 35px;
          height: 35px;
        }

        .side-card-icon {
          width: 32px;
          height: 32px;
        }

        .card-heading h2 {
          margin: 0;
          color: #1e293b;
          font-size: 15px;
          font-weight: 750;
        }

        .card-heading p {
          margin: 3px 0 0;
          color: #94a3b8;
          font-size: 10px;
        }

        .count-badge {
          min-width: 25px;
          height: 25px;
          padding: 0 7px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: #f1f5f9;
          color: #475569;
          font-size: 10px;
          font-weight: 750;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0;
        }

        .info-item {
          padding: 15px 18px;
          border-right: 1px solid #edf0f2;
          border-bottom: 1px solid #edf0f2;
          min-width: 0;
        }

        .info-item:nth-child(4n) {
          border-right: 0;
        }

        .info-item:nth-last-child(-n + 4) {
          border-bottom: 0;
        }

        .info-item > span {
          display: block;
          color: #94a3b8;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 750;
          margin-bottom: 5px;
        }

        .info-item > strong {
          display: block;
          color: #334155;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .inline-status {
          display: flex !important;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .green-dot {
          background: #16a34a;
        }

        .gray-dot {
          background: #94a3b8;
        }

        .description-box {
          margin: 0 18px 18px;
          padding: 13px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #f8fafc;
        }

        .description-box > span {
          display: block;
          color: #94a3b8;
          font-size: 9px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }

        .description-box p {
          margin: 0;
          color: #475569;
          font-size: 12px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .variant-table,
        .batch-table {
          width: 100%;
        }

        .variant-table-header,
        .variant-row {
          display: grid;
          grid-template-columns:
            minmax(170px, 1.5fr)
            minmax(150px, 1.2fr)
            minmax(110px, 0.8fr)
            minmax(80px, 0.7fr)
            minmax(80px, 0.7fr)
            55px;
          align-items: center;
          min-width: 790px;
        }

        .variant-table-header {
          min-height: 38px;
          padding: 0 14px;
          background: #f8fafc;
          color: #64748b;
          border-bottom: 1px solid #e5e7eb;
          font-size: 9px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .variant-row {
          min-height: 68px;
          padding: 0 14px;
          border-bottom: 1px solid #edf0f2;
          color: #475569;
          font-size: 11px;
        }

        .variant-row:last-child {
          border-bottom: 0;
        }

        .variant-row.expanded {
          background: #fbfdfb;
        }

        .variant-name-cell {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .variant-name-cell > div {
          min-width: 0;
        }

        .variant-name-cell strong {
          display: block;
          color: #1e293b;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .expand-button {
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: white;
          color: #64748b;
          cursor: pointer;
        }

        .expand-button:hover {
          color: #166534;
          border-color: #b8cdbd;
        }

        .default-label {
          display: inline-block;
          margin-top: 3px;
          padding: 2px 6px;
          border-radius: 999px;
          background: #dcfce7;
          color: #166534;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .sku-cell span,
        .sku-cell small,
        .price-cell strong,
        .price-cell small,
        .stock-cell strong,
        .stock-cell small {
          display: block;
        }

        .sku-cell span {
          color: #334155;
          font-weight: 650;
          font-size: 11px;
        }

        .sku-cell small,
        .price-cell small,
        .stock-cell small {
          color: #94a3b8;
          font-size: 9px;
          margin-top: 3px;
        }

        .price-cell strong,
        .stock-cell strong {
          color: #1e293b;
          font-size: 12px;
        }

        .muted {
          color: #94a3b8;
        }

        .row-action {
          display: flex;
          justify-content: flex-end;
        }

        .row-expand {
          border: 0;
          background: transparent;
          color: #166534;
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
        }

        .variant-detail {
          padding: 15px 19px 16px 53px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
        }

        .variant-detail-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
        }

        .variant-detail-grid > div {
          padding: 10px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          min-width: 0;
        }

        .variant-detail-grid span {
          display: block;
          color: #94a3b8;
          font-size: 8px;
          text-transform: uppercase;
          font-weight: 750;
          margin-bottom: 4px;
        }

        .variant-detail-grid strong {
          display: block;
          color: #334155;
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .variant-inventory-preview {
          margin-top: 12px;
          padding: 12px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
        }

        .mini-section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #475569;
          font-size: 10px;
          font-weight: 750;
          margin-bottom: 9px;
        }

        .mini-empty {
          color: #94a3b8;
          font-size: 10px;
          padding: 8px 0;
        }

        .location-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .location-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 9px;
          background: #f8fafc;
          border: 1px solid #edf0f2;
          border-radius: 7px;
        }

        .location-name,
        .warehouse-name {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          color: #64748b;
        }

        .location-name > div,
        .warehouse-name > div {
          min-width: 0;
        }

        .location-name strong,
        .warehouse-name strong {
          display: block;
          color: #334155;
          font-size: 10px;
        }

        .location-name small,
        .warehouse-name small {
          display: block;
          color: #94a3b8;
          font-size: 8px;
          margin-top: 2px;
        }

        .location-quantity {
          text-align: right;
          flex-shrink: 0;
        }

        .location-quantity strong {
          display: block;
          color: #1e293b;
          font-size: 11px;
        }

        .location-quantity small {
          display: block;
          color: #94a3b8;
          font-size: 8px;
          margin-top: 2px;
        }

        .variant-footer-actions {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 12px;
        }

        .text-button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: 0;
          background: transparent;
          padding: 0;
          color: #166534;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .text-button:hover {
          color: #14532d;
        }

        .empty-state {
          min-height: 190px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #94a3b8;
          padding: 20px;
        }

        .empty-state strong {
          margin-top: 8px;
          color: #475569;
          font-size: 12px;
        }

        .empty-state p {
          margin: 4px 0 0;
          font-size: 10px;
        }

        .empty-state.compact {
          min-height: 150px;
        }

        .view-all-button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: 0;
          background: transparent;
          color: #166534;
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
        }

        .batch-table {
          overflow-x: auto;
        }

        .batch-table-header,
        .batch-row {
          display: grid;
          grid-template-columns:
            minmax(180px, 1.4fr)
            minmax(120px, 1fr)
            minmax(80px, 0.7fr)
            minmax(90px, 0.7fr)
            minmax(100px, 0.8fr)
            50px;
          align-items: center;
          min-width: 650px;
        }

        .batch-table-header {
          min-height: 37px;
          padding: 0 16px;
          background: #f8fafc;
          color: #64748b;
          border-bottom: 1px solid #e5e7eb;
          font-size: 9px;
          font-weight: 750;
          text-transform: uppercase;
        }

        .batch-row {
          min-height: 59px;
          padding: 0 16px;
          border-bottom: 1px solid #edf0f2;
          color: #475569;
          font-size: 10px;
        }

        .batch-row:last-child {
          border-bottom: 0;
        }

        .batch-number {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #166534;
        }

        .batch-number div {
          min-width: 0;
        }

        .batch-number strong,
        .batch-number small {
          display: block;
        }

        .batch-number strong {
          color: #334155;
          font-size: 10px;
        }

        .batch-number small {
          color: #94a3b8;
          font-size: 8px;
          margin-top: 2px;
        }

        .batch-status {
          background: #f1f5f9;
          color: #64748b;
          font-size: 8px;
        }

        .batch-status.active {
          background: #f0fdf4;
          color: #166534;
        }

        .batch-status.depleted {
          background: #f8fafc;
          color: #64748b;
        }

        .batch-status.quarantined {
          background: #fff7ed;
          color: #c2410c;
        }

        .batch-status.closed {
          background: #f1f5f9;
          color: #64748b;
        }

        .small-link {
          border: 0;
          background: transparent;
          color: #166534;
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
        }

        .side-card {
          padding: 17px;
        }

        .side-card-header {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 15px;
        }

        .side-card-header h3 {
          margin: 0;
          color: #1e293b;
          font-size: 12px;
          font-weight: 750;
        }

        .side-card-header p {
          margin: 3px 0 0;
          color: #94a3b8;
          font-size: 9px;
        }

        .identity-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .identity-list > div {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          padding: 9px 0;
          border-bottom: 1px solid #edf0f2;
        }

        .identity-list > div:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .identity-list span {
          color: #94a3b8;
          font-size: 9px;
        }

        .identity-list strong {
          max-width: 180px;
          color: #334155;
          font-size: 10px;
          text-align: right;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .identity-list .id-value {
          font-family: monospace;
          font-size: 8px;
          color: #64748b;
        }

        .tracking-state {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 11px;
          border-radius: 9px;
        }

        .tracking-state.tracked {
          color: #166534;
          background: #f0fdf4;
          border: 1px solid #dcfce7;
        }

        .tracking-state.not-tracked {
          color: #64748b;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
        }

        .tracking-state > div {
          min-width: 0;
        }

        .tracking-state strong,
        .tracking-state span {
          display: block;
        }

        .tracking-state strong {
          font-size: 10px;
          margin-bottom: 3px;
        }

        .tracking-state span {
          color: #64748b;
          font-size: 9px;
          line-height: 1.4;
        }

        .hierarchy {
          margin-top: 15px;
        }

        .hierarchy-item {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .hierarchy-item > span {
          width: 23px;
          height: 23px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 7px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 9px;
          font-weight: 750;
        }

        .hierarchy-item > div {
          min-width: 0;
        }

        .hierarchy-item strong,
        .hierarchy-item small {
          display: block;
        }

        .hierarchy-item strong {
          color: #334155;
          font-size: 10px;
        }

        .hierarchy-item small {
          color: #94a3b8;
          font-size: 8px;
          margin-top: 2px;
        }

        .hierarchy-line {
          width: 1px;
          height: 12px;
          margin-left: 11px;
          background: #dbe4df;
        }

        .pricing-overview {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .pricing-overview > div {
          padding: 11px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f8fafc;
        }

        .pricing-overview > div:last-child {
          grid-column: 1 / -1;
        }

        .pricing-overview span {
          display: block;
          color: #94a3b8;
          font-size: 8px;
          margin-bottom: 4px;
        }

        .pricing-overview strong {
          display: block;
          color: #1e293b;
          font-size: 13px;
        }

        .warehouse-list {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .warehouse-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 9px;
          border: 1px solid #edf0f2;
          border-radius: 8px;
          background: #f8fafc;
        }

        .warehouse-qty {
          text-align: right;
          flex-shrink: 0;
        }

        .warehouse-qty strong,
        .warehouse-qty small {
          display: block;
        }

        .warehouse-qty strong {
          color: #1e293b;
          font-size: 11px;
        }

        .warehouse-qty small {
          color: #94a3b8;
          font-size: 8px;
          margin-top: 2px;
        }

        .side-empty {
          min-height: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: #94a3b8;
          font-size: 9px;
          text-align: center;
        }

        .timeline {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 17px;
        }

        .timeline::before {
          content: "";
          position: absolute;
          left: 4px;
          top: 7px;
          bottom: 7px;
          width: 1px;
          background: #e2e8f0;
        }

        .timeline-item {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          position: relative;
        }

        .timeline-dot {
          width: 9px;
          height: 9px;
          margin-top: 3px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #166534;
          border: 2px solid white;
          box-shadow: 0 0 0 1px #bbf7d0;
        }

        .timeline-item strong,
        .timeline-item small {
          display: block;
        }

        .timeline-item strong {
          color: #334155;
          font-size: 10px;
        }

        .timeline-item small {
          color: #94a3b8;
          font-size: 8px;
          margin-top: 3px;
        }

        .quick-actions-card {
          padding: 15px;
        }

        .quick-actions-title {
          color: #94a3b8;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin: 0 0 9px 3px;
        }

        .quick-actions-card button {
          width: 100%;
          min-height: 37px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 9px;
          border: 0;
          border-bottom: 1px solid #edf0f2;
          background: transparent;
          color: #475569;
          text-align: left;
          font-size: 10px;
          font-weight: 650;
          cursor: pointer;
        }

        .quick-actions-card button:last-child {
          border-bottom: 0;
        }

        .quick-actions-card button svg:last-child {
          margin-left: auto;
          color: #cbd5e1;
        }

        .quick-actions-card button:hover {
          color: #166534;
          background: #f8fafc;
        }

        .bottom-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 20px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1250px) {
          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .main-grid {
            grid-template-columns: minmax(0, 1fr) 290px;
          }

          .info-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .info-item:nth-child(4n) {
            border-right: 1px solid #edf0f2;
          }

          .info-item:nth-child(2n) {
            border-right: 0;
          }

          .info-item:nth-last-child(-n + 4) {
            border-bottom: 1px solid #edf0f2;
          }

          .info-item:nth-last-child(-n + 2) {
            border-bottom: 0;
          }

          .variant-detail-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 1000px) {
          .main-grid {
            grid-template-columns: 1fr;
          }

          .side-column {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-items: start;
          }

          .quick-actions-card {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 760px) {
          .page-content {
            padding: 20px 15px;
          }

          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .side-column {
            grid-template-columns: 1fr;
          }

          .quick-actions-card {
            grid-column: auto;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .info-item,
          .info-item:nth-child(2n),
          .info-item:nth-child(4n) {
            border-right: 0;
            border-bottom: 1px solid #edf0f2;
          }

          .info-item:last-child {
            border-bottom: 0;
          }

          .variant-table {
            overflow-x: auto;
          }

          .variant-detail {
            padding-left: 15px;
          }

          .variant-detail-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .bottom-actions {
            flex-direction: column-reverse;
          }

          .bottom-actions button {
            width: 100%;
          }
        }

        @media (max-width: 500px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .title-row {
            align-items: flex-start;
          }

          .product-icon {
            width: 44px;
            height: 44px;
          }

          .page-title {
            font-size: 24px;
          }

          .header-actions {
            flex-direction: column;
          }

          .header-actions button {
            width: 100%;
          }

          .variant-detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AppShell>
  );
}