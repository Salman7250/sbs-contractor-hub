import { requirePlatformAdmin } from "@/lib/auth/platform-admin";

const platformSettings = [
  {
    category: "General",
    settings: [
      {
        name: "Platform Name",
        value: "Sharif Business Solutions",
        description: "The name displayed throughout the platform.",
        type: "text",
      },
      {
        name: "Platform URL",
        value: "https://sharifbusinesssolutions.com",
        description: "Primary URL used for the SBS platform.",
        type: "text",
      },
      {
        name: "Default Country",
        value: "United States",
        description: "Default country used for new companies.",
        type: "select",
      },
      {
        name: "Default Currency",
        value: "USD",
        description: "Default billing currency for new subscriptions.",
        type: "select",
      },
    ],
  },
  {
    category: "Account & Security",
    settings: [
      {
        name: "Require Email Verification",
        value: "Enabled",
        description:
          "Require users to verify their email before accessing the platform.",
        type: "toggle",
      },
      {
        name: "Multi-Factor Authentication",
        value: "Optional",
        description:
          "Allow platform and company users to protect their accounts with MFA.",
        type: "toggle",
      },
      {
        name: "Session Duration",
        value: "7 days",
        description:
          "Default maximum lifetime for authenticated sessions.",
        type: "select",
      },
      {
        name: "Admin Session Protection",
        value: "Enabled",
        description:
          "Apply stricter authentication rules to Platform Administrators.",
        type: "toggle",
      },
    ],
  },
  {
    category: "Company Defaults",
    settings: [
      {
        name: "New Company Status",
        value: "Trial",
        description:
          "Default status assigned when a new company is created.",
        type: "select",
      },
      {
        name: "Default Trial Period",
        value: "14 days",
        description:
          "Default trial duration for newly created companies.",
        type: "select",
      },
      {
        name: "Default Timezone",
        value: "America/Chicago",
        description:
          "Timezone assigned to new companies unless changed.",
        type: "select",
      },
      {
        name: "Automatic Company Activation",
        value: "Enabled",
        description:
          "Automatically activate companies after successful onboarding.",
        type: "toggle",
      },
    ],
  },
];

const systemStatus = [
  {
    name: "Authentication",
    status: "Operational",
    description: "Supabase authentication and session handling.",
  },
  {
    name: "Database",
    status: "Operational",
    description: "Primary Supabase database connection.",
  },
  {
    name: "Tenant Isolation",
    status: "Operational",
    description: "Company-level data separation and access control.",
  },
  {
    name: "Billing",
    status: "Not Configured",
    description: "Payment provider and subscription billing.",
  },
  {
    name: "Email",
    status: "Not Configured",
    description: "Production transactional email delivery.",
  },
  {
    name: "Audit Logging",
    status: "Planned",
    description: "Centralized platform audit and security logging.",
  },
];

