"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  Globe2,
  Lock,
  Mail,
  Save,
  Settings2,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Wrench,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PlatformSettings = {
  id: string;
  platform_name: string;
  platform_url: string;
  support_email: string | null;
  support_phone: string | null;

  default_country: string;
  default_currency: string;
  default_timezone: string;

  require_email_verification: boolean;
  mfa_policy: "disabled" | "optional" | "required";
  admin_session_protection: boolean;
  session_duration_days: number;

  default_company_status:
    | "active"
    | "trial"
    | "suspended"
    | "cancelled";

  default_trial_days: number;
  automatic_company_activation: boolean;

  new_company_signups_enabled: boolean;
  maintenance_mode: boolean;
  platform_lockdown: boolean;

  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

const countries = [
  "United States",
  "United Arab Emirates",
  "Pakistan",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "Netherlands",
  "Saudi Arabia",
];

const currencies = [
  "USD",
  "AED",
  "PKR",
  "GBP",
  "EUR",
  "CAD",
  "AUD",
  "SAR",
];

const timezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
  "Asia/Dubai",
  "Asia/Karachi",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Amsterdam",
];

const sessionOptions = [1, 7, 14, 30, 60, 90];

const trialOptions = [0, 7, 14, 30, 60, 90];

export default function PlatformSettingsPage() {
  const supabase = createClient();

  const [settings, setSettings] =
    useState<PlatformSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      setLoading(true);
      setError("");

      const { data, error: loadError } = await supabase
        .from("platform_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (!mounted) return;

      if (loadError) {
        console.error(loadError);
        setError(loadError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError("Platform settings could not be found.");
        setLoading(false);
        return;
      }

      setSettings(data as PlatformSettings);
      setLoading(false);
    }

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!settings) return;

    setSaving(true);
    setSaved(false);
    setError("");

    const { error: saveError } = await supabase.rpc(
      "update_platform_settings",
      {
        p_platform_name: settings.platform_name,
        p_platform_url: settings.platform_url,
        p_support_email: settings.support_email,
        p_support_phone: settings.support_phone,
        p_default_country: settings.default_country,
        p_default_currency: settings.default_currency,
        p_default_timezone: settings.default_timezone,
        p_require_email_verification:
          settings.require_email_verification,
        p_mfa_policy: settings.mfa_policy,
        p_admin_session_protection:
          settings.admin_session_protection,
        p_session_duration_days:
          settings.session_duration_days,
        p_default_company_status:
          settings.default_company_status,
        p_default_trial_days:
          settings.default_trial_days,
        p_automatic_company_activation:
          settings.automatic_company_activation,
        p_new_company_signups_enabled:
          settings.new_company_signups_enabled,
        p_maintenance_mode: settings.maintenance_mode,
        p_platform_lockdown:
          settings.platform_lockdown,
      }
    );

    if (saveError) {
      console.error(saveError);
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);

    window.setTimeout(() => {
      setSaved(false);
    }, 3500);
  }

  function updateSetting<K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K]
  ) {
    setSettings((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current
    );
  }

  if (loading) {
    return (
      <div className="space-y-7">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />

        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-200" />

        <div className="grid gap-5 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
            />
          ))}
        </div>

        <div className="h-[500px] animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-500" />

          <div>
            <h2 className="text-sm font-semibold text-red-900">
              Unable to load platform settings
            </h2>

            <p className="mt-1 text-sm text-red-700">
              {error ||
                "The platform settings record is unavailable."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="space-y-7 pb-10"
    >
      {/* HEADER */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
            <Settings2 className="h-4 w-4" />
            Platform Configuration
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Platform Settings
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Control the global configuration and behavior of
            the SBS platform. These settings apply at the
            platform level rather than to an individual company.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* SUCCESS */}
      {saved && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-4 w-4" />
          </div>

          <div>
            <div className="font-semibold">
              Platform settings saved
            </div>

            <div className="text-xs text-emerald-600">
              Your changes have been applied successfully.
            </div>
          </div>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

          <div>
            <div className="font-semibold">
              Unable to save settings
            </div>

            <div className="mt-1 text-xs">
              {error}
            </div>
          </div>
        </div>
      )}

      {/* PLATFORM STATUS */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Globe2 className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Platform Status
                </h2>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Operational
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-500">
                Global SBS configuration and platform controls.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MiniStat
              label="Currency"
              value={settings.default_currency}
            />

            <MiniStat
              label="Timezone"
              value={settings.default_timezone
                .split("/")
                .pop()
                ?.replace(/_/g, " ") ?? settings.default_timezone}
            />

            <MiniStat
              label="Trial"
              value={`${settings.default_trial_days} days`}
            />
          </div>
        </div>
      </section>

      {/* GENERAL */}
      <SettingsSection
        icon={<Globe2 className="h-5 w-5" />}
        title="General Platform"
        description="Identity and regional defaults used throughout SBS."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Platform Name"
            description="The name displayed throughout the SBS platform."
          >
            <input
              value={settings.platform_name}
              onChange={(event) =>
                updateSetting(
                  "platform_name",
                  event.target.value
                )
              }
              className={inputClass}
              placeholder="Sharif Business Solutions"
            />
          </Field>

          <Field
            label="Platform URL"
            description="Primary public URL for the SBS platform."
          >
            <input
              type="url"
              value={settings.platform_url}
              onChange={(event) =>
                updateSetting(
                  "platform_url",
                  event.target.value
                )
              }
              className={inputClass}
              placeholder="https://example.com"
            />
          </Field>

          <Field
            label="Support Email"
            description="Primary support address for SBS."
          >
            <div className="relative">
              <Mail className={iconClass} />

              <input
                type="email"
                value={settings.support_email ?? ""}
                onChange={(event) =>
                  updateSetting(
                    "support_email",
                    event.target.value
                  )
                }
                className={`${inputClass} pl-10`}
                placeholder="support@example.com"
              />
            </div>
          </Field>

          <Field
            label="Support Phone"
            description="Primary support phone number."
          >
            <div className="relative">
              <Smartphone className={iconClass} />

              <input
                value={settings.support_phone ?? ""}
                onChange={(event) =>
                  updateSetting(
                    "support_phone",
                    event.target.value
                  )
                }
                className={`${inputClass} pl-10`}
                placeholder="+971..."
              />
            </div>
          </Field>

          <Field
            label="Default Country"
            description="Country assigned to newly created companies."
          >
            <Select
              value={settings.default_country}
              onChange={(value) =>
                updateSetting(
                  "default_country",
                  value
                )
              }
              options={countries}
            />
          </Field>

          <Field
            label="Default Currency"
            description="Default currency for new platform subscriptions."
          >
            <Select
              value={settings.default_currency}
              onChange={(value) =>
                updateSetting(
                  "default_currency",
                  value
                )
              }
              options={currencies}
            />
          </Field>

          <Field
            label="Default Timezone"
            description="Timezone used as the platform default."
          >
            <Select
              value={settings.default_timezone}
              onChange={(value) =>
                updateSetting(
                  "default_timezone",
                  value
                )
              }
              options={timezones}
            />
          </Field>
        </div>
      </SettingsSection>

      {/* SECURITY */}
      <SettingsSection
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Account & Security"
        description="Authentication and administrator security defaults."
      >
        <div className="divide-y divide-slate-100">
          <ToggleRow
            icon={<Mail className="h-4 w-4" />}
            title="Require Email Verification"
            description="Require users to verify their email before accessing the platform."
            enabled={settings.require_email_verification}
            onChange={(value) =>
              updateSetting(
                "require_email_verification",
                value
              )
            }
          />

          <div className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Smartphone className="h-4 w-4" />
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Multi-Factor Authentication
                </div>

                <div className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                  Control whether MFA is disabled, optional, or
                  required for platform accounts.
                </div>
              </div>
            </div>

            <Select
              value={settings.mfa_policy}
              onChange={(value) =>
                updateSetting(
                  "mfa_policy",
                  value as PlatformSettings["mfa_policy"]
                )
              }
              options={[
                "disabled",
                "optional",
                "required",
              ]}
              className="lg:w-48"
              formatOption={(value) =>
                value.charAt(0).toUpperCase() +
                value.slice(1)
              }
            />
          </div>

          <ToggleRow
            icon={<Lock className="h-4 w-4" />}
            title="Admin Session Protection"
            description="Apply stricter session protection to Platform Administrators."
            enabled={settings.admin_session_protection}
            onChange={(value) =>
              updateSetting(
                "admin_session_protection",
                value
              )
            }
          />

          <div className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Session Duration
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Default maximum lifetime for authenticated sessions.
              </div>
            </div>

            <Select
              value={String(
                settings.session_duration_days
              )}
              onChange={(value) =>
                updateSetting(
                  "session_duration_days",
                  Number(value)
                )
              }
              options={sessionOptions.map(String)}
              className="lg:w-48"
              formatOption={(value) =>
                `${value} ${
                  value === "1" ? "day" : "days"
                }`
              }
            />
          </div>
        </div>
      </SettingsSection>

      {/* COMPANY DEFAULTS */}
      <SettingsSection
        icon={<UserPlus className="h-5 w-5" />}
        title="Company Defaults"
        description="Defaults applied when new companies enter the SBS platform."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="New Company Status"
            description="Initial status assigned to newly created companies."
          >
            <Select
              value={settings.default_company_status}
              onChange={(value) =>
                updateSetting(
                  "default_company_status",
                  value as PlatformSettings["default_company_status"]
                )
              }
              options={[
                "active",
                "trial",
                "suspended",
                "cancelled",
              ]}
              formatOption={(value) =>
                value.charAt(0).toUpperCase() +
                value.slice(1)
              }
            />
          </Field>

          <Field
            label="Default Trial Period"
            description="Default trial duration for new companies."
          >
            <Select
              value={String(
                settings.default_trial_days
              )}
              onChange={(value) =>
                updateSetting(
                  "default_trial_days",
                  Number(value)
                )
              }
              options={trialOptions.map(String)}
              formatOption={(value) =>
                `${value} ${
                  value === "1" ? "day" : "days"
                }`
              }
            />
          </Field>
        </div>

        <div className="mt-2 divide-y divide-slate-100">
          <ToggleRow
            icon={<UserPlus className="h-4 w-4" />}
            title="Automatic Company Activation"
            description="Automatically activate companies after successful onboarding."
            enabled={
              settings.automatic_company_activation
            }
            onChange={(value) =>
              updateSetting(
                "automatic_company_activation",
                value
              )
            }
          />
        </div>
      </SettingsSection>

      {/* PLATFORM OPERATIONS */}
      <SettingsSection
        icon={<Wrench className="h-5 w-5" />}
        title="Platform Operations"
        description="High-impact controls affecting platform availability and onboarding."
      >
        <div className="divide-y divide-slate-100">
          <ToggleRow
            icon={<UserPlus className="h-4 w-4" />}
            title="Allow New Company Signups"
            description="Allow new companies to be created on the SBS platform."
            enabled={
              settings.new_company_signups_enabled
            }
            onChange={(value) =>
              updateSetting(
                "new_company_signups_enabled",
                value
              )
            }
            danger={!settings.new_company_signups_enabled}
          />

          <ToggleRow
            icon={<Wrench className="h-4 w-4" />}
            title="Maintenance Mode"
            description="Restrict normal platform access while maintenance is being performed."
            enabled={settings.maintenance_mode}
            onChange={(value) =>
              updateSetting(
                "maintenance_mode",
                value
              )
            }
            danger
          />

          <ToggleRow
            icon={<Lock className="h-4 w-4" />}
            title="Platform Lockdown"
            description="Emergency control intended to restrict platform access to administrators."
            enabled={settings.platform_lockdown}
            onChange={(value) =>
              updateSetting(
                "platform_lockdown",
                value
              )
            }
            danger
          />
        </div>
      </SettingsSection>

      {/* DANGER ZONE */}
      <section className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
        <div className="border-b border-red-100 bg-red-50/60 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </div>

            <div>
              <h2 className="text-sm font-bold text-red-900">
                High-Impact Controls
              </h2>

              <p className="mt-1 text-xs text-red-600/80">
                These settings affect platform-wide behavior.
                Changes are recorded in Activity & Logs.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

            <div className="text-xs leading-5 text-amber-800">
              <strong>Use these controls carefully.</strong>{" "}
              Maintenance Mode and Platform Lockdown are
              intended for operational emergencies and planned
              maintenance. Their enforcement layer will be
              connected to the platform access middleware as SBS
              expands.
            </div>
          </div>
        </div>
      </section>

      {/* LAST UPDATED */}
      <div className="flex flex-col gap-2 border-t border-slate-200 pt-5 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Last configuration update
        </div>

        <div className="font-medium text-slate-500">
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(settings.updated_at))}
        </div>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* COMPONENTS                                                                 */
/* -------------------------------------------------------------------------- */

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10";

const iconClass =
  "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400";

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            {icon}
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {title}
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block">
        <div className="text-sm font-semibold text-slate-900">
          {label}
        </div>

        <div className="mt-1 mb-2.5 text-xs leading-5 text-slate-500">
          {description}
        </div>

        {children}
      </label>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  className = "",
  formatOption,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  className?: string;
  formatOption?: (value: string) => string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-10 text-sm font-medium text-slate-800 outline-none transition hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOption
              ? formatOption(option)
              : option}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  enabled,
  onChange,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            danger
              ? "bg-red-50 text-red-600"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {icon}
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-900">
            {title}
          </div>

          <div className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            {description}
          </div>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition ${
          enabled
            ? danger
              ? "bg-red-500"
              : "bg-emerald-500"
            : "bg-slate-200"
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            enabled
              ? "translate-x-5"
              : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>

      <div className="mt-1 max-w-[110px] truncate text-xs font-semibold text-slate-800">
        {value}
      </div>
    </div>
  );
}