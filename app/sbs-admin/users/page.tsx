import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminUsersPage() {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const [
    profilesResult,
    membershipsResult,
    companiesResult,
    platformAdminsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, created_at, updated_at")
      .order("created_at", { ascending: false }),

    supabase
      .from("company_members")
      .select("id, company_id, user_id, role, created_at"),

    supabase
      .from("companies")
      .select("id, name, slug"),

    supabase
      .from("platform_admins")
      .select("user_id, role, created_at"),
  ]);

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }

  if (membershipsResult.error) {
    throw new Error(membershipsResult.error.message);
  }

  if (companiesResult.error) {
    throw new Error(companiesResult.error.message);
  }

  if (platformAdminsResult.error) {
    throw new Error(platformAdminsResult.error.message);
  }

  const profiles = profilesResult.data ?? [];
  const memberships = membershipsResult.data ?? [];
  const companies = companiesResult.data ?? [];
  const platformAdmins = platformAdminsResult.data ?? [];

  const companyMap = new Map(
    companies.map((company) => [
      company.id,
      company,
    ])
  );

  const membershipMap = new Map<
    string,
    (typeof memberships)[number]
  >();

  for (const membership of memberships) {
    if (!membershipMap.has(membership.user_id)) {
      membershipMap.set(
        membership.user_id,
        membership
      );
    }
  }

  const platformAdminMap = new Map(
    platformAdmins.map((admin) => [
      admin.user_id,
      admin,
    ])
  );

  const users = profiles.map((profile) => {
    const membership = membershipMap.get(profile.id);
    const company = membership
      ? companyMap.get(membership.company_id)
      : null;

    const platformAdmin = platformAdminMap.get(
      profile.id
    );

    return {
      ...profile,
      membership,
      company,
      platformAdmin,
    };
  });

  const totalUsers = users.length;

  const companyUsers = users.filter(
    (user) => user.membership
  ).length;

  const platformAdminUsers = users.filter(
    (user) => user.platformAdmin
  ).length;

  const unassignedUsers = users.filter(
    (user) =>
      !user.membership && !user.platformAdmin
  ).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            User Management
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Users
          </h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            Manage users across the SBS platform, view their
            company memberships, roles, and administrative access.
          </p>
        </div>

        <Link
          href="/sbs-admin"
          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
        >
          ← Dashboard
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UserStat
          label="Total Users"
          value={totalUsers}
          icon="♙"
        />

        <UserStat
          label="Company Users"
          value={companyUsers}
          icon="◫"
        />

        <UserStat
          label="Platform Admins"
          value={platformAdminUsers}
          icon="★"
        />

        <UserStat
          label="Unassigned"
          value={unassignedUsers}
          icon="?"
          warning={unassignedUsers > 0}
        />
      </div>

      {/* Main Users Table */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-white">
              All Users
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Users currently known to the SBS application.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-xs text-slate-400">
            {totalUsers.toLocaleString()}{" "}
            {totalUsers === 1 ? "user" : "users"}
          </div>
        </div>

        {users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    User
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Company
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Role
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Account Type
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Joined
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {users.map((user) => {
                  const isPlatformAdmin =
                    Boolean(user.platformAdmin);

                  const companyName =
                    user.company?.name ?? null;

                  const role =
                    isPlatformAdmin
                      ? user.platformAdmin?.role
                      : user.membership?.role;

                  return (
                    <tr
                      key={user.id}
                      className="transition hover:bg-white/[0.025]"
                    >
                      {/* User */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white">
                            {getInitials(
                              user.full_name
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate font-medium text-white">
                              {user.full_name ||
                                "Unnamed User"}
                            </div>

                            <div className="mt-1 max-w-[300px] truncate font-mono text-[10px] text-slate-600">
                              {user.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="px-6 py-5">
                        {companyName ? (
                          <div>
                            <div className="font-medium text-slate-200">
                              {companyName}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {user.company?.slug ||
                                "No slug"}
                            </div>
                          </div>
                        ) : isPlatformAdmin ? (
                          <span className="text-sm text-slate-400">
                            SBS Platform
                          </span>
                        ) : (
                          <span className="text-sm text-slate-600">
                            No company
                          </span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="px-6 py-5">
                        {role ? (
                          <RoleBadge
                            role={role}
                            platformAdmin={
                              isPlatformAdmin
                            }
                          />
                        ) : (
                          <span className="text-sm text-slate-600">
                            —
                          </span>
                        )}
                      </td>

                      {/* Account Type */}
                      <td className="px-6 py-5">
                        {isPlatformAdmin ? (
                          <span className="inline-flex rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-400">
                            Platform Admin
                          </span>
                        ) : user.membership ? (
                          <span className="inline-flex rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
                            Company User
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-500">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Joined */}
                      <td className="px-6 py-5">
                        <div className="text-sm text-slate-300">
                          {formatDate(
                            user.created_at
                          )}
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          {formatRelativeDate(
                            user.created_at
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-5 text-right">
                        <button
                          type="button"
                          disabled
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-600"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyUsers />
        )}
      </section>

      {/* Information panel */}
      <section className="grid gap-4 md:grid-cols-3">
        <InfoCard
          title="Company Membership"
          description="A user becomes a company user when they have an entry in company_members."
          icon="◫"
        />

        <InfoCard
          title="Platform Access"
          description="Platform administrators are controlled separately through platform_admins."
          icon="★"
        />

        <InfoCard
          title="User Profiles"
          description="Profile information is stored separately from authentication credentials."
          icon="♙"
        />
      </section>
    </div>
  );
}

function UserStat({
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

        <div
          className={`h-2 w-2 rounded-full ${
            warning
              ? "bg-amber-400"
              : "bg-emerald-400"
          }`}
        />
      </div>

      <div className="mt-5">
        <div className="text-3xl font-bold tracking-tight text-white">
          {value.toLocaleString()}
        </div>

        <div className="mt-1 text-sm text-slate-500">
          {label}
        </div>
      </div>
    </div>
  );
}

function RoleBadge({
  role,
  platformAdmin,
}: {
  role: string;
  platformAdmin: boolean;
}) {
  const normalized = role.toLowerCase();

  let className =
    "bg-white/5 text-slate-300";

  if (platformAdmin) {
    className =
      "bg-purple-500/10 text-purple-400";
  } else if (normalized === "owner") {
    className =
      "bg-emerald-500/10 text-emerald-400";
  } else if (normalized === "admin") {
    className =
      "bg-blue-500/10 text-blue-400";
  } else if (
    normalized === "manager" ||
    normalized === "staff"
  ) {
    className =
      "bg-amber-500/10 text-amber-400";
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${className}`}
    >
      {role.replace(/_/g, " ")}
    </span>
  );
}

function InfoCard({
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
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm text-slate-300">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-semibold text-white">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function EmptyUsers() {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-xl text-slate-500">
        ♙
      </div>

      <h3 className="mt-5 font-semibold text-slate-300">
        No users found
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        Users will appear here once they have a profile
        in the SBS platform.
      </p>
    </div>
  );
}

function getInitials(
  name: string | null
) {
  if (!name?.trim()) {
    return "U";
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .slice(0, 2);

  return parts
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}

function formatRelativeDate(date: string) {
  const created = new Date(date).getTime();
  const now = Date.now();

  const days = Math.floor(
    (now - created) /
      (1000 * 60 * 60 * 24)
  );

  if (days <= 0) {
    return "Today";
  }

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 30) {
    return `${days} days ago`;
  }

  const months = Math.floor(days / 30);

  if (months < 12) {
    return `${months} ${
      months === 1 ? "month" : "months"
    } ago`;
  }

  const years = Math.floor(months / 12);

  return `${years} ${
    years === 1 ? "year" : "years"
  } ago`;
}