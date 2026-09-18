"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type BusinessType = "product" | "service";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [businessType, setBusinessType] =
    useState<BusinessType>("product");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState(
    "United Arab Emirates"
  );
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [trnNumber, setTrnNumber] = useState("");
  const [tradeLicenseNumber, setTradeLicenseNumber] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      setCheckingSession(false);
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError("");

    const trimmedCompanyName = companyName.trim();

    if (!trimmedCompanyName) {
      setError("Please enter your company name.");
      return;
    }

    setSubmitting(true);

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

      const { data, error: onboardingError } =
        await supabase.rpc("create_company_onboarding", {
          p_company_name: trimmedCompanyName,
          p_business_type: businessType,
          p_phone: phone.trim() || null,
          p_country: country.trim() || null,
          p_city: city.trim() || null,
          p_address: address.trim() || null,
          p_trn_number: trnNumber.trim() || null,
          p_trade_license_number:
            tradeLicenseNumber.trim() || null,
        });

      if (onboardingError) {
        throw new Error(onboardingError.message);
      }

      if (!data) {
        throw new Error(
          "Unable to create your business workspace. Please try again."
        );
      }

const selectedPlanSlug =
  typeof user.user_metadata?.selected_plan_slug === "string"
    ? user.user_metadata.selected_plan_slug
    : "";

