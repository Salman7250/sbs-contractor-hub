import { notFound, redirect } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import RepairPartForm from "./repair-part-form";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function NewRepairPartPage({
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
    .select(
      "id, company_id, repair_number, customer_id, product_id, status",
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (repairError || !repair) {
    notFound();
  }

  const productsQuery = supabase
    .from("products")
    .select("id, name")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  const variantsQuery = supabase
    .from("product_variants")
    .select("id, product_id, name")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  const warehousesQuery = supabase
    .from("warehouses")
    .select("id, name, code")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const locationsQuery = supabase
    .from("warehouse_locations")
    .select("id, warehouse_id, name, code, location_type")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const [
    productsResult,
    variantsResult,
    warehousesResult,
    locationsResult,
  ] = await Promise.all([
    productsQuery,
    variantsQuery,
    warehousesQuery,
    locationsQuery,
  ]);

  return (
    <AppShell>
      <RepairPartForm
        repair={repair}
        products={productsResult.data ?? []}
        variants={variantsResult.data ?? []}
        warehouses={warehousesResult.data ?? []}
        locations={locationsResult.data ?? []}
      />
    </AppShell>
  );
}