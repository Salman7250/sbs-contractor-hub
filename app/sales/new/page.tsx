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
  email: string | null;
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  cost_price: number;
  selling_price: number;
  is_default: boolean;
  is_active: boolean;
};

type Product = {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  product_type: string;
  status: string;
  tracking_mode: string;
  product_variants?: ProductVariant[];
};

type SaleLine = {
  id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  tracking_mode: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount_amount: number;
  tax_rate: number;
};

type RegionalSettings = {
  base_currency: string;
  currency_symbol: string;
  currency_symbol_position: string;
  decimal_places: number;
  thousands_separator: string;
  decimal_separator: string;
};

function formatMoney(
  value: number,
  currency: string,
  settings?: RegionalSettings | null,
) {
  const amount = Number(value || 0);

  try {
    if (
      settings &&
      currency === settings.base_currency
    ) {
      const decimalPlaces = Number(
        settings.decimal_places ?? 2,
      );

      const fixed = amount.toFixed(decimalPlaces);
      const [integerPart, decimalPart] =
        fixed.split(".");

      const formattedInteger = integerPart.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        settings.thousands_separator || ",",
      );

      const numberPart =
        decimalPlaces > 0
          ? `${formattedInteger}${
              settings.decimal_separator || "."
            }${decimalPart}`
          : formattedInteger;

      return settings.currency_symbol_position ===
        "after"
        ? `${numberPart} ${settings.currency_symbol}`
        : `${settings.currency_symbol}${numberPart}`;
    }

    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

function createLineId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function createOrderNumber() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(
    2,
    "0",
  );
  const day = String(now.getDate()).padStart(2, "0");
  const time = String(now.getTime()).slice(-6);

  return `SO-${year}${month}${day}-${time}`;
}

function getCustomerLabel(customer: Customer) {
  return (
    customer.name ||
    customer.email ||
    "Unnamed customer"
  );
}

