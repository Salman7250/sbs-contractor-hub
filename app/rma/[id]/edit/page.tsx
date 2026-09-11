import { notFound, redirect } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import RmaEditClient from "./rma-edit-client";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RmaEditPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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

  if (
    membershipError ||
    !membership?.company_id
  ) {
    redirect("/dashboard");
  }

  const companyId = membership.company_id;

  const { data: rma, error: rmaError } =
    await supabase
      .from("rmas")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

  if (rmaError || !rma) {
    notFound();
  }

  const [
    customersResult,
    productsResult,
    employeesResult,
    warrantiesResult,
    claimsResult,
    repairsResult,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, email, phone")
      .eq("company_id", companyId)
      .order("name", { ascending: true }),

    supabase
      .from("products")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name", { ascending: true }),

    supabase
      .from("employees")
      .select(
        "id, display_name, first_name, last_name, email",
      )
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("display_name", { ascending: true }),

    supabase
      .from("warranties")
      .select(
        "id, warranty_number, customer_id, product_id, variant_id, serial_number, status, coverage_type, start_date, end_date",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),

    supabase
      .from("warranty_claims")
      .select(
        "id, claim_number, warranty_id, company_id, status, issue, claim_date",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),

    supabase
      .from("repairs")
      .select(
        "id, repair_number, customer_id, product_id, serial_number, status",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
  ]);

  if (
    customersResult.error ||
    productsResult.error ||
    employeesResult.error ||
    warrantiesResult.error ||
    claimsResult.error ||
    repairsResult.error
  ) {
    console.error("RMA edit data load error:", {
      customers: customersResult.error,
      products: productsResult.error,
      employees: employeesResult.error,
      warranties: warrantiesResult.error,
      claims: claimsResult.error,
      repairs: repairsResult.error,
    });
  }

  return (
    <AppShell>
      <RmaEditClient
        rma={rma}
        customers={customersResult.data ?? []}
        products={productsResult.data ?? []}
        employees={employeesResult.data ?? []}
        warranties={warrantiesResult.data ?? []}
        claims={claimsResult.data ?? []}
        repairs={repairsResult.data ?? []}
      />
    </AppShell>
  );
}