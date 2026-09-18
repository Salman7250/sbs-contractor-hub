import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

type PlanModule = {
  plan_id: string;
  modules:
    | {
        name: string;
        slug: string;
      }
    | null;
};

export default async function PlansPage() {
  const supabase = await createClient();

  const [{ data: plansData, error: plansError }, { data: modulesData }] =
    await Promise.all([
      supabase
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
        .eq("is_active", true)
        .order("sort_order", {
          ascending: true,
        }),

      supabase
        .from("plan_modules")
        .select(
          `
            plan_id,
            modules (
              name,
              slug
            )
          `
        ),
    ]);

  const plans = (plansData ?? []) as Plan[];
  const planModules = (modulesData ?? []) as unknown as PlanModule[];

  const modulesByPlan = new Map<string, string[]>();

  for (const item of planModules) {
    if (!item.modules) {
      continue;
    }

    const existing = modulesByPlan.get(item.plan_id) ?? [];

    existing.push(item.modules.name);

    modulesByPlan.set(item.plan_id, existing);
  }

  return (
    <main className={styles.plansPage}>
      {/* Decorative background */}
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

        <div className={styles.headerActions}>
          <span className={styles.headerQuestion}>
            Already have an account?
          </span>

          <Link
            href="/login"
            className={styles.loginLink}
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Main */}
      <section className={styles.content}>
        {/* Intro */}
        <div className={styles.intro}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            Simple, transparent pricing
          </div>

          <h1>
            Choose the plan that
            <br />
            <span>fits your business.</span>
          </h1>

          <p>
            Start with the tools your business needs today and
            move to a more powerful workspace as your business
            grows.
          </p>

          <div className={styles.billingNote}>
            <div className={styles.billingIcon}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M12 3v18" />
                <path d="M17 7H9.5a2.5 2.5 0 0 0 0 5H15a2.5 2.5 0 0 1 0 5H6" />
              </svg>
            </div>

            <div>
              <strong>Flexible billing</strong>

              <span>
                Choose monthly or yearly billing during
                checkout.
              </span>
            </div>
          </div>
        </div>

        {/* Database error */}
        {plansError && (
          <div
            className={styles.errorBox}
            role="alert"
          >
            <div className={styles.errorIcon}>
              !
            </div>

            <div>
              <strong>
                Unable to load pricing plans
              </strong>

              <p>
                {plansError.message}
              </p>
            </div>
          </div>
        )}

        {/* Plans */}
        {!plansError && plans.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              $
            </div>

            <h2>No plans are currently available</h2>

            <p>
              Please check back shortly or contact SBS
              support.
            </p>
          </div>
        ) : (
          <div className={styles.plansGrid}>
            {plans.map((plan) => {
              const modules =
                modulesByPlan.get(plan.id) ?? [];

              const isEnterprise =
                plan.slug === "enterprise";

              return (
                <article
                  key={plan.id}
                  className={`${styles.planCard} ${
                    plan.is_popular
                      ? styles.popularCard
                      : ""
                  }`}
                >
                  {plan.is_popular && (
                    <div className={styles.popularBadge}>
                      Most popular
                    </div>
                  )}

                  <div className={styles.planCardTop}>
                    <div>
                      <div className={styles.planName}>
                        {plan.name}
                      </div>

                      <p className={styles.planDescription}>
                        {plan.description ??
                          "Business management tools for your team."}
                      </p>
                    </div>
                  </div>

                  <div className={styles.priceArea}>
                    {isEnterprise ? (
                      <>
                        <span className={styles.customPrice}>
                          Custom
                        </span>

                        <span className={styles.pricePeriod}>
                          Tailored to your organization
                        </span>
                      </>
                    ) : (
                      <>
                        <div className={styles.priceRow}>
                          <span className={styles.currency}>
                            {getCurrencySymbol(
                              plan.currency
                            )}
                          </span>

                          <span className={styles.price}>
                            {formatPrice(
                              plan.monthly_price
                            )}
                          </span>

                          <span className={styles.pricePeriod}>
                            / month
                          </span>
                        </div>

                        <div className={styles.yearlyPrice}>
                          {formatPrice(
                            plan.yearly_price
                          )}{" "}
                          {plan.currency} / year
                        </div>
                      </>
                    )}
                  </div>

                  <div className={styles.planDivider} />

                  <div className={styles.featuresHeading}>
                    Includes
                  </div>

                  <ul className={styles.features}>
                    {modules.length > 0 ? (
                      modules.map((moduleName) => (
                        <li
                          key={`${plan.id}-${moduleName}`}
                        >
                          <span
                            className={
                              styles.checkIcon
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
                        </li>
                      ))
                    ) : (
                      <li>
                        <span
                          className={
                            styles.checkIcon
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
                      </li>
                    )}
                  </ul>

                  <div className={styles.planAction}>
                    {isEnterprise ? (
                      <Link
                        href="/contact"
                        className={`${styles.planButton} ${styles.enterpriseButton}`}
                      >
                        Contact our team

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
                    ) : (
                      <Link
                        href={`/signup?plan=${encodeURIComponent(
                          plan.slug
                        )}`}
                        className={`${styles.planButton} ${
                          plan.is_popular
                            ? styles.primaryButton
                            : styles.secondaryButton
                        }`}
                      >
                        Get started

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
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Billing provider note */}
        <section className={styles.providerSection}>
          <div className={styles.providerIntro}>
            <span className={styles.providerEyebrow}>
              Secure billing
            </span>

            <h2>
              Your subscription stays under your
              control.
            </h2>

            <p>
              SBS will use a secure payment provider for
              subscription billing. Your payment details are
              handled by the payment provider rather than
              stored directly by SBS.
            </p>
          </div>

          <div className={styles.providerCards}>
            <div
              className={`${styles.providerCard} ${styles.providerActive}`}
            >
              <div className={styles.providerLogo}>
                <span className={styles.paypalMark}>
                  P
                </span>
              </div>

              <div>
                <strong>PayPal</strong>

                <span>
                  Available for subscription billing
                </span>
              </div>

              <span className={styles.providerStatus}>
                Active
              </span>
            </div>

            <div
              className={`${styles.providerCard} ${styles.providerFuture}`}
            >
              <div className={styles.providerLogo}>
                <span className={styles.stripeMark}>
                  S
                </span>
              </div>

              <div>
                <strong>Stripe</strong>

                <span>
                  Additional billing option
                </span>
              </div>

              <span className={styles.futureBadge}>
                Coming soon
              </span>
            </div>
          </div>
        </section>

        {/* Bottom help */}
        <div className={styles.bottomHelp}>
          <div className={styles.helpIcon}>
            ?
          </div>

          <div>
            <strong>Need help choosing?</strong>

            <span>
              Our team can help you understand which
              workspace fits your business.
            </span>
          </div>

          <Link
            href="/contact"
            className={styles.helpLink}
          >
            Talk to us
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>
          © {new Date().getFullYear()} Sharif Business
          Solutions. All rights reserved.
        </span>

        <div className={styles.footerLinks}>
          <Link href="/">
            Website
          </Link>

          <span>•</span>

          <Link href="/privacy">
            Privacy
          </Link>

          <span>•</span>

          <Link href="/terms">
            Terms
          </Link>
        </div>
      </footer>
    </main>
  );
}

function formatPrice(
  price: number | null
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

function getCurrencySymbol(
  currency: string
) {
  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency: currency || "USD",
      }
    )
      .formatToParts(0)
      .find(
        (part) => part.type === "currency"
      )?.value ?? "$";
  } catch {
    return "$";
  }
}