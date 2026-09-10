import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type WarrantyPayload = {
  warranty_number?: string;
  customer_id?: string;
  product_id?: string;
  serial_number?: string;
  coverage_type?: string;
  purchase_date?: string;
  start_date?: string;
  end_date?: string;
  terms?: string;
  notes?: string;
};

const allowedCoverageTypes = new Set([
  "standard",
  "extended",
  "limited",
  "parts_only",
  "labor_only",
  "custom",
]);

function cleanOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.company_id) {
    return NextResponse.json(
      { error: "No company membership was found." },
      { status: 403 },
    );
  }

  const companyId = membership.company_id;

  const [customersResult, productsResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name", { ascending: true }),

    supabase
      .from("products")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name", { ascending: true }),
  ]);

  if (customersResult.error) {
    return NextResponse.json(
      { error: customersResult.error.message },
      { status: 500 },
    );
  }

  if (productsResult.error) {
    return NextResponse.json(
      { error: productsResult.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    customers: customersResult.data ?? [],
    products: productsResult.data ?? [],
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.company_id) {
    return NextResponse.json(
      { error: "No company membership was found." },
      { status: 403 },
    );
  }

  const companyId = membership.company_id;

  const hasManagePermission =
    await supabase.rpc("employee_has_permission", {
      p_company_id: companyId,
      p_module: "warranty",
      p_action: "manage",
    });

  const { data: companyAdmin } = await supabase.rpc(
    "is_company_admin",
    {
      p_company_id: companyId,
    },
  );

  if (!hasManagePermission.data && !companyAdmin) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to create warranty records.",
      },
      { status: 403 },
    );
  }

  let body: WarrantyPayload;

  try {
    body = (await request.json()) as WarrantyPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const coverageType = cleanOptionalString(body.coverage_type);

  if (
    !coverageType ||
    !allowedCoverageTypes.has(coverageType)
  ) {
    return NextResponse.json(
      { error: "Invalid warranty coverage type." },
      { status: 400 },
    );
  }

  const startDate = cleanOptionalString(body.start_date);
  const endDate = cleanOptionalString(body.end_date);

  if (!startDate || !isValidDate(startDate)) {
    return NextResponse.json(
      { error: "A valid start date is required." },
      { status: 400 },
    );
  }

  if (!endDate || !isValidDate(endDate)) {
    return NextResponse.json(
      { error: "A valid end date is required." },
      { status: 400 },
    );
  }

  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date cannot be before the start date." },
      { status: 400 },
    );
  }

  const purchaseDate = cleanOptionalString(body.purchase_date);

  if (purchaseDate && !isValidDate(purchaseDate)) {
    return NextResponse.json(
      { error: "Purchase date is invalid." },
      { status: 400 },
    );
  }

  const customerId = cleanOptionalString(body.customer_id);
  const productId = cleanOptionalString(body.product_id);

  if (customerId) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (customerError) {
      return NextResponse.json(
        { error: customerError.message },
        { status: 500 },
      );
    }

    if (!customer) {
      return NextResponse.json(
        { error: "Selected customer was not found." },
        { status: 400 },
      );
    }
  }

  if (productId) {
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (productError) {
      return NextResponse.json(
        { error: productError.message },
        { status: 500 },
      );
    }

    if (!product) {
      return NextResponse.json(
        { error: "Selected product was not found." },
        { status: 400 },
      );
    }
  }

  let warrantyNumber = cleanOptionalString(body.warranty_number);

  if (!warrantyNumber) {
    const { data: latestWarranty, error: latestError } =
      await supabase
        .from("warranties")
        .select("warranty_number")
        .eq("company_id", companyId)
        .like("warranty_number", "WAR-%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (latestError) {
      return NextResponse.json(
        { error: latestError.message },
        { status: 500 },
      );
    }

    let nextNumber = 1;

    if (latestWarranty?.warranty_number) {
      const match = latestWarranty.warranty_number.match(
        /^WAR-(\d+)$/,
      );

      if (match) {
        nextNumber = Number(match[1]) + 1;
      }
    }

    warrantyNumber = `WAR-${String(nextNumber).padStart(5, "0")}`;
  }

  const { data: existingWarranty, error: existingError } =
    await supabase
      .from("warranties")
      .select("id")
      .eq("company_id", companyId)
      .eq("warranty_number", warrantyNumber)
      .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message },
      { status: 500 },
    );
  }

  if (existingWarranty) {
    return NextResponse.json(
      {
        error: `Warranty number ${warrantyNumber} already exists.`,
      },
      { status: 409 },
    );
  }

  const { data: warranty, error: insertError } = await supabase
    .from("warranties")
    .insert({
      company_id: companyId,
      warranty_number: warrantyNumber,
      customer_id: customerId,
      product_id: productId,
      serial_number: cleanOptionalString(body.serial_number),
      coverage_type: coverageType,
      purchase_date: purchaseDate,
      start_date: startDate,
      end_date: endDate,
      terms: cleanOptionalString(body.terms),
      notes: cleanOptionalString(body.notes),
      created_by: user.id,
    })
    .select("id, warranty_number")
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      id: warranty.id,
      warranty_number: warranty.warranty_number,
    },
    { status: 201 },
  );
}