export default async function AdminSettingsPage() {
  await requirePlatformAdmin();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Platform Configuration
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Platform Settings
          </h1>

          <p className="mt-2 max-w-3xl text-slate-400">
            Configure global SBS settings, security defaults,
            company onboarding behavior, and platform services.
          </p>
        </div>

        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700"
        >
          Save Changes
        </button>
      </div>

      {/* Environment */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

              <h2 className="font-semibold text-white">
                Production Environment
              </h2>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              SBS is currently configured for production-oriented
              platform architecture.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-emerald-500/60">
              Environment
            </div>

            <div className="mt-1 text-sm font-semibold text-emerald-400">
              Production
            </div>
          </div>
        </div>
      </section>

      {/* Settings */}
      {platformSettings.map((group) => (
        <section
          key={group.category}
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
        >
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="font-semibold text-white">
              {group.category}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Global {group.category.toLowerCase()} configuration
              for the SBS platform.
            </p>
          </div>

          <div className="divide-y divide-white/10">
            {group.settings.map((setting) => (
              <div
                key={setting.name}
                className="flex flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="max-w-2xl">
                  <h3 className="text-sm font-medium text-white">
                    {setting.name}
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {setting.description}
                  </p>
                </div>

                <div className="w-full lg:w-72">
                  {setting.type === "toggle" ? (
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950 px-4 py-3">
                      <span className="text-sm text-slate-400">
                        {setting.value}
                      </span>

                      <div className="h-5 w-9 rounded-full bg-emerald-500/20 p-0.5">
                        <div className="ml-auto h-4 w-4 rounded-full bg-emerald-400" />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3">
                      <div className="text-sm text-slate-300">
                        {setting.value}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* System Status */}
      <section>
        <div className="mb-5">
          <h2 className="font-semibold text-white">
            Platform Services
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            High-level status of the services used by SBS.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {systemStatus.map((service) => (
            <div
              key={service.name}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {service.name}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {service.description}
                  </p>
                </div>

                <StatusDot status={service.status} />
              </div>

              <div className="mt-5">
                <ServiceStatus status={service.status} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-sm text-emerald-400">
            S
          </div>

          <h3 className="mt-5 font-semibold text-white">
            Security Configuration
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Platform-wide security settings should be centrally
            controlled and enforced server-side. Client-side
            settings must never be treated as security boundaries.
          </p>

          <div className="mt-5 space-y-2">
            <SecurityRow
              label="Authentication"
              value="Supabase Auth"
            />

            <SecurityRow
              label="Authorization"
              value="Role + RLS"
            />

            <SecurityRow
              label="Tenant Isolation"
              value="Company Scoped"
            />

            <SecurityRow
              label="Admin Access"
              value="Platform Admin"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-sm text-amber-400">
            !
          </div>

          <h3 className="mt-5 font-semibold text-white">
            Configuration Warning
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            The controls on this page are currently visual
            placeholders. They do not modify production
            configuration yet.
          </p>

          <div className="mt-5 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-4 text-xs leading-5 text-amber-400/60">
            Settings will later be stored in a centralized
            platform configuration layer with server-side
            validation and administrator authorization.
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.03]">
        <div className="border-b border-red-500/10 px-6 py-5">
          <h2 className="font-semibold text-red-300">
            Platform Danger Zone
          </h2>

          <p className="mt-1 text-xs text-red-400/50">
            High-impact platform operations that require
            additional protection.
          </p>
        </div>

        <div className="divide-y divide-red-500/10">
          <DangerRow
            title="Disable New Company Signups"
            description="Temporarily prevent creation of new companies on the platform."
            action="Disable Signups"
          />

          <DangerRow
            title="Maintenance Mode"
            description="Temporarily restrict access to the SBS platform while maintenance is performed."
            action="Enable Maintenance"
          />

          <DangerRow
            title="Platform Lockdown"
            description="Emergency operation to restrict platform access to Platform Administrators."
            action="Lock Platform"
          />
        </div>
      </section>

      {/* Final Notice */}
      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
        <div className="flex gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-sm text-amber-400">
            !
          </div>

          <div>
            <h3 className="text-sm font-semibold text-amber-300">
              Platform configuration is not connected
            </h3>

            <p className="mt-1 text-xs leading-5 text-amber-400/60">
              The settings displayed on this page represent the
              planned Platform Administration configuration. They
              are not currently persisted or applied. Production
              implementation will connect these controls to
              centralized configuration, authorization, audit
              logging, and service integrations.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusDot({
  status,
}: {
  status: string;
}) {
  const color =
    status === "Operational"
      ? "bg-emerald-400"
      : status === "Not Configured"
        ? "bg-amber-400"
        : "bg-slate-500";

  return (
    <span
      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${color}`}
    />
  );
}

function ServiceStatus({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    Operational:
      "bg-emerald-500/10 text-emerald-400",
    "Not Configured":
      "bg-amber-500/10 text-amber-400",
    Planned:
      "bg-slate-500/10 text-slate-400",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        styles[status] ?? "bg-white/5 text-slate-400"
      }`}
    >
      {status}
    </span>
  );
}

function SecurityRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950 px-4 py-3">
      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span className="text-xs font-medium text-slate-300">
        {value}
      </span>
    </div>
  );
}

function DangerRow({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: string;
}) {
  return (
    <div className="flex flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h3 className="text-sm font-medium text-red-200">
          {title}
        </h3>

        <p className="mt-1 max-w-2xl text-xs leading-5 text-red-400/50">
          {description}
        </p>
      </div>

      <button
        type="button"
        disabled
        className="rounded-xl border border-red-500/20 bg-red-500/[0.03] px-4 py-2.5 text-xs font-medium text-red-500/40"
      >
        {action}
      </button>
    </div>
  );
}