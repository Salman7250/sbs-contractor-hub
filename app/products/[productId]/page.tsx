import Link from "next/link";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/server";

type Product = {
  id: string;
  company_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  category: string | null;
  brand: string | null;
  product_type: "physical" | "digital" | "other";
  status: "active" | "archived" | "draft";
  track_inventory: boolean;
  tax_rate: number;
  created_at: string;
  updated_at: string;
};

type ProductVariant = {
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

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function getStatusLabel(status: Product["status"]) {
  switch (status) {
    case "active":
      return "Active";
    case "archived":
      return "Archived";
    case "draft":
      return "Draft";
    default:
      return status;
  }
}

export default async function ProductViewPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            Please sign in
          </h1>

          <p
            style={{
              marginTop: 8,
              color: "#64748b",
              fontSize: 15,
            }}
          >
            You need to be signed in to view this product.
          </p>
        </div>
      </div>
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership?.company_id) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            Company not found
          </h1>

          <p
            style={{
              marginTop: 8,
              color: "#64748b",
              fontSize: 15,
            }}
          >
            Your account is not currently connected to a company.
          </p>
        </div>
      </div>
    );
  }

  const companyId = membership.company_id;

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, currency")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError || !company) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            Company not found
          </h1>

          <p
            style={{
              marginTop: 8,
              color: "#64748b",
              fontSize: 15,
            }}
          >
            We could not load your company information.
          </p>
        </div>
      </div>
    );
  }

  const currency = company.currency || "USD";

  const { data: productData, error: productError } = await supabase
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
        created_at,
        updated_at
      `
    )
    .eq("id", productId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (productError || !productData) {
    return (
      <AppShell
        title="Product Not Found"
        description="The product could not be found."
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 32,
            textAlign: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            Product not found
          </h2>

          <p
            style={{
              marginTop: 8,
              color: "#64748b",
              fontSize: 14,
            }}
          >
            This product may have been deleted or you may not have access to
            it.
          </p>

          <Link
            href="/products"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 20,
              padding: "10px 16px",
              borderRadius: 8,
              background: "#111111",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Back to Products
          </Link>
        </div>
      </AppShell>
    );
  }

  const product = productData as Product;

  const { data: variantData, error: variantError } = await supabase
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
      `
    )
    .eq("product_id", productId)
    .eq("company_id", companyId)
    .eq("is_default", true)
    .maybeSingle();

  if (variantError) {
    console.error("Error loading product variant:", variantError);
  }

  const variant = variantData as ProductVariant | null;

  const cost = Number(variant?.cost_price ?? 0);
  const sellingPrice = Number(variant?.selling_price ?? 0);

  const profit = sellingPrice - cost;

  const margin =
    sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  const productTypeLabel =
    product.product_type.charAt(0).toUpperCase() +
    product.product_type.slice(1);

  return (
    <AppShell
      title={product.name}
      description="View product details, pricing, and inventory settings."
      actions={
        <Link
          href={`/products/${product.id}/edit`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 16px",
            borderRadius: 8,
            background: "#111111",
            color: "#ffffff",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 700,
            border: "1px solid #111111",
          }}
        >
          Edit Product
        </Link>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Back */}
        <div>
          <Link
            href="/products"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              color: "#475569",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 18 }}>←</span>
            Back to Products
          </Link>
        </div>

        {/* Product Header */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <h1
                  style={{
                    margin: 0,
                    fontSize: 28,
                    lineHeight: 1.2,
                    fontWeight: 800,
                    color: "#111827",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {product.name}
                </h1>

                {product.track_inventory && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "5px 9px",
                      borderRadius: 999,
                      background: "#f1f5f9",
                      color: "#334155",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Inventory tracked
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 10,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "5px 9px",
                    borderRadius: 999,
                    background:
                      product.status === "active"
                        ? "#ecfdf5"
                        : product.status === "draft"
                          ? "#fffbeb"
                          : "#f1f5f9",
                    color:
                      product.status === "active"
                        ? "#047857"
                        : product.status === "draft"
                          ? "#b45309"
                          : "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {getStatusLabel(product.status)}
                </span>

                {(product.brand || product.category) && (
                  <>
                    <span
                      style={{
                        color: "#cbd5e1",
                      }}
                    >
                      •
                    </span>

                    <span
                      style={{
                        color: "#64748b",
                        fontSize: 14,
                      }}
                    >
                      {product.brand || "No brand"}
                      {product.category
                        ? ` • ${product.category}`
                        : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Product Information */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 20px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              Product Information
            </h2>
          </div>

          <div
            style={{
              padding: 20,
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Product Name
              </div>

              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {product.name}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Brand
              </div>

              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {product.brand || "—"}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Category
              </div>

              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {product.category || "—"}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Product Type
              </div>

              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {productTypeLabel}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Tax Rate
              </div>

              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {Number(product.tax_rate || 0).toFixed(2)}%
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Inventory
              </div>

              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {product.track_inventory
                  ? "Inventory tracked"
                  : "Inventory not tracked"}
              </div>
            </div>

            <div
              style={{
                gridColumn: "1 / -1",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Description
              </div>

              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: "#475569",
                  whiteSpace: "pre-wrap",
                }}
              >
                {product.description || "No description added."}
              </div>
            </div>
          </div>
        </div>

        {/* Default Variant */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 20px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              Default Variant
            </h2>
          </div>

          {variant ? (
            <div
              style={{
                padding: 20,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 20,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      marginBottom: 6,
                    }}
                  >
                    Variant Name
                  </div>

                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {variant.name}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      marginBottom: 6,
                    }}
                  >
                    SKU
                  </div>

                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {variant.sku || "—"}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      marginBottom: 6,
                    }}
                  >
                    Barcode
                  </div>

                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {variant.barcode || "—"}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      marginBottom: 6,
                    }}
                  >
                    Cost Price
                  </div>

                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#111827",
                    }}
                  >
                    {formatMoney(cost, currency)}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      marginBottom: 6,
                    }}
                  >
                    Selling Price
                  </div>

                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#111827",
                    }}
                  >
                    {formatMoney(sellingPrice, currency)}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      marginBottom: 6,
                    }}
                  >
                    Estimated Profit
                  </div>

                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: profit >= 0 ? "#047857" : "#dc2626",
                    }}
                  >
                    {formatMoney(profit, currency)}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      marginBottom: 6,
                    }}
                  >
                    Margin
                  </div>

                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: margin >= 0 ? "#111827" : "#dc2626",
                    }}
                  >
                    {margin.toFixed(2)}%
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      marginBottom: 6,
                    }}
                  >
                    Variant Status
                  </div>

                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {variant.is_active ? "Active" : "Inactive"}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: 24,
                color: "#64748b",
                fontSize: 14,
              }}
            >
              No default variant found for this product.
            </div>
          )}
        </div>

        {/* Product Metadata */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 20px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              Product Details
            </h2>
          </div>

          <div
            style={{
              padding: 20,
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Product ID
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: "#475569",
                  wordBreak: "break-all",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {product.id}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Created
              </div>

              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {formatDate(product.created_at)}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Last Updated
              </div>

              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {formatDate(product.updated_at)}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Slug
              </div>

              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {product.slug || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}