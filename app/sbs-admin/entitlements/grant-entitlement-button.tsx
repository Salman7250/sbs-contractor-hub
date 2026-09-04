"use client";

import { useState } from "react";
import { grantEntitlement } from "./actions/grant-entitlement";

type Company = {
  id: string;
  name: string;
};

type Module = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
};

type Props = {
  companies: Company[];
  modules: Module[];
};

export default function GrantEntitlementButton({
  companies,
  modules,
}: Props) {
  const [open, setOpen] = useState(false);

  const [companyId, setCompanyId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [access, setAccess] = useState<
    "enabled" | "disabled"
  >("enabled");

  const [source, setSource] = useState<
    "override" | "free"
  >("override");

  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const result = await grantEntitlement(formData);

    if (!result.success) {
      setError(
        result.error ||
          "Failed to grant entitlement."
      );

      setLoading(false);
      return;
    }

    setLoading(false);
    setOpen(false);

    resetForm();

    window.location.reload();
  }

  function resetForm() {
    setCompanyId("");
    setModuleId("");
    setAccess("enabled");
    setSource("override");
    setExpiresAt("");
    setReason("");
    setError("");
  }

  function closeModal() {
    if (loading) return;

    setOpen(false);
    resetForm();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
        className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
      >
        + Grant Access
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-700 px-6 py-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Manual Entitlement
                </p>

                <h2 className="mt-1 text-lg font-semibold text-white">
                  Grant Module Access
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Give a company access outside its normal plan.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="text-slate-400 transition hover:text-white disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <form
              action={handleSubmit}
              className="space-y-5 p-6"
            >
              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Company
                </label>

                <select
                  name="company_id"
                  value={companyId}
                  onChange={(event) =>
                    setCompanyId(event.target.value)
                  }
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500 disabled:opacity-50"
                >
                  <option value="">
                    Select company
                  </option>

                  {companies.map((company) => (
                    <option
                      key={company.id}
                      value={company.id}
                    >
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Module
                </label>

                <select
                  name="module_id"
                  value={moduleId}
                  onChange={(event) =>
                    setModuleId(event.target.value)
                  }
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500 disabled:opacity-50"
                >
                  <option value="">
                    Select module
                  </option>

                  {modules.map((module) => (
                    <option
                      key={module.id}
                      value={module.id}
                    >
                      {module.name}
                      {module.category
                        ? ` · ${module.category}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Access
                  </label>

                  <select
                    name="access"
                    value={access}
                    onChange={(event) =>
                      setAccess(
                        event.target.value as
                          | "enabled"
                          | "disabled"
                      )
                    }
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500 disabled:opacity-50"
                  >
                    <option value="enabled">
                      Enabled
                    </option>

                    <option value="disabled">
                      Disabled
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Source
                  </label>

                  <select
                    name="source"
                    value={source}
                    onChange={(event) =>
                      setSource(
                        event.target.value as
                          | "override"
                          | "free"
                      )
                    }
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500 disabled:opacity-50"
                  >
                    <option value="override">
                      Manual Override
                    </option>

                    <option value="free">
                      Free Access
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Expiration
                </label>

                <input
                  name="expires_at"
                  type="date"
                  value={expiresAt}
                  onChange={(event) =>
                    setExpiresAt(event.target.value)
                  }
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500 disabled:opacity-50"
                />

                <p className="mt-1.5 text-xs text-slate-500">
                  Leave empty for permanent access.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Reason
                </label>

                <textarea
                  name="reason"
                  value={reason}
                  onChange={(event) =>
                    setReason(event.target.value)
                  }
                  disabled={loading}
                  rows={3}
                  placeholder="Why is this access being granted?"
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-slate-500 disabled:opacity-50"
                />
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="text-xs leading-5 text-blue-300/80">
                  This creates a manual entitlement for the
                  selected company and module. It will take
                  priority over normal plan access.
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-700 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "Granting..."
                    : "Grant Access"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}