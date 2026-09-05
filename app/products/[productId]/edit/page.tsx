import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/server";

type TrackingMode =
  | "none"
  | "quantity"
  | "batch"
  | "serial";

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
  tracking_mode: TrackingMode;
  tax_rate: number;
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
};

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#ffffff",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "#e2e8f0",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "18px 20px",
          borderBottomWidth: "1px",
          borderBottomStyle: "solid",
          borderBottomColor: "#e2e8f0",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          {title}
        </h2>

        {description && (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "#64748b",
            }}
          >
            {description}
          </p>
        )}
      </div>

      <div style={{ padding: 20 }}>{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          marginBottom: 7,
          fontSize: 13,
          fontWeight: 650,
          color: "#334155",
        }}
      >
        {label}

        {required && (
          <span
            style={{
              color: "#dc2626",
              marginLeft: 3,
            }}
          >
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: 42,
  padding: "0 12px",
  background: "#ffffff",
  color: "#0f172a",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#cbd5e1",
  borderRadius: 9,
  outline: "none",
  fontSize: 14,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "auto",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 120,
  padding: "11px 12px",
  background: "#ffffff",
  color: "#0f172a",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#cbd5e1",
  borderRadius: 9,
  outline: "none",
  fontSize: 14,
  resize: "vertical",
  fontFamily: "inherit",
};

function calculateProfitMargin(
  cost: number,
  selling: number
) {
  const profit = selling - cost;

  const margin =
    selling > 0 ? (profit / selling) * 100 : 0;

  return {
    profit,
    margin,
  };
}

function getTrackingDescription(
  trackingMode: TrackingMode
) {
  switch (trackingMode) {
    case "none":
      return "Inventory quantities and individual units are not tracked for this product.";

    case "quantity":
      return "Track stock quantities for this product without tracking individual units.";

    case "batch":
      return "Track stock by batches or lots, useful for products that share the same batch or lot number.";

    case "serial":
      return "Track each physical unit individually using a unique serial number. Serial numbers can later be connected to sales, customers, warehouses, warranties, returns, and repairs.";

    default:
      return "";
  }
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;

  const supabase = await createClient();

  /*
   * Authentication
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * Company membership
   */
  const { data: membership, error: membershipError } =
    await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

  if (membershipError || !membership?.company_id) {
    return (
      <AppShell
        title="Edit Product"
        description="Unable to determine your company."
      >
        <div
          style={{
            background: "#ffffff",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "#fecaca",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 16,
              color: "#991b1b",
            }}
          >
            Company not found
          </h2>

          <p
            style={{
              margin: "0 0 20px",
              fontSize: 14,
              color: "#64748b",
            }}
          >
            Your account is not currently connected
            to a company.
          </p>

          <Link
            href="/products"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#000000",
              color: "#ffffff",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "#000000",
              borderRadius: 9,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Back to Products
          </Link>
        </div>
      </AppShell>
    );
  }

  const companyId = membership.company_id;

  /*
   * Company currency
   */
  const { data: company } = await supabase
    .from("companies")
    .select("currency")
    .eq("id", companyId)
    .maybeSingle();

  const currency = company?.currency || "USD";

  /*
   * Load product.
   *
   * IMPORTANT:
   * Product ID AND company ID are both checked.
   */
  const { data: productData, error: productError } =
    await supabase
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
          tracking_mode,
          tax_rate
        `
      )
      .eq("id", productId)
      .eq("company_id", companyId)
      .maybeSingle();

  if (productError) {
    console.error(
      "Product lookup error:",
      productError
    );
  }

  if (!productData) {
    return (
      <AppShell
        title="Edit Product"
        description="Product not found."
      >
        <div
          style={{
            background: "#ffffff",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "#e2e8f0",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 16,
              color: "#0f172a",
            }}
          >
            Product not found
          </h2>

          <p
            style={{
              margin: "0 0 20px",
              fontSize: 14,
              color: "#64748b",
            }}
          >
            This product does not exist or you do not
            have access to it.
          </p>

          <Link
            href="/products"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#000000",
              color: "#ffffff",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "#000000",
              borderRadius: 9,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Back to Products
          </Link>
        </div>
      </AppShell>
    );
  }

  const product = productData as Product;

  /*
   * Determine tracking mode.
   *
   * New products use tracking_mode directly.
   * The fallback keeps older products compatible.
   */
  const trackingMode: TrackingMode =
    product.tracking_mode ||
    (product.track_inventory
      ? "quantity"
      : "none");

  /*
   * Load default variant.
   *
   * IMPORTANT:
   * We scope by product_id + company_id.
   *
   * Do NOT use:
   * .eq("id", productId)
   *
   * because productId is a product ID, not a
   * product_variants ID.
   */
  const { data: variantData, error: variantError } =
    await supabase
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
          is_active
        `
      )
      .eq("product_id", productId)
      .eq("company_id", companyId)
      .eq("is_default", true)
      .maybeSingle();

  if (variantError) {
    console.error(
      "Default variant lookup error:",
      variantError
    );
  }

  const variant = variantData as ProductVariant | null;

  const costPrice = Number(
    variant?.cost_price || 0
  );

  const sellingPrice = Number(
    variant?.selling_price || 0
  );

  const { profit, margin } =
    calculateProfitMargin(
      costPrice,
      sellingPrice
    );

  return (
    <AppShell
      title="Edit Product"
      description={`Update ${product.name}`}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        {/* Back */}
        <Link
          href={`/products/${product.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            alignSelf: "flex-start",
            color: "#475569",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ← Back to Product
        </Link>

        {/* Product Information */}
        <SectionCard
          title="Product Information"
          description="Update the basic information for this product."
        >
          <form
            action={`/api/products/${product.id}`}
            method="POST"
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: 20,
              }}
            >
              <Field
                label="Product Name"
                required
              >
                <input
                  name="name"
                  type="text"
                  defaultValue={product.name}
                  required
                  style={inputStyle}
                />
              </Field>

              <Field label="Brand">
                <input
                  name="brand"
                  type="text"
                  defaultValue={
                    product.brand || ""
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="Category">
                <input
                  name="category"
                  type="text"
                  defaultValue={
                    product.category || ""
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="Product Type">
                <select
                  name="product_type"
                  defaultValue={
                    product.product_type
                  }
                  style={selectStyle}
                >
                  <option value="physical">
                    Physical
                  </option>

                  <option value="digital">
                    Digital
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>
              </Field>

              <Field label="Status">
                <select
                  name="status"
                  defaultValue={product.status}
                  style={selectStyle}
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="draft">
                    Draft
                  </option>

                  <option value="archived">
                    Archived
                  </option>
                </select>
              </Field>

              <Field label="Tax Rate">
                <input
                  name="tax_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={product.tax_rate}
                  style={inputStyle}
                />
              </Field>

              <div
                style={{
                  gridColumn: "1 / -1",
                }}
              >
                <Field label="Description">
                  <textarea
                    name="description"
                    defaultValue={
                      product.description || ""
                    }
                    style={textareaStyle}
                  />
                </Field>
              </div>
            </div>

            {/* Inventory Tracking */}
            <div
              style={{
                marginTop: 30,
                paddingTop: 26,
                borderTopWidth: "1px",
                borderTopStyle: "solid",
                borderTopColor: "#e2e8f0",
              }}
            >
              <div
                style={{
                  marginBottom: 18,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Inventory Tracking
                </h3>

                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 13,
                    color: "#64748b",
                  }}
                >
                  Choose how SBS should track inventory
                  for this product.
                </p>
              </div>

              <div
                style={{
                  maxWidth: 500,
                }}
              >
                <Field label="Tracking Method">
                  <select
                    name="tracking_mode"
                    defaultValue={trackingMode}
                    style={selectStyle}
                  >
                    <option value="none">
                      No Tracking
                    </option>

                    <option value="quantity">
                      Quantity
                    </option>

                    <option value="batch">
                      Batch / Lot
                    </option>

                    <option value="serial">
                      Serial Numbers
                    </option>
                  </select>
                </Field>

                <div
                  style={{
                    marginTop: 12,
                    padding: 14,
                    background:
                      trackingMode === "serial"
                        ? "#f8fafc"
                        : "#f8fafc",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor:
                      trackingMode === "serial"
                        ? "#cbd5e1"
                        : "#e2e8f0",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#334155",
                      marginBottom: 5,
                    }}
                  >
                    {trackingMode === "none" &&
                      "No inventory tracking"}

                    {trackingMode === "quantity" &&
                      "Quantity tracking enabled"}

                    {trackingMode === "batch" &&
                      "Batch / lot tracking enabled"}

                    {trackingMode === "serial" &&
                      "Serial tracking enabled"}
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: "#64748b",
                    }}
                  >
                    {getTrackingDescription(
                      trackingMode
                    )}
                  </p>
                </div>
              </div>

              {trackingMode === "serial" && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    background: "#ffffff",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor: "#e2e8f0",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        marginTop: 5,
                        borderRadius: "50%",
                        background: "#000000",
                        flexShrink: 0,
                      }}
                    />

                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#0f172a",
                          marginBottom: 4,
                        }}
                      >
                        Serial numbers are managed
                        separately
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          lineHeight: 1.55,
                          color: "#64748b",
                        }}
                      >
                        After saving, individual units
                        can be added from the Serial
                        Numbers module. Each physical unit
                        can have its own serial number,
                        barcode, status, cost, warranty,
                        customer, and transaction history.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Default Variant */}
            <div
              style={{
                marginTop: 30,
                paddingTop: 26,
                borderTopWidth: "1px",
                borderTopStyle: "solid",
                borderTopColor: "#e2e8f0",
              }}
            >
              <div
                style={{
                  marginBottom: 18,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Default Variant
                </h3>

                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 13,
                    color: "#64748b",
                  }}
                >
                  Update the default SKU, barcode,
                  and pricing.
                </p>
              </div>

              {variant ? (
                <>
                  <input
                    type="hidden"
                    name="variant_id"
                    value={variant.id}
                  />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(2, minmax(0, 1fr))",
                      gap: 20,
                    }}
                  >
                    <Field
                      label="Variant Name"
                      required
                    >
                      <input
                        name="variant_name"
                        type="text"
                        defaultValue={
                          variant.name
                        }
                        required
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="SKU">
                      <input
                        name="sku"
                        type="text"
                        defaultValue={
                          variant.sku || ""
                        }
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="Barcode">
                      <input
                        name="barcode"
                        type="text"
                        defaultValue={
                          variant.barcode || ""
                        }
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="Cost Price">
                      <input
                        name="cost_price"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={
                          variant.cost_price
                        }
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="Selling Price">
                      <input
                        name="selling_price"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={
                          variant.selling_price
                        }
                        style={inputStyle}
                      />
                    </Field>
                  </div>

                  {/* Pricing Summary */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(3, minmax(0, 1fr))",
                      gap: 14,
                      marginTop: 22,
                    }}
                  >
                    <div
                      style={{
                        borderWidth: "1px",
                        borderStyle: "solid",
                        borderColor: "#e2e8f0",
                        borderRadius: 10,
                        padding: 15,
                        background: "#f8fafc",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#64748b",
                          marginBottom: 6,
                        }}
                      >
                        Current Cost
                      </div>

                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          color: "#0f172a",
                        }}
                      >
                        {formatMoney(
                          costPrice,
                          currency
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        borderWidth: "1px",
                        borderStyle: "solid",
                        borderColor: "#e2e8f0",
                        borderRadius: 10,
                        padding: 15,
                        background: "#f8fafc",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#64748b",
                          marginBottom: 6,
                        }}
                      >
                        Current Profit
                      </div>

                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          color:
                            profit >= 0
                              ? "#166534"
                              : "#b91c1c",
                        }}
                      >
                        {formatMoney(
                          profit,
                          currency
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        borderWidth: "1px",
                        borderStyle: "solid",
                        borderColor: "#e2e8f0",
                        borderRadius: 10,
                        padding: 15,
                        background: "#f8fafc",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#64748b",
                          marginBottom: 6,
                        }}
                      >
                        Current Margin
                      </div>

                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          color:
                            margin >= 0
                              ? "#166534"
                              : "#b91c1c",
                        }}
                      >
                        {margin.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    padding: 18,
                    background: "#f8fafc",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor: "#e2e8f0",
                    borderRadius: 10,
                    fontSize: 14,
                    color: "#64748b",
                  }}
                >
                  This product does not have a default
                  variant.
                </div>
              )}
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 10,
                marginTop: 30,
                paddingTop: 20,
                borderTopWidth: "1px",
                borderTopStyle: "solid",
                borderTopColor: "#e2e8f0",
              }}
            >
              <Link
                href={`/products/${product.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#ffffff",
                  color: "#0f172a",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "#cbd5e1",
                  borderRadius: 9,
                  padding: "10px 17px",
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Cancel
              </Link>

              <button
                type="submit"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#000000",
                  color: "#ffffff",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "#000000",
                  borderRadius: 9,
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Save Changes
              </button>
            </div>
          </form>
        </SectionCard>
      </div>
    </AppShell>
  );
}