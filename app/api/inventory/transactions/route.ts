import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";


export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ------------------------------------------------------
    // Authenticate
    // ------------------------------------------------------

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    // ------------------------------------------------------
    // Company membership
    // ------------------------------------------------------

    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error(membershipError);

      return NextResponse.json(
        {
          error: "Unable to verify company membership.",
        },
        { status: 500 }
      );
    }

    if (!membership?.company_id) {
      return NextResponse.json(
        {
          error: "No company membership found.",
        },
        { status: 403 }
      );
    }

    const companyId = membership.company_id;

    // ------------------------------------------------------
    // Parse body
    // ------------------------------------------------------

    const body = await request.json();

    const action =
      typeof body.action === "string"
        ? body.action
        : "";

    const productId =
      typeof body.product_id === "string"
        ? body.product_id
        : "";

    const variantId =
      typeof body.variant_id === "string"
        ? body.variant_id
        : "";

    const warehouseId =
      typeof body.warehouse_id === "string"
        ? body.warehouse_id
        : "";

    const locationId =
      typeof body.location_id === "string"
        ? body.location_id
        : "";

    const quantity = Number(body.quantity);

    const movementType =
      typeof body.movement_type === "string"
        ? body.movement_type
        : "stock_out";

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim() || null
        : null;

    const referenceType =
      typeof body.reference_type === "string"
        ? body.reference_type.trim() || null
        : null;

    const referenceId =
      typeof body.reference_id === "string" &&
      body.reference_id.trim()
        ? body.reference_id
        : null;

    const notes =
      typeof body.notes === "string"
        ? body.notes.trim() || null
        : null;

    // ------------------------------------------------------
    // Basic validation
    // ------------------------------------------------------

    if (
      action !== "stock_in" &&
      action !== "stock_out"
    ) {
      return NextResponse.json(
        {
          error:
            'Action must be either "stock_in" or "stock_out".',
        },
        { status: 400 }
      );
    }

    if (!productId) {
      return NextResponse.json(
        {
          error: "Product is required.",
        },
        { status: 400 }
      );
    }

    if (!variantId) {
      return NextResponse.json(
        {
          error: "Product variant is required.",
        },
        { status: 400 }
      );
    }

    if (!warehouseId) {
      return NextResponse.json(
        {
          error: "Warehouse is required.",
        },
        { status: 400 }
      );
    }

    if (!locationId) {
      return NextResponse.json(
        {
          error: "Location is required.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Quantity must be a positive whole number.",
        },
        { status: 400 }
      );
    }

    // ------------------------------------------------------
    // Stock In
    // ------------------------------------------------------

    if (action === "stock_in") {
      const {
        data,
        error,
      } = await supabase.rpc(
        "inventory_stock_in",
        {
          p_company_id: companyId,
          p_product_id: productId,
          p_variant_id: variantId,
          p_warehouse_id: warehouseId,
          p_location_id: locationId,
          p_quantity: quantity,
          p_reason: reason,
          p_reference_type: referenceType,
          p_reference_id: referenceId,
          p_notes: notes,
        }
      );

      if (error) {
        console.error(
          "inventory_stock_in RPC error:",
          error
        );

        return NextResponse.json(
          {
            error: error.message,
          },
          { status: 400 }
        );
      }

      const result =
        Array.isArray(data) ? data[0] : data;

      return NextResponse.json({
        success: true,
        action,
        transaction: result ?? null,
      });
    }

    // ------------------------------------------------------
    // Stock Out
    // ------------------------------------------------------

    const validMovementTypes = [
      "stock_out",
      "sale",
      "adjustment_out",
      "transfer_out",
    ];

    if (
      !validMovementTypes.includes(
        movementType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid stock-out movement type.",
        },
        { status: 400 }
      );
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "inventory_stock_out",
      {
        p_company_id: companyId,
        p_product_id: productId,
        p_variant_id: variantId,
        p_warehouse_id: warehouseId,
        p_location_id: locationId,
        p_quantity: quantity,
        p_movement_type: movementType,
        p_reason: reason,
        p_reference_type: referenceType,
        p_reference_id: referenceId,
        p_notes: notes,
      }
    );

    if (error) {
      console.error(
        "inventory_stock_out RPC error:",
        error
      );

      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 400 }
      );
    }

    const result =
      Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      success: true,
      action,
      transaction: result ?? null,
    });
  } catch (error) {
    console.error(
      "POST /api/inventory/transactions error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}