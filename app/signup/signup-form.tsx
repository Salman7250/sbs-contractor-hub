"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type BusinessType = "product" | "service";

export default function SignupForm() {
  const [form, setForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
    phone: "",
    businessType: "service" as BusinessType,
    password: "",
    confirmPassword: "",
    country: "",
    agreeToTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateField(
    field: keyof typeof form,
    value: string | boolean
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function validate() {
    if (!form.fullName.trim()) {
      return "Please enter your full name.";
    }

    if (!form.companyName.trim()) {
      return "Please enter your company name.";
    }

    if (!form.email.trim()) {
      return "Please enter your email address.";
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      return "Please enter a valid email address.";
    }

    if (!form.country.trim()) {
      return "Please select your country.";
    }

    if (form.password.length < 8) {
      return "Your password must be at least 8 characters long.";
    }

    if (form.password !== form.confirmPassword) {
      return "Your passwords do not match.";
    }

    if (!form.agreeToTerms) {
      return "Please agree to the SBS Terms and Privacy Policy.";
    }

    return "";
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (loading) return;

    setError("");
    setSuccess("");

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/signup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            companyName: form.companyName.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim(),
            country: form.country.trim(),
            businessType: form.businessType,
            password: form.password,
            confirmPassword: form.confirmPassword,
            slug: generateSlug(form.companyName),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(
          result.error ||
            "Unable to create your SBS account. Please try again."
        );
        return;
      }

      setSuccess(
        result.message ||
          "Your SBS account has been created. Please check your email to continue."
      );

      setForm((current) => ({
        ...current,
        password: "",
        confirmPassword: "",
      }));
    } catch (requestError) {
      console.error(
        "Signup request error:",
        requestError
      );

      setError(
        "Something went wrong while creating your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const passwordLengthValid =
    form.password.length >= 8;

  const passwordsMatch =
    form.password.length > 0 &&
    form.password === form.confirmPassword;

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
    >
      {error && (
        <div
          className={styles.error}
          role="alert"
        >
          <span className={styles.errorIcon}>
            !
          </span>

          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          className={styles.success}
          role="status"
        >
          <span className={styles.successIcon}>
            ✓
          </span>

          <span>{success}</span>
        </div>
      )}

      {/* Personal information */}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionNumber}>
            01
          </span>

          <div>
            <div className={styles.sectionTitle}>
              Your details
            </div>

            <div className={styles.sectionDescription}>
              Tell us who will manage the SBS workspace.
            </div>
          </div>
        </div>

        <div className={styles.fields}>
          <div className={styles.fieldGroup}>
            <label
              htmlFor="fullName"
              className={styles.label}
            >
              Full name
            </label>

            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle
                    cx="12"
                    cy="8"
                    r="3.5"
                  />
                  <path d="M5 20c.8-3.4 3.1-5 7-5s6.2 1.6 7 5" />
                </svg>
              </span>

              <input
                id="fullName"
                name="fullName"
                type="text"
                value={form.fullName}
                onChange={(event) =>
                  updateField(
                    "fullName",
                    event.target.value
                  )
                }
                className={styles.input}
                placeholder="John Smith"
                autoComplete="name"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label
              htmlFor="email"
              className={styles.label}
            >
              Work email
            </label>

            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="2"
                  />
                  <path d="m4 7 8 6 8-6" />
                </svg>
              </span>

              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateField(
                    "email",
                    event.target.value
                  )
                }
                className={styles.input}
                placeholder="you@company.com"
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label
              htmlFor="phone"
              className={styles.label}
            >
              Phone
              <span className={styles.optional}>
                Optional
              </span>
            </label>

            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M7 4h3l1.5 4-2 1.5c1 2.1 2.4 3.5 4.5 4.5l1.5-2 4 1.5v3c0 1.1-.9 2-2 2C10.9 18.5 5.5 13.1 5.5 6 5.5 4.9 6.4 4 7.5 4Z" />
                </svg>
              </span>

              <input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  updateField(
                    "phone",
                    event.target.value
                  )
                }
                className={styles.input}
                placeholder="+971 50 123 4567"
                autoComplete="tel"
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label
              htmlFor="country"
              className={styles.label}
            >
              Country
            </label>

            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                  />
                  <path d="M3 12h18" />
                  <path d="M12 3c2.2 2.4 3.4 5.4 3.4 9s-1.2 6.6-3.4 9c-2.2-2.4-3.4-5.4-3.4-9S9.8 5.4 12 3Z" />
                </svg>
              </span>

              <select
                id="country"
                name="country"
                value={form.country}
                onChange={(event) =>
                  updateField(
                    "country",
                    event.target.value
                  )
                }
                className={styles.select}
                disabled={loading}
                required
              >
                <option value="">
                  Select country
                </option>

                <option value="United Arab Emirates">
                  United Arab Emirates
                </option>

                <option value="United States">
                  United States
                </option>

                <option value="Canada">
                  Canada
                </option>

                <option value="United Kingdom">
                  United Kingdom
                </option>

                <option value="Australia">
                  Australia
                </option>

                <option value="Pakistan">
                  Pakistan
                </option>

                <option value="Saudi Arabia">
                  Saudi Arabia
                </option>

                <option value="Qatar">
                  Qatar
                </option>

                <option value="Kuwait">
                  Kuwait
                </option>

                <option value="Bahrain">
                  Bahrain
                </option>

                <option value="Oman">
                  Oman
                </option>

                <option value="India">
                  India
                </option>

                <option value="Germany">
                  Germany
                </option>

                <option value="Netherlands">
                  Netherlands
                </option>

                <option value="Other">
                  Other
                </option>
              </select>

              <span className={styles.selectArrow}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m7 10 5 5 5-5" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Company */}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionNumber}>
            02
          </span>

          <div>
            <div className={styles.sectionTitle}>
              Your business
            </div>

            <div className={styles.sectionDescription}>
              This becomes your SBS workspace.
            </div>
          </div>
        </div>

        <div className={styles.fields}>
          <div className={styles.fieldGroup}>
            <label
              htmlFor="companyName"
              className={styles.label}
            >
              Company name
            </label>

            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M4 20V6l8-3 8 3v14" />
                  <path d="M2 20h20" />
                  <path d="M8 8h1" />
                  <path d="M15 8h1" />
                  <path d="M8 12h1" />
                  <path d="M15 12h1" />
                  <path d="M10 20v-4h4v4" />
                </svg>
              </span>

              <input
                id="companyName"
                name="companyName"
                type="text"
                value={form.companyName}
                onChange={(event) =>
                  updateField(
                    "companyName",
                    event.target.value
                  )
                }
                className={styles.input}
                placeholder="Your Company LLC"
                autoComplete="organization"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className={styles.businessTypeField}>
            <div className={styles.label}>
              What does your business do?
            </div>

            <div className={styles.businessTypes}>
              <button
                type="button"
                className={`${styles.businessType} ${
                  form.businessType === "product"
                    ? styles.businessTypeActive
                    : ""
                }`}
                onClick={() =>
                  updateField(
                    "businessType",
                    "product"
                  )
                }
                disabled={loading}
              >
                <span
                  className={
                    styles.businessTypeIcon
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path d="m4 7 8-4 8 4-8 4-8-4Z" />
                    <path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z" />
                    <path d="m12 11v10" />
                  </svg>
                </span>

                <span>
                  <strong>
                    Product business
                  </strong>

                  <small>
                    Products, retail, wholesale,
                    e-commerce & inventory
                  </small>
                </span>

                <span
                  className={
                    styles.radioIndicator
                  }
                >
                  {form.businessType ===
                    "product" && (
                    <span />
                  )}
                </span>
              </button>

              <button
                type="button"
                className={`${styles.businessType} ${
                  form.businessType === "service"
                    ? styles.businessTypeActive
                    : ""
                }`}
                onClick={() =>
                  updateField(
                    "businessType",
                    "service"
                  )
                }
                disabled={loading}
              >
                <span
                  className={
                    styles.businessTypeIcon
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.8-2.8 1.9-2.3Z" />
                  </svg>
                </span>

                <span>
                  <strong>
                    Service business
                  </strong>

                  <small>
                    Contractors, field service,
                    repair & professional services
                  </small>
                </span>

                <span
                  className={
                    styles.radioIndicator
                  }
                >
                  {form.businessType ===
                    "service" && (
                    <span />
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Password */}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionNumber}>
            03
          </span>

          <div>
            <div className={styles.sectionTitle}>
              Secure your account
            </div>

            <div className={styles.sectionDescription}>
              Create the password you'll use to sign in.
            </div>
          </div>
        </div>

        <div className={styles.fields}>
          <div className={styles.fieldGroup}>
            <label
              htmlFor="password"
              className={styles.label}
            >
              Password
            </label>

            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect
                    x="4"
                    y="10"
                    width="16"
                    height="10"
                    rx="2"
                  />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>

              <input
                id="password"
                name="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={form.password}
                onChange={(event) =>
                  updateField(
                    "password",
                    event.target.value
                  )
                }
                className={styles.input}
                placeholder="Create a secure password"
                autoComplete="new-password"
                disabled={loading}
                required
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
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                    <path d="M9.9 5.1A10.7 10.7 0 0 1 12 5c5 0 8.5 4.3 9.5 7-.4 1.1-1.3 2.7-2.7 4" />
                    <path d="M6.2 6.2C4.2 7.6 2.9 9.8 2.5 12c.9 2.7 4.5 7 9.5 7 1.2 0 2.3-.2 3.3-.6" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                    <circle
                      cx="12"
                      cy="12"
                      r="2.5"
                    />
                  </svg>
                )}
              </button>
            </div>

            <div className={styles.requirements}>
              <div
                className={`${styles.requirement} ${
                  passwordLengthValid
                    ? styles.requirementValid
                    : ""
                }`}
              >
                <span
                  className={
                    styles.requirementIcon
                  }
                >
                  {passwordLengthValid
                    ? "✓"
                    : "•"}
                </span>

                At least 8 characters
              </div>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label
              htmlFor="confirmPassword"
              className={styles.label}
            >
              Confirm password
            </label>

            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect
                    x="4"
                    y="10"
                    width="16"
                    height="10"
                    rx="2"
                  />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>

              <input
                id="confirmPassword"
                name="confirmPassword"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                value={form.confirmPassword}
                onChange={(event) =>
                  updateField(
                    "confirmPassword",
                    event.target.value
                  )
                }
                className={styles.input}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                disabled={loading}
                required
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
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                    <path d="M9.9 5.1A10.7 10.7 0 0 1 12 5c5 0 8.5 4.3 9.5 7-.4 1.1-1.3 2.7-2.7 4" />
                    <path d="M6.2 6.2C4.2 6.2 2.9 9.8 2.5 12c.9 2.7 4.5 7 9.5 7 1.2 0 2.3-.2 3.3-.6" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                    <circle
                      cx="12"
                      cy="12"
                      r="2.5"
                    />
                  </svg>
                )}
              </button>
            </div>

            <div className={styles.requirements}>
              <div
                className={`${styles.requirement} ${
                  passwordsMatch
                    ? styles.requirementValid
                    : ""
                }`}
              >
                <span
                  className={
                    styles.requirementIcon
                  }
                >
                  {passwordsMatch
                    ? "✓"
                    : "•"}
                </span>

                Passwords match
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terms */}

      <label className={styles.terms}>
        <input
          type="checkbox"
          checked={form.agreeToTerms}
          onChange={(event) =>
            updateField(
              "agreeToTerms",
              event.target.checked
            )
          }
          disabled={loading}
          required
        />

        <span className={styles.checkbox}>
          {form.agreeToTerms && "✓"}
        </span>

        <span className={styles.termsText}>
          I agree to the{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        className={styles.submitButton}
        disabled={loading}
      >
        {loading ? (
          <>
            <span
              className={styles.spinner}
              aria-hidden="true"
            />

            Creating your workspace...
          </>
        ) : (
          <>
            Create my SBS workspace

            <svg
              className={styles.buttonArrow}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </>
        )}
      </button>

      <div className={styles.loginPrompt}>
        Already have an SBS account?

        <Link href="/login">
          Sign in
        </Link>
      </div>
    </form>
  );
}