import Image from "next/image";
import Link from "next/link";
import styles from "../page.module.css";

type VerifyPageProps = {
  searchParams: Promise<{
    email?: string;
    error?: string;
  }>;
};

export default async function VerifySignupPage({
  searchParams,
}: VerifyPageProps) {
  const params = await searchParams;

  const email = params.email?.trim() ?? "";
  const error = params.error?.trim() ?? "";

  const hasError = Boolean(error);

  return (
    <main className={styles.loginPage}>
      {/* Background */}
      <div
        className={styles.loginBackground}
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

        <div
          className={`${styles.curve} ${styles.curveOne}`}
        />

        <div
          className={`${styles.curve} ${styles.curveTwo}`}
        />
      </div>

      {/* Header */}
      <header className={styles.loginHeader}>
        <Link href="/" className={styles.brand}>
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
      </header>

      {/* Content */}
      <section className={styles.loginContent}>
        {/* Intro */}
        <div className={styles.loginIntro}>
          <div className={styles.welcomePill}>
            <span className={styles.welcomeDot} />

            Account verification
          </div>

          <h1>
            One more step.
            <br />
            <span>Verify your email.</span>
          </h1>

          <p className={styles.introDescription}>
            We&apos;ve sent a confirmation link to your email
            address. Confirm it to activate your SBS account and
            continue setting up your business workspace.
          </p>
        </div>

        {/* Card */}
        <div className={styles.loginCard}>
          <div className={styles.cardAccent} />

          <div className={styles.loginCardContent}>
            {/* Logo */}
            <div className={styles.cardBrand}>
              <Image
                src="/sbs-logo-black.png"
                alt="SBS"
                width={190}
                height={48}
                priority
                className={styles.cardLogo}
              />
            </div>

            {/* Heading */}
            <div className={styles.loginHeading}>
              <h2>
                {hasError
                  ? "Confirmation problem"
                  : "Check your email"}
              </h2>

              <p>
                {hasError
                  ? "The confirmation link could not be verified."
                  : "We&apos;ve sent you an email with a secure confirmation link."}
              </p>
            </div>

            {/* Status */}
            {hasError ? (
              <div
                className={styles.loginError}
                role="alert"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />

                  <path d="M12 8v5" />

                  <path d="M12 16.5h.01" />
                </svg>

                <span>
                  {error === "invalid_confirmation"
                    ? "The confirmation link is missing required information. Please start the signup process again."
                    : "This confirmation link may have expired or already been used. Please start the signup process again."}
                </span>
              </div>
            ) : (
              <div className={styles.verifyMessage}>
                <div className={styles.verifyIcon}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="14"
                      rx="2"
                    />

                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </div>

                <div>
                  <strong>
                    Email confirmation required
                  </strong>

                  <p>
                    {email
                      ? `Check ${email} and click the confirmation button.`
                      : "Check your inbox and click the confirmation button."}
                  </p>
                </div>
              </div>
            )}

            {/* Action */}
            <Link
              href="/login"
              className={styles.loginSubmit}
            >
              <span>Return to sign in</span>

              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M19 12H5" />

                <path d="m11 18-6-6 6-6" />
              </svg>
            </Link>

            {/* Help */}
            <p className={styles.loginHelp}>
              Didn&apos;t receive the email? Check your spam or
              junk folder.
            </p>

            {/* Trust */}
            <div className={styles.trustArea}>
              <div className={styles.trustItem}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="10"
                    rx="2"
                  />

                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>

                <span>Secure verification</span>
              </div>

              <div className={styles.trustDivider} />

              <div className={styles.trustItem}>
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

                <span>Business ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.loginFooter}>
        <span>
          © {new Date().getFullYear()} Sharif Business Solutions.
          All rights reserved.
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