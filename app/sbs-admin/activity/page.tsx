import { requirePlatformAdmin } from "@/lib/auth/platform-admin";

const activities = [
  {
    id: "LOG-001",
    actor: "Salman Sharif",
    action: "Created company",
    target: "North Texas Roofing",
    category: "Company",
    severity: "info",
    timestamp: "Sep 3, 2026 · 11:42 AM",
    ip: "—",
  },
  {
    id: "LOG-002",
    actor: "Salman Sharif",
    action: "Granted module access",
    target: "North Texas Roofing · Reports",
    category: "Entitlement",
    severity: "info",
    timestamp: "Sep 3, 2026 · 11:31 AM",
    ip: "—",
  },
  {
    id: "LOG-003",
    actor: "System",
    action: "Subscription entered trial",
    target: "Example Construction Co.",
    category: "Subscription",
    severity: "success",
    timestamp: "Sep 3, 2026 · 10:18 AM",
    ip: "System",
  },
  {
    id: "LOG-004",
    actor: "System",
    action: "Payment failed",
    target: "Demo Services LLC",
    category: "Payment",
    severity: "warning",
    timestamp: "Sep 2, 2026 · 4:52 PM",
    ip: "System",
  },
  {
    id: "LOG-005",
    actor: "Salman Sharif",
    action: "Updated plan configuration",
    target: "Professional",
    category: "Plan",
    severity: "info",
    timestamp: "Sep 2, 2026 · 2:14 PM",
    ip: "—",
  },
  {
    id: "LOG-006",
    actor: "System",
    action: "User joined company",
    target: "North Texas Roofing",
    category: "User",
    severity: "success",
    timestamp: "Sep 2, 2026 · 12:08 PM",
    ip: "System",
  },
  {
    id: "LOG-007",
    actor: "Salman Sharif",
    action: "Disabled module",
    target: "Example Construction Co. · Inventory",
    category: "Entitlement",
    severity: "warning",
    timestamp: "Sep 1, 2026 · 5:27 PM",
    ip: "—",
  },
  {
    id: "LOG-008",
    actor: "System",
    action: "Company invitation created",
    target: "Example Construction Co.",
    category: "Company",
    severity: "info",
    timestamp: "Sep 1, 2026 · 3:45 PM",
    ip: "System",
  },
];

const categories = [
  "Authentication",
  "Company",
  "User",
  "Subscription",
  "Payment",
  "Entitlement",
  "Plan",
  "System",
];

