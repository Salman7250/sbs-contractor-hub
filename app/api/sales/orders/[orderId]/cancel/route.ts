import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    let body: { reason?: unknown } = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const reason =
      typeof body.reason === "string" &&
      body.reason.trim()
        ? body.reason.trim()
        : "Sales order cancellation";

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership?.company_id) {
      return NextResponse.json(
        { error: "No company membership was found." },
        { status: 403 }
      );
    }

    const { data, error } = await supabase.rpc(
      "cancel_sales_order",
      {
        p_company_id: membership.company_id,
        p_order_id: orderId,
        p_reason: reason,
      }
    );

    if (error) {
      console.error(
        "cancel_sales_order RPC error:",
        error
      );

      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    const result = Array.isArray(data)
      ? data[0]
      : data;

    return NextResponse.json({
      success: true,
      ...(result || {}),
    });
  } catch (error) {
    console.error(
      "POST /api/sales/orders/[orderId]/cancel error:",
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