"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

export default function PortalLoginPage() {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] =
    useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [infoMessage, setInfoMessage] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: {
          user,
        },
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
          window.location.href =
            "/portal";
          return;
        }
      }

      setChecking(false);
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
          email: email.trim().toLowerCase(),
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

      const { data: portalUser, error: portalError } =
        await supabase
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

      window.location.href =
        "/portal";
    } catch (error: any) {
      console.error(
        "Portal login error:",
        error,
      );

      setErrorMessage(
        error?.message ||
          "Unable to sign in.",
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
        process.env.NEXT_PUBLIC_SITE_URL ||
        window.location.origin;

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
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
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          "Unable to send password reset instructions.",
      );
    }
  }

  if (checking) {
    return (
      <div className="login-page">
        <div className="login-loading">
          Checking secure portal session…
        </div>

        <style jsx>{`
          .login-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f6f7f9;
            color: #111827;
          }

          .login-loading {
            font-size: 12px;
            color: #6b7280;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="brand-mark">
          SBS
        </div>

        <div className="brand-copy">
          <strong>
            Client Portal
          </strong>
          <span>
            by Sharif Business Solutions
          </span>
        </div>

        <div className="login-card">
          <div className="login-card-header">
            <h1>
              Welcome back
            </h1>

            <p>
              Sign in to access your private
              business portal.
            </p>
          </div>

          {errorMessage && (
            <div className="alert error">
              {errorMessage}
            </div>
          )}

          {infoMessage && (
            <div className="alert info">
              {infoMessage}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="field">
              <label>
                Email address
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                autoComplete="email"
                placeholder="you@company.com"
              />
            </div>

            <div className="field">
              <label>
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </div>

            <button
              className="login-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Signing in…"
                : "Sign In"}
            </button>
          </form>

          <button
            className="forgot-button"
            onClick={sendPasswordReset}
            disabled={loading}
          >
            Forgot your password?
          </button>
        </div>

        <div className="security-note">
          Your access is limited to the customer
          information and files your company has
          authorized you to view.
        </div>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 25px;
          background: #f6f7f9;
        }

        .login-shell {
          width: min(430px, 100%);
          text-align: center;
        }

        .brand-mark {
          width: 48px;
          height: 48px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #111827;
          color: #fff;
          font-size: 13px;
          font-weight: 900;
        }

        .brand-copy {
          margin-top: 11px;
        }

        .brand-copy strong {
          display: block;
          color: #111827;
          font-size: 15px;
        }

        .brand-copy span {
          display: block;
          margin-top: 3px;
          color: #9ca3af;
          font-size: 10px;
        }

        .login-card {
          margin-top: 20px;
          padding: 26px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 15px;
          box-shadow:
            0 12px 35px
            rgba(15, 23, 42, 0.05);
          text-align: left;
        }

        .login-card-header {
          margin-bottom: 18px;
        }

        .login-card-header h1 {
          margin: 0;
          color: #111827;
          font-size: 21px;
        }

        .login-card-header p {
          margin: 6px 0 0;
          color: #9ca3af;
          font-size: 11px;
          line-height: 1.5;
        }

        .alert {
          margin-bottom: 14px;
          padding: 10px 11px;
          border-radius: 8px;
          font-size: 10px;
          line-height: 1.5;
        }

        .alert.error {
          color: #991b1b;
          background: #fef2f2;
          border: 1px solid #fecaca;
        }

        .alert.info {
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
        }

        .field {
          display: grid;
          gap: 6px;
          margin-bottom: 14px;
        }

        .field label {
          color: #374151;
          font-size: 10px;
          font-weight: 800;
        }

        .field input {
          width: 100%;
          height: 41px;
          padding: 0 11px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          outline: none;
          color: #111827;
          background: #fff;
          font-size: 11px;
        }

        .field input:focus {
          border-color: #9ca3af;
          box-shadow:
            0 0 0 3px
            rgba(17, 24, 39, 0.05);
        }

        .login-button {
          width: 100%;
          height: 42px;
          margin-top: 2px;
          border: 1px solid #111827;
          border-radius: 8px;
          background: #111827;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
        }

        .login-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .forgot-button {
          display: block;
          margin: 14px auto 0;
          border: 0;
          background: transparent;
          color: #6b7280;
          font-size: 10px;
          font-weight: 700;
        }

        .forgot-button:hover {
          color: #111827;
          text-decoration: underline;
        }

        .forgot-button:disabled {
          opacity: 0.5;
        }

        .security-note {
          margin-top: 15px;
          color: #9ca3af;
          font-size: 9px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}