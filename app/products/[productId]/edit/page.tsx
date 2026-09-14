"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Package,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  company_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  category: string | null;
  brand: string | null;
  product_type: string;
  status: string;
  track_inventory: boolean;
  tax_rate: number;
  tracking_mode: string;
  created_at: string;
  updated_at: string;
};

type Variant = {
  id: string;
  company_id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  cost_price: number;
  selling_price: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type VariantForm = {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  cost_price: string;
  selling_price: string;
  is_default: boolean;
  is_active: boolean;
};

type Toast = {
  type: "success" | "error";
  message: string;
} | null;

function createVariantForm(variant?: Variant): VariantForm {
  if (!variant) {
    return {
      name: "Default",
      sku: "",
      barcode: "",
      cost_price: "0",
      selling_price: "0",
      is_default: true,
      is_active: true,
    };
  }

  return {
    id: variant.id,
    name: variant.name || "Default",
    sku: variant.sku || "",
    barcode: variant.barcode || "",
    cost_price: String(variant.cost_price ?? 0),
    selling_price: String(variant.selling_price ?? 0),
    is_default: Boolean(variant.is_default),
    is_active: Boolean(variant.is_active),
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ProductEditPage() {
  const params = useParams<{ productId: string }>();
  const router = useRouter();

  const productId = params?.productId;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("physical");
  const [taxRate, setTaxRate] = useState("0");

  // User-facing inventory model is intentionally simplified:
  // Not Tracked / Tracked.
  const [inventoryTracked, setInventoryTracked] = useState(true);

  const [status, setStatus] = useState("active");

  const [variantForms, setVariantForms] = useState<VariantForm[]>([]);
  const [expandedVariant, setExpandedVariant] = useState<number | null>(0);

  const [toast, setToast] = useState<Toast>(null);

  const showToast = useCallback((nextToast: Toast) => {
    setToast(nextToast);

    if (nextToast) {
      window.setTimeout(() => {
        setToast(null);
      }, 4000);
    }
  }, []);

  const loadProduct = useCallback(async () => {
    if (!productId) return;

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membershipData, error: membershipError } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membershipData?.company_id) {
        throw new Error("No company workspace is available for this user.");
      }

      const currentCompanyId = membershipData.company_id;

      setCompanyId(currentCompanyId);

      const [
        { data: productData, error: productError },
        { data: variantData, error: variantError },
      ] = await Promise.all([
        supabase
          .from("products")
          .select(
            `
              id,
              company_id,
              name,
              slug,
              description,
              category,
              brand,
              product_type,
              status,
              track_inventory,
              tax_rate,
              tracking_mode,
              created_at,
              updated_at
            `,
          )
          .eq("company_id", currentCompanyId)
          .eq("id", productId)
          .maybeSingle(),

        supabase
          .from("product_variants")
          .select(
            `
              id,
              company_id,
              product_id,
              name,
              sku,
              barcode,
              cost_price,
              selling_price,
              is_default,
              is_active,
              created_at,
              updated_at
            `,
          )
          .eq("company_id", currentCompanyId)
          .eq("product_id", productId)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true }),
      ]);

      if (productError) throw productError;
      if (variantError) throw variantError;

      if (!productData) {
        throw new Error("Product not found.");
      }

      const loadedProduct = productData as Product;
      const loadedVariants = (variantData || []) as Variant[];

      setProduct(loadedProduct);
      setVariants(loadedVariants);

      setName(loadedProduct.name || "");
      setSlug(loadedProduct.slug || slugify(loadedProduct.name || ""));
      setDescription(loadedProduct.description || "");
      setBrand(loadedProduct.brand || "");
      setCategory(loadedProduct.category || "");
      setProductType(loadedProduct.product_type || "physical");
      setTaxRate(String(loadedProduct.tax_rate ?? 0));
      setStatus(loadedProduct.status || "active");

      /*
       * Compatibility handling:
       *
       * Existing products may historically have:
       *   none
       *   quantity
       *   batch
       *   serial
       *
       * The UI only exposes:
       *   Not Tracked
       *   Tracked
       *
       * Any existing tracked mode remains Tracked.
       */
      setInventoryTracked(
        loadedProduct.track_inventory !== false &&
          loadedProduct.tracking_mode !== "none",
      );

      if (loadedVariants.length > 0) {
        setVariantForms(loadedVariants.map(createVariantForm));
        setExpandedVariant(0);
      } else {
        setVariantForms([createVariantForm()]);
        setExpandedVariant(0);
      }
    } catch (error) {
      console.error("Failed to load product:", error);

      showToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load this product.",
      });
    } finally {
      setLoading(false);
    }
  }, [productId, router, showToast, supabase]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const totalVariants = variantForms.length;

  const activeVariants = variantForms.filter(
    (variant) => variant.is_active,
  ).length;

  const defaultVariantIndex = variantForms.findIndex(
    (variant) => variant.is_default,
  );

  const totalCostValue = variantForms.reduce(
    (sum, variant) => sum + (Number(variant.cost_price) || 0),
    0,
  );

  const totalSellingValue = variantForms.reduce(
    (sum, variant) => sum + (Number(variant.selling_price) || 0),
    0,
  );

  function updateVariant(
    index: number,
    field: keyof VariantForm,
    value: string | boolean,
  ) {
    setVariantForms((current) =>
      current.map((variant, variantIndex) => {
        if (variantIndex !== index) return variant;

        return {
          ...variant,
          [field]: value,
        };
      }),
    );
  }

  function setDefaultVariant(index: number) {
    setVariantForms((current) =>
      current.map((variant, variantIndex) => ({
        ...variant,
        is_default: variantIndex === index,
      })),
    );
  }

  function addVariant() {
    const nextVariant: VariantForm = {
      name: `Variant ${variantForms.length + 1}`,
      sku: "",
      barcode: "",
      cost_price: "0",
      selling_price: "0",
      is_default: variantForms.length === 0,
      is_active: true,
    };

    setVariantForms((current) => [...current, nextVariant]);
    setExpandedVariant(variantForms.length);
  }

  function removeVariant(index: number) {
    setVariantForms((current) => {
      if (current.length <= 1) {
        return current;
      }

      const removingDefault = current[index]?.is_default;

      const next = current.filter((_, variantIndex) => variantIndex !== index);

      if (removingDefault && next.length > 0) {
        next[0] = {
          ...next[0],
          is_default: true,
        };
      }

      return next;
    });

    setExpandedVariant((current) => {
      if (current === null) return null;
      if (current === index) return null;
      if (current > index) return current - 1;
      return current;
    });
  }

  function handleNameBlur() {
    if (!slug.trim() && name.trim()) {
      setSlug(slugify(name));
    }
  }

  function validateForm() {
    if (!companyId) {
      return "Company workspace could not be resolved.";
    }

    if (!name.trim()) {
      return "Product name is required.";
    }

    if (!slug.trim()) {
      return "Product slug is required.";
    }

    const parsedTaxRate = Number(taxRate);

    if (!Number.isFinite(parsedTaxRate) || parsedTaxRate < 0) {
      return "Tax rate must be a valid non-negative number.";
    }

    if (parsedTaxRate > 100) {
      return "Tax rate cannot exceed 100%.";
    }

    if (variantForms.length === 0) {
      return "At least one product variant is required.";
    }

    const defaultCount = variantForms.filter(
      (variant) => variant.is_default,
    ).length;

    if (defaultCount !== 1) {
      return "Exactly one variant must be the default variant.";
    }

    const skuValues = new Map<string, number[]>();
    const barcodeValues = new Map<string, number[]>();

    for (let index = 0; index < variantForms.length; index += 1) {
      const variant = variantForms[index];

      if (!variant.name.trim()) {
        return `Variant ${index + 1} needs a name.`;
      }

      const cost = Number(variant.cost_price);
      const selling = Number(variant.selling_price);

      if (!Number.isFinite(cost) || cost < 0) {
        return `Variant ${index + 1} has an invalid cost price.`;
      }

      if (!Number.isFinite(selling) || selling < 0) {
        return `Variant ${index + 1} has an invalid selling price.`;
      }

      const sku = variant.sku.trim().toLowerCase();

      if (sku) {
        const existing = skuValues.get(sku) || [];
        existing.push(index);
        skuValues.set(sku, existing);
      }

      const barcode = variant.barcode.trim().toLowerCase();

      if (barcode) {
        const existing = barcodeValues.get(barcode) || [];
        existing.push(index);
        barcodeValues.set(barcode, existing);
      }
    }

    for (const [, indexes] of skuValues) {
      if (indexes.length > 1) {
        return `Duplicate SKU found in variants ${indexes
          .map((index) => index + 1)
          .join(", ")}.`;
      }
    }

    for (const [, indexes] of barcodeValues) {
      if (indexes.length > 1) {
        return `Duplicate barcode found in variants ${indexes
          .map((index) => index + 1)
          .join(", ")}.`;
      }
    }

    return null;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      showToast({
        type: "error",
        message: validationError,
      });
      return;
    }

    if (!companyId || !productId) return;

    setSaving(true);

    try {
      /*
       * IMPORTANT:
       *
       * The public UI has only two tracking choices:
       *
       * Not Tracked -> none
       * Tracked     -> batch
       *
       * Existing serial-mode products remain compatible because changing
       * the product to "Tracked" does not blindly rewrite historical data.
       *
       * We deliberately use batch as the canonical V2 tracked mode.
       */
      const nextTrackingMode = inventoryTracked ? "batch" : "none";

      const parsedTaxRate = Number(taxRate);

      const { error: productUpdateError } = await supabase
        .from("products")
        .update({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          brand: brand.trim() || null,
          category: category.trim() || null,
          product_type: productType,
          status,
          track_inventory: inventoryTracked,
          tax_rate: parsedTaxRate,
          tracking_mode: nextTrackingMode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId)
        .eq("company_id", companyId);

      if (productUpdateError) {
        throw productUpdateError;
      }

      /*
       * Update existing variants and create new variants.
       *
       * We don't delete existing database variants automatically because
       * variants may already be referenced by inventory, purchase orders,
       * invoices, serials, etc.
       *
       * Removing a variant from this editor therefore means deactivating it,
       * not destructive deletion.
       */

      const existingVariantIds = new Set(
        variants.map((variant) => variant.id),
      );

      const formVariantIds = new Set(
        variantForms
          .map((variant) => variant.id)
          .filter((id): id is string => Boolean(id)),
      );

      for (const variantForm of variantForms) {
        const payload = {
          company_id: companyId,
          product_id: productId,
          name: variantForm.name.trim(),
          sku: variantForm.sku.trim() || null,
          barcode: variantForm.barcode.trim() || null,
          cost_price: Number(variantForm.cost_price) || 0,
          selling_price: Number(variantForm.selling_price) || 0,
          is_default: variantForm.is_default,
          is_active: variantForm.is_active,
          updated_at: new Date().toISOString(),
        };

        if (variantForm.id && existingVariantIds.has(variantForm.id)) {
          const { error } = await supabase
            .from("product_variants")
            .update(payload)
            .eq("id", variantForm.id)
            .eq("product_id", productId)
            .eq("company_id", companyId);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("product_variants")
            .insert({
              ...payload,
              created_at: new Date().toISOString(),
            });

          if (error) throw error;
        }
      }

      /*
       * Variants removed from the editor are deactivated rather than
       * physically deleted.
       *
       * This preserves historical references.
       */
      for (const existingVariant of variants) {
        if (!formVariantIds.has(existingVariant.id)) {
          const { error } = await supabase
            .from("product_variants")
            .update({
              is_active: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingVariant.id)
            .eq("product_id", productId)
            .eq("company_id", companyId);

          if (error) throw error;
        }
      }

      showToast({
        type: "success",
        message: "Product updated successfully.",
      });

      await loadProduct();
    } catch (error) {
      console.error("Failed to save product:", error);

      showToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save product changes.",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleSlugChange(event: ChangeEvent<HTMLInputElement>) {
    setSlug(event.target.value.toLowerCase().replace(/\s+/g, "-"));
  }

  if (loading) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="loading-shell">
            <div className="loading-spinner" />
            <span>Loading product...</span>
          </div>

          <style jsx>{`
            .page-content {
              min-height: 100vh;
              padding: 28px 32px 48px;
            }

            .inventory-page {
              background: #f8fafc;
            }

            .loading-shell {
              min-height: 420px;
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
              border: 2px solid #dbe4ea;
              border-top-color: #166534;
              border-radius: 999px;
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

  if (!product) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="not-found-card">
            <div className="not-found-icon">
              <Package size={22} />
            </div>

            <h1>Product not found</h1>
            <p>
              This product may have been deleted, moved to another company,
              or you may not have access to it.
            </p>

            <Link href="/products" className="back-button">
              <ArrowLeft size={16} />
              Back to Products
            </Link>
          </div>

          <style jsx>{`
            .page-content {
              min-height: 100vh;
              padding: 32px;
            }

            .inventory-page {
              background: #f8fafc;
            }

            .not-found-card {
              max-width: 560px;
              margin: 80px auto;
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 16px;
              padding: 36px;
              text-align: center;
              box-shadow: 0 8px 30px rgba(15, 23, 42, 0.05);
            }

            .not-found-icon {
              width: 52px;
              height: 52px;
              margin: 0 auto 18px;
              border-radius: 14px;
              background: #f1f5f9;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #475569;
            }

            h1 {
              margin: 0;
              color: #0f172a;
              font-size: 24px;
              font-weight: 700;
            }

            p {
              margin: 10px 0 24px;
              color: #64748b;
              font-size: 14px;
              line-height: 1.6;
            }

            .back-button {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 10px 15px;
              border-radius: 9px;
              background: #166534;
              color: white;
              text-decoration: none;
              font-size: 14px;
              font-weight: 600;
            }
          `}</style>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content inventory-page">
        {toast && (
          <div
            className={`toast ${toast.type === "success" ? "success" : "error"}`}
          >
            <div className="toast-icon">
              {toast.type === "success" ? (
                <Check size={16} />
              ) : (
                <X size={16} />
              )}
            </div>

            <span>{toast.message}</span>

            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Close notification"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <form onSubmit={handleSave}>
          <div className="page-header">
            <div className="header-left">
              <button
  type="button"
  className="back-link"
  onClick={() => router.push(`/products/${productId}`)}
>
  <ArrowLeft size={17} />
  Product Details
</button>

              <div className="eyebrow">
                <span className="eyebrow-dot" />
                PRODUCT MANAGEMENT
              </div>

              <h1 className="page-title">Edit Product</h1>

              <p className="page-subtitle">
                Update product information, variants, pricing, and inventory
                configuration.
              </p>
            </div>

            <div className="header-actions">
              <button
  type="button"
  className="button secondary"
  onClick={() => router.push(`/products/${productId}`)}
>
  Cancel
</button>

              <button
                type="submit"
                className="button primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="button-spinner" />
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
          </div>

          <div className="layout">
            <main className="main-column">
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>Product Information</h2>
                    <p>Core information used throughout SBS.</p>
                  </div>

                  <div
                    className={`status-pill ${
                      status === "active" ? "active" : "inactive"
                    }`}
                  >
                    <span />
                    {status === "active" ? "Active" : "Inactive"}
                  </div>
                </div>

                <div className="form-grid">
                  <div className="field field-wide">
                    <label htmlFor="product-name">
                      Product Name <span>*</span>
                    </label>

                    <input
                      id="product-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      onBlur={handleNameBlur}
                      placeholder="e.g. Dell Latitude 7420"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="product-slug">
                      Slug <span>*</span>
                    </label>

                    <input
                      id="product-slug"
                      value={slug}
                      onChange={handleSlugChange}
                      placeholder="dell-latitude-7420"
                    />

                    <small>
                      Used for internal/product URLs and integrations.
                    </small>
                  </div>

                  <div className="field">
                    <label htmlFor="brand">Brand</label>

                    <input
                      id="brand"
                      value={brand}
                      onChange={(event) => setBrand(event.target.value)}
                      placeholder="e.g. Dell"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="category">Category</label>

                    <input
                      id="category"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      placeholder="e.g. Laptops"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="product-type">Product Type</label>

                    <select
                      id="product-type"
                      value={productType}
                      onChange={(event) => setProductType(event.target.value)}
                    >
                      <option value="physical">Physical</option>
                      <option value="service">Service</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="product-status">Status</label>

                    <select
                      id="product-status"
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="tax-rate">Tax Rate (%)</label>

                    <input
                      id="tax-rate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={taxRate}
                      onChange={(event) => setTaxRate(event.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div className="field field-wide">
                    <label htmlFor="description">Description</label>

                    <textarea
                      id="description"
                      value={description}
                      onChange={(event) =>
                        setDescription(event.target.value)
                      }
                      placeholder="Describe the product..."
                      rows={5}
                    />
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>Inventory Tracking</h2>
                    <p>
                      Configure whether SBS should track inventory for this
                      product.
                    </p>
                  </div>
                </div>

                <div className="tracking-options">
                  <button
                    type="button"
                    className={`tracking-option ${
                      !inventoryTracked ? "selected" : ""
                    }`}
                    onClick={() => setInventoryTracked(false)}
                  >
                    <div className="tracking-radio">
                      {!inventoryTracked && <span />}
                    </div>

                    <div className="tracking-content">
                      <strong>Not Tracked</strong>
                      <p>
                        SBS will not maintain inventory quantities, batches, or
                        serial identities for this product.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`tracking-option ${
                      inventoryTracked ? "selected" : ""
                    }`}
                    onClick={() => setInventoryTracked(true)}
                  >
                    <div className="tracking-radio">
                      {inventoryTracked && <span />}
                    </div>

                    <div className="tracking-content">
                      <strong>Tracked</strong>
                      <p>
                        Inventory is tracked through the SBS V2 hierarchy:
                        Product → Variant → Batch/Lot → optional Serial
                        Numbers.
                      </p>
                    </div>
                  </button>
                </div>

                <div className="tracking-note">
                  <Package size={16} />

                  <div>
                    <strong>Inventory V2</strong>
                    <p>
                      Tracked products use batches/lots as the primary
                      inventory layer. Serial numbers are optional child
                      identities inside a batch, so partial serialization is
                      supported.
                    </p>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>Variants</h2>
                    <p>
                      Manage SKU, barcode, pricing, and variant status.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="button secondary"
                    onClick={addVariant}
                  >
                    <Plus size={16} />
                    Add Variant
                  </button>
                </div>

                <div className="variant-summary">
                  <div className="summary-item">
                    <span>Total Variants</span>
                    <strong>{totalVariants}</strong>
                  </div>

                  <div className="summary-item">
                    <span>Active</span>
                    <strong>{activeVariants}</strong>
                  </div>

                  <div className="summary-item">
                    <span>Default</span>
                    <strong>
                      {defaultVariantIndex >= 0
                        ? variantForms[defaultVariantIndex]?.name || "—"
                        : "—"}
                    </strong>
                  </div>

                  <div className="summary-item">
                    <span>Avg. Cost</span>
                    <strong>
                      {totalVariants > 0
                        ? (totalCostValue / totalVariants).toFixed(2)
                        : "0.00"}
                    </strong>
                  </div>

                  <div className="summary-item">
                    <span>Avg. Selling</span>
                    <strong>
                      {totalVariants > 0
                        ? (totalSellingValue / totalVariants).toFixed(2)
                        : "0.00"}
                    </strong>
                  </div>
                </div>

                <div className="variants-list">
                  {variantForms.map((variant, index) => {
                    const expanded = expandedVariant === index;

                    return (
                      <Fragment
                        key={variant.id || `new-variant-${index}`}
                      >
                        <div
                          className={`variant-card ${
                            expanded ? "expanded" : ""
                          }`}
                        >
                          <div className="variant-header">
                            <button
                              type="button"
                              className="variant-expand"
                              onClick={() =>
                                setExpandedVariant(
                                  expanded ? null : index,
                                )
                              }
                            >
                              <div className="variant-number">
                                {index + 1}
                              </div>

                              <div className="variant-heading">
                                <strong>
                                  {variant.name || `Variant ${index + 1}`}
                                </strong>

                                <span>
                                  {variant.sku
                                    ? `SKU: ${variant.sku}`
                                    : "No SKU assigned"}
                                </span>
                              </div>

                              <div className="variant-badges">
                                {variant.is_default && (
                                  <span className="badge default">
                                    Default
                                  </span>
                                )}

                                {variant.is_active ? (
                                  <span className="badge active">
                                    Active
                                  </span>
                                ) : (
                                  <span className="badge inactive">
                                    Inactive
                                  </span>
                                )}
                              </div>

                              {expanded ? (
                                <ChevronUp size={18} />
                              ) : (
                                <ChevronDown size={18} />
                              )}
                            </button>

                            <button
                              type="button"
                              className="delete-variant"
                              onClick={() => removeVariant(index)}
                              disabled={variantForms.length <= 1}
                              title={
                                variantForms.length <= 1
                                  ? "At least one variant is required"
                                  : "Remove variant"
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {expanded && (
                            <div className="variant-body">
                              <div className="variant-grid">
                                <div className="field field-wide">
                                  <label>
                                    Variant Name <span>*</span>
                                  </label>

                                  <input
                                    value={variant.name}
                                    onChange={(event) =>
                                      updateVariant(
                                        index,
                                        "name",
                                        event.target.value,
                                      )
                                    }
                                    placeholder="e.g. i7 / 16GB / 512GB"
                                  />
                                </div>

                                <div className="field">
                                  <label>SKU</label>

                                  <input
                                    value={variant.sku}
                                    onChange={(event) =>
                                      updateVariant(
                                        index,
                                        "sku",
                                        event.target.value,
                                      )
                                    }
                                    placeholder="e.g. DELL-7420-I7"
                                  />

                                  <small>
                                    SKU identifies this variant. It does not
                                    change when additional stock is purchased.
                                  </small>
                                </div>

                                <div className="field">
                                  <label>Barcode</label>

                                  <input
                                    value={variant.barcode}
                                    onChange={(event) =>
                                      updateVariant(
                                        index,
                                        "barcode",
                                        event.target.value,
                                      )
                                    }
                                    placeholder="e.g. 890123456789"
                                  />
                                </div>

                                <div className="field">
                                  <label>Cost Price</label>

                                  <div className="input-with-icon">
                                    <DollarSign size={15} />
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={variant.cost_price}
                                      onChange={(event) =>
                                        updateVariant(
                                          index,
                                          "cost_price",
                                          event.target.value,
                                        )
                                      }
                                      placeholder="0.00"
                                    />
                                  </div>
                                </div>

                                <div className="field">
                                  <label>Selling Price</label>

                                  <div className="input-with-icon">
                                    <DollarSign size={15} />
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={variant.selling_price}
                                      onChange={(event) =>
                                        updateVariant(
                                          index,
                                          "selling_price",
                                          event.target.value,
                                        )
                                      }
                                      placeholder="0.00"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="variant-settings">
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={variant.is_default}
                                    onChange={() =>
                                      setDefaultVariant(index)
                                    }
                                  />

                                  <span>
                                    <strong>Default Variant</strong>
                                    <small>
                                      Used when the product is selected
                                      without specifying a variant.
                                    </small>
                                  </span>
                                </label>

                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={variant.is_active}
                                    onChange={(event) =>
                                      updateVariant(
                                        index,
                                        "is_active",
                                        event.target.checked,
                                      )
                                    }
                                  />

                                  <span>
                                    <strong>Active Variant</strong>
                                    <small>
                                      Inactive variants remain in historical
                                      records but are no longer offered for
                                      new transactions.
                                    </small>
                                  </span>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      </Fragment>
                    );
                  })}
                </div>
              </section>

              <section className="card danger-card">
                <div className="danger-content">
                  <div className="danger-icon">
                    <X size={18} />
                  </div>

                  <div>
                    <h3>Product Status</h3>
                    <p>
                      If this product is no longer being sold, set it to
                      inactive instead of deleting it. Historical inventory
                      and transaction references should remain intact.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="danger-button"
                    onClick={() =>
                      setStatus(status === "active" ? "inactive" : "active")
                    }
                  >
                    {status === "active"
                      ? "Set Inactive"
                      : "Set Active"}
                  </button>
                </div>
              </section>
            </main>

            <aside className="side-column">
              <section className="card sticky-card">
                <div className="side-card-title">
                  <Package size={17} />
                  Product Preview
                </div>

                <div className="preview-product">
                  <div className="preview-icon">
                    <Package size={22} />
                  </div>

                  <div>
                    <strong>{name || "Product Name"}</strong>
                    <span>
                      {brand || "Brand"}{" "}
                      {category ? `• ${category}` : ""}
                    </span>
                  </div>
                </div>

                <div className="preview-divider" />

                <div className="preview-row">
                  <span>Status</span>

                  <strong
                    className={
                      status === "active"
                        ? "text-active"
                        : "text-inactive"
                    }
                  >
                    {status === "active" ? "Active" : "Inactive"}
                  </strong>
                </div>

                <div className="preview-row">
                  <span>Inventory</span>
                  <strong>
                    {inventoryTracked ? "Tracked" : "Not Tracked"}
                  </strong>
                </div>

                <div className="preview-row">
                  <span>Variants</span>
                  <strong>{totalVariants}</strong>
                </div>

                <div className="preview-row">
                  <span>Active Variants</span>
                  <strong>{activeVariants}</strong>
                </div>

                <div className="preview-row">
                  <span>Default Variant</span>
                  <strong>
                    {defaultVariantIndex >= 0
                      ? variantForms[defaultVariantIndex]?.name || "—"
                      : "—"}
                  </strong>
                </div>
              </section>

              <section className="card">
                <div className="side-card-title">
                  <DollarSign size={17} />
                  Pricing Overview
                </div>

                <div className="price-box">
                  <span>Lowest Cost</span>
                  <strong>
                    {variantForms.length > 0
                      ? Math.min(
                          ...variantForms.map(
                            (variant) =>
                              Number(variant.cost_price) || 0,
                          ),
                        ).toFixed(2)
                      : "0.00"}
                  </strong>
                </div>

                <div className="price-box">
                  <span>Highest Selling</span>
                  <strong>
                    {variantForms.length > 0
                      ? Math.max(
                          ...variantForms.map(
                            (variant) =>
                              Number(variant.selling_price) || 0,
                          ),
                        ).toFixed(2)
                      : "0.00"}
                  </strong>
                </div>

                <div className="currency-note">
                  Currency display will be centralized through the global
                  SBS currency/settings system.
                </div>
              </section>

              <section className="card">
                <div className="side-card-title">Record Information</div>

                <div className="info-row">
                  <span>Product ID</span>
                  <code>{product.id.slice(0, 8)}...</code>
                </div>

                <div className="info-row">
                  <span>Created</span>
                  <strong>{formatDate(product.created_at)}</strong>
                </div>

                <div className="info-row">
                  <span>Last Updated</span>
                  <strong>{formatDate(product.updated_at)}</strong>
                </div>

                <div className="info-row">
                  <span>Existing Tracking Mode</span>
                  <strong>{product.tracking_mode}</strong>
                </div>
              </section>

              <section className="card hierarchy-card">
                <div className="side-card-title">
                  Inventory V2 Hierarchy
                </div>

                <div className="hierarchy">
                  <div className="hierarchy-item primary">
                    <span className="hierarchy-dot" />
                    Product
                  </div>

                  <div className="hierarchy-line" />

                  <div className="hierarchy-item">
                    <span className="hierarchy-dot" />
                    Variant
                  </div>

                  <div className="hierarchy-line" />

                  <div className="hierarchy-item">
                    <span className="hierarchy-dot" />
                    Batch / Lot
                    <small>Primary inventory tracking</small>
                  </div>

                  <div className="hierarchy-line" />

                  <div className="hierarchy-item optional">
                    <span className="hierarchy-dot" />
                    Serialized Units
                    <small>Optional child identities</small>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </form>

        <style jsx>{`
          .page-content {
            min-height: 100vh;
            padding: 28px 32px 60px;
          }

          .inventory-page {
            background: #f8fafc;
          }

          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 24px;
            margin-bottom: 26px;
          }

          .header-left {
            min-width: 0;
          }

          .back-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 18px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #475569;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.back-link:hover {
  color: #166534;
}

          .eyebrow {
            display: flex;
            align-items: center;
            gap: 7px;
            margin-bottom: 7px;
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.09em;
          }

          .eyebrow-dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: #16a34a;
          }

          .page-title {
            margin: 0;
            color: #0f172a;
            font-size: 30px;
            line-height: 1.15;
            font-weight: 750;
            letter-spacing: -0.02em;
          }

          .page-subtitle {
            margin: 8px 0 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.6;
          }

          .header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
          }

          .button {
            min-height: 40px;
            padding: 0 15px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-radius: 9px;
            font-size: 13px;
            font-weight: 650;
            text-decoration: none;
            cursor: pointer;
            transition:
              background 0.15s ease,
              border-color 0.15s ease,
              transform 0.15s ease;
          }

          .button:disabled {
            opacity: 0.65;
            cursor: not-allowed;
          }

          .button.secondary {
            color: #334155;
            background: #ffffff;
            border: 1px solid #dbe1e7;
          }

          .button.secondary:hover:not(:disabled) {
            background: #f8fafc;
            border-color: #cbd5e1;
          }

          .button.primary {
            color: #ffffff;
            background: #166534;
            border: 1px solid #166534;
            box-shadow: 0 2px 5px rgba(22, 101, 52, 0.15);
          }

          .button.primary:hover:not(:disabled) {
            background: #14532d;
            border-color: #14532d;
          }

          .button-spinner {
            width: 15px;
            height: 15px;
            border: 2px solid rgba(255, 255, 255, 0.35);
            border-top-color: #ffffff;
            border-radius: 999px;
            animation: spin 0.7s linear infinite;
          }

          .layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 330px;
            gap: 20px;
            align-items: start;
          }

          .main-column {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .side-column {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            box-shadow: 0 4px 18px rgba(15, 23, 42, 0.035);
            overflow: hidden;
          }

          .sticky-card {
            position: sticky;
            top: 20px;
          }

          .card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            padding: 21px 22px;
            border-bottom: 1px solid #edf0f2;
          }

          .card-header h2 {
            margin: 0;
            color: #0f172a;
            font-size: 16px;
            font-weight: 700;
          }

          .card-header p {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 12px;
            line-height: 1.5;
          }

          .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            padding: 6px 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
          }

          .status-pill span {
            width: 6px;
            height: 6px;
            border-radius: 999px;
          }

          .status-pill.active {
            color: #166534;
            background: #f0fdf4;
          }

          .status-pill.active span {
            background: #16a34a;
          }

          .status-pill.inactive {
            color: #64748b;
            background: #f1f5f9;
          }

          .status-pill.inactive span {
            background: #94a3b8;
          }

          .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
            padding: 22px;
          }

          .field {
            min-width: 0;
          }

          .field-wide {
            grid-column: 1 / -1;
          }

          .field label {
            display: block;
            margin-bottom: 7px;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
          }

          .field label span {
            color: #dc2626;
          }

          .field input,
          .field select,
          .field textarea {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #dbe1e7;
            border-radius: 9px;
            background: #ffffff;
            color: #0f172a;
            font-family: inherit;
            font-size: 13px;
            outline: none;
            transition:
              border-color 0.15s ease,
              box-shadow 0.15s ease;
          }

          .field input,
          .field select {
            height: 40px;
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
            border-color: #86b99a;
            box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
          }

          .field small {
            display: block;
            margin-top: 6px;
            color: #94a3b8;
            font-size: 11px;
            line-height: 1.45;
          }

          .tracking-options {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            padding: 22px;
          }

          .tracking-option {
            display: flex;
            align-items: flex-start;
            gap: 13px;
            padding: 17px;
            text-align: left;
            background: #ffffff;
            border: 1px solid #dbe1e7;
            border-radius: 11px;
            cursor: pointer;
            transition:
              border-color 0.15s ease,
              background 0.15s ease,
              box-shadow 0.15s ease;
          }

          .tracking-option:hover {
            border-color: #b9c6cf;
          }

          .tracking-option.selected {
            border-color: #86b99a;
            background: #f7fcf8;
            box-shadow: 0 0 0 2px rgba(22, 101, 52, 0.05);
          }

          .tracking-radio {
            width: 18px;
            height: 18px;
            flex: 0 0 18px;
            margin-top: 1px;
            border: 2px solid #cbd5e1;
            border-radius: 999px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .tracking-option.selected .tracking-radio {
            border-color: #166534;
          }

          .tracking-radio span {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #166534;
          }

          .tracking-content strong {
            display: block;
            color: #0f172a;
            font-size: 13px;
            font-weight: 700;
          }

          .tracking-content p {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 12px;
            line-height: 1.55;
          }

          .tracking-note {
            display: flex;
            gap: 11px;
            margin: 0 22px 22px;
            padding: 14px;
            border: 1px solid #dbeafe;
            border-radius: 10px;
            background: #f8fbff;
            color: #475569;
          }

          .tracking-note > svg {
            flex: 0 0 auto;
            margin-top: 1px;
            color: #2563eb;
          }

          .tracking-note strong {
            display: block;
            color: #334155;
            font-size: 12px;
          }

          .tracking-note p {
            margin: 4px 0 0;
            font-size: 11px;
            line-height: 1.55;
          }

          .variant-summary {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            margin: 20px 22px 0;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            overflow: hidden;
          }

          .summary-item {
            min-width: 0;
            padding: 13px 14px;
            border-right: 1px solid #e5e7eb;
            background: #f8fafc;
          }

          .summary-item:last-child {
            border-right: 0;
          }

          .summary-item span {
            display: block;
            color: #64748b;
            font-size: 10px;
            font-weight: 650;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .summary-item strong {
            display: block;
            margin-top: 5px;
            color: #0f172a;
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .variants-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 20px 22px 22px;
          }

          .variant-card {
            border: 1px solid #e5e7eb;
            border-radius: 11px;
            overflow: hidden;
            background: #ffffff;
          }

          .variant-card.expanded {
            border-color: #cbd5e1;
          }

          .variant-header {
            display: flex;
            align-items: center;
            min-height: 67px;
          }

          .variant-expand {
            min-width: 0;
            flex: 1;
            display: flex;
            align-items: center;
            gap: 11px;
            padding: 12px 14px;
            border: 0;
            background: transparent;
            color: #0f172a;
            text-align: left;
            cursor: pointer;
          }

          .variant-number {
            width: 30px;
            height: 30px;
            flex: 0 0 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            background: #f1f5f9;
            color: #475569;
            font-size: 12px;
            font-weight: 700;
          }

          .variant-heading {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .variant-heading strong {
            color: #0f172a;
            font-size: 13px;
            font-weight: 700;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .variant-heading span {
            color: #94a3b8;
            font-size: 11px;
          }

          .variant-badges {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-left: auto;
            padding-left: 10px;
          }

          .badge {
            padding: 4px 7px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 700;
            white-space: nowrap;
          }

          .badge.default {
            color: #166534;
            background: #f0fdf4;
          }

          .badge.active {
            color: #166534;
            background: #f0fdf4;
          }

          .badge.inactive {
            color: #64748b;
            background: #f1f5f9;
          }

          .delete-variant {
            width: 40px;
            height: 40px;
            margin-right: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: #94a3b8;
            cursor: pointer;
          }

          .delete-variant:hover:not(:disabled) {
            color: #dc2626;
            background: #fef2f2;
          }

          .delete-variant:disabled {
            opacity: 0.35;
            cursor: not-allowed;
          }

          .variant-body {
            padding: 0 17px 17px;
            border-top: 1px solid #edf0f2;
            background: #fbfcfd;
          }

          .variant-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            padding-top: 17px;
          }

          .input-with-icon {
            position: relative;
          }

          .input-with-icon > svg {
            position: absolute;
            left: 11px;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
            pointer-events: none;
          }

          .input-with-icon input {
            padding-left: 31px;
          }

          .variant-settings {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin-top: 18px;
            padding-top: 17px;
            border-top: 1px solid #e5e7eb;
          }

          .check-row {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 9px;
            background: #ffffff;
            cursor: pointer;
          }

          .check-row input {
            width: 16px;
            height: 16px;
            margin-top: 1px;
            accent-color: #166534;
          }

          .check-row span {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .check-row strong {
            color: #334155;
            font-size: 12px;
          }

          .check-row small {
            color: #94a3b8;
            font-size: 10px;
            line-height: 1.45;
          }

          .danger-card {
            border-color: #fecaca;
          }

          .danger-content {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 18px 20px;
          }

          .danger-icon {
            width: 38px;
            height: 38px;
            flex: 0 0 38px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 9px;
            background: #fef2f2;
            color: #dc2626;
          }

          .danger-content > div:nth-child(2) {
            min-width: 0;
            flex: 1;
          }

          .danger-content h3 {
            margin: 0;
            color: #991b1b;
            font-size: 13px;
            font-weight: 700;
          }

          .danger-content p {
            margin: 4px 0 0;
            color: #7f1d1d;
            font-size: 11px;
            line-height: 1.5;
          }

          .danger-button {
            flex-shrink: 0;
            min-height: 36px;
            padding: 0 12px;
            border: 1px solid #fecaca;
            border-radius: 8px;
            background: #ffffff;
            color: #b91c1c;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
          }

          .danger-button:hover {
            background: #fef2f2;
          }

          .side-card-title {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 17px 18px;
            border-bottom: 1px solid #edf0f2;
            color: #0f172a;
            font-size: 13px;
            font-weight: 700;
          }

          .side-card-title svg {
            color: #166534;
          }

          .preview-product {
            display: flex;
            gap: 11px;
            padding: 18px;
          }

          .preview-icon {
            width: 42px;
            height: 42px;
            flex: 0 0 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            background: #f0fdf4;
            color: #166534;
          }

          .preview-product > div:last-child {
            min-width: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 3px;
          }

          .preview-product strong {
            color: #0f172a;
            font-size: 13px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .preview-product span {
            color: #64748b;
            font-size: 11px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .preview-divider {
            height: 1px;
            background: #edf0f2;
          }

          .preview-row,
          .info-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 11px 18px;
            border-bottom: 1px solid #f1f5f9;
          }

          .preview-row:last-child,
          .info-row:last-child {
            border-bottom: 0;
          }

          .preview-row span,
          .info-row span {
            color: #64748b;
            font-size: 11px;
          }

          .preview-row strong,
          .info-row strong,
          .info-row code {
            max-width: 170px;
            color: #334155;
            font-size: 11px;
            font-weight: 700;
            text-align: right;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .text-active {
            color: #166534 !important;
          }

          .text-inactive {
            color: #64748b !important;
          }

          .price-box {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 13px 18px;
            border-bottom: 1px solid #f1f5f9;
          }

          .price-box span {
            color: #64748b;
            font-size: 11px;
          }

          .price-box strong {
            color: #0f172a;
            font-size: 14px;
          }

          .currency-note {
            margin: 13px 18px 17px;
            padding: 10px;
            border-radius: 8px;
            background: #f8fafc;
            color: #94a3b8;
            font-size: 10px;
            line-height: 1.5;
          }

          .hierarchy {
            padding: 17px 18px 19px;
          }

          .hierarchy-item {
            display: flex;
            align-items: center;
            gap: 9px;
            color: #475569;
            font-size: 11px;
            font-weight: 650;
          }

          .hierarchy-item small {
            margin-left: auto;
            color: #94a3b8;
            font-size: 9px;
            font-weight: 500;
          }

          .hierarchy-item.primary {
            color: #166534;
            font-weight: 700;
          }

          .hierarchy-item.optional {
            color: #64748b;
          }

          .hierarchy-dot {
            width: 7px;
            height: 7px;
            flex: 0 0 7px;
            border-radius: 999px;
            background: #cbd5e1;
          }

          .primary .hierarchy-dot {
            background: #16a34a;
          }

          .hierarchy-line {
            width: 1px;
            height: 18px;
            margin: 2px 0 2px 3px;
            background: #dbe4ea;
          }

          .toast {
            position: fixed;
            z-index: 100;
            top: 22px;
            right: 24px;
            max-width: 420px;
            min-width: 300px;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 13px;
            border: 1px solid #e5e7eb;
            border-radius: 11px;
            background: #ffffff;
            box-shadow: 0 12px 35px rgba(15, 23, 42, 0.15);
            color: #334155;
            font-size: 12px;
          }

          .toast-icon {
            width: 28px;
            height: 28px;
            flex: 0 0 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
          }

          .toast.success .toast-icon {
            color: #166534;
            background: #f0fdf4;
          }

          .toast.error .toast-icon {
            color: #dc2626;
            background: #fef2f2;
          }

          .toast > span {
            flex: 1;
            line-height: 1.45;
          }

          .toast > button {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 0;
            border-radius: 7px;
            background: transparent;
            color: #94a3b8;
            cursor: pointer;
          }

          .toast > button:hover {
            background: #f1f5f9;
            color: #475569;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 1180px) {
            .layout {
              grid-template-columns: 1fr;
            }

            .side-column {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .sticky-card {
              position: static;
            }
          }

          @media (max-width: 850px) {
            .page-content {
              padding: 22px 18px 42px;
            }

            .page-header {
              flex-direction: column;
              align-items: stretch;
            }

            .header-actions {
              justify-content: flex-end;
            }

            .tracking-options,
            .variant-grid,
            .variant-settings {
              grid-template-columns: 1fr;
            }

            .variant-summary {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .summary-item:nth-child(2) {
              border-right: 0;
            }

            .summary-item:nth-child(-n + 3) {
              border-bottom: 1px solid #e5e7eb;
            }

            .side-column {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 620px) {
            .form-grid {
              grid-template-columns: 1fr;
            }

            .field-wide {
              grid-column: auto;
            }

            .card-header {
              flex-direction: column;
              align-items: stretch;
            }

            .header-actions {
              width: 100%;
            }

            .header-actions .button {
              flex: 1;
            }

            .variant-summary {
              grid-template-columns: 1fr 1fr;
            }

            .variant-header {
              align-items: flex-start;
            }

            .variant-badges {
              display: none;
            }

            .danger-content {
              align-items: flex-start;
              flex-wrap: wrap;
            }

            .danger-button {
              margin-left: 52px;
            }

            .toast {
              left: 16px;
              right: 16px;
              top: 14px;
              min-width: 0;
            }
          }
        `}</style>
      </div>
    </AppShell>
  );
}