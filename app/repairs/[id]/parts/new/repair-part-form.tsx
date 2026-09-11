"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  PackagePlus,
  Save,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Repair = {
  id: string;
  company_id: string;
  repair_number: string;
  customer_id: string | null;
  product_id: string | null;
  status: string;
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

type Props = {
  repair: Repair;
  products: Product[];
  variants: Variant[];
  warehouses: Warehouse[];
  locations: Location[];
};

const sourceOptions: {
  value: PartSource;
  label: string;
  description: string;
}[] = [
  {
    value: "inventory",
    label: "Company Inventory",
    description: "Part is taken from your company's stock.",
  },
  {
    value: "external",
    label: "External / Purchased",
    description: "Part is purchased or sourced specifically for this repair.",
  },
  {
    value: "customer_supplied",
    label: "Customer Supplied",
    description: "Customer provided the replacement part.",
  },
  {
    value: "non_inventory",
    label: "Non-Inventory",
    description: "Part or material is not tracked in inventory.",
  },
];

const statusOptions: {
  value: PartStatus;
  label: string;
}[] = [
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

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function RepairPartForm({
  repair,
  products,
  variants,
  warehouses,
  locations,
}: Props) {
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [source, setSource] =
    useState<PartSource>("non_inventory");

  const [productId, setProductId] =
    useState("");

  const [variantId, setVariantId] =
    useState("");

  const [warehouseId, setWarehouseId] =
    useState("");

  const [locationId, setLocationId] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [quantity, setQuantity] =
    useState("1");

  const [unitCost, setUnitCost] =
    useState("0");

  const [unitCharge, setUnitCharge] =
    useState("0");

  const [status, setStatus] =
    useState<PartStatus>("planned");

  const [notes, setNotes] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const filteredVariants = useMemo(
    () =>
      productId
        ? variants.filter(
            (variant) =>
              variant.product_id === productId,
          )
        : [],
    [productId, variants],
  );

  const filteredLocations = useMemo(
    () =>
      warehouseId
        ? locations.filter(
            (location) =>
              location.warehouse_id === warehouseId,
          )
        : [],
    [warehouseId, locations],
  );

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) => product.id === productId,
      ) ?? null,
    [products, productId],
  );

  const totalCost =
    Math.max(Number(quantity) || 0, 0) *
    Math.max(Number(unitCost) || 0, 0);

  const totalCharge =
    Math.max(Number(quantity) || 0, 0) *
    Math.max(Number(unitCharge) || 0, 0);

  const margin = totalCharge - totalCost;

  function handleSourceChange(nextSource: PartSource) {
    setSource(nextSource);

    if (nextSource !== "inventory") {
      setWarehouseId("");
      setLocationId("");
    }
  }

  function handleProductChange(nextProductId: string) {
    setProductId(nextProductId);
    setVariantId("");

    if (!description.trim()) {
      const product = products.find(
        (item) => item.id === nextProductId,
      );

      if (product) {
        setDescription(product.name);
      }
    }
  }

  function handleWarehouseChange(
    nextWarehouseId: string,
  ) {
    setWarehouseId(nextWarehouseId);
    setLocationId("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Your session has expired. Please log in again.",
        );
      }

      const { data: membership, error: membershipError } =
        await supabase
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
          "Unable to determine your company.",
        );
      }

      if (
        membership.company_id !==
        repair.company_id
      ) {
        throw new Error(
          "You do not have access to this repair.",
        );
      }

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("is_company_admin", {
          p_company_id: repair.company_id,
        });

      if (adminError) {
        throw new Error(
          "Unable to verify your permissions.",
        );
      }

      let canManage =
        Boolean(isAdmin);

      if (!canManage) {
        const {
          data: hasPermission,
          error: permissionError,
        } = await supabase.rpc(
          "employee_has_permission",
          {
            p_company_id: repair.company_id,
            p_module: "repairs",
            p_action: "manage",
          },
        );

        if (permissionError) {
          throw new Error(
            "Unable to verify your repair permissions.",
          );
        }

        canManage = Boolean(hasPermission);
      }

      if (!canManage) {
        throw new Error(
          "You do not have permission to add repair parts.",
        );
      }

      const parsedQuantity =
        Number(quantity);

      const parsedUnitCost =
        Number(unitCost);

      const parsedUnitCharge =
        Number(unitCharge);

     if (
  !Number.isFinite(parsedQuantity) ||
  parsedQuantity <= 0
) {
  throw new Error(
    "Quantity must be greater than zero.",
  );
}

