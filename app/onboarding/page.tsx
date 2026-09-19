"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type BusinessType = "product" | "service";

export default function OnboardingPage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [trialStarted, setTrialStarted] =
    useState(false);

  const [error, setError] = useState("");

  const [companyName, setCompanyName] =
    useState("");

  const [businessType, setBusinessType] =
    useState<BusinessType>("product");

  const [phone, setPhone] =
    useState("");

  const [country, setCountry] =
    useState("United Arab Emirates");

  const [city, setCity] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [trnNumber, setTrnNumber] =
    useState("");

  const [tradeLicenseNumber, setTradeLicenseNumber] =
    useState("");

  /*
   * Check authentication and onboarding status.
   *
   * Authenticated user + no company membership =
   * onboarding is incomplete.
   *
   * Authenticated user + company membership =
   * onboarding is already complete.
   */
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!mounted) {
          return;
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        const {
          data: membership,
          error: membershipError,
        } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw new Error(
            membershipError.message,
          );
        }

        /*
         * Existing company = onboarding already completed.
         */
        if (membership?.company_id) {
          router.replace("/");
          return;
        }

        /*
         * Authenticated account with no company.
         * Stay on onboarding.
         */
        setCheckingSession(false);
      } catch (sessionError) {
        console.error(
          "Onboarding session check error:",
          sessionError,
        );

        if (!mounted) {
          return;
        }

        setError(
          sessionError instanceof Error
            ? sessionError.message
            : "Unable to verify your account.",
        );

        setCheckingSession(false);
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (submitting || trialStarted) {
      return;
    }

    setError("");

    const trimmedCompanyName =
      companyName.trim();

    if (!trimmedCompanyName) {
      setError(
        "Please enter your company name.",
      );
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

      /*
       * The database function is responsible for:
       *
       * - creating the company
       * - creating the owner membership
       * - selecting the user's plan
       * - creating the subscription
       * - starting the 14-day trial
       * - assigning the plan's modules
       */
      const {
        data,
        error: onboardingError,
      } = await supabase.rpc(
        "create_company_onboarding",
        {
          p_company_name:
            trimmedCompanyName,

          p_business_type:
            businessType,

          p_phone:
            phone.trim() || null,

          p_country:
            country.trim() || null,

          p_city:
            city.trim() || null,

          p_address:
            address.trim() || null,

          p_trn_number:
            trnNumber.trim() || null,

          p_trade_license_number:
            tradeLicenseNumber.trim() || null,
        },
      );

      if (onboardingError) {
        throw new Error(
          onboardingError.message,
        );
      }

      if (!data) {
        throw new Error(
          "Unable to create your business workspace. Please try again.",
        );
      }

      /*
       * The database has successfully created the
       * workspace and started the 14-day trial.
       *
       * Show a success message before entering
       * the workspace.
       */
      setSubmitting(false);
      setTrialStarted(true);

      /*
       * Give the user enough time to see the
       * successful trial confirmation.
       */
      window.setTimeout(() => {
        router.replace("/");
      }, 3500);
    } catch (submitError) {
      console.error(
        "Company onboarding error:",
        submitError,
      );

      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while creating your workspace.",
      );

      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <main
        className={styles.onboardingPage}
      >
        <div
          className={styles.loadingScreen}
        >
          <span
            className={
              styles.loadingSpinner
            }
            aria-hidden="true"
          />

          <span>
            Preparing your workspace...
          </span>
        </div>
      </main>
    );
  }

  return (
    <main
      className={styles.onboardingPage}
    >
      {/* Background */}
      <div
        className={
          styles.onboardingBackground
        }
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
      <header
        className={
          styles.onboardingHeader
        }
      >
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

          <div
            className={styles.brandText}
          >
            <span
              className={
                styles.brandName
              }
            >
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

        <div
          className={
            styles.headerStatus
          }
        >
          <span
            className={
              styles.statusDot
            }
          />

          Account verified
        </div>
      </header>

      {/* Main content */}
      <section
        className={
          styles.onboardingContent
        }
      >
        {/* Intro */}
        <div
          className={
            styles.onboardingIntro
          }
        >
          <div
            className={
              styles.welcomePill
            }
          >
            <span
              className={
                styles.welcomeDot
              }
            />

            Workspace setup
          </div>

          <h1>
            Let&apos;s build your
            <br />
            <span>
              business workspace.
            </span>
          </h1>

          <p
            className={
              styles.introDescription
            }
          >
            Tell us a little about your
            business. We&apos;ll use this
            information to create your SBS
            workspace and start your
            14-day free trial.
          </p>

          <div
            className={
              styles.setupSteps
            }
          >
            <div
              className={
                styles.setupStep
              }
            >
              <div
                className={`${styles.stepIcon} ${styles.stepActive}`}
              >
                <span>1</span>
              </div>

              <div
                className={
                  styles.stepText
                }
              >
                <strong>
                  Business information
                </strong>

                <span>
                  Set up your company
                  profile and workspace.
                </span>
              </div>
            </div>

            <div
              className={
                styles.setupLine
              }
            />

            <div
              className={
                styles.setupStep
              }
            >
              <div
                className={styles.stepIcon}
              >
                <span>2</span>
              </div>

              <div
                className={
                  styles.stepText
                }
              >
                <strong>
                  14-day free trial
                </strong>

                <span>
                  Explore SBS without
                  entering payment details.
                </span>
              </div>
            </div>

            <div
              className={
                styles.setupLine
              }
            />

            <div
              className={
                styles.setupStep
              }
            >
              <div
                className={styles.stepIcon}
              >
                <span>3</span>
              </div>

              <div
                className={
                  styles.stepText
                }
              >
                <strong>
                  Start using SBS
                </strong>

                <span>
                  Your workspace is ready
                  immediately.
                </span>
              </div>
            </div>
          </div>

          <div
            className={styles.setupNote}
          >
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

              <path d="M12 10v6" />

              <path d="M12 7.5h.01" />
            </svg>

            <span>
              No payment is required to
              start your 14-day trial.
            </span>
          </div>
        </div>

        {/* Form card */}
        <div
          className={
            styles.onboardingCard
          }
        >
          <div
            className={
              styles.cardAccent
            }
          />

          <div
            className={
              styles.cardContent
            }
          >
            <div
              className={
                styles.cardBrand
              }
            >
              <Image
                src="/sbs-logo-black.png"
                alt="SBS"
                width={190}
                height={48}
                priority
                className={
                  styles.cardLogo
                }
              />
            </div>

            {trialStarted ? (
              /*
               * SUCCESS STATE
               *
               * This appears immediately after
               * the database successfully creates
               * the workspace and starts the trial.
               */
              <div
                style={{
                  textAlign: "center",
                  padding:
                    "36px 10px 28px",
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    margin:
                      "0 auto 22px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    background:
                      "#ecfdf3",
                    color:
                      "#16a34a",
                    fontSize: 36,
                    fontWeight: 700,
                    border:
                      "1px solid #bbf7d0",
                  }}
                  aria-hidden="true"
                >
                  ✓
                </div>

                <h2
                  style={{
                    margin:
                      "0 0 10px",
                    fontSize: 28,
                    lineHeight: 1.2,
                    fontWeight: 700,
                    color:
                      "#111827",
                  }}
                >
                  Your free trial has
                  started!
                </h2>

                <p
                  style={{
                    margin:
                      "0 auto 24px",
                    maxWidth: 440,
                    fontSize: 16,
                    lineHeight: 1.6,
                    color:
                      "#6b7280",
                  }}
                >
                  Your SBS workspace has
                  been created successfully.
                  You now have{" "}
                  <strong
                    style={{
                      color:
                        "#111827",
                    }}
                  >
                    14 days free
                  </strong>{" "}
                  to explore the platform.
                </p>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems:
                      "center",
                    gap: 8,
                    padding:
                      "10px 16px",
                    borderRadius: 999,
                    background:
                      "#f0fdf4",
                    border:
                      "1px solid #bbf7d0",
                    color:
                      "#15803d",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  <span
                    aria-hidden="true"
                  >
                    🎉
                  </span>

                  No payment required
                </div>

                <p
                  style={{
                    margin:
                      "24px 0 0",
                    fontSize: 13,
                    color:
                      "#9ca3af",
                  }}
                >
                  Taking you to your
                  workspace...
                </p>
              </div>
            ) : (
              <>
                <div
                  className={
                    styles.cardHeading
                  }
                >
                  <h2>
                    Create your workspace
                  </h2>

                  <p>
                    Start with the essential
                    information about your
                    business.
                  </p>
                </div>

                <form
                  className={
                    styles.onboardingForm
                  }
                  onSubmit={handleSubmit}
                >
                  {/* Company */}
                  <div
                    className={
                      styles.formField
                    }
                  >
                    <label htmlFor="companyName">
                      Company name
                    </label>

                    <div
                      className={
                        styles.inputWrapper
                      }
                    >
                      <input
                        id="companyName"
                        name="companyName"
                        type="text"
                        value={
                          companyName
                        }
                        onChange={(
                          event,
                        ) =>
                          setCompanyName(
                            event.target
                              .value,
                          )
                        }
                        placeholder="Your company name"
                        autoComplete="organization"
                        required
                        disabled={
                          submitting
                        }
                      />
                    </div>
                  </div>

                  {/* Business type */}
                  <div
                    className={
                      styles.formField
                    }
                  >
                    <label>
                      Business type
                    </label>

                    <div
                      className={
                        styles.businessTypeGrid
                      }
                    >
                      <button
                        type="button"
                        className={`${styles.businessTypeOption} ${
                          businessType ===
                          "product"
                            ? styles.businessTypeActive
                            : ""
                        }`}
                        onClick={() =>
                          setBusinessType(
                            "product",
                          )
                        }
                        disabled={
                          submitting
                        }
                      >
                        <span
                          className={
                            styles.businessTypeIcon
                          }
                        >
                          📦
                        </span>

                        <span>
                          <strong>
                            Products
                          </strong>

                          <small>
                            Inventory &amp;
                            product-based
                            business
                          </small>
                        </span>

                        <span
                          className={
                            styles.businessTypeCheck
                          }
                        >
                          {businessType ===
                          "product"
                            ? "✓"
                            : ""}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.businessTypeOption} ${
                          businessType ===
                          "service"
                            ? styles.businessTypeActive
                            : ""
                        }`}
                        onClick={() =>
                          setBusinessType(
                            "service",
                          )
                        }
                        disabled={
                          submitting
                        }
                      >
                        <span
                          className={
                            styles.businessTypeIcon
                          }
                        >
                          🔧
                        </span>

                        <span>
                          <strong>
                            Services
                          </strong>

                          <small>
                            Service &amp;
                            operations-based
                            business
                          </small>
                        </span>

                        <span
                          className={
                            styles.businessTypeCheck
                          }
                        >
                          {businessType ===
                          "service"
                            ? "✓"
                            : ""}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Phone */}
                  <div
                    className={
                      styles.formField
                    }
                  >
                    <label htmlFor="phone">
                      Business phone
                      <span
                        className={
                          styles.optional
                        }
                      >
                        Optional
                      </span>
                    </label>

                    <div
                      className={
                        styles.inputWrapper
                      }
                    >
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={phone}
                        onChange={(
                          event,
                        ) =>
                          setPhone(
                            event.target
                              .value,
                          )
                        }
                        placeholder="+971 50 000 0000"
                        autoComplete="tel"
                        disabled={
                          submitting
                        }
                      />
                    </div>
                  </div>

                  {/* Country + City */}
                  <div
                    className={
                      styles.formRow
                    }
                  >
                    <div
                      className={
                        styles.formField
                      }
                    >
                      <label htmlFor="country">
                        Country
                      </label>

                      <div
                        className={
                          styles.inputWrapper
                        }
                      >
                        <input
                          id="country"
                          name="country"
                          type="text"
                          value={
                            country
                          }
                          onChange={(
                            event,
                          ) =>
                            setCountry(
                              event.target
                                .value,
                            )
                          }
                          autoComplete="country-name"
                          disabled={
                            submitting
                          }
                        />
                      </div>
                    </div>

                    <div
                      className={
                        styles.formField
                      }
                    >
                      <label htmlFor="city">
                        City
                        <span
                          className={
                            styles.optional
                          }
                        >
                          Optional
                        </span>
                      </label>

                      <div
                        className={
                          styles.inputWrapper
                        }
                      >
                        <input
                          id="city"
                          name="city"
                          type="text"
                          value={city}
                          onChange={(
                            event,
                          ) =>
                            setCity(
                              event.target
                                .value,
                            )
                          }
                          placeholder="Dubai"
                          autoComplete="address-level2"
                          disabled={
                            submitting
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div
                    className={
                      styles.formField
                    }
                  >
                    <label htmlFor="address">
                      Business address
                      <span
                        className={
                          styles.optional
                        }
                      >
                        Optional
                      </span>
                    </label>

                    <div
                      className={
                        styles.inputWrapper
                      }
                    >
                      <input
                        id="address"
                        name="address"
                        type="text"
                        value={address}
                        onChange={(
                          event,
                        ) =>
                          setAddress(
                            event.target
                              .value,
                          )
                        }
                        placeholder="Street, building, area"
                        autoComplete="street-address"
                        disabled={
                          submitting
                        }
                      />
                    </div>
                  </div>

                  {/* TRN */}
                  <div
                    className={
                      styles.formField
                    }
                  >
                    <label htmlFor="trnNumber">
                      TRN number
                      <span
                        className={
                          styles.optional
                        }
                      >
                        Optional
                      </span>
                    </label>

                    <div
                      className={
                        styles.inputWrapper
                      }
                    >
                      <input
                        id="trnNumber"
                        name="trnNumber"
                        type="text"
                        value={
                          trnNumber
                        }
                        onChange={(
                          event,
                        ) =>
                          setTrnNumber(
                            event.target
                              .value,
                          )
                        }
                        placeholder="Tax registration number"
                        disabled={
                          submitting
                        }
                      />
                    </div>
                  </div>

                  {/* Trade license */}
                  <div
                    className={
                      styles.formField
                    }
                  >
                    <label htmlFor="tradeLicenseNumber">
                      Trade license number
                      <span
                        className={
                          styles.optional
                        }
                      >
                        Optional
                      </span>
                    </label>

                    <div
                      className={
                        styles.inputWrapper
                      }
                    >
                      <input
                        id="tradeLicenseNumber"
                        name="tradeLicenseNumber"
                        type="text"
                        value={
                          tradeLicenseNumber
                        }
                        onChange={(
                          event,
                        ) =>
                          setTradeLicenseNumber(
                            event.target
                              .value,
                          )
                        }
                        placeholder="Trade license number"
                        disabled={
                          submitting
                        }
                      />
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div
                      className={
                        styles.errorBox
                      }
                      role="alert"
                    >
                      <span
                        className={
                          styles.errorIcon
                        }
                      >
                        !
                      </span>

                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    className={
                      styles.submitButton
                    }
                    disabled={
                      submitting
                    }
                  >
                    {submitting ? (
                      <>
                        <span
                          className={
                            styles.buttonSpinner
                          }
                          aria-hidden="true"
                        />

                        Creating your
                        workspace...
                      </>
                    ) : (
                      <>
                        Start my 14-day free
                        trial

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

                  <p
                    className={
                      styles.formNote
                    }
                  >
                    No credit card required.
                    Your 14-day trial starts
                    when your workspace is
                    created.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className={
          styles.onboardingFooter
        }
      >
        <span>
          ©{" "}
          {new Date().getFullYear()}{" "}
          Sharif Business Solutions.
          All rights reserved.
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