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

      await new Promise((resolve) => setTimeout(resolve, 150));

      window.location.replace("/");
    } catch (err) {
      console.error("Login error:", err);

      setError("Something went wrong while signing in. Please try again.");

      setLoading(false);
    }
  }

  return (
    <main className="sbs-login-page">
      {/* =========================================================
          DECORATIVE BACKGROUND
      ========================================================== */}

      <div className="sbs-background" aria-hidden="true">
        <div className="sbs-paper-shape sbs-shape-one" />
        <div className="sbs-paper-shape sbs-shape-two" />
        <div className="sbs-paper-shape sbs-shape-three" />

        <div className="sbs-soft-circle sbs-circle-one" />
        <div className="sbs-soft-circle sbs-circle-two" />

        <div className="sbs-dots sbs-dots-one" />
        <div className="sbs-dots sbs-dots-two" />

        <div className="sbs-curved-line sbs-curve-one" />
        <div className="sbs-curved-line sbs-curve-two" />
      </div>

      {/* =========================================================
          HEADER
      ========================================================== */}

      <header className="sbs-header">
        <div className="sbs-brand">
          <div className="sbs-brand-mark" aria-hidden="true">
            <div className="sbs-mark-inner">
              <span>S</span>
              <span>B</span>
              <span>S</span>
            </div>
          </div>

          <div className="sbs-brand-copy">
            <strong>SHARIF BUSINESS SOLUTIONS</strong>
            <span>Business management, made practical.</span>
          </div>
        </div>

        <div className="sbs-header-note">
          <span className="sbs-header-dot" />
          Business Management Platform
        </div>
      </header>

      {/* =========================================================
          MAIN
      ========================================================== */}

      <section className="sbs-main">
        {/* =====================================================
            LEFT SIDE
        ====================================================== */}

        <div className="sbs-intro">
          <div className="sbs-welcome-pill">
            <span className="sbs-pill-dot" />
            Welcome to SBS
          </div>

          <h1>
            Your business,
            <br />
            <span>beautifully managed.</span>
          </h1>

          <p className="sbs-intro-text">
            Sharif Business Management Platform brings your
            everyday business operations together — from
            customers and sales to inventory, service,
            purchasing and finances.
          </p>

          {/* BUSINESS AREAS */}

          <div className="sbs-business-areas">
            <div className="sbs-area-card sbs-area-green">
              <div className="sbs-area-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-5A4.5 4.5 0 0 0 2 18.5V20" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M16 4.5a4 4 0 0 1 0 7.75" />
                  <path d="M17 14.25a4.5 4.5 0 0 1 5 4.25V20" />
                </svg>
              </div>

              <div>
                <strong>Customers</strong>
                <span>Relationships &amp; sales</span>
              </div>
            </div>

            <div className="sbs-area-card sbs-area-peach">
              <div className="sbs-area-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
                  <path d="m3 7.5 9 4.5 9-4.5" />
                  <path d="M12 12v9" />
                </svg>
              </div>

              <div>
                <strong>Inventory</strong>
                <span>Products &amp; stock</span>
              </div>
            </div>

            <div className="sbs-area-card sbs-area-blue">
              <div className="sbs-area-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M4 19V10" />
                  <path d="M10 19V5" />
                  <path d="M16 19v-8" />
                  <path d="M22 19H2" />
                </svg>
              </div>

              <div>
                <strong>Business</strong>
                <span>Reports &amp; finances</span>
              </div>
            </div>

            <div className="sbs-area-card sbs-area-yellow">
              <div className="sbs-area-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M20 12a8 8 0 1 1-2.34-5.66" />
                  <path d="M20 4v6h-6" />
                  <path d="M12 8v4l2.5 1.5" />
                </svg>
              </div>

              <div>
                <strong>Service</strong>
                <span>Jobs &amp; operations</span>
              </div>
            </div>
          </div>

          {/* HUMAN BRAND STATEMENT */}

          <div className="sbs-quote">
            <div className="sbs-quote-mark">“</div>

            <div>
              <p>
                Built around the way businesses actually
                work — simple, organized and connected.
              </p>

              <span>Sharif Business Solutions</span>
            </div>
          </div>
        </div>

        {/* =====================================================
            LOGIN PANEL
        ====================================================== */}

        <div className="sbs-login-wrapper">
          <div className="sbs-login-card">
            {/* TOP COLOR STRIP */}

            <div className="sbs-card-color-strip">
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="sbs-card-content">
              {/* CARD BRAND */}

              <div className="sbs-card-brand">
                <div className="sbs-card-mark" aria-hidden="true">
                  <span>S</span>
                  <span>B</span>
                  <span>S</span>
                </div>

                <div className="sbs-card-brand-copy">
                  <strong>Sharif Business Solutions</strong>
                  <span>Business Management Platform</span>
                </div>
              </div>

              {/* HEADING */}

              <div className="sbs-heading">
                <span className="sbs-heading-small">
                  GOOD TO SEE YOU
                </span>

                <h2>Welcome back.</h2>

                <p>
                  Sign in to continue managing your business.
                </p>
              </div>

              {/* FORM */}

              <form
                onSubmit={handleLogin}
                className="sbs-login-form"
              >
                {/* EMAIL */}

                <div className="sbs-field">
                  <label htmlFor="email">
                    Email address
                  </label>

                  <div className="sbs-input-wrapper">
                    <div className="sbs-input-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        aria-hidden="true"
                      >
                        <rect
                          x="3"
                          y="5"
                          width="18"
                          height="14"
                          rx="2.5"
                        />
                        <path d="m3 7 9 6 9-6" />
                      </svg>
                    </div>

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
                </div>

                {/* PASSWORD */}

                <div className="sbs-field">
                  <label htmlFor="password">
                    Password
                  </label>

                  <div className="sbs-input-wrapper">
                    <div className="sbs-input-icon">
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
                          rx="2.5"
                        />
                        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      </svg>
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
                </div>

                {/* ERROR */}

                {error && (
                  <div
                    className="sbs-error"
                    role="alert"
                  >
                    <div className="sbs-error-symbol">
                      !
                    </div>

                    <div className="sbs-error-content">
                      <strong>Unable to sign in</strong>
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {/* BUTTON */}

                <button
                  type="submit"
                  className="sbs-login-button"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="sbs-spinner" />
                      <span>Signing you in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in</span>

                      <span className="sbs-button-arrow">
                        →
                      </span>
                    </>
                  )}
                </button>
              </form>

              {/* TRUST AREA */}

              <div className="sbs-trust">
                <div className="sbs-trust-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" />
                    <path d="m8.5 12 2.3 2.3 4.7-5" />
                  </svg>
                </div>

                <div>
                  <strong>Private &amp; secure</strong>
                  <span>
                    Your business information stays protected.
                  </span>
                </div>
              </div>

              {/* SMALL COLOR DETAILS */}

              <div className="sbs-card-footer">
                <span className="sbs-mini-dot green" />
                <span className="sbs-mini-dot peach" />
                <span className="sbs-mini-dot blue" />

                <span className="sbs-card-footer-text">
                  Your business. Your workspace.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          FOOTER
      ========================================================== */}

      <footer className="sbs-footer">
        <div>
          <strong>SHARIF BUSINESS SOLUTIONS</strong>
          <span>Sharif Business Management Platform</span>
        </div>

        <span className="sbs-footer-copy">
          © {new Date().getFullYear()} Sharif Business Solutions
        </span>
      </footer>

      {/* =========================================================
          STYLES
      ========================================================== */}

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .sbs-login-page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          isolation: isolate;
          display: flex;
          flex-direction: column;

          background:
            radial-gradient(
              circle at 15% 15%,
              rgba(214, 237, 222, 0.9),
              transparent 27%
            ),
            radial-gradient(
              circle at 88% 12%,
              rgba(255, 225, 207, 0.85),
              transparent 25%
            ),
            radial-gradient(
              circle at 90% 85%,
              rgba(215, 231, 249, 0.7),
              transparent 28%
            ),
            #f8f6f0;

          color: #25352d;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        /* =====================================================
           BACKGROUND
        ====================================================== */

        .sbs-background {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: -1;
        }

        .sbs-paper-shape {
          position: absolute;
          opacity: 0.72;
        }

        .sbs-shape-one {
          width: 430px;
          height: 430px;
          left: -260px;
          top: 26%;
          border-radius: 42% 58% 65% 35%;
          background: #dcefe2;
          transform: rotate(-18deg);
        }

        .sbs-shape-two {
          width: 360px;
          height: 360px;
          right: -190px;
          top: 27%;
          border-radius: 58% 42% 34% 66%;
          background: #fde2d3;
          transform: rotate(23deg);
        }

        .sbs-shape-three {
          width: 300px;
          height: 300px;
          right: 15%;
          bottom: -210px;
          border-radius: 60% 40% 50% 50%;
          background: #dceafa;
        }

        .sbs-soft-circle {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(48, 91, 70, 0.08);
        }

        .sbs-circle-one {
          width: 620px;
          height: 620px;
          right: -350px;
          top: -230px;
        }

        .sbs-circle-two {
          width: 450px;
          height: 450px;
          left: -300px;
          bottom: -260px;
        }

        .sbs-dots {
          position: absolute;
          width: 90px;
          height: 90px;
          opacity: 0.45;

          background-image: radial-gradient(
            #7ca38a 1.4px,
            transparent 1.4px
          );

          background-size: 13px 13px;
        }

        .sbs-dots-one {
          right: 8%;
          top: 19%;
        }

        .sbs-dots-two {
          left: 10%;
          bottom: 18%;
          opacity: 0.25;
        }

        .sbs-curved-line {
          position: absolute;
          border: 1px solid rgba(52, 99, 76, 0.08);
          border-radius: 50%;
        }

        .sbs-curve-one {
          width: 700px;
          height: 330px;
          left: 31%;
          top: -280px;
          transform: rotate(-9deg);
        }

        .sbs-curve-two {
          width: 700px;
          height: 300px;
          right: 17%;
          bottom: -260px;
          transform: rotate(8deg);
        }

        /* =====================================================
           HEADER
        ====================================================== */

        .sbs-header {
          width: min(1320px, calc(100% - 72px));
          margin: 0 auto;
          padding: 30px 0 18px;

          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sbs-brand {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .sbs-brand-mark {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 13px;
          background: #ffffff;
          border: 1px solid #dce5de;

          box-shadow:
            0 5px 15px rgba(55, 83, 67, 0.07),
            0 1px 2px rgba(55, 83, 67, 0.05);

          transform: rotate(-4deg);
        }

        .sbs-mark-inner {
          display: flex;
          align-items: center;
          gap: 0;
          transform: rotate(4deg);

          color: #285e43;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: -1.7px;
        }

        .sbs-mark-inner span:nth-child(2) {
          color: #d17a59;
        }

        .sbs-brand-copy {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sbs-brand-copy strong {
          color: #294236;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.13em;
        }

        .sbs-brand-copy span {
          color: #829088;
          font-size: 10px;
          font-weight: 500;
        }

        .sbs-header-note {
          display: flex;
          align-items: center;
          gap: 8px;

          padding: 9px 13px;
          border-radius: 999px;

          background: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(213, 222, 215, 0.9);

          color: #718078;
          font-size: 10px;
          font-weight: 650;

          box-shadow: 0 4px 14px rgba(65, 89, 74, 0.04);
        }

        .sbs-header-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #5e9b72;
          box-shadow: 0 0 0 4px rgba(94, 155, 114, 0.1);
        }

        /* =====================================================
           MAIN
        ====================================================== */

        .sbs-main {
          width: min(1180px, calc(100% - 72px));
          flex: 1;
          margin: 0 auto;

          display: grid;
          grid-template-columns: minmax(0, 1fr) 430px;
          align-items: center;
          gap: 105px;

          padding: 35px 0 45px;
        }

        /* =====================================================
           INTRO
        ====================================================== */

        .sbs-intro {
          max-width: 630px;
        }

        .sbs-welcome-pill {
          width: fit-content;

          display: flex;
          align-items: center;
          gap: 8px;

          padding: 7px 11px;

          border-radius: 999px;
          background: #ffffff;
          border: 1px solid #dce6df;

          color: #507261;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;

          box-shadow:
            0 5px 16px rgba(61, 88, 70, 0.05);
        }

        .sbs-pill-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #6ca17b;
        }

        .sbs-intro h1 {
          margin: 24px 0 0;

          color: #294136;

          font-size: clamp(48px, 5.1vw, 70px);
          line-height: 0.99;
          letter-spacing: -0.055em;
          font-weight: 720;
        }

        .sbs-intro h1 span {
          color: #568366;
        }

        .sbs-intro-text {
          max-width: 575px;
          margin: 26px 0 0;

          color: #69786f;
          font-size: 14px;
          line-height: 1.8;
        }

        /* =====================================================
           BUSINESS AREA CARDS
        ====================================================== */

        .sbs-business-areas {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;

          margin-top: 32px;
          max-width: 545px;
        }

        .sbs-area-card {
          min-height: 68px;

          display: flex;
          align-items: center;
          gap: 11px;

          padding: 11px 13px;

          border-radius: 14px;

          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(215, 224, 217, 0.95);

          box-shadow:
            0 6px 18px rgba(60, 84, 69, 0.035);

          transition:
            transform 160ms ease,
            box-shadow 160ms ease;
        }

        .sbs-area-card:hover {
          transform: translateY(-2px);
          box-shadow:
            0 10px 24px rgba(60, 84, 69, 0.07);
        }

        .sbs-area-icon {
          width: 37px;
          height: 37px;
          flex: 0 0 37px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 11px;
        }

        .sbs-area-icon svg {
          width: 18px;
          height: 18px;
        }

        .sbs-area-green .sbs-area-icon {
          color: #4f8562;
          background: #e2f1e5;
        }

        .sbs-area-peach .sbs-area-icon {
          color: #b9684b;
          background: #fce7db;
        }

        .sbs-area-blue .sbs-area-icon {
          color: #527aa3;
          background: #e3edf8;
        }

        .sbs-area-yellow .sbs-area-icon {
          color: #9a7a37;
          background: #f8efd4;
        }

        .sbs-area-card > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .sbs-area-card strong {
          color: #405349;
          font-size: 11px;
          font-weight: 750;
        }

        .sbs-area-card span {
          color: #8a958f;
          font-size: 9px;
          line-height: 1.3;
        }

        /* =====================================================
           QUOTE
        ====================================================== */

        .sbs-quote {
          display: flex;
          align-items: flex-start;
          gap: 10px;

          margin-top: 29px;
          max-width: 510px;
        }

        .sbs-quote-mark {
          color: #d08a6c;
          font-family: Georgia, serif;
          font-size: 38px;
          line-height: 0.8;
        }

        .sbs-quote p {
          margin: 0;

          color: #6e7b74;
          font-size: 11px;
          line-height: 1.6;
          font-style: italic;
        }

        .sbs-quote span {
          display: block;
          margin-top: 5px;

          color: #8c9891;
          font-size: 8px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        /* =====================================================
           LOGIN WRAPPER
        ====================================================== */

        .sbs-login-wrapper {
          width: 100%;
          position: relative;
        }

        .sbs-login-wrapper::before {
          content: "";
          position: absolute;

          width: 110px;
          height: 110px;

          right: -37px;
          top: -37px;

          border-radius: 30px;

          background: #f9dfd1;

          transform: rotate(12deg);

          z-index: -1;
        }

        .sbs-login-wrapper::after {
          content: "";

          position: absolute;

          width: 80px;
          height: 80px;

          left: -28px;
          bottom: -24px;

          border-radius: 50%;

          background: #dcebe1;

          z-index: -1;
        }

        /* =====================================================
           LOGIN CARD
        ====================================================== */

        .sbs-login-card {
          overflow: hidden;

          border-radius: 23px;

          background: #ffffff;

          border: 1px solid #e0e6e1;

          box-shadow:
            0 28px 65px rgba(58, 78, 66, 0.11),
            0 8px 20px rgba(58, 78, 66, 0.055);

          position: relative;
        }

        .sbs-card-color-strip {
          height: 5px;
          width: 100%;

          display: grid;
          grid-template-columns: 1.8fr 0.8fr 0.8fr 1fr;
        }

        .sbs-card-color-strip span:nth-child(1) {
          background: #5d966d;
        }

        .sbs-card-color-strip span:nth-child(2) {
          background: #e49a78;
        }

        .sbs-card-color-strip span:nth-child(3) {
          background: #8aaed0;
        }

        .sbs-card-color-strip span:nth-child(4) {
          background: #e3c875;
        }

        .sbs-card-content {
          padding: 34px 35px 28px;
        }

        /* =====================================================
           CARD BRAND
        ====================================================== */

        .sbs-card-brand {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .sbs-card-mark {
          width: 39px;
          height: 39px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 11px;

          background: #edf5ef;
          border: 1px solid #d8e7dc;

          color: #316347;

          font-size: 9px;
          font-weight: 850;
          letter-spacing: -1.5px;
        }

        .sbs-card-mark span:nth-child(2) {
          color: #d27c5c;
        }

        .sbs-card-brand-copy {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .sbs-card-brand-copy strong {
          color: #394d41;
          font-size: 11px;
          font-weight: 780;
        }

        .sbs-card-brand-copy span {
          color: #89948e;
          font-size: 8px;
          font-weight: 600;
        }

        /* =====================================================
           HEADING
        ====================================================== */

        .sbs-heading {
          margin-top: 37px;
        }

        .sbs-heading-small {
          display: block;

          color: #6a9477;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.18em;
        }

        .sbs-heading h2 {
          margin: 9px 0 0;

          color: #2d4036;

          font-size: 29px;
          line-height: 1.1;
          letter-spacing: -0.045em;
          font-weight: 720;
        }

        .sbs-heading p {
          margin: 9px 0 0;

          color: #829087;
          font-size: 11px;
          line-height: 1.55;
        }

        /* =====================================================
           FORM
        ====================================================== */

        .sbs-login-form {
          margin-top: 27px;
        }

        .sbs-field {
          margin-bottom: 18px;
        }

        .sbs-field label {
          display: block;
          margin-bottom: 7px;

          color: #53645a;
          font-size: 10px;
          font-weight: 750;
        }

        .sbs-input-wrapper {
          position: relative;
        }

        .sbs-input-icon {
          position: absolute;

          left: 13px;
          top: 50%;

          width: 16px;
          height: 16px;

          display: flex;
          align-items: center;
          justify-content: center;

          color: #91a097;

          transform: translateY(-50%);

          pointer-events: none;

          transition: color 160ms ease;
        }

        .sbs-input-icon svg {
          width: 16px;
          height: 16px;
        }

        .sbs-input-wrapper:focus-within .sbs-input-icon {
          color: #5d956d;
        }

        .sbs-input-wrapper input {
          width: 100%;
          height: 47px;

          padding: 0 13px 0 39px;

          border: 1px solid #dfe5e1;
          border-radius: 11px;

          outline: none;

          background: #fbfcfb;

          color: #33463b;

          font-family: inherit;
          font-size: 11px;

          transition:
            border-color 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        .sbs-input-wrapper input::placeholder {
          color: #adb6b0;
        }

        .sbs-input-wrapper input:hover {
          border-color: #cfd9d2;
          background: #ffffff;
        }

        .sbs-input-wrapper input:focus {
          border-color: #74a282;
          background: #ffffff;

          box-shadow:
            0 0 0 3px rgba(93, 150, 109, 0.1);
        }

        .sbs-input-wrapper input:disabled {
          opacity: 0.62;
          cursor: not-allowed;
        }

        /* =====================================================
           ERROR
        ====================================================== */

        .sbs-error {
          display: flex;
          align-items: flex-start;
          gap: 9px;

          margin: 2px 0 17px;
          padding: 11px;

          border-radius: 10px;

          background: #fff4f1;
          border: 1px solid #f0d5ce;
        }

        .sbs-error-symbol {
          width: 20px;
          height: 20px;
          flex: 0 0 20px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 50%;

          background: #f7d8cf;

          color: #ae5942;

          font-size: 10px;
          font-weight: 850;
        }

        .sbs-error-content {
          min-width: 0;

          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sbs-error-content strong {
          color: #98503d;
          font-size: 9px;
          font-weight: 800;
        }

        .sbs-error-content span {
          color: #a06e61;
          font-size: 9px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        /* =====================================================
           BUTTON
        ====================================================== */

        .sbs-login-button {
          width: 100%;
          height: 49px;

          border: 0;
          border-radius: 11px;

          background: #4f855f;

          color: #ffffff;

          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;

          font-family: inherit;
          font-size: 11px;
          font-weight: 780;

          cursor: pointer;

          box-shadow:
            0 9px 20px rgba(67, 119, 81, 0.2);

          transition:
            transform 160ms ease,
            background 160ms ease,
            box-shadow 160ms ease;
        }

        .sbs-login-button:hover:not(:disabled) {
          background: #467b56;
          transform: translateY(-1px);

          box-shadow:
            0 12px 24px rgba(67, 119, 81, 0.25);
        }

        .sbs-login-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .sbs-login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .sbs-button-arrow {
          font-size: 18px;
          line-height: 1;

          transition: transform 160ms ease;
        }

        .sbs-login-button:hover:not(:disabled)
          .sbs-button-arrow {
          transform: translateX(3px);
        }

        .sbs-spinner {
          width: 14px;
          height: 14px;

          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #ffffff;

          border-radius: 50%;

          animation: sbs-spin 0.7s linear infinite;
        }

        @keyframes sbs-spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* =====================================================
           TRUST
        ====================================================== */

        .sbs-trust {
          display: flex;
          align-items: center;
          gap: 9px;

          margin-top: 22px;
          padding-top: 19px;

          border-top: 1px solid #edf0ed;
        }

        .sbs-trust-icon {
          width: 29px;
          height: 29px;
          flex: 0 0 29px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 9px;

          background: #eef6f0;
          color: #5d916b;
        }

        .sbs-trust-icon svg {
          width: 15px;
          height: 15px;
        }

        .sbs-trust > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sbs-trust strong {
          color: #5b6b62;
          font-size: 9px;
          font-weight: 750;
        }

        .sbs-trust span {
          color: #9aa49e;
          font-size: 8px;
        }

        /* =====================================================
           CARD FOOTER
        ====================================================== */

        .sbs-card-footer {
          display: flex;
          align-items: center;
          gap: 5px;

          margin-top: 20px;
        }

        .sbs-mini-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }

        .sbs-mini-dot.green {
          background: #6d9d79;
        }

        .sbs-mini-dot.peach {
          background: #df9274;
        }

        .sbs-mini-dot.blue {
          background: #89aaca;
        }

        .sbs-card-footer-text {
          margin-left: 4px;

          color: #a0aaa4;
          font-size: 8px;
          font-weight: 550;
        }

        /* =====================================================
           FOOTER
        ====================================================== */

        .sbs-footer {
          width: min(1180px, calc(100% - 72px));
          margin: 0 auto;

          padding: 15px 0 24px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          border-top: 1px solid rgba(211, 220, 214, 0.65);
        }

        .sbs-footer > div {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .sbs-footer strong {
          color: #6b7b72;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .sbs-footer div span {
          padding-left: 9px;
          border-left: 1px solid #d5ddd7;

          color: #9ba59f;
          font-size: 8px;
        }

        .sbs-footer-copy {
          color: #a5aea9;
          font-size: 8px;
        }

        /* =====================================================
           TABLET
        ====================================================== */

        @media (max-width: 1050px) {
          .sbs-main {
            grid-template-columns: minmax(0, 1fr) 390px;
            gap: 55px;
          }

          .sbs-intro h1 {
            font-size: 53px;
          }
        }

        /* =====================================================
           MOBILE / SMALL TABLET
        ====================================================== */

        @media (max-width: 850px) {
          .sbs-header {
            width: calc(100% - 40px);
            padding-top: 22px;
          }

          .sbs-header-note {
            display: none;
          }

          .sbs-main {
            width: min(520px, calc(100% - 40px));
            grid-template-columns: 1fr;
            gap: 36px;

            padding: 38px 0 40px;
          }

          .sbs-intro {
            text-align: center;
            margin: 0 auto;
          }

          .sbs-welcome-pill {
            margin: 0 auto;
          }

          .sbs-intro h1 {
            font-size: 47px;
          }

          .sbs-intro-text {
            margin-left: auto;
            margin-right: auto;
          }

          .sbs-business-areas {
            margin-left: auto;
            margin-right: auto;
          }

          .sbs-quote {
            display: none;
          }

          .sbs-login-wrapper {
            max-width: 430px;
            margin: 0 auto;
            width: 100%;
          }

          .sbs-footer {
            width: calc(100% - 40px);
          }
        }

        /* =====================================================
           MOBILE
        ====================================================== */

        @media (max-width: 540px) {
          .sbs-header {
            width: calc(100% - 28px);
            padding-top: 17px;
          }

          .sbs-brand-copy strong {
            font-size: 9px;
          }

          .sbs-brand-copy span {
            font-size: 8px;
          }

          .sbs-brand-mark {
            width: 39px;
            height: 39px;
          }

          .sbs-main {
            width: calc(100% - 28px);
            padding-top: 27px;
          }

          .sbs-intro h1 {
            font-size: 39px;
          }

          .sbs-intro-text {
            font-size: 12px;
            line-height: 1.7;
          }

          .sbs-business-areas {
            grid-template-columns: 1fr 1fr;
          }

          .sbs-area-card {
            min-height: 63px;
            padding: 9px;
          }

          .sbs-area-icon {
            width: 33px;
            height: 33px;
            flex-basis: 33px;
          }

          .sbs-area-card strong {
            font-size: 10px;
          }

          .sbs-area-card span {
            font-size: 8px;
          }

          .sbs-card-content {
            padding: 29px 22px 24px;
          }

          .sbs-heading {
            margin-top: 31px;
          }

          .sbs-heading h2 {
            font-size: 26px;
          }

          .sbs-footer {
            width: calc(100% - 28px);
          }

          .sbs-footer > div {
            display: none;
          }

          .sbs-footer {
            justify-content: center;
          }
        }

        @media (max-height: 760px) and (min-width: 851px) {
          .sbs-header {
            padding-top: 20px;
          }

          .sbs-main {
            padding-top: 18px;
            padding-bottom: 25px;
          }

          .sbs-intro h1 {
            font-size: 55px;
          }

          .sbs-intro-text {
            margin-top: 19px;
          }

          .sbs-business-areas {
            margin-top: 23px;
          }

          .sbs-quote {
            margin-top: 19px;
          }

          .sbs-heading {
            margin-top: 29px;
          }

          .sbs-login-form {
            margin-top: 22px;
          }

          .sbs-field {
            margin-bottom: 14px;
          }
        }
      `}</style>
    </main>
  );
}