import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/app/components/print-button";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type StockReceipt = {
  id: string;
  company_id: string;
  receipt_number: string;
  supplier_name: string | null;
  reference_number: string | null;
  notes: string | null;
  status: string | null;
  received_by: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  purchase_order_id: string | null;
};

type StockReceiptItem = {
  id: string;
  company_id: string;
  receipt_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_cost: number;
  created_at: string;
  warehouse_id: string | null;
  location_id: string | null;
  purchase_order_item_id: string | null;
  batch_id: string | null;
};

type Product = {
  id: string;
  name: string;
  tracking_mode: string | null;
  category: string | null;
  brand: string | null;
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
};

type Warehouse = {
  id: string;
  name: string;
  code: string | null;
};

type WarehouseLocation = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string | null;
  location_type: string | null;
};

type InventoryBatch = {
  id: string;
  company_id: string;
  product_id: string;
  variant_id: string | null;
  lot_number: string;
  supplier_id: string | null;
  purchase_order_id: string | null;
  purchase_order_item_id: string | null;
  stock_receipt_id: string | null;
  stock_receipt_item_id: string | null;
  received_at: string | null;
  quantity_received: number;
  unit_cost: number;
  landed_cost_total: number;
  refurbishment_cost_total: number;
  other_cost_total: number;
  total_cost: number;
  status: string | null;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  status: string | null;
  currency: string | null;
  order_date: string | null;
  expected_date: string | null;
  supplier_id: string | null;
  warehouse_id: string | null;
  total_amount: number | null;
};

type Supplier = {
  id: string;
  legal_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
};

type PurchaseOrderItem = {
  id: string;
  product_name: string | null;
  variant_name: string | null;
  sku: string | null;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
};

type SerializedUnit = {
  id: string;
  company_id: string;
  product_id: string;
  variant_id: string | null;
  serial_number: string;
  barcode: string | null;
  status: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  batch_id: string | null;
  purchase_order_id: string | null;
  purchase_order_item_id: string | null;
  received_at: string | null;
  cost_price: number | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(
  value: number | null | undefined,
  currency = "USD",
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(Number(value ?? 0));
}

function titleCase(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClasses(status: string | null | undefined) {
  const normalized = String(status ?? "").toLowerCase();

  if (
    normalized === "received" ||
    normalized === "completed" ||
    normalized === "posted"
  ) {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "#bbf7d0",
    };
  }

  if (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "rejected"
  ) {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fecaca",
    };
  }

  if (
    normalized === "pending" ||
    normalized === "draft" ||
    normalized === "processing"
  ) {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "#fde68a",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#374151",
    border: "#e5e7eb",
  };
}

