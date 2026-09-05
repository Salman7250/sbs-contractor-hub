import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = {
  params: Promise<{
    serialId: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { serialId } = await params;

    if (!serialId) {
      return NextResponse.json(
        {
          error: "Serial number ID is required.",
        },
        { status: 400 }
      );
    }

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

    const productId =
      typeof body.product_id === "string"
        ? body.product_id
        : "";

    const variantId =
      typeof body.variant_id === "string" &&
      body.variant_id.trim()
        ? body.variant_id
        : null;

    const serialNumber =
      typeof body.serial_number === "string"
        ? body.serial_number.trim()
        : "";

    const barcode =
      typeof body.barcode === "string"
        ? body.barcode.trim()
        : "";

    const status = body.status;

    const costPrice = Number(
      body.cost_price ?? 0
    );

    const warrantyStart =
      body.warranty_start || null;

    const warrantyEnd =
      body.warranty_end || null;

    const receivedAt =
      body.received_at || null;

    const soldAt =
      body.sold_at || null;

    const notes =
      typeof body.notes === "string"
        ? body.notes.trim() || null
        : null;

    // ------------------------------------------------------
    // Basic validation
    // ------------------------------------------------------

    if (!productId) {
      return NextResponse.json(
        {
          error: "Product is required.",
        },
        { status: 400 }
      );
    }

    if (!serialNumber) {
      return NextResponse.json(
        {
          error: "Serial number is required.",
        },
        { status: 400 }
      );
    }

    if (
      Number.isNaN(costPrice) ||
      costPrice < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Cost price must be a valid non-negative number.",
        },
        { status: 400 }
      );
    }

    const validStatuses = [
      "available",
      "reserved",
      "sold",
      "returned",
      "repair",
      "rma",
      "damaged",
      "lost",
      "disposed",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: "Invalid serial number status.",
        },
        { status: 400 }
      );
    }

    if (
      warrantyStart &&
      warrantyEnd &&
      warrantyEnd < warrantyStart
    ) {
      return NextResponse.json(
        {
          error:
            "Warranty end date cannot be before warranty start date.",
        },
        { status: 400 }
      );
    }

    // ------------------------------------------------------
    // Load existing serial
    // ------------------------------------------------------

    const {
      data: existingSerial,
      error: existingError,
    } = await supabase
      .from("serialized_units")
      .select(
        `
          id,
          company_id,
          product_id,
          variant_id,
          serial_number,
          barcode,
          status,
          warehouse_id,
          customer_id,
          order_id,
          invoice_id
        `
      )
      .eq("id", serialId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (existingError) {
      console.error(existingError);

      return NextResponse.json(
        {
          error:
            "Unable to load the existing serial number.",
        },
        { status: 500 }
      );
    }

    if (!existingSerial) {
      return NextResponse.json(
        {
          error: "Serial number not found.",
        },
        { status: 404 }
      );
    }

    // ------------------------------------------------------
    // Validate product
    // ------------------------------------------------------

    const {
      data: product,
      error: productError,
    } = await supabase
      .from("products")
      .select(
        `
          id,
          company_id,
          tracking_mode,
          status
        `
      )
      .eq("id", productId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (productError) {
      console.error(productError);

      return NextResponse.json(
        {
          error: "Unable to validate product.",
        },
        { status: 500 }
      );
    }

    if (!product) {
      return NextResponse.json(
        {
          error: "Selected product was not found.",
        },
        { status: 400 }
      );
    }

    if (product.tracking_mode !== "serial") {
      return NextResponse.json(
        {
          error:
            "Selected product is not configured for serial number tracking.",
        },
        { status: 400 }
      );
    }

    // ------------------------------------------------------
    // Validate variant
    // ------------------------------------------------------

    if (variantId) {
      const {
        data: variant,
        error: variantError,
      } = await supabase
        .from("product_variants")
        .select(
          `
            id,
            product_id,
            company_id,
            is_active
          `
        )
        .eq("id", variantId)
        .eq("product_id", productId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (variantError) {
        console.error(variantError);

        return NextResponse.json(
          {
            error: "Unable to validate variant.",
          },
          { status: 500 }
        );
      }

      if (!variant) {
        return NextResponse.json(
          {
            error:
              "Selected variant was not found.",
          },
          { status: 400 }
        );
      }

      if (!variant.is_active) {
        return NextResponse.json(
          {
            error:
              "Selected variant is inactive.",
          },
          { status: 400 }
        );
      }
    }

    // ------------------------------------------------------
    // Duplicate serial check
    // ------------------------------------------------------

    const {
      data: duplicateSerial,
      error: duplicateSerialError,
    } = await supabase
      .from("serialized_units")
      .select("id")
      .eq("company_id", companyId)
      .ilike(
        "serial_number",
        serialNumber
      )
      .neq("id", serialId)
      .limit(1)
      .maybeSingle();

    if (duplicateSerialError) {
      console.error(duplicateSerialError);

      return NextResponse.json(
        {
          error:
            "Unable to check serial number uniqueness.",
        },
        { status: 500 }
      );
    }

    if (duplicateSerial) {
      return NextResponse.json(
        {
          error: `Serial number "${serialNumber}" is already assigned to another unit.`,
        },
        { status: 409 }
      );
    }

    // ------------------------------------------------------
    // Duplicate barcode check
    // ------------------------------------------------------

    if (barcode) {
      const {
        data: duplicateBarcode,
        error: duplicateBarcodeError,
      } = await supabase
        .from("serialized_units")
        .select("id")
        .eq("company_id", companyId)
        .eq("barcode", barcode)
        .neq("id", serialId)
        .limit(1)
        .maybeSingle();

      if (duplicateBarcodeError) {
        console.error(
          duplicateBarcodeError
        );

        return NextResponse.json(
          {
            error:
              "Unable to check barcode uniqueness.",
          },
          { status: 500 }
        );
      }

      if (duplicateBarcode) {
        return NextResponse.json(
          {
            error: `Barcode "${barcode}" is already assigned to another unit.`,
          },
          { status: 409 }
        );
      }
    }

    // ------------------------------------------------------
    // Update serial
    // ------------------------------------------------------

    const { error: updateError } =
      await supabase
        .from("serialized_units")
        .update({
          product_id: productId,
          variant_id: variantId,
          serial_number: serialNumber,
          barcode: barcode || null,
          status,
          cost_price: costPrice,
          warranty_start: warrantyStart,
          warranty_end: warrantyEnd,
          received_at: receivedAt
            ? `${receivedAt}T00:00:00`
            : null,
          sold_at: soldAt
            ? `${soldAt}T00:00:00`
            : null,
          notes,
        })
        .eq("id", serialId)
        .eq("company_id", companyId);

    if (updateError) {
      console.error(updateError);

      if (updateError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "The serial number or barcode is already in use.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error:
            "Unable to update serial number.",
        },
        { status: 500 }
      );
    }

    // ------------------------------------------------------
    // History: status change
    // ------------------------------------------------------

    if (
      existingSerial.status !== status
    ) {
      const {
        error: historyError,
      } = await supabase
        .from("serial_number_history")
        .insert({
          company_id: companyId,
          serialized_unit_id: serialId,
          event_type: "status_changed",
          from_status:
            existingSerial.status,
          to_status: status,
          from_warehouse_id:
            existingSerial.warehouse_id,
          to_warehouse_id:
            existingSerial.warehouse_id,
          reference_type:
            "serialized_unit",
          reference_id: serialId,
          notes: `Status changed from ${existingSerial.status} to ${status}.`,
          created_by: user.id,
        });

      if (historyError) {
        console.error(
          "History error:",
          historyError
        );
      }
    }

    // ------------------------------------------------------
    // History: serial number changed
    // ------------------------------------------------------

    if (
      existingSerial.serial_number !==
      serialNumber
    ) {
      const {
        error: historyError,
      } = await supabase
        .from("serial_number_history")
        .insert({
          company_id: companyId,
          serialized_unit_id: serialId,
          event_type: "updated",
          from_status: status,
          to_status: status,
          from_warehouse_id:
            existingSerial.warehouse_id,
          to_warehouse_id:
            existingSerial.warehouse_id,
          reference_type:
            "serialized_unit",
          reference_id: serialId,
          notes: `Serial number changed from "${existingSerial.serial_number}" to "${serialNumber}".`,
          created_by: user.id,
        });

      if (historyError) {
        console.error(
          "History error:",
          historyError
        );
      }
    }

    // ------------------------------------------------------
    // Success
    // ------------------------------------------------------

    return NextResponse.json({
      success: true,
      id: serialId,
    });
  } catch (error) {
    console.error(
      "PATCH /api/serial-numbers/[serialId] error:",
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