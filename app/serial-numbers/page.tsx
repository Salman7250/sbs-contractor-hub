"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type SerialStatus =
  | "available"
  | "reserved"
  | "sold"
  | "returned"
  | "repair"
  | "rma"
  | "damaged"
  | "lost"
  | "disposed";

type SerializedUnit = {
  id: string;
  company_id: string;
  product_id: string;
  variant_id: string | null;
  serial_number: string;
  barcode: string | null;
  status: SerialStatus;
  warehouse_id: string | null;
  customer_id: string | null;
  order_id: string | null;
  invoice_id: string | null;
  cost_price: number;
  warranty_start: string | null;
  warranty_end: string | null;
  received_at: string | null;
  sold_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    brand: string | null;
  } | null;
  variant?: {
    id: string;
    name: string;
    sku: string | null;
  } | null;
  customer?: {
    id: string;
    name: string;
  } | null;
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
};

const STATUS_OPTIONS: {
  value: "all" | SerialStatus;
  label: string;
}[] = [
  { value: "all", label: "All Statuses" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "returned", label: "Returned" },
  { value: "repair", label: "Repair" },
  { value: "rma", label: "RMA" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost" },
  { value: "disposed", label: "Disposed" },
];

function statusLabel(status: SerialStatus) {
  switch (status) {
    case "available":
      return "Available";
    case "reserved":
      return "Reserved";
    case "sold":
      return "Sold";
    case "returned":
      return "Returned";
    case "repair":
      return "Repair";
    case "rma":
      return "RMA";
    case "damaged":
      return "Damaged";
    case "lost":
      return "Lost";
    case "disposed":
      return "Disposed";
    default:
      return status;
  }
}

function statusClasses(status: SerialStatus) {
  switch (status) {
    case "available":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "reserved":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "sold":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "returned":
      return "bg-violet-50 text-violet-700 ring-violet-200";
    case "repair":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "rma":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "damaged":
      return "bg-red-50 text-red-700 ring-red-200";
    case "lost":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "disposed":
      return "bg-slate-100 text-slate-500 ring-slate-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div
      className="rounded-xl bg-white p-5"
      style={{
        border: "1px solid #e2e8f0",
      }}
    >
      <div className="text-sm font-medium text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {value.toLocaleString()}
      </div>

      <div className="mt-1 text-xs text-slate-400">
        {description}
      </div>
    </div>
  );
}

export default function SerialNumbersPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");

  const [serialUnits, setSerialUnits] = useState<
    SerializedUnit[]
  >([]);

  const [products, setProducts] = useState<Product[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | SerialStatus
  >("all");
  const [productFilter, setProductFilter] =
    useState("all");

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");

      // ------------------------------------------------------
      // 1. Authenticate
      // ------------------------------------------------------
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login");
        return;
      }

      // ------------------------------------------------------
      // 2. Get company membership
      // ------------------------------------------------------
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
        setErrorMessage(
          "No company membership was found for this account."
        );
        return;
      }

      const currentCompanyId = membership.company_id;

      setCompanyId(currentCompanyId);

      // ------------------------------------------------------
      // 3. Get company currency
      // ------------------------------------------------------
      const { data: company, error: companyError } =
        await supabase
          .from("companies")
          .select("id, currency")
          .eq("id", currentCompanyId)
          .maybeSingle();

      if (companyError) {
        throw companyError;
      }

      setCurrency(company?.currency || "USD");

      // ------------------------------------------------------
      // 4. Load serialized units
      // ------------------------------------------------------
      const {
        data: serializedData,
        error: serializedError,
      } = await supabase
        .from("serialized_units")
        .select(
          `
            id,
            company_id,
            product_id,
            variant_id,
            serial_number,
            barcode,
            status,
            warehouse_id,
            customer_id,
            order_id,
            invoice_id,
            cost_price,
            warranty_start,
            warranty_end,
            received_at,
            sold_at,
            notes,
            created_at,
            updated_at,
            products (
              id,
              name,
              brand
            ),
            product_variants (
              id,
              name,
              sku
            ),
            customers (
              id,
              name
            )
          `
        )
        .eq("company_id", currentCompanyId)
        .order("created_at", {
          ascending: false,
        });

      if (serializedError) {
        throw serializedError;
      }

      const normalizedUnits: SerializedUnit[] =
        (serializedData || []).map((item: any) => ({
          id: item.id,
          company_id: item.company_id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          serial_number: item.serial_number,
          barcode: item.barcode,
          status: item.status,
          warehouse_id: item.warehouse_id,
          customer_id: item.customer_id,
          order_id: item.order_id,
          invoice_id: item.invoice_id,
          cost_price: Number(item.cost_price || 0),
          warranty_start: item.warranty_start,
          warranty_end: item.warranty_end,
          received_at: item.received_at,
          sold_at: item.sold_at,
          notes: item.notes,
          created_at: item.created_at,
          updated_at: item.updated_at,
          product: Array.isArray(item.products)
            ? item.products[0] || null
            : item.products || null,
          variant: Array.isArray(item.product_variants)
            ? item.product_variants[0] || null
            : item.product_variants || null,
          customer: Array.isArray(item.customers)
            ? item.customers[0] || null
            : item.customers || null,
        }));

      setSerialUnits(normalizedUnits);

      // ------------------------------------------------------
      // 5. Load serial-tracked products for filter
      // ------------------------------------------------------
      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select("id, name, brand")
          .eq("company_id", currentCompanyId)
          .eq("tracking_mode", "serial")
          .order("name", {
            ascending: true,
          });

      if (productError) {
        throw productError;
      }

      setProducts(productData || []);
    } catch (error) {
      console.error(
        "Serial numbers load error:",
        error
      );

      setErrorMessage(
        "Unable to load serial numbers. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const total = serialUnits.length;

    const available = serialUnits.filter(
      (item) => item.status === "available"
    ).length;

    const reserved = serialUnits.filter(
      (item) => item.status === "reserved"
    ).length;

    const sold = serialUnits.filter(
      (item) => item.status === "sold"
    ).length;

    const repairRma = serialUnits.filter(
      (item) =>
        item.status === "repair" ||
        item.status === "rma"
    ).length;

    return {
      total,
      available,
      reserved,
      sold,
      repairRma,
    };
  }, [serialUnits]);

  const filteredUnits = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return serialUnits.filter((item) => {
      const matchesSearch =
        normalizedSearch === "" ||
        item.serial_number
          .toLowerCase()
          .includes(normalizedSearch) ||
        (item.barcode || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (item.product?.name || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (item.variant?.sku || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (item.customer?.name || "")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        item.status === statusFilter;

      const matchesProduct =
        productFilter === "all" ||
        item.product_id === productFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesProduct
      );
    });
  }, [
    serialUnits,
    search,
    statusFilter,
    productFilter,
  ]);

  return (
    <AppShell
      title="Serial Numbers"
      description="Track individual physical units, ownership, warranty, and lifecycle history."
      actions={
        <Link
          href="/serial-numbers/new"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-black px-4 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <span className="mr-2 text-base leading-none">
            +
          </span>
          Add Serial Number
        </Link>
      }
    >
      <div className="space-y-6">
        {/* -------------------------------------------------- */}
        {/* Stats */}
        {/* -------------------------------------------------- */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard
            label="Total Units"
            value={stats.total}
            description="All serialized units"
          />

          <StatCard
            label="Available"
            value={stats.available}
            description="Ready for sale or use"
          />

          <StatCard
            label="Reserved"
            value={stats.reserved}
            description="Reserved for an order"
          />

          <StatCard
            label="Sold"
            value={stats.sold}
            description="Currently sold"
          />

          <StatCard
            label="Repair / RMA"
            value={stats.repairRma}
            description="Units requiring attention"
          />
        </div>

        {/* -------------------------------------------------- */}
        {/* Error */}
        {/* -------------------------------------------------- */}
        {errorMessage && (
          <div
            className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
            style={{
              border: "1px solid #fecaca",
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* -------------------------------------------------- */}
        {/* Main card */}
        {/* -------------------------------------------------- */}
        <div
          className="overflow-hidden rounded-xl bg-white"
          style={{
            border: "1px solid #e2e8f0",
          }}
        >
          {/* Filters */}
          <div
            className="border-b border-slate-200 p-4"
            style={{
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <div className="flex flex-col gap-3 lg:flex-row">
              {/* Search */}
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  ⌕
                </span>

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search serial number, barcode, product, SKU or customer..."
                  className="h-11 w-full rounded-lg bg-white pl-9 pr-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-black focus:ring-2 focus:ring-slate-200"
                  style={{
                    border: "1px solid #cbd5e1",
                  }}
                />
              </div>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as
                      | "all"
                      | SerialStatus
                  )
                }
                className="h-11 rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-slate-200 lg:w-48"
                style={{
                  border: "1px solid #cbd5e1",
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>

              {/* Product */}
              <select
                value={productFilter}
                onChange={(e) =>
                  setProductFilter(e.target.value)
                }
                className="h-11 rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-slate-200 lg:w-64"
                style={{
                  border: "1px solid #cbd5e1",
                }}
              >
                <option value="all">
                  All Products
                </option>

                {products.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results header */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                Serialized Units
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                {loading
                  ? "Loading..."
                  : `${filteredUnits.length.toLocaleString()} unit${
                      filteredUnits.length === 1
                        ? ""
                        : "s"
                    }`}
              </p>
            </div>

            {(search ||
              statusFilter !== "all" ||
              productFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setProductFilter("all");
                }}
                className="text-sm font-medium text-slate-600 hover:text-black"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* ------------------------------------------------ */}
          {/* Loading */}
          {/* ------------------------------------------------ */}
          {loading ? (
            <div className="px-5 pb-6">
              <div
                className="rounded-lg bg-slate-50 p-10 text-center text-sm text-slate-500"
                style={{
                  border:
                    "1px solid #e2e8f0",
                }}
              >
                Loading serial numbers...
              </div>
            </div>
          ) : filteredUnits.length === 0 ? (
            /* ------------------------------------------------ */
            /* Empty state */
            /* ------------------------------------------------ */
            <div className="px-5 pb-6">
              <div
                className="rounded-lg bg-slate-50 p-12 text-center"
                style={{
                  border:
                    "1px solid #e2e8f0",
                }}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl text-slate-500">
                  #
                </div>

                <h3 className="mt-4 text-sm font-semibold text-slate-950">
                  {serialUnits.length === 0
                    ? "No serial numbers yet"
                    : "No matching serial numbers"}
                </h3>

                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  {serialUnits.length === 0
                    ? "Add your first serialized unit to start tracking individual products."
                    : "Try changing your search or filters."}
                </p>

                {serialUnits.length === 0 && (
                  <Link
                    href="/serial-numbers/new"
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-black px-4 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    + Add Serial Number
                  </Link>
                )}
              </div>
            </div>
          ) : (
            /* ------------------------------------------------ */
            /* Desktop table */
            /* ------------------------------------------------ */
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead>
                  <tr
                    className="bg-slate-50 text-left text-xs font-medium text-slate-500"
                    style={{
                      borderTop:
                        "1px solid #e2e8f0",
                      borderBottom:
                        "1px solid #e2e8f0",
                    }}
                  >
                    <th className="px-5 py-3">
                      Serial Number
                    </th>

                    <th className="px-5 py-3">
                      Product
                    </th>

                    <th className="px-5 py-3">
                      SKU
                    </th>

                    <th className="px-5 py-3">
                      Status
                    </th>

                    <th className="px-5 py-3">
                      Customer
                    </th>

                    <th className="px-5 py-3">
                      Cost
                    </th>

                    <th className="px-5 py-3">
                      Warranty
                    </th>

                    <th className="px-5 py-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUnits.map((unit) => (
                    <tr
                      key={unit.id}
                      className="transition hover:bg-slate-50"
                      style={{
                        borderBottom:
                          "1px solid #f1f5f9",
                      }}
                    >
                      {/* Serial */}
                      <td className="px-5 py-4">
                        <Link
                          href={`/serial-numbers/${unit.id}`}
                          className="font-medium text-slate-950 hover:underline"
                        >
                          {unit.serial_number}
                        </Link>

                        {unit.barcode && (
                          <div className="mt-1 text-xs text-slate-400">
                            Barcode: {unit.barcode}
                          </div>
                        )}
                      </td>

                      {/* Product */}
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {unit.product?.name ||
                            "Unknown Product"}
                        </div>

                        {unit.product?.brand && (
                          <div className="mt-1 text-xs text-slate-400">
                            {unit.product.brand}
                          </div>
                        )}

                        {unit.variant?.name &&
                          unit.variant.name !==
                            "Default" && (
                            <div className="mt-1 text-xs text-slate-400">
                              {unit.variant.name}
                            </div>
                          )}
                      </td>

                      {/* SKU */}
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {unit.variant?.sku || "—"}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClasses(
                            unit.status
                          )}`}
                        >
                          {statusLabel(unit.status)}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        {unit.customer ? (
                          <div className="text-sm font-medium text-slate-900">
                            {unit.customer.name}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">
                            —
                          </span>
                        )}
                      </td>

                      {/* Cost */}
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {currency}{" "}
                        {formatMoney(
                          unit.cost_price
                        )}
                      </td>

                      {/* Warranty */}
                      <td className="px-5 py-4">
                        {unit.warranty_end ? (
                          <div>
                            <div className="text-sm text-slate-700">
                              Until{" "}
                              {formatDate(
                                unit.warranty_end
                              )}
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              Started{" "}
                              {formatDate(
                                unit.warranty_start
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">
                            —
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/serial-numbers/${unit.id}`}
                          className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-black"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {!loading &&
            filteredUnits.length > 0 && (
              <div
                className="border-t px-5 py-3 text-xs text-slate-400"
                style={{
                  borderTop:
                    "1px solid #e2e8f0",
                }}
              >
                Showing{" "}
                {filteredUnits.length.toLocaleString()} of{" "}
                {serialUnits.length.toLocaleString()}{" "}
                serialized units
              </div>
            )}
        </div>
      </div>
    </AppShell>
  );
}