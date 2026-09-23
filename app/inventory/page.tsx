"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DollarSign,
  MapPin,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Truck,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { useRegionalSettings } from "@/app/components/regional-settings-provider";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/regional-settings";

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  status: string | null;
  tracking_mode: string | null;
  track_inventory: boolean | null;
};

type Variant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
  barcode: string | null;
  cost_price: number | null;
  selling_price: number | null;
  is_active: boolean | null;
};

type Batch = {
  id: string;
  product_id: string;
  variant_id: string | null;
  lot_number: string;
  quantity_received: number;
  unit_cost: number | null;
  total_cost: number | null;
  status: string | null;
  received_at: string | null;
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

type WarehouseRow = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean | null;
  is_default: boolean | null;
};

type LocationRow = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string | null;
  location_type: string | null;
  is_active: boolean | null;
};

type SerializedUnit = {
  id: string;
  product_id: string;
  variant_id: string | null;
  batch_id: string | null;
  serial_number: string;
  barcode: string | null;
  status: string;
  warehouse_id: string | null;
  location_id: string | null;
  cost_price: number | null;
  warranty_end: string | null;
  received_at: string | null;
};

type Movement = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  movement_type: string;
  quantity: number;
  quantity_before: number | null;
  quantity_after: number | null;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  warehouse_id: string | null;
  location_id: string | null;
  batch_id: string | null;
  unit_id: string | null;
};

type StockRow = {
  key: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string;
  sku: string;
  barcode: string;
  brand: string;
  category: string;
  trackingMode: string;
  physical: number;
  reserved: number;
  available: number;
  batches: number;
  locations: number;
  warehouses: number;
  unitCost: number;
  stockValue: number;
};

const PAGE_SIZE = 25;

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

const formatDate = (
  value: string | null | undefined,
) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatRelative = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const difference =
    Date.now() - date.getTime();

  const minutes = Math.floor(
    difference / 60000,
  );

  const hours = Math.floor(
    difference / 3600000,
  );

  const days = Math.floor(
    difference / 86400000,
  );

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return formatDate(value);
};

const movementLabel = (
  movementType: string,
) => {
  switch (movementType) {
    case "stock_in":
      return "Stock In";
    case "stock_out":
      return "Stock Out";
    case "adjustment_in":
      return "Adjustment In";
    case "adjustment_out":
      return "Adjustment Out";
    case "transfer_in":
      return "Transfer In";
    case "transfer_out":
      return "Transfer Out";
    case "return":
      return "Return";
    case "sale":
      return "Sale";
    case "purchase":
      return "Purchase";
    default:
      return movementType.replace(
        /_/g,
        " ",
      );
  }
};

const isInboundMovement = (
  movementType: string,
) =>
  [
    "stock_in",
    "adjustment_in",
    "transfer_in",
    "return",
    "purchase",
  ].includes(movementType);

const trackingLabel = (
  trackingMode: string,
) => {
  switch (trackingMode) {
    case "serial":
      return "Serial";
    case "batch":
      return "Batch";
    case "none":
      return "Not tracked";
    default:
      return "Batch";
  }
};

