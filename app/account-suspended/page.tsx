"use client";

import { LogOut, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export default function AccountSuspendedPage() {
  const [loggingOut, setLoggingOut] =
    useState(false);

  async function handleLogout() {
    setLoggingOut(true);

    const supabase = createClient();

    await supabase.auth.signOut();

    window.location.href = "/login";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl sm:p-10">
          {/* ICON */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <ShieldAlert className="h-8 w-8" />
          </div>

          {/* TITLE */}
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-950">
            Your company is suspended
          </h1>

          {/* MESSAGE */}
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
            Access to the SBS workspace has
            been temporarily suspended for
            your company.
          </p>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Please contact your company
            administrator or SBS support if
            you believe this is an error.
          </p>

          {/* STATUS */}
          <div className="mt-7 rounded-2xl border border-red-100 bg-red-50/70 px-5 py-4 text-left">
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              Account Status
            </div>

            <div className="mt-1 text-sm font-semibold text-red-900">
              Suspended
            </div>
          </div>

          {/* LOGOUT */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />

            {loggingOut
              ? "Logging out..."
              : "Log out"}
          </button>
        </div>

        {/* BRAND */}
        <div className="mt-6 text-center text-xs text-slate-400">
          SBS · Sharif Business Solutions
        </div>
      </div>
    </main>
  );
}