router.replace(
  selectedPlanSlug
    ? `/billing?plan=${encodeURIComponent(selectedPlanSlug)}`
    : "/billing"
);  } catch (submitError) {
      console.error(
        "Company onboarding error:",
        submitError
      );

      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while creating your workspace."
      );

      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <main className={styles.onboardingPage}>
        <div className={styles.loadingScreen}>
          <span
            className={styles.loadingSpinner}
            aria-hidden="true"
          />

          <span>Preparing your workspace...</span>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.onboardingPage}>
      {/* Decorative background */}
      <div
        className={styles.onboardingBackground}
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
      <header className={styles.onboardingHeader}>
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

        <div className={styles.headerStatus}>
          <span className={styles.statusDot} />
          Account verified
        </div>
      </header>

      {/* Main */}
      <section className={styles.onboardingContent}>
        {/* Intro */}
        <div className={styles.onboardingIntro}>
          <div className={styles.welcomePill}>
            <span className={styles.welcomeDot} />
            Workspace setup
          </div>

          <h1>
            Let&apos;s build your
            <br />
            <span>business workspace.</span>
          </h1>

          <p className={styles.introDescription}>
            Tell us a little about your business. We&apos;ll use
            this information to create your SBS workspace and
            configure the foundation for your account.
          </p>

          <div className={styles.setupSteps}>
            <div className={styles.setupStep}>
              <div
                className={`${styles.stepIcon} ${styles.stepActive}`}
              >
                <span>1</span>
              </div>

              <div className={styles.stepText}>
                <strong>Business information</strong>
                <span>
                  Set up your company profile and workspace.
                </span>
              </div>
            </div>

            <div className={styles.setupLine} />

            <div className={styles.setupStep}>
              <div className={styles.stepIcon}>
                <span>2</span>
              </div>

              <div className={styles.stepText}>
                <strong>Choose your plan</strong>
                <span>
                  Select the subscription that fits your business.
                </span>
              </div>
            </div>

            <div className={styles.setupLine} />

            <div className={styles.setupStep}>
              <div className={styles.stepIcon}>
                <span>3</span>
              </div>

              <div className={styles.stepText}>
                <strong>Activate your workspace</strong>
                <span>
                  Complete billing and start using SBS.
                </span>
              </div>
            </div>
          </div>

          <div className={styles.setupNote}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 10v6" />
              <path d="M12 7.5h.01" />
            </svg>

            <span>
              You can update your business details later from
              Settings.
            </span>
          </div>
        </div>

        {/* Card */}
        <div className={styles.onboardingCard}>
          <div className={styles.cardAccent} />

          <div className={styles.cardContent}>
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

            <div className={styles.cardHeading}>
              <h2>Create your workspace</h2>

              <p>
                Start with the essential information about your
                business.
              </p>
            </div>

            <form
              className={styles.onboardingForm}
              onSubmit={handleSubmit}
            >
              {/* Company name */}
              <div className={styles.formField}>
                <label htmlFor="companyName">
                  Company name
                </label>

                <div className={styles.inputWrapper}>
                  <svg
                    className={styles.inputIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
                    <path d="M2 21h20" />
                    <path d="M8 7h2" />
                    <path d="M14 7h2" />
                    <path d="M8 11h2" />
                    <path d="M14 11h2" />
                    <path d="M8 15h2" />
                    <path d="M14 15h2" />
                  </svg>

                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    value={companyName}
                    onChange={(event) =>
                      setCompanyName(event.target.value)
                    }
                    placeholder="Your company name"
                    autoComplete="organization"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Business type */}
              <div className={styles.formField}>
                <label>Business type</label>

                <div className={styles.businessTypeGrid}>
                  <button
                    type="button"
                    className={`${styles.businessTypeOption} ${
                      businessType === "product"
                        ? styles.businessTypeActive
                        : ""
                    }`}
                    onClick={() =>
                      setBusinessType("product")
                    }
                    disabled={submitting}
                  >
                    <span className={styles.businessTypeIcon}>
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
                    </span>

                    <span>
                      <strong>Products</strong>
                      <small>
                        Inventory &amp; product-based business
                      </small>
                    </span>

                    <span
                      className={
                        styles.businessTypeCheck
                      }
                    >
                      {businessType === "product" ? "✓" : ""}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.businessTypeOption} ${
                      businessType === "service"
                        ? styles.businessTypeActive
                        : ""
                    }`}
                    onClick={() =>
                      setBusinessType("service")
                    }
                    disabled={submitting}
                  >
                    <span className={styles.businessTypeIcon}>
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
                    </span>

                    <span>
                      <strong>Services</strong>
                      <small>
                        Service &amp; operations-based business
                      </small>
                    </span>

                    <span
                      className={
                        styles.businessTypeCheck
                      }
                    >
                      {businessType === "service" ? "✓" : ""}
                    </span>
                  </button>
                </div>
              </div>

              {/* Phone */}
              <div className={styles.formField}>
                <label htmlFor="phone">
                  Business phone
                  <span className={styles.optional}>
                    Optional
                  </span>
                </label>

                <div className={styles.inputWrapper}>
                  <svg
                    className={styles.inputIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.08 5.18 2 2 0 0 1 5.06 3h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L9 10.73a16 16 0 0 0 4.27 4.27l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 21 15.9l1 .02Z" />
                  </svg>

                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                    placeholder="+971 50 000 0000"
                    autoComplete="tel"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Location row */}
              <div className={styles.formGrid}>
                <div className={styles.formField}>
                  <label htmlFor="country">Country</label>

                  <div className={styles.inputWrapper}>
                    <svg
                      className={styles.inputIcon}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M3 12h18" />
                      <path d="M12 3a14 14 0 0 1 0 18" />
                      <path d="M12 3a14 14 0 0 0 0 18" />
                    </svg>

                    <input
                      id="country"
                      name="country"
                      type="text"
                      value={country}
                      onChange={(event) =>
                        setCountry(event.target.value)
                      }
                      placeholder="Country"
                      autoComplete="country-name"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className={styles.formField}>
                  <label htmlFor="city">
                    City
                    <span className={styles.optional}>
                      Optional
                    </span>
                  </label>

                  <div className={styles.inputWrapper}>
                    <svg
                      className={styles.inputIcon}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="M12 21s7-5.35 7-11a7 7 0 0 0-14 0c0 5.65 7 11 7 11Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>

                    <input
                      id="city"
                      name="city"
                      type="text"
                      value={city}
                      onChange={(event) =>
                        setCity(event.target.value)
                      }
                      placeholder="City"
                      autoComplete="address-level2"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className={styles.formField}>
                <label htmlFor="address">
                  Business address
                  <span className={styles.optional}>
                    Optional
                  </span>
                </label>

                <div className={styles.inputWrapper}>
                  <svg
                    className={styles.inputIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M4 21V9l8-6 8 6v12" />
                    <path d="M9 21v-6h6v6" />
                    <path d="M8 11h.01" />
                    <path d="M12 11h.01" />
                    <path d="M16 11h.01" />
                  </svg>

                  <input
                    id="address"
                    name="address"
                    type="text"
                    value={address}
                    onChange={(event) =>
                      setAddress(event.target.value)
                    }
                    placeholder="Street, building, office..."
                    autoComplete="street-address"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Business registration */}
              <div className={styles.formSectionLabel}>
                Business registration
                <span>
                  Optional — you can add these later
                </span>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formField}>
                  <label htmlFor="trnNumber">
                    TRN number
                  </label>

                  <div className={styles.inputWrapper}>
                    <svg
                      className={styles.inputIcon}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <rect
                        x="4"
                        y="3"
                        width="16"
                        height="18"
                        rx="2"
                      />
                      <path d="M8 7h8" />
                      <path d="M8 11h8" />
                      <path d="M8 15h5" />
                    </svg>

                    <input
                      id="trnNumber"
                      name="trnNumber"
                      type="text"
                      value={trnNumber}
                      onChange={(event) =>
                        setTrnNumber(event.target.value)
                      }
                      placeholder="Tax registration number"
                      autoComplete="off"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className={styles.formField}>
                  <label htmlFor="tradeLicenseNumber">
                    Trade license
                  </label>

                  <div className={styles.inputWrapper}>
                    <svg
                      className={styles.inputIcon}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="M6 3h12v18H6z" />
                      <path d="M9 7h6" />
                      <path d="M9 11h6" />
                      <path d="M9 15h4" />
                    </svg>

                    <input
                      id="tradeLicenseNumber"
                      name="tradeLicenseNumber"
                      type="text"
                      value={tradeLicenseNumber}
                      onChange={(event) =>
                        setTradeLicenseNumber(
                          event.target.value
                        )
                      }
                      placeholder="License number"
                      autoComplete="off"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  className={styles.formError}
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

                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className={styles.submitButton}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span
                      className={styles.buttonSpinner}
                      aria-hidden="true"
                    />

                    <span>
                      Creating your workspace...
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      Continue to plan selection
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
            </form>

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

                <span>Flexible billing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.onboardingFooter}>
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