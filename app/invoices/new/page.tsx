"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  currency: string | null;
  business_type: "product" | "service";
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  product_type: string;
  status: string;
};

type Variant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  selling_price: number;
  cost_price: number;
  is_default: boolean;
  is_active: boolean;
};

type InvoiceLine = {
  id: string;
  type: "product" | "service";
  product_id: string | null;
  variant_id: string | null;
  description: string;
  sku: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_rate: number;
};

const INVOICE_STATUSES = [
  "draft",
  "sent",
  "overdue",
  "void",
];

function createLine(
  type: "product" | "service"
): InvoiceLine {
  return {
    id: crypto.randomUUID(),
    type,
    product_id: null,
    variant_id: null,
    description: "",
    sku: "",
    quantity: 1,
    unit_price: 0,
    discount_amount: 0,
    tax_rate: 0,
  };
}

export default function NewInvoicePage() {
  const router = useRouter();
  const supabase = createClient();

  const customerDropdownRef =
    useRef<HTMLDivElement | null>(null);

  const [company, setCompany] =
    useState<Company | null>(null);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [variants, setVariants] =
    useState<Variant[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [customerId, setCustomerId] =
    useState("");

  const [customerSearch, setCustomerSearch] =
    useState("");

  const [customerDropdownOpen, setCustomerDropdownOpen] =
    useState(false);

  const [orderId, setOrderId] =
    useState("");

  const [linkedOrderNumber, setLinkedOrderNumber] =
    useState("");

  const [invoiceNumber, setInvoiceNumber] =
    useState(() => `INV-${Date.now()}`);

  const [status, setStatus] =
    useState("draft");

  const [dueDate, setDueDate] =
    useState("");

  const [vatNumber, setVatNumber] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [lines, setLines] =
    useState<InvoiceLine[]>([
      createLine("service"),
    ]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        router.replace("/login");
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

      if (membershipError) {
        throw membershipError;
      }

      if (!membership?.company_id) {
        throw new Error(
          "No company membership found."
        );
      }

      const companyId =
        membership.company_id;

      const params = new URLSearchParams(
        window.location.search
      );

      const requestedOrderId =
        params.get("orderId") || "";

      setOrderId(requestedOrderId);

      const [
        companyResult,
        customersResult,
        productsResult,
        variantsResult,
      ] = await Promise.all([
        supabase
          .from("companies")
          .select(
            "id, name, currency, business_type"
          )
          .eq("id", companyId)
          .single(),

        supabase
          .from("customers")
          .select(
            "id, name, email, phone"
          )
          .eq("company_id", companyId)
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("products")
          .select(
            "id, name, description, brand, category, product_type, status"
          )
          .eq("company_id", companyId)
          .eq("status", "active")
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("product_variants")
          .select(
            "id, product_id, name, sku, selling_price, cost_price, is_default, is_active"
          )
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name", {
            ascending: true,
          }),
      ]);

      if (companyResult.error) {
        throw companyResult.error;
      }

      if (customersResult.error) {
        throw customersResult.error;
      }

      if (productsResult.error) {
        throw productsResult.error;
      }

      if (variantsResult.error) {
        throw variantsResult.error;
      }

      const loadedCompany =
        companyResult.data;

      const loadedCustomers =
        customersResult.data || [];

      setCompany(loadedCompany);
      setCustomers(loadedCustomers);
      setProducts(
        productsResult.data || []
      );
      setVariants(
        variantsResult.data || []
      );

      /*
       * ---------------------------------------------------------
       * LINKED SALES ORDER
       * ---------------------------------------------------------
       */

      if (requestedOrderId) {
        const {
          data: linkedOrder,
          error: linkedOrderError,
        } = await supabase
          .from("orders")
          .select(
            "id, order_number, customer_id, currency, shipping_amount, discount_amount"
          )
          .eq("id", requestedOrderId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (linkedOrderError) {
          throw linkedOrderError;
        }

        if (!linkedOrder) {
          throw new Error(
            "The requested sales order could not be found."
          );
        }

        setLinkedOrderNumber(
          linkedOrder.order_number || ""
        );

        setCustomerId(
          linkedOrder.customer_id || ""
        );

        const linkedCustomer =
          loadedCustomers.find(
            (customer) =>
              customer.id ===
              linkedOrder.customer_id
          );

        if (linkedCustomer) {
          setCustomerSearch(
            linkedCustomer.name || ""
          );
        }

        const {
          data: linkedItems,
          error: linkedItemsError,
        } = await supabase
          .from("order_items")
          .select(
            "product_id, variant_id, product_name, variant_name, sku, quantity, unit_price, unit_cost, discount_amount, tax_amount, line_total"
          )
          .eq("order_id", linkedOrder.id)
          .eq("company_id", companyId)
          .order("created_at", {
            ascending: true,
          });

        if (linkedItemsError) {
          throw linkedItemsError;
        }

        const mappedLines: InvoiceLine[] =
          (linkedItems || []).map(
            (item) => {
              const quantity = Math.max(
                Number(item.quantity) || 1,
                0.001
              );

              const unitPrice = Math.max(
                Number(item.unit_price) || 0,
                0
              );

              const discount = Math.max(
                Number(
                  item.discount_amount
                ) || 0,
                0
              );

              const taxableAmount =
                Math.max(
                  quantity *
                    unitPrice -
                    discount,
                  0
                );

              const taxAmount =
                Math.max(
                  Number(
                    item.tax_amount
                  ) || 0,
                  0
                );

              return {
                id: crypto.randomUUID(),
                type: "product",
                product_id:
                  item.product_id,
                variant_id:
                  item.variant_id,
                description:
                  item.variant_name
                    ? `${item.product_name} - ${item.variant_name}`
                    : item.product_name,
                sku:
                  item.sku || "",
                quantity,
                unit_price:
                  unitPrice,
                discount_amount:
                  discount,
                tax_rate:
                  taxableAmount > 0
                    ? (taxAmount /
                        taxableAmount) *
                      100
                    : 0,
              };
            }
          );

        /*
         * Add shipping as an invoice service line.
         */
        if (
          Number(
            linkedOrder.shipping_amount
          ) > 0
        ) {
          mappedLines.push({
            id: crypto.randomUUID(),
            type: "service",
            product_id: null,
            variant_id: null,
            description: "Shipping",
            sku: "",
            quantity: 1,
            unit_price:
              Number(
                linkedOrder.shipping_amount
              ) || 0,
            discount_amount: 0,
            tax_rate: 0,
          });
        }

        setLines(
          mappedLines.length > 0
            ? mappedLines
            : [
                createLine(
                  loadedCompany.business_type ===
                    "product"
                    ? "product"
                    : "service"
                ),
              ]
        );
      } else if (
        loadedCompany.business_type ===
        "product"
      ) {
        setLines([
          createLine("product"),
        ]);
      }
    } catch (err: unknown) {
      console.error(
        "New invoice load error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not load invoice builder."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    // This effect intentionally starts the asynchronous Supabase
    // synchronization for the invoice builder.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setCustomerDropdownOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  const selectedCustomer = useMemo(() => {
    return (
      customers.find(
        (customer) =>
          customer.id === customerId
      ) || null
    );
  }, [customers, customerId]);

  const filteredCustomers = useMemo(() => {
    const search =
      customerSearch
        .trim()
        .toLowerCase();

    if (!search) {
      return customers;
    }

    return customers.filter(
      (customer) => {
        const name =
          customer.name
            ?.toLowerCase() || "";

        const email =
          customer.email
            ?.toLowerCase() || "";

        const phone =
          customer.phone
            ?.toLowerCase() || "";

        return (
          name.includes(search) ||
          email.includes(search) ||
          phone.includes(search)
        );
      }
    );
  }, [
    customers,
    customerSearch,
  ]);

  const subtotal = useMemo(() => {
    return lines.reduce(
      (sum, line) => {
        const quantity = Math.max(
          Number(line.quantity) || 0,
          0
        );

        const unitPrice = Math.max(
          Number(line.unit_price) || 0,
          0
        );

        const gross =
          quantity * unitPrice;

        const discount = Math.min(
          Math.max(
            Number(
              line.discount_amount
            ) || 0,
            0
          ),
          gross
        );

        return (
          sum +
          Math.max(
            gross - discount,
            0
          )
        );
      },
      0
    );
  }, [lines]);

  const discountTotal = useMemo(() => {
    return lines.reduce(
      (sum, line) =>
        sum +
        Math.min(
          Math.max(
            Number(
              line.discount_amount
            ) || 0,
            0
          ),
          Math.max(
            (Number(line.quantity) ||
              0) *
              (Number(
                line.unit_price
              ) || 0),
            0
          )
        ),
      0
    );
  }, [lines]);

  const taxTotal = useMemo(() => {
    return lines.reduce(
      (sum, line) => {
        const quantity = Math.max(
          Number(line.quantity) || 0,
          0
        );

        const unitPrice = Math.max(
          Number(line.unit_price) || 0,
          0
        );

        const gross =
          quantity * unitPrice;

        const discount = Math.min(
          Math.max(
            Number(
              line.discount_amount
            ) || 0,
            0
          ),
          gross
        );

        const taxableAmount =
          Math.max(
            gross - discount,
            0
          );

        const taxRate = Math.max(
          Number(line.tax_rate) || 0,
          0
        );

        return (
          sum +
          taxableAmount *
            (taxRate / 100)
        );
      },
      0
    );
  }, [lines]);

  const total = useMemo(() => {
    return subtotal + taxTotal;
  }, [subtotal, taxTotal]);

  function formatCurrency(
    value: number
  ) {
    const currency =
      company?.currency || "USD";

    try {
      return new Intl.NumberFormat(
        "en-US",
        {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }
      ).format(value);
    } catch {
      return `$${value.toFixed(2)}`;
    }
  }

  function formatStatus(
    value: string
  ) {
    return value
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      );
  }

  function updateLine(
    lineId: string,
    updates: Partial<InvoiceLine>
  ) {
    setLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              ...updates,
            }
          : line
      )
    );
  }

  function addLine(
    type: "product" | "service"
  ) {
    setLines((current) => [
      ...current,
      createLine(type),
    ]);
  }

  function removeLine(
    lineId: string
  ) {
    setLines((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter(
        (line) =>
          line.id !== lineId
      );
    });
  }

  function selectCustomer(
    customer: Customer
  ) {
    setCustomerId(customer.id);
    setCustomerSearch(
      customer.name || ""
    );
    setCustomerDropdownOpen(false);
    setError("");
  }

  function clearCustomer() {
    setCustomerId("");
    setCustomerSearch("");
    setCustomerDropdownOpen(false);
  }

  function selectProduct(
    lineId: string,
    productId: string
  ) {
    const product =
      products.find(
        (item) =>
          item.id === productId
      );

    if (!product) {
      updateLine(lineId, {
        product_id: null,
        variant_id: null,
        description: "",
        sku: "",
        unit_price: 0,
      });

      return;
    }

    const productVariants =
      variants.filter(
        (variant) =>
          variant.product_id ===
          product.id
      );

    const defaultVariant =
      productVariants.find(
        (variant) =>
          variant.is_default
      ) ||
      productVariants[0] ||
      null;

    updateLine(lineId, {
      type: "product",
      product_id: product.id,
      variant_id:
        defaultVariant?.id || null,
      description:
        product.description ||
        product.name,
      sku:
        defaultVariant?.sku || "",
      unit_price:
        Number(
          defaultVariant?.selling_price ||
            0
        ),
    });
  }

  function selectVariant(
    lineId: string,
    variantId: string
  ) {
    const variant =
      variants.find(
        (item) =>
          item.id === variantId
      );

    if (!variant) {
      return;
    }

    updateLine(lineId, {
      variant_id: variant.id,
      sku: variant.sku || "",
      unit_price:
        Number(
          variant.selling_price
        ) || 0,
    });
  }

  function getLineVariants(
    productId: string | null
  ) {
    if (!productId) {
      return [];
    }

    return variants.filter(
      (variant) =>
        variant.product_id ===
        productId
    );
  }

  function getLineSubtotal(
    line: InvoiceLine
  ) {
    const quantity = Math.max(
      Number(line.quantity) || 0,
      0
    );

    const unitPrice = Math.max(
      Number(line.unit_price) || 0,
      0
    );

    const gross =
      quantity * unitPrice;

    const discount = Math.min(
      Math.max(
        Number(
          line.discount_amount
        ) || 0,
        0
      ),
      gross
    );

    return Math.max(
      gross - discount,
      0
    );
  }

  function getLineTax(
    line: InvoiceLine
  ) {
    return (
      getLineSubtotal(line) *
      (Math.max(
        Number(line.tax_rate) || 0,
        0
      ) /
        100)
    );
  }

  async function saveInvoice() {
    setError("");
    setSuccess("");

    if (!invoiceNumber.trim()) {
      setError(
        "Please enter an invoice number."
      );
      return;
    }

    if (!customerId) {
      setError(
        "Please select a customer."
      );
      setCustomerDropdownOpen(true);
      return;
    }

    if (lines.length === 0) {
      setError(
        "Add at least one invoice line."
      );
      return;
    }

    for (const line of lines) {
      if (!line.description.trim()) {
        setError(
          "Every invoice line needs a description."
        );
        return;
      }

      if (
        !Number.isFinite(
          Number(line.quantity)
        ) ||
        Number(line.quantity) <= 0
      ) {
        setError(
          "Every invoice line must have a quantity greater than zero."
        );
        return;
      }

      if (
        !Number.isFinite(
          Number(line.unit_price)
        ) ||
        Number(line.unit_price) < 0
      ) {
        setError(
          "Unit prices cannot be negative."
        );
        return;
      }

      if (
        !Number.isFinite(
          Number(
            line.discount_amount
          )
        ) ||
        Number(
          line.discount_amount
        ) < 0
      ) {
        setError(
          "Discount amounts cannot be negative."
        );
        return;
      }

      if (
        !Number.isFinite(
          Number(line.tax_rate)
        ) ||
        Number(line.tax_rate) < 0
      ) {
        setError(
          "Tax rates cannot be negative."
        );
        return;
      }

      if (
        line.type === "product" &&
        !line.product_id
      ) {
        setError(
          "Every product line must have a product selected."
        );
        return;
      }

      if (
        line.type === "product" &&
        line.product_id &&
        line.variant_id
      ) {
        const variant =
          variants.find(
            (item) =>
              item.id ===
              line.variant_id
          );

        if (
          !variant ||
          variant.product_id !==
            line.product_id
        ) {
          setError(
            "One of the selected variants does not belong to its product."
          );
          return;
        }
      }
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        router.replace("/login");
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

      if (membershipError) {
        throw membershipError;
      }

      if (!membership?.company_id) {
        throw new Error(
          "No company membership found."
        );
      }

      const companyId =
        membership.company_id;

      const cleanInvoiceNumber =
        invoiceNumber.trim();

      const {
        data: existingInvoice,
        error: existingError,
      } = await supabase
        .from("invoices")
        .select("id")
        .eq(
          "company_id",
          companyId
        )
        .eq(
          "invoice_number",
          cleanInvoiceNumber
        )
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingInvoice) {
        throw new Error(
          `Invoice ${cleanInvoiceNumber} already exists.`
        );
      }

      /*
       * Verify customer belongs to this company.
       */
      const {
        data: verifiedCustomer,
        error: customerVerifyError,
      } = await supabase
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (customerVerifyError) {
        throw customerVerifyError;
      }

      if (!verifiedCustomer) {
        throw new Error(
          "The selected customer could not be verified."
        );
      }

      /*
       * Verify the linked order again before inserting.
       */
      if (orderId) {
        const {
          data: verifiedOrder,
          error: verifiedOrderError,
        } = await supabase
          .from("orders")
          .select(
            "id, customer_id"
          )
          .eq("id", orderId)
          .eq(
            "company_id",
            companyId
          )
          .maybeSingle();

        if (verifiedOrderError) {
          throw verifiedOrderError;
        }

        if (!verifiedOrder) {
          throw new Error(
            "The linked sales order could not be verified."
          );
        }

        /*
         * If the order has a customer, prevent
         * accidentally changing the invoice to a
         * different customer.
         */
        if (
          verifiedOrder.customer_id &&
          verifiedOrder.customer_id !==
            customerId
        ) {
          throw new Error(
            "The selected customer does not match the linked sales order."
          );
        }
      }

      const {
        data: invoice,
        error: invoiceError,
      } = await supabase
        .from("invoices")
        .insert({
          company_id: companyId,
          customer_id:
            customerId || null,
          invoice_number:
            cleanInvoiceNumber,
          order_id:
            orderId || null,
          status,
          subtotal,
          tax: taxTotal,
          total,
          due_date:
            dueDate || null,
          vat_number:
            vatNumber.trim() ||
            null,
          notes:
            notes.trim() || null,
        })
        .select("id")
        .single();

      if (invoiceError) {
        throw invoiceError;
      }

      const invoiceItems =
        lines.map((line) => ({
          company_id: companyId,
          invoice_id: invoice.id,
          product_id:
            line.product_id || null,
          variant_id:
            line.variant_id || null,
          description:
            line.description.trim(),
          sku:
            line.sku.trim() || null,
          quantity:
            Number(line.quantity),
          unit_price:
            Number(line.unit_price),
          discount_amount:
            Number(
              line.discount_amount
            ) || 0,
          tax_amount:
            getLineTax(line),
          line_total:
            getLineSubtotal(line) +
            getLineTax(line),
        }));

      const {
        error: itemsError,
      } = await supabase
        .from("invoice_items")
        .insert(invoiceItems);

      if (itemsError) {
        console.error(
          "Invoice items insert error:",
          itemsError
        );

        await supabase
          .from("invoices")
          .delete()
          .eq(
            "id",
            invoice.id
          )
          .eq(
            "company_id",
            companyId
          );

        throw itemsError;
      }

      setSuccess(
        "Invoice created successfully."
      );

      router.push(
        `/invoices/${invoice.id}`
      );
    } catch (err: unknown) {
      console.error(
        "Invoice creation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not create invoice."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="New Invoice"
        description="Create a professional customer invoice."
      >
        <div className="loading-page">
          <div className="loading-spinner" />
          <p>
            Loading invoice builder...
          </p>
        </div>

        <style jsx>{`
          .loading-page {
            min-height: 500px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #64748b;
            font-size: 14px;
          }

          .loading-spinner {
            width: 30px;
            height: 30px;
            margin-bottom: 12px;
            border: 3px solid #e2e8f0;
            border-top-color: #0f172a;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
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
      title="New Invoice"
      description={
        linkedOrderNumber
          ? `Create invoice from ${linkedOrderNumber}`
          : "Create a professional customer invoice."
      }
      actions={
        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              orderId
                ? router.push(
                    `/sales/${orderId}`
                  )
                : router.push(
                    "/invoices"
                  )
            }
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={saveInvoice}
            disabled={saving}
          >
            {saving
              ? "Creating..."
              : "Create Invoice"}
          </button>
        </div>
      }
    >
      <main className="invoice-builder">
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        <div className="builder-grid">
          <section className="builder-main">

            {/* ------------------------------------------------ */}
            {/* INVOICE DETAILS                                  */}
            {/* ------------------------------------------------ */}

            <div className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Invoice Details
                  </h2>

                  <p>
                    Basic information for
                    this invoice.
                  </p>
                </div>
              </div>

              {linkedOrderNumber && (
                <div className="linked-order-section">
                  <div className="linked-order-card">
                    <div className="linked-order-icon">
                      SO
                    </div>

                    <div className="linked-order-content">
                      <div className="linked-order-label">
                        LINKED SALES ORDER
                      </div>

                      <div className="linked-order-number">
                        {linkedOrderNumber}
                      </div>

                      <div className="linked-order-description">
                        This invoice is connected
                        to this sales order.
                      </div>
                    </div>

                    <button
                      type="button"
                      className="view-order-button"
                      onClick={() =>
                        router.push(
                          `/sales/${orderId}`
                        )
                      }
                      disabled={saving}
                    >
                      View Order
                    </button>
                  </div>
                </div>
              )}

              <div className="form-grid">

                {/* CUSTOMER */}
                <div className="form-group customer-group">
                  <label>
                    Customer
                    <span className="required">
                      *
                    </span>
                  </label>

                  <div
                    className="customer-selector"
                    ref={
                      customerDropdownRef
                    }
                  >
                    <button
                      type="button"
                      className={`customer-selector-button ${
                        customerDropdownOpen
                          ? "is-open"
                          : ""
                      }`}
                      onClick={() => {
                        if (saving) {
                          return;
                        }

                        setCustomerDropdownOpen(
                          (open) => !open
                        );
                      }}
                      disabled={saving}
                    >
                      <span
                        className={
                          selectedCustomer
                            ? "selected-customer-text"
                            : "placeholder-text"
                        }
                      >
                        {selectedCustomer
                          ? selectedCustomer.name
                          : "Select customer"}
                      </span>

                      <span className="customer-chevron">
                        {customerDropdownOpen
                          ? "▲"
                          : "▼"}
                      </span>
                    </button>

                    {customerDropdownOpen && (
                      <div className="customer-dropdown">
                        <div className="customer-search-wrapper">
                          <input
                            type="text"
                            value={
                              customerSearch
                            }
                            onChange={(
                              event
                            ) => {
                              setCustomerSearch(
                                event.target
                                  .value
                              );
                            }}
                            placeholder="Search customer..."
                            autoFocus
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                          />
                        </div>

                        <div className="customer-results">
                          {filteredCustomers.length ===
                          0 ? (
                            <div className="customer-empty">
                              No customers found.
                            </div>
                          ) : (
                            filteredCustomers.map(
                              (
                                customer
                              ) => {
                                const isSelected =
                                  customer.id ===
                                  customerId;

                                return (
                                  <button
                                    type="button"
                                    key={
                                      customer.id
                                    }
                                    className={`customer-option ${
                                      isSelected
                                        ? "selected"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      selectCustomer(
                                        customer
                                      )
                                    }
                                  >
                                    <span className="customer-avatar">
                                      {(
                                        customer.name ||
                                        "C"
                                      )
                                        .charAt(
                                          0
                                        )
                                        .toUpperCase()}
                                    </span>

                                    <span className="customer-option-content">
                                      <strong>
                                        {
                                          customer.name
                                        }
                                      </strong>

                                      {customer.email && (
                                        <small>
                                          {
                                            customer.email
                                          }
                                        </small>
                                      )}

                                      {!customer.email &&
                                        customer.phone && (
                                          <small>
                                            {
                                              customer.phone
                                            }
                                          </small>
                                        )}
                                    </span>

                                    {isSelected && (
                                      <span className="customer-check">
                                        ✓
                                      </span>
                                    )}
                                  </button>
                                );
                              }
                            )
                          )}
                        </div>

                        {selectedCustomer && (
                          <button
                            type="button"
                            className="clear-customer"
                            onClick={
                              clearCustomer
                            }
                          >
                            Clear customer
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedCustomer && (
                    <div className="customer-preview">
                      <span className="customer-selected">
                        Customer selected
                      </span>

                      {selectedCustomer.email && (
                        <span>
                          {
                            selectedCustomer.email
                          }
                        </span>
                      )}

                      {selectedCustomer.phone && (
                        <span>
                          {
                            selectedCustomer.phone
                          }
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* INVOICE NUMBER */}
                <div className="form-group">
                  <label>
                    Invoice Number
                    <span className="required">
                      *
                    </span>
                  </label>

                  <input
                    type="text"
                    value={
                      invoiceNumber
                    }
                    onChange={(event) =>
                      setInvoiceNumber(
                        event.target.value
                      )
                    }
                    disabled={saving}
                  />
                </div>

                {/* VAT */}
                <div className="form-group">
                  <label>
                    VAT Number
                  </label>

                  <input
                    type="text"
                    placeholder="e.g. VAT / TRN number"
                    value={
                      vatNumber
                    }
                    onChange={(event) =>
                      setVatNumber(
                        event.target.value
                      )
                    }
                    disabled={saving}
                  />

                  <div className="field-help">
                    Optional tax registration
                    number for this invoice.
                  </div>
                </div>

                {/* STATUS */}
                <div className="form-group">
                  <label>
                    Status
                  </label>

                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(
                        event.target.value
                      )
                    }
                    disabled={saving}
                  >
                    {INVOICE_STATUSES.map(
                      (value) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {formatStatus(
                            value
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* DUE DATE */}
                <div className="form-group">
                  <label>
                    Due Date
                  </label>

                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) =>
                      setDueDate(
                        event.target.value
                      )
                    }
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            {/* ------------------------------------------------ */}
            {/* INVOICE ITEMS                                    */}
            {/* ------------------------------------------------ */}

            <div className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Invoice Items
                  </h2>

                  <p>
                    Add products, services,
                    or custom invoice lines.
                  </p>
                </div>

                <div className="line-buttons">
                  <button
                    type="button"
                    className="small-button"
                    onClick={() =>
                      addLine("product")
                    }
                    disabled={saving}
                  >
                    + Product
                  </button>

                  <button
                    type="button"
                    className="small-button"
                    onClick={() =>
                      addLine("service")
                    }
                    disabled={saving}
                  >
                    + Service
                  </button>
                </div>
              </div>

              <div className="items-wrapper">
                {lines.map(
                  (
                    line,
                    index
                  ) => {
                    const lineVariants =
                      getLineVariants(
                        line.product_id
                      );

                    return (
                      <div
                        className="invoice-line"
                        key={
                          line.id
                        }
                      >
                        <div className="line-number">
                          {index + 1}
                        </div>

                        <div className="line-content">
                          <div className="line-top">
                            <div className="line-type">
                              {line.type ===
                              "product"
                                ? "PRODUCT"
                                : "SERVICE"}
                            </div>

                            {lines.length >
                              1 && (
                              <button
                                type="button"
                                className="remove-line"
                                onClick={() =>
                                  removeLine(
                                    line.id
                                  )
                                }
                                disabled={
                                  saving
                                }
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          {line.type ===
                            "product" && (
                            <div className="product-fields">
                              <div className="form-group">
                                <label>
                                  Product
                                </label>

                                <select
                                  value={
                                    line.product_id ||
                                    ""
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    selectProduct(
                                      line.id,
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  disabled={
                                    saving
                                  }
                                >
                                  <option value="">
                                    Select product
                                  </option>

                                  {products.map(
                                    (
                                      product
                                    ) => (
                                      <option
                                        key={
                                          product.id
                                        }
                                        value={
                                          product.id
                                        }
                                      >
                                        {
                                          product.name
                                        }
                                        {product.brand
                                          ? ` — ${product.brand}`
                                          : ""}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>

                              <div className="form-group">
                                <label>
                                  Variant
                                </label>

                                <select
                                  value={
                                    line.variant_id ||
                                    ""
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    selectVariant(
                                      line.id,
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  disabled={
                                    saving ||
                                    lineVariants.length ===
                                      0
                                  }
                                >
                                  <option value="">
                                    {line.product_id
                                      ? lineVariants.length >
                                        0
                                        ? "Select variant"
                                        : "No variants"
                                      : "Select product first"}
                                  </option>

                                  {lineVariants.map(
                                    (
                                      variant
                                    ) => (
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
                                    )
                                  )}
                                </select>
                              </div>
                            </div>
                          )}

                          <div className="description-grid">
                            <div className="form-group description-field">
                              <label>
                                Description
                              </label>

                              <input
                                type="text"
                                placeholder={
                                  line.type ===
                                  "product"
                                    ? "Product or item description"
                                    : "Service description"
                                }
                                value={
                                  line.description
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateLine(
                                    line.id,
                                    {
                                      description:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                disabled={
                                  saving
                                }
                              />
                            </div>

                            <div className="form-group sku-field">
                              <label>
                                SKU
                              </label>

                              <input
                                type="text"
                                placeholder="Optional"
                                value={
                                  line.sku
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateLine(
                                    line.id,
                                    {
                                      sku: event
                                        .target
                                        .value,
                                    }
                                  )
                                }
                                disabled={
                                  saving
                                }
                              />
                            </div>
                          </div>

                          <div className="line-numbers">
                            <div className="form-group">
                              <label>
                                Qty
                              </label>

                              <input
                                type="number"
                                min="0.001"
                                step="0.001"
                                value={
                                  line.quantity
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateLine(
                                    line.id,
                                    {
                                      quantity:
                                        Number(
                                          event
                                            .target
                                            .value
                                        ) || 0,
                                    }
                                  )
                                }
                                disabled={
                                  saving
                                }
                              />
                            </div>

                            <div className="form-group">
                              <label>
                                Unit Price
                              </label>

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  line.unit_price
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateLine(
                                    line.id,
                                    {
                                      unit_price:
                                        Number(
                                          event
                                            .target
                                            .value
                                        ) || 0,
                                    }
                                  )
                                }
                                disabled={
                                  saving
                                }
                              />
                            </div>

                            <div className="form-group">
                              <label>
                                Discount
                              </label>

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  line.discount_amount
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateLine(
                                    line.id,
                                    {
                                      discount_amount:
                                        Number(
                                          event
                                            .target
                                            .value
                                        ) || 0,
                                    }
                                  )
                                }
                                disabled={
                                  saving
                                }
                              />
                            </div>

                            <div className="form-group">
                              <label>
                                Tax %
                              </label>

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  line.tax_rate
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateLine(
                                    line.id,
                                    {
                                      tax_rate:
                                        Number(
                                          event
                                            .target
                                            .value
                                        ) || 0,
                                    }
                                  )
                                }
                                disabled={
                                  saving
                                }
                              />
                            </div>

                            <div className="line-total">
                              <span>
                                Line Total
                              </span>

                              <strong>
                                {formatCurrency(
                                  getLineSubtotal(
                                    line
                                  ) +
                                    getLineTax(
                                      line
                                    )
                                )}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* ------------------------------------------------ */}
            {/* NOTES                                            */}
            {/* ------------------------------------------------ */}

            <div className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Notes
                  </h2>

                  <p>
                    Optional notes shown on
                    the invoice.
                  </p>
                </div>
              </div>

              <textarea
                className="notes"
                placeholder="Add payment terms, delivery information, thank-you message, or other notes..."
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value
                  )
                }
                disabled={saving}
              />
            </div>
          </section>

          {/* -------------------------------------------------- */}
          {/* SIDEBAR                                            */}
          {/* -------------------------------------------------- */}

          <aside className="builder-sidebar">
            <div className="summary-card">
              <div className="summary-header">
                Invoice Summary
              </div>

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

              <div className="summary-row">
                <span>
                  Discount
                </span>

                <strong className="discount">
                  -
                  {formatCurrency(
                    discountTotal
                  )}
                </strong>
              </div>

              <div className="summary-row">
                <span>
                  Tax
                </span>

                <strong>
                  {formatCurrency(
                    taxTotal
                  )}
                </strong>
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

              <div className="balance-box">
                <span>
                  Amount Due
                </span>

                <strong>
                  {formatCurrency(
                    total
                  )}
                </strong>
              </div>
            </div>

            {linkedOrderNumber && (
              <div className="sidebar-linked-card">
                <div className="sidebar-linked-label">
                  SOURCE ORDER
                </div>

                <strong>
                  {linkedOrderNumber}
                </strong>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/sales/${orderId}`
                    )
                  }
                  disabled={saving}
                >
                  Open Sales Order
                </button>
              </div>
            )}

            <div className="company-card">
              <div className="company-label">
                FROM
              </div>

              <div className="company-name">
                {company?.name ||
                  "Your Company"}
              </div>

              <div className="company-meta">
                {company?.business_type ===
                "product"
                  ? "Product Business"
                  : "Service Business"}
              </div>
            </div>

            <div className="info-card">
              <div className="info-title">
                Invoice Builder
              </div>

              <p>
                Product lines automatically
                use your catalog pricing and
                SKU.
              </p>

              <p>
                Service lines can be entered
                manually without linking a
                product.
              </p>

              <p>
                Totals are calculated
                automatically from the
                invoice lines.
              </p>
            </div>

            <button
              type="button"
              className="sidebar-create"
              onClick={saveInvoice}
              disabled={saving}
            >
              {saving
                ? "Creating Invoice..."
                : "Create Invoice"}
            </button>
          </aside>
        </div>
      </main>

      <style jsx>{`
  .invoice-builder {
    padding: 28px;
    background: #f8fafc;
    min-height: calc(100vh - 120px);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .builder-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 20px;
    max-width: 1450px;
    margin: 0 auto;
  }

  .builder-main {
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-width: 0;
  }

  .builder-sidebar {
    display: flex;
    flex-direction: column;
    gap: 14px;
    position: sticky;
    top: 20px;
    align-self: start;
  }

  .card,
  .summary-card,
  .company-card,
  .info-card,
  .sidebar-linked-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  }

  .card {
    overflow: visible;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 18px 20px;
    border-bottom: 1px solid #e2e8f0;
  }

  .card-header h2 {
    margin: 0;
    color: #0f172a;
    font-size: 17px;
    font-weight: 750;
    letter-spacing: -0.2px;
  }

  .card-header p {
    margin: 4px 0 0;
    color: #94a3b8;
    font-size: 12px;
    line-height: 1.5;
  }

  /* LINKED ORDER */

  .linked-order-section {
    padding: 16px 20px 0;
  }

  .linked-order-card {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 13px;
    border: 1px solid #bbf7d0;
    border-radius: 10px;
    background: #f0fdf4;
  }

  .linked-order-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    background: #059669;
    color: #ffffff;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.4px;
  }

  .linked-order-content {
    min-width: 0;
  }

  .linked-order-label {
    color: #047857;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.7px;
    line-height: 1.2;
  }

  .linked-order-number {
    display: block;
    margin-top: 3px;
    color: #0f172a;
    font-size: 14px;
    font-weight: 800;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .linked-order-description {
    margin-top: 3px;
    color: #64748b;
    font-size: 11px;
    line-height: 1.4;
    white-space: normal;
  }

  .view-order-button {
    height: 34px;
    padding: 0 11px;
    border: 1px solid #a7f3d0;
    border-radius: 8px;
    background: #ffffff;
    color: #047857;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .view-order-button:hover {
    background: #ecfdf5;
    border-color: #6ee7b7;
  }

  /* FORM */

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    padding: 20px;
  }

  .form-group {
    min-width: 0;
  }

  .form-group label {
    display: block;
    margin-bottom: 6px;
    color: #475569;
    font-size: 11.5px;
    font-weight: 700;
  }

  .required {
    color: #dc2626;
    margin-left: 3px;
  }

  input,
  select,
  textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #dbe3ea;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    font: inherit;
    font-size: 12.5px;
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  input,
  select {
    height: 40px;
    padding: 0 11px;
  }

  input::placeholder,
  textarea::placeholder {
    color: #a1a1aa;
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: #6ee7b7;
    box-shadow: 0 0 0 3px #ecfdf5;
  }

  input:disabled,
  select:disabled,
  textarea:disabled {
    background: #f8fafc;
    color: #64748b;
    cursor: not-allowed;
  }

  /* CUSTOMER DROPDOWN */

  .customer-group {
    position: relative;
    z-index: 30;
  }

  .customer-selector {
    position: relative;
    width: 100%;
  }

  .customer-selector-button {
    width: 100%;
    height: 40px;
    padding: 0 11px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border: 1px solid #dbe3ea;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    cursor: pointer;
    text-align: left;
    font: inherit;
    font-size: 12.5px;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .customer-selector-button:hover {
    border-color: #cbd5e1;
  }

  .customer-selector-button.is-open {
    border-color: #6ee7b7;
    box-shadow: 0 0 0 3px #ecfdf5;
  }

  .customer-selector-button:disabled {
    background: #f8fafc;
    color: #64748b;
    cursor: not-allowed;
  }

  .placeholder-text {
    color: #94a3b8;
  }

  .selected-customer-text {
    color: #0f172a;
    font-weight: 650;
  }

  .customer-chevron {
    flex: 0 0 auto;
    color: #64748b;
    font-size: 8px;
  }

  .customer-dropdown {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 6px);
    z-index: 100;
    overflow: hidden;
    border: 1px solid #dbe3ea;
    border-radius: 10px;
    background: #ffffff;
    box-shadow: 0 14px 35px rgba(15, 23, 42, 0.13);
  }

  .customer-search-wrapper {
    padding: 9px;
    border-bottom: 1px solid #eef2f7;
  }

  .customer-search-wrapper input {
    height: 36px;
  }

  .customer-results {
    max-height: 260px;
    overflow-y: auto;
    padding: 5px;
  }

  .customer-option {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #0f172a;
    cursor: pointer;
    text-align: left;
  }

  .customer-option:hover,
  .customer-option.selected {
    background: #f0fdf4;
  }

  .customer-avatar {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    background: #ecfdf5;
    color: #059669;
    font-size: 10px;
    font-weight: 800;
  }

  .customer-option-content {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .customer-option-content strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 11.5px;
    font-weight: 700;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .customer-option-content small {
    overflow: hidden;
    color: #94a3b8;
    font-size: 10px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .customer-check {
    flex: 0 0 auto;
    color: #059669;
    font-size: 13px;
    font-weight: 900;
  }

  .customer-empty {
    padding: 17px 10px;
    color: #94a3b8;
    font-size: 11.5px;
    text-align: center;
  }

  .clear-customer {
    width: 100%;
    height: 34px;
    border: 0;
    border-top: 1px solid #eef2f7;
    background: #ffffff;
    color: #dc2626;
    cursor: pointer;
    font-size: 10.5px;
    font-weight: 700;
  }

  .clear-customer:hover {
    background: #fef2f2;
  }

  .customer-preview {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
    margin-top: 6px;
    color: #94a3b8;
    font-size: 10.5px;
  }

  .customer-selected {
    color: #059669;
    font-weight: 700;
  }

  .field-help {
    margin-top: 5px;
    color: #94a3b8;
    font-size: 10.5px;
    line-height: 1.4;
  }

  /* ITEMS */

  .line-buttons {
    display: flex;
    gap: 7px;
  }

  .small-button {
    height: 34px;
    padding: 0 11px;
    border: 1px solid #dbe3ea;
    border-radius: 8px;
    background: #ffffff;
    color: #475569;
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 700;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .small-button:hover {
    background: #ecfdf5;
    border-color: #a7f3d0;
    color: #047857;
  }

  .items-wrapper {
    padding: 0 20px;
  }

  .invoice-line {
    display: flex;
    gap: 12px;
    padding: 20px 0;
    border-bottom: 1px solid #eef2f7;
  }

  .invoice-line:last-child {
    border-bottom: 0;
  }

  .line-number {
    width: 29px;
    height: 29px;
    flex: 0 0 29px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: #ecfdf5;
    color: #059669;
    font-size: 11px;
    font-weight: 800;
  }

  .line-content {
    flex: 1;
    min-width: 0;
  }

  .line-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 11px;
  }

  .line-type {
    color: #059669;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.65px;
  }

  .remove-line {
    padding: 0;
    border: 0;
    background: transparent;
    color: #dc2626;
    cursor: pointer;
    font-size: 10.5px;
    font-weight: 700;
  }

  .remove-line:hover {
    color: #b91c1c;
    text-decoration: underline;
  }

  .product-fields {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 11px;
    margin-bottom: 11px;
  }

  .description-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 180px;
    gap: 11px;
  }

  .line-numbers {
    display: grid;
    grid-template-columns: 90px 140px 120px 90px minmax(150px, 1fr);
    gap: 11px;
    align-items: end;
    margin-top: 11px;
  }

  .line-total {
    min-width: 0;
    height: 40px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 11px;
    border: 1px solid #d1fae5;
    border-radius: 8px;
    background: #f0fdf4;
  }

  .line-total span {
    color: #059669;
    font-size: 9px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .line-total strong {
    margin-top: 2px;
    color: #0f172a;
    font-size: 12.5px;
  }

  .notes {
    min-height: 120px;
    padding: 12px;
    resize: vertical;
    margin: 20px;
    width: calc(100% - 40px);
    line-height: 1.5;
  }

  /* SUMMARY */

  .summary-card {
    padding: 18px;
  }

  .summary-header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #0f172a;
    font-size: 15px;
    font-weight: 800;
    margin-bottom: 17px;
  }

  .summary-header::before {
    content: "";
    width: 4px;
    height: 17px;
    border-radius: 999px;
    background: #059669;
  }

  .summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 12px;
    color: #64748b;
    font-size: 12.5px;
  }

  .summary-row strong {
    color: #334155;
    font-weight: 700;
  }

  .summary-row .discount {
    color: #059669;
  }

  .summary-divider {
    height: 1px;
    background: #e5e7eb;
    margin: 16px 0;
  }

  .summary-total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    color: #0f172a;
    font-size: 14px;
    font-weight: 800;
  }

  .summary-total strong {
    color: #059669;
    font-size: 19px;
  }

  .balance-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-top: 15px;
    padding: 13px;
    border: 1px solid #bbf7d0;
    border-radius: 9px;
    background: #ecfdf5;
    color: #047857;
    font-size: 12px;
    font-weight: 750;
  }

  .balance-box strong {
    color: #065f46;
    font-size: 15px;
  }

  /* SIDEBAR */

  .sidebar-linked-card {
    padding: 15px;
    background: #f8fafc;
  }

  .sidebar-linked-label {
    color: #94a3b8;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.7px;
  }

  .sidebar-linked-card strong {
    display: block;
    margin-top: 5px;
    color: #0f172a;
    font-size: 14px;
    font-weight: 800;
  }

  .sidebar-linked-card button {
    width: 100%;
    height: 33px;
    margin-top: 11px;
    border: 1px solid #dbe3ea;
    border-radius: 8px;
    background: #ffffff;
    color: #475569;
    cursor: pointer;
    font-size: 10.5px;
    font-weight: 700;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .sidebar-linked-card button:hover {
    background: #ecfdf5;
    border-color: #a7f3d0;
    color: #047857;
  }

  .company-card {
    padding: 17px;
  }

  .company-label {
    color: #94a3b8;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.7px;
  }

  .company-name {
    margin-top: 7px;
    color: #0f172a;
    font-size: 15px;
    font-weight: 800;
  }

  .company-meta {
    margin-top: 4px;
    color: #059669;
    font-size: 11px;
    font-weight: 650;
  }

  .info-card {
    padding: 17px;
  }

  .info-title {
    color: #0f172a;
    font-size: 12.5px;
    font-weight: 800;
    margin-bottom: 9px;
  }

  .info-card p {
    margin: 7px 0 0;
    color: #64748b;
    font-size: 10.5px;
    line-height: 1.55;
  }

  /* BUTTONS */

  .primary-button,
  .secondary-button,
  .sidebar-create {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 38px;
    padding: 0 14px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.1s ease;
  }

  .primary-button,
  .sidebar-create {
    border: 0;
    background: #059669;
    color: #ffffff;
    box-shadow: 0 1px 2px rgba(5, 150, 105, 0.18);
  }

  .primary-button:hover,
  .sidebar-create:hover {
    background: #047857;
    box-shadow: 0 4px 10px rgba(5, 150, 105, 0.16);
  }

  .primary-button:active,
  .sidebar-create:active {
    transform: translateY(1px);
  }

  .secondary-button {
    border: 1px solid #dbe3ea;
    background: #ffffff;
    color: #475569;
  }

  .secondary-button:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  .primary-button:disabled,
  .secondary-button:disabled,
  .sidebar-create:disabled,
  .small-button:disabled,
  .view-order-button:disabled,
  .sidebar-linked-card button:disabled,
  .customer-selector-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }

  .sidebar-create {
    width: 100%;
    height: 44px;
  }

  /* ALERTS */

  .alert {
    max-width: 1450px;
    margin: 0 auto 16px;
    padding: 11px 13px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 600;
  }

  .alert-error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }

  .alert-success {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }

  /* LOADING */

  .loading-page {
    min-height: 500px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 13px;
  }

  .loading-spinner {
    width: 30px;
    height: 30px;
    margin-bottom: 12px;
    border: 3px solid #d1fae5;
    border-top-color: #059669;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* RESPONSIVE */

  @media (max-width: 1200px) {
    .builder-grid {
      grid-template-columns: minmax(0, 1fr) 290px;
    }

    .line-numbers {
      grid-template-columns:
        80px
        120px
        110px
        80px
        minmax(130px, 1fr);
    }
  }

  @media (max-width: 1000px) {
    .builder-grid {
      grid-template-columns: 1fr;
    }

    .builder-sidebar {
      position: static;
    }

    .company-card,
    .info-card,
    .sidebar-create {
      display: none;
    }
  }

  @media (max-width: 750px) {
    .invoice-builder {
      padding: 18px;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .product-fields,
    .description-grid {
      grid-template-columns: 1fr;
    }

    .line-numbers {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .line-total {
      grid-column: span 2;
    }

    .card-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .line-buttons {
      width: 100%;
    }

    .small-button {
      flex: 1;
    }

    .linked-order-card {
      grid-template-columns: 40px minmax(0, 1fr);
      align-items: start;
    }

    .view-order-button {
      grid-column: 1 / -1;
      width: 100%;
    }
  }

  @media (max-width: 520px) {
    .header-actions {
      width: 100%;
    }

    .header-actions button {
      flex: 1;
    }

    .invoice-builder {
      padding: 12px;
    }

    .form-grid,
    .items-wrapper {
      padding-left: 15px;
      padding-right: 15px;
    }

    .linked-order-section {
      padding-left: 15px;
      padding-right: 15px;
    }

    .invoice-line {
      gap: 8px;
    }

    .line-number {
      width: 25px;
      flex-basis: 25px;
    }

    .line-numbers {
      grid-template-columns: 1fr 1fr;
    }

    .line-total {
      grid-column: span 2;
    }

    .card-header {
      padding: 16px;
    }
  }
`}</style>
    </AppShell>
  );
}