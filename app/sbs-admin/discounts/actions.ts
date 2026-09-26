"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

function getString(
  formData: FormData,
  name: string,
) {
  return String(formData.get(name) ?? "").trim();
}

function parseDiscountData(formData: FormData) {
  const name = getString(formData, "name");
  const codeRaw = getString(formData, "code");
  const companyIdRaw = getString(formData, "company_id");
  const planIdRaw = getString(formData, "plan_id");

  const discountType = getString(
    formData,
    "discount_type",
  ) || "percentage";

  const discountValue = Number(
    formData.get("discount_value") ?? 0,
  );

  const durationType = getString(
    formData,
    "duration_type",
  ) || "lifetime";

  const durationValueRaw = getString(
    formData,
    "duration_value",
  );

  const durationUnitRaw = getString(
    formData,
    "duration_unit",
  );

  const billingCycleRaw = getString(
    formData,
    "billing_cycle",
  );

  const startsAtRaw = getString(
    formData,
    "starts_at",
  );

  const expiresAtRaw = getString(
    formData,
    "expires_at",
  );

  const maxRedemptionsRaw = getString(
    formData,
    "max_redemptions",
  );

  const reason = getString(
    formData,
    "reason",
  );

  if (!name) {
    throw new Error(
      "Discount name is required.",
    );
  }

  if (
    discountType !== "percentage" &&
    discountType !== "fixed"
  ) {
    throw new Error(
      "Invalid discount type.",
    );
  }

  if (
    !Number.isFinite(discountValue) ||
    discountValue < 0
  ) {
    throw new Error(
      "Discount value must be zero or greater.",
    );
  }

  if (
    discountType === "percentage" &&
    discountValue > 100
  ) {
    throw new Error(
      "Percentage discount cannot exceed 100%.",
    );
  }

  const validDurations = [
    "one_time",
    "one_month",
    "three_months",
    "six_months",
    "twelve_months",
    "lifetime",
    "custom",
  ];

  if (!validDurations.includes(durationType)) {
    throw new Error(
      "Invalid discount duration.",
    );
  }

  let durationValue:
    | number
    | null = null;

  let durationUnit:
    | "days"
    | "weeks"
    | "months"
    | "years"
    | null = null;

  if (durationType === "custom") {
    const parsedValue = Number(
      durationValueRaw,
    );

    if (
      !Number.isInteger(parsedValue) ||
      parsedValue <= 0
    ) {
      throw new Error(
        "Custom duration must be a positive whole number.",
      );
    }

    if (
      ![
        "days",
        "weeks",
        "months",
        "years",
      ].includes(durationUnitRaw)
    ) {
      throw new Error(
        "Invalid custom duration unit.",
      );
    }

    durationValue = parsedValue;

    durationUnit =
      durationUnitRaw as
        | "days"
        | "weeks"
        | "months"
        | "years";
  }

  let billingCycle:
    | "monthly"
    | "yearly"
    | null = null;

  if (
    billingCycleRaw === "monthly" ||
    billingCycleRaw === "yearly"
  ) {
    billingCycle = billingCycleRaw;
  }

  let maxRedemptions:
    | number
    | null = null;

  if (maxRedemptionsRaw) {
    const parsed = Number(
      maxRedemptionsRaw,
    );

    if (
      !Number.isInteger(parsed) ||
      parsed <= 0
    ) {
      throw new Error(
        "Maximum redemptions must be a positive whole number.",
      );
    }

    maxRedemptions = parsed;
  }

  const startsAt = startsAtRaw
    ? new Date(
        startsAtRaw,
      ).toISOString()
    : new Date().toISOString();

  const expiresAt = expiresAtRaw
    ? new Date(
        expiresAtRaw,
      ).toISOString()
    : null;

  if (
    expiresAt &&
    new Date(expiresAt).getTime() <
      new Date(startsAt).getTime()
  ) {
    throw new Error(
      "Expiration cannot be before the start date.",
    );
  }

  return {
    company_id:
      companyIdRaw || null,

    plan_id:
      planIdRaw || null,

    name,

    code:
      codeRaw
        ? codeRaw.toUpperCase()
        : null,

    discount_type:
      discountType,

    discount_value:
      discountValue,

    duration_type:
      durationType,

    starts_at:
      startsAt,

    expires_at:
      expiresAt,

    billing_cycle:
      billingCycle,

    reason:
      reason || null,

    duration_value:
      durationValue,

    duration_unit:
      durationUnit,

    max_redemptions:
      maxRedemptions,
  };
}

export async function createDiscount(
  formData: FormData,
) {
  const { user } =
    await requirePlatformAdmin();

  const supabase =
    await createClient();

  const data =
    parseDiscountData(formData);

  const { error } =
    await supabase
      .from("company_discounts")
      .insert({
        ...data,
        is_active: true,
        created_by: user.id,
        redemption_count: 0,
      });

  if (error) {
    throw new Error(
      error.message,
    );
  }

  revalidatePath(
    "/sbs-admin/discounts",
  );
}

export async function updateDiscount(
  formData: FormData,
) {
  await requirePlatformAdmin();

  const supabase =
    await createClient();

  const id = getString(
    formData,
    "id",
  );

  if (!id) {
    throw new Error(
      "Discount ID is required.",
    );
  }

  const data =
    parseDiscountData(formData);

  const { error } =
    await supabase
      .from("company_discounts")
      .update(data)
      .eq("id", id);

  if (error) {
    throw new Error(
      error.message,
    );
  }

  revalidatePath(
    "/sbs-admin/discounts",
  );
}

export async function toggleDiscount(
  formData: FormData,
) {
  await requirePlatformAdmin();

  const supabase =
    await createClient();

  const id = getString(
    formData,
    "id",
  );

  const nextStatus =
    getString(
      formData,
      "next_status",
    ) === "true";

  if (!id) {
    throw new Error(
      "Discount ID is required.",
    );
  }

  const { error } =
    await supabase
      .from("company_discounts")
      .update({
        is_active:
          nextStatus,
      })
      .eq("id", id);

  if (error) {
    throw new Error(
      error.message,
    );
  }

  revalidatePath(
    "/sbs-admin/discounts",
  );
}

export async function deleteDiscount(
  formData: FormData,
) {
  await requirePlatformAdmin();

  const supabase =
    await createClient();

  const id = getString(
    formData,
    "id",
  );

  if (!id) {
    throw new Error(
      "Discount ID is required.",
    );
  }

  const { error } =
    await supabase
      .from("company_discounts")
      .delete()
      .eq("id", id);

  if (error) {
    throw new Error(
      error.message,
    );
  }

  revalidatePath(
    "/sbs-admin/discounts",
  );
}