import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, LockKeyhole, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type RuntimePolicy = {
  maintenance_mode: boolean;
  platform_lockdown: boolean;
  is_platform_admin?: boolean;
};

type PublicAvailability = {
  maintenance_mode: boolean;
  platform_lockdown: boolean;
};

type MaintenancePageProps = {
  searchParams: Promise<{
    reason?: string;
  }>;
};

export default async function MaintenancePage({
  searchParams,
}: MaintenancePageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let maintenanceMode = false;
  let platformLockdown = false;

  if (user) {
    const { data: runtimePolicy, error } = await supabase.rpc(
      "get_platform_runtime_policy",
    );

    if (error || !runtimePolicy) {
      // Fail closed: if we cannot verify platform state, keep the page visible.
      maintenanceMode = true;
    } else {
      const policy = runtimePolicy as RuntimePolicy;
      maintenanceMode = Boolean(policy.maintenance_mode);
      platformLockdown = Boolean(policy.platform_lockdown);

      // Platform admins must always be able to reach the admin area.
      if (policy.is_platform_admin) {
        redirect("/sbs-admin");
      }
    }
  } else {
    // The public site/login/signup must remain reachable during maintenance.
    // This RPC exposes only the two public availability flags.
    const { data: availability, error } = await supabase.rpc(
      "get_public_platform_availability",
    );

    if (error || !availability) {
      // Fail closed if availability cannot be verified.
      maintenanceMode = true;
    } else {
      const publicPolicy = availability as PublicAvailability;
      maintenanceMode = Boolean(publicPolicy.maintenance_mode);
      platformLockdown = Boolean(publicPolicy.platform_lockdown);
    }
  }

  // Direct visits to /maintenance should never show a stale maintenance page
  // after the setting has been disabled.
  if (!maintenanceMode && !platformLockdown) {
    redirect("/");
  }

  const isLockdown = platformLockdown;
  const policyCheckFailed = params.reason === "policy-check-failed";

  const title = isLockdown
    ? "SBS Platform Locked Down"
    : "SBS Is Temporarily Unavailable";

  const description = isLockdown
    ? "Access to the SBS application has been temporarily restricted by the platform administration team."
    : "The SBS application is temporarily unavailable while we perform maintenance and platform updates.";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl backdrop-blur sm:p-12">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            {isLockdown ? (
              <LockKeyhole className="h-8 w-8 text-amber-300" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-amber-300" />
            )}
          </div>

          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Sharif Business Solutions
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
            {description}
          </p>

          {policyCheckFailed && (
            <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
              Platform availability could not be verified right now. Please try
              again shortly.
            </div>
          )}

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Back to Sign In
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Return Home
            </Link>
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            <span>Platform access is controlled by SBS administration.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
