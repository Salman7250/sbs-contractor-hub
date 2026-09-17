"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  ChevronDown,
  Globe2,
  Mail,
  MapPin,
  Percent,
  Phone,
  ShieldCheck,
  Tag,
  UserRound,
  X,
} from "lucide-react";

import { createCompany } from "./actions/create-company";

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  currency: string | null;
  is_active: boolean | null;
  is_popular: boolean | null;
  sort_order: number | null;
};

type Props = {
  plans: Plan[];
};

type FormState = {
  companyName: string;
  ownerName: string;
  ownerEmail: string;

  slug: string;
  email: string;
  phone: string;
  website: string;

  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;

  timezone: string;
  currency: string;

  taxRegistrationNumber: string;
  tradeLicenseNumber: string;
  legalRegistrationType: string;
  authorityName: string;

  planId: string;
  billingCycle: "monthly" | "yearly";

  trialEnabled: boolean;
  trialDays: number;

  discountEnabled: boolean;
  discountName: string;
  discountCode: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  discountDuration:
    | "one_month"
    | "three_months"
    | "six_months"
    | "twelve_months"
    | "lifetime"
    | "custom";
  discountBillingCycle:
    | "monthly"
    | "yearly"
    | "both";
  discountExpiresAt: string;
  discountReason: string;
};

const DEFAULT_FORM: FormState = {
  companyName: "",
  ownerName: "",
  ownerEmail: "",

  slug: "",
  email: "",
  phone: "",
  website: "",

  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United Arab Emirates",

  timezone: "Asia/Dubai",
  currency: "AED",

  taxRegistrationNumber: "",
  tradeLicenseNumber: "",
  legalRegistrationType: "",
  authorityName: "",

  planId: "",
  billingCycle: "monthly",

  trialEnabled: true,
  trialDays: 14,

  discountEnabled: false,
  discountName: "",
  discountCode: "",
  discountType: "percentage",
  discountValue: "",
  discountDuration: "one_month",
  discountBillingCycle: "both",
  discountExpiresAt: "",
  discountReason: "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatMoney(
  amount: number,
  currency: string,
  billingCycle: "monthly" | "yearly",
) {
  const safeCurrency =
    currency || "USD";

  return (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 0,
    }).format(amount) +
    (billingCycle === "monthly"
      ? "/mo"
      : "/yr")
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: typeof Building2;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-slate-700">
        {label}
        {required ? (
          <span className="ml-1 text-emerald-600">
            *
          </span>
        ) : null}
      </span>

      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        ) : null}

        <input
          type={type}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          required={required}
          className={[
            "h-11 w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition",
            "placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10",
            Icon
              ? "pl-10 pr-3.5"
              : "px-3.5",
          ].join(" ")}
        />
      </div>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-slate-700">
        {label}
      </span>

      <div className="relative">
        <select
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 pr-10 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        >
          {children}
        </select>

        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  );
}

