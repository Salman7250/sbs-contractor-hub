import Image from "next/image";
import Link from "next/link";
import SetPasswordForm from "./set-password-form";
import styles from "./page.module.css";

export default function SetPasswordPage() {
  return (
    <main className={styles.passwordPage}>
      {/* Decorative background */}
      <div
        className={styles.passwordBackground}
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
      <header className={styles.passwordHeader}>
        <Link href="/" className={styles.brand}>
          <Image
            src="/sbs-logo.png"
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

      {/* Main */}
      <section className={styles.passwordContent}>
        {/* Left introduction */}
        <div className={styles.passwordIntro}>
          <div className={styles.welcomePill}>
            <span className={styles.welcomeDot} />
            Welcome to SBS
          </div>

          <h1>
            Your workspace.
            <br />
            <span>Ready to begin.</span>
          </h1>

          <p className={styles.introDescription}>
            Your SBS account has been created. Set your password
            to activate your workspace and securely access your
            business operations.
          </p>

          <div className={styles.setupSteps}>
            <div className={styles.setupStep}>
              <div
                className={`${styles.stepIcon} ${styles.stepIconActive}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>

              <div className={styles.stepText}>
                <strong>Invitation accepted</strong>
                <span>
                  Your SBS workspace invitation is ready.
                </span>
              </div>
            </div>

            <div className={styles.setupLine} />

            <div className={styles.setupStep}>
              <div
                className={`${styles.stepIcon} ${styles.stepIconCurrent}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="11"
                    rx="2"
                  />

                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </div>

              <div className={styles.stepText}>
                <strong>Create your password</strong>
                <span>
                  Secure your account with your own password.
                </span>
              </div>
            </div>

            <div className={styles.setupLine} />

            <div className={styles.setupStep}>
              <div className={styles.stepIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </div>

              <div className={styles.stepText}>
                <strong>Enter your workspace</strong>
                <span>
                  Start managing your business with SBS.
                </span>
              </div>
            </div>
          </div>

          <div className={styles.loginQuote}>
            <div className={styles.quoteMark}>“</div>

            <div>
              <p>
                One secure workspace for the systems and
                operations that keep your business moving.
              </p>

              <span>Sharif Business Solutions</span>
            </div>
          </div>
        </div>

        {/* Password card */}
        <div className={styles.passwordCard}>
          <div className={styles.cardAccent} />

          <div className={styles.passwordCardContent}>
            {/* Card logo */}
            <div className={styles.cardBrand}>
              <Image
                src="/sbs-logo.png"
                alt="SBS"
                width={190}
                height={48}
                priority
                className={styles.cardLogo}
              />
            </div>

            {/* Security icon */}
            <div className={styles.passwordIconArea}>
              <div className={styles.passwordIconRing}>
                <div className={styles.passwordIcon}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <rect
                      x="4"
                      y="10"
                      width="16"
                      height="11"
                      rx="2.5"
                    />

                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />

                    <circle
                      cx="12"
                      cy="15"
                      r="1"
                      fill="currentColor"
                      stroke="none"
                    />

                    <path d="M12 16v2" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Heading */}
            <div className={styles.passwordHeading}>
              <div className={styles.passwordEyebrow}>
                ACCOUNT SETUP
              </div>

              <h2>Create your password</h2>

              <p>
                Create a secure password to activate your SBS
                account and access your business workspace.
              </p>
            </div>

            {/* Interactive form */}
            <SetPasswordForm />

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
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="10"
                    rx="2"
                  />

                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>

                <span>Secure setup</span>
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

                <span>Ready to use</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.passwordFooter}>
        <span>
          © {new Date().getFullYear()} Sharif Business Solutions.
          All rights reserved.
        </span>

        <div className={styles.footerLinks}>
          <Link href="/">Website</Link>
          <span>•</span>
          <a href="/privacy">Privacy</a>
          <span>•</span>
          <a href="/terms">Terms</a>
        </div>
      </footer>
    </main>
  );
}
