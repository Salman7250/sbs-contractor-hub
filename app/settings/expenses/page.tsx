"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type ExpenseSettings = {
  id?: string;
  company_id: string;
  daily_enabled: boolean;
  daily_time: string;
  weekly_enabled: boolean;
  weekly_day: number;
  weekly_time: string;
  monthly_enabled: boolean;
  monthly_time: string;
  timezone: string;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  include_csv: boolean;
  include_receipts: boolean;
  admin_email: string;
  admin_whatsapp: string;
};

type Company = {
  id: string;
  name: string;
  currency: string | null;
};

const DEFAULT_SETTINGS: Omit<
  ExpenseSettings,
  "company_id"
> = {
  daily_enabled: true,
  daily_time: "20:00",
  weekly_enabled: true,
  weekly_day: 0,
  weekly_time: "20:00",
  monthly_enabled: true,
  monthly_time: "20:00",
  timezone: "Asia/Dubai",
  email_enabled: true,
  whatsapp_enabled: true,
  include_csv: true,
  include_receipts: false,
  admin_email: "",
  admin_whatsapp: "",
};

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const TIMEZONES = [
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Asia/Kuwait",
  "Asia/Muscat",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Warsaw",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
];

function normalizeTime(
  value: string | null | undefined
) {
  if (!value) {
    return "20:00";
  }

  return value.slice(0, 5);
}

