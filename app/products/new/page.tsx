"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type ProductType = "physical" | "digital" | "other";

type TrackingMode =
  | "none"
  | "quantity"
  | "batch"
  | "serial";

type ProductForm = {
  name: string;
  description: string;
  brand: string;
  category: string;
  product_type: ProductType;
  tax_rate: string;
  tracking_mode: TrackingMode;
  track_inventory: boolean;
};

type VariantForm = {
  name: string;
  sku: string;
  barcode: string;
  cost_price: string;
  selling_price: string;
};

const initialProduct: ProductForm = {
  name: "",
  description: "",
  brand: "",
  category: "",
  product_type: "physical",
  tax_rate: "0",
  tracking_mode: "quantity",
  track_inventory: true,
};

const initialVariant: VariantForm = {
  name: "Default",
  sku: "",
  barcode: "",
  cost_price: "0",
  selling_price: "0",
};

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function Icon({
  name,
  size = 18,
}: {
  name:
    | "arrow"
    | "package"
    | "tag"
    | "layers"
    | "box"
    | "dollar"
    | "check"
    | "warning"
    | "close"
    | "info";
  size?: number;
}) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "arrow":
      return (
        <svg {...props}>
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
      );

    case "package":
      return (
        <svg {...props}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="m4.5 7.5 7.5 4 7.5-4" />
          <path d="M12 11.5V21" />
        </svg>
      );

    case "tag":
      return (
        <svg {...props}>
          <path d="M20 13 13 20l-9-9V4h7l9 9Z" />
          <path d="M7.5 7.5h.01" />
        </svg>
      );

    case "layers":
      return (
        <svg {...props}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 16 9 5 9-5" />
        </svg>
      );

    case "box":
      return (
        <svg {...props}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="M12 12 4.5 7.5" />
          <path d="m12 12 7.5-4.5" />
        </svg>
      );

    case "dollar":
      return (
        <svg {...props}>
          <path d="M12 2v20" />
          <path d="M17 5.5c-1-1-2.6-1.5-4.5-1.5-3 0-5 1.5-5 3.8 0 5.7 9.5 2.4 9.5 7.3 0 2.2-2 3.4-5 3.4-2 0-3.7-.6-4.8-1.7" />
        </svg>
      );

    case "check":
      return (
        <svg {...props}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "warning":
      return (
        <svg {...props}>
          <path d="M12 3 2.8 19a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5L12 3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );

    case "close":
      return (
        <svg {...props}>
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </svg>
      );

    case "info":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 8h.01" />
        </svg>
      );
  }
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  step,
  mono = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  min?: string;
  step?: string;
  mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      step={step}
      className={`block h-11 w-full rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 hover:border-slate-400 focus:border-black focus:ring-2 focus:ring-slate-200 ${
        mono ? "font-mono" : ""
      }`}
      style={{
        border: "1px solid #cbd5e1",
      }}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      rows={5}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="block w-full resize-none rounded-lg bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 hover:border-slate-400 focus:border-black focus:ring-2 focus:ring-slate-200"
      style={{
        border: "1px solid #cbd5e1",
      }}
    />
  );
}

function Select({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="block h-11 w-full rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none hover:border-slate-400 focus:border-black focus:ring-2 focus:ring-slate-200"
      style={{
        border: "1px solid #cbd5e1",
      }}
    >
      <option value="physical">Physical</option>
      <option value="digital">Digital</option>
      <option value="other">Other</option>
    </select>
  );
}

