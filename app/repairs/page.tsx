import { redirect } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import RepairsClient from "./repairs-client";

export default async function RepairsPage() {
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

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership?.company_id) {
    throw new Error("No company membership found.");
  }

  const companyId = membership.company_id;

  const [
    repairsResult,
    customersResult,
    productsResult,
    employeesResult,
    claimsResult,
  ] = await Promise.all([
    supabase
      .from("repairs")
      .select(
        `
          id,
          company_id,
          repair_number,
          warranty_id,
          warranty_claim_id,
          customer_id,
          product_id,
          variant_id,
          serialized_unit_id,
          serial_number,
          order_id,
          job_id,
          assigned_employee_id,
          source,
          status,
          priority,
          issue,
          diagnosis,
          work_performed,
          resolution,
          internal_notes,
          customer_notes,
          warranty_covered,
          estimated_labor,
          estimated_parts,
          estimated_total,
          actual_labor,
          actual_parts,
          actual_total,
          customer_charge,
          received_at,
          diagnosed_at,
          repair_started_at,
          quality_checked_at,
          completed_at,
          cancelled_at,
          created_by,
          created_at,
          updated_at
        `
      )
      .eq("company_id", companyId)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("customers")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("products")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("employees")
      .select(
        "id, display_name, first_name, last_name"
      )
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("display_name", {
        ascending: true,
      }),

    supabase
      .from("warranty_claims")
      .select(
        "id, warranty_id, claim_number, status"
      )
      .eq("company_id", companyId)
      .order("created_at", {
        ascending: false,
      }),
  ]);

  if (repairsResult.error) {
    throw new Error(repairsResult.error.message);
  }

  if (customersResult.error) {
    throw new Error(customersResult.error.message);
  }

  if (productsResult.error) {
    throw new Error(productsResult.error.message);
  }

  if (employeesResult.error) {
    throw new Error(employeesResult.error.message);
  }

  if (claimsResult.error) {
    throw new Error(claimsResult.error.message);
  }

  const employees = (employeesResult.data || []).map(
    (employee) => ({
      id: employee.id,
      name:
        employee.display_name ||
        [employee.first_name, employee.last_name]
          .filter(Boolean)
          .join(" ") ||
        "Employee",
    })
  );

  return (
    <AppShell>
      <RepairsClient
        repairs={repairsResult.data || []}
        customers={customersResult.data || []}
        products={productsResult.data || []}
        employees={employees}
        claims={claimsResult.data || []}
      />
    </AppShell>
  );
}