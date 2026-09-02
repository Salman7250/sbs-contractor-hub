"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (!data.session || !data.user) {
        setError(
          "Login succeeded, but no active session was created. Please try again."
        );
        setLoading(false);
        return;
      }

      /*
       * Give the browser a moment to persist the Supabase
       * session cookies before navigating to the protected app.
       */
      await new Promise((resolve) => setTimeout(resolve, 150));

      /*
       * Force a complete navigation so Next.js middleware
       * receives the newly established authentication session.
       */
      window.location.replace("/");
    } catch (err) {
      console.error("Login error:", err);

      setError(
        "Something went wrong while signing in. Please try again."
      );

      setLoading(false);
    }
  }

  return (
    <main className="sbs-login-page">
      <div className="sbs-login-background">
        <div className="sbs-login-orb sbs-login-orb-one" />
        <div className="sbs-login-orb sbs-login-orb-two" />
      </div>

      <section className="sbs-login-card">
        <div className="sbs-login-brand">
          <div className="sbs-login-logo">
            SBS
          </div>

          <div>
            <div className="sbs-login-brand-name">
              Sharif Business Solutions
            </div>

            <div className="sbs-login-product">
              Contractor Hub
            </div>
          </div>
        </div>

        <div className="sbs-login-heading">
          <h1>Welcome back</h1>

          <p>
            Sign in to manage your leads, customers,
            jobs, estimates, and invoices.
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="sbs-login-form"
        >
          <div className="sbs-login-field">
            <label htmlFor="email">
              Email address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="sbs-login-field">
            <div className="sbs-login-label-row">
              <label htmlFor="password">
                Password
              </label>

              <span>
                Secure sign in
              </span>
            </div>

            <input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div
              className="sbs-login-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="sbs-login-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="sbs-login-spinner" />
                Signing in...
              </>
            ) : (
              <>
                Sign in
                <span>→</span>
              </>
            )}
          </button>
        </form>

        <div className="sbs-login-footer">
          <span>
            Sharif Business Solutions
          </span>

          <span>•</span>

          <span>
            Contractor Hub
          </span>
        </div>
      </section>
    </main>
  );
}