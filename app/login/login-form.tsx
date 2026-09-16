"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

export default function LoginForm() {
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    const { data, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "The email or password you entered is incorrect."
          : authError.message
      );

      setLoading(false);
      return;
    }

    if (!data.session || !data.user) {
      setError(
        "Unable to create a login session. Please try again."
      );

      setLoading(false);
      return;
    }

    window.location.replace("/");
  }

  return (
    <form className={styles.loginForm} onSubmit={handleLogin}>
      {/* Email */}
      <div className={styles.formField}>
        <label htmlFor="email">Email address</label>

        <div className={styles.inputWrapper}>
          <svg
            className={styles.inputIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>

          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
        <div className={styles.passwordLabelRow}>
          <label htmlFor="password">Password</label>

          <a
            href="/forgot-password"
            className={styles.forgotPassword}
          >
            Forgot password?
          </a>
        </div>

        <div className={styles.inputWrapper}>
          <svg
            className={styles.inputIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>

          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            disabled={loading}
          />

          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() =>
              setShowPassword((current) => !current)
            }
            aria-label={
              showPassword ? "Hide password" : "Show password"
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
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className={styles.loginError} role="alert">
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
        className={styles.loginSubmit}
        disabled={loading}
      >
        {loading ? (
          <>
            <span
              className={styles.buttonSpinner}
              aria-hidden="true"
            />

            <span>Signing in...</span>
          </>
        ) : (
          <>
            <span>Sign in to your account</span>

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

      <p className={styles.loginHelp}>
        Having trouble signing in? Contact your account administrator.
      </p>
    </form>
  );
}