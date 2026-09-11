import { redirect } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import NewRepairClient from "./new-repair-client";

export default async function NewRepairPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.company_id) {
    redirect("/dashboard");
  }

  const companyId = membership.company_id;

  const [
    customersResult,
    productsResult,
    employeesResult,
    warrantiesResult,
    claimsResult,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, email, phone")
      .eq("company_id", companyId)
      .order("name"),

    supabase
      .from("products")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name"),

    supabase
      .from("employees")
      .select("id, display_name, first_name, last_name")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("display_name"),

    supabase
      .from("warranties")
      .select(
        "id, warranty_number, customer_id, product_id, variant_id, serial_number, status, end_date",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),

    supabase
      .from("warranty_claims")
      .select(
        "id, claim_number, warranty_id, customer_id, product_id, status, issue",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
  ]);

  const employees = (employeesResult.data ?? []).map((employee) => ({
    id: employee.id,
    name:
      employee.display_name ||
      [employee.first_name, employee.last_name].filter(Boolean).join(" ") ||
      "Unnamed Employee",
  }));

  return (
    <AppShell>
      <NewRepairClient
        customers={customersResult.data ?? []}
        products={productsResult.data ?? []}
        employees={employees}
        warranties={warrantiesResult.data ?? []}
        claims={claimsResult.data ?? []}
      />
    </AppShell>
  );
}