export default function InventoryPage() {
  const router = useRouter();
  const { settings } = useRegionalSettings();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [products, setProducts] =
    useState<Product[]>([]);

  const [variants, setVariants] =
    useState<Variant[]>([]);

  const [batches, setBatches] =
    useState<Batch[]>([]);

  const [batchStock, setBatchStock] =
    useState<BatchStock[]>([]);

  const [warehouses, setWarehouses] =
    useState<WarehouseRow[]>([]);

  const [locations, setLocations] =
    useState<LocationRow[]>([]);

  const [serializedUnits, setSerializedUnits] =
    useState<SerializedUnit[]>([]);

  const [movements, setMovements] =
    useState<Movement[]>([]);

  const [search, setSearch] =
    useState("");

  const [warehouseFilter, setWarehouseFilter] =
    useState("all");

  const [trackingFilter, setTrackingFilter] =
    useState("all");

  const [stockFilter, setStockFilter] =
    useState("all");

  const [page, setPage] =
    useState(1);

  const [period, setPeriod] =
    useState("30");

  const loadInventory = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        // AppShell currently resolves the workspace company from the
        // authenticated user's first company membership. Inventory must
        // use that same company explicitly on every query. RLS protects
        // tenant access, while this filter keeps the UI scoped to the
        // currently selected workspace instead of showing every company
        // the user belongs to.
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!user) {
          throw new Error("You must be signed in to view inventory.");
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
          throw new Error(membershipError.message);
        }

        const companyId = membershipData?.company_id;

        if (!companyId) {
          throw new Error("No company workspace is available for this account.");
        }

        const [
          productsResult,
          variantsResult,
          batchesResult,
          batchStockResult,
          warehousesResult,
          locationsResult,
          serializedResult,
          movementsResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id,name,brand,category,status,tracking_mode,track_inventory",
            )
            .eq("company_id", companyId),

          supabase
            .from("product_variants")
            .select(
              "id,product_id,name,sku,barcode,cost_price,selling_price,is_active",
            )
            .eq("company_id", companyId),

          supabase
            .from("inventory_batches")
            .select(
              "id,product_id,variant_id,lot_number,quantity_received,unit_cost,total_cost,status,received_at",
            )
            .eq("company_id", companyId),

          supabase
            .from("inventory_batch_stock")
            .select(
              "id,batch_id,product_id,variant_id,warehouse_id,location_id,quantity,reserved_quantity",
            )
            .eq("company_id", companyId),

          supabase
            .from("warehouses")
            .select(
              "id,name,code,is_active,is_default",
            )
            .eq("company_id", companyId)
            .order("name"),

          supabase
            .from("warehouse_locations")
            .select(
              "id,warehouse_id,name,code,location_type,is_active",
            )
            .eq("company_id", companyId)
            .order("name"),

          supabase
            .from("serialized_units")
            .select(
              "id,product_id,variant_id,batch_id,serial_number,barcode,status,warehouse_id,location_id,cost_price,warranty_end,received_at",
            )
            .eq("company_id", companyId),

          supabase
            .from("inventory_movements")
            .select(
              "id,product_id,variant_id,movement_type,quantity,quantity_before,quantity_after,reference_type,reference_id,reason,notes,created_at,warehouse_id,location_id,batch_id,unit_id",
            )
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            })
            .limit(100),
        ]);

        if (productsResult.error) {
          throw new Error(productsResult.error.message);
        }

        if (variantsResult.error) {
          throw new Error(variantsResult.error.message);
        }

        if (batchesResult.error) {
          throw new Error(batchesResult.error.message);
        }

        if (batchStockResult.error) {
          throw new Error(batchStockResult.error.message);
        }

        if (warehousesResult.error) {
          throw new Error(warehousesResult.error.message);
        }

        if (locationsResult.error) {
          throw new Error(locationsResult.error.message);
        }

        if (serializedResult.error) {
          throw new Error(serializedResult.error.message);
        }

        if (movementsResult.error) {
          throw new Error(movementsResult.error.message);
        }

        setProducts((productsResult.data ?? []) as Product[]);
        setVariants((variantsResult.data ?? []) as Variant[]);
        setBatches((batchesResult.data ?? []) as Batch[]);
        setBatchStock((batchStockResult.data ?? []) as BatchStock[]);
        setWarehouses((warehousesResult.data ?? []) as WarehouseRow[]);
        setLocations((locationsResult.data ?? []) as LocationRow[]);
        setSerializedUnits((serializedResult.data ?? []) as SerializedUnit[]);
        setMovements((movementsResult.data ?? []) as Movement[]);
      } catch (error) {
        console.error("Failed to load inventory:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load inventory.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

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

  const locationMap = useMemo(
    () =>
      new Map(
        locations.map((location) => [
          location.id,
          location,
        ]),
      ),
    [locations],
  );

  const serialsByBatch = useMemo(() => {
    const map = new Map<
      string,
      SerializedUnit[]
    >();

    serializedUnits.forEach((unit) => {
      if (!unit.batch_id) return;

      const existing =
        map.get(unit.batch_id) ?? [];

      existing.push(unit);

      map.set(
        unit.batch_id,
        existing,
      );
    });

    return map;
  }, [serializedUnits]);

  /*
   * SEARCH IS APPLIED TO THE RAW INVENTORY
   * RECORDS BEFORE GROUPING.
   *
   * This is important:
   *
   * Searching for a SKU, batch, warehouse,
   * location or serial can therefore find
   * the product correctly even though the
   * final table is grouped by product/variant.
   */

  const searchableBatchStock =
    useMemo(() => {
      const term =
        search.trim().toLowerCase();

      return batchStock.filter(
        (stock) => {
          if (
            warehouseFilter !== "all" &&
            stock.warehouse_id !==
              warehouseFilter
          ) {
            return false;
          }

          const product =
            productMap.get(
              stock.product_id,
            );

          const variant = stock.variant_id
            ? variantMap.get(
                stock.variant_id,
              )
            : null;

          const batch =
            batchMap.get(
              stock.batch_id,
            );

          const warehouse =
            warehouseMap.get(
              stock.warehouse_id,
            );

          const location =
            locationMap.get(
              stock.location_id,
            );

          const trackingMode =
            product?.tracking_mode ||
            "batch";

          if (
            trackingFilter !== "all" &&
            trackingMode !==
              trackingFilter
          ) {
            return false;
          }

          const available =
            Math.max(
              0,
              stock.quantity -
                stock.reserved_quantity,
            );

          if (
            stockFilter === "available" &&
            available <= 0
          ) {
            return false;
          }

          if (
            stockFilter === "low" &&
            (available <= 0 ||
              available >= 5)
          ) {
            return false;
          }

          if (
            stockFilter === "out" &&
            available > 0
          ) {
            return false;
          }

          if (
            stockFilter === "reserved" &&
            stock.reserved_quantity <= 0
          ) {
            return false;
          }

          if (!term) {
            return true;
          }

          const relatedSerials =
            serialsByBatch.get(
              stock.batch_id,
            ) ?? [];

          const serialSearchText =
            relatedSerials
              .flatMap((unit) => [
                unit.serial_number,
                unit.barcode ?? "",
              ])
              .join(" ");

          const searchableText = [
            product?.name ?? "",
            product?.brand ?? "",
            product?.category ?? "",
            variant?.name ?? "",
            variant?.sku ?? "",
            variant?.barcode ?? "",
            batch?.lot_number ?? "",
            warehouse?.name ?? "",
            warehouse?.code ?? "",
            location?.name ?? "",
            location?.code ?? "",
            serialSearchText,
          ]
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            term,
          );
        },
      );
    }, [
      batchStock,
      productMap,
      variantMap,
      batchMap,
      warehouseMap,
      locationMap,
      serialsByBatch,
      search,
      warehouseFilter,
      trackingFilter,
      stockFilter,
    ]);

  /*
   * GROUP THE PHYSICAL BATCH STOCK INTO
   * PRODUCT + VARIANT ROWS.
   *
   * inventory_batch_stock remains the
   * source of truth.
   */

  const stockRows = useMemo<
    StockRow[]
  >(() => {
    const grouped =
      new Map<string, StockRow>();

    searchableBatchStock.forEach(
      (stock) => {
        const product =
          productMap.get(
            stock.product_id,
          );

        if (!product) return;

        const variant =
          stock.variant_id
            ? variantMap.get(
                stock.variant_id,
              )
            : null;

        const key = stock.variant_id
          ? `${stock.product_id}:${stock.variant_id}`
          : stock.product_id;

        const available = Math.max(
          0,
          stock.quantity -
            stock.reserved_quantity,
        );

        const batch =
          batchMap.get(
            stock.batch_id,
          );

        const unitCost = Number(
          variant?.cost_price ??
            batch?.unit_cost ??
            0,
        );

        const existing =
          grouped.get(key);

        if (existing) {
          existing.physical +=
            stock.quantity;

          existing.reserved +=
            stock.reserved_quantity;

          existing.available +=
            available;

          existing.batches += 1;

          existing.locations += 1;

          existing.warehouses += 1;

          return;
        }

        grouped.set(key, {
          key,
          productId:
            stock.product_id,
          variantId:
            stock.variant_id,
          productName:
            product.name,
          variantName:
            variant?.name ||
            "Default Variant",
          sku:
            variant?.sku ||
            "No SKU",
          barcode:
            variant?.barcode ||
            "—",
          brand:
            product.brand ||
            "—",
          category:
            product.category ||
            "—",
          trackingMode:
            product.tracking_mode ||
            "batch",
          physical:
            stock.quantity,
          reserved:
            stock.reserved_quantity,
          available,
          batches: 1,
          locations: 1,
          warehouses: 1,
          unitCost,
          stockValue:
            available * unitCost,
        });
      },
    );

    return Array.from(
      grouped.values(),
    )
      .map((row) => ({
        ...row,
        stockValue:
          row.available *
          row.unitCost,
      }))
      .sort(
        (a, b) =>
          b.available -
          a.available,
      );
  }, [
    searchableBatchStock,
    productMap,
    variantMap,
    batchMap,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    warehouseFilter,
    trackingFilter,
    stockFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      stockRows.length /
        PAGE_SIZE,
    ),
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedRows = useMemo(() => {
    const start =
      (page - 1) * PAGE_SIZE;

    return stockRows.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [stockRows, page]);

  const totals = useMemo(() => {
    const physical =
      batchStock
        .filter(
          (stock) =>
            warehouseFilter ===
              "all" ||
            stock.warehouse_id ===
              warehouseFilter,
        )
        .reduce(
          (sum, stock) =>
            sum + stock.quantity,
          0,
        );

    const reserved =
      batchStock
        .filter(
          (stock) =>
            warehouseFilter ===
              "all" ||
            stock.warehouse_id ===
              warehouseFilter,
        )
        .reduce(
          (sum, stock) =>
            sum +
            stock.reserved_quantity,
          0,
        );

    const available = Math.max(
      0,
      physical - reserved,
    );

    const inventoryValue =
      stockRows.reduce(
        (sum, row) =>
          sum + row.stockValue,
        0,
      );

    return {
      physical,
      reserved,
      available,
      inventoryValue,
    };
  }, [
    batchStock,
    warehouseFilter,
    stockRows,
  ]);

  const health = useMemo(() => {
    const healthy =
      stockRows.filter(
        (row) =>
          row.available >= 5,
      ).length;

    const low =
      stockRows.filter(
        (row) =>
          row.available > 0 &&
          row.available < 5,
      ).length;

    const out =
      stockRows.filter(
        (row) =>
          row.available <= 0,
      ).length;

    const total =
      stockRows.length;

    return {
      healthy,
      low,
      out,
      total,
      healthyPercent:
        total > 0
          ? Math.round(
              (healthy / total) *
                100,
            )
          : 0,
    };
  }, [stockRows]);

  const attentionRows = useMemo(
    () =>
      [...stockRows]
        .filter(
          (row) =>
            row.available < 5,
        )
        .sort(
          (a, b) =>
            a.available -
            b.available,
        )
        .slice(0, 6),
    [stockRows],
  );

  const warehouseSummary =
    useMemo(() => {
      const map = new Map<
        string,
        {
          id: string;
          name: string;
          code: string;
          available: number;
          physical: number;
          reserved: number;
          locations: Set<string>;
        }
      >();

      batchStock.forEach(
        (stock) => {
          if (
            warehouseFilter !==
              "all" &&
            stock.warehouse_id !==
              warehouseFilter
          ) {
            return;
          }

          const warehouse =
            warehouseMap.get(
              stock.warehouse_id,
            );

          if (!warehouse) {
            return;
          }

          const existing =
            map.get(
              stock.warehouse_id,
            );

          const available =
            Math.max(
              0,
              stock.quantity -
                stock.reserved_quantity,
            );

          if (existing) {
            existing.physical +=
              stock.quantity;

            existing.reserved +=
              stock.reserved_quantity;

            existing.available +=
              available;

            existing.locations.add(
              stock.location_id,
            );

            return;
          }

          map.set(
            stock.warehouse_id,
            {
              id: stock.warehouse_id,
              name: warehouse.name,
              code:
                warehouse.code ||
                "—",
              available,
              physical:
                stock.quantity,
              reserved:
                stock.reserved_quantity,
              locations: new Set([
                stock.location_id,
              ]),
            },
          );
        },
      );

      return Array.from(
        map.values(),
      ).sort(
        (a, b) =>
          b.available -
          a.available,
      );
    }, [
      batchStock,
      warehouseFilter,
      warehouseMap,
    ]);

  const maxWarehouseStock =
    warehouseSummary[0]
      ?.available || 1;

  const periodStart = useMemo(
    () => {
      const date = new Date();

      date.setDate(
        date.getDate() -
          Number(period),
      );

      return date;
    },
    [period],
  );

  const periodMovements =
    useMemo(
      () =>
        movements.filter(
          (movement) =>
            new Date(
              movement.created_at,
            ) >= periodStart &&
            (warehouseFilter ===
              "all" ||
              movement.warehouse_id ===
                warehouseFilter),
        ),
      [
        movements,
        periodStart,
        warehouseFilter,
      ],
    );

  const flow = useMemo(() => {
    let inbound = 0;
    let outbound = 0;

    periodMovements.forEach(
      (movement) => {
        if (
          isInboundMovement(
            movement.movement_type,
          )
        ) {
          inbound += Math.abs(
            movement.quantity,
          );
        } else {
          outbound += Math.abs(
            movement.quantity,
          );
        }
      },
    );

    return {
      inbound,
      outbound,
      net:
        inbound - outbound,
    };
  }, [periodMovements]);

  const recentMovements =
    useMemo(
      () =>
        periodMovements.slice(
          0,
          6,
        ),
      [periodMovements],
    );

  const latestBatch =
    useMemo(
      () =>
        [...batches]
          .filter(
            (batch) =>
              Boolean(
                batch.received_at,
              ),
          )
          .sort(
            (a, b) =>
              new Date(
                b.received_at ||
                  0,
              ).getTime() -
              new Date(
                a.received_at ||
                  0,
              ).getTime(),
          )[0] ?? null,
      [batches],
    );

  const quarantinedCount =
    useMemo(
      () =>
        batches.filter(
          (batch) =>
            batch.status ===
            "quarantined",
        ).length,
      [batches],
    );

  const serializedAvailable =
    useMemo(
      () =>
        serializedUnits.filter(
          (unit) =>
            unit.status ===
            "available" &&
            (warehouseFilter ===
              "all" ||
              unit.warehouse_id ===
                warehouseFilter),
        ).length,
      [
        serializedUnits,
        warehouseFilter,
      ],
    );

  const handleRefresh = async () => {
    await loadInventory(true);
  };

  const clearFilters = () => {
    setSearch("");
    setWarehouseFilter("all");
    setTrackingFilter("all");
    setStockFilter("all");
    setPage(1);
  };

  const hasFilters =
    Boolean(search) ||
    warehouseFilter !==
      "all" ||
    trackingFilter !==
      "all" ||
    stockFilter !==
      "all";

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <style jsx>{`
          .inventory-page {
            padding-bottom: 50px;
          }

          .hero {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 24px;
            margin-bottom: 20px;
          }

          .hero-left {
            min-width: 0;
          }

          .eyebrow {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            color: #64748b;
            font-size: 11px;
            font-weight: 750;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }

          .eyebrow-dot {
            display: block;
            width: 7px !important;
            height: 7px !important;
            min-width: 7px !important;
            max-width: 7px !important;
            min-height: 7px !important;
            max-height: 7px !important;
            flex: 0 0 7px !important;
            border-radius: 50% !important;
            background: #166534;
          }

          .page-title {
            margin: 0;
            color: #0f172a;
            font-size: 30px;
            line-height: 1.15;
            font-weight: 780;
            letter-spacing: -0.035em;
          }

          .page-subtitle {
            max-width: 760px;
            margin: 8px 0 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.55;
          }

          .hero-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
          }

          button,
          input,
          select {
            font: inherit;
          }

          .button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            height: 38px;
            padding: 0 12px;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            background: #ffffff;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition:
              border-color 0.15s ease,
              box-shadow 0.15s ease,
              transform 0.15s ease;
            white-space: nowrap;
          }

          .button:hover {
            border-color: #cbd5e1;
            box-shadow: 0 4px 12px
              rgba(15, 23, 42, 0.06);
          }

          .button:active {
            transform: translateY(1px);
          }

          .button:disabled {
            cursor: default;
            opacity: 0.55;
          }

          .button-primary {
            border-color: #166534;
            background: #166534;
            color: #ffffff;
          }

          .button-primary:hover {
            border-color: #14532d;
            background: #14532d;
          }

          .spin {
            animation: inventory-spin 0.8s linear infinite;
          }

          @keyframes inventory-spin {
            to {
              transform: rotate(360deg);
            }
          }

          /*
           * FILTER BAR
           *
           * One clean search control.
           * No nested input borders.
           */

          .filter-bar {
            display: grid;
            grid-template-columns:
              minmax(280px, 1fr)
              190px
              155px
              155px
              auto;
            align-items: center;
            gap: 9px;
            padding: 10px;
            margin-bottom: 15px;
            border: 1px solid #e5e7eb;
            border-radius: 13px;
            background: #ffffff;
            box-shadow: 0 2px 8px
              rgba(15, 23, 42, 0.035);
          }

          .search-control {
            display: flex;
            align-items: center;
            width: 100%;
            height: 40px;
            min-width: 0;
            overflow: hidden;
            box-sizing: border-box;
            border: 1px solid #dfe6ee;
            border-radius: 9px;
            background: #ffffff;
          }

          .search-control:focus-within {
            border-color: #94a3b8;
            box-shadow: 0 0 0 3px
              rgba(148, 163, 184, 0.1);
          }

          .search-leading {
            display: grid;
            place-items: center;
            width: 40px;
            min-width: 40px;
            height: 40px;
            color: #94a3b8;
          }

          .search-input {
            display: block;
            width: 100%;
            min-width: 0;
            height: 38px;
            padding: 0 9px 0 0;
            margin: 0;
            border: 0 !important;
            outline: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            color: #334155;
            font-size: 12px;
          }

          .search-input::placeholder {
            color: #94a3b8;
          }

          .clear-search {
            display: grid;
            place-items: center;
            width: 28px;
            min-width: 28px;
            height: 28px;
            margin-right: 5px;
            padding: 0;
            border: 0;
            border-radius: 7px;
            background: #f8fafc;
            color: #64748b;
            cursor: pointer;
          }

          .select-control {
            display: block;
            width: 100%;
            height: 40px;
            box-sizing: border-box;
            padding: 0 10px;
            border: 1px solid #dfe6ee;
            border-radius: 9px;
            outline: none;
            background: #ffffff;
            color: #475569;
            font-size: 12px;
            cursor: pointer;
          }

          .select-control:focus {
            border-color: #94a3b8;
            box-shadow: 0 0 0 3px
              rgba(148, 163, 184, 0.1);
          }

          .filter-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 7px;
          }

          .clear-filter {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            height: 40px;
            padding: 0 9px;
            border: 0;
            border-radius: 8px;
            background: #f8fafc;
            color: #64748b;
            font-size: 11px;
            font-weight: 650;
            cursor: pointer;
            white-space: nowrap;
          }

          /*
           * KPI STRIP
           */

          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(
              6,
              minmax(0, 1fr)
            );
            gap: 11px;
            margin-bottom: 15px;
          }

          .kpi {
            position: relative;
            min-height: 112px;
            overflow: hidden;
            padding: 15px;
            border: 1px solid #e5e7eb;
            border-radius: 13px;
            background: #ffffff;
            box-shadow: 0 2px 8px
              rgba(15, 23, 42, 0.035);
          }

          .kpi::after {
            content: "";
            position: absolute;
            right: -32px;
            bottom: -35px;
            width: 86px;
            height: 86px;
            border-radius: 50%;
            background: #f8fafc;
            pointer-events: none;
          }

          .kpi-top {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
          }

          .kpi-label {
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
          }

          .kpi-icon {
            display: grid;
            place-items: center;
            width: 30px;
            height: 30px;
            min-width: 30px;
            border-radius: 8px;
            background: #f8fafc;
            color: #64748b;
          }

          .kpi-value {
            position: relative;
            z-index: 1;
            margin-top: 14px;
            color: #0f172a;
            font-size: 23px;
            line-height: 1;
            font-weight: 780;
            letter-spacing: -0.025em;
          }

          .kpi-meta {
            position: relative;
            z-index: 1;
            margin-top: 7px;
            color: #94a3b8;
            font-size: 10px;
          }

          /*
           * MAIN INVENTORY TABLE
           */

          .inventory-card {
            margin-bottom: 15px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 3px 10px
              rgba(15, 23, 42, 0.04);
          }

          .inventory-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 17px 18px;
            border-bottom: 1px solid #eef2f7;
          }

          .inventory-card-heading {
            min-width: 0;
          }

          .inventory-card-title {
            margin: 0;
            color: #0f172a;
            font-size: 15px;
            font-weight: 750;
            letter-spacing: -0.01em;
          }

          .inventory-card-subtitle {
            margin: 4px 0 0;
            color: #94a3b8;
            font-size: 11px;
          }

          .inventory-card-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
          }

          .count-label {
            color: #64748b;
            font-size: 11px;
            white-space: nowrap;
          }

          .table-wrap {
            width: 100%;
            overflow-x: auto;
          }

          .stock-table {
            width: 100%;
            min-width: 1080px;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .stock-table th {
            height: 40px;
            padding: 0 13px;
            border-bottom: 1px solid #e5e7eb;
            background: #f8fafc;
            color: #64748b;
            font-size: 10px;
            font-weight: 750;
            letter-spacing: 0.045em;
            text-align: left;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .stock-table td {
            height: 68px;
            padding: 0 13px;
            border-bottom: 1px solid #f1f5f9;
            color: #475569;
            font-size: 12px;
            vertical-align: middle;
          }

          .stock-table tbody tr {
            transition: background 0.12s ease;
          }

          .stock-table tbody tr:hover {
            background: #fafdfb;
          }

          .stock-table tbody tr:last-child td {
            border-bottom: 0;
          }

          .product-cell {
            display: flex;
            align-items: center;
            gap: 11px;
            min-width: 0;
          }

          .product-avatar {
            display: grid;
            place-items: center;
            width: 36px;
            height: 36px;
            min-width: 36px;
            border: 1px solid #e5e7eb;
            border-radius: 9px;
            background: #f8fafc;
            color: #64748b;
          }

          .product-info {
            min-width: 0;
          }

          .product-name {
            overflow: hidden;
            color: #1e293b;
            font-size: 12px;
            font-weight: 720;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .product-variant {
            overflow: hidden;
            margin-top: 3px;
            color: #94a3b8;
            font-size: 10px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .sku {
            color: #475569;
            font-family:
              ui-monospace,
              SFMono-Regular,
              Menlo,
              Monaco,
              Consolas,
              monospace;
            font-size: 10px;
            font-weight: 650;
          }

          .barcode {
            margin-top: 3px;
            color: #94a3b8;
            font-family:
              ui-monospace,
              SFMono-Regular,
              Menlo,
              Monaco,
              Consolas,
              monospace;
            font-size: 9px;
          }

          .qty-main {
            color: #0f172a;
            font-size: 14px;
            font-weight: 760;
            text-align: right;
          }

          .qty-sub {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 9px;
            text-align: right;
          }

          .reserved {
            color: #b45309;
            font-weight: 700;
          }

          .value {
            color: #334155;
            font-size: 12px;
            font-weight: 700;
            text-align: right;
          }

          .status-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 70px;
            height: 24px;
            padding: 0 8px;
            border-radius: 6px;
            font-size: 9px;
            font-weight: 750;
            white-space: nowrap;
          }

          .status-healthy {
            background: #f0fdf4;
            color: #166534;
          }

          .status-low {
            background: #fffbeb;
            color: #a16207;
          }

          .status-out {
            background: #fef2f2;
            color: #b91c1c;
          }

          .tracking-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 56px;
            height: 22px;
            padding: 0 7px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            background: #f8fafc;
            color: #64748b;
            font-size: 9px;
            font-weight: 700;
          }

          .mini-counts {
            display: flex;
            align-items: center;
            gap: 9px;
            color: #64748b;
            font-size: 10px;
          }

          .mini-count {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
          }

          .mini-count svg {
            color: #94a3b8;
          }

          .row-action {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            height: 28px;
            padding: 0 8px;
            border: 1px solid #e2e8f0;
            border-radius: 7px;
            background: #ffffff;
            color: #64748b;
            font-size: 10px;
            font-weight: 700;
            cursor: pointer;
          }

          .row-action:hover {
            border-color: #cbd5e1;
            color: #166534;
          }

          /*
           * PAGINATION
           */

          .pagination {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 15px;
            border-top: 1px solid #eef2f7;
          }

          .pagination-info {
            color: #94a3b8;
            font-size: 10px;
          }

          .pagination-actions {
            display: flex;
            align-items: center;
            gap: 5px;
          }

          .page-button {
            display: grid;
            place-items: center;
            width: 29px;
            height: 29px;
            padding: 0;
            border: 1px solid #e2e8f0;
            border-radius: 7px;
            background: #ffffff;
            color: #64748b;
            cursor: pointer;
          }

          .page-button:hover:not(:disabled) {
            border-color: #cbd5e1;
            color: #166534;
          }

          .page-button:disabled {
            cursor: default;
            opacity: 0.4;
          }

          .page-number {
            display: grid;
            place-items: center;
            min-width: 29px;
            height: 29px;
            padding: 0 7px;
            border-radius: 7px;
            background: #166534;
            color: #ffffff;
            font-size: 10px;
            font-weight: 750;
          }

          /*
           * SECONDARY DASHBOARD
           */

          .secondary-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1.15fr)
              minmax(0, 1fr);
            gap: 15px;
            margin-bottom: 15px;
          }

          .panel {
            min-width: 0;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 2px 8px
              rgba(15, 23, 42, 0.035);
          }

          .panel-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 17px 18px 14px;
            border-bottom: 1px solid #eef2f7;
          }

          .panel-title {
            margin: 0;
            color: #0f172a;
            font-size: 14px;
            font-weight: 750;
          }

          .panel-description {
            margin: 4px 0 0;
            color: #94a3b8;
            font-size: 10px;
          }

          .text-button {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 0;
            border: 0;
            background: transparent;
            color: #166534;
            font-size: 10px;
            font-weight: 750;
            cursor: pointer;
            white-space: nowrap;
          }

          /*
           * HEALTH
           *
           * No circles. No donut.
           * Simple horizontal health composition.
           */

          .health-body {
            padding: 17px 18px;
          }

          .health-summary {
            display: grid;
            grid-template-columns: 90px minmax(0, 1fr);
            gap: 18px;
            align-items: center;
            margin-bottom: 18px;
          }

          .health-percent {
            color: #0f172a;
            font-size: 29px;
            line-height: 1;
            font-weight: 800;
            letter-spacing: -0.04em;
          }

          .health-percent-label {
            margin-top: 5px;
            color: #94a3b8;
            font-size: 9px;
            font-weight: 650;
          }

          .health-bar {
            display: flex;
            width: 100%;
            height: 12px;
            overflow: hidden;
            border-radius: 6px;
            background: #f1f5f9;
          }

          .health-segment {
            height: 12px;
            min-width: 0;
          }

          .health-healthy {
            background: #166534;
          }

          .health-low {
            background: #f59e0b;
          }

          .health-out {
            background: #cbd5e1;
          }

          .health-legend {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 11px;
          }

          .health-legend-item {
            display: grid;
            grid-template-columns: 7px minmax(0, 1fr);
            gap: 7px;
            align-items: center;
            min-width: 0;
          }

          .health-legend-dot {
            display: block !important;
            width: 7px !important;
            height: 7px !important;
            min-width: 7px !important;
            max-width: 7px !important;
            min-height: 7px !important;
            max-height: 7px !important;
            flex: 0 0 7px !important;
            border-radius: 50% !important;
          }

          .legend-green {
            background: #166534;
          }

          .legend-yellow {
            background: #f59e0b;
          }

          .legend-gray {
            background: #cbd5e1;
          }

          .health-legend-text {
            min-width: 0;
            color: #64748b;
            font-size: 9px;
          }

          .health-legend-text strong {
            display: block;
            margin-bottom: 2px;
            color: #334155;
            font-size: 11px;
          }

          /*
           * ATTENTION
           */

          .attention-list {
            padding: 4px 18px 12px;
          }

          .attention-item {
            display: grid;
            grid-template-columns:
              7px
              minmax(0, 1fr)
              auto;
            align-items: center;
            gap: 9px;
            padding: 11px 0;
            border-bottom: 1px solid #f1f5f9;
          }

          .attention-item:last-child {
            border-bottom: 0;
          }

          .attention-dot {
            display: block !important;
            width: 7px !important;
            height: 7px !important;
            min-width: 7px !important;
            max-width: 7px !important;
            min-height: 7px !important;
            max-height: 7px !important;
            flex: 0 0 7px !important;
            border-radius: 50% !important;
            background: #f59e0b;
          }

          .attention-dot.out {
            background: #dc2626;
          }

          .attention-product {
            overflow: hidden;
            color: #334155;
            font-size: 11px;
            font-weight: 700;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .attention-sku {
            margin-top: 3px;
            overflow: hidden;
            color: #94a3b8;
            font-size: 9px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .attention-value {
            color: #a16207;
            font-size: 11px;
            font-weight: 750;
            text-align: right;
          }

          .attention-value.out {
            color: #dc2626;
          }

          /*
           * WAREHOUSE
           */

          .warehouse-list {
            padding: 4px 18px 12px;
          }

          .warehouse-item {
            padding: 11px 0;
            border-bottom: 1px solid #f1f5f9;
          }

          .warehouse-item:last-child {
            border-bottom: 0;
          }

          .warehouse-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 7px;
          }

          .warehouse-name {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
          }

          .warehouse-icon {
            display: grid;
            place-items: center;
            width: 27px;
            height: 27px;
            min-width: 27px;
            border-radius: 7px;
            background: #f8fafc;
            color: #64748b;
          }

          .warehouse-name-text {
            overflow: hidden;
            color: #334155;
            font-size: 11px;
            font-weight: 700;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .warehouse-code {
            margin-left: 4px;
            color: #94a3b8;
            font-size: 9px;
          }

          .warehouse-qty {
            color: #0f172a;
            font-size: 12px;
            font-weight: 750;
            white-space: nowrap;
          }

          .warehouse-bar {
            width: 100%;
            height: 7px;
            overflow: hidden;
            border-radius: 4px;
            background: #f1f5f9;
          }

          .warehouse-bar-fill {
            height: 7px;
            min-width: 2px;
            border-radius: 4px;
            background: #166534;
          }

          .warehouse-bottom {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-top: 5px;
            color: #94a3b8;
            font-size: 9px;
          }

          /*
           * ACTIVITY
           */

          .activity-list {
            padding: 4px 18px 12px;
          }

          .activity-item {
            display: grid;
            grid-template-columns: 31px minmax(0, 1fr) auto;
            align-items: center;
            gap: 9px;
            padding: 10px 0;
            border-bottom: 1px solid #f1f5f9;
          }

          .activity-item:last-child {
            border-bottom: 0;
          }

          .activity-icon {
            display: grid;
            place-items: center;
            width: 29px;
            height: 29px;
            min-width: 29px;
            border-radius: 7px;
            background: #f8fafc;
            color: #64748b;
          }

          .activity-icon.inbound {
            background: #f0fdf4;
            color: #166534;
          }

          .activity-icon.outbound {
            background: #fff7ed;
            color: #c2410c;
          }

          .activity-title {
            overflow: hidden;
            color: #334155;
            font-size: 10px;
            font-weight: 700;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .activity-meta {
            overflow: hidden;
            margin-top: 3px;
            color: #94a3b8;
            font-size: 9px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .activity-qty {
            color: #0f172a;
            font-size: 11px;
            font-weight: 750;
            text-align: right;
          }

          .activity-time {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 8px;
            text-align: right;
          }

          /*
           * OPERATIONS
           */

          .operations {
            display: grid;
            grid-template-columns: repeat(
              4,
              minmax(0, 1fr)
            );
            gap: 10px;
            margin-bottom: 15px;
          }

          .operation {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 13px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #ffffff;
            box-shadow: 0 2px 8px
              rgba(15, 23, 42, 0.03);
            cursor: pointer;
            transition:
              border-color 0.15s ease,
              transform 0.15s ease,
              box-shadow 0.15s ease;
          }

          .operation:hover {
            border-color: #cbd5e1;
            box-shadow: 0 5px 15px
              rgba(15, 23, 42, 0.055);
            transform: translateY(-1px);
          }

          .operation-left {
            display: flex;
            align-items: center;
            gap: 9px;
            min-width: 0;
          }

          .operation-icon {
            display: grid;
            place-items: center;
            width: 31px;
            height: 31px;
            min-width: 31px;
            border-radius: 8px;
            background: #f8fafc;
            color: #64748b;
          }

          .operation-title {
            overflow: hidden;
            color: #334155;
            font-size: 10px;
            font-weight: 750;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .operation-meta {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 8px;
          }

          .operation-arrow {
            color: #94a3b8;
            flex-shrink: 0;
          }

          /*
           * QUARANTINE NOTICE
           */

          .notice {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 13px 15px;
            margin-top: 15px;
            border: 1px solid #fed7aa;
            border-radius: 12px;
            background: #fffaf5;
          }

          .notice-left {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .notice-icon {
            color: #c2410c;
            flex-shrink: 0;
          }

          .notice-title {
            color: #9a3412;
            font-size: 11px;
            font-weight: 750;
          }

          .notice-text {
            margin-top: 3px;
            color: #c2410c;
            font-size: 9px;
          }

          /*
           * EMPTY / LOADING / ERROR
           */

          .empty {
            display: grid;
            place-items: center;
            min-height: 260px;
            padding: 30px;
            text-align: center;
          }

          .empty-icon {
            display: grid;
            place-items: center;
            width: 45px;
            height: 45px;
            margin: 0 auto 11px;
            border-radius: 11px;
            background: #f8fafc;
            color: #94a3b8;
          }

          .empty-title {
            color: #334155;
            font-size: 13px;
            font-weight: 750;
          }

          .empty-text {
            max-width: 470px;
            margin: 5px auto 0;
            color: #94a3b8;
            font-size: 10px;
            line-height: 1.55;
          }

          .empty-actions {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            margin-top: 14px;
            flex-wrap: wrap;
          }

          .loading {
            display: grid;
            place-items: center;
            min-height: 480px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
          }

          .loading-spinner {
            margin: 0 auto 10px;
            color: #166534;
            animation: inventory-spin
              0.8s linear infinite;
          }

          .loading-title {
            color: #475569;
            font-size: 12px;
            font-weight: 700;
          }

          .loading-text {
            margin-top: 4px;
            color: #94a3b8;
            font-size: 10px;
          }

          .error {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 14px;
            margin-bottom: 15px;
            border: 1px solid #fecaca;
            border-radius: 11px;
            background: #ffffff;
          }

          .error-icon {
            color: #dc2626;
            flex-shrink: 0;
          }

          .error-title {
            color: #991b1b;
            font-size: 11px;
            font-weight: 750;
          }

          .error-text {
            margin-top: 3px;
            color: #b91c1c;
            font-size: 9px;
            line-height: 1.5;
          }

          /*
           * RESPONSIVE
           */

          @media (max-width: 1350px) {
            .filter-bar {
              grid-template-columns:
                minmax(260px, 1fr)
                180px
                145px
                145px
                auto;
            }

            .kpi-grid {
              grid-template-columns: repeat(
                3,
                minmax(0, 1fr)
              );
            }
          }

          @media (max-width: 1100px) {
            .hero {
              align-items: flex-start;
              flex-direction: column;
            }

            .hero-actions {
              width: 100%;
            }

            .secondary-grid {
              grid-template-columns: 1fr;
            }

            .operations {
              grid-template-columns: repeat(
                2,
                minmax(0, 1fr)
              );
            }
          }

          @media (max-width: 900px) {
            .filter-bar {
              grid-template-columns:
                1fr 1fr;
            }

            .filter-bar
              .search-control {
              grid-column: 1 / -1;
            }

            .filter-actions {
              justify-content: flex-start;
            }
          }

          @media (max-width: 650px) {
            .page-title {
              font-size: 25px;
            }

            .hero-actions {
              flex-wrap: wrap;
            }

            .hero-actions .button {
              flex: 1;
            }

            .filter-bar {
              grid-template-columns: 1fr;
            }

            .filter-bar
              .search-control {
              grid-column: auto;
            }

            .kpi-grid {
              grid-template-columns: 1fr 1fr;
            }

            .health-summary {
              grid-template-columns: 1fr;
              gap: 12px;
            }

            .health-legend {
              grid-template-columns: 1fr 1fr 1fr;
            }

            .operations {
              grid-template-columns: 1fr;
            }

            .inventory-card-header {
              align-items: flex-start;
              flex-direction: column;
            }

            .inventory-card-actions {
              width: 100%;
              justify-content: space-between;
            }

            .pagination {
              align-items: flex-start;
              flex-direction: column;
            }
          }

          @media (max-width: 430px) {
            .kpi-grid {
              grid-template-columns: 1fr;
            }

            .health-legend {
              grid-template-columns: 1fr;
            }

            .notice {
              align-items: flex-start;
              flex-direction: column;
            }
          }
        `}</style>

        {/* =========================================================
            HERO
        ========================================================= */}

        <div className="hero">
          <div className="hero-left">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Inventory Command Center
            </div>

            <h1 className="page-title">
              Inventory
            </h1>

            <p className="page-subtitle">
              Your operational source of truth for
              physical stock, availability, batches,
              locations and inventory movement.
            </p>
          </div>

          <div className="hero-actions">
            <button
              type="button"
              className="button"
              onClick={() =>
                router.push(
                  "/inventory/receipts",
                )
              }
            >
              <Truck size={14} />
              Receipts
            </button>

            <button
              type="button"
              className="button"
              onClick={() =>
                router.push(
                  "/inventory/transfers",
                )
              }
            >
              <ArrowRight size={14} />
              Transfers
            </button>

            <button
              type="button"
              className="button button-primary"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                size={14}
                className={
                  refreshing
                    ? "spin"
                    : ""
                }
              />
              {refreshing
                ? "Refreshing"
                : "Refresh"}
            </button>
          </div>
        </div>

        {/* =========================================================
            FILTER BAR
        ========================================================= */}

        <div className="filter-bar">
          <div className="search-control">
            <div className="search-leading">
              <Search size={16} />
            </div>

            <input
              type="text"
              className="search-input"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search product, variant, SKU, barcode, batch, warehouse, location or serial..."
            />

            {search && (
              <button
                type="button"
                className="clear-search"
                onClick={() =>
                  setSearch("")
                }
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <select
            className="select-control"
            value={warehouseFilter}
            onChange={(event) =>
              setWarehouseFilter(
                event.target.value,
              )
            }
          >
            <option value="all">
              All Warehouses
            </option>

            {warehouses
              .filter(
                (warehouse) =>
                  warehouse.is_active !==
                  false,
              )
              .map(
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
                  </option>
                ),
              )}
          </select>

          <select
            className="select-control"
            value={trackingFilter}
            onChange={(event) =>
              setTrackingFilter(
                event.target.value,
              )
            }
          >
            <option value="all">
              All Tracking
            </option>

            <option value="batch">
              Batch
            </option>

            <option value="serial">
              Serial
            </option>

            <option value="none">
              Not Tracked
            </option>
          </select>

          <select
            className="select-control"
            value={stockFilter}
            onChange={(event) =>
              setStockFilter(
                event.target.value,
              )
            }
          >
            <option value="all">
              All Stock
            </option>

            <option value="available">
              Available
            </option>

            <option value="low">
              Low Stock
            </option>

            <option value="out">
              Out of Stock
            </option>

            <option value="reserved">
              Reserved
            </option>
          </select>

          <div className="filter-actions">
            {hasFilters && (
              <button
                type="button"
                className="clear-filter"
                onClick={
                  clearFilters
                }
              >
                <X size={12} />
                Clear
              </button>
            )}

            <button
              type="button"
              className="button"
              onClick={() =>
                router.push(
                  "/inventory/adjustments/new",
                )
              }
            >
              <SlidersHorizontal
                size={14}
              />
              Adjustment
            </button>
          </div>
        </div>

        {/* =========================================================
            ERROR
        ========================================================= */}

        {errorMessage && (
          <div className="error">
            <AlertTriangle
              size={17}
              className="error-icon"
            />

            <div>
              <div className="error-title">
                Inventory could not be loaded
              </div>

              <div className="error-text">
                {errorMessage}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading">
            <div>
              <RefreshCw
                size={26}
                className="loading-spinner"
              />

              <div className="loading-title">
                Loading inventory
              </div>

              <div className="loading-text">
                Reading batches, stock locations,
                serial assets and movement activity...
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* =====================================================
                KPI STRIP
            ===================================================== */}

            <div className="kpi-grid">
              <div className="kpi">
                <div className="kpi-top">
                  <span className="kpi-label">
                    Physical Units
                  </span>

                  <div className="kpi-icon">
                    <Package
                      size={15}
                    />
                  </div>
                </div>

                <div className="kpi-value">
                  {formatNumber(
                    totals.physical,
                  )}
                </div>

                <div className="kpi-meta">
                  Actual units in batch stock
                </div>
              </div>

              <div className="kpi">
                <div className="kpi-top">
                  <span className="kpi-label">
                    Available
                  </span>

                  <div className="kpi-icon">
                    <PackageCheck
                      size={15}
                    />
                  </div>
                </div>

                <div className="kpi-value">
                  {formatNumber(
                    totals.available,
                  )}
                </div>

                <div className="kpi-meta">
                  Physical less reserved
                </div>
              </div>

              <div className="kpi">
                <div className="kpi-top">
                  <span className="kpi-label">
                    Reserved
                  </span>

                  <div className="kpi-icon">
                    <ClipboardList
                      size={15}
                    />
                  </div>
                </div>

                <div className="kpi-value">
                  {formatNumber(
                    totals.reserved,
                  )}
                </div>

                <div className="kpi-meta">
                  Units already committed
                </div>
              </div>

              <div className="kpi">
                <div className="kpi-top">
                  <span className="kpi-label">
                    Stock Value
                  </span>

                  <div className="kpi-icon">
                    <DollarSign
                      size={15}
                    />
                  </div>
                </div>

                <div className="kpi-value">
                  {formatMoney(
                    totals.inventoryValue,
                    settings,
                  )}
                </div>

                <div className="kpi-meta">
                  Available stock cost basis
                </div>
              </div>

              <div className="kpi">
                <div className="kpi-top">
                  <span className="kpi-label">
                    Products
                  </span>

                  <div className="kpi-icon">
                    <Boxes
                      size={15}
                    />
                  </div>
                </div>

                <div className="kpi-value">
                  {formatNumber(
                    stockRows.length,
                  )}
                </div>

                <div className="kpi-meta">
                  Product / variant stock lines
                </div>
              </div>

              <div className="kpi">
                <div className="kpi-top">
                  <span className="kpi-label">
                    Serial Assets
                  </span>

                  <div className="kpi-icon">
                    <Zap
                      size={15}
                    />
                  </div>
                </div>

                <div className="kpi-value">
                  {formatNumber(
                    serializedAvailable,
                  )}
                </div>

                <div className="kpi-meta">
                  Serialized units available
                </div>
              </div>
            </div>

            {/* =====================================================
                ACTUAL INVENTORY — PRIMARY SECTION
            ===================================================== */}

            <div className="inventory-card">
              <div className="inventory-card-header">
                <div className="inventory-card-heading">
                  <h2 className="inventory-card-title">
                    Stock
                  </h2>

                  <p className="inventory-card-subtitle">
                    Physical inventory grouped by product and
                    variant. Batch/location records remain the
                    underlying source of truth.
                  </p>
                </div>

                <div className="inventory-card-actions">
                  <span className="count-label">
                    {formatNumber(
                      stockRows.length,
                    )}{" "}
                    stock line
                    {stockRows.length ===
                    1
                      ? ""
                      : "s"}
                  </span>

                  {hasFilters && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={
                        clearFilters
                      }
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {stockRows.length ===
              0 ? (
                <div className="empty">
                  <div>
                    <div className="empty-icon">
                      <Package
                        size={21}
                      />
                    </div>

                    <div className="empty-title">
                      {hasFilters
                        ? "No inventory matches your filters"
                        : "No inventory recorded yet"}
                    </div>

                    <div className="empty-text">
                      {hasFilters
                        ? "Try another product, SKU, batch, warehouse, location or serial number, or clear the filters."
                        : "Receive inventory into a batch and assign it to a warehouse and location. Your actual physical stock will appear here."}
                    </div>

                    {hasFilters ? (
                      <div className="empty-actions">
                        <button
                          type="button"
                          className="button"
                          onClick={
                            clearFilters
                          }
                        >
                          Clear Filters
                        </button>
                      </div>
                    ) : (
                      <div className="empty-actions">
                        <button
                          type="button"
                          className="button button-primary"
                          onClick={() =>
                            router.push(
                              "/inventory/receipts",
                            )
                          }
                        >
                          View Receipts
                        </button>

                        <button
                          type="button"
                          className="button"
                          onClick={() =>
                            router.push(
                              "/inventory/batches",
                            )
                          }
                        >
                          View Batches
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="stock-table">
                      <colgroup>
                        <col
                          style={{
                            width:
                              "27%",
                          }}
                        />

                        <col
                          style={{
                            width:
                              "11%",
                          }}
                        />

                        <col
                          style={{
                            width:
                              "9%",
                          }}
                        />

                        <col
                          style={{
                            width:
                              "9%",
                          }}
                        />

                        <col
                          style={{
                            width:
                              "9%",
                          }}
                        />

                        <col
                          style={{
                            width:
                              "11%",
                          }}
                        />

                        <col
                          style={{
                            width:
                              "9%",
                          }}
                        />

                        <col
                          style={{
                            width:
                              "7%",
                          }}
                        />

                        <col
                          style={{
                            width:
                              "8%",
                          }}
                        />
                      </colgroup>

                      <thead>
                        <tr>
                          <th>
                            Product
                          </th>

                          <th>
                            SKU
                          </th>

                          <th
                            style={{
                              textAlign:
                                "right",
                            }}
                          >
                            Physical
                          </th>

                          <th
                            style={{
                              textAlign:
                                "right",
                            }}
                          >
                            Reserved
                          </th>

                          <th
                            style={{
                              textAlign:
                                "right",
                            }}
                          >
                            Available
                          </th>

                          <th>
                            Coverage
                          </th>

                          <th
                            style={{
                              textAlign:
                                "right",
                            }}
                          >
                            Stock Value
                          </th>

                          <th>
                            Tracking
                          </th>

                          <th>
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {paginatedRows.map(
                          (row) => {
                            const status =
                              row.available <=
                              0
                                ? "out"
                                : row.available <
                                    5
                                  ? "low"
                                  : "healthy";

                            return (
                              <tr
                                key={
                                  row.key
                                }
                              >
                                <td>
                                  <div className="product-cell">
                                    <div className="product-avatar">
                                      <Package
                                        size={
                                          16
                                        }
                                      />
                                    </div>

                                    <div className="product-info">
                                      <div className="product-name">
                                        {
                                          row.productName
                                        }
                                      </div>

                                      <div className="product-variant">
                                        {
                                          row.variantName
                                        }

                                        {row.brand !==
                                          "—" &&
                                          ` · ${row.brand}`}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td>
                                  <div className="sku">
                                    {
                                      row.sku
                                    }
                                  </div>

                                  {row.barcode !==
                                    "—" && (
                                    <div className="barcode">
                                      {
                                        row.barcode
                                      }
                                    </div>
                                  )}
                                </td>

                                <td>
                                  <div className="qty-main">
                                    {formatNumber(
                                      row.physical,
                                    )}
                                  </div>

                                  <div className="qty-sub">
                                    units
                                  </div>
                                </td>

                                <td>
                                  <div
                                    className={`qty-main ${
                                      row.reserved >
                                      0
                                        ? "reserved"
                                        : ""
                                    }`}
                                  >
                                    {formatNumber(
                                      row.reserved,
                                    )}
                                  </div>

                                  <div className="qty-sub">
                                    committed
                                  </div>
                                </td>

                                <td>
                                  <div className="qty-main">
                                    {formatNumber(
                                      row.available,
                                    )}
                                  </div>

                                  <div className="qty-sub">
                                    ready
                                  </div>
                                </td>

                                <td>
                                  <div className="mini-counts">
                                    <span className="mini-count">
                                      <Boxes
                                        size={
                                          11
                                        }
                                      />
                                      {
                                        row.batches
                                      }
                                    </span>

                                    <span className="mini-count">
                                      <MapPin
                                        size={
                                          11
                                        }
                                      />
                                      {
                                        row.locations
                                      }
                                    </span>

                                    <span className="mini-count">
                                      <Warehouse
                                        size={
                                          11
                                        }
                                      />
                                      {
                                        row.warehouses
                                      }
                                    </span>
                                  </div>
                                </td>

                                <td>
                                  <div className="value">
                                    {formatMoney(
                                      row.stockValue,
                                      settings,
                                    )}
                                  </div>
                                </td>

                                <td>
                                  <span className="tracking-pill">
                                    {trackingLabel(
                                      row.trackingMode,
                                    )}
                                  </span>
                                </td>

                                <td>
                                  <span
                                    className={`status-pill ${
                                      status ===
                                      "healthy"
                                        ? "status-healthy"
                                        : status ===
                                            "low"
                                          ? "status-low"
                                          : "status-out"
                                    }`}
                                  >
                                    {status ===
                                    "healthy"
                                      ? "Healthy"
                                      : status ===
                                          "low"
                                        ? "Low Stock"
                                        : "Out"}
                                  </span>
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="pagination">
                      <div className="pagination-info">
                        Showing{" "}
                        {(page - 1) *
                          PAGE_SIZE +
                          1}{" "}
                       –{" "}
                        {Math.min(
                          page *
                            PAGE_SIZE,
                          stockRows.length,
                        )}{" "}
                        of{" "}
                        {formatNumber(
                          stockRows.length,
                        )}
                      </div>

                      <div className="pagination-actions">
                        <button
                          type="button"
                          className="page-button"
                          onClick={() =>
                            setPage(
                              (current) =>
                                Math.max(
                                  1,
                                  current -
                                    1,
                                ),
                            )
                          }
                          disabled={
                            page <= 1
                          }
                          aria-label="Previous page"
                        >
                          <ChevronLeft
                            size={
                              14
                            }
                          />
                        </button>

                        <span className="page-number">
                          {page}
                        </span>

                        <button
                          type="button"
                          className="page-button"
                          onClick={() =>
                            setPage(
                              (current) =>
                                Math.min(
                                  totalPages,
                                  current +
                                    1,
                                ),
                            )
                          }
                          disabled={
                            page >=
                            totalPages
                          }
                          aria-label="Next page"
                        >
                          <ChevronRight
                            size={
                              14
                            }
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* =====================================================
                HEALTH + NEEDS ATTENTION
            ===================================================== */}

            <div className="secondary-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      Stock Health
                    </h2>

                    <p className="panel-description">
                      Availability condition across visible
                      stock lines
                    </p>
                  </div>

                  <CheckCircle2
                    size={17}
                    color={
                      health.out > 0
                        ? "#f59e0b"
                        : "#166534"
                    }
                  />
                </div>

                <div className="health-body">
                  <div className="health-summary">
                    <div>
                      <div className="health-percent">
                        {health.total >
                        0
                          ? `${health.healthyPercent}%`
                          : "—"}
                      </div>

                      <div className="health-percent-label">
                        healthy stock
                      </div>
                    </div>

                    <div>
                      <div className="health-bar">
                        {health.total >
                          0 && (
                          <>
                            <div
                              className="health-segment health-healthy"
                              style={{
                                width: `${(
                                  (health.healthy /
                                    health.total) *
                                  100
                                ).toFixed(
                                  2,
                                )}%`,
                              }}
                            />

                            <div
                              className="health-segment health-low"
                              style={{
                                width: `${(
                                  (health.low /
                                    health.total) *
                                  100
                                ).toFixed(
                                  2,
                                )}%`,
                              }}
                            />

                            <div
                              className="health-segment health-out"
                              style={{
                                width: `${(
                                  (health.out /
                                    health.total) *
                                  100
                                ).toFixed(
                                  2,
                                )}%`,
                              }}
                            />
                          </>
                        )}
                      </div>

                      <div className="health-legend">
                        <div className="health-legend-item">
                          <span className="health-legend-dot legend-green" />

                          <div className="health-legend-text">
                            <strong>
                              {formatNumber(
                                health.healthy,
                              )}
                            </strong>
                            Healthy
                          </div>
                        </div>

                        <div className="health-legend-item">
                          <span className="health-legend-dot legend-yellow" />

                          <div className="health-legend-text">
                            <strong>
                              {formatNumber(
                                health.low,
                              )}
                            </strong>
                            Low
                          </div>
                        </div>

                        <div className="health-legend-item">
                          <span className="health-legend-dot legend-gray" />

                          <div className="health-legend-text">
                            <strong>
                              {formatNumber(
                                health.out,
                              )}
                            </strong>
                            Out
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      Needs Attention
                    </h2>

                    <p className="panel-description">
                      Products with limited or unavailable
                      stock
                    </p>
                  </div>

                  <AlertTriangle
                    size={17}
                    color="#f59e0b"
                  />
                </div>

                <div className="attention-list">
                  {attentionRows.length ===
                  0 ? (
                    <div className="empty">
                      <div>
                        <div className="empty-icon">
                          <CheckCircle2
                            size={
                              20
                            }
                          />
                        </div>

                        <div className="empty-title">
                          Stock is looking good
                        </div>

                        <div className="empty-text">
                          No products are below the current
                          low-stock threshold.
                        </div>
                      </div>
                    </div>
                  ) : (
                    attentionRows.map(
                      (row) => {
                        const isOut =
                          row.available <=
                          0;

                        return (
                          <div
                            key={
                              row.key
                            }
                            className="attention-item"
                          >
                            <span
                              className={`attention-dot ${
                                isOut
                                  ? "out"
                                  : ""
                              }`}
                            />

                            <div>
                              <div className="attention-product">
                                {
                                  row.productName
                                }
                              </div>

                              <div className="attention-sku">
                                {
                                  row.variantName
                                }{" "}
                                ·{" "}
                                {
                                  row.sku
                                }
                              </div>
                            </div>

                            <div
                              className={`attention-value ${
                                isOut
                                  ? "out"
                                  : ""
                              }`}
                            >
                              {isOut
                                ? "OUT"
                                : `${formatNumber(
                                    row.available,
                                  )} left`}
                            </div>
                          </div>
                        );
                      },
                    )
                  )}
                </div>
              </div>
            </div>

            {/* =====================================================
                WAREHOUSE + RECENT ACTIVITY
            ===================================================== */}

            <div className="secondary-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      Warehouse Distribution
                    </h2>

                    <p className="panel-description">
                      Available stock by physical warehouse
                    </p>
                  </div>

                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      router.push(
                        "/warehouses",
                      )
                    }
                  >
                    Manage
                    <ChevronRight
                      size={
                        12
                      }
                    />
                  </button>
                </div>

                {warehouseSummary.length ===
                0 ? (
                  <div className="empty">
                    <div>
                      <div className="empty-icon">
                        <Warehouse
                          size={
                            20
                          }
                        />
                      </div>

                      <div className="empty-title">
                        No warehouse stock
                      </div>

                      <div className="empty-text">
                        Inventory will appear here after
                        physical stock is assigned to a
                        warehouse and location.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="warehouse-list">
                    {warehouseSummary
                      .slice(0, 6)
                      .map(
                        (
                          warehouse,
                        ) => {
                          const width =
                            Math.max(
                              2,
                              Math.round(
                                (warehouse.available /
                                  maxWarehouseStock) *
                                  100,
                              ),
                            );

                          return (
                            <div
                              key={
                                warehouse.id
                              }
                              className="warehouse-item"
                            >
                              <div className="warehouse-top">
                                <div className="warehouse-name">
                                  <div className="warehouse-icon">
                                    <Warehouse
                                      size={
                                        14
                                      }
                                    />
                                  </div>

                                  <div className="warehouse-name-text">
                                    {
                                      warehouse.name
                                    }

                                    <span className="warehouse-code">
                                      {
                                        warehouse.code
                                      }
                                    </span>
                                  </div>
                                </div>

                                <div className="warehouse-qty">
                                  {formatNumber(
                                    warehouse.available,
                                  )}
                                </div>
                              </div>

                              <div className="warehouse-bar">
                                <div
                                  className="warehouse-bar-fill"
                                  style={{
                                    width: `${width}%`,
                                  }}
                                />
                              </div>

                              <div className="warehouse-bottom">
                                <span>
                                  {formatNumber(
                                    warehouse.physical,
                                  )}{" "}
                                  physical
                                </span>

                                <span>
                                  {formatNumber(
                                    warehouse.reserved,
                                  )}{" "}
                                  reserved
                                </span>

                                <span>
                                  {
                                    warehouse
                                      .locations
                                      .size
                                  }{" "}
                                  locations
                                </span>
                              </div>
                            </div>
                          );
                        },
                      )}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      Recent Activity
                    </h2>

                    <p className="panel-description">
                      Latest inventory ledger events
                    </p>
                  </div>

                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      router.push(
                        "/inventory/movements",
                      )
                    }
                  >
                    View ledger
                    <ChevronRight
                      size={
                        12
                      }
                    />
                  </button>
                </div>

                {recentMovements.length ===
                0 ? (
                  <div className="empty">
                    <div>
                      <div className="empty-icon">
                        <Activity
                          size={
                            20
                          }
                        />
                      </div>

                      <div className="empty-title">
                        No recent movement
                      </div>

                      <div className="empty-text">
                        Inventory receipts, transfers,
                        adjustments, sales and returns will
                        appear here.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="activity-list">
                    {recentMovements.map(
                      (
                        movement,
                      ) => {
                        const product =
                          movement.product_id
                            ? productMap.get(
                                movement.product_id,
                              )
                            : null;

                        const variant =
                          movement.variant_id
                            ? variantMap.get(
                                movement.variant_id,
                              )
                            : null;

                        const warehouse =
                          movement.warehouse_id
                            ? warehouseMap.get(
                                movement.warehouse_id,
                              )
                            : null;

                        const inbound =
                          isInboundMovement(
                            movement.movement_type,
                          );

                        return (
                          <div
                            key={
                              movement.id
                            }
                            className="activity-item"
                          >
                            <div
                              className={`activity-icon ${
                                inbound
                                  ? "inbound"
                                  : "outbound"
                              }`}
                            >
                              {inbound ? (
                                <ArrowDownLeft
                                  size={
                                    14
                                  }
                                />
                              ) : (
                                <ArrowUpRight
                                  size={
                                    14
                                  }
                                />
                              )}
                            </div>

                            <div>
                              <div className="activity-title">
                                {movementLabel(
                                  movement.movement_type,
                                )}{" "}
                                ·{" "}
                                {product?.name ||
                                  "Inventory item"}
                              </div>

                              <div className="activity-meta">
                                {variant?.sku ||
                                  "No SKU"}

                                {warehouse
                                  ? ` · ${warehouse.name}`
                                  : ""}

                                {movement.reason
                                  ? ` · ${movement.reason}`
                                  : ""}
                              </div>
                            </div>

                            <div>
                              <div className="activity-qty">
                                {inbound
                                  ? "+"
                                  : "−"}
                                {formatNumber(
                                  Math.abs(
                                    movement.quantity,
                                  ),
                                )}
                              </div>

                              <div className="activity-time">
                                {formatRelative(
                                  movement.created_at,
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* =====================================================
                OPERATION SHORTCUTS
            ===================================================== */}

            <div className="operations">
              <div
                className="operation"
                onClick={() =>
                  router.push(
                    "/inventory/batches",
                  )
                }
              >
                <div className="operation-left">
                  <div className="operation-icon">
                    <Boxes
                      size={
                        15
                      }
                    />
                  </div>

                  <div>
                    <div className="operation-title">
                      Batches & Lots
                    </div>

                    <div className="operation-meta">
                      {formatNumber(
                        batches.length,
                      )}{" "}
                      batch records
                    </div>
                  </div>
                </div>

                <ChevronRight
                  size={
                    14
                  }
                  className="operation-arrow"
                />
              </div>

              <div
                className="operation"
                onClick={() =>
                  router.push(
                    "/serial-numbers",
                  )
                }
              >
                <div className="operation-left">
                  <div className="operation-icon">
                    <Zap
                      size={
                        15
                      }
                    />
                  </div>

                  <div>
                    <div className="operation-title">
                      Serial Assets
                    </div>

                    <div className="operation-meta">
                      {formatNumber(
                        serializedUnits.length,
                      )}{" "}
                      registered
                    </div>
                  </div>
                </div>

                <ChevronRight
                  size={
                    14
                  }
                  className="operation-arrow"
                />
              </div>

              <div
                className="operation"
                onClick={() =>
                  router.push(
                    "/inventory/adjustments",
                  )
                }
              >
                <div className="operation-left">
                  <div className="operation-icon">
                    <SlidersHorizontal
                      size={
                        15
                      }
                    />
                  </div>

                  <div>
                    <div className="operation-title">
                      Adjustments
                    </div>

                    <div className="operation-meta">
                      Correct physical balances
                    </div>
                  </div>
                </div>

                <ChevronRight
                  size={
                    14
                  }
                  className="operation-arrow"
                />
              </div>

              <div
                className="operation"
                onClick={() =>
                  router.push(
                    "/inventory/movements",
                  )
                }
              >
                <div className="operation-left">
                  <div className="operation-icon">
                    <Activity
                      size={
                        15
                      }
                    />
                  </div>

                  <div>
                    <div className="operation-title">
                      Movement Ledger
                    </div>

                    <div className="operation-meta">
                      {formatNumber(
                        periodMovements.length,
                      )}{" "}
                      in selected period
                    </div>
                  </div>
                </div>

                <ChevronRight
                  size={
                    14
                  }
                  className="operation-arrow"
                />
              </div>
            </div>

            {/* =====================================================
                QUARANTINE
            ===================================================== */}

            {quarantinedCount >
              0 && (
              <div className="notice">
                <div className="notice-left">
                  <AlertTriangle
                    size={
                      17
                    }
                    className="notice-icon"
                  />

                  <div>
                    <div className="notice-title">
                      {formatNumber(
                        quarantinedCount,
                      )}{" "}
                      quarantined batch
                      {quarantinedCount ===
                      1
                        ? ""
                        : "es"}{" "}
                      require review
                    </div>

                    <div className="notice-text">
                      Quarantined stock remains part of physical
                      inventory but should not be treated as
                      normal operational stock.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="button"
                  onClick={() =>
                    router.push(
                      "/inventory/batches",
                    )
                  }
                >
                  Review Batches
                  <ChevronRight
                    size={
                      13
                    }
                  />
                </button>
              </div>
            )}

            {/* =====================================================
                PERIOD FLOW FOOTER
            ===================================================== */}

            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: 12,
                marginTop: 16,
                padding: "11px 2px",
                color: "#94a3b8",
                fontSize: 10,
              }}
            >
              <div>
                Inventory flow ·{" "}
                {period === "7"
                  ? "Last 7 days"
                  : period ===
                      "30"
                    ? "Last 30 days"
                    : period ===
                        "90"
                      ? "Last 90 days"
                      : "Last year"}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: 14,
                }}
              >
                <span>
                  Inbound{" "}
                  <strong
                    style={{
                      color:
                        "#166534",
                    }}
                  >
                    +
                    {formatNumber(
                      flow.inbound,
                    )}
                  </strong>
                </span>

                <span>
                  Outbound{" "}
                  <strong
                    style={{
                      color:
                        "#c2410c",
                    }}
                  >
                    −
                    {formatNumber(
                      flow.outbound,
                    )}
                  </strong>
                </span>

                <span>
                  Net{" "}
                  <strong
                    style={{
                      color:
                        "#334155",
                    }}
                  >
                    {flow.net >=
                    0
                      ? "+"
                      : ""}
                    {formatNumber(
                      flow.net,
                    )}
                  </strong>
                </span>
              </div>

              <select
                className="select-control"
                value={period}
                onChange={(
                  event,
                ) =>
                  setPeriod(
                    event.target
                      .value,
                  )
                }
                style={{
                  width: 130,
                  height: 32,
                }}
              >
                <option value="7">
                  7 days
                </option>

                <option value="30">
                  30 days
                </option>

                <option value="90">
                  90 days
                </option>

                <option value="365">
                  1 year
                </option>
              </select>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}