"use client";

import {
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] =
    useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const passwordChecks = useMemo(() => {
    return {
      length: password.length >= 8,
      match:
        password.length > 0 &&
        password === confirmPassword,
    };
  }, [password, confirmPassword]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (loading) return;

    setError("");

    if (password.length < 8) {
      setError(
        "Your password must be at least 8 characters long.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "The passwords do not match.",
      );
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      /*
       * Make sure the invitation created a valid
       * authenticated session before changing the password.
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError(
          "Your invitation session is missing or has expired. Please request a new invitation.",
        );
        setLoading(false);
        return;
      }

      /*
       * Set the password for the authenticated
       * invitation user.
       */
      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        console.error(
          "Password setup error:",
          updateError,
        );

        setError(updateError.message);
        setLoading(false);
        return;
      }

      /*
       * The employee was created with status = invited.
       *
       * Once they successfully create their password,
       * activate their own employee account.
       *
       * The database function only allows the currently
       * authenticated user to activate their own record.
       */
      const { error: activationError } =
        await supabase.rpc(
          "employee_activate_my_account",
        );

      if (activationError) {
        console.error(
          "Employee activation error:",
          activationError,
        );

        setError(
          "Your password was created, but your employee account could not be activated. Please contact your administrator.",
        );

        setLoading(false);
        return;
      }

      /*
       * Use the production SBS application domain when
       * running on the deployed application.
       *
       * During local development, keep localhost.
       */
      const appUrl =
        window.location.hostname === "localhost"
          ? window.location.origin
          : "https://app.sharifbusinesssolutions.com";

      window.location.replace(appUrl);
    } catch (err) {
      console.error(
        "Password setup error:",
        err,
      );

      setError(
        "Something went wrong while setting up your account. Please try again.",
      );

      setLoading(false);
    }
  }

  return (
    <main className="sbs-password-page">
      {/* =====================================================
          BACKGROUND
      ====================================================== */}

      <div className="sbs-password-background">
        <div className="sbs-password-orb sbs-password-orb-one" />
        <div className="sbs-password-orb sbs-password-orb-two" />
        <div className="sbs-password-grid" />

        <div className="sbs-password-glow" />
      </div>

      {/* =====================================================
          MAIN CARD
      ====================================================== */}

      <section className="sbs-password-card">
        {/* ===================================================
            BRAND
        ==================================================== */}

        <div className="sbs-password-brand">
          <div className="sbs-password-logo">
            <span>S</span>
            <span>B</span>
            <span>S</span>
          </div>

          <div className="sbs-password-brand-copy">
            <div className="sbs-password-brand-name">
              Sharif Business Solutions
            </div>

            <div className="sbs-password-product">
              SBS Workspace
            </div>
          </div>
        </div>

        {/* ===================================================
            ICON
        ==================================================== */}

        <div className="sbs-password-icon-area">
          <div className="sbs-password-icon-ring">
            <div className="sbs-password-icon">
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

        {/* ===================================================
            HEADING
        ==================================================== */}

        <div className="sbs-password-heading">
          <div className="sbs-password-eyebrow">
            ACCOUNT SETUP
          </div>

          <h1>Create your password</h1>

          <p>
            Welcome to your SBS Workspace. Create a
            secure password below to activate your
            account and get started.
          </p>
        </div>

        {/* ===================================================
            FORM
        ==================================================== */}

        <form
          onSubmit={handleSubmit}
          className="sbs-password-form"
          noValidate
        >
          {/* PASSWORD */}

          <div className="sbs-password-field">
            <div className="sbs-password-label-row">
              <label htmlFor="password">
                Password
              </label>

              <span className="sbs-password-secure">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>

                Secure
              </span>
            </div>

            <div className="sbs-password-input-container">
              <div className="sbs-password-input-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
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

              <input
                id="password"
                name="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) => {
                  setPassword(
                    event.target.value,
                  );

                  if (error) {
                    setError("");
                  }
                }}
                placeholder="Create a secure password"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={loading}
              />

              <button
                type="button"
                className="sbs-password-eye"
                onClick={() =>
                  setShowPassword(
                    (current) => !current,
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
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c5.2 0 9 4.3 10 8-0.4 1.7-1.4 3.1-2.7 4.4" />
                    <path d="M6.2 6.2C4.4 7.5 3.3 9.4 2 12c1 3.7 4.8 8 10 8 1 0 2-.2 2.9-.5" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
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

            <div className="sbs-password-requirements">
              <div
                className={
                  passwordChecks.length
                    ? "sbs-requirement active"
                    : "sbs-requirement"
                }
              >
                <span>
                  {passwordChecks.length
                    ? "✓"
                    : "•"}
                </span>

                At least 8 characters
              </div>
            </div>
          </div>

          {/* CONFIRM PASSWORD */}

          <div className="sbs-password-field">
            <div className="sbs-password-label-row">
              <label htmlFor="confirm-password">
                Confirm password
              </label>
            </div>

            <div className="sbs-password-input-container">
              <div className="sbs-password-input-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
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

              <input
                id="confirm-password"
                name="confirm-password"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(
                    event.target.value,
                  );

                  if (error) {
                    setError("");
                  }
                }}
                placeholder="Enter your password again"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={loading}
              />

              <button
                type="button"
                className="sbs-password-eye"
                onClick={() =>
                  setShowConfirmPassword(
                    (current) => !current,
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
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c5.2 0 9 4.3 10 8-0.4 1.7-1.4 3.1-2.7 4.4" />
                    <path d="M6.2 6.2C4.4 7.5 3.3 9.4 2 12c1 3.7 4.8 8 10 8 1 0 2-.2 2.9-.5" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
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

            {confirmPassword.length > 0 && (
              <div
                className={
                  passwordChecks.match
                    ? "sbs-password-match success"
                    : "sbs-password-match"
                }
              >
                <span>
                  {passwordChecks.match
                    ? "✓"
                    : "!"}
                </span>

                {passwordChecks.match
                  ? "Passwords match"
                  : "Passwords do not match"}
              </div>
            )}
          </div>

          {/* ERROR */}

          {error && (
            <div
              className="sbs-password-error"
              role="alert"
            >
              <div className="sbs-password-error-icon">
                !
              </div>

              <div className="sbs-password-error-content">
                <strong>
                  Unable to complete setup
                </strong>

                <span>{error}</span>
              </div>
            </div>
          )}

          {/* SUBMIT */}

          <button
            type="submit"
            className="sbs-password-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="sbs-password-spinner" />
                <span>
                  Activating your account...
                </span>
              </>
            ) : (
              <>
                <span>
                  Activate my account
                </span>

                <span className="sbs-password-arrow">
                  →
                </span>
              </>
            )}
          </button>
        </form>

        {/* ===================================================
            SECURITY INFORMATION
        ==================================================== */}

        <div className="sbs-password-security">
          <div className="sbs-password-security-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>

          <div>
            <strong>
              Secure account setup
            </strong>

            <span>
              Your password is securely managed
              through Supabase authentication.
            </span>
          </div>
        </div>

        {/* ===================================================
            FOOTER
        ==================================================== */}

        <div className="sbs-password-footer">
          <span>
            Sharif Business Solutions
          </span>

          <span className="sbs-password-footer-dot">
            •
          </span>

          <span>
            Secure workspace access
          </span>
        </div>
      </section>

      {/* =====================================================
          PAGE CSS
      ====================================================== */}

      <style jsx>{`
        .sbs-password-page {
          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 50% 0%,
              rgba(16, 185, 129, 0.08),
              transparent 34%
            ),
            #060a0f;
          color: #e2e8f0;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .sbs-password-background {
          position: fixed;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .sbs-password-orb {
          position: absolute;
          border-radius: 999px;
          filter: blur(2px);
        }

        .sbs-password-orb-one {
          top: -220px;
          left: -180px;
          width: 520px;
          height: 520px;
          background: rgba(16, 185, 129, 0.065);
          filter: blur(80px);
        }

        .sbs-password-orb-two {
          right: -220px;
          bottom: -250px;
          width: 560px;
          height: 560px;
          background: rgba(16, 185, 129, 0.045);
          filter: blur(90px);
        }

        .sbs-password-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 720px;
          height: 720px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.018);
          filter: blur(80px);
        }

        .sbs-password-grid {
          position: absolute;
          inset: 0;
          opacity: 0.22;
          background-image:
            linear-gradient(
              rgba(148, 163, 184, 0.035) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(148, 163, 184, 0.035) 1px,
              transparent 1px
            );
          background-size: 44px 44px;
        }

        .sbs-password-card {
          position: relative;
          z-index: 2;
          width: min(100%, 510px);
          padding: 32px 38px 26px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 22px;
          background:
            linear-gradient(
              145deg,
              rgba(15, 23, 42, 0.96),
              rgba(8, 13, 19, 0.97)
            );
          box-shadow:
            0 32px 90px rgba(0, 0, 0, 0.42),
            0 0 0 1px rgba(255, 255, 255, 0.015)
              inset,
            0 1px 0 rgba(255, 255, 255, 0.035)
              inset;
          backdrop-filter: blur(24px);
        }

        .sbs-password-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .sbs-password-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1px;
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          border: 1px solid
            rgba(16, 185, 129, 0.28);
          border-radius: 11px;
          background:
            linear-gradient(
              145deg,
              rgba(16, 185, 129, 0.16),
              rgba(16, 185, 129, 0.05)
            );
          color: #34d399;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: -0.08em;
          box-shadow:
            0 8px 22px rgba(16, 185, 129, 0.08),
            inset 0 1px 0
              rgba(255, 255, 255, 0.06);
        }

        .sbs-password-logo span:nth-child(2) {
          transform: translateY(-1px);
        }

        .sbs-password-brand-name {
          color: #f1f5f9;
          font-size: 13px;
          font-weight: 750;
          letter-spacing: -0.015em;
        }

        .sbs-password-product {
          margin-top: 2px;
          color: #64748b;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.03em;
        }

        .sbs-password-icon-area {
          display: flex;
          justify-content: center;
          margin-top: 27px;
          margin-bottom: 18px;
        }

        .sbs-password-icon-ring {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 66px;
          height: 66px;
          border: 1px solid
            rgba(16, 185, 129, 0.14);
          border-radius: 20px;
          background: rgba(16, 185, 129, 0.035);
        }

        .sbs-password-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border: 1px solid
            rgba(16, 185, 129, 0.23);
          border-radius: 16px;
          background:
            linear-gradient(
              145deg,
              rgba(16, 185, 129, 0.13),
              rgba(16, 185, 129, 0.045)
            );
          color: #10b981;
          box-shadow:
            0 10px 28px
              rgba(16, 185, 129, 0.08),
            inset 0 1px 0
              rgba(255, 255, 255, 0.05);
        }

        .sbs-password-icon svg {
          width: 25px;
          height: 25px;
        }

        .sbs-password-heading {
          text-align: center;
        }

        .sbs-password-eyebrow {
          margin-bottom: 7px;
          color: #10b981;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.2em;
        }

        .sbs-password-heading h1 {
          margin: 0;
          color: #f8fafc;
          font-size: 28px;
          font-weight: 750;
          line-height: 1.15;
          letter-spacing: -0.035em;
        }

        .sbs-password-heading p {
          max-width: 420px;
          margin: 11px auto 0;
          color: #718096;
          font-size: 12px;
          line-height: 1.7;
        }

        .sbs-password-form {
          margin-top: 27px;
        }

        .sbs-password-field {
          margin-bottom: 17px;
        }

        .sbs-password-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 18px;
          margin-bottom: 7px;
        }

        .sbs-password-label-row label {
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 650;
        }

        .sbs-password-secure {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #10b981;
          font-size: 9px;
          font-weight: 650;
        }

        .sbs-password-secure svg {
          width: 12px;
          height: 12px;
        }

        .sbs-password-input-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .sbs-password-input-icon {
          position: absolute;
          left: 14px;
          z-index: 2;
          display: flex;
          color: #526173;
          pointer-events: none;
        }

        .sbs-password-input-icon svg {
          width: 17px;
          height: 17px;
        }

        .sbs-password-input-container input {
          width: 100%;
          height: 48px;
          padding: 0 47px 0 42px;
          border: 1px solid
            rgba(100, 116, 139, 0.2);
          border-radius: 11px;
          outline: none;
          background: rgba(2, 6, 12, 0.52);
          color: #f1f5f9;
          font-size: 12px;
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        .sbs-password-input-container input::placeholder {
          color: #4b586a;
        }

        .sbs-password-input-container input:hover {
          border-color: rgba(100, 116, 139, 0.32);
        }

        .sbs-password-input-container input:focus {
          border-color: rgba(16, 185, 129, 0.48);
          background: rgba(2, 6, 12, 0.72);
          box-shadow:
            0 0 0 3px
              rgba(16, 185, 129, 0.075),
            0 8px 25px rgba(0, 0, 0, 0.12);
        }

        .sbs-password-input-container input:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .sbs-password-eye {
          position: absolute;
          right: 10px;
          top: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 31px;
          height: 31px;
          padding: 0;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #596779;
          cursor: pointer;
          transform: translateY(-50%);
          transition:
            color 150ms ease,
            background 150ms ease;
        }

        .sbs-password-eye:hover {
          color: #10b981;
          background: rgba(16, 185, 129, 0.07);
        }

        .sbs-password-eye:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .sbs-password-eye svg {
          width: 17px;
          height: 17px;
        }

        .sbs-password-requirements {
          margin-top: 7px;
        }

        .sbs-requirement {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #526173;
          font-size: 9px;
          transition: color 150ms ease;
        }

        .sbs-requirement span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          font-size: 9px;
        }

        .sbs-requirement.active {
          color: #10b981;
        }

        .sbs-password-match {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 7px;
          color: #f59e0b;
          font-size: 9px;
        }

        .sbs-password-match.success {
          color: #10b981;
        }

        .sbs-password-match span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: rgba(245, 158, 11, 0.1);
          font-size: 9px;
          font-weight: 800;
        }

        .sbs-password-match.success span {
          background: rgba(16, 185, 129, 0.1);
        }

        .sbs-password-error {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin: 5px 0 14px;
          padding: 12px;
          border: 1px solid
            rgba(239, 68, 68, 0.16);
          border-radius: 11px;
          background: rgba(127, 29, 29, 0.1);
        }

        .sbs-password-error-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.14);
          color: #f87171;
          font-size: 11px;
          font-weight: 800;
        }

        .sbs-password-error-content strong,
        .sbs-password-error-content span {
          display: block;
        }

        .sbs-password-error-content strong {
          margin-bottom: 2px;
          color: #fca5a5;
          font-size: 10px;
          font-weight: 700;
        }

        .sbs-password-error-content span {
          color: #a8b3c2;
          font-size: 10px;
          line-height: 1.5;
        }

        .sbs-password-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          height: 48px;
          margin-top: 3px;
          padding: 0 18px;
          border: 1px solid
            rgba(16, 185, 129, 0.38);
          border-radius: 11px;
          background:
            linear-gradient(
              135deg,
              #10b981,
              #059669
            );
          color: #ecfdf5;
          font-size: 12px;
          font-weight: 750;
          letter-spacing: -0.01em;
          cursor: pointer;
          box-shadow:
            0 10px 28px
              rgba(16, 185, 129, 0.14),
            inset 0 1px 0
              rgba(255, 255, 255, 0.14);
          transition:
            transform 150ms ease,
            box-shadow 150ms ease,
            filter 150ms ease;
        }

        .sbs-password-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.04);
          box-shadow:
            0 14px 34px
              rgba(16, 185, 129, 0.2),
            inset 0 1px 0
              rgba(255, 255, 255, 0.14);
        }

        .sbs-password-submit:active:not(:disabled) {
          transform: translateY(0);
        }

        .sbs-password-submit:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .sbs-password-arrow {
          font-size: 17px;
          line-height: 1;
          transition: transform 150ms ease;
        }

        .sbs-password-submit:hover
          .sbs-password-arrow {
          transform: translateX(3px);
        }

        .sbs-password-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid
            rgba(236, 253, 245, 0.28);
          border-top-color: #ecfdf5;
          border-radius: 50%;
          animation:
            sbs-password-spin 700ms linear infinite;
        }

        @keyframes sbs-password-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .sbs-password-security {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          padding: 11px 12px;
          border: 1px solid
            rgba(148, 163, 184, 0.1);
          border-radius: 11px;
          background: rgba(15, 23, 42, 0.38);
        }

        .sbs-password-security-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          width: 32px;
          height: 32px;
          border-radius: 9px;
          background: rgba(16, 185, 129, 0.08);
          color: #10b981;
        }

        .sbs-password-security-icon svg {
          width: 17px;
          height: 17px;
        }

        .sbs-password-security strong {
          display: block;
          margin-bottom: 2px;
          color: #cbd5e1;
          font-size: 10px;
          font-weight: 700;
        }

        .sbs-password-security span {
          display: block;
          color: #586679;
          font-size: 9px;
          line-height: 1.45;
        }

        .sbs-password-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-top: 20px;
          color: #475569;
          font-size: 9px;
        }

        .sbs-password-footer-dot {
          color: #334155;
        }

        @media (max-width: 640px) {
          .sbs-password-page {
            align-items: flex-start;
            padding: 18px 14px;
          }

          .sbs-password-card {
            width: 100%;
            padding: 25px 20px 22px;
            border-radius: 18px;
          }

          .sbs-password-brand-name {
            font-size: 12px;
          }

          .sbs-password-icon-area {
            margin-top: 23px;
          }

          .sbs-password-heading h1 {
            font-size: 25px;
          }

          .sbs-password-heading p {
            font-size: 11px;
            line-height: 1.65;
          }

          .sbs-password-form {
            margin-top: 23px;
          }

          .sbs-password-input-container input {
            height: 47px;
          }

          .sbs-password-submit {
            height: 47px;
          }
        }

        @media (max-width: 380px) {
          .sbs-password-card {
            padding: 22px 16px 19px;
          }

          .sbs-password-brand-name {
            font-size: 11px;
          }

          .sbs-password-product {
            font-size: 9px;
          }

          .sbs-password-heading h1 {
            font-size: 23px;
          }

          .sbs-password-security span {
            font-size: 8px;
          }
        }
      `}</style>
    </main>
  );
}