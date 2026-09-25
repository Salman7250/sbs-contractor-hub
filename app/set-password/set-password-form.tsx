"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

export default function SetPasswordForm() {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      match:
        password.length > 0 &&
        password === confirmPassword,
    }),
    [password, confirmPassword],
  );

  /*
   * -------------------------------------------------------
   * INITIALIZE INVITATION SESSION
   * -------------------------------------------------------
   *
   * Supabase invitation links can return the authentication
   * tokens in the URL hash:
   *
   * #access_token=...
   * &refresh_token=...
   * &type=invite
   *
   * The browser client needs those tokens converted into a
   * Supabase session before getUser() or updateUser() can
   * work.
   * -------------------------------------------------------
   */
  useEffect(() => {
    let mounted = true;

    async function initializeInvitationSession() {
      try {
        /*
         * First check whether Supabase already has a session.
         *
         * This is important because the auth client may have
         * already processed the invitation URL automatically.
         */
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          if (mounted) {
            setInitializing(false);
          }

          return;
        }

        /*
         * Read invitation tokens from the URL hash.
         */
        const hash =
          typeof window !== "undefined"
            ? window.location.hash
            : "";

        if (!hash) {
          if (mounted) {
            setError(
              "This invitation link is missing its authentication information. Please request a new invitation.",
            );
            setInitializing(false);
          }

          return;
        }

        const hashParams = new URLSearchParams(
          hash.substring(1),
        );

        const accessToken =
          hashParams.get("access_token");

        const refreshToken =
          hashParams.get("refresh_token");

        const tokenType =
          hashParams.get("type");

        /*
         * If this is an invitation URL, establish the
         * authenticated session manually.
         */
        if (accessToken && refreshToken) {
          const {
            data: sessionData,
            error: sessionError,
          } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error(
              "Invitation session error:",
              sessionError,
            );

            if (mounted) {
              setError(
                "This invitation link has expired or is no longer valid. Please request a new invitation.",
              );
              setInitializing(false);
            }

            return;
          }

          if (!sessionData.session) {
            if (mounted) {
              setError(
                "Unable to establish your invitation session. Please request a new invitation.",
              );
              setInitializing(false);
            }

            return;
          }

          /*
           * Remove the sensitive authentication tokens from
           * the visible browser URL after the session has
           * been established.
           */
          if (typeof window !== "undefined") {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname +
                window.location.search,
            );
          }

          if (mounted) {
            setInitializing(false);
          }

          return;
        }

        /*
         * No tokens were found and no existing session exists.
         */
        if (mounted) {
          setError(
            tokenType === "invite"
              ? "This invitation link could not be authenticated. Please request a new invitation."
              : "No valid invitation session was found. Please use the invitation link from your email.",
          );

          setInitializing(false);
        }
      } catch (err) {
        console.error(
          "Invitation initialization error:",
          err,
        );

        if (mounted) {
          setError(
            "Something went wrong while opening your invitation. Please try again.",
          );
          setInitializing(false);
        }
      }
    }

    initializeInvitationSession();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (loading || initializing) {
      return;
    }

    setError("");

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters long.",
      );

      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");

      return;
    }

    setLoading(true);

    try {
      /*
       * -------------------------------------------------------
       * Make absolutely sure a valid session exists.
       * -------------------------------------------------------
       */
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          "Session error:",
          sessionError,
        );

        setError(
          "Unable to verify your invitation session. Please try again.",
        );

        return;
      }

      if (!session?.user) {
        setError(
          "This invitation link has expired or is no longer valid. Please request a new invitation.",
        );

        return;
      }

      /*
       * -------------------------------------------------------
       * Get the authenticated invitation user.
       * -------------------------------------------------------
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(
          "Get user error:",
          userError,
        );

        setError(
          "Unable to verify your account. Please request a new invitation.",
        );

        return;
      }

      /*
       * -------------------------------------------------------
       * Create the user's password.
       * -------------------------------------------------------
       */
      const {
        error: passwordError,
      } = await supabase.auth.updateUser({
        password,
      });

      if (passwordError) {
        console.error(
          "Password update error:",
          passwordError,
        );

        setError(
          passwordError.message ||
            "Unable to create your password. Please try again.",
        );

        return;
      }

      /*
       * -------------------------------------------------------
       * Determine account type.
       * -------------------------------------------------------
       */
      const accountType =
        user.user_metadata?.account_type;

      /*
       * -------------------------------------------------------
       * EMPLOYEE ACCOUNT
       * -------------------------------------------------------
       */
      if (accountType === "employee") {
        const {
          error: activationError,
        } = await supabase.rpc(
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

          return;
        }

        const appUrl =
          window.location.hostname ===
          "localhost"
            ? window.location.origin
            : "https://app.sharifbusinesssolutions.com";

        window.location.replace(appUrl);

        return;
      }

      /*
       * -------------------------------------------------------
       * B2B CUSTOMER PORTAL
       * -------------------------------------------------------
       *
       * The customer portal relationship was already created
       * when the administrator sent the invitation.
       *
       * No employee activation RPC is required here.
       */
      window.location.replace("/b2b-portal");
    } catch (err) {
      console.error(
        "Set password error:",
        err,
      );

      setError(
        "Something went wrong while setting up your account. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * -------------------------------------------------------
   * INITIALIZING STATE
   * -------------------------------------------------------
   */
  if (initializing) {
    return (
      <div className={styles.form}>
        <div className={styles.loadingState}>
          <span
            className={styles.spinner}
            aria-hidden="true"
          />

          <span>
            Verifying your invitation...
          </span>
        </div>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
    >
      {/* -------------------------------------------------- */}
      {/* PASSWORD */}
      {/* -------------------------------------------------- */}

      <div className={styles.fieldGroup}>
        <label
          htmlFor="password"
          className={styles.label}
        >
          Create password
        </label>

        <div className={styles.inputWrapper}>
          <span
            className={styles.inputIcon}
            aria-hidden="true"
          >
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
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value,
              )
            }
            className={styles.input}
            placeholder="Enter your password"
            autoComplete="new-password"
            disabled={loading}
            required
          />

          <button
            type="button"
            className={
              styles.passwordToggle
            }
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

        <div
          className={
            styles.requirements
          }
        >
          <div
            className={`${styles.requirement} ${
              passwordChecks.length
                ? styles.requirementValid
                : ""
            }`}
          >
            <span
              className={
                styles.requirementIcon
              }
            >
              {passwordChecks.length
                ? "✓"
                : "•"}
            </span>

            At least 8 characters
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* CONFIRM PASSWORD */}
      {/* -------------------------------------------------- */}

      <div className={styles.fieldGroup}>
        <label
          htmlFor="confirmPassword"
          className={styles.label}
        >
          Confirm password
        </label>

        <div className={styles.inputWrapper}>
          <span
            className={styles.inputIcon}
            aria-hidden="true"
          >
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
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(
                event.target.value,
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
            className={
              styles.passwordToggle
            }
            onClick={() =>
              setShowConfirmPassword(
                (current) =>
                  !current,
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

        <div
          className={
            styles.requirements
          }
        >
          <div
            className={`${styles.requirement} ${
              passwordChecks.match
                ? styles.requirementValid
                : ""
            }`}
          >
            <span
              className={
                styles.requirementIcon
              }
            >
              {passwordChecks.match
                ? "✓"
                : "•"}
            </span>

            Passwords match
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* ERROR */}
      {/* -------------------------------------------------- */}

      {error && (
        <div
          className={styles.error}
          role="alert"
        >
          <span
            className={styles.errorIcon}
          >
            !
          </span>

          <span>{error}</span>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* SUBMIT */}
      {/* -------------------------------------------------- */}

      <button
        type="submit"
        className={
          styles.submitButton
        }
        disabled={
          loading ||
          !!error ||
          !passwordChecks.length ||
          !passwordChecks.match
        }
      >
        {loading ? (
          <>
            <span
              className={styles.spinner}
              aria-hidden="true"
            />

            Setting up your account...
          </>
        ) : (
          <>
            Create password

            <svg
              className={
                styles.buttonArrow
              }
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
  );
}