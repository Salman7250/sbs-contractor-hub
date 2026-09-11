import { notFound, redirect } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import RepairEditClient from "./repair-edit-client";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RepairEditPage({
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

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.company_id) {
    redirect("/dashboard");
  }

  const companyId = membership.company_id;

  const { data: repair, error: repairError } = await supabase
    .from("repairs")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (repairError || !repair) {
    notFound();
  }

  const customerQuery = repair.customer_id
    ? supabase
        .from("customers")
        .select("id, name")
        .eq("id", repair.customer_id)
        .eq("company_id", companyId)
        .maybeSingle()
    : null;

  const productQuery = repair.product_id
    ? supabase
        .from("products")
        .select("id, name")
        .eq("id", repair.product_id)
        .eq("company_id", companyId)
        .maybeSingle()
    : null;

  const employeesQuery = supabase
    .from("employees")
    .select(
      "id, display_name, first_name, last_name, email, job_title, status",
    )
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("display_name", { ascending: true });

  const warrantyQuery = repair.warranty_id
    ? supabase
        .from("warranties")
        .select(
          "id, warranty_number, status, coverage_type, start_date, end_date, serial_number",
        )
        .eq("id", repair.warranty_id)
        .eq("company_id", companyId)
        .maybeSingle()
    : null;

  const claimQuery = repair.warranty_claim_id
    ? supabase
        .from("warranty_claims")
        .select(
          "id, claim_number, status, issue, claim_date, resolution",
        )
        .eq("id", repair.warranty_claim_id)
        .eq("company_id", companyId)
        .maybeSingle()
    : null;

  const [
    customerResult,
    productResult,
    employeesResult,
    warrantyResult,
    claimResult,
  ] = await Promise.all([
    customerQuery,
    productQuery,
    employeesQuery,
    warrantyQuery,
    claimQuery,
  ]);

  const employees = (employeesResult.data ?? []).map((employee) => ({
    id: employee.id,
    name:
      employee.display_name ||
      `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() ||
      employee.email ||
      "Employee",
    jobTitle: employee.job_title,
  }));

  return (
    <AppShell>
      <RepairEditClient
        repair={repair}
        customer={customerResult?.data ?? null}
        product={productResult?.data ?? null}
        employeeOptions={employees}
        warranty={warrantyResult?.data ?? null}
        claim={claimResult?.data ?? null}
      />
    </AppShell>
  );
}