"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

const CONFIRMATION_PATH = "/auth/confirm";

type SignupPlatformPolicy = {
  new_company_signups_enabled: boolean;
  require_email_verification: boolean;
  default_trial_days: number;
};

type SelectedPlan = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

export default function SignupForm() {
  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerificationRequired, setEmailVerificationRequired] =
    useState(true);

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");

    /*
     * Read the current public signup policy before creating the
     * account. The database onboarding RPC remains the final
     * server-side authority for new company creation.
     */
    const {
      data: platformPolicy,
      error: platformPolicyError,
    } = await supabase.rpc(
      "get_signup_platform_policy",
    );

    if (platformPolicyError) {
      console.error(
        "Signup platform policy error:",
        platformPolicyError,
      );

      setError(
        "We could not verify signup availability. Please try again.",
      );
      return;
    }

    const policy =
      platformPolicy as SignupPlatformPolicy | null;

    if (policy && !policy.new_company_signups_enabled) {
      setError(
        "New company signups are currently disabled. Please try again later.",
      );
      return;
    }

    setEmailVerificationRequired(
      policy?.require_email_verification !== false,
    );

    const trimmedFullName = fullName.trim();
    const trimmedCompanyName = companyName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    /*
     * ---------------------------------------------------------
     * Get selected plan from the signup URL.
     *
     * Example:
     * /signup?plan=professional
     * ---------------------------------------------------------
     */
    const searchParams =
      new URLSearchParams(window.location.search);

    const selectedPlanSlug =
  searchParams.get("plan")?.trim().toLowerCase() ||
  "starter";

    if (!trimmedFullName) {
      setError("Please enter your full name.");
      return;
    }

    if (!trimmedCompanyName) {
      setError("Please enter your company name.");
      return;
    }

    if (!businessType) {
      setError("Please select your business type.");
      return;
    }

    if (password.length < 8) {
      setError(
        "Your password must contain at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    /*
     * ---------------------------------------------------------
     * Verify the selected plan before creating the account.
     *
     * The signup URL contains the plan slug.
     * We resolve the active plan from the database.
     * ---------------------------------------------------------
     */
    const {
      data: plan,
      error: planError,
    } = await supabase
      .from("plans")
      .select(
        `
          id,
          name,
          slug,
          is_active
        `
      )
      .eq("slug", selectedPlanSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (planError) {
      setError(
        "We could not verify the selected plan. Please try again."
      );
      setLoading(false);
      return;
    }

    if (!plan) {
      setError(
        "The selected plan is no longer available. Please return to pricing and choose another plan."
      );
      setLoading(false);
      return;
    }

    const selectedPlan =
      plan as SelectedPlan;

    /*
     * ---------------------------------------------------------
     * Confirmation URL
     *
     * Keep the selected plan slug in the confirmation URL so
     * the confirmation route can preserve it.
     * ---------------------------------------------------------
     */
    const redirectUrl =
      `${window.location.origin}${CONFIRMATION_PATH}?plan=${encodeURIComponent(
        selectedPlan.slug
      )}`;

    /*
     * ---------------------------------------------------------
     * Create Supabase Auth account
     * ---------------------------------------------------------
     */
    const {
      data,
      error: authError,
    } =
      await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: redirectUrl,

          data: {
            full_name: trimmedFullName,
            company_name: trimmedCompanyName,
            business_type: businessType,

            /*
             * Preserve selected plan information in the
             * Supabase Auth user metadata.
             */
            selected_plan_slug:
              selectedPlan.slug,

            selected_plan_id:
              selectedPlan.id,

            selected_plan_name:
              selectedPlan.name,
          },
        },
      });

    if (authError) {
      setError(
        authError.message ===
          "User already registered"
          ? "An account with this email already exists. Please sign in instead."
          : authError.message
      );

      setLoading(false);
      return;
    }

    if (!data.user) {
      setError(
        "Unable to create your account. Please try again."
      );

      setLoading(false);
      return;
    }

    /*
     * When the platform policy does not require verification and
     * Supabase returned an active session, continue directly to
     * onboarding. Otherwise show the existing confirmation state.
     *
     * Supabase Auth project-level confirmation settings can still
     * require verification independently of this application
     * setting, so we never claim that verification was bypassed
     * unless an active session is actually available.
     */
    if (
      policy?.require_email_verification === false &&
      data.session
    ) {
      window.location.href = "/onboarding";
      return;
    }

    setEmailSent(true);
    setLoading(false);
  }

  if (emailSent) {
    return (
      <div className={styles.signupSuccess}>
        <div className={styles.successIcon}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M4 5h16v14H4z" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        </div>

        {emailVerificationRequired ? (
          <h3>Check your email</h3>
        ) : (
          <h3>Your account is ready</h3>
        )}

        {emailVerificationRequired ? (
          <>
            <p>
              We sent a confirmation link to{" "}
              <strong>{email.trim()}</strong>.
            </p>

            <p className={styles.successSecondary}>
              Open the email and click the confirmation
              link to activate your SBS account.
            </p>
          </>
        ) : (
          <>
            <p>
              Your SBS account has been created successfully.
            </p>

            <p className={styles.successSecondary}>
              Sign in to continue to your workspace.
            </p>
          </>
        )}

        <div className={styles.successActions}>
          <Link
            href="/login"
            className={styles.secondaryAction}
          >
            Back to sign in
          </Link>
        </div>

        {emailVerificationRequired && (
          <p className={styles.successHelp}>
            Didn&apos;t receive it? Check your spam or
            junk folder.
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      className={styles.signupForm}
      onSubmit={handleSignup}
    >
      {/* Full Name */}
      <div className={styles.formField}>
        <label htmlFor="fullName">
          Full name
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
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>

          <input
            id="fullName"
            name="fullName"
            type="text"
            value={fullName}
            onChange={(event) =>
              setFullName(event.target.value)
            }
            placeholder="Your full name"
            autoComplete="name"
            required
            disabled={loading}
          />
        </div>
      </div>

      {/* Company */}
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
            <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
            <path d="M16 9h4a1 1 0 0 1 1 1v11" />
            <path d="M8 7h4" />
            <path d="M8 11h4" />
            <path d="M8 15h4" />
            <path d="M8 19h4" />
            <path d="M2 21h20" />
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
            disabled={loading}
          />
        </div>
      </div>

      {/* Business Type */}
      <div className={styles.formField}>
        <label htmlFor="businessType">
          Business type
        </label>

        <div className={styles.selectWrapper}>
          <svg
            className={styles.inputIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M3 21h18" />
            <path d="M5 21V7l7-4 7 4v14" />
            <path d="M9 21v-5h6v5" />
            <path d="M8 10h1" />
            <path d="M15 10h1" />
            <path d="M8 13h1" />
            <path d="M15 13h1" />
          </svg>

          <select
            id="businessType"
            name="businessType"
            value={businessType}
            onChange={(event) =>
              setBusinessType(event.target.value)
            }
            required
            disabled={loading}
          >
            <option value="">
              Select your business type
            </option>

            <option value="retail">
              Retail & E-commerce
            </option>

            <option value="wholesale">
              Wholesale & Distribution
            </option>

            <option value="it_technology">
              IT & Technology
            </option>

            <option value="repair">
              Repair & Refurbishment
            </option>

            <option value="professional_services">
              Professional Services
            </option>

            <option
              value="service_business"
              disabled
            >
              Service Business — Coming Soon
            </option>
          </select>

          <svg
            className={styles.selectArrow}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Email */}
      <div className={styles.formField}>
        <label htmlFor="email">
          Email address
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
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2"
            />
            <path d="m3 7 9 6 9-6" />
          </svg>

          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="you@company.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            disabled={loading}
          />
        </div>
      </div>

      {/* Password */}
      <div className={styles.formField}>
        <label htmlFor="password">
          Password
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
              x="5"
              y="10"
              width="14"
              height="11"
              rx="2"
            />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>

          <input
            id="password"
            name="password"
            type={
              showPassword
                ? "text"
                : "password"
            }
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Create a password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={loading}
          />

          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() =>
              setShowPassword(
                (current) => !current
              )
            }
            aria-label={
              showPassword
                ? "Hide password"
                : "Show password"
            }
            disabled={loading}
          >
            {showPassword ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M3 3l18 18" />
                <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83" />
                <path d="M9.88 4.24A10.4 10.4 0 0 1 12 4c5 0 8.73 4.11 10 8a14.5 14.5 0 0 1-3.04 5.06" />
                <path d="M6.61 6.61C4.62 7.95 3.26 10.04 2 12c1.27 3.89 5 8 10 8a10.3 10.3 0 0 0 3.58-.63" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                />
              </svg>
            )}
          </button>
        </div>

        <p className={styles.fieldHint}>
          Use at least 8 characters.
        </p>
      </div>

      {/* Confirm Password */}
      <div className={styles.formField}>
        <label htmlFor="confirmPassword">
          Confirm password
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
            <path d="m5 12 4 4L19 6" />
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="3"
            />
          </svg>

          <input
            id="confirmPassword"
            name="confirmPassword"
            type={
              showConfirmPassword
                ? "text"
                : "password"
            }
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(
                event.target.value
              )
            }
            placeholder="Enter your password again"
            autoComplete="new-password"
            required
            disabled={loading}
          />

          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() =>
              setShowConfirmPassword(
                (current) => !current
              )
            }
            aria-label={
              showConfirmPassword
                ? "Hide password"
                : "Show password"
            }
            disabled={loading}
          >
            {showConfirmPassword ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M3 3l18 18" />
                <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83" />
                <path d="M9.88 4.24A10.4 10.4 0 0 1 12 4c5 0 8.73 4.11 10 8a14.5 14.5 0 0 1-3.04 5.06" />
                <path d="M6.61 6.61C4.62 6.61 2 10.04 2 12c1.27 3.89 5 8 10 8a10.3 10.3 0 0 0 3.58-.63" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
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
            <circle
              cx="12"
              cy="12"
              r="9"
            />
            <path d="M12 8v5" />
            <path d="M12 16.5h.01" />
          </svg>

          <span>{error}</span>
        </div>
      )}

      {/* Terms */}
      <p className={styles.termsText}>
        By creating an account, you agree to our{" "}
        <Link href="https://www.sharifbusinesssolutions.com/terms">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="https://www.sharifbusinesssolutions.com/privacy">
          Privacy Policy
        </Link>
        .
      </p>

      {/* Submit */}
      <button
        type="submit"
        className={styles.loginSubmit}
        disabled={loading}
      >
        {loading ? (
          <>
            <span
              className={styles.buttonSpinner}
              aria-hidden="true"
            />

            <span>
              Creating your account...
            </span>
          </>
        ) : (
          <>
            <span>
              Create your SBS account
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

      {/* Existing account */}
      <p className={styles.accountPrompt}>
        Already have an account?{" "}
        <Link href="/login">
          Sign in
        </Link>
      </p>
    </form>
  );
}