"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  legal_name: string | null;
  display_name: string | null;
  status: string;
  currency: string | null;
  payment_terms_days: number | null;
  default_lead_time_days: number | null;
  minimum_order_amount: number | null;
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
  variant_id: string | null;
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
    name: string | null;
    sku: string | null;
    cost_price: number | null;
    selling_price: number | null;
  } | null;
};

type PurchaseOrder = {
  id: string;
  company_id: string;
  supplier_id: string;
  po_number: string;
  status:
    | "draft"
    | "sent"
    | "confirmed"
    | "partially_received"
    | "received"
    | "cancelled";
  currency: string;
  order_date: string;
  expected_date: string | null;
  warehouse_id: string | null;
  supplier_reference: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  notes: string | null;
  terms: string | null;
};

type ExistingItem = {
  id: string;
  company_id: string;
  purchase_order_id: string;
  product_id: string;
  variant_id: string | null;
  supplier_product_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  supplier_sku: string | null;
  description: string | null;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
};

type OrderLine = {
  id?: string;
  supplierProductId: string | null;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  supplierSku: string | null;
  description: string | null;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  discount: number;
  tax: number;
};

const money = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

function normalizeSupplierProducts(
  data: any[]
): SupplierProduct[] {
  return (data || []).map((row) => {
    const product = Array.isArray(row.product)
      ? row.product[0] ?? null
      : row.product ?? null;

    const variant = Array.isArray(row.variant)
      ? row.variant[0] ?? null
      : row.variant ?? null;

    return {
      id: row.id,
      supplier_id: row.supplier_id,
      product_id: row.product_id,
      variant_id: row.variant_id ?? null,
      supplier_sku: row.supplier_sku ?? null,
      supplier_product_name:
        row.supplier_product_name ?? null,
      unit_cost: Number(row.unit_cost || 0),
      currency: row.currency || "USD",
      minimum_order_quantity: Number(
        row.minimum_order_quantity || 1
      ),
      lead_time_days: Number(row.lead_time_days || 0),
      is_preferred: Boolean(row.is_preferred),
      product: product
        ? {
            id: product.id,
            name: product.name,
            brand: product.brand ?? null,
            category: product.category ?? null,
          }
        : null,
      variant: variant
        ? {
            id: variant.id,
            name: variant.name ?? null,
            sku: variant.sku ?? null,
            cost_price:
              variant.cost_price !== null
                ? Number(variant.cost_price)
                : null,
            selling_price:
              variant.selling_price !== null
                ? Number(variant.selling_price)
                : null,
          }
        : null,
    };
  });
}

