"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Crown,
  FileText,
  Mail,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  currency: string;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
};

type Subscription = {
  id: string;
  company_id: string;
  plan_id: string;
  status: string;
  billing_cycle: "monthly" | "yearly";
  amount: number;
  currency: string;
  started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
};

type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  tax_registration_number: string | null;
  billing_contact_name: string | null;
  billing_email: string | null;
  billing_phone: string | null;
};

type Payment = {
  id: string;
  company_id: string;
  subscription_id: string | null;
  provider: string;
  provider_transaction_id: string | null;
  provider_order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_type: string;
  payment_method: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  failure_reason: string | null;
  created_at: string;
  plan_name: string | null;
};

type BillingPayload = {
  company: Company;
  subscription: Subscription | null;
  plan: Plan | null;
  plans: Plan[];
  payments: Payment[];
  role: string;
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(
  amount: number | null,
  currency = "USD",
) {
  if (amount === null || amount === undefined) {
    return "Custom";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function statusLabel(status: string) {
  switch (status) {
    case "trialing":
      return "Free trial";

    case "active":
      return "Active";

    case "pending":
      return "Awaiting payment";

    case "approved":
      return "Active";

    case "past_due":
      return "Past due";

    case "paused":
      return "Paused";

    case "canceled":
      return "Canceled";

    case "failed":
      return "Payment failed";

    default:
      return status.replaceAll("_", " ");
  }
}

function statusClass(status: string) {
  switch (status) {
    case "trialing":
      return styles.statusTrial;

    case "active":
    case "approved":
      return styles.statusActive;

    case "past_due":
    case "failed":
      return styles.statusDanger;

    case "pending":
      return styles.statusPending;

    default:
      return styles.statusNeutral;
  }
}

export default function BillingSettingsPage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [saving, setSaving] = useState(false);

  const [data, setData] =
    useState<BillingPayload | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [billingContactName, setBillingContactName] =
    useState("");

  const [billingEmail, setBillingEmail] =
    useState("");

  const [billingPhone, setBillingPhone] =
    useState("");

  const [addressLine1, setAddressLine1] =
    useState("");

  const [addressLine2, setAddressLine2] =
    useState("");

  const [city, setCity] =
    useState("");

  const [state, setState] =
    useState("");

  const [postalCode, setPostalCode] =
    useState("");

  const [country, setCountry] =
    useState("");

  const [taxRegistrationNumber, setTaxRegistrationNumber] =
    useState("");

  const [billingCycle, setBillingCycle] =
    useState<"monthly" | "yearly">("monthly");

  const [selectedPlan, setSelectedPlan] =
    useState("");

  const [checkoutLoading, setCheckoutLoading] =
    useState("");

  const loadBilling = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const {
          data: billingData,
          error: billingError,
        } = await supabase.rpc(
          "get_my_company_billing",
        );

        if (billingError) {
          throw new Error(
            billingError.message,
          );
        }

        if (!billingData) {
          throw new Error(
            "Unable to load billing information.",
          );
        }

        const payload =
          billingData as BillingPayload;

        setData(payload);

        const company =
          payload.company;

        setBillingContactName(
          company.billing_contact_name ??
            "",
        );

        setBillingEmail(
          company.billing_email ??
            company.email ??
            "",
        );

        setBillingPhone(
          company.billing_phone ??
            company.phone ??
            "",
        );

        setAddressLine1(
          company.address_line1 ?? "",
        );

        setAddressLine2(
          company.address_line2 ?? "",
        );

        setCity(company.city ?? "");
        setState(company.state ?? "");
        setPostalCode(
          company.postal_code ?? "",
        );

        setCountry(
          company.country ?? "",
        );

        setTaxRegistrationNumber(
          company.tax_registration_number ??
            "",
        );

        if (payload.subscription) {
          setBillingCycle(
            payload.subscription.billing_cycle,
          );
        }

        if (payload.plan) {
          setSelectedPlan(
            payload.plan.slug,
          );
        }
      } catch (loadError) {
        console.error(
          "Billing load error:",
          loadError,
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load billing information.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  async function saveBillingInformation() {
    if (saving) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const {
        error: saveError,
      } = await supabase.rpc(
        "update_my_company_billing",
        {
          p_billing_contact_name:
            billingContactName.trim(),

          p_billing_email:
            billingEmail.trim(),

          p_billing_phone:
            billingPhone.trim(),

          p_address_line1:
            addressLine1.trim(),

          p_address_line2:
            addressLine2.trim(),

          p_city:
            city.trim(),

          p_state:
            state.trim(),

          p_postal_code:
            postalCode.trim(),

          p_country:
            country.trim(),

          p_tax_registration_number:
            taxRegistrationNumber.trim(),
        },
      );

      if (saveError) {
        throw new Error(
          saveError.message,
        );
      }

      setSuccess(
        "Billing information saved successfully.",
      );

      await loadBilling(true);
    } catch (saveError) {
      console.error(
        "Billing save error:",
        saveError,
      );

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save billing information.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function startCheckout(
    plan: Plan,
  ) {
    if (
      checkoutLoading ||
      plan.slug === "enterprise"
    ) {
      return;
    }

    try {
      setCheckoutLoading(plan.slug);
      setError("");

      const response = await fetch(
        "/api/paypal/create-subscription",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            planSlug: plan.slug,
            billingCycle,
          }),
        },
      );

      const result =
        (await response.json()) as {
          error?: string;
          approvalUrl?: string;
        };

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Unable to start checkout.",
        );
      }

      if (!result.approvalUrl) {
        throw new Error(
          "PayPal did not return a checkout URL.",
        );
      }

      window.location.href =
        result.approvalUrl;
    } catch (checkoutError) {
      console.error(
        "Billing checkout error:",
        checkoutError,
      );

      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to start checkout.",
      );

      setCheckoutLoading("");
    }
  }

  const subscription =
    data?.subscription ?? null;

  const currentPlan =
    data?.plan ?? null;

  const isTrial =
    subscription?.status === "trialing";

  const canManageBilling =
    data?.role === "owner" ||
    data?.role === "admin";

  const trialDaysRemaining =
  subscription?.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(
            subscription.trial_ends_at,
          ).getTime() -
            Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : 0;

