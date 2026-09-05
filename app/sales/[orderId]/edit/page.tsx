"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string | null;
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
};

type Variant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  selling_price: number;
  cost_price: number;
};

type SaleItem = {
  id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
};

type Order = {
  id: string;
  company_id: string;
  customer_id: string | null;
  order_number: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  currency: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  notes: string | null;
};

type PaymentStatus =
  | "unpaid"
  | "partially_paid"
  | "paid";

type FulfillmentStatus =
  | "unfulfilled"
  | "partially_fulfilled"
  | "fulfilled";

function formatCurrency(
  amount: number,
  currency = "USD"
) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

export default function EditSalePage() {
  const router = useRouter();
  const params = useParams();

  const orderId = String(params.orderId || "");

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [order, setOrder] =
    useState<Order | null>(null);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [variants, setVariants] =
    useState<Variant[]>([]);

  const [items, setItems] =
    useState<SaleItem[]>([]);

  const [customerId, setCustomerId] =
    useState("");

  const [productSearch, setProductSearch] =
    useState("");

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [selectedVariantId, setSelectedVariantId] =
    useState("");

  const [discountAmount, setDiscountAmount] =
    useState("0");

  const [taxAmount, setTaxAmount] =
    useState("0");

  const [shippingAmount, setShippingAmount] =
    useState("0");

  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatus>("unpaid");

  const [fulfillmentStatus, setFulfillmentStatus] =
    useState<FulfillmentStatus>("unfulfilled");

  const [notes, setNotes] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const currency =
    order?.currency || "USD";

  const loadData = useCallback(
    async () => {
      if (!orderId) {
        setError(
          "The sales order could not be identified."
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            "Your session could not be verified."
          );
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

        if (
          membershipError ||
          !membership?.company_id
        ) {
          throw new Error(
            "Your company workspace could not be found."
          );
        }

        const companyId =
          membership.company_id;

        const [
          orderResult,
          customersResult,
          productsResult,
          variantsResult,
        ] = await Promise.all([
          supabase
            .from("orders")
            .select(
              `
                id,
                company_id,
                customer_id,
                order_number,
                status,
                payment_status,
                fulfillment_status,
                currency,
                subtotal,
                discount_amount,
                tax_amount,
                shipping_amount,
                total_amount,
                notes
              `
            )
            .eq("id", orderId)
            .eq("company_id", companyId)
            .maybeSingle(),

          supabase
            .from("customers")
            .select("id, name")
            .eq("company_id", companyId)
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("products")
            .select(
              "id, name, brand, category"
            )
            .eq("company_id", companyId)
            .eq("status", "active")
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("product_variants")
            .select(
              `
                id,
                product_id,
                name,
                sku,
                selling_price,
                cost_price
              `
            )
            .eq("company_id", companyId)
            .eq("is_active", true)
            .order("name", {
              ascending: true,
            }),
        ]);

        if (orderResult.error) {
          throw new Error(
            orderResult.error.message ||
              "The sales order could not be loaded."
          );
        }

        if (!orderResult.data) {
          throw new Error(
            "Sales order not found or you do not have access to it."
          );
        }

        const loadedOrder =
          orderResult.data as Order;

        const {
          data: orderItemsData,
          error: orderItemsError,
        } = await supabase
          .from("order_items")
          .select(
            `
              id,
              company_id,
              order_id,
              product_id,
              variant_id,
              product_name,
              variant_name,
              sku,
              quantity,
              unit_price,
              unit_cost
            `
          )
          .eq("order_id", orderId)
          .eq("company_id", companyId)
          .order("created_at", {
            ascending: true,
          });

        if (orderItemsError) {
          throw new Error(
            orderItemsError.message ||
              "The sales order items could not be loaded."
          );
        }

        setOrder(loadedOrder);

        setCustomers(
          (customersResult.data ||
            []) as Customer[]
        );

        setProducts(
          (productsResult.data ||
            []) as Product[]
        );

        setVariants(
          (variantsResult.data ||
            []) as Variant[]
        );

        setCustomerId(
          loadedOrder.customer_id || ""
        );

        setDiscountAmount(
          String(
            Number(
              loadedOrder.discount_amount || 0
            )
          )
        );

        setTaxAmount(
          String(
            Number(
              loadedOrder.tax_amount || 0
            )
          )
        );

        setShippingAmount(
          String(
            Number(
              loadedOrder.shipping_amount || 0
            )
          )
        );

        setPaymentStatus(
          (
            loadedOrder.payment_status ||
            "unpaid"
          ) as PaymentStatus
        );

        setFulfillmentStatus(
          (
            loadedOrder.fulfillment_status ||
            "unfulfilled"
          ) as FulfillmentStatus
        );

        setNotes(
          loadedOrder.notes || ""
        );

        setItems(
          (orderItemsData || []).map(
            (item) => ({
              id: item.id,
              product_id:
                item.product_id || "",
              variant_id:
                item.variant_id || null,
              product_name:
                item.product_name,
              variant_name:
                item.variant_name || null,
              sku:
                item.sku || null,
              quantity: Math.max(
                1,
                Number(item.quantity) || 1
              ),
              unit_price: Math.max(
                0,
                Number(item.unit_price) || 0
              ),
              unit_cost: Math.max(
                0,
                Number(item.unit_cost) || 0
              ),
            })
          )
        );
      } catch (caughtError) {
        console.error(
          "Load edit sale error:",
          caughtError
        );

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The sales order could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    },
    [orderId, supabase]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedProduct =
    products.find(
      (product) =>
        product.id ===
        selectedProductId
    ) || null;

  const productVariants =
    variants.filter(
      (variant) =>
        variant.product_id ===
        selectedProductId
    );

  const selectedVariant =
    productVariants.find(
      (variant) =>
        variant.id ===
        selectedVariantId
    ) || null;

  const filteredProducts =
    useMemo(() => {
      const query =
        productSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return products.slice(0, 30);
      }

      return products
        .filter((product) => {
          return (
            product.name
              .toLowerCase()
              .includes(query) ||
            product.brand
              ?.toLowerCase()
              .includes(query) ||
            product.category
              ?.toLowerCase()
              .includes(query)
          );
        })
        .slice(0, 30);
    }, [products, productSearch]);

  const subtotal = useMemo(() => {
    return items.reduce(
      (sum, item) =>
        sum +
        item.quantity *
          item.unit_price,
      0
    );
  }, [items]);

  const discount = Math.max(
    0,
    Number(discountAmount) || 0
  );

  const tax = Math.max(
    0,
    Number(taxAmount) || 0
  );

  const shipping = Math.max(
    0,
    Number(shippingAmount) || 0
  );

  const total = Math.max(
    0,
    subtotal -
      discount +
      tax +
      shipping
  );

  function selectProduct(
    productId: string
  ) {
    setSelectedProductId(productId);
    setSelectedVariantId("");
  }

  function addItem() {
    if (!selectedProduct) {
      setError(
        "Please select a product first."
      );
      return;
    }

    if (productVariants.length > 0) {
      if (!selectedVariant) {
        setError(
          "Please select a product variant."
        );
        return;
      }
    }

    setError(null);

    const variantId =
      selectedVariant?.id || null;

    const existingItemIndex =
      items.findIndex(
        (item) =>
          item.product_id ===
            selectedProduct.id &&
          item.variant_id ===
            variantId
      );

    if (existingItemIndex >= 0) {
      setItems((current) =>
        current.map(
          (item, index) =>
            index ===
            existingItemIndex
              ? {
                  ...item,
                  quantity:
                    item.quantity + 1,
                }
              : item
        )
      );

      setSelectedProductId("");
      setSelectedVariantId("");
      setProductSearch("");

      return;
    }

    const newItem: SaleItem = {
      id: crypto.randomUUID(),
      product_id:
        selectedProduct.id,
      variant_id:
        variantId,
      product_name:
        selectedProduct.name,
      variant_name:
        selectedVariant?.name ||
        null,
      sku:
        selectedVariant?.sku ||
        null,
      quantity: 1,
      unit_price:
        Number(
          selectedVariant?.selling_price ||
            0
        ),
      unit_cost:
        Number(
          selectedVariant?.cost_price ||
            0
        ),
    };

    setItems((current) => [
      ...current,
      newItem,
    ]);

    setSelectedProductId("");
    setSelectedVariantId("");
    setProductSearch("");
  }

  function updateQuantity(
    itemId: string,
    quantity: number
  ) {
    const safeQuantity = Math.max(
      1,
      Number.isFinite(quantity)
        ? quantity
        : 1
    );

    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity:
                safeQuantity,
            }
          : item
      )
    );
  }

  function updatePrice(
    itemId: string,
    price: number
  ) {
    const safePrice = Math.max(
      0,
      Number.isFinite(price)
        ? price
        : 0
    );

    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              unit_price:
                safePrice,
            }
          : item
      )
    );
  }

  function removeItem(
    itemId: string
  ) {
    setItems((current) =>
      current.filter(
        (item) =>
          item.id !== itemId
      )
    );
  }

  async function saveChanges() {
    setError(null);
    setSuccessMessage(null);

    if (!order) {
      setError(
        "The sales order has not finished loading."
      );
      return;
    }

    if (items.length === 0) {
      setError(
        "A sales order must contain at least one product."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Your session could not be verified."
        );
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

      if (
        membershipError ||
        !membership?.company_id
      ) {
        throw new Error(
          "Your company workspace could not be found."
        );
      }

      const companyId =
        membership.company_id;

      if (
        order.company_id !==
        companyId
      ) {
        throw new Error(
          "You do not have access to this sales order."
        );
      }

      const safeDiscount = Math.max(
        0,
        Number(discountAmount) || 0
      );

      const safeTax = Math.max(
        0,
        Number(taxAmount) || 0
      );

      const safeShipping =
        Math.max(
          0,
          Number(shippingAmount) || 0
        );

      const calculatedSubtotal =
        items.reduce(
          (sum, item) =>
            sum +
            Math.max(
              0,
              Number(item.quantity) || 0
            ) *
              Math.max(
                0,
                Number(item.unit_price) ||
                  0
              ),
          0
        );

      const calculatedTotal =
        Math.max(
          0,
          calculatedSubtotal -
            safeDiscount +
            safeTax +
            safeShipping
        );

      /*
       * First update the order.
       * The order remains the same record,
       * so its order number and ID are preserved.
       */
      const {
        error: orderUpdateError,
      } = await supabase
        .from("orders")
        .update({
          customer_id:
            customerId || null,
          status:
            order.status || "confirmed",
          payment_status:
            paymentStatus,
          fulfillment_status:
            fulfillmentStatus,
          currency:
            order.currency || "USD",
          subtotal:
            calculatedSubtotal,
          discount_amount:
            safeDiscount,
          tax_amount:
            safeTax,
          shipping_amount:
            safeShipping,
          total_amount:
            calculatedTotal,
          notes:
            notes.trim() || null,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("company_id", companyId);

      if (orderUpdateError) {
        console.error(
          "Order update error:",
          orderUpdateError
        );

        throw new Error(
          orderUpdateError.message ||
            "The sales order could not be updated."
        );
      }

      /*
       * Replace the existing line items.
       *
       * Every delete and insert is scoped to
       * both the order and company.
       */
      const {
        error: deleteItemsError,
      } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", order.id)
        .eq("company_id", companyId);

      if (deleteItemsError) {
        console.error(
          "Existing order items deletion error:",
          deleteItemsError
        );

        throw new Error(
          deleteItemsError.message ||
            "The existing sales items could not be updated."
        );
      }

      const orderItems = items.map(
        (item) => {
          const quantity = Math.max(
            1,
            Number(item.quantity) || 1
          );

          const unitPrice = Math.max(
            0,
            Number(item.unit_price) || 0
          );

          const unitCost = Math.max(
            0,
            Number(item.unit_cost) || 0
          );

          return {
            company_id: companyId,
            order_id: order.id,
            product_id:
              item.product_id,
            variant_id:
              item.variant_id,
            product_name:
              item.product_name,
            variant_name:
              item.variant_name,
            sku:
              item.sku,
            quantity,
            unit_price:
              unitPrice,
            unit_cost:
              unitCost,
            discount_amount: 0,
            tax_amount: 0,
            line_total:
              quantity * unitPrice,
          };
        }
      );

      const {
        error: insertItemsError,
      } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (insertItemsError) {
        console.error(
          "Updated order items insertion error:",
          insertItemsError
        );

        throw new Error(
          insertItemsError.message ||
            "The updated sales items could not be saved."
        );
      }

      setSuccessMessage(
        "Sales order updated successfully."
      );

      /*
       * Give the success state a moment to render,
       * then return to the order document.
       */
      setTimeout(() => {
        router.push(
          `/sales/${order.id}`
        );
        router.refresh();
      }, 350);
    } catch (caughtError) {
      console.error(
        "Save sales order changes error:",
        caughtError
      );

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The sales order could not be updated."
      );

      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Edit Sale"
        description="Update the sales order."
      >
        <div className="edit-sale-state">
          <div className="edit-sale-spinner" />

          <strong>
            Loading sales order...
          </strong>

          <span>
            Getting the order, products,
            and customer information.
          </span>
        </div>

        <style jsx>{`
          .edit-sale-state {
            min-height: 420px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .edit-sale-state strong {
            color: #465163;
            font-size: 14px;
          }

          .edit-sale-state span {
            margin-top: 6px;
            color: #9aa2af;
            font-size: 11px;
          }

          .edit-sale-spinner {
            width: 30px;
            height: 30px;
            margin-bottom: 14px;
            border: 2px solid #e4e8ee;
            border-top-color: #697386;
            border-radius: 50%;
            animation: spin 0.75s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={
        order
          ? `Edit ${order.order_number}`
          : "Edit Sale"
      }
      description="Update the sales order and its line items."
      actions={
        <div className="edit-sale-header-actions">
          <button
            type="button"
            className="edit-sale-cancel"
            onClick={() =>
              router.push(
                order
                  ? `/sales/${order.id}`
                  : "/sales"
              )
            }
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="edit-sale-save"
            onClick={saveChanges}
            disabled={
              saving ||
              items.length === 0
            }
          >
            {saving
              ? "Saving..."
              : "Save Changes"}
          </button>
        </div>
      }
    >
      <div className="edit-sale-page">
        {error && (
          <div className="edit-sale-error">
            <span className="error-icon">
              !
            </span>

            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setError(null)
              }
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="edit-sale-success">
            {successMessage}
          </div>
        )}

        {order && (
          <div className="edit-sale-order-meta">
            <span>
              Order
            </span>

            <strong>
              {order.order_number}
            </strong>

            <span className="meta-separator">
              •
            </span>

            <span>
              Existing order — changes will
              update this record.
            </span>
          </div>
        )}

        <div className="edit-sale-layout">
          <main className="edit-sale-main">
            <section className="edit-sale-card">
              <div className="edit-sale-card-header">
                <div>
                  <h2>
                    Customer
                  </h2>

                  <p>
                    Choose the customer for
                    this sale.
                  </p>
                </div>
              </div>

              <div className="edit-sale-card-body">
                <label
                  className="edit-sale-label"
                  htmlFor="customer"
                >
                  Customer
                </label>

                <select
                  id="customer"
                  value={customerId}
                  onChange={(event) =>
                    setCustomerId(
                      event.target.value
                    )
                  }
                  disabled={saving}
                >
                  <option value="">
                    Walk-in Customer
                  </option>

                  {customers.map(
                    (customer) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.name ||
                          "Unnamed Customer"}
                      </option>
                    )
                  )}
                </select>
              </div>
            </section>

            <section className="edit-sale-card">
              <div className="edit-sale-card-header">
                <div>
                  <h2>
                    Products
                  </h2>

                  <p>
                    Add, remove, or modify
                    products in this sale.
                  </p>
                </div>
              </div>

              <div className="edit-sale-product-picker">
                <div className="edit-sale-field">
                  <label>
                    Search Product
                  </label>

                  <input
                    type="search"
                    value={productSearch}
                    onChange={(event) => {
                      setProductSearch(
                        event.target
                          .value
                      );

                      setSelectedProductId(
                        ""
                      );

                      setSelectedVariantId(
                        ""
                      );
                    }}
                    placeholder="Search products..."
                    disabled={saving}
                  />

                  {productSearch.trim() &&
                    !selectedProduct && (
                      <div className="product-results">
                        {filteredProducts.length ===
                        0 ? (
                          <div className="product-result-empty">
                            No products found.
                          </div>
                        ) : (
                          filteredProducts.map(
                            (product) => (
                              <button
                                key={
                                  product.id
                                }
                                type="button"
                                className="product-result"
                                onClick={() => {
                                  selectProduct(
                                    product.id
                                  );

                                  setProductSearch(
                                    product.name
                                  );
                                }}
                                disabled={
                                  saving
                                }
                              >
                                <span>
                                  <strong>
                                    {
                                      product.name
                                    }
                                  </strong>

                                  {product.brand && (
                                    <small>
                                      {
                                        product.brand
                                      }
                                    </small>
                                  )}
                                </span>

                                <span className="result-arrow">
                                  →
                                </span>
                              </button>
                            )
                          )
                        )}
                      </div>
                    )}
                </div>

                {selectedProduct && (
                  <div className="edit-sale-field">
                    <label>
                      Variant
                    </label>

                    {productVariants.length ===
                    0 ? (
                      <div className="no-variant">
                        This product has no active
                        variants.
                      </div>
                    ) : (
                      <select
                        value={
                          selectedVariantId
                        }
                        onChange={(event) =>
                          setSelectedVariantId(
                            event.target
                              .value
                          )
                        }
                        disabled={saving}
                      >
                        <option value="">
                          Select variant
                        </option>

                        {productVariants.map(
                          (variant) => (
                            <option
                              key={
                                variant.id
                              }
                              value={
                                variant.id
                              }
                            >
                              {variant.name}
                              {variant.sku
                                ? ` — ${variant.sku}`
                                : ""}{" "}
                              —{" "}
                              {formatCurrency(
                                Number(
                                  variant.selling_price
                                ),
                                currency
                              )}
                            </option>
                          )
                        )}
                      </select>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="add-product-button"
                  onClick={addItem}
                  disabled={
                    saving ||
                    !selectedProduct ||
                    (productVariants.length >
                      0 &&
                      !selectedVariant)
                  }
                >
                  <span>+</span>
                  Add Product
                </button>
              </div>

              <div className="edit-sale-items">
                {items.length === 0 ? (
                  <div className="empty-items">
                    <div className="empty-items-icon">
                      +
                    </div>

                    <strong>
                      No products added
                    </strong>

                    <span>
                      Add at least one product
                      before saving this order.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="items-table-header">
                      <span>
                        Product
                      </span>

                      <span>
                        Quantity
                      </span>

                      <span>
                        Price
                      </span>

                      <span>
                        Total
                      </span>

                      <span />
                    </div>

                    {items.map((item) => (
                      <div
                        className="sale-item"
                        key={item.id}
                      >
                        <div className="sale-item-product">
                          <div className="sale-item-icon">
                            {item.product_name
                              .slice(
                                0,
                                1
                              )
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {
                                item.product_name
                              }
                            </strong>

                            <span>
                              {item.variant_name ||
                                "Default"}

                              {item.sku
                                ? ` · ${item.sku}`
                                : ""}
                            </span>
                          </div>
                        </div>

                        <div className="sale-item-quantity">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.id,
                                item.quantity -
                                  1
                              )
                            }
                            disabled={
                              saving ||
                              item.quantity <=
                                1
                            }
                          >
                            −
                          </button>

                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={
                              item.quantity
                            }
                            onChange={(
                              event
                            ) =>
                              updateQuantity(
                                item.id,
                                Number(
                                  event
                                    .target
                                    .value
                                )
                              )
                            }
                            disabled={saving}
                          />

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.id,
                                item.quantity +
                                  1
                              )
                            }
                            disabled={saving}
                          >
                            +
                          </button>
                        </div>

                        <div className="sale-item-price">
                          <span>
                            {currency ===
                            "USD"
                              ? "$"
                              : currency}
                          </span>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              item.unit_price
                            }
                            onChange={(
                              event
                            ) =>
                              updatePrice(
                                item.id,
                                Number(
                                  event
                                    .target
                                    .value
                                )
                              )
                            }
                            disabled={saving}
                          />
                        </div>

                        <strong className="sale-item-total">
                          {formatCurrency(
                            item.quantity *
                              item.unit_price,
                            currency
                          )}
                        </strong>

                        <button
                          type="button"
                          className="remove-item"
                          onClick={() =>
                            removeItem(
                              item.id
                            )
                          }
                          aria-label={`Remove ${item.product_name}`}
                          disabled={saving}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </section>

            <section className="edit-sale-card">
              <div className="edit-sale-card-header">
                <div>
                  <h2>
                    Notes
                  </h2>

                  <p>
                    Add or update internal
                    notes related to this sale.
                  </p>
                </div>
              </div>

              <div className="edit-sale-card-body">
                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target.value
                    )
                  }
                  placeholder="Add notes about this sale..."
                  rows={4}
                  disabled={saving}
                />
              </div>
            </section>
          </main>

          <aside className="edit-sale-sidebar">
            <section className="edit-sale-card totals-card">
              <div className="edit-sale-card-header">
                <div>
                  <h2>
                    Sale Summary
                  </h2>
                </div>
              </div>

              <div className="totals-body">
                <div className="summary-row">
                  <span>
                    Subtotal
                  </span>

                  <strong>
                    {formatCurrency(
                      subtotal,
                      currency
                    )}
                  </strong>
                </div>

                <div className="summary-input-row">
                  <label>
                    Discount
                  </label>

                  <div className="summary-input">
                    <span>
                      {currency ===
                      "USD"
                        ? "$"
                        : currency}
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        discountAmount
                      }
                      onChange={(
                        event
                      ) =>
                        setDiscountAmount(
                          event.target
                            .value
                        )
                      }
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="summary-input-row">
                  <label>
                    Tax
                  </label>

                  <div className="summary-input">
                    <span>
                      {currency ===
                      "USD"
                        ? "$"
                        : currency}
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={taxAmount}
                      onChange={(
                        event
                      ) =>
                        setTaxAmount(
                          event.target
                            .value
                        )
                      }
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="summary-input-row">
                  <label>
                    Shipping
                  </label>

                  <div className="summary-input">
                    <span>
                      {currency ===
                      "USD"
                        ? "$"
                        : currency}
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        shippingAmount
                      }
                      onChange={(
                        event
                      ) =>
                        setShippingAmount(
                          event.target
                            .value
                        )
                      }
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="summary-divider" />

                <div className="summary-total">
                  <span>
                    Total
                  </span>

                  <strong>
                    {formatCurrency(
                      total,
                      currency
                    )}
                  </strong>
                </div>
              </div>
            </section>

            <section className="edit-sale-card">
              <div className="edit-sale-card-header">
                <div>
                  <h2>
                    Payment
                  </h2>

                  <p>
                    Update the payment state.
                  </p>
                </div>
              </div>

              <div className="settings-body">
                <label>
                  Payment Status
                </label>

                <select
                  value={
                    paymentStatus
                  }
                  onChange={(event) =>
                    setPaymentStatus(
                      event.target
                        .value as PaymentStatus
                    )
                  }
                  disabled={saving}
                >
                  <option value="unpaid">
                    Unpaid
                  </option>

                  <option value="partially_paid">
                    Partially Paid
                  </option>

                  <option value="paid">
                    Paid
                  </option>
                </select>
              </div>
            </section>

            <section className="edit-sale-card">
              <div className="edit-sale-card-header">
                <div>
                  <h2>
                    Fulfillment
                  </h2>

                  <p>
                    Update how the order is
                    being fulfilled.
                  </p>
                </div>
              </div>

              <div className="settings-body">
                <label>
                  Fulfillment Status
                </label>

                <select
                  value={
                    fulfillmentStatus
                  }
                  onChange={(event) =>
                    setFulfillmentStatus(
                      event.target
                        .value as FulfillmentStatus
                    )
                  }
                  disabled={saving}
                >
                  <option value="unfulfilled">
                    Unfulfilled
                  </option>

                  <option value="partially_fulfilled">
                    Partially Fulfilled
                  </option>

                  <option value="fulfilled">
                    Fulfilled
                  </option>
                </select>
              </div>
            </section>

            <button
              type="button"
              className="mobile-save-button"
              onClick={saveChanges}
              disabled={
                saving ||
                items.length === 0
              }
            >
              {saving
                ? "Saving Changes..."
                : "Save Changes"}
            </button>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .edit-sale-page {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
        }

        .edit-sale-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .edit-sale-cancel,
        .edit-sale-save {
          height: 41px;
          padding: 0 14px;
          border-radius: 8px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .edit-sale-cancel {
          border: 1px solid #dfe4eb;
          background: #ffffff;
          color: #667080;
        }

        .edit-sale-cancel:hover {
          background: #f7f8fa;
          color: #263043;
        }

        .edit-sale-save {
          border: 1px solid #172033;
          background: #172033;
          color: #ffffff;
        }

        .edit-sale-save:hover {
          background: #263043;
        }

        .edit-sale-save:disabled,
        .mobile-save-button:disabled,
        .add-product-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .edit-sale-error {
          min-height: 43px;
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 15px;
          padding: 0 12px;
          border: 1px solid #ead6d6;
          border-radius: 9px;
          background: #fff8f8;
          color: #8b5555;
          font-size: 10px;
          font-weight: 600;
        }

        .error-icon {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          flex: 0 0 22px;
          border-radius: 50%;
          background: #f4e2e2;
          font-size: 10px;
          font-weight: 800;
        }

        .edit-sale-error button {
          margin-left: auto;
          border: 0;
          background: transparent;
          color: #9a7474;
          cursor: pointer;
          font-size: 17px;
        }

        .edit-sale-success {
          margin-bottom: 15px;
          padding: 12px;
          border: 1px solid #d8e9dc;
          border-radius: 9px;
          background: #f5fbf6;
          color: #477052;
          font-size: 10px;
          font-weight: 600;
        }

        .edit-sale-order-meta {
          min-height: 40px;
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 15px;
          padding: 0 13px;
          border: 1px solid #e2e6ec;
          border-radius: 8px;
          background: #fafbfd;
          color: #8d96a4;
          font-size: 9px;
        }

        .edit-sale-order-meta strong {
          color: #465163;
          font-size: 10px;
          font-weight: 800;
        }

        .meta-separator {
          color: #c2c7cf;
        }

        .edit-sale-layout {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            340px;
          gap: 18px;
          align-items: start;
        }

        .edit-sale-main,
        .edit-sale-sidebar {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .edit-sale-card {
          overflow: visible;
          border: 1px solid #e2e6ec;
          border-radius: 13px;
          background: #ffffff;
        }

        .edit-sale-card-header {
          min-height: 68px;
          display: flex;
          align-items: center;
          padding: 13px 17px;
          border-bottom: 1px solid #edf0f4;
        }

        .edit-sale-card-header h2 {
          margin: 0;
          color: #30394a;
          font-size: 13px;
          font-weight: 780;
          letter-spacing: -0.01em;
        }

        .edit-sale-card-header p {
          margin: 4px 0 0;
          color: #9aa2af;
          font-size: 9px;
          line-height: 14px;
        }

        .edit-sale-card-body {
          padding: 16px 17px;
        }

        .edit-sale-label,
        .edit-sale-field label,
        .settings-body label {
          display: block;
          margin-bottom: 6px;
          color: #687386;
          font-size: 10px;
          font-weight: 700;
        }

        select,
        input,
        textarea {
          font-family: inherit;
        }

        .edit-sale-card select,
        .edit-sale-card textarea,
        .edit-sale-field > input,
        .summary-input input {
          width: 100%;
          border: 1px solid #dfe4eb;
          outline: none;
          border-radius: 8px;
          background: #ffffff;
          color: #354052;
          font-size: 11px;
        }

        .edit-sale-card select {
          height: 40px;
          padding: 0 10px;
        }

        .edit-sale-card textarea {
          min-height: 100px;
          padding: 10px;
          resize: vertical;
          line-height: 17px;
        }

        .edit-sale-card select:focus,
        .edit-sale-card textarea:focus,
        .edit-sale-field > input:focus,
        .summary-input:focus-within {
          border-color: #c9d0da;
        }

        .edit-sale-product-picker {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(190px, 0.75fr)
            auto;
          gap: 10px;
          align-items: end;
          padding: 16px 17px;
          border-bottom: 1px solid #edf0f4;
          background: #fafbfd;
        }

        .edit-sale-field {
          position: relative;
        }

        .edit-sale-field > input {
          height: 40px;
          padding: 0 11px;
        }

        .product-results {
          position: absolute;
          z-index: 20;
          top: calc(100% + 5px);
          left: 0;
          right: 0;
          max-height: 270px;
          overflow-y: auto;
          border: 1px solid #dfe4eb;
          border-radius: 9px;
          background: #ffffff;
          box-shadow:
            0 10px 30px
              rgba(24, 34, 51, 0.09);
        }

        .product-result {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 11px 12px;
          border: 0;
          border-bottom: 1px solid #f0f2f5;
          background: #ffffff;
          color: #364052;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
        }

        .product-result:last-child {
          border-bottom: 0;
        }

        .product-result:hover {
          background: #f8fafc;
        }

        .product-result strong,
        .product-result small {
          display: block;
        }

        .product-result strong {
          font-size: 10px;
          font-weight: 700;
        }

        .product-result small {
          margin-top: 3px;
          color: #9aa2af;
          font-size: 8px;
        }

        .result-arrow {
          color: #9ba4b1;
          font-size: 13px;
        }

        .product-result-empty {
          padding: 16px;
          color: #9aa2af;
          font-size: 10px;
          text-align: center;
        }

        .no-variant {
          min-height: 40px;
          display: flex;
          align-items: center;
          padding: 0 10px;
          border: 1px solid #e3e7ed;
          border-radius: 8px;
          background: #f8f9fb;
          color: #8992a0;
          font-size: 9px;
        }

        .add-product-button {
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 13px;
          border: 1px solid #172033;
          border-radius: 8px;
          background: #172033;
          color: #ffffff;
          cursor: pointer;
          font-family: inherit;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .add-product-button:hover:not(
            :disabled
          ) {
          background: #263043;
        }

        .add-product-button span {
          font-size: 15px;
          font-weight: 400;
        }

        .edit-sale-items {
          min-height: 180px;
        }

        .items-table-header {
          min-height: 39px;
          display: grid;
          grid-template-columns:
            minmax(230px, 1fr)
            125px
            120px
            100px
            35px;
          gap: 12px;
          align-items: center;
          padding: 0 17px;
          border-bottom: 1px solid #edf0f4;
          color: #9aa2af;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .sale-item {
          min-height: 73px;
          display: grid;
          grid-template-columns:
            minmax(230px, 1fr)
            125px
            120px
            100px
            35px;
          gap: 12px;
          align-items: center;
          padding: 8px 17px;
          border-bottom: 1px solid #f0f2f5;
        }

        .sale-item:last-child {
          border-bottom: 0;
        }

        .sale-item-product {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sale-item-icon {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          flex: 0 0 32px;
          border: 1px solid #e2e6ec;
          border-radius: 8px;
          background: #f8f9fb;
          color: #6e7888;
          font-size: 9px;
          font-weight: 800;
        }

        .sale-item-product strong,
        .sale-item-product span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sale-item-product strong {
          color: #465163;
          font-size: 10px;
          font-weight: 700;
        }

        .sale-item-product span {
          margin-top: 3px;
          color: #9aa2af;
          font-size: 8px;
        }

        .sale-item-quantity {
          height: 34px;
          display: flex;
          align-items: center;
          border: 1px solid #dfe4eb;
          border-radius: 7px;
          overflow: hidden;
        }

        .sale-item-quantity button {
          width: 29px;
          height: 100%;
          border: 0;
          background: #f8f9fb;
          color: #697386;
          cursor: pointer;
          font-size: 14px;
        }

        .sale-item-quantity button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .sale-item-quantity input {
          width: 50px;
          height: 100%;
          border: 0;
          outline: 0;
          text-align: center;
          color: #465163;
          font-size: 10px;
        }

        .sale-item-price {
          height: 34px;
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 0 8px;
          border: 1px solid #dfe4eb;
          border-radius: 7px;
          color: #8c95a3;
        }

        .sale-item-price input {
          width: 100%;
          height: 100%;
          border: 0;
          outline: 0;
          color: #465163;
          font-size: 10px;
        }

        .sale-item-total {
          color: #344052;
          font-size: 10px;
          font-weight: 750;
          white-space: nowrap;
        }

        .remove-item {
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border: 1px solid transparent;
          border-radius: 7px;
          background: transparent;
          color: #a0a8b4;
          cursor: pointer;
          font-size: 17px;
        }

        .remove-item:hover:not(
            :disabled
          ) {
          border-color: #ead6d6;
          background: #fff8f8;
          color: #915858;
        }

        .empty-items {
          min-height: 220px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .empty-items-icon {
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          margin-bottom: 11px;
          border: 1px solid #e2e6ec;
          border-radius: 50%;
          background: #fafbfd;
          color: #9099a7;
          font-size: 18px;
        }

        .empty-items strong {
          color: #5a6575;
          font-size: 12px;
          font-weight: 750;
        }

        .empty-items span {
          max-width: 280px;
          margin-top: 5px;
          color: #a0a8b4;
          font-size: 9px;
          line-height: 15px;
        }

        .totals-body {
          padding: 15px 17px 17px;
        }

        .summary-row,
        .summary-input-row,
        .summary-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .summary-row {
          min-height: 34px;
        }

        .summary-row span,
        .summary-input-row label {
          color: #7d8795;
          font-size: 10px;
        }

        .summary-row strong {
          color: #465163;
          font-size: 10px;
          font-weight: 700;
        }

        .summary-input-row {
          min-height: 43px;
        }

        .summary-input {
          width: 110px;
          height: 34px;
          display: flex;
          align-items: center;
          padding: 0 8px;
          border: 1px solid #dfe4eb;
          border-radius: 7px;
          color: #9aa2af;
        }

        .summary-input input {
          height: 100%;
          border: 0;
          outline: 0;
          padding: 0 0 0 3px;
          color: #465163;
          font-size: 10px;
        }

        .summary-divider {
          height: 1px;
          margin: 10px 0;
          background: #e5e8ed;
        }

        .summary-total {
          min-height: 50px;
        }

        .summary-total span {
          color: #30394a;
          font-size: 11px;
          font-weight: 800;
        }

        .summary-total strong {
          color: #172033;
          font-size: 19px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .settings-body {
          padding: 16px 17px;
        }

        .settings-body select {
          width: 100%;
          height: 40px;
          padding: 0 10px;
          border: 1px solid #dfe4eb;
          border-radius: 8px;
          background: #ffffff;
          color: #354052;
          outline: none;
          font-size: 11px;
        }

        .settings-body select:focus {
          border-color: #c9d0da;
        }

        .mobile-save-button {
          display: none;
          height: 43px;
          border: 1px solid #172033;
          border-radius: 8px;
          background: #172033;
          color: #ffffff;
          cursor: pointer;
          font-family: inherit;
          font-size: 10px;
          font-weight: 750;
        }

        @media (max-width: 950px) {
          .edit-sale-layout {
            grid-template-columns: 1fr;
          }

          .edit-sale-sidebar {
            display: grid;
            grid-template-columns: 1fr 1fr;
            align-items: start;
          }

          .totals-card {
            grid-column: 1 / -1;
          }

          .mobile-save-button {
            display: block;
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 700px) {
          .edit-sale-header-actions {
            gap: 5px;
          }

          .edit-sale-cancel,
          .edit-sale-save {
            height: 37px;
            padding: 0 9px;
            font-size: 9px;
          }

          .edit-sale-order-meta {
            align-items: flex-start;
            flex-wrap: wrap;
            padding: 9px 11px;
          }

          .edit-sale-layout {
            grid-template-columns: 1fr;
          }

          .edit-sale-sidebar {
            display: flex;
            flex-direction: column;
          }

          .edit-sale-product-picker {
            grid-template-columns: 1fr;
          }

          .add-product-button {
            width: 100%;
          }

          .items-table-header {
            display: none;
          }

          .edit-sale-items {
            overflow-x: auto;
          }

          .sale-item {
            min-width: 680px;
          }

          .edit-sale-card-body {
            padding: 14px;
          }

          .edit-sale-card-header {
            min-height: 62px;
            padding: 12px 14px;
          }

          .mobile-save-button {
            display: block;
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}