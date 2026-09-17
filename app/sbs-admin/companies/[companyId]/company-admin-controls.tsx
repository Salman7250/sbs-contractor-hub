"use client";

import {
  useState,
  useTransition,
} from "react";
import {
  Check,
  ChevronDown,
  Clock3,
  Shield,
  ShieldAlert,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import {
  changeCompanyPlan,
  extendCompanyTrial,
  setCompanyModuleAccess,
  setCompanyLimitOverride,
  removeCompanyLimitOverride,
  toggleCompanySuspension,
} from "./actions";

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  currency: string | null;
  is_active: boolean | null;
  is_popular: boolean | null;
  sort_order: number | null;
};

type Module = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean | null;
};

type ModuleRow = {
  module: Module;
  enabled: boolean;
  includedInPlan: boolean;
  isOverride: boolean;
  reason: string | null;
};

type LimitRow = {
  key: string;
  base:
    | {
        limit_value: number | null;
        is_unlimited: boolean;
      }
    | null;
  override:
    | {
        limit_value: number | null;
        is_unlimited: boolean;
      }
    | null;
};

type Props = {
  companyId: string;
  companyName: string;
  companyStatus: string | null;
  subscription: {
    id: string;
    status: string | null;
    billing_cycle: string | null;
    trial_ends_at: string | null;
  } | null;
  plans: Plan[];
  modules: Module[];
  moduleRows: ModuleRow[];
  limitRows: LimitRow[];
};

type Modal =
  | "plan"
  | "trial"
  | "modules"
  | "limit"
  | "suspend"
  | null;

function formatMoney(
  amount: number | null,
  currency = "USD",
) {
  if (amount == null) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    },
  ).format(amount);
}

