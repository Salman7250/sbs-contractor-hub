import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PricingPlans from "./pricing-plans";

type Plan = {
  id: string;
  name: string;
  slug: string;
  monthly_price: number | null;
  yearly_price: number | null;
  is_active: boolean;
};

type Module = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  is_active: boolean;
};

type PlanModule = {
  plan_id: string;
  module_id: string;
};

export default async function PricingPage() {
  const supabase = await createClient();

  const [
    { data: plans, error: plansError },
    { data: modules, error: modulesError },
    { data: planModules, error: planModulesError },
  ] = await Promise.all([
    supabase
      .from("plans")
      .select(
        `
          id,
          name,
          slug,
          monthly_price,
          yearly_price,
          is_active
        `
      )
      .eq("is_active", true)
      .order("monthly_price", {
        ascending: true,
        nullsFirst: false,
      }),

    supabase
      .from("modules")
      .select(
        `
          id,
          name,
          slug,
          category,
          is_active
        `
      )
      .eq("is_active", true)
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("plan_modules")
      .select(
        `
          plan_id,
          module_id
        `
      ),
  ]);

  if (plansError) {
    console.error("Pricing plans error:", plansError);
  }

  if (modulesError) {
    console.error("Pricing modules error:", modulesError);
  }

  if (planModulesError) {
    console.error("Pricing plan modules error:", planModulesError);
  }

  const activePlans = (plans ?? []) as Plan[];
  const activeModules = (modules ?? []) as Module[];
  const assignments = (planModules ?? []) as PlanModule[];

  const planModuleMap = new Map<string, string[]>();

  for (const plan of activePlans) {
    const moduleIds = assignments
      .filter((assignment) => assignment.plan_id === plan.id)
      .map((assignment) => assignment.module_id);

    planModuleMap.set(plan.id, moduleIds);
  }

  const pricingPlans = activePlans.map((plan) => {
    const moduleIds = planModuleMap.get(plan.id) ?? [];

    const includedModules = activeModules
      .filter((module) => moduleIds.includes(module.id))
      .map((module) => ({
        id: module.id,
        name: module.name,
        slug: module.slug,
        category: module.category,
      }));

    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      monthlyPrice: plan.monthly_price,
      yearlyPrice: plan.yearly_price,
      modules: includedModules,
      recommended:
        plan.slug.toLowerCase() === "professional",
    };
  });

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-bold text-slate-950">
              SB
            </div>

            <div>
              <div className="text-sm font-semibold tracking-tight text-white">
                Sharif Business
              </div>

              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Solutions
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-white sm:inline-flex"
            >
              Sign in
            </Link>

            <Link
              href="/signup"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_42%)]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-20 text-center sm:px-6 lg:px-8 lg:pb-16 lg:pt-24">
          <div className="mx-auto max-w-3xl">
            <div className="mb-5 inline-flex items-center rounded-full border border-slate-800 bg-slate-900/70 px-3.5 py-1.5 text-xs font-medium text-slate-400">
              Simple, transparent pricing
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Run your business from
              <span className="block text-slate-400">
                one powerful platform.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              CRM, sales, operations, finance, employees,
              reporting, and more — all in one place.
            </p>

            <p className="mt-4 text-sm text-slate-500">
              Start with the plan that fits your business.
              Upgrade whenever you need.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        {pricingPlans.length > 0 ? (
          <PricingPlans plans={pricingPlans} />
        ) : (
          <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
            <h2 className="text-lg font-semibold text-white">
              Pricing is currently unavailable
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Please check back shortly.
            </p>
          </div>
        )}
      </section>

      {/* Trust / Billing */}
      <section className="border-t border-slate-800/80 bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 text-center sm:grid-cols-3">
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-sm font-semibold text-white">
                ✓
              </div>

              <h3 className="mt-4 text-sm font-semibold text-white">
                Flexible plans
              </h3>

              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                Choose the features your business needs
                today and upgrade as you grow.
              </p>
            </div>

            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-sm font-semibold text-white">
                ↗
              </div>

              <h3 className="mt-4 text-sm font-semibold text-white">
                Built to scale
              </h3>

              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                Add more capabilities without changing
                your entire business system.
              </p>
            </div>

            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-sm font-semibold text-white">
                ⚡
              </div>

              <h3 className="mt-4 text-sm font-semibold text-white">
                One platform
              </h3>

              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                Keep sales, operations, finance, and
                business management connected.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ / Bottom CTA */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Not sure which plan is right for you?
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
          Start with the plan that matches your current
          needs. You can upgrade as your business grows.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Get started
          </Link>

          <Link
            href="/login"
            className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-center text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:text-left">
          <p>
            © {new Date().getFullYear()} Sharif Business
            Solutions. All rights reserved.
          </p>

          <div className="flex justify-center gap-5 sm:justify-end">
            <Link
              href="/privacy"
              className="transition hover:text-slate-300"
            >
              Privacy
            </Link>

            <Link
              href="/terms"
              className="transition hover:text-slate-300"
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}