"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/app/components/app-shell";
import { useRegionalSettings } from "@/app/components/regional-settings-provider";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/regional-settings";
import InventoryNav from "../_components/inventory-nav";
import { badgeClass, getCompanyId } from "../_components/inventory-utils";

type Row = { id: string; batch_id: string; product_id: string; variant_id: string; warehouse_id: string; location_id: string; quantity: number; reserved_quantity: number; };
type Named = { id: string; name: string; sku?: string | null; lot_number?: string | null; unit_cost?: number | null; status?: string | null };
type Warehouse = { id: string; name: string; code: string };
type Location = { id: string; name: string; code: string; warehouse_id: string };

export default function InventoryStockPage() {
  const { settings } = useRegionalSettings();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]); const [products, setProducts] = useState<Named[]>([]); const [variants, setVariants] = useState<Named[]>([]); const [batches, setBatches] = useState<Named[]>([]); const [warehouses, setWarehouses] = useState<Warehouse[]>([]); const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [search, setSearch] = useState(""); const [warehouse, setWarehouse] = useState("");

  const load = useCallback(async () => { setLoading(true); setError(""); try { const companyId = await getCompanyId(supabase);
    const [r,p,v,b,w,l] = await Promise.all([
      supabase.from("inventory_batch_stock").select("id,batch_id,product_id,variant_id,warehouse_id,location_id,quantity,reserved_quantity").eq("company_id", companyId).order("updated_at", { ascending: false }),
      supabase.from("products").select("id,name,sku").eq("company_id", companyId),
      supabase.from("product_variants").select("id,name,sku").eq("company_id", companyId),
      supabase.from("inventory_batches").select("id,lot_number,unit_cost,status").eq("company_id", companyId),
      supabase.from("warehouses").select("id,name,code").eq("company_id", companyId).order("name"),
      supabase.from("warehouse_locations").select("id,name,code,warehouse_id").eq("company_id", companyId).order("name")
    ]); [r,p,v,b,w,l].forEach(x => { if (x.error) throw x.error; });
    setRows((r.data ?? []) as Row[]); setProducts((p.data ?? []) as Named[]); setVariants((v.data ?? []) as Named[]); setBatches((b.data ?? []) as Named[]); setWarehouses((w.data ?? []) as Warehouse[]); setLocations((l.data ?? []) as Location[]);
  } catch (e) { setError(e instanceof Error ? e.message : "Unable to load stock."); } finally { setLoading(false); } }, [supabase]);
  useEffect(() => { void load(); }, [load]);
  const pm = useMemo(() => new Map(products.map(x => [x.id, x])), [products]); const vm = useMemo(() => new Map(variants.map(x => [x.id, x])), [variants]); const bm = useMemo(() => new Map(batches.map(x => [x.id, x])), [batches]); const wm = useMemo(() => new Map(warehouses.map(x => [x.id, x])), [warehouses]); const lm = useMemo(() => new Map(locations.map(x => [x.id, x])), [locations]);
  const filtered = useMemo(() => { const q=search.trim().toLowerCase(); return rows.filter(r => { const p=pm.get(r.product_id), v=vm.get(r.variant_id), b=bm.get(r.batch_id), w=wm.get(r.warehouse_id), l=lm.get(r.location_id); const text=[p?.name,p?.sku,v?.name,v?.sku,b?.lot_number,w?.name,w?.code,l?.name,l?.code].filter(Boolean).join(" ").toLowerCase(); return (!q || text.includes(q)) && (!warehouse || r.warehouse_id===warehouse); }); }, [rows,pm,vm,bm,wm,lm,search,warehouse]);
  const totals = useMemo(() => filtered.reduce((a,r) => { a.qty += r.quantity; a.reserved += r.reserved_quantity; a.available += r.quantity-r.reserved_quantity; const b=bm.get(r.batch_id); a.value += (r.quantity-r.reserved_quantity)*(Number(b?.unit_cost)||0); return a; }, {qty:0,reserved:0,available:0,value:0}), [filtered,bm]);
  return <AppShell title="Stock" description="Physical stock by batch, warehouse and location."><InventoryNav />
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Units",totals.qty], ["Available",totals.available], ["Reserved",totals.reserved], ["Available value",formatMoney(totals.value, settings)]].map(([label,value])=><div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-950">{typeof value === "number" ? value.toLocaleString() : value}</div></div>)}</div>
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product, SKU, batch, warehouse..." className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"/><select value={warehouse} onChange={e=>setWarehouse(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All warehouses</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><button onClick={()=>void load()} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Refresh</button></div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Product / Variant","Batch / Lot","Warehouse / Location","Qty","Reserved","Available","Cost","Status"].map(h=><th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Loading stock…</td></tr> : filtered.length===0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No batch stock matches your filters.</td></tr> : filtered.map(r=>{const p=pm.get(r.product_id),v=vm.get(r.variant_id),b=bm.get(r.batch_id),w=wm.get(r.warehouse_id),l=lm.get(r.location_id);return <tr key={r.id} className="hover:bg-slate-50"><td className="px-4 py-3"><div className="font-medium text-slate-900">{p?.name||"Unknown product"}</div><div className="text-xs text-slate-500">{v?.name||v?.sku||"Variant"}</div></td><td className="px-4 py-3"><div className="font-medium">{b?.lot_number||"—"}</div><div className="text-xs text-slate-500">Batch parent</div></td><td className="px-4 py-3"><div>{w?.name||"—"}</div><div className="text-xs text-slate-500">{l ? `${l.code} · ${l.name}` : "—"}</div></td><td className="px-4 py-3 font-medium">{r.quantity.toLocaleString()}</td><td className="px-4 py-3">{r.reserved_quantity.toLocaleString()}</td><td className="px-4 py-3 font-semibold">{(r.quantity-r.reserved_quantity).toLocaleString()}</td><td className="px-4 py-3">{formatMoney(Number(b?.unit_cost)||0, settings)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ring-1 ${badgeClass(b?.status||"active")}`}>{b?.status||"active"}</span></td></tr>})}</tbody></table></div></div>
    </div></AppShell>;
}
