import Image from "next/image";
import Link from "next/link";
import styles from "../../page.module.css";

type PayPalCancelPageProps = {
  searchParams: Promise<{
    plan?: string;
  }>;
};

export default async function PayPalCancelPage({
  searchParams,
}: PayPalCancelPageProps) {
  const params = await searchParams;

  const planSlug =
    params.plan?.trim().toLowerCase() ?? "";

  const billingHref = planSlug
    ? `/billing?plan=${encodeURIComponent(planSlug)}`
    : "/billing";

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
          Checkout cancelled
        </div>
      </header>

      {/* Content */}
      <section className={styles.content}>
        <div className={styles.billingCard}>
          <div className={styles.cardAccent} />

          <div className={styles.cardContent}>
            <div className={styles.cardHeading}>
              <div>
                <span className={styles.cardEyebrow}>
                  PayPal checkout
                </span>

                <h2>
                  Checkout was cancelled
                </h2>

                <p>
                  No subscription was activated because
                  PayPal checkout was cancelled.
                </p>
              </div>
            </div>

            <div className={styles.errorBox}>
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

                <path d="M8 8l8 8" />
                <path d="M16 8l-8 8" />
              </svg>

              <span>
                Your PayPal checkout was cancelled. You
                have not completed the subscription.
              </span>
            </div>

            <div className={styles.divider} />

            <div className={styles.featuresSection}>
              <div className={styles.featuresHeading}>
                You can still activate your workspace
              </div>

              <div className={styles.featuresGrid}>
                <div className={styles.feature}>
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
                    Your selected plan remains available.
                  </span>
                </div>

                <div className={styles.feature}>
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
                    No PayPal approval was completed.
                  </span>
                </div>

                <div className={styles.feature}>
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
                    You can return to billing and try
                    again.
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.checkoutArea}>
              <Link
                href={billingHref}
                className={styles.paypalButton}
              >
                <span>
                  Return to checkout
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

              <p className={styles.checkoutNote}>
                You can choose your billing cycle again
                before returning to PayPal.
              </p>
            </div>

            <div className={styles.changePlan}>
              <Link href="/plans">
                ← Change plan
              </Link>

              <span>
                No subscription has been activated.
              </span>
            </div>

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