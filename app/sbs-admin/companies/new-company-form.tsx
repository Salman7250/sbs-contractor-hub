"use client";

import { useState } from "react";
import { createCompany } from "./actions/create-company";

type BusinessType = "product" | "service";

export default function NewCompanyForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    slug: "",
    businessType: "service" as BusinessType,
    ownerEmail: "",
    email: "",
    phone: "",
    website: "",
    domain: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "United States",
    timezone: "America/Chicago",
    currency: "USD",
    status: "trial" as
      | "active"
      | "trial"
      | "suspended"
      | "cancelled",
  });

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function resetForm() {
    setForm({
      name: "",
      slug: "",
      businessType: "service",
      ownerEmail: "",
      email: "",
      phone: "",
      website: "",
      domain: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "United States",
      timezone: "America/Chicago",
      currency: "USD",
      status: "trial",
    });
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    const result = await createCompany(form);

    if (!result.success) {
      setError(result.error || "Something went wrong.");
      setLoading(false);
      return;
    }

    setSuccess(
      `Company created successfully. An owner invitation has been sent to ${result.owner?.email}.`
    );

    setLoading(false);

    resetForm();

    setTimeout(() => {
      setOpen(false);
      setSuccess("");
    }, 3000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setSuccess("");
          setOpen(true);
        }}
        className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
      >
        <span className="mr-2 text-lg leading-none">
          +
        </span>

        New Company
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => !loading && setOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
            <div className="sticky top-0 border-b border-white/10 bg-slate-950/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Create Company
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    Provision a new business workspace and invite
                    its owner.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-8 p-6"
            >
              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  {success}
                </div>
              )}

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Company
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-sm text-slate-300">
                      Company name *
                    </label>

                    <input
                      required
                      value={form.name}
                      onChange={(event) => {
                        const name =
                          event.target.value;

                        setForm((current) => ({
                          ...current,
                          name,
                          slug:
                            current.slug ||
                            generateSlug(name),
                        }));
                      }}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-white/30"
                      placeholder="North Texas Roofing & Shingle"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">
                      Company slug *
                    </label>

                    <input
                      required
                      value={form.slug}
                      onChange={(event) =>
                        updateField(
                          "slug",
                          event.target.value
                            .toLowerCase()
                            .replace(/\s+/g, "-")
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-white/30"
                      placeholder="north-texas-roofing"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">
                      Status
                    </label>

                    <select
                      value={form.status}
                      onChange={(event) =>
                        updateField(
                          "status",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-white/30"
                    >
                      <option value="trial">
                        Trial
                      </option>

                      <option value="active">
                        Active
                      </option>

                      <option value="suspended">
                        Suspended
                      </option>

                      <option value="cancelled">
                        Cancelled
                      </option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-sm font-medium text-slate-300">
                    Business type *
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    This determines the primary workspace experience
                    SBS provides for this company.
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          businessType: "product",
                        }))
                      }
                      className={`group rounded-xl border p-4 text-left transition ${
                        form.businessType === "product"
                          ? "border-white/30 bg-white/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${
                            form.businessType === "product"
                              ? "bg-white/10"
                              : "bg-white/5"
                          }`}
                        >
                          🛒
                        </div>

                        <div>
                          <div className="font-medium text-white">
                            Product Business
                          </div>

                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            For businesses that sell physical
                            products, including retail, wholesale,
                            e-commerce, electronics, clothing,
                            hardware and more.
                          </p>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          businessType: "service",
                        }))
                      }
                      className={`group rounded-xl border p-4 text-left transition ${
                        form.businessType === "service"
                          ? "border-white/30 bg-white/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${
                            form.businessType === "service"
                              ? "bg-white/10"
                              : "bg-white/5"
                          }`}
                        >
                          🔧
                        </div>

                        <div>
                          <div className="font-medium text-white">
                            Service Business
                          </div>

                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            For businesses that provide physical
                            services such as plumbing, roofing,
                            HVAC, electrical, cleaning, landscaping
                            and construction.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Company Owner
                </h3>

                <div className="mt-4">
                  <label className="text-sm text-slate-300">
                    Owner email *
                  </label>

                  <input
                    required
                    type="email"
                    value={form.ownerEmail}
                    onChange={(event) =>
                      updateField(
                        "ownerEmail",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-white/30"
                    placeholder="owner@company.com"
                  />

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    SBS will send this person a secure
                    Supabase invitation. They will create
                    their own password.
                  </p>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Website
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-300">
                      Website URL
                    </label>

                    <input
                      type="text"
                      value={form.website}
                      onChange={(event) =>
                        updateField(
                          "website",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/30"
                      placeholder="https://northtexasroofing.com"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">
                      Primary domain
                    </label>

                    <input
                      type="text"
                      value={form.domain}
                      onChange={(event) =>
                        updateField(
                          "domain",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/30"
                      placeholder="northtexasroofing.com"
                    />

                    <p className="mt-1 text-xs text-slate-500">
                      Used later to authenticate website
                      integrations.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Contact
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-300">
                      Business email
                    </label>

                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField(
                          "email",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/30"
                      placeholder="office@company.com"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">
                      Phone
                    </label>

                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        updateField(
                          "phone",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/30"
                      placeholder="+1 214 555 0100"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Address
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-sm text-slate-300">
                      Address line 1
                    </label>

                    <input
                      value={form.addressLine1}
                      onChange={(event) =>
                        updateField(
                          "addressLine1",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/30"
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-sm text-slate-300">
                      Address line 2
                    </label>

                    <input
                      value={form.addressLine2}
                      onChange={(event) =>
                        updateField(
                          "addressLine2",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/30"
                      placeholder="Suite 100"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">
                      City
                    </label>

                    <input
                      value={form.city}
                      onChange={(event) =>
                        updateField(
                          "city",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/30"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">
                      State / Region
                    </label>

                    <input
                      value={form.state}
                      onChange={(event) =>
                        updateField(
                          "state",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/30"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">
                      Postal code
                    </label>

                    <input
                      value={form.postalCode}
                      onChange={(event) =>
                        updateField(
                          "postalCode",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/30"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">
                      Country
                    </label>

                    <input
                      value={form.country}
                      onChange={(event) =>
                        updateField(
                          "country",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/30"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Regional settings
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-300">
                      Timezone
                    </label>

                    <input
                      value={form.timezone}
                      onChange={(event) =>
                        updateField(
                          "timezone",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/30"
                      placeholder="America/Chicago"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">
                      Currency
                    </label>

                    <input
                      value={form.currency}
                      onChange={(event) =>
                        updateField(
                          "currency",
                          event.target.value
                            .toUpperCase()
                            .slice(0, 3)
                        )
                      }
                      maxLength={3}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/30"
                      placeholder="USD"
                    />
                  </div>
                </div>
              </section>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="text-sm font-medium text-blue-300">
                  Owner onboarding
                </div>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  When you create this company, SBS will create
                  its tenant and send the owner a secure account
                  invitation. The owner will choose their own
                  password.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Creating & Inviting..."
                    : "Create Company & Invite Owner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}