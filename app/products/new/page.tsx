"use client";

import {
  ArrowLeft,
  Barcode,
  Boxes,
  Check,
  ChevronDown,
  DollarSign,
  Layers3,
  Package,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type VariantDraft = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  costPrice: string;
  sellingPrice: string;
  isDefault: boolean;
  isActive: boolean;
};

const PRODUCT_TYPES = [
  { value: "physical", label: "Physical Product" },
  { value: "service", label: "Service" },
];

const createVariant = (
  index = 0,
  isDefault = false,
): VariantDraft => ({
  id: `new-${Date.now()}-${index}-${Math.random()
    .toString(36)
    .slice(2, 8)}`,
  name: index === 0 ? "Default" : `Variant ${index + 1}`,
  sku: "",
  barcode: "",
  costPrice: "",
  sellingPrice: "",
  isDefault,
  isActive: true,
});

export default function NewProductPage() {
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("physical");

  const [trackingEnabled, setTrackingEnabled] = useState(true);

  const [taxRate, setTaxRate] = useState("0");

  const [variants, setVariants] = useState<VariantDraft[]>([
    createVariant(0, true),
  ]);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadCompany = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: {
          user,
        },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: membershipData, error: membershipError } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        throw new Error(membershipError.message);
      }

      if (!membershipData?.company_id) {
        throw new Error(
          "No company workspace is available for your account.",
        );
      }

      setCompanyId(membershipData.company_id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load your company workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  const updateVariant = (
    id: string,
    field: keyof VariantDraft,
    value: string | boolean,
  ) => {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === id
          ? {
              ...variant,
              [field]: value,
            }
          : variant,
      ),
    );
  };

  const setDefaultVariant = (id: string) => {
    setVariants((current) =>
      current.map((variant) => ({
        ...variant,
        isDefault: variant.id === id,
      })),
    );
  };

  const addVariant = () => {
    setVariants((current) => [
      ...current,
      createVariant(current.length, current.length === 0),
    ]);
  };

  const removeVariant = (id: string) => {
    if (variants.length === 1) {
      setErrorMessage(
        "A product must have at least one variant.",
      );
      return;
    }

    const variantToRemove = variants.find(
      (variant) => variant.id === id,
    );

    const remaining = variants.filter(
      (variant) => variant.id !== id,
    );

    if (variantToRemove?.isDefault && remaining.length > 0) {
      remaining[0] = {
        ...remaining[0],
        isDefault: true,
      };
    }

    setVariants(remaining);
  };

  const normalizedTaxRate = Number(taxRate || 0);

  const totalVariantCount = variants.length;

  const activeVariantCount = variants.filter(
    (variant) => variant.isActive,
  ).length;

  const defaultVariant =
    variants.find((variant) => variant.isDefault) ??
    variants[0];

  const hasValidPrices = variants.every((variant) => {
    const cost = Number(variant.costPrice || 0);
    const selling = Number(variant.sellingPrice || 0);

    return (
      Number.isFinite(cost) &&
      Number.isFinite(selling) &&
      cost >= 0 &&
      selling >= 0
    );
  });

  const validateForm = () => {
    if (!companyId) {
      return "Company workspace could not be determined.";
    }

    if (!name.trim()) {
      return "Product name is required.";
    }

    if (!["physical", "service"].includes(productType)) {
      return "Please select a valid product type.";
    }

    if (
      !Number.isFinite(normalizedTaxRate) ||
      normalizedTaxRate < 0 ||
      normalizedTaxRate > 100
    ) {
      return "Tax rate must be between 0 and 100.";
    }

    if (variants.length === 0) {
      return "Add at least one product variant.";
    }

    if (!variants.some((variant) => variant.isDefault)) {
      return "Select a default variant.";
    }

    if (!hasValidPrices) {
      return "Variant prices must be valid non-negative numbers.";
    }

    const names = variants
      .map((variant) => variant.name.trim().toLowerCase())
      .filter(Boolean);

    if (names.length !== new Set(names).size) {
      return "Each variant must have a unique name.";
    }

    const skus = variants
      .map((variant) => variant.sku.trim().toLowerCase())
      .filter(Boolean);

    if (skus.length !== new Set(skus).size) {
      return "Each variant SKU must be unique within this product.";
    }

    const barcodes = variants
      .map((variant) =>
        variant.barcode.trim().toLowerCase(),
      )
      .filter(Boolean);

    if (
      barcodes.length !== new Set(barcodes).size
    ) {
      return "Each variant barcode must be unique within this product.";
    }

    return null;
  };

  const handleSave = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!companyId) {
      return;
    }

    setSaving(true);

    try {
      const slugBase = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const slug = `${slugBase || "product"}-${Date.now()
        .toString(36)
        .toLowerCase()}`;

      /*
       * V2 tracking architecture:
       *
       * Not Tracked -> tracking_mode = "none"
       * Tracked     -> tracking_mode = "batch"
       *
       * Batch/Lot is the primary inventory layer.
       * Serialized units remain optional children of batches.
       */
      const trackingMode = trackingEnabled
        ? "batch"
        : "none";

      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .insert({
            company_id: companyId,
            name: name.trim(),
            slug,
            description:
              description.trim() || null,
            category: category.trim() || null,
            brand: brand.trim() || null,
            product_type: productType,
            status: "active",
            track_inventory: trackingEnabled,
            tax_rate: normalizedTaxRate,
            tracking_mode: trackingMode,
          })
          .select("id")
          .single();

      if (productError) {
        throw new Error(productError.message);
      }

      if (!productData?.id) {
        throw new Error(
          "Product was created but no product ID was returned.",
        );
      }

      const variantPayload = variants.map(
        (variant) => ({
          company_id: companyId,
          product_id: productData.id,
          name: variant.name.trim(),
          sku: variant.sku.trim() || null,
          barcode:
            variant.barcode.trim() || null,
          cost_price: Number(
            variant.costPrice || 0,
          ),
          selling_price: Number(
            variant.sellingPrice || 0,
          ),
          is_default: variant.isDefault,
          is_active: variant.isActive,
        }),
      );

      const { error: variantsError } =
        await supabase
          .from("product_variants")
          .insert(variantPayload);

      if (variantsError) {
        /*
         * Remove the product if variant creation fails,
         * preventing a partially-created product.
         */
        await supabase
          .from("products")
          .delete()
          .eq("id", productData.id)
          .eq("company_id", companyId);

        throw new Error(
          `Product could not be completed: ${variantsError.message}`,
        );
      }

      setSuccessMessage(
        "Product created successfully.",
      );

      setTimeout(() => {
        router.push(
          `/products/${productData.id}`,
        );
      }, 500);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the product.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="loading-card">
            <div className="loading-spinner" />
            <span>Loading product workspace...</span>
          </div>

          <style jsx>{`
            .page-content {
              min-height: calc(100vh - 64px);
              padding: 28px;
            }

            .loading-card {
              min-height: 320px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              color: #64748b;
              font-size: 14px;
            }

            .loading-spinner {
              width: 20px;
              height: 20px;
              border: 2px solid #dbe4df;
              border-top-color: #166534;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
            }

            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <div className="page-header">
          <div className="header-left">
            <button
              type="button"
              className="back-button"
              onClick={() => router.push("/products")}
            >
              <ArrowLeft size={17} />
              Back to Products
            </button>

            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Product Management
            </div>

            <h1 className="page-title">
              Create Product
            </h1>

            <p className="page-subtitle">
              Add a product, configure its variants,
              pricing, and inventory tracking.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                router.push("/products")
              }
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="button-spinner" />
                  Creating...
                </>
              ) : (
                <>
                  <Save size={17} />
                  Create Product
                </>
              )}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-error">
            <div className="alert-icon">
              <X size={17} />
            </div>

            <div>
              <strong>Unable to save product</strong>
              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              onClick={() => setErrorMessage("")}
            >
              <X size={17} />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            <div className="alert-icon">
              <Check size={17} />
            </div>

            <div>
              <strong>{successMessage}</strong>
              <p>
                Opening the product details page...
              </p>
            </div>
          </div>
        )}

        <div className="content-grid">
          <main className="main-column">
            <section className="section-card">
              <div className="section-header">
                <div className="section-icon">
                  <Package size={19} />
                </div>

                <div>
                  <h2>Product Information</h2>
                  <p>
                    Basic information customers and
                    staff will see throughout SBS.
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <div className="field field-full">
                  <label>
                    Product Name
                    <span className="required">*</span>
                  </label>

                  <input
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    placeholder="e.g. Dell Latitude 7420"
                    disabled={saving}
                  />
                </div>

                <div className="field">
                  <label>Brand</label>

                  <input
                    value={brand}
                    onChange={(event) =>
                      setBrand(event.target.value)
                    }
                    placeholder="e.g. Dell"
                    disabled={saving}
                  />
                </div>

                <div className="field">
                  <label>Category</label>

                  <input
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value)
                    }
                    placeholder="e.g. Laptops"
                    disabled={saving}
                  />
                </div>

                <div className="field">
                  <label>Product Type</label>

                  <div className="select-wrap">
                    <select
                      value={productType}
                      onChange={(event) =>
                        setProductType(
                          event.target.value,
                        )
                      }
                      disabled={saving}
                    >
                      {PRODUCT_TYPES.map(
                        (type) => (
                          <option
                            key={type.value}
                            value={type.value}
                          >
                            {type.label}
                          </option>
                        ),
                      )}
                    </select>

                    <ChevronDown size={16} />
                  </div>
                </div>

                <div className="field">
                  <label>Tax Rate</label>

                  <div className="input-with-suffix">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={taxRate}
                      onChange={(event) =>
                        setTaxRate(
                          event.target.value,
                        )
                      }
                      disabled={saving}
                    />

                    <span>%</span>
                  </div>
                </div>

                <div className="field field-full">
                  <label>Description</label>

                  <textarea
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value,
                      )
                    }
                    placeholder="Describe the product, specifications, condition, or other useful information..."
                    rows={5}
                    disabled={saving}
                  />
                </div>
              </div>
            </section>

            <section className="section-card">
              <div className="section-header">
                <div className="section-icon">
                  <Boxes size={19} />
                </div>

                <div className="section-heading-row">
                  <div>
                    <h2>Inventory Tracking</h2>
                    <p>
                      Decide whether SBS should track
                      stock for this product.
                    </p>
                  </div>

                  <div
                    className={`tracking-badge ${
                      trackingEnabled
                        ? "tracked"
                        : "not-tracked"
                    }`}
                  >
                    <span />
                    {trackingEnabled
                      ? "Tracked"
                      : "Not Tracked"}
                  </div>
                </div>
              </div>

              <div className="tracking-options">
                <button
                  type="button"
                  className={`tracking-option ${
                    !trackingEnabled
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setTrackingEnabled(false)
                  }
                  disabled={saving}
                >
                  <div className="tracking-radio">
                    {!trackingEnabled && (
                      <span />
                    )}
                  </div>

                  <div>
                    <strong>Not Tracked</strong>
                    <p>
                      SBS will not maintain inventory
                      quantities for this product.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  className={`tracking-option ${
                    trackingEnabled
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setTrackingEnabled(true)
                  }
                  disabled={saving}
                >
                  <div className="tracking-radio">
                    {trackingEnabled && (
                      <span />
                    )}
                  </div>

                  <div>
                    <strong>Tracked</strong>
                    <p>
                      Inventory is tracked through
                      batches/lots, with optional
                      serialized units.
                    </p>
                  </div>
                </button>
              </div>

              {trackingEnabled && (
                <div className="tracking-info">
                  <Layers3 size={17} />

                  <div>
                    <strong>
                      Batch / Lot tracking is automatic
                    </strong>

                    <p>
                      Tracked products use the SBS
                      Inventory V2 hierarchy:
                      Product → Variant → Batch/Lot →
                      optional Serialized Units.
                      Individual serial numbers can be
                      added when stock is received.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="section-card">
              <div className="section-header">
                <div className="section-icon">
                  <Layers3 size={19} />
                </div>

                <div>
                  <h2>Product Variants</h2>
                  <p>
                    SKUs, barcodes, costs, and selling
                    prices belong to variants.
                  </p>
                </div>

                <button
                  type="button"
                  className="add-variant-button"
                  onClick={addVariant}
                  disabled={saving}
                >
                  <Plus size={16} />
                  Add Variant
                </button>
              </div>

              <div className="variant-summary">
                <div>
                  <span>Variants</span>
                  <strong>
                    {totalVariantCount}
                  </strong>
                </div>

                <div>
                  <span>Active</span>
                  <strong>
                    {activeVariantCount}
                  </strong>
                </div>

                <div>
                  <span>Default</span>
                  <strong>
                    {defaultVariant?.name || "—"}
                  </strong>
                </div>
              </div>

              <div className="variants-list">
                {variants.map(
                  (variant, index) => (
                    <div
                      className="variant-card"
                      key={variant.id}
                    >
                      <div className="variant-top">
                        <div className="variant-title">
                          <div className="variant-number">
                            {index + 1}
                          </div>

                          <div>
                            <strong>
                              {variant.name ||
                                `Variant ${
                                  index + 1
                                }`}
                            </strong>

                            {variant.isDefault && (
                              <span className="default-badge">
                                Default
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="variant-actions">
                          <button
                            type="button"
                            className={`default-button ${
                              variant.isDefault
                                ? "active"
                                : ""
                            }`}
                            onClick={() =>
                              setDefaultVariant(
                                variant.id,
                              )
                            }
                            disabled={
                              saving ||
                              variant.isDefault
                            }
                          >
                            <Check size={14} />
                            {variant.isDefault
                              ? "Default"
                              : "Set Default"}
                          </button>

                          {variants.length > 1 && (
                            <button
                              type="button"
                              className="icon-danger"
                              title="Remove variant"
                              onClick={() =>
                                removeVariant(
                                  variant.id,
                                )
                              }
                              disabled={saving}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="variant-grid">
                        <div className="field">
                          <label>
                            Variant Name
                            <span className="required">
                              *
                            </span>
                          </label>

                          <input
                            value={variant.name}
                            onChange={(event) =>
                              updateVariant(
                                variant.id,
                                "name",
                                event.target.value,
                              )
                            }
                            placeholder="e.g. i7 / 16GB / 512GB"
                            disabled={saving}
                          />
                        </div>

                        <div className="field">
                          <label>SKU</label>

                          <div className="input-with-icon">
                            <Barcode
                              size={16}
                            />

                            <input
                              value={variant.sku}
                              onChange={(event) =>
                                updateVariant(
                                  variant.id,
                                  "sku",
                                  event.target.value,
                                )
                              }
                              placeholder="e.g. DELL-7420-I7"
                              disabled={saving}
                            />
                          </div>
                        </div>

                        <div className="field">
                          <label>Barcode</label>

                          <div className="input-with-icon">
                            <Barcode
                              size={16}
                            />

                            <input
                              value={
                                variant.barcode
                              }
                              onChange={(event) =>
                                updateVariant(
                                  variant.id,
                                  "barcode",
                                  event.target.value,
                                )
                              }
                              placeholder="UPC / EAN / internal barcode"
                              disabled={saving}
                            />
                          </div>
                        </div>

                        <div className="field">
                          <label>Cost Price</label>

                          <div className="input-with-icon">
                            <DollarSign
                              size={16}
                            />

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                variant.costPrice
                              }
                              onChange={(event) =>
                                updateVariant(
                                  variant.id,
                                  "costPrice",
                                  event.target.value,
                                )
                              }
                              placeholder="0.00"
                              disabled={saving}
                            />
                          </div>
                        </div>

                        <div className="field">
                          <label>
                            Selling Price
                          </label>

                          <div className="input-with-icon">
                            <DollarSign
                              size={16}
                            />

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                variant.sellingPrice
                              }
                              onChange={(event) =>
                                updateVariant(
                                  variant.id,
                                  "sellingPrice",
                                  event.target.value,
                                )
                              }
                              placeholder="0.00"
                              disabled={saving}
                            />
                          </div>
                        </div>

                        <div className="field status-field">
                          <label>Variant Status</label>

                          <button
                            type="button"
                            className={`status-toggle ${
                              variant.isActive
                                ? "active"
                                : ""
                            }`}
                            onClick={() =>
                              updateVariant(
                                variant.id,
                                "isActive",
                                !variant.isActive,
                              )
                            }
                            disabled={saving}
                          >
                            <span className="toggle-track">
                              <span className="toggle-thumb" />
                            </span>

                            <span>
                              {variant.isActive
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>

              <button
                type="button"
                className="add-variant-large"
                onClick={addVariant}
                disabled={saving}
              >
                <Plus size={17} />
                Add Another Variant
              </button>
            </section>
          </main>

          <aside className="side-column">
            <section className="preview-card">
              <div className="preview-label">
                PRODUCT PREVIEW
              </div>

              <div className="preview-icon">
                <Package size={24} />
              </div>

              <h3>
                {name.trim() || "New Product"}
              </h3>

              <p>
                {brand.trim() ||
                  category.trim() ||
                  "Product details"}
              </p>

              <div className="preview-divider" />

              <div className="preview-row">
                <span>Type</span>
                <strong>
                  {productType === "physical"
                    ? "Physical"
                    : "Service"}
                </strong>
              </div>

              <div className="preview-row">
                <span>Tracking</span>
                <strong>
                  {trackingEnabled
                    ? "Tracked"
                    : "Not Tracked"}
                </strong>
              </div>

              <div className="preview-row">
                <span>Variants</span>
                <strong>
                  {totalVariantCount}
                </strong>
              </div>

              <div className="preview-row">
                <span>Default</span>
                <strong>
                  {defaultVariant?.name || "—"}
                </strong>
              </div>
            </section>

            <section className="side-card">
              <div className="side-card-header">
                <div className="small-icon">
                  <DollarSign size={17} />
                </div>

                <div>
                  <h3>Pricing</h3>
                  <p>
                    Default variant pricing
                  </p>
                </div>
              </div>

              <div className="price-summary">
                <div>
                  <span>Cost</span>
                  <strong>
                    $
                    {Number(
                      defaultVariant?.costPrice ||
                        0,
                    ).toFixed(2)}
                  </strong>
                </div>

                <div>
                  <span>Selling</span>
                  <strong>
                    $
                    {Number(
                      defaultVariant?.sellingPrice ||
                        0,
                    ).toFixed(2)}
                  </strong>
                </div>
              </div>
            </section>

            <section className="side-card">
              <div className="side-card-header">
                <div className="small-icon">
                  <Boxes size={17} />
                </div>

                <div>
                  <h3>Inventory Logic</h3>
                  <p>
                    How SBS will handle this product
                  </p>
                </div>
              </div>

              {trackingEnabled ? (
                <div className="logic-list">
                  <div>
                    <span className="logic-check">
                      <Check size={12} />
                    </span>
                    <span>
                      Inventory quantities tracked
                    </span>
                  </div>

                  <div>
                    <span className="logic-check">
                      <Check size={12} />
                    </span>
                    <span>
                      Batch / lot tracking
                    </span>
                  </div>

                  <div>
                    <span className="logic-check">
                      <Check size={12} />
                    </span>
                    <span>
                      Optional serial numbers
                    </span>
                  </div>

                  <div>
                    <span className="logic-check">
                      <Check size={12} />
                    </span>
                    <span>
                      Warehouse/location stock
                    </span>
                  </div>
                </div>
              ) : (
                <div className="not-tracked-message">
                  <Package size={18} />

                  <div>
                    <strong>
                      Inventory disabled
                    </strong>

                    <p>
                      This product will not create
                      inventory batches or stock
                      balances.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="side-card">
              <div className="side-card-header">
                <div className="small-icon">
                  <Check size={17} />
                </div>

                <div>
                  <h3>Before You Create</h3>
                  <p>
                    Quick checklist
                  </p>
                </div>
              </div>

              <div className="checklist">
                <div
                  className={
                    name.trim()
                      ? "complete"
                      : ""
                  }
                >
                  <span>
                    {name.trim() ? (
                      <Check size={12} />
                    ) : (
                      "1"
                    )}
                  </span>
                  Product name
                </div>

                <div
                  className={
                    variants.length > 0
                      ? "complete"
                      : ""
                  }
                >
                  <span>
                    <Check size={12} />
                  </span>
                  At least one variant
                </div>

                <div
                  className={
                    variants.some(
                      (variant) =>
                        variant.isDefault,
                    )
                      ? "complete"
                      : ""
                  }
                >
                  <span>
                    <Check size={12} />
                  </span>
                  Default variant
                </div>

                <div
                  className={
                    hasValidPrices
                      ? "complete"
                      : ""
                  }
                >
                  <span>
                    <Check size={12} />
                  </span>
                  Valid pricing
                </div>
              </div>
            </section>
          </aside>
        </div>

        <div className="bottom-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push("/products")
            }
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="button-spinner" />
                Creating...
              </>
            ) : (
              <>
                <Save size={17} />
                Create Product
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .page-content {
          min-height: calc(100vh - 64px);
          padding: 28px;
          background: #f6f8f7;
        }

        .page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .header-left {
          min-width: 0;
        }

        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 0;
          background: transparent;
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          padding: 0;
          margin-bottom: 16px;
          cursor: pointer;
        }

        .back-button:hover {
          color: #166534;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 7px;
        }

        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #16a34a;
        }

        .page-title {
          margin: 0;
          color: #172033;
          font-size: 30px;
          line-height: 1.15;
          font-weight: 750;
          letter-spacing: -0.02em;
        }

        .page-subtitle {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.5;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .primary-button,
        .secondary-button {
          min-height: 40px;
          padding: 0 15px;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition:
            background 0.15s,
            border-color 0.15s,
            transform 0.15s;
        }

        .primary-button {
          border: 1px solid #166534;
          background: #166534;
          color: white;
        }

        .primary-button:hover:not(:disabled) {
          background: #14532d;
        }

        .secondary-button {
          border: 1px solid #d6dce2;
          background: white;
          color: #334155;
        }

        .secondary-button:hover:not(:disabled) {
          border-color: #b8c2cc;
          background: #f8fafc;
        }

        .primary-button:disabled,
        .secondary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .button-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255, 255, 255, 0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 13px 15px;
          border-radius: 11px;
          margin-bottom: 20px;
        }

        .alert-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .alert-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .alert-icon {
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.6);
        }

        .alert > div:nth-child(2) {
          flex: 1;
        }

        .alert strong {
          display: block;
          font-size: 13px;
          margin-bottom: 2px;
        }

        .alert p {
          margin: 0;
          font-size: 12px;
          line-height: 1.5;
        }

        .alert > button {
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          padding: 4px;
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 330px;
          gap: 20px;
          align-items: start;
        }

        .main-column,
        .side-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }

        .section-card,
        .side-card,
        .preview-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .section-card {
          padding: 22px;
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 22px;
        }

        .section-icon,
        .small-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #166534;
          background: #f0fdf4;
          border: 1px solid #dcfce7;
          border-radius: 9px;
        }

        .section-icon {
          width: 38px;
          height: 38px;
        }

        .small-icon {
          width: 34px;
          height: 34px;
        }

        .section-header h2 {
          margin: 0;
          color: #1e293b;
          font-size: 16px;
          font-weight: 750;
        }

        .section-header p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.45;
        }

        .section-heading-row {
          flex: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .field {
          min-width: 0;
        }

        .field-full {
          grid-column: 1 / -1;
        }

        .field label {
          display: block;
          color: #334155;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 7px;
        }

        .required {
          color: #dc2626;
          margin-left: 3px;
        }

        .field input,
        .field textarea,
        .field select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d9dee5;
          background: white;
          color: #172033;
          border-radius: 8px;
          outline: none;
          font: inherit;
          font-size: 13px;
          transition:
            border-color 0.15s,
            box-shadow 0.15s;
        }

        .field input,
        .field select {
          height: 40px;
          padding: 0 11px;
        }

        .field textarea {
          padding: 10px 11px;
          resize: vertical;
          min-height: 110px;
          line-height: 1.5;
        }

        .field input:focus,
        .field textarea:focus,
        .field select:focus {
          border-color: #86b89a;
          box-shadow: 0 0 0 3px #f0fdf4;
        }

        .field input::placeholder,
        .field textarea::placeholder {
          color: #94a3b8;
        }

        .select-wrap {
          position: relative;
        }

        .select-wrap select {
          appearance: none;
          padding-right: 34px;
        }

        .select-wrap svg {
          position: absolute;
          right: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          pointer-events: none;
        }

        .input-with-suffix,
        .input-with-icon {
          position: relative;
        }

        .input-with-suffix input {
          padding-right: 38px;
        }

        .input-with-suffix span {
          position: absolute;
          right: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .input-with-icon svg {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .input-with-icon input {
          padding-left: 35px;
        }

        .tracking-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .tracking-option {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          text-align: left;
          padding: 15px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 11px;
          cursor: pointer;
          transition:
            border-color 0.15s,
            background 0.15s;
        }

        .tracking-option:hover {
          border-color: #b8cfc0;
          background: #fbfdfb;
        }

        .tracking-option.selected {
          border-color: #86b89a;
          background: #f5fbf7;
        }

        .tracking-radio {
          width: 18px;
          height: 18px;
          border: 2px solid #cbd5e1;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 1px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tracking-option.selected
          .tracking-radio {
          border-color: #166534;
        }

        .tracking-radio span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #166534;
        }

        .tracking-option strong {
          display: block;
          color: #1e293b;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .tracking-option p {
          margin: 0;
          color: #64748b;
          font-size: 11px;
          line-height: 1.45;
        }

        .tracking-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 750;
          flex-shrink: 0;
        }

        .tracking-badge span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .tracking-badge.tracked {
          background: #f0fdf4;
          color: #166534;
        }

        .tracking-badge.tracked span {
          background: #16a34a;
        }

        .tracking-badge.not-tracked {
          background: #f1f5f9;
          color: #64748b;
        }

        .tracking-badge.not-tracked span {
          background: #94a3b8;
        }

        .tracking-info {
          display: flex;
          gap: 11px;
          align-items: flex-start;
          margin-top: 14px;
          padding: 13px;
          border: 1px solid #dcfce7;
          border-radius: 10px;
          background: #f7fdf9;
          color: #166534;
        }

        .tracking-info > svg {
          flex-shrink: 0;
          margin-top: 1px;
        }

        .tracking-info strong {
          display: block;
          font-size: 12px;
          margin-bottom: 3px;
        }

        .tracking-info p {
          margin: 0;
          color: #52705d;
          font-size: 11px;
          line-height: 1.5;
        }

        .add-variant-button {
          margin-left: auto;
          flex-shrink: 0;
          height: 36px;
          padding: 0 11px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid #b8d0be;
          background: white;
          color: #166534;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .add-variant-button:hover:not(:disabled) {
          background: #f5fbf7;
        }

        .add-variant-button:disabled,
        .add-variant-large:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .variant-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .variant-summary > div {
          padding: 11px 13px;
          background: #f8fafc;
          border-right: 1px solid #e5e7eb;
        }

        .variant-summary > div:last-child {
          border-right: 0;
        }

        .variant-summary span {
          display: block;
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
          margin-bottom: 3px;
        }

        .variant-summary strong {
          display: block;
          color: #1e293b;
          font-size: 13px;
        }

        .variants-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .variant-card {
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          overflow: hidden;
          background: #fff;
        }

        .variant-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
        }

        .variant-title {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .variant-number {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border: 1px solid #dce2e8;
          color: #64748b;
          font-size: 11px;
          font-weight: 750;
        }

        .variant-title strong {
          color: #1e293b;
          font-size: 13px;
        }

        .default-badge {
          display: inline-flex;
          margin-left: 7px;
          padding: 3px 7px;
          border-radius: 999px;
          background: #dcfce7;
          color: #166534;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .variant-actions {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
        }

        .default-button {
          height: 30px;
          padding: 0 9px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: 1px solid #d7dee5;
          border-radius: 7px;
          background: white;
          color: #64748b;
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
        }

        .default-button:hover:not(:disabled) {
          border-color: #a9c2b0;
          color: #166534;
        }

        .default-button.active {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .icon-danger {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e2e8f0;
          border-radius: 7px;
          background: white;
          color: #94a3b8;
          cursor: pointer;
        }

        .icon-danger:hover:not(:disabled) {
          border-color: #fecaca;
          color: #dc2626;
          background: #fffafa;
        }

        .icon-danger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .variant-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          padding: 16px;
        }

        .status-field {
          display: flex;
          flex-direction: column;
        }

        .status-toggle {
          height: 40px;
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid #d9dee5;
          background: white;
          border-radius: 8px;
          padding: 0 10px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .toggle-track {
          width: 31px;
          height: 18px;
          padding: 2px;
          display: flex;
          align-items: center;
          border-radius: 999px;
          background: #cbd5e1;
          transition: background 0.15s;
        }

        .toggle-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.18);
          transition: transform 0.15s;
        }

        .status-toggle.active {
          color: #166534;
        }

        .status-toggle.active
          .toggle-track {
          background: #166534;
        }

        .status-toggle.active
          .toggle-thumb {
          transform: translateX(13px);
        }

        .add-variant-large {
          width: 100%;
          min-height: 42px;
          margin-top: 14px;
          border: 1px dashed #bfd1c4;
          background: #fbfdfb;
          color: #166534;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .add-variant-large:hover:not(:disabled) {
          background: #f5fbf7;
          border-color: #9fbea7;
        }

        .preview-card {
          padding: 21px;
          position: relative;
          overflow: hidden;
        }

        .preview-card::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 3px;
          background: #166534;
        }

        .preview-label {
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin-bottom: 16px;
        }

        .preview-icon {
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0fdf4;
          border: 1px solid #dcfce7;
          border-radius: 12px;
          color: #166534;
          margin-bottom: 13px;
        }

        .preview-card h3 {
          margin: 0;
          color: #172033;
          font-size: 17px;
          line-height: 1.3;
          word-break: break-word;
        }

        .preview-card > p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .preview-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 18px 0 12px;
        }

        .preview-row {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 7px 0;
          font-size: 12px;
        }

        .preview-row span {
          color: #64748b;
        }

        .preview-row strong {
          color: #1e293b;
          text-align: right;
        }

        .side-card {
          padding: 17px;
        }

        .side-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }

        .side-card-header h3 {
          margin: 0;
          color: #1e293b;
          font-size: 13px;
          font-weight: 750;
        }

        .side-card-header p {
          margin: 3px 0 0;
          color: #94a3b8;
          font-size: 10px;
        }

        .price-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }

        .price-summary > div {
          padding: 12px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
        }

        .price-summary span {
          display: block;
          color: #64748b;
          font-size: 10px;
          margin-bottom: 5px;
        }

        .price-summary strong {
          color: #172033;
          font-size: 15px;
        }

        .logic-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .logic-list > div {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475569;
          font-size: 11px;
        }

        .logic-check {
          width: 19px;
          height: 19px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: #f0fdf4;
          color: #166534;
          flex-shrink: 0;
        }

        .not-tracked-message {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 11px;
          border-radius: 9px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          color: #64748b;
        }

        .not-tracked-message svg {
          flex-shrink: 0;
          margin-top: 1px;
        }

        .not-tracked-message strong {
          display: block;
          color: #334155;
          font-size: 11px;
          margin-bottom: 3px;
        }

        .not-tracked-message p {
          margin: 0;
          font-size: 10px;
          line-height: 1.45;
        }

        .checklist {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .checklist > div {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-size: 11px;
        }

        .checklist > div > span {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: #f1f5f9;
          color: #94a3b8;
          font-size: 9px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .checklist > div.complete {
          color: #475569;
        }

        .checklist > div.complete > span {
          background: #f0fdf4;
          color: #166534;
        }

        .bottom-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1100px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .side-column {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-items: start;
          }

          .preview-card {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 20px 16px;
          }

          .page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }

          .form-grid,
          .tracking-options,
          .variant-grid {
            grid-template-columns: 1fr;
          }

          .field-full {
            grid-column: auto;
          }

          .side-column {
            grid-template-columns: 1fr;
          }

          .variant-top {
            align-items: flex-start;
            flex-direction: column;
          }

          .variant-actions {
            width: 100%;
            justify-content: flex-end;
          }

          .section-heading-row {
            flex-direction: column;
          }

          .add-variant-button {
            margin-left: auto;
          }
        }

        @media (max-width: 520px) {
          .page-title {
            font-size: 25px;
          }

          .section-card {
            padding: 16px;
          }

          .section-header {
            flex-wrap: wrap;
          }

          .add-variant-button {
            width: 100%;
          }

          .variant-summary {
            grid-template-columns: 1fr;
          }

          .variant-summary > div {
            border-right: 0;
            border-bottom: 1px solid #e5e7eb;
          }

          .variant-summary > div:last-child {
            border-bottom: 0;
          }

          .bottom-actions {
            flex-direction: column-reverse;
          }

          .bottom-actions button {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}