function TrackingSelect({
  value,
  onChange,
}: {
  value: TrackingMode;
  onChange: (value: TrackingMode) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) =>
        onChange(e.target.value as TrackingMode)
      }
      className="block h-11 w-full rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none hover:border-slate-400 focus:border-black focus:ring-2 focus:ring-slate-200"
      style={{
        border: "1px solid #cbd5e1",
      }}
    >
      <option value="none">No Tracking</option>
      <option value="quantity">Quantity</option>
      <option value="batch">Batch / Lot</option>
      <option value="serial">Serial Numbers</option>
    </select>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      {children}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: "package" | "layers";
  title: string;
  description: string;
}) {
  return (
    <div
      className="border-b px-6 py-5"
      style={{
        borderColor: "#e2e8f0",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600"
          style={{
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <Icon name={icon} size={18} />
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {title}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NewProductPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [companyId, setCompanyId] =
    useState<string | null>(null);

  const [currency, setCurrency] = useState("USD");

  const [product, setProduct] =
    useState<ProductForm>(initialProduct);

  const [variant, setVariant] =
    useState<VariantForm>(initialVariant);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadWorkspace() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data: membership, error: membershipError } =
          await supabase
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
            "No company workspace was found."
          );
        }

        if (!mounted) return;

        setCompanyId(membership.company_id);

        const { data: company, error: companyError } =
          await supabase
            .from("companies")
            .select("currency")
            .eq("id", membership.company_id)
            .single();

        if (companyError) {
          throw companyError;
        }

        if (mounted) {
          setCurrency(company?.currency || "USD");
        }
      } catch (err) {
        console.error(err);

        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load workspace."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  const cost = toNumber(variant.cost_price);
  const selling = toNumber(variant.selling_price);

  const profit = selling - cost;

  const margin =
    selling > 0
      ? (profit / selling) * 100
      : 0;

  const money = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!companyId) {
      setError("No company workspace was found.");
      return;
    }

    const productName = product.name.trim();

    if (!productName) {
      setError("Product name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: createdProduct, error: productError } =
        await supabase
          .from("products")
          .insert({
            company_id: companyId,
            name: productName,
            slug: slugify(productName) || null,
            description:
              product.description.trim() || null,
            brand:
              product.brand.trim() || null,
            category:
              product.category.trim() || null,
            product_type: product.product_type,
            status: "active",
            tracking_mode: product.tracking_mode,
            track_inventory:
              product.tracking_mode !== "none",
            tax_rate: toNumber(product.tax_rate),
          })
          .select("id")
          .single();

      if (productError) {
        throw productError;
      }

      if (!createdProduct?.id) {
        throw new Error(
          "Product ID was not returned."
        );
      }

      const { error: variantError } =
        await supabase
          .from("product_variants")
          .insert({
            company_id: companyId,
            product_id: createdProduct.id,
            name:
              variant.name.trim() || "Default",
            sku:
              variant.sku.trim() || null,
            barcode:
              variant.barcode.trim() || null,
            cost_price: cost,
            selling_price: selling,
            is_default: true,
            is_active: true,
          });

      if (variantError) {
        await supabase
          .from("products")
          .delete()
          .eq("id", createdProduct.id)
          .eq("company_id", companyId);

        throw variantError;
      }

      router.push(
        `/products/${createdProduct.id}`
      );

      router.refresh();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create product."
      );

      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="New Product"
        description="Create a new product in your catalog."
      >
        <div className="space-y-6">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />

          <div
            className="rounded-xl bg-white p-6"
            style={{
              border: "1px solid #e2e8f0",
            }}
          >
            <div className="space-y-5">
              <div className="h-11 animate-pulse rounded-lg bg-slate-100" />

              <div className="grid gap-5 md:grid-cols-2">
                <div className="h-11 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-11 animate-pulse rounded-lg bg-slate-100" />
              </div>

              <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="New Product"
      description="Create a product and establish its core catalog information."
      actions={
        <button
          type="button"
          onClick={() => router.push("/products")}
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          style={{
            border: "1px solid #cbd5e1",
          }}
        >
          <Icon name="close" size={16} />
          Cancel
        </button>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-6xl space-y-6"
      >
        {/* Back */}

        <button
          type="button"
          onClick={() => router.push("/products")}
          disabled={saving}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-black"
        >
          <Icon name="arrow" size={16} />
          Back to Products
        </button>

        {/* Error */}

        {error && (
          <div
            className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3"
            style={{
              border: "1px solid #fecaca",
            }}
          >
            <div className="mt-0.5 text-red-600">
              <Icon name="warning" size={18} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-800">
                Unable to create product
              </p>

              <p className="mt-1 break-words text-sm text-red-700">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-md p-1 text-red-500 hover:bg-red-100"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        )}

        {/* Product Information */}

        <section
          className="overflow-hidden rounded-xl bg-white shadow-sm"
          style={{
            border: "1px solid #e2e8f0",
          }}
        >
          <SectionHeader
            icon="package"
            title="Product Information"
            description="Define the core information for this product."
          />

          <div className="p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field
                  label="Product name"
                  required
                >
                  <Input
                    value={product.name}
                    onChange={(value) =>
                      setProduct((current) => ({
                        ...current,
                        name: value,
                      }))
                    }
                    placeholder="e.g. Dell Latitude 7420"
                  />
                </Field>

                <p className="mt-1.5 text-xs text-slate-400">
                  The main product name displayed throughout SBS.
                </p>
              </div>

              <Field label="Brand">
                <Input
                  value={product.brand}
                  onChange={(value) =>
                    setProduct((current) => ({
                      ...current,
                      brand: value,
                    }))
                  }
                  placeholder="e.g. Dell"
                />
              </Field>

              <Field label="Category">
                <Input
                  value={product.category}
                  onChange={(value) =>
                    setProduct((current) => ({
                      ...current,
                      category: value,
                    }))
                  }
                  placeholder="e.g. Laptops"
                />
              </Field>

              <Field label="Product type">
                <Select
                  value={product.product_type}
                  onChange={(value) =>
                    setProduct((current) => ({
                      ...current,
                      product_type:
                        value as ProductType,
                    }))
                  }
                />
              </Field>

              <Field label="Tax rate">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={product.tax_rate}
                    onChange={(e) =>
                      setProduct((current) => ({
                        ...current,
                        tax_rate: e.target.value,
                      }))
                    }
                    className="block h-11 w-full rounded-lg bg-white px-3.5 pr-10 text-sm text-slate-900 outline-none hover:border-slate-400 focus:border-black focus:ring-2 focus:ring-slate-200"
                    style={{
                      border: "1px solid #cbd5e1",
                    }}
                  />

                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
                    %
                  </span>
                </div>
              </Field>

              <div className="md:col-span-2">
                <Field label="Description">
                  <TextArea
                    value={product.description}
                    onChange={(value) =>
                      setProduct((current) => ({
                        ...current,
                        description: value,
                      }))
                    }
                    placeholder="Describe the product..."
                  />
                </Field>
              </div>
            </div>

            {/* Inventory Tracking */}

            <div
              className="mt-6 rounded-xl bg-slate-50 p-5"
              style={{
                border: "1px solid #e2e8f0",
              }}
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Inventory tracking">
                  <TrackingSelect
                    value={product.tracking_mode}
                    onChange={(value) =>
                      setProduct((current) => ({
                        ...current,
                        tracking_mode: value,
                        track_inventory:
                          value !== "none",
                      }))
                    }
                  />
                </Field>

                <div className="flex items-end">
                  <div className="w-full">
                    {product.tracking_mode === "none" && (
                      <p className="text-xs leading-5 text-slate-500">
                        SBS will not maintain stock quantities
                        or individual inventory records for this
                        product.
                      </p>
                    )}

                    {product.tracking_mode === "quantity" && (
                      <p className="text-xs leading-5 text-slate-500">
                        SBS will track the total quantity available,
                        but individual units will not be identified.
                      </p>
                    )}

                    {product.tracking_mode === "batch" && (
                      <p className="text-xs leading-5 text-slate-500">
                        SBS will track inventory by batch or lot,
                        allowing groups of units to share a batch
                        identifier.
                      </p>
                    )}

                    {product.tracking_mode === "serial" && (
                      <p className="text-xs leading-5 text-slate-500">
                        SBS will track every physical unit separately
                        using its own serial number. This is ideal
                        for laptops, electronics, equipment, and
                        other individually identifiable assets.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {product.tracking_mode === "serial" && (
                <div
                  className="mt-5 flex items-start gap-3 rounded-lg bg-white px-4 py-3"
                  style={{
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div className="mt-0.5 text-slate-500">
                    <Icon name="info" size={16} />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      Serial tracking enabled
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      When stock is received, SBS will allow
                      individual serial numbers to be recorded
                      and tracked through sales, warehouses,
                      customers, warranty, returns, repairs,
                      and asset history.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Default Variant */}

        <section
          className="overflow-hidden rounded-xl bg-white shadow-sm"
          style={{
            border: "1px solid #e2e8f0",
          }}
        >
          <SectionHeader
            icon="layers"
            title="Default Variant"
            description="Every product starts with one default variant."
          />

          <div className="p-6">
            <div
              className="mb-6 flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3.5"
              style={{
                border: "1px solid #e2e8f0",
              }}
            >
              <div className="mt-0.5 text-slate-500">
                <Icon name="info" size={17} />
              </div>

              <p className="text-xs leading-5 text-slate-600">
                You can add additional variants and options
                from the product workspace after creation.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field
                  label="Variant name"
                  required
                >
                  <Input
                    value={variant.name}
                    onChange={(value) =>
                      setVariant((current) => ({
                        ...current,
                        name: value,
                      }))
                    }
                    placeholder="Default"
                  />
                </Field>
              </div>

              <Field label="SKU">
                <Input
                  value={variant.sku}
                  onChange={(value) =>
                    setVariant((current) => ({
                      ...current,
                      sku: value,
                    }))
                  }
                  placeholder="e.g. DELL-7420-I7"
                  mono
                />
              </Field>

              <Field label="Barcode">
                <Input
                  value={variant.barcode}
                  onChange={(value) =>
                    setVariant((current) => ({
                      ...current,
                      barcode: value,
                    }))
                  }
                  placeholder="UPC / EAN / other"
                  mono
                />
              </Field>

              <Field label="Cost price">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-slate-400">
                    {currency}
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.cost_price}
                    onChange={(e) =>
                      setVariant((current) => ({
                        ...current,
                        cost_price: e.target.value,
                      }))
                    }
                    className="block h-11 w-full rounded-lg bg-white pl-14 pr-3.5 text-sm text-slate-900 outline-none hover:border-slate-400 focus:border-black focus:ring-2 focus:ring-slate-200"
                    style={{
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </div>
              </Field>

              <Field label="Selling price">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-slate-400">
                    {currency}
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.selling_price}
                    onChange={(e) =>
                      setVariant((current) => ({
                        ...current,
                        selling_price:
                          e.target.value,
                      }))
                    }
                    className="block h-11 w-full rounded-lg bg-white pl-14 pr-3.5 text-sm text-slate-900 outline-none hover:border-slate-400 focus:border-black focus:ring-2 focus:ring-slate-200"
                    style={{
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </div>
              </Field>
            </div>

            {/* Pricing */}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div
                className="rounded-xl bg-slate-50 p-4"
                style={{
                  border: "1px solid #e2e8f0",
                }}
              >
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Icon name="dollar" size={14} />
                  Estimated profit
                </div>

                <p
                  className={`mt-2 text-xl font-bold ${
                    profit < 0
                      ? "text-red-600"
                      : "text-slate-900"
                  }`}
                >
                  {money(profit)}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Selling price minus cost price
                </p>
              </div>

              <div
                className="rounded-xl bg-slate-50 p-4"
                style={{
                  border: "1px solid #e2e8f0",
                }}
              >
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Icon name="tag" size={14} />
                  Gross margin
                </div>

                <p
                  className={`mt-2 text-xl font-bold ${
                    margin >= 30
                      ? "text-emerald-600"
                      : margin >= 15
                        ? "text-slate-900"
                        : "text-amber-600"
                  }`}
                >
                  {margin.toFixed(1)}%
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Based on current pricing
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Future workspace */}

        <section
          className="rounded-xl bg-slate-50 p-5"
          style={{
            border: "1px solid #e2e8f0",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500"
              style={{
                border: "1px solid #e2e8f0",
              }}
            >
              <Icon name="box" size={17} />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Product workspace
              </h3>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                After creation, the product workspace will
                manage variants, inventory, identifiers,
                pricing, serial numbers, suppliers, warranty,
                documents, and activity history.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom actions */}

        <div
          className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end"
          style={{
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/products")}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            style={{
              border: "1px solid #cbd5e1",
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving || !companyId}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-black px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Creating Product...
              </>
            ) : (
              <>
                <Icon name="check" size={16} />
                Create Product
              </>
            )}
          </button>
        </div>
      </form>
    </AppShell>
  );
}