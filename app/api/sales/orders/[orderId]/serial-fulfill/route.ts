import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SerialAllocation = {
  order_item_id: string;
  serialized_unit_ids: string[];
};

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      orderId: string;
    }>;
  }
) {
  try {
    const { orderId } =
      await context.params;

    if (!orderId) {
      return NextResponse.json(
        {
          error:
            "Order ID is required.",
        },
        { status: 400 }
      );
    }

    const body =
      await request.json();

    const warehouseId =
      typeof body.warehouse_id ===
      "string"
        ? body.warehouse_id.trim()
        : "";

    const locationId =
      typeof body.location_id ===
      "string"
        ? body.location_id.trim()
        : "";

    const allocations =
      Array.isArray(
        body.allocations
      )
        ? (body.allocations as SerialAllocation[])
        : [];

    if (
      !warehouseId ||
      !locationId
    ) {
      return NextResponse.json(
        {
          error:
            "A warehouse and location are required to fulfill an order.",
        },
        { status: 400 }
      );
    }

    if (
      allocations.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "At least one serial allocation is required.",
        },
        { status: 400 }
      );
    }

    for (
      const allocation of allocations
    ) {
      if (
        !allocation ||
        typeof allocation.order_item_id !==
          "string" ||
        !Array.isArray(
          allocation.serialized_unit_ids
        ) ||
        allocation
          .serialized_unit_ids
          .length === 0
      ) {
        return NextResponse.json(
          {
            error:
              "Each allocation must contain an order item and at least one serial unit.",
          },
          { status: 400 }
        );
      }

      if (
        allocation.serialized_unit_ids.some(
          (id) =>
            typeof id !==
              "string" ||
            !id.trim()
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Serial unit IDs must be valid strings.",
          },
          { status: 400 }
        );
      }
    }

    const supabase =
      await createClient();

    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth.getUser();

    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const {
      data: membership,
      error: membershipError,
    } =
      await supabase
        .from(
          "company_members"
        )
        .select(
          "company_id"
        )
        .eq(
          "user_id",
          user.id
        )
        .limit(1)
        .maybeSingle();

    if (
      membershipError ||
      !membership?.company_id
    ) {
      return NextResponse.json(
        {
          error:
            "No company membership was found.",
        },
        { status: 403 }
      );
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "fulfill_serial_sales_order",
      {
        p_company_id:
          membership.company_id,
        p_order_id:
          orderId,
        p_warehouse_id:
          warehouseId,
        p_location_id:
          locationId,
        p_allocations:
          allocations,
      }
    );

    if (error) {
      console.error(
        "fulfill_serial_sales_order RPC error:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message,
        },
        { status: 409 }
      );
    }

    const result =
      Array.isArray(data)
        ? data[0]
        : data;

    return NextResponse.json({
      success: true,
      ...(result || {}),
    });
  } catch (error) {
    console.error(
      "POST /api/sales/orders/[orderId]/serial-fulfill error:",
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