export default function NewSalePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [companyId, setCompanyId] = useState<
    string | null
  >(null);

  const [customers, setCustomers] = useState<Customer[]>(
    [],
  );

  const [products, setProducts] = useState<Product[]>(
    [],
  );

  const [regionalSettings, setRegionalSettings] =
    useState<RegionalSettings | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");

  const [searchProduct, setSearchProduct] = useState("");
  const [selectedProductId, setSelectedProductId] =
    useState("");
  const [selectedVariantId, setSelectedVariantId] =
    useState("");

  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [discountAmount, setDiscountAmount] =
    useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [shippingAmount, setShippingAmount] =
    useState("0");

  const [lines, setLines] = useState<SaleLine[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "You must be signed in to create a sale.",
        );
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
        throw membershipError;
      }

      if (!membershipData?.company_id) {
        throw new Error(
          "No company membership was found.",
        );
      }

      const currentCompanyId =
        membershipData.company_id;

      setCompanyId(currentCompanyId);

      const [
        customersResult,
        productsResult,
        variantsResult,
        regionalResult,
      ] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name, email")
          .eq("company_id", currentCompanyId)
          .order("name", { ascending: true }),

        supabase
          .from("products")
          .select(
            `
              id,
              name,
              category,
              brand,
              product_type,
              status,
              tracking_mode
            `,
          )
          .eq("company_id", currentCompanyId)
          .eq("status", "active")
          .order("name", { ascending: true }),

        supabase
          .from("product_variants")
          .select(
            `
              id,
              product_id,
              name,
              sku,
              barcode,
              cost_price,
              selling_price,
              is_default,
              is_active
            `,
          )
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("name", { ascending: true }),

        supabase
          .from("company_regional_settings")
          .select(
            `
              base_currency,
              currency_symbol,
              currency_symbol_position,
              decimal_places,
              thousands_separator,
              decimal_separator
            `,
          )
          .eq("company_id", currentCompanyId)
          .maybeSingle(),
      ]);

      if (customersResult.error) {
        throw customersResult.error;
      }

      if (productsResult.error) {
        throw productsResult.error;
      }

      if (variantsResult.error) {
        throw variantsResult.error;
      }

      if (regionalResult.error) {
        throw regionalResult.error;
      }

      const variants =
        (variantsResult.data || []) as ProductVariant[];

      const productsWithVariants: Product[] = (
        productsResult.data || []
      ).map((product: any) => ({
        ...product,
        product_variants: variants.filter(
          (variant) =>
            variant.product_id === product.id,
        ),
      }));

      setCustomers(
        (customersResult.data || []) as Customer[],
      );

      setProducts(productsWithVariants);

      if (regionalResult.data) {
        const settings =
          regionalResult.data as RegionalSettings;

        setRegionalSettings(settings);

        setCurrency(
          settings.base_currency || "USD",
        );
      }
    } catch (error: any) {
      console.error(
        "New Sale load error:",
        error,
      );

      setErrorMessage(
        error?.message ||
          "Unable to load the New Sale page.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedProduct = useMemo(() => {
    return products.find(
      (product) =>
        product.id === selectedProductId,
    );
  }, [products, selectedProductId]);

  const selectedVariant = useMemo(() => {
    return selectedProduct?.product_variants?.find(
      (variant) =>
        variant.id === selectedVariantId,
    );
  }, [selectedProduct, selectedVariantId]);

  const filteredProducts = useMemo(() => {
    const search = searchProduct
      .trim()
      .toLowerCase();

    if (!search) {
      return products.slice(0, 50);
    }

    return products
      .filter((product) => {
        const productMatch =
          product.name
            .toLowerCase()
            .includes(search) ||
          product.brand
            ?.toLowerCase()
            .includes(search) ||
          product.category
            ?.toLowerCase()
            .includes(search);

        const variantMatch =
          product.product_variants?.some(
            (variant) =>
              variant.name
                .toLowerCase()
                .includes(search) ||
              variant.sku
                ?.toLowerCase()
                .includes(search) ||
              variant.barcode
                ?.toLowerCase()
                .includes(search),
          );

        return productMatch || variantMatch;
      })
      .slice(0, 50);
  }, [products, searchProduct]);

  const subtotal = useMemo(() => {
    return lines.reduce(
      (sum, line) =>
        sum +
        Number(line.quantity || 0) *
          Number(line.unit_price || 0),
      0,
    );
  }, [lines]);

  const totalDiscount = useMemo(() => {
    return lines.reduce(
      (sum, line) =>
        sum + Number(line.discount_amount || 0),
      0,
    );
  }, [lines]);

  const taxAmount = useMemo(() => {
    return lines.reduce((sum, line) => {
      const lineSubtotal =
        Number(line.quantity || 0) *
        Number(line.unit_price || 0);

      const taxable = Math.max(
        0,
        lineSubtotal -
          Number(line.discount_amount || 0),
      );

      return (
        sum +
        taxable *
          (Number(line.tax_rate || 0) / 100)
      );
    }, 0);
  }, [lines]);

  const shipping = Number(shippingAmount || 0);

  const total = Math.max(
    0,
    subtotal -
      totalDiscount +
      taxAmount +
      shipping,
  );

  const totalCost = useMemo(() => {
    return lines.reduce(
      (sum, line) =>
        sum +
        Number(line.quantity || 0) *
          Number(line.unit_cost || 0),
      0,
    );
  }, [lines]);

  const estimatedGrossProfit =
    total - totalCost;

  const selectProduct = (productId: string) => {
    setSelectedProductId(productId);

    const product = products.find(
      (item) => item.id === productId,
    );

    const defaultVariant =
      product?.product_variants?.find(
        (variant) => variant.is_default,
      ) ||
      product?.product_variants?.[0];

    if (defaultVariant) {
      setSelectedVariantId(defaultVariant.id);

      setUnitPrice(
        String(
          defaultVariant.selling_price || 0,
        ),
      );
    } else {
      setSelectedVariantId("");
      setUnitPrice("0");
    }
  };

  const selectVariant = (variantId: string) => {
    setSelectedVariantId(variantId);

    const variant =
      selectedProduct?.product_variants?.find(
        (item) => item.id === variantId,
      );

    if (variant) {
      setUnitPrice(
        String(
          variant.selling_price || 0,
        ),
      );
    }
  };

  const addLine = () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!selectedProduct) {
      setErrorMessage(
        "Please select a product.",
      );
      return;
    }

    if (!selectedVariant) {
      setErrorMessage(
        "Please select a product variant.",
      );
      return;
    }

    const parsedQuantity = Number(quantity);
    const parsedPrice = Number(unitPrice);
    const parsedDiscount =
      Number(discountAmount);
    const parsedTaxRate = Number(taxRate);

    if (
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity <= 0
    ) {
      setErrorMessage(
        "Quantity must be greater than zero.",
      );
      return;
    }

    if (
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0
    ) {
      setErrorMessage(
        "Unit price cannot be negative.",
      );
      return;
    }

    if (
      !Number.isFinite(parsedDiscount) ||
      parsedDiscount < 0
    ) {
      setErrorMessage(
        "Discount cannot be negative.",
      );
      return;
    }

    if (
      !Number.isFinite(parsedTaxRate) ||
      parsedTaxRate < 0 ||
      parsedTaxRate > 100
    ) {
      setErrorMessage(
        "Tax rate must be between 0 and 100.",
      );
      return;
    }

    const existingLineIndex = lines.findIndex(
      (line) =>
        line.product_id ===
          selectedProduct.id &&
        line.variant_id ===
          selectedVariant.id,
    );

    if (existingLineIndex >= 0) {
      const nextLines = [...lines];
      const existing =
        nextLines[existingLineIndex];

      nextLines[existingLineIndex] = {
        ...existing,
        quantity:
          Number(existing.quantity || 0) +
          parsedQuantity,
        unit_price: parsedPrice,
        discount_amount:
          Number(
            existing.discount_amount || 0,
          ) + parsedDiscount,
        tax_rate: parsedTaxRate,
      };

      setLines(nextLines);
    } else {
      setLines([
        ...lines,
        {
          id: createLineId(),
          product_id: selectedProduct.id,
          variant_id: selectedVariant.id,
          product_name:
            selectedProduct.name,
          variant_name:
            selectedVariant.name,
          sku: selectedVariant.sku || "",
          tracking_mode:
            selectedProduct.tracking_mode ||
            "none",
          quantity: parsedQuantity,
          unit_price: parsedPrice,
          unit_cost:
            Number(
              selectedVariant.cost_price,
            ) || 0,
          discount_amount:
            parsedDiscount,
          tax_rate: parsedTaxRate,
        },
      ]);
    }

    setQuantity("1");
    setDiscountAmount("0");
    setTaxRate("0");
    setSearchProduct("");
    setSelectedProductId("");
    setSelectedVariantId("");
    setUnitPrice("0");
  };

  const removeLine = (lineId: string) => {
    setLines((current) =>
      current.filter(
        (line) => line.id !== lineId,
      ),
    );
  };

  const updateLine = (
    lineId: string,
    field:
      | "quantity"
      | "unit_price"
      | "discount_amount"
      | "tax_rate",
    value: string,
  ) => {
    const numericValue = Number(value);

    setLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              [field]: Number.isFinite(
                numericValue,
              )
                ? Math.max(0, numericValue)
                : 0,
            }
          : line,
      ),
    );
  };

  const saveSale = async () => {
    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!companyId) {
        throw new Error(
          "Company context is missing.",
        );
      }

      if (lines.length === 0) {
        throw new Error(
          "Add at least one product to the sale.",
        );
      }

      if (!currency) {
        throw new Error(
          "A transaction currency is required.",
        );
      }

      if (
        !/^[A-Z]{3}$/.test(
          currency.toUpperCase(),
        )
      ) {
        throw new Error(
          "Currency must be a valid 3-letter currency code.",
        );
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "You must be signed in to create a sale.",
        );
      }

      const orderNumber =
        createOrderNumber();

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("orders")
        .insert({
          company_id: companyId,
          customer_id:
            customerId || null,
          order_number: orderNumber,
          status,
          payment_status: "unpaid",
          fulfillment_status:
            "unfulfilled",
          currency:
            currency.toUpperCase(),
          subtotal,
          discount_amount:
            totalDiscount,
          tax_amount: taxAmount,
          shipping_amount: shipping,
          total_amount: total,
          notes:
            notes.trim() || null,
        })
        .select("id")
        .single();

      if (orderError) {
        throw orderError;
      }

      if (!order?.id) {
        throw new Error(
          "The sales order was created but no order ID was returned.",
        );
      }

      const orderItems = lines.map(
        (line) => {
          const lineSubtotal =
            Number(line.quantity || 0) *
            Number(
              line.unit_price || 0,
            );

          const taxable = Math.max(
            0,
            lineSubtotal -
              Number(
                line.discount_amount || 0,
              ),
          );

          const lineTax =
            taxable *
            (Number(
              line.tax_rate || 0,
            ) / 100);

          const lineTotal =
            taxable + lineTax;

          return {
            company_id: companyId,
            order_id: order.id,
            product_id:
              line.product_id,
            variant_id:
              line.variant_id,
            product_name:
              line.product_name,
            variant_name:
              line.variant_name,
            sku:
              line.sku || null,
            quantity:
              Number(
                line.quantity || 0,
              ),
            unit_price:
              Number(
                line.unit_price || 0,
              ),
            unit_cost:
              Number(
                line.unit_cost || 0,
              ),
            discount_amount:
              Number(
                line.discount_amount || 0,
              ),
            tax_amount: lineTax,
            line_total: lineTotal,
          };
        },
      );

      const { error: itemsError } =
        await supabase
          .from("order_items")
          .insert(orderItems);

      if (itemsError) {
        await supabase
          .from("orders")
          .delete()
          .eq("id", order.id)
          .eq(
            "company_id",
            companyId,
          );

        throw itemsError;
      }

      setSuccessMessage(
        `Sales order ${orderNumber} created successfully.`,
      );

      router.push(
        `/sales/${order.id}`,
      );
    } catch (error: any) {
      console.error(
        "Create sales order error:",
        error,
      );

      setErrorMessage(
        error?.message ||
          "Unable to create the sales order.",
      );
    } finally {
      setSaving(false);
    }
  };

  const clearForm = () => {
    setCustomerId("");
    setCurrency(
      regionalSettings?.base_currency ||
        "USD",
    );
    setStatus("draft");
    setNotes("");
    setShippingAmount("0");
    setLines([]);
    setSearchProduct("");
    setSelectedProductId("");
    setSelectedVariantId("");
    setQuantity("1");
    setUnitPrice("0");
    setDiscountAmount("0");
    setTaxRate("0");
    setErrorMessage("");
    setSuccessMessage("");
  };

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-11">
            <div className="animate-pulse">
              <div className="h-8 w-48 rounded bg-slate-200" />

              <div className="mt-12 h-5 w-64 rounded bg-slate-200" />

              <div className="mt-5 h-14 w-80 rounded bg-slate-200" />

              <div className="mt-5 h-7 w-[700px] max-w-full rounded bg-slate-200" />

              <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
                <div className="h-[650px] rounded-2xl bg-white" />
                <div className="h-[650px] rounded-2xl bg-white" />
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-11">
          {/* Header */}
          <div className="mb-10">
            <button
              type="button"
              onClick={() =>
                router.push("/sales")
              }
              className="mb-10 inline-flex items-center gap-3 text-[24px] font-semibold text-slate-500 transition hover:text-slate-900"
            >
              <svg
                className="h-7 w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 12H5"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m12 19-7-7 7-7"
                />
              </svg>

              Back to Sales
            </button>

            <div className="flex items-center gap-3">
              <span className="h-3.5 w-3.5 rounded-full bg-green-700" />

              <span className="text-[24px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Sales Management
              </span>
            </div>

            <h1 className="mt-5 text-5xl font-bold tracking-tight text-slate-950">
              New Sale
            </h1>

            <p className="mt-4 text-[22px] text-slate-500">
              Create a sales order and prepare it for inventory fulfillment.
            </p>
          </div>

          {/* Messages */}
          {errorMessage && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                  />

                  <path
                    strokeLinecap="round"
                    d="M12 8v4M12 16h.01"
                  />
                </svg>

                <div>
                  <p className="text-sm font-semibold text-red-800">
                    Unable to create sale
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
              {successMessage}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
            {/* Main */}
            <div className="space-y-6">
              {/* Order Information */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-base font-semibold text-slate-950">
                    Order Information
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Customer, transaction currency, and order status.
                  </p>
                </div>

                <div className="grid gap-5 p-6 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Customer
                    </label>

                    <select
                      value={customerId}
                      onChange={(event) =>
                        setCustomerId(
                          event.target.value,
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="">
                        Walk-in customer
                      </option>

                      {customers.map(
                        (customer) => (
                          <option
                            key={
                              customer.id
                            }
                            value={
                              customer.id
                            }
                          >
                            {getCustomerLabel(
                              customer,
                            )}

                            {customer.email &&
                            customer.name
                              ? ` — ${customer.email}`
                              : ""}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Currency
                    </label>

                    <input
                      value={currency}
                      onChange={(event) =>
                        setCurrency(
                          event.target.value
                            .toUpperCase()
                            .slice(0, 3),
                        )
                      }
                      maxLength={3}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium uppercase text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />

                    <p className="mt-1.5 text-xs text-slate-400">
                      Default:{" "}
                      {regionalSettings
                        ?.base_currency ||
                        "USD"}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Order Status
                    </label>

                    <select
                      value={status}
                      onChange={(event) =>
                        setStatus(
                          event.target.value,
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="draft">
                        Draft
                      </option>

                      <option value="pending">
                        Pending
                      </option>

                      <option value="confirmed">
                        Confirmed
                      </option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Add Products */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-base font-semibold text-slate-950">
                    Add Products
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Select a variant, enter pricing, and add it to the order.
                  </p>
                </div>

                <div className="p-6">
                  <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                    <div className="min-w-0">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Product Search
                      </label>

                      <input
                        value={searchProduct}
                        onChange={(event) => {
                          setSearchProduct(
                            event.target.value,
                          );

                          if (
                            selectedProductId
                          ) {
                            setSelectedProductId(
                              "",
                            );

                            setSelectedVariantId(
                              "",
                            );

                            setUnitPrice("0");
                          }
                        }}
                        placeholder="Search product, brand, category, SKU, or barcode..."
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />

                      {searchProduct &&
                        !selectedProductId && (
                          <div className="relative z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                            {filteredProducts.length ===
                            0 ? (
                              <div className="px-4 py-4 text-sm text-slate-500">
                                No matching products found.
                              </div>
                            ) : (
                              filteredProducts.map(
                                (product) => (
                                  <button
                                    key={
                                      product.id
                                    }
                                    type="button"
                                    onClick={() =>
                                      selectProduct(
                                        product.id,
                                      )
                                    }
                                    className="block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50"
                                  >
                                    <div className="flex min-w-0 items-center justify-between gap-4">
                                      <div className="min-w-0">
                                        <p className="whitespace-nowrap text-sm font-semibold text-slate-800">
                                          {
                                            product.name
                                          }
                                        </p>

                                        <p className="mt-1 whitespace-nowrap text-xs text-slate-400">
                                          {product.brand ||
                                            "No brand"}

                                          {" · "}

                                          {product.category ||
                                            "Uncategorized"}
                                        </p>
                                      </div>

                                      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">
                                        {product.tracking_mode ===
                                        "none"
                                          ? "Not Tracked"
                                          : "Tracked"}
                                      </span>
                                    </div>
                                  </button>
                                ),
                              )
                            )}
                          </div>
                        )}
                    </div>

                    <div className="min-w-0">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Variant
                      </label>

                      <select
                        value={
                          selectedVariantId
                        }
                        disabled={
                          !selectedProduct
                        }
                        onChange={(event) =>
                          selectVariant(
                            event.target
                              .value,
                          )
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="">
                          {selectedProduct
                            ? "Select variant"
                            : "Select product first"}
                        </option>

                        {selectedProduct?.product_variants?.map(
                          (variant) => (
                            <option
                              key={
                                variant.id
                              }
                              value={
                                variant.id
                              }
                            >
                              {
                                variant.name
                              }

                              {variant.sku
                                ? ` — ${variant.sku}`
                                : ""}
                            </option>
                          ),
                        )}
                      </select>

                      {selectedVariant && (
                        <p className="mt-1.5 text-xs text-slate-400">
                          Cost:{" "}
                          {formatMoney(
                            selectedVariant.cost_price,
                            currency,
                            regionalSettings,
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedProduct &&
                    selectedVariant && (
                      <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="whitespace-normal break-words text-base font-semibold leading-6 text-slate-900">
                              {
                                selectedProduct.name
                              }
                            </p>

                            <p className="mt-1 whitespace-normal break-words text-sm text-slate-500">
                              {
                                selectedVariant.name
                              }

                              {selectedVariant.sku
                                ? ` · SKU ${selectedVariant.sku}`
                                : ""}
                            </p>
                          </div>

                          <span
                            className={`inline-flex w-fit shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                              selectedProduct.tracking_mode ===
                              "none"
                                ? "border-slate-200 bg-white text-slate-600"
                                : "border-blue-200 bg-blue-50 text-blue-700"
                            }`}
                          >
                            {selectedProduct.tracking_mode ===
                            "none"
                              ? "Not Tracked"
                              : "Tracked"}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-600">
                              Quantity
                            </label>

                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={quantity}
                              onChange={(event) =>
                                setQuantity(
                                  event.target
                                    .value,
                                )
                              }
                              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-600">
                              Unit Price
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={unitPrice}
                              onChange={(event) =>
                                setUnitPrice(
                                  event.target
                                    .value,
                                )
                              }
                              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-600">
                              Discount
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                discountAmount
                              }
                              onChange={(event) =>
                                setDiscountAmount(
                                  event.target
                                    .value,
                                )
                              }
                              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-600">
                              Tax %
                            </label>

                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={taxRate}
                              onChange={(event) =>
                                setTaxRate(
                                  event.target
                                    .value,
                                )
                              }
                              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={addLine}
                            className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                          >
                            Add Item
                          </button>
                        </div>
                      </div>
                    )}
                </div>
              </section>

              {/* Order Items */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-base font-semibold text-slate-950">
                    Order Items
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Review quantities, prices, discounts, and taxes before creating the order.
                  </p>
                </div>

                {lines.length === 0 ? (
                  <div className="px-6 py-14 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <svg
                        className="h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 3h12v18H6z"
                        />

                        <path
                          strokeLinecap="round"
                          d="M9 7h6M9 11h6M9 15h4"
                        />
                      </svg>
                    </div>

                    <h3 className="mt-4 text-sm font-semibold text-slate-900">
                      No products added
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Search for a product above to add items to this sale.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-[1150px] w-full table-auto">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/70">
                            <th className="min-w-[320px] px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Product
                            </th>

                            <th className="w-[100px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Qty
                            </th>

                            <th className="w-[150px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Price
                            </th>

                            <th className="w-[150px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Discount
                            </th>

                            <th className="w-[110px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Tax
                            </th>

                            <th className="w-[160px] px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Total
                            </th>

                            <th className="w-14 px-3 py-3" />
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {lines.map(
                            (line) => {
                              const lineSubtotal =
                                Number(
                                  line.quantity ||
                                    0,
                                ) *
                                Number(
                                  line.unit_price ||
                                    0,
                                );

                              const taxable =
                                Math.max(
                                  0,
                                  lineSubtotal -
                                    Number(
                                      line.discount_amount ||
                                        0,
                                    ),
                                );

                              const lineTax =
                                taxable *
                                (Number(
                                  line.tax_rate ||
                                    0,
                                ) /
                                  100);

                              const lineTotal =
                                taxable +
                                lineTax;

                              return (
                                <tr
                                  key={
                                    line.id
                                  }
                                  className="transition hover:bg-slate-50/50"
                                >
                                  <td className="min-w-[320px] px-6 py-4 align-middle">
                                    <div className="min-w-0">
                                      <p className="whitespace-nowrap text-sm font-semibold text-slate-800">
                                        {
                                          line.product_name
                                        }
                                      </p>

                                      <div className="mt-1 flex flex-nowrap items-center gap-2 overflow-hidden">
                                        <span className="whitespace-nowrap text-xs text-slate-400">
                                          {
                                            line.variant_name
                                          }
                                        </span>

                                        {line.sku && (
                                          <>
                                            <span className="shrink-0 text-slate-300">
                                              ·
                                            </span>

                                            <span className="whitespace-nowrap text-xs text-slate-400">
                                              SKU{" "}
                                              {
                                                line.sku
                                              }
                                            </span>
                                          </>
                                        )}

                                        <span
                                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                            line.tracking_mode ===
                                            "none"
                                              ? "border-slate-200 bg-slate-50 text-slate-500"
                                              : "border-blue-200 bg-blue-50 text-blue-700"
                                          }`}
                                        >
                                          {line.tracking_mode ===
                                          "none"
                                            ? "Not Tracked"
                                            : "Tracked"}
                                        </span>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-4 py-4 align-middle">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={
                                        line.quantity
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        updateLine(
                                          line.id,
                                          "quantity",
                                          event
                                            .target
                                            .value,
                                        )
                                      }
                                      className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                    />
                                  </td>

                                  <td className="px-4 py-4 align-middle">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={
                                        line.unit_price
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        updateLine(
                                          line.id,
                                          "unit_price",
                                          event
                                            .target
                                            .value,
                                        )
                                      }
                                      className="h-9 w-28 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                    />
                                  </td>

                                  <td className="px-4 py-4 align-middle">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={
                                        line.discount_amount
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        updateLine(
                                          line.id,
                                          "discount_amount",
                                          event
                                            .target
                                            .value,
                                        )
                                      }
                                      className="h-9 w-28 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                    />
                                  </td>

                                  <td className="px-4 py-4 align-middle">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      value={
                                        line.tax_rate
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        updateLine(
                                          line.id,
                                          "tax_rate",
                                          event
                                            .target
                                            .value,
                                        )
                                      }
                                      className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                    />
                                  </td>

                                  <td className="px-5 py-4 text-right align-middle">
                                    <p className="whitespace-nowrap text-sm font-semibold text-slate-900">
                                      {formatMoney(
                                        lineTotal,
                                        currency,
                                        regionalSettings,
                                      )}
                                    </p>
                                  </td>

                                  <td className="px-3 py-4 align-middle">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeLine(
                                          line.id,
                                        )
                                      }
                                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                      aria-label="Remove item"
                                    >
                                      <svg
                                        className="h-4 w-4"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          d="M6 6l12 12M18 6 6 18"
                                        />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="border-t border-slate-200 px-6 py-5">
                      <div className="grid gap-5 md:grid-cols-[1fr_320px]">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Order Notes
                          </label>

                          <textarea
                            value={notes}
                            onChange={(event) =>
                              setNotes(
                                event.target
                                  .value,
                              )
                            }
                            rows={5}
                            placeholder="Internal notes, delivery instructions, customer requests..."
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Shipping
                          </label>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              shippingAmount
                            }
                            onChange={(event) =>
                              setShippingAmount(
                                event.target
                                  .value,
                              )
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-right text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          />

                          <p className="mt-2 text-xs text-slate-400">
                            Enter shipping charges in{" "}
                            {currency}.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>

            {/* Summary */}
            <aside className="space-y-6">
              {/* Order Summary */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-base font-semibold text-slate-950">
                    Order Summary
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Final sales order totals.
                  </p>
                </div>

                <div className="space-y-4 px-6 py-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      Items
                    </span>

                    <span className="font-medium text-slate-800">
                      {lines.length}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      Subtotal
                    </span>

                    <span className="font-medium text-slate-800">
                      {formatMoney(
                        subtotal,
                        currency,
                        regionalSettings,
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      Discount
                    </span>

                    <span className="font-medium text-red-600">
                      -
                      {formatMoney(
                        totalDiscount,
                        currency,
                        regionalSettings,
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      Tax
                    </span>

                    <span className="font-medium text-slate-800">
                      {formatMoney(
                        taxAmount,
                        currency,
                        regionalSettings,
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      Shipping
                    </span>

                    <span className="font-medium text-slate-800">
                      {formatMoney(
                        shipping,
                        currency,
                        regionalSettings,
                      )}
                    </span>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-end justify-between gap-4">
                      <span className="text-sm font-semibold text-slate-700">
                        Order Total
                      </span>

                      <span className="whitespace-nowrap text-2xl font-semibold tracking-tight text-slate-950">
                        {formatMoney(
                          total,
                          currency,
                          regionalSettings,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Margin Preview */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-base font-semibold text-slate-950">
                    Margin Preview
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Estimated from current variant costs.
                  </p>
                </div>

                <div className="space-y-4 px-6 py-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      Estimated Cost
                    </span>

                    <span className="font-medium text-slate-800">
                      {formatMoney(
                        totalCost,
                        currency,
                        regionalSettings,
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      Gross Profit
                    </span>

                    <span
                      className={`font-semibold ${
                        estimatedGrossProfit >=
                        0
                          ? "text-emerald-700"
                          : "text-red-600"
                      }`}
                    >
                      {formatMoney(
                        estimatedGrossProfit,
                        currency,
                        regionalSettings,
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      Gross Margin
                    </span>

                    <span className="font-semibold text-slate-900">
                      {total > 0
                        ? `${(
                            (estimatedGrossProfit /
                              total) *
                            100
                          ).toFixed(1)}%`
                        : "0.0%"}
                    </span>
                  </div>
                </div>
              </section>

              {/* Fulfillment Info */}
              <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 7h16M4 12h10M4 17h7"
                      />

                      <circle
                        cx="18"
                        cy="15"
                        r="3"
                      />
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-blue-900">
                      Inventory fulfillment
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-blue-800/80">
                      This sale will be created as unfulfilled. Warehouse selection, batch allocation, and optional serial selection happen from the fulfillment workflow after the order is created.
                    </p>
                  </div>
                </div>
              </section>

              {/* V2 Inventory Model */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">
                  V2 Inventory Model
                </h3>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                      1
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        Product
                      </p>

                      <p className="text-[11px] text-slate-400">
                        Product definition
                      </p>
                    </div>
                  </div>

                  <div className="ml-4 h-3 border-l border-dashed border-slate-300" />

                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                      2
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        Variant
                      </p>

                      <p className="text-[11px] text-slate-400">
                        SKU / pricing identity
                      </p>
                    </div>
                  </div>

                  <div className="ml-4 h-3 border-l border-dashed border-slate-300" />

                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-600">
                      3
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        Batch / Lot
                      </p>

                      <p className="text-[11px] text-slate-400">
                        Primary tracked inventory
                      </p>
                    </div>
                  </div>

                  <div className="ml-4 h-3 border-l border-dashed border-slate-300" />

                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-xs font-bold text-purple-600">
                      4
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        Serialized Unit
                      </p>

                      <p className="text-[11px] text-slate-400">
                        Optional child identity
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Actions */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <button
                  type="button"
                  onClick={saveSale}
                  disabled={
                    saving ||
                    lines.length === 0
                  }
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Creating Sale..."
                    : "Create Sales Order"}
                </button>

                <button
                  type="button"
                  onClick={clearForm}
                  disabled={saving}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear Form
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}