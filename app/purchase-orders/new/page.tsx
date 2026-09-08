"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  legal_name: string;
  display_name: string;
  status: string;
  currency: string;
  payment_terms_days: number;
  default_lead_time_days: number;
  minimum_order_amount: number;
};

type Warehouse = {
  id: string;
  name: string;
  code: string | null;
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

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function normalizeSupplierProducts(data: any[]): SupplierProduct[] {
  return (data ?? []).map((item: any) => ({
    id: item.id,
    supplier_id: item.supplier_id,
    product_id: item.product_id,
    variant_id: item.variant_id,
    supplier_sku: item.supplier_sku ?? null,
    supplier_product_name: item.supplier_product_name ?? null,
    unit_cost: Number(item.unit_cost ?? 0),
    currency: item.currency ?? "USD",
    minimum_order_quantity: Number(item.minimum_order_quantity ?? 1),
    lead_time_days: Number(item.lead_time_days ?? 0),
    is_preferred: Boolean(item.is_preferred),

    product: Array.isArray(item.product)
      ? item.product[0] ?? null
      : item.product ?? null,

    variant: Array.isArray(item.variant)
      ? item.variant[0] ?? null
      : item.variant ?? null,
  }));
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<
    SupplierProduct[]
  >([]);

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");

  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [expectedDate, setExpectedDate] = useState("");
  const [supplierReference, setSupplierReference] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  const [currency, setCurrency] = useState("USD");

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  const [lines, setLines] = useState<OrderLine[]>([]);

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

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

      if (membershipError) throw membershipError;

      if (!membership?.company_id) {
        throw new Error("No company is associated with your account.");
      }

      const currentCompanyId = membership.company_id;

      setCompanyId(currentCompanyId);

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
              status,
              currency,
              payment_terms_days,
              default_lead_time_days,
              minimum_order_amount
            `
          )
          .eq("company_id", currentCompanyId)
          .eq("status", "active")
          .order("display_name"),

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
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
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
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);

      if (suppliersResult.error) throw suppliersResult.error;
      if (warehousesResult.error) throw warehousesResult.error;
      if (supplierProductsResult.error) {
        throw supplierProductsResult.error;
      }

      setSuppliers((suppliersResult.data ?? []) as Supplier[]);

      setWarehouses((warehousesResult.data ?? []) as Warehouse[]);

      const normalizedProducts = normalizeSupplierProducts(
        supplierProductsResult.data ?? []
      );

      setSupplierProducts(normalizedProducts);

      const defaultWarehouse = (warehousesResult.data ?? []).find(
        (warehouse: Warehouse) => warehouse.is_default
      );

      if (defaultWarehouse) {
        setWarehouseId(defaultWarehouse.id);
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage(
        error?.message || "Failed to load purchase order form."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === supplierId
  );

  const availableSupplierProducts = supplierProducts.filter(
    (item) => item.supplier_id === supplierId && item.product && item.variant
  );

  const selectedSupplierProduct = availableSupplierProducts.find(
    (item) => item.id === selectedProductId
  );

  useEffect(() => {
    if (!supplierId) {
      setCurrency("USD");
      setSelectedProductId("");
      return;
    }

    const supplier = suppliers.find((item) => item.id === supplierId);

    if (supplier) {
      setCurrency(supplier.currency || "USD");

      if (
        !selectedProductId ||
        !availableSupplierProducts.some(
          (item) => item.id === selectedProductId
        )
      ) {
        setSelectedProductId("");
      }
    }
  }, [supplierId, suppliers]);

  function addLine() {
    setErrorMessage("");

    if (!supplierId) {
      setErrorMessage("Please select a supplier first.");
      return;
    }

    if (!selectedProductId) {
      setErrorMessage("Please select a product.");
      return;
    }

    if (!selectedSupplierProduct) {
      setErrorMessage("The selected supplier product could not be found.");
      return;
    }

    if (selectedQuantity <= 0) {
      setErrorMessage("Quantity must be greater than zero.");
      return;
    }

    const product = selectedSupplierProduct.product;
    const variant = selectedSupplierProduct.variant;

    if (!product || !variant) {
      setErrorMessage("The selected product or variant is unavailable.");
      return;
    }

    const existingIndex = lines.findIndex(
      (line) => line.supplierProductId === selectedSupplierProduct.id
    );

    if (existingIndex >= 0) {
      const updated = [...lines];

      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity:
          updated[existingIndex].quantity + selectedQuantity,
      };

      setLines(updated);
    } else {
      const newLine: OrderLine = {
        supplierProductId: selectedSupplierProduct.id,
        productId: selectedSupplierProduct.product_id,
        variantId: selectedSupplierProduct.variant_id,
        productName: product.name,
        variantName: variant.name,
        sku: variant.sku || "",
        supplierSku: selectedSupplierProduct.supplier_sku || "",
        quantity: selectedQuantity,
        unitCost: selectedSupplierProduct.unit_cost,
        discount: 0,
        tax: 0,
      };

      setLines((current) => [...current, newLine]);
    }

    setSelectedProductId("");
    setSelectedQuantity(1);
  }

  function updateLine(
    index: number,
    field: keyof OrderLine,
    value: number
  ) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              [field]: value,
            }
          : line
      )
    );
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  const subtotal = lines.reduce((sum, line) => {
    const lineSubtotal =
      line.quantity * line.unitCost - line.discount;

    return sum + Math.max(0, lineSubtotal);
  }, 0);

  const discountTotal = lines.reduce(
    (sum, line) => sum + Math.max(0, line.discount),
    0
  );

  const taxTotal = lines.reduce(
    (sum, line) => sum + Math.max(0, line.tax),
    0
  );

  const total = Math.max(
    0,
    subtotal + taxTotal
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setErrorMessage("");

    if (!companyId) {
      setErrorMessage("Company information is missing.");
      return;
    }

    if (!supplierId) {
      setErrorMessage("Please select a supplier.");
      return;
    }

    if (lines.length === 0) {
      setErrorMessage("Please add at least one product.");
      return;
    }

    for (const line of lines) {
      if (!line.productId || !line.variantId) {
        setErrorMessage(
          "One of the selected products is missing a valid variant."
        );
        return;
      }

      if (line.quantity <= 0) {
        setErrorMessage(
          "All quantities must be greater than zero."
        );
        return;
      }

      if (line.unitCost < 0) {
        setErrorMessage(
          "Unit cost cannot be negative."
        );
        return;
      }

      if (line.discount < 0 || line.tax < 0) {
        setErrorMessage(
          "Discount and tax cannot be negative."
        );
        return;
      }
    }

    try {
      setSaving(true);

      const { data: purchaseOrder, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          company_id: companyId,
          supplier_id: supplierId,
          status: "draft",
          currency,
          order_date: orderDate,
          expected_date: expectedDate || null,
          warehouse_id: warehouseId || null,
          supplier_reference:
            supplierReference.trim() || null,
          subtotal,
          discount_amount: discountTotal,
          tax_amount: taxTotal,
          shipping_amount: 0,
          total_amount: total,
          notes: notes.trim() || null,
          terms: terms.trim() || null,
        })
        .select("id")
        .single();

      if (poError) throw poError;

      const purchaseOrderId = purchaseOrder.id;

      const itemRows = lines.map((line) => {
        const lineSubtotal =
          line.quantity * line.unitCost;

        const lineTotal = Math.max(
          0,
          lineSubtotal -
            line.discount +
            line.tax
        );

        return {
          company_id: companyId,
          purchase_order_id: purchaseOrderId,
          product_id: line.productId,
          variant_id: line.variantId,
          supplier_product_id: line.supplierProductId,
          product_name: line.productName,
          variant_name: line.variantName,
          sku: line.sku || null,
          supplier_sku: line.supplierSku || null,
          description: null,
          quantity: line.quantity,
          received_quantity: 0,
          unit_cost: line.unitCost,
          discount_amount: line.discount,
          tax_amount: line.tax,
          line_total: lineTotal,
        };
      });

      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(itemRows);

      if (itemsError) {
        await supabase
          .from("purchase_orders")
          .delete()
          .eq("id", purchaseOrderId)
          .eq("company_id", companyId);

        throw itemsError;
      }

      router.push(`/purchase-orders/${purchaseOrderId}`);
    } catch (error: any) {
      console.error(error);

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
        description="Create a purchase order for a supplier."
      >
        <div className="page-content">
          <div className="loading-card">
            Loading purchase order form...
          </div>
        </div>

        <style jsx>{`
          .page-content {
            padding: 28px;
          }

          .loading-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 40px;
            text-align: center;
            color: #64748b;
          }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="New Purchase Order"
      description="Create a purchase order for a supplier."
      actions={
        <Link
          href="/purchase-orders"
          className="secondary-button"
        >
          Back to Purchase Orders
        </Link>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="page-content"
      >
        {errorMessage && (
          <div className="error-banner">
            <strong>Unable to continue</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="layout">
          <main className="main-column">
            <section className="card">
              <div className="card-header">
                <div>
                  <h2>Order Information</h2>
                  <p>
                    Basic details for this purchase order.
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>
                    Supplier <span>*</span>
                  </label>

                  <select
                    value={supplierId}
                    onChange={(event) =>
                      setSupplierId(event.target.value)
                    }
                    required
                  >
                    <option value="">
                      Select supplier
                    </option>

                    {suppliers.map((supplier) => (
                      <option
                        key={supplier.id}
                        value={supplier.id}
                      >
                        {supplier.display_name}
                      </option>
                    ))}
                  </select>

                  {suppliers.length === 0 && (
                    <small>
                      No active suppliers found.{" "}
                      <Link href="/suppliers/new">
                        Create a supplier
                      </Link>
                    </small>
                  )}
                </div>

                <div className="field">
                  <label>Currency</label>

                  <input
                    value={currency}
                    onChange={(event) =>
                      setCurrency(
                        event.target.value
                          .toUpperCase()
                          .slice(0, 3)
                      )
                    }
                    maxLength={3}
                  />
                </div>

                <div className="field">
                  <label>
                    Order Date <span>*</span>
                  </label>

                  <input
                    type="date"
                    value={orderDate}
                    onChange={(event) =>
                      setOrderDate(event.target.value)
                    }
                    required
                  />
                </div>

                <div className="field">
                  <label>Expected Delivery</label>

                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(event) =>
                      setExpectedDate(event.target.value)
                    }
                    min={orderDate}
                  />
                </div>

                <div className="field">
                  <label>Warehouse</label>

                  <select
                    value={warehouseId}
                    onChange={(event) =>
                      setWarehouseId(event.target.value)
                    }
                  >
                    <option value="">
                      No warehouse selected
                    </option>

                    {warehouses.map((warehouse) => (
                      <option
                        key={warehouse.id}
                        value={warehouse.id}
                      >
                        {warehouse.name}
                        {warehouse.code
                          ? ` (${warehouse.code})`
                          : ""}
                      </option>
                    ))}
                  </select>

                  <small>
                    You can select the receiving warehouse later.
                  </small>
                </div>

                <div className="field">
                  <label>Supplier Reference</label>

                  <input
                    value={supplierReference}
                    onChange={(event) =>
                      setSupplierReference(
                        event.target.value
                      )
                    }
                    placeholder="Supplier quote / reference"
                  />
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h2>Add Products</h2>
                  <p>
                    Add products supplied by the selected vendor.
                  </p>
                </div>
              </div>

              {!supplierId ? (
                <div className="empty-state">
                  <div className="empty-icon">+</div>
                  <strong>Select a supplier first</strong>
                  <span>
                    Supplier products will appear here after
                    selecting a supplier.
                  </span>
                </div>
              ) : availableSupplierProducts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">!</div>
                  <strong>
                    No supplier products found
                  </strong>
                  <span>
                    This supplier does not have any active
                    products assigned yet.
                  </span>

                  <Link
                    href="/suppliers"
                    className="secondary-button small"
                  >
                    Manage Supplier Products
                  </Link>
                </div>
              ) : (
                <>
                  <div className="add-product-row">
                    <div className="field product-field">
                      <label>Product / Variant</label>

                      <select
                        value={selectedProductId}
                        onChange={(event) =>
                          setSelectedProductId(
                            event.target.value
                          )
                        }
                      >
                        <option value="">
                          Select product
                        </option>

                        {availableSupplierProducts.map(
                          (item) => {
                            const product =
                              item.product!;
                            const variant =
                              item.variant!;

                            return (
                              <option
                                key={item.id}
                                value={item.id}
                              >
                                {product.name} —{" "}
                                {variant.name}
                                {variant.sku
                                  ? ` (${variant.sku})`
                                  : ""}
                              </option>
                            );
                          }
                        )}
                      </select>
                    </div>

                    <div className="field quantity-field">
                      <label>Quantity</label>

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={selectedQuantity}
                        onChange={(event) =>
                          setSelectedQuantity(
                            Math.max(
                              1,
                              Number(
                                event.target.value
                              ) || 1
                            )
                          )
                        }
                      />
                    </div>

                    <div className="add-button-wrap">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={addLine}
                      >
                        Add Product
                      </button>
                    </div>
                  </div>

                  {selectedSupplierProduct && (
                    <div className="product-preview">
                      <div>
                        <strong>
                          {
                            selectedSupplierProduct
                              .product?.name
                          }
                        </strong>

                        <span>
                          {
                            selectedSupplierProduct
                              .variant?.name
                          }
                        </span>
                      </div>

                      <div>
                        <span>Supplier cost</span>
                        <strong>
                          {money(
                            selectedSupplierProduct.unit_cost,
                            currency
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>MOQ</span>
                        <strong>
                          {
                            selectedSupplierProduct.minimum_order_quantity
                          }
                        </strong>
                      </div>

                      <div>
                        <span>Lead time</span>
                        <strong>
                          {
                            selectedSupplierProduct.lead_time_days
                          }{" "}
                          days
                        </strong>
                      </div>
                    </div>
                  )}
                </>
              )}

              {lines.length > 0 && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Qty</th>
                        <th>Unit Cost</th>
                        <th>Discount</th>
                        <th>Tax</th>
                        <th>Total</th>
                        <th></th>
                      </tr>
                    </thead>

                    <tbody>
                      {lines.map((line, index) => {
                        const lineTotal = Math.max(
                          0,
                          line.quantity *
                            line.unitCost -
                            line.discount +
                            line.tax
                        );

                        return (
                          <tr key={`${line.supplierProductId}-${index}`}>
                            <td>
                              <div className="product-name">
                                {line.productName}
                              </div>

                              <div className="variant-name">
                                {line.variantName}
                              </div>
                            </td>

                            <td>
                              {line.sku || "—"}
                            </td>

                            <td>
                              <input
                                className="table-input quantity-input"
                                type="number"
                                min="1"
                                step="1"
                                value={line.quantity}
                                onChange={(event) =>
                                  updateLine(
                                    index,
                                    "quantity",
                                    Math.max(
                                      1,
                                      Number(
                                        event.target
                                          .value
                                      ) || 1
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
                                value={line.unitCost}
                                onChange={(event) =>
                                  updateLine(
                                    index,
                                    "unitCost",
                                    Math.max(
                                      0,
                                      Number(
                                        event.target
                                          .value
                                      ) || 0
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
                                value={line.discount}
                                onChange={(event) =>
                                  updateLine(
                                    index,
                                    "discount",
                                    Math.max(
                                      0,
                                      Number(
                                        event.target
                                          .value
                                      ) || 0
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
                                value={line.tax}
                                onChange={(event) =>
                                  updateLine(
                                    index,
                                    "tax",
                                    Math.max(
                                      0,
                                      Number(
                                        event.target
                                          .value
                                      ) || 0
                                    )
                                  )
                                }
                              />
                            </td>

                            <td className="line-total">
                              {money(
                                lineTotal,
                                currency
                              )}
                            </td>

                            <td>
                              <button
                                type="button"
                                className="remove-button"
                                onClick={() =>
                                  removeLine(index)
                                }
                                aria-label="Remove product"
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

            <section className="card">
              <div className="card-header">
                <div>
                  <h2>Notes & Terms</h2>
                  <p>
                    Add additional information for this order.
                  </p>
                </div>
              </div>

              <div className="notes-grid">
                <div className="field">
                  <label>Internal Notes</label>

                  <textarea
                    value={notes}
                    onChange={(event) =>
                      setNotes(event.target.value)
                    }
                    placeholder="Internal notes about this purchase..."
                    rows={5}
                  />
                </div>

                <div className="field">
                  <label>Terms & Conditions</label>

                  <textarea
                    value={terms}
                    onChange={(event) =>
                      setTerms(event.target.value)
                    }
                    placeholder="Payment terms, delivery terms, or other conditions..."
                    rows={5}
                  />
                </div>
              </div>
            </section>
          </main>

          <aside className="side-column">
            <section className="summary-card">
              <div className="summary-header">
                <h2>Order Summary</h2>
                <span className="draft-badge">
                  Draft
                </span>
              </div>

              <div className="summary-row">
                <span>Products</span>
                <strong>
                  {lines.length}
                </strong>
              </div>

              <div className="summary-row">
                <span>Quantity</span>
                <strong>
                  {lines.reduce(
                    (sum, line) =>
                      sum + line.quantity,
                    0
                  )}
                </strong>
              </div>

              <div className="summary-row">
                <span>Subtotal</span>
                <strong>
                  {money(subtotal, currency)}
                </strong>
              </div>

              <div className="summary-row">
                <span>Discount</span>
                <strong>
                  -{money(
                    discountTotal,
                    currency
                  )}
                </strong>
              </div>

              <div className="summary-row">
                <span>Tax</span>
                <strong>
                  {money(taxTotal, currency)}
                </strong>
              </div>

              <div className="summary-divider" />

              <div className="total-row">
                <span>Total</span>
                <strong>
                  {money(total, currency)}
                </strong>
              </div>

              {selectedSupplier && (
                <div className="supplier-summary">
                  <div className="summary-label">
                    Supplier
                  </div>

                  <strong>
                    {selectedSupplier.display_name}
                  </strong>

                  {selectedSupplier.payment_terms_days >
                    0 && (
                    <span>
                      Payment terms:{" "}
                      {
                        selectedSupplier.payment_terms_days
                      }{" "}
                      days
                    </span>
                  )}

                  {selectedSupplier.default_lead_time_days >
                    0 && (
                    <span>
                      Default lead time:{" "}
                      {
                        selectedSupplier.default_lead_time_days
                      }{" "}
                      days
                    </span>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="create-button"
                disabled={saving || lines.length === 0}
              >
                {saving
                  ? "Creating Purchase Order..."
                  : "Create Purchase Order"}
              </button>

              <Link
                href="/purchase-orders"
                className="cancel-link"
              >
                Cancel
              </Link>
            </section>
          </aside>
        </div>
      </form>

      <style jsx>{`
        .page-content {
          padding: 28px;
          background: #f8fafc;
          min-height: calc(100vh - 80px);
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 330px;
          gap: 24px;
          max-width: 1500px;
          margin: 0 auto;
        }

        .main-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }

        .side-column {
          min-width: 0;
        }

        .card,
        .summary-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .card {
          padding: 24px;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .card-header h2,
        .summary-header h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
        }

        .card-header p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field label {
          color: #334155;
          font-size: 13px;
          font-weight: 600;
        }

        .field label span {
          color: #dc2626;
        }

        .field small {
          color: #64748b;
          font-size: 12px;
        }

        .field small a {
          color: #2563eb;
          text-decoration: none;
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #0f172a;
          border-radius: 9px;
          font-size: 14px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        input,
        select {
          height: 40px;
          padding: 0 12px;
        }

        textarea {
          padding: 11px 12px;
          resize: vertical;
          min-height: 120px;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.16);
        }

        .error-banner {
          max-width: 1500px;
          margin: 0 auto 20px;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
          border-radius: 10px;
          padding: 13px 15px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          font-size: 13px;
        }

        .secondary-button,
        .primary-button,
        .create-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: 0.15s ease;
        }

        .secondary-button {
          height: 40px;
          padding: 0 15px;
          background: #ffffff;
          color: #334155;
          border: 1px solid #d1d5db;
        }

        .secondary-button:hover {
          background: #f8fafc;
        }

        .secondary-button.small {
          margin-top: 8px;
          height: 36px;
          padding: 0 13px;
        }

        .primary-button {
          height: 40px;
          padding: 0 16px;
          background: #0f172a;
          color: #ffffff;
          border: 1px solid #0f172a;
        }

        .primary-button:hover {
          background: #1e293b;
        }

        .add-product-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 130px auto;
          align-items: end;
          gap: 12px;
        }

        .product-field {
          min-width: 0;
        }

        .quantity-field {
          width: 130px;
        }

        .add-button-wrap {
          padding-bottom: 0;
        }

        .product-preview {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 150px 100px 110px;
          gap: 18px;
          align-items: center;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 13px 15px;
          margin-top: 15px;
        }

        .product-preview > div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .product-preview strong {
          color: #0f172a;
          font-size: 13px;
        }

        .product-preview span {
          color: #64748b;
          font-size: 12px;
        }

        .empty-state {
          min-height: 190px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 7px;
          text-align: center;
          border: 1px dashed #cbd5e1;
          border-radius: 11px;
          background: #f8fafc;
          color: #64748b;
          padding: 25px;
        }

        .empty-state strong {
          color: #334155;
          font-size: 14px;
        }

        .empty-state span {
          max-width: 430px;
          font-size: 13px;
        }

        .empty-icon {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #e2e8f0;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .table-wrap {
          margin-top: 22px;
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
        }

        table {
          width: 100%;
          min-width: 920px;
          border-collapse: collapse;
        }

        th {
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 12px;
          text-align: left;
          white-space: nowrap;
          border-bottom: 1px solid #e5e7eb;
        }

        td {
          padding: 13px 12px;
          color: #334155;
          font-size: 13px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        .product-name {
          font-weight: 600;
          color: #0f172a;
        }

        .variant-name {
          color: #64748b;
          margin-top: 3px;
          font-size: 12px;
        }

        .table-input {
          width: 100px;
          height: 36px;
          padding: 0 9px;
          font-size: 13px;
        }

        .quantity-input {
          width: 70px;
        }

        .line-total {
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
        }

        .remove-button {
          width: 32px;
          height: 32px;
          border: 0;
          background: transparent;
          color: #94a3b8;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          border-radius: 7px;
        }

        .remove-button:hover {
          background: #fef2f2;
          color: #dc2626;
        }

        .notes-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .summary-card {
          padding: 22px;
          position: sticky;
          top: 20px;
        }

        .summary-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 20px;
        }

        .draft-badge {
          display: inline-flex;
          align-items: center;
          height: 26px;
          padding: 0 9px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 700;
        }

        .summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 9px 0;
          color: #64748b;
          font-size: 13px;
        }

        .summary-row strong {
          color: #334155;
          font-weight: 600;
        }

        .summary-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 10px 0;
        }

        .total-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 7px 0 16px;
        }

        .total-row span {
          color: #0f172a;
          font-weight: 700;
        }

        .total-row strong {
          color: #0f172a;
          font-size: 21px;
          font-weight: 800;
        }

        .supplier-summary {
          border-top: 1px solid #e5e7eb;
          margin-top: 5px;
          padding-top: 17px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .supplier-summary strong {
          color: #0f172a;
          font-size: 14px;
        }

        .supplier-summary span {
          color: #64748b;
          font-size: 12px;
        }

        .summary-label {
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 10px;
          font-weight: 700;
          margin-bottom: 2px;
        }

        .create-button {
          width: 100%;
          height: 44px;
          border: 0;
          background: #0f172a;
          color: #ffffff;
          margin-top: 20px;
        }

        .create-button:hover:not(:disabled) {
          background: #1e293b;
        }

        .create-button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .cancel-link {
          display: flex;
          justify-content: center;
          margin-top: 12px;
          color: #64748b;
          font-size: 13px;
          text-decoration: none;
        }

        .cancel-link:hover {
          color: #334155;
        }

        @media (max-width: 1100px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .summary-card {
            position: static;
          }

          .summary-card {
            max-width: none;
          }

          .product-preview {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 18px;
          }

          .form-grid,
          .notes-grid {
            grid-template-columns: 1fr;
          }

          .add-product-row {
            grid-template-columns: 1fr 110px;
          }

          .add-button-wrap {
            grid-column: 1 / -1;
          }

          .primary-button {
            width: 100%;
          }
        }

        @media (max-width: 600px) {
          .page-content {
            padding: 14px;
          }

          .card,
          .summary-card {
            padding: 17px;
            border-radius: 11px;
          }

          .product-preview {
            grid-template-columns: 1fr;
          }

          .quantity-field {
            width: 100%;
          }

          .add-product-row {
            grid-template-columns: 1fr;
          }

          .secondary-button {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}