export default async function StockReceiptDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: memberships, error: membershipError } =
    await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id);

  if (membershipError || !memberships?.length) {
    notFound();
  }

  const companyIds = memberships.map(
    (membership) => membership.company_id,
  );

  const { data: receipt, error: receiptError } =
    await supabase
      .from("stock_receipts")
      .select(`
        id,
        company_id,
        receipt_number,
        supplier_name,
        reference_number,
        notes,
        status,
        received_by,
        received_at,
        created_at,
        updated_at,
        purchase_order_id
      `)
      .eq("id", id)
      .in("company_id", companyIds)
      .maybeSingle();

  if (receiptError || !receipt) {
    notFound();
  }

  const companyId = receipt.company_id;

  const [
    receiptItemsResult,
    purchaseOrderResult,
    batchesResult,
  ] = await Promise.all([
    supabase
      .from("stock_receipt_items")
      .select(`
        id,
        company_id,
        receipt_id,
        product_id,
        variant_id,
        quantity,
        unit_cost,
        created_at,
        warehouse_id,
        location_id,
        purchase_order_item_id,
        batch_id
      `)
      .eq("company_id", companyId)
      .eq("receipt_id", receipt.id)
      .order("created_at", { ascending: true }),

    receipt.purchase_order_id
      ? supabase
          .from("purchase_orders")
          .select(`
            id,
            po_number,
            status,
            currency,
            order_date,
            expected_date,
            supplier_id,
            warehouse_id,
            total_amount
          `)
          .eq("company_id", companyId)
          .eq("id", receipt.purchase_order_id)
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null,
        }),

    supabase
      .from("inventory_batches")
      .select(`
        id,
        company_id,
        product_id,
        variant_id,
        lot_number,
        supplier_id,
        purchase_order_id,
        purchase_order_item_id,
        stock_receipt_id,
        stock_receipt_item_id,
        received_at,
        quantity_received,
        unit_cost,
        landed_cost_total,
        refurbishment_cost_total,
        other_cost_total,
        total_cost,
        status
      `)
      .eq("company_id", companyId)
      .eq("stock_receipt_id", receipt.id)
      .order("created_at", { ascending: true }),
  ]);

  if (receiptItemsResult.error) {
    throw new Error(receiptItemsResult.error.message);
  }

  if (purchaseOrderResult.error) {
    throw new Error(
      purchaseOrderResult.error.message,
    );
  }

  if (batchesResult.error) {
    throw new Error(batchesResult.error.message);
  }

  const receiptItems =
    (receiptItemsResult.data as StockReceiptItem[] | null) ??
    [];

  const purchaseOrder =
    (purchaseOrderResult.data as PurchaseOrder | null) ??
    null;

  const batches =
    (batchesResult.data as InventoryBatch[] | null) ??
    [];

  const productIds = Array.from(
    new Set(
      receiptItems.map((item) => item.product_id),
    ),
  );

  const variantIds = Array.from(
    new Set(
      receiptItems
        .map((item) => item.variant_id)
        .filter(Boolean) as string[],
    ),
  );

  const warehouseIds = Array.from(
    new Set(
      receiptItems
        .map((item) => item.warehouse_id)
        .filter(Boolean) as string[],
    ),
  );

  const locationIds = Array.from(
    new Set(
      receiptItems
        .map((item) => item.location_id)
        .filter(Boolean) as string[],
    ),
  );

  const purchaseOrderItemIds = Array.from(
    new Set(
      receiptItems
        .map((item) => item.purchase_order_item_id)
        .filter(Boolean) as string[],
    ),
  );

  const [
    productsResult,
    variantsResult,
    warehousesResult,
    locationsResult,
    purchaseOrderItemsResult,
    supplierResult,
  ] = await Promise.all([
    productIds.length
      ? supabase
          .from("products")
          .select(`
            id,
            name,
            tracking_mode,
            category,
            brand
          `)
          .eq("company_id", companyId)
          .in("id", productIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    variantIds.length
      ? supabase
          .from("product_variants")
          .select(`
            id,
            product_id,
            name,
            sku
          `)
          .eq("company_id", companyId)
          .in("id", variantIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    warehouseIds.length
      ? supabase
          .from("warehouses")
          .select("id, name, code")
          .eq("company_id", companyId)
          .in("id", warehouseIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    locationIds.length
      ? supabase
          .from("warehouse_locations")
          .select(`
            id,
            warehouse_id,
            name,
            code,
            location_type
          `)
          .eq("company_id", companyId)
          .in("id", locationIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    purchaseOrderItemIds.length
      ? supabase
          .from("purchase_order_items")
          .select(`
            id,
            product_name,
            variant_name,
            sku,
            quantity,
            received_quantity,
            unit_cost
          `)
          .eq("company_id", companyId)
          .in("id", purchaseOrderItemIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    purchaseOrder?.supplier_id
      ? supabase
          .from("suppliers")
          .select(`
            id,
            legal_name,
            display_name,
            email,
            phone
          `)
          .eq("company_id", companyId)
          .eq("id", purchaseOrder.supplier_id)
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null,
        }),
  ]);

  if (productsResult.error) {
    throw new Error(productsResult.error.message);
  }

  if (variantsResult.error) {
    throw new Error(variantsResult.error.message);
  }

  if (warehousesResult.error) {
    throw new Error(warehousesResult.error.message);
  }

  if (locationsResult.error) {
    throw new Error(locationsResult.error.message);
  }

  if (purchaseOrderItemsResult.error) {
    throw new Error(
      purchaseOrderItemsResult.error.message,
    );
  }

  if (supplierResult.error) {
    throw new Error(supplierResult.error.message);
  }

  const products =
    (productsResult.data as Product[] | null) ?? [];

  const variants =
    (variantsResult.data as ProductVariant[] | null) ??
    [];

  const warehouses =
    (warehousesResult.data as Warehouse[] | null) ?? [];

  const locations =
    (locationsResult.data as WarehouseLocation[] | null) ??
    [];

  const purchaseOrderItems =
    (purchaseOrderItemsResult.data as PurchaseOrderItem[] | null) ??
    [];

  const supplier =
    (supplierResult.data as Supplier | null) ?? null;

  const productMap = new Map(
    products.map((product) => [
      product.id,
      product,
    ]),
  );

  const variantMap = new Map(
    variants.map((variant) => [
      variant.id,
      variant,
    ]),
  );

  const warehouseMap = new Map(
    warehouses.map((warehouse) => [
      warehouse.id,
      warehouse,
    ]),
  );

  const locationMap = new Map(
    locations.map((location) => [
      location.id,
      location,
    ]),
  );

  const batchMap = new Map(
    batches.map((batch) => [
      batch.id,
      batch,
    ]),
  );

  const totalReceivedQuantity = receiptItems.reduce(
    (sum, item) =>
      sum + Number(item.quantity ?? 0),
    0,
  );

  const totalReceiptValue = receiptItems.reduce(
    (sum, item) =>
      sum +
      Number(item.quantity ?? 0) *
        Number(item.unit_cost ?? 0),
    0,
  );

  const totalBatchCost = batches.reduce(
    (sum, batch) =>
      sum + Number(batch.total_cost ?? 0),
    0,
  );

  const totalLandedCost = batches.reduce(
    (sum, batch) =>
      sum +
      Number(batch.landed_cost_total ?? 0),
    0,
  );

  const totalRefurbishmentCost =
    batches.reduce(
      (sum, batch) =>
        sum +
        Number(
          batch.refurbishment_cost_total ?? 0,
        ),
      0,
    );

  const totalOtherCost = batches.reduce(
    (sum, batch) =>
      sum +
      Number(batch.other_cost_total ?? 0),
    0,
  );

  /*
   * Only fetch serialized units when the receipt actually
   * contains serialized batches. This avoids the previous
   * timestamp-based query that could accidentally pick up
   * unrelated units.
   */
  const serializedBatchIds = batches.map(
    (batch) => batch.id,
  );

  let serializedUnits: SerializedUnit[] = [];

  if (serializedBatchIds.length) {
    const serializedResult = await supabase
      .from("serialized_units")
      .select(`
        id,
        company_id,
        product_id,
        variant_id,
        serial_number,
        barcode,
        status,
        warehouse_id,
        location_id,
        batch_id,
        purchase_order_id,
        purchase_order_item_id,
        received_at,
        cost_price
      `)
      .eq("company_id", companyId)
      .in("batch_id", serializedBatchIds)
      .order("received_at", {
        ascending: true,
      });

    if (serializedResult.error) {
      throw new Error(
        serializedResult.error.message,
      );
    }

    serializedUnits =
      (serializedResult.data as SerializedUnit[] | null) ??
      [];
  }

  const currency =
    purchaseOrder?.currency || "USD";

  const receiptStatusStyles =
    getStatusClasses(receipt.status);

  const receivedDate =
    receipt.received_at ||
    receipt.created_at;

  return (
    <>
      <main className="sbs-receipt-page page-content">
        <div className="page-shell">
          <div className="breadcrumb-row">
            <Link
              href="/inventory"
              className="breadcrumb-link"
            >
              Inventory
            </Link>

            <span className="breadcrumb-separator">
              /
            </span>

            <Link
              href="/inventory/receiving"
              className="breadcrumb-link"
            >
              Receiving
            </Link>

            <span className="breadcrumb-separator">
              /
            </span>

            <span className="breadcrumb-current">
              {receipt.receipt_number}
            </span>
          </div>

          <section className="hero-card">
            <div className="hero-main">
              <div className="hero-title-row">
                <div>
                  <div className="eyebrow">
                    GOODS RECEIPT NOTE
                  </div>

                  <h1>
                    {receipt.receipt_number}
                  </h1>

                  <p className="hero-subtitle">
                    Stock received into inventory from a
                    purchase order.
                  </p>
                </div>

                <span
                  className="status-badge"
                  style={{
                    background:
                      receiptStatusStyles.background,
                    color:
                      receiptStatusStyles.color,
                    borderColor:
                      receiptStatusStyles.border,
                  }}
                >
                  {titleCase(
                    receipt.status || "received",
                  )}
                </span>
              </div>

              <div className="hero-meta-grid">
                <div>
                  <span>Received</span>

                  <strong>
                    {formatDateTime(receivedDate)}
                  </strong>
                </div>

                <div>
                  <span>Supplier</span>

                  <strong>
                    {supplier?.display_name ||
                      supplier?.legal_name ||
                      receipt.supplier_name ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>Purchase Order</span>

                  {purchaseOrder ? (
                    <Link
                      href={`/purchase-orders/${purchaseOrder.id}`}
                      className="inline-link"
                    >
                      {purchaseOrder.po_number}
                    </Link>
                  ) : (
                    <strong>—</strong>
                  )}
                </div>

                <div>
                  <span>Reference</span>

                  <strong>
                    {receipt.reference_number ||
                      "—"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="hero-actions">
              {purchaseOrder ? (
                <Link
                  href={`/purchase-orders/${purchaseOrder.id}`}
                  className="secondary-button"
                >
                  View Purchase Order
                </Link>
              ) : null}

              <PrintButton label="Print GRN" />
            </div>
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">
                Received Units
              </div>

              <div className="stat-value">
                {formatNumber(
                  totalReceivedQuantity,
                )}
              </div>

              <div className="stat-description">
                Total quantity on this receipt
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                Receipt Value
              </div>

              <div className="stat-value">
                {formatMoney(
                  totalReceiptValue,
                  currency,
                )}
              </div>

              <div className="stat-description">
                Quantity × receiving unit cost
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                Batches / Lots
              </div>

              <div className="stat-value">
                {batches.length}
              </div>

              <div className="stat-description">
                Inventory cost boundaries created
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                Serialized Units
              </div>

              <div className="stat-value">
                {serializedUnits.length}
              </div>

              <div className="stat-description">
                Individual manufacturer serials received
              </div>
            </div>
          </section>

          <div className="two-column-layout">
            <section className="content-card">
              <div className="card-header">
                <div>
                  <h2>Receipt Items</h2>

                  <p>
                    Products and quantities recorded against
                    this GRN.
                  </p>
                </div>

                <span className="count-badge">
                  {receiptItems.length} lines
                </span>
              </div>

              <div className="table-wrapper">
                {receiptItems.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-title">
                      No receipt items
                    </div>

                    <div className="empty-description">
                      This receipt does not contain any item
                      lines.
                    </div>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Tracking</th>
                        <th>Batch / Lot</th>
                        <th>Warehouse</th>
                        <th>Location</th>
                        <th>Qty</th>
                        <th>Unit Cost</th>
                        <th>Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {receiptItems.map((item) => {
                        const product =
                          productMap.get(
                            item.product_id,
                          );

                        const variant =
                          item.variant_id
                            ? variantMap.get(
                                item.variant_id,
                              )
                            : null;

                        const batch =
                          item.batch_id
                            ? batchMap.get(
                                item.batch_id,
                              )
                            : null;

                        const warehouse =
                          item.warehouse_id
                            ? warehouseMap.get(
                                item.warehouse_id,
                              )
                            : null;

                        const location =
                          item.location_id
                            ? locationMap.get(
                                item.location_id,
                              )
                            : null;

                        const lineTotal =
                          Number(
                            item.quantity ?? 0,
                          ) *
                          Number(
                            item.unit_cost ?? 0,
                          );

                        return (
                          <tr key={item.id}>
                            <td>
                              <div className="cell-primary">
                                {product?.name ||
                                  "Unknown Product"}
                              </div>

                              <div className="cell-secondary">
                                {variant?.name ||
                                  variant?.sku ||
                                  "Default Variant"}
                              </div>
                            </td>

                            <td>
                              <span className="tracking-badge">
                                {titleCase(
                                  product?.tracking_mode ||
                                    "none",
                                )}
                              </span>
                            </td>

                            <td>
                              {batch ? (
                                <Link
                                  href={`/inventory/batches/${batch.id}`}
                                  className="inline-link"
                                >
                                  {batch.lot_number}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td>
                              <div className="cell-primary">
                                {warehouse?.name ||
                                  "—"}
                              </div>

                              {warehouse?.code ? (
                                <div className="cell-secondary">
                                  {warehouse.code}
                                </div>
                              ) : null}
                            </td>

                            <td>
                              <div className="cell-primary">
                                {location?.name ||
                                  "—"}
                              </div>

                              {location?.code ? (
                                <div className="cell-secondary">
                                  {location.code}
                                </div>
                              ) : null}
                            </td>

                            <td className="numeric-cell">
                              {formatNumber(
                                item.quantity,
                              )}
                            </td>

                            <td className="numeric-cell">
                              {formatMoney(
                                item.unit_cost,
                                currency,
                              )}
                            </td>

                            <td className="numeric-cell strong-number">
                              {formatMoney(
                                lineTotal,
                                currency,
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section className="content-card">
              <div className="card-header">
                <div>
                  <h2>
                    Receiving Information
                  </h2>

                  <p>
                    Operational details for this receipt.
                  </p>
                </div>
              </div>

              <div className="detail-list">
                <div className="detail-row">
                  <span>Receipt Number</span>

                  <strong>
                    {receipt.receipt_number}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Status</span>

                  <span
                    className="status-badge small"
                    style={{
                      background:
                        receiptStatusStyles.background,
                      color:
                        receiptStatusStyles.color,
                      borderColor:
                        receiptStatusStyles.border,
                    }}
                  >
                    {titleCase(
                      receipt.status ||
                        "received",
                    )}
                  </span>
                </div>

                <div className="detail-row">
                  <span>Received Date</span>

                  <strong>
                    {formatDate(
                      receipt.received_at,
                    )}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Created</span>

                  <strong>
                    {formatDateTime(
                      receipt.created_at,
                    )}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Reference</span>

                  <strong>
                    {receipt.reference_number ||
                      "—"}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Supplier</span>

                  <strong>
                    {supplier?.display_name ||
                      supplier?.legal_name ||
                      receipt.supplier_name ||
                      "—"}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Supplier Email</span>

                  <strong>
                    {supplier?.email || "—"}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Supplier Phone</span>

                  <strong>
                    {supplier?.phone || "—"}
                  </strong>
                </div>
              </div>
            </section>
          </div>

          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Batch / Lot Creation</h2>

                <p>
                  Inventory batches created when this receipt
                  was posted.
                </p>
              </div>

              <span className="count-badge">
                {batches.length} batches
              </span>
            </div>

            <div className="table-wrapper">
              {batches.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-title">
                    No batches recorded
                  </div>

                  <div className="empty-description">
                    No inventory batch was linked to this
                    receipt.
                  </div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Lot Number</th>
                      <th>Received Qty</th>
                      <th>Unit Cost</th>
                      <th>Landed</th>
                      <th>Refurbishment</th>
                      <th>Other</th>
                      <th>Total Cost</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {batches.map((batch) => {
                      const product =
                        productMap.get(
                          batch.product_id,
                        );

                      const variant =
                        batch.variant_id
                          ? variantMap.get(
                              batch.variant_id,
                            )
                          : null;

                      const batchStatusStyles =
                        getStatusClasses(
                          batch.status,
                        );

                      return (
                        <tr key={batch.id}>
                          <td>
                            <div className="cell-primary">
                              {product?.name ||
                                "Unknown Product"}
                            </div>

                            <div className="cell-secondary">
                              {variant?.name ||
                                variant?.sku ||
                                "Default Variant"}
                            </div>
                          </td>

                          <td>
                            <Link
                              href={`/inventory/batches/${batch.id}`}
                              className="inline-link"
                            >
                              {batch.lot_number}
                            </Link>
                          </td>

                          <td className="numeric-cell">
                            {formatNumber(
                              batch.quantity_received,
                            )}
                          </td>

                          <td className="numeric-cell">
                            {formatMoney(
                              batch.unit_cost,
                              currency,
                            )}
                          </td>

                          <td className="numeric-cell">
                            {formatMoney(
                              batch.landed_cost_total,
                              currency,
                            )}
                          </td>

                          <td className="numeric-cell">
                            {formatMoney(
                              batch.refurbishment_cost_total,
                              currency,
                            )}
                          </td>

                          <td className="numeric-cell">
                            {formatMoney(
                              batch.other_cost_total,
                              currency,
                            )}
                          </td>

                          <td className="numeric-cell strong-number">
                            {formatMoney(
                              batch.total_cost,
                              currency,
                            )}
                          </td>

                          <td>
                            <span
                              className="status-badge small"
                              style={{
                                background:
                                  batchStatusStyles.background,
                                color:
                                  batchStatusStyles.color,
                                borderColor:
                                  batchStatusStyles.border,
                              }}
                            >
                              {titleCase(
                                batch.status,
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>Serialized Units</h2>

                <p>
                  Individual manufacturer serial numbers created
                  from this receiving transaction.
                </p>
              </div>

              <span className="count-badge">
                {serializedUnits.length} units
              </span>
            </div>

            <div className="table-wrapper">
              {serializedUnits.length === 0 ? (
                <div className="empty-state compact">
                  <div className="empty-title">
                    No serialized units
                  </div>

                  <div className="empty-description">
                    This receipt did not create individually
                    serialized inventory units.
                  </div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Serial Number</th>
                      <th>Barcode</th>
                      <th>Batch / Lot</th>
                      <th>Status</th>
                      <th>Warehouse</th>
                      <th>Location</th>
                      <th>Cost</th>
                    </tr>
                  </thead>

                  <tbody>
                    {serializedUnits.map((unit) => {
                      const product =
                        productMap.get(
                          unit.product_id,
                        );

                      const variant =
                        unit.variant_id
                          ? variantMap.get(
                              unit.variant_id,
                            )
                          : null;

                      const batch =
                        unit.batch_id
                          ? batchMap.get(
                              unit.batch_id,
                            )
                          : null;

                      const warehouse =
                        unit.warehouse_id
                          ? warehouseMap.get(
                              unit.warehouse_id,
                            )
                          : null;

                      const location =
                        unit.location_id
                          ? locationMap.get(
                              unit.location_id,
                            )
                          : null;

                      const unitStatusStyles =
                        getStatusClasses(
                          unit.status,
                        );

                      return (
                        <tr key={unit.id}>
                          <td>
                            <div className="cell-primary">
                              {product?.name ||
                                "Unknown Product"}
                            </div>

                            <div className="cell-secondary">
                              {variant?.name ||
                                variant?.sku ||
                                "Default Variant"}
                            </div>
                          </td>

                          <td>
                            <Link
                              href={`/inventory/serial-numbers/${unit.id}`}
                              className="inline-link"
                            >
                              {unit.serial_number}
                            </Link>
                          </td>

                          <td>
                            {unit.barcode || "—"}
                          </td>

                          <td>
                            {batch ? (
                              <Link
                                href={`/inventory/batches/${batch.id}`}
                                className="inline-link"
                              >
                                {batch.lot_number}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td>
                            <span
                              className="status-badge small"
                              style={{
                                background:
                                  unitStatusStyles.background,
                                color:
                                  unitStatusStyles.color,
                                borderColor:
                                  unitStatusStyles.border,
                              }}
                            >
                              {titleCase(
                                unit.status,
                              )}
                            </span>
                          </td>

                          <td>
                            {warehouse?.name || "—"}
                          </td>

                          <td>
                            {location?.name || "—"}
                          </td>

                          <td className="numeric-cell">
                            {formatMoney(
                              unit.cost_price,
                              currency,
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <div className="two-column-layout">
            <section className="content-card">
              <div className="card-header">
                <div>
                  <h2>Cost Summary</h2>

                  <p>
                    Cost captured when stock was received.
                  </p>
                </div>
              </div>

              <div className="detail-list">
                <div className="detail-row">
                  <span>
                    Base Inventory Cost
                  </span>

                  <strong>
                    {formatMoney(
                      totalBatchCost -
                        totalLandedCost -
                        totalRefurbishmentCost -
                        totalOtherCost,
                      currency,
                    )}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Landed Cost</span>

                  <strong>
                    {formatMoney(
                      totalLandedCost,
                      currency,
                    )}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>
                    Refurbishment Cost
                  </span>

                  <strong>
                    {formatMoney(
                      totalRefurbishmentCost,
                      currency,
                    )}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Other Cost</span>

                  <strong>
                    {formatMoney(
                      totalOtherCost,
                      currency,
                    )}
                  </strong>
                </div>

                <div className="detail-row total-row">
                  <span>
                    Total Inventory Cost
                  </span>

                  <strong>
                    {formatMoney(
                      totalBatchCost,
                      currency,
                    )}
                  </strong>
                </div>
              </div>
            </section>

            <section className="content-card">
              <div className="card-header">
                <div>
                  <h2>
                    Purchase Order Context
                  </h2>

                  <p>
                    Source transaction for this inventory
                    receipt.
                  </p>
                </div>
              </div>

              {purchaseOrder ? (
                <div className="detail-list">
                  <div className="detail-row">
                    <span>PO Number</span>

                    <Link
                      href={`/purchase-orders/${purchaseOrder.id}`}
                      className="inline-link"
                    >
                      {purchaseOrder.po_number}
                    </Link>
                  </div>

                  <div className="detail-row">
                    <span>PO Status</span>

                    <strong>
                      {titleCase(
                        purchaseOrder.status,
                      )}
                    </strong>
                  </div>

                  <div className="detail-row">
                    <span>Order Date</span>

                    <strong>
                      {formatDate(
                        purchaseOrder.order_date,
                      )}
                    </strong>
                  </div>

                  <div className="detail-row">
                    <span>Expected Date</span>

                    <strong>
                      {formatDate(
                        purchaseOrder.expected_date,
                      )}
                    </strong>
                  </div>

                  <div className="detail-row">
                    <span>PO Total</span>

                    <strong>
                      {formatMoney(
                        purchaseOrder.total_amount,
                        currency,
                      )}
                    </strong>
                  </div>

                  <div className="detail-row">
                    <span>Receipt Lines</span>

                    <strong>
                      {receiptItems.length}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="empty-state compact">
                  <div className="empty-title">
                    No purchase order linked
                  </div>

                  <div className="empty-description">
                    This GRN was created without a linked
                    purchase order.
                  </div>
                </div>
              )}
            </section>
          </div>

          {receipt.notes ? (
            <section className="content-card">
              <div className="card-header">
                <div>
                  <h2>Receiving Notes</h2>

                  <p>
                    Notes recorded when the stock was received.
                  </p>
                </div>
              </div>

              <div className="notes-box">
                {receipt.notes}
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <style>{`
        .sbs-receipt-page {
          padding: 28px;
        }

        .sbs-receipt-page .page-shell {
          max-width: 1600px;
          margin: 0 auto;
        }

        .sbs-receipt-page .breadcrumb-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 18px;
          font-size: 13px;
          color: #6b7280;
        }

        .sbs-receipt-page .breadcrumb-link {
          color: #4b5563;
          text-decoration: none;
        }

        .sbs-receipt-page .breadcrumb-link:hover {
          color: #111827;
        }

        .sbs-receipt-page .breadcrumb-separator {
          color: #9ca3af;
        }

        .sbs-receipt-page .breadcrumb-current {
          color: #111827;
          font-weight: 600;
        }

        .sbs-receipt-page .hero-card {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          padding: 28px;
          margin-bottom: 20px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .sbs-receipt-page .hero-main {
          min-width: 0;
          flex: 1;
        }

        .sbs-receipt-page .hero-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        .sbs-receipt-page .eyebrow {
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #6b7280;
        }

        .sbs-receipt-page h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.15;
          color: #111827;
          font-weight: 700;
        }

        .sbs-receipt-page .hero-subtitle {
          margin: 8px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .sbs-receipt-page .hero-meta-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 22px;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #f0f0f0;
        }

        .sbs-receipt-page .hero-meta-grid div {
          min-width: 0;
        }

        .sbs-receipt-page .hero-meta-grid span {
          display: block;
          margin-bottom: 5px;
          font-size: 12px;
          color: #6b7280;
        }

        .sbs-receipt-page .hero-meta-grid strong {
          display: block;
          font-size: 14px;
          color: #111827;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sbs-receipt-page .hero-actions {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          flex-shrink: 0;
        }

        .sbs-receipt-page .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 14px;
          background: #ffffff;
          color: #111827;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
        }

        .sbs-receipt-page .secondary-button:hover {
          background: #f9fafb;
        }

        .sbs-receipt-page .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 0 10px;
          border: 1px solid transparent;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .sbs-receipt-page .status-badge.small {
          min-height: 24px;
          padding: 0 8px;
          font-size: 11px;
        }

        .sbs-receipt-page .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .sbs-receipt-page .stat-card {
          padding: 20px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .sbs-receipt-page .stat-label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 8px;
        }

        .sbs-receipt-page .stat-value {
          font-size: 24px;
          line-height: 1.15;
          font-weight: 700;
          color: #111827;
        }

        .sbs-receipt-page .stat-description {
          margin-top: 7px;
          font-size: 12px;
          color: #9ca3af;
        }

        .sbs-receipt-page .two-column-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(350px, 1fr);
          gap: 20px;
          margin-bottom: 20px;
        }

        .sbs-receipt-page .content-card {
          margin-bottom: 20px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          overflow: hidden;
        }

        .sbs-receipt-page .two-column-layout .content-card {
          margin-bottom: 0;
        }

        .sbs-receipt-page .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 22px;
          border-bottom: 1px solid #f0f0f0;
        }

        .sbs-receipt-page .card-header h2 {
          margin: 0;
          font-size: 16px;
          color: #111827;
          font-weight: 700;
        }

        .sbs-receipt-page .card-header p {
          margin: 5px 0 0;
          font-size: 12px;
          color: #6b7280;
        }

        .sbs-receipt-page .count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 26px;
          padding: 0 9px;
          border-radius: 999px;
          background: #f3f4f6;
          color: #4b5563;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .sbs-receipt-page .table-wrapper {
          overflow-x: auto;
        }

        .sbs-receipt-page .data-table {
          width: 100%;
          min-width: 1050px;
          border-collapse: collapse;
        }

        .sbs-receipt-page .data-table th {
          padding: 12px 16px;
          background: #fafafa;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-align: left;
          white-space: nowrap;
        }

        .sbs-receipt-page .data-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #f0f0f0;
          color: #374151;
          font-size: 13px;
          vertical-align: middle;
        }

        .sbs-receipt-page .data-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .sbs-receipt-page .data-table tbody tr:hover {
          background: #fafafa;
        }

        .sbs-receipt-page .cell-primary {
          color: #111827;
          font-weight: 600;
        }

        .sbs-receipt-page .cell-secondary {
          margin-top: 3px;
          color: #9ca3af;
          font-size: 11px;
        }

        .sbs-receipt-page .tracking-badge {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 8px;
          background: #f3f4f6;
          color: #4b5563;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
        }

        .sbs-receipt-page .numeric-cell {
          text-align: right !important;
          white-space: nowrap;
        }

        .sbs-receipt-page .strong-number {
          color: #111827 !important;
          font-weight: 700 !important;
        }

        .sbs-receipt-page .inline-link {
          color: #2563eb;
          text-decoration: none;
          font-weight: 600;
        }

        .sbs-receipt-page .inline-link:hover {
          text-decoration: underline;
        }

        .sbs-receipt-page .detail-list {
          padding: 4px 22px 14px;
        }

        .sbs-receipt-page .detail-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 14px 0;
          border-bottom: 1px solid #f0f0f0;
          font-size: 13px;
        }

        .sbs-receipt-page .detail-row:last-child {
          border-bottom: 0;
        }

        .sbs-receipt-page .detail-row > span:first-child {
          color: #6b7280;
        }

        .sbs-receipt-page .detail-row strong {
          color: #111827;
          font-weight: 600;
          text-align: right;
        }

        .sbs-receipt-page .total-row {
          margin-top: 4px;
          padding-top: 18px;
          border-top: 1px solid #e5e7eb;
          border-bottom: 0;
        }

        .sbs-receipt-page .total-row span:first-child,
        .sbs-receipt-page .total-row strong {
          color: #111827;
          font-weight: 700;
        }

        .sbs-receipt-page .notes-box {
          padding: 20px 22px;
          color: #374151;
          font-size: 14px;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        .sbs-receipt-page .empty-state {
          padding: 40px 24px;
          text-align: center;
        }

        .sbs-receipt-page .empty-state.compact {
          padding: 28px 20px;
        }

        .sbs-receipt-page .empty-title {
          color: #111827;
          font-size: 14px;
          font-weight: 700;
        }

        .sbs-receipt-page .empty-description {
          margin-top: 6px;
          color: #6b7280;
          font-size: 12px;
        }

        @media (max-width: 1200px) {
          .sbs-receipt-page .hero-card {
            flex-direction: column;
          }

          .sbs-receipt-page .hero-actions {
            align-items: center;
          }

          .sbs-receipt-page .hero-meta-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sbs-receipt-page .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sbs-receipt-page .two-column-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .sbs-receipt-page {
            padding: 18px;
          }

          .sbs-receipt-page .hero-card {
            padding: 20px;
          }

          .sbs-receipt-page .hero-title-row {
            flex-direction: column;
          }

          .sbs-receipt-page .hero-meta-grid {
            grid-template-columns: 1fr;
          }

          .sbs-receipt-page .hero-actions {
            width: 100%;
            flex-direction: column;
          }

          .sbs-receipt-page .hero-actions > * {
            width: 100%;
          }

          .sbs-receipt-page .stats-grid {
            grid-template-columns: 1fr;
          }
        }

        @media print {
          .sbs-receipt-page .breadcrumb-row,
          .sbs-receipt-page .hero-actions {
            display: none !important;
          }

          .sbs-receipt-page {
            padding: 0;
          }

          .sbs-receipt-page .hero-card,
          .sbs-receipt-page .stat-card,
          .sbs-receipt-page .content-card {
            box-shadow: none;
          }
        }
      `}</style>
    </>
  );
}