function prettyLimitKey(key: string) {
  return key
    .replace(
      /_per_month/g,
      " / month",
    )
    .replace(
      /_per_year/g,
      " / year",
    )
    .replace(
      /_/g,
      " ",
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

export default function CompanyAdminControls({
  companyId,
  companyName,
  companyStatus,
  subscription,
  plans,
  moduleRows,
  limitRows,
}: Props) {
  const router = useRouter();

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const [modal, setModal] =
    useState<Modal>(null);

  const [
    selectedPlanId,
    setSelectedPlanId,
  ] = useState(
    plans.find(
      (plan) =>
        plan.id ===
        undefined,
    )?.id ??
      "",
  );

  const [
    billingCycle,
    setBillingCycle,
  ] = useState<
    "monthly" | "yearly"
  >(
    subscription?.billing_cycle ===
      "yearly"
      ? "yearly"
      : "monthly",
  );

  const [
    trialDays,
    setTrialDays,
  ] = useState("7");

  const [
    moduleStates,
    setModuleStates,
  ] = useState<
    Record<string, boolean>
  >(
    Object.fromEntries(
      moduleRows.map((row) => [
        row.module.id,
        row.enabled,
      ]),
    ),
  );

  const [
    selectedLimit,
    setSelectedLimit,
  ] = useState(
    limitRows[0]?.key ?? "",
  );

  const [
    limitValue,
    setLimitValue,
  ] = useState("");

  const [
    unlimited,
    setUnlimited,
  ] = useState(false);

  const [
    limitReason,
    setLimitReason,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  function closeModal() {
    if (isPending) {
      return;
    }

    setModal(null);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function runAction(
    action: () => Promise<{
      success: boolean;
      error?: string;
    }>,
    success: string,
  ) {
    setErrorMessage("");
    setSuccessMessage("");

    startTransition(async () => {
      try {
        const result =
          await action();

        if (!result.success) {
          throw new Error(
            result.error ||
              "The action could not be completed.",
          );
        }

        setSuccessMessage(
          success,
        );

        setModal(null);

        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Something went wrong.",
        );
      }
    });
  }

  function openPlanModal() {
    const currentPlan =
      plans.find(
        (plan) =>
          plan.id ===
          undefined,
      );

    setSelectedPlanId(
      currentPlan?.id ??
        plans[0]?.id ??
        "",
    );

    setErrorMessage("");
    setSuccessMessage("");
    setModal("plan");
  }

  function submitPlan() {
    if (!selectedPlanId) {
      setErrorMessage(
        "Please select a plan.",
      );
      return;
    }

    runAction(
      () =>
        changeCompanyPlan({
          companyId,
          subscriptionId:
            subscription?.id ??
            "",
          planId:
            selectedPlanId,
          billingCycle,
        }),
      "Company plan updated successfully.",
    );
  }

  function submitTrial() {
    const days =
      Number(trialDays);

    if (
      !Number.isFinite(days) ||
      days < 1 ||
      days > 3650
    ) {
      setErrorMessage(
        "Trial extension must be between 1 and 3650 days.",
      );
      return;
    }

    if (!subscription?.id) {
      setErrorMessage(
        "This company does not have a subscription.",
      );
      return;
    }

    runAction(
      () =>
        extendCompanyTrial({
          companyId,
          subscriptionId:
            subscription.id,
          days,
        }),
      `Trial extended by ${days} days.`,
    );
  }

  function submitModules() {
    const changes =
      moduleRows
        .filter(
          (row) =>
            moduleStates[
              row.module.id
            ] !==
            row.enabled,
        )
        .map((row) => ({
          moduleId:
            row.module.id,
          enabled:
            moduleStates[
              row.module.id
            ],
        }));

    if (
      changes.length === 0
    ) {
      setModal(null);
      return;
    }

    runAction(
      () =>
        Promise.all(
          changes.map(
            (change) =>
              setCompanyModuleAccess(
                {
                  companyId,
                  moduleId:
                    change.moduleId,
                  enabled:
                    change.enabled,
                  reason:
                    "Platform administrator override",
                },
              ),
          ),
        ).then(
  (
    results: {
      success: boolean;
      error?: string;
    }[],
  ) => {
    const failed =
      results.find(
        (
          result: {
            success: boolean;
            error?: string;
          },
        ) => !result.success,
      );

    return (
      failed ?? {
        success: true,
      }
    );
  },
),
      "Module access updated successfully.",
    );
  }

  function submitLimit() {
    if (!selectedLimit) {
      setErrorMessage(
        "Please select a resource limit.",
      );
      return;
    }

    if (
      !unlimited &&
      (limitValue.trim() === "" ||
        Number(limitValue) < 0)
    ) {
      setErrorMessage(
        "Enter a valid limit value.",
      );
      return;
    }

    runAction(
      () =>
        setCompanyLimitOverride({
          companyId,
          limitKey:
            selectedLimit,
          limitValue:
            unlimited
              ? null
              : Number(
                  limitValue,
                ),
          isUnlimited:
            unlimited,
          reason:
            limitReason.trim() ||
            null,
        }),
      "Resource limit override saved.",
    );
  }

  function removeLimit() {
    if (!selectedLimit) {
      return;
    }

    runAction(
      () =>
        removeCompanyLimitOverride({
          companyId,
          limitKey:
            selectedLimit,
        }),
      "Resource limit override removed.",
    );
  }

  function toggleSuspension() {
    const suspended =
      companyStatus ===
      "suspended";

    runAction(
      () =>
        toggleCompanySuspension({
          companyId,
          suspended:
            !suspended,
        }),
      suspended
        ? "Company reactivated successfully."
        : "Company suspended successfully.",
    );
  }

  return (
    <>
      {/* =====================================================
          TOP ACTIONS
          ===================================================== */}
      <div
        id="top-controls"
        className="flex flex-wrap gap-2"
      >
        <ActionButton
          onClick={() =>
            openPlanModal()
          }
          icon={
            <Shield className="h-3.5 w-3.5" />
          }
        >
          Change Plan
        </ActionButton>

        <ActionButton
          onClick={() => {
            setErrorMessage("");
            setSuccessMessage("");
            setModal("trial");
          }}
          icon={
            <Clock3 className="h-3.5 w-3.5" />
          }
        >
          Extend Trial
        </ActionButton>

        <ActionButton
          danger={
            companyStatus !==
            "suspended"
          }
          onClick={() => {
            setErrorMessage("");
            setSuccessMessage("");
            setModal("suspend");
          }}
          icon={
            <ShieldAlert className="h-3.5 w-3.5" />
          }
        >
          {companyStatus ===
          "suspended"
            ? "Reactivate"
            : "Suspend"}
        </ActionButton>
      </div>

      {/* =====================================================
          HIDDEN CONTROL ANCHORS
          ===================================================== */}
      <div
        id="module-controls"
        className="pointer-events-none absolute h-px w-px opacity-0"
      />

      <div
        id="limit-controls"
        className="pointer-events-none absolute h-px w-px opacity-0"
      />

      {/* =====================================================
          MODAL
          ===================================================== */}
      {modal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
          <div
            className="absolute inset-0"
            onClick={closeModal}
          />

          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  {modal ===
                    "plan" &&
                    "Change Subscription Plan"}

                  {modal ===
                    "trial" &&
                    "Extend Trial"}

                  {modal ===
                    "modules" &&
                    "Manage Module Access"}

                  {modal ===
                    "limit" &&
                    "Override Resource Limit"}

                  {modal ===
                    "suspend" &&
                    (companyStatus ===
                    "suspended"
                      ? "Reactivate Company"
                      : "Suspend Company")}
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  {companyName}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={
                  isPending
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error */}
            {errorMessage ? (
              <div className="mx-6 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            {/* =================================================
                PLAN
                ================================================= */}
            {modal ===
            "plan" ? (
              <div className="max-h-[65vh] overflow-y-auto p-6">
                <div className="grid gap-3 md:grid-cols-3">
                  {plans.map(
                    (plan) => {
                      const selected =
                        selectedPlanId ===
                        plan.id;

                      const price =
                        billingCycle ===
                        "monthly"
                          ? plan.monthly_price
                          : plan.yearly_price;

                      return (
                        <button
                          key={
                            plan.id
                          }
                          type="button"
                          onClick={() =>
                            setSelectedPlanId(
                              plan.id,
                            )
                          }
                          className={`relative rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/10"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {plan.is_popular ? (
                            <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-700">
                              Popular
                            </span>
                          ) : null}

                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                              selected
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {selected ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Shield className="h-4 w-4" />
                            )}
                          </div>

                          <div className="mt-4 text-sm font-bold text-slate-900">
                            {plan.name}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {plan.description ||
                              "SBS product business plan."}
                          </div>

                          <div className="mt-4 text-lg font-bold text-slate-900">
                            {formatMoney(
                              price,
                              plan.currency ||
                                "USD",
                            )}
                          </div>

                          <div className="mt-0.5 text-[10px] text-slate-400">
                            /{" "}
                            {billingCycle ===
                            "monthly"
                              ? "month"
                              : "year"}
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>

                <div className="mt-5">
                  <label className="mb-2 block text-xs font-semibold text-slate-600">
                    Billing Cycle
                  </label>

                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() =>
                        setBillingCycle(
                          "monthly",
                        )
                      }
                      className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                        billingCycle ===
                        "monthly"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500"
                      }`}
                    >
                      Monthly
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setBillingCycle(
                          "yearly",
                        )
                      }
                      className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                        billingCycle ===
                        "yearly"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500"
                      }`}
                    >
                      Yearly
                    </button>
                  </div>
                </div>

                <ModalFooter
                  cancel={
                    closeModal
                  }
                  submit={
                    submitPlan
                  }
                  saving={
                    isPending
                  }
                  label="Change Plan"
                />
              </div>
            ) : null}

            {/* =================================================
                TRIAL
                ================================================= */}
            {modal ===
            "trial" ? (
              <div className="p-6">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex gap-3">
                    <Clock3 className="h-5 w-5 shrink-0 text-blue-600" />

                    <div>
                      <div className="text-sm font-semibold text-blue-900">
                        Extend the current trial
                      </div>

                      <p className="mt-1 text-xs leading-5 text-blue-700">
                        The selected number of days
                        will be added to the current
                        trial end date. If the trial
                        has already expired, the
                        extension starts from today.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 max-w-xs">
                  <label className="mb-2 block text-xs font-semibold text-slate-600">
                    Additional Days
                  </label>

                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={
                      trialDays
                    }
                    onChange={(
                      event,
                    ) =>
                      setTrialDays(
                        event.target
                          .value,
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>

                <ModalFooter
                  cancel={
                    closeModal
                  }
                  submit={
                    submitTrial
                  }
                  saving={
                    isPending
                  }
                  label="Extend Trial"
                />
              </div>
            ) : null}

            {/* =================================================
                MODULES
                ================================================= */}
            {modal ===
            "modules" ? (
              <div className="max-h-[65vh] overflow-y-auto p-6">
                <div className="space-y-2">
                  {moduleRows.map(
                    (row) => (
                      <button
                        key={
                          row.module.id
                        }
                        type="button"
                        onClick={() =>
                          setModuleStates(
                            (
                              current,
                            ) => ({
                              ...current,
                              [row.module.id]:
                                !current[
                                  row.module
                                    .id
                                ],
                            }),
                          )
                        }
                        className={`flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left transition ${
                          moduleStates[
                            row.module.id
                          ]
                            ? "border-emerald-200 bg-emerald-50/40"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              moduleStates[
                                row.module.id
                              ]
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {moduleStates[
                              row.module.id
                            ] ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {
                                row
                                  .module
                                  .name
                              }
                            </div>

                            <div className="mt-0.5 truncate text-xs text-slate-400">
                              {row
                                .includedInPlan
                                ? "Included in current plan"
                                : "Not included in current plan"}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                            moduleStates[
                              row.module.id
                            ]
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {moduleStates[
                            row.module.id
                          ]
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                      </button>
                    ),
                  )}
                </div>

                <ModalFooter
                  cancel={
                    closeModal
                  }
                  submit={
                    submitModules
                  }
                  saving={
                    isPending
                  }
                  label="Save Module Access"
                />
              </div>
            ) : null}

            {/* =================================================
                LIMIT
                ================================================= */}
            {modal ===
            "limit" ? (
              <div className="p-6">
                <label className="mb-2 block text-xs font-semibold text-slate-600">
                  Resource
                </label>

                <div className="relative">
                  <select
                    value={
                      selectedLimit
                    }
                    onChange={(
                      event,
                    ) => {
                      const key =
                        event.target
                          .value;

                      setSelectedLimit(
                        key,
                      );

                      const row =
                        limitRows.find(
                          (
                            item,
                          ) =>
                            item.key ===
                            key,
                        );

                      setUnlimited(
                        row?.override
                          ?.is_unlimited ??
                          false,
                      );

                      setLimitValue(
                        row?.override
                          ?.limit_value !=
                          null
                          ? String(
                              row
                                .override
                                .limit_value,
                            )
                          : "",
                      );
                    }}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 pr-10 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  >
                    {limitRows.map(
                      (row) => (
                        <option
                          key={
                            row.key
                          }
                          value={
                            row.key
                          }
                        >
                          {prettyLimitKey(
                            row.key,
                          )}
                        </option>
                      ),
                    )}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>

                <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      Unlimited
                    </div>

                    <div className="mt-0.5 text-xs text-slate-400">
                      Remove the numeric resource cap.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setUnlimited(
                        !unlimited,
                      )
                    }
                    className={`relative h-6 w-11 rounded-full transition ${
                      unlimited
                        ? "bg-emerald-600"
                        : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                        unlimited
                          ? "left-6"
                          : "left-1"
                      }`}
                    />
                  </button>
                </div>

                {!unlimited ? (
                  <div className="mt-5">
                    <label className="mb-2 block text-xs font-semibold text-slate-600">
                      Limit Value
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={
                        limitValue
                      }
                      onChange={(
                        event,
                      ) =>
                        setLimitValue(
                          event.target
                            .value,
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                ) : null}

                <div className="mt-5">
                  <label className="mb-2 block text-xs font-semibold text-slate-600">
                    Reason
                  </label>

                  <textarea
                    rows={3}
                    value={
                      limitReason
                    }
                    onChange={(
                      event,
                    ) =>
                      setLimitReason(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Why is this override being granted?"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={
                      removeLimit
                    }
                    disabled={
                      isPending
                    }
                    className="rounded-xl px-4 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove Override
                  </button>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={
                        closeModal
                      }
                      disabled={
                        isPending
                      }
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={
                        submitLimit
                      }
                      disabled={
                        isPending
                      }
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending
                        ? "Saving..."
                        : "Save Override"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* =================================================
                SUSPEND
                ================================================= */}
            {modal ===
            "suspend" ? (
              <div className="p-6">
                <div
                  className={`rounded-xl border p-5 ${
                    companyStatus ===
                    "suspended"
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex gap-3">
                    <ShieldAlert
                      className={`mt-0.5 h-5 w-5 ${
                        companyStatus ===
                        "suspended"
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    />

                    <div>
                      <div
                        className={`text-sm font-semibold ${
                          companyStatus ===
                          "suspended"
                            ? "text-emerald-900"
                            : "text-red-900"
                        }`}
                      >
                        {companyStatus ===
                        "suspended"
                          ? "Reactivate this company?"
                          : "Suspend this company?"}
                      </div>

                      <p
                        className={`mt-1 text-xs leading-5 ${
                          companyStatus ===
                          "suspended"
                            ? "text-emerald-700"
                            : "text-red-700"
                        }`}
                      >
                        {companyStatus ===
                        "suspended"
                          ? "The company will be restored to active status and can access its workspace again."
                          : "The company status will be changed to suspended. This is a platform-level account control."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={
                      closeModal
                    }
                    disabled={
                      isPending
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      toggleSuspension
                    }
                    disabled={
                      isPending
                    }
                    className={`rounded-xl px-5 py-2.5 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      companyStatus ===
                      "suspended"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {isPending
                      ? "Saving..."
                      : companyStatus ===
                          "suspended"
                        ? "Reactivate Company"
                        : "Suspend Company"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Success toast */}
      {successMessage ? (
        <div className="fixed bottom-6 right-6 z-[110] flex max-w-sm items-start gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-xl">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Check className="h-4 w-4" />
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">
              Done
            </div>

            <div className="mt-0.5 text-xs text-slate-500">
              {successMessage}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ActionButton({
  children,
  onClick,
  danger = false,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
        danger
          ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ModalFooter({
  cancel,
  submit,
  saving,
  label,
}: {
  cancel: () => void;
  submit: () => void;
  saving: boolean;
  label: string;
}) {
  return (
    <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-5">
      <button
        type="button"
        onClick={cancel}
        disabled={saving}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving
          ? "Saving..."
          : label}
      </button>
    </div>
  );
}