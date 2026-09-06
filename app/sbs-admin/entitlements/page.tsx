import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import ManageEntitlementButton from "./manage-entitlement-button";
import GrantEntitlementButton from "./grant-entitlement-button";

type EntitlementRow = {
  id: string;
  company_id: string;
  module_id: string;
  access: "enabled" | "disabled";
  source: "plan" | "override" | "free";
  subscription_id: string | null;
  expires_at: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
  companies:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
  modules:
    | {
        id: string;
        name: string;
        slug: string;
        category: string | null;
      }
    | {
        id: string;
        name: string;
        slug: string;
        category: string | null;
      }[]
    | null;
};

const currentTime = Date.now();

function getCompany(
  company:
    | EntitlementRow["companies"]
    | null
    | undefined
): { id: string; name: string } | null {
  if (!company) return null;

  if (Array.isArray(company)) {
    return company[0] ?? null;
  }

  return company;
}

function getModule(
  module:
    | EntitlementRow["modules"]
    | null
    | undefined
): {
  id: string;
  name: string;
  slug: string;
  category: string | null;
} | null {
  if (!module) return null;

  if (Array.isArray(module)) {
    return module[0] ?? null;
  }

  return module;
}

function formatDate(value: string | null) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getSourceLabel(source: EntitlementRow["source"]) {
  switch (source) {
    case "plan":
      return "Plan";
    case "override":
      return "Override";
    case "free":
      return "Free";
    default:
      return source;
  }
}

function getSourceClasses(source: EntitlementRow["source"]) {
  switch (source) {
    case "plan":
      return "bg-blue-500/10 text-blue-300 ring-blue-500/20";

    case "override":
      return "bg-amber-500/10 text-amber-300 ring-amber-500/20";

    case "free":
      return "bg-purple-500/10 text-purple-300 ring-purple-500/20";

    default:
      return "bg-slate-500/10 text-slate-300 ring-slate-500/20";
  }
}

