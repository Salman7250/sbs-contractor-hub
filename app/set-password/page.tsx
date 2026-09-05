"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");

    if (password.length < 8) {
      setError("Your password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
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
          password,
        });

      if (updateError) {
        console.error("Password setup error:", updateError);
        setError(updateError.message);
        setLoading(false);
        return;
      }

      window.location.replace("/");
    } catch (err) {
      console.error("Password setup error:", err);

      setError(
        "Something went wrong while setting your password. Please try again."
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
          <div className="sbs-login-logo">SBS</div>

          <div>
            <div className="sbs-login-brand-name">
              Sharif Business Solutions
            </div>

            <div className="sbs-login-product">
              SBS Workspace
            </div>
          </div>
        </div>

        <div className="sbs-login-heading">
          <h1>Set your password</h1>

          <p>
            Welcome to Sharif Business Solutions. Create a secure
            password to finish setting up your account.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="sbs-login-form"
        >
          <div className="sbs-login-field">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
              minLength={8}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          <div className="sbs-login-field">
            <label htmlFor="confirm-password">
              Confirm password
            </label>

            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              required
              minLength={8}
              autoComplete="new-password"
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
                Setting password...
              </>
            ) : (
              <>
                Set password
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
            Secure account setup
          </span>
        </div>
      </section>
    </main>
  );
}