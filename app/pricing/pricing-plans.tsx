"use client";

import { useState } from "react";
import Link from "next/link";

type PricingModule = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
};

type PricingPlan = {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  recommended: boolean;
  modules: PricingModule[];
};

type Props = {
  plans: PricingPlan[];
};

function formatPrice(
  price: number | null,
  suffix: string
) {
  if (price === null || price === undefined) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-white">
          Custom
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-1">
      <span className="text-4xl font-semibold tracking-tight text-white">
        ${price.toFixed(0)}
      </span>

      <span className="text-sm text-slate-500">
        /{suffix}
      </span>
    </div>
  );
}

function getPlanDescription(slug: string) {
  switch (slug.toLowerCase()) {
    case "starter":
      return "Everything you need to get your business organized.";

    case "professional":
      return "Powerful tools for growing businesses.";

    case "business":
      return "Complete business management across every department.";

    case "enterprise":
      return "Advanced capabilities for larger organizations.";

    default:
      return "Business tools designed to help your company grow.";
  }
}

function getButtonText(slug: string) {
  if (slug.toLowerCase() === "enterprise") {
    return "Contact Sales";
  }

  return "Get started";
}

function getButtonHref(slug: string) {
  if (slug.toLowerCase() === "enterprise") {
    return "/contact";
  }

  return `/signup?plan=${encodeURIComponent(slug)}`;
}

export default function PricingPlans({
  plans,
}: Props) {
  const [billingCycle, setBillingCycle] = useState<
    "monthly" | "yearly"
  >("monthly");

  return (
    <div>
      {/* Billing toggle */}
      <div className="mb-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`rounded-lg px-5 py-2.5 text-sm font-medium transition ${
              billingCycle === "monthly"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Monthly
          </button>

          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={`rounded-lg px-5 py-2.5 text-sm font-medium transition ${
              billingCycle === "yearly"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Yearly
          </button>
        </div>

        <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Save with yearly billing
        </div>
      </div>

      {/* Plans */}
      <div
        className={`grid gap-5 ${
          plans.length === 1
            ? "mx-auto max-w-md"
            : plans.length === 2
            ? "mx-auto max-w-4xl md:grid-cols-2"
            : plans.length === 3
            ? "mx-auto max-w-6xl md:grid-cols-3"
            : "xl:grid-cols-4"
        }`}
      >
        {plans.map((plan) => {
          const price =
            billingCycle === "yearly"
              ? plan.yearlyPrice
              : plan.monthlyPrice;

          const suffix =
            billingCycle === "yearly"
              ? "year"
              : "month";

          const moduleCount = plan.modules.length;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-slate-900/70 ${
                plan.recommended
                  ? "border-white/30 shadow-xl shadow-black/20"
                  : "border-slate-800"
              }`}
            >
              {/* Recommended badge */}
              {plan.recommended && (
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-950 shadow-lg">
                  Most popular
                </div>
              )}

              <div className="flex flex-1 flex-col p-6 sm:p-7">
                {/* Plan heading */}
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {plan.name}
                  </h2>

                  <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-400">
                    {getPlanDescription(plan.slug)}
                  </p>
                </div>

                {/* Price */}
                <div className="mt-7">
                  {formatPrice(price, suffix)}

                  {billingCycle === "yearly" &&
                    price !== null &&
                    plan.monthlyPrice !== null && (
                      <p className="mt-2 text-xs text-slate-500">
                        Billed annually
                      </p>
                    )}
                </div>

                {/* CTA */}
                <Link
                  href={getButtonHref(plan.slug)}
                  className={`mt-7 flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    plan.recommended
                      ? "bg-white text-slate-950 hover:bg-slate-100"
                      : "border border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
                  }`}
                >
                  {getButtonText(plan.slug)}
                </Link>

                {/* Features */}
                <div className="mt-8 border-t border-slate-800 pt-6">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      Includes
                    </span>

                    <span className="text-xs text-slate-600">
                      {moduleCount}{" "}
                      {moduleCount === 1
                        ? "module"
                        : "modules"}
                    </span>
                  </div>

                  {moduleCount > 0 ? (
                    <ul className="space-y-3">
                      {plan.modules.map((module) => (
                        <li
                          key={module.id}
                          className="flex items-start gap-3"
                        >
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                            ✓
                          </span>

                          <span className="min-w-0 text-sm leading-5 text-slate-300">
                            {module.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Contact us for available features.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison note */}
      <div className="mt-8 text-center">
        <p className="text-xs leading-5 text-slate-600">
          Features shown above are based on the modules
          currently assigned to each active plan.
        </p>
      </div>
    </div>
  );
}