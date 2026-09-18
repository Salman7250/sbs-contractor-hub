import Image from "next/image";
import Link from "next/link";
import styles from "../../page.module.css";

type PayPalSuccessPageProps = {
  searchParams: Promise<{
    subscription_id?: string;
    ba_token?: string;
    token?: string;
    plan?: string;
  }>;
};

export default async function PayPalSuccessPage({
  searchParams,
}: PayPalSuccessPageProps) {
  const params = await searchParams;

  const subscriptionId =
    params.subscription_id ??
    params.ba_token ??
    params.token ??
    "";

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
          Subscription checkout
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
                  PayPal authorization
                </span>

                <h2>
                  Subscription approved
                </h2>

                <p>
                  Your PayPal subscription approval was
                  received successfully.
                </p>
              </div>
            </div>

            <div className={styles.providerNote}>
              <div className={styles.providerIcon}>
                <span>✓</span>
              </div>

              <div>
                <strong>
                  PayPal approval received
                </strong>

                <span>
                  Your subscription details have been
                  received by SBS.
                </span>
              </div>

              <span
                className={
                  styles.providerStatus
                }
              >
                Approved
              </span>
            </div>

            <div className={styles.divider} />

            <div className={styles.featuresSection}>
              <div className={styles.featuresHeading}>
                What happens next?
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
                    Your PayPal subscription approval has
                    been received.
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
                    SBS will finalize your workspace
                    subscription.
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
                    You can then continue to your SBS
                    workspace.
                  </span>
                </div>
              </div>
            </div>

            {subscriptionId && (
              <div className={styles.checkoutNote}>
                PayPal reference received successfully.
              </div>
            )}

            <div className={styles.checkoutArea}>
              <Link
                href="/dashboard"
                className={styles.paypalButton}
              >
                <span>
                  Continue to SBS
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
                If your workspace is not ready yet, you can
                return to this page shortly.
              </p>
            </div>

            <div className={styles.changePlan}>
              <Link href="/billing">
                ← Return to billing
              </Link>

              <span>
                Your payment details remain securely
                handled by PayPal.
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