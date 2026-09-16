import Image from "next/image";
import Link from "next/link";
import SignupForm from "./signup-form";
import styles from "./page.module.css";

export default function SignupPage() {
  return (
    <main className={styles.signupPage}>
      <div className={styles.backgroundPaper}>
        <div className={styles.backgroundCircle} />
        <div className={styles.backgroundDots} />
        <div className={styles.backgroundCurve} />
      </div>

      <div className={styles.container}>
        <header className={styles.header}>
          <Link
            href="/"
            className={styles.logo}
            aria-label="SBS home"
          >
            <Image
              src="/sbs-logo.png"
              alt="SBS"
              width={148}
              height={45}
              priority
              className={styles.logoImage}
            />
          </Link>

          <div className={styles.headerRight}>
            <span className={styles.headerText}>
              Already have an account?
            </span>

            <Link
              href="/login"
              className={styles.loginLink}
            >
              Sign in
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
        </header>

        <div className={styles.main}>
          <section className={styles.intro}>
            <div className={styles.introEyebrow}>
              <span className={styles.introEyebrowLine} />
              GET STARTED WITH SBS
            </div>

            <h1 className={styles.introTitle}>
              Build your business.
              <br />
              <span className={styles.introTitleAccent}>
                Run it smarter.
              </span>
            </h1>

            <p className={styles.introDescription}>
              Create your SBS workspace and bring your
              products, customers, sales, inventory and
              business operations into one connected system.
            </p>

            <div className={styles.benefits}>
              <div className={styles.benefit}>
                <div className={styles.benefitIcon}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M4 7h16" />
                    <path d="M7 4v3" />
                    <path d="M17 4v3" />
                    <rect
                      x="4"
                      y="5"
                      width="16"
                      height="15"
                      rx="2"
                    />
                    <path d="m8 13 2.5 2.5L16 10" />
                  </svg>
                </div>

                <div>
                  <div className={styles.benefitTitle}>
                    One connected workspace
                  </div>

                  <div className={styles.benefitText}>
                    Keep your day-to-day business operations
                    organized in one place.
                  </div>
                </div>
              </div>

              <div className={styles.benefit}>
                <div className={styles.benefitIcon}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M12 3 5 6v5c0 4.5 3 7.8 7 10 4-2.2 7-5.5 7-10V6l-7-3Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>

                <div>
                  <div className={styles.benefitTitle}>
                    Built for growing businesses
                  </div>

                  <div className={styles.benefitText}>
                    Start with the tools you need and expand
                    as your operation grows.
                  </div>
                </div>
              </div>

              <div className={styles.benefit}>
                <div className={styles.benefitIcon}>
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
                      r="8"
                    />
                    <path d="M12 8v4l2.5 2.5" />
                  </svg>
                </div>

                <div>
                  <div className={styles.benefitTitle}>
                    Set up in minutes
                  </div>

                  <div className={styles.benefitText}>
                    Tell us about your business and we'll
                    prepare your workspace.
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.quote}>
              <span className={styles.quoteMark}>“</span>

              <span>
                Everything your business needs to stay
                organized, visible and in control.
              </span>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <Image
                src="/sbs-logo.png"
                alt="SBS"
                width={122}
                height={38}
                className={styles.cardLogo}
              />

              <div className={styles.cardEyebrow}>
                CREATE YOUR WORKSPACE
              </div>

              <h2 className={styles.cardTitle}>
                Create your SBS account
              </h2>

              <p className={styles.cardDescription}>
                Set up your business workspace and start
                managing your operation from one place.
              </p>
            </div>

            <SignupForm />

            <div className={styles.trust}>
              <div className={styles.trustIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M12 3 5 6v5c0 4.5 3 7.8 7 10 4-2.2 7-5.5 7-10V6l-7-3Z" />
                  <path d="M9.5 12.5 11 14l3.5-4" />
                </svg>
              </div>

              <span>
                Your account information is securely
                handled through Supabase authentication.
              </span>
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <span className={styles.footerBrand}>
            SBS · Sharif Business Solutions
          </span>

          <span className={styles.footerText}>
            Business management, connected.
          </span>
        </footer>
      </div>
    </main>
  );
}