"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type BillingCycle = "monthly" | "yearly";

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

type PlanModule = {
  plan_id: string;
  modules:
    | {
        name: string;
        slug: string;
      }
    | null;
};

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const supabase = useMemo(() => createClient(), []);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [modules, setModules] = useState<string[]>([]);
  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>("monthly");

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadBilling() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        const urlPlan =
          searchParams.get("plan")?.trim().toLowerCase() ?? "";

        const metadataPlan =
          typeof user.user_metadata?.selected_plan_slug ===
          "string"
            ? user.user_metadata.selected_plan_slug
                .trim()
                .toLowerCase()
            : "";

        const selectedPlanSlug =
          urlPlan || metadataPlan;

        if (!selectedPlanSlug) {
          router.replace("/plans");
          return;
        }

        const {
          data: planData,
          error: planError,
        } = await supabase
          .from("plans")
          .select(
            `
              id,
              name,
              slug,
              description,
              monthly_price,
              yearly_price,
              currency,
              is_active,
              is_popular,
              sort_order
            `
          )
          .eq("slug", selectedPlanSlug)
          .eq("is_active", true)
          .maybeSingle();

        if (planError) {
          throw new Error(planError.message);
        }

        if (!planData) {
          router.replace("/plans");
          return;
        }

        const {
          data: moduleData,
          error: moduleError,
        } = await supabase
          .from("plan_modules")
          .select(
            `
              plan_id,
              modules (
                name,
                slug
              )
            `
          )
          .eq("plan_id", planData.id);

        if (moduleError) {
          throw new Error(moduleError.message);
        }

        const moduleNames = (
          (moduleData ?? []) as unknown as PlanModule[]
        )
          .filter((item) => item.modules)
          .map((item) => item.modules!.name);

        if (!mounted) {
          return;
        }

        setPlan(planData as Plan);
        setModules(moduleNames);
        setLoading(false);
      } catch (loadError) {
        console.error(
          "Billing page error:",
          loadError
        );

        if (!mounted) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load billing information."
        );

        setLoading(false);
      }
    }

    loadBilling();

    return () => {
      mounted = false;
    };
  }, [router, searchParams, supabase]);

  async function handlePayPalCheckout() {
    if (!plan || processing) {
      return;
    }

    setError("");
    setProcessing(true);

    try {
      const response = await fetch(
        "/api/paypal/create-subscription",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planSlug: plan.slug,
            billingCycle,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to start PayPal checkout."
        );
      }

      if (!result?.approvalUrl) {
        throw new Error(
          "PayPal did not return an approval URL."
        );
      }

      window.location.href = result.approvalUrl;
    } catch (checkoutError) {
      console.error(
        "PayPal checkout error:",
        checkoutError
      );

      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to start PayPal checkout."
      );

      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.billingPage}>
        <div
          className={styles.background}
          aria-hidden="true"
        >
          <div
            className={`${styles.paper} ${styles.paperOne}`}
          />
          <div
            className={`${styles.paper} ${styles.paperTwo}`}
          />
          <div
            className={`${styles.circle} ${styles.circleOne}`}
          />
          <div
            className={`${styles.circle} ${styles.circleTwo}`}
          />
        </div>

        <div className={styles.loadingScreen}>
          <span
            className={styles.loadingSpinner}
            aria-hidden="true"
          />

          <span>
            Preparing your secure checkout...
          </span>
        </div>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className={styles.billingPage}>
        <div className={styles.errorPage}>
          <div className={styles.errorIcon}>!</div>

          <h1>Billing information unavailable</h1>

          <p>
            We could not load your selected plan.
            Please return to pricing and try again.
          </p>

          <Link
            href="/plans"
            className={styles.primaryButton}
          >
            Return to plans
          </Link>
        </div>
      </main>
    );
  }

  const isEnterprise =
    plan.slug === "enterprise";

  const price =
    billingCycle === "monthly"
      ? plan.monthly_price
      : plan.yearly_price;

  const monthlyEquivalent =
    billingCycle === "yearly" &&
    plan.yearly_price !== null
      ? plan.yearly_price / 12
      : null;

  const savings =
    plan.monthly_price !== null &&
    plan.yearly_price !== null
      ? plan.monthly_price * 12 - plan.yearly_price
      : null;

  return (
    <main className={styles.billingPage}>
      {/* Background */}
      <div
        className={styles.background}
        aria-hidden="true"
      >
        <div
          className={`${styles.paper} ${styles.paperOne}`}
        />

        <div
          className={`${styles.paper} ${styles.paperTwo}`}
        />

        <div
          className={`${styles.paper} ${styles.paperThree}`}
        />

        <div
          className={`${styles.circle} ${styles.circleOne}`}
        />

        <div
          className={`${styles.circle} ${styles.circleTwo}`}
        />

        <div
          className={`${styles.dotField} ${styles.dotFieldOne}`}
        />

        <div
          className={`${styles.dotField} ${styles.dotFieldTwo}`}
        />
      </div>

      {/* Header */}
      <header className={styles.header}>
        <Link
          href="/"
          className={styles.brand}
        >
          <Image
            src="/sbs-logo-black.png"
            alt="Sharif Business Solutions"
            width={190}
            height={43}
            priority
            className={styles.brandLogo}
          />

          <div className={styles.brandText}>
            <span className={styles.brandName}>
              SHARIF BUSINESS SOLUTIONS
            </span>

            <span className={styles.brandTagline}>
              Business Management Platform
            </span>
          </div>
        </Link>

        <div className={styles.headerStatus}>
          <span className={styles.statusDot} />
          Secure checkout
        </div>
      </header>

      {/* Progress */}
      <div className={styles.progressArea}>
        <div className={styles.progressStep}>
          <span className={styles.progressComplete}>
            ✓
          </span>

          <span>Account</span>
        </div>

        <div className={styles.progressLine} />

        <div className={styles.progressStep}>
          <span className={styles.progressComplete}>
            ✓
          </span>

          <span>Business</span>
        </div>

        <div className={styles.progressLine} />

        <div className={styles.progressStep}>
          <span className={styles.progressActive}>
            3
          </span>

          <span>Billing</span>
        </div>
      </div>

      {/* Main */}
      <section className={styles.content}>
        {/* Intro */}
        <div className={styles.intro}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            Workspace activation
          </div>

          <h1>
            Activate your
            <br />
            <span>SBS workspace.</span>
          </h1>

          <p>
            Your business information is ready. Choose your
            billing cycle below and complete your secure
            subscription through PayPal.
          </p>

          <div className={styles.trustList}>
            <div className={styles.trustItem}>
              <span className={styles.trustIcon}>
                ✓
              </span>

              <span>
                Secure payment processing
              </span>
            </div>

            <div className={styles.trustItem}>
              <span className={styles.trustIcon}>
                ✓
              </span>

              <span>
                Cancel or manage your subscription
              </span>
            </div>

            <div className={styles.trustItem}>
              <span className={styles.trustIcon}>
                ✓
              </span>

              <span>
                Business data stays with SBS
              </span>
            </div>
          </div>
        </div>

        {/* Billing Card */}
        <div className={styles.billingCard}>
          <div className={styles.cardAccent} />

          <div className={styles.cardContent}>
            {/* Card heading */}
            <div className={styles.cardHeading}>
              <div>
                <span className={styles.cardEyebrow}>
                  Selected plan
                </span>

                <h2>{plan.name}</h2>

                <p>
                  {plan.description ??
                    "Business management tools for your business."}
                </p>
              </div>

              {plan.is_popular && (
                <span className={styles.popularBadge}>
                  Most popular
                </span>
              )}
            </div>

            {/* Billing toggle */}
            {!isEnterprise && (
              <div className={styles.billingSection}>
                <div className={styles.sectionHeading}>
                  <div>
                    <strong>
                      Choose your billing cycle
                    </strong>

                    <span>
                      Change this anytime from your billing
                      settings.
                    </span>
                  </div>

                  {savings !== null &&
                    savings > 0 && (
                      <span className={styles.savingsBadge}>
                        Save{" "}
                        {formatPrice(
                          savings,
                          plan.currency
                        )}{" "}
                        / year
                      </span>
                    )}
                </div>

                <div className={styles.billingToggle}>
                  <button
                    type="button"
                    className={
                      billingCycle === "monthly"
                        ? styles.billingOptionActive
                        : styles.billingOption
                    }
                    onClick={() =>
                      setBillingCycle("monthly")
                    }
                    disabled={processing}
                  >
                    <span>
                      <strong>Monthly</strong>
                      <small>
                        {formatPrice(
                          plan.monthly_price,
                          plan.currency
                        )}{" "}
                        / month
                      </small>
                    </span>

                    <span
                      className={
                        styles.radioCircle
                      }
                    >
                      {billingCycle === "monthly" && (
                        <span
                          className={
                            styles.radioDot
                          }
                        />
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={
                      billingCycle === "yearly"
                        ? styles.billingOptionActive
                        : styles.billingOption
                    }
                    onClick={() =>
                      setBillingCycle("yearly")
                    }
                    disabled={processing}
                  >
                    <span>
                      <strong>
                        Yearly
                        {savings !== null &&
                          savings > 0 && (
                            <em>
                              Save{" "}
                              {formatPrice(
                                savings,
                                plan.currency
                              )}
                            </em>
                          )}
                      </strong>

                      <small>
                        {formatPrice(
                          plan.yearly_price,
                          plan.currency
                        )}{" "}
                        / year
                      </small>
                    </span>

                    <span
                      className={
                        styles.radioCircle
                      }
                    >
                      {billingCycle === "yearly" && (
                        <span
                          className={
                            styles.radioDot
                          }
                        />
                      )}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Price summary */}
            <div className={styles.priceSummary}>
              <div>
                <span className={styles.summaryLabel}>
                  {isEnterprise
                    ? "Subscription"
                    : billingCycle === "monthly"
                    ? "Monthly subscription"
                    : "Yearly subscription"}
                </span>

                {monthlyEquivalent !== null && (
                  <span
                    className={
                      styles.summarySubtext
                    }
                  >
                    Equivalent to{" "}
                    {formatPrice(
                      monthlyEquivalent,
                      plan.currency
                    )}{" "}
                    / month
                  </span>
                )}
              </div>

              <div className={styles.summaryPrice}>
                {isEnterprise ? (
                  <strong>Custom</strong>
                ) : (
                  <>
                    <strong>
                      {formatPrice(
                        price,
                        plan.currency
                      )}
                    </strong>

                    <span>
                      {plan.currency}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className={styles.divider} />

            {/* Features */}
            <div className={styles.featuresSection}>
              <div className={styles.featuresHeading}>
                Your workspace includes
              </div>

              <div className={styles.featuresGrid}>
                {modules.length > 0 ? (
                  modules.map((moduleName) => (
                    <div
                      key={moduleName}
                      className={styles.feature}
                    >
                      <span
                        className={
                          styles.featureCheck
                        }
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path d="m5 12 4 4L19 6" />
                        </svg>
                      </span>

                      <span>{moduleName}</span>
                    </div>
                  ))
                ) : (
                  <div
                    className={styles.feature}
                  >
                    <span
                      className={
                        styles.featureCheck
                      }
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    </span>

                    <span>
                      Business management tools
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className={styles.errorBox}
                role="alert"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                  />

                  <path d="M12 8v5" />

                  <path d="M12 16.5h.01" />
                </svg>

                <span>{error}</span>
              </div>
            )}

            {/* PayPal */}
            {!isEnterprise ? (
              <div className={styles.checkoutArea}>
                <button
                  type="button"
                  className={
                    styles.paypalButton
                  }
                  onClick={
                    handlePayPalCheckout
                  }
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <span
                        className={
                          styles.buttonSpinner
                        }
                        aria-hidden="true"
                      />

                      <span>
                        Preparing secure checkout...
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className={
                          styles.paypalLogo
                        }
                      >
                        P
                      </span>

                      <span>
                        Continue with PayPal
                      </span>

                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14" />
                        <path d="m13 6 6 6-6 6" />
                      </svg>
                    </>
                  )}
                </button>

                <p className={styles.checkoutNote}>
                  You&apos;ll be redirected to PayPal to
                  securely approve your subscription.
                </p>
              </div>
            ) : (
              <div className={styles.enterpriseArea}>
                <Link
                  href="/contact"
                  className={styles.paypalButton}
                >
                  <span>
                    Contact our team
                  </span>

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </Link>
              </div>
            )}

            {/* Change plan */}
            <div className={styles.changePlan}>
              <Link href="/plans">
                ← Change plan
              </Link>

              <span>
                No charge is processed until you approve
                the PayPal subscription.
              </span>
            </div>

            {/* Provider */}
            <div className={styles.providerNote}>
              <div className={styles.providerIcon}>
                <span>P</span>
              </div>

              <div>
                <strong>
                  Securely processed by PayPal
                </strong>

                <span>
                  SBS does not store your PayPal payment
                  credentials.
                </span>
              </div>

              <span
                className={
                  styles.providerStatus
                }
              >
                Secure
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>
          © {new Date().getFullYear()} Sharif Business
          Solutions. All rights reserved.
        </span>

        <div className={styles.footerLinks}>
          <Link href="/">Website</Link>

          <span>•</span>

          <Link href="/privacy">Privacy</Link>

          <span>•</span>

          <Link href="/terms">Terms</Link>
        </div>
      </footer>
    </main>
  );
}

function formatPrice(
  price: number | null,
  currency: string
) {
  if (price === null || price === undefined) {
    return "—";
  }

  return Number(price).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  );
}