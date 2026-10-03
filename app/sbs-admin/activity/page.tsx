import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Search,
  ShieldAlert,
} from "lucide-react";

type ActivityRow = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  company_id: string | null;
  actor_user_id: string | null;
  reason: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
};

type SearchParams = {
  q?: string;
  type?: string;
};

export default async function PlatformActivityPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const params = searchParams ? await searchParams : {};

  const searchQuery =
    typeof params.q === "string"
      ? params.q.trim().toLowerCase()
      : "";

  const selectedType =
    typeof params.type === "string"
      ? params.type
      : "all";

  const [
    activityResult,
    profilesResult,
  ] = await Promise.all([
    supabase
      .from("platform_activity_logs")
      .select(
        `
          id,
          action,
          entity_type,
          entity_id,
          company_id,
          actor_user_id,
          reason,
          created_at
        `
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(250),

    supabase
      .from("profiles")
      .select("id, full_name"),
  ]);

  if (activityResult.error) {
    throw new Error(
      activityResult.error.message
    );
  }

  if (profilesResult.error) {
    throw new Error(
      profilesResult.error.message
    );
  }

  const activities =
    (activityResult.data ??
      []) as ActivityRow[];

  const profiles =
    (profilesResult.data ??
      []) as Profile[];

  const profileMap = new Map(
    profiles.map((profile) => [
      profile.id,
      profile,
    ])
  );

  const entityTypes = Array.from(
    new Set(
      activities
        .map(
          (activity) =>
            activity.entity_type
        )
        .filter(Boolean)
    )
  ) as string[];

  const filteredActivities =
    activities.filter((activity) => {
      const actorName =
        activity.actor_user_id
          ? profileMap.get(
              activity.actor_user_id
            )?.full_name ?? ""
          : "System";

      const searchableText = [
        activity.action,
        activity.entity_type,
        activity.reason,
        activity.entity_id,
        actorName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !searchQuery ||
        searchableText.includes(
          searchQuery
        );

      const matchesType =
        selectedType === "all" ||
        activity.entity_type ===
          selectedType;

      return (
        matchesSearch &&
        matchesType
      );
    });

  const today = new Date();

  const eventsToday =
    activities.filter((activity) => {
      const date = new Date(
        activity.created_at
      );

      return (
        date.toDateString() ===
        today.toDateString()
      );
    }).length;

  const attentionEvents =
    activities.filter((activity) => {
      const action =
        activity.action.toLowerCase();

      return (
        action.includes("failed") ||
        action.includes("suspend") ||
        action.includes("remove") ||
        action.includes("ban") ||
        action.includes("warning") ||
        action.includes("error")
      );
    }).length;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
            <Activity className="h-4 w-4" />
            System Audit
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Activity & Logs
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            A permanent audit trail of important
            activity across the SBS platform.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          <ShieldAlert className="h-4 w-4" />
          Platform audit
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Events Today"
          value={eventsToday}
          icon={
            <Clock3 className="h-5 w-5" />
          }
        />

        <StatCard
          label="Loaded Events"
          value={activities.length}
          icon={
            <CheckCircle2 className="h-5 w-5" />
          }
        />

        <StatCard
          label="Attention Events"
          value={attentionEvents}
          icon={
            <AlertTriangle className="h-5 w-5" />
          }
        />
      </div>

      {/* Activity */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Filters */}
        <form
          method="GET"
          className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              name="q"
              defaultValue={
                typeof params.q ===
                "string"
                  ? params.q
                  : ""
              }
              placeholder="Search actions, actors, reasons..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>

          <select
            name="type"
            defaultValue={
              selectedType
            }
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-emerald-500"
          >
            <option value="all">
              All entity types
            </option>

            {entityTypes.map(
              (entityType) => (
                <option
                  key={entityType}
                  value={entityType}
                >
                  {formatLabel(
                    entityType
                  )}
                </option>
              )
            )}
          </select>

          <button
            type="submit"
            className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Filter
          </button>
        </form>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {filteredActivities.length >
          0 ? (
            filteredActivities.map(
              (activity) => {
                const actorName =
                  activity.actor_user_id
                    ? profileMap.get(
                        activity.actor_user_id
                      )?.full_name ??
                      "Platform User"
                    : "System";

                return (
                  <ActivityRowItem
                    key={activity.id}
                    activity={activity}
                    actorName={
                      actorName
                    }
                  />
                );
              }
            )
          ) : (
            <div className="px-6 py-16 text-center">
              <Activity className="mx-auto h-8 w-8 text-slate-300" />

              <div className="mt-4 text-sm font-semibold text-slate-700">
                No activity found
              </div>

              <p className="mt-1 text-xs text-slate-400">
                Try changing your
                search or filter.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   ACTIVITY ROW
============================================================ */

function ActivityRowItem({
  activity,
  actorName,
}: {
  activity: ActivityRow;
  actorName: string;
}) {
  return (
    <div className="flex gap-4 px-5 py-5 transition hover:bg-slate-50 sm:px-6">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <Activity className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {formatLabel(
                activity.action
              )}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              {actorName}

              {" · "}

              {formatLabel(
                activity.entity_type ??
                  "system"
              )}
            </div>
          </div>

          <time className="shrink-0 text-[11px] text-slate-400">
            {formatDate(
              activity.created_at
            )}
          </time>
        </div>

        {activity.reason && (
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {activity.reason}
          </p>
        )}

        {activity.entity_id && (
          <div className="mt-2 break-all font-mono text-[10px] text-slate-400">
            {activity.entity_id}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        {icon}
      </div>

      <div className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </div>

      <div className="mt-1 text-xs font-medium text-slate-500">
        {label}
      </div>
    </div>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function formatLabel(
  value: string
) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(new Date(value));
}