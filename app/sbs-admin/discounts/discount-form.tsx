"use client";

import {
  CheckCircle2,
  Gift,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

type Company = {
  id: string;
  name: string;
};

type Plan = {
  id: string;
  name: string;
  slug: string;
};

type DiscountType =
  | "percentage"
  | "fixed";

type DurationType =
  | "one_time"
  | "one_month"
  | "three_months"
  | "six_months"
  | "twelve_months"
  | "lifetime"
  | "custom";

type DurationUnit =
  | "days"
  | "weeks"
  | "months"
  | "years";

type BillingCycle =
  | "monthly"
  | "yearly"
  | null;

type Discount = {
  id: string;
  company_id: string | null;
  plan_id: string | null;
  name: string;
  code: string | null;
  discount_type: DiscountType;
  discount_value: number;
  duration_type: DurationType;
  starts_at: string;
  expires_at: string | null;
  billing_cycle: BillingCycle;
  reason: string | null;
  duration_value: number | null;
  duration_unit: DurationUnit | null;
  max_redemptions: number | null;
};

export default function DiscountForm({
  companies,
  plans,
  discount,
  action,
}: {
  companies: Company[];
  plans: Plan[];
  discount: Discount | null;
  action: (
    formData: FormData,
  ) => Promise<void>;
}) {
  const isEdit =
    Boolean(discount);

  /*
   * --------------------------------------------------------
   * FORM STATE
   * --------------------------------------------------------
   */

  const [
    discountType,
    setDiscountType,
  ] = useState<DiscountType>(
    discount?.discount_type ??
      "percentage",
  );

  const [
    durationType,
    setDurationType,
  ] = useState<DurationType>(
    discount?.duration_type ??
      "lifetime",
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /*
   * --------------------------------------------------------
   * DATE VALUES
   * --------------------------------------------------------
   */

  const startsAtValue =
    discount?.starts_at
      ? new Date(
          discount.starts_at,
        )
          .toISOString()
          .slice(0, 16)
      : "";

  const expiresAtValue =
    discount?.expires_at
      ? new Date(
          discount.expires_at,
        )
          .toISOString()
          .slice(0, 16)
      : "";

  /*
   * --------------------------------------------------------
   * LOCK BODY WHEN MODAL IS OPEN
   * --------------------------------------------------------
   */

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, []);

  /*
   * --------------------------------------------------------
   * SUBMIT
   * --------------------------------------------------------
   */

  async function handleSubmit(
    formData: FormData,
  ) {
    setSubmitting(true);
    setError("");

    try {
      await action(formData);

      window.location.href =
        "/sbs-admin/discounts";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong.",
      );

      setSubmitting(false);
    }
  }

  /*
   * --------------------------------------------------------
   * SAFE SELECT HANDLERS
   * --------------------------------------------------------
   */

  function handleDiscountTypeChange(
    value: string,
  ) {
    if (
      value === "percentage" ||
      value === "fixed"
    ) {
      setDiscountType(value);
    }
  }

  function handleDurationTypeChange(
    value: string,
  ) {
    const allowed: DurationType[] =
      [
        "one_time",
        "one_month",
        "three_months",
        "six_months",
        "twelve_months",
        "lifetime",
        "custom",
      ];

    if (
      allowed.includes(
        value as DurationType,
      )
    ) {
      setDurationType(
        value as DurationType,
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* ====================================================
          BACKDROP
          ==================================================== */}

      <Link
        href="/sbs-admin/discounts"
        aria-label="Close"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
      />

      {/* ====================================================
          MODAL WRAPPER
          ==================================================== */}

      <div className="relative flex min-h-full items-center justify-center p-4 sm:p-6">
        {/* ==================================================
            MODAL
            ================================================== */}

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="discount-form-title"
          className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        >
          {/* =================================================
              HEADER
              ================================================= */}

          <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-5 sm:px-7">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Gift className="h-5 w-5" />
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Revenue Management
                </div>

                <h2
                  id="discount-form-title"
                  className="mt-1 text-xl font-bold tracking-tight text-slate-950"
                >
                  {isEdit
                    ? "Edit Discount"
                    : "Create Discount"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Configure the offer,
                  duration, targeting and
                  usage rules.
                </p>
              </div>
            </div>

            <Link
              href="/sbs-admin/discounts"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title="Close"
            >
              <X className="h-5 w-5" />
            </Link>
          </div>

          {/* =================================================
              BODY
              ================================================= */}

          <div className="overflow-y-auto px-6 py-6 sm:px-7">
            <form
              action={handleSubmit}
              className="space-y-7"
            >
              {/* EDIT ID */}

              {discount ? (
                <input
                  type="hidden"
                  name="id"
                  value={discount.id}
                />
              ) : null}

              {/* ERROR */}

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              ) : null}

              {/* =================================================
                  BASIC INFORMATION
                  ================================================= */}

              <section>
                <SectionTitle
                  title="Basic information"
                  description="Set the identity and value of the discount."
                />

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <Field
                    label="Discount name"
                    description="Internal name used by the SBS team."
                  >
                    <input
                      required
                      name="name"
                      defaultValue={
                        discount?.name ??
                        ""
                      }
                      placeholder="Early Customer Discount"
                      className="input"
                    />
                  </Field>

                  <Field
                    label="Promo code"
                    description="Optional code customers can enter."
                  >
                    <input
                      name="code"
                      defaultValue={
                        discount?.code ??
                        ""
                      }
                      placeholder="WELCOME25"
                      autoComplete="off"
                      className="input font-mono uppercase"
                    />
                  </Field>

                  <Field
                    label="Discount type"
                    description="Choose percentage or fixed amount."
                  >
                    <select
                      name="discount_type"
                      value={
                        discountType
                      }
                      onChange={(event) =>
                        handleDiscountTypeChange(
                          event.target
                            .value,
                        )
                      }
                      className="input"
                    >
                      <option value="percentage">
                        Percentage
                      </option>

                      <option value="fixed">
                        Fixed amount
                      </option>
                    </select>
                  </Field>

                  <Field
                    label="Discount value"
                    description={
                      discountType ===
                      "percentage"
                        ? "Any value from 0% to 100%."
                        : "Amount removed from the subscription price."
                    }
                  >
                    <div className="relative">
                      <input
                        required
                        type="number"
                        name="discount_value"
                        min="0"
                        max={
                          discountType ===
                          "percentage"
                            ? "100"
                            : undefined
                        }
                        step="0.01"
                        defaultValue={
                          discount?.discount_value ??
                          ""
                        }
                        placeholder={
                          discountType ===
                          "percentage"
                            ? "25"
                            : "50"
                        }
                        className="input pr-12"
                      />

                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                        {discountType ===
                        "percentage"
                          ? "%"
                          : "$"}
                      </span>
                    </div>
                  </Field>
                </div>
              </section>

              {/* =================================================
                  TARGETING
                  ================================================= */}

              <section>
                <SectionTitle
                  title="Targeting"
                  description="Decide who can receive this discount."
                />

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <Field
                    label="Company"
                    description="Leave as all companies for a platform-wide offer."
                  >
                    <select
                      name="company_id"
                      defaultValue={
                        discount?.company_id ??
                        ""
                      }
                      className="input"
                    >
                      <option value="">
                        All companies
                      </option>

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
                            {
                              company.name
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </Field>

                  <Field
                    label="Plan"
                    description="Restrict the offer to a specific SBS plan."
                  >
                    <select
                      name="plan_id"
                      defaultValue={
                        discount?.plan_id ??
                        ""
                      }
                      className="input"
                    >
                      <option value="">
                        All plans
                      </option>

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
                        ),
                      )}
                    </select>
                  </Field>
                </div>
              </section>

              {/* =================================================
                  DURATION & BILLING
                  ================================================= */}

              <section>
                <SectionTitle
                  title="Duration & billing"
                  description="Control how long and on which billing cycle the discount applies."
                />

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <Field
                    label="Discount duration"
                    description="Lifetime, fixed subscription period or custom."
                  >
                    <select
                      name="duration_type"
                      value={
                        durationType
                      }
                      onChange={(event) =>
                        handleDurationTypeChange(
                          event.target
                            .value,
                        )
                      }
                      className="input"
                    >
                      <option value="one_time">
                        One time
                      </option>

                      <option value="one_month">
                        1 month
                      </option>

                      <option value="three_months">
                        3 months
                      </option>

                      <option value="six_months">
                        6 months
                      </option>

                      <option value="twelve_months">
                        12 months
                      </option>

                      <option value="lifetime">
                        Lifetime
                      </option>

                      <option value="custom">
                        Custom duration
                      </option>
                    </select>
                  </Field>

                  <Field
                    label="Billing cycle"
                    description="Choose which billing cycle receives the discount."
                  >
                    <select
                      name="billing_cycle"
                      defaultValue={
                        discount?.billing_cycle ??
                        ""
                      }
                      className="input"
                    >
                      <option value="">
                        Monthly + Yearly
                      </option>

                      <option value="monthly">
                        Monthly only
                      </option>

                      <option value="yearly">
                        Yearly only
                      </option>
                    </select>
                  </Field>

                  {/* CUSTOM DURATION */}

                  {durationType ===
                  "custom" ? (
                    <>
                      <Field
                        label="Custom duration"
                        description="Enter the number of days, weeks, months or years."
                      >
                        <input
                          type="number"
                          name="duration_value"
                          min="1"
                          step="1"
                          required
                          defaultValue={
                            discount?.duration_value ??
                            ""
                          }
                          placeholder="90"
                          className="input"
                        />
                      </Field>

                      <Field
                        label="Duration unit"
                        description="Select the unit for the custom duration."
                      >
                        <select
                          name="duration_unit"
                          defaultValue={
                            discount?.duration_unit ??
                            "days"
                          }
                          required
                          className="input"
                        >
                          <option value="days">
                            Days
                          </option>

                          <option value="weeks">
                            Weeks
                          </option>

                          <option value="months">
                            Months
                          </option>

                          <option value="years">
                            Years
                          </option>
                        </select>
                      </Field>
                    </>
                  ) : (
                    <>
                      <input
                        type="hidden"
                        name="duration_value"
                        value=""
                      />

                      <input
                        type="hidden"
                        name="duration_unit"
                        value=""
                      />
                    </>
                  )}
                </div>
              </section>

              {/* =================================================
                  SCHEDULE & USAGE
                  ================================================= */}

              <section>
                <SectionTitle
                  title="Schedule & usage"
                  description="Control when the discount starts, ends and how many times it can be used."
                />

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <Field
                    label="Starts at"
                    description="Leave blank to start immediately."
                  >
                    <input
                      type="datetime-local"
                      name="starts_at"
                      defaultValue={
                        startsAtValue
                      }
                      className="input"
                    />
                  </Field>

                  <Field
                    label="Expires at"
                    description="Leave blank for no expiration."
                  >
                    <input
                      type="datetime-local"
                      name="expires_at"
                      defaultValue={
                        expiresAtValue
                      }
                      className="input"
                    />
                  </Field>

                  <Field
                    label="Maximum redemptions"
                    description="Leave blank for unlimited usage."
                  >
                    <input
                      type="number"
                      name="max_redemptions"
                      min="1"
                      step="1"
                      defaultValue={
                        discount?.max_redemptions ??
                        ""
                      }
                      placeholder="100"
                      className="input"
                    />
                  </Field>

                  <Field
                    label="Reason / internal note"
                    description="Keep an internal record of why the discount was created."
                  >
                    <input
                      name="reason"
                      defaultValue={
                        discount?.reason ??
                        ""
                      }
                      placeholder="Early customer / partner / founder offer"
                      className="input"
                    />
                  </Field>
                </div>
              </section>

              {/* =================================================
                  FLEXIBLE ENGINE NOTICE
                  ================================================= */}

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Zap className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-emerald-900">
                      Flexible discount engine
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-emerald-700/80">
                      Create anything from a
                      one-time percentage
                      discount to a lifetime
                      customer deal or a
                      completely custom
                      duration.
                    </p>
                  </div>
                </div>
              </div>

              {/* =================================================
                  FOOTER
                  ================================================= */}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <Link
                  href="/sbs-admin/discounts"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={
                    submitting
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    "Saving..."
                  ) : isEdit ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Gift className="h-4 w-4" />
                      Create Discount
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ======================================================
          GLOBAL INPUT STYLES
          ====================================================== */}

      <style jsx global>{`
        .input {
          width: 100%;
          height: 44px;
          border-radius: 12px;
          border: 1px solid rgb(226 232 240);
          background: rgb(248 250 252);
          padding: 0 14px;
          font-size: 14px;
          line-height: 20px;
          color: rgb(15 23 42);
          outline: none;
          transition:
            border-color 150ms ease,
            background-color 150ms ease,
            box-shadow 150ms ease;
        }

        .input::placeholder {
          color: rgb(148 163 184);
        }

        .input:hover {
          border-color: rgb(203 213 225);
          background: rgb(255 255 255);
        }

        .input:focus {
          border-color: rgb(16 185 129);
          background: rgb(255 255 255);
          box-shadow:
            0 0 0 4px
            rgb(16 185 129 / 0.1);
        }

        select.input {
          cursor: pointer;
        }

        input[type="datetime-local"].input {
          color-scheme: light;
        }

        input[type="number"].input {
          appearance: textfield;
        }

        input[type="number"].input::-webkit-inner-spin-button,
        input[type="number"].input::-webkit-outer-spin-button {
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   SECTION TITLE
   ============================================================ */

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-slate-100 pb-3">
      <h3 className="text-sm font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>
    </div>
  );
}

/* ============================================================
   FIELD
   ============================================================ */

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block">
        <div className="text-sm font-semibold text-slate-800">
          {label}
        </div>

        <div className="mt-1 text-xs leading-5 text-slate-400">
          {description}
        </div>

        <div className="mt-2">
          {children}
        </div>
      </label>
    </div>
  );
}