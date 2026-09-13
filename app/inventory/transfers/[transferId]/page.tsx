"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Transfer = {
  id: string;
  company_id: string;
  transfer_number: string;
  source_warehouse_id: string;
  source_location_id: string;
  destination_warehouse_id: string;
  destination_location_id: string;
  status: string;
  notes: string | null;
  created_by: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type TransferItem = {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  notes: string | null;
  batch_id: string | null;
  serial_unit_ids: string[] | null;
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  tracking_mode: string | null;
};

type Variant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
};

type Batch = {
  id: string;
  product_id: string;
  variant_id: string | null;
  lot_number: string;
  quantity_received: number;
  unit_cost: number | null;
  status: string | null;
};

type Warehouse = {
  id: string;
  name: string;
  code: string | null;
};

type Location = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string | null;
};

type SerializedUnit = {
  id: string;
  product_id: string;
  variant_id: string | null;
  batch_id: string | null;
  serial_number: string;
  barcode: string | null;
  status: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function normalizeSerialIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter((id): id is string => isValidUuid(id));
}

export default function TransferDetailPage() {
  const params = useParams();
  const router = useRouter();

  const rawTransferId = params?.transferId;

  const transferId = Array.isArray(rawTransferId)
    ? rawTransferId[0]
    : rawTransferId;

  const supabase = useMemo(() => createClient(), []);

  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [serialUnits, setSerialUnits] = useState<SerializedUnit[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      if (!isValidUuid(transferId)) {
        throw new Error("Invalid transfer ID.");
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

      if (!membership?.company_id || !isValidUuid(membership.company_id)) {
        throw new Error("Could not determine your company.");
      }

      const membershipCompanyId = membership.company_id;

      const [
        transferResult,
        itemsResult,
        productsResult,
        variantsResult,
        batchesResult,
        warehousesResult,
        locationsResult,
        serialResult,
      ] = await Promise.all([
        supabase
          .from("stock_transfers")
          .select(
            `
              id,
              company_id,
              transfer_number,
              source_warehouse_id,
              source_location_id,
              destination_warehouse_id,
              destination_location_id,
              status,
              notes,
              created_by,
              completed_by,
              created_at,
              updated_at,
              completed_at
            `,
          )
          .eq("company_id", membershipCompanyId)
          .eq("id", transferId)
          .maybeSingle(),

        supabase
          .from("stock_transfer_items")
          .select(
            `
              id,
              product_id,
              variant_id,
              quantity,
              notes,
              batch_id,
              serial_unit_ids
            `,
          )
          .eq("company_id", membershipCompanyId)
          .eq("transfer_id", transferId)
          .order("id"),

        supabase
          .from("products")
          .select("id,name,brand,category,tracking_mode")
          .eq("company_id", membershipCompanyId),

        supabase
          .from("product_variants")
          .select("id,product_id,name,sku")
          .eq("company_id", membershipCompanyId),

        supabase
          .from("inventory_batches")
          .select(
            "id,product_id,variant_id,lot_number,quantity_received,unit_cost,status",
          )
          .eq("company_id", membershipCompanyId)
          .neq("status", "cancelled"),

        supabase
          .from("warehouses")
          .select("id,name,code")
          .eq("company_id", membershipCompanyId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("warehouse_locations")
          .select("id,warehouse_id,name,code")
          .eq("company_id", membershipCompanyId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("serialized_units")
          .select(
            "id,product_id,variant_id,batch_id,serial_number,barcode,status",
          )
          .eq("company_id", membershipCompanyId),
      ]);

      if (transferResult.error) throw transferResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (productsResult.error) throw productsResult.error;
      if (variantsResult.error) throw variantsResult.error;
      if (batchesResult.error) throw batchesResult.error;
      if (warehousesResult.error) throw warehousesResult.error;
      if (locationsResult.error) throw locationsResult.error;
      if (serialResult.error) throw serialResult.error;

      if (!transferResult.data) {
        throw new Error("Transfer not found.");
      }

      const loadedTransfer = transferResult.data as Transfer;

      if (!isValidUuid(loadedTransfer.company_id)) {
        throw new Error("Transfer has an invalid company ID.");
      }

      setTransfer(loadedTransfer);
      setItems((itemsResult.data ?? []) as TransferItem[]);
      setProducts((productsResult.data ?? []) as Product[]);
      setVariants((variantsResult.data ?? []) as Variant[]);
      setBatches((batchesResult.data ?? []) as Batch[]);
      setWarehouses((warehousesResult.data ?? []) as Warehouse[]);
      setLocations((locationsResult.data ?? []) as Location[]);
      setSerialUnits((serialResult.data ?? []) as SerializedUnit[]);
    } catch (error: any) {
      console.error("Transfer load error:", error);
      setErrorMessage(error?.message || "Failed to load transfer.");
    } finally {
      setLoading(false);
    }
  }, [router, supabase, transferId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getProduct = (id: string) =>
    products.find((product) => product.id === id);

  const getVariant = (id: string | null) =>
    id ? variants.find((variant) => variant.id === id) : undefined;

  const getBatch = (id: string | null) =>
    id ? batches.find((batch) => batch.id === id) : undefined;

  const getWarehouse = (id: string) =>
    warehouses.find((warehouse) => warehouse.id === id);

  const getLocation = (id: string) =>
    locations.find((location) => location.id === id);

  const getSerials = (item: TransferItem) => {
    const ids = normalizeSerialIds(item.serial_unit_ids);

    return ids
      .map((id) => serialUnits.find((serial) => serial.id === id))
      .filter(Boolean) as SerializedUnit[];
  };

  const totalUnits = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  const totalSerials = items.reduce(
    (sum, item) => sum + normalizeSerialIds(item.serial_unit_ids).length,
    0,
  );

  const handleAction = async (
    action: "dispatch" | "receive" | "cancel",
  ) => {
    setErrorMessage("");

    if (!transfer) {
      setErrorMessage("Transfer data is not loaded.");
      return;
    }

    if (!isValidUuid(transfer.id)) {
      setErrorMessage("Invalid transfer ID.");
      return;
    }

    if (!isValidUuid(transfer.company_id)) {
      setErrorMessage("Invalid company ID on transfer.");
      return;
    }

    if (
      !isValidUuid(transfer.source_warehouse_id) ||
      !isValidUuid(transfer.source_location_id) ||
      !isValidUuid(transfer.destination_warehouse_id) ||
      !isValidUuid(transfer.destination_location_id)
    ) {
      setErrorMessage(
        "This transfer has an invalid warehouse or location ID. Please recreate the transfer.",
      );
      return;
    }

    setActionLoading(true);

    try {
      let rpcName:
        | "dispatch_stock_transfer"
        | "receive_stock_transfer"
        | "cancel_stock_transfer";

      if (action === "dispatch") {
        rpcName = "dispatch_stock_transfer";
      } else if (action === "receive") {
        rpcName = "receive_stock_transfer";
      } else {
        rpcName = "cancel_stock_transfer";
      }

      const rpcArgs: Record<string, unknown> = {
        p_company_id: transfer.company_id,
        p_transfer_id: transfer.id,
      };

      if (action === "cancel") {
        rpcArgs.p_reason = "Cancelled from transfer detail.";
      }

      console.log("Transfer RPC:", rpcName, rpcArgs);

      const { error } = await supabase.rpc(rpcName, rpcArgs);

      if (error) {
        throw new Error(error.message);
      }

      await loadData();
    } catch (error: any) {
      console.error("Transfer action error:", error);

      const message = error?.message || "Transfer action failed.";

      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="loading-card">Loading transfer...</div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .inventory-page {
              max-width: 1600px;
              margin: 0 auto;
            }

            .loading-card {
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              padding: 40px;
              color: #64748b;
              text-align: center;
            }
          `}</style>
        </div>
      </AppShell>
    );
  }

  if (!transfer) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="error-card">
            {errorMessage || "Transfer not found."}
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .inventory-page {
              max-width: 1600px;
              margin: 0 auto;
            }

            .error-card {
              background: #ffffff;
              border: 1px solid #fecaca;
              border-radius: 14px;
              padding: 24px;
              color: #991b1b;
            }
          `}</style>
        </div>
      </AppShell>
    );
  }

  const sourceWarehouse = getWarehouse(transfer.source_warehouse_id);
  const sourceLocation = getLocation(transfer.source_location_id);

  const destinationWarehouse = getWarehouse(
    transfer.destination_warehouse_id,
  );

  const destinationLocation = getLocation(
    transfer.destination_location_id,
  );

  const status = transfer.status.toLowerCase();

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <div className="top-row">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Inventory · Transfer Detail
            </div>

            <h1 className="page-title">{transfer.transfer_number}</h1>

            <p className="page-subtitle">
              Review the transfer route, batch allocation, optional serial
              assets, and lifecycle status.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="secondary-button"
              onClick={() => router.push("/inventory/transfers")}
            >
              ← Back to Transfers
            </button>

            <button
              className="secondary-button"
              onClick={loadData}
              disabled={actionLoading}
            >
              Refresh
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="alert">
            <strong>Transfer action failed</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Status</div>

            <div className="stat-value small">
              <span className={`status-badge status-${status}`}>
                {transfer.status}
              </span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Items</div>
            <div className="stat-value">{items.length}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Units</div>
            <div className="stat-value">{totalUnits}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Serial Assets</div>
            <div className="stat-value">{totalSerials}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Created</div>

            <div className="stat-value date-value">
              {new Date(transfer.created_at).toLocaleDateString()}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Completed</div>

            <div className="stat-value date-value">
              {transfer.completed_at
                ? new Date(transfer.completed_at).toLocaleDateString()
                : "—"}
            </div>
          </div>
        </div>

        <div className="action-card">
          <div>
            <div className="action-title">Transfer Actions</div>

            <div className="action-subtitle">
              Move this transfer through its inventory lifecycle.
            </div>
          </div>

          <div className="action-buttons">
            {status === "draft" && (
              <>
                <button
                  className="primary-button"
                  onClick={() => handleAction("dispatch")}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Processing..." : "Dispatch Transfer"}
                </button>

                <button
                  className="danger-button"
                  onClick={() => handleAction("cancel")}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
              </>
            )}

            {status === "in_transit" && (
              <button
                className="primary-button"
                onClick={() => handleAction("receive")}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Receive Transfer"}
              </button>
            )}

            {status === "completed" && (
              <div className="completed-message">
                ✓ Transfer completed
              </div>
            )}

            {status === "cancelled" && (
              <div className="cancelled-message">
                Transfer cancelled
              </div>
            )}
          </div>
        </div>

        <div className="route-card">
          <div className="section-header route-header">
            <div>
              <h2>Transfer Route</h2>
              <p>Source and destination inventory locations.</p>
            </div>
          </div>

          <div className="route-grid">
            <div className="route-box">
              <div className="route-label">FROM</div>

              <div className="route-name">
                {sourceWarehouse?.name || "Unknown warehouse"}
              </div>

              {sourceWarehouse?.code && (
                <div className="route-code">
                  {sourceWarehouse.code}
                </div>
              )}

              <div className="route-location">
                {sourceLocation?.name || "Unknown location"}

                {sourceLocation?.code
                  ? ` · ${sourceLocation.code}`
                  : ""}
              </div>
            </div>

            <div className="route-arrow">→</div>

            <div className="route-box">
              <div className="route-label">TO</div>

              <div className="route-name">
                {destinationWarehouse?.name || "Unknown warehouse"}
              </div>

              {destinationWarehouse?.code && (
                <div className="route-code">
                  {destinationWarehouse.code}
                </div>
              )}

              <div className="route-location">
                {destinationLocation?.name || "Unknown location"}

                {destinationLocation?.code
                  ? ` · ${destinationLocation.code}`
                  : ""}
              </div>
            </div>
          </div>
        </div>

        <div className="content-card">
          <div className="section-header">
            <div>
              <h2>Transfer Items</h2>

              <p>
                Batch allocation is required. Serial numbers are optional and
                may represent only part of the transferred quantity.
              </p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">
                No transfer items
              </div>

              <div className="empty-text">
                This transfer does not contain any items.
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU / Variant</th>
                    <th>Batch / Lot</th>
                    <th>Tracking</th>
                    <th>Quantity</th>
                    <th>Serials</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => {
                    const product = getProduct(item.product_id);
                    const variant = getVariant(item.variant_id);
                    const batch = getBatch(item.batch_id);
                    const serials = getSerials(item);

                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="product-name">
                            {product?.name || "Unknown product"}
                          </div>

                          {product?.brand && (
                            <div className="muted">
                              {product.brand}
                            </div>
                          )}
                        </td>

                        <td>
                          <div className="variant-name">
                            {variant?.name || "Default"}
                          </div>

                          <div className="muted">
                            {variant?.sku || "No SKU"}
                          </div>
                        </td>

                        <td>
                          {batch ? (
                            <div>
                              <button
                                className="link-button"
                                onClick={() =>
                                  router.push(
                                    `/inventory/batches/${batch.id}`,
                                  )
                                }
                              >
                                {batch.lot_number}
                              </button>

                              <div className="muted">
                                {batch.status || "active"}
                              </div>
                            </div>
                          ) : (
                            <span className="muted">
                              No batch
                            </span>
                          )}
                        </td>

                        <td>
                          <span className="tracking-badge">
                            {product?.tracking_mode || "unknown"}
                          </span>
                        </td>

                        <td>
                          <strong>{item.quantity}</strong>
                        </td>

                        <td>
                          {serials.length === 0 ? (
                            <span className="optional-badge">
                              No serials
                            </span>
                          ) : (
                            <div className="serial-cell">
                              <span className="serial-count">
                                {serials.length} selected
                              </span>

                              <div className="serial-list">
                                {serials.map((serial) => (
                                  <button
                                    key={serial.id}
                                    className="serial-link"
                                    onClick={() =>
                                      router.push(
                                        `/serial-numbers/${serial.id}`,
                                      )
                                    }
                                  >
                                    {serial.serial_number}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="content-card">
          <div className="section-header">
            <div>
              <h2>Transfer Information</h2>
              <p>Lifecycle and document metadata.</p>
            </div>
          </div>

          <div className="info-grid">
            <div className="info-item">
              <span>Transfer Number</span>
              <strong>{transfer.transfer_number}</strong>
            </div>

            <div className="info-item">
              <span>Status</span>
              <strong>{transfer.status}</strong>
            </div>

            <div className="info-item">
              <span>Created</span>
              <strong>
                {new Date(transfer.created_at).toLocaleString()}
              </strong>
            </div>

            <div className="info-item">
              <span>Last Updated</span>
              <strong>
                {new Date(transfer.updated_at).toLocaleString()}
              </strong>
            </div>

            <div className="info-item">
              <span>Completed</span>
              <strong>
                {transfer.completed_at
                  ? new Date(
                      transfer.completed_at,
                    ).toLocaleString()
                  : "Not completed"}
              </strong>
            </div>

            <div className="info-item">
              <span>Completed By</span>
              <strong>
                {transfer.completed_by || "—"}
              </strong>
            </div>
          </div>
        </div>

        <div className="content-card">
          <div className="section-header">
            <div>
              <h2>Notes</h2>
              <p>Internal notes attached to this transfer.</p>
            </div>
          </div>

          <div className="notes">
            {transfer.notes?.trim() ||
              "No notes added to this transfer."}
          </div>
        </div>

        <div className="footer-meta">
          Transfer ID: {transfer.id}
        </div>
      </div>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .inventory-page {
          max-width: 1600px;
          margin: 0 auto;
        }

        .top-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 8px;
        }

        .eyebrow-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #166534;
        }

        .page-title {
          margin: 0;
          color: #0f172a;
          font-size: 30px;
          line-height: 1.15;
          font-weight: 700;
        }

        .page-subtitle {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions,
        .action-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        button {
          font-family: inherit;
        }

        .primary-button,
        .secondary-button,
        .danger-button {
          border-radius: 10px;
          padding: 10px 15px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.15s ease;
        }

        .primary-button {
          border: 1px solid #166534;
          background: #166534;
          color: white;
        }

        .primary-button:hover {
          background: #14532d;
        }

        .secondary-button {
          border: 1px solid #d1d5db;
          background: white;
          color: #334155;
        }

        .secondary-button:hover {
          background: #f8fafc;
        }

        .danger-button {
          border: 1px solid #fecaca;
          background: white;
          color: #b91c1c;
        }

        .danger-button:hover {
          background: #fef2f2;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .alert {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 20px;
          padding: 14px 16px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 13px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
        }

        .stat-label {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .stat-value {
          color: #0f172a;
          font-size: 24px;
          font-weight: 700;
        }

        .stat-value.small {
          font-size: 14px;
        }

        .date-value {
          font-size: 16px;
        }

        .status-badge,
        .tracking-badge,
        .optional-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .status-draft {
          background: #f1f5f9;
          color: #475569;
        }

        .status-in_transit {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status-completed {
          background: #ecfdf5;
          color: #166534;
        }

        .status-cancelled {
          background: #fef2f2;
          color: #b91c1c;
        }

        .tracking-badge {
          background: #f0fdf4;
          color: #166534;
        }

        .optional-badge {
          background: #f8fafc;
          color: #64748b;
        }

        .action-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
          padding: 18px 20px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
        }

        .action-title {
          color: #0f172a;
          font-size: 15px;
          font-weight: 700;
        }

        .action-subtitle {
          margin-top: 4px;
          color: #64748b;
          font-size: 13px;
        }

        .completed-message {
          padding: 10px 14px;
          border-radius: 10px;
          background: #ecfdf5;
          color: #166534;
          font-size: 13px;
          font-weight: 700;
        }

        .cancelled-message {
          padding: 10px 14px;
          border-radius: 10px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 13px;
          font-weight: 700;
        }

        .route-card,
        .content-card {
          margin-bottom: 20px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
        }

        .route-card {
          padding: 20px;
        }

        .content-card {
          overflow: hidden;
        }

        .route-header {
          padding: 0 0 18px;
          border-bottom: 1px solid #e5e7eb;
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .section-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 17px;
          font-weight: 700;
        }

        .section-header p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .route-grid {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 18px;
          margin-top: 18px;
        }

        .route-box {
          padding: 18px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #f8fafc;
        }

        .route-label {
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
        }

        .route-name {
          color: #0f172a;
          font-size: 16px;
          font-weight: 700;
        }

        .route-code {
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
        }

        .route-location {
          margin-top: 10px;
          color: #334155;
          font-size: 13px;
        }

        .route-arrow {
          color: #166534;
          font-size: 28px;
          font-weight: 700;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
        }

        th {
          padding: 12px 16px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        td {
          padding: 15px 16px;
          border-bottom: 1px solid #e5e7eb;
          color: #334155;
          font-size: 13px;
          vertical-align: top;
        }

        tr:last-child td {
          border-bottom: none;
        }

        .product-name,
        .variant-name {
          color: #0f172a;
          font-weight: 700;
        }

        .muted {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 11px;
        }

        .link-button,
        .serial-link {
          border: 0;
          background: transparent;
          padding: 0;
          color: #166534;
          font-weight: 700;
          cursor: pointer;
        }

        .link-button:hover,
        .serial-link:hover {
          text-decoration: underline;
        }

        .serial-cell {
          min-width: 190px;
        }

        .serial-count {
          display: block;
          margin-bottom: 7px;
          color: #334155;
          font-size: 12px;
          font-weight: 700;
        }

        .serial-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .serial-link {
          width: fit-content;
          font-size: 12px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          background: #e5e7eb;
        }

        .info-item {
          padding: 18px 20px;
          background: white;
        }

        .info-item span {
          display: block;
          margin-bottom: 6px;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .info-item strong {
          color: #0f172a;
          font-size: 13px;
          font-weight: 700;
          word-break: break-word;
        }

        .notes {
          padding: 20px;
          color: #475569;
          font-size: 13px;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        .empty-state {
          padding: 48px 20px;
          text-align: center;
        }

        .empty-title {
          color: #0f172a;
          font-size: 15px;
          font-weight: 700;
        }

        .empty-text {
          margin-top: 5px;
          color: #64748b;
          font-size: 13px;
        }

        .footer-meta {
          padding: 4px 2px 20px;
          color: #94a3b8;
          font-size: 11px;
        }

        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 18px;
          }

          .top-row,
          .action-card {
            flex-direction: column;
            align-items: stretch;
          }

          .header-actions,
          .action-buttons {
            width: 100%;
          }

          .header-actions button,
          .action-buttons button {
            flex: 1;
          }

          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .route-grid {
            grid-template-columns: 1fr;
          }

          .route-arrow {
            text-align: center;
            transform: rotate(90deg);
          }

          .info-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 500px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AppShell>
  );
}