export default async function AdminEntitlementsPage() {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("company_entitlements")
    .select(
      `
        id,
        company_id,
        module_id,
        access,
        source,
        subscription_id,
        expires_at,
        reason,
        created_at,
        updated_at,
        companies (
          id,
          name
        ),
        modules (
          id,
          name,
          slug,
          category
        )
      `
    )
    .order("created_at", { ascending: false });

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");

  const { data: modules } = await supabase
    .from("modules")
    .select("id, name, slug, category")
    .eq("is_active", true)
    .order("name");

  const entitlements = (data ?? []) as EntitlementRow[];

  const enabledCount = entitlements.filter(
    (item) => item.access === "enabled"
  ).length;

  const disabledCount = entitlements.filter(
    (item) => item.access === "disabled"
  ).length;

  const overrideCount = entitlements.filter(
    (item) => item.source === "override"
  ).length;

  const freeCount = entitlements.filter(
    (item) => item.source === "free"
  ).length;

  const thirtyDaysFromNow =
    currentTime + 30 * 24 * 60 * 60 * 1000;

  const expiringCount = entitlements.filter((item) => {
    if (!item.expires_at) return false;

    const expiresAt = new Date(item.expires_at).getTime();

    return (
      expiresAt > currentTime &&
      expiresAt <= thirtyDaysFromNow
    );
  }).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Access & Entitlements
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Control module access for companies, including plan
            access, manual overrides, and free access.
          </p>
        </div>

        <GrantEntitlementButton
          companies={companies ?? []}
          modules={modules ?? []}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          Failed to load entitlements: {error.message}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-sm text-slate-400">
            Total Entitlements
          </p>

          <p className="mt-2 text-3xl font-semibold text-white">
            {entitlements.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-sm text-slate-400">
            Enabled
          </p>

          <p className="mt-2 text-3xl font-semibold text-emerald-400">
            {enabledCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-sm text-slate-400">
            Disabled
          </p>

          <p className="mt-2 text-3xl font-semibold text-red-400">
            {disabledCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-sm text-slate-400">
            Overrides / Free
          </p>

          <p className="mt-2 text-3xl font-semibold text-amber-400">
            {overrideCount + freeCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-sm text-slate-400">
            Expiring Soon
          </p>

          <p className="mt-2 text-3xl font-semibold text-orange-400">
            {expiringCount}
          </p>
        </div>
      </div>

      {/* Information notice */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
        <div className="flex gap-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.5m0 3h.01M10.3 4.4 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0Z"
              />
            </svg>
          </div>

          <div>
            <h2 className="font-medium text-white">
              How entitlement access works
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-400">
              Plan entitlements are generated automatically from a
              company&apos;s subscription. Manual overrides and free
              access can temporarily replace normal plan access.
              Expiration dates allow temporary access to be granted
              without permanently changing the customer&apos;s plan.
            </p>
          </div>
        </div>
      </div>

      {/* Entitlements table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
        <div className="border-b border-slate-800 px-6 py-5">
          <h2 className="font-semibold text-white">
            Company Module Access
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Current effective access for every company/module
            entitlement.
          </p>
        </div>

        {entitlements.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                />
              </svg>
            </div>

            <h3 className="mt-4 font-medium text-white">
              No entitlements yet
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Create a manual entitlement using the Grant Access
              button above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-left">
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Company
                  </th>

                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Module
                  </th>

                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Access
                  </th>

                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Source
                  </th>

                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Expires
                  </th>

                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Updated
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {entitlements.map((entitlement) => {
                  const company = getCompany(
                    entitlement.companies
                  );

                  const moduleInfo = getModule(
                    entitlement.modules
                  );

                  return (
                    <tr
                      key={entitlement.id}
                      className="transition-colors hover:bg-slate-800/30"
                    >
                      {/* Company */}
                      <td className="px-6 py-5">
                        <div className="font-medium text-white">
                          {company?.name ?? "Unknown company"}
                        </div>

                        <div className="mt-1 font-mono text-xs text-slate-500">
                          {entitlement.company_id.slice(0, 8)}...
                        </div>
                      </td>

                      {/* Module */}
                      <td className="px-6 py-5">
                        <div className="font-medium text-white">
                          {moduleInfo?.name ?? "Unknown module"}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {moduleInfo?.category ??
                            moduleInfo?.slug ??
                            "—"}
                        </div>
                      </td>

                      {/* Access */}
                      <td className="px-6 py-5">
                        {entitlement.access === "enabled" ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/20">
                            Disabled
                          </span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${getSourceClasses(
                            entitlement.source
                          )}`}
                        >
                          {getSourceLabel(
                            entitlement.source
                          )}
                        </span>

                        {entitlement.reason && (
                          <div
                            className="mt-2 max-w-[220px] truncate text-xs text-slate-500"
                            title={entitlement.reason}
                          >
                            {entitlement.reason}
                          </div>
                        )}
                      </td>

                      {/* Expires */}
                      <td className="px-6 py-5 text-sm text-slate-300">
                        {entitlement.expires_at ? (
                          <div>
                            {formatDate(
                              entitlement.expires_at
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">
                            Never
                          </span>
                        )}
                      </td>

                      {/* Updated */}
                      <td className="px-6 py-5 text-sm text-slate-400">
                        {formatDateTime(
                          entitlement.updated_at
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-6 py-5 text-right">
                        {company && moduleInfo && (
                          <ManageEntitlementButton
                            entitlement={{
                              id: entitlement.id,
                              companyId:
                                entitlement.company_id,
                              companyName: company.name,
                              moduleId:
                                entitlement.module_id,
                              moduleName: moduleInfo.name,
                              access:
                                entitlement.access,
                              source:
                                entitlement.source,
                              expiresAt:
                                entitlement.expires_at,
                              reason:
                                entitlement.reason,
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}