export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function money(value: number | null | undefined, currency = "AED") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value ?? 0);
}

export function badgeClass(value: string) {
  const v = value.toLowerCase();
  if (["active", "available", "completed", "in_stock"].includes(v)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["reserved", "in_transit", "draft", "repair"].includes(v)) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (["sold", "depleted", "closed", "cancelled", "disposed", "damaged", "lost"].includes(v)) return "bg-slate-100 text-slate-600 ring-slate-200";
  if (["rma", "returned", "quarantined"].includes(v)) return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-slate-50 text-slate-600 ring-slate-200";
}

export async function getCompanyId(supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("You must be signed in.");
  const { data, error } = await supabase.from("company_members").select("company_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (error) throw error;
  if (!data?.company_id) throw new Error("No company membership was found for this account.");
  return data.company_id as string;
}