export default function EditPurchaseOrderPage() {
  const params = useParams();
  const router = useRouter();

  const purchaseOrderId = String(params.id);

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [purchaseOrder, setPurchaseOrder] =
    useState<PurchaseOrder | null>(null);

  const [suppliers, setSuppliers] = useState<
    Supplier[]
  >([]);

  const [warehouses, setWarehouses] = useState<
    Warehouse[]
  >([]);

  const [supplierProducts, setSupplierProducts] =
    useState<SupplierProduct[]>([]);

  const [supplierId, setSupplierId] =
    useState("");

  const [currency, setCurrency] =
    useState("USD");

  const [orderDate, setOrderDate] =
    useState("");

  const [expectedDate, setExpectedDate] =
    useState("");

  const [warehouseId, setWarehouseId] =
    useState("");

  const [supplierReference, setSupplierReference] =
    useState("");

  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  const [
    selectedSupplierProductId,
    setSelectedSupplierProductId,
  ] = useState("");

  const [newQuantity, setNewQuantity] =
    useState(1);

  const [lines, setLines] = useState<OrderLine[]>(
    []
  );

  useEffect(() => {
    loadPage();
  }, [purchaseOrderId]);

  async function loadPage() {
    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membership, error } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (error) throw error;

      if (!membership?.company_id) {
        throw new Error(
          "No company membership found."
        );
      }

      const companyId = membership.company_id;

      const { data: po, error: poError } =
        await supabase
          .from("purchase_orders")
          .select(
            `
              id,
              company_id,
              supplier_id,
              po_number,
              status,
              currency,
              order_date,
              expected_date,
              warehouse_id,
              supplier_reference,
              subtotal,
              discount_amount,
              tax_amount,
              shipping_amount,
              total_amount,
              notes,
              terms
            `
          )
          .eq("id", purchaseOrderId)
          .eq("company_id", companyId)
          .maybeSingle();

      if (poError) throw poError;

      if (!po) {
        throw new Error(
          "Purchase order not found."
        );
      }

      setPurchaseOrder(
        po as PurchaseOrder
      );

      setSupplierId(po.supplier_id);
      setCurrency(po.currency || "USD");
      setOrderDate(po.order_date || "");
      setExpectedDate(
        po.expected_date || ""
      );
      setWarehouseId(
        po.warehouse_id || ""
      );
      setSupplierReference(
        po.supplier_reference || ""
      );
      setNotes(po.notes || "");
      setTerms(po.terms || "");

      const [
        suppliersResult,
        warehousesResult,
        supplierProductsResult,
        itemsResult,
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
          .eq("company_id", companyId)
          .order("display_name", {
            ascending: true,
          }),

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
          .eq("company_id", companyId)
          .order("name", {
            ascending: true,
          }),

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
          .eq("company_id", companyId)
          .eq("is_active", true),

        supabase
          .from("purchase_order_items")
          .select(
            `
              id,
              company_id,
              purchase_order_id,
              product_id,
              variant_id,
              supplier_product_id,
              product_name,
              variant_name,
              sku,
              supplier_sku,
              description,
              quantity,
              received_quantity,
              unit_cost,
              discount_amount,
              tax_amount,
              line_total
            `
          )
          .eq("company_id", companyId)
          .eq(
            "purchase_order_id",
            purchaseOrderId
          )
          .order("created_at", {
            ascending: true,
          }),
      ]);

      if (suppliersResult.error)
        throw suppliersResult.error;

      if (warehousesResult.error)
        throw warehousesResult.error;

      if (supplierProductsResult.error)
        throw supplierProductsResult.error;

      if (itemsResult.error)
        throw itemsResult.error;

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
          supplierProductsResult.data || []
        )
      );

      const mappedLines: OrderLine[] =
        (
          (itemsResult.data ||
            []) as ExistingItem[]
        ).map((item) => ({
          id: item.id,
          supplierProductId:
            item.supplier_product_id,
          productId: item.product_id,
          variantId: item.variant_id,
          productName: item.product_name,
          variantName: item.variant_name,
          sku: item.sku,
          supplierSku: item.supplier_sku,
          description: item.description,
          quantity: Number(
            item.quantity || 0
          ),
          receivedQuantity: Number(
            item.received_quantity || 0
          ),
          unitCost: Number(
            item.unit_cost || 0
          ),
          discount: Number(
            item.discount_amount || 0
          ),
          tax: Number(
            item.tax_amount || 0
          ),
        }));

      setLines(mappedLines);
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "Failed to load purchase order."
      );
    } finally {
      setLoading(false);
    }
  }

  const isEditable =
    purchaseOrder?.status === "draft" ||
    purchaseOrder?.status === "cancelled";

  const selectedSupplier = suppliers.find(
    (supplier) =>
      supplier.id === supplierId
  );

  const availableSupplierProducts =
    supplierProducts.filter(
      (item) =>
        item.supplier_id === supplierId
    );

  const selectedSupplierProduct =
    availableSupplierProducts.find(
      (item) =>
        item.id ===
        selectedSupplierProductId
    );

  const subtotal = useMemo(
    () =>
      lines.reduce(
        (sum, line) =>
          sum +
          Math.max(
            0,
            line.quantity *
              line.unitCost -
              line.discount
          ),
        0
      ),
    [lines]
  );

  const discountTotal = useMemo(
    () =>
      lines.reduce(
        (sum, line) =>
          sum +
          Math.max(
            0,
            line.discount
          ),
        0
      ),
    [lines]
  );

  const taxTotal = useMemo(
    () =>
      lines.reduce(
        (sum, line) =>
          sum +
          Math.max(0, line.tax),
        0
      ),
    [lines]
  );

  const shippingAmount = Number(
    purchaseOrder?.shipping_amount || 0
  );

  const total = Math.max(
    0,
    subtotal +
      taxTotal +
      shippingAmount
  );

  const totalQuantity = lines.reduce(
    (sum, line) =>
      sum + Number(line.quantity || 0),
    0
  );

  const totalReceived = lines.reduce(
    (sum, line) =>
      sum +
      Number(
        line.receivedQuantity || 0
      ),
    0
  );

  function handleSupplierChange(
    value: string
  ) {
    if (lines.length > 0) {
      setErrorMessage(
        "Supplier cannot be changed while this purchase order has items."
      );
      return;
    }

    setSupplierId(value);

    const supplier = suppliers.find(
      (item) => item.id === value
    );

    if (supplier?.currency) {
      setCurrency(
        supplier.currency
      );
    }

    setSelectedSupplierProductId("");
  }

  function addLine() {
    setErrorMessage("");

    if (!supplierId) {
      setErrorMessage(
        "Select a supplier first."
      );
      return;
    }

    if (!selectedSupplierProduct) {
      setErrorMessage(
        "Select a supplier product first."
      );
      return;
    }

    const quantity = Number(
      newQuantity
    );

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      setErrorMessage(
        "Quantity must be greater than zero."
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
      setLines((current) =>
        current.map(
          (line, index) =>
            index === existingIndex
              ? {
                  ...line,
                  quantity:
                    line.quantity +
                    quantity,
                }
              : line
        )
      );
    } else {
      setLines((current) => [
        ...current,
        {
          supplierProductId:
            selectedSupplierProduct.id,
          productId:
            selectedSupplierProduct.product_id,
          variantId:
            selectedSupplierProduct.variant_id,
          productName:
            selectedSupplierProduct
              .product?.name ||
            selectedSupplierProduct
              .supplier_product_name ||
            "Product",
          variantName:
            selectedSupplierProduct
              .variant?.name || null,
          sku:
            selectedSupplierProduct
              .variant?.sku || null,
          supplierSku:
            selectedSupplierProduct
              .supplier_sku || null,
          description: null,
          quantity,
          receivedQuantity: 0,
          unitCost:
            selectedSupplierProduct.unit_cost,
          discount: 0,
          tax: 0,
        },
      ]);
    }

    setSelectedSupplierProductId("");
    setNewQuantity(1);
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
    setLines((current) =>
      current.map(
        (line, lineIndex) => {
          if (
            lineIndex !== index
          ) {
            return line;
          }

          if (field === "quantity") {
            const minimum =
              line.receivedQuantity;

            return {
              ...line,
              quantity: Math.max(
                minimum,
                Number.isFinite(value)
                  ? value
                  : minimum
              ),
            };
          }

          return {
            ...line,
            [field]: Math.max(
              0,
              Number.isFinite(value)
                ? value
                : 0
            ),
          };
        }
      )
    );
  }

  function removeLine(index: number) {
    const line = lines[index];

    if (
      line.receivedQuantity > 0
    ) {
      setErrorMessage(
        "A received item cannot be removed from the purchase order."
      );
      return;
    }

    setLines((current) =>
      current.filter(
        (_, lineIndex) =>
          lineIndex !== index
      )
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!purchaseOrder) return;

    if (!isEditable) {
      setErrorMessage(
        "This purchase order can no longer be edited."
      );
      return;
    }

    if (!supplierId) {
      setErrorMessage(
        "Select a supplier."
      );
      return;
    }

    if (!warehouseId) {
      setErrorMessage(
        "Select a warehouse."
      );
      return;
    }

    if (lines.length === 0) {
      setErrorMessage(
        "Add at least one product to the purchase order."
      );
      return;
    }

    for (const line of lines) {
      if (line.quantity <= 0) {
        setErrorMessage(
          "All quantities must be greater than zero."
        );
        return;
      }

      if (
        line.quantity <
        line.receivedQuantity
      ) {
        setErrorMessage(
          "Quantity cannot be lower than the quantity already received."
        );
        return;
      }
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
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

      if (membershipError)
        throw membershipError;

      if (!membership?.company_id) {
        throw new Error(
          "No company membership found."
        );
      }

      const companyId =
        membership.company_id;

      const {
        data: currentPO,
        error: currentPOError,
      } = await supabase
        .from("purchase_orders")
        .select(
          `
            id,
            status,
            supplier_id
          `
        )
        .eq("id", purchaseOrderId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (currentPOError)
        throw currentPOError;

      if (!currentPO) {
        throw new Error(
          "Purchase order no longer exists."
        );
      }

      if (
        currentPO.status !== "draft" &&
        currentPO.status !==
          "cancelled"
      ) {
        throw new Error(
          "This purchase order was changed and can no longer be edited."
        );
      }

      const {
        data: currentItems,
        error: currentItemsError,
      } = await supabase
        .from("purchase_order_items")
        .select(
          `
            id,
            received_quantity
          `
        )
        .eq("company_id", companyId)
        .eq(
          "purchase_order_id",
          purchaseOrderId
        );

      if (currentItemsError)
        throw currentItemsError;

      const currentReceivedMap =
        new Map<string, number>();

      for (
        const item of currentItems || []
      ) {
        currentReceivedMap.set(
          item.id,
          Number(
            item.received_quantity || 0
          )
        );
      }

      for (const line of lines) {
        if (
          line.id &&
          currentReceivedMap.has(
            line.id
          )
        ) {
          const currentReceived =
            currentReceivedMap.get(
              line.id
            ) || 0;

          if (
            line.quantity <
            currentReceived
          ) {
            throw new Error(
              "Receiving data changed. Please reload the purchase order."
            );
          }
        }
      }

      const submittedItemIds =
        new Set(
          lines
            .filter((line) =>
              Boolean(line.id)
            )
            .map(
              (line) =>
                line.id as string
            )
        );

      for (
        const item of currentItems || []
      ) {
        const received =
          Number(
            item.received_quantity ||
              0
          );

        if (
          received > 0 &&
          !submittedItemIds.has(
            item.id
          )
        ) {
          throw new Error(
            "A received purchase-order item cannot be removed."
          );
        }
      }

      const {
        error: updatePOError,
      } = await supabase
        .from("purchase_orders")
        .update({
          supplier_id: supplierId,
          currency,
          order_date: orderDate,
          expected_date:
            expectedDate || null,
          warehouse_id: warehouseId,
          supplier_reference:
            supplierReference.trim() ||
            null,
          subtotal,
          discount_amount:
            discountTotal,
          tax_amount: taxTotal,
          shipping_amount:
            shippingAmount,
          total_amount: total,
          notes:
            notes.trim() || null,
          terms:
            terms.trim() || null,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", purchaseOrderId)
        .eq("company_id", companyId);

      if (updatePOError)
        throw updatePOError;

      for (const line of lines) {
        const lineTotal =
          Math.max(
            0,
            line.quantity *
              line.unitCost -
              line.discount +
              line.tax
          );

        const payload = {
          company_id: companyId,
          purchase_order_id:
            purchaseOrderId,
          product_id: line.productId,
          variant_id: line.variantId,
          supplier_product_id:
            line.supplierProductId,
          product_name:
            line.productName,
          variant_name:
            line.variantName,
          sku: line.sku,
          supplier_sku:
            line.supplierSku,
          description:
            line.description,
          quantity: line.quantity,
          received_quantity:
            line.receivedQuantity,
          unit_cost:
            line.unitCost,
          discount_amount:
            line.discount,
          tax_amount: line.tax,
          line_total: lineTotal,
          updated_at:
            new Date().toISOString(),
        };

        if (line.id) {
          const { error } =
            await supabase
              .from(
                "purchase_order_items"
              )
              .update(payload)
              .eq("id", line.id)
              .eq(
                "company_id",
                companyId
              )
              .eq(
                "purchase_order_id",
                purchaseOrderId
              );

          if (error) throw error;
        } else {
          const { error } =
            await supabase
              .from(
                "purchase_order_items"
              )
              .insert(payload);

          if (error) throw error;
        }
      }

      const removableItemIds =
        (currentItems || [])
          .filter(
            (item) =>
              Number(
                item.received_quantity ||
                  0
              ) === 0 &&
              !submittedItemIds.has(
                item.id
              )
          )
          .map((item) => item.id);

      if (
        removableItemIds.length > 0
      ) {
        const { error } =
          await supabase
            .from(
              "purchase_order_items"
            )
            .delete()
            .eq(
              "company_id",
              companyId
            )
            .eq(
              "purchase_order_id",
              purchaseOrderId
            )
            .in(
              "id",
              removableItemIds
            );

        if (error) throw error;
      }

      setSuccessMessage(
        "Purchase order updated successfully."
      );

      setTimeout(() => {
        router.push(
          `/purchase-orders/${purchaseOrderId}`
        );
      }, 700);
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "Failed to update purchase order."
      );
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    if (saving) return;

    router.push(
      `/purchase-orders/${purchaseOrderId}`
    );
  }

  if (loading) {
    return (
      <AppShell>
        <main className="po-edit-page">
          <div className="po-edit-loading">
            <div className="po-edit-spinner" />
            <p>Loading purchase order...</p>
          </div>

          <style jsx>{`
            .po-edit-page {
              width: 100%;
              min-height: 500px;
              padding: 28px;
              box-sizing: border-box;
            }

            .po-edit-loading {
              min-height: 420px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 12px;
              color: #64748b;
              font-size: 13px;
            }

            .po-edit-spinner {
              width: 28px;
              height: 28px;
              border: 3px solid #e2e8f0;
              border-top-color: #0f172a;
              border-radius: 50%;
              animation: poEditSpin 0.8s linear infinite;
            }

            @keyframes poEditSpin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </main>
      </AppShell>
    );
  }

  if (!purchaseOrder) {
    return (
      <AppShell>
        <main className="po-edit-page">
          <div className="po-edit-error-card">
            <h2>Purchase order not found</h2>

            <p>
              {errorMessage ||
                "The purchase order could not be loaded."}
            </p>

            <Link
              href="/purchase-orders"
              className="po-edit-error-button"
            >
              Back to Purchase Orders
            </Link>
          </div>

          <style jsx>{`
            .po-edit-page {
              width: 100%;
              padding: 28px;
              box-sizing: border-box;
            }

            .po-edit-error-card {
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              padding: 32px;
              box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
            }

            .po-edit-error-card h2 {
              margin: 0 0 8px;
              color: #0f172a;
              font-size: 20px;
            }

            .po-edit-error-card p {
              margin: 0 0 20px;
              color: #64748b;
              font-size: 13px;
            }

            .po-edit-error-button {
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              width: auto !important;
              height: 40px !important;
              min-height: 40px !important;
              padding: 0 16px !important;
              margin: 0 !important;
              box-sizing: border-box !important;
              border-radius: 9px !important;
              background: #0f172a !important;
              border: 1px solid #0f172a !important;
              color: #ffffff !important;
              text-decoration: none !important;
              font-family: inherit !important;
              font-size: 13px !important;
              font-weight: 700 !important;
              line-height: 1 !important;
            }

            .po-edit-error-button:hover {
              background: #1e293b !important;
              color: #ffffff !important;
              border-color: #1e293b !important;
            }
          `}</style>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="po-edit-page">
        <div className="po-edit-header">
          <button
  type="button"
  className="po-edit-back-button"
  onClick={() => router.push(`/purchase-orders/${purchaseOrderId}`)}
>
  ← Back to Purchase Order
</button>

          <div className="po-edit-eyebrow">
            PURCHASE ORDER
          </div>

          <div className="po-edit-title-row">
            <h1>
              Edit {purchaseOrder.po_number}
            </h1>

            <span
              className={`po-edit-status po-edit-status-${purchaseOrder.status}`}
            >
              {purchaseOrder.status
                .replaceAll("_", " ")
                .replace(/\b\w/g, (letter) =>
                  letter.toUpperCase()
                )}
            </span>
          </div>

          <p className="po-edit-header-text">
            Update supplier, delivery details,
            products, costs and purchase order
            notes.
          </p>
        </div>

        {!isEditable && (
          <div className="po-edit-locked-alert">
            <strong>
              This purchase order is locked.
            </strong>

            <span>
              Orders that have been sent,
              confirmed, partially received, or
              fully received cannot be edited.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="po-edit-alert po-edit-alert-error">
            <strong>Error</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="po-edit-alert po-edit-alert-success">
            <strong>Success</strong>
            <span>{successMessage}</span>
          </div>
        )}

        <form
          className="po-edit-layout"
          onSubmit={handleSubmit}
        >
          <div className="po-edit-main">
            <section className="po-edit-card">
              <div className="po-edit-card-header">
                <div>
                  <h2>Order Information</h2>
                  <p>
                    Basic purchase order and
                    delivery information.
                  </p>
                </div>
              </div>

              <div className="po-edit-form-grid">
                <div className="po-edit-field">
                  <label>Supplier</label>

                  <select
                    value={supplierId}
                    onChange={(event) =>
                      handleSupplierChange(
                        event.target.value
                      )
                    }
                    disabled={
                      !isEditable ||
                      lines.length > 0
                    }
                  >
                    <option value="">
                      Select supplier
                    </option>

                    {suppliers.map(
                      (supplier) => (
                        <option
                          key={supplier.id}
                          value={supplier.id}
                        >
                          {supplier.display_name ||
                            supplier.legal_name ||
                            "Unnamed Supplier"}
                          {supplier.status !==
                            "active" &&
                            " (Inactive)"}
                        </option>
                      )
                    )}
                  </select>

                  {lines.length > 0 && (
                    <small>
                      Supplier cannot be changed
                      while items exist.
                    </small>
                  )}
                </div>

                <div className="po-edit-field">
                  <label>Currency</label>

                  <input
                    value={currency}
                    onChange={(event) =>
                      setCurrency(
                        event.target.value.toUpperCase()
                      )
                    }
                    maxLength={3}
                    disabled={!isEditable}
                  />
                </div>

                <div className="po-edit-field">
                  <label>Order Date</label>

                  <input
                    type="date"
                    value={orderDate}
                    onChange={(event) =>
                      setOrderDate(
                        event.target.value
                      )
                    }
                    disabled={!isEditable}
                  />
                </div>

                <div className="po-edit-field">
                  <label>
                    Expected Delivery
                  </label>

                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(event) =>
                      setExpectedDate(
                        event.target.value
                      )
                    }
                    disabled={!isEditable}
                  />
                </div>

                <div className="po-edit-field">
                  <label>Warehouse</label>

                  <select
                    value={warehouseId}
                    onChange={(event) =>
                      setWarehouseId(
                        event.target.value
                      )
                    }
                    disabled={!isEditable}
                  >
                    <option value="">
                      Select warehouse
                    </option>

                    {warehouses.map(
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
                          {warehouse.code
                            ? ` (${warehouse.code})`
                            : ""}
                          {!warehouse.is_active
                            ? " (Inactive)"
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="po-edit-field">
                  <label>
                    Supplier Reference
                  </label>

                  <input
                    value={
                      supplierReference
                    }
                    onChange={(event) =>
                      setSupplierReference(
                        event.target.value
                      )
                    }
                    placeholder="Supplier quote / reference"
                    disabled={!isEditable}
                  />
                </div>
              </div>
            </section>

            <section className="po-edit-card">
              <div className="po-edit-card-header">
                <div>
                  <h2>Add Products</h2>
                  <p>
                    Add products using your
                    supplier catalog.
                  </p>
                </div>
              </div>

              <div className="po-edit-add-product-row">
                <div className="po-edit-field po-edit-product-selector">
                  <label>
                    Supplier Product
                  </label>

                  <select
                    value={
                      selectedSupplierProductId
                    }
                    onChange={(event) =>
                      setSelectedSupplierProductId(
                        event.target.value
                      )
                    }
                    disabled={
                      !isEditable ||
                      !supplierId
                    }
                  >
                    <option value="">
                      {supplierId
                        ? "Select product"
                        : "Select supplier first"}
                    </option>

                    {availableSupplierProducts.map(
                      (item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.product?.name ||
                            item.supplier_product_name ||
                            "Product"}
                          {item.variant?.name
                            ? ` — ${item.variant.name}`
                            : ""}
                          {item.supplier_sku
                            ? ` [${item.supplier_sku}]`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="po-edit-field po-edit-quantity-field">
                  <label>Quantity</label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={newQuantity}
                    onChange={(event) =>
                      setNewQuantity(
                        Number(
                          event.target
                            .value
                        )
                      )
                    }
                    disabled={
                      !isEditable ||
                      !supplierId
                    }
                  />
                </div>

                <button
                  type="button"
                  className="po-edit-add-button"
                  onClick={addLine}
                  disabled={
                    !isEditable ||
                    !selectedSupplierProduct
                  }
                >
                  + Add Product
                </button>
              </div>

              {selectedSupplierProduct && (
                <div className="po-edit-product-preview">
                  <div>
                    <span>Cost</span>
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
                    <span>Lead Time</span>
                    <strong>
                      {
                        selectedSupplierProduct.lead_time_days
                      }{" "}
                      days
                    </strong>
                  </div>

                  <div>
                    <span>Supplier SKU</span>
                    <strong>
                      {selectedSupplierProduct.supplier_sku ||
                        "—"}
                    </strong>
                  </div>
                </div>
              )}

              <div className="po-edit-table-wrapper">
                {lines.length === 0 ? (
                  <div className="po-edit-empty">
                    <div className="po-edit-empty-icon">
                      +
                    </div>

                    <h3>
                      No products added
                    </h3>

                    <p>
                      Select a supplier product
                      above to add items to this
                      purchase order.
                    </p>
                  </div>
                ) : (
                  <table className="po-edit-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Qty</th>
                        <th>Received</th>
                        <th>Unit Cost</th>
                        <th>Discount</th>
                        <th>Tax</th>
                        <th>Total</th>
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
                              key={
                                line.id ||
                                `${line.productId}-${index}`
                              }
                            >
                              <td>
                                <div className="po-edit-product-name">
                                  {
                                    line.productName
                                  }
                                </div>

                                {line.variantName && (
                                  <div className="po-edit-variant">
                                    {
                                      line.variantName
                                    }
                                  </div>
                                )}
                              </td>

                              <td>
                                <span className="po-edit-sku">
                                  {line.sku ||
                                    line.supplierSku ||
                                    "—"}
                                </span>
                              </td>

                              <td>
                                <input
                                  className="po-edit-table-input po-edit-qty-input"
                                  type="number"
                                  min={
                                    line.receivedQuantity
                                  }
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
                                  disabled={
                                    !isEditable
                                  }
                                />
                              </td>

                              <td>
                                <span className="po-edit-received">
                                  {
                                    line.receivedQuantity
                                  }
                                </span>
                              </td>

                              <td>
                                <input
                                  className="po-edit-table-input"
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
                                  disabled={
                                    !isEditable
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  className="po-edit-table-input"
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
                                  disabled={
                                    !isEditable
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  className="po-edit-table-input"
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
                                  disabled={
                                    !isEditable
                                  }
                                />
                              </td>

                              <td>
                                <strong className="po-edit-line-total">
                                  {money(
                                    lineTotal,
                                    currency
                                  )}
                                </strong>
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className="po-edit-remove-button"
                                  onClick={() =>
                                    removeLine(
                                      index
                                    )
                                  }
                                  disabled={
                                    !isEditable ||
                                    line.receivedQuantity >
                                      0
                                  }
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section className="po-edit-card">
              <div className="po-edit-card-header">
                <div>
                  <h2>Notes & Terms</h2>
                  <p>
                    Add internal notes or supplier
                    terms.
                  </p>
                </div>
              </div>

              <div className="po-edit-notes-grid">
                <div className="po-edit-field">
                  <label>Notes</label>

                  <textarea
                    value={notes}
                    onChange={(event) =>
                      setNotes(
                        event.target.value
                      )
                    }
                    placeholder="Internal notes..."
                    rows={5}
                    disabled={!isEditable}
                  />
                </div>

                <div className="po-edit-field">
                  <label>Terms</label>

                  <textarea
                    value={terms}
                    onChange={(event) =>
                      setTerms(
                        event.target.value
                      )
                    }
                    placeholder="Payment terms, delivery terms, etc..."
                    rows={5}
                    disabled={!isEditable}
                  />
                </div>
              </div>
            </section>
          </div>

          <aside className="po-edit-summary-column">
            <section className="po-edit-summary-card">
              <div className="po-edit-summary-header">
                <div>
                  <div className="po-edit-summary-eyebrow">
                    PURCHASE ORDER
                  </div>

                  <h2>
                    {purchaseOrder.po_number}
                  </h2>
                </div>

                <span
                  className={`po-edit-status po-edit-status-${purchaseOrder.status}`}
                >
                  {purchaseOrder.status
                    .replaceAll(
                      "_",
                      " "
                    )
                    .replace(
                      /\b\w/g,
                      (letter) =>
                        letter.toUpperCase()
                    )}
                </span>
              </div>

              <div className="po-edit-summary-stats">
                <div>
                  <span>Products</span>
                  <strong>
                    {lines.length}
                  </strong>
                </div>

                <div>
                  <span>Quantity</span>
                  <strong>
                    {totalQuantity}
                  </strong>
                </div>

                <div>
                  <span>Received</span>
                  <strong>
                    {totalReceived}
                  </strong>
                </div>
              </div>

              <div className="po-edit-divider" />

              <div className="po-edit-summary-row">
                <span>Subtotal</span>

                <strong>
                  {money(
                    subtotal,
                    currency
                  )}
                </strong>
              </div>

              <div className="po-edit-summary-row">
                <span>Discount</span>

                <strong className="po-edit-discount">
                  -
                  {money(
                    discountTotal,
                    currency
                  )}
                </strong>
              </div>

              <div className="po-edit-summary-row">
                <span>Tax</span>

                <strong>
                  {money(
                    taxTotal,
                    currency
                  )}
                </strong>
              </div>

              {shippingAmount > 0 && (
                <div className="po-edit-summary-row">
                  <span>Shipping</span>

                  <strong>
                    {money(
                      shippingAmount,
                      currency
                    )}
                  </strong>
                </div>
              )}

              <div className="po-edit-divider" />

              <div className="po-edit-summary-total">
                <span>Total</span>

                <strong>
                  {money(
                    total,
                    currency
                  )}
                </strong>
              </div>

              {selectedSupplier && (
                <div className="po-edit-supplier-summary">
                  <div className="po-edit-supplier-title">
                    Supplier Terms
                  </div>

                  <div className="po-edit-supplier-row">
                    <span>
                      Payment Terms
                    </span>

                    <strong>
                      {selectedSupplier.payment_terms_days ??
                        0}{" "}
                      days
                    </strong>
                  </div>

                  <div className="po-edit-supplier-row">
                    <span>
                      Lead Time
                    </span>

                    <strong>
                      {selectedSupplier.default_lead_time_days ??
                        0}{" "}
                      days
                    </strong>
                  </div>
                </div>
              )}

              <div className="po-edit-actions">
                <button
                  type="submit"
                  className="po-edit-save-button"
                  disabled={
                    saving ||
                    !isEditable
                  }
                >
                  {saving
                    ? "Saving Changes..."
                    : "Save Changes"}
                </button>

                <button
                  type="button"
                  className="po-edit-cancel-button"
                  onClick={
                    cancelEdit
                  }
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>

              <button
  type="button"
  className="po-edit-view-button"
  onClick={() => router.push(`/purchase-orders/${purchaseOrderId}`)}
>
  View Purchase Order →
</button>
            </section>
          </aside>
        </form>

        <style jsx>{`
          .po-edit-page {
            width: 100%;
            max-width: 1600px;
            margin: 0 auto;
            padding: 28px;
            box-sizing: border-box;
            color: #0f172a;
            font-family:
              Inter,
              ui-sans-serif,
              system-ui,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              sans-serif;
          }

          .po-edit-header {
            margin-bottom: 22px;
          }

          /* BACK BUTTON — FULLY ISOLATED FROM GLOBAL CSS */

          .po-edit-back-button {
            width: fit-content !important;
            min-width: 0 !important;
            height: 38px !important;
            min-height: 38px !important;
            box-sizing: border-box !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            padding: 0 13px !important;
            margin: 0 0 16px 0 !important;
            border: 1px solid #dbe1e8 !important;
            border-radius: 9px !important;
            background: #ffffff !important;
            color: #475569 !important;
            text-decoration: none !important;
            font-family: inherit !important;
            font-size: 12px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
            cursor: pointer !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
            outline: none !important;
          }

          .po-edit-back-button:hover {
            background: #f8fafc !important;
            border-color: #cbd5e1 !important;
            color: #0f172a !important;
            text-decoration: none !important;
            box-shadow: 0 2px 5px rgba(15, 23, 42, 0.06) !important;
          }

          .po-edit-back-button:active {
            background: #f1f5f9 !important;
            transform: translateY(1px);
          }

          .po-edit-back-icon {
            font-size: 15px !important;
            line-height: 1 !important;
            color: #64748b !important;
          }

          .po-edit-eyebrow {
            margin-bottom: 6px;
            color: #94a3b8;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.08em;
          }

          .po-edit-title-row {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
          }

          .po-edit-title-row h1 {
            margin: 0;
            color: #0f172a;
            font-size: 28px;
            line-height: 1.15;
            letter-spacing: -0.6px;
            font-weight: 800;
          }

          .po-edit-header-text {
            margin: 8px 0 0;
            color: #64748b;
            font-size: 13px;
          }

          .po-edit-status {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            height: 26px !important;
            min-height: 26px !important;
            padding: 0 9px !important;
            border-radius: 999px !important;
            font-size: 10px !important;
            font-weight: 800 !important;
            line-height: 1 !important;
            white-space: nowrap !important;
            text-transform: capitalize;
          }

          .po-edit-status-draft {
            background: #f1f5f9 !important;
            color: #475569 !important;
          }

          .po-edit-status-sent {
            background: #eff6ff !important;
            color: #2563eb !important;
          }

          .po-edit-status-confirmed {
            background: #f0fdf4 !important;
            color: #15803d !important;
          }

          .po-edit-status-partially_received {
            background: #fff7ed !important;
            color: #c2410c !important;
          }

          .po-edit-status-received {
            background: #ecfdf5 !important;
            color: #047857 !important;
          }

          .po-edit-status-cancelled {
            background: #fef2f2 !important;
            color: #dc2626 !important;
          }

          .po-edit-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 330px;
            gap: 20px;
            align-items: start;
          }

          .po-edit-main {
            min-width: 0;
            display: grid;
            gap: 20px;
          }

          .po-edit-summary-column {
            position: sticky;
            top: 20px;
          }

          .po-edit-card,
          .po-edit-summary-card {
            background: #ffffff !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 14px !important;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04) !important;
            overflow: hidden;
          }

          .po-edit-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            padding: 22px;
            border-bottom: 1px solid #e5e7eb;
          }

          .po-edit-card-header h2 {
            margin: 0;
            color: #0f172a;
            font-size: 18px;
            font-weight: 800;
          }

          .po-edit-card-header p {
            margin: 5px 0 0;
            color: #94a3b8;
            font-size: 13px;
          }

          .po-edit-form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
            padding: 22px;
          }

          .po-edit-field {
            min-width: 0;
          }

          .po-edit-field label {
            display: block;
            margin-bottom: 7px;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
          }

          .po-edit-field small {
            display: block;
            margin-top: 6px;
            color: #94a3b8;
            font-size: 11px;
          }

          .po-edit-field input,
          .po-edit-field select,
          .po-edit-field textarea {
            width: 100% !important;
            box-sizing: border-box !important;
            border: 1px solid #dbe1e8 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border-radius: 9px !important;
            font-family: inherit !important;
            font-size: 13px !important;
            outline: none !important;
            box-shadow: none !important;
          }

          .po-edit-field input,
          .po-edit-field select {
            height: 40px !important;
            min-height: 40px !important;
            padding: 0 12px !important;
          }

          .po-edit-field textarea {
            min-height: 120px !important;
            padding: 11px 12px !important;
            resize: vertical;
          }

          .po-edit-field input:focus,
          .po-edit-field select:focus,
          .po-edit-field textarea:focus {
            border-color: #94a3b8 !important;
            box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.12) !important;
          }

          .po-edit-field input:disabled,
          .po-edit-field select:disabled,
          .po-edit-field textarea:disabled {
            background: #f8fafc !important;
            color: #94a3b8 !important;
            cursor: not-allowed !important;
          }

          .po-edit-add-product-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 130px auto;
            gap: 12px;
            padding: 20px 22px;
            border-bottom: 1px solid #e5e7eb;
            align-items: end;
          }

          .po-edit-quantity-field {
            width: 130px;
          }

          .po-edit-add-button {
            width: auto !important;
            min-width: 135px !important;
            height: 40px !important;
            min-height: 40px !important;
            padding: 0 16px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            border: 1px solid #0f172a !important;
            border-radius: 9px !important;
            background: #0f172a !important;
            color: #ffffff !important;
            font-family: inherit !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
            cursor: pointer !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            box-shadow: none !important;
            text-decoration: none !important;
          }

          .po-edit-add-button:hover:not(:disabled) {
            background: #1e293b !important;
            border-color: #1e293b !important;
          }

          .po-edit-add-button:disabled {
            opacity: 0.45 !important;
            cursor: not-allowed !important;
          }

          .po-edit-product-preview {
            margin: 0 22px 18px;
            padding: 13px 15px;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            border: 1px solid #e5e7eb;
            background: #f8fafc;
            border-radius: 10px;
          }

          .po-edit-product-preview span {
            display: block;
            margin-bottom: 4px;
            color: #94a3b8;
            font-size: 11px;
            font-weight: 700;
          }

          .po-edit-product-preview strong {
            color: #334155;
            font-size: 12px;
          }

          .po-edit-table-wrapper {
            width: 100%;
            overflow-x: auto;
          }

          .po-edit-table {
            width: 100%;
            min-width: 1050px;
            border-collapse: collapse;
          }

          .po-edit-table th {
            padding: 12px 16px;
            background: #f8fafc !important;
            color: #64748b !important;
            text-align: left;
            font-size: 11px !important;
            font-weight: 800 !important;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            white-space: nowrap;
          }

          .po-edit-table td {
            padding: 14px 16px;
            border-top: 1px solid #eef2f7 !important;
            background: #ffffff !important;
            color: #334155 !important;
            font-size: 13px;
            vertical-align: middle;
          }

          .po-edit-product-name {
            color: #0f172a;
            font-size: 13px;
            font-weight: 700;
          }

          .po-edit-variant {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 11px;
          }

          .po-edit-sku {
            color: #64748b;
            font-size: 12px;
          }

          .po-edit-received {
            color: #0f172a;
            font-size: 13px;
            font-weight: 700;
          }

          .po-edit-table-input {
            width: 90px !important;
            height: 36px !important;
            min-height: 36px !important;
            box-sizing: border-box !important;
            padding: 0 9px !important;
            border: 1px solid #dbe1e8 !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: inherit !important;
            font-size: 12px !important;
            outline: none !important;
            box-shadow: none !important;
          }

          .po-edit-table-input:focus {
            border-color: #94a3b8 !important;
            box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.12) !important;
          }

          .po-edit-table-input:disabled {
            background: #f8fafc !important;
            color: #94a3b8 !important;
          }

          .po-edit-qty-input {
            width: 75px !important;
          }

          .po-edit-line-total {
            color: #0f172a;
            font-size: 13px;
            white-space: nowrap;
          }

          .po-edit-remove-button {
            width: 32px !important;
            height: 32px !important;
            min-width: 32px !important;
            min-height: 32px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            border: 1px solid #fecaca !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            color: #dc2626 !important;
            font-family: inherit !important;
            font-size: 18px !important;
            line-height: 1 !important;
            cursor: pointer !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            box-shadow: none !important;
          }

          .po-edit-remove-button:hover:not(:disabled) {
            background: #fef2f2 !important;
            border-color: #fca5a5 !important;
          }

          .po-edit-remove-button:disabled {
            opacity: 0.35 !important;
            cursor: not-allowed !important;
          }

          .po-edit-empty {
            padding: 55px 20px;
            text-align: center;
          }

          .po-edit-empty-icon {
            width: 42px;
            height: 42px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
            border-radius: 12px;
            background: #f1f5f9;
            color: #64748b;
            font-size: 24px;
          }

          .po-edit-empty h3 {
            margin: 0 0 5px;
            color: #0f172a;
            font-size: 15px;
            font-weight: 800;
          }

          .po-edit-empty p {
            margin: 0;
            color: #94a3b8;
            font-size: 12px;
          }

          .po-edit-notes-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
            padding: 22px;
          }

          .po-edit-summary-card {
            padding: 20px;
            overflow: visible;
          }

          .po-edit-summary-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
          }

          .po-edit-summary-eyebrow {
            margin-bottom: 4px;
            color: #94a3b8;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.08em;
          }

          .po-edit-summary-header h2 {
            margin: 0;
            color: #0f172a;
            font-size: 17px;
            font-weight: 800;
          }

          .po-edit-summary-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-top: 20px;
          }

          .po-edit-summary-stats > div {
            padding: 11px 8px;
            background: #f8fafc !important;
            border-radius: 9px;
            text-align: center;
          }

          .po-edit-summary-stats span {
            display: block;
            margin-bottom: 4px;
            color: #94a3b8;
            font-size: 10px;
            font-weight: 700;
          }

          .po-edit-summary-stats strong {
            color: #0f172a;
            font-size: 15px;
            font-weight: 800;
          }

          .po-edit-divider {
            height: 1px;
            margin: 18px 0;
            background: #e5e7eb;
          }

          .po-edit-summary-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 11px;
          }

          .po-edit-summary-row span {
            color: #64748b;
            font-size: 12px;
          }

          .po-edit-summary-row strong {
            color: #334155;
            font-size: 12px;
          }

          .po-edit-discount {
            color: #dc2626 !important;
          }

          .po-edit-summary-total {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }

          .po-edit-summary-total span {
            color: #0f172a;
            font-size: 14px;
            font-weight: 800;
          }

          .po-edit-summary-total strong {
            color: #0f172a;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.4px;
          }

          .po-edit-supplier-summary {
            margin-top: 20px;
            padding: 14px;
            background: #f8fafc !important;
            border: 1px solid #eef2f7 !important;
            border-radius: 10px;
          }

          .po-edit-supplier-title {
            margin-bottom: 12px;
            color: #334155;
            font-size: 12px;
            font-weight: 800;
          }

          .po-edit-supplier-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-top: 9px;
          }

          .po-edit-supplier-row span {
            color: #94a3b8;
            font-size: 11px;
          }

          .po-edit-supplier-row strong {
            color: #334155;
            font-size: 11px;
          }

          .po-edit-actions {
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
            margin-top: 22px !important;
            width: 100% !important;
          }

          .po-edit-save-button,
          .po-edit-cancel-button {
            width: 100% !important;
            height: 42px !important;
            min-height: 42px !important;
            max-height: 42px !important;
            box-sizing: border-box !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 16px !important;
            margin: 0 !important;
            border-radius: 9px !important;
            font-family: inherit !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
            text-align: center !important;
            text-decoration: none !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            box-shadow: none !important;
            outline: none !important;
            cursor: pointer !important;
          }

          .po-edit-save-button {
            background: #0f172a !important;
            border: 1px solid #0f172a !important;
            color: #ffffff !important;
          }

          .po-edit-save-button:hover:not(:disabled) {
            background: #1e293b !important;
            border-color: #1e293b !important;
            color: #ffffff !important;
          }

          .po-edit-save-button:disabled {
            opacity: 0.55 !important;
            cursor: not-allowed !important;
          }

          .po-edit-cancel-button {
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            color: #334155 !important;
          }

          .po-edit-cancel-button:hover:not(:disabled) {
            background: #f8fafc !important;
            border-color: #94a3b8 !important;
            color: #0f172a !important;
          }

          .po-edit-cancel-button:active:not(:disabled) {
            background: #f1f5f9 !important;
            transform: translateY(1px);
          }

          .po-edit-cancel-button:disabled {
            opacity: 0.55 !important;
            cursor: not-allowed !important;
          }

          /* VIEW PURCHASE ORDER — FULL BUTTON */

          .po-edit-view-button {
            width: 100% !important;
            height: 42px !important;
            min-height: 42px !important;
            max-height: 42px !important;
            box-sizing: border-box !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            padding: 0 14px !important;
            margin: 10px 0 0 0 !important;
            border: 1px solid #dbe1e8 !important;
            border-radius: 9px !important;
            background: #ffffff !important;
            color: #475569 !important;
            text-decoration: none !important;
            font-family: inherit !important;
            font-size: 12px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
            cursor: pointer !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            box-shadow: none !important;
            outline: none !important;
          }

          .po-edit-view-button:hover {
            background: #f8fafc !important;
            border-color: #cbd5e1 !important;
            color: #0f172a !important;
            text-decoration: none !important;
          }

          .po-edit-view-button:active {
            background: #f1f5f9 !important;
            transform: translateY(1px);
          }

          .po-edit-view-arrow {
            font-size: 15px !important;
            line-height: 1 !important;
            color: #64748b !important;
            transition: transform 0.15s ease;
          }

          .po-edit-view-button:hover
            .po-edit-view-arrow {
            transform: translateX(2px);
            color: #0f172a !important;
          }

          .po-edit-locked-alert {
            display: flex;
            flex-direction: column;
            gap: 3px;
            margin-bottom: 18px;
            padding: 13px 15px;
            border: 1px solid #fed7aa;
            border-radius: 10px;
            background: #fff7ed;
            color: #9a3412;
            font-size: 12px;
          }

          .po-edit-alert {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 18px;
            padding: 12px 14px;
            border-radius: 9px;
            font-size: 12px;
          }

          .po-edit-alert-error {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #b91c1c;
          }

          .po-edit-alert-success {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #15803d;
          }

          @media (max-width: 1150px) {
            .po-edit-layout {
              grid-template-columns: minmax(0, 1fr) 300px;
            }

            .po-edit-add-product-row {
              grid-template-columns: minmax(0, 1fr) 110px auto;
            }

            .po-edit-product-preview {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 900px) {
            .po-edit-layout {
              grid-template-columns: 1fr;
            }

            .po-edit-summary-column {
              position: static;
            }
          }

          @media (max-width: 700px) {
            .po-edit-page {
              padding: 20px 14px;
            }

            .po-edit-title-row h1 {
              font-size: 23px;
            }

            .po-edit-form-grid,
            .po-edit-notes-grid {
              grid-template-columns: 1fr;
            }

            .po-edit-add-product-row {
              grid-template-columns: 1fr;
              align-items: stretch;
            }

            .po-edit-quantity-field {
              width: 100%;
            }

            .po-edit-add-button {
              width: 100% !important;
            }

            .po-edit-product-preview {
              grid-template-columns: repeat(2, 1fr);
              margin-left: 14px;
              margin-right: 14px;
            }

            .po-edit-card-header {
              padding: 18px;
            }

            .po-edit-form-grid,
            .po-edit-notes-grid {
              padding: 18px;
            }
          }

          @media (max-width: 480px) {
            .po-edit-page {
              padding: 16px 10px;
            }

            .po-edit-product-preview {
              grid-template-columns: 1fr;
            }

            .po-edit-summary-card {
              padding: 16px;
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}