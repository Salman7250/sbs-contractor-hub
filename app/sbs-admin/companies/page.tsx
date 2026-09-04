import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import NewCompanyForm from "./new-company-form";

export default async function AdminCompaniesPage() {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const { data: companies, error } = await supabase
    .from("companies")
    .select(
      `
        id,
        name,
        slug,
        email,
        phone,
        city,
        state,
        country,
        status,
        created_at
      `
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Companies
          </h1>

          <p className="mt-2 text-slate-400">
            Manage customer companies registered on the SBS platform.
          </p>
        </div>

        <NewCompanyForm />
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        {companies && companies.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Company
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Contact
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Location
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Status
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Created
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {companies.map((company) => (
                  <tr
                    key={company.id}
                    className="transition hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-5">
                      <div className="font-medium text-white">
                        {company.name}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {company.slug || "No slug"}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="text-sm text-slate-300">
                        {company.email || "—"}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {company.phone || "No phone"}
                      </div>
                    </td>

                    <td className="px-6 py-5 text-sm text-slate-300">
                      {[
                        company.city,
                        company.state,
                        company.country,
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                          company.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : company.status === "trial"
                              ? "bg-blue-500/10 text-blue-400"
                              : company.status === "suspended"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-red-500/10 text-red-400",
                        ].join(" ")}
                      >
                        {company.status}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-sm text-slate-400">
                      {new Date(
                        company.created_at
                      ).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center">
            <div className="text-lg font-semibold">
              No companies yet
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Customer companies will appear here when they are
              provisioned.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}