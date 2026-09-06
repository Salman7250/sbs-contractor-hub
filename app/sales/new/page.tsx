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
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function NewSalePage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

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

  const loadData = useCallback(
    async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError(
          "Your session could not be verified."
        );
        setLoading(false);
        return;
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
        setError(
          "Your company workspace could not be found."
        );
        setLoading(false);
        return;
      }

      const companyId =
        membership.company_id;

      const [
        customersResult,
        productsResult,
        variantsResult,
      ] = await Promise.all([
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
            "id, product_id, name, sku, selling_price, cost_price"
          )
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name", {
            ascending: true,
          }),
      ]);

      if (customersResult.error) {
        console.error(
          "Customers loading error:",
          customersResult.error
        );
      }

      if (productsResult.error) {
        console.error(
          "Products loading error:",
          productsResult.error
        );
      }

      if (variantsResult.error) {
        console.error(
          "Variants loading error:",
          variantsResult.error
        );
      }

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

      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    // This effect intentionally starts the asynchronous sales data synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const selectedProduct =
    products.find(
      (product) =>
        product.id === selectedProductId
    ) || null;

  const productVariants =
    variants.filter(
      (variant) =>
        variant.product_id ===
        selectedProductId
    );

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

  const selectedVariant =
    productVariants.find(
      (variant) =>
        variant.id === selectedVariantId
    ) || null;

  const subtotal = useMemo(() => {
    return items.reduce(
      (sum, item) =>
        sum +
        item.quantity *
          item.unit_price,
      0
    );
  }, [items]);

  const discount =
    Math.max(
      0,
      Number(discountAmount) || 0
    );

  const tax =
    Math.max(
      0,
      Number(taxAmount) || 0
    );

  const shipping =
    Math.max(
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

    const existingItemIndex =
      items.findIndex(
        (item) =>
          item.product_id ===
            selectedProduct.id &&
          item.variant_id ===
            (selectedVariant?.id ||
              null)
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

      return;
    }

    const newItem: SaleItem = {
      id: crypto.randomUUID(),
      product_id:
        selectedProduct.id,
      variant_id:
        selectedVariant?.id || null,
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
    const safeQuantity =
      Math.max(
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
    const safePrice =
      Math.max(
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

  async function saveSale() {
    setError(null);
    setSuccessMessage(null);

    if (items.length === 0) {
      setError(
        "Add at least one product to the sale."
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

      const orderNumber = `SO-${Date.now()}`;

      const { data: order, error: orderError } =
        await supabase
          .from("orders")
          .insert({
            company_id: companyId,
            customer_id:
              customerId || null,
            order_number:
              orderNumber,
            status: "confirmed",
            payment_status:
              paymentStatus,
            fulfillment_status:
              fulfillmentStatus,
            currency: "USD",
            subtotal,
            discount_amount:
              discount,
            tax_amount: tax,
            shipping_amount:
              shipping,
            total_amount: total,
            notes:
              notes.trim() ||
              null,
          })
          .select("id")
          .single();

      if (orderError || !order) {
        console.error(
          "Order creation error:",
          orderError
        );

        throw new Error(
          orderError?.message ||
            "The sale could not be created."
        );
      }

      const orderItems = items.map(
        (item) => {
          const lineSubtotal =
            item.quantity *
            item.unit_price;

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
            sku: item.sku,
            quantity:
              item.quantity,
            unit_price:
              item.unit_price,
            unit_cost:
              item.unit_cost,
            discount_amount: 0,
            tax_amount: 0,
            line_total:
              lineSubtotal,
          };
        }
      );

      const {
        error: itemsError,
      } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        console.error(
          "Order items creation error:",
          itemsError
        );

        // Attempt to clean up the order
        // because the line items failed.
        await supabase
          .from("orders")
          .delete()
          .eq("id", order.id)
          .eq(
            "company_id",
            companyId
          );

        throw new Error(
          itemsError.message ||
            "The sale items could not be created."
        );
      }

      router.push(
        `/sales/${order.id}`
      );
    } catch (caughtError) {
      console.error(
        "Save sale error:",
        caughtError
      );

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The sale could not be created."
      );

      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="New Sale"
        description="Create a new customer sale and order."
      >
        <div className="new-sale-state">
          <div className="new-sale-spinner" />
          <strong>
            Loading sales workspace...
          </strong>
          <span>
            Getting your customers and
            products.
          </span>
        </div>

        <style jsx>{`
          .new-sale-state {
            min-height: 420px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .new-sale-state strong {
            color: #465163;
            font-size: 14px;
          }

          .new-sale-state span {
            margin-top: 6px;
            color: #9aa2af;
            font-size: 11px;
          }

          .new-sale-spinner {
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
      title="New Sale"
      description="Create a new customer sale and order."
      actions={
        <div className="new-sale-header-actions">
          <button
            type="button"
            className="new-sale-cancel"
            onClick={() =>
              router.push("/sales")
            }
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="new-sale-save"
            onClick={saveSale}
            disabled={
              saving ||
              items.length === 0
            }
          >
            {saving
              ? "Creating..."
              : "Create Sale"}
          </button>
        </div>
      }
    >
      <div className="new-sale-page">
        {error && (
          <div className="new-sale-error">
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
          <div className="new-sale-success">
            {successMessage}
          </div>
        )}

        <div className="new-sale-layout">
          <main className="new-sale-main">
            <section className="new-sale-card">
              <div className="new-sale-card-header">
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

              <div className="new-sale-card-body">
                <label
                  className="new-sale-label"
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

            <section className="new-sale-card">
              <div className="new-sale-card-header">
                <div>
                  <h2>
                    Products
                  </h2>

                  <p>
                    Add products and variants
                    to this sale.
                  </p>
                </div>
              </div>

              <div className="new-sale-product-picker">
                <div className="new-sale-field">
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
                  <div className="new-sale-field">
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
                                )
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

              <div className="new-sale-items">
                {items.length === 0 ? (
                  <div className="empty-items">
                    <div className="empty-items-icon">
                      +
                    </div>

                    <strong>
                      No products added
                    </strong>

                    <span>
                      Search for a product above
                      to add it to the sale.
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
                          >
                            +
                          </button>
                        </div>

                        <div className="sale-item-price">
                          <span>
                            $
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
                          />
                        </div>

                        <strong className="sale-item-total">
                          {formatCurrency(
                            item.quantity *
                              item.unit_price
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
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </section>

            <section className="new-sale-card">
              <div className="new-sale-card-header">
                <div>
                  <h2>
                    Notes
                  </h2>

                  <p>
                    Add any internal notes
                    related to this sale.
                  </p>
                </div>
              </div>

              <div className="new-sale-card-body">
                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target.value
                    )
                  }
                  placeholder="Add notes about this sale..."
                  rows={4}
                />
              </div>
            </section>
          </main>

          <aside className="new-sale-sidebar">
            <section className="new-sale-card totals-card">
              <div className="new-sale-card-header">
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
                      subtotal
                    )}
                  </strong>
                </div>

                <div className="summary-input-row">
                  <label>
                    Discount
                  </label>

                  <div className="summary-input">
                    <span>
                      $
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
                    />
                  </div>
                </div>

                <div className="summary-input-row">
                  <label>
                    Tax
                  </label>

                  <div className="summary-input">
                    <span>
                      $
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        taxAmount
                      }
                      onChange={(
                        event
                      ) =>
                        setTaxAmount(
                          event.target
                            .value
                        )
                      }
                    />
                  </div>
                </div>

                <div className="summary-input-row">
                  <label>
                    Shipping
                  </label>

                  <div className="summary-input">
                    <span>
                      $
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
                      total
                    )}
                  </strong>
                </div>
              </div>
            </section>

            <section className="new-sale-card">
              <div className="new-sale-card-header">
                <div>
                  <h2>
                    Payment
                  </h2>

                  <p>
                    Record the payment state.
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

            <section className="new-sale-card">
              <div className="new-sale-card-header">
                <div>
                  <h2>
                    Fulfillment
                  </h2>

                  <p>
                    Track how the order will be
                    fulfilled.
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
              onClick={saveSale}
              disabled={
                saving ||
                items.length === 0
              }
            >
              {saving
                ? "Creating Sale..."
                : "Create Sale"}
            </button>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .new-sale-page {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
        }

        .new-sale-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .new-sale-cancel,
        .new-sale-save {
          height: 41px;
          padding: 0 14px;
          border-radius: 8px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .new-sale-cancel {
          border: 1px solid #dfe4eb;
          background: #ffffff;
          color: #667080;
        }

        .new-sale-cancel:hover {
          background: #f7f8fa;
          color: #263043;
        }

        .new-sale-save {
          border: 1px solid #172033;
          background: #172033;
          color: #ffffff;
        }

        .new-sale-save:hover {
          background: #263043;
        }

        .new-sale-save:disabled,
        .mobile-save-button:disabled,
        .add-product-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .new-sale-error {
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

        .new-sale-error button {
          margin-left: auto;
          border: 0;
          background: transparent;
          color: #9a7474;
          cursor: pointer;
          font-size: 17px;
        }

        .new-sale-success {
          margin-bottom: 15px;
          padding: 12px;
          border: 1px solid #d8e9dc;
          border-radius: 9px;
          background: #f5fbf6;
          color: #477052;
          font-size: 10px;
          font-weight: 600;
        }

        .new-sale-layout {
          display: grid;
          grid-template-columns: minmax(
              0,
              1fr
            )
            340px;
          gap: 18px;
          align-items: start;
        }

        .new-sale-main,
        .new-sale-sidebar {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .new-sale-card {
          overflow: visible;
          border: 1px solid #e2e6ec;
          border-radius: 13px;
          background: #ffffff;
        }

        .new-sale-card-header {
          min-height: 68px;
          display: flex;
          align-items: center;
          padding: 13px 17px;
          border-bottom: 1px solid #edf0f4;
        }

        .new-sale-card-header h2 {
          margin: 0;
          color: #30394a;
          font-size: 13px;
          font-weight: 780;
          letter-spacing: -0.01em;
        }

        .new-sale-card-header p {
          margin: 4px 0 0;
          color: #9aa2af;
          font-size: 9px;
          line-height: 14px;
        }

        .new-sale-card-body {
          padding: 16px 17px;
        }

        .new-sale-label,
        .new-sale-field label,
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

        .new-sale-card select,
        .new-sale-card textarea,
        .new-sale-field > input,
        .summary-input input {
          width: 100%;
          border: 1px solid #dfe4eb;
          outline: none;
          border-radius: 8px;
          background: #ffffff;
          color: #354052;
          font-size: 11px;
        }

        .new-sale-card select {
          height: 40px;
          padding: 0 10px;
        }

        .new-sale-card textarea {
          min-height: 100px;
          padding: 10px;
          resize: vertical;
          line-height: 17px;
        }

        .new-sale-card select:focus,
        .new-sale-card textarea:focus,
        .new-sale-field > input:focus,
        .summary-input:focus-within {
          border-color: #c9d0da;
        }

        .new-sale-product-picker {
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

        .new-sale-field {
          position: relative;
        }

        .new-sale-field > input {
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
          box-shadow: 0 10px 30px
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

        .new-sale-items {
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

        .remove-item:hover {
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
          padding: 0;
          border: 0;
          outline: 0;
          font-size: 10px;
          text-align: right;
        }

        .summary-divider {
          height: 1px;
          margin: 8px 0;
          background: #edf0f4;
        }

        .summary-total {
          padding-top: 4px;
        }

        .summary-total span {
          color: #596476;
          font-size: 11px;
          font-weight: 750;
        }

        .summary-total strong {
          color: #263043;
          font-size: 19px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .settings-body {
          padding: 15px 17px 17px;
        }

        .mobile-save-button {
          display: none;
        }

        @media (max-width: 1100px) {
          .new-sale-layout {
            grid-template-columns: 1fr;
          }

          .new-sale-sidebar {
            display: grid;
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
            align-items: start;
          }

          .totals-card {
            grid-column: span 1;
          }
        }

        @media (max-width: 850px) {
          .new-sale-product-picker {
            grid-template-columns: 1fr;
          }

          .add-product-button {
            width: 100%;
          }

          .new-sale-sidebar {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .new-sale-header-actions {
            gap: 5px;
          }

          .new-sale-cancel,
          .new-sale-save {
            height: 37px;
            padding: 0 10px;
            font-size: 10px;
          }

          .items-table-header {
            display: none;
          }

          .sale-item {
            grid-template-columns:
              minmax(0, 1fr)
              auto;
            gap: 10px;
            padding: 13px 14px;
          }

          .sale-item-product {
            grid-column: 1 / -1;
          }

          .sale-item-quantity {
            width: 105px;
          }

          .sale-item-price {
            width: 105px;
          }

          .sale-item-total {
            justify-self: end;
          }

          .remove-item {
            justify-self: end;
          }

          .mobile-save-button {
            min-height: 45px;
            display: block;
            width: 100%;
            border: 1px solid #172033;
            border-radius: 9px;
            background: #172033;
            color: #ffffff;
            cursor: pointer;
            font-family: inherit;
            font-size: 11px;
            font-weight: 750;
          }
        }
      `}</style>
    </AppShell>
  );
}