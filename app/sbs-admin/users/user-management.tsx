"use client";

import {
  useMemo,
  useState,
  useTransition,
} from "react";

import Link from "next/link";

import {
  Search,
  Users,
  UserCheck,
  Mail,
  Building2,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Eye,
  UserRoundPlus,
  Ban,
  UserRoundCheck,
  RefreshCw,
  ShieldCheck,
  Clock3,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

import {
  resendUserInvite,
  toggleUserBan,
} from "./user-actions";

type CompanyUser = {
  membershipId: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
  role: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
  isPlatformAdmin: boolean;
};

type Company = {
  id: string;
  name: string;
  slug: string;
  status?: string | null;
  created_at?: string | null;
  users: CompanyUser[];
};

type PlatformAdmin = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  createdAt: string;
  bannedUntil: string | null;
};

type Stats = {
  totalCompanies: number;
  companiesWithUsers: number;
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  platformAdmins: number;
  unassignedUsers: number;
};

type Props = {
  companies: Company[];
  stats: Stats;
  platformAdmins: PlatformAdmin[];
};

export default function UsersPageClient({
  companies,
  stats,
  platformAdmins,
}: Props) {
  const [search, setSearch] = useState("");

  const [
    expandedCompanies,
    setExpandedCompanies,
  ] = useState<Set<string>>(new Set());

  const [selectedUser, setSelectedUser] =
    useState<{
      user: CompanyUser;
      company: Company;
    } | null>(null);

  const [menuKey, setMenuKey] =
    useState<string | null>(null);

  const [isPending, startTransition] =
    useTransition();

  const [message, setMessage] =
    useState<{
      type: "success" | "error";
      text: string;
    } | null>(null);

  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return companies;
    }

    return companies.filter((company) => {
      const companyMatch = company.name
        .toLowerCase()
        .includes(query);

      const userMatch = company.users.some(
        (user) =>
          user.fullName
            .toLowerCase()
            .includes(query) ||
          user.email
            .toLowerCase()
            .includes(query)
      );

      return companyMatch || userMatch;
    });
  }, [companies, search]);

  function toggleCompany(companyId: string) {
    setExpandedCompanies((current) => {
      const next = new Set(current);

      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }

      return next;
    });
  }

  function expandAll() {
    setExpandedCompanies(
      new Set(
        filteredCompanies.map(
          (company) => company.id
        )
      )
    );
  }

  function collapseAll() {
    setExpandedCompanies(new Set());
  }

  function showResult(
    success: boolean,
    error?: string,
    successText?: string
  ) {
    setMessage({
      type: success ? "success" : "error",
      text: success
        ? successText ??
          "Changes saved successfully."
        : error ??
          "Something went wrong.",
    });

    if (success) {
      setTimeout(() => {
        setMessage(null);
      }, 3500);
    }
  }

  function runAction(
    action: () => Promise<{
      success: boolean;
      error?: string;
    }>,
    successText?: string
  ) {
    startTransition(async () => {
      const result = await action();

      showResult(
        result.success,
        result.error,
        successText
      );
    });
  }

  return (
    <div className="space-y-7 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
            <ShieldCheck className="h-4 w-4" />
            Platform Management
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Users
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage users by company, review their access,
            and handle account status from one clean
            platform-level view.
          </p>
        </div>

        <Link
          href="/sbs-admin"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
        >
          ← Dashboard
        </Link>
      </div>

      {/* Flash message */}
      {message && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}

          <span>{message.text}</span>

          <button
            type="button"
            onClick={() => setMessage(null)}
            className="ml-auto rounded-md p-1 hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Companies"
          value={stats.totalCompanies}
          detail="Registered businesses"
          icon={Building2}
        />

        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          detail="Company memberships"
          icon={Users}
        />

        <StatCard
          label="Active Users"
          value={stats.activeUsers}
          detail="Not currently banned"
          icon={UserCheck}
        />

        <StatCard
          label="Pending"
          value={stats.pendingUsers}
          detail="Email verification"
          icon={Mail}
          warning={stats.pendingUsers > 0}
        />

        <StatCard
          label="Platform Admins"
          value={stats.platformAdmins}
          detail="SBS administrators"
          icon={ShieldCheck}
        />

        <StatCard
          label="Unassigned"
          value={stats.unassignedUsers}
          detail="No company membership"
          icon={UserRoundPlus}
          warning={stats.unassignedUsers > 0}
        />
      </div>

      {/* Main company users */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Section header */}
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Company Users
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Expand a company to view the users belonging
                to that business.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={expandAll}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                Expand all
              </button>

              <button
                type="button"
                onClick={collapseAll}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                Collapse all
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search companies or users..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-medium text-slate-500">
              {filteredCompanies.length} companies
            </div>
          </div>
        </div>

        {/* Companies */}
        {filteredCompanies.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredCompanies.map((company) => {
              const expanded =
                expandedCompanies.has(company.id);

              return (
                <CompanyRow
                  key={company.id}
                  company={company}
                  expanded={expanded}
                  isPending={isPending}
                  menuKey={menuKey}
                  onToggle={() =>
                    toggleCompany(company.id)
                  }
                  onViewUser={(user) => {
                    setSelectedUser({
                      user,
                      company,
                    });
                    setMenuKey(null);
                  }}
                  onMenuChange={setMenuKey}
                  onBan={(user) => {
                    setMenuKey(null);

                    runAction(
                      () =>
                        toggleUserBan({
                          userId: user.userId,
                          banned:
                            !user.bannedUntil,
                        }),
                      user.bannedUntil
                        ? "User access restored."
                        : "User has been banned."
                    );
                  }}
                  onInvite={(user) => {
                    setMenuKey(null);

                    runAction(
                      () =>
                        resendUserInvite({
                          userId: user.userId,
                        }),
                      "Invitation email sent."
                    );
                  }}
                />
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Search className="h-6 w-6" />
            </div>

            <h3 className="mt-5 text-sm font-semibold text-slate-800">
              No companies found
            </h3>

            <p className="mt-2 text-xs text-slate-500">
              Try a different company or user name.
            </p>
          </div>
        )}
      </section>

      {/* Platform Administrators */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-purple-600" />

              <h2 className="text-base font-semibold text-slate-900">
                SBS Platform Administrators
              </h2>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Platform-level administrators are managed separately
              from customer company users.
            </p>
          </div>

          <span className="rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700">
            {platformAdmins.length}
          </span>
        </div>

        {platformAdmins.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {platformAdmins.map((admin) => (
              <PlatformAdminRow
                key={admin.id}
                admin={admin}
              />
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-xs text-slate-400">
            No platform administrators found.
          </div>
        )}
      </section>

      {/* Bottom info */}
      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard
          icon={Building2}
          title="Company-first"
          text="Users are organized under the business they belong to instead of being shown as one large global list."
        />

        <InfoCard
          icon={ShieldCheck}
          title="Access control"
          text="Company roles determine the user's application-level position within that business."
        />

        <InfoCard
          icon={Clock3}
          title="Account activity"
          text="Verification and last sign-in information comes from the user's authentication account."
        />
      </div>

      {/* User details */}
      {selectedUser && (
        <UserDetailsModal
          user={selectedUser.user}
          company={selectedUser.company}
          isPending={isPending}
          onClose={() => setSelectedUser(null)}
          onBan={() =>
            runAction(
              () =>
                toggleUserBan({
                  userId:
                    selectedUser.user.userId,
                  banned:
                    !selectedUser.user.bannedUntil,
                }),
              selectedUser.user.bannedUntil
                ? "User access restored."
                : "User has been banned."
            )
          }
          onInvite={() =>
            runAction(
              () =>
                resendUserInvite({
                  userId:
                    selectedUser.user.userId,
                }),
              "Invitation email sent."
            )
          }
        />
      )}
    </div>
  );
}

/* -------------------------------- */
/* Company Row                      */
/* -------------------------------- */

function CompanyRow({
  company,
  expanded,
  isPending,
  menuKey,
  onToggle,
  onViewUser,
  onMenuChange,
  onBan,
  onInvite,
}: {
  company: Company;
  expanded: boolean;
  isPending: boolean;
  menuKey: string | null;
  onToggle: () => void;
  onViewUser: (user: CompanyUser) => void;
  onMenuChange: (key: string | null) => void;
  onBan: (user: CompanyUser) => void;
  onInvite: (user: CompanyUser) => void;
}) {
  const activeCount = company.users.filter(
    (user) => !user.bannedUntil
  ).length;

  const pendingCount = company.users.filter(
    (user) => !user.emailConfirmedAt
  ).length;

  return (
    <div>
      {/* Company header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-6 py-5 text-left transition hover:bg-slate-50"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
          {getCompanyInitials(company.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">
              {company.name}
            </span>

            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
              {company.status ?? "active"}
            </span>
          </div>

          <div className="mt-1 text-xs text-slate-400">
            {company.slug}
          </div>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          <CompanyMetric
            label="Users"
            value={company.users.length}
          />

          <CompanyMetric
            label="Active"
            value={activeCount}
          />

          <CompanyMetric
            label="Pending"
            value={pendingCount}
            warning={pendingCount > 0}
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
          <Users className="h-3.5 w-3.5" />

          <span className="hidden sm:inline">
            {expanded
              ? "Hide Users"
              : "View Users"}
          </span>

          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px]">
            {company.users.length}
          </span>
        </div>
      </button>

      {/* Expanded users */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          {company.users.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="hidden grid-cols-[minmax(240px,1.5fr)_180px_150px_170px_90px] border-b border-slate-100 bg-slate-50 px-4 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 lg:grid">
                <div>User</div>
                <div>Role</div>
                <div>Verification</div>
                <div>Last Active</div>
                <div className="text-right">
                  Action
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {company.users.map((user) => (
                  <UserRow
                    key={user.membershipId}
                    user={user}
                    company={company}
                    isPending={isPending}
                    menuKey={menuKey}
                    onView={() =>
                      onViewUser(user)
                    }
                    onMenuChange={onMenuChange}
                    onBan={() =>
                      onBan(user)
                    }
                    onInvite={() =>
                      onInvite(user)
                    }
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <Users className="mx-auto h-6 w-6 text-slate-300" />

              <p className="mt-2 text-xs text-slate-500">
                This company has no users.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- */
/* User Row                         */
/* -------------------------------- */

function UserRow({
  user,
  company,
  isPending,
  menuKey,
  onView,
  onMenuChange,
  onBan,
  onInvite,
}: {
  user: CompanyUser;
  company: Company;
  isPending: boolean;
  menuKey: string | null;
  onView: () => void;
  onMenuChange: (key: string | null) => void;
  onBan: () => void;
  onInvite: () => void;
}) {
  const key = `${company.id}:${user.userId}`;

  const isBanned = Boolean(user.bannedUntil);

  const pendingVerification =
    !user.emailConfirmedAt;

  return (
    <div className="relative grid gap-4 px-4 py-4 transition hover:bg-slate-50 lg:grid-cols-[minmax(240px,1.5fr)_180px_150px_170px_90px] lg:items-center">
      {/* User */}
      <div className="flex min-w-0 items-center gap-3">
        <Avatar
          name={user.fullName}
          avatarUrl={user.avatarUrl}
        />

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">
            {user.fullName}
          </div>

          <div className="mt-0.5 truncate text-xs text-slate-500">
            {user.email}
          </div>
        </div>
      </div>

      {/* Role */}
      <div>
        <RoleBadge role={user.role} />
      </div>

      {/* Verification */}
      <div>
        {pendingVerification ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Pending
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Verified
          </span>
        )}

        {isBanned && (
          <span className="ml-1.5 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-700">
            Banned
          </span>
        )}
      </div>

      {/* Last active */}
      <div>
        <div className="text-xs font-medium text-slate-600">
          {user.lastSignInAt
            ? formatDate(user.lastSignInAt)
            : "Never"}
        </div>

        {user.lastSignInAt && (
          <div className="mt-0.5 text-[10px] text-slate-400">
            {formatRelative(
              user.lastSignInAt
            )}
          </div>
        )}
      </div>

      {/* Action */}
      <div className="flex justify-end">
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              onMenuChange(
                menuKey === key
                  ? null
                  : key
              )
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuKey === key && (
            <UserActionMenu
              user={user}
              isPending={isPending}
              onClose={() =>
                onMenuChange(null)
              }
              onView={onView}
              onBan={onBan}
              onInvite={onInvite}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- */
/* Platform Admin                   */
/* -------------------------------- */

function PlatformAdminRow({
  admin,
}: {
  admin: PlatformAdmin;
}) {
  return (
    <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
        <ShieldCheck className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-800">
          {admin.fullName}
        </div>

        <div className="mt-0.5 truncate text-xs text-slate-500">
          {admin.email}
        </div>
      </div>

      <span className="inline-flex w-fit rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-semibold capitalize text-purple-700">
        {admin.role}
      </span>

      <div className="text-xs text-slate-500">
        {admin.lastSignInAt
          ? `Last active ${formatRelative(
              admin.lastSignInAt
            )}`
          : "Never signed in"}
      </div>

      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Protected
      </div>
    </div>
  );
}

/* -------------------------------- */
/* User Action Menu                 */
/* -------------------------------- */

function UserActionMenu({
  user,
  isPending,
  onClose,
  onView,
  onBan,
  onInvite,
}: {
  user: CompanyUser;
  isPending: boolean;
  onClose: () => void;
  onView: () => void;
  onBan: () => void;
  onInvite: () => void;
}) {
  const isBanned = Boolean(user.bannedUntil);

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="fixed inset-0 z-20 cursor-default"
      />

      <div className="absolute right-0 top-11 z-30 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl">
        <MenuButton
          icon={Eye}
          label="View details"
          onClick={onView}
        />

        {!user.emailConfirmedAt && (
          <MenuButton
            icon={RefreshCw}
            label="Resend invitation"
            onClick={onInvite}
            disabled={isPending}
          />
        )}

        {!user.isPlatformAdmin && (
          <>
            <div className="my-1 border-t border-slate-100" />

            <MenuButton
              icon={
                isBanned
                  ? UserRoundCheck
                  : Ban
              }
              label={
                isBanned
                  ? "Restore access"
                  : "Ban user"
              }
              onClick={onBan}
              disabled={isPending}
              danger={!isBanned}
            />
          </>
        )}
      </div>
    </>
  );
}

/* -------------------------------- */
/* User Details Modal               */
/* -------------------------------- */

function UserDetailsModal({
  user,
  company,
  isPending,
  onClose,
  onBan,
  onInvite,
}: {
  user: CompanyUser;
  company: Company;
  isPending: boolean;
  onClose: () => void;
  onBan: () => void;
  onInvite: () => void;
}) {
  const isBanned = Boolean(user.bannedUntil);

  return (
    <Modal onClose={onClose}>
      <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            name={user.fullName}
            avatarUrl={user.avatarUrl}
          />

          <div className="min-w-0">
            <h2 className="truncate font-semibold text-slate-900">
              {user.fullName}
            </h2>

            <p className="mt-1 truncate text-xs text-slate-500">
              {user.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-slate-400" />

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Company
              </div>

              <div className="mt-1 text-sm font-semibold text-slate-800">
                {company.name}
              </div>

              <div className="mt-0.5 text-[11px] text-slate-400">
                {company.slug}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <DetailBox
            label="Company Role"
            value={formatRole(user.role)}
          />

          <DetailBox
            label="Account Status"
            value={
              isBanned
                ? "Banned"
                : "Active"
            }
          />

          <DetailBox
            label="Verification"
            value={
              user.emailConfirmedAt
                ? "Email verified"
                : "Pending verification"
            }
          />

          <DetailBox
            label="Last Active"
            value={
              user.lastSignInAt
                ? formatDate(
                    user.lastSignInAt
                  )
                : "Never"
            }
          />

          <DetailBox
            label="Joined Company"
            value={formatDate(user.createdAt)}
          />
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            User ID
          </div>

          <div className="mt-2 break-all font-mono text-[10px] text-slate-500">
            {user.userId}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <div>
          {!user.emailConfirmedAt && (
            <button
              type="button"
              disabled={isPending}
              onClick={onInvite}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Resend Invite
            </button>
          )}
        </div>

        {!user.isPlatformAdmin && (
          <button
            type="button"
            disabled={isPending}
            onClick={onBan}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
              isBanned
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {isBanned ? (
              <>
                <UserRoundCheck className="h-3.5 w-3.5" />
                Restore Access
              </>
            ) : (
              <>
                <Ban className="h-3.5 w-3.5" />
                Ban User
              </>
            )}
          </button>
        )}
      </div>
    </Modal>
  );
}

/* -------------------------------- */
/* Small Components                 */
/* -------------------------------- */

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  warning = false,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Users;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="h-5 w-5" />
        </div>

        <span
          className={`h-2 w-2 rounded-full ${
            warning
              ? "bg-amber-400"
              : "bg-emerald-500"
          }`}
        />
      </div>

      <div className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
        {value.toLocaleString()}
      </div>

      <div className="mt-1 text-sm font-medium text-slate-700">
        {label}
      </div>

      <div className="mt-1 text-[11px] text-slate-400">
        {detail}
      </div>
    </div>
  );
}

function CompanyMetric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className="text-right">
      <div className="text-sm font-semibold text-slate-800">
        {value}
      </div>

      <div
        className={`mt-0.5 text-[9px] font-bold uppercase tracking-wider ${
          warning
            ? "text-amber-500"
            : "text-slate-400"
        }`}
      >
        {label}
      </div>
    </div>
  );
}

function Avatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || "User"}
        className="h-10 w-10 shrink-0 rounded-xl object-cover"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

function RoleBadge({
  role,
}: {
  role: string;
}) {
  const normalized = role.toLowerCase();

  let classes =
    "bg-slate-100 text-slate-600";

  if (normalized === "owner") {
    classes =
      "bg-emerald-50 text-emerald-700";
  } else if (normalized === "admin") {
    classes =
      "bg-blue-50 text-blue-700";
  } else if (normalized === "manager") {
    classes =
      "bg-amber-50 text-amber-700";
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${classes}`}
    >
      {formatRole(role)}
    </span>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function DetailBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>

      <div className="mt-1.5 text-sm font-semibold text-slate-800">
        {value}
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Users;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-800">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {text}
      </p>
    </div>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function getCompanyInitials(name: string) {
  const value = name.trim();

  if (!value) {
    return "C";
  }

  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");
}

function formatRole(role: string) {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}

function formatRelative(value: string) {
  const timestamp = new Date(value).getTime();

  const difference = Math.max(
    0,
    Date.now() - timestamp
  );

  const minutes = Math.floor(
    difference / (1000 * 60)
  );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 30) {
    return `${days}d ago`;
  }

  const months = Math.floor(days / 30);

  if (months < 12) {
    return `${months}mo ago`;
  }

  const years = Math.floor(months / 12);

  return `${years}y ago`;
}