import Image from "next/image";
import Link from "next/link";
import styles from "../../page.module.css";
import { completePayPalSubscription } from "@/lib/paypal/complete-subscription";

type PayPalSuccessPageProps = {
  searchParams: Promise<{
    subscription_id?:
      | string
      | string[];
    ba_token?: string | string[];
    token?: string | string[];
    plan?: string | string[];
  }>;
};

function getFirstString(
  value:
    | string
    | string[]
    | undefined,
) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function findPayPalSubscriptionId(
  value:
    | string
    | string[]
    | undefined,
) {
  const values = Array.isArray(value)
    ? value
    : value
      ? [value]
      : [];

  /*
   * PayPal subscription IDs normally look like:
   *
   * I-XXXXXXXXXXXX
   *
   * We deliberately ignore UUIDs here because
   * the SBS subscription UUID is NOT a PayPal
   * subscription ID.
   */
  const paypalId = values.find(
    (item) =>
      /^I-[A-Z0-9]+$/i.test(
        item.trim(),
      ),
  );

  return paypalId?.trim() ?? "";
}

export default async function PayPalSuccessPage({
  searchParams,
}: PayPalSuccessPageProps) {
  const params = await searchParams;

  /*
   * PayPal normally returns:
   *
   * subscription_id=I-XXXXXXXXXXXX
   *
   * However, our checkout flow can also leave
   * an SBS subscription UUID in the query string.
   *
   * Therefore we specifically search for the
   * PayPal I-XXXXXXXX ID instead of blindly using
   * the first subscription_id value.
   */
  const paypalSubscriptionId =
    findPayPalSubscriptionId(
      params.subscription_id,
    );

  const fallbackToken =
    getFirstString(params.token);

  let completionStatus:
    | "active"
    | "pending"
    | "paused"
    | "canceled"
    | "error" = "error";

  let completionMessage =
    "We received your PayPal approval.";

  let subscriptionReference =
    paypalSubscriptionId ||
    fallbackToken;

  if (paypalSubscriptionId) {
    try {
      const result =
        await completePayPalSubscription(
          paypalSubscriptionId,
        );

      const status =
        result.subscription.status;

      subscriptionReference =
        result.paypal.id ??
        paypalSubscriptionId;

      switch (status) {
        case "active":
          completionStatus = "active";

          completionMessage =
            "Your SBS subscription is now active.";

          break;

        case "pending":
          completionStatus = "pending";

          completionMessage =
            "Your PayPal approval was received. SBS is waiting for PayPal to finalize the subscription.";

          break;

        case "paused":
          completionStatus = "paused";

          completionMessage =
            "Your PayPal subscription is currently paused.";

          break;

        case "canceled":
          completionStatus = "canceled";

          completionMessage =
            "The PayPal subscription was canceled.";

          break;

        default:
          completionStatus = "error";

          completionMessage =
            "Your PayPal approval was received, but SBS could not confirm the final subscription status yet.";
      }
    } catch (error) {
      console.error(
        "PayPal success page subscription completion error:",
        error,
      );

      completionStatus = "error";

      completionMessage =
        error instanceof Error
          ? error.message
          : "We received your PayPal approval, but could not finalize the SBS subscription yet.";
    }
  } else {
    completionStatus = "error";

    completionMessage =
      "PayPal did not return a valid PayPal subscription ID.";
  }

  const isActive =
    completionStatus === "active";

  const isPending =
    completionStatus === "pending";

  const isCanceled =
    completionStatus === "canceled";

  const isPaused =
    completionStatus === "paused";

  const statusTitle = isActive
    ? "Subscription activated"
    : isPending
      ? "Subscription approval received"
      : isCanceled
        ? "Subscription canceled"
        : isPaused
          ? "Subscription paused"
          : "PayPal approval received";

  const statusLabel = isActive
    ? "Active"
    : isPending
      ? "Pending"
      : isCanceled
        ? "Canceled"
        : isPaused
          ? "Paused"
          : "Processing";

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

            <span
              className={
                styles.brandTagline
              }
            >
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
                <span
                  className={
                    styles.cardEyebrow
                  }
                >
                  PayPal subscription
                </span>

                <h2>
                  {statusTitle}
                </h2>

                <p>
                  {completionMessage}
                </p>
              </div>
            </div>

            {/* Provider status */}
            <div
              className={
                styles.providerNote
              }
            >
              <div
                className={
                  styles.providerIcon
                }
              >
                <span>
                  {isActive
                    ? "✓"
                    : isPending
                      ? "!"
                      : isCanceled
                        ? "!"
                        : isPaused
                          ? "!"
                          : "✓"}
                </span>
              </div>

              <div>
                <strong>
                  PayPal subscription
                </strong>

                <span>
                  {isActive
                    ? "PayPal confirmed the subscription is active."
                    : isPending
                      ? "PayPal approval was received and the subscription is still being finalized."
                      : isCanceled
                        ? "The PayPal subscription is no longer active."
                        : isPaused
                          ? "The PayPal subscription is currently paused."
                          : "PayPal approval was received by SBS."}
                </span>
              </div>

              <span
                className={
                  styles.providerStatus
                }
              >
                {statusLabel}
              </span>
            </div>

            <div className={styles.divider} />

            {/* What happens next */}
            <div
              className={
                styles.featuresSection
              }
            >
              <div
                className={
                  styles.featuresHeading
                }
              >
                {isActive
                  ? "Your subscription is ready"
                  : "What happens next?"}
              </div>

              <div
                className={
                  styles.featuresGrid
                }
              >
                <div
                  className={
                    styles.feature
                  }
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
                    Your PayPal subscription
                    approval has been received.
                  </span>
                </div>

                <div
                  className={
                    styles.feature
                  }
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
                    {isActive
                      ? "Your SBS workspace subscription is active."
                      : isPending
                        ? "SBS is waiting for PayPal to finalize the subscription."
                        : "SBS has recorded the PayPal response."}
                  </span>
                </div>

                <div
                  className={
                    styles.feature
                  }
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
                    You can continue to your
                    SBS workspace.
                  </span>
                </div>
              </div>
            </div>

            {/* Reference */}
            {subscriptionReference && (
              <div
                className={
                  styles.checkoutNote
                }
              >
                PayPal subscription reference:{" "}
                {subscriptionReference}
              </div>
            )}

            {/* Actions */}
            <div
              className={
                styles.checkoutArea
              }
            >
              <Link
                href="/dashboard"
                className={
                  styles.paypalButton
                }
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

              <p
                className={
                  styles.checkoutNote
                }
              >
                {isActive
                  ? "Your subscription is active and your workspace is ready."
                  : isPending
                    ? "If PayPal is still processing your subscription, return to Billing shortly to refresh the status."
                    : "You can return to Billing to check your subscription status."}
              </p>
            </div>

            <div
              className={
                styles.changePlan
              }
            >
              <Link href="/settings/billing">
                ← Return to billing
              </Link>

              <span>
                Your payment details remain
                securely handled by PayPal.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>
          © {new Date().getFullYear()}{" "}
          Sharif Business Solutions. All
          rights reserved.
        </span>

        <div
          className={
            styles.footerLinks
          }
        >
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