import { notFound, redirect } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import RmaDetailClient from "./rma-detail-client";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RmaDetailPage({
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

  const { data: membership, error: membershipError } =
    await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

  if (membershipError || !membership?.company_id) {
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

  const customerQuery = rma.customer_id
    ? supabase
        .from("customers")
        .select("id, name, email, phone")
        .eq("id", rma.customer_id)
        .eq("company_id", companyId)
        .maybeSingle()
    : null;

  const productQuery = rma.product_id
    ? supabase
        .from("products")
        .select("id, name")
        .eq("id", rma.product_id)
        .eq("company_id", companyId)
        .maybeSingle()
    : null;

  const employeeQuery = rma.assigned_employee_id
    ? supabase
        .from("employees")
        .select(
          "id, display_name, first_name, last_name, email, phone, job_title",
        )
        .eq("id", rma.assigned_employee_id)
        .eq("company_id", companyId)
        .maybeSingle()
    : null;

  const warrantyQuery = rma.warranty_id
    ? supabase
        .from("warranties")
        .select(
          "id, warranty_number, status, coverage_type, start_date, end_date, serial_number",
        )
        .eq("id", rma.warranty_id)
        .eq("company_id", companyId)
        .maybeSingle()
    : null;

  const claimQuery = rma.warranty_claim_id
    ? supabase
        .from("warranty_claims")
        .select(
          "id, claim_number, status, issue, claim_date, resolution",
        )
        .eq("id", rma.warranty_claim_id)
        .eq("company_id", companyId)
        .maybeSingle()
    : null;

  const repairQuery = rma.repair_id
    ? supabase
        .from("repairs")
        .select(
          "id, repair_number, status, priority, issue, serial_number",
        )
        .eq("id", rma.repair_id)
        .eq("company_id", companyId)
        .maybeSingle()
    : null;

  const activityQuery = supabase
    .from("rma_activity")
    .select("*")
    .eq("rma_id", rma.id)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const [
    customerResult,
    productResult,
    employeeResult,
    warrantyResult,
    claimResult,
    repairResult,
    activityResult,
  ] = await Promise.all([
    customerQuery,
    productQuery,
    employeeQuery,
    warrantyQuery,
    claimQuery,
    repairQuery,
    activityQuery,
  ]);

  return (
    <AppShell>
      <RmaDetailClient
        rma={rma}
        customer={customerResult?.data ?? null}
        product={productResult?.data ?? null}
        employee={employeeResult?.data ?? null}
        warranty={warrantyResult?.data ?? null}
        claim={claimResult?.data ?? null}
        repair={repairResult?.data ?? null}
        activity={activityResult.data ?? []}
      />
    </AppShell>
  );
}