const trialTotalDays =
  subscription?.started_at &&
  subscription?.trial_ends_at
    ? Math.max(
        1,
        Math.ceil(
          (new Date(
            subscription.trial_ends_at,
          ).getTime() -
            new Date(
              subscription.started_at,
            ).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : 14;

  if (loading) {
    return (
      <AppShell>
        <div className={styles.loading}>
          <RefreshCw
            size={22}
            className={styles.spin}
          />

          <span>
            Loading billing information...
          </span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              type="button"
              className={styles.backButton}
              onClick={() =>
                router.push("/settings")
              }
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <div
                className={styles.eyebrow}
              >
                SETTINGS
              </div>

              <h1>Billing & Subscription</h1>

              <p>
                Manage your SBS subscription,
                billing information and payment
                history.
              </p>
            </div>
          </div>

          <button
            type="button"
            className={styles.refreshButton}
            onClick={() =>
              loadBilling(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? styles.spin
                  : ""
              }
            />

            Refresh
          </button>
        </header>

        {error && (
          <div
            className={styles.errorBanner}
            role="alert"
          >
            <span>!</span>
            {error}
          </div>
        )}

        {success && (
          <div
            className={styles.successBanner}
            role="status"
          >
            <Check size={17} />
            {success}
          </div>
        )}

        {isTrial && (
          <section
            className={styles.trialBanner}
          >
            <div
              className={styles.trialIcon}
            >
              <Crown size={22} />
            </div>

            <div
              className={styles.trialContent}
            >
              <strong>
  You&apos;re on your {trialTotalDays}-day
  free trial
</strong>

              <span>
                {trialDaysRemaining > 0
                  ? `${trialDaysRemaining} ${
                      trialDaysRemaining ===
                      1
                        ? "day"
                        : "days"
                    } remaining`
                  : "Your trial ends today"}
                . No payment has been
                charged.
              </span>
            </div>

            <div
              className={styles.trialDate}
            >
              Trial ends
              <strong>
                {formatDate(
                  subscription?.trial_ends_at ??
                    null,
                )}
              </strong>
            </div>
          </section>
        )}

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div
              className={styles.statIcon}
            >
              <Crown size={19} />
            </div>

            <div>
              <span>Current plan</span>

              <strong>
                {currentPlan?.name ??
                  "No plan"}
              </strong>
            </div>
          </div>

          <div className={styles.statCard}>
            <div
              className={styles.statIcon}
            >
              <ShieldCheck size={19} />
            </div>

            <div>
              <span>Status</span>

              <strong
                className={
                  styles.statStatus
                }
              >
                {subscription
                  ? statusLabel(
                      subscription.status,
                    )
                  : "Not subscribed"}
              </strong>
            </div>
          </div>

          <div className={styles.statCard}>
            <div
              className={styles.statIcon}
            >
              <CreditCard size={19} />
            </div>

            <div>
              <span>Billing cycle</span>

              <strong>
                {subscription
                  ? subscription.billing_cycle ===
                    "yearly"
                    ? "Yearly"
                    : "Monthly"
                  : "—"}
              </strong>
            </div>
          </div>

          <div className={styles.statCard}>
            <div
              className={styles.statIcon}
            >
              <FileText size={19} />
            </div>

            <div>
              <span>Current price</span>

              <strong>
                {subscription
                  ? isTrial
                    ? "Free"
                    : formatMoney(
                        Number(
                          subscription.amount,
                        ),
                        subscription.currency,
                      )
                  : "—"}
              </strong>
            </div>
          </div>
        </div>

        <div className={styles.mainGrid}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Billing information</h2>

                <p>
                  This information is used for
                  your SBS billing records.
                </p>
              </div>

              <div
                className={
                  styles.headerIcon
                }
              >
                <FileText size={19} />
              </div>
            </div>

            <div className={styles.formGrid}>
              <div
                className={
                  styles.fieldFull
                }
              >
                <label>
                  Billing contact name
                </label>

                <input
                  value={
                    billingContactName
                  }
                  onChange={(event) =>
                    setBillingContactName(
                      event.target.value,
                    )
                  }
                  placeholder="Billing contact"
                  disabled={
                    !canManageBilling ||
                    saving
                  }
                />
              </div>

              <div className={styles.field}>
                <label>Billing email</label>

                <div
                  className={
                    styles.inputWithIcon
                  }
                >
                  <Mail size={16} />

                  <input
                    value={billingEmail}
                    onChange={(event) =>
                      setBillingEmail(
                        event.target.value,
                      )
                    }
                    type="email"
                    placeholder="billing@company.com"
                    disabled={
                      !canManageBilling ||
                      saving
                    }
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label>Billing phone</label>

                <div
                  className={
                    styles.inputWithIcon
                  }
                >
                  <Phone size={16} />

                  <input
                    value={billingPhone}
                    onChange={(event) =>
                      setBillingPhone(
                        event.target.value,
                      )
                    }
                    type="tel"
                    placeholder="+971..."
                    disabled={
                      !canManageBilling ||
                      saving
                    }
                  />
                </div>
              </div>

              <div
                className={
                  styles.fieldFull
                }
              >
                <label>
                  Address line 1
                </label>

                <input
                  value={addressLine1}
                  onChange={(event) =>
                    setAddressLine1(
                      event.target.value,
                    )
                  }
                  placeholder="Street and building"
                  disabled={
                    !canManageBilling ||
                    saving
                  }
                />
              </div>

              <div
                className={
                  styles.fieldFull
                }
              >
                <label>
                  Address line 2
                  <span>Optional</span>
                </label>

                <input
                  value={addressLine2}
                  onChange={(event) =>
                    setAddressLine2(
                      event.target.value,
                    )
                  }
                  placeholder="Suite, floor, unit"
                  disabled={
                    !canManageBilling ||
                    saving
                  }
                />
              </div>

              <div className={styles.field}>
                <label>City</label>

                <input
                  value={city}
                  onChange={(event) =>
                    setCity(
                      event.target.value,
                    )
                  }
                  placeholder="Dubai"
                  disabled={
                    !canManageBilling ||
                    saving
                  }
                />
              </div>

              <div className={styles.field}>
                <label>State / Province</label>

                <input
                  value={state}
                  onChange={(event) =>
                    setState(
                      event.target.value,
                    )
                  }
                  placeholder="Dubai"
                  disabled={
                    !canManageBilling ||
                    saving
                  }
                />
              </div>

              <div className={styles.field}>
                <label>Postal code</label>

                <input
                  value={postalCode}
                  onChange={(event) =>
                    setPostalCode(
                      event.target.value,
                    )
                  }
                  placeholder="00000"
                  disabled={
                    !canManageBilling ||
                    saving
                  }
                />
              </div>

              <div className={styles.field}>
                <label>Country</label>

                <input
                  value={country}
                  onChange={(event) =>
                    setCountry(
                      event.target.value,
                    )
                  }
                  placeholder="United Arab Emirates"
                  disabled={
                    !canManageBilling ||
                    saving
                  }
                />
              </div>

              <div
                className={
                  styles.fieldFull
                }
              >
                <label>
                  Tax / TRN number
                  <span>Optional</span>
                </label>

                <input
                  value={
                    taxRegistrationNumber
                  }
                  onChange={(event) =>
                    setTaxRegistrationNumber(
                      event.target.value,
                    )
                  }
                  placeholder="Tax registration number"
                  disabled={
                    !canManageBilling ||
                    saving
                  }
                />
              </div>
            </div>

            {canManageBilling && (
              <div
                className={
                  styles.cardFooter
                }
              >
                <button
                  type="button"
                  className={
                    styles.primaryButton
                  }
                  onClick={
                    saveBillingInformation
                  }
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw
                        size={16}
                        className={
                          styles.spin
                        }
                      />

                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save billing information
                    </>
                  )}
                </button>
              </div>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Subscription</h2>

                <p>
                  Your current SBS subscription.
                </p>
              </div>

              <div
                className={
                  styles.headerIcon
                }
              >
                <CreditCard size={19} />
              </div>
            </div>

            {subscription ? (
              <div
                className={
                  styles.subscriptionPanel
                }
              >
                <div
                  className={
                    styles.subscriptionTop
                  }
                >
                  <div>
                    <span
                      className={
                        styles.planLabel
                      }
                    >
                      CURRENT PLAN
                    </span>

                    <h3>
                      {currentPlan?.name ??
                        "SBS Plan"}
                    </h3>

                    <p>
                      {currentPlan?.description ??
                        "Business management platform subscription."}
                    </p>
                  </div>

                  <span
                    className={`${styles.statusBadge} ${statusClass(
                      subscription.status,
                    )}`}
                  >
                    {statusLabel(
                      subscription.status,
                    )}
                  </span>
                </div>

                <div
                  className={
                    styles.subscriptionDetails
                  }
                >
                  <div>
                    <span>Billing cycle</span>

                    <strong>
                      {subscription.billing_cycle ===
                      "yearly"
                        ? "Yearly"
                        : "Monthly"}
                    </strong>
                  </div>

                  <div>
                    <span>Price</span>

                    <strong>
                      {isTrial
                        ? "Free trial"
                        : formatMoney(
                            Number(
                              subscription.amount,
                            ),
                            subscription.currency,
                          )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {isTrial
                        ? "Trial ends"
                        : "Current period ends"}
                    </span>

                    <strong>
                      {formatDate(
                        isTrial
                          ? subscription.trial_ends_at
                          : subscription.current_period_end,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Payment provider</span>

                    <strong>
                      {subscription.provider
                        ? subscription.provider.toUpperCase()
                        : "Not connected"}
                    </strong>
                  </div>
                </div>

                {isTrial && (
                  <div
                    className={
                      styles.noPaymentNote
                    }
                  >
                    <ShieldCheck size={17} />

                    <span>
  No payment method is
  required during your
  {trialTotalDays}-day trial.
</span>
                  </div>
                )}
              </div>
            ) : (
              <div
                className={
                  styles.emptySubscription
                }
              >
                <CreditCard size={28} />

                <strong>
                  No active subscription
                </strong>

                <span>
                  Choose a plan below to
                  activate your SBS workspace.
                </span>
              </div>
            )}
          </section>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Available plans</h2>

              <p>
                Change your SBS plan whenever
                your business needs more.
              </p>
            </div>

            <div
              className={
                styles.cycleToggle
              }
            >
              <button
                type="button"
                className={
                  billingCycle === "monthly"
                    ? styles.cycleActive
                    : ""
                }
                onClick={() =>
                  setBillingCycle(
                    "monthly",
                  )
                }
              >
                Monthly
              </button>

              <button
                type="button"
                className={
                  billingCycle === "yearly"
                    ? styles.cycleActive
                    : ""
                }
                onClick={() =>
                  setBillingCycle(
                    "yearly",
                  )
                }
              >
                Yearly
                <span>Save</span>
              </button>
            </div>
          </div>

          <div className={styles.plansGrid}>
            {(data?.plans ?? []).map(
              (plan) => {
                const isCurrent =
                  currentPlan?.id === plan.id;

                const price =
                  billingCycle ===
                  "yearly"
                    ? plan.yearly_price
                    : plan.monthly_price;

                const disabled =
                  plan.slug ===
                    "enterprise" ||
                  isCurrent ||
                  Boolean(checkoutLoading);

                return (
                  <div
                    key={plan.id}
                    className={`${styles.planCard} ${
                      isCurrent
                        ? styles.planCurrent
                        : ""
                    } ${
                      plan.is_popular
                        ? styles.planPopular
                        : ""
                    }`}
                  >
                    {plan.is_popular && (
                      <div
                        className={
                          styles.popularBadge
                        }
                      >
                        MOST POPULAR
                      </div>
                    )}

                    <div
                      className={
                        styles.planTop
                      }
                    >
                      <div>
                        <h3>
                          {plan.name}
                        </h3>

                        <p>
                          {plan.description ??
                            "SBS business management tools."}
                        </p>
                      </div>

                      {isCurrent && (
                        <span
                          className={
                            styles.currentCheck
                          }
                        >
                          <Check size={15} />
                        </span>
                      )}
                    </div>

                    <div
                      className={
                        styles.planPrice
                      }
                    >
                      {price === null ? (
                        <>
                          <strong>
                            Custom
                          </strong>

                          <span>
                            Contact SBS
                          </span>
                        </>
                      ) : (
                        <>
                          <strong>
                            {formatMoney(
                              Number(price),
                              plan.currency,
                            )}
                          </strong>

                          <span>
                            /{" "}
                            {billingCycle ===
                            "yearly"
                              ? "year"
                              : "month"}
                          </span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      className={
                        isCurrent
                          ? styles.currentPlanButton
                          : styles.planButton
                      }
                      disabled={disabled}
                      onClick={() => {
                        setSelectedPlan(
                          plan.slug,
                        );

                        startCheckout(plan);
                      }}
                    >
                      {checkoutLoading ===
                      plan.slug ? (
                        <>
                          <RefreshCw
                            size={16}
                            className={
                              styles.spin
                            }
                          />

                          Opening PayPal...
                        </>
                      ) : isCurrent ? (
                        "Current plan"
                      ) : plan.slug ===
                        "enterprise" ? (
                        "Contact us"
                      ) : (
                        isTrial
                          ? "Subscribe to plan"
                          : "Choose plan"
                      )}
                    </button>

                    {isTrial &&
                      !isCurrent && (
                        <small
                          className={
                            styles.trialPlanNote
                          }
                        >
                          Your trial remains
                          active until you
                          subscribe.
                        </small>
                      )}
                  </div>
                );
              },
            )}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Payment history</h2>

              <p>
                Payments made for your SBS
                subscription.
              </p>
            </div>

            <div
              className={
                styles.headerIcon
              }
            >
              <CreditCard size={19} />
            </div>
          </div>

          {data?.payments?.length ? (
            <div
              className={
                styles.paymentTableWrap
              }
            >
              <table
                className={
                  styles.paymentTable
                }
              >
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {data.payments.map(
                    (payment) => (
                      <tr key={payment.id}>
                        <td>
                          {formatDateTime(
                            payment.paid_at ??
                              payment.created_at,
                          )}
                        </td>

                        <td>
                          <div
                            className={
                              styles.paymentDescription
                            }
                          >
                            <strong>
                              {payment.plan_name ??
                                "SBS subscription"}
                            </strong>

                            <span>
                              {payment.payment_type.replaceAll(
                                "_",
                                " ",
                              )}
                            </span>
                          </div>
                        </td>

                        <td>
                          {payment.provider.toUpperCase()}
                        </td>

                        <td>
                          <span
                            className={`${styles.statusBadge} ${statusClass(
                              payment.status,
                            )}`}
                          >
                            {statusLabel(
                              payment.status,
                            )}
                          </span>
                        </td>

                        <td
                          className={
                            styles.amountCell
                          }
                        >
                          {formatMoney(
                            Number(
                              payment.amount,
                            ),
                            payment.currency,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className={
                styles.emptyPayments
              }
            >
              <CreditCard size={25} />

              <strong>
                No payments yet
              </strong>

              <span>
                Your subscription payments
                will appear here once you
                subscribe to a paid plan.
              </span>
            </div>
          )}
        </section>

        <div className={styles.securityNote}>
          <ShieldCheck size={17} />

          <span>
            Billing information is protected
            and only workspace owners and
            administrators can change it.
          </span>
        </div>
      </div>
    </AppShell>
  );
}