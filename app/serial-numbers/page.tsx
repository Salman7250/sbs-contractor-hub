"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  tracking_mode: string;
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
};

type WarehouseLocation = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string;
};

type Customer = {
  id: string;
  name: string;
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
  customer_id: string | null;
  cost_price: number | null;
  warranty_start: string | null;
  warranty_end: string | null;
  received_at: string | null;
  sold_at: string | null;
  notes: string | null;
  created_at: string;
};

const STATUS_OPTIONS = [
  "available",
  "reserved",
  "sold",
  "returned",
  "repair",
  "rma",
  "damaged",
  "lost",
  "disposed",
];

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(value: number | null, currency: string) {
  if (value === null || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function getStatusClass(status: string) {
  switch (status) {
    case "available":
      return "status available";
    case "reserved":
      return "status reserved";
    case "sold":
      return "status sold";
    case "returned":
      return "status returned";
    case "repair":
      return "status repair";
    case "rma":
      return "status rma";
    case "damaged":
      return "status damaged";
    case "lost":
      return "status lost";
    case "disposed":
      return "status disposed";
    default:
      return "status";
  }
}

function getStatusLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function SerialNumbersPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [currency, setCurrency] = useState("USD");

  const [serialUnits, setSerialUnits] = useState<SerializedUnit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const loadData = useCallback(
    async (showRefresh = false) => {
      try {
        setError("");

        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const { data: membership, error: membershipError } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (!membership?.company_id) {
          throw new Error("No company is associated with your account.");
        }

        const currentCompanyId = membership.company_id;

        const [
          companyResult,
          serialResult,
          productResult,
          variantResult,
          warehouseResult,
          locationResult,
        ] = await Promise.all([
          supabase
            .from("companies")
            .select("currency")
            .eq("id", currentCompanyId)
            .maybeSingle(),

          supabase
            .from("serialized_units")
            .select(
              `
                id,
                product_id,
                variant_id,
                serial_number,
                barcode,
                status,
                warehouse_id,
                location_id,
                customer_id,
                cost_price,
                warranty_start,
                warranty_end,
                received_at,
                sold_at,
                notes,
                created_at
              `,
            )
            .eq("company_id", currentCompanyId)
            .order("created_at", { ascending: false }),

          supabase
            .from("products")
            .select("id, name, tracking_mode")
            .eq("company_id", currentCompanyId)
            .eq("tracking_mode", "serial")
            .order("name"),

          supabase
            .from("product_variants")
            .select("id, product_id, name, sku")
            .eq("company_id", currentCompanyId)
            .order("name"),

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

        if (companyResult.error) throw companyResult.error;
        if (serialResult.error) throw serialResult.error;
        if (productResult.error) throw productResult.error;
        if (variantResult.error) throw variantResult.error;
        if (warehouseResult.error) throw warehouseResult.error;
        if (locationResult.error) throw locationResult.error;

        setCurrency(companyResult.data?.currency || "USD");
        setSerialUnits((serialResult.data || []) as SerializedUnit[]);
        setProducts((productResult.data || []) as Product[]);
        setVariants((variantResult.data || []) as Variant[]);
        setWarehouses((warehouseResult.data || []) as Warehouse[]);
        setLocations((locationResult.data || []) as WarehouseLocation[]);

        const customerIds = Array.from(
          new Set(
            ((serialResult.data || []) as SerializedUnit[])
              .map((unit) => unit.customer_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );

        if (customerIds.length > 0) {
          const { data: customerData, error: customerError } = await supabase
            .from("customers")
            .select("id, name")
            .eq("company_id", currentCompanyId)
            .in("id", customerIds);

          if (customerError) {
            throw customerError;
          }

          setCustomers((customerData || []) as Customer[]);
        } else {
          setCustomers([]);
        }
      } catch (loadError) {
        console.error("Failed to load serial numbers:", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load serial numbers.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const variantMap = useMemo(
    () => new Map(variants.map((variant) => [variant.id, variant])),
    [variants],
  );

  const warehouseMap = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );

  const locationMap = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );

  const customerMap = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const filteredUnits = useMemo(() => {
    const query = search.trim().toLowerCase();

    return serialUnits.filter((unit) => {
      const product = productMap.get(unit.product_id);
      const variant = unit.variant_id
        ? variantMap.get(unit.variant_id)
        : undefined;
      const warehouse = unit.warehouse_id
        ? warehouseMap.get(unit.warehouse_id)
        : undefined;
      const location = unit.location_id
        ? locationMap.get(unit.location_id)
        : undefined;
      const customer = unit.customer_id
        ? customerMap.get(unit.customer_id)
        : undefined;

      const matchesSearch =
        !query ||
        unit.serial_number.toLowerCase().includes(query) ||
        Boolean(unit.barcode?.toLowerCase().includes(query)) ||
        Boolean(product?.name.toLowerCase().includes(query)) ||
        Boolean(variant?.name?.toLowerCase().includes(query)) ||
        Boolean(variant?.sku?.toLowerCase().includes(query)) ||
        Boolean(warehouse?.name.toLowerCase().includes(query)) ||
        Boolean(location?.name.toLowerCase().includes(query)) ||
        Boolean(customer?.name.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "all" || unit.status === statusFilter;

      const matchesWarehouse =
        warehouseFilter === "all" ||
        unit.warehouse_id === warehouseFilter;

      return matchesSearch && matchesStatus && matchesWarehouse;
    });
  }, [
    serialUnits,
    productMap,
    variantMap,
    warehouseMap,
    locationMap,
    customerMap,
    search,
    statusFilter,
    warehouseFilter,
  ]);

  const stats = useMemo(() => {
    const total = serialUnits.length;

    const available = serialUnits.filter(
      (unit) => unit.status === "available",
    ).length;

    const reserved = serialUnits.filter(
      (unit) => unit.status === "reserved",
    ).length;

    const sold = serialUnits.filter((unit) => unit.status === "sold").length;

    const service = serialUnits.filter((unit) =>
      ["repair", "rma"].includes(unit.status),
    ).length;

    const totalCost = serialUnits.reduce(
      (sum, unit) => sum + Number(unit.cost_price || 0),
      0,
    );

    return {
      total,
      available,
      reserved,
      sold,
      service,
      totalCost,
    };
  }, [serialUnits]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setWarehouseFilter("all");
  };

  return (
    <AppShell>
      <div className="serial-page">
        <style jsx global>{`
          .serial-page {
            min-height: 100%;
            padding: 28px;
            background: #f7f8fa;
          }

          .serial-page *,
          .serial-page *::before,
          .serial-page *::after {
            box-sizing: border-box;
          }

          .serial-page button {
            font-family: inherit;
          }

          .serial-page .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            margin-bottom: 24px;
          }

          .serial-page .eyebrow {
            margin: 0 0 6px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #6b7280;
          }

          .serial-page h1 {
            margin: 0;
            font-size: 30px;
            line-height: 1.15;
            color: #111827;
          }

          .serial-page .subtitle {
            margin: 8px 0 0;
            color: #6b7280;
            font-size: 14px;
          }

          .serial-page .header-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }

          .serial-page .button {
            min-height: 42px !important;
            height: 42px;
            border: 1px solid #d1d5db !important;
            border-radius: 10px !important;
            padding: 0 15px !important;
            background: #ffffff !important;
            color: #111827 !important;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none !important;
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
            appearance: none;
            -webkit-appearance: none;
          }

          .serial-page .button:hover {
            background: #f9fafb !important;
            border-color: #9ca3af !important;
            color: #111827 !important;
          }

          .serial-page .button.primary {
            border: 1px solid #111827 !important;
            background: #111827 !important;
            color: #ffffff !important;
          }

          .serial-page .button.primary:hover {
            border-color: #1f2937 !important;
            background: #1f2937 !important;
            color: #ffffff !important;
          }

          .serial-page .button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .serial-page .stats {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
          }

          .serial-page .stat {
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
            padding: 16px;
            min-width: 0;
          }

          .serial-page .stat-label {
            color: #6b7280;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
          }

          .serial-page .stat-value {
            color: #111827;
            font-size: 24px;
            font-weight: 750;
            line-height: 1;
          }

          .serial-page .filters {
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
            padding: 16px;
            margin-bottom: 16px;
          }

          .serial-page .filter-grid {
            display: grid;
            grid-template-columns: minmax(240px, 1fr) 180px 200px auto;
            gap: 10px;
            align-items: end;
          }

          .serial-page .field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .serial-page .field label {
            font-size: 12px;
            font-weight: 700;
            color: #4b5563;
          }

          .serial-page .input,
          .serial-page .select {
            width: 100% !important;
            min-height: 42px !important;
            height: 42px;
            border: 1px solid #d1d5db !important;
            border-radius: 9px !important;
            padding: 0 12px !important;
            background: #ffffff !important;
            color: #111827 !important;
            outline: none;
            font-size: 14px;
            box-shadow: none !important;
          }

          .serial-page .input:focus,
          .serial-page .select:focus {
            border-color: #111827 !important;
            box-shadow: 0 0 0 1px #111827 !important;
          }

          .serial-page .table-card {
            overflow: hidden;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
          }

          .serial-page .table-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding: 16px 18px;
            border-bottom: 1px solid #e5e7eb;
          }

          .serial-page .table-title {
            font-size: 15px;
            font-weight: 750;
            color: #111827;
          }

          .serial-page .table-count {
            color: #6b7280;
            font-size: 13px;
          }

          .serial-page .table-wrap {
            width: 100%;
            overflow-x: auto;
          }

          .serial-page table {
            width: 100%;
            border-collapse: collapse;
            min-width: 1180px;
          }

          .serial-page th {
            padding: 12px 16px;
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
            color: #6b7280;
            font-size: 11px;
            font-weight: 750;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .serial-page td {
            padding: 14px 16px;
            border-bottom: 1px solid #f0f1f3;
            color: #374151;
            font-size: 13px;
            vertical-align: middle;
          }

          .serial-page tbody tr:hover {
            background: #fafafa;
          }

          .serial-page tbody tr:last-child td {
            border-bottom: 0;
          }

          .serial-page .serial-link {
            display: inline-flex;
            flex-direction: column;
            gap: 4px;
            color: #111827 !important;
            text-decoration: none !important;
            font-weight: 700;
          }

          .serial-page .serial-link:hover {
            text-decoration: underline !important;
          }

          .serial-page .barcode {
            color: #9ca3af;
            font-size: 11px;
            font-weight: 500;
          }

          .serial-page .product-name {
            color: #111827;
            font-weight: 650;
          }

          .serial-page .secondary {
            margin-top: 3px;
            color: #9ca3af;
            font-size: 11px;
          }

          .serial-page .location {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .serial-page .location-main {
            color: #111827;
            font-weight: 600;
          }

          .serial-page .location-sub {
            color: #6b7280;
            font-size: 11px;
          }

          .serial-page .status {
            display: inline-flex;
            align-items: center;
            width: fit-content;
            border-radius: 999px;
            padding: 5px 9px;
            background: #f3f4f6;
            color: #4b5563;
            font-size: 11px;
            font-weight: 750;
          }

          .serial-page .status.available {
            background: #ecfdf5;
            color: #047857;
          }

          .serial-page .status.reserved {
            background: #fffbeb;
            color: #b45309;
          }

          .serial-page .status.sold {
            background: #eff6ff;
            color: #1d4ed8;
          }

          .serial-page .status.returned {
            background: #f5f3ff;
            color: #6d28d9;
          }

          .serial-page .status.repair,
          .serial-page .status.rma {
            background: #fff7ed;
            color: #c2410c;
          }

          .serial-page .status.damaged,
          .serial-page .status.lost,
          .serial-page .status.disposed {
            background: #fef2f2;
            color: #b91c1c;
          }

          .serial-page .empty {
            padding: 60px 20px;
            text-align: center;
          }

          .serial-page .empty-title {
            margin: 0 0 8px;
            color: #111827;
            font-size: 16px;
            font-weight: 750;
          }

          .serial-page .empty-text {
            margin: 0;
            color: #6b7280;
            font-size: 13px;
          }

          .serial-page .error {
            margin-bottom: 16px;
            border: 1px solid #fecaca;
            border-radius: 10px;
            background: #fef2f2;
            color: #b91c1c;
            padding: 12px 14px;
            font-size: 13px;
          }

          .serial-page .loading {
            padding: 60px 20px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
          }

          @media (max-width: 1200px) {
            .serial-page .stats {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .serial-page .filter-grid {
              grid-template-columns: 1fr 1fr;
            }
          }

          @media (max-width: 760px) {
            .serial-page {
              padding: 18px;
            }

            .serial-page .header {
              flex-direction: column;
            }

            .serial-page h1 {
              font-size: 26px;
            }

            .serial-page .header-actions {
              width: 100%;
            }

            .serial-page .header-actions .button {
              flex: 1;
            }

            .serial-page .stats {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .serial-page .filter-grid {
              grid-template-columns: 1fr;
            }

            .serial-page .table-header {
              align-items: flex-start;
              flex-direction: column;
            }
          }
        `}</style>

        <div className="header">
          <div>
            <p className="eyebrow">Inventory</p>
            <h1>Serial Numbers</h1>
            <p className="subtitle">
              Track every serialized asset across your inventory, warehouses,
              customers, and lifecycle statuses.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <Link href="/inventory" className="button">
              Inventory
            </Link>

            <Link href="/serial-numbers/new" className="button primary">
              Add Serial Number
            </Link>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <div className="stats">
          <div className="stat">
            <div className="stat-label">Total Serialized Units</div>
            <div className="stat-value">{stats.total}</div>
          </div>

          <div className="stat">
            <div className="stat-label">Available</div>
            <div className="stat-value">{stats.available}</div>
          </div>

          <div className="stat">
            <div className="stat-label">Reserved</div>
            <div className="stat-value">{stats.reserved}</div>
          </div>

          <div className="stat">
            <div className="stat-label">Sold</div>
            <div className="stat-value">{stats.sold}</div>
          </div>

          <div className="stat">
            <div className="stat-label">Repair / RMA</div>
            <div className="stat-value">{stats.service}</div>
          </div>

          <div className="stat">
            <div className="stat-label">Inventory Cost</div>
            <div className="stat-value">
              {formatCurrency(stats.totalCost, currency)}
            </div>
          </div>
        </div>

        <div className="filters">
          <div className="filter-grid">
            <div className="field">
              <label htmlFor="serial-search">Search</label>
              <input
                id="serial-search"
                className="input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Serial, barcode, product, SKU, warehouse..."
              />
            </div>

            <div className="field">
              <label htmlFor="serial-status">Status</label>
              <select
                id="serial-status"
                className="select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>

                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="serial-warehouse">Warehouse</label>
              <select
                id="serial-warehouse"
                className="select"
                value={warehouseFilter}
                onChange={(event) => setWarehouseFilter(event.target.value)}
              >
                <option value="all">All warehouses</option>

                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="button"
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <div className="table-title">Serialized Inventory</div>

            <div className="table-count">
              Showing {filteredUnits.length} of {serialUnits.length}
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading serial numbers...</div>
          ) : filteredUnits.length === 0 ? (
            <div className="empty">
              <p className="empty-title">
                {serialUnits.length === 0
                  ? "No serial numbers yet"
                  : "No matching serial numbers"}
              </p>

              <p className="empty-text">
                {serialUnits.length === 0
                  ? "Create your first serialized inventory unit to start tracking assets."
                  : "Try changing your search or filters."}
              </p>

              {serialUnits.length === 0 ? (
                <div style={{ marginTop: 16 }}>
                  <Link
                    href="/serial-numbers/new"
                    className="button primary"
                  >
                    Add Serial Number
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Serial Number</th>
                    <th>Product</th>
                    <th>Status</th>
                    <th>Warehouse / Location</th>
                    <th>Customer</th>
                    <th>Cost</th>
                    <th>Warranty</th>
                    <th>Received</th>
                    <th>Sold</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUnits.map((unit) => {
                    const product = productMap.get(unit.product_id);
                    const variant = unit.variant_id
                      ? variantMap.get(unit.variant_id)
                      : undefined;
                    const warehouse = unit.warehouse_id
                      ? warehouseMap.get(unit.warehouse_id)
                      : undefined;
                    const location = unit.location_id
                      ? locationMap.get(unit.location_id)
                      : undefined;
                    const customer = unit.customer_id
                      ? customerMap.get(unit.customer_id)
                      : undefined;

                    return (
                      <tr key={unit.id}>
                        <td>
                          <Link
                            href={`/serial-numbers/${unit.id}`}
                            className="serial-link"
                          >
                            <span>{unit.serial_number}</span>

                            {unit.barcode ? (
                              <span className="barcode">
                                Barcode: {unit.barcode}
                              </span>
                            ) : null}
                          </Link>
                        </td>

                        <td>
                          <div className="product-name">
                            {product?.name || "Unknown product"}
                          </div>

                          {variant?.name || variant?.sku ? (
                            <div className="secondary">
                              {variant?.name || ""}
                              {variant?.name && variant?.sku ? " · " : ""}
                              {variant?.sku || ""}
                            </div>
                          ) : null}
                        </td>

                        <td>
                          <span className={getStatusClass(unit.status)}>
                            {getStatusLabel(unit.status)}
                          </span>
                        </td>

                        <td>
                          {warehouse || location ? (
                            <div className="location">
                              <span className="location-main">
                                {warehouse?.name || "No warehouse"}
                              </span>

                              <span className="location-sub">
                                {location
                                  ? `${location.name}${
                                      location.code
                                        ? ` (${location.code})`
                                        : ""
                                    }`
                                  : "No location"}
                              </span>
                            </div>
                          ) : (
                            <span className="secondary">Unassigned</span>
                          )}
                        </td>

                        <td>
                          {customer?.name || (
                            <span className="secondary">
                              Not assigned
                            </span>
                          )}
                        </td>

                        <td>
                          {formatCurrency(unit.cost_price, currency)}
                        </td>

                        <td>
                          {unit.warranty_start || unit.warranty_end ? (
                            <div className="location">
                              <span className="location-main">
                                {formatDate(unit.warranty_end)}
                              </span>

                              <span className="location-sub">
                                Started {formatDate(unit.warranty_start)}
                              </span>
                            </div>
                          ) : (
                            <span className="secondary">No warranty</span>
                          )}
                        </td>

                        <td>{formatDate(unit.received_at)}</td>

                        <td>{formatDate(unit.sold_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
