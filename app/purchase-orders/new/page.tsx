"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  legal_name: string;
  display_name: string;
  supplier_number: string;
  status: string;
  currency: string;
  payment_terms_days: number;
  default_lead_time_days: number;
  minimum_order_amount: number;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  is_default: boolean;
};

type SupplierProduct = {
  id: string;
  supplier_id: string;
  product_id: string;
  variant_id: string;
  supplier_sku: string | null;
  supplier_product_name: string | null;
  unit_cost: number;
  currency: string;
  minimum_order_quantity: number;
  lead_time_days: number;
  is_preferred: boolean;
  product: {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
  } | null;
  variant: {
    id: string;
    name: string;
    sku: string | null;
    cost_price: number;
    selling_price: number;
  } | null;
};

type OrderLine = {
  supplierProductId: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  supplierSku: string;
  quantity: number;
  unitCost: number;
  discount: number;
  tax: number;
};

function Icon({
  name,
  size = 18,
}: {
  name:
    | "arrow"
    | "calendar"
    | "check"
    | "chevron"
    | "box"
    | "plus"
    | "trash"
    | "truck"
    | "supplier"
    | "search"
    | "info";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );

    case "calendar":
      return (
        <svg {...common}>
          <rect
            x="3"
            y="4"
            width="18"
            height="17"
            rx="2"
          />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );

    case "box":
      return (
        <svg {...common}>
          <path d="m21 8-9 5-9-5 9-5 9 5Z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );

    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="m6 7 1 14h10l1-14" />
          <path d="M9 7V4h6v3" />
        </svg>
      );

    case "truck":
      return (
        <svg {...common}>
          <path d="M3 6h11v10H3z" />
          <path d="M14 9h4l3 3v4h-7z" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
      );

    case "supplier":
      return (
        <svg {...common}>
          <path d="M4 21V8l8-5 8 5v13" />
          <path d="M9 21v-6h6v6" />
          <path d="M8 9h1" />
          <path d="M15 9h1" />
          <path d="M8 12h1" />
          <path d="M15 12h1" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle
            cx="11"
            cy="11"
            r="7"
          />
          <path d="m20 20-4-4" />
        </svg>
      );

    case "info":
      return (
        <svg {...common}>
          <circle
            cx="12"
            cy="12"
            r="9"
          />
          <path d="M12 11v5" />
          <path d="M12 8h.01" />
        </svg>
      );

    default:
      return null;
  }
}

function money(
  value: number,
  currency = "USD"
) {
  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }
    ).format(value || 0);
  } catch {
    return `${currency} ${(
      value || 0
    ).toFixed(2)}`;
  }
}

