import { notFound, redirect } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import WarrantyDetailClient from "./warranty-detail-client";

export const dynamic = "force-dynamic";

type Warranty = {
  id: string;
  company_id: string;
  warranty_number: string;
  customer_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  order_id: string | null;
  serial_number: string | null;
  status: "active" | "expiring" | "expired" | "claimed" | "void";
  coverage_type:
    | "standard"
    | "extended"
    | "limited"
    | "parts_only"
    | "labor_only"
    | "custom";
  purchase_date: string | null;
  start_date: string;
  end_date: string;
  terms: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Product = {
  id: string;
  name: string;
};

type Claim = {
  id: string;
  company_id: string;
  warranty_id: string;
  claim_number: string;
  status:
    | "open"
    | "under_review"
    | "approved"
    | "rejected"
    | "repair"
    | "replacement"
    | "resolved"
    | "cancelled";
  issue: string;
  resolution: string | null;
  claim_date: string;
  resolved_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Activity = {
  id: string;
  company_id: string;
  warranty_id: string;
  action: string;
  message: string;
  created_by: string | null;
  created_at: string;
};

export default async function WarrantyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    redirect("/login");
  }

  const companyId = membership.company_id;

  const { data: warranty, error: warrantyError } = await supabase
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

  if (warrantyError || !warranty) {
    notFound();
  }

  const [customerResult, productResult, claimsResult, activityResult] =
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

      supabase
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
        .eq("warranty_id", id)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),

      supabase
        .from("warranty_activity")
        .select(
          `
            id,
            company_id,
            warranty_id,
            action,
            message,
            created_by,
            created_at
          `,
        )
        .eq("warranty_id", id)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  if (customerResult.error) {
    throw new Error(customerResult.error.message);
  }

  if (productResult.error) {
    throw new Error(productResult.error.message);
  }

  if (claimsResult.error) {
    throw new Error(claimsResult.error.message);
  }

  if (activityResult.error) {
    throw new Error(activityResult.error.message);
  }

  return (
    <AppShell>
      <WarrantyDetailClient
        warranty={warranty as Warranty}
        customer={customerResult.data as Customer | null}
        product={productResult.data as Product | null}
        claims={(claimsResult.data ?? []) as Claim[]}
        activity={(activityResult.data ?? []) as Activity[]}
      />
    </AppShell>
  );
}