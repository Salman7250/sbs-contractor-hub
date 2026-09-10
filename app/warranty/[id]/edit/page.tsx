import { notFound, redirect } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import WarrantyEditClient from "./warranty-edit-client";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function WarrantyEditPage({
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

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.company_id) {
    redirect("/login");
  }

  const companyId = membership.company_id;

  const { data: warranty, error } = await supabase
    .from("warranties")
    .select(
      `
        id,
        company_id,
        warranty_number,
        customer_id,
        product_id,
        variant_id,
        order_id,
        serial_number,
        status,
        coverage_type,
        purchase_date,
        start_date,
        end_date,
        terms,
        notes,
        created_by,
        created_at,
        updated_at
      `,
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!warranty) {
    notFound();
  }

  const [
    customersResult,
    productsResult,
    variantsResult,
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
      .from("product_variants")
      .select("id, product_id, name, sku")
      .eq("company_id", companyId)
      .order("name"),
  ]);

  if (customersResult.error) {
    throw new Error(customersResult.error.message);
  }

  if (productsResult.error) {
    throw new Error(productsResult.error.message);
  }

  if (variantsResult.error) {
    throw new Error(variantsResult.error.message);
  }

  return (
    <AppShell>
      <WarrantyEditClient
        warranty={warranty}
        customers={customersResult.data ?? []}
        products={productsResult.data ?? []}
        variants={variantsResult.data ?? []}
      />
    </AppShell>
  );
}