function normalizeSupplierProducts(
  data: any[]
): SupplierProduct[] {
  return (data || []).map(
    (item: any) => ({
      id: item.id,
      supplier_id:
        item.supplier_id,
      product_id:
        item.product_id,
      variant_id:
        item.variant_id,
      supplier_sku:
        item.supplier_sku ??
        null,
      supplier_product_name:
        item.supplier_product_name ??
        null,
      unit_cost: Number(
        item.unit_cost ?? 0
      ),
      currency:
        item.currency || "USD",
      minimum_order_quantity:
        Number(
          item.minimum_order_quantity ??
            1
        ),
      lead_time_days:
        Number(
          item.lead_time_days ?? 0
        ),
      is_preferred:
        Boolean(
          item.is_preferred
        ),
      product:
        Array.isArray(
          item.product
        )
          ? item.product[0] ??
            null
          : item.product ?? null,
      variant:
        Array.isArray(
          item.variant
        )
          ? item.variant[0] ??
            null
          : item.variant ?? null,
    })
  );
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [companyId, setCompanyId] =
    useState("");

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [warehouses, setWarehouses] =
    useState<Warehouse[]>([]);

  const [
    supplierProducts,
    setSupplierProducts,
  ] = useState<SupplierProduct[]>([]);

  const [supplierId, setSupplierId] =
    useState("");

  const [warehouseId, setWarehouseId] =
    useState("");

  const [orderDate, setOrderDate] =
    useState(
      new Date()
        .toISOString()
        .slice(0, 10)
    );

  const [
    expectedDate,
    setExpectedDate,
  ] = useState("");

  const [
    supplierReference,
    setSupplierReference,
  ] = useState("");

  const [currency, setCurrency] =
    useState("USD");

  const [notes, setNotes] =
    useState("");

  const [terms, setTerms] =
    useState("");

  const [
    selectedProductId,
    setSelectedProductId,
  ] = useState("");

  const [
    selectedQuantity,
    setSelectedQuantity,
  ] = useState(1);

  const [lines, setLines] =
    useState<OrderLine[]>([]);

  const [errorMessage, setErrorMessage] =
    useState("");

  const selectedSupplier =
    suppliers.find(
      (supplier) =>
        supplier.id ===
        supplierId
    );

  const availableSupplierProducts =
    supplierProducts.filter(
      (item) =>
        item.supplier_id ===
          supplierId &&
        item.product &&
        item.variant
    );

  const selectedSupplierProduct =
    availableSupplierProducts.find(
      (item) =>
        item.id ===
        selectedProductId
    );

  useEffect(() => {
    void loadPage();
  }, []);

  async function loadPage() {
    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const {
        data: membership,
        error: membershipError,
      } =
        await supabase
          .from("company_members")
          .select(
            "company_id"
          )
          .eq(
            "user_id",
            user.id
          )
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (
        !membership?.company_id
      ) {
        throw new Error(
          "No company membership found."
        );
      }

      const cid =
        membership.company_id;

      setCompanyId(cid);

      const [
        suppliersResult,
        warehousesResult,
        supplierProductsResult,
      ] = await Promise.all([
        supabase
          .from("suppliers")
          .select(
            `
              id,
              legal_name,
              display_name,
              supplier_number,
              status,
              currency,
              payment_terms_days,
              default_lead_time_days,
              minimum_order_amount
            `
          )
          .eq(
            "company_id",
            cid
          )
          .eq(
            "status",
            "active"
          )
          .order(
            "display_name"
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
            `
          )
          .eq(
            "company_id",
            cid
          )
          .eq(
            "is_active",
            true
          )
          .order("name"),

        supabase
          .from("supplier_products")
          .select(
            `
              id,
              supplier_id,
              product_id,
              variant_id,
              supplier_sku,
              supplier_product_name,
              unit_cost,
              currency,
              minimum_order_quantity,
              lead_time_days,
              is_preferred,
              product:products(
                id,
                name,
                brand,
                category
              ),
              variant:product_variants(
                id,
                name,
                sku,
                cost_price,
                selling_price
              )
            `
          )
          .eq(
            "company_id",
            cid
          )
          .eq(
            "is_active",
            true
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            }
          ),
      ]);

      if (
        suppliersResult.error
      ) {
        throw suppliersResult.error;
      }

      if (
        warehousesResult.error
      ) {
        throw warehousesResult.error;
      }

      if (
        supplierProductsResult.error
      ) {
        throw supplierProductsResult.error;
      }

      setSuppliers(
        (suppliersResult.data ||
          []) as Supplier[]
      );

      setWarehouses(
        (warehousesResult.data ||
          []) as Warehouse[]
      );

      setSupplierProducts(
        normalizeSupplierProducts(
          supplierProductsResult.data ||
            []
        )
      );

      const defaultWarehouse =
        (
          warehousesResult.data ||
          []
        ).find(
          (warehouse: Warehouse) =>
            warehouse.is_default
        );

      if (defaultWarehouse) {
        setWarehouseId(
          defaultWarehouse.id
        );
      }
    } catch (error: any) {
      console.error(
        "New purchase order load error:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Failed to load purchase order form."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!supplierId) {
      setCurrency("USD");
      setSelectedProductId("");
      return;
    }

    const supplier =
      suppliers.find(
        (item) =>
          item.id ===
          supplierId
      );

    if (!supplier) {
      return;
    }

    setCurrency(
      supplier.currency ||
        "USD"
    );

    setSelectedProductId("");
  }, [
    supplierId,
    suppliers,
  ]);

  function addLine() {
    setErrorMessage("");

    if (!supplierId) {
      setErrorMessage(
        "Please select a supplier first."
      );
      return;
    }

    if (!selectedSupplierProduct) {
      setErrorMessage(
        "Please select a product and variant."
      );
      return;
    }

    if (
      !Number.isFinite(
        selectedQuantity
      ) ||
      selectedQuantity <= 0
    ) {
      setErrorMessage(
        "Quantity must be greater than zero."
      );
      return;
    }

    const minimumQuantity =
      Number(
        selectedSupplierProduct.minimum_order_quantity ||
          1
      );

    if (
      selectedQuantity <
      minimumQuantity
    ) {
      setErrorMessage(
        `Minimum order quantity is ${minimumQuantity}.`
      );
      return;
    }

    const product =
      selectedSupplierProduct.product;

    const variant =
      selectedSupplierProduct.variant;

    if (!product || !variant) {
      setErrorMessage(
        "The selected product or variant is unavailable."
      );
      return;
    }

    const existingIndex =
      lines.findIndex(
        (line) =>
          line.supplierProductId ===
          selectedSupplierProduct.id
      );

    if (existingIndex >= 0) {
      setLines(
        (current) =>
          current.map(
            (
              line,
              index
            ) =>
              index ===
              existingIndex
                ? {
                    ...line,
                    quantity:
                      line.quantity +
                      selectedQuantity,
                  }
                : line
          )
      );
    } else {
      setLines(
        (current) => [
          ...current,
          {
            supplierProductId:
              selectedSupplierProduct.id,
            productId:
              selectedSupplierProduct.product_id,
            variantId:
              selectedSupplierProduct.variant_id,
            productName:
              product.name,
            variantName:
              variant.name,
            sku:
              variant.sku ||
              "",
            supplierSku:
              selectedSupplierProduct.supplier_sku ||
              "",
            quantity:
              selectedQuantity,
            unitCost:
              Number(
                selectedSupplierProduct.unit_cost ||
                  0
              ),
            discount: 0,
            tax: 0,
          },
        ]
      );
    }

    setSelectedProductId("");
    setSelectedQuantity(1);
  }

  function updateLine(
    index: number,
    field:
      | "quantity"
      | "unitCost"
      | "discount"
      | "tax",
    value: number
  ) {
    setLines(
      (current) =>
        current.map(
          (
            line,
            lineIndex
          ) =>
            lineIndex ===
            index
              ? {
                  ...line,
                  [field]:
                    Number.isFinite(
                      value
                    )
                      ? Math.max(
                          0,
                          value
                        )
                      : 0,
                }
              : line
        )
    );
  }

  function removeLine(
    index: number
  ) {
    setLines(
      (current) =>
        current.filter(
          (_, i) =>
            i !== index
        )
    );
  }

  const subtotal =
    lines.reduce(
      (sum, line) =>
        sum +
        Math.max(
          0,
          line.quantity *
            line.unitCost
        ),
      0
    );

  const discountTotal =
    lines.reduce(
      (sum, line) =>
        sum +
        Math.max(
          0,
          line.discount
        ),
      0
    );

  const taxTotal =
    lines.reduce(
      (sum, line) =>
        sum +
        Math.max(
          0,
          line.tax
        ),
      0
    );

  const netSubtotal =
    Math.max(
      0,
      subtotal -
        discountTotal
    );

  const total =
    Math.max(
      0,
      netSubtotal +
        taxTotal
    );

  const totalQuantity =
    lines.reduce(
      (sum, line) =>
        sum +
        Number(
          line.quantity || 0
        ),
      0
    );

  const canSubmit =
    Boolean(
      companyId &&
        supplierId &&
        warehouseId &&
        lines.length
    );

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!companyId) {
      setErrorMessage(
        "Company information is missing."
      );
      return;
    }

    if (!supplierId) {
      setErrorMessage(
        "Please select a supplier."
      );
      return;
    }

    if (!warehouseId) {
      setErrorMessage(
        "Please select a receiving warehouse."
      );
      return;
    }

    if (!lines.length) {
      setErrorMessage(
        "Please add at least one product."
      );
      return;
    }

    if (
      expectedDate &&
      orderDate &&
      expectedDate <
        orderDate
    ) {
      setErrorMessage(
        "Expected date cannot be earlier than the order date."
      );
      return;
    }

    for (const line of lines) {
      if (
        !line.productId ||
        !line.variantId
      ) {
        setErrorMessage(
          "Every line must have a valid product and variant."
        );
        return;
      }

      if (
        line.quantity <= 0
      ) {
        setErrorMessage(
          "All quantities must be greater than zero."
        );
        return;
      }

      if (
        line.unitCost < 0 ||
        line.discount < 0 ||
        line.tax < 0
      ) {
        setErrorMessage(
          "Cost, discount and tax cannot be negative."
        );
        return;
      }
    }

    try {
      setSaving(true);

      const payload = lines.map(
        (line) => {
          const lineTotal =
            Math.max(
              0,
              line.quantity *
                line.unitCost -
                line.discount +
                line.tax
            );

          return {
            supplier_product_id:
              line.supplierProductId,
            product_id:
              line.productId,
            variant_id:
              line.variantId,
            product_name:
              line.productName,
            variant_name:
              line.variantName,
            sku:
              line.sku ||
              null,
            supplier_sku:
              line.supplierSku ||
              null,
            description:
              null,
            quantity:
              line.quantity,
            unit_cost:
              line.unitCost,
            discount_amount:
              line.discount,
            tax_amount:
              line.tax,
            line_total:
              lineTotal,
          };
        }
      );

      const {
        data: purchaseOrderId,
        error,
      } =
        await supabase.rpc(
          "create_purchase_order",
          {
            p_company_id:
              companyId,
            p_supplier_id:
              supplierId,
            p_currency:
              currency,
            p_order_date:
              orderDate,
            p_expected_date:
              expectedDate ||
              null,
            p_warehouse_id:
              warehouseId,
            p_supplier_reference:
              supplierReference.trim() ||
              null,
            p_subtotal:
              netSubtotal,
            p_discount_amount:
              discountTotal,
            p_tax_amount:
              taxTotal,
            p_shipping_amount:
              0,
            p_total_amount:
              total,
            p_notes:
              notes.trim() ||
              null,
            p_terms:
              terms.trim() ||
              null,
            p_items:
              payload,
          }
        );

      if (error) {
        throw error;
      }

      if (!purchaseOrderId) {
        throw new Error(
          "Purchase order was not created."
        );
      }

      router.push(
        `/purchase-orders/${purchaseOrderId}`
      );
    } catch (error: any) {
      console.error(
        "Purchase order creation error:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Failed to create purchase order."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="New Purchase Order"
        description="Create a supplier purchase order."
      >
        <div className="page-content">
          <div className="loading-card">
            <div className="spinner" />
            <p>
              Loading purchase order form...
            </p>
          </div>
        </div>

        <style jsx>{styles}</style>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="New Purchase Order"
      description="Create a supplier purchase order."
    >
      <form
        className="page-content"
        onSubmit={
          handleSubmit
        }
      >
        <div className="page-header">
          <div>
            <div className="eyebrow">
              <span />
              PROCUREMENT
            </div>

            <h1 className="page-title">
              New Purchase Order
            </h1>

            <p className="page-subtitle">
              Create a supplier order
              and define where incoming
              inventory will be received.
            </p>
          </div>

          <div className="header-actions">
            <Link
              href="/purchase-orders"
              className="secondary-button"
            >
              Cancel
            </Link>

            <button
              type="submit"
              className="primary-button"
              disabled={
                saving ||
                !canSubmit
              }
            >
              <Icon
                name="check"
                size={17}
              />

              {saving
                ? "Creating..."
                : "Create Purchase Order"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="error-alert">
            <Icon
              name="info"
              size={17}
            />

            <span>
              {errorMessage}
            </span>
          </div>
        )}

        <div className="main-grid">
          <div className="left-column">
            <section className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Purchase Order
                    Information
                  </h2>

                  <p>
                    Basic supplier and
                    order details.
                  </p>
                </div>

                <div className="header-icon">
                  <Icon
                    name="supplier"
                    size={19}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="field field-wide">
                  <label>
                    Supplier
                    <span>*</span>
                  </label>

                  <div className="select-wrap">
                    <Icon
                      name="supplier"
                      size={16}
                    />

                    <select
                      value={
                        supplierId
                      }
                      onChange={(
                        event
                      ) =>
                        setSupplierId(
                          event
                            .target
                            .value
                        )
                      }
                      required
                    >
                      <option value="">
                        Select supplier
                      </option>

                      {suppliers.map(
                        (
                          supplier
                        ) => (
                          <option
                            key={
                              supplier.id
                            }
                            value={
                              supplier.id
                            }
                          >
                            {supplier.display_name ||
                              supplier.legal_name}
                            {supplier.supplier_number
                              ? ` • ${supplier.supplier_number}`
                              : ""}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {selectedSupplier && (
                    <div className="supplier-meta">
                      <span>
                        Currency:{" "}
                        {
                          selectedSupplier.currency
                        }
                      </span>

                      <span>
                        Payment terms:{" "}
                        {
                          selectedSupplier.payment_terms_days
                        }{" "}
                        days
                      </span>

                      <span>
                        Lead time:{" "}
                        {
                          selectedSupplier.default_lead_time_days
                        }{" "}
                        days
                      </span>
                    </div>
                  )}
                </div>

                <div className="field">
                  <label>
                    Order Date
                    <span>*</span>
                  </label>

                  <div className="input-icon">
                    <Icon
                      name="calendar"
                      size={16}
                    />

                    <input
                      type="date"
                      value={
                        orderDate
                      }
                      onChange={(
                        event
                      ) =>
                        setOrderDate(
                          event
                            .target
                            .value
                        )
                      }
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label>
                    Expected Date
                  </label>

                  <div className="input-icon">
                    <Icon
                      name="calendar"
                      size={16}
                    />

                    <input
                      type="date"
                      value={
                        expectedDate
                      }
                      min={
                        orderDate
                      }
                      onChange={(
                        event
                      ) =>
                        setExpectedDate(
                          event
                            .target
                            .value
                        )
                      }
                    />
                  </div>
                </div>

                <div className="field">
                  <label>
                    Currency
                  </label>

                  <input
                    value={
                      currency
                    }
                    onChange={(
                      event
                    ) =>
                      setCurrency(
                        event
                          .target
                          .value
                          .toUpperCase()
                          .slice(
                            0,
                            3
                          )
                      )
                    }
                    maxLength={3}
                    placeholder="USD"
                  />
                </div>

                <div className="field">
                  <label>
                    Supplier Reference
                  </label>

                  <input
                    value={
                      supplierReference
                    }
                    onChange={(
                      event
                    ) =>
                      setSupplierReference(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Supplier quote / reference"
                  />
                </div>

                <div className="field field-wide">
                  <label>
                    Receiving Warehouse
                    <span>*</span>
                  </label>

                  <div className="select-wrap">
                    <Icon
                      name="box"
                      size={16}
                    />

                    <select
                      value={
                        warehouseId
                      }
                      onChange={(
                        event
                      ) =>
                        setWarehouseId(
                          event
                            .target
                            .value
                        )
                      }
                      required
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
                            }
                            {warehouse.code
                              ? ` (${warehouse.code})`
                              : ""}
                            {warehouse.is_default
                              ? " • Default"
                              : ""}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="field-help">
                    Inventory received against
                    this PO will be placed into
                    this warehouse. The exact
                    location is selected during
                    receiving.
                  </div>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Products & Items
                  </h2>

                  <p>
                    Add products using the
                    supplier's configured
                    product relationships.
                  </p>
                </div>

                <div className="item-count">
                  {lines.length}{" "}
                  {lines.length ===
                  1
                    ? "line"
                    : "lines"}
                </div>
              </div>

              <div className="add-product">
                <div className="field product-selector">
                  <label>
                    Product / Variant
                  </label>

                  <div className="select-wrap">
                    <Icon
                      name="search"
                      size={16}
                    />

                    <select
                      value={
                        selectedProductId
                      }
                      onChange={(
                        event
                      ) =>
                        setSelectedProductId(
                          event
                            .target
                            .value
                        )
                      }
                      disabled={
                        !supplierId
                      }
                    >
                      <option value="">
                        {!supplierId
                          ? "Select a supplier first"
                          : availableSupplierProducts.length
                          ? "Select product / variant"
                          : "No supplier products available"}
                      </option>

                      {availableSupplierProducts.map(
                        (
                          item
                        ) => (
                          <option
                            key={
                              item.id
                            }
                            value={
                              item.id
                            }
                          >
                            {item.product
                              ?.name ||
                              "Product"}
                            {" • "}
                            {item.variant
                              ?.name ||
                              "Variant"}
                            {item.variant
                              ?.sku
                              ? ` • ${item.variant.sku}`
                              : ""}
                            {item.is_preferred
                              ? " • Preferred"
                              : ""}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div className="field quantity-field">
                  <label>
                    Quantity
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={
                      selectedQuantity
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedQuantity(
                        Math.max(
                          1,
                          Number(
                            event
                              .target
                              .value
                          ) || 1
                        )
                      )
                    }
                  />
                </div>

                <button
                  type="button"
                  className="add-button"
                  onClick={
                    addLine
                  }
                  disabled={
                    !supplierId ||
                    !selectedSupplierProduct
                  }
                >
                  <Icon
                    name="plus"
                    size={17}
                  />
                  Add Item
                </button>
              </div>

              {selectedSupplierProduct && (
                <div className="selected-product-info">
                  <div>
                    <strong>
                      {
                        selectedSupplierProduct
                          .product
                          ?.name
                      }
                    </strong>

                    <span>
                      {
                        selectedSupplierProduct
                          .variant
                          ?.name
                      }
                    </span>
                  </div>

                  <div>
                    <span>
                      Unit Cost
                    </span>

                    <strong>
                      {money(
                        selectedSupplierProduct.unit_cost,
                        currency
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      MOQ
                    </span>

                    <strong>
                      {
                        selectedSupplierProduct.minimum_order_quantity
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Lead Time
                    </span>

                    <strong>
                      {
                        selectedSupplierProduct.lead_time_days
                      }{" "}
                      days
                    </strong>
                  </div>
                </div>
              )}

              {lines.length ===
              0 ? (
                <div className="items-empty">
                  <div className="empty-icon">
                    <Icon
                      name="box"
                      size={24}
                    />
                  </div>

                  <h3>
                    No products added
                  </h3>

                  <p>
                    Select a supplier,
                    choose a product
                    and add it to the
                    purchase order.
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
                          Qty
                        </th>
                        <th>
                          Unit Cost
                        </th>
                        <th>
                          Discount
                        </th>
                        <th>
                          Tax
                        </th>
                        <th>
                          Line Total
                        </th>
                        <th />
                      </tr>
                    </thead>

                    <tbody>
                      {lines.map(
                        (
                          line,
                          index
                        ) => {
                          const lineTotal =
                            Math.max(
                              0,
                              line.quantity *
                                line.unitCost -
                                line.discount +
                                line.tax
                            );

                          return (
                            <tr
                              key={`${line.supplierProductId}-${index}`}
                            >
                              <td>
                                <div className="product-cell">
                                  <strong>
                                    {
                                      line.productName
                                    }
                                  </strong>

                                  <span>
                                    {
                                      line.variantName
                                    }
                                  </span>
                                </div>
                              </td>

                              <td>
                                <span className="sku">
                                  {line.sku ||
                                    "—"}
                                </span>
                              </td>

                              <td>
                                <input
                                  className="table-input qty"
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={
                                    line.quantity
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateLine(
                                      index,
                                      "quantity",
                                      Number(
                                        event
                                          .target
                                          .value
                                      )
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  className="table-input"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    line.unitCost
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateLine(
                                      index,
                                      "unitCost",
                                      Number(
                                        event
                                          .target
                                          .value
                                      )
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  className="table-input"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    line.discount
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateLine(
                                      index,
                                      "discount",
                                      Number(
                                        event
                                          .target
                                          .value
                                      )
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  className="table-input"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    line.tax
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateLine(
                                      index,
                                      "tax",
                                      Number(
                                        event
                                          .target
                                          .value
                                      )
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <strong className="line-total">
                                  {money(
                                    lineTotal,
                                    currency
                                  )}
                                </strong>
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className="delete-button"
                                  onClick={() =>
                                    removeLine(
                                      index
                                    )
                                  }
                                  title="Remove item"
                                >
                                  <Icon
                                    name="trash"
                                    size={16}
                                  />
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="bottom-grid">
              <section className="card">
                <div className="card-header compact">
                  <div>
                    <h2>
                      Notes
                    </h2>

                    <p>
                      Internal notes for
                      this purchase order.
                    </p>
                  </div>
                </div>

                <textarea
                  value={notes}
                  onChange={(
                    event
                  ) =>
                    setNotes(
                      event.target.value
                    )
                  }
                  placeholder="Add internal notes..."
                  rows={6}
                />
              </section>

              <section className="card">
                <div className="card-header compact">
                  <div>
                    <h2>
                      Terms & Conditions
                    </h2>

                    <p>
                      Supplier terms or
                      purchasing conditions.
                    </p>
                  </div>
                </div>

                <textarea
                  value={terms}
                  onChange={(
                    event
                  ) =>
                    setTerms(
                      event.target.value
                    )
                  }
                  placeholder="Add purchase terms..."
                  rows={6}
                />
              </section>
            </div>
          </div>

          <aside className="right-column">
            <section className="summary-card">
              <div className="summary-header">
                <div>
                  <div className="summary-eyebrow">
                    PURCHASE ORDER
                  </div>

                  <h2>
                    Order Summary
                  </h2>
                </div>

                <div className="summary-icon">
                  <Icon
                    name="truck"
                    size={20}
                  />
                </div>
              </div>

              <div className="summary-stat">
                <span>
                  Supplier
                </span>

                <strong>
                  {selectedSupplier
                    ?.display_name ||
                    "Not selected"}
                </strong>
              </div>

              <div className="summary-stat">
                <span>
                  Warehouse
                </span>

                <strong>
                  {warehouses.find(
                    (warehouse) =>
                      warehouse.id ===
                      warehouseId
                  )?.name ||
                    "Not selected"}
                </strong>
              </div>

              <div className="summary-stat">
                <span>
                  Total Items
                </span>

                <strong>
                  {totalQuantity}
                </strong>
              </div>

              <div className="summary-divider" />

              <div className="amount-row">
                <span>
                  Gross Subtotal
                </span>

                <strong>
                  {money(
                    subtotal,
                    currency
                  )}
                </strong>
              </div>

              <div className="amount-row">
                <span>
                  Discount
                </span>

                <strong className="discount">
                  -
                  {money(
                    discountTotal,
                    currency
                  )}
                  )
                </strong>
              </div>

              <div className="amount-row">
                <span>
                  Tax
                </span>

                <strong>
                  {money(
                    taxTotal,
                    currency
                  )}
                </strong>
              </div>

              <div className="summary-total">
                <span>
                  Total
                </span>

                <strong>
                  {money(
                    total,
                    currency
                  )}
                </strong>
              </div>

              <div className="summary-note">
                <Icon
                  name="info"
                  size={15}
                />

                <span>
                  Inventory is not added
                  when the PO is created.
                  Stock is added when the
                  purchase order is received.
                </span>
              </div>
            </section>

            <section className="workflow-card">
              <div className="workflow-title">
                <h3>
                  Procurement Flow
                </h3>

                <span>
                  Draft
                </span>
              </div>

              <div className="workflow-step active">
                <div className="step-number">
                  1
                </div>

                <div>
                  <strong>
                    Create PO
                  </strong>

                  <span>
                    Define supplier and
                    products
                  </span>
                </div>
              </div>

              <div className="workflow-line" />

              <div className="workflow-step">
                <div className="step-number">
                  2
                </div>

                <div>
                  <strong>
                    Send / Confirm
                  </strong>

                  <span>
                    Submit the order to
                    supplier
                  </span>
                </div>
              </div>

              <div className="workflow-line" />

              <div className="workflow-step">
                <div className="step-number">
                  3
                </div>

                <div>
                  <strong>
                    Receive Stock
                  </strong>

                  <span>
                    Batch, location and
                    optional serials
                  </span>
                </div>
              </div>

              <div className="workflow-line" />

              <div className="workflow-step">
                <div className="step-number">
                  4
                </div>

                <div>
                  <strong>
                    Inventory
                  </strong>

                  <span>
                    Batch stock and
                    movement recorded
                  </span>
                </div>
              </div>
            </section>

            <div className="inventory-note">
              <div className="inventory-note-icon">
                <Icon
                  name="box"
                  size={18}
                />
              </div>

              <div>
                <strong>
                  Inventory V2
                </strong>

                <p>
                  Every received line will
                  create a Batch/Lot as the
                  parent inventory record.
                  Serial numbers are optional
                  child identities.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </form>

      <style jsx>{styles}</style>
    </AppShell>
  );
}

const styles = `
  .page-content {
    padding: 28px;
    max-width: 1700px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 24px;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #64748b;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .1em;
  }

  .eyebrow span {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #16a34a;
  }

  .page-title {
    margin: 6px 0 4px;
    color: #0f172a;
    font-size: 30px;
    line-height: 1.15;
    font-weight: 750;
    letter-spacing: -.025em;
  }

  .page-subtitle {
    margin: 0;
    color: #64748b;
    font-size: 14px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .primary-button,
  .secondary-button,
  .add-button {
    min-height: 40px;
    padding: 0 15px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
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

  .primary-button:disabled,
  .add-button:disabled {
    opacity: .55;
    cursor: not-allowed;
  }

  .secondary-button {
    border: 1px solid #d7dee7;
    background: white;
    color: #334155;
  }

  .secondary-button:hover {
    background: #f8fafc;
  }

  .error-alert {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 12px 14px;
    margin-bottom: 18px;
    border: 1px solid #fecaca;
    border-radius: 10px;
    background: #fef2f2;
    color: #991b1b;
    font-size: 13px;
  }

  .main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 350px;
    gap: 18px;
    align-items: start;
  }

  .left-column {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .right-column {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: sticky;
    top: 20px;
  }

  .card,
  .summary-card,
  .workflow-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, .03);
    overflow: hidden;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    padding: 19px 20px;
    border-bottom: 1px solid #e5e7eb;
  }

  .card-header.compact {
    padding-bottom: 15px;
  }

  .card-header h2 {
    margin: 0;
    color: #0f172a;
    font-size: 15px;
    font-weight: 750;
  }

  .card-header p {
    margin: 4px 0 0;
    color: #94a3b8;
    font-size: 12px;
  }

  .header-icon,
  .summary-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    color: #166534;
    background: #f0fdf4;
  }

  .item-count {
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
    padding: 20px;
  }

  .field {
    min-width: 0;
  }

  .field-wide {
    grid-column: span 2;
  }

  .field label {
    display: block;
    margin-bottom: 7px;
    color: #334155;
    font-size: 12px;
    font-weight: 700;
  }

  .field label span {
    margin-left: 3px;
    color: #dc2626;
  }

  .field input,
  .field select,
  .field textarea,
  textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #dbe1e7;
    border-radius: 9px;
    outline: none;
    background: #ffffff;
    color: #0f172a;
    font-family: inherit;
    font-size: 13px;
  }

  .field input,
  .field select {
    height: 41px;
    padding: 0 11px;
  }

  .field input:focus,
  .field select:focus,
  textarea:focus {
    border-color: #94a3b8;
    box-shadow: 0 0 0 3px rgba(22, 101, 52, .06);
  }

  .select-wrap,
  .input-icon {
    position: relative;
    display: flex;
    align-items: center;
  }

  .select-wrap svg,
  .input-icon svg {
    position: absolute;
    left: 11px;
    color: #94a3b8;
    pointer-events: none;
  }

  .select-wrap select,
  .input-icon input {
    padding-left: 35px;
  }

  .supplier-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    margin-top: 8px;
    color: #94a3b8;
    font-size: 11px;
  }

  .field-help {
    margin-top: 7px;
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.5;
  }

  .add-product {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 110px auto;
    align-items: end;
    gap: 10px;
    padding: 18px 20px;
    border-bottom: 1px solid #eef2f7;
  }

  .product-selector {
    min-width: 0;
  }

  .quantity-field {
    min-width: 0;
  }

  .quantity-field input {
    width: 100%;
    height: 41px;
    box-sizing: border-box;
    border: 1px solid #dbe1e7;
    border-radius: 9px;
    padding: 0 10px;
    outline: none;
    color: #0f172a;
    font-size: 13px;
  }

  .quantity-field input:focus {
    border-color: #94a3b8;
    box-shadow: 0 0 0 3px rgba(22, 101, 52, .06);
  }

  .add-button {
    height: 41px;
    border: 1px solid #166534;
    background: #166534;
    color: white;
    white-space: nowrap;
  }

  .selected-product-info {
    display: grid;
    grid-template-columns: minmax(0, 1fr) repeat(3, auto);
    gap: 24px;
    align-items: center;
    margin: 0 20px 16px;
    padding: 12px 14px;
    border: 1px solid #dcfce7;
    border-radius: 10px;
    background: #f7fdf9;
  }

  .selected-product-info div {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .selected-product-info span {
    color: #94a3b8;
    font-size: 10px;
  }

  .selected-product-info strong {
    color: #334155;
    font-size: 12px;
  }

  .items-empty {
    min-height: 280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 35px;
    text-align: center;
  }

  .empty-icon {
    width: 54px;
    height: 54px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    border-radius: 14px;
    background: #f0fdf4;
    color: #166534;
  }

  .items-empty h3 {
    margin: 0;
    color: #0f172a;
    font-size: 15px;
  }

  .items-empty p {
    max-width: 440px;
    margin: 7px 0 0;
    color: #94a3b8;
    font-size: 12px;
    line-height: 1.6;
  }

  .items-table-wrap {
    width: 100%;
    overflow-x: auto;
  }

  .items-table {
    width: 100%;
    min-width: 920px;
    border-collapse: collapse;
  }

  .items-table th {
    height: 42px;
    padding: 0 12px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
    color: #64748b;
    text-align: left;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .06em;
    white-space: nowrap;
  }

  .items-table td {
    padding: 12px;
    border-bottom: 1px solid #eef2f7;
    color: #475569;
    font-size: 12px;
    vertical-align: middle;
  }

  .items-table tbody tr:last-child td {
    border-bottom: 0;
  }

  .product-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 180px;
  }

  .product-cell strong {
    color: #0f172a;
    font-size: 12px;
  }

  .product-cell span {
    color: #94a3b8;
    font-size: 11px;
  }

  .sku {
    color: #64748b;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
  }

  .table-input {
    width: 95px;
    height: 34px;
    box-sizing: border-box;
    border: 1px solid #dbe1e7;
    border-radius: 7px;
    padding: 0 8px;
    outline: none;
    color: #0f172a;
    font-size: 12px;
  }

  .table-input.qty {
    width: 70px;
  }

  .table-input:focus {
    border-color: #94a3b8;
  }

  .line-total {
    color: #0f172a;
    white-space: nowrap;
  }

  .delete-button {
    width: 31px;
    height: 31px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
  }

  .delete-button:hover {
    border-color: #fecaca;
    background: #fef2f2;
    color: #b91c1c;
  }

  .bottom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }

  textarea {
    display: block;
    resize: vertical;
    min-height: 140px;
    padding: 12px;
    border: 0;
    border-radius: 0;
    line-height: 1.6;
  }

  .summary-card {
    padding: 20px;
  }

  .summary-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 20px;
  }

  .summary-eyebrow {
    color: #94a3b8;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .09em;
  }

  .summary-header h2 {
    margin: 5px 0 0;
    color: #0f172a;
    font-size: 18px;
  }

  .summary-stat {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    padding: 10px 0;
  }

  .summary-stat span {
    color: #64748b;
    font-size: 12px;
  }

  .summary-stat strong {
    max-width: 190px;
    color: #334155;
    text-align: right;
    font-size: 12px;
  }

  .summary-divider {
    height: 1px;
    margin: 8px 0;
    background: #e5e7eb;
  }

  .amount-row {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    padding: 8px 0;
    color: #64748b;
    font-size: 12px;
  }

  .amount-row strong {
    color: #334155;
  }

  .amount-row .discount {
    color: #b45309;
  }

  .summary-total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 15px;
    margin-top: 10px;
    padding-top: 15px;
    border-top: 1px solid #e5e7eb;
  }

  .summary-total span {
    color: #334155;
    font-size: 13px;
    font-weight: 750;
  }

  .summary-total strong {
    color: #0f172a;
    font-size: 21px;
    font-weight: 800;
  }

  .summary-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 18px;
    padding: 11px;
    border: 1px solid #e2e8f0;
    border-radius: 9px;
    background: #f8fafc;
    color: #64748b;
    font-size: 11px;
    line-height: 1.55;
  }

  .summary-note svg {
    flex: 0 0 auto;
    margin-top: 1px;
  }

  .workflow-card {
    padding: 18px;
  }

  .workflow-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 18px;
  }

  .workflow-title h3 {
    margin: 0;
    color: #0f172a;
    font-size: 14px;
  }

  .workflow-title span {
    padding: 5px 8px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #64748b;
    font-size: 10px;
    font-weight: 800;
  }

  .workflow-step {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .step-number {
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: #f1f5f9;
    color: #64748b;
    font-size: 11px;
    font-weight: 800;
  }

  .workflow-step.active .step-number {
    background: #dcfce7;
    color: #166534;
  }

  .workflow-step div:last-child {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .workflow-step strong {
    color: #334155;
    font-size: 12px;
  }

  .workflow-step span {
    color: #94a3b8;
    font-size: 10px;
    line-height: 1.4;
  }

  .workflow-line {
    width: 1px;
    height: 18px;
    margin: 3px 0 3px 14px;
    background: #e2e8f0;
  }

  .inventory-note {
    display: flex;
    gap: 11px;
    padding: 15px;
    border: 1px solid #dcfce7;
    border-radius: 12px;
    background: #f7fdf9;
  }

  .inventory-note-icon {
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: #dcfce7;
    color: #166534;
  }

  .inventory-note strong {
    color: #166534;
    font-size: 12px;
  }

  .inventory-note p {
    margin: 4px 0 0;
    color: #64748b;
    font-size: 11px;
    line-height: 1.55;
  }

  .loading-card {
    min-height: 450px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #ffffff;
    color: #64748b;
  }

  .loading-card p {
    margin: 14px 0 0;
    font-size: 13px;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid #e2e8f0;
    border-top-color: #166534;
    border-radius: 999px;
    animation: spin .8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1200px) {
    .main-grid {
      grid-template-columns: 1fr;
    }

    .right-column {
      position: static;
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }

    .inventory-note {
      grid-column: span 2;
    }
  }

  @media (max-width: 850px) {
    .page-content {
      padding: 18px;
    }

    .page-header {
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions a,
    .header-actions button {
      flex: 1;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .field-wide {
      grid-column: span 1;
    }

    .add-product {
      grid-template-columns: 1fr 100px;
    }

    .add-button {
      grid-column: span 2;
    }

    .bottom-grid {
      grid-template-columns: 1fr;
    }

    .right-column {
      grid-template-columns: 1fr;
    }

    .inventory-note {
      grid-column: span 1;
    }

    .selected-product-info {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 520px) {
    .header-actions {
      flex-direction: column;
    }

    .header-actions a,
    .header-actions button {
      width: 100%;
      box-sizing: border-box;
    }

    .add-product {
      grid-template-columns: 1fr;
    }

    .add-button {
      grid-column: span 1;
    }

    .selected-product-info {
      grid-template-columns: 1fr;
    }
  }
`;