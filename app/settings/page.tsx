"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  country: string | null;
  state: string | null;
  currency: string | null;
  timezone: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
};

type TeamMember = {
  user_id: string;
  role: string;
  company_id: string;
  profile?: {
    full_name: string | null;
  } | null;
};

const ROLE_ORDER: Record<string, number> = {
  owner: 1,
  admin: 2,
  member: 3,
};

const CURRENCIES = [
  "USD",
  "CAD",
  "GBP",
  "EUR",
  "AED",
  "AUD",
];

const TIMEZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Australia/Sydney",
];

function getInitials(name: string) {
  const clean = name.trim();

  if (!clean) return "U";

  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [userEmail, setUserEmail] = useState("");
  const [company, setCompany] = useState<Company | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);

  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("America/Chicago");

  const [fullName, setFullName] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserEmail(user.email || "");

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from("company_members")
        .select("company_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership) {
        throw new Error(
          "No company membership was found for this account."
        );
      }

      const {
        data: companyData,
        error: companyError,
      } = await supabase
        .from("companies")
        .select(
          "id, name, country, state, currency, timezone"
        )
        .eq("id", membership.company_id)
        .maybeSingle();

      if (companyError) {
        throw companyError;
      }

      if (!companyData) {
        throw new Error(
          "The company associated with your account could not be found."
        );
      }

      setCompany(companyData);
      setCompanyName(companyData.name || "");
      setCountry(companyData.country || "");
      setState(companyData.state || "");
      setCurrency(companyData.currency || "USD");
      setTimezone(companyData.timezone || "America/Chicago");

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (profileData) {
        setProfile(profileData);
        setFullName(profileData.full_name || "");
      }

      const {
        data: teamData,
        error: teamError,
      } = await supabase
        .from("company_members")
        .select("user_id, role, company_id")
        .eq("company_id", membership.company_id)
        .order("role", { ascending: true });

      if (teamError) {
        throw teamError;
      }

      const members = teamData || [];

      if (members.length > 0) {
        const userIds = members.map(
          (member) => member.user_id
        );

        const {
          data: profilesData,
          error: profilesError,
        } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        if (profilesError) {
          throw profilesError;
        }

        const profileMap = new Map(
          (profilesData || []).map((item) => [
            item.id,
            item,
          ])
        );

        const normalizedTeam = members
          .map((member) => ({
            ...member,
            profile:
              profileMap.get(member.user_id) || null,
          }))
          .sort(
            (a, b) =>
              (ROLE_ORDER[
                String(a.role).toLowerCase()
              ] || 99) -
              (ROLE_ORDER[
                String(b.role).toLowerCase()
              ] || 99)
          );

        setTeam(normalizedTeam);
      } else {
        setTeam([]);
      }
    } catch (err: any) {
      console.error("Settings load error:", err);

      setError(
        err?.message || "Could not load your settings."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveCompanySettings(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!company) {
      setError("Company information is not loaded.");
      return;
    }

    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }

    try {
      setSavingCompany(true);
      setMessage("");
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from("company_members")
        .select("company_id, role")
        .eq("user_id", user.id)
        .eq("company_id", company.id)
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership) {
        throw new Error(
          "You are not a member of this company."
        );
      }

      const role = String(
        membership.role || ""
      ).toLowerCase();

      if (role !== "owner" && role !== "admin") {
        throw new Error(
          "Only an owner or admin can update company settings."
        );
      }

      const updatedCompany = {
        name: companyName.trim(),
        country: country.trim() || null,
        state: state.trim() || null,
        currency,
        timezone,
      };

      const {
  data: savedCompany,
  error: updateError,
} = await supabase
  .from("companies")
  .update(updatedCompany)
  .eq("id", company.id)
  .select("id, name, country, state, currency, timezone")
  .maybeSingle();

if (updateError) {
  throw updateError;
}

if (!savedCompany) {
  throw new Error(
    "The company could not be updated. Please check your company permissions and try again."
  );
}

setCompany(savedCompany);

setCompanyName(savedCompany.name || "");
setCountry(savedCompany.country || "");
setState(savedCompany.state || "");
setCurrency(savedCompany.currency || "USD");
setTimezone(
  savedCompany.timezone || "America/Chicago"
);

window.dispatchEvent(
  new CustomEvent("sbs-company-updated", {
    detail: {
      id: savedCompany.id,
      name: savedCompany.name,
      currency: savedCompany.currency,
      timezone: savedCompany.timezone,
    },
  })
);
      setMessage(
        "Company settings saved successfully."
      );
    } catch (err: any) {
      console.error(
        "Company settings update error:",
        err
      );

      setError(
        err?.message ||
          "Could not save company settings."
      );
    } finally {
      setSavingCompany(false);
    }
  }

  async function saveProfile(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!fullName.trim()) {
      setError("Your name is required.");
      return;
    }

    try {
      setSavingProfile(true);
      setMessage("");
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const {
        data,
        error: updateError,
      } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
        })
        .eq("id", user.id)
        .select("id, full_name")
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      if (!data) {
        throw new Error(
          "Your profile record could not be found. Please refresh the page and try again."
        );
      }

      setProfile(data);
      setFullName(data.full_name || "");

      setMessage(
        "Profile updated successfully."
      );
    } catch (err: any) {
      console.error(
        "Profile update error:",
        err
      );

      setError(
        err?.message ||
          "Could not update your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  const currentMember = useMemo(
    () =>
      team.find(
        (member) =>
          member.user_id === profile?.id
      ),
    [team, profile?.id]
  );

  const currentRole =
    currentMember?.role || "owner";

  const isAdmin =
    currentRole === "owner" ||
    currentRole === "admin";

  const initials = useMemo(
    () => getInitials(fullName),
    [fullName]
  );

  if (loading) {
    return (
      <AppShell
        title="Settings"
        description="Manage your workspace, profile, team, and account."
      >
        <div className="settings-loading">
          <div className="settings-loading-card">
            <div className="settings-spinner" />
            <strong>Loading settings...</strong>
            <span>
              Preparing your workspace configuration.
            </span>
          </div>
        </div>

        <style jsx>{`
          .settings-loading {
            min-height: 500px;
            display: grid;
            place-items: center;
          }

          .settings-loading-card {
            width: min(420px, 100%);
            background: white;
            border: 1px solid #e5eaf0;
            border-radius: 18px;
            padding: 34px;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 8px;
            box-shadow: 0 8px 30px rgba(15, 23, 42, 0.05);
          }

          .settings-loading-card strong {
            color: #172033;
            font-size: 15px;
          }

          .settings-loading-card span {
            color: #718096;
            font-size: 13px;
          }

          .settings-spinner {
            width: 34px;
            height: 34px;
            border: 3px solid #e7ecf2;
            border-top-color: #172033;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 8px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Settings"
      description="Manage your workspace, profile, team, and account."
    >
      <div className="settings-page">
        {message && (
          <div className="settings-alert settings-alert-success">
            <span className="settings-alert-icon">
              ✓
            </span>
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="settings-alert settings-alert-error">
            <span className="settings-alert-icon">
              !
            </span>
            <span>{error}</span>
          </div>
        )}

        <section className="settings-hero">
          <div className="settings-hero-content">
            <div className="settings-hero-icon">
              ⚙
            </div>

            <div>
              <span className="settings-eyebrow">
                Workspace configuration
              </span>

              <h2>Settings & Administration</h2>

              <p>
                Configure your company, regional preferences,
                profile, team access, and account information.
              </p>
            </div>
          </div>

          <div className="settings-company-chip">
            <div className="settings-company-chip-avatar">
              {getInitials(companyName)}
            </div>

            <div>
              <span>Active workspace</span>
              <strong>{companyName}</strong>
            </div>
          </div>
        </section>

        <div className="settings-grid">
          <section className="settings-card settings-card-wide">
            <div className="settings-card-header">
              <div>
                <span className="settings-section-label">
                  Workspace
                </span>

                <h3>Company Profile</h3>

                <p>
                  Keep the legal and operational identity of
                  your company up to date.
                </p>
              </div>

              <div className="settings-card-badge">
                {isAdmin ? "Editable" : "Read only"}
              </div>
            </div>

            <form
              className="settings-form"
              onSubmit={saveCompanySettings}
            >
              <div className="settings-form-grid">
                <label className="settings-field settings-field-full">
                  <span>Company name</span>

                  <input
                    value={companyName}
                    onChange={(event) =>
                      setCompanyName(event.target.value)
                    }
                    disabled={!isAdmin || savingCompany}
                    placeholder="Your company name"
                  />

                  <small>
                    This name appears throughout your
                    Contractor Hub workspace.
                  </small>
                </label>

                <label className="settings-field">
                  <span>Country</span>

                  <input
                    value={country}
                    onChange={(event) =>
                      setCountry(event.target.value)
                    }
                    disabled={!isAdmin || savingCompany}
                    placeholder="United States"
                  />
                </label>

                <label className="settings-field">
                  <span>State / Region</span>

                  <input
                    value={state}
                    onChange={(event) =>
                      setState(event.target.value)
                    }
                    disabled={!isAdmin || savingCompany}
                    placeholder="Texas"
                  />
                </label>

                <label className="settings-field">
                  <span>Currency</span>

                  <select
                    value={currency}
                    onChange={(event) =>
                      setCurrency(event.target.value)
                    }
                    disabled={!isAdmin || savingCompany}
                  >
                    {CURRENCIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="settings-field">
                  <span>Timezone</span>

                  <select
                    value={timezone}
                    onChange={(event) =>
                      setTimezone(event.target.value)
                    }
                    disabled={!isAdmin || savingCompany}
                  >
                    {TIMEZONES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {isAdmin && (
                <div className="settings-form-actions">
                  <span>
                    Changes are protected by your company
                    permissions.
                  </span>

                  <button
                    type="submit"
                    className="primary-button settings-save-button"
                    disabled={savingCompany}
                  >
                    {savingCompany
                      ? "Saving..."
                      : "Save Company Settings"}
                  </button>
                </div>
              )}
            </form>
          </section>

          <section className="settings-card">
            <div className="settings-card-header">
              <div>
                <span className="settings-section-label">
                  Localization
                </span>

                <h3>Regional Preferences</h3>

                <p>
                  These preferences control how business
                  information is displayed.
                </p>
              </div>
            </div>

            <div className="settings-info-list">
              <div className="settings-info-row">
                <span>Currency</span>
                <strong>
                  {currency || "USD"}
                </strong>
              </div>

              <div className="settings-info-row">
                <span>Timezone</span>
                <strong>
                  {timezone || "Not configured"}
                </strong>
              </div>

              <div className="settings-info-row">
                <span>Location</span>
                <strong>
                  {[state, country]
                    .filter(Boolean)
                    .join(", ") || "Not configured"}
                </strong>
              </div>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-header">
              <div>
                <span className="settings-section-label">
                  Personal
                </span>

                <h3>Your Profile</h3>

                <p>
                  Update the name shown across your
                  workspace.
                </p>
              </div>

              <div className="settings-profile-avatar">
                {initials}
              </div>
            </div>

            <form
              className="settings-form"
              onSubmit={saveProfile}
            >
              <label className="settings-field">
                <span>Full name</span>

                <input
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  disabled={savingProfile}
                  placeholder="Your full name"
                />
              </label>

              <label className="settings-field">
                <span>Email address</span>

                <input
                  value={userEmail}
                  disabled
                  readOnly
                />

                <small>
                  Your login email is managed by your
                  authentication provider.
                </small>
              </label>

              <button
                type="submit"
                className="secondary-button"
                disabled={savingProfile}
              >
                {savingProfile
                  ? "Updating..."
                  : "Update Profile"}
              </button>
            </form>
          </section>

          <section className="settings-card settings-card-wide">
            <div className="settings-card-header">
              <div>
                <span className="settings-section-label">
                  Access Control
                </span>

                <h3>Team & Permissions</h3>

                <p>
                  Review the members who currently have
                  access to this company workspace.
                </p>
              </div>

              <div className="settings-team-count">
                {team.length}{" "}
                {team.length === 1
                  ? "member"
                  : "members"}
              </div>
            </div>

            {team.length === 0 ? (
              <div className="settings-empty">
                <div>👥</div>
                <strong>No team members found</strong>
                <span>
                  Your company does not currently have
                  additional members.
                </span>
              </div>
            ) : (
              <div className="settings-team-table">
                {team.map((member) => {
                  const memberName =
                    member.profile?.full_name ||
                    "Unnamed User";

                  const memberInitials =
                    getInitials(memberName);

                  return (
                    <div
                      key={`${member.company_id}-${member.user_id}`}
                      className="settings-team-row"
                    >
                      <div className="settings-team-person">
                        <div className="settings-team-avatar">
                          {memberInitials}
                        </div>

                        <div>
                          <strong>
                            {memberName}
                          </strong>

                          <span>
                            {member.user_id ===
                            profile?.id
                              ? "You"
                              : "Workspace member"}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`settings-role settings-role-${String(
                          member.role
                        ).toLowerCase()}`}
                      >
                        {formatRole(member.role)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="settings-card">
            <div className="settings-card-header">
              <div>
                <span className="settings-section-label">
                  Security
                </span>

                <h3>Security & Account</h3>

                <p>
                  Account-level information and security
                  controls.
                </p>
              </div>
            </div>

            <div className="settings-security-list">
              <div className="settings-security-item">
                <div className="settings-security-icon">
                  ✓
                </div>

                <div>
                  <strong>
                    Authentication enabled
                  </strong>

                  <span>
                    Your account is authenticated through
                    Supabase.
                  </span>
                </div>
              </div>

              <div className="settings-security-item">
                <div className="settings-security-icon">
                  ✓
                </div>

                <div>
                  <strong>
                    Company isolation enabled
                  </strong>

                  <span>
                    Workspace data is protected by
                    company-level access policies.
                  </span>
                </div>
              </div>

              <div className="settings-security-item">
                <div className="settings-security-icon">
                  {isAdmin ? "✓" : "—"}
                </div>

                <div>
                  <strong>
                    Administrative access
                  </strong>

                  <span>
                    {isAdmin
                      ? "You can manage company settings."
                      : "You have member-level access."}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-header">
              <div>
                <span className="settings-section-label">
                  Workspace Details
                </span>

                <h3>System Information</h3>

                <p>
                  Internal identifiers for this workspace.
                </p>
              </div>
            </div>

            <div className="settings-system-list">
              <div>
                <span>Company ID</span>

                <code>
                  {company?.id || "Unavailable"}
                </code>
              </div>

              <div>
                <span>Your role</span>

                <strong>
                  {formatRole(currentRole)}
                </strong>
              </div>

              <div>
                <span>Account email</span>

                <strong>
                  {userEmail || "Unavailable"}
                </strong>
              </div>
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .settings-page {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
        }

        .settings-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 16px;
          border-radius: 12px;
          margin-bottom: 18px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid transparent;
        }

        .settings-alert-success {
          background: #ecfdf3;
          border-color: #bbf7d0;
          color: #166534;
        }

        .settings-alert-error {
          background: #fff1f2;
          border-color: #fecdd3;
          color: #be123c;
        }

        .settings-alert-icon {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          background: currentColor;
          color: white;
          font-size: 12px;
          font-weight: 800;
        }

        .settings-alert-error .settings-alert-icon {
          background: #be123c;
        }

        .settings-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 26px;
          margin-bottom: 22px;
          border-radius: 20px;
          border: 1px solid #e4e9ef;
          background:
            linear-gradient(
              135deg,
              #ffffff 0%,
              #f7faff 100%
            );
          box-shadow:
            0 8px 30px rgba(15, 23, 42, 0.045);
        }

        .settings-hero-content {
          display: flex;
          align-items: center;
          gap: 17px;
        }

        .settings-hero-icon {
          width: 52px;
          height: 52px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          background: #172033;
          color: white;
          font-size: 22px;
          flex: 0 0 auto;
        }

        .settings-eyebrow,
        .settings-section-label {
          display: block;
          margin-bottom: 5px;
          color: #718096;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.11em;
          text-transform: uppercase;
        }

        .settings-hero h2 {
          margin: 0;
          color: #172033;
          font-size: 24px;
          line-height: 1.2;
          letter-spacing: -0.025em;
        }

        .settings-hero p {
          margin: 7px 0 0;
          color: #718096;
          font-size: 13px;
          line-height: 1.6;
        }

        .settings-company-chip {
          min-width: 230px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border: 1px solid #e4e9ef;
          border-radius: 14px;
          background: white;
        }

        .settings-company-chip-avatar {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: #edf2f7;
          color: #172033;
          font-size: 11px;
          font-weight: 800;
        }

        .settings-company-chip span,
        .settings-company-chip strong {
          display: block;
        }

        .settings-company-chip span {
          margin-bottom: 2px;
          color: #8a94a6;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .settings-company-chip strong {
          color: #172033;
          font-size: 13px;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 18px;
        }

        .settings-card {
          min-width: 0;
          padding: 22px;
          border: 1px solid #e4e9ef;
          border-radius: 18px;
          background: white;
          box-shadow:
            0 6px 24px rgba(15, 23, 42, 0.035);
        }

        .settings-card-wide {
          grid-column: span 2;
        }

        .settings-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 20px;
        }

        .settings-card-header h3 {
          margin: 0;
          color: #172033;
          font-size: 17px;
          letter-spacing: -0.015em;
        }

        .settings-card-header p {
          max-width: 650px;
          margin: 6px 0 0;
          color: #718096;
          font-size: 12px;
          line-height: 1.55;
        }

        .settings-card-badge,
        .settings-team-count {
          flex: 0 0 auto;
          padding: 7px 10px;
          border-radius: 999px;
          background: #f2f5f8;
          color: #566274;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .settings-form-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 16px;
        }

        .settings-field {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .settings-field-full {
          grid-column: span 2;
        }

        .settings-field > span {
          color: #334155;
          font-size: 11px;
          font-weight: 800;
        }

        .settings-field input,
        .settings-field select {
          width: 100%;
          min-height: 42px;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid #dfe5ec;
          border-radius: 10px;
          outline: none;
          background: #fff;
          color: #172033;
          font: inherit;
          font-size: 13px;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .settings-field input:focus,
        .settings-field select:focus {
          border-color: #9aa6b6;
          box-shadow:
            0 0 0 3px rgba(23, 32, 51, 0.06);
        }

        .settings-field input:disabled,
        .settings-field select:disabled {
          background: #f7f9fb;
          color: #7b8798;
          cursor: not-allowed;
        }

        .settings-field input[readonly] {
          background: #f7f9fb;
          color: #6b7688;
        }

        .settings-field small {
          color: #8a94a6;
          font-size: 10px;
          line-height: 1.45;
        }

        .settings-form-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid #edf0f4;
        }

        .settings-form-actions > span {
          color: #8a94a6;
          font-size: 10px;
          line-height: 1.45;
        }

        .settings-save-button {
          flex: 0 0 auto;
          min-height: 42px;
        }

        .settings-info-list {
          display: flex;
          flex-direction: column;
          border-top: 1px solid #edf0f4;
        }

        .settings-info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 14px 0;
          border-bottom: 1px solid #edf0f4;
        }

        .settings-info-row span {
          color: #718096;
          font-size: 12px;
        }

        .settings-info-row strong {
          max-width: 55%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #172033;
          font-size: 12px;
          text-align: right;
        }

        .settings-profile-avatar {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: #172033;
          color: white;
          font-size: 12px;
          font-weight: 800;
        }

        .settings-form {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .secondary-button {
          width: fit-content;
          min-height: 40px;
          padding: 9px 14px;
          border: 1px solid #d8dee7;
          border-radius: 10px;
          background: white;
          color: #172033;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            transform 0.15s ease;
        }

        .secondary-button:hover:not(:disabled) {
          background: #f7f9fb;
          border-color: #c6ced9;
        }

        .secondary-button:disabled,
        .primary-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .settings-team-table {
          border-top: 1px solid #edf0f4;
        }

        .settings-team-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 14px 0;
          border-bottom: 1px solid #edf0f4;
        }

        .settings-team-person {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .settings-team-avatar {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          background: #eef2f6;
          color: #172033;
          font-size: 10px;
          font-weight: 800;
        }

        .settings-team-person strong,
        .settings-team-person span {
          display: block;
        }

        .settings-team-person strong {
          color: #273244;
          font-size: 12px;
        }

        .settings-team-person span {
          margin-top: 2px;
          color: #8a94a6;
          font-size: 10px;
        }

        .settings-role {
          flex: 0 0 auto;
          padding: 6px 9px;
          border-radius: 999px;
          background: #f2f5f8;
          color: #566274;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .settings-role-owner {
          background: #edf2f7;
          color: #172033;
        }

        .settings-role-admin {
          background: #f3f4f6;
          color: #374151;
        }

        .settings-empty {
          min-height: 170px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 6px;
          border: 1px dashed #dbe2ea;
          border-radius: 14px;
          background: #fafbfd;
        }

        .settings-empty > div {
          font-size: 24px;
          margin-bottom: 4px;
        }

        .settings-empty strong {
          color: #334155;
          font-size: 13px;
        }

        .settings-empty span {
          color: #8a94a6;
          font-size: 11px;
        }

        .settings-security-list {
          display: flex;
          flex-direction: column;
          gap: 13px;
        }

        .settings-security-item {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 12px;
          border: 1px solid #edf0f4;
          border-radius: 12px;
          background: #fafbfd;
        }

        .settings-security-icon {
          width: 24px;
          height: 24px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          background: #eaf7ef;
          color: #21864a;
          font-size: 11px;
          font-weight: 900;
        }

        .settings-security-item strong,
        .settings-security-item span {
          display: block;
        }

        .settings-security-item strong {
          color: #334155;
          font-size: 11px;
        }

        .settings-security-item span {
          margin-top: 3px;
          color: #8a94a6;
          font-size: 10px;
          line-height: 1.45;
        }

        .settings-system-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .settings-system-list > div {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 12px 0;
          border-bottom: 1px solid #edf0f4;
        }

        .settings-system-list > div:last-child {
          border-bottom: 0;
        }

        .settings-system-list span {
          color: #8a94a6;
          font-size: 10px;
          font-weight: 700;
        }

        .settings-system-list strong,
        .settings-system-list code {
          color: #334155;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .settings-system-list code {
          padding: 7px 9px;
          border-radius: 8px;
          background: #f5f7fa;
          font-family:
            var(--font-geist-mono),
            monospace;
        }

        @media (max-width: 1050px) {
          .settings-hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .settings-company-chip {
            width: 100%;
            box-sizing: border-box;
          }

          .settings-grid {
            grid-template-columns: 1fr;
          }

          .settings-card-wide {
            grid-column: span 1;
          }
        }

        @media (max-width: 700px) {
          .settings-hero {
            padding: 19px;
            border-radius: 16px;
          }

          .settings-hero-content {
            align-items: flex-start;
          }

          .settings-hero-icon {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            font-size: 18px;
          }

          .settings-hero h2 {
            font-size: 20px;
          }

          .settings-card {
            padding: 17px;
            border-radius: 15px;
          }

          .settings-form-grid {
            grid-template-columns: 1fr;
          }

          .settings-field-full {
            grid-column: span 1;
          }

          .settings-form-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .settings-save-button {
            width: 100%;
          }

          .settings-team-row {
            align-items: flex-start;
          }

          .settings-role {
            margin-top: 4px;
          }
        }

        @media (max-width: 480px) {
          .settings-hero-content {
            flex-direction: column;
          }

          .settings-company-chip {
            min-width: 0;
          }

          .settings-card-header {
            flex-direction: column;
          }

          .settings-card-badge,
          .settings-team-count {
            align-self: flex-start;
          }

          .settings-info-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 4px;
          }

          .settings-info-row strong {
            max-width: 100%;
            text-align: left;
          }

          .settings-team-row {
            flex-direction: column;
          }
        }
      `}</style>
    </AppShell>
  );
}