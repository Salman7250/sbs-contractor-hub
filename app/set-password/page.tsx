"use client";

import {
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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (loading) return;

    setError("");

    const trimmedPassword = password;
    const trimmedConfirmPassword =
      confirmPassword;

    if (trimmedPassword.length < 8) {
      setError(
        "Your password must be at least 8 characters long."
      );
      return;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      setError(
        "The passwords do not match."
      );
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError(
          "Your invitation session is missing or has expired. Please request a new invitation."
        );
        setLoading(false);
        return;
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password: trimmedPassword,
        });

      if (updateError) {
        console.error(
          "Password setup error:",
          updateError
        );

        setError(updateError.message);
        setLoading(false);
        return;
      }

      window.location.replace("/");
    } catch (err) {
      console.error(
        "Password setup error:",
        err
      );

      setError(
        "Something went wrong while setting your password. Please try again."
      );

      setLoading(false);
    }
  }

  return (
    <main className="sbs-login-page">
      {/* BACKGROUND */}
      <div className="sbs-login-background">
        <div className="sbs-login-orb sbs-login-orb-one" />
        <div className="sbs-login-orb sbs-login-orb-two" />

        <div className="sbs-password-grid" />
      </div>

      {/* CARD */}
      <section className="sbs-login-card sbs-password-card">
        {/* BRAND */}
        <div className="sbs-login-brand">
          <div className="sbs-login-logo">
            <span>S</span>
            <span>B</span>
            <span>S</span>
          </div>

          <div>
            <div className="sbs-login-brand-name">
              Sharif Business Solutions
            </div>

            <div className="sbs-login-product">
              SBS Workspace
            </div>
          </div>
        </div>

        {/* WELCOME ICON */}
        <div className="sbs-password-icon-wrap">
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
              <path d="M12 14v3" />
              <circle
                cx="12"
                cy="14"
                r="0.7"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </div>
        </div>

        {/* HEADING */}
        <div className="sbs-login-heading sbs-password-heading">
          <div className="sbs-password-eyebrow">
            ACCOUNT SETUP
          </div>

          <h1>
            Create your password
          </h1>

          <p>
            Welcome to your SBS Workspace.
            Set a secure password below to
            activate your account and get
            started.
          </p>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="sbs-login-form sbs-password-form"
          noValidate
        >
          {/* PASSWORD */}
          <div className="sbs-login-field">
            <div className="sbs-login-label-row">
              <label htmlFor="password">
                Password
              </label>

              <span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" />
                  <path d="M9 12h6" />
                </svg>

                Secure
              </span>
            </div>

            <div className="sbs-password-input-wrap">
              <svg
                className="sbs-input-icon"
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

              <input
                id="password"
                name="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Create a secure password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                required
                minLength={8}
                autoComplete="new-password"
                disabled={loading}
              />

              <button
                type="button"
                className="sbs-password-toggle"
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
                    strokeWidth="1.7"
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

            <div className="sbs-password-hint">
              Use at least 8 characters.
            </div>
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="sbs-login-field">
            <div className="sbs-login-label-row">
              <label htmlFor="confirm-password">
                Confirm password
              </label>
            </div>

            <div className="sbs-password-input-wrap">
              <svg
                className="sbs-input-icon"
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

              <input
                id="confirm-password"
                name="confirm-password"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                placeholder="Enter your password again"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                required
                minLength={8}
                autoComplete="new-password"
                disabled={loading}
              />

              <button
                type="button"
                className="sbs-password-toggle"
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
                    strokeWidth="1.7"
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
          </div>

          {/* ERROR */}
          {error && (
            <div
              className="sbs-login-error sbs-password-error"
              role="alert"
            >
              <div className="sbs-password-error-icon">
                !
              </div>

              <div>
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
            className="sbs-login-button sbs-password-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="sbs-login-spinner" />
                Setting up your account...
              </>
            ) : (
              <>
                <span>
                  Activate my account
                </span>

                <span className="sbs-login-arrow">
                  →
                </span>
              </>
            )}
          </button>
        </form>

        {/* SECURITY NOTE */}
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
              by SBS authentication.
            </span>
          </div>
        </div>

        {/* FOOTER */}
        <div className="sbs-login-footer">
          <span>
            Sharif Business Solutions
          </span>

          <span>•</span>

          <span>
            Secure workspace access
          </span>
        </div>
      </section>

      <style jsx>{`
        .sbs-password-card {
          position: relative;
        }

        .sbs-password-grid {
          position: absolute;
          inset: 0;
          opacity: 0.22;
          background-image:
            linear-gradient(
              rgba(16, 185, 129, 0.045) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(16, 185, 129, 0.045) 1px,
              transparent 1px
            );
          background-size: 42px 42px;
          pointer-events: none;
        }

        .sbs-password-icon-wrap {
          display: flex;
          justify-content: center;
          margin: 26px 0 18px;
        }

        .sbs-password-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          border: 1px solid
            rgba(16, 185, 129, 0.2);
          border-radius: 17px;
          background:
            linear-gradient(
              145deg,
              rgba(16, 185, 129, 0.12),
              rgba(16, 185, 129, 0.045)
            );
          color: #10b981;
          box-shadow:
            0 12px 30px
              rgba(16, 185, 129, 0.08),
            inset 0 1px 0
              rgba(255, 255, 255, 0.05);
        }

        .sbs-password-icon svg {
          width: 28px;
          height: 28px;
        }

        .sbs-password-heading {
          text-align: center;
        }

        .sbs-password-eyebrow {
          margin-bottom: 8px;
          color: #10b981;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .sbs-password-heading h1 {
          margin-bottom: 10px;
        }

        .sbs-password-heading p {
          max-width: 430px;
          margin-left: auto;
          margin-right: auto;
        }

        .sbs-password-form {
          margin-top: 26px;
        }

        .sbs-password-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .sbs-password-input-wrap input {
          width: 100%;
          padding-right: 48px;
        }

        .sbs-password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          transform: translateY(-50%);
        }

        .sbs-password-toggle:hover {
          color: #10b981;
        }

        .sbs-password-toggle:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .sbs-password-toggle svg {
          width: 18px;
          height: 18px;
        }

        .sbs-password-hint {
          margin-top: 7px;
          color: #64748b;
          font-size: 10px;
        }

        .sbs-password-error {
          display: flex;
          align-items: flex-start;
          gap: 10px;
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

        .sbs-password-error strong,
        .sbs-password-error span {
          display: block;
        }

        .sbs-password-error strong {
          margin-bottom: 2px;
        }

        .sbs-password-submit {
          margin-top: 4px;
        }

        .sbs-password-security {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-top: 20px;
          padding: 12px 13px;
          border: 1px solid
            rgba(148, 163, 184, 0.13);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.42);
        }

        .sbs-password-security-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .sbs-password-security-icon svg {
          width: 18px;
          height: 18px;
        }

        .sbs-password-security strong {
          display: block;
          margin-bottom: 2px;
          color: #e2e8f0;
          font-size: 11px;
          font-weight: 700;
        }

        .sbs-password-security span {
          display: block;
          color: #64748b;
          font-size: 10px;
          line-height: 1.45;
        }

        @media (max-width: 640px) {
          .sbs-password-card {
            width: calc(100% - 28px);
            padding: 25px 20px;
          }

          .sbs-password-icon-wrap {
            margin-top: 20px;
          }

          .sbs-password-heading h1 {
            font-size: 25px;
          }

          .sbs-password-heading p {
            font-size: 12px;
            line-height: 1.65;
          }

          .sbs-password-security {
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}