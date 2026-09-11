"use client";

import { FormEvent, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Save,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Repair = {
  id: string;
  company_id: string;
  repair_number: string;
  status: string;
};

type RepairPart = {
  id: string;
  company_id: string;
  repair_id: string;
  product_id: string | null;
  variant_id: string | null;
  description: string | null;
  quantity: number;
  unit_cost: number;
  unit_charge: number;
  status:
    | "planned"
    | "used"
    | "returned"
    | "cancelled";
  notes: string | null;
  source:
    | "inventory"
    | "external"
    | "customer_supplied"
    | "non_inventory";
  warehouse_id: string | null;
  location_id: string | null;
  inventory_id: string | null;
  inventory_movement_id: string | null;
  inventory_return_movement_id: string | null;
};

type Product = {
  id: string;
  name: string;
};

type Variant = {
  id: string;
  product_id: string;
  name: string;
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
  location_type: string | null;
};

type Props = {
  repair: Repair;
  part: RepairPart;
  products: Product[];
  variants: Variant[];
  warehouses: Warehouse[];
  locations: Location[];
};

type PartSource =
  | "inventory"
  | "external"
  | "customer_supplied"
  | "non_inventory";

type PartStatus =
  | "planned"
  | "used"
  | "returned"
  | "cancelled";

const sourceOptions: Array<{
  value: PartSource;
  label: string;
  description: string;
}> = [
  {
    value: "inventory",
    label: "Company Inventory",
    description:
      "Part comes from your company's stock.",
  },
  {
    value: "external",
    label: "External / Purchased",
    description:
      "Part is purchased specifically for this repair.",
  },
  {
    value: "customer_supplied",
    label: "Customer Supplied",
    description:
      "The customer provided the replacement part.",
  },
  {
    value: "non_inventory",
    label: "Non-Inventory",
    description:
      "Material or part is not tracked in inventory.",
  },
];

const statusOptions: Array<{
  value: PartStatus;
  label: string;
}> = [
  {
    value: "planned",
    label: "Planned",
  },
  {
    value: "used",
    label: "Used",
  },
  {
    value: "returned",
    label: "Returned",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];

function money(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function RepairPartEdit({
  repair,
  part,
  products,
  variants,
  warehouses,
  locations,
}: Props) {
  const router = useRouter();

  const params = useParams<{
    id: string;
    partId: string;
  }>();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [source, setSource] =
    useState<PartSource>(
      part.source ?? "non_inventory",
    );

  const [productId, setProductId] =
    useState(part.product_id ?? "");

  const [variantId, setVariantId] =
    useState(part.variant_id ?? "");

  const [warehouseId, setWarehouseId] =
    useState(part.warehouse_id ?? "");

  const [locationId, setLocationId] =
    useState(part.location_id ?? "");

  const [description, setDescription] =
    useState(part.description ?? "");

  const [quantity, setQuantity] =
    useState(
      String(
        Math.max(
          1,
          Math.round(
            Number(part.quantity ?? 1),
          ),
        ),
      ),
    );

  const [unitCost, setUnitCost] =
    useState(
      String(part.unit_cost ?? 0),
    );

  const [unitCharge, setUnitCharge] =
    useState(
      String(part.unit_charge ?? 0),
    );

  const [status, setStatus] =
    useState<PartStatus>(part.status);

  const [notes, setNotes] =
    useState(part.notes ?? "");

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const isConsumedInventoryPart =
    part.source === "inventory" &&
    part.status === "used" &&
    Boolean(part.inventory_movement_id);

  const isLocked =
    part.status === "returned" ||
    part.status === "cancelled";

  const filteredVariants = useMemo(
    () =>
      productId
        ? variants.filter(
            (variant) =>
              variant.product_id ===
              productId,
          )
        : [],
    [productId, variants],
  );

  const filteredLocations = useMemo(
    () =>
      warehouseId
        ? locations.filter(
            (location) =>
              location.warehouse_id ===
              warehouseId,
          )
        : [],
    [warehouseId, locations],
  );

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) =>
          product.id === productId,
      ) ?? null,
    [products, productId],
  );

  const totalCost =
    Number(quantity || 0) *
    Number(unitCost || 0);

  const totalCharge =
    Number(quantity || 0) *
    Number(unitCharge || 0);

  const margin =
    totalCharge - totalCost;

  function handleSourceChange(
    nextSource: PartSource,
  ) {
    if (isConsumedInventoryPart) {
      return;
    }

    setSource(nextSource);

    if (nextSource !== "inventory") {
      setWarehouseId("");
      setLocationId("");
    }
  }

  function handleProductChange(
    nextProductId: string,
  ) {
    if (isConsumedInventoryPart) {
      return;
    }

    setProductId(nextProductId);
    setVariantId("");

    if (!description.trim()) {
      const product = products.find(
        (item) =>
          item.id === nextProductId,
      );

      if (product) {
        setDescription(product.name);
      }
    }
  }

  function handleWarehouseChange(
    nextWarehouseId: string,
  ) {
    if (isConsumedInventoryPart) {
      return;
    }

    setWarehouseId(nextWarehouseId);
    setLocationId("");
  }

  function handleStatusChange(
    nextStatus: PartStatus,
  ) {
    if (isLocked) {
      return;
    }

    if (
      isConsumedInventoryPart &&
      nextStatus !== "returned"
    ) {
      setStatus(nextStatus);
      return;
    }

    setStatus(nextStatus);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membership } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (!membership?.company_id) {
        throw new Error(
          "Your company membership could not be verified.",
        );
      }

      const companyId =
        membership.company_id;

      if (
        companyId !==
        repair.company_id
      ) {
        throw new Error(
          "You are not authorized to modify this repair.",
        );
      }

      const { data: isAdmin } =
        await supabase.rpc(
          "is_company_admin",
          {
            p_company_id: companyId,
          },
        );

      let hasPermission =
        Boolean(isAdmin);

      if (!hasPermission) {
        const {
          data: canManage,
        } = await supabase.rpc(
          "employee_has_permission",
          {
            p_company_id: companyId,
            p_module: "repairs",
            p_action: "manage",
          },
        );

        hasPermission =
          Boolean(canManage);
      }

      if (!hasPermission) {
        throw new Error(
          "You do not have permission to manage repair parts.",
        );
      }

      const parsedQuantity =
        Number(quantity);

      const parsedUnitCost =
        Number(unitCost);

      const parsedUnitCharge =
        Number(unitCharge);

      if (
        !Number.isFinite(
          parsedQuantity,
        ) ||
        parsedQuantity <= 0
      ) {
        throw new Error(
          "Quantity must be greater than zero.",
        );
      }

      if (
        !Number.isInteger(
          parsedQuantity,
        )
      ) {
        throw new Error(
          "Quantity must be a whole number.",
        );
      }

      if (
        !Number.isFinite(
          parsedUnitCost,
        ) ||
        parsedUnitCost < 0
      ) {
        throw new Error(
          "Unit cost must be a valid non-negative number.",
        );
      }

      if (
        !Number.isFinite(
          parsedUnitCharge,
        ) ||
        parsedUnitCharge < 0
      ) {
        throw new Error(
          "Unit charge must be a valid non-negative number.",
        );
      }

      if (
        !description.trim() &&
        !productId
      ) {
        throw new Error(
          "Select a product or enter a part description.",
        );
      }

      if (
        source === "inventory" &&
        !productId
      ) {
        throw new Error(
          "Select a product for an inventory part.",
        );
      }

      if (
        source === "inventory" &&
        !variantId
      ) {
        throw new Error(
          "Select a variant for an inventory part.",
        );
      }

      if (
        source === "inventory" &&
        !warehouseId
      ) {
        throw new Error(
          "Select a warehouse for the inventory part.",
        );
      }

      if (
        source === "inventory" &&
        !locationId
      ) {
        throw new Error(
          "Select an inventory location.",
        );
      }

      let finalDescription =
        description.trim();

      if (
        !finalDescription &&
        productId
      ) {
        finalDescription =
          selectedProduct?.name ??
          "Repair Part";
      }

      /*
       * Consumed inventory parts cannot be
       * changed into another product, quantity,
       * warehouse, or source. They must first
       * be returned through the lifecycle.
       */
      if (isConsumedInventoryPart) {
        if (
          source !== "inventory" ||
          productId !==
            part.product_id ||
          variantId !==
            part.variant_id ||
          warehouseId !==
            part.warehouse_id ||
          locationId !==
            part.location_id ||
          parsedQuantity !==
            Number(part.quantity)
        ) {
          throw new Error(
            "This inventory part has already been consumed. Return it before changing its product, quantity, warehouse, or location.",
          );
        }

        if (
          status !== "used" &&
          status !== "returned"
        ) {
          throw new Error(
            "A consumed inventory part can only remain Used or be marked Returned.",
          );
        }
      }

      /*
       * Returned and cancelled parts are
       * permanently closed.
       */
      if (isLocked) {
        if (
          status !== part.status
        ) {
          throw new Error(
            "This repair part is already closed and cannot be reopened.",
          );
        }
      }

      const { error: updateError } =
        await supabase.rpc(
          "update_repair_part",
          {
            p_company_id: companyId,
            p_repair_part_id:
              params.partId,
            p_product_id:
              productId || null,
            p_variant_id:
              variantId || null,
            p_warehouse_id:
              source === "inventory"
                ? warehouseId
                : null,
            p_location_id:
              source === "inventory"
                ? locationId
                : null,
            p_source: source,
            p_description:
              finalDescription,
            p_quantity:
              parsedQuantity,
            p_unit_cost:
              parsedUnitCost,
            p_unit_charge:
              parsedUnitCharge,
            p_status: status,
            p_notes:
              notes.trim() || null,
          },
        );

      if (updateError) {
        throw new Error(
          updateError.message ||
            "The repair part could not be updated.",
        );
      }

      router.push(
        `/repairs/${repair.id}`,
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while updating the repair part.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Package size={15} />
            Repair Parts
          </div>

          <h1>
            Edit Repair Part
          </h1>

          <p>
            Update the part attached to{" "}
            <strong>
              {repair.repair_number}
            </strong>
            .
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            router.push(
              `/repairs/${repair.id}`,
            )
          }
        >
          <ArrowLeft size={16} />
          Back to Repair
        </button>
      </div>

      {errorMessage ? (
        <div className="error-banner">
          <strong>
            Unable to save part
          </strong>

          <span>
            {errorMessage}
          </span>
        </div>
      ) : null}

      {isConsumedInventoryPart ? (
        <div className="info-banner">
          <strong>
            Inventory part already consumed
          </strong>

          <span>
            This part has already been deducted
            from company inventory. Its product,
            quantity, warehouse, and location are
            locked. You can mark it as Returned to
            put the quantity back into inventory.
          </span>
        </div>
      ) : null}

      {isLocked ? (
        <div className="info-banner">
          <strong>
            Part is closed
          </strong>

          <span>
            {part.status === "returned"
              ? "This part has been returned and cannot be reopened."
              : "This part has been cancelled and cannot be reopened."}
          </span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <section className="card">
            <div className="card-header">
              <div>
                <h2>
                  Part Source
                </h2>

                <p>
                  Choose where this replacement
                  part comes from.
                </p>
              </div>
            </div>

            <div className="source-grid">
              {sourceOptions.map(
                (option) => (
                  <button
                    key={
                      option.value
                    }
                    type="button"
                    className={`source-option ${
                      source ===
                      option.value
                        ? "selected"
                        : ""
                    } ${
                      isConsumedInventoryPart ||
                      isLocked
                        ? "disabled"
                        : ""
                    }`}
                    onClick={() =>
                      handleSourceChange(
                        option.value,
                      )
                    }
                    disabled={
                      isConsumedInventoryPart ||
                      isLocked
                    }
                  >
                    <span className="source-title">
                      {option.label}
                    </span>

                    <span className="source-description">
                      {
                        option.description
                      }
                    </span>
                  </button>
                ),
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2>
                  Part Information
                </h2>

                <p>
                  Update the replacement part
                  details.
                </p>
              </div>
            </div>

            <div className="fields-grid">
              <div className="field full-width">
                <label>
                  Product
                  {source ===
                    "inventory" && (
                    <span className="required">
                      *
                    </span>
                  )}
                </label>

                <select
                  value={productId}
                  onChange={(event) =>
                    handleProductChange(
                      event.target
                        .value,
                    )
                  }
                  disabled={
                    isConsumedInventoryPart ||
                    isLocked
                  }
                >
                  <option value="">
                    {source ===
                    "inventory"
                      ? "Select inventory product"
                      : "Custom / No Product"}
                  </option>

                  {products.map(
                    (product) => (
                      <option
                        key={
                          product.id
                        }
                        value={
                          product.id
                        }
                      >
                        {product.name}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="field">
                <label>
                  Variant
                  {source ===
                    "inventory" && (
                    <span className="required">
                      *
                    </span>
                  )}
                </label>

                <select
                  value={variantId}
                  onChange={(event) =>
                    setVariantId(
                      event.target
                        .value,
                    )
                  }
                  disabled={
                    !productId ||
                    filteredVariants.length ===
                      0 ||
                    isConsumedInventoryPart ||
                    isLocked
                  }
                >
                  <option value="">
                    {productId
                      ? filteredVariants.length
                        ? "Select variant"
                        : "No variants available"
                      : "Select product first"}
                  </option>

                  {filteredVariants.map(
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
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="field">
                <label>
                  Status
                </label>

                <select
                  value={status}
                  onChange={(event) =>
                    handleStatusChange(
                      event.target
                        .value as PartStatus,
                    )
                  }
                  disabled={isLocked}
                >
                  {statusOptions.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="field full-width">
                <label>
                  Description
                  <span className="required">
                    *
                  </span>
                </label>

                <input
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Repair part description"
                  disabled={
                    isLocked
                  }
                />
              </div>
            </div>
          </section>

          {source ===
            "inventory" && (
            <section className="card full-card">
              <div className="card-header">
                <div>
                  <h2>
                    Inventory Source
                  </h2>

                  <p>
                    Select the exact SBS
                    inventory location.
                  </p>
                </div>
              </div>

              <div className="fields-grid">
                <div className="field">
                  <label>
                    Warehouse
                    <span className="required">
                      *
                    </span>
                  </label>

                  <select
                    value={
                      warehouseId
                    }
                    onChange={(
                      event,
                    ) =>
                      handleWarehouseChange(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      isConsumedInventoryPart ||
                      isLocked
                    }
                  >
                    <option value="">
                      Select warehouse
                    </option>

                    {warehouses.map(
                      (
                        warehouse,
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
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="field">
                  <label>
                    Location
                    <span className="required">
                      *
                    </span>
                  </label>

                  <select
                    value={
                      locationId
                    }
                    onChange={(
                      event,
                    ) =>
                      setLocationId(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      !warehouseId ||
                      isConsumedInventoryPart ||
                      isLocked
                    }
                  >
                    <option value="">
                      {!warehouseId
                        ? "Select warehouse first"
                        : "Select location"}
                    </option>

                    {filteredLocations.map(
                      (
                        location,
                      ) => (
                        <option
                          key={
                            location.id
                          }
                          value={
                            location.id
                          }
                        >
                          {
                            location.name
                          }
                          {location.code
                            ? ` (${location.code})`
                            : ""}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              <div className="inventory-note">
                <strong>
                  Inventory rule:
                </strong>{" "}
                stock is deducted only when
                an inventory part becomes{" "}
                <strong>Used</strong>.
                Returning a consumed part puts
                the quantity back into the same
                warehouse and location.
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-header">
              <div>
                <h2>
                  Quantity & Pricing
                </h2>

                <p>
                  Update cost and customer
                  pricing.
                </p>
              </div>
            </div>

            <div className="fields-grid">
              <div className="field">
                <label>
                  Quantity
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      event.target
                        .value,
                    )
                  }
                  disabled={
                    isConsumedInventoryPart ||
                    isLocked
                  }
                />

                <span className="field-help">
                  Quantity must be a
                  whole number.
                </span>
              </div>

              <div className="field">
                <label>
                  Unit Cost
                </label>

                <div className="money-input">
                  <span>
                    USD
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitCost}
                    onChange={(
                      event,
                    ) =>
                      setUnitCost(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      isLocked
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label>
                  Unit Charge
                </label>

                <div className="money-input">
                  <span>
                    USD
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      unitCharge
                    }
                    onChange={(
                      event,
                    ) =>
                      setUnitCharge(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      isLocked
                    }
                  />
                </div>
              </div>
            </div>

            <div className="totals-box">
              <div>
                <span>
                  Part Cost
                </span>

                <strong>
                  $
                  {money(
                    totalCost,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Customer Charge
                </span>

                <strong>
                  $
                  {money(
                    totalCharge,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Margin
                </span>

                <strong
                  className={
                    margin >= 0
                      ? "positive"
                      : "negative"
                  }
                >
                  $
                  {money(
                    margin,
                  )}
                </strong>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2>
                  Notes
                </h2>

                <p>
                  Internal information about
                  this part.
                </p>
              </div>
            </div>

            <div className="field">
              <label>
                Notes
              </label>

              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target
                      .value,
                  )
                }
                rows={6}
                placeholder="Add notes..."
                disabled={
                  isLocked
                }
              />
            </div>
          </section>
        </div>

        <div className="form-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push(
                `/repairs/${repair.id}`,
              )
            }
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={
              saving ||
              isLocked
            }
          >
            {saving ? (
              <>
                <span className="spinner" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 8px;
          color: #16a34a;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          color: #111827;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 700;
        }

        .page-header p {
          margin: 8px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .page-header p strong {
          color: #111827;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 20px;
        }

        .card {
          padding: 22px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 1px 2px
              rgba(
                15,
                23,
                42,
                0.03
              );
        }

        .full-card {
          grid-column: 1 / -1;
        }

        .card-header {
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f1f5f9;
        }

        .card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .card-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .source-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 12px;
        }

        .source-option {
          min-height: 112px;
          padding: 15px;
          text-align: left;
          border: 1px solid #e5e7eb;
          border-radius: 11px;
          background: #ffffff;
          color: #111827;
          cursor: pointer;
          font-family: inherit;
          transition:
            border-color 0.15s ease,
            background 0.15s ease,
            box-shadow 0.15s ease;
        }

        .source-option:hover:not(
          :disabled
        ) {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        .source-option.selected {
          border-color: #111827;
          background: #f9fafb;
          box-shadow:
            0 0 0 1px
              #111827;
        }

        .source-option.disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .source-title {
          display: block;
          margin-bottom: 7px;
          font-size: 13px;
          font-weight: 700;
        }

        .source-description {
          display: block;
          color: #6b7280;
          font-size: 11px;
          line-height: 1.5;
        }

        .fields-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 18px;
        }

        .field {
          min-width: 0;
        }

        .full-width {
          grid-column: 1 / -1;
        }

        .field label {
          display: block;
          margin-bottom: 7px;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
        }

        .required {
          margin-left: 3px;
          color: #dc2626;
        }

        .field input,
        .field select,
        .field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #ffffff;
          color: #111827;
          font-family: inherit;
          font-size: 14px;
          outline: none;
        }

        .field input,
        .field select {
          min-height: 42px;
          padding: 0 12px;
        }

        .field textarea {
          padding: 11px 12px;
          resize: vertical;
          line-height: 1.55;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          border-color: #16a34a;
          box-shadow:
            0 0 0 3px
              rgba(
                22,
                163,
                74,
                0.1
              );
        }

        .field input:disabled,
        .field select:disabled,
        .field textarea:disabled {
          background: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .field-help {
          display: block;
          margin-top: 5px;
          color: #6b7280;
          font-size: 11px;
        }

        .money-input {
          display: flex;
        }

        .money-input span {
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          border: 1px solid #d1d5db;
          border-right: 0;
          border-radius: 9px 0 0 9px;
          background: #f9fafb;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
        }

        .money-input input {
          border-radius: 0 9px 9px 0;
        }

        .totals-box {
          display: grid;
          grid-template-columns: repeat(
            3,
            1fr
          );
          gap: 10px;
          margin-top: 20px;
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
        }

        .totals-box div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .totals-box span {
          color: #6b7280;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .totals-box strong {
          color: #111827;
          font-size: 15px;
        }

        .totals-box strong.positive {
          color: #15803d;
        }

        .totals-box strong.negative {
          color: #dc2626;
        }

        .inventory-note {
          margin-top: 18px;
          padding: 12px 14px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #f9fafb;
          color: #4b5563;
          font-size: 12px;
          line-height: 1.55;
        }

        .error-banner,
        .info-banner {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 20px;
          padding: 13px 15px;
          border-radius: 10px;
          font-size: 13px;
          line-height: 1.5;
        }

        .error-banner {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .info-banner {
          border: 1px solid #dbeafe;
          background: #eff6ff;
          color: #1e40af;
        }

        .secondary-button,
        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .secondary-button {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
        }

        .secondary-button:hover:not(
          :disabled
        ) {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .primary-button {
          border: 1px solid #16a34a;
          background: #16a34a;
          color: #ffffff;
        }

        .primary-button:hover:not(
          :disabled
        ) {
          background: #15803d;
          border-color: #15803d;
        }

        .secondary-button:disabled,
        .primary-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .form-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid
            rgba(
              255,
              255,
              255,
              0.4
            );
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin
            0.7s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(
              360deg
            );
          }
        }

        @media (max-width: 1000px) {
          .source-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 900px) {
          .form-grid {
            grid-template-columns: 1fr;
          }

          .full-card {
            grid-column: auto;
          }
        }

        @media (max-width: 700px) {
          .page-content {
            padding: 20px;
          }

          .page-header {
            flex-direction: column;
          }

          .page-header
            .secondary-button {
            width: 100%;
          }

          .fields-grid,
          .totals-box {
            grid-template-columns: 1fr;
          }

          .full-width {
            grid-column: auto;
          }

          .card {
            padding: 18px;
          }

          .form-footer {
            flex-direction: column-reverse;
          }

          .form-footer button {
            width: 100%;
          }
        }

        @media (max-width: 520px) {
          .source-grid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}