if (!Number.isInteger(parsedQuantity)) {
  throw new Error(
    "Quantity must be a whole number.",
  );
}

      if (
        !Number.isFinite(parsedUnitCost) ||
        parsedUnitCost < 0
      ) {
        throw new Error(
          "Unit cost cannot be negative.",
        );
      }

      if (
        !Number.isFinite(parsedUnitCharge) ||
        parsedUnitCharge < 0
      ) {
        throw new Error(
          "Customer charge cannot be negative.",
        );
      }

      if (
        source === "inventory" &&
        !Number.isInteger(parsedQuantity)
      ) {
        throw new Error(
          "Company inventory quantities must be whole numbers.",
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
          "Select the warehouse where the part will be taken from.",
        );
      }

      if (
        source === "inventory" &&
        !locationId
      ) {
        throw new Error(
          "Select the inventory location.",
        );
      }

      if (
        !description.trim() &&
        !selectedProduct
      ) {
        throw new Error(
          "Enter a part description or select a product.",
        );
      }

      const { data, error } =
        await supabase.rpc(
          "create_repair_part",
          {
            p_company_id:
              repair.company_id,
            p_repair_id:
              repair.id,
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
              description.trim() || null,
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

      if (error) {
        throw new Error(
          error.message ||
            "Unable to add the repair part.",
        );
      }

      if (!data) {
        throw new Error(
          "The repair part could not be created.",
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
          : "Something went wrong while adding the repair part.",
      );
      setSaving(false);
    }
  }

  return (
    <main className="page-content">
      <div className="page-header">
        <div>
          <button
            type="button"
            className="back-button"
            onClick={() =>
              router.push(
                `/repairs/${repair.id}`,
              )
            }
          >
            <ArrowLeft size={16} />
            Back to Repair
          </button>

          <div className="title-row">
            <div className="title-icon">
              <PackagePlus size={22} />
            </div>

            <div>
              <h1>Add Repair Part</h1>
              <p>
                Add a replacement part or material
                to {repair.repair_number}.
              </p>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="error-banner">
          {errorMessage}
        </div>
      )}

      <form
        className="form-layout"
        onSubmit={handleSubmit}
      >
        <section className="form-card">
          <div className="card-header">
            <div>
              <h2>Part Source</h2>
              <p>
                Choose where this part comes from.
              </p>
            </div>
          </div>

          <div className="source-grid">
            {sourceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`source-option ${
                  source === option.value
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  handleSourceChange(
                    option.value,
                  )
                }
              >
                <span className="source-option-title">
                  {option.label}
                </span>

                <span className="source-option-description">
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="form-card">
          <div className="card-header">
            <div>
              <h2>Part Details</h2>
              <p>
                Define the replacement part and
                quantities.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field field-full">
              <label htmlFor="product">
                Product
                {source === "inventory" && (
                  <span className="required">
                    *
                  </span>
                )}
              </label>

              <select
                id="product"
                value={productId}
                onChange={(event) =>
                  handleProductChange(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  {source === "inventory"
                    ? "Select inventory product"
                    : "Optional — select product"}
                </option>

                {products.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            {productId && (
              <div className="field field-full">
                <label htmlFor="variant">
                  Variant
                  {source === "inventory" && (
                    <span className="required">
                      *
                    </span>
                  )}
                </label>

                <select
                  id="variant"
                  value={variantId}
                  onChange={(event) =>
                    setVariantId(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    {source === "inventory"
                      ? "Select variant"
                      : "Optional — select variant"}
                  </option>

                  {filteredVariants.map(
                    (variant) => (
                      <option
                        key={variant.id}
                        value={variant.id}
                      >
                        {variant.name}
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}

            <div className="field field-full">
              <label htmlFor="description">
                Description
                <span className="required">*</span>
              </label>

              <input
                id="description"
                type="text"
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                placeholder="e.g. Dell Latitude 7420 Battery"
              />
            </div>

            <div className="field">
              <label htmlFor="quantity">
                Quantity
              </label>

              <input
  id="quantity"
  type="number"
  min="1"
  step="1"
  value={quantity}
  onChange={(event) =>
    setQuantity(event.target.value)
  }
/>

              {source === "inventory" && (
                <span className="field-help">
                  Inventory quantities must be
                  whole numbers.
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor="status">
                Status
              </label>

              <select
                id="status"
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target
                      .value as PartStatus,
                  )
                }
              >
                {statusOptions.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
        </section>

        {source === "inventory" && (
          <section className="form-card">
            <div className="card-header">
              <div>
                <h2>Inventory Source</h2>
                <p>
                  Select exactly where SBS will
                  take this part from.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="warehouse">
                  Warehouse
                  <span className="required">
                    *
                  </span>
                </label>

                <select
                  id="warehouse"
                  value={warehouseId}
                  onChange={(event) =>
                    handleWarehouseChange(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select warehouse
                  </option>

                  {warehouses.map(
                    (warehouse) => (
                      <option
                        key={warehouse.id}
                        value={warehouse.id}
                      >
                        {warehouse.name}
                        {warehouse.code
                          ? ` (${warehouse.code})`
                          : ""}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="field">
                <label htmlFor="location">
                  Location
                  <span className="required">
                    *
                  </span>
                </label>

                <select
                  id="location"
                  value={locationId}
                  onChange={(event) =>
                    setLocationId(
                      event.target.value,
                    )
                  }
                  disabled={!warehouseId}
                >
                  <option value="">
                    {!warehouseId
                      ? "Select warehouse first"
                      : "Select location"}
                  </option>

                  {filteredLocations.map(
                    (location) => (
                      <option
                        key={location.id}
                        value={location.id}
                      >
                        {location.name}
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
              <strong>Inventory rule:</strong>
              {" "}
              stock is deducted only when this
              part is saved as <strong>Used</strong>.
              A Planned part does not change
              inventory.
            </div>
          </section>
        )}

        <section className="form-card">
          <div className="card-header">
            <div>
              <h2>Cost & Customer Charge</h2>
              <p>
                Track your cost and what the customer
                will be charged.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="unit-cost">
                Unit Cost
              </label>

              <div className="input-prefix">
                <span>$</span>
                <input
                  id="unit-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitCost}
                  onChange={(event) =>
                    setUnitCost(
                      event.target.value,
                    )
                  }
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="unit-charge">
                Customer Charge
              </label>

              <div className="input-prefix">
                <span>$</span>
                <input
                  id="unit-charge"
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitCharge}
                  onChange={(event) =>
                    setUnitCharge(
                      event.target.value,
                    )
                  }
                />
              </div>
            </div>
          </div>

          <div className="totals-grid">
            <div className="total-box">
              <span>Total Cost</span>
              <strong>
                {formatMoney(totalCost)}
              </strong>
            </div>

            <div className="total-box">
              <span>Total Charge</span>
              <strong>
                {formatMoney(totalCharge)}
              </strong>
            </div>

            <div className="total-box">
              <span>Margin</span>
              <strong
                className={
                  margin >= 0
                    ? "positive"
                    : "negative"
                }
              >
                {formatMoney(margin)}
              </strong>
            </div>
          </div>
        </section>

        <section className="form-card">
          <div className="card-header">
            <div>
              <h2>Notes</h2>
              <p>
                Add any useful information about this
                part.
              </p>
            </div>
          </div>

          <div className="field field-full">
            <label htmlFor="notes">
              Notes
            </label>

            <textarea
              id="notes"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Optional notes..."
              rows={5}
            />
          </div>
        </section>

        <div className="form-actions">
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
            disabled={saving}
          >
            <Save size={16} />

            {saving
              ? "Saving..."
              : "Add Part"}
          </button>
        </div>
      </form>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 0;
          background: transparent;
          color: #6b7280;
          padding: 0;
          margin-bottom: 18px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .back-button:hover {
          color: #111827;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .title-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #f3f4f6;
          color: #374151;
        }

        h1 {
          margin: 0;
          color: #111827;
          font-size: 26px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .title-row p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .error-banner {
          margin-bottom: 18px;
          padding: 12px 14px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 13px;
          line-height: 1.5;
        }

        .form-layout {
          display: flex;
          flex-direction: column;
          gap: 18px;
          max-width: 1100px;
        }

        .form-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          padding: 22px;
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
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
          font-size: 12px;
        }

        .source-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .source-option {
          min-height: 112px;
          padding: 16px;
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

        .source-option:hover {
          border-color: #c7cbd1;
          background: #f9fafb;
        }

        .source-option.selected {
          border-color: #111827;
          background: #f9fafb;
          box-shadow: 0 0 0 1px #111827;
        }

        .source-option-title {
          display: block;
          margin-bottom: 7px;
          font-size: 13px;
          font-weight: 700;
        }

        .source-option-description {
          display: block;
          color: #6b7280;
          font-size: 11px;
          line-height: 1.5;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }

        .field-full {
          grid-column: 1 / -1;
        }

        label {
          color: #374151;
          font-size: 12px;
          font-weight: 600;
        }

        .required {
          margin-left: 3px;
          color: #dc2626;
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #ffffff;
          color: #111827;
          font-family: inherit;
          font-size: 13px;
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

        textarea {
          padding: 11px;
          resize: vertical;
          line-height: 1.5;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.06);
        }

        select:disabled {
          background: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .field-help {
          color: #6b7280;
          font-size: 11px;
        }

        .inventory-note {
          margin-top: 18px;
          padding: 12px 14px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #f9fafb;
          color: #4b5563;
          font-size: 12px;
          line-height: 1.5;
        }

        .input-prefix {
          position: relative;
        }

        .input-prefix > span {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #6b7280;
          font-size: 13px;
          pointer-events: none;
        }

        .input-prefix input {
          padding-left: 25px;
        }

        .totals-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 20px;
        }

        .total-box {
          padding: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
        }

        .total-box span {
          display: block;
          margin-bottom: 6px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 600;
        }

        .total-box strong {
          color: #111827;
          font-size: 17px;
        }

        .total-box strong.positive {
          color: #15803d;
        }

        .total-box strong.negative {
          color: #dc2626;
        }

        .form-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding-bottom: 10px;
        }

        .secondary-button,
        .primary-button {
          min-height: 40px;
          padding: 0 15px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }

        .secondary-button {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
        }

        .secondary-button:hover:not(:disabled) {
          background: #f9fafb;
        }

        .primary-button {
          border: 1px solid #111827;
          background: #111827;
          color: #ffffff;
        }

        .primary-button:hover:not(:disabled) {
          background: #1f2937;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .source-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .page-content {
            padding: 20px;
          }

          .form-card {
            padding: 18px;
          }

          .form-grid,
          .totals-grid {
            grid-template-columns: 1fr;
          }

          .field-full {
            grid-column: auto;
          }
        }

        @media (max-width: 520px) {
          .source-grid {
            grid-template-columns: 1fr;
          }

          .title-row {
            align-items: flex-start;
          }

          h1 {
            font-size: 22px;
          }

          .form-actions {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          .secondary-button,
          .primary-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}