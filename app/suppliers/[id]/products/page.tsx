"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  brand?: string | null;
  category?: string | null;
};

type Variant = {
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

type SupplierProduct = {
  id: string;
  company_id: string;
  supplier_id: string;
  product_id: string;
  variant_id: string;
  supplier_sku: string | null;
  supplier_product_name: string | null;
  unit_cost: number;
  currency: string;
  minimum_order_quantity: number;
  lead_time_days: number;
  is_preferred: boolean;
  is_active: boolean;
  last_purchase_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Supplier = {
  id: string;
  supplier_number: string;
  legal_name: string;
  display_name: string;
  currency: string;
};

type FormState = {
  product_id: string;
  variant_id: string;
  supplier_sku: string;
  supplier_product_name: string;
  unit_cost: string;
  currency: string;
  minimum_order_quantity: string;
  lead_time_days: string;
  is_preferred: boolean;
  is_active: boolean;
  notes: string;
};

const emptyForm: FormState = {
  product_id: "",
  variant_id: "",
  supplier_sku: "",
  supplier_product_name: "",
  unit_cost: "0",
  currency: "USD",
  minimum_order_quantity: "1",
  lead_time_days: "0",
  is_preferred: false,
  is_active: true,
  notes: "",
};

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `${currency || "USD"} ${Number(value || 0).toLocaleString()}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Never";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SupplierProductsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();

  const supplierId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : "";

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [supplierProducts, setSupplierProducts] = useState<
    SupplierProduct[]
  >([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [form, setForm] = useState<FormState>(emptyForm);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadData = useCallback(async () => {
    if (!supplierId) return;

    setLoading(true);
    setErrorMessage("");

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

      const { data: membership, error: membershipError } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership?.company_id) {
        throw new Error("No company membership was found.");
      }

      const companyId = membership.company_id;

      const [
        supplierResult,
        supplierProductsResult,
        productsResult,
        variantsResult,
      ] = await Promise.all([
        supabase
          .from("suppliers")
          .select(
            "id, supplier_number, legal_name, display_name, currency"
          )
          .eq("id", supplierId)
          .eq("company_id", companyId)
          .maybeSingle(),

        supabase
          .from("supplier_products")
          .select("*")
          .eq("supplier_id", supplierId)
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),

        supabase
          .from("products")
          .select("id, name, brand, category")
          .eq("company_id", companyId)
          .order("name", { ascending: true }),

        supabase
          .from("product_variants")
          .select(
            "id, product_id, name, sku, barcode, cost_price, selling_price, is_default, is_active"
          )
          .eq("company_id", companyId)
          .order("name", { ascending: true }),
      ]);

      if (supplierResult.error) throw supplierResult.error;
      if (supplierProductsResult.error)
        throw supplierProductsResult.error;
      if (productsResult.error) throw productsResult.error;
      if (variantsResult.error) throw variantsResult.error;

      if (!supplierResult.data) {
        throw new Error("Supplier not found.");
      }

      setSupplier(supplierResult.data as Supplier);
      setSupplierProducts(
        (supplierProductsResult.data || []) as SupplierProduct[]
      );
      setProducts((productsResult.data || []) as Product[]);
      setVariants((variantsResult.data || []) as Variant[]);
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message || "Unable to load supplier products."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supplierId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateForm<K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openAddModal() {
    setEditingId(null);

    setForm({
      ...emptyForm,
      currency: supplier?.currency || "USD",
    });

    setErrorMessage("");
    setShowModal(true);
  }

  function openEditModal(item: SupplierProduct) {
    setEditingId(item.id);

    setForm({
      product_id: item.product_id,
      variant_id: item.variant_id,
      supplier_sku: item.supplier_sku || "",
      supplier_product_name: item.supplier_product_name || "",
      unit_cost: String(item.unit_cost ?? 0),
      currency: item.currency || supplier?.currency || "USD",
      minimum_order_quantity: String(
        item.minimum_order_quantity ?? 1
      ),
      lead_time_days: String(item.lead_time_days ?? 0),
      is_preferred: item.is_preferred,
      is_active: item.is_active,
      notes: item.notes || "",
    });

    setErrorMessage("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setErrorMessage("");
  }

  async function handleSave() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!form.product_id) {
      setErrorMessage("Please select a product.");
      return;
    }

    if (!form.variant_id) {
      setErrorMessage("Please select a product variant.");
      return;
    }

    const unitCost = Number(form.unit_cost);
    const minimumOrderQuantity = Number(
      form.minimum_order_quantity
    );
    const leadTimeDays = Number(form.lead_time_days);

    if (Number.isNaN(unitCost) || unitCost < 0) {
      setErrorMessage("Unit cost must be a valid number.");
      return;
    }

    if (
      Number.isNaN(minimumOrderQuantity) ||
      minimumOrderQuantity <= 0
    ) {
      setErrorMessage(
        "Minimum order quantity must be greater than 0."
      );
      return;
    }

    if (
      Number.isNaN(leadTimeDays) ||
      !Number.isInteger(leadTimeDays) ||
      leadTimeDays < 0
    ) {
      setErrorMessage(
        "Lead time must be a whole number of days."
      );
      return;
    }

    const currency = form.currency.trim().toUpperCase();

    if (currency.length !== 3) {
      setErrorMessage(
        "Currency must be a valid 3-letter code such as USD."
      );
      return;
    }

    setSaving(true);

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

      const { data: membership, error: membershipError } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership?.company_id) {
        throw new Error("No company membership was found.");
      }

      const companyId = membership.company_id;

      const payload = {
        company_id: companyId,
        supplier_id: supplierId,
        product_id: form.product_id,
        variant_id: form.variant_id,
        supplier_sku: form.supplier_sku.trim() || null,
        supplier_product_name:
          form.supplier_product_name.trim() || null,
        unit_cost: unitCost,
        currency,
        minimum_order_quantity: minimumOrderQuantity,
        lead_time_days: leadTimeDays,
        is_preferred: form.is_preferred,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { data, error } = await supabase
          .from("supplier_products")
          .update(payload)
          .eq("id", editingId)
          .eq("supplier_id", supplierId)
          .eq("company_id", companyId)
          .select("*")
          .single();

        if (error) throw error;

        setSupplierProducts((current) =>
          current.map((item) =>
            item.id === editingId
              ? (data as SupplierProduct)
              : item
          )
        );

        setSuccessMessage(
          "Supplier product updated successfully."
        );
      } else {
        const { data, error } = await supabase
          .from("supplier_products")
          .insert(payload)
          .select("*")
          .single();

        if (error) throw error;

        setSupplierProducts((current) => [
          data as SupplierProduct,
          ...current,
        ]);

        setSuccessMessage(
          "Product linked to supplier successfully."
        );
      }

      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (error: any) {
      console.error(error);

      if (
        error?.code === "23505" ||
        error?.message?.toLowerCase()?.includes("duplicate")
      ) {
        setErrorMessage(
          "This product variant is already linked to this supplier."
        );
      } else {
        setErrorMessage(
          error?.message ||
            "Unable to save the supplier product."
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: SupplierProduct) {
    const product = products.find(
      (product) => product.id === item.product_id
    );

    const productName =
      item.supplier_product_name ||
      product?.name ||
      "this product";

    const confirmed = window.confirm(
      `Remove ${productName} from this supplier?`
    );

    if (!confirmed) return;

    setDeleting(true);
    setErrorMessage("");
    setSuccessMessage("");

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

      const { data: membership, error: membershipError } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership?.company_id) {
        throw new Error("No company membership was found.");
      }

      const { error } = await supabase
        .from("supplier_products")
        .delete()
        .eq("id", item.id)
        .eq("supplier_id", supplierId)
        .eq("company_id", membership.company_id);

      if (error) throw error;

      setSupplierProducts((current) =>
        current.filter((product) => product.id !== item.id)
      );

      setSuccessMessage("Supplier product removed successfully.");
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "Unable to remove the supplier product."
      );
    } finally {
      setDeleting(false);
    }
  }

  const selectedProductVariants = useMemo(() => {
    if (!form.product_id) return [];

    return variants.filter(
      (variant) =>
        variant.product_id === form.product_id &&
        variant.is_active
    );
  }, [form.product_id, variants]);

  const filteredSupplierProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return supplierProducts.filter((item) => {
      const product = products.find(
        (product) => product.id === item.product_id
      );

      const variant = variants.find(
        (variant) => variant.id === item.variant_id
      );

      const matchesSearch =
        !query ||
        product?.name?.toLowerCase().includes(query) ||
        product?.brand?.toLowerCase().includes(query) ||
        product?.category?.toLowerCase().includes(query) ||
        variant?.name?.toLowerCase().includes(query) ||
        variant?.sku?.toLowerCase().includes(query) ||
        item.supplier_sku?.toLowerCase().includes(query) ||
        item.supplier_product_name
          ?.toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.is_active) ||
        (statusFilter === "inactive" && !item.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [
    products,
    search,
    statusFilter,
    supplierProducts,
    variants,
  ]);

  const activeCount = supplierProducts.filter(
    (item) => item.is_active
  ).length;

  const preferredCount = supplierProducts.filter(
    (item) => item.is_preferred
  ).length;

  const averageCost =
    supplierProducts.length > 0
      ? supplierProducts.reduce(
          (sum, item) => sum + Number(item.unit_cost || 0),
          0
        ) / supplierProducts.length
      : 0;

  if (loading) {
    return (
      <AppShell>
        <div className="page">
          <div className="loadingCard">
            Loading supplier products...
          </div>
        </div>

        <style jsx>{`
          .page {
            padding: 28px;
          }

          .loadingCard {
            padding: 50px;
            text-align: center;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            color: #64748b;
          }
        `}</style>
      </AppShell>
    );
  }

  if (!supplier) {
    return (
      <AppShell>
        <div className="page">
          <div className="errorCard">
            <h2>Supplier not found</h2>

            <p>
              {errorMessage ||
                "The supplier could not be found or you do not have access to it."}
            </p>

            <button
              className="primaryButton"
              onClick={() => router.push("/suppliers")}
            >
              Back to Suppliers
            </button>
          </div>
        </div>

        <style jsx>{`
          .page {
            padding: 28px;
          }

          .errorCard {
            max-width: 600px;
            margin: 50px auto;
            padding: 40px;
            text-align: center;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
          }

          .errorCard h2 {
            margin: 0 0 10px;
            font-size: 24px;
            color: #111827;
          }

          .errorCard p {
            color: #64748b;
            line-height: 1.6;
            margin-bottom: 24px;
          }

          .primaryButton {
            border: 0;
            border-radius: 10px;
            padding: 11px 18px;
            background: #0f172a;
            color: white;
            font-weight: 700;
            cursor: pointer;
          }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page">
        <div className="header">
          <div>
            <button
              className="backButton"
              onClick={() => router.push(`/suppliers/${supplierId}`)}
            >
              ← Back to Supplier
            </button>

            <div className="titleRow">
              <div>
                <div className="eyebrow">
                  {supplier.supplier_number}
                </div>

                <h1>
                  {supplier.display_name ||
                    supplier.legal_name}
                </h1>

                <p>
                  Manage products and purchasing terms for this
                  supplier.
                </p>
              </div>
            </div>
          </div>

          <button
            className="primaryButton"
            onClick={openAddModal}
          >
            + Add Product
          </button>
        </div>

        {errorMessage && !showModal && (
          <div className="alert error">
            <span>{errorMessage}</span>

            <button
              onClick={() => setErrorMessage("")}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="alert success">
            <span>{successMessage}</span>

            <button
              onClick={() => setSuccessMessage("")}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <div className="statsGrid">
          <div className="statCard">
            <div className="statLabel">Total Products</div>
            <div className="statValue">
              {supplierProducts.length}
            </div>
          </div>

          <div className="statCard">
            <div className="statLabel">Active</div>
            <div className="statValue">{activeCount}</div>
          </div>

          <div className="statCard">
            <div className="statLabel">Preferred</div>
            <div className="statValue">{preferredCount}</div>
          </div>

          <div className="statCard">
            <div className="statLabel">Average Unit Cost</div>
            <div className="statValue">
              {formatMoney(
                averageCost,
                supplier.currency || "USD"
              )}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <div className="searchBox">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search products, SKU, brand..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | "all"
                  | "active"
                  | "inactive"
              )
            }
          >
            <option value="all">All Products</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <div className="tableCard">
          <div className="tableHeader">
            <div>
              <h2>Supplier Products</h2>
              <p>
                {filteredSupplierProducts.length} product
                {filteredSupplierProducts.length === 1
                  ? ""
                  : "s"} shown
              </p>
            </div>
          </div>

          {filteredSupplierProducts.length === 0 ? (
            <div className="emptyState">
              <div className="emptyIcon">📦</div>

              <h3>
                {supplierProducts.length === 0
                  ? "No products linked yet"
                  : "No matching products"}
              </h3>

              <p>
                {supplierProducts.length === 0
                  ? "Link products to this supplier to manage supplier pricing, MOQ and lead times."
                  : "Try changing your search or status filter."}
              </p>

              {supplierProducts.length === 0 && (
                <button
                  className="primaryButton"
                  onClick={openAddModal}
                >
                  + Add First Product
                </button>
              )}
            </div>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Supplier SKU</th>
                    <th>Cost</th>
                    <th>MOQ</th>
                    <th>Lead Time</th>
                    <th>Last Purchase</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSupplierProducts.map((item) => {
                    const product = products.find(
                      (product) =>
                        product.id === item.product_id
                    );

                    const variant = variants.find(
                      (variant) =>
                        variant.id === item.variant_id
                    );

                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="productCell">
                            <div className="productIcon">
                              📦
                            </div>

                            <div>
                              <div className="productName">
                                {product?.name ||
                                  item.supplier_product_name ||
                                  "Unnamed Product"}
                              </div>

                              <div className="variantText">
                                {variant?.name || "Default"}

                                {product?.brand
                                  ? ` • ${product.brand}`
                                  : ""}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="sku">
                            {item.supplier_sku || "—"}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {formatMoney(
                              Number(item.unit_cost || 0),
                              item.currency
                            )}
                          </strong>
                        </td>

                        <td>
                          {Number(
                            item.minimum_order_quantity
                          ).toLocaleString()}
                        </td>

                        <td>
                          {item.lead_time_days}{" "}
                          {item.lead_time_days === 1
                            ? "day"
                            : "days"}
                        </td>

                        <td>
                          {formatDate(item.last_purchase_at)}
                        </td>

                        <td>
                          <div className="statusGroup">
                            {item.is_preferred && (
                              <span className="preferredBadge">
                                Preferred
                              </span>
                            )}

                            <span
                              className={
                                item.is_active
                                  ? "status active"
                                  : "status inactive"
                              }
                            >
                              {item.is_active
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="actions">
                            <button
                              className="actionButton"
                              onClick={() =>
                                openEditModal(item)
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="deleteButton"
                              disabled={deleting}
                              onClick={() =>
                                handleDelete(item)
                              }
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showModal && (
          <div
            className="modalOverlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeModal();
              }
            }}
          >
            <div className="modal">
              <div className="modalHeader">
                <div>
                  <h2>
                    {editingId
                      ? "Edit Supplier Product"
                      : "Add Supplier Product"}
                  </h2>

                  <p>
                    {editingId
                      ? "Update supplier-specific purchasing information."
                      : "Link an existing product to this supplier."}
                  </p>
                </div>

                <button
                  className="closeButton"
                  onClick={closeModal}
                  disabled={saving}
                >
                  ×
                </button>
              </div>

              {errorMessage && (
                <div className="modalError">
                  {errorMessage}
                </div>
              )}

              <div className="formGrid">
                <div className="field full">
                  <label>
                    Product <span>*</span>
                  </label>

                  <select
                    value={form.product_id}
                    disabled={!!editingId}
                    onChange={(event) => {
                      updateForm(
                        "product_id",
                        event.target.value
                      );

                      updateForm("variant_id", "");
                    }}
                  >
                    <option value="">
                      Select a product...
                    </option>

                    {products.map((product) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {product.name}
                        {product.brand
                          ? ` — ${product.brand}`
                          : ""}
                      </option>
                    ))}
                  </select>

                  {editingId && (
                    <small>
                      Product cannot be changed while editing
                      an existing relationship.
                    </small>
                  )}
                </div>

                <div className="field full">
                  <label>
                    Variant <span>*</span>
                  </label>

                  <select
                    value={form.variant_id}
                    disabled={
                      !!editingId || !form.product_id
                    }
                    onChange={(event) =>
                      updateForm(
                        "variant_id",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      {form.product_id
                        ? "Select a variant..."
                        : "Select a product first..."}
                    </option>

                    {selectedProductVariants.map(
                      (variant) => (
                        <option
                          key={variant.id}
                          value={variant.id}
                        >
                          {variant.name}
                          {variant.sku
                            ? ` — ${variant.sku}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="field">
                  <label>Supplier SKU</label>

                  <input
                    value={form.supplier_sku}
                    onChange={(event) =>
                      updateForm(
                        "supplier_sku",
                        event.target.value
                      )
                    }
                    placeholder="Supplier's SKU"
                  />
                </div>

                <div className="field">
                  <label>Supplier Product Name</label>

                  <input
                    value={form.supplier_product_name}
                    onChange={(event) =>
                      updateForm(
                        "supplier_product_name",
                        event.target.value
                      )
                    }
                    placeholder="Optional supplier name"
                  />
                </div>

                <div className="field">
                  <label>
                    Unit Cost <span>*</span>
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unit_cost}
                    onChange={(event) =>
                      updateForm(
                        "unit_cost",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="field">
                  <label>Currency</label>

                  <input
                    maxLength={3}
                    value={form.currency}
                    onChange={(event) =>
                      updateForm(
                        "currency",
                        event.target.value.toUpperCase()
                      )
                    }
                    placeholder="USD"
                  />
                </div>

                <div className="field">
                  <label>Minimum Order Quantity</label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.minimum_order_quantity}
                    onChange={(event) =>
                      updateForm(
                        "minimum_order_quantity",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="field">
                  <label>Lead Time</label>

                  <div className="inputWithSuffix">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.lead_time_days}
                      onChange={(event) =>
                        updateForm(
                          "lead_time_days",
                          event.target.value
                        )
                      }
                    />

                    <span>days</span>
                  </div>
                </div>

                <div className="field full">
                  <label>Notes</label>

                  <textarea
                    rows={4}
                    value={form.notes}
                    onChange={(event) =>
                      updateForm(
                        "notes",
                        event.target.value
                      )
                    }
                    placeholder="Supplier-specific notes, pricing notes, purchasing instructions..."
                  />
                </div>

                <div className="toggleRow full">
                  <label className="toggleItem">
                    <input
                      type="checkbox"
                      checked={form.is_preferred}
                      onChange={(event) =>
                        updateForm(
                          "is_preferred",
                          event.target.checked
                        )
                      }
                    />

                    <span>
                      <strong>Preferred supplier</strong>
                      <small>
                        Mark this supplier as the preferred
                        source for this product.
                      </small>
                    </span>
                  </label>

                  <label className="toggleItem">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) =>
                        updateForm(
                          "is_active",
                          event.target.checked
                        )
                      }
                    />

                    <span>
                      <strong>Active relationship</strong>
                      <small>
                        Allow this supplier relationship to
                        be used for purchasing.
                      </small>
                    </span>
                  </label>
                </div>
              </div>

              <div className="modalFooter">
                <button
                  className="secondaryButton"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  className="primaryButton"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Link Product"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .page {
          padding: 28px;
          max-width: 1600px;
          margin: 0 auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 24px;
        }

        .backButton {
          border: 0;
          background: transparent;
          padding: 0;
          margin-bottom: 12px;
          color: #64748b;
          font-weight: 700;
          cursor: pointer;
        }

        .backButton:hover {
          color: #0f172a;
        }

        .titleRow h1 {
          margin: 0;
          font-size: 30px;
          line-height: 1.15;
          color: #111827;
        }

        .titleRow p {
          margin: 8px 0 0;
          color: #64748b;
        }

        .eyebrow {
          margin-bottom: 7px;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .primaryButton,
        .secondaryButton {
          border-radius: 10px;
          padding: 11px 17px;
          font-weight: 750;
          cursor: pointer;
          transition: 0.15s ease;
        }

        .primaryButton {
          border: 1px solid #0f172a;
          background: #0f172a;
          color: #ffffff;
        }

        .primaryButton:hover {
          background: #1e293b;
        }

        .primaryButton:disabled,
        .secondaryButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .secondaryButton {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #111827;
        }

        .secondaryButton:hover {
          background: #f8fafc;
        }

        .alert {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding: 12px 15px;
          margin-bottom: 20px;
          border-radius: 10px;
          font-size: 14px;
        }

        .alert button {
          border: 0;
          background: transparent;
          font-size: 20px;
          cursor: pointer;
        }

        .alert.error {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .alert.success {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .statCard {
          padding: 20px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
        }

        .statLabel {
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .statValue {
          color: #111827;
          font-size: 25px;
          font-weight: 800;
        }

        .toolbar {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .searchBox {
          display: flex;
          align-items: center;
          gap: 9px;
          flex: 1;
          min-width: 0;
          border: 1px solid #d1d5db;
          background: #ffffff;
          border-radius: 10px;
          padding: 0 13px;
        }

        .searchBox span {
          color: #94a3b8;
          font-size: 21px;
        }

        .searchBox input {
          width: 100%;
          border: 0;
          outline: none;
          padding: 12px 0;
          font-size: 14px;
          background: transparent;
        }

        .toolbar select {
          min-width: 160px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          border-radius: 10px;
          padding: 0 12px;
          outline: none;
        }

        .tableCard {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          overflow: hidden;
        }

        .tableHeader {
          padding: 20px 22px;
          border-bottom: 1px solid #e5e7eb;
        }

        .tableHeader h2 {
          margin: 0;
          font-size: 18px;
          color: #111827;
        }

        .tableHeader p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .tableWrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1050px;
        }

        th {
          padding: 12px 18px;
          text-align: left;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }

        td {
          padding: 16px 18px;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          font-size: 14px;
          white-space: nowrap;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        tbody tr:hover {
          background: #fafafa;
        }

        .productCell {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 260px;
        }

        .productIcon {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #f1f5f9;
          font-size: 17px;
        }

        .productName {
          color: #111827;
          font-weight: 750;
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .variantText {
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
        }

        .sku {
          color: #475569;
          font-family: monospace;
          font-size: 12px;
        }

        .statusGroup {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status,
        .preferredBadge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
        }

        .status.active {
          background: #dcfce7;
          color: #166534;
        }

        .status.inactive {
          background: #f1f5f9;
          color: #64748b;
        }

        .preferredBadge {
          background: #fef3c7;
          color: #92400e;
        }

        .actions {
          display: flex;
          gap: 7px;
          justify-content: flex-end;
        }

        .actionButton,
        .deleteButton {
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .actionButton {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #334155;
        }

        .actionButton:hover {
          background: #f8fafc;
        }

        .deleteButton {
          border: 1px solid #fecaca;
          background: #fff;
          color: #b91c1c;
        }

        .deleteButton:hover {
          background: #fef2f2;
        }

        .deleteButton:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .emptyState {
          padding: 70px 25px;
          text-align: center;
        }

        .emptyIcon {
          font-size: 36px;
          margin-bottom: 12px;
        }

        .emptyState h3 {
          margin: 0 0 8px;
          color: #111827;
          font-size: 18px;
        }

        .emptyState p {
          max-width: 500px;
          margin: 0 auto 20px;
          color: #64748b;
          line-height: 1.6;
        }

        .modalOverlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.55);
        }

        .modal {
          width: 100%;
          max-width: 720px;
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          background: #ffffff;
          border-radius: 18px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, 0.25);
        }

        .modalHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 22px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modalHeader h2 {
          margin: 0;
          color: #111827;
          font-size: 20px;
        }

        .modalHeader p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .closeButton {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 8px;
          background: #f1f5f9;
          color: #475569;
          font-size: 22px;
          cursor: pointer;
        }

        .modalError {
          margin: 18px 24px 0;
          padding: 11px 13px;
          border-radius: 9px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          font-size: 13px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
          padding: 24px;
        }

        .field {
          min-width: 0;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label {
          display: block;
          margin-bottom: 7px;
          color: #334155;
          font-size: 13px;
          font-weight: 750;
        }

        .field label span {
          color: #dc2626;
        }

        .field small {
          display: block;
          margin-top: 5px;
          color: #94a3b8;
          font-size: 11px;
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
          padding: 11px 12px;
          outline: none;
          font-size: 14px;
          font-family: inherit;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          border-color: #64748b;
          box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.1);
        }

        .field input:disabled,
        .field select:disabled {
          background: #f8fafc;
          color: #64748b;
          cursor: not-allowed;
        }

        .field textarea {
          resize: vertical;
        }

        .inputWithSuffix {
          position: relative;
        }

        .inputWithSuffix input {
          padding-right: 55px;
        }

        .inputWithSuffix span {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          font-size: 12px;
        }

        .toggleRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .toggleItem {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 13px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
        }

        .toggleItem input {
          width: 17px;
          height: 17px;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .toggleItem strong {
          display: block;
          color: #334155;
          font-size: 13px;
        }

        .toggleItem small {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 11px;
          line-height: 1.45;
        }

        .modalFooter {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 18px 24px;
          border-top: 1px solid #e5e7eb;
        }

        @media (max-width: 900px) {
          .statsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .header {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 650px) {
          .page {
            padding: 18px;
          }

          .statsGrid {
            grid-template-columns: 1fr;
          }

          .toolbar {
            flex-direction: column;
          }

          .toolbar select {
            min-height: 44px;
          }

          .formGrid,
          .toggleRow {
            grid-template-columns: 1fr;
          }

          .field.full {
            grid-column: auto;
          }

          .modalOverlay {
            padding: 10px;
          }

          .modalFooter {
            flex-direction: column-reverse;
          }

          .modalFooter button {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}