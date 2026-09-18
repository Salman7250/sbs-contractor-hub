"use client";

import {
  AlertCircle,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  Gift,
  Pause,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  cancelSubscription,
  createSubscription,
  extendSubscription,
  updateSubscription,
} from "./subscription-actions";

type Company = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type Plan = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  monthly_price?: number | string | null;
  yearly_price?: number | string | null;
};

type Subscription = {
  id: string;
  company_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  amount: number;
  currency: string;
  current_period_start?: string | null;
  current_period_end: string | null;
  trial_end?: string | null;
  cancel_at_period_end?: boolean | null;
  created_at?: string | null;
};

type CompanyDiscount = {
  id: string;
  company_id: string;
  [key: string]: unknown;
};

type PlanLimit = {
  id: string;
  plan_id: string;
  [key: string]: unknown;
};

type CompanyLimitOverride = {
  id: string;
  company_id: string;
  [key: string]: unknown;
};

type Payment = {
  id: string;
  company_id: string;
  [key: string]: unknown;
};

type Props = {
  companies: Company[];
  plans: Plan[];
  subscriptions: Subscription[];

  /*
   * These datasets are supplied by the parent
   * subscription management page. They are accepted
   * here because the parent passes them into this
   * component and they may be used by future
   * subscription controls.
   */
  discounts?: CompanyDiscount[];
  planLimits?: PlanLimit[];
  companyLimitOverrides?: CompanyLimitOverride[];
  payments?: Payment[];
};

type EditorMode =
  | "create"
  | "edit"
  | "extend";