export default function NewCompanyForm({
  plans,
}: Props) {
  const router = useRouter();

  const activePlans = useMemo(
    () =>
      (plans ?? [])
        .filter(
          (plan) =>
            plan.is_active !== false,
        )
        .sort(
          (a, b) =>
            (a.sort_order ?? 0) -
            (b.sort_order ?? 0),
        ),
    [plans],
  );

  const [open, setOpen] =
    useState(false);

  const [form, setForm] =
    useState<FormState>({
      ...DEFAULT_FORM,
      planId:
        activePlans[0]?.id ?? "",
    });

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const selectedPlan =
    activePlans.find(
      (plan) =>
        plan.id === form.planId,
    );

  const update = <
    K extends keyof FormState
  >(
    key: K,
    value: FormState[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleCompanyNameChange = (
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      companyName: value,
      slug:
        current.slug ||
        slugify(value),
    }));
  };

  const calculateDiscount = () => {
    if (
      !selectedPlan ||
      !form.discountEnabled
    ) {
      return {
        original: 0,
        discount: 0,
        final: 0,
      };
    }

    const original =
      form.billingCycle ===
      "monthly"
        ? Number(
            selectedPlan.monthly_price ??
              0,
          )
        : Number(
            selectedPlan.yearly_price ??
              0,
          );

    const value = Number(
      form.discountValue || 0,
    );

    let discount = 0;

    if (
      form.discountType ===
      "percentage"
    ) {
      discount =
        (original *
          Math.min(
            Math.max(value, 0),
            100,
          )) /
        100;
    } else {
      discount = Math.min(
        Math.max(value, 0),
        original,
      );
    }

    return {
      original,
      discount,
      final: Math.max(
        original - discount,
        0,
      ),
    };
  };

  const pricing =
    calculateDiscount();

  function resetForm() {
    setForm({
      ...DEFAULT_FORM,
      planId:
        activePlans[0]?.id ?? "",
    });

    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeModal() {
    if (saving) return;

    setOpen(false);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function openModal() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!form.planId) {
      setForm((current) => ({
        ...current,
        planId:
          activePlans[0]?.id ?? "",
      }));
    }

    setOpen(true);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (!form.companyName.trim()) {
        throw new Error(
          "Company name is required.",
        );
      }

      if (!form.ownerName.trim()) {
        throw new Error(
          "Owner name is required.",
        );
      }

      if (!form.ownerEmail.trim()) {
        throw new Error(
          "Owner email is required.",
        );
      }

      if (!form.planId) {
        throw new Error(
          "Please select a plan.",
        );
      }

      if (
        form.trialEnabled &&
        (form.trialDays < 0 ||
          form.trialDays > 3650)
      ) {
        throw new Error(
          "Trial period must be between 0 and 3650 days.",
        );
      }

      if (
        form.discountEnabled &&
        form.discountType ===
          "percentage" &&
        (Number(
          form.discountValue,
        ) < 0 ||
          Number(
            form.discountValue,
          ) > 100)
      ) {
        throw new Error(
          "Percentage discount must be between 0 and 100.",
        );
      }

      if (
        form.discountEnabled &&
        form.discountType ===
          "fixed" &&
        Number(
          form.discountValue,
        ) < 0
      ) {
        throw new Error(
          "Fixed discount cannot be negative.",
        );
      }

      if (
        form.discountEnabled &&
        form.discountDuration ===
          "custom" &&
        !form.discountExpiresAt
      ) {
        throw new Error(
          "Please provide a custom discount expiry date.",
        );
      }

      if (
        form.discountEnabled &&
        !form.discountName.trim()
      ) {
        throw new Error(
          "Discount name is required.",
        );
      }

      const result =
        await createCompany({
          companyName:
            form.companyName.trim(),

          ownerName:
            form.ownerName.trim(),

          ownerEmail:
            form.ownerEmail.trim(),

          slug:
            form.slug.trim() ||
            slugify(
              form.companyName,
            ),

          email:
            form.email.trim(),

          phone:
            form.phone.trim(),

          website:
            form.website.trim(),

          addressLine1:
            form.addressLine1.trim(),

          addressLine2:
            form.addressLine2.trim(),

          city:
            form.city.trim(),

          state:
            form.state.trim(),

          postalCode:
            form.postalCode.trim(),

          country:
            form.country.trim(),

          timezone:
            form.timezone.trim(),

          currency:
            form.currency.trim(),

          taxRegistrationNumber:
            form.taxRegistrationNumber.trim(),

          tradeLicenseNumber:
            form.tradeLicenseNumber.trim(),

          legalRegistrationType:
            form.legalRegistrationType.trim(),

          authorityName:
            form.authorityName.trim(),

          businessType:
            "product",

          planId:
            form.planId,

          billingCycle:
            form.billingCycle,

          trialEnabled:
            form.trialEnabled,

          trialDays:
            form.trialEnabled
              ? form.trialDays
              : 0,

          discountEnabled:
            form.discountEnabled,

          discountName:
            form.discountName.trim(),

          discountCode:
            form.discountCode.trim(),

          discountType:
            form.discountType,

          discountValue:
            Number(
              form.discountValue || 0,
            ),

          discountDuration:
            form.discountDuration,

          discountBillingCycle:
            form.discountBillingCycle,

          discountExpiresAt:
            form.discountExpiresAt,

          discountReason:
            form.discountReason.trim(),
        });

      if (!result.success) {
        throw new Error(
          result.error ||
            "Unable to create company.",
        );
      }

      setSuccessMessage(
        `${form.companyName.trim()} was created successfully.`,
      );

      router.refresh();

      /*
       * Navigate immediately after successful
       * company provisioning.
       */
      router.push(
        `/sbs-admin/companies/${result.companyId}`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while creating the company.",
      );

      setSaving(false);
    }
  }

  return (
    <>
      {/* =========================================================
          TRIGGER BUTTON
          ========================================================= */}
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
      >
        <Building2 className="h-4 w-4" />
        New Company
      </button>

      {/* =========================================================
          MODAL
          ========================================================= */}
      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f3f5f8] shadow-2xl">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Building2 className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Create New Company
                  </h2>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Provision a new SBS
                    product-business
                    workspace.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              <form
                id="new-company-form"
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {/* Business Type */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <Building2 className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Business Type
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        SBS is currently
                        focused on
                        product-based
                        businesses.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                        <Check className="h-4 w-4" />
                      </div>

                      <div>
                        <p className="font-semibold text-slate-900">
                          Product Business
                        </p>

                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Designed for
                          ITAD,
                          refurbishing,
                          IT hardware,
                          electronics,
                          parts,
                          resale,
                          wholesale,
                          distribution,
                          and other
                          inventory-driven
                          businesses.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Company */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Building2 className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Company
                        Information
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Basic identity
                        and contact
                        information
                        for the
                        customer
                        company.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <InputField
                      label="Company Name"
                      value={
                        form.companyName
                      }
                      onChange={
                        handleCompanyNameChange
                      }
                      placeholder="e.g. Sharif Tech Solutions"
                      icon={
                        Building2
                      }
                      required
                    />

                    <InputField
                      label="Company Slug"
                      value={
                        form.slug
                      }
                      onChange={(
                        value,
                      ) =>
                        update(
                          "slug",
                          slugify(
                            value,
                          ),
                        )
                      }
                      placeholder="sharif-tech-solutions"
                    />

                    <InputField
                      label="Company Email"
                      value={
                        form.email
                      }
                      onChange={(
                        value,
                      ) =>
                        update(
                          "email",
                          value,
                        )
                      }
                      placeholder="info@company.com"
                      type="email"
                      icon={Mail}
                    />

                    <InputField
                      label="Phone"
                      value={
                        form.phone
                      }
                      onChange={(
                        value,
                      ) =>
                        update(
                          "phone",
                          value,
                        )
                      }
                      placeholder="+971..."
                      icon={Phone}
                    />

                    <div className="md:col-span-2">
                      <InputField
                        label="Website"
                        value={
                          form.website
                        }
                        onChange={(
                          value,
                        ) =>
                          update(
                            "website",
                            value,
                          )
                        }
                        placeholder="https://company.com"
                        icon={
                          Globe2
                        }
                      />
                    </div>
                  </div>
                </section>

                {/* Owner */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <UserRound className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Company Owner
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        The owner will
                        receive an
                        invitation to
                        activate their
                        SBS account.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <InputField
                      label="Owner Full Name"
                      value={
                        form.ownerName
                      }
                      onChange={(
                        value,
                      ) =>
                        update(
                          "ownerName",
                          value,
                        )
                      }
                      placeholder="John Smith"
                      icon={
                        UserRound
                      }
                      required
                    />

                    <InputField
                      label="Owner Email"
                      value={
                        form.ownerEmail
                      }
                      onChange={(
                        value,
                      ) =>
                        update(
                          "ownerEmail",
                          value,
                        )
                      }
                      placeholder="owner@company.com"
                      type="email"
                      icon={Mail}
                      required
                    />
                  </div>
                </section>

                {/* Address */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <MapPin className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Business
                        Address
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Used across
                        invoices,
                        documents,
                        and company
                        records.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <InputField
                        label="Address Line 1"
                        value={
                          form.addressLine1
                        }
                        onChange={(
                          value,
                        ) =>
                          update(
                            "addressLine1",
                            value,
                          )
                        }
                        placeholder="Street / building"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <InputField
                        label="Address Line 2"
                        value={
                          form.addressLine2
                        }
                        onChange={(
                          value,
                        ) =>
                          update(
                            "addressLine2",
                            value,
                          )
                        }
                        placeholder="Suite / office / unit"
                      />
                    </div>

                    <InputField
                      label="City"
                      value={
                        form.city
                      }
                      onChange={(
                        value,
                      ) =>
                        update(
                          "city",
                          value,
                        )
                      }
                      placeholder="Dubai"
                    />

                    <InputField
                      label="State / Emirate"
                      value={
                        form.state
                      }
                      onChange={(
                        value,
                      ) =>
                        update(
                          "state",
                          value,
                        )
                      }
                      placeholder="Dubai"
                    />

                    <InputField
                      label="Postal Code"
                      value={
                        form.postalCode
                      }
                      onChange={(
                        value,
                      ) =>
                        update(
                          "postalCode",
                          value,
                        )
                      }
                      placeholder="00000"
                    />

                    <InputField
                      label="Country"
                      value={
                        form.country
                      }
                      onChange={(
                        value,
                      ) =>
                        update(
                          "country",
                          value,
                        )
                      }
                      placeholder="United Arab Emirates"
                    />
                  </div>
                </section>

                {/* Registration */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5">
                    <h2 className="text-base font-bold text-slate-900">
                      Registration &
                      Tax
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Optional company
                      registration
                      information.
                    </p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <InputField
                      label="Tax Registration Number / TRN"
                      value={
                        form.taxRegistrationNumber
                      }
                      onChange={(
                        value,
                      ) =>
                        update(
                          "taxRegistrationNumber",
                          value,
                        )
                      }
                      placeholder="e.g. 100xxxxxxxxx"
                    />

                    <InputField
                      label="Trade License Number"
                      value={
                        form.tradeLicenseNumber
                      }
                      onChange={(
                        value,
                      ) =>
                        update(
                          "tradeLicenseNumber",
                          value,
                        )
                      }
                      placeholder="License number"
                    />

                    <InputField
                      label="Legal Registration Type"
                      value={
                        form.legalRegistrationType
                      }
                      onChange={(
                        value,
                      ) =>
                        update(
                          "legalRegistrationType",
                          value,
                        )
                      }
                      placeholder="LLC / Sole Establishment / etc."
                    />

                    <InputField
                      label="Registration Authority"
                      value={
                        form.authorityName
                      }
                      onChange={(
                        value,
                      ) =>
                        update(
                          "authorityName",
                          value,
                        )
                      }
                      placeholder="DED / Free Zone / other"
                    />
                  </div>
                </section>

                {/* Plan */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5">
                    <h2 className="text-base font-bold text-slate-900">
                      Subscription
                      Plan
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Choose the plan
                      and billing
                      cycle for this
                      company.
                    </p>
                  </div>

                  {activePlans.length >
                  0 ? (
                    <>
                      <div className="grid gap-4 lg:grid-cols-3">
                        {activePlans.map(
                          (
                            plan,
                          ) => {
                            const selected =
                              form.planId ===
                              plan.id;

                            const price =
                              form.billingCycle ===
                              "monthly"
                                ? Number(
                                    plan.monthly_price ??
                                      0,
                                  )
                                : Number(
                                    plan.yearly_price ??
                                      0,
                                  );

                            return (
                              <button
                                key={
                                  plan.id
                                }
                                type="button"
                                onClick={() =>
                                  update(
                                    "planId",
                                    plan.id,
                                  )
                                }
                                className={[
                                  "relative rounded-2xl border p-5 text-left transition",
                                  selected
                                    ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/10"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
                                ].join(
                                  " ",
                                )}
                              >
                                {plan.is_popular ? (
                                  <span className="absolute right-4 top-4 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                    Popular
                                  </span>
                                ) : null}

                                <div
                                  className={[
                                    "mb-4 flex h-9 w-9 items-center justify-center rounded-lg",
                                    selected
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-100 text-slate-600",
                                  ].join(
                                    " ",
                                  )}
                                >
                                  {selected ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <ShieldCheck className="h-4 w-4" />
                                  )}
                                </div>

                                <p className="font-bold text-slate-900">
                                  {
                                    plan.name
                                  }
                                </p>

                                <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">
                                  {plan.description ||
                                    "SBS product business plan."}
                                </p>

                                <div className="mt-4">
                                  <span className="text-2xl font-bold text-slate-900">
                                    {formatMoney(
                                      price,
                                      plan.currency ||
                                        "USD",
                                      form.billingCycle,
                                    )}
                                  </span>
                                </div>
                              </button>
                            );
                          },
                        )}
                      </div>

                      <div className="mt-5 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                        <button
                          type="button"
                          onClick={() =>
                            update(
                              "billingCycle",
                              "monthly",
                            )
                          }
                          className={[
                            "rounded-lg px-4 py-2 text-sm font-semibold transition",
                            form.billingCycle ===
                            "monthly"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-700",
                          ].join(
                            " ",
                          )}
                        >
                          Monthly
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            update(
                              "billingCycle",
                              "yearly",
                            )
                          }
                          className={[
                            "rounded-lg px-4 py-2 text-sm font-semibold transition",
                            form.billingCycle ===
                            "yearly"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-700",
                          ].join(
                            " ",
                          )}
                        >
                          Yearly
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      No active
                      subscription
                      plans are
                      currently
                      available.
                    </div>
                  )}
                </section>

                {/* Trial */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Trial Period
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Give the company
                        temporary access
                        before billing
                        begins.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        update(
                          "trialEnabled",
                          !form.trialEnabled,
                        )
                      }
                      className={[
                        "relative h-6 w-11 shrink-0 rounded-full transition",
                        form.trialEnabled
                          ? "bg-emerald-600"
                          : "bg-slate-300",
                      ].join(
                        " ",
                      )}
                      aria-label="Toggle trial"
                    >
                      <span
                        className={[
                          "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition",
                          form.trialEnabled
                            ? "left-6"
                            : "left-1",
                        ].join(
                          " ",
                        )}
                      />
                    </button>
                  </div>

                  {form.trialEnabled ? (
                    <div className="mt-5 max-w-xs">
                      <InputField
                        label="Trial Days"
                        value={String(
                          form.trialDays,
                        )}
                        onChange={(
                          value,
                        ) =>
                          update(
                            "trialDays",
                            Math.max(
                              0,
                              Number(
                                value ||
                                  0,
                              ),
                            ),
                          )
                        }
                        type="number"
                        placeholder="14"
                      />
                    </div>
                  ) : null}
                </section>

                {/* Discount */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        <Percent className="h-5 w-5" />
                      </div>

                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Discount
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          Apply a real
                          billing discount
                          to this company.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        update(
                          "discountEnabled",
                          !form.discountEnabled,
                        )
                      }
                      className={[
                        "relative h-6 w-11 shrink-0 rounded-full transition",
                        form.discountEnabled
                          ? "bg-emerald-600"
                          : "bg-slate-300",
                      ].join(
                        " ",
                      )}
                      aria-label="Toggle discount"
                    >
                      <span
                        className={[
                          "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition",
                          form.discountEnabled
                            ? "left-6"
                            : "left-1",
                        ].join(
                          " ",
                        )}
                      />
                    </button>
                  </div>

                  {form.discountEnabled ? (
                    <div className="mt-6 space-y-5">
                      <div className="grid gap-5 md:grid-cols-2">
                        <InputField
                          label="Discount Name"
                          value={
                            form.discountName
                          }
                          onChange={(
                            value,
                          ) =>
                            update(
                              "discountName",
                              value,
                            )
                          }
                          placeholder="Beta Tester Discount"
                          icon={Tag}
                          required
                        />

                        <InputField
                          label="Promo Code"
                          value={
                            form.discountCode
                          }
                          onChange={(
                            value,
                          ) =>
                            update(
                              "discountCode",
                              value.toUpperCase(),
                            )
                          }
                          placeholder="BETA50"
                        />

                        <SelectField
                          label="Discount Type"
                          value={
                            form.discountType
                          }
                          onChange={(
                            value,
                          ) =>
                            update(
                              "discountType",
                              value as
                                | "percentage"
                                | "fixed",
                            )
                          }
                        >
                          <option value="percentage">
                            Percentage
                          </option>

                          <option value="fixed">
                            Fixed Amount
                          </option>
                        </SelectField>

                        <InputField
                          label={
                            form.discountType ===
                            "percentage"
                              ? "Discount Percentage"
                              : "Discount Amount"
                          }
                          value={
                            form.discountValue
                          }
                          onChange={(
                            value,
                          ) =>
                            update(
                              "discountValue",
                              value,
                            )
                          }
                          placeholder={
                            form.discountType ===
                            "percentage"
                              ? "50"
                              : "100"
                          }
                          type="number"
                          required
                        />

                        <SelectField
                          label="Duration"
                          value={
                            form.discountDuration
                          }
                          onChange={(
                            value,
                          ) =>
                            update(
                              "discountDuration",
                              value as FormState["discountDuration"],
                            )
                          }
                        >
                          <option value="one_month">
                            1 Month
                          </option>

                          <option value="three_months">
                            3 Months
                          </option>

                          <option value="six_months">
                            6 Months
                          </option>

                          <option value="twelve_months">
                            12 Months
                          </option>

                          <option value="lifetime">
                            Lifetime
                          </option>

                          <option value="custom">
                            Custom Expiry
                          </option>
                        </SelectField>

                        <SelectField
                          label="Billing Cycle"
                          value={
                            form.discountBillingCycle
                          }
                          onChange={(
                            value,
                          ) =>
                            update(
                              "discountBillingCycle",
                              value as FormState["discountBillingCycle"],
                            )
                          }
                        >
                          <option value="both">
                            Monthly & Yearly
                          </option>

                          <option value="monthly">
                            Monthly Only
                          </option>

                          <option value="yearly">
                            Yearly Only
                          </option>
                        </SelectField>

                        {form.discountDuration ===
                        "custom" ? (
                          <InputField
                            label="Custom Expiry"
                            value={
                              form.discountExpiresAt
                            }
                            onChange={(
                              value,
                            ) =>
                              update(
                                "discountExpiresAt",
                                value,
                              )
                            }
                            type="date"
                            required
                          />
                        ) : null}

                        <div className="md:col-span-2">
                          <label className="block">
                            <span className="mb-2 block text-[13px] font-semibold text-slate-700">
                              Internal
                              Reason
                            </span>

                            <textarea
                              value={
                                form.discountReason
                              }
                              onChange={(
                                event,
                              ) =>
                                update(
                                  "discountReason",
                                  event.target
                                    .value,
                                )
                              }
                              rows={3}
                              placeholder="Why was this discount granted?"
                              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                            />
                          </label>
                        </div>
                      </div>

                      {selectedPlan ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Billing Preview
                          </p>

                          <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                            <span className="text-sm text-slate-400 line-through">
                              {formatMoney(
                                pricing.original,
                                selectedPlan.currency ||
                                  "USD",
                                form.billingCycle,
                              )}
                            </span>

                            <span className="text-2xl font-bold text-slate-900">
                              {pricing.final ===
                              0
                                ? "FREE"
                                : formatMoney(
                                    pricing.final,
                                    selectedPlan.currency ||
                                      "USD",
                                    form.billingCycle,
                                  )}
                            </span>

                            <span className="text-sm font-semibold text-emerald-600">
                              Save{" "}
                              {formatMoney(
                                pricing.discount,
                                selectedPlan.currency ||
                                  "USD",
                                form.billingCycle,
                              )}
                            </span>
                          </div>

                          {form.discountType ===
                            "percentage" &&
                          Number(
                            form.discountValue,
                          ) === 100 ? (
                            <p className="mt-3 text-sm font-semibold text-emerald-700">
                              100% discount —
                              this company
                              will be free
                              for the
                              configured
                              discount
                              duration.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>

                {/* Messages */}
                {errorMessage ? (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <X className="mt-0.5 h-4 w-4 shrink-0" />

                    <span>
                      {
                        errorMessage
                      }
                    </span>
                  </div>
                ) : null}

                {successMessage ? (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />

                    <span>
                      {
                        successMessage
                      }
                    </span>
                  </div>
                ) : null}
              </form>
            </div>

            {/* Modal Footer */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
              <p className="hidden text-xs text-slate-400 sm:block">
                The owner will
                receive an email
                invitation after
                provisioning.
              </p>

              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  form="new-company-form"
                  disabled={
                    saving ||
                    activePlans.length ===
                      0
                  }
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Creating Company..."
                    : "Create Company"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}