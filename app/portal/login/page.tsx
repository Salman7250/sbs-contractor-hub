"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function PortalLoginPage() {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [checking, setChecking] =
    useState(true);

  const [showPassword, setShowPassword] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [infoMessage, setInfoMessage] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (user) {
          const { data: portalUser } =
            await supabase
              .from("customer_portal_users")
              .select("id, status")
              .eq("user_id", user.id)
              .eq("status", "active")
              .limit(1)
              .maybeSingle();

          if (portalUser) {
            window.location.replace(
              "/portal",
            );

            return;
          }
        }
      } catch (error) {
        console.error(
          "Portal session check error:",
          error,
        );
      }

      if (mounted) {
        setChecking(false);
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setInfoMessage("");

      if (!email.trim() || !password) {
        throw new Error(
          "Enter your email and password.",
        );
      }

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email
            .trim()
            .toLowerCase(),
          password,
        });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error(
          "Unable to sign in.",
        );
      }

      const {
        data: portalUser,
        error: portalError,
      } = await supabase
        .from("customer_portal_users")
        .select(
          "id, company_id, customer_id, status",
        )
        .eq("user_id", data.user.id)
        .limit(1)
        .maybeSingle();

      if (portalError) {
        throw portalError;
      }

      if (!portalUser) {
        await supabase.auth.signOut();

        throw new Error(
          "This account does not have Client Portal access.",
        );
      }

      if (portalUser.status !== "active") {
        await supabase.auth.signOut();

        throw new Error(
          `Your Client Portal access is ${portalUser.status}. Please contact the company administrator.`,
        );
      }

      window.location.replace(
        "/portal",
      );
    } catch (error: unknown) {
      console.error(
        "Portal login error:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendPasswordReset() {
    try {
      setErrorMessage("");
      setInfoMessage("");

      if (!email.trim()) {
        throw new Error(
          "Enter your email address first.",
        );
      }

      const siteUrl =
        process.env
          .NEXT_PUBLIC_SITE_URL ||
        window.location.origin;

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email
            .trim()
            .toLowerCase(),
          {
            redirectTo: `${siteUrl}/portal/reset-password`,
          },
        );

      if (error) {
        throw error;
      }

      setInfoMessage(
        "Password reset instructions have been sent to your email address.",
      );
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to send password reset instructions.",
      );
    }
  }

  if (checking) {
    return (
      <main className="portal-page">
        <div
          className="background"
          aria-hidden="true"
        >
          <div className="paper paper-one" />
          <div className="paper paper-two" />
          <div className="circle circle-one" />
          <div className="circle circle-two" />
          <div className="dot-field dot-one" />
          <div className="dot-field dot-two" />
        </div>

        <div className="checking-card">
          <div className="loading-logo">
            <Image
              src="/sbs-logo-black.png"
              alt="Sharif Business Solutions"
              width={165}
              height={38}
              priority
            />
          </div>

          <span className="spinner" />

          <p>
            Checking secure portal session…
          </p>
        </div>

        <style jsx>{`
          .portal-page {
            position: relative;
            min-height: 100vh;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f7f8fa;
            color: #111827;
          }

          .background {
            position: absolute;
            inset: 0;
            overflow: hidden;
            pointer-events: none;
          }

          .paper {
            position: absolute;
            width: 420px;
            height: 240px;
            border: 1px solid rgba(17, 24, 39, 0.035);
            background: rgba(255, 255, 255, 0.42);
            transform: rotate(-13deg);
          }

          .paper-one {
            top: -90px;
            left: -110px;
          }

          .paper-two {
            right: -150px;
            bottom: -100px;
            transform: rotate(18deg);
          }

          .circle {
            position: absolute;
            border-radius: 999px;
            border: 1px solid rgba(22, 163, 74, 0.08);
          }

          .circle-one {
            width: 300px;
            height: 300px;
            right: 5%;
            top: 8%;
          }

          .circle-two {
            width: 190px;
            height: 190px;
            left: 5%;
            bottom: 8%;
          }

          .dot-field {
            position: absolute;
            width: 100px;
            height: 100px;
            opacity: 0.28;
            background-image: radial-gradient(
              #9ca3af 1px,
              transparent 1px
            );
            background-size: 12px 12px;
          }

          .dot-one {
            top: 16%;
            left: 9%;
          }

          .dot-two {
            right: 9%;
            bottom: 16%;
          }

          .checking-card {
            position: relative;
            z-index: 2;
            width: min(390px, calc(100% - 40px));
            padding: 38px 30px;
            border: 1px solid #e5e7eb;
            border-radius: 22px;
            background: rgba(255, 255, 255, 0.94);
            box-shadow:
              0 30px 80px rgba(15, 23, 42, 0.08);
            text-align: center;
          }

          .loading-logo {
            margin-bottom: 28px;
          }

          .spinner {
            width: 22px;
            height: 22px;
            margin: 0 auto;
            display: block;
            border: 2px solid #e5e7eb;
            border-top-color: #16a34a;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          .checking-card p {
            margin: 15px 0 0;
            color: #6b7280;
            font-size: 12px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="portal-page">
      {/* Decorative background */}
      <div
        className="background"
        aria-hidden="true"
      >
        <div className="paper paper-one" />
        <div className="paper paper-two" />
        <div className="paper paper-three" />

        <div className="circle circle-one" />
        <div className="circle circle-two" />

        <div className="dot-field dot-one" />
        <div className="dot-field dot-two" />

        <div className="curve curve-one" />
        <div className="curve curve-two" />
      </div>

      {/* Header */}
      <header className="portal-header">
        <Link
          href="/"
          className="brand"
        >
          <Image
            src="/sbs-logo-black.png"
            alt="Sharif Business Solutions"
            width={185}
            height={42}
            priority
            className="brand-logo"
          />

          <div className="brand-copy">
            <span className="brand-name">
              CLIENT PORTAL
            </span>

            <span className="brand-tagline">
              Secure business access
            </span>
          </div>
        </Link>
      </header>

      {/* Main */}
      <section className="login-content">
        {/* Left introduction */}
        <div className="intro">
          <div className="welcome-pill">
            <span className="welcome-dot" />
            Customer access
          </div>

          <h1>
            Your business.
            <br />
            <span>Connected.</span>
          </h1>

          <p className="intro-description">
            Access your invoices, orders, estimates,
            jobs and other business information through
            your secure SBS customer workspace.
          </p>

          <div className="feature-list">
            <div className="feature">
              <div className="feature-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <rect
                    x="5"
                    y="3"
                    width="14"
                    height="18"
                    rx="2"
                  />
                  <path d="M8 7h8" />
                  <path d="M8 11h5" />
                  <path d="M8 15h8" />
                </svg>
              </div>

              <div>
                <strong>
                  Business documents
                </strong>

                <span>
                  View your invoices, estimates and
                  related documents.
                </span>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </div>

              <div>
                <strong>
                  Orders & services
                </strong>

                <span>
                  Keep track of orders, jobs and service
                  activity.
                </span>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
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

              <div>
                <strong>
                  Secure access
                </strong>

                <span>
                  Your portal only shows information
                  authorized for your account.
                </span>
              </div>
            </div>
          </div>

          <div className="intro-quote">
            <span className="quote-mark">
              “
            </span>

            <div>
              <p>
                One secure place to stay connected
                with the businesses you work with.
              </p>

              <span>
                Sharif Business Solutions
              </span>
            </div>
          </div>
        </div>

        {/* Login card */}
        <div className="login-card">
          <div className="card-accent" />

          <div className="card-content">
            <div className="card-brand">
              <Image
                src="/sbs-logo-black.png"
                alt="SBS"
                width={175}
                height={45}
                priority
              />
            </div>

            <div className="login-icon-area">
              <div className="login-icon-ring">
                <div className="login-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path d="M12 3 4.5 6v5.5c0 4.6 3.1 7.9 7.5 9.5 4.4-1.6 7.5-4.9 7.5-9.5V6L12 3Z" />
                    <path d="m8.5 12 2.2 2.2 4.8-5" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="card-heading">
              <div className="eyebrow">
                CLIENT PORTAL
              </div>

              <h2>
                Welcome back
              </h2>

              <p>
                Sign in to access your private
                business workspace.
              </p>
            </div>

            {errorMessage && (
              <div
                className="alert error"
                role="alert"
              >
                <span className="alert-icon">
                  !
                </span>

                <span>
                  {errorMessage}
                </span>
              </div>
            )}

            {infoMessage && (
              <div
                className="alert info"
                role="status"
              >
                <span className="alert-icon">
                  ✓
                </span>

                <span>
                  {infoMessage}
                </span>
              </div>
            )}

            <form
              onSubmit={handleLogin}
              className="login-form"
            >
              <div className="field">
                <label htmlFor="email">
                  Email address
                </label>

                <div className="input-wrapper">
                  <span
                    className="input-icon"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
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
                  </span>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value,
                      )
                    }
                    autoComplete="email"
                    placeholder="you@company.com"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="password">
                  Password
                </label>

                <div className="input-wrapper">
                  <span
                    className="input-icon"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
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
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={loading}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        (current) =>
                          !current,
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
                        <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                        <path d="M9.9 5.1A10.7 10.7 0 0 1 12 5c5 0 8.5 4.3 9.5 7-.4 1.1-1.3 2.7-2.7 4" />
                        <path d="M6.2 6.2C4.2 7.6 2.9 9.8 2.5 12c.9 2.7 4.5 7 9.5 7 1.2 0 2.3-.2 3.3-.6" />
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

              <button
                className="login-button"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="button-spinner" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in to portal

                    <svg
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
            </form>

            <button
              className="forgot-button"
              onClick={sendPasswordReset}
              disabled={loading}
            >
              Forgot your password?
            </button>

            <div className="trust-area">
              <div className="trust-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
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

                Secure
              </div>

              <span className="trust-divider" />

              <div className="trust-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M12 3v18" />
                  <path d="M17 7H9.5a2.5 2.5 0 0 0 0 5H15a2.5 2.5 0 0 1 0 5H6" />
                </svg>

                Business ready
              </div>

              <span className="trust-divider" />

              <div className="trust-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M20 11a8.1 8.1 0 0 0-15.5-2" />
                  <path d="M4 4v5h5" />
                  <path d="M4 13a8.1 8.1 0 0 0 15.5 2" />
                  <path d="M20 20v-5h-5" />
                </svg>

                Connected
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="portal-footer">
        <span>
          © {new Date().getFullYear()} Sharif
          Business Solutions. All rights reserved.
        </span>

        <div className="footer-links">
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

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .portal-page {
          position: relative;
          min-height: 100vh;
          overflow-x: hidden;
          padding: 0 42px;
          background:
            linear-gradient(
              135deg,
              #f8fafb 0%,
              #f5f7f8 48%,
              #f8faf9 100%
            );
          color: #111827;
        }

        .background {
          position: fixed;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }

        .paper {
          position: absolute;
          width: 520px;
          height: 290px;
          border: 1px solid
            rgba(17, 24, 39, 0.035);
          background: rgba(
            255,
            255,
            255,
            0.38
          );
        }

        .paper-one {
          top: -125px;
          left: -180px;
          transform: rotate(-14deg);
        }

        .paper-two {
          right: -190px;
          bottom: -130px;
          transform: rotate(16deg);
        }

        .paper-three {
          right: 15%;
          top: -230px;
          width: 320px;
          height: 180px;
          transform: rotate(23deg);
          opacity: 0.5;
        }

        .circle {
          position: absolute;
          border-radius: 50%;
          border: 1px solid
            rgba(22, 163, 74, 0.075);
        }

        .circle-one {
          width: 390px;
          height: 390px;
          right: -100px;
          top: 6%;
        }

        .circle-two {
          width: 260px;
          height: 260px;
          left: -110px;
          bottom: 7%;
        }

        .dot-field {
          position: absolute;
          width: 110px;
          height: 110px;
          opacity: 0.25;
          background-image: radial-gradient(
            #9ca3af 1px,
            transparent 1px
          );
          background-size: 12px 12px;
        }

        .dot-one {
          top: 17%;
          left: 8%;
        }

        .dot-two {
          right: 8%;
          bottom: 17%;
        }

        .curve {
          position: absolute;
          width: 470px;
          height: 220px;
          border: 1px solid
            rgba(22, 163, 74, 0.055);
          border-radius: 50%;
        }

        .curve-one {
          left: -280px;
          top: 39%;
          transform: rotate(-20deg);
        }

        .curve-two {
          right: -280px;
          top: 48%;
          transform: rotate(20deg);
        }

        .portal-header {
          position: relative;
          z-index: 2;
          max-width: 1280px;
          margin: 0 auto;
          padding: 28px 0 0;
        }

        .brand {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          color: inherit;
          text-decoration: none;
        }

        .brand-logo {
          width: 168px;
          height: auto;
          object-fit: contain;
        }

        .brand-copy {
          padding-left: 14px;
          border-left: 1px solid #d9dde2;
        }

        .brand-name {
          display: block;
          color: #111827;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .brand-tagline {
          display: block;
          margin-top: 3px;
          color: #9ca3af;
          font-size: 9px;
        }

        .login-content {
          position: relative;
          z-index: 2;
          width: min(1120px, 100%);
          min-height: calc(100vh - 150px);
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 430px;
          align-items: center;
          gap: 95px;
          padding: 48px 0 65px;
        }

        .intro {
          max-width: 560px;
        }

        .welcome-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 11px;
          border: 1px solid
            rgba(22, 163, 74, 0.15);
          border-radius: 999px;
          background: rgba(
            240,
            253,
            244,
            0.75
          );
          color: #15803d;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .welcome-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 4px
            rgba(34, 197, 94, 0.1);
        }

        .intro h1 {
          margin: 20px 0 0;
          color: #111827;
          font-size: clamp(
            43px,
            5vw,
            66px
          );
          line-height: 0.98;
          letter-spacing: -0.045em;
          font-weight: 800;
        }

        .intro h1 span {
          color: #16a34a;
        }

        .intro-description {
          max-width: 500px;
          margin: 23px 0 0;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.8;
        }

        .feature-list {
          display: grid;
          gap: 18px;
          margin-top: 34px;
        }

        .feature {
          display: flex;
          align-items: flex-start;
          gap: 13px;
        }

        .feature-icon {
          flex: 0 0 35px;
          width: 35px;
          height: 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e3e7eb;
          border-radius: 10px;
          background: rgba(
            255,
            255,
            255,
            0.7
          );
          color: #16a34a;
        }

        .feature-icon svg {
          width: 17px;
          height: 17px;
        }

        .feature strong {
          display: block;
          color: #1f2937;
          font-size: 11px;
          font-weight: 800;
        }

        .feature span {
          display: block;
          margin-top: 4px;
          color: #9ca3af;
          font-size: 10px;
          line-height: 1.5;
        }

        .intro-quote {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          max-width: 440px;
          margin-top: 34px;
          padding-top: 20px;
          border-top: 1px solid
            rgba(17, 24, 39, 0.07);
        }

        .quote-mark {
          color: #16a34a;
          font-size: 30px;
          line-height: 0.8;
          font-weight: 800;
        }

        .intro-quote p {
          margin: 0;
          color: #6b7280;
          font-size: 10px;
          line-height: 1.6;
        }

        .intro-quote div span {
          display: block;
          margin-top: 6px;
          color: #9ca3af;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .login-card {
          position: relative;
          overflow: hidden;
          border: 1px solid #e3e6ea;
          border-radius: 22px;
          background: rgba(
            255,
            255,
            255,
            0.96
          );
          box-shadow:
            0 35px 90px
              rgba(15, 23, 42, 0.09),
            0 5px 18px
              rgba(15, 23, 42, 0.035);
        }

        .card-accent {
          height: 3px;
          background: linear-gradient(
            90deg,
            #111827 0%,
            #16a34a 52%,
            #22c55e 100%
          );
        }

        .card-content {
          padding: 30px 32px 25px;
        }

        .card-brand {
          display: flex;
          justify-content: center;
          padding-bottom: 13px;
        }

        .card-brand img {
          width: 145px;
          height: auto;
        }

        .login-icon-area {
          display: flex;
          justify-content: center;
          margin-top: 7px;
        }

        .login-icon-ring {
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid
            rgba(22, 163, 74, 0.18);
          border-radius: 50%;
          background: #f0fdf4;
        }

        .login-icon {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #fff;
          color: #16a34a;
          box-shadow:
            0 4px 14px
              rgba(22, 163, 74, 0.1);
        }

        .login-icon svg {
          width: 21px;
          height: 21px;
        }

        .card-heading {
          margin-top: 16px;
          text-align: center;
        }

        .eyebrow {
          color: #16a34a;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }

        .card-heading h2 {
          margin: 6px 0 0;
          color: #111827;
          font-size: 23px;
          line-height: 1.2;
          letter-spacing: -0.025em;
        }

        .card-heading p {
          max-width: 280px;
          margin: 7px auto 0;
          color: #9ca3af;
          font-size: 10px;
          line-height: 1.55;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 17px;
          padding: 10px 11px;
          border-radius: 9px;
          font-size: 9px;
          line-height: 1.5;
        }

        .alert.error {
          border: 1px solid #fecaca;
          background: #fff7f7;
          color: #991b1b;
        }

        .alert.info {
          border: 1px solid #bfdbfe;
          background: #f5f9ff;
          color: #1d4ed8;
        }

        .alert-icon {
          flex: 0 0 17px;
          width: 17px;
          height: 17px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: currentColor;
          color: #fff;
          font-size: 9px;
          font-weight: 900;
        }

        .login-form {
          margin-top: 20px;
        }

        .field {
          margin-bottom: 15px;
        }

        .field label {
          display: block;
          margin-bottom: 7px;
          color: #374151;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        .input-wrapper {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
        }

        .input-icon svg {
          width: 16px;
          height: 16px;
        }

        .field input {
          width: 100%;
          height: 44px;
          padding: 0 42px;
          border: 1px solid #dfe3e7;
          border-radius: 9px;
          outline: none;
          background: #fff;
          color: #111827;
          font-family: inherit;
          font-size: 11px;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .field input::placeholder {
          color: #b4bac2;
        }

        .field input:hover {
          border-color: #c9ced4;
        }

        .field input:focus {
          border-color: #16a34a;
          box-shadow:
            0 0 0 3px
              rgba(22, 163, 74, 0.08);
        }

        .password-toggle {
          position: absolute;
          right: 10px;
          top: 50%;
          width: 27px;
          height: 27px;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translateY(-50%);
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
        }

        .password-toggle:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .password-toggle svg {
          width: 16px;
          height: 16px;
        }

        .login-button {
          width: 100%;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          margin-top: 5px;
          border: 1px solid #111827;
          border-radius: 9px;
          background: #111827;
          color: #fff;
          font-family: inherit;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            background 0.15s ease,
            box-shadow 0.15s ease;
        }

        .login-button:hover:not(:disabled) {
          background: #1f2937;
          transform: translateY(-1px);
          box-shadow:
            0 8px 20px
              rgba(17, 24, 39, 0.13);
        }

        .login-button svg {
          width: 16px;
          height: 16px;
        }

        .login-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .button-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid
            rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        .forgot-button {
          display: block;
          margin: 14px auto 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: #6b7280;
          font-family: inherit;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
        }

        .forgot-button:hover:not(:disabled) {
          color: #111827;
          text-decoration: underline;
        }

        .forgot-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .trust-area {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          margin-top: 23px;
          padding-top: 18px;
          border-top: 1px solid #eef0f2;
        }

        .trust-item {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #9ca3af;
          font-size: 7px;
          font-weight: 700;
          white-space: nowrap;
        }

        .trust-item svg {
          width: 12px;
          height: 12px;
          color: #16a34a;
        }

        .trust-divider {
          width: 1px;
          height: 14px;
          background: #e5e7eb;
        }

        .portal-footer {
          position: relative;
          z-index: 2;
          max-width: 1120px;
          margin: -30px auto 0;
          padding: 0 0 25px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #a1a7af;
          font-size: 8px;
        }

        .footer-links {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .footer-links a {
          color: #8b929b;
          text-decoration: none;
        }

        .footer-links a:hover {
          color: #111827;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .portal-page {
            padding: 0 24px;
          }

          .login-content {
            grid-template-columns: 1fr;
            gap: 42px;
            padding-top: 55px;
          }

          .intro {
            max-width: 600px;
            margin: 0 auto;
            text-align: center;
          }

          .intro-description {
            margin-left: auto;
            margin-right: auto;
          }

          .feature-list {
            max-width: 430px;
            margin-left: auto;
            margin-right: auto;
            text-align: left;
          }

          .intro-quote {
            margin-left: auto;
            margin-right: auto;
            text-align: left;
          }

          .login-card {
            width: min(430px, 100%);
            margin: 0 auto;
          }

          .portal-footer {
            margin-top: 0;
          }
        }

        @media (max-width: 560px) {
          .portal-page {
            padding: 0 16px;
          }

          .portal-header {
            padding-top: 20px;
          }

          .brand-logo {
            width: 135px;
          }

          .brand-copy {
            padding-left: 10px;
          }

          .brand-name {
            font-size: 8px;
          }

          .brand-tagline {
            font-size: 7px;
          }

          .login-content {
            min-height: auto;
            padding: 50px 0 35px;
          }

          .intro h1 {
            font-size: 42px;
          }

          .intro-description {
            font-size: 11px;
          }

          .feature-list {
            margin-top: 28px;
          }

          .intro-quote {
            display: none;
          }

          .login-card {
            border-radius: 18px;
          }

          .card-content {
            padding: 25px 21px 21px;
          }

          .portal-footer {
            flex-direction: column;
            gap: 9px;
            padding-bottom: 20px;
            text-align: center;
          }
        }
      `}</style>
    </main>
  );
}