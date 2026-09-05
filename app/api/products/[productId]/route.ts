import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TrackingMode = "none" | "quantity" | "batch" | "serial";

function parseNumber(value: FormDataEntryValue | null, fallback = 0) {
  if (typeof value !== "string") return fallback;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

function isTrackingMode(value: string | null): value is TrackingMode {
  return (
    value === "none" ||
    value === "quantity" ||
    value === "batch" ||
    value === "serial"
  );
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ productId: string }>;
  }
) {
  try {
    const { productId } = await context.params;

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // ---------------------------------------------------------
    // 1. Authenticate user
    // ---------------------------------------------------------
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(
        new URL("/login", request.url)
      );
    }

    // ---------------------------------------------------------
    // 2. Find the user's company
    // ---------------------------------------------------------
    const { data: membership, error: membershipError } =
      await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

    if (membershipError) {
      console.error(
        "Membership lookup error:",
        membershipError
      );

      return NextResponse.json(
        { error: "Unable to verify company membership." },
        { status: 500 }
      );
    }

    if (!membership?.company_id) {
      return NextResponse.json(
        { error: "No company membership found." },
        { status: 403 }
      );
    }

    const companyId = membership.company_id;

    // ---------------------------------------------------------
    // 3. Verify product belongs to this company
    // ---------------------------------------------------------
    const { data: existingProduct, error: productLookupError } =
      await supabase
        .from("products")
        .select(
          `
            id,
            company_id,
            tracking_mode,
            track_inventory
          `
        )
        .eq("id", productId)
        .eq("company_id", companyId)
        .maybeSingle();

    if (productLookupError) {
      console.error(
        "Product lookup error:",
        productLookupError
      );

      return NextResponse.json(
        { error: "Unable to load product." },
        { status: 500 }
      );
    }

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // 4. Read submitted form data
    // ---------------------------------------------------------
    const formData = await request.formData();

    const name = cleanString(formData.get("name"));

    if (!name) {
      return NextResponse.json(
        { error: "Product name is required." },
        { status: 400 }
      );
    }

    const description = cleanString(
      formData.get("description")
    );

    const brand = cleanString(formData.get("brand"));

    const category = cleanString(
      formData.get("category")
    );

    const productType = cleanString(
      formData.get("product_type")
    );

    const status = cleanString(
      formData.get("status")
    );

    const taxRate = parseNumber(
      formData.get("tax_rate"),
      0
    );

    // ---------------------------------------------------------
    // 5. Tracking mode
    // ---------------------------------------------------------
    const submittedTrackingMode = cleanString(
      formData.get("tracking_mode")
    );

    const trackingMode: TrackingMode = isTrackingMode(
      submittedTrackingMode
    )
      ? submittedTrackingMode
      : existingProduct.tracking_mode ||
        (existingProduct.track_inventory
          ? "quantity"
          : "none");

    // Keep legacy track_inventory synchronized.
    const trackInventory = trackingMode !== "none";

    // ---------------------------------------------------------
    // 6. Validate numeric values
    // ---------------------------------------------------------
    if (taxRate < 0 || taxRate > 100) {
      return NextResponse.json(
        { error: "Tax rate must be between 0 and 100." },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 7. Update product
    // ---------------------------------------------------------
    const { error: updateProductError } = await supabase
      .from("products")
      .update({
        name,
        description,
        brand,
        category,
        product_type: productType || "physical",
        status: status || "active",
        tax_rate: taxRate,
        tracking_mode: trackingMode,
        track_inventory: trackInventory,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("company_id", companyId);

    if (updateProductError) {
      console.error(
        "Product update error:",
        updateProductError
      );

      return NextResponse.json(
        {
          error:
            updateProductError.message ||
            "Failed to update product.",
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 8. Find the default variant
    // ---------------------------------------------------------
    const { data: defaultVariant, error: variantLookupError } =
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

    if (variantLookupError) {
      console.error(
        "Variant lookup error:",
        variantLookupError
      );

      return NextResponse.redirect(
        new URL(`/products/${productId}`, request.url)
      );
    }

    // ---------------------------------------------------------
    // 9. Read variant fields
    // ---------------------------------------------------------
    const variantName =
      cleanString(formData.get("variant_name")) ||
      "Default";

    const sku = cleanString(formData.get("sku"));

    const barcode = cleanString(
      formData.get("barcode")
    );

    const costPrice = parseNumber(
      formData.get("cost_price"),
      0
    );

    const sellingPrice = parseNumber(
      formData.get("selling_price"),
      0
    );

    if (costPrice < 0 || sellingPrice < 0) {
      return NextResponse.json(
        {
          error:
            "Cost price and selling price cannot be negative.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 10. Update existing default variant
    // ---------------------------------------------------------
    if (defaultVariant) {
      const { error: updateVariantError } = await supabase
        .from("product_variants")
        .update({
          name: variantName,
          sku,
          barcode,
          cost_price: costPrice,
          selling_price: sellingPrice,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", defaultVariant.id)
        .eq("company_id", companyId)
        .eq("product_id", productId);

      if (updateVariantError) {
        console.error(
          "Variant update error:",
          updateVariantError
        );

        return NextResponse.json(
          {
            error:
              updateVariantError.message ||
              "Product updated, but the default variant could not be updated.",
          },
          { status: 500 }
        );
      }
    } else {
      // -------------------------------------------------------
      // 11. Create default variant if one doesn't exist
      // -------------------------------------------------------
      const { error: createVariantError } = await supabase
        .from("product_variants")
        .insert({
          company_id: companyId,
          product_id: productId,
          name: variantName,
          sku,
          barcode,
          cost_price: costPrice,
          selling_price: sellingPrice,
          is_default: true,
          is_active: true,
        });

      if (createVariantError) {
        console.error(
          "Default variant creation error:",
          createVariantError
        );

        return NextResponse.json(
          {
            error:
              createVariantError.message ||
              "Product updated, but the default variant could not be created.",
          },
          { status: 500 }
        );
      }
    }

    // ---------------------------------------------------------
    // 12. Redirect back to product view
    // ---------------------------------------------------------
    return NextResponse.redirect(
      new URL(`/products/${productId}`, request.url),
      303
    );
  } catch (error) {
    console.error(
      "Unexpected product update error:",
      error
    );

    return NextResponse.json(
      {
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}