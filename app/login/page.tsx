import Image from "next/image";
import LoginForm from "./login-form";
import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <main className={styles.loginPage}>
      {/* Decorative background */}
      <div className={styles.loginBackground} aria-hidden="true">
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
        <a href="/" className={styles.brand}>
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
        </a>
      </header>

      {/* Main content */}
      <section className={styles.loginContent}>
        {/* Left side */}
        <div className={styles.loginIntro}>
          <div className={styles.welcomePill}>
            <span className={styles.welcomeDot} />
            Welcome back
          </div>

          <h1>
            Run your business.
            <br />
            <span>Better. Smarter. Faster.</span>
          </h1>

          <p className={styles.introDescription}>
            Manage your products, inventory, sales, purchasing, customers,
            invoices, payments, expenses and more — all from one powerful
            business platform.
          </p>

          <div className={styles.businessAreas}>
            {/* Customers */}
            <div className={styles.businessArea}>
              <div
                className={`${styles.areaIcon} ${styles.customersIcon}`}
              >
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
              <div
                className={`${styles.areaIcon} ${styles.inventoryIcon}`}
              >
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
              <div
                className={`${styles.areaIcon} ${styles.businessIcon}`}
              >
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
              <div
                className={`${styles.areaIcon} ${styles.serviceIcon}`}
              >
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
                <span>Purchase orders and day-to-day workflows</span>
              </div>
            </div>
          </div>

          {/* Quote */}
          <div className={styles.loginQuote}>
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

        {/* Login card */}
        <div className={styles.loginCard}>
          <div className={styles.cardAccent} />

          <div className={styles.loginCardContent}>
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

            <div className={styles.loginHeading}>
              <h2>Sign in to SBS</h2>

              <p>
                Access your business workspace and continue where you
                left off.
              </p>
            </div>

            <LoginForm />

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

                <span>Secure login</span>
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

                <span>Always connected</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.loginFooter}>
        <span>
          © {new Date().getFullYear()} Sharif Business Solutions. All
          rights reserved.
        </span>

        <div className={styles.footerLinks}>
          <a href="/">Website</a>
          <span>•</span>
          <a href="/privacy">Privacy</a>
          <span>•</span>
          <a href="/terms">Terms</a>
        </div>
      </footer>
    </main>
  );
}