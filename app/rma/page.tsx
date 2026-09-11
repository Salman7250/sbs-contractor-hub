import { redirect } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import RmaClient from "./rma-client";

type PageProps = {
  searchParams: Promise<{
    search?: string;
    status?: string;
    priority?: string;
    customer?: string;
  }>;
};

export default async function RmaPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

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

  const [rmasResult, customersResult, employeesResult] =
    await Promise.all([
      supabase
        .from("rmas")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),

      supabase
        .from("customers")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name", { ascending: true }),

      supabase
        .from("employees")
        .select(
          "id, display_name, first_name, last_name",
        )
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("display_name", { ascending: true }),
    ]);

  if (rmasResult.error) {
    console.error("RMA load error:", rmasResult.error);
  }

  if (customersResult.error) {
    console.error(
      "RMA customer load error:",
      customersResult.error,
    );
  }

  if (employeesResult.error) {
    console.error(
      "RMA employee load error:",
      employeesResult.error,
    );
  }

  const rmas = rmasResult.data ?? [];
  const customers = customersResult.data ?? [];
  const employees = employeesResult.data ?? [];

  return (
    <AppShell>
      <RmaClient
        rmas={rmas}
        customers={customers}
        employees={employees}
        initialFilters={{
          search: params.search ?? "",
          status: params.status ?? "",
          priority: params.priority ?? "",
          customer: params.customer ?? "",
        }}
      />
    </AppShell>
  );
}