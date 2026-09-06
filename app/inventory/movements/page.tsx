"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Movement = {
  id: string;
  company_id: string;
  inventory_id: string;
  product_id: string;
  variant_id: string;
  movement_type: string;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  warehouse_id: string | null;
  location_id: string | null;
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
};

type WarehouseLocation = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string;
};

type FilterType =
  | "all"
  | "stock_in"
  | "stock_out"
  | "sale"
  | "purchase"
  | "adjustment_in"
  | "adjustment_out"
  | "return"
  | "transfer_in"
  | "transfer_out";

const movementLabels: Record<string, string> = {
  stock_in: "Stock In",
  stock_out: "Stock Out",
  sale: "Sale",
  purchase: "Purchase",
  adjustment_in: "Adjustment In",
  adjustment_out: "Adjustment Out",
  return: "Return",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function movementLabel(type: string) {
  return movementLabels[type] || type.replace(/_/g, " ");
}

function isIncoming(type: string) {
  return [
    "stock_in",
    "purchase",
    "adjustment_in",
    "return",
    "transfer_in",
  ].includes(type);
}

function isOutgoing(type: string) {
  return [
    "stock_out",
    "sale",
    "adjustment_out",
    "transfer_out",
  ].includes(type);
}

function Icon({
  name,
  size = 18,
}: {
  name:
    | "arrow-left"
    | "refresh"
    | "search"
    | "filter"
    | "package"
    | "warehouse"
    | "calendar"
    | "in"
    | "out"
    | "chevron";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "arrow-left") {
    return (
      <svg {...common}>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
    );
  }

  if (name === "refresh") {
    return (
      <svg {...common}>
        <path d="M20 11a8.1 8.1 0 0 0-14.8-4L3 10" />
        <path d="M3 4v6h6" />
        <path d="M4 13a8.1 8.1 0 0 0 14.8 4L21 14" />
        <path d="M21 20v-6h-6" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
    );
  }

  if (name === "filter") {
    return (
      <svg {...common}>
        <path d="M4 6h16" />
        <path d="M7 12h10" />
        <path d="M10 18h4" />
      </svg>
    );
  }

  if (name === "package") {
    return (
      <svg {...common}>
        <path d="m16.5 9.4-9-5.19" />
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="M3.3 7 12 12l8.7-5" />
        <path d="M12 22V12" />
      </svg>
    );
  }

  if (name === "warehouse") {
    return (
      <svg {...common}>
        <path d="m3 10 9-6 9 6" />
        <path d="M5 9v10h14V9" />
        <path d="M9 19v-6h6v6" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    );
  }

  if (name === "in") {
    return (
      <svg {...common}>
        <path d="M12 19V5" />
        <path d="m6 11 6-6 6 6" />
      </svg>
    );
  }

  if (name === "out") {
    return (
      <svg {...common}>
        <path d="M12 5v14" />
        <path d="m18 13-6 6-6-6" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function InventoryMovementsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [movementFilter, setMovementFilter] =
    useState<FilterType>("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const loadData = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const {
          data: {
            user,
          },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("You must be signed in to view inventory movements.");
        }

        const { data: membership, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (!membership?.company_id) {
          throw new Error("No company membership was found.");
        }

        const currentCompanyId = membership.company_id;
        setCompanyId(currentCompanyId);

        const [
          movementsResult,
          productsResult,
          variantsResult,
          warehousesResult,
          locationsResult,
        ] = await Promise.all([
          supabase
            .from("inventory_movements")
            .select(
              `
                id,
                company_id,
                inventory_id,
                product_id,
                variant_id,
                movement_type,
                quantity,
                quantity_before,
                quantity_after,
                reason,
                reference_type,
                reference_id,
                notes,
                created_by,
                created_at,
                warehouse_id,
                location_id
              `
            )
            .eq("company_id", currentCompanyId)
            .order("created_at", { ascending: false })
            .limit(500),

          supabase
            .from("products")
            .select("id, name, brand, category")
            .eq("company_id", currentCompanyId),

          supabase
            .from("product_variants")
            .select("id, product_id, name, sku")
            .eq("company_id", currentCompanyId),

          supabase
            .from("warehouses")
            .select("id, name, code")
            .eq("company_id", currentCompanyId)
            .order("name"),

          supabase
            .from("warehouse_locations")
            .select("id, warehouse_id, name, code")
            .eq("company_id", currentCompanyId)
            .order("name"),
        ]);

        if (movementsResult.error) {
          throw movementsResult.error;
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

        setMovements((movementsResult.data || []) as Movement[]);
        setProducts((productsResult.data || []) as Product[]);
        setVariants((variantsResult.data || []) as ProductVariant[]);
        setWarehouses((warehousesResult.data || []) as Warehouse[]);
        setLocations(
          (locationsResult.data || []) as WarehouseLocation[]
        );
      } catch (loadError) {
        console.error("INVENTORY MOVEMENTS LOAD ERROR:", loadError);

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load inventory movements."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    // Initial data loading intentionally updates component state asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const productMap = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

  const variantMap = useMemo(() => {
    return new Map(variants.map((variant) => [variant.id, variant]));
  }, [variants]);

  const warehouseMap = useMemo(() => {
    return new Map(
      warehouses.map((warehouse) => [warehouse.id, warehouse])
    );
  }, [warehouses]);

  const locationMap = useMemo(() => {
    return new Map(
      locations.map((location) => [location.id, location])
    );
  }, [locations]);

  const filteredMovements = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return movements.filter((movement) => {
      const product = productMap.get(movement.product_id);
      const variant = variantMap.get(movement.variant_id);
      const warehouse = movement.warehouse_id
        ? warehouseMap.get(movement.warehouse_id)
        : undefined;
      const location = movement.location_id
        ? locationMap.get(movement.location_id)
        : undefined;

      const searchText = [
        product?.name,
        product?.brand,
        product?.category,
        variant?.name,
        variant?.sku,
        warehouse?.name,
        warehouse?.code,
        location?.name,
        location?.code,
        movement.movement_type,
        movement.reason,
        movement.reference_type,
        movement.reference_id,
        movement.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (
        normalizedSearch &&
        !searchText.includes(normalizedSearch)
      ) {
        return false;
      }

      if (
        movementFilter !== "all" &&
        movement.movement_type !== movementFilter
      ) {
        return false;
      }

      if (
        warehouseFilter !== "all" &&
        movement.warehouse_id !== warehouseFilter
      ) {
        return false;
      }

      if (dateFilter !== "all") {
        const movementDate = new Date(movement.created_at);
        const now = new Date();

        if (dateFilter === "today") {
          if (
            movementDate.toDateString() !== now.toDateString()
          ) {
            return false;
          }
        }

        if (dateFilter === "7") {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 7);

          if (movementDate < cutoff) {
            return false;
          }
        }

        if (dateFilter === "30") {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);

          if (movementDate < cutoff) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    movements,
    productMap,
    variantMap,
    warehouseMap,
    locationMap,
    search,
    movementFilter,
    warehouseFilter,
    dateFilter,
  ]);

  const stats = useMemo(() => {
    const incoming = movements
      .filter((movement) => isIncoming(movement.movement_type))
      .reduce((sum, movement) => sum + movement.quantity, 0);

    const outgoing = movements
      .filter((movement) => isOutgoing(movement.movement_type))
      .reduce((sum, movement) => sum + movement.quantity, 0);

    return {
      total: movements.length,
      incoming,
      outgoing,
      net: incoming - outgoing,
    };
  }, [movements]);

  const clearFilters = () => {
    setSearch("");
    setMovementFilter("all");
    setWarehouseFilter("all");
    setDateFilter("all");
  };

  const hasFilters =
    search.trim() !== "" ||
    movementFilter !== "all" ||
    warehouseFilter !== "all" ||
    dateFilter !== "all";

  return (
    <AppShell>
      <div className="movements-page">
        <style jsx>{`
          .movements-page {
            min-height: 100vh;
            background: #f8fafc;
            color: #0f172a;
            padding: 28px;
          }

          .container {
            max-width: 1500px;
            margin: 0 auto;
          }

          .topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 26px;
          }

          .heading {
            display: flex;
            align-items: flex-start;
            gap: 14px;
          }

          .back-button {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #475569;
            text-decoration: none;
            flex-shrink: 0;
          }

          .back-button:hover {
            background: #f1f5f9;
          }

          h1 {
            margin: 0;
            font-size: 28px;
            line-height: 1.2;
            letter-spacing: -0.02em;
          }

          .subtitle {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 14px;
          }

          .actions {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .button {
            height: 42px;
            padding: 0 15px;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
            color: #334155;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          }

          .button:hover {
            background: #f8fafc;
          }

          .stats {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 20px;
          }

          .stat {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 18px;
          }

          .stat-label {
            color: #64748b;
            font-size: 13px;
            font-weight: 600;
          }

          .stat-value {
            margin-top: 7px;
            font-size: 25px;
            font-weight: 700;
            letter-spacing: -0.02em;
          }

          .filters {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 18px;
          }

          .filter-row {
            display: grid;
            grid-template-columns: minmax(260px, 1.8fr) repeat(
                3,
                minmax(150px, 1fr)
              ) auto;
            gap: 10px;
            align-items: center;
          }

          .search-box {
            position: relative;
          }

          .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
            pointer-events: none;
          }

          .input,
          .select {
            width: 100%;
            height: 42px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            background: #ffffff;
            color: #0f172a;
            padding: 0 12px;
            font-size: 14px;
            outline: none;
          }

          .search-input {
            padding-left: 40px;
          }

          .input:focus,
          .select:focus {
            border-color: #94a3b8;
          }

          .clear-button {
            height: 42px;
            padding: 0 12px;
            border: 0;
            background: transparent;
            color: #64748b;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
          }

          .clear-button:hover {
            color: #0f172a;
          }

          .table-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            overflow: hidden;
          }

          .table-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 17px 18px;
            border-bottom: 1px solid #e2e8f0;
          }

          .table-title {
            font-size: 16px;
            font-weight: 700;
          }

          .table-count {
            color: #64748b;
            font-size: 13px;
          }

          .table-wrap {
            width: 100%;
            overflow-x: auto;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            min-width: 1050px;
          }

          th {
            text-align: left;
            padding: 12px 16px;
            background: #f8fafc;
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 1px solid #e2e8f0;
            white-space: nowrap;
          }

          td {
            padding: 15px 16px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: middle;
            font-size: 13px;
          }

          tr:last-child td {
            border-bottom: 0;
          }

          .product-cell {
            display: flex;
            flex-direction: column;
            gap: 3px;
            min-width: 210px;
          }

          .product-name {
            color: #0f172a;
            font-weight: 700;
            text-decoration: none;
          }

          .product-name:hover {
            text-decoration: underline;
          }

          .variant-name {
            color: #64748b;
            font-size: 12px;
          }

          .sku {
            color: #94a3b8;
            font-size: 11px;
          }

          .movement-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border-radius: 999px;
            padding: 6px 9px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
          }

          .movement-in {
            background: #ecfdf5;
            color: #047857;
          }

          .movement-out {
            background: #fff1f2;
            color: #be123c;
          }

          .movement-neutral {
            background: #f1f5f9;
            color: #475569;
          }

          .quantity-in {
            color: #047857;
            font-weight: 700;
          }

          .quantity-out {
            color: #be123c;
            font-weight: 700;
          }

          .balance {
            font-weight: 700;
          }

          .location-cell {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .warehouse-name {
            font-weight: 600;
          }

          .location-name {
            color: #64748b;
            font-size: 12px;
          }

          .date-cell {
            white-space: nowrap;
          }

          .date-main {
            font-weight: 600;
          }

          .date-time {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 11px;
          }

          .reference {
            max-width: 190px;
            color: #475569;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .empty {
            padding: 70px 20px;
            text-align: center;
            color: #64748b;
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

          .empty-title {
            color: #0f172a;
            font-size: 16px;
            font-weight: 700;
          }

          .empty-text {
            max-width: 440px;
            margin: 7px auto 0;
            font-size: 13px;
            line-height: 1.6;
          }

          .error {
            margin-bottom: 18px;
            padding: 13px 15px;
            border: 1px solid #fecdd3;
            border-radius: 10px;
            background: #fff1f2;
            color: #be123c;
            font-size: 13px;
          }

          .loading {
            padding: 60px 20px;
            text-align: center;
            color: #64748b;
          }

          .footer-note {
            margin-top: 14px;
            color: #94a3b8;
            font-size: 12px;
          }

          @media (max-width: 1100px) {
            .filter-row {
              grid-template-columns: 1fr 1fr;
            }

            .search-box {
              grid-column: 1 / -1;
            }

            .clear-button {
              justify-self: start;
            }
          }

          @media (max-width: 800px) {
            .movements-page {
              padding: 18px 14px 30px;
            }

            .topbar {
              align-items: flex-start;
              flex-direction: column;
            }

            .actions {
              width: 100%;
            }

            .actions .button {
              flex: 1;
            }

            .stats {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .filter-row {
              grid-template-columns: 1fr;
            }

            .search-box {
              grid-column: auto;
            }

            h1 {
              font-size: 24px;
            }
          }

          @media (max-width: 480px) {
            .stats {
              grid-template-columns: 1fr;
            }

            .heading {
              gap: 10px;
            }

            .back-button {
              width: 38px;
              height: 38px;
            }
          }
        `}</style>

        <div className="container">
          <div className="topbar">
            <div className="heading">
              <Link
                href="/inventory"
                className="back-button"
                aria-label="Back to inventory"
              >
                <Icon name="arrow-left" />
              </Link>

              <div>
                <h1>Movement History</h1>
                <p className="subtitle">
                  Complete inventory movement and audit ledger.
                </p>
              </div>
            </div>

            <div className="actions">
              <Link
                href="/inventory"
                className="button"
              >
                <Icon name="package" size={16} />
                Inventory
              </Link>

              <button
                type="button"
                className="button"
                onClick={() => void loadData(true)}
                disabled={refreshing}
              >
                <Icon name="refresh" size={16} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="stats">
            <div className="stat">
              <div className="stat-label">Total Movements</div>
              <div className="stat-value">
                {formatNumber(stats.total)}
              </div>
            </div>

            <div className="stat">
              <div className="stat-label">Units In</div>
              <div className="stat-value">
                {formatNumber(stats.incoming)}
              </div>
            </div>

            <div className="stat">
              <div className="stat-label">Units Out</div>
              <div className="stat-value">
                {formatNumber(stats.outgoing)}
              </div>
            </div>

            <div className="stat">
              <div className="stat-label">Net Movement</div>
              <div className="stat-value">
                {stats.net >= 0 ? "+" : ""}
                {formatNumber(stats.net)}
              </div>
            </div>
          </div>

          <div className="filters">
            <div className="filter-row">
              <div className="search-box">
                <span className="search-icon">
                  <Icon name="search" size={17} />
                </span>

                <input
                  type="search"
                  className="input search-input"
                  placeholder="Search products, SKU, warehouse, reference..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              <select
                className="select"
                value={movementFilter}
                onChange={(event) =>
                  setMovementFilter(
                    event.target.value as FilterType
                  )
                }
              >
                <option value="all">All Movement Types</option>
                <option value="stock_in">Stock In</option>
                <option value="stock_out">Stock Out</option>
                <option value="sale">Sale</option>
                <option value="purchase">Purchase</option>
                <option value="adjustment_in">
                  Adjustment In
                </option>
                <option value="adjustment_out">
                  Adjustment Out
                </option>
                <option value="return">Return</option>
                <option value="transfer_in">
                  Transfer In
                </option>
                <option value="transfer_out">
                  Transfer Out
                </option>
              </select>

              <select
                className="select"
                value={warehouseFilter}
                onChange={(event) =>
                  setWarehouseFilter(event.target.value)
                }
              >
                <option value="all">All Warehouses</option>

                {warehouses.map((warehouse) => (
                  <option
                    key={warehouse.id}
                    value={warehouse.id}
                  >
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>

              <select
                className="select"
                value={dateFilter}
                onChange={(event) =>
                  setDateFilter(event.target.value)
                }
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
              </select>

              {hasFilters && (
                <button
                  type="button"
                  className="clear-button"
                  onClick={clearFilters}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="table-card">
            <div className="table-header">
              <div>
                <div className="table-title">
                  Inventory Movements
                </div>
                <div className="table-count">
                  Showing {formatNumber(filteredMovements.length)}{" "}
                  of {formatNumber(movements.length)} movements
                </div>
              </div>
            </div>

            {loading ? (
              <div className="loading">
                Loading movement history...
              </div>
            ) : filteredMovements.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">
                  <Icon name="package" size={24} />
                </div>

                <div className="empty-title">
                  {hasFilters
                    ? "No matching movements"
                    : "No inventory movements yet"}
                </div>

                <div className="empty-text">
                  {hasFilters
                    ? "Try changing your search or filters."
                    : "Inventory movements will appear here when stock is received, sold, adjusted, returned, or transferred."}
                </div>

                {hasFilters && (
                  <button
                    type="button"
                    className="button"
                    style={{ marginTop: 16 }}
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Movement</th>
                      <th>Quantity</th>
                      <th>Balance</th>
                      <th>Warehouse / Location</th>
                      <th>Reference</th>
                      <th>Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMovements.map((movement) => {
                      const product = productMap.get(
                        movement.product_id
                      );
                      const variant = variantMap.get(
                        movement.variant_id
                      );
                      const warehouse = movement.warehouse_id
                        ? warehouseMap.get(movement.warehouse_id)
                        : undefined;
                      const location = movement.location_id
                        ? locationMap.get(movement.location_id)
                        : undefined;

                      const incoming = isIncoming(
                        movement.movement_type
                      );
                      const outgoing = isOutgoing(
                        movement.movement_type
                      );

                      const reference = [
                        movement.reference_type,
                        movement.reference_id,
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      return (
                        <tr key={movement.id}>
                          <td>
                            <div className="product-cell">
                              <Link
                                href={`/inventory/${movement.product_id}`}
                                className="product-name"
                              >
                                {product?.name ||
                                  "Unknown Product"}
                              </Link>

                              {variant?.name && (
                                <div className="variant-name">
                                  {variant.name}
                                </div>
                              )}

                              {variant?.sku && (
                                <div className="sku">
                                  SKU: {variant.sku}
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            <span
                              className={`movement-badge ${
                                incoming
                                  ? "movement-in"
                                  : outgoing
                                    ? "movement-out"
                                    : "movement-neutral"
                              }`}
                            >
                              <Icon
                                name={
                                  incoming ? "in" : "out"
                                }
                                size={13}
                              />
                              {movementLabel(
                                movement.movement_type
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={
                                incoming
                                  ? "quantity-in"
                                  : outgoing
                                    ? "quantity-out"
                                    : ""
                              }
                            >
                              {incoming
                                ? "+"
                                : outgoing
                                  ? "-"
                                  : ""}
                              {formatNumber(
                                movement.quantity
                              )}
                            </span>
                          </td>

                          <td>
                            <span className="balance">
                              {formatNumber(
                                movement.quantity_before
                              )}{" "}
                              →{" "}
                              {formatNumber(
                                movement.quantity_after
                              )}
                            </span>
                          </td>

                          <td>
                            <div className="location-cell">
                              <div className="warehouse-name">
                                {warehouse?.name ||
                                  "No warehouse"}
                              </div>

                              <div className="location-name">
                                {location
                                  ? `${location.name} (${location.code})`
                                  : "No location"}
                              </div>
                            </div>
                          </td>

                          <td>
                            <div
                              className="reference"
                              title={
                                reference ||
                                movement.reason ||
                                movement.notes ||
                                ""
                              }
                            >
                              {reference ||
                                movement.reason ||
                                movement.notes ||
                                "—"}
                            </div>
                          </td>

                          <td>
                            <div className="date-cell">
                              <div className="date-main">
                                {formatDate(
                                  movement.created_at
                                )}
                              </div>

                              <div className="date-time">
                                {formatTime(
                                  movement.created_at
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {companyId && (
            <div className="footer-note">
              Movement history is restricted to your company
              inventory.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}