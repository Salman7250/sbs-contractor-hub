import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WarrantyClient from "./warranty-client";
import AppShell from "@/app/components/app-shell";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
};

type WarrantyRow = {
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
  created_at: string;
  updated_at: string;
};

type ClaimRow = {
  id: string;
  warranty_id: string;
  status:
    | "open"
    | "under_review"
    | "approved"
    | "rejected"
    | "repair"
    | "replacement"
    | "resolved"
    | "cancelled";
};

export default async function WarrantyPage() {
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
    redirect("/login");
  }

  const companyId = membership.company_id;

  const [
    warrantiesResult,
    customersResult,
    productsResult,
    claimsResult,
  ] = await Promise.all([
    supabase
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
          created_at,
          updated_at
        `,
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),

    supabase
      .from("customers")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name", { ascending: true }),

    supabase
      .from("products")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name", { ascending: true }),

    supabase
      .from("warranty_claims")
      .select("id, warranty_id, status")
      .eq("company_id", companyId),
  ]);

  if (warrantiesResult.error) {
    return (
      <main className="page-content">
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <strong>Unable to load warranties.</strong>
          <p style={{ margin: "8px 0 0" }}>
            {warrantiesResult.error.message}
          </p>
        </div>
      </main>
    );
  }

  return (
  <AppShell>
    <WarrantyClient
      warranties={(warrantiesResult.data ?? []) as WarrantyRow[]}
      customers={(customersResult.data ?? []) as Customer[]}
      products={(productsResult.data ?? []) as Product[]}
      claims={(claimsResult.data ?? []) as ClaimRow[]}
    />
  </AppShell>
);
}