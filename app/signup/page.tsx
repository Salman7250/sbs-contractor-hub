import Image from "next/image";
import Link from "next/link";
import SignupForm from "./signup-form";
import styles from "./page.module.css";

export default function SignupPage() {
  return (
    <main className={styles.signupPage}>
      {/* Decorative background */}
      <div className={styles.signupBackground} aria-hidden="true">
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
      <header className={styles.signupHeader}>
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

      {/* Main content */}
      <section className={styles.signupContent}>
        {/* Left side */}
        <div className={styles.signupIntro}>
          <div className={styles.welcomePill}>
            <span className={styles.welcomeDot} />
            Start your business workspace
          </div>

          <h1>
            Build your business.
            <br />
            <span>All in one place.</span>
          </h1>

          <p className={styles.introDescription}>
            Create your SBS workspace and bring your products,
            inventory, sales, purchasing, customers, invoices,
            payments, expenses and operations together.
          </p>

          <div className={styles.businessAreas}>
            {/* Customers */}
            <div className={styles.businessArea}>
              <div className={styles.areaIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>

              <div className={styles.businessAreaText}>
                <strong>Customers</strong>
                <span>Keep every relationship organized</span>
              </div>
            </div>

            {/* Inventory */}
            <div className={styles.businessArea}>
              <div className={styles.areaIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="m21 16-9 5-9-5" />
                  <path d="m21 12-9 5-9-5" />
                  <path d="m21 8-9 5-9-5 9-5 9 5Z" />
                </svg>
              </div>

              <div className={styles.businessAreaText}>
                <strong>Inventory</strong>
                <span>Know what you have and where it is</span>
              </div>
            </div>

            {/* Sales */}
            <div className={styles.businessArea}>
              <div className={styles.areaIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M8 9h8" />
                  <path d="M8 13h5" />
                  <path d="M8 17h3" />
                </svg>
              </div>

              <div className={styles.businessAreaText}>
                <strong>Sales & Finance</strong>
                <span>Invoices, payments and business control</span>
              </div>
            </div>

            {/* Operations */}
            <div className={styles.businessArea}>
              <div className={styles.areaIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M14.7 6.3a4 4 0 0 0-5.66 5.66L3 18v3h3l6.04-6.04a4 4 0 0 0 5.66-5.66l-2.12 2.12-2.83-2.83L14.7 6.3Z" />
                  <path d="m15 15 6 6" />
                </svg>
              </div>

              <div className={styles.businessAreaText}>
                <strong>Operations</strong>
                <span>Purchase orders and daily workflows</span>
              </div>
            </div>
          </div>

          {/* Quote */}
          <div className={styles.signupQuote}>
            <div className={styles.quoteMark}>“</div>

            <div>
              <p>
                Everything your business needs to stay organized,
                connected, and in control.
              </p>

              <span>Sharif Business Solutions</span>
            </div>
          </div>
        </div>

        {/* Signup card */}
        <div className={styles.signupCard}>
          <div className={styles.cardAccent} />

          <div className={styles.signupCardContent}>
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

            <div className={styles.signupHeading}>
              <h2>Create your SBS account</h2>

              <p>
                Set up your business workspace and start your
                14-day trial.
              </p>
            </div>

            <SignupForm />

            {/* Existing account */}
            {/* <div className={styles.existingAccount}>
              <span>Already have an account?</span>

              <Link href="/login">
                Sign in
              </Link>
            </div> */}

            {/* Trust area */}
            <div className={styles.trustArea}>
              <div className={styles.trustItem}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>

                <span>Secure account</span>
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

                <span>14-day trial</span>
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
                  <path d="M20 11a8.1 8.1 0 0 0-15.5-2" />
                  <path d="M4 4v5h5" />
                  <path d="M4 13a8.1 8.1 0 0 0 15.5 2" />
                  <path d="M20 20v-5h-5" />
                </svg>

                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.signupFooter}>
        <span>
          © {new Date().getFullYear()} Sharif Business Solutions.
          All rights reserved.
        </span>

        <div className={styles.footerLinks}>
          <Link href="https://www.sharifbusinesssolutions.com">Website</Link>
          <span>•</span>
          <Link href="https://www.sharifbusinesssolutions.com/privacy">Privacy</Link>
          <span>•</span>
          <Link href="https://www.sharifbusinesssolutions.com/terms">Terms</Link>
        </div>
      </footer>
    </main>
  );
}