export default function ExpenseSettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [company, setCompany] =
    useState<Company | null>(null);

  const [settings, setSettings] =
    useState<ExpenseSettings | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const loadData = useCallback(
    async () => {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
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
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company membership found."
          );
        }

        const companyId =
          membership.company_id;

        const [
          companyResult,
          settingsResult,
        ] = await Promise.all([
          supabase
            .from("companies")
            .select(
              "id, name, currency"
            )
            .eq(
              "id",
              companyId
            )
            .single(),

          supabase
            .from(
              "expense_notification_settings"
            )
            .select("*")
            .eq(
              "company_id",
              companyId
            )
            .maybeSingle(),
        ]);

        if (companyResult.error) {
          throw companyResult.error;
        }

        if (settingsResult.error) {
          throw settingsResult.error;
        }

        setCompany(
          companyResult.data
        );

        if (settingsResult.data) {
          setSettings({
            ...settingsResult.data,
            daily_time:
              normalizeTime(
                settingsResult
                  .data
                  .daily_time
              ),
            weekly_time:
              normalizeTime(
                settingsResult
                  .data
                  .weekly_time
              ),
            monthly_time:
              normalizeTime(
                settingsResult
                  .data
                  .monthly_time
              ),
            admin_email:
              settingsResult
                .data
                .admin_email || "",
            admin_whatsapp:
              settingsResult
                .data
                .admin_whatsapp || "",
          });
        } else {
          setSettings({
            company_id: companyId,
            ...DEFAULT_SETTINGS,
          });
        }
      } catch (err: unknown) {
        console.error(
          "Expense settings load error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Could not load expense settings."
        );
      } finally {
        setLoading(false);
      }
    },
    [router, supabase]
  );

  useEffect(() => {
    // This effect intentionally starts the asynchronous
    // Supabase synchronization for the settings page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  function updateSetting<
    K extends keyof ExpenseSettings
  >(
    key: K,
    value: ExpenseSettings[K]
  ) {
    setSettings((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [key]: value,
      };
    });

    setSuccess("");
    setError("");
  }

  async function saveSettings() {
    if (!settings) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
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
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership?.company_id) {
        throw new Error(
          "No company membership found."
        );
      }

      if (
        settings.email_enabled &&
        !settings.admin_email.trim()
      ) {
        throw new Error(
          "Add an admin email address before enabling email notifications."
        );
      }

      if (
        settings.whatsapp_enabled &&
        !settings.admin_whatsapp.trim()
      ) {
        throw new Error(
          "Add an admin WhatsApp number before enabling WhatsApp notifications."
        );
      }

      const payload = {
        company_id:
          membership.company_id,

        daily_enabled:
          settings.daily_enabled,

        daily_time:
          settings.daily_time,

        weekly_enabled:
          settings.weekly_enabled,

        weekly_day:
          Number(
            settings.weekly_day
          ),

        weekly_time:
          settings.weekly_time,

        monthly_enabled:
          settings.monthly_enabled,

        monthly_time:
          settings.monthly_time,

        timezone:
          settings.timezone,

        email_enabled:
          settings.email_enabled,

        whatsapp_enabled:
          settings.whatsapp_enabled,

        include_csv:
          settings.include_csv,

        include_receipts:
          settings.include_receipts,

        admin_email:
          settings.admin_email.trim() ||
          null,

        admin_whatsapp:
          settings.admin_whatsapp.trim() ||
          null,
      };

      const {
        data,
        error: saveError,
      } = await supabase
        .from(
          "expense_notification_settings"
        )
        .upsert(
          payload,
          {
            onConflict:
              "company_id",
          }
        )
        .select("*")
        .single();

      if (saveError) {
        throw saveError;
      }

      setSettings({
        ...data,
        daily_time:
          normalizeTime(
            data.daily_time
          ),
        weekly_time:
          normalizeTime(
            data.weekly_time
          ),
        monthly_time:
          normalizeTime(
            data.monthly_time
          ),
        admin_email:
          data.admin_email || "",
        admin_whatsapp:
          data.admin_whatsapp || "",
      });

      setSuccess(
        "Expense settings saved successfully."
      );

      window.setTimeout(() => {
        setSuccess("");
      }, 2500);
    } catch (err: unknown) {
      console.error(
        "Expense settings save error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not save expense settings."
      );
    } finally {
      setSaving(false);
    }
  }

  function formatScheduleStatus(
    enabled: boolean
  ) {
    return enabled
      ? "Enabled"
      : "Disabled";
  }

  function getScheduleStatusClass(
    enabled: boolean
  ) {
    return enabled
      ? "status-enabled"
      : "status-disabled";
  }

  function getWeekdayLabel(
    value: number
  ) {
    return (
      WEEKDAYS.find(
        (day) =>
          day.value === value
      )?.label || "Sunday"
    );
  }

  if (loading || !settings) {
    return (
      <AppShell
        title="Expense Settings"
        description="Configure expense closing schedules and notifications."
      >
        <section className="page-content">
          <section className="content-card">
            <div className="loading-state">
              <div className="loading-spinner" />
              <div>
                <h3>
                  Loading expense settings
                </h3>
                <p>
                  Preparing your company expense configuration.
                </p>
              </div>
            </div>
          </section>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .content-card {
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              overflow: hidden;
              box-shadow: 0 2px 8px
                rgba(15, 23, 42, 0.04);
            }

            .loading-state {
              min-height: 360px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              padding: 40px 20px;
            }

            .loading-spinner {
              width: 28px;
              height: 28px;
              margin-bottom: 14px;
              border: 3px solid #e2e8f0;
              border-top-color: #334155;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
            }

            .loading-state h3 {
              margin: 0;
              color: #0f172a;
              font-size: 17px;
            }

            .loading-state p {
              margin: 7px 0 0;
              color: #94a3b8;
              font-size: 13px;
            }

            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }

            @media (max-width: 800px) {
              .page-content {
                padding: 18px;
              }
            }
          `}</style>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Expense Settings"
      description="Configure expense closing schedules and notifications."
      actions={
        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void loadData();
            }}
            disabled={loading || saving}
          >
            Refresh
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => {
              void saveSettings();
            }}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Save Settings"}
          </button>
        </div>
      }
    >
      <section className="page-content">
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Daily Closing
            </div>

            <div className="stat-row">
              <div className="stat-value-small">
                {formatScheduleStatus(
                  settings.daily_enabled
                )}
              </div>

              <span
                className={`status-badge ${getScheduleStatusClass(
                  settings.daily_enabled
                )}`}
              >
                {settings.daily_enabled
                  ? "ON"
                  : "OFF"}
              </span>
            </div>

            <div className="stat-description">
              Every day at{" "}
              {settings.daily_time}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Weekly Closing
            </div>

            <div className="stat-row">
              <div className="stat-value-small">
                {formatScheduleStatus(
                  settings.weekly_enabled
                )}
              </div>

              <span
                className={`status-badge ${getScheduleStatusClass(
                  settings.weekly_enabled
                )}`}
              >
                {settings.weekly_enabled
                  ? "ON"
                  : "OFF"}
              </span>
            </div>

            <div className="stat-description">
              {getWeekdayLabel(
                settings.weekly_day
              )}{" "}
              at{" "}
              {settings.weekly_time}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Monthly Closing
            </div>

            <div className="stat-row">
              <div className="stat-value-small">
                {formatScheduleStatus(
                  settings.monthly_enabled
                )}
              </div>

              <span
                className={`status-badge ${getScheduleStatusClass(
                  settings.monthly_enabled
                )}`}
              >
                {settings.monthly_enabled
                  ? "ON"
                  : "OFF"}
              </span>
            </div>

            <div className="stat-description">
              Last day at{" "}
              {settings.monthly_time}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Notifications
            </div>

            <div className="stat-value-small">
              {settings.email_enabled &&
              settings.whatsapp_enabled
                ? "Email + WhatsApp"
                : settings.email_enabled
                ? "Email"
                : settings.whatsapp_enabled
                ? "WhatsApp"
                : "Disabled"}
            </div>

            <div className="stat-description">
              Closing reports and alerts
            </div>
          </div>
        </div>

        <section className="content-card">
          <div className="content-card-header">
            <div>
              <h2>
                Expense Closing Schedule
              </h2>

              <p>
                Automatically prepare daily, weekly and monthly expense closing reports.
              </p>
            </div>
          </div>

          <div className="settings-body">
            <div className="schedule-grid">
              <div className="setting-panel">
                <div className="setting-panel-header">
                  <div>
                    <h3>
                      Daily Closing
                    </h3>

                    <p>
                      Close and report the previous day's expense activity.
                    </p>
                  </div>

                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={
                        settings.daily_enabled
                      }
                      onChange={(event) =>
                        updateSetting(
                          "daily_enabled",
                          event.target.checked
                        )
                      }
                    />

                    <span className="switch-slider" />
                  </label>
                </div>

                <div className="form-grid">
                  <div className="form-field">
                    <label>
                      Closing Time
                    </label>

                    <input
                      type="time"
                      value={
                        settings.daily_time
                      }
                      onChange={(event) =>
                        updateSetting(
                          "daily_time",
                          event.target.value
                        )
                      }
                      disabled={
                        !settings.daily_enabled
                      }
                    />

                    <span className="field-help">
                      Time is based on the company timezone.
                    </span>
                  </div>
                </div>
              </div>

              <div className="setting-panel">
                <div className="setting-panel-header">
                  <div>
                    <h3>
                      Weekly Closing
                    </h3>

                    <p>
                      Prepare a weekly expense summary on the selected day.
                    </p>
                  </div>

                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={
                        settings.weekly_enabled
                      }
                      onChange={(event) =>
                        updateSetting(
                          "weekly_enabled",
                          event.target.checked
                        )
                      }
                    />

                    <span className="switch-slider" />
                  </label>
                </div>

                <div className="form-grid">
                  <div className="form-field">
                    <label>
                      Closing Day
                    </label>

                    <select
                      value={
                        settings.weekly_day
                      }
                      onChange={(event) =>
                        updateSetting(
                          "weekly_day",
                          Number(
                            event.target.value
                          )
                        )
                      }
                      disabled={
                        !settings.weekly_enabled
                      }
                    >
                      {WEEKDAYS.map(
                        (day) => (
                          <option
                            key={
                              day.value
                            }
                            value={
                              day.value
                            }
                          >
                            {day.label}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>
                      Closing Time
                    </label>

                    <input
                      type="time"
                      value={
                        settings.weekly_time
                      }
                      onChange={(event) =>
                        updateSetting(
                          "weekly_time",
                          event.target.value
                        )
                      }
                      disabled={
                        !settings.weekly_enabled
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="setting-panel">
                <div className="setting-panel-header">
                  <div>
                    <h3>
                      Monthly Closing
                    </h3>

                    <p>
                      Prepare a monthly expense report at the end of each month.
                    </p>
                  </div>

                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={
                        settings.monthly_enabled
                      }
                      onChange={(event) =>
                        updateSetting(
                          "monthly_enabled",
                          event.target.checked
                        )
                      }
                    />

                    <span className="switch-slider" />
                  </label>
                </div>

                <div className="form-grid">
                  <div className="form-field">
                    <label>
                      Closing Day
                    </label>

                    <div className="readonly-field">
                      Last day of each month
                    </div>

                    <span className="field-help">
                      The closing period automatically covers the full month.
                    </span>
                  </div>

                  <div className="form-field">
                    <label>
                      Closing Time
                    </label>

                    <input
                      type="time"
                      value={
                        settings.monthly_time
                      }
                      onChange={(event) =>
                        updateSetting(
                          "monthly_time",
                          event.target.value
                        )
                      }
                      disabled={
                        !settings.monthly_enabled
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="content-card">
          <div className="content-card-header">
            <div>
              <h2>
                Notifications & Recipients
              </h2>

              <p>
                Choose how expense reports are delivered to company administrators.
              </p>
            </div>
          </div>

          <div className="settings-body">
            <div className="notification-grid">
              <div className="notification-option">
                <div>
                  <h3>
                    Email Notifications
                  </h3>

                  <p>
                    Send expense closing reports and notification messages by email.
                  </p>
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={
                      settings.email_enabled
                    }
                    onChange={(event) =>
                      updateSetting(
                        "email_enabled",
                        event.target.checked
                      )
                    }
                  />

                  <span className="switch-slider" />
                </label>
              </div>

              <div className="notification-option">
                <div>
                  <h3>
                    WhatsApp Notifications
                  </h3>

                  <p>
                    Send expense closing notifications through WhatsApp.
                  </p>
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={
                      settings.whatsapp_enabled
                    }
                    onChange={(event) =>
                      updateSetting(
                        "whatsapp_enabled",
                        event.target.checked
                      )
                    }
                  />

                  <span className="switch-slider" />
                </label>
              </div>
            </div>

            <div className="divider" />

            <div className="form-grid recipient-grid">
              <div className="form-field">
                <label>
                  Admin Email
                </label>

                <input
                  type="email"
                  value={
                    settings.admin_email
                  }
                  onChange={(event) =>
                    updateSetting(
                      "admin_email",
                      event.target.value
                    )
                  }
                  placeholder="admin@company.com"
                />

                <span className="field-help">
                  The recipient for expense closing reports.
                </span>
              </div>

              <div className="form-field">
                <label>
                  Admin WhatsApp
                </label>

                <input
                  type="tel"
                  value={
                    settings.admin_whatsapp
                  }
                  onChange={(event) =>
                    updateSetting(
                      "admin_whatsapp",
                      event.target.value
                    )
                  }
                  placeholder="+971 50 123 4567"
                />

                <span className="field-help">
                  Use the full international phone number.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="content-card">
          <div className="content-card-header">
            <div>
              <h2>
                Report Content
              </h2>

              <p>
                Choose what is included with generated closing reports.
              </p>
            </div>
          </div>

          <div className="settings-body">
            <div className="notification-grid">
              <div className="notification-option">
                <div>
                  <h3>
                    Include CSV Report
                  </h3>

                  <p>
                    Attach the expense closing CSV report to supported notifications.
                  </p>
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={
                      settings.include_csv
                    }
                    onChange={(event) =>
                      updateSetting(
                        "include_csv",
                        event.target.checked
                      )
                    }
                  />

                  <span className="switch-slider" />
                </label>
              </div>

              <div className="notification-option">
                <div>
                  <h3>
                    Include Receipts
                  </h3>

                  <p>
                    Include available expense receipts with closing reports where supported.
                  </p>
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={
                      settings.include_receipts
                    }
                    onChange={(event) =>
                      updateSetting(
                        "include_receipts",
                        event.target.checked
                      )
                    }
                  />

                  <span className="switch-slider" />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="content-card">
          <div className="content-card-header">
            <div>
              <h2>
                Company Timezone
              </h2>

              <p>
                Scheduled closing times are calculated using this timezone.
              </p>
            </div>
          </div>

          <div className="settings-body">
            <div className="timezone-row">
              <div className="form-field timezone-field">
                <label>
                  Timezone
                </label>

                <select
                  value={
                    settings.timezone
                  }
                  onChange={(event) =>
                    updateSetting(
                      "timezone",
                      event.target.value
                    )
                  }
                >
                  {TIMEZONES.map(
                    (timezone) => (
                      <option
                        key={timezone}
                        value={timezone}
                      >
                        {timezone}
                      </option>
                    )
                  )}
                </select>

                <span className="field-help">
                  Current company:{" "}
                  {company?.name ||
                    "Company"}
                </span>
              </div>

              <div className="timezone-info">
                <div className="info-icon">
                  ⓘ
                </div>

                <div>
                  <strong>
                    Scheduled jobs run server-side
                  </strong>

                  <p>
                    These settings only define the schedule and delivery preferences. The actual automated closing and notification workers will run on the server, not in the browser.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="info-card">
          <div className="info-icon large">
            ⓘ
          </div>

          <div>
            <h3>
              Notification provider setup
            </h3>

            <p>
              Email and WhatsApp delivery infrastructure will be connected separately. Saving these settings does not send messages immediately and does not require a browser session to remain open.
            </p>
          </div>
        </section>

        <div className="bottom-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void loadData();
            }}
            disabled={loading || saving}
          >
            Reset Changes
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => {
              void saveSettings();
            }}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Save Settings"}
          </button>
        </div>
      </section>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 20px;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.04);
        }

        .stat-label {
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .stat-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .stat-value-small {
          color: #0f172a;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.4px;
        }

        .stat-description {
          color: #94a3b8;
          font-size: 12px;
          margin-top: 7px;
        }

        .content-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.04);
        }

        .content-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 22px;
          border-bottom: 1px solid #e5e7eb;
        }

        .content-card-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 18px;
        }

        .content-card-header p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 13px;
        }

        .settings-body {
          padding: 22px;
        }

        .schedule-grid {
          display: grid;
          grid-template-columns: repeat(
            3,
            minmax(0, 1fr)
          );
          gap: 16px;
        }

        .setting-panel {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 18px;
          background: #ffffff;
        }

        .setting-panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .setting-panel-header h3,
        .notification-option h3 {
          margin: 0;
          color: #0f172a;
          font-size: 15px;
          font-weight: 700;
        }

        .setting-panel-header p,
        .notification-option p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.5;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 16px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-field label {
          color: #334155;
          font-size: 12px;
          font-weight: 700;
        }

        .form-field input,
        .form-field select {
          width: 100%;
          box-sizing: border-box;
          height: 42px;
          padding: 0 12px;
          border: 1px solid #dbe1e8;
          border-radius: 9px;
          background: #ffffff;
          color: #0f172a;
          font-size: 13px;
          outline: none;
        }

        .form-field input:focus,
        .form-field select:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px
            rgba(148, 163, 184, 0.12);
        }

        .form-field input:disabled,
        .form-field select:disabled {
          background: #f8fafc;
          color: #94a3b8;
          cursor: not-allowed;
        }

        .field-help {
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.4;
        }

        .readonly-field {
          min-height: 42px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          padding: 0 12px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #f8fafc;
          color: #64748b;
          font-size: 13px;
        }

        .notification-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 16px;
        }

        .notification-option {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 18px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }

        .recipient-grid {
          max-width: 900px;
        }

        .divider {
          height: 1px;
          background: #eef2f7;
          margin: 22px 0;
        }

        .timezone-row {
          display: grid;
          grid-template-columns: minmax(260px, 360px) 1fr;
          gap: 22px;
          align-items: end;
        }

        .timezone-info {
          min-height: 70px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border: 1px solid #dbeafe;
          border-radius: 10px;
          background: #eff6ff;
          color: #1e40af;
        }

        .timezone-info strong {
          display: block;
          color: #1e3a8a;
          font-size: 12px;
        }

        .timezone-info p {
          margin: 4px 0 0;
          color: #3b82f6;
          font-size: 12px;
          line-height: 1.5;
        }

        .info-icon {
          flex: 0 0 auto;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #dbeafe;
          color: #2563eb;
          font-size: 15px;
        }

        .info-icon.large {
          width: 36px;
          height: 36px;
          border-radius: 10px;
        }

        .info-card {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 24px;
          padding: 16px 18px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #f8fafc;
        }

        .info-card h3 {
          margin: 0;
          color: #0f172a;
          font-size: 13px;
          font-weight: 700;
        }

        .info-card p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status-enabled {
          background: #ecfdf5;
          color: #059669;
        }

        .status-disabled {
          background: #f1f5f9;
          color: #64748b;
        }

        .switch {
          position: relative;
          flex: 0 0 auto;
          width: 42px;
          height: 24px;
          cursor: pointer;
        }

        .switch input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .switch-slider {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: #cbd5e1;
          transition:
            background 0.2s ease;
        }

        .switch-slider::before {
          content: "";
          position: absolute;
          width: 18px;
          height: 18px;
          left: 3px;
          top: 3px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 1px 3px
            rgba(15, 23, 42, 0.18);
          transition:
            transform 0.2s ease;
        }

        .switch input:checked
          + .switch-slider {
          background: #0f172a;
        }

        .switch input:checked
          + .switch-slider::before {
          transform: translateX(18px);
        }

        .switch input:focus-visible
          + .switch-slider {
          box-shadow: 0 0 0 3px
            rgba(15, 23, 42, 0.12);
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 40px;
          padding: 0 15px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .primary-button {
          border: 0;
          background: #0f172a;
          color: #ffffff;
        }

        .primary-button:hover {
          background: #1e293b;
        }

        .secondary-button {
          border: 1px solid #dbe1e8;
          background: #ffffff;
          color: #475569;
        }

        .secondary-button:hover {
          background: #f8fafc;
        }

        .primary-button:disabled,
        .secondary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .bottom-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding-bottom: 10px;
        }

        .alert {
          padding: 12px 14px;
          margin-bottom: 18px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
        }

        .alert-error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .alert-success {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(
              2,
              1fr
            );
          }

          .schedule-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 18px;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }

          .notification-grid,
          .timezone-row {
            grid-template-columns: 1fr;
          }

          .timezone-info {
            align-self: stretch;
          }
        }

        @media (max-width: 600px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .content-card-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .settings-body {
            padding: 16px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .notification-option {
            padding: 15px;
          }

          .bottom-actions {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          .bottom-actions button {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}