export default async function AdminActivityPage() {
  await requirePlatformAdmin();

  const todayCount = activities.length;
  const systemEvents = activities.filter(
    (activity) => activity.actor === "System"
  ).length;

  const adminEvents = activities.filter(
    (activity) => activity.actor !== "System"
  ).length;

  const warnings = activities.filter(
    (activity) => activity.severity === "warning"
  ).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Platform Monitoring
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Activity & Logs
          </h1>

          <p className="mt-2 max-w-3xl text-slate-400">
            Monitor administrative actions, system events,
            authentication activity, billing events, and changes
            across the SBS platform.
          </p>
        </div>

        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-600"
        >
          Export Logs
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ActivityStat
          label="Events"
          value={todayCount}
          icon="↯"
        />

        <ActivityStat
          label="Admin Actions"
          value={adminEvents}
          icon="A"
        />

        <ActivityStat
          label="System Events"
          value={systemEvents}
          icon="S"
        />

        <ActivityStat
          label="Warnings"
          value={warnings}
          icon="!"
          warning
        />
      </div>

      {/* Monitoring Status */}
      <section className="grid gap-5 lg:grid-cols-3">
        <MonitorCard
          title="Audit Logging"
          status="Planned"
          description="Administrative and security-sensitive actions will be recorded."
          icon="✓"
        />

        <MonitorCard
          title="Security Events"
          status="Planned"
          description="Authentication, permission, and access events will be tracked."
          icon="◉"
        />

        <MonitorCard
          title="System Events"
          status="Planned"
          description="Automated billing, subscription, and background events will be logged."
          icon="↻"
        />
      </section>

      {/* Filters */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
          <input
            type="text"
            disabled
            placeholder="Search activity, actor, or target..."
            className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
          />

          <select
            disabled
            defaultValue="all"
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-500 outline-none"
          >
            <option value="all">
              All categories
            </option>

            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            disabled
            defaultValue="all"
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-500 outline-none"
          >
            <option value="all">
              All actors
            </option>

            <option value="admin">
              Administrators
            </option>

            <option value="system">
              System
            </option>
          </select>

          <select
            disabled
            defaultValue="all"
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-500 outline-none"
          >
            <option value="all">
              All severity
            </option>

            <option value="info">
              Info
            </option>

            <option value="success">
              Success
            </option>

            <option value="warning">
              Warning
            </option>
          </select>
        </div>
      </section>

      {/* Activity Table */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="font-semibold text-white">
              Recent Activity
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Latest platform events and administrative actions.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-xs text-slate-500">
            {activities.length} events
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Event
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actor
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Action
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Target
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Category
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Severity
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Timestamp
                </th>

                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {activities.map((activity) => (
                <tr
                  key={activity.id}
                  className="transition hover:bg-white/[0.025]"
                >
                  <td className="px-6 py-5">
                    <div className="font-mono text-xs text-slate-400">
                      {activity.id}
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-[10px] font-semibold text-slate-300">
                        {activity.actor === "System"
                          ? "S"
                          : "A"}
                      </div>

                      <span className="text-sm font-medium text-white">
                        {activity.actor}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <span className="text-sm text-slate-300">
                      {activity.action}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <span className="text-sm text-slate-400">
                      {activity.target}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <span className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-slate-400">
                      {activity.category}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <ActivitySeverity
                      severity={activity.severity}
                    />
                  </td>

                  <td className="px-6 py-5">
                    <span className="whitespace-nowrap text-xs text-slate-500">
                      {activity.timestamp}
                    </span>
                  </td>

                  <td className="px-6 py-5 text-right">
                    <button
                      type="button"
                      disabled
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-600"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Audit Architecture */}
      <section>
        <div className="mb-5">
          <h2 className="font-semibold text-white">
            Audit Architecture
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Events that should eventually be captured by the
            production audit system.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AuditCard
            title="Authentication"
            description="Login, logout, invitation, password changes, and authentication failures."
            icon="A"
          />

          <AuditCard
            title="Company Changes"
            description="Company creation, status changes, domains, settings, and ownership changes."
            icon="C"
          />

          <AuditCard
            title="Billing"
            description="Subscriptions, payments, refunds, invoices, discounts, and billing state."
            icon="$"
          />

          <AuditCard
            title="Access Control"
            description="Roles, permissions, module access, overrides, and entitlement changes."
            icon="✓"
          />
        </div>
      </section>

      {/* Security Notice */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-sm text-emerald-400">
            #
          </div>

          <h3 className="mt-5 font-semibold text-white">
            Immutable Audit Trail
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Production audit records should be append-only. Admin
            users should be able to inspect events but should not
            be able to silently modify or delete historical
            security records.
          </p>

          <div className="mt-5 rounded-xl border border-white/10 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-500">
            Actor → Action → Target
            <br />
            Timestamp → IP → Metadata
            <br />
            Result → Audit Record
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-sm text-amber-400">
            !
          </div>

          <h3 className="mt-5 font-semibold text-white">
            Sensitive Operations
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            High-impact operations such as changing platform
            access, granting free subscriptions, modifying billing
            configuration, or changing administrator privileges
            should always generate an audit event.
          </p>

          <div className="mt-5 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-4 text-xs leading-5 text-amber-400/60">
            Every privileged action should be attributable to a
            specific authenticated administrator or system process.
          </div>
        </div>
      </section>

      {/* Notice */}
      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
        <div className="flex gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-sm text-amber-400">
            !
          </div>

          <div>
            <h3 className="text-sm font-semibold text-amber-300">
              Audit logging is not connected
            </h3>

            <p className="mt-1 text-xs leading-5 text-amber-400/60">
              The events shown on this page are interface
              placeholders. They are not real audit records.
              Production logging will require a dedicated audit
              log data model, server-side event recording,
              immutable history, actor tracking, timestamps,
              metadata, and appropriate retention policies.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActivityStat({
  label,
  value,
  icon,
  warning = false,
}: {
  label: string;
  value: number;
  icon: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm text-slate-200">
          {icon}
        </div>

        <span
          className={`h-2 w-2 rounded-full ${
            warning
              ? "bg-amber-400"
              : "bg-emerald-400"
          }`}
        />
      </div>

      <div className="mt-5">
        <div className="text-3xl font-bold tracking-tight text-white">
          {value}
        </div>

        <div className="mt-1 text-sm text-slate-500">
          {label}
        </div>
      </div>
    </div>
  );
}

function MonitorCard({
  title,
  status,
  description,
  icon,
}: {
  title: string;
  status: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm text-slate-300">
          {icon}
        </div>

        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-400">
          {status}
        </span>
      </div>

      <h3 className="mt-5 text-sm font-semibold text-white">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function ActivitySeverity({
  severity,
}: {
  severity: string;
}) {
  const styles: Record<string, string> = {
    info: "bg-blue-500/10 text-blue-400",
    success: "bg-emerald-500/10 text-emerald-400",
    warning: "bg-amber-500/10 text-amber-400",
  };

  const labels: Record<string, string> = {
    info: "Info",
    success: "Success",
    warning: "Warning",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        styles[severity] ?? "bg-white/5 text-slate-400"
      }`}
    >
      {labels[severity] ?? severity}
    </span>
  );
}

function AuditCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-slate-300">
        {icon}
      </div>

      <h3 className="mt-5 text-sm font-semibold text-white">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}