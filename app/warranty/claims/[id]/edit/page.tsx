import { notFound, redirect } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import ClaimEditClient from "./claim-edit-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function WarrantyClaimEditPage({
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
      .select("company_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership?.company_id) {
    redirect("/login");
  }

  const companyId = membership.company_id;

  const { data: claim, error: claimError } =
    await supabase
      .from("warranty_claims")
      .select(
        `
          id,
          company_id,
          warranty_id,
          claim_number,
          status,
          issue,
          resolution,
          claim_date,
          resolved_date,
          notes,
          created_by,
          created_at,
          updated_at
        `,
      )
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

  if (claimError) {
    throw new Error(claimError.message);
  }

  if (!claim) {
    notFound();
  }

  const { data: warranty, error: warrantyError } =
    await supabase
      .from("warranties")
      .select(
        `
          id,
          warranty_number,
          customer_id,
          product_id,
          variant_id,
          serial_number,
          status,
          coverage_type,
          purchase_date,
          start_date,
          end_date
        `,
      )
      .eq("id", claim.warranty_id)
      .eq("company_id", companyId)
      .maybeSingle();

  if (warrantyError) {
    throw new Error(warrantyError.message);
  }

  if (!warranty) {
    notFound();
  }

  const [customerResult, productResult] =
    await Promise.all([
      warranty.customer_id
        ? supabase
            .from("customers")
            .select("id, name, email, phone")
            .eq("id", warranty.customer_id)
            .eq("company_id", companyId)
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),

      warranty.product_id
        ? supabase
            .from("products")
            .select("id, name")
            .eq("id", warranty.product_id)
            .eq("company_id", companyId)
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),
    ]);

  if (customerResult.error) {
    throw new Error(customerResult.error.message);
  }

  if (productResult.error) {
    throw new Error(productResult.error.message);
  }

  return (
    <AppShell>
      <ClaimEditClient
        claim={claim}
        warranty={warranty}
        customer={customerResult.data}
        product={productResult.data}
      />
    </AppShell>
  );
}