export default function SubscriptionManagement({
  companies,
  plans,
  subscriptions,
}: Props) {
  const [selectedCompanyId, setSelectedCompanyId] =
    useState(companies[0]?.id ?? "");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [editorMode, setEditorMode] =
    useState<EditorMode | null>(null);

  const [selectedSubscription, setSelectedSubscription] =
    useState<Subscription | null>(null);

  const [isPending, startTransition] =
    useTransition();

  const selectedCompany = companies.find(
    (company) =>
      company.id === selectedCompanyId
  );

  const companySubscriptions = subscriptions.filter(
    (subscription) =>
      subscription.company_id ===
      selectedCompanyId
  );

  const activeSubscription =
    companySubscriptions.find((subscription) =>
      [
        "trialing",
        "active",
        "past_due",
        "paused",
      ].includes(subscription.status)
    );

  const selectedPlan = plans.find(
    (plan) =>
      plan.id ===
      activeSubscription?.plan_id
  );

  const filteredCompanies = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return companies.filter((company) => {
      if (!query) {
        return true;
      }

      return (
        company.name
          .toLowerCase()
          .includes(query) ||
        company.slug
          .toLowerCase()
          .includes(query)
      );
    });
  }, [companies, search]);

  const visibleSubscriptions =
    companySubscriptions.filter(
      (subscription) =>
        statusFilter === "all" ||
        subscription.status ===
          statusFilter
    );

  const activeCount =
    subscriptions.filter((subscription) =>
      ["active", "trialing"].includes(
        subscription.status
      )
    ).length;

  const pausedCount =
    subscriptions.filter(
      (subscription) =>
        subscription.status === "paused"
    ).length;

  const pastDueCount =
    subscriptions.filter(
      (subscription) =>
        subscription.status === "past_due"
    ).length;

  const canceledCount =
    subscriptions.filter(
      (subscription) =>
        subscription.status === "canceled"
    ).length;

  function openCreate() {
    setSelectedSubscription(null);
    setEditorMode("create");
  }

  function openEdit(
    subscription: Subscription
  ) {
    setSelectedSubscription(subscription);
    setEditorMode("edit");
  }

  function openExtend(
    subscription: Subscription
  ) {
    setSelectedSubscription(subscription);
    setEditorMode("extend");
  }

  function closeEditor() {
    if (isPending) {
      return;
    }

    setEditorMode(null);
    setSelectedSubscription(null);
  }

  function submitForm(
    formData: FormData
  ) {
    startTransition(async () => {
      try {
        if (editorMode === "create") {
          await createSubscription(
            formData
          );
        }

        if (editorMode === "edit") {
          await updateSubscription(
            formData
          );
        }

        if (editorMode === "extend") {
          await extendSubscription(
            formData
          );
        }

        closeEditor();
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : "Unable to save subscription."
        );
      }
    });
  }

  function handleCancel(
    subscription: Subscription
  ) {
    const confirmed =
      window.confirm(
        `Cancel the subscription for ${
          selectedCompany?.name ??
          "this company"
        }?`
      );

    if (!confirmed) {
      return;
    }

    const formData =
      new FormData();

    formData.set(
      "subscriptionId",
      subscription.id
    );

    startTransition(async () => {
      try {
        await cancelSubscription(
          formData
        );
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : "Unable to cancel subscription."
        );
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
            <CreditCard className="h-4 w-4" />
            Platform Management
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Subscriptions
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Manage company subscriptions,
            plans, custom pricing, free access,
            trials, billing cycles, and
            subscription lifecycle controls.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <Sparkles className="h-4 w-4" />
          Create Subscription
        </button>
      </div>

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active"
          value={activeCount}
          detail="Active and trialing subscriptions"
          icon={Check}
          tone="green"
        />

        <StatCard
          label="Paused"
          value={pausedCount}
          detail="Subscriptions currently paused"
          icon={Pause}
          tone="amber"
        />

        <StatCard
          label="Past Due"
          value={pastDueCount}
          detail="Subscriptions requiring attention"
          icon={AlertCircle}
          tone="red"
        />

        <StatCard
          label="Canceled"
          value={canceledCount}
          detail="Canceled subscriptions"
          icon={X}
          tone="slate"
        />
      </div>

      {/* COMPANY SELECTOR */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[minmax(280px,1fr)_minmax(280px,1fr)_auto] lg:items-end">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Search Company
            </label>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search companies..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Company
            </label>

            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <select
                value={selectedCompanyId}
                onChange={(event) =>
                  setSelectedCompanyId(
                    event.target.value
                  )
                }
                className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                {filteredCompanies.map(
                  (company) => (
                    <option
                      key={company.id}
                      value={company.id}
                    >
                      {company.name}
                    </option>
                  )
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {selectedCompany && (
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={
                  selectedCompany.status
                }
                tone={
                  selectedCompany.status ===
                  "active"
                    ? "green"
                    : "slate"
                }
              />

              {selectedPlan && (
                <StatusPill
                  label={
                    selectedPlan.name
                  }
                  tone="blue"
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* CURRENT SUBSCRIPTION */}
      {selectedCompany && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Current Subscription
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Subscription configuration for{" "}
                <span className="font-medium text-slate-700">
                  {selectedCompany.name}
                </span>
                .
              </p>
            </div>

            <div className="flex items-center gap-2">
              {activeSubscription ? (
                <StatusPill
                  label={
                    activeSubscription.status
                  }
                  tone={
                    activeSubscription.status ===
                    "past_due"
                      ? "red"
                      : activeSubscription.status ===
                          "paused"
                        ? "amber"
                        : "green"
                  }
                />
              ) : (
                <StatusPill
                  label="No active subscription"
                  tone="slate"
                />
              )}
            </div>
          </div>

          {activeSubscription ? (
            <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-5">
              <InfoCard
                label="Plan"
                value={
                  selectedPlan?.name ??
                  "Unknown plan"
                }
                icon={ShieldCheck}
              />

              <InfoCard
                label="Amount"
                value={`${activeSubscription.currency} ${formatMoney(
                  activeSubscription.amount
                )}`}
                icon={BadgeDollarSign}
              />

              <InfoCard
                label="Billing"
                value={
                  activeSubscription.billing_cycle
                }
                icon={RotateCcw}
              />

              <InfoCard
                label="Period Ends"
                value={
                  activeSubscription.current_period_end
                    ? formatDate(
                        activeSubscription.current_period_end
                      )
                    : "—"
                }
                icon={CalendarDays}
              />

              <InfoCard
                label="Trial"
                value={
                  activeSubscription.trial_end
                    ? formatDate(
                        activeSubscription.trial_end
                      )
                    : "No trial"
                }
                icon={Clock3}
              />
            </div>
          ) : (
            <div className="p-8 text-center">
              <CreditCard className="mx-auto h-8 w-8 text-slate-300" />

              <p className="mt-3 text-sm font-semibold text-slate-700">
                No active subscription
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Create a subscription to give
                this company access to a plan.
              </p>

              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <Sparkles className="h-4 w-4" />
                Create Subscription
              </button>
            </div>
          )}
        </section>
      )}

      {/* SUBSCRIPTION HISTORY */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Subscription History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              All subscription records for this
              company.
            </p>
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="h-10 appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value="all">
                All statuses
              </option>
              <option value="active">
                Active
              </option>
              <option value="trialing">
                Trialing
              </option>
              <option value="paused">
                Paused
              </option>
              <option value="past_due">
                Past Due
              </option>
              <option value="canceled">
                Canceled
              </option>
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {visibleSubscriptions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <TableHeader>
                    Plan
                  </TableHeader>

                  <TableHeader>
                    Amount
                  </TableHeader>

                  <TableHeader>
                    Billing
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    Period End
                  </TableHeader>

                  <TableHeader align="right">
                    Actions
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visibleSubscriptions.map(
                  (subscription) => {
                    const plan =
                      plans.find(
                        (item) =>
                          item.id ===
                          subscription.plan_id
                      );

                    return (
                      <tr
                        key={
                          subscription.id
                        }
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-5">
                          <div className="font-medium text-slate-900">
                            {plan?.name ??
                              "Unknown plan"}
                          </div>

                          <div className="mt-1 font-mono text-[10px] text-slate-400">
                            {plan?.slug ??
                              "unknown"}
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="font-semibold text-slate-800">
                            {
                              subscription.currency
                            }{" "}
                            {formatMoney(
                              subscription.amount
                            )}
                          </div>

                          {isCustomPrice(
                            subscription,
                            plan
                          ) && (
                            <div className="mt-1 text-[10px] font-medium text-blue-600">
                              Custom price
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-5">
                          <span className="text-sm capitalize text-slate-600">
                            {
                              subscription.billing_cycle
                            }
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <StatusPill
                            label={
                              subscription.status
                            }
                            tone={getStatusTone(
                              subscription.status
                            )}
                          />
                        </td>

                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600">
                            {subscription.current_period_end
                              ? formatDate(
                                  subscription.current_period_end
                                )
                              : "—"}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-2">
                            {[
                              "active",
                              "trialing",
                              "paused",
                              "past_due",
                            ].includes(
                              subscription.status
                            ) && (
                              <>
                                <button
                                  type="button"
                                  disabled={
                                    isPending
                                  }
                                  onClick={() =>
                                    openEdit(
                                      subscription
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  Manage
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    isPending
                                  }
                                  onClick={() =>
                                    openExtend(
                                      subscription
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  Extend
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    isPending
                                  }
                                  onClick={() =>
                                    handleCancel(
                                      subscription
                                    )
                                  }
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <CreditCard className="mx-auto h-7 w-7 text-slate-300" />

            <p className="mt-3 text-sm font-semibold text-slate-700">
              No subscriptions found
            </p>

            <p className="mt-1 text-xs text-slate-400">
              There are no subscription records
              matching the current filters.
            </p>
          </div>
        )}
      </section>

      {/* CONTROL ARCHITECTURE */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ArchitectureCard
          icon={BadgeDollarSign}
          title="Custom Pricing"
          description="Override the normal plan price for a specific company without changing the global plan price."
        />

        <ArchitectureCard
          icon={Gift}
          title="Free Access"
          description="Give a company a subscription with a zero amount while keeping the plan and module architecture intact."
        />

        <ArchitectureCard
          icon={Clock3}
          title="Trials & Extensions"
          description="Create trials, extend billing periods, or provide additional access without changing the customer's underlying plan."
        />
      </section>

      {/* EDITOR */}
      {editorMode && (
        <SubscriptionEditor
          mode={editorMode}
          companies={companies}
          plans={plans}
          companyId={
            selectedCompanyId
          }
          subscription={
            selectedSubscription
          }
          disabled={isPending}
          onClose={closeEditor}
          onSubmit={submitForm}
        />
      )}
    </div>
  );
}

/* ============================================================
   SUBSCRIPTION EDITOR
============================================================ */

function SubscriptionEditor({
  mode,
  companies,
  plans,
  companyId,
  subscription,
  disabled,
  onClose,
  onSubmit,
}: {
  mode: EditorMode;
  companies: Company[];
  plans: Plan[];
  companyId: string;
  subscription: Subscription | null;
  disabled: boolean;
  onClose: () => void;
  onSubmit: (
    formData: FormData
  ) => void;
}) {
  const initialPlanId =
    subscription?.plan_id ??
    plans[0]?.id ??
    "";

  const initialBillingCycle =
    subscription?.billing_cycle ??
    "monthly";

  const initialAmount =
    subscription?.amount ??
    getPlanPrice(
      plans.find(
        (plan) =>
          plan.id ===
          initialPlanId
      ),
      initialBillingCycle
    );

  const [planId, setPlanId] =
    useState(initialPlanId);

  const [billingCycle, setBillingCycle] =
    useState(initialBillingCycle);

  const [amount, setAmount] =
    useState(String(initialAmount));

  const [isFree, setIsFree] =
    useState(
      Number(initialAmount) === 0
    );

  const [status, setStatus] =
    useState(
      subscription?.status ??
        "active"
    );

  const [trialEnd, setTrialEnd] =
    useState(
      subscription?.trial_end
        ? subscription.trial_end.slice(
            0,
            10
          )
        : ""
    );

  const [periodEnd, setPeriodEnd] =
    useState(
      subscription?.current_period_end
        ? subscription.current_period_end.slice(
            0,
            10
          )
        : ""
    );

  const [reason, setReason] =
    useState("");

  const selectedPlan =
    plans.find(
      (plan) =>
        plan.id === planId
    );

  function handlePlanChange(
    value: string
  ) {
    setPlanId(value);

    const plan =
      plans.find(
        (item) =>
          item.id === value
      );

    const nextPrice =
      getPlanPrice(
        plan,
        billingCycle
      );

    if (!isFree) {
      setAmount(
        String(nextPrice)
      );
    }
  }

  function handleBillingChange(
    value: string
  ) {
    setBillingCycle(value);

    const nextPrice =
      getPlanPrice(
        selectedPlan,
        value
      );

    if (!isFree) {
      setAmount(
        String(nextPrice)
      );
    }
  }

  function toggleFree() {
    const next = !isFree;

    setIsFree(next);

    if (next) {
      setAmount("0");
      return;
    }

    setAmount(
      String(
        getPlanPrice(
          selectedPlan,
          billingCycle
        )
      )
    );
  }

  const title =
    mode === "create"
      ? "Create Subscription"
      : mode === "extend"
        ? "Extend Subscription"
        : "Manage Subscription";

  const description =
    mode === "create"
      ? "Create a plan subscription for this company."
      : mode === "extend"
        ? "Extend the company's current subscription period."
        : "Update the company's subscription configuration.";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* MODAL HEADER */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                <CreditCard className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {title}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  {description}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* FORM */}
        <form
          action={onSubmit}
          className="max-h-[75vh] space-y-5 overflow-y-auto p-6"
        >
          <input
            type="hidden"
            name="companyId"
            value={companyId}
          />

          {subscription && (
            <input
              type="hidden"
              name="subscriptionId"
              value={
                subscription.id
              }
            />
          )}

          <input
            type="hidden"
            name="mode"
            value={mode}
          />

          {/* COMPANY */}
          {mode === "create" && (
            <div>
              <label
                htmlFor="subscription-company"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Company
              </label>

              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <select
                  id="subscription-company"
                  name="companyId"
                  value={
                    companyId
                  }
                  disabled
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm font-medium text-slate-700 outline-none"
                >
                  {companies.map(
                    (company) => (
                      <option
                        key={
                          company.id
                        }
                        value={
                          company.id
                        }
                      >
                        {company.name}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          )}

          {/* PLAN */}
          {mode !== "extend" && (
            <div>
              <label
                htmlFor="subscription-plan"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Plan
              </label>

              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <select
                  id="subscription-plan"
                  name="planId"
                  value={planId}
                  onChange={(event) =>
                    handlePlanChange(
                      event.target.value
                    )
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {plans.map(
                    (plan) => (
                      <option
                        key={
                          plan.id
                        }
                        value={
                          plan.id
                        }
                      >
                        {plan.name}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>

              {selectedPlan?.description && (
                <p className="mt-2 text-xs text-slate-400">
                  {
                    selectedPlan.description
                  }
                </p>
              )}
            </div>
          )}

          {/* BILLING */}
          {mode !== "extend" && (
            <div>
              <label
                htmlFor="billing-cycle"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Billing Cycle
              </label>

              <div className="relative">
                <RotateCcw className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <select
                  id="billing-cycle"
                  name="billingCycle"
                  value={
                    billingCycle
                  }
                  onChange={(event) =>
                    handleBillingChange(
                      event.target.value
                    )
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="monthly">
                    Monthly
                  </option>

                  <option value="yearly">
                    Yearly
                  </option>
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          )}

          {/* CUSTOM PRICE */}
          {mode !== "extend" && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="subscription-amount"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Subscription Amount
                </label>

                <button
                  type="button"
                  onClick={toggleFree}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    isFree
                      ? "text-emerald-600"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Gift className="h-3.5 w-3.5" />
                  {isFree
                    ? "Free subscription"
                    : "Make free"}
                </button>
              </div>

              <div className="relative">
                <BadgeDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  id="subscription-amount"
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) =>
                    setAmount(
                      event.target
                        .value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <p className="mt-1.5 text-[11px] text-slate-400">
                You can override the normal plan
                price for this company.
              </p>
            </div>
          )}

          {/* STATUS */}
          {mode === "edit" && (
            <div>
              <label
                htmlFor="subscription-status"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Status
              </label>

              <div className="relative">
                <select
                  id="subscription-status"
                  name="status"
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value
                    )
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-700 outline-none focus:border-emerald-500"
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="trialing">
                    Trialing
                  </option>

                  <option value="paused">
                    Paused
                  </option>

                  <option value="past_due">
                    Past Due
                  </option>
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          )}

          {/* TRIAL */}
          {mode === "create" && (
            <div>
              <label
                htmlFor="trial-end"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Trial End
              </label>

              <input
                id="trial-end"
                name="trialEnd"
                type="date"
                value={trialEnd}
                onChange={(event) =>
                  setTrialEnd(
                    event.target.value
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />

              <p className="mt-1.5 text-[11px] text-slate-400">
                Leave empty if the subscription should
                start immediately.
              </p>
            </div>
          )}

          {/* PERIOD END */}
          {(mode === "extend" ||
            mode === "edit") && (
            <div>
              <label
                htmlFor="period-end"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Subscription Period End
              </label>

              <input
                id="period-end"
                name="currentPeriodEnd"
                type="date"
                value={periodEnd}
                onChange={(event) =>
                  setPeriodEnd(
                    event.target.value
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />

              <p className="mt-1.5 text-[11px] text-slate-400">
                Set a custom end date to extend or
                shorten access.
              </p>
            </div>
          )}

          {/* REASON */}
          <div>
            <label
              htmlFor="subscription-reason"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Reason
            </label>

            <textarea
              id="subscription-reason"
              name="reason"
              value={reason}
              onChange={(event) =>
                setReason(
                  event.target.value
                )
              }
              rows={3}
              placeholder="Why is this subscription being changed?"
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* NOTICE */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />

              <p className="text-xs leading-5 text-blue-700">
                Subscription pricing and lifecycle
                changes affect this company only. Global
                plan pricing remains unchanged.
              </p>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={disabled}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {disabled ? (
                <RotateCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}

              {disabled
                ? "Saving..."
                : mode === "extend"
                  ? "Extend Subscription"
                  : mode === "create"
                    ? "Create Subscription"
                    : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  tone:
    | "green"
    | "amber"
    | "red"
    | "slate";
}) {
  const iconClasses = {
    green:
      "bg-emerald-50 text-emerald-700",
    amber:
      "bg-amber-50 text-amber-700",
    red:
      "bg-red-50 text-red-700",
    slate:
      "bg-slate-100 text-slate-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClasses[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="mt-5">
        <div className="text-2xl font-bold tracking-tight text-slate-900">
          {value}
        </div>

        <div className="mt-1 text-sm font-medium text-slate-700">
          {label}
        </div>

        <div className="mt-1 text-xs text-slate-400">
          {detail}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   INFO CARD
============================================================ */

function InfoCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />

        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>

      <div className="mt-3 truncate text-sm font-semibold text-slate-800">
        {value}
      </div>
    </div>
  );
}

/* ============================================================
   ARCHITECTURE CARD
============================================================ */

function ArchitectureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Icon className="h-5 w-5" />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

/* ============================================================
   TABLE HEADER
============================================================ */

function TableHeader({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

/* ============================================================
   STATUS PILL
============================================================ */

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone:
    | "green"
    | "blue"
    | "amber"
    | "red"
    | "slate";
}) {
  const classes = {
    green:
      "bg-emerald-50 text-emerald-700",
    blue:
      "bg-blue-50 text-blue-700",
    amber:
      "bg-amber-50 text-amber-700",
    red:
      "bg-red-50 text-red-700",
    slate:
      "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${classes[tone]}`}
    >
      {label.replaceAll(
        "_",
        " "
      )}
    </span>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function getStatusTone(
  status: string
):
  | "green"
  | "blue"
  | "amber"
  | "red"
  | "slate" {
  if (
    status === "active" ||
    status === "trialing"
  ) {
    return "green";
  }

  if (status === "paused") {
    return "amber";
  }

  if (status === "past_due") {
    return "red";
  }

  return "slate";
}

function getPlanPrice(
  plan:
    | Plan
    | undefined,
  billingCycle: string
) {
  if (!plan) {
    return 0;
  }

  if (
    billingCycle === "yearly"
  ) {
    return Number(
      plan.yearly_price ??
        plan.monthly_price ??
        0
    );
  }

  return Number(
    plan.monthly_price ?? 0
  );
}

function isCustomPrice(
  subscription: Subscription,
  plan:
    | Plan
    | undefined
) {
  if (!plan) {
    return false;
  }

  const standardPrice =
    getPlanPrice(
      plan,
      subscription.billing_cycle
    );

  return (
    Number(subscription.amount) !==
    standardPrice
  );
}

function formatMoney(
  value: number
) {
  return Number(value ?? 0).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function formatDate(
  value: string
) {
  try {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    ).format(new Date(value));
  